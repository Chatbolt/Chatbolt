'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Cpu,
  Eye,
  Filter,
  Flame,
  Layers,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Terminal,
  Zap,
  ArrowUpRight,
  Sliders,
  X,
  Radio,
  FileText
} from 'lucide-react'
import { api } from '@/lib/api'

interface Run {
  id: string
  agentRole: string
  teamName?: string
  missionGoal: string
  status: 'running' | 'completed' | 'failed' | 'stuck' | 'paused'
  startedAt: string
  endedAt?: string
  durationMs: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  totalCostUSD: number
  metadata?: Record<string, any>
}

interface Span {
  id: string
  runId: string
  parentId?: string
  type: 'agent' | 'llm' | 'tool' | 'handoff' | 'escalation' | 'sandbox' | 'critic'
  name: string
  status: 'ok' | 'error' | 'in_progress'
  startedAt: string
  endedAt?: string
  durationMs: number
  input?: any
  output?: any
  errorMessage?: string
  metadata?: Record<string, any>
}

interface LogEntry {
  id: string
  runId: string
  spanId?: string
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
}

interface Finding {
  id: string
  runId: string
  type: 'long_running' | 'repeated_tool' | 'repeated_error' | 'no_activity' | 'possible_loop'
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: Record<string, any>
  actionTaken?: string
  createdAt: string
}

interface ErrorGroup {
  signature: string
  type: string
  sampleMessage: string
  sampleStack?: string
  count: number
  firstSeenAt: string
  lastSeenAt: string
  affectedAgents: string[]
  affectedRunIds: string[]
}

