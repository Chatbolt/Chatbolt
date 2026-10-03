package observability

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

// SpanType represents standardized span classifications
type SpanType string

const (
	SpanTypeAgent      SpanType = "agent"
	SpanTypeLLM        SpanType = "llm"
	SpanTypeTool       SpanType = "tool"
	SpanTypeHandoff    SpanType = "handoff"
	SpanTypeEscalation SpanType = "escalation"
	SpanTypeSandbox    SpanType = "sandbox"
	SpanTypeCritic     SpanType = "critic"
)

// SpanStatus represents execution status of a span
type SpanStatus string

const (
	SpanStatusOk         SpanStatus = "ok"
	SpanStatusError      SpanStatus = "error"
	SpanStatusInProgress SpanStatus = "in_progress"
)

// FindingType represents deterministic rule detection types
type FindingType string

const (
	FindingLongRunning   FindingType = "long_running"
	FindingRepeatedTool  FindingType = "repeated_tool"
	FindingRepeatedError FindingType = "repeated_error"
	FindingNoActivity    FindingType = "no_activity"
	FindingPossibleLoop  FindingType = "possible_loop"
)

// Severity represents finding alert severity
type Severity string

const (
	SeverityInfo     Severity = "info"
	SeverityLow      Severity = "low"
	SeverityMedium   Severity = "medium"
	SeverityHigh     Severity = "high"
	SeverityCritical Severity = "critical"
)

// Run represents an observed agent/team execution session
type Run struct {
	ID               string                 `json:"id"`
	TenantID         string                 `json:"tenant_id"`
	AgentID          string                 `json:"agent_id,omitempty"`
	AgentRole        string                 `json:"agent_role"`
	TeamID           string                 `json:"team_id,omitempty"`
	TeamName         string                 `json:"team_name,omitempty"`
	MissionGoal      string                 `json:"mission_goal"`
	Status           string                 `json:"status"` // running, completed, failed, stuck, paused
	StartedAt        time.Time              `json:"started_at"`
	EndedAt          *time.Time             `json:"ended_at,omitempty"`
	DurationMs       int64                  `json:"duration_ms"`
	PromptTokens     int                    `json:"prompt_tokens"`
	CompletionTokens int                    `json:"completion_tokens"`
	TotalTokens      int                    `json:"total_tokens"`
	TotalCostUSD     float64                `json:"total_cost_usd"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	LastActivityAt   time.Time              `json:"last_activity_at"`
}

// Span represents a single unit of execution (OTel Span equivalent)
type Span struct {
	ID           string                 `json:"id"`
	RunID        string                 `json:"run_id"`
	ParentID     string                 `json:"parent_id,omitempty"`
	TraceID      string                 `json:"trace_id"`
	Type         SpanType               `json:"type"`
	Name         string                 `json:"name"`
	Status       SpanStatus             `json:"status"`
	StartedAt    time.Time              `json:"started_at"`
	EndedAt      *time.Time             `json:"ended_at,omitempty"`
	DurationMs   int64                  `json:"duration_ms"`
	Input        interface{}            `json:"input,omitempty"`
	Output       interface{}            `json:"output,omitempty"`
	ErrorMessage string                 `json:"error_message,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// Log represents a structured timestamped event emitted during a span/run
type Log struct {
	ID        string                 `json:"id"`
	RunID     string                 `json:"run_id"`
	SpanID    string                 `json:"span_id,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Level     string                 `json:"level"` // debug, info, warn, error
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// ErrorRecord represents an error occurrence grouped by signature
type ErrorRecord struct {
	ID             string                 `json:"id"`
	RunID          string                 `json:"run_id"`
	SpanID         string                 `json:"span_id,omitempty"`
	ErrorSignature string                 `json:"error_signature"`
	Type           string                 `json:"type"`
	Message        string                 `json:"message"`
	Stack          string                 `json:"stack,omitempty"`
	AgentRole      string                 `json:"agent_role"`
	Timestamp      time.Time              `json:"timestamp"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// Finding represents an automated diagnostic finding
type Finding struct {
	ID          string                 `json:"id"`
	RunID       string                 `json:"run_id"`
	SpanID      string                 `json:"span_id,omitempty"`
	Type        FindingType            `json:"type"`
	Severity    Severity               `json:"severity"`
	Message     string                 `json:"message"`
	Details     map[string]interface{} `json:"details,omitempty"`
	ActionTaken string                 `json:"action_taken,omitempty"` // alert_supervisor, escalate, reassign, circuit_trip
	CreatedAt   time.Time              `json:"created_at"`
}

// ErrorGroup summarizes error records by error signature
type ErrorGroup struct {
	Signature       string        `json:"signature"`
	Type            string        `json:"type"`
	SampleMessage   string        `json:"sample_message"`
	SampleStack     string        `json:"sample_stack,omitempty"`
	Count           int           `json:"count"`
	FirstSeenAt     time.Time     `json:"first_seen_at"`
	LastSeenAt      time.Time     `json:"last_seen_at"`
	AffectedAgents  []string      `json:"affected_agents"`
	AffectedRunIDs  []string      `json:"affected_run_ids"`
	SampleErrorList []ErrorRecord `json:"sample_errors,omitempty"`
}

// DetectionConfig contains configurable threshold settings for detection rules
type DetectionConfig struct {
	LongRunningRunMs        int64 `json:"long_running_run_ms"`         // default: 120000 (2m)
	LongRunningSpanMs       int64 `json:"long_running_span_ms"`        // default: 45000 (45s)
	RepeatedToolThreshold   int   `json:"repeated_tool_threshold"`     // default: 4
	RepeatedErrorThreshold  int   `json:"repeated_error_threshold"`    // default: 3
	NoActivitySeconds       int64 `json:"no_activity_seconds"`         // default: 30s
	LoopPatternWindow       int   `json:"loop_pattern_window"`         // default: 8
	SweepIntervalSeconds    int   `json:"sweep_interval_seconds"`      // default: 10
}

// DefaultDetectionConfig returns production-calibrated defaults
func DefaultDetectionConfig() DetectionConfig {
	return DetectionConfig{
		LongRunningRunMs:       120000,
		LongRunningSpanMs:      45000,
		RepeatedToolThreshold:  4,
		RepeatedErrorThreshold: 3,
		NoActivitySeconds:      30,
		LoopPatternWindow:      8,
		SweepIntervalSeconds:   10,
	}
}

// ComputeErrorSignature computes a deterministic hash signature from error type and message
func ComputeErrorSignature(errType, message string) string {
	raw := fmt.Sprintf("%s:%s", errType, message)
	hash := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(hash[:8])
}

// SafeStringMap sync wrapper
type SafeMap struct {
	mu   sync.RWMutex
	data map[string]interface{}
}
