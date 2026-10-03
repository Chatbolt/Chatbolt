package observability

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// Store provides thread-safe, fast in-memory indexing with optional file persistence
type Store struct {
	mu           sync.RWMutex
	runs         map[string]*Run
	spans        map[string]*Span
	runSpans     map[string][]string // runID -> []spanID
	logs         map[string][]Log    // runID -> []Log
	errors       map[string][]ErrorRecord // signature -> []ErrorRecord
	runErrors    map[string][]ErrorRecord // runID -> []ErrorRecord
	findings     map[string][]Finding     // runID -> []Finding
	allFindings  []Finding
	persistPath  string
	maxLogsPerRun int
	subscribers  map[string]chan interface{}
	subMu        sync.RWMutex
}

// NewStore initializes a high-performance observability store
func NewStore(persistPath string) *Store {
	store := &Store{
		runs:          make(map[string]*Run),
		spans:         make(map[string]*Span),
		runSpans:      make(map[string][]string),
		logs:          make(map[string][]Log),
		errors:        make(map[string][]ErrorRecord),
		runErrors:     make(map[string][]ErrorRecord),
		findings:      make(map[string][]Finding),
		allFindings:   make([]Finding, 0),
		persistPath:   persistPath,
		maxLogsPerRun: 1000,
		subscribers:   make(map[string]chan interface{}),
	}

	// Attempt restore if persistence file exists
	if persistPath != "" {
		_ = store.restoreFromFile()
	}

	return store
}

// Subscribe returns a channel for live streaming events (runs, spans, findings, errors)
func (s *Store) Subscribe(subID string) chan interface{} {
	s.subMu.Lock()
	defer s.subMu.Unlock()
	ch := make(chan interface{}, 200)
	s.subscribers[subID] = ch
	return ch
}

// Unsubscribe removes a live stream subscriber
func (s *Store) Unsubscribe(subID string) {
	s.subMu.Lock()
	defer s.subMu.Unlock()
	if ch, ok := s.subscribers[subID]; ok {
		close(ch)
		delete(s.subscribers, subID)
	}
}

// broadcast emits an event to all live subscribers without blocking
func (s *Store) broadcast(event interface{}) {
	s.subMu.RLock()
	defer s.subMu.RUnlock()
	for _, ch := range s.subscribers {
		select {
		case ch <- event:
		default:
		}
	}
}

// SaveRun creates or updates a run record
func (s *Store) SaveRun(run *Run) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if run.LastActivityAt.IsZero() {
		run.LastActivityAt = time.Now()
	}
	s.runs[run.ID] = run
	go s.broadcast(map[string]interface{}{"type": "run_update", "run": run})
}

// GetRun retrieves a run by ID
func (s *Store) GetRun(runID string) (*Run, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.runs[runID]
	return r, ok
}

// ListRuns returns all runs sorted by started_at descending with optional limit
func (s *Store) ListRuns(limit int, statusFilter, roleFilter string) []*Run {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*Run, 0, len(s.runs))
	for _, r := range s.runs {
		if statusFilter != "" && r.Status != statusFilter {
			continue
		}
		if roleFilter != "" && r.AgentRole != roleFilter {
			continue
		}
		result = append(result, r)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].StartedAt.After(result[j].StartedAt)
	})

	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	return result
}

// SaveSpan records an execution span and updates run activity timestamp
func (s *Store) SaveSpan(span *Span) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.spans[span.ID] = span
	if _, exists := s.runSpans[span.RunID]; !exists {
		s.runSpans[span.RunID] = make([]string, 0, 16)
	}

	// Avoid duplicate IDs in run index
	found := false
	for _, id := range s.runSpans[span.RunID] {
		if id == span.ID {
			found = true
			break
		}
	}
	if !found {
		s.runSpans[span.RunID] = append(s.runSpans[span.RunID], span.ID)
	}

	// Update run last activity
	if run, ok := s.runs[span.RunID]; ok {
		run.LastActivityAt = time.Now()
	}

	go s.broadcast(map[string]interface{}{"type": "span_update", "span": span})
}

