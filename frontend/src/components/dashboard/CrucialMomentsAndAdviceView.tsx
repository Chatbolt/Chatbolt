'use client'

import React, { useState, useEffect } from 'react'
import {
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Lightbulb,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sliders,
  DollarSign,
  Globe,
  Trash2,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Clock,
  Shield,
  ThumbsUp,
  ThumbsDown,
  X,
  PlusCircle,
  Layers,
  FileCode,
  Calendar,
  AlertOctagon,
  Eye,
  Info
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

export interface CrucialFactorScores {
  irreversibilityScore: number
  financialImpactScore: number
  externalExposureScore: number
  patternDeviationScore: number
  noveltyScore: number
  antiEchoMistakeScore: number
}

export interface CrucialEvaluationResult {
  isCrucial: boolean
  compositeScore: number
  factorScores: CrucialFactorScores
  triggeredFactors: string[]
  explanation: string
  recommendation: 'auto_proceed' | 'ask_confirmation' | 'block_and_alert'
  patternConfidence: number
  isRepeatingKnownMistake?: boolean
  notificationDispatched?: boolean
}

export interface ProactiveAdviceItem {
  id: string
  tenantId: string
  category: 'upcoming_problem' | 'better_approach' | 'conflict_warning' | 'mistake_prevention' | 'optimization'
  title: string
  summary: string
  reasoning: string
  evidenceCitations: Array<{
    source: string
    evidenceSummary: string
    patternId?: string
    timestamp?: string
  }>
  suggestedAction?: {
    label: string
    actionType: string
    payload?: Record<string, any>
  }
  confidenceScore: number
  status: 'active' | 'dismissed' | 'acted_upon' | 'expired'
  feedback?: 'helpful' | 'unhelpful' | 'dismissed'
  createdAt: string
}

export interface UserCrucialSettings {
  proactivityLevel: 'off' | 'important_only' | 'frequent'
  maxAutoSpendLimit: number
  requireExternalExposureConfirmation: boolean
  antiEchoWarnings: boolean
  noveltySensitivity: 'conservative' | 'balanced' | 'relaxed'
  categoryFrequencyDampeners: Record<string, number>
}

interface CrucialMomentsAndAdviceViewProps {
  agentName?: string
  onRefreshParent?: () => void
}

const CATEGORY_BADGES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  conflict_warning: {
    label: 'Schedule Conflict',
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    icon: <Calendar className="w-3.5 h-3.5" />
  },
  mistake_prevention: {
    label: 'Anti-Mistake Warning',
    color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    icon: <AlertOctagon className="w-3.5 h-3.5" />
  },
  better_approach: {
    label: 'Better Approach',
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: <TrendingUp className="w-3.5 h-3.5" />
  },
  upcoming_problem: {
    label: 'Upcoming Problem',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    icon: <AlertTriangle className="w-3.5 h-3.5" />
  },
  optimization: {
    label: 'Workflow Optimization',
    color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    icon: <Sparkles className="w-3.5 h-3.5" />
  }
}

