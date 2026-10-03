'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Target, Award, TrendingUp, Brain, BarChart3, Activity,
  RefreshCw, CheckCircle2, XCircle, Clock, Loader2, ChevronRight,
  Zap, ShieldCheck, BadgeDollarSign, Calendar, Play
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

interface Run {
  id: string
  workflow_id: string
  workflow_name: string
  status: string
  created_at: string
  completed_at?: string
  inputs?: any
  tenant_id?: string
}

interface DerivedStats {
  total: number
  completed: number
  failed: number
  running: number
  successRate: number
  avgDurationMs: number
  savedHours: number
  roiDollar: number
}

function computeStats(runs: Run[]): DerivedStats {
  const total = runs.length
  const completed = runs.filter(r => r.status === 'completed').length
  const failed = runs.filter(r => r.status === 'error' || r.status === 'failed').length
  const running = runs.filter(r => r.status === 'running' || r.status === 'queued').length
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0

  // Estimate avg duration from completed runs with timestamps
  const completedWithDuration = runs.filter(r => r.status === 'completed' && r.completed_at && r.created_at)
  const avgDurationMs = completedWithDuration.length > 0
    ? completedWithDuration.reduce((acc, r) => {
        return acc + (new Date(r.completed_at!).getTime() - new Date(r.created_at).getTime())
      }, 0) / completedWithDuration.length
    : 0

  // Assumption: each completed run saves ~30 min human labor @ $50/hr
  const savedHours = completed * 0.5
  const roiDollar = savedHours * 50

  return { total, completed, failed, running, successRate, avgDurationMs, savedHours, roiDollar }
}

function fmtDuration(ms: number): string {
  if (!ms) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  completed: { label: 'Completed', color: 'text-signal-green', bg: 'bg-signal-green-bg', border: 'border-signal-green-border', icon: CheckCircle2 },
  error: { label: 'Failed', color: 'text-signal-red', bg: 'bg-signal-red-bg', border: 'border-signal-red-border', icon: XCircle },
  failed: { label: 'Failed', color: 'text-signal-red', bg: 'bg-signal-red-bg', border: 'border-signal-red-border', icon: XCircle },
  running: { label: 'Running', color: 'text-signal-blue', bg: 'bg-signal-blue-bg', border: 'border-signal-blue-border', icon: Loader2 },
  queued: { label: 'Queued', color: 'text-signal-amber', bg: 'bg-signal-amber-bg', border: 'border-signal-amber-border', icon: Clock },
  pending: { label: 'Pending', color: 'text-signal-amber', bg: 'bg-signal-amber-bg', border: 'border-signal-amber-border', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'text-muted', bg: 'bg-secondary', border: 'border-border', icon: XCircle },
}

