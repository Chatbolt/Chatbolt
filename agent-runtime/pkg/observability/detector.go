package observability

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"
)

// SupervisorAlertHandler is called when a finding requires supervisor escalation/reassignment
type SupervisorAlertHandler func(teamID, agentID, runID, reason string, finding Finding) error

// Engine runs deterministic detection rules against ingesting events and background sweeps
type Engine struct {
	config       DetectionConfig
	store        *Store
	mu           sync.RWMutex
	alertHandler SupervisorAlertHandler
	stopCh       chan struct{}
}

// NewEngine creates a new detection rules engine
func NewEngine(cfg DetectionConfig, store *Store, alertHandler SupervisorAlertHandler) *Engine {
	return &Engine{
		config:       cfg,
		store:        store,
		alertHandler: alertHandler,
		stopCh:       make(chan struct{}),
	}
}

// Start launches the periodic sweep background worker
func (e *Engine) Start() {
	sweepInterval := time.Duration(e.config.SweepIntervalSeconds) * time.Second
	if sweepInterval <= 0 {
		sweepInterval = 10 * time.Second
	}

	go func() {
		ticker := time.NewTicker(sweepInterval)
		defer ticker.Stop()

		for {
			select {
			case <-e.stopCh:
				return
			case <-ticker.C:
				e.RunPeriodicSweep()
			}
		}
	}()
}

// Stop terminates the periodic sweep
func (e *Engine) Stop() {
	close(e.stopCh)
}

// EvaluateSpanOnIngest runs fast deterministic checks on span ingestion
func (e *Engine) EvaluateSpanOnIngest(span *Span) {
	// 1. Check long_running span
	if span.DurationMs > e.config.LongRunningSpanMs && span.Status != SpanStatusInProgress {
		finding := Finding{
			ID:       fmt.Sprintf("find_span_dur_%s", span.ID),
			RunID:    span.RunID,
			SpanID:   span.ID,
			Type:     FindingLongRunning,
			Severity: SeverityMedium,
			Message:  fmt.Sprintf("Span '%s' [%s] exceeded duration threshold (%dms > %dms)", span.Name, span.Type, span.DurationMs, e.config.LongRunningSpanMs),
			Details: map[string]interface{}{
				"span_id":     span.ID,
				"span_name":   span.Name,
				"span_type":   span.Type,
				"duration_ms": span.DurationMs,
				"threshold":   e.config.LongRunningSpanMs,
			},
			CreatedAt: time.Now(),
		}
		e.store.SaveFinding(finding)
	}

	// 2. Check repeated_tool and possible_loop on all spans for this run
	spans := e.store.GetRunSpans(span.RunID)
	if len(spans) >= 3 {
		e.checkRepeatedTool(span.RunID, spans)
		e.checkPossibleLoop(span.RunID, spans)
	}
}

// EvaluateErrorOnIngest runs checks when a new error is recorded
func (e *Engine) EvaluateErrorOnIngest(errRec ErrorRecord) {
	// Check repeated_error threshold
	sig := errRec.ErrorSignature
	if sig == "" {
		sig = ComputeErrorSignature(errRec.Type, errRec.Message)
	}

	_, list := e.store.GetErrorSignatureDetail(sig)
	if len(list) >= e.config.RepeatedErrorThreshold {
		finding := Finding{
			ID:          fmt.Sprintf("find_rep_err_%s_%d", sig, time.Now().UnixNano()),
			RunID:       errRec.RunID,
			SpanID:      errRec.SpanID,
			Type:        FindingRepeatedError,
			Severity:    SeverityHigh,
			Message:     fmt.Sprintf("Error signature '%s' occurred %d times across runs: %s", sig, len(list), errRec.Message),
			Details: map[string]interface{}{
				"error_signature": sig,
				"error_type":      errRec.Type,
				"count":           len(list),
				"threshold":       e.config.RepeatedErrorThreshold,
				"agent_role":      errRec.AgentRole,
			},
			ActionTaken: "escalate",
			CreatedAt:   time.Now(),
		}
		e.store.SaveFinding(finding)

		// Trigger active recovery path (supervisor escalation)
		if e.alertHandler != nil {
			run, _ := e.store.GetRun(errRec.RunID)
			teamID := ""
			agentID := ""
			if run != nil {
				teamID = run.TeamID
				agentID = run.AgentID
			}
			_ = e.alertHandler(teamID, agentID, errRec.RunID, "Repeated failure signature detected across tasks", finding)
		}
	}
}

