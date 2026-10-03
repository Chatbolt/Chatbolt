'use client'

import React, { useState, useEffect } from 'react'
import {
  Clock,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  Trash2,
  Plus,
  RefreshCw,
  Zap,
  Calendar,
  Mail,
  GitPullRequest,
  Check,
  X,
  ChevronRight,
  HelpCircle,
  FileText,
  Activity,
  Layers
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

interface BackgroundDigestModalProps {
  isOpen: boolean
  onClose: () => void
  agentName?: string
}

export default function BackgroundDigestModal({
  isOpen,
  onClose,
  agentName = 'Aria'
}: BackgroundDigestModalProps) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()

  const [loading, setLoading] = useState(false)
  const [digest, setDigest] = useState<any>(null)
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | 'all'>('24h')
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'triggers' | 'simulate'>('timeline')

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  // New Trigger Modal State
  const [showAddTrigger, setShowAddTrigger] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<'recurring_cron' | 'event_watcher'>('recurring_cron')
  const [newCron, setNewCron] = useState('0 9 * * 1-5')
  const [newEventSource, setNewEventSource] = useState('google_calendar')
  const [newPrompt, setNewPrompt] = useState('')
  const [newHasSideEffect, setNewHasSideEffect] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadDigest(timeframe)
    }
  }, [isOpen, timeframe])

  const loadDigest = async (tf: '24h' | '7d' | 'all') => {
    setLoading(true)
    try {
      const res = await api.personalAgent.getDigest(tf)
      if (res.success && res.digest) {
        setDigest(res.digest)
      }
    } catch (err: any) {
      console.warn('Failed to load background digest:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (approvalId: string) => {
    setActionLoading(approvalId)
    try {
      const res = await api.personalAgent.approvePendingAction(approvalId, 'Approved via Executive Digest')
      if (res.success) {
        toastSuccess('Action Approved', 'Background task executed successfully and trust score increased.')
        await loadDigest(timeframe)
      }
    } catch (err: any) {
      toastError('Approval Failed', err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (approvalId: string) => {
    setActionLoading(approvalId)
    try {
      const res = await api.personalAgent.rejectPendingAction(approvalId, 'Denied by user in Executive Digest')
      if (res.success) {
        toastInfo('Action Denied', 'Background action cancelled.')
        await loadDigest(timeframe)
      }
    } catch (err: any) {
      toastError('Denial Failed', err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleTrigger = async (triggerId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active'
    setActionLoading(triggerId)
    try {
      const res = await api.personalAgent.toggleTriggerStatus(triggerId, nextStatus)
      if (res.success) {
        toastSuccess('Schedule Updated', `Trigger is now ${nextStatus}.`)
        await loadDigest(timeframe)
      }
    } catch (err: any) {
      toastError('Update Failed', err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRunTriggerNow = async (triggerId: string) => {
    setActionLoading(`run_${triggerId}`)
    try {
      const res = await api.personalAgent.runTriggerNow(triggerId)
      if (res.success) {
        toastSuccess('Task Dispatched', 'Background task executed. Check the timeline.')
        await loadDigest(timeframe)
      }
    } catch (err: any) {
      toastError('Execution Failed', err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteTrigger = async (triggerId: string) => {
    try {
      const res = await api.personalAgent.deleteTrigger(triggerId)
      if (res.success) {
        toastSuccess('Trigger Removed', 'Scheduled check deleted.')
        await loadDigest(timeframe)
      }
    } catch (err: any) {
      toastError('Delete Failed', err.message)
    }
  }

  const handleSimulateEvent = async (source: string, eventType: string, payload: any) => {
    setIsSimulating(true)
    try {
      const res = await api.personalAgent.simulateEvent({ source, eventType, payload })
      if (res.success) {
        toastSuccess('Event Dispatched', `Simulated ${source}.${eventType} -> ${res.matchedCount} watcher(s) triggered.`)
        await loadDigest(timeframe)
      }
    } catch (err: any) {
      toastError('Simulation Failed', err.message)
    } finally {
      setIsSimulating(false)
    }
  }

  const handleSimulateMultiDay = async (days: number) => {
    setIsSimulating(true)
    try {
      const res = await api.personalAgent.simulateMultiDay(days)
      if (res.success) {
        toastSuccess('Multi-Day Simulation Complete', res.summary)
        setTimeframe('7d')
        await loadDigest('7d')
      }
    } catch (err: any) {
      toastError('Simulation Failed', err.message)
    } finally {
      setIsSimulating(false)
    }
  }

  const handleCreateTriggerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newPrompt.trim()) return

    try {
      const payload: any = {
        title: newTitle.trim(),
        triggerType: newType,
        actionPayload: {
          taskType: 'custom',
          title: newTitle.trim(),
          prompt: newPrompt.trim(),
          intendedSideEffects: newHasSideEffect
            ? [{ type: 'send_email', preview: `Notification for ${newTitle.trim()}`, riskLevel: 'low' }]
            : []
        }
      }

      if (newType === 'recurring_cron') {
        payload.scheduleCron = newCron
      } else {
        payload.eventPattern = { source: newEventSource, eventType: '*' }
      }

      const res = await api.personalAgent.createTrigger(payload)
      if (res.success) {
        toastSuccess('Routine Scheduled', 'New always-on trigger registered.')
        setShowAddTrigger(false)
        setNewTitle('')
        setNewPrompt('')
        await loadDigest(timeframe)
      }
    } catch (err: any) {
      toastError('Creation Failed', err.message)
    }
  }

  if (!isOpen) return null

  const metrics = digest?.metrics || {
    totalRuns: 0,
    completedRuns: 0,
    actionsAutoExecuted: 0,
    pendingApprovalsCount: 0,
    estimatedMinutesSaved: 0,
    autonomyLevel: 'L1_SUPERVISED',
    trustScore: 15
  }

  const pendingApprovals = digest?.pendingApprovals || []
  const timeline = digest?.timeline || []
  const activeTriggers = digest?.activeTriggers || []

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-border bg-surface-subtle flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-action-primary/10 border border-action-primary/20 flex items-center justify-center text-action-primary shadow-xs">
              <Clock size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-primary tracking-tight">
                  Always-On Assistant Activity
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Always-On Active
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                What {agentName} is doing right now and completed while you were away.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadDigest(timeframe)}
              disabled={loading}
              className="p-2 text-secondary hover:text-primary rounded-lg border border-border hover:bg-surface transition-colors cursor-pointer"
              title="Refresh Activity"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-action-primary' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-secondary hover:text-primary rounded-lg border border-border hover:bg-surface transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Executive Summary Banner */}
        <div className="px-6 py-4 bg-surface border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary">Autonomy Level:</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {metrics.autonomyLevel?.replace('_', ' ')}
                </span>
                <span className="text-xs text-muted">
                  (Trust Score: {metrics.trustScore}%)
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                {metrics.autonomyLevel === 'L1_SUPERVISED'
                  ? 'Default cautious mode for unattended tasks. Side effects held for 1-click human confirmation.'
                  : metrics.autonomyLevel === 'L2_HYBRID'
                  ? 'Hybrid mode: verified read routines auto-execute, high-risk actions prompt for approval.'
                  : 'Full autonomy: standing trust rules auto-approve routine workflows.'}
              </p>
            </div>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center p-1 bg-surface-subtle border border-border rounded-lg text-xs font-medium shrink-0">
            {(['24h', '7d', 'all'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  timeframe === tf
                    ? 'bg-action-primary text-white shadow-xs'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                {tf === '24h' ? 'Last 24 Hours' : tf === '7d' ? 'Past 7 Days' : 'All Time'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metric Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 border-b border-border bg-surface-subtle/50">
          <div className="p-3.5 rounded-xl border border-border bg-surface">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Completed Checks</div>
            <div className="text-2xl font-bold text-primary mt-1">{metrics.completedRuns}</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
              <CheckCircle2 size={11} /> 100% Reliable
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-surface">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Auto-Executed Actions</div>
            <div className="text-2xl font-bold text-primary mt-1">{metrics.actionsAutoExecuted}</div>
            <div className="text-[11px] text-secondary mt-0.5">Background operations</div>
          </div>

          <div className={`p-3.5 rounded-xl border bg-surface ${metrics.pendingApprovalsCount > 0 ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-border'}`}>
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Pending Approvals</div>
            <div className={`text-2xl font-bold mt-1 ${metrics.pendingApprovalsCount > 0 ? 'text-amber-500' : 'text-primary'}`}>
              {metrics.pendingApprovalsCount}
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              {metrics.pendingApprovalsCount > 0 ? 'Review requested below' : 'All clear'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-surface">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Estimated Time Saved</div>
            <div className="text-2xl font-bold text-emerald-500 mt-1">~{metrics.estimatedMinutesSaved}m</div>
            <div className="text-[11px] text-secondary mt-0.5">Deep focus reclaimed</div>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="px-6 pt-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-1">
            {[
              { id: 'timeline', label: `Activity Timeline (${timeline.length})`, icon: Activity },
              { id: 'triggers', label: `Scheduled Routines (${activeTriggers.length})`, icon: Clock },
              { id: 'simulate', label: 'Multi-Day & Event Testing', icon: Zap }
            ].map(tab => {
              const isActive = activeSubTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'border-action-primary text-action-primary'
                      : 'border-transparent text-secondary hover:text-primary'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {activeSubTab === 'triggers' && (
            <button
              onClick={() => setShowAddTrigger(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-action-primary hover:bg-action-primary/90 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>New Scheduled Routine</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          
          {/* PENDING HUMAN-IN-THE-LOOP APPROVALS BANNER */}
          {pendingApprovals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-500" />
                  <h3 className="text-sm font-bold text-primary">
                    Action Approvals Waiting for You ({pendingApprovals.length})
                  </h3>
                </div>
                <span className="text-[11px] text-muted">
                  Enforced under {metrics.autonomyLevel?.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-3">
                {pendingApprovals.map((appr: any) => (
                  <div
                    key={appr.id}
                    className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            {appr.actionType}
                          </span>
                          <span className="text-xs font-bold text-primary">
                            {appr.description}
                          </span>
                        </div>
                        {appr.proposedPayload && (
                          <div className="mt-2 text-xs text-secondary bg-surface p-2.5 rounded-lg border border-border font-mono">
                            {appr.proposedPayload.preview || JSON.stringify(appr.proposedPayload, null, 2)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleReject(appr.id)}
                          disabled={actionLoading === appr.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
                        >
                          <X size={13} />
                          <span>Deny</span>
                        </button>
                        <button
                          onClick={() => handleApprove(appr.id)}
                          disabled={actionLoading === appr.id}
                          className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          <Check size={13} />
                          <span>Approve & Run</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: ACTIVITY TIMELINE */}
          {activeSubTab === 'timeline' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-border bg-surface-subtle/50 text-xs text-secondary leading-relaxed">
                <strong className="text-primary font-semibold">Executive Narrative: </strong>
                {digest?.executiveNarrative}
              </div>

              {timeline.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-border text-muted text-xs space-y-2">
                  <Clock size={28} className="mx-auto text-muted/60" />
                  <p className="font-semibold text-primary">No background activity recorded in this timeframe.</p>
                  <p>Trigger a test run or event below to observe the always-on loop.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {timeline.map((run: any) => {
                    const isWaiting = run.status === 'waiting_approval'
                    const isCompleted = run.status === 'completed' || run.status === 'action_approved'
                    const isRejected = run.status === 'action_rejected'

                    return (
                      <div
                        key={run.id}
                        className="p-4 rounded-xl border border-border bg-surface hover:border-border-hover transition-colors space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              isWaiting ? 'bg-amber-500 animate-ping' : isCompleted ? 'bg-emerald-500' : 'bg-rose-500'
                            }`} />
                            <h4 className="text-xs font-bold text-primary">
                              {run.title}
                            </h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-subtle text-muted border border-border">
                              {run.triggerType}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-muted">
                            <span>{new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span className={`font-semibold capitalize ${
                              isWaiting ? 'text-amber-500' : isCompleted ? 'text-emerald-500' : 'text-rose-500'
                            }`}>
                              {run.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-secondary leading-relaxed pl-4 border-l-2 border-border-subtle">
                          {run.executiveSummary}
                        </p>

                        {/* Artifacts or Side-Effects Executed */}
                        {run.sideEffectsExecuted && run.sideEffectsExecuted.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1 pl-4">
                            {run.sideEffectsExecuted.map((se: any, i: number) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 size={10} />
                                {se.details || se.type}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCHEDULED ROUTINES & WATCHERS */}
          {activeSubTab === 'triggers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">
                  Lightweight recurring checks and event listeners active in the background.
                </p>
              </div>

              <div className="space-y-3">
                {activeTriggers.map((trig: any) => (
                  <div
                    key={trig.id}
                    className="p-4 rounded-xl border border-border bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-primary">{trig.title}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-subtle text-muted border border-border">
                          {trig.triggerType === 'recurring_cron' ? `Cron: ${trig.scheduleCron || 'Daily'}` : `Event: ${trig.eventPattern?.source}`}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                          trig.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {trig.status}
                        </span>
                      </div>
                      <p className="text-xs text-secondary">
                        {trig.description || trig.actionPayload?.prompt?.slice(0, 100)}
                      </p>
                      {trig.nextRunAt && (
                        <div className="text-[11px] text-muted">
                          Next scheduled run: {new Date(trig.nextRunAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRunTriggerNow(trig.id)}
                        disabled={actionLoading === `run_${trig.id}`}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-secondary hover:text-primary rounded-lg border border-border hover:bg-surface-subtle transition-colors cursor-pointer"
                        title="Force trigger run right now"
                      >
                        <Play size={11} />
                        <span>Run Now</span>
                      </button>

                      <button
                        onClick={() => handleToggleTrigger(trig.id, trig.status)}
                        disabled={actionLoading === trig.id}
                        className="p-1.5 text-secondary hover:text-primary rounded-lg border border-border hover:bg-surface-subtle transition-colors cursor-pointer"
                        title={trig.status === 'active' ? 'Pause Routine' : 'Resume Routine'}
                      >
                        {trig.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                      </button>

                      <button
                        onClick={() => handleDeleteTrigger(trig.id)}
                        className="p-1.5 text-secondary hover:text-rose-500 rounded-lg border border-border hover:bg-surface-subtle transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: MULTI-DAY & EVENT SIMULATOR */}
          {activeSubTab === 'simulate' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl border border-action-primary/30 bg-action-primary/5 space-y-2">
                <div className="flex items-center gap-2 text-action-primary font-bold text-xs">
                  <Zap size={14} />
                  <span>Interactive Always-On Background Test Suite</span>
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  Verify how {agentName} intercepts real-world events, respects your autonomy levels, pauses for approval when side effects occur, and builds an uninterrupted multi-day track record.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Event Test 1 */}
                <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-indigo-500" />
                    <h4 className="text-xs font-bold text-primary">Calendar Event Watcher</h4>
                  </div>
                  <p className="text-xs text-secondary">
                    Simulates a client meeting starting in 60 minutes. Triggers context preparation and attendee dossier creation.
                  </p>
                  <button
                    onClick={() => handleSimulateEvent('google_calendar', 'meeting_upcoming', { title: 'Q4 Product Roadmap Sync' })}
                    disabled={isSimulating}
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    Simulate Calendar Trigger
                  </button>
                </div>

                {/* Event Test 2 */}
                <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-amber-500" />
                    <h4 className="text-xs font-bold text-primary">Urgent VIP Email Pattern</h4>
                  </div>
                  <p className="text-xs text-secondary">
                    Simulates an incoming email with side effects. Tests L1 Supervised Autonomy gate and approval alert.
                  </p>
                  <button
                    onClick={() => handleSimulateEvent('gmail', 'email_received', { from: 'director@enterprise.com', subject: 'Urgent SLA Contract' })}
                    disabled={isSimulating}
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    Simulate VIP Email Trigger
                  </button>
                </div>
              </div>

              {/* Multi-Day Simulation Card */}
              <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-xs font-bold text-primary">Simulate 3 Days of Always-On Background Runs</h4>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Multi-Day Reliability
                  </span>
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  Generates morning inbox digests, midday calendar dossiers, and verifies that executive timeline transparency persists across multiple continuous days.
                </p>
                <button
                  onClick={() => handleSimulateMultiDay(3)}
                  disabled={isSimulating}
                  className="py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  <RefreshCw size={13} className={isSimulating ? 'animate-spin' : ''} />
                  <span>Run 3-Day Scenario Simulation</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-surface-subtle flex items-center justify-between">
          <div className="text-[11px] text-muted flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>Encrypted background store • Sovereign data guarantees respected</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-secondary hover:text-primary rounded-lg border border-border hover:bg-surface transition-colors cursor-pointer"
          >
            Close Digest
          </button>
        </div>
      </div>
    </div>
  )
}