export default function OutcomesPage() {
  const router = useRouter()
  const { error: toastError } = useToast()
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DerivedStats | null>(null)

  const loadOutcomes = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.workflows.listRuns({ limit: 50 })
      const runsData: Run[] = res.runs || []
      setRuns(runsData)
      setStats(computeStats(runsData))
    } catch (err: any) {
      toastError('Failed to load outcomes', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOutcomes()
    // Auto-refresh every 30s
    const interval = setInterval(loadOutcomes, 30000)
    return () => clearInterval(interval)
  }, [])

  const statCards = stats ? [
    {
      label: 'Success Rate',
      value: `${stats.successRate}%`,
      sub: `${stats.completed} of ${stats.total} outcomes achieved`,
      icon: Award,
      iconColor: 'text-signal-green',
      trend: stats.successRate >= 80 ? 'up' : 'neutral'
    },
    {
      label: 'Blended Labor ROI',
      value: `$${stats.roiDollar.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      sub: `${stats.savedHours.toFixed(1)} hrs of human labor saved`,
      icon: BadgeDollarSign,
      iconColor: 'text-signal-blue',
      trend: 'up'
    },
    {
      label: 'Avg Execution Time',
      value: fmtDuration(stats.avgDurationMs),
      sub: 'Per completed autonomous run',
      icon: Zap,
      iconColor: 'text-signal-amber',
      trend: 'neutral'
    },
    {
      label: 'Active Swarms',
      value: String(stats.running),
      sub: `${stats.total} total runs logged`,
      icon: Activity,
      iconColor: 'text-primary',
      trend: 'neutral'
    },
  ] : []

  return (
    <div className="flex flex-col h-full bg-background text-primary overflow-y-auto custom-scrollbar font-sans">

      {/* Page Header */}
      <div className="h-14 border-b border-border bg-surface/90 backdrop-blur-md flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Target size={15} className="text-signal-blue" />
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">Outcomes & Task History</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard/terminal')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-action-primary hover:bg-action-primary-hover text-action-primary-text rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Play size={11} />
            New Task
          </button>
          <button
            onClick={loadOutcomes}
            disabled={loading}
            className="p-2 bg-surface border border-border rounded-md text-muted hover:text-primary transition-all disabled:opacity-40 cursor-pointer shadow-xs"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-7 space-y-7">

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading && !stats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-lg p-5 h-24 animate-pulse shadow-xs" />
            ))
          ) : (
            statCards.map((card) => (
              <div key={card.label} className="bg-surface border border-border rounded-lg p-5 space-y-2 hover:border-signal-blue/40 transition-all shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">{card.label}</span>
                  <card.icon size={15} className={card.iconColor} />
                </div>
                <div className="text-2xl font-bold text-primary tracking-tight">{card.value}</div>
                <p className="text-xs text-muted font-normal leading-relaxed">{card.sub}</p>
              </div>
            ))
          )}
        </div>

        {/* Run History Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">Execution History</span>
            {!loading && runs.length > 0 && (
              <span className="text-xs font-semibold text-muted">{runs.length} total runs</span>
            )}
          </div>

          {loading && runs.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-surface border border-border rounded-lg h-14 animate-pulse shadow-xs" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center py-16 bg-surface shadow-xs">
              <Target size={28} className="text-muted/60 mb-2" />
              <h5 className="text-sm font-bold text-primary">No task history yet</h5>
              <p className="text-xs text-muted max-w-xs mt-1 leading-relaxed">
                Task runs will appear here as you launch autonomous tasks from the main terminal.
              </p>
              <button
                onClick={() => router.push('/dashboard/terminal')}
                className="mt-4 px-4 py-2 bg-action-primary hover:bg-action-primary-hover text-action-primary-text rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                Launch First Task
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => {
                const sc = STATUS_CONFIG[run.status] || STATUS_CONFIG['pending']
                const StatusIcon = sc.icon
                const duration = run.completed_at
                  ? new Date(run.completed_at).getTime() - new Date(run.created_at).getTime()
                  : 0

                return (
                  <div
                    key={run.id}
                    className="group bg-surface border border-border hover:border-signal-blue/40 rounded-lg px-5 py-3.5 flex items-center gap-4 transition-all cursor-pointer shadow-xs"
                    onClick={() => router.push(`/dashboard/workflows`)}
                  >
                    {/* Status Icon */}
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${sc.bg} border ${sc.border}`}>
                      <StatusIcon size={14} className={`${sc.color} ${run.status === 'running' ? 'animate-spin' : ''}`} />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-xs font-bold text-primary truncate">
                        {run.workflow_name || 'Unnamed Task'}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-semibold ${sc.color} ${sc.bg} border ${sc.border} px-2 py-0.5 rounded`}>
                          {sc.label}
                        </span>
                        <span className="text-xs text-muted font-normal">
                          <Calendar size={11} className="inline mr-1" />
                          {fmtDate(run.created_at)}
                        </span>
                        {duration > 0 && (
                          <span className="text-xs text-muted font-normal">
                            <Zap size={11} className="inline mr-1 text-signal-amber" />
                            {fmtDuration(duration)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Time ago + Arrow */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted hidden md:block">{timeAgo(run.created_at)}</span>
                      <ChevronRight size={14} className="text-muted group-hover:text-primary transition-colors group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Success Breakdown Chart */}
        {stats && stats.total > 0 && (
          <div className="bg-surface border border-border rounded-lg p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-secondary">Outcome Breakdown</span>
              <BarChart3 size={15} className="text-muted" />
            </div>

            {/* Stacked bar */}
            <div className="h-2 w-full rounded-full overflow-hidden flex gap-0.5 bg-secondary">
              {stats.completed > 0 && (
                <div
                  className="h-full bg-signal-green rounded-full transition-all duration-500"
                  style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                />
              )}
              {stats.running > 0 && (
                <div
                  className="h-full bg-signal-blue animate-pulse transition-all duration-500"
                  style={{ width: `${(stats.running / stats.total) * 100}%` }}
                />
              )}
              {stats.failed > 0 && (
                <div
                  className="h-full bg-signal-red transition-all duration-500"
                  style={{ width: `${(stats.failed / stats.total) * 100}%` }}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 flex-wrap pt-1">
              {[
                { label: 'Completed', count: stats.completed, color: 'bg-signal-green' },
                { label: 'Running', count: stats.running, color: 'bg-signal-blue' },
                { label: 'Failed', count: stats.failed, color: 'bg-signal-red' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${item.color}`} />
                  <span className="text-xs text-muted">{item.label}</span>
                  <span className="text-xs font-bold text-primary">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
