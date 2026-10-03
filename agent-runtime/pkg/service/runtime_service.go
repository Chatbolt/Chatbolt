package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"agent-runtime/pkg/bus"
	"agent-runtime/pkg/circuitbreaker"
	"agent-runtime/pkg/concurrency"
	"agent-runtime/pkg/metrics"
	"agent-runtime/pkg/observability"
	"agent-runtime/pkg/sandbox"
)

type RuntimeService struct {
	pool           *concurrency.WorkerPool
	sandboxExec    *sandbox.Executor
	diffPatcher    *sandbox.DiffPatcher
	bus            *bus.AgentBus
	circuitBreaker *circuitbreaker.Registry
	metrics        *metrics.Collector
	obsStore       *observability.Store
	obsTracer      *observability.Tracer
	obsDetector    *observability.Engine
	obsHTTP        *observability.HTTPHandler
	mu             sync.RWMutex
}

func NewRuntimeService(
	pool *concurrency.WorkerPool,
	exec *sandbox.Executor,
	agentBus *bus.AgentBus,
	cb *circuitbreaker.Registry,
	col *metrics.Collector,
) *RuntimeService {
	// Initialize high-performance in-memory observability store
	obsStore := observability.NewStore("")

	// Initialize detection rules engine with supervisor alert recovery hook
	obsDetector := observability.NewEngine(
		observability.DefaultDetectionConfig(),
		obsStore,
		func(teamID, agentID, runID, reason string, finding observability.Finding) error {
			// Wire detection findings directly into failure recovery paths
			payloadBytes, _ := json.Marshal(finding)
			_, err := agentBus.Publish(&bus.Message{
				TargetTopic:   "supervisor:alert",
				RunID:         runID,
				SenderAgentID: agentID,
				EventType:     "observability_finding_alert",
				PayloadJSON:   string(payloadBytes),
				TimestampMs:   time.Now().UnixMilli(),
			})
			return err
		},
	)
	obsDetector.Start()

	obsTracer := observability.NewTracer(obsStore, obsDetector)
	obsHTTP := observability.NewHTTPHandler(obsStore, obsTracer, obsDetector)

	return &RuntimeService{
		pool:           pool,
		sandboxExec:    exec,
		diffPatcher:    sandbox.NewDiffPatcher(),
		bus:            agentBus,
		circuitBreaker: cb,
		metrics:        col,
		obsStore:       obsStore,
		obsTracer:      obsTracer,
		obsDetector:    obsDetector,
		obsHTTP:        obsHTTP,
	}
}

