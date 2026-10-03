'use client'

import { useState, useEffect } from 'react'
import { X, Clock, CheckCircle2, AlertCircle, Loader2, RotateCcw, History, FileText } from 'lucide-react'
import { api } from '@/lib/api'

interface WorkflowRun {
  id: string
  workflow_id?: string
  workflow_name: string
  status: 'completed' | 'failed' | 'running' | 'queued'
  created_at: string
  completed_at?: string
  prompt?: string
  duration_ms?: number
  task_receipt?: string
}

interface HistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  tenantId?: string
  onRerun?: (prompt: string) => void
  onViewArtifact?: (runId: string) => void
}

function statusIcon(status: string) {
  const norm = (status || '').toLowerCase()
  switch (norm) {
    case 'completed': return <CheckCircle2 size={14} className="text-emerald-600" />
    case 'failed': return <AlertCircle size={14} className="text-rose-600" />
    case 'running':
    case 'executing':
    case 'planning':
      return <Loader2 size={14} className="text-sky-600 animate-spin" />
    default: return <Clock size={14} className="text-muted" />
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    completed: 'Done',
    failed: 'Failed',
    running: 'In Progress',
    executing: 'In Progress',
    planning: 'Planning',
    queued: 'Queued'
  }
  return map[(status || '').toLowerCase()] || status
}

function formatDuration(ms?: number): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function HistoryPanel({
  isOpen,
  onClose,
  tenantId,
  onRerun,
  onViewArtifact
}: HistoryPanelProps) {
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed'>('all')

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    api.workflows.listRuns({ limit: 30 })
      .then(res => {
        setRuns(res.runs || [])
      })
      .catch(err => {
        console.warn('Failed to load workflow runs:', err)
      })
      .finally(() => setLoading(false))
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!isOpen) return null

  const filtered = runs.filter(r => {
    if (filter === 'completed') return r.status === 'completed'
    if (filter === 'failed') return r.status === 'failed'
    return true
  })

  return (
    <div className="fixed inset-y-0 right-0 w-80 md:w-96 bg-surface border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-subtle/50">
        <div className="flex items-center gap-2">
          <History size={16} className="text-secondary" />
          <h3 className="text-xs font-semibold text-primary">Execution History</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-secondary text-secondary hover:text-primary transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-border bg-subtle/30 px-3 py-2 gap-1.5">
        {(['all', 'completed', 'failed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-all cursor-pointer ${
              filter === f
                ? 'bg-surface text-primary shadow-xs border border-border'
                : 'text-secondary hover:text-primary hover:bg-secondary/60'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="space-y-4 p-4 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="space-y-2">
                <div className="h-4 bg-secondary rounded w-[60%]" />
                <div className="h-3 bg-secondary rounded w-[40%]" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-secondary px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center text-muted">
              <Clock size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-primary">No task history yet</p>
              <p className="text-xs text-secondary">Your runs and automations will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(run => (
              <div key={run.id} className="p-4 hover:bg-subtle/50 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {statusIcon(run.status)}
                      <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">
                        {statusLabel(run.status)}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-primary truncate">{run.workflow_name}</p>
                    {run.prompt && (
                      <p className="text-xs text-secondary mt-1 line-clamp-2 italic">"{run.prompt}"</p>
                    )}
                    {run.task_receipt && (
                      <p className="text-xs text-primary mt-1.5 p-2 bg-secondary/60 rounded border border-border leading-relaxed">
                        {run.task_receipt}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted">
                      <span>{timeAgo(run.created_at)}</span>
                      {run.duration_ms && <span>⏱ {formatDuration(run.duration_ms)}</span>}
                    </div>

                    {/* View Deliverable Button (Artifact) */}
                    {run.status && run.status.toLowerCase() === 'completed' && onViewArtifact && (
                      <button
                        onClick={() => onViewArtifact(run.id)}
                        className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline cursor-pointer bg-sky-50 border border-sky-200 rounded-md px-2 py-1 transition-all shadow-xs"
                      >
                        <FileText size={11} />
                        <span>View Deliverable</span>
                      </button>
                    )}
                  </div>
                  {onRerun && run.prompt && (
                    <button
                      onClick={() => onRerun(run.prompt || '')}
                      title="Recall prompt"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md cursor-pointer
                        text-secondary hover:text-primary hover:bg-secondary"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-subtle/50">
        <p className="text-xs text-secondary font-medium">Showing last {filtered.length} runs</p>
      </div>
    </div>
  )
}
