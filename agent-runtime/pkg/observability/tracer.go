package observability

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

type contextKey string

const (
	runContextKey  contextKey = "chatbolt_run_id"
	spanContextKey contextKey = "chatbolt_span_id"
)

// Tracer provides high-level instrumentation APIs
type Tracer struct {
	store    *Store
	detector *Engine
}

// NewTracer creates an observability tracer
func NewTracer(store *Store, detector *Engine) *Tracer {
	return &Tracer{
		store:    store,
		detector: detector,
	}
}

// GenerateTraceID generates a 16-byte hex trace ID compliant with W3C TraceContext
func GenerateTraceID() string {
	bytes := make([]byte, 16)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// GenerateSpanID generates an 8-byte hex span ID compliant with W3C TraceContext
func GenerateSpanID() string {
	bytes := make([]byte, 8)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// StartRun starts observing a new agent execution session
func (t *Tracer) StartRun(runID, tenantID, agentID, agentRole, teamID, teamName, missionGoal string, metadata map[string]interface{}) *Run {
	if runID == "" {
		runID = fmt.Sprintf("run_%d_%s", time.Now().UnixMilli(), GenerateSpanID()[:6])
	}
	if tenantID == "" {
		tenantID = "00000000-0000-0000-0000-000000000000"
	}

	run := &Run{
		ID:             runID,
		TenantID:       tenantID,
		AgentID:        agentID,
		AgentRole:      agentRole,
		TeamID:         teamID,
		TeamName:       teamName,
		MissionGoal:    missionGoal,
		Status:         "running",
		StartedAt:      time.Now(),
		LastActivityAt: time.Now(),
		Metadata:       metadata,
	}

	t.store.SaveRun(run)
	return run
}

// EndRun finalizes a run with status, token usage, and cost
func (t *Tracer) EndRun(runID, status string, promptTokens, completionTokens int, costUSD float64, err error) {
	run, ok := t.store.GetRun(runID)
	if !ok {
		return
	}

	now := time.Now()
	run.EndedAt = &now
	run.DurationMs = now.Sub(run.StartedAt).Milliseconds()
	run.Status = status
	run.PromptTokens += promptTokens
	run.CompletionTokens += completionTokens
	run.TotalTokens = run.PromptTokens + run.CompletionTokens
	run.TotalCostUSD += costUSD
	run.LastActivityAt = now

	if err != nil && status != "completed" {
		run.Status = "failed"
		t.RecordError(runID, "", "RunExecutionError", err.Error(), "", run.AgentRole, nil)
	}

	t.store.SaveRun(run)
}

// StartSpan creates and begins a new execution span
func (t *Tracer) StartSpan(ctx context.Context, runID, parentSpanID, name string, spanType SpanType, input interface{}, metadata map[string]interface{}) (context.Context, *Span) {
	spanID := GenerateSpanID()
	traceID := GenerateTraceID()

	span := &Span{
		ID:        spanID,
		RunID:     runID,
		ParentID:  parentSpanID,
		TraceID:   traceID,
		Type:      spanType,
		Name:      name,
		Status:    SpanStatusInProgress,
		StartedAt: time.Now(),
		Input:     input,
		Metadata:  metadata,
	}

	t.store.SaveSpan(span)

	newCtx := context.WithValue(ctx, runContextKey, runID)
	newCtx = context.WithValue(newCtx, spanContextKey, spanID)
	return newCtx, span
}

// EndSpan completes a span and immediately passes it through the detection engine
func (t *Tracer) EndSpan(span *Span, status SpanStatus, output interface{}, err error) {
	if span == nil {
		return
	}

	now := time.Now()
	span.EndedAt = &now
	span.DurationMs = now.Sub(span.StartedAt).Milliseconds()
	span.Status = status
	span.Output = output

	if err != nil {
		span.Status = SpanStatusError
		span.ErrorMessage = err.Error()
		t.RecordError(span.RunID, span.ID, fmt.Sprintf("%sError", span.Type), err.Error(), "", "", span.Metadata)
	}

	t.store.SaveSpan(span)

	// Ingest-time deterministic detection rules evaluation
	if t.detector != nil {
		t.detector.EvaluateSpanOnIngest(span)
	}
}

// RecordLog adds a structured log to a run/span
func (t *Tracer) RecordLog(runID, spanID, level, message string, metadata map[string]interface{}) {
	logEntry := Log{
		ID:        fmt.Sprintf("log_%d_%s", time.Now().UnixNano(), GenerateSpanID()[:4]),
		RunID:     runID,
		SpanID:    spanID,
		Timestamp: time.Now(),
		Level:     level,
		Message:   message,
		Metadata:  metadata,
	}
	t.store.SaveLog(logEntry)
}

// RecordError logs an error record and triggers detection rules
func (t *Tracer) RecordError(runID, spanID, errType, message, stack, agentRole string, metadata map[string]interface{}) {
	if errType == "" {
		errType = "RuntimeError"
	}

	errRec := ErrorRecord{
		ID:             fmt.Sprintf("err_%d_%s", time.Now().UnixNano(), GenerateSpanID()[:4]),
		RunID:          runID,
		SpanID:         spanID,
		ErrorSignature: ComputeErrorSignature(errType, message),
		Type:           errType,
		Message:        message,
		Stack:          stack,
		AgentRole:      agentRole,
		Timestamp:      time.Now(),
		Metadata:       metadata,
	}

	t.store.SaveError(errRec)

	if t.detector != nil {
		t.detector.EvaluateErrorOnIngest(errRec)
	}
}

// GetStore returns underlying store
func (t *Tracer) GetStore() *Store {
	return t.store
}

// GetDetector returns detection engine
func (t *Tracer) GetDetector() *Engine {
	return t.detector
}