export default function ObservabilityPage() {
  const [activeTab, setActiveTab] = useState<'runs' | 'errors' | 'findings' | 'config'>('runs')
  const [runs, setRuns] = useState<Run[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [runDetail, setRunDetail] = useState<{ run?: Run; spans: Span[]; logs: LogEntry[]; findings: Finding[] } | null>(null)
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null)
  const [errorGroups, setErrorGroups] = useState<ErrorGroup[]>([])
  const [selectedErrorSignature, setSelectedErrorSignature] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<{ group?: ErrorGroup; occurrences: any[]; affectedRuns: Run[] } | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [thresholds, setThresholds] = useState({
    longRunningRunMs: 120000,
    longRunningSpanMs: 45000,
    repeatedToolThreshold: 4,
    repeatedErrorThreshold: 3,
    noActivitySeconds: 30
  })
  const [showConfigModal, setShowConfigModal] = useState(false)

  // Fetch initial observability data
  const fetchData = async () => {
    setIsLoading(true)
    try {
      // 1. Fetch runs
      const runsRes = await api.observability.listRuns({ limit: 50 }).catch(() => ({ runs: [] }))
      const fetchedRuns = runsRes.runs || []
      setRuns(fetchedRuns)

      // 2. Fetch error signature groups
      const errRes = await api.observability.listErrors().catch(() => ({ groups: [] }))
      setErrorGroups(errRes.groups || [])

      // 3. Fetch findings feed
      const findRes = await api.observability.listFindings(50).catch(() => ({ findings: [] }))
      setFindings(findRes.findings || [])

      // 4. Fetch detection config
      const cfgRes = await api.observability.getConfig().catch(() => ({ config: thresholds }))
      if (cfgRes.config) setThresholds(cfgRes.config)

      if (fetchedRuns.length > 0 && !selectedRunId) {
        setSelectedRunId(fetchedRuns[0].id)
      }
    } catch (err) {
      console.error('Failed to load observability data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Load specific run detail
  useEffect(() => {
    if (!selectedRunId) return
    let isMounted = true
    api.observability.getRun(selectedRunId)
      .then(res => {
        if (isMounted && res.success) {
          setRunDetail(res)
          if (res.spans?.length > 0 && !selectedSpan) {
            setSelectedSpan(res.spans[0])
          }
        }
      })
      .catch(err => console.error('Error loading run detail:', err))
    return () => { isMounted = false }
  }, [selectedRunId])

  // Load specific error signature detail
  useEffect(() => {
    if (!selectedErrorSignature) return
    api.observability.getError(selectedErrorSignature)
      .then(res => {
        if (res.success) {
          setErrorDetail(res)
        }
      })
      .catch(err => console.error('Error loading error detail:', err))
  }, [selectedErrorSignature])

  // Connect live SSE stream
  useEffect(() => {
    fetchData()

    let eventSource: EventSource | null = null
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      eventSource = new EventSource(`${backendUrl}/api/observability/stream`)

      eventSource.onopen = () => setIsConnected(true)
      eventSource.onerror = () => setIsConnected(false)

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.type === 'run_update') {
            setRuns(prev => {
              const idx = prev.findIndex(r => r.id === parsed.data.id)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = parsed.data
                return next
              }
              return [parsed.data, ...prev]
            })
            if (parsed.data.id === selectedRunId) {
              setRunDetail(prev => prev ? { ...prev, run: parsed.data } : null)
            }
          } else if (parsed.type === 'finding_entry') {
            setFindings(prev => [parsed.data, ...prev])
          } else if (parsed.type === 'error_entry') {
            fetchData() // Refresh error groups on new error
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    } catch (e) {
      console.warn('SSE stream unavailable, falling back to periodic polling')
    }

    const interval = setInterval(fetchData, 12000)
    return () => {
      clearInterval(interval)
      if (eventSource) eventSource.close()
    }
  }, [])

  // Metrics summary
  const summaryMetrics = useMemo(() => {
    const totalRuns = runs.length
    const activeRuns = runs.filter(r => r.status === 'running').length
    const stuckRuns = runs.filter(r => r.status === 'stuck' || r.status === 'failed').length
    const totalTokens = runs.reduce((acc, r) => acc + (r.totalTokens || 0), 0)
    const totalCost = runs.reduce((acc, r) => acc + (r.totalCostUSD || 0), 0)
    const criticalFindings = findings.filter(f => f.severity === 'critical' || f.severity === 'high').length
    return { totalRuns, activeRuns, stuckRuns, totalTokens, totalCost, criticalFindings }
  }, [runs, findings])

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return runs.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return r.id.toLowerCase().includes(q) ||
               r.agentRole.toLowerCase().includes(q) ||
               r.missionGoal.toLowerCase().includes(q)
      }
      return true
    })
  }, [runs, statusFilter, searchQuery])

  // Save updated threshold settings
  const handleSaveConfig = async () => {
    try {
      await api.observability.updateConfig(thresholds)
      setShowConfigModal(false)
    } catch (e) {
      console.error('Failed to save config:', e)
    }
  }

  return (
    <div className="min-h-screen bg-background text-primary p-6 space-y-6">
      {/* ── Top Header & Live Pulse ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-signal-blue" />
              Runtime Observability
            </h1>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-border bg-surface text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-signal-green animate-pulse' : 'bg-signal-idle'}`} />
              <span className="text-secondary">{isConnected ? 'LIVE OTLP STREAM' : 'POLLING MODE'}</span>
            </div>
          </div>
          <p className="text-sm text-secondary mt-1">
            OpenTelemetry-standard spans, deterministic loop/failure detection rules, and signature-grouped error traces.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-surface-elevated text-secondary transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-surface-elevated text-primary shadow-sm transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-signal-blue" />
            Detection Rules
          </button>
        </div>
      </div>

      {/* ── Metric Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-xs text-secondary font-medium">Observed Runs</span>
          <div className="text-2xl font-bold font-mono text-primary mt-1">{summaryMetrics.totalRuns}</div>
          <div className="text-xs text-secondary mt-1 flex items-center gap-1">
            <span className="text-signal-blue font-medium">{summaryMetrics.activeRuns} active</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-xs text-secondary font-medium">Stuck / Failed</span>
          <div className={`text-2xl font-bold font-mono mt-1 ${summaryMetrics.stuckRuns > 0 ? 'text-signal-red' : 'text-signal-green'}`}>
            {summaryMetrics.stuckRuns}
          </div>
          <div className="text-xs text-secondary mt-1">Auto-detected</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-xs text-secondary font-medium">Critical Findings</span>
          <div className={`text-2xl font-bold font-mono mt-1 ${summaryMetrics.criticalFindings > 0 ? 'text-signal-amber' : 'text-signal-green'}`}>
            {summaryMetrics.criticalFindings}
          </div>
          <div className="text-xs text-secondary mt-1">Rules triggered</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-xs text-secondary font-medium">Error Signatures</span>
          <div className="text-2xl font-bold font-mono text-primary mt-1">{errorGroups.length}</div>
          <div className="text-xs text-secondary mt-1">Unique patterns</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-xs text-secondary font-medium">Total Tokens</span>
          <div className="text-2xl font-bold font-mono text-primary mt-1">
            {(summaryMetrics.totalTokens / 1000).toFixed(1)}k
          </div>
          <div className="text-xs text-secondary mt-1">Instrumented</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-xs text-secondary font-medium">Total Spend</span>
          <div className="text-2xl font-bold font-mono text-primary mt-1">
            ${summaryMetrics.totalCost.toFixed(4)}
          </div>
          <div className="text-xs text-secondary mt-1 font-mono">USD Itemized</div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('runs')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'runs'
              ? 'border-signal-blue text-signal-blue'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <Layers className="w-4 h-4" />
          Runs & Timeline Waterfall ({runs.length})
        </button>

        <button
          onClick={() => setActiveTab('errors')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'errors'
              ? 'border-signal-blue text-signal-blue'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-signal-red" />
          Error Signatures ({errorGroups.length})
        </button>

        <button
          onClick={() => setActiveTab('findings')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'findings'
              ? 'border-signal-blue text-signal-blue'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-signal-amber" />
          Deterministic Findings ({findings.length})
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: RUNS & SPAN TIMELINE WATERFALL ── */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'runs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Run List (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Search & Filter Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-secondary" />
                <input
                  type="text"
                  placeholder="Filter by run ID, agent role, or goal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-surface border border-border rounded-lg text-primary placeholder:text-secondary focus:outline-none focus:border-signal-blue"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-signal-blue"
              >
                <option value="all">All Status</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="stuck">Stuck / Looping</option>
              </select>
            </div>

            {/* Run Cards Scrollable Container */}
            <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
              {filteredRuns.length === 0 ? (
                <div className="bg-surface border border-border rounded-xl p-8 text-center text-secondary text-sm">
                  No execution runs match the current criteria.
                </div>
              ) : (
                filteredRuns.map((r) => {
                  const isSelected = r.id === selectedRunId
                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        setSelectedRunId(r.id)
                        setSelectedSpan(null)
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-surface border-signal-blue shadow-sm ring-1 ring-signal-blue/20'
                          : 'bg-surface border-border hover:border-border-focus hover:bg-surface-elevated'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-medium text-primary flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-signal-blue" />
                          {r.agentRole}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase font-mono ${
                            r.status === 'completed'
                              ? 'bg-emerald-500/10 text-signal-green border border-emerald-500/20'
                              : r.status === 'running'
                              ? 'bg-sky-500/10 text-signal-blue border border-sky-500/20 animate-pulse'
                              : r.status === 'failed'
                              ? 'bg-rose-500/10 text-signal-red border border-rose-500/20'
                              : 'bg-amber-500/10 text-signal-amber border border-amber-500/20'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>

                      <p className="text-xs text-secondary mt-2 line-clamp-2">{r.missionGoal}</p>

                      <div className="flex items-center justify-between text-[11px] text-secondary font-mono mt-3 pt-3 border-t border-border">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(r.durationMs / 1000).toFixed(1)}s
                        </span>
                        <span>{r.totalTokens || 0} tokens</span>
                        <span className="text-primary font-medium">${Number(r.totalCostUSD || 0).toFixed(4)}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Timeline & Span Inspector (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {runDetail?.run ? (
              <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-6">
                {/* Header with Run Title & Replay Link */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-elevated text-secondary border border-border">
                        {runDetail.run.id}
                      </span>
                      <span className="text-xs text-secondary">
                        {new Date(runDetail.run.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-primary mt-1">
                      {runDetail.run.missionGoal}
                    </h2>
                  </div>

                  {/* One-click jump to Business Session Replay */}
                  <Link
                    href={`/api/sessions/${runDetail.run.id}/replay`}
                    target="_blank"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-surface-elevated text-primary shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5 text-signal-blue" />
                    Session Replay
                    <ArrowUpRight className="w-3 h-3 text-secondary" />
                  </Link>
                </div>

                {/* Diagnostic Findings Alert Box for Run */}
                {runDetail.findings && runDetail.findings.length > 0 && (
                  <div className="space-y-2">
                    {runDetail.findings.map(f => (
                      <div
                        key={f.id}
                        className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                          f.severity === 'critical'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                        }`}
                      >
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-semibold uppercase tracking-wider text-[10px]">
                            {f.severity} Rule: {f.type}
                          </div>
                          <div className="mt-0.5">{f.message}</div>
                          {f.actionTaken && f.actionTaken !== 'none' && (
                            <div className="mt-1 font-mono text-[11px] opacity-90">
                              ⚡ Action Taken: <strong>{f.actionTaken}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hierarchical Execution Waterfall */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-secondary font-medium">
                    <span>EXECUTION SPAN WATERFALL ({runDetail.spans.length})</span>
                    <span>DURATION (MS)</span>
                  </div>

                  <div className="space-y-1.5 font-mono text-xs">
                    {runDetail.spans.map((sp) => {
                      const isSpanSelected = selectedSpan?.id === sp.id
                      const maxDuration = Math.max(...runDetail.spans.map(s => s.durationMs || 100), 1000)
                      const barPercent = Math.max(5, Math.min(100, Math.round((sp.durationMs / maxDuration) * 100)))

                      return (
                        <div
                          key={sp.id}
                          onClick={() => setSelectedSpan(sp)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                            isSpanSelected
                              ? 'bg-surface-elevated border-signal-blue ring-1 ring-signal-blue/20'
                              : 'bg-surface border-border hover:bg-surface-elevated'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-medium ${
                                  sp.type === 'llm'
                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                    : sp.type === 'tool'
                                    ? 'bg-blue-500/10 text-signal-blue'
                                    : sp.type === 'sandbox'
                                    ? 'bg-amber-500/10 text-signal-amber'
                                    : 'bg-emerald-500/10 text-signal-green'
                                }`}
                              >
                                {sp.type}
                              </span>
                              <span className="text-primary truncate font-medium">{sp.name}</span>
                            </div>

                            <span className="text-secondary shrink-0 text-[11px]">
                              {sp.durationMs}ms
                            </span>
                          </div>

                          {/* Visual Waterfall Duration Bar */}
                          <div className="w-full bg-surface-elevated h-1.5 rounded-full overflow-hidden mt-2">
                            <div
                              className={`h-full rounded-full ${
                                sp.status === 'error'
                                  ? 'bg-signal-red'
                                  : sp.type === 'llm'
                                  ? 'bg-purple-500'
                                  : 'bg-signal-blue'
                              }`}
                              style={{ width: `${barPercent}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Span Inspector Panel */}
                {selectedSpan && (
                  <div className="bg-telemetry-bg border border-telemetry-border rounded-xl p-4 text-telemetry-text font-mono text-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-telemetry-border pb-2">
                      <span className="text-signal-blue font-bold">SPAN INSPECTOR</span>
                      <span className="text-gray-400">{selectedSpan.id}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                      <div>Type: <span className="text-white">{selectedSpan.type}</span></div>
                      <div>Status: <span className={selectedSpan.status === 'ok' ? 'text-signal-green' : 'text-signal-red'}>{selectedSpan.status}</span></div>
                      <div>Duration: <span className="text-white">{selectedSpan.durationMs}ms</span></div>
                      <div>Started: <span className="text-white">{new Date(selectedSpan.startedAt).toLocaleTimeString()}</span></div>
                    </div>

                    {selectedSpan.input && (
                      <div>
                        <div className="text-gray-400 text-[11px] mb-1">Payload / Input:</div>
                        <pre className="bg-black/40 p-2.5 rounded border border-telemetry-border overflow-x-auto text-[11px] max-h-40">
                          {typeof selectedSpan.input === 'string' ? selectedSpan.input : JSON.stringify(selectedSpan.input, null, 2)}
                        </pre>
                      </div>
                    )}

                    {selectedSpan.output && (
                      <div>
                        <div className="text-gray-400 text-[11px] mb-1">Output / Result:</div>
                        <pre className="bg-black/40 p-2.5 rounded border border-telemetry-border overflow-x-auto text-[11px] max-h-40">
                          {typeof selectedSpan.output === 'string' ? selectedSpan.output : JSON.stringify(selectedSpan.output, null, 2)}
                        </pre>
                      </div>
                    )}

                    {selectedSpan.errorMessage && (
                      <div>
                        <div className="text-signal-red text-[11px] mb-1">Error Message:</div>
                        <pre className="bg-rose-950/40 p-2.5 rounded border border-rose-800 text-rose-300 text-[11px]">
                          {selectedSpan.errorMessage}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-xl p-12 text-center text-secondary text-sm">
                Select a run from the list to view its complete timeline waterfall and span telemetry.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: ERRORS GROUPED BY SIGNATURE ── */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'errors' && (
        <div className="space-y-4">
          <p className="text-xs text-secondary">
            Errors grouped deterministically by computed type and message hash signature. Click any signature card to inspect all affected runs and stack traces.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {errorGroups.length === 0 ? (
              <div className="col-span-2 bg-surface border border-border rounded-xl p-12 text-center text-secondary text-sm">
                <CheckCircle2 className="w-8 h-8 text-signal-green mx-auto mb-2" />
                Zero error signatures recorded across active runs.
              </div>
            ) : (
              errorGroups.map((g) => {
                const isSelected = selectedErrorSignature === g.signature
                return (
                  <div
                    key={g.signature}
                    onClick={() => setSelectedErrorSignature(g.signature)}
                    className={`p-5 rounded-xl border transition-all cursor-pointer space-y-3 ${
                      isSelected
                        ? 'bg-surface border-signal-red shadow-sm ring-1 ring-signal-red/20'
                        : 'bg-surface border-border hover:border-border-focus'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-rose-500/10 text-signal-red border border-rose-500/20">
                        {g.type}
                      </span>
                      <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded-full bg-surface-elevated border border-border">
                        {g.count} occurrences
                      </span>
                    </div>

                    <p className="text-xs font-mono text-primary font-medium line-clamp-2">
                      {g.sampleMessage}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-secondary font-mono pt-2 border-t border-border">
                      <span>Agents: {g.affectedAgents.join(', ') || 'general'}</span>
                      <span>Runs: {g.affectedRunIds.length}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Drilldown Modal / Drawer for Error Signature */}
          {selectedErrorSignature && errorDetail && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-signal-red" />
                    <h3 className="text-base font-bold text-primary">
                      Signature: <span className="font-mono text-signal-red">{errorDetail.group?.signature}</span>
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedErrorSignature(null)
                      setErrorDetail(null)
                    }}
                    className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-elevated"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5 text-xs font-mono">
                  <div>
                    <span className="text-secondary uppercase font-semibold text-[10px]">Error Type & Message</span>
                    <div className="text-primary font-bold text-sm mt-1">{errorDetail.group?.type}</div>
                    <div className="text-secondary mt-1 bg-surface-elevated p-3 rounded-lg border border-border">
                      {errorDetail.group?.sampleMessage}
                    </div>
                  </div>

                  <div>
                    <span className="text-secondary uppercase font-semibold text-[10px]">Affected Runs ({errorDetail.affectedRuns.length})</span>
                    <div className="space-y-2 mt-2">
                      {errorDetail.affectedRuns.map(r => (
                        <div
                          key={r.id}
                          onClick={() => {
                            setSelectedRunId(r.id)
                            setActiveTab('runs')
                            setSelectedErrorSignature(null)
                          }}
                          className="p-3 rounded-lg bg-surface border border-border hover:border-signal-blue cursor-pointer flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-primary">{r.id}</span>
                            <span className="text-secondary ml-2">[{r.agentRole}]</span>
                          </div>
                          <span className="text-signal-blue font-medium flex items-center gap-1">
                            Inspect Run <ArrowUpRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {errorDetail.group?.sampleStack && (
                    <div>
                      <span className="text-secondary uppercase font-semibold text-[10px]">Sample Stack Trace</span>
                      <pre className="mt-1 bg-telemetry-bg text-telemetry-text p-3 rounded-lg border border-telemetry-border overflow-x-auto text-[11px] max-h-48">
                        {errorDetail.group.sampleStack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: DETERMINISTIC FINDINGS FEED ── */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'findings' && (
        <div className="space-y-4">
          <p className="text-xs text-secondary">
            Live deterministic engine findings triggered on ingest or periodic sweep (long running runs, repeated tool calls, repeated error signatures, silent/hung agents, and cycles).
          </p>

          <div className="space-y-3">
            {findings.length === 0 ? (
              <div className="bg-surface border border-border rounded-xl p-12 text-center text-secondary text-sm">
                <CheckCircle2 className="w-8 h-8 text-signal-green mx-auto mb-2" />
                No diagnostic findings raised. All agent execution runs are performing cleanly within normal bounds.
              </div>
            ) : (
              findings.map((f) => {
                const isCritical = f.severity === 'critical'
                const isHigh = f.severity === 'high'

                return (
                  <div
                    key={f.id}
                    className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                      isCritical
                        ? 'bg-rose-500/5 border-rose-500/30'
                        : isHigh
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-surface border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${
                        isCritical ? 'text-signal-red' : isHigh ? 'text-signal-amber' : 'text-signal-blue'
                      }`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            isCritical ? 'bg-rose-500/20 text-signal-red' : 'bg-amber-500/20 text-signal-amber'
                          }`}>
                            {f.severity}
                          </span>
                          <span className="font-mono text-xs font-bold text-primary">{f.type}</span>
                          <span className="text-[11px] text-secondary font-mono">
                            Run: {f.runId}
                          </span>
                        </div>
                        <p className="text-xs text-primary mt-1">{f.message}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-auto">
                      {f.actionTaken && f.actionTaken !== 'none' && (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-sky-500/10 text-signal-blue border border-sky-500/20 font-medium">
                          ⚡ {f.actionTaken}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setSelectedRunId(f.runId)
                          setActiveTab('runs')
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-surface-elevated text-primary shadow-sm flex items-center gap-1"
                      >
                        Inspect <ChevronRight className="w-3 h-3 text-secondary" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ── Threshold Configuration Modal ── */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <Sliders className="w-4 h-4 text-signal-blue" />
                Deterministic Detection Thresholds
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded text-secondary hover:text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-secondary block mb-1">Long-Running Run Threshold (ms):</label>
                <input
                  type="number"
                  value={thresholds.longRunningRunMs}
                  onChange={e => setThresholds({ ...thresholds, longRunningRunMs: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-primary"
                />
              </div>

              <div>
                <label className="text-secondary block mb-1">Repeated Tool Call Threshold (count):</label>
                <input
                  type="number"
                  value={thresholds.repeatedToolThreshold}
                  onChange={e => setThresholds({ ...thresholds, repeatedToolThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-primary"
                />
              </div>

              <div>
                <label className="text-secondary block mb-1">Repeated Error Signature Threshold (count):</label>
                <input
                  type="number"
                  value={thresholds.repeatedErrorThreshold}
                  onChange={e => setThresholds({ ...thresholds, repeatedErrorThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-primary"
                />
              </div>

              <div>
                <label className="text-secondary block mb-1">Silent Agent (No Activity) Seconds:</label>
                <input
                  type="number"
                  value={thresholds.noActivitySeconds}
                  onChange={e => setThresholds({ ...thresholds, noActivitySeconds: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-border bg-surface text-secondary hover:bg-surface-elevated"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-action-primary text-action-primary-text hover:bg-action-primary-hover shadow-sm"
              >
                Save Thresholds
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