// GetSpan retrieves a span by ID
func (s *Store) GetSpan(spanID string) (*Span, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	span, ok := s.spans[spanID]
	return span, ok
}

// GetRunSpans returns all spans for a given run sorted chronologically
func (s *Store) GetRunSpans(runID string) []*Span {
	s.mu.RLock()
	defer s.mu.RUnlock()

	spanIDs := s.runSpans[runID]
	result := make([]*Span, 0, len(spanIDs))
	for _, id := range spanIDs {
		if sp, ok := s.spans[id]; ok {
			result = append(result, sp)
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].StartedAt.Before(result[j].StartedAt)
	})

	return result
}

// SaveLog appends a structured log
func (s *Store) SaveLog(logEntry Log) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if logEntry.Timestamp.IsZero() {
		logEntry.Timestamp = time.Now()
	}

	list := s.logs[logEntry.RunID]
	if len(list) >= s.maxLogsPerRun {
		list = list[1:] // Ring eviction
	}
	s.logs[logEntry.RunID] = append(list, logEntry)

	// Update run activity
	if run, ok := s.runs[logEntry.RunID]; ok {
		run.LastActivityAt = time.Now()
	}

	go s.broadcast(map[string]interface{}{"type": "log_entry", "log": logEntry})
}

// GetRunLogs returns all logs for a run
func (s *Store) GetRunLogs(runID string) []Log {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]Log(nil), s.logs[runID]...)
}

// SaveError records an error event into the signature index and run index
func (s *Store) SaveError(errRec ErrorRecord) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if errRec.Timestamp.IsZero() {
		errRec.Timestamp = time.Now()
	}
	if errRec.ErrorSignature == "" {
		errRec.ErrorSignature = ComputeErrorSignature(errRec.Type, errRec.Message)
	}

	s.errors[errRec.ErrorSignature] = append(s.errors[errRec.ErrorSignature], errRec)
	s.runErrors[errRec.RunID] = append(s.runErrors[errRec.RunID], errRec)

	go s.broadcast(map[string]interface{}{"type": "error_entry", "error": errRec})
}

// GetErrorsGroupedBySignature aggregates errors across all runs
func (s *Store) GetErrorsGroupedBySignature() []ErrorGroup {
	s.mu.RLock()
	defer s.mu.RUnlock()

	groups := make([]ErrorGroup, 0, len(s.errors))
	for sig, list := range s.errors {
		if len(list) == 0 {
			continue
		}

		firstSeen := list[0].Timestamp
		lastSeen := list[0].Timestamp
		agentsMap := make(map[string]bool)
		runsMap := make(map[string]bool)

		for _, item := range list {
			if item.Timestamp.Before(firstSeen) {
				firstSeen = item.Timestamp
			}
			if item.Timestamp.After(lastSeen) {
				lastSeen = item.Timestamp
			}
			if item.AgentRole != "" {
				agentsMap[item.AgentRole] = true
			}
			if item.RunID != "" {
				runsMap[item.RunID] = true
			}
		}

		agents := make([]string, 0, len(agentsMap))
		for a := range agentsMap {
			agents = append(agents, a)
		}

		runIDs := make([]string, 0, len(runsMap))
		for r := range runsMap {
			runIDs = append(runIDs, r)
		}

		sample := list[len(list)-1]

		groups = append(groups, ErrorGroup{
			Signature:       sig,
			Type:            sample.Type,
			SampleMessage:   sample.Message,
			SampleStack:     sample.Stack,
			Count:           len(list),
			FirstSeenAt:     firstSeen,
			LastSeenAt:      lastSeen,
			AffectedAgents:  agents,
			AffectedRunIDs:  runIDs,
			SampleErrorList: list,
		})
	}

	sort.Slice(groups, func(i, j int) bool {
		return groups[i].Count > groups[j].Count
	})

	return groups
}

