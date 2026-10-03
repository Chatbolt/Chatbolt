'use client'

import React, { useState } from 'react'
import {
  Sparkles,
  Bot,
  User,
  Target,
  Key,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Loader2,
  ShieldCheck,
  Zap,
  ArrowRight
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

interface PersonalAgentOnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onCompleted: (agent: any) => void
  initialName?: string
}

const PRESET_NAMES = ['Aria', 'Atlas', 'Jarvis', 'Nova', 'Echo']

const GOAL_OPTIONS = [
  'Full-Stack Architecture & Coding',
  'Automated Code Reviews & Refactoring',
  'Deep Technical & Market Research',
  'DevOps, CI/CD & Cloud Deployments',
  'Database Design & Optimization',
  'UI/UX Design Systems & Polish'
]

const INTEGRATION_OPTIONS = [
  { id: 'github', name: 'GitHub', icon: '🐙', desc: 'Repositories, PRs & issues' },
  { id: 'supabase', name: 'Supabase / Postgres', icon: '⚡', desc: 'Database & Auth state' },
  { id: 'slack', name: 'Slack / Discord', icon: '💬', desc: 'Channel notifications' },
  { id: 'vercel', name: 'Vercel / Cloudflare', icon: '▲', desc: 'Edge deployments & logs' }
]