// checkRepeatedTool checks if the same tool has been invoked N times in one run
func (e *Engine) checkRepeatedTool(runID string, spans []*Span) {
	toolCounts := make(map[string]int)
	for _, s := range spans {
		if s.Type == SpanTypeTool && s.Name != "" {
			toolCounts[s.Name]++
		}
	}

	for toolName, count := range toolCounts {
		if count >= e.config.RepeatedToolThreshold {
			// Avoid spamming duplicate findings
			existingFindings := e.store.GetRunFindings(runID)
			alreadyReported := false
			for _, ef := range existingFindings {
				if ef.Type == FindingRepeatedTool && ef.Details["tool_name"] == toolName {
					alreadyReported = true
					break
				}
			}

			if !alreadyReported {
				finding := Finding{
					ID:          fmt.Sprintf("find_tool_%s_%s", runID, toolName),
					RunID:       runID,
					Type:        FindingRepeatedTool,
					Severity:    SeverityHigh,
					Message:     fmt.Sprintf("Tool '%s' invoked %d times without goal completion (threshold: %d) — agent may be flailing", toolName, count, e.config.RepeatedToolThreshold),
					Details: map[string]interface{}{
						"tool_name": toolName,
						"count":     count,
						"threshold": e.config.RepeatedToolThreshold,
					},
					ActionTaken: "reassign",
					CreatedAt:   time.Now(),
				}
				e.store.SaveFinding(finding)

				if e.alertHandler != nil {
					run, _ := e.store.GetRun(runID)
					teamID := ""
					agentID := ""
					if run != nil {
						teamID = run.TeamID
						agentID = run.AgentID
					}
					_ = e.alertHandler(teamID, agentID, runID, fmt.Sprintf("Agent repeatedly calling tool '%s' without progress", toolName), finding)
				}
			}
		}
	}
}

// checkPossibleLoop detects recurring cycles in tool invocation sequence & payload hashes
func (e *Engine) checkPossibleLoop(runID string, spans []*Span) {
	// Extract tool sequence tokens: hash(tool_name + input_fingerprint)
	type toolInvocation struct {
		Name        string
		Fingerprint string
	}

	var invocations []toolInvocation
	for _, s := range spans {
		if s.Type == SpanTypeTool || s.Type == SpanTypeLLM {
			fp := computeInputFingerprint(s.Input)
			invocations = append(invocations, toolInvocation{
				Name:        s.Name,
				Fingerprint: fp,
			})
		}
	}

	if len(invocations) < 4 {
		return
	}

	// Detect period 1 loop: A -> A -> A
	n := len(invocations)
	if n >= 3 {
		last1 := invocations[n-1]
		last2 := invocations[n-2]
		last3 := invocations[n-3]
		if last1.Name == last2.Name && last2.Name == last3.Name && last1.Fingerprint == last2.Fingerprint && last2.Fingerprint == last3.Fingerprint {
			e.emitLoopFinding(runID, fmt.Sprintf("Single-step cycle detected: '%s' invoked 3x consecutively with identical input", last1.Name), 1, last1.Name)
			return
		}
	}

	// Detect period 2 loop: A -> B -> A -> B
	if n >= 4 {
		a1 := invocations[n-4]
		b1 := invocations[n-3]
		a2 := invocations[n-2]
		b2 := invocations[n-1]

		if a1.Name == a2.Name && b1.Name == b2.Name && a1.Fingerprint == a2.Fingerprint && b1.Fingerprint == b2.Fingerprint {
			e.emitLoopFinding(runID, fmt.Sprintf("Two-step alternating cycle detected: [%s -> %s] repeating with identical inputs", a1.Name, b1.Name), 2, fmt.Sprintf("%s, %s", a1.Name, b1.Name))
			return
		}
	}

	// Detect period 3 loop: A -> B -> C -> A -> B -> C
	if n >= 6 {
		a1, b1, c1 := invocations[n-6], invocations[n-5], invocations[n-4]
		a2, b2, c2 := invocations[n-3], invocations[n-2], invocations[n-1]

		if a1.Name == a2.Name && b1.Name == b2.Name && c1.Name == c2.Name &&
			a1.Fingerprint == a2.Fingerprint && b1.Fingerprint == b2.Fingerprint && c1.Fingerprint == c2.Fingerprint {
			e.emitLoopFinding(runID, fmt.Sprintf("Three-step cycle detected: [%s -> %s -> %s] repeating deterministically", a1.Name, b1.Name, c1.Name), 3, fmt.Sprintf("%s, %s, %s", a1.Name, b1.Name, c1.Name))
			return
		}
	}
}