// GetErrorSignatureDetail returns all occurrences and affected runs for an error signature
func (s *Store) GetErrorSignatureDetail(signature string) (*ErrorGroup, []ErrorRecord) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list := s.errors[signature]
	if len(list) == 0 {
		return nil, nil
	}

	firstSeen := list[0].Timestamp
	lastSeen := list[0].Timestamp
	agentsMap := make(map[string]bool)
	runsMap := make(map[string]bool)

	for _, item := range list {
		if item.Timestamp.Before(firstSeen) {
			firstSeen = item.Timestamp
		}
		if item.Timestamp.After(lastSeen) {
			lastSeen = item.Timestamp
		}
		if item.AgentRole != "" {
			agentsMap[item.AgentRole] = true
		}
		if item.RunID != "" {
			runsMap[item.RunID] = true
		}
	}

	agents := make([]string, 0, len(agentsMap))
	for a := range agentsMap {
		agents = append(agents, a)
	}

	runIDs := make([]string, 0, len(runsMap))
	for r := range runsMap {
		runIDs = append(runIDs, r)
	}

	sample := list[len(list)-1]
	group := &ErrorGroup{
		Signature:       signature,
		Type:            sample.Type,
		SampleMessage:   sample.Message,
		SampleStack:     sample.Stack,
		Count:           len(list),
		FirstSeenAt:     firstSeen,
		LastSeenAt:      lastSeen,
		AffectedAgents:  agents,
		AffectedRunIDs:  runIDs,
		SampleErrorList: list,
	}

	return group, list
}

// SaveFinding adds an automated diagnostic finding
func (s *Store) SaveFinding(finding Finding) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if finding.CreatedAt.IsZero() {
		finding.CreatedAt = time.Now()
	}
	if finding.ID == "" {
		finding.ID = fmt.Sprintf("find_%d", time.Now().UnixNano())
	}

	s.findings[finding.RunID] = append(s.findings[finding.RunID], finding)
	s.allFindings = append(s.allFindings, finding)

	go s.broadcast(map[string]interface{}{"type": "finding_entry", "finding": finding})
}

// GetRunFindings returns findings for a specific run
func (s *Store) GetRunFindings(runID string) []Finding {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]Finding(nil), s.findings[runID]...)
}

// ListFindings returns all findings sorted by creation time descending
func (s *Store) ListFindings(limit int) []Finding {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := append([]Finding(nil), s.allFindings...)
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})

	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	return result
}

// GetActiveRuns returns all runs currently in "running" status
func (s *Store) GetActiveRuns() []*Run {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var active []*Run
	for _, r := range s.runs {
		if r.Status == "running" {
			active = append(active, r)
		}
	}
	return active
}

// Snapshot serializes store data to disk for persistent recovery
func (s *Store) Snapshot() error {
	if s.persistPath == "" {
		return nil
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	data := map[string]interface{}{
		"runs":         s.runs,
		"spans":        s.spans,
		"run_spans":    s.runSpans,
		"logs":         s.logs,
		"errors":       s.errors,
		"findings":     s.findings,
		"all_findings": s.allFindings,
		"timestamp":    time.Now(),
	}

	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(s.persistPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(s.persistPath, bytes, 0644)
}

func (s *Store) restoreFromFile() error {
	if s.persistPath == "" {
		return nil
	}
	bytes, err := os.ReadFile(s.persistPath)
	if err != nil {
		return err
	}

	var data struct {
		Runs        map[string]*Run            `json:"runs"`
		Spans       map[string]*Span           `json:"spans"`
		RunSpans    map[string][]string        `json:"run_spans"`
		Logs        map[string][]Log           `json:"logs"`
		Errors      map[string][]ErrorRecord   `json:"errors"`
		Findings    map[string][]Finding       `json:"findings"`
		AllFindings []Finding                  `json:"all_findings"`
	}

	if err := json.Unmarshal(bytes, &data); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if data.Runs != nil {
		s.runs = data.Runs
	}
	if data.Spans != nil {
		s.spans = data.Spans
	}
	if data.RunSpans != nil {
		s.runSpans = data.RunSpans
	}
	if data.Logs != nil {
		s.logs = data.Logs
	}
	if data.Errors != nil {
		s.errors = data.Errors
	}
	if data.Findings != nil {
		s.findings = data.Findings
	}
	if data.AllFindings != nil {
		s.allFindings = data.AllFindings
	}

	return nil
}
