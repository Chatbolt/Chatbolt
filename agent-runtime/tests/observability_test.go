package tests

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"agent-runtime/pkg/observability"
)

func TestObservabilityTracerAndSpans(t *testing.T) {
	store := observability.NewStore("")
	detector := observability.NewEngine(observability.DefaultDetectionConfig(), store, nil)
	tracer := observability.NewTracer(store, detector)

	run := tracer.StartRun("run_test_1", "tenant_1", "agent_123", "software_engineer", "team_1", "Core Squad", "Implement feature", map[string]interface{}{"env": "test"})
	if run == nil || run.ID != "run_test_1" {
		t.Fatalf("expected run ID 'run_test_1', got %v", run)
	}

	_, span := tracer.StartSpan(context.Background(), run.ID, "", "llm_generate_code", observability.SpanTypeLLM, `{"prompt":"write tests"}`, map[string]interface{}{"model": "gpt-4o"})
	if span == nil || span.Type != observability.SpanTypeLLM {
		t.Fatalf("expected span type LLM, got %v", span)
	}

	tracer.RecordLog(run.ID, span.ID, "info", "Model response received in 250ms", nil)
	tracer.EndSpan(span, observability.SpanStatusOk, `{"code":"func Test()..."}`, nil)

	spans := store.GetRunSpans(run.ID)
	if len(spans) != 1 {
		t.Fatalf("expected 1 span, got %d", len(spans))
	}

	tracer.EndRun(run.ID, "completed", 500, 150, 0.004, nil)

	updatedRun, ok := store.GetRun(run.ID)
	if !ok || updatedRun.Status != "completed" || updatedRun.TotalTokens != 650 {
		t.Fatalf("expected completed run with 650 tokens, got %+v", updatedRun)
	}
}

func TestDeterministicLoopDetectionFailureInjection(t *testing.T) {
	store := observability.NewStore("")
	var alertTriggered int32

	detector := observability.NewEngine(
		observability.DefaultDetectionConfig(),
		store,
		func(teamID, agentID, runID, reason string, finding observability.Finding) error {
			if finding.Type == observability.FindingPossibleLoop {
				atomic.AddInt32(&alertTriggered, 1)
			}
			return nil
		},
	)
	tracer := observability.NewTracer(store, detector)

	runID := "run_loop_test"
	tracer.StartRun(runID, "tenant_1", "agent_coder", "coder", "team_1", "Dev Team", "Fix bug", nil)

	// Simulate a 2-step infinite cycle: ToolA(input1) -> ToolB(input2) -> ToolA(input1) -> ToolB(input2)
	for i := 0; i < 2; i++ {
		_, spanA := tracer.StartSpan(context.Background(), runID, "", "web_search", observability.SpanTypeTool, map[string]string{"query": "error in line 42"}, nil)
		tracer.EndSpan(spanA, observability.SpanStatusOk, "error not found", nil)

		_, spanB := tracer.StartSpan(context.Background(), runID, "", "file_read", observability.SpanTypeTool, map[string]string{"file": "index.ts"}, nil)
		tracer.EndSpan(spanB, observability.SpanStatusOk, "content...", nil)
	}

	findings := store.GetRunFindings(runID)
	loopFound := false
	for _, f := range findings {
		if f.Type == observability.FindingPossibleLoop {
			loopFound = true
			break
		}
	}

	if !loopFound {
		t.Fatalf("expected loop finding to be detected deterministically, findings: %+v", findings)
	}

	if atomic.LoadInt32(&alertTriggered) == 0 {
		t.Fatalf("expected supervisor recovery alert to be triggered on loop detection")
	}
}