export default function CrucialMomentsAndAdviceView({
  agentName = 'Aria',
  onRefreshParent
}: CrucialMomentsAndAdviceViewProps) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()

  const [adviceList, setAdviceList] = useState<ProactiveAdviceItem[]>([])
  const [settings, setSettings] = useState<UserCrucialSettings>({
    proactivityLevel: 'important_only',
    maxAutoSpendLimit: 50.0,
    requireExternalExposureConfirmation: true,
    antiEchoWarnings: true,
    noveltySensitivity: 'balanced',
    categoryFrequencyDampeners: {}
  })
  const [loading, setLoading] = useState(true)
  const [generatingAdvice, setGeneratingAdvice] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // Evaluator / Simulator State
  const [simActionType, setSimActionType] = useState('send_invoice_email')
  const [simDomain, setSimDomain] = useState('email_comms')
  const [simAmount, setSimAmount] = useState(120)
  const [simRecipient, setSimRecipient] = useState('client@externalcorp.com')
  const [simIsPermanent, setSimIsPermanent] = useState(false)
  const [simContext, setSimContext] = useState('Send final invoice to external client for project milestone')
  const [evaluationResult, setEvaluationResult] = useState<CrucialEvaluationResult | null>(null)
  const [evaluating, setEvaluating] = useState(false)

  // Register Mistake Modal
  const [showMistakeModal, setShowMistakeModal] = useState(false)
  const [mistakeAction, setMistakeAction] = useState('')
  const [mistakeDomain, setMistakeDomain] = useState('email_comms')
  const [mistakeRationale, setMistakeRationale] = useState('')
  const [savingMistake, setSavingMistake] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [settingsRes, adviceRes] = await Promise.all([
        api.personalAgent.getCrucialSettings().catch(() => null),
        api.personalAgent.getProactiveAdvice().catch(() => null)
      ])

      if (settingsRes?.settings) {
        setSettings(settingsRes.settings)
      }
      if (adviceRes?.advice) {
        setAdviceList(adviceRes.advice)
      }
    } catch (err: any) {
      console.warn('Failed to load crucial moments data:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleGenerateAdvice = async () => {
    setGeneratingAdvice(true)
    try {
      const res: any = await api.personalAgent.generateProactiveAdvice({})
      if (res?.advice) {
        setAdviceList(res.advice)
        toastSuccess(`Generated ${res.advice.length} proactive recommendations with traceable reasoning`)
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to generate advice')
    } finally {
      setGeneratingAdvice(false)
    }
  }

  const handleFeedback = async (adviceId: string, feedback: 'helpful' | 'unhelpful' | 'dismissed') => {
    try {
      await api.personalAgent.submitAdviceFeedback(adviceId, feedback)
      if (feedback === 'dismissed') {
        setAdviceList(prev => prev.filter(a => a.id !== adviceId))
        toastInfo('Advice dismissed. Frequency dynamically reduced for this topic.')
      } else {
        setAdviceList(prev =>
          prev.map(a => (a.id === adviceId ? { ...a, feedback, status: 'acted_upon' } : a))
        )
        toastSuccess(feedback === 'helpful' ? 'Marked helpful! Tuned your assistant profile.' : 'Feedback recorded.')
      }
      if (onRefreshParent) onRefreshParent()
    } catch (err: any) {
      toastError(err.message || 'Feedback error')
    }
  }

  const handleSaveSettings = async (updated: Partial<UserCrucialSettings>) => {
    const next = { ...settings, ...updated }
    setSettings(next)
    setSavingSettings(true)
    try {
      await api.personalAgent.updateCrucialSettings(next)
      toastSuccess('Crucial-moment safeguards & proactivity settings updated')
    } catch (err: any) {
      toastError(err.message || 'Failed to update settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleEvaluateSimulation = async () => {
    setEvaluating(true)
    try {
      const res = await api.personalAgent.evaluateCrucialMoment({
        actionType: simActionType,
        domain: simDomain,
        proposedPayload: {
          amount: simAmount,
          recipient: simRecipient,
          isPermanent: simIsPermanent
        },
        contextDescription: simContext
      })

      if (res?.evaluation) {
        setEvaluationResult(res.evaluation)
      }
    } catch (err: any) {
      toastError(err.message || 'Evaluation failed')
    } finally {
      setEvaluating(false)
    }
  }

  const handleSaveMistake = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mistakeAction.trim() || !mistakeRationale.trim()) return
    setSavingMistake(true)
    try {
      await api.personalAgent.flagMistake({
        actionType: mistakeAction.trim(),
        domain: mistakeDomain,
        rationale: mistakeRationale.trim()
      })
      toastSuccess('Mistake registered in Anti-Echo Registry. Assistant will never repeat it silently.')
      setShowMistakeModal(false)
      setMistakeAction('')
      setMistakeRationale('')
      loadData()
    } catch (err: any) {
      toastError(err.message || 'Failed to register mistake')
    } finally {
      setSavingMistake(false)
    }
  }

  return (
    <div className="space-y-6 text-slate-200">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-950/30 via-slate-900/40 to-indigo-950/30 border border-amber-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-semibold text-white">
                Crucial-Moment Detection & Proactive Traceable Advice
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Safe & Traceable
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Detects high-stakes, irreversible, financial, or novel moments that always require your confirmation,
              while surfacing proactive, evidence-based advice traceable to your real history.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMistakeModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-xs font-medium text-rose-300 border border-rose-500/30 transition-colors"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              Flag Past Mistake
            </button>
            <button
              onClick={handleGenerateAdvice}
              disabled={generatingAdvice}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generatingAdvice ? 'animate-spin' : ''}`} />
              Generate Advice
            </button>
          </div>
        </div>
      </div>

      {/* Safeguard Controls Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Proactivity Level */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Proactivity Level
            </span>
            <span className="text-[10px] font-medium text-slate-400 uppercase">
              {settings.proactivityLevel.replace('_', ' ')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 pt-1">
            {(['off', 'important_only', 'frequent'] as const).map(level => (
              <button
                key={level}
                onClick={() => handleSaveSettings({ proactivityLevel: level })}
                className={`py-1 rounded text-[11px] font-medium transition-all ${
                  settings.proactivityLevel === level
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400'
                }`}
              >
                {level === 'off' ? 'Off' : level === 'important_only' ? 'Important' : 'Frequent'}
              </button>
            ))}
          </div>
        </div>

        {/* Spend Limit */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Max Auto-Spend Limit
            </span>
            <span className="text-xs font-bold text-emerald-400">
              ${settings.maxAutoSpendLimit.toFixed(0)}
            </span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="range"
              min="0"
              max="250"
              step="10"
              value={settings.maxAutoSpendLimit}
              onChange={e => handleSaveSettings({ maxAutoSpendLimit: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>
          <span className="text-[10px] text-slate-400 block">
            Any expense over ${settings.maxAutoSpendLimit.toFixed(0)} always asks for confirmation.
          </span>
        </div>

        {/* Anti-Echo Guard */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              Anti-Mistake Safeguard
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${settings.antiEchoWarnings ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-800 text-slate-500'}`}>
              {settings.antiEchoWarnings ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="antiEchoToggle"
              checked={settings.antiEchoWarnings}
              onChange={e => handleSaveSettings({ antiEchoWarnings: e.target.checked })}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="antiEchoToggle" className="text-[11px] text-slate-300 select-none cursor-pointer">
              Never repeat flagged mistakes silently
            </label>
          </div>
        </div>
      </div>

      {/* SECTION 1: PROACTIVE ADVICE FEED */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">
              Proactive Advice Feed ({adviceList.length} active)
            </h4>
          </div>
          <span className="text-xs text-slate-400">
            Honest probabilistic reasoning with cited evidence
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
            Loading proactive recommendations...
          </div>
        ) : adviceList.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
            <h5 className="text-xs font-semibold text-slate-300">No Pending Proactive Advice</h5>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              {settings.proactivityLevel === 'off'
                ? 'Proactivity is currently turned off in your settings.'
                : `${agentName} will surface advice when it detects potential schedule conflicts, communication optimizations, or slip-up risks.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {adviceList.map(item => {
              const badge = CATEGORY_BADGES[item.category] || CATEGORY_BADGES.optimization
              return (
                <div
                  key={item.id}
                  className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4.5 flex flex-col justify-between space-y-3 shadow-sm hover:border-slate-700/90 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 ${badge.color}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {(item.confidenceScore * 100).toFixed(0)}% confidence
                      </span>
                    </div>

                    <h5 className="text-xs font-bold text-white">
                      {item.title}
                    </h5>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {item.summary}
                    </p>

                    {/* Traceable Reasoning Box */}
                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/70 space-y-1.5">
                      <span className="text-[10px] font-semibold text-indigo-300 block uppercase tracking-wider">
                        Why We Surfaced This (Traceable History)
                      </span>
                      <p className="text-[11px] text-slate-400 italic">
                        "{item.reasoning}"
                      </p>

                      {item.evidenceCitations && item.evidenceCitations.length > 0 && (
                        <div className="pt-1 border-t border-slate-800/60 space-y-1">
                          {item.evidenceCitations.map((cit, idx) => (
                            <div key={idx} className="text-[10px] text-slate-400 flex items-start gap-1">
                              <span className="text-indigo-400 font-semibold">• {cit.source}:</span>
                              <span>{cit.evidenceSummary}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                    {item.suggestedAction ? (
                      <button
                        onClick={() => {
                          toastSuccess(`Applied recommendation: ${item.suggestedAction?.label}`)
                          handleFeedback(item.id, 'helpful')
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition-colors"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {item.suggestedAction.label}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500">Advisory notice</span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleFeedback(item.id, 'helpful')}
                        title="Helpful advice"
                        className="p-1 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(item.id, 'unhelpful')}
                        title="Not helpful"
                        className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(item.id, 'dismissed')}
                        title="Dismiss advice"
                        className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: INTERACTIVE CRUCIAL MOMENT SIMULATOR & FACTOR RADAR */}
      <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-semibold text-white">
              Crucial-Moment Evaluator & Multi-Factor Scorer
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            Tests 5 concrete factors + anti-echo circuit breaker
          </span>
        </div>

        <p className="text-[11px] text-slate-300 leading-relaxed">
          Simulate real action requests to observe how {agentName} scores irreversibility, financial impact, external exposure, pattern deviation, and genuine novelty to gate autonomy.
        </p>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Action Type</label>
            <select
              value={simActionType}
              onChange={e => setSimActionType(e.target.value)}
              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="send_invoice_email">Send External Invoice Email</option>
              <option value="delete_customer_records">Delete Production Database Records</option>
              <option value="purchase_software_subscription">Purchase Enterprise Software ($120)</option>
              <option value="schedule_routine_standup">Schedule Routine Morning Standup</option>
              <option value="publish_social_announcement">Publish Public Twitter/X Post</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Financial Impact ($)</label>
            <input
              type="number"
              value={simAmount}
              onChange={e => setSimAmount(parseFloat(e.target.value) || 0)}
              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">External Recipient</label>
            <input
              type="text"
              value={simRecipient}
              onChange={e => setSimRecipient(e.target.value)}
              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPermCheck"
              checked={simIsPermanent}
              onChange={e => setSimIsPermanent(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isPermCheck" className="text-xs text-slate-300 cursor-pointer">
              Mark action as permanent / irreversible
            </label>
          </div>

          <button
            onClick={handleEvaluateSimulation}
            disabled={evaluating}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {evaluating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            Evaluate Crucial Factors
          </button>
        </div>

        {/* Evaluation Result View */}
        {evaluationResult && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-white">Evaluation Decision:</span>
                  {evaluationResult.isCrucial ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      CRUCIAL MOMENT — ASKS USER
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      ROUTINE ACTION — AUTO-PROCEEDS
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {evaluationResult.explanation}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 block">Composite Risk Score</span>
                <span className={`text-lg font-bold ${evaluationResult.isCrucial ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {(evaluationResult.compositeScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Factor Scores Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block mb-1">Irreversibility</span>
                <span className={`font-bold ${evaluationResult.factorScores.irreversibilityScore >= 0.8 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {(evaluationResult.factorScores.irreversibilityScore * 100).toFixed(0)}%
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block mb-1">Financial Impact</span>
                <span className={`font-bold ${evaluationResult.factorScores.financialImpactScore >= 0.8 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {(evaluationResult.factorScores.financialImpactScore * 100).toFixed(0)}%
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block mb-1">External Exposure</span>
                <span className={`font-bold ${evaluationResult.factorScores.externalExposureScore >= 0.8 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {(evaluationResult.factorScores.externalExposureScore * 100).toFixed(0)}%
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block mb-1">Pattern Deviation</span>
                <span className={`font-bold ${evaluationResult.factorScores.patternDeviationScore >= 0.75 ? 'text-amber-400' : 'text-slate-200'}`}>
                  {(evaluationResult.factorScores.patternDeviationScore * 100).toFixed(0)}%
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block mb-1">Novelty</span>
                <span className={`font-bold ${evaluationResult.factorScores.noveltyScore >= 0.8 ? 'text-amber-400' : 'text-slate-200'}`}>
                  {(evaluationResult.factorScores.noveltyScore * 100).toFixed(0)}%
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block mb-1">Anti-Mistake Warning</span>
                <span className={`font-bold ${evaluationResult.factorScores.antiEchoMistakeScore >= 0.8 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {evaluationResult.factorScores.antiEchoMistakeScore >= 0.8 ? 'TRIGGERED' : 'CLEAR'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Flag Mistake Modal */}
      {showMistakeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveMistake}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                Flag Past Undesirable Outcome / Mistake
              </h4>
              <button
                type="button"
                onClick={() => setShowMistakeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              When an action didn't turn out well, tell {agentName}. The assistant will add it to the Anti-Echo Mistake Registry and halt automation if a similar pattern recurs.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Action Name</label>
                <input
                  type="text"
                  value={mistakeAction}
                  onChange={e => setMistakeAction(e.target.value)}
                  placeholder="e.g., auto_deploy_staging_to_prod"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Domain</label>
                <select
                  value={mistakeDomain}
                  onChange={e => setMistakeDomain(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="email_comms">Email & Communications</option>
                  <option value="code_style">Code & Deployment</option>
                  <option value="spending_threshold">Spending & Subscriptions</option>
                  <option value="scheduling">Calendar & Scheduling</option>
                  <option value="destructive_actions">Destructive Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">What went wrong?</label>
                <textarea
                  rows={3}
                  value={mistakeRationale}
                  onChange={e => setMistakeRationale(e.target.value)}
                  placeholder="e.g., Deployed without checking staging logs, causing downtime"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowMistakeModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingMistake || !mistakeAction.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingMistake ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                Save Safeguard
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
