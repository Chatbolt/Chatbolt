package observability

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// HTTPHandler exposes REST and OTLP endpoints for observability
type HTTPHandler struct {
	store    *Store
	tracer   *Tracer
	detector *Engine
}

// NewHTTPHandler creates the HTTP handler wrapper
func NewHTTPHandler(store *Store, tracer *Tracer, detector *Engine) *HTTPHandler {
	return &HTTPHandler{
		store:    store,
		tracer:   tracer,
		detector: detector,
	}
}

// RegisterRoutes attaches all observability endpoints to ServeMux
func (h *HTTPHandler) RegisterRoutes(mux *http.ServeMux) {
	// Standard OpenTelemetry OTLP Ingest
	mux.HandleFunc("/v1/traces", h.handleOTLPTraces)
	mux.HandleFunc("/v1/logs", h.handleOTLPLogs)

	// Custom Chatbolt Observability API
	mux.HandleFunc("/api/observability/runs", h.handleRuns)
	mux.HandleFunc("/api/observability/runs/", h.handleRunDetail)
	mux.HandleFunc("/api/observability/errors", h.handleErrors)
	mux.HandleFunc("/api/observability/findings", h.handleFindings)
	mux.HandleFunc("/api/observability/stream", h.handleSSEStream)
	mux.HandleFunc("/api/observability/config", h.handleConfig)
}