func TestRepeatedToolFailureInjection(t *testing.T) {
	store := observability.NewStore("")
	var alertTriggered int32

	cfg := observability.DefaultDetectionConfig()
	cfg.RepeatedToolThreshold = 3

	detector := observability.NewEngine(cfg, store, func(teamID, agentID, runID, reason string, finding observability.Finding) error {
		if finding.Type == observability.FindingRepeatedTool {
			atomic.AddInt32(&alertTriggered, 1)
		}
		return nil
	})
	tracer := observability.NewTracer(store, detector)

	runID := "run_repeated_tool_test"
	tracer.StartRun(runID, "tenant_1", "agent_scraper", "scraper", "team_1", "Scraper Team", "Extract table", nil)

	// Invoke same tool 3 times
	for i := 0; i < 3; i++ {
		_, span := tracer.StartSpan(context.Background(), runID, "", "http_scrape", observability.SpanTypeTool, map[string]string{"url": fmt.Sprintf("https://example.com/page/%d", i)}, nil)
		tracer.EndSpan(span, observability.SpanStatusOk, "blocked by cloudflare", nil)
	}

	findings := store.GetRunFindings(runID)
	repFound := false
	for _, f := range findings {
		if f.Type == observability.FindingRepeatedTool {
			repFound = true
			break
		}
	}

	if !repFound {
		t.Fatalf("expected repeated tool finding to be generated, got: %+v", findings)
	}

	if atomic.LoadInt32(&alertTriggered) == 0 {
		t.Fatalf("expected alert handler to be invoked for repeated tool")
	}
}

func TestErrorsGroupedBySignature(t *testing.T) {
	store := observability.NewStore("")
	detector := observability.NewEngine(observability.DefaultDetectionConfig(), store, nil)
	tracer := observability.NewTracer(store, detector)

	// Inject same error in multiple runs
	tracer.RecordError("run_1", "span_1", "RateLimitError", "429 Too Many Requests to provider openai", "stack...", "coder", nil)
	tracer.RecordError("run_2", "span_2", "RateLimitError", "429 Too Many Requests to provider openai", "stack...", "researcher", nil)
	tracer.RecordError("run_3", "span_3", "SyntaxError", "Unexpected token < at line 1", "stack...", "coder", nil)

	groups := store.GetErrorsGroupedBySignature()
	if len(groups) != 2 {
		t.Fatalf("expected 2 distinct error signature groups, got %d", len(groups))
	}

	// First group should have 2 occurrences (RateLimitError)
	if groups[0].Count != 2 || groups[0].Type != "RateLimitError" {
		t.Fatalf("expected RateLimitError group with count 2, got %+v", groups[0])
	}

	if len(groups[0].AffectedAgents) != 2 {
		t.Fatalf("expected 2 affected agents, got %v", groups[0].AffectedAgents)
	}
}

func TestNoActivityDetectionPeriodicSweep(t *testing.T) {
	store := observability.NewStore("")
	var alertTriggered int32

	cfg := observability.DefaultDetectionConfig()
	cfg.NoActivitySeconds = 1 // 1 second threshold for test

	detector := observability.NewEngine(cfg, store, func(teamID, agentID, runID, reason string, finding observability.Finding) error {
		if finding.Type == observability.FindingNoActivity {
			atomic.AddInt32(&alertTriggered, 1)
		}
		return nil
	})
	tracer := observability.NewTracer(store, detector)

	runID := "run_silent_agent"
	run := tracer.StartRun(runID, "tenant_1", "agent_silent", "analyst", "team_1", "Analytics Squad", "Analyze trend", nil)
	run.LastActivityAt = time.Now().Add(-3 * time.Second) // Simulated silence
	store.SaveRun(run)

	// Run deterministic periodic sweep
	detector.RunPeriodicSweep()

	findings := store.GetRunFindings(runID)
	silentFound := false
	for _, f := range findings {
		if f.Type == observability.FindingNoActivity {
			silentFound = true
			break
		}
	}

	if !silentFound {
		t.Fatalf("expected no_activity finding, got %+v", findings)
	}

	if atomic.LoadInt32(&alertTriggered) == 0 {
		t.Fatalf("expected supervisor escalation on silent/hung agent")
	}
}