// ExecuteSandboxCode runs sandboxed code inside the bounded worker pool and protected by circuit breaker
func (s *RuntimeService) ExecuteSandboxCode(ctx context.Context, opts sandbox.ExecutionOptions) (*sandbox.ExecutionResult, error) {
	// Create Observability Span for Sandbox Execution
	runID := opts.RunID
	if runID == "" {
		runID = fmt.Sprintf("run_sb_%s", opts.ExecutionID)
	}
	_, span := s.obsTracer.StartSpan(ctx, runID, "", fmt.Sprintf("sandbox:%s", opts.Language), observability.SpanTypeSandbox, opts.Code, map[string]interface{}{
		"language":     opts.Language,
		"execution_id": opts.ExecutionID,
		"timeout_sec":  opts.TimeoutSeconds,
	})

	// 1. Circuit breaker check for sandbox
	allowed, err := s.circuitBreaker.Allow("sandbox")
	if !allowed {
		res := &sandbox.ExecutionResult{
			ExecutionID:   opts.ExecutionID,
			Success:       false,
			ExitCode:      503,
			Stderr:        fmt.Sprintf("Sandbox execution circuit breaker is OPEN: %v", err),
			IsolationMode: "circuit_broken",
		}
		s.obsTracer.EndSpan(span, observability.SpanStatusError, res, fmt.Errorf("circuit breaker open"))
		return res, nil
	}

	// 2. Submit to bounded worker pool
	taskID := fmt.Sprintf("sandbox-%s", opts.ExecutionID)
	resultVal, err := s.pool.SubmitSync(ctx, taskID, func(taskCtx context.Context) (interface{}, error) {
		return s.sandboxExec.ExecuteCode(taskCtx, opts)
	})

	if err != nil {
		s.circuitBreaker.RecordFailure("sandbox")
		s.obsTracer.EndSpan(span, observability.SpanStatusError, nil, err)
		return nil, fmt.Errorf("worker pool execution error: %w", err)
	}

	res, ok := resultVal.(*sandbox.ExecutionResult)
	if !ok || res == nil {
		s.circuitBreaker.RecordFailure("sandbox")
		s.obsTracer.EndSpan(span, observability.SpanStatusError, nil, fmt.Errorf("invalid execution result"))
		return nil, fmt.Errorf("invalid execution result returned")
	}

	// Record success/failure in circuit breaker & observability
	if res.Success {
		s.circuitBreaker.RecordSuccess("sandbox")
		s.obsTracer.EndSpan(span, observability.SpanStatusOk, res, nil)
	} else {
		s.circuitBreaker.RecordFailure("sandbox")
		s.obsTracer.EndSpan(span, observability.SpanStatusError, res, fmt.Errorf("%s", res.Stderr))
	}

	return res, nil
}

// ExecuteAgentStep executes a single agent step with circuit breaking per agent role
func (s *RuntimeService) ExecuteAgentStep(
	ctx context.Context,
	runID, stepID, tenantID, agentID, role, actionType, payloadJSON string,
	timeoutSec int,
	statusCh chan<- map[string]interface{},
) error {
	defer close(statusCh)

	// Start Observability Agent Span
	_, span := s.obsTracer.StartSpan(ctx, runID, "", fmt.Sprintf("step:%s:%s", role, actionType), observability.SpanTypeAgent, payloadJSON, map[string]interface{}{
		"step_id":     stepID,
		"agent_id":    agentID,
		"agent_role":  role,
		"action_type": actionType,
		"tenant_id":   tenantID,
	})

	// 1. Check circuit breaker for this specific agent role
	roleKey := fmt.Sprintf("role:%s", role)
	allowed, err := s.circuitBreaker.Allow(roleKey)
	if !allowed {
		errMsg := fmt.Sprintf("Circuit breaker is OPEN for agent role '%s': %v", role, err)
		statusCh <- map[string]interface{}{
			"run_id":        runID,
			"step_id":       stepID,
			"status":        "CIRCUIT_BROKEN",
			"error_message": errMsg,
			"timestamp_ms":  time.Now().UnixMilli(),
		}
		s.obsTracer.EndSpan(span, observability.SpanStatusError, nil, fmt.Errorf("%s", errMsg))
		return nil
	}

	// Emit QUEUED
	statusCh <- map[string]interface{}{
		"run_id":       runID,
		"step_id":      stepID,
		"status":       "QUEUED",
		"timestamp_ms": time.Now().UnixMilli(),
	}

	taskID := fmt.Sprintf("step-%s-%s", runID, stepID)
	_, execErr := s.pool.SubmitSync(ctx, taskID, func(taskCtx context.Context) (interface{}, error) {
		// Emit RUNNING
		statusCh <- map[string]interface{}{
			"run_id":       runID,
			"step_id":      stepID,
			"status":       "RUNNING",
			"timestamp_ms": time.Now().UnixMilli(),
		}

		// If action involves code execution, delegate to sandbox
		if strings.Contains(actionType, "code") || strings.Contains(actionType, "sandbox") || strings.Contains(actionType, "python") {
			var payload struct {
				Code     string `json:"code"`
				Language string `json:"language"`
			}
			_ = json.Unmarshal([]byte(payloadJSON), &payload)

			if payload.Language == "" {
				payload.Language = "javascript"
			}

			execRes, err := s.sandboxExec.ExecuteCode(taskCtx, sandbox.ExecutionOptions{
				ExecutionID:    fmt.Sprintf("%s-%s", runID, stepID),
				RunID:          runID,
				Language:       payload.Language,
				Code:           payload.Code,
				TimeoutSeconds: timeoutSec,
			})

			if err != nil || (execRes != nil && !execRes.Success) {
				s.circuitBreaker.RecordFailure(roleKey)
				errMsg := "sandbox execution failed"
				if err != nil {
					errMsg = err.Error()
				} else if execRes != nil {
					errMsg = execRes.Stderr
				}
				statusCh <- map[string]interface{}{
					"run_id":        runID,
					"step_id":       stepID,
					"status":        "FAILED",
					"error_message": errMsg,
					"timestamp_ms":  time.Now().UnixMilli(),
				}
				s.obsTracer.EndSpan(span, observability.SpanStatusError, nil, fmt.Errorf("%s", errMsg))
				return nil, fmt.Errorf("%s", errMsg)
			}

			resBytes, _ := json.Marshal(execRes)
			statusCh <- map[string]interface{}{
				"run_id":       runID,
				"step_id":      stepID,
				"status":       "COMPLETED",
				"result_json":  string(resBytes),
				"timestamp_ms": time.Now().UnixMilli(),
			}
			s.circuitBreaker.RecordSuccess(roleKey)
			s.obsTracer.EndSpan(span, observability.SpanStatusOk, string(resBytes), nil)
			return execRes, nil
		}

		// Generic agent step simulation
		time.Sleep(50 * time.Millisecond) // Simulated compute cycle
		statusCh <- map[string]interface{}{
			"run_id":       runID,
			"step_id":      stepID,
			"status":       "COMPLETED",
			"result_json":  `{"status":"success","step_completed":true}`,
			"timestamp_ms": time.Now().UnixMilli(),
		}
		s.circuitBreaker.RecordSuccess(roleKey)
		s.obsTracer.EndSpan(span, observability.SpanStatusOk, `{"status":"success"}`, nil)
		return nil, nil
	})

	if execErr != nil {
		s.circuitBreaker.RecordFailure(roleKey)
		s.obsTracer.EndSpan(span, observability.SpanStatusError, nil, execErr)
	}

	return execErr
}