// OTLP standard trace ingestion
func (h *HTTPHandler) handleOTLPTraces(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var otlpReq struct {
		ResourceSpans []struct {
			Resource struct {
				Attributes []struct {
					Key   string      `json:"key"`
					Value interface{} `json:"value"`
				} `json:"attributes"`
			} `json:"resource"`
			ScopeSpans []struct {
				Spans []struct {
					TraceID           string `json:"traceId"`
					SpanID            string `json:"spanId"`
					ParentSpanID      string `json:"parentSpanId"`
					Name              string `json:"name"`
					Kind              int    `json:"kind"`
					StartTimeUnixNano int64  `json:"startTimeUnixNano"`
					EndTimeUnixNano   int64  `json:"endTimeUnixNano"`
					Attributes        []struct {
						Key   string      `json:"key"`
						Value interface{} `json:"value"`
					} `json:"attributes"`
					Status struct {
						Code    int    `json:"code"`
						Message string `json:"message"`
					} `json:"status"`
				} `json:"spans"`
			} `json:"scopeSpans"`
		} `json:"resourceSpans"`
	}

	if err := json.NewDecoder(r.Body).Decode(&otlpReq); err != nil {
		http.Error(w, fmt.Sprintf("Invalid OTLP JSON: %v", err), http.StatusBadRequest)
		return
	}

	for _, rs := range otlpReq.ResourceSpans {
		serviceName := "agent"
		for _, attr := range rs.Resource.Attributes {
			if attr.Key == "service.name" {
				serviceName = fmt.Sprintf("%v", attr.Value)
			}
		}

		for _, ss := range rs.ScopeSpans {
			for _, sp := range ss.Spans {
				runID := fmt.Sprintf("run_%s", sp.TraceID[:8])
				spanType := SpanTypeTool
				if strings.Contains(strings.ToLower(sp.Name), "llm") || strings.Contains(strings.ToLower(sp.Name), "chat") {
					spanType = SpanTypeLLM
				} else if strings.Contains(strings.ToLower(sp.Name), "agent") {
					spanType = SpanTypeAgent
				} else if strings.Contains(strings.ToLower(sp.Name), "handoff") {
					spanType = SpanTypeHandoff
				} else if strings.Contains(strings.ToLower(sp.Name), "escalat") {
					spanType = SpanTypeEscalation
				}

				start := time.Unix(0, sp.StartTimeUnixNano)
				var end *time.Time
				dur := int64(0)
				if sp.EndTimeUnixNano > 0 {
					t := time.Unix(0, sp.EndTimeUnixNano)
					end = &t
					dur = t.Sub(start).Milliseconds()
				}

				spanStatus := SpanStatusOk
				if sp.Status.Code == 2 { // OTel Error code
					spanStatus = SpanStatusError
				}

				attrsMap := make(map[string]interface{})
				for _, a := range sp.Attributes {
					attrsMap[a.Key] = a.Value
					if a.Key == "chatbolt.run_id" {
						runID = fmt.Sprintf("%v", a.Value)
					}
					if a.Key == "chatbolt.span_type" {
						spanType = SpanType(fmt.Sprintf("%v", a.Value))
					}
				}
				attrsMap["service_name"] = serviceName

				spanObj := &Span{
					ID:           sp.SpanID,
					RunID:        runID,
					ParentID:     sp.ParentSpanID,
					TraceID:      sp.TraceID,
					Type:         spanType,
					Name:         sp.Name,
					Status:       spanStatus,
					StartedAt:    start,
					EndedAt:      end,
					DurationMs:   dur,
					ErrorMessage: sp.Status.Message,
					Metadata:     attrsMap,
				}

				h.store.SaveSpan(spanObj)
				if h.detector != nil {
					h.detector.EvaluateSpanOnIngest(spanObj)
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"success","received":true}`))
}

// OTLP logs ingestion
func (h *HTTPHandler) handleOTLPLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"success"}`))
}

// REST: /api/observability/runs
func (h *HTTPHandler) handleRuns(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var req struct {
			RunID       string                 `json:"run_id"`
			TenantID    string                 `json:"tenant_id"`
			AgentID     string                 `json:"agent_id"`
			AgentRole   string                 `json:"agent_role"`
			TeamID      string                 `json:"team_id"`
			TeamName    string                 `json:"team_name"`
			MissionGoal string                 `json:"mission_goal"`
			Metadata    map[string]interface{} `json:"metadata"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		run := h.tracer.StartRun(req.RunID, req.TenantID, req.AgentID, req.AgentRole, req.TeamID, req.TeamName, req.MissionGoal, req.Metadata)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(run)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 50
	}
	status := r.URL.Query().Get("status")
	role := r.URL.Query().Get("role")

	runs := h.store.ListRuns(limit, status, role)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"runs":  runs,
		"total": len(runs),
	})
}

// REST: /api/observability/runs/{id}
func (h *HTTPHandler) handleRunDetail(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/observability/runs/")
	parts := strings.Split(path, "/")
	runID := parts[0]

	if runID == "" {
		http.Error(w, "Missing run ID", http.StatusBadRequest)
		return
	}

	run, ok := h.store.GetRun(runID)
	if !ok {
		http.Error(w, "Run not found", http.StatusNotFound)
		return
	}

	spans := h.store.GetRunSpans(runID)
	logs := h.store.GetRunLogs(runID)
	findings := h.store.GetRunFindings(runID)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"run":      run,
		"spans":    spans,
		"logs":     logs,
		"findings": findings,
	})
}

// REST: /api/observability/errors
func (h *HTTPHandler) handleErrors(w http.ResponseWriter, r *http.Request) {
	sig := r.URL.Query().Get("signature")
	if sig != "" {
		group, details := h.store.GetErrorSignatureDetail(sig)
		if group == nil {
			http.Error(w, "Signature not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"group":   group,
			"details": details,
		})
		return
	}

	groups := h.store.GetErrorsGroupedBySignature()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"groups": groups,
		"total":  len(groups),
	})
}

// REST: /api/observability/findings
func (h *HTTPHandler) handleFindings(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 100
	}
	findings := h.store.ListFindings(limit)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"findings": findings,
		"total":    len(findings),
	})
}

// REST: /api/observability/config
func (h *HTTPHandler) handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost || r.Method == http.MethodPut {
		var cfg DetectionConfig
		if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		h.detector.UpdateConfig(cfg)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "updated",
			"config": h.detector.GetConfig(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(h.detector.GetConfig())
}

// SSE live stream for runs, spans, errors, findings
func (h *HTTPHandler) handleSSEStream(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	subID := fmt.Sprintf("sub_obs_%d", time.Now().UnixNano())
	eventCh := h.store.Subscribe(subID)
	defer h.store.Unsubscribe(subID)

	// Send initial heartbeat
	fmt.Fprintf(w, "data: {\"type\":\"connected\",\"timestamp\":%d}\n\n", time.Now().UnixMilli())
	flusher.Flush()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case evt, ok := <-eventCh:
			if !ok {
				return
			}
			bytes, err := json.Marshal(evt)
			if err == nil {
				fmt.Fprintf(w, "data: %s\n\n", bytes)
				flusher.Flush()
			}
		}
	}
}
