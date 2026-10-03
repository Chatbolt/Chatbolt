'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart2,
  TrendingUp,
  Clock,
  Star,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Calendar,
  Target,
  CheckCircle2,
  Award,
  Activity,
  ArrowUpRight
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyTask {
  date: string
  count: number
  completed: number
  failed: number
}

interface TopCategory {
  category: string
  count: number
}

interface ProductivityData {
  daily_tasks: DailyTask[]
  top_categories: TopCategory[]
  time_saved_hours: number
  total_completed: number
  current_streak: number
  quality: { avg_rating: number | null; total_ratings: number }
}

interface AutomationStat {
  id: string
  name: string
  type: string
  total_runs: number
  successful_runs: number
  avg_duration_ms: number | null
  last_run_at: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDuration(ms: number | null) {
  if (!ms) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function successRateBadge(rate: number) {
  if (rate >= 90) return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (rate >= 70) return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-rose-50 text-rose-800 border-rose-200'
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

function StatCard({ icon, label, value, sub, accent }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <div className="w-8 h-8 rounded-md bg-secondary border border-border flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold font-mono text-primary tracking-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Custom Bar Chart ───────────────────────────────────────────────────────────

function DailyActivityChart({ data }: { data: DailyTask[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted text-xs">
        No task activity recorded for this period
      </div>
    )
  }

  const maxCount = Math.max(...data.map(d => Number(d.count) || 0), 1)
  const recent = data.slice(-30)

  return (
    <div className="w-full space-y-3">
      <div className="flex items-end gap-1.5 h-44 w-full overflow-x-auto pb-2 pt-4 border-b border-border">
        {recent.map((d, i) => {
          const total = Number(d.count) || 0
          const completed = Number(d.completed) || 0
          const failed = Number(d.failed) || 0
          const other = Math.max(0, total - completed - failed)
          const heightPct = total === 0 ? 0 : Math.max(6, (total / maxCount) * 100)

          return (
            <div
              key={i}
              className="flex flex-col items-center gap-1 flex-1 min-w-[16px] group cursor-default relative h-full justify-end"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 hidden group-hover:flex flex-col items-center pointer-events-none">
                <div className="bg-surface border border-border-strong rounded-md px-3 py-2 text-xs whitespace-nowrap shadow-md">
                  <p className="text-primary font-semibold font-mono">{formatDate(d.date)}</p>
                  <p className="text-emerald-700 font-medium">✓ {completed} completed</p>
                  {failed > 0 && <p className="text-rose-700 font-medium">✗ {failed} failed</p>}
                  {other > 0 && <p className="text-muted">~ {other} in progress</p>}
                </div>
              </div>

              {/* Bar stack */}
              <div
                className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse bg-gray-100 border border-border/40"
                style={{ height: `${heightPct}%` }}
              >
                {failed > 0 && (
                  <div
                    className="w-full bg-rose-500 shrink-0"
                    style={{ height: `${(failed / total) * 100}%` }}
                  />
                )}
                {other > 0 && (
                  <div
                    className="w-full bg-gray-400 shrink-0"
                    style={{ height: `${(other / total) * 100}%` }}
                  />
                )}
                {completed > 0 && (
                  <div
                    className="w-full bg-emerald-600 shrink-0"
                    style={{ height: `${(completed / total) * 100}%` }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex gap-1.5 w-full overflow-x-auto">
        {recent.map((d, i) => (
          <div key={i} className="flex-1 min-w-[16px] text-center">
            {i % Math.max(1, Math.floor(recent.length / 6)) === 0 && (
              <span className="text-[10px] text-muted font-mono leading-none">
                {formatDate(d.date)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
          <span className="text-secondary">Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          <span className="text-secondary">Failed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-gray-400" />
          <span className="text-secondary">In Progress</span>
        </div>
      </div>
    </div>
  )
}

// ── Top Categories Chart ───────────────────────────────────────────────────────

function TopCategoriesChart({ data }: { data: TopCategory[] }) {
  if (!data || data.length === 0) {
    return <p className="text-muted text-xs py-4 text-center">No category data recorded yet</p>
  }
  const maxCount = Math.max(...data.map(d => Number(d.count) || 0), 1)
  return (
    <div className="flex flex-col gap-3">
      {data.map((cat, i) => {
        const count = Number(cat.count) || 0
        const pct = Math.round((count / maxCount) * 100)
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-secondary font-medium w-28 truncate capitalize">
              {cat.category || 'Standard task'}
            </span>
            <div className="flex-1 bg-gray-100 border border-border/40 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-action-primary rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-mono font-semibold text-primary w-8 text-right">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Stars Display ──────────────────────────────────────────────────────────────

function StarRating({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted text-xs">No feedback ratings recorded</span>
  const pct = Math.round(((value + 1) / 2) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <Star
            key={s}
            className={`w-4 h-4 ${s <= Math.round((pct / 100) * 5) ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`}
          />
        ))}
      </div>
      <span className="text-xs font-mono font-medium text-secondary">{pct}% positive feedback</span>
    </div>
  )
}

// ── Feedback Widget ────────────────────────────────────────────────────────────

function FeedbackWidget() {
  const [lastRun, setLastRun] = useState<any>(null)
  const [rated, setRated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    api.tasks.history(1).then(res => {
      if (res.runs && res.runs.length > 0) setLastRun(res.runs[0])
    }).catch(() => {})
  }, [])

  const handleRate = async (r: number) => {
    if (!lastRun || submitting || rated) return
    setSubmitting(true)
    try {
      await api.analytics.feedback(lastRun.id, r)
      setRated(true)
      toast({ title: 'Task evaluation saved', type: 'success' })
    } catch {
      toast({ title: 'Could not record feedback', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!lastRun) return null

  return (
    <div className="bg-surface border border-border rounded-lg p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-secondary" />
            Rate Output Quality: <span className="font-normal text-secondary truncate">{lastRun.workflow?.name || lastRun.trigger || 'Recent Process'}</span>
          </p>
          <p className="text-[10px] text-muted font-mono mt-0.5">{formatRelativeTime(lastRun.created_at)}</p>
        </div>
        {rated ? (
          <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            Feedback saved
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleRate(1)}
              disabled={submitting}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-surface hover:bg-secondary text-primary border border-border text-xs font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <ThumbsUp className="w-3 h-3 text-emerald-700" />
              Optimal
            </button>
            <button
              onClick={() => handleRate(-1)}
              disabled={submitting}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-surface hover:bg-secondary text-secondary border border-border text-xs font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <ThumbsDown className="w-3 h-3 text-rose-700" />
              Suboptimal
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Personal Tab ──────────────────────────────────────────────────────────────

function PersonalTab({ data, loading }: { data: ProductivityData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-lg p-5 h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data || data.total_completed === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6 bg-surface border border-border rounded-lg shadow-xs">
        <div className="w-12 h-12 rounded-lg bg-secondary border border-border flex items-center justify-center text-secondary">
          <BarChart2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-primary">No performance records found</h2>
          <p className="text-xs text-muted max-w-sm">
            Execute agent workflows and pipeline runs to populate real-time analytics.
          </p>
        </div>
      </div>
    )
  }

  const avgRating = data.quality?.avg_rating !== null ? Number(data.quality.avg_rating) : null

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-700" />}
          label="Tasks Completed"
          value={data.total_completed}
          sub="Total executions"
        />
        <StatCard
          icon={<Clock className="w-4 h-4 text-primary" />}
          label="Hours Saved"
          value={`${data.time_saved_hours}h`}
          sub="Calculated automation ROI"
        />
        <StatCard
          icon={<Calendar className="w-4 h-4 text-secondary" />}
          label="Active Days"
          value={data.current_streak}
          sub="Consecutive execution days"
        />
        <StatCard
          icon={<Star className="w-4 h-4 text-amber-600" />}
          label="Quality Accuracy"
          value={avgRating !== null ? `${Math.round(((avgRating + 1) / 2) * 100)}%` : 'N/A'}
          sub={`${data.quality?.total_ratings || 0} user audits`}
        />
      </div>

      {/* Daily Activity Chart */}
      <div className="bg-surface border border-border rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Activity className="w-4 h-4 text-secondary" />
              Daily Execution Throughput
            </h3>
            <p className="text-xs text-muted">Completed vs failed runs per day</p>
          </div>
        </div>
        <DailyActivityChart data={data.daily_tasks} />
      </div>

      {/* Categories & Quality */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-lg p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-3 border-b border-border pb-2">
            <Target className="w-4 h-4 text-secondary" />
            Top Workflow Categories
          </h3>
          <TopCategoriesChart data={data.top_categories} />
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-3 border-b border-border pb-2">
            <Star className="w-4 h-4 text-secondary" />
            Evaluated Task Quality
          </h3>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-3xl font-bold font-mono text-primary mb-1">
                {avgRating !== null ? `${Math.round(((avgRating + 1) / 2) * 100)}%` : '—'}
              </p>
              <StarRating value={avgRating} />
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Synthesized from {data.quality?.total_ratings || 0} human-in-the-loop evaluations.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Widget */}
      <FeedbackWidget />
    </div>
  )
}

// ── Automations Tab ────────────────────────────────────────────────────────────

function AutomationsTab({
  data,
  loading,
}: {
  data: AutomationStat[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 space-y-3 shadow-xs animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-secondary rounded-md" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center text-muted">
            <Zap className="w-8 h-8 text-muted" />
            <p className="text-xs font-semibold text-primary">No automation performance metrics recorded</p>
            <p className="text-xs text-muted max-w-xs">
              Execute recurring schedules or event triggers to build performance benchmarks.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left font-semibold text-secondary">Automation Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-secondary">Trigger Type</th>
                  <th className="px-4 py-3 text-right font-semibold text-secondary">Total Runs</th>
                  <th className="px-4 py-3 text-right font-semibold text-secondary">Success Rate</th>
                  <th className="px-4 py-3 text-right font-semibold text-secondary">Avg Latency</th>
                  <th className="px-4 py-3 text-right font-semibold text-secondary">Last Invoked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map(a => {
                  const total = Number(a.total_runs) || 0
                  const success = Number(a.successful_runs) || 0
                  const rate = total > 0 ? Math.round((success / total) * 100) : 0
                  return (
                    <tr key={a.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-primary font-medium truncate max-w-xs">
                        {a.name}
                      </td>
                      <td className="px-4 py-3 text-secondary capitalize font-mono">
                        {a.type || 'Cron'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-primary font-semibold">{total}</td>
                      <td className="px-4 py-3 text-right">
                        {total === 0 ? (
                          <span className="text-muted font-mono">—</span>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${successRateBadge(rate)}`}>
                            {rate}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted">
                        {formatDuration(a.avg_duration_ms)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted">
                        {formatRelativeTime(a.last_run_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FeedbackWidget />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'Personal' | 'Automations'

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('Personal')
  const [days, setDays] = useState(30)

  const [productivityData, setProductivityData] = useState<ProductivityData | null>(null)
  const [automationsData, setAutomationsData] = useState<AutomationStat[]>([])
  const [loadingProductivity, setLoadingProductivity] = useState(true)
  const [loadingAutomations, setLoadingAutomations] = useState(true)

  const { toast } = useToast()

  const fetchProductivity = useCallback(async () => {
    setLoadingProductivity(true)
    try {
      const res = await api.analytics.productivity(days)
      setProductivityData(res)
    } catch {
      toast({ title: 'Failed to load productivity metrics', type: 'error' })
    } finally {
      setLoadingProductivity(false)
    }
  }, [days])

  const fetchAutomations = useCallback(async () => {
    setLoadingAutomations(true)
    try {
      const res = await api.analytics.automationPerformance()
      setAutomationsData(res.automations || [])
    } catch {
      toast({ title: 'Failed to load automation metrics', type: 'error' })
    } finally {
      setLoadingAutomations(false)
    }
  }, [])

  useEffect(() => { fetchProductivity() }, [fetchProductivity])
  useEffect(() => { fetchAutomations() }, [fetchAutomations])

  return (
    <div className="min-h-screen bg-background text-primary">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <span className="text-xs font-mono font-medium text-muted uppercase tracking-wider">Metrics & Performance</span>
            <h1 className="text-2xl font-bold tracking-tight text-primary mt-1">Analytics & Operational Insights</h1>
            <p className="text-xs text-secondary mt-1">
              Real-time task throughput, automation success ratios, and quality scores.
            </p>
          </div>

          {/* Timeframe Filter */}
          <div className="flex items-center p-0.5 bg-surface border border-border rounded-md shadow-xs self-start">
            {[7, 14, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs font-mono rounded font-medium transition-all cursor-pointer ${
                  days === d
                    ? 'bg-action-primary text-action-primary-text shadow-xs'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center p-1 bg-surface border border-border rounded-lg shadow-xs w-fit">
          {(['Personal', 'Automations'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                tab === t
                  ? 'bg-action-primary text-action-primary-text shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-secondary'
              }`}
            >
              {t === 'Personal' && <TrendingUp className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />}
              {t === 'Automations' && <Zap className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />}
              {t} Overview
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'Personal' && (
          <PersonalTab data={productivityData} loading={loadingProductivity} />
        )}
        {tab === 'Automations' && (
          <AutomationsTab data={automationsData} loading={loadingAutomations} />
        )}
      </div>
    </div>
  )
}