// HTTP API Handlers for seamless REST/SSE integration with Node.js and tests

func (s *RuntimeService) RegisterHTTPRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/metrics", s.handleMetrics)
	mux.HandleFunc("/api/circuit-breaker", s.handleCircuitBreaker)
	mux.HandleFunc("/api/sandbox/exec", s.handleSandboxExec)
	mux.HandleFunc("/api/sandbox/apply_diff", s.handleApplyDiff)
	mux.HandleFunc("/api/agent/step", s.handleAgentStep)
	mux.HandleFunc("/api/bus/publish", s.handleBusPublish)
	mux.HandleFunc("/api/bus/subscribe", s.handleBusSubscribe)

	// Attach full OpenTelemetry OTLP & Observability endpoints
	s.obsHTTP.RegisterRoutes(mux)
}

func (s *RuntimeService) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"service":   "agent-runtime",
		"version":   "1.0.0",
		"timestamp": time.Now().UnixMilli(),
	})
}

func (s *RuntimeService) handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	metricsData := s.metrics.Collect()
	_ = json.NewEncoder(w).Encode(metricsData)
}

func (s *RuntimeService) handleCircuitBreaker(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	states := s.circuitBreaker.GetAllStates()
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"states": states,
	})
}

func (s *RuntimeService) handleSandboxExec(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req sandbox.ExecutionOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	if req.ExecutionID == "" {
		req.ExecutionID = fmt.Sprintf("exec-%d", time.Now().UnixNano())
	}

	res, err := s.ExecuteSandboxCode(r.Context(), req)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (s *RuntimeService) handleAgentStep(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		RunID          string `json:"run_id"`
		StepID         string `json:"step_id"`
		TenantID       string `json:"tenant_id"`
		AgentID        string `json:"agent_id"`
		AgentRole      string `json:"agent_role"`
		ActionType     string `json:"action_type"`
		PayloadJSON    string `json:"payload_json"`
		TimeoutSeconds int    `json:"timeout_seconds"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	if req.TimeoutSeconds <= 0 {
		req.TimeoutSeconds = 30
	}

	// Check if SSE streaming is requested
	if strings.Contains(r.Header.Get("Accept"), "text/event-stream") {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
			return
		}

		statusCh := make(chan map[string]interface{}, 10)
		go func() {
			_ = s.ExecuteAgentStep(r.Context(), req.RunID, req.StepID, req.TenantID, req.AgentID, req.AgentRole, req.ActionType, req.PayloadJSON, req.TimeoutSeconds, statusCh)
		}()

		for update := range statusCh {
			data, _ := json.Marshal(update)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
		return
	}

	// Synchronous HTTP response
	statusCh := make(chan map[string]interface{}, 10)
	var finalUpdate map[string]interface{}

	done := make(chan struct{})
	go func() {
		for update := range statusCh {
			finalUpdate = update
		}
		close(done)
	}()

	_ = s.ExecuteAgentStep(r.Context(), req.RunID, req.StepID, req.TenantID, req.AgentID, req.AgentRole, req.ActionType, req.PayloadJSON, req.TimeoutSeconds, statusCh)
	<-done

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(finalUpdate)
}

func (s *RuntimeService) handleBusPublish(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var msg bus.Message
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	delivered, err := s.bus.Publish(&msg)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"message_id":       msg.MessageID,
		"delivered":        delivered > 0,
		"subscriber_count": delivered,
	})
}

func (s *RuntimeService) handleBusSubscribe(w http.ResponseWriter, r *http.Request) {
	topicsParam := r.URL.Query().Get("topics")
	if topicsParam == "" {
		topicsParam = "*"
	}
	topics := strings.Split(topicsParam, ",")
	subID := fmt.Sprintf("sub-%d", time.Now().UnixNano())

	sub := s.bus.Subscribe(subID, topics)
	defer s.bus.Unsubscribe(subID)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-sub.Channel:
			if !ok {
				return
			}
			data, _ := json.Marshal(msg)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

// GetRuntimeBus returns the in-memory bus instance
func (s *RuntimeService) GetRuntimeBus() *bus.AgentBus {
	return s.bus
}

// GetWorkerPool returns the bounded worker pool instance
func (s *RuntimeService) GetWorkerPool() *concurrency.WorkerPool {
	return s.pool
}

// GetCircuitBreaker returns the circuit breaker registry
func (s *RuntimeService) GetCircuitBreaker() *circuitbreaker.Registry {
	return s.circuitBreaker
}

// GetMetricsCollector returns the metrics collector
func (s *RuntimeService) GetMetricsCollector() *metrics.Collector {
	return s.metrics
}

// GetSandboxExecutor returns the sandbox executor
func (s *RuntimeService) GetSandboxExecutor() *sandbox.Executor {
	return s.sandboxExec
}

// GetDiffPatcher returns the diff patcher instance
func (s *RuntimeService) GetDiffPatcher() *sandbox.DiffPatcher {
	return s.diffPatcher
}

func (s *RuntimeService) handleApplyDiff(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req sandbox.ApplyDiffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	sandboxRoot := s.sandboxExec.GetSandboxRoot()
	res, err := s.diffPatcher.ApplyDiff(sandboxRoot, req)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if !res.Success {
		w.WriteHeader(http.StatusUnprocessableEntity)
	}
	_ = json.NewEncoder(w).Encode(res)
}