func (e *Engine) emitLoopFinding(runID, message string, period int, pattern string) {
	existingFindings := e.store.GetRunFindings(runID)
	for _, ef := range existingFindings {
		if ef.Type == FindingPossibleLoop {
			return // Already alerted
		}
	}

	finding := Finding{
		ID:          fmt.Sprintf("find_loop_%s_%d", runID, time.Now().UnixNano()),
		RunID:       runID,
		Type:        FindingPossibleLoop,
		Severity:    SeverityCritical,
		Message:     message,
		Details: map[string]interface{}{
			"period":  period,
			"pattern": pattern,
		},
		ActionTaken: "alert_supervisor",
		CreatedAt:   time.Now(),
	}
	e.store.SaveFinding(finding)

	// Trigger immediate active recovery
	if e.alertHandler != nil {
		run, _ := e.store.GetRun(runID)
		teamID := ""
		agentID := ""
		if run != nil {
			teamID = run.TeamID
			agentID = run.AgentID
		}
		_ = e.alertHandler(teamID, agentID, runID, fmt.Sprintf("Autonomous agent stuck in reasoning/tool cycle: %s", message), finding)
	}
}

// RunPeriodicSweep executes background sweeps across all active runs
func (e *Engine) RunPeriodicSweep() {
	activeRuns := e.store.GetActiveRuns()
	now := time.Now()

	for _, run := range activeRuns {
		// 1. Check long_running run
		runDuration := now.Sub(run.StartedAt).Milliseconds()
		if runDuration > e.config.LongRunningRunMs {
			existing := e.store.GetRunFindings(run.ID)
			found := false
			for _, f := range existing {
				if f.Type == FindingLongRunning && f.SpanID == "" {
					found = true
					break
				}
			}

			if !found {
				finding := Finding{
					ID:       fmt.Sprintf("find_run_dur_%s", run.ID),
					RunID:    run.ID,
					Type:     FindingLongRunning,
					Severity: SeverityMedium,
					Message:  fmt.Sprintf("Run '%s' duration (%dms) exceeded configured threshold (%dms)", run.ID, runDuration, e.config.LongRunningRunMs),
					Details: map[string]interface{}{
						"duration_ms": runDuration,
						"threshold":   e.config.LongRunningRunMs,
						"agent_role":  run.AgentRole,
					},
					CreatedAt: now,
				}
				e.store.SaveFinding(finding)
			}
		}

		// 2. Check no_activity (silent agent)
		lastActivity := run.LastActivityAt
		if lastActivity.IsZero() {
			lastActivity = run.StartedAt
		}

		silentSec := int64(now.Sub(lastActivity).Seconds())
		if silentSec >= e.config.NoActivitySeconds {
			existing := e.store.GetRunFindings(run.ID)
			found := false
			for _, f := range existing {
				if f.Type == FindingNoActivity {
					found = true
					break
				}
			}

			if !found {
				finding := Finding{
					ID:          fmt.Sprintf("find_noact_%s", run.ID),
					RunID:       run.ID,
					Type:        FindingNoActivity,
					Severity:    SeverityHigh,
					Message:     fmt.Sprintf("Agent '%s' in run '%s' has shown no span/log activity for %ds (threshold: %ds) — possible hung process", run.AgentRole, run.ID, silentSec, e.config.NoActivitySeconds),
					Details: map[string]interface{}{
						"silent_seconds": silentSec,
						"threshold":      e.config.NoActivitySeconds,
						"agent_role":     run.AgentRole,
					},
					ActionTaken: "escalate",
					CreatedAt:   now,
				}
				e.store.SaveFinding(finding)

				// Mark run status as stuck if severe
				if silentSec >= e.config.NoActivitySeconds*2 {
					run.Status = "stuck"
					e.store.SaveRun(run)
				}

				if e.alertHandler != nil {
					_ = e.alertHandler(run.TeamID, run.AgentID, run.ID, "Agent runtime process is silent/hung", finding)
				}
			}
		}
	}
}

// Helper to compute a stable SHA256 input fingerprint
func computeInputFingerprint(input interface{}) string {
	if input == nil {
		return "nil"
	}
	b, err := json.Marshal(input)
	if err != nil {
		return fmt.Sprintf("%v", input)
	}
	hash := sha256.Sum256(b)
	return hex.EncodeToString(hash[:6])
}

// UpdateConfig updates detection thresholds dynamically at runtime
func (e *Engine) UpdateConfig(cfg DetectionConfig) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.config = cfg
	log.Printf("[ObservabilityEngine] Updated detection config: %+v", cfg)
}

// GetConfig returns current detection thresholds
func (e *Engine) GetConfig() DetectionConfig {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.config
}