export default function PersonalAgentOnboardingModal({
  isOpen,
  onClose,
  onCompleted,
  initialName = 'Aria'
}: PersonalAgentOnboardingModalProps) {
  const { success: toastSuccess, error: toastError } = useToast()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)

  // Form state
  const [name, setName] = useState(initialName || 'Aria')
  const [tone, setTone] = useState<'concise' | 'thoughtful' | 'technical' | 'collaborative'>('concise')
  const [userRole, setUserRole] = useState('Staff Engineer & System Architect')
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    'Full-Stack Architecture & Coding',
    'Automated Code Reviews & Refactoring'
  ])
  const [initialNote, setInitialNote] = useState('Prefer concise, deterministic answers with high test coverage and clean DDD architecture.')
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>(['github', 'supabase'])

  if (!isOpen) return null

  const toggleGoal = (goal: string) => {
    setSelectedGoals(prev =>
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    )
  }

  const toggleIntegration = (id: string) => {
    setSelectedIntegrations(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toastError('Name required', 'Please provide a name for your personal assistant.')
      return
    }
    setLoading(true)
    try {
      const res = await api.personalAgent.completeOnboarding({
        name: name.trim(),
        userRole: userRole.trim(),
        primaryGoals: selectedGoals,
        preferredTone: tone,
        initialNote: initialNote.trim(),
        connectedIntegrations: selectedIntegrations
      })

      if (res.success && res.agent) {
        toastSuccess('Assistant Ready', `${res.agent.name} is now your personal AI partner and orchestrator.`)
        onCompleted(res.agent)
        onClose()
      } else {
        throw new Error(res.message || 'Failed to complete onboarding')
      }
    } catch (err: any) {
      toastError('Setup Failed', err.message || 'Could not complete assistant setup.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-subtle shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-action-primary flex items-center justify-center text-white shadow-xs">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-primary tracking-tight">
                Meet Your Personal AI Companion
              </h2>
              <p className="text-[11px] text-muted">
                Step {step} of 3 • Persistent, single point of contact across all sessions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-secondary hover:text-primary hover:bg-surface rounded-md transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="grid grid-cols-3 h-1 bg-surface-subtle border-b border-border">
          <div className={`h-full transition-all duration-300 ${step >= 1 ? 'bg-action-primary' : 'bg-transparent'}`} />
          <div className={`h-full transition-all duration-300 ${step >= 2 ? 'bg-action-primary' : 'bg-transparent'}`} />
          <div className={`h-full transition-all duration-300 ${step >= 3 ? 'bg-action-primary' : 'bg-transparent'}`} />
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          {/* STEP 1: Name & Personality */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-semibold text-primary mb-1.5">
                  1. Name your assistant
                </label>
                <p className="text-[11px] text-muted mb-2">
                  This identity stays with you indefinitely across all sessions and devices.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Jarvis, Aria, Atlas"
                    className="flex-1 px-3 py-2 text-xs rounded-md bg-surface-subtle border border-border text-primary focus:outline-none focus:border-action-primary"
                    maxLength={32}
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-muted">Presets:</span>
                  {PRESET_NAMES.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setName(p)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                        name === p
                          ? 'border-action-primary bg-action-primary/10 text-action-primary font-semibold'
                          : 'border-border bg-surface text-secondary hover:text-primary'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border-subtle">
                <label className="block text-xs font-semibold text-primary mb-1.5">
                  Tone & Communication Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'concise', label: 'Concise & Direct', desc: 'No fluff, high signal-to-noise' },
                    { id: 'thoughtful', label: 'Thoughtful & Exploratory', desc: 'Synthesizes tradeoffs & alternatives' },
                    { id: 'technical', label: 'Technical & Rigorous', desc: 'Deep architecture & code detail' },
                    { id: 'collaborative', label: 'Warm & Collaborative', desc: 'Adaptive partner & proactive helper' }
                  ].map(t => (
                    <div
                      key={t.id}
                      onClick={() => setTone(t.id as any)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        tone === t.id
                          ? 'border-action-primary bg-action-primary/5 text-primary ring-1 ring-action-primary'
                          : 'border-border bg-surface hover:bg-surface-subtle text-secondary hover:text-primary'
                      }`}
                    >
                      <p className="text-xs font-semibold">{t.label}</p>
                      <p className="text-[10px] text-muted mt-0.5">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: About You & Goals */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-semibold text-primary mb-1.5">
                  Your Primary Role & Domain
                </label>
                <input
                  type="text"
                  value={userRole}
                  onChange={e => setUserRole(e.target.value)}
                  placeholder="e.g. Lead Engineer, Product Founder, Data Scientist"
                  className="w-full px-3 py-2 text-xs rounded-md bg-surface-subtle border border-border text-primary focus:outline-none focus:border-action-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary mb-1.5">
                  What do you want {name || 'your assistant'} to help you with most?
                </label>
                <div className="space-y-1.5">
                  {GOAL_OPTIONS.map(goal => {
                    const isSelected = selectedGoals.includes(goal)
                    return (
                      <div
                        key={goal}
                        onClick={() => toggleGoal(goal)}
                        className={`flex items-center justify-between p-2.5 rounded-md border text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-action-primary bg-action-primary/5 text-primary font-medium'
                            : 'border-border bg-surface text-secondary hover:text-primary hover:bg-surface-subtle'
                        }`}
                      >
                        <span>{goal}</span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-action-primary border-action-primary text-white'
                              : 'border-border bg-surface'
                          }`}
                        >
                          {isSelected && <Check size={11} />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary mb-1.5">
                  Initial Instructions or Preferences (Optional)
                </label>
                <textarea
                  value={initialNote}
                  onChange={e => setInitialNote(e.target.value)}
                  rows={2}
                  placeholder="e.g. Always format diffs clearly, assume TypeScript strict mode..."
                  className="w-full px-3 py-2 text-xs rounded-md bg-surface-subtle border border-border text-primary focus:outline-none focus:border-action-primary custom-scrollbar resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Initial Integrations & Clean Delegation Preview */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-semibold text-primary mb-1">
                  Connect initial integrations
                </label>
                <p className="text-[11px] text-muted mb-2.5">
                  {name || 'Your assistant'} will coordinate tasks with tools and specialist agents.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {INTEGRATION_OPTIONS.map(item => {
                    const isChecked = selectedIntegrations.includes(item.id)
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleIntegration(item.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                          isChecked
                            ? 'border-action-primary bg-action-primary/5 ring-1 ring-action-primary'
                            : 'border-border bg-surface hover:bg-surface-subtle'
                        }`}
                      >
                        <span className="text-lg">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-primary">{item.name}</p>
                          <p className="text-[10px] text-muted truncate">{item.desc}</p>
                        </div>
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border mt-0.5 shrink-0 ${
                            isChecked
                              ? 'bg-action-primary border-action-primary text-white'
                              : 'border-border bg-surface'
                          }`}
                        >
                          {isChecked && <Check size={9} />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="p-3 bg-surface-subtle rounded-lg border border-border space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <ShieldCheck size={14} className="text-signal-green" />
                  <span>Single Point of Contact Architecture</span>
                </div>
                <p className="text-[11px] text-secondary leading-relaxed">
                  <strong>{name || 'Your assistant'}</strong> serves as your continuous companion and orchestrator. When you ask for complex programming, deep research, or batch operations, {name || 'your assistant'} delegates directly to the specialist workforce roster while retaining full persistent context.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-border bg-surface-subtle flex items-center justify-between shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as any)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary rounded-md hover:bg-surface transition-colors cursor-pointer"
            >
              <ChevronLeft size={14} />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !name.trim()) {
                  toastError('Name required', 'Please give your assistant a name.')
                  return
                }
                setStep((step + 1) as any)
              }}
              className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold bg-action-primary hover:bg-action-primary-hover text-white rounded-md transition-colors cursor-pointer shadow-xs"
            >
              Continue
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-action-primary hover:bg-action-primary-hover text-white rounded-md transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Initializing {name}...
                </>
              ) : (
                <>
                  Meet {name}
                  <Sparkles size={13} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
