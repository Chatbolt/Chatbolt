'use client'

import React, { useState, useEffect } from 'react'
import {
  Brain,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Pin,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  RefreshCw,
  Sliders,
  History,
  Info,
  Layers,
  FileCode,
  Mail,
  Calendar,
  CreditCard,
  GitPullRequest,
  Check,
  X,
  PlusCircle,
  HelpCircle,
  TrendingUp,
  Cpu
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

export interface DecisionEvidence {
  id: string
  timestamp: string
  source: 'permission_decision' | 'edit_diff' | 'option_choice' | 'explicit_statement' | 'comms_style'
  contextSummary: string
  userDecision: 'approved' | 'rejected' | 'edited' | 'chosen'
  diffDetails?: {
    originalProposed?: string
    userEdited?: string
    diffRatio?: number
  }
  optionsPresented?: string[]
  chosenOption?: string
  confidenceImpact: number
}

export interface DecisionPattern {
  id: string
  tenantId: string
  domain: 'email_comms' | 'code_style' | 'spending_threshold' | 'scheduling' | 'delegation_routing' | 'destructive_actions'
  title: string
  rule: Record<string, any>
  naturalLanguageSummary: string
  confidenceScore: number
  evidenceCount: number
  consistencyRatio: number
  status: 'cold_start' | 'learning' | 'established' | 'user_pinned'
  evidenceLog: DecisionEvidence[]
  lastObservedAt: string
  createdAt: string
  updatedAt: string
  userOverride?: {
    isPinned: boolean
    userEditedRule?: string
    userSetConfidence?: number
  }
}

interface DecisionPatternsViewProps {
  agentName?: string
  onRefreshParent?: () => void
}

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  email_comms: <Mail className="w-4 h-4 text-sky-400" />,
  code_style: <FileCode className="w-4 h-4 text-emerald-400" />,
  spending_threshold: <CreditCard className="w-4 h-4 text-amber-400" />,
  scheduling: <Calendar className="w-4 h-4 text-purple-400" />,
  delegation_routing: <Layers className="w-4 h-4 text-indigo-400" />,
  destructive_actions: <AlertTriangle className="w-4 h-4 text-rose-400" />
}

const DOMAIN_LABELS: Record<string, string> = {
  all: 'All Domains',
  email_comms: 'Email & Comms',
  code_style: 'Code & Technical',
  spending_threshold: 'Spending Approvals',
  scheduling: 'Calendar & Scheduling',
  delegation_routing: 'Specialist Delegation'
}

export default function DecisionPatternsView({
  agentName = 'Aria',
  onRefreshParent
}: DecisionPatternsViewProps) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()

  const [patterns, setPatterns] = useState<DecisionPattern[]>([])
  const [learningStats, setLearningStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Evidence Drawer state
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null)
  
  // Edit Pattern state
  const [editingPattern, setEditingPattern] = useState<DecisionPattern | null>(null)
  const [editRuleText, setEditRuleText] = useState('')
  const [editConfidence, setEditConfidence] = useState<number>(0.8)
  const [editPinned, setEditPinned] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  // Simulation state
  const [simulatingSignal, setSimulatingSignal] = useState(false)
  const [simSignalType, setSimSignalType] = useState<string>('permission_decision')
  const [simOutcome, setSimOutcome] = useState<'approved' | 'rejected' | 'edited' | 'chosen'>('approved')
  const [simDomain, setSimDomain] = useState<string>('email_comms')

  const fetchPatterns = async () => {
    setLoading(true)
    try {
      const res: any = await api.get('/personal-agent/decision-patterns')
      if (res && res.patterns) {
        setPatterns(res.patterns)
        setLearningStats(res.learningStats)
      }
    } catch (err: any) {
      console.warn('Failed to load decision patterns:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPatterns()
  }, [])

  const handleSaveEdit = async () => {
    if (!editingPattern) return
    setSavingEdit(true)
    try {
      const res: any = await api.patch(`/personal-agent/decision-patterns/${editingPattern.id}`, {
        userEditedRule: editRuleText.trim(),
        userSetConfidence: editConfidence,
        isPinned: editPinned,
        title: editRuleText.trim()
      })
      if (res && res.pattern) {
        toastSuccess('Pattern preference updated successfully')
        setEditingPattern(null)
        fetchPatterns()
        if (onRefreshParent) onRefreshParent()
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to update pattern')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeletePattern = async (patternId: string, title: string) => {
    if (!confirm(`Are you sure you want ${agentName} to forget this decision pattern?\n\n"${title}"`)) {
      return
    }
    try {
      await api.delete(`/personal-agent/decision-patterns/${patternId}`)
      toastSuccess('Decision pattern forgotten and removed')
      setPatterns(prev => prev.filter(p => p.id !== patternId))
      if (expandedPatternId === patternId) setExpandedPatternId(null)
      if (onRefreshParent) onRefreshParent()
    } catch (err: any) {
      toastError(err.message || 'Failed to delete pattern')
    }
  }

  const handleTogglePin = async (pattern: DecisionPattern) => {
    const nextPinned = !pattern.userOverride?.isPinned
    try {
      await api.patch(`/personal-agent/decision-patterns/${pattern.id}`, {
        isPinned: nextPinned
      })
      toastSuccess(nextPinned ? 'Pattern pinned! Will auto-execute without gating.' : 'Pattern unpinned.')
      fetchPatterns()
    } catch (err: any) {
      toastError(err.message || 'Failed to toggle pin state')
    }
  }

  const handleSimulateSignal = async () => {
    setSimulatingSignal(true)
    try {
      const payload: any = {
        signalSource: simSignalType,
        domain: simDomain,
        contextSummary: `Simulated signal for ${DOMAIN_LABELS[simDomain] || simDomain}`,
        userDecision: simOutcome,
        timestamp: new Date().toISOString()
      }

      if (simOutcome === 'edited') {
        payload.diffDetails = {
          originalProposed: 'Dear team, please find attached the weekly summary with all details.',
          userEdited: 'Hey everyone, here is the quick weekly summary attached.',
          diffRatio: 0.35
        }
      }

      const res: any = await api.post('/personal-agent/decision-patterns/signals', payload)
      if (res && res.pattern) {
        toastSuccess(`Learned from signal! New confidence: ${(res.pattern.confidenceScore * 100).toFixed(0)}%`)
        fetchPatterns()
      }
    } catch (err: any) {
      toastError(err.message || 'Simulation signal failed')
    } finally {
      setSimulatingSignal(false)
    }
  }

  const filteredPatterns = patterns.filter(p => {
    const matchesDomain = selectedDomain === 'all' || p.domain === selectedDomain
    const matchesQuery =
      searchQuery.trim() === '' ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.naturalLanguageSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.domain.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesDomain && matchesQuery
  })

  return (
    <div className="space-y-6 text-slate-200">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900/40 border border-indigo-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Brain className="w-36 h-36 text-indigo-400" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-semibold text-white">
                Inspectable Decision-Making Profile
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Transparent & Sovereign
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {agentName} learns your actual decision patterns from approvals, diff edits, and option choices over time.
              Routine decisions with high confidence automate cleanly; novel or high-stakes decisions always ask for your confirmation.
            </p>
          </div>

          <button
            onClick={fetchPatterns}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-xs font-medium text-slate-300 border border-slate-700/60 transition-colors w-fit self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Rules
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/60">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block mb-0.5">Learned Patterns</span>
            <span className="text-lg font-bold text-white">{patterns.length}</span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block mb-0.5">Automated Rules</span>
            <span className="text-lg font-bold text-emerald-400">
              {patterns.filter(p => p.confidenceScore >= 0.8 || p.status === 'user_pinned').length}
            </span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block mb-0.5">Cold Start / Ask First</span>
            <span className="text-lg font-bold text-amber-400">
              {patterns.filter(p => p.confidenceScore < 0.8 && p.status !== 'user_pinned').length}
            </span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block mb-0.5">Total Observations</span>
            <span className="text-lg font-bold text-indigo-400">
              {patterns.reduce((sum, p) => sum + (p.evidenceCount || 0), 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Domain Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 scrollbar-none">
          {['all', 'email_comms', 'code_style', 'spending_threshold', 'scheduling', 'delegation_routing'].map(dKey => (
            <button
              key={dKey}
              onClick={() => setSelectedDomain(dKey)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedDomain === dKey
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'bg-slate-900/60 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              {dKey !== 'all' && DOMAIN_ICONS[dKey]}
              {DOMAIN_LABELS[dKey] || dKey}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search learned patterns..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full sm:w-64 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-colors"
        />
      </div>

      {/* Patterns List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mb-3" />
          <p className="text-xs">Loading inspectable decision model...</p>
        </div>
      ) : filteredPatterns.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-10 text-center">
          <Brain className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-300 mb-1">No Decision Patterns Found</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery
              ? 'No patterns match your search query.'
              : `${agentName} will automatically capture decision patterns as you approve actions, edit drafts, or select options.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPatterns.map(pattern => {
            const isExpanded = expandedPatternId === pattern.id
            const isPinned = pattern.userOverride?.isPinned || pattern.status === 'user_pinned'
            const isAutomated = isPinned || pattern.confidenceScore >= 0.80
            const confidencePct = Math.round(pattern.confidenceScore * 100)

            return (
              <div
                key={pattern.id}
                className="bg-slate-900/70 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4.5 transition-all shadow-sm"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/60 shrink-0 mt-0.5">
                      {DOMAIN_ICONS[pattern.domain] || <Brain className="w-4 h-4 text-indigo-400" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-white truncate">
                          {pattern.title}
                        </span>
                        
                        {/* Domain Tag */}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/50">
                          {DOMAIN_LABELS[pattern.domain] || pattern.domain}
                        </span>

                        {/* Status Badge */}
                        {isPinned ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                            <Pin className="w-2.5 h-2.5" />
                            User Pinned
                          </span>
                        ) : isAutomated ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Automated ({confidencePct}%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Still Learning ({confidencePct}%)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-normal">
                        "{pattern.naturalLanguageSummary}"
                      </p>
                    </div>
                  </div>

                  {/* Actions & Gauge */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => handleTogglePin(pattern)}
                      title={isPinned ? 'Unpin preference' : 'Pin preference to lock automation'}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isPinned
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setEditingPattern(pattern)
                        setEditRuleText(pattern.naturalLanguageSummary)
                        setEditConfidence(pattern.confidenceScore)
                        setEditPinned(!!pattern.userOverride?.isPinned)
                      }}
                      title="Edit rule or override confidence"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeletePattern(pattern.id, pattern.title)}
                      title="Forget this pattern completely"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setExpandedPatternId(isExpanded ? null : pattern.id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        isExpanded
                          ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>{pattern.evidenceCount} Decision{pattern.evidenceCount === 1 ? '' : 's'}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Evidence Drawer */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-indigo-400" />
                        Verifiable Evidence Trail ({pattern.evidenceLog?.length || 0} observations)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Last observed: {new Date(pattern.lastObservedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {(!pattern.evidenceLog || pattern.evidenceLog.length === 0) ? (
                      <p className="text-xs text-slate-500 italic py-2">
                        No individual historical log records attached to this pattern.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {pattern.evidenceLog.map((ev, idx) => (
                          <div
                            key={ev.id || idx}
                            className="bg-slate-950/60 border border-slate-800/70 rounded-xl p-3 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-200">
                                {ev.contextSummary || 'Decision observation'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(ev.timestamp).toLocaleString()}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                                ev.userDecision === 'approved'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : ev.userDecision === 'edited'
                                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                  : ev.userDecision === 'rejected'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              }`}>
                                {ev.userDecision}
                              </span>

                              <span className="text-[11px] text-slate-400">
                                Source: <strong className="text-slate-300">{ev.source.replace(/_/g, ' ')}</strong>
                              </span>

                              <span className="text-[11px] text-indigo-300 ml-auto">
                                Impact: +{(ev.confidenceImpact * 100).toFixed(0)}%
                              </span>
                            </div>

                            {/* Diff View if user edited agent output */}
                            {ev.diffDetails && (
                              <div className="mt-2 pt-2 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                <div className="p-2 rounded bg-rose-950/20 border border-rose-900/30 text-rose-200">
                                  <span className="font-semibold block mb-0.5 text-rose-400">Proposed by Agent:</span>
                                  <p className="line-clamp-2">{ev.diffDetails.originalProposed || 'N/A'}</p>
                                </div>
                                <div className="p-2 rounded bg-emerald-950/20 border border-emerald-900/30 text-emerald-200">
                                  <span className="font-semibold block mb-0.5 text-emerald-400">Accepted by You:</span>
                                  <p className="line-clamp-2">{ev.diffDetails.userEdited || 'N/A'}</p>
                                </div>
                              </div>
                            )}

                            {/* Option Choice details */}
                            {ev.chosenOption && (
                              <div className="mt-1 text-[11px] text-slate-400">
                                Chosen option: <strong className="text-slate-200">{ev.chosenOption}</strong>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingPattern && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                Edit Decision Rule
              </h3>
              <button
                onClick={() => setEditingPattern(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Learned Rule (Plain Language)
                </label>
                <textarea
                  rows={3}
                  value={editRuleText}
                  onChange={e => setEditRuleText(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 leading-relaxed"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-300">
                    Confidence Level ({Math.round(editConfidence * 100)}%)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {editConfidence >= 0.8 ? 'Automates cleanly' : 'Asks before acting'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={editConfidence}
                  onChange={e => setEditConfidence(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinCheck"
                  checked={editPinned}
                  onChange={e => setEditPinned(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="pinCheck" className="text-slate-300 select-none cursor-pointer">
                  Pin this rule permanently (locks confidence and prevents decay)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingPattern(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit || !editRuleText.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Learning Simulator Tool */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-semibold text-white">
              Simulate Real Decision Signal (Interactive Test Safeguard)
            </h4>
          </div>
          <span className="text-[11px] text-slate-500">
            Tests cold start & anti-overfitting response
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Trigger simulated signals to observe how {agentName} calculates asymptotic confidence ($1 - e^{'{'}-0.4N{'}'}$), applies contradiction drag, and prevents overfitting to isolated outlier choices.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <select
            value={simDomain}
            onChange={e => setSimDomain(e.target.value)}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="email_comms">Email & Comms</option>
            <option value="code_style">Code & Style</option>
            <option value="spending_threshold">Spending Approvals</option>
            <option value="scheduling">Calendar & Meetings</option>
            <option value="delegation_routing">Specialist Delegation</option>
          </select>

          <select
            value={simSignalType}
            onChange={e => setSimSignalType(e.target.value)}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="permission_decision">Permission Action</option>
            <option value="edit_diff">Draft Edit Diff</option>
            <option value="option_choice">Option Picked</option>
            <option value="comms_style">Comms Style Signal</option>
          </select>

          <select
            value={simOutcome}
            onChange={e => setSimOutcome(e.target.value as any)}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="approved">Approved / Accepted</option>
            <option value="edited">Edited before Accepting</option>
            <option value="chosen">Explicitly Chosen</option>
            <option value="rejected">Contradicted / Rejected</option>
          </select>

          <button
            onClick={handleSimulateSignal}
            disabled={simulatingSignal}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {simulatingSignal ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
            Ingest Signal
          </button>
        </div>
      </div>
    </div>
  )
}
