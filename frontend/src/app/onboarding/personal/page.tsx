'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles,
  Bot,
  Key,
  Shield,
  Zap,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Play,
  Brain,
  MessageSquare,
  HardDrive
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

export default function PersonalOnboardingPage() {
  const router = useRouter()
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()

  // Steps: 1 (Name & Tone), 2 (BYOK Key Setup), 3 (Run 1st Real Task)
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 3

  // Form State
  const [assistantName, setAssistantName] = useState('Aria')
  const [assistantTone, setAssistantTone] = useState<'thoughtful' | 'concise' | 'direct' | 'warm'>('thoughtful')
  const [userRole, setUserRole] = useState('Personal & Tech Productivity')

  // BYOK State
  const [byokProvider, setByokProvider] = useState<'groq' | 'openai' | 'anthropic' | 'openrouter'>('groq')
  const [apiKey, setApiKey] = useState('')
  const [validating, setValidating] = useState(false)
  const [validated, setValidated] = useState(false)

  // Execution State
  const [executingTask, setExecutingTask] = useState(false)
  const [firstTaskPrompt, setFirstTaskPrompt] = useState('')

  const handleValidateKey = async () => {
    if (!apiKey.trim()) {
      toastError('API Key Required', 'Please enter an API key or use Groq free tier.')
      return false
    }

    setValidating(true)
    try {
      const res = await fetch('/api/personal-agent/byok/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: byokProvider, apiKey: apiKey.trim() })
      }).then(r => r.json())

      if (res.valid) {
        setValidated(true)
        toastSuccess('API Key Verified!', `Provider: ${byokProvider.toUpperCase()} (${res.speed || 'Fast'})`)
        // Auto-save configuration
        await fetch('/api/personal-agent/byok/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: byokProvider, apiKey: apiKey.trim(), model: res.model })
        })
        return true
      } else {
        toastError('Verification Failed', res.error || 'Invalid API key format.')
        return false
      }
    } catch (err: any) {
      toastError('Error', err.message || 'Could not validate key.')
      return false
    } finally {
      setValidating(false)
    }
  }

  const handleLaunchFirstTask = async (task: { title: string; prompt: string }) => {
    setExecutingTask(true)
    setFirstTaskPrompt(task.prompt)

    try {
      // 1. Update personal agent profile
      await api.personalAgent.updateProfile({
        name: assistantName,
        persona: {
          roleDescription: 'Personal AI Companion & Workflow Orchestrator',
          tone: assistantTone,
          language: 'en'
        },
        onboardingCompleted: true,
        onboardingAnswers: {
          userRole,
          firstTask: task.title
        }
      })

      // 2. Dispatch first task
      await api.personalAgent.chat(task.prompt)

      toastSuccess(`Mission Complete!`, `${assistantName} handled your request.`)

      setTimeout(() => {
        router.push('/dashboard/assistant')
      }, 1000)
    } catch (err: any) {
      toastError('Execution Error', err.message || 'Failed to run task.')
      setExecutingTask(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between selection:bg-[#534AB7]/30 relative overflow-x-hidden font-sans">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[#534AB7]/10 blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-[#00DFB8]/5 blur-[140px]" />
      </div>

      {/* Header */}
      <header className="w-full max-w-4xl mx-auto pt-8 pb-4 px-6 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#534AB7] to-[#3B3299] flex items-center justify-center shadow-lg shadow-[#534AB7]/20 border border-white/10">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
            Chatbolt <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Personal Setup</span>
          </span>
        </Link>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const stepNum = idx + 1
            const isCurrent = stepNum === currentStep
            const isCompleted = stepNum < currentStep
            return (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  isCurrent ? 'w-8 bg-[#00DFB8]' : isCompleted ? 'w-4 bg-[#534AB7]' : 'w-2 bg-white/10'
                }`}
              />
            )
          })}
          <span className="text-xs font-mono text-zinc-500 ml-1.5">Step {currentStep} of {totalSteps}</span>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-8 flex flex-col justify-center z-10">
        <div className="bg-[#0e0e13]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          
          {/* STEP 1: Name & Tone */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="text-center space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#534AB7]/20 text-purple-300 border border-[#534AB7]/30">
                  Step 1 • 30 Seconds
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Name Your Personal AI Partner
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400">
                  One persistent companion that learns your habits and coordinates 40+ specialist agents behind the scenes.
                </p>
              </div>

              {/* Name Presets & Custom Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Companion Name
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {['Aria', 'Jarvis', 'Echo', 'Nova'].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAssistantName(n)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        assistantName === n
                          ? 'bg-[#534AB7] border-[#534AB7] text-white shadow-md'
                          : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={assistantName}
                  onChange={e => setAssistantName(e.target.value)}
                  placeholder="Or enter a custom name..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-medium focus:outline-none focus:border-[#00DFB8]"
                />
              </div>

              {/* Tone Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Conversational Style
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'thoughtful', label: 'Thoughtful', sub: 'Deep & balanced' },
                    { id: 'concise', label: 'Concise', sub: 'Short & direct' },
                    { id: 'direct', label: 'Direct', sub: 'Execution focused' },
                    { id: 'warm', label: 'Warm', sub: 'Friendly & helpful' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAssistantTone(t.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        assistantTone === t.id
                          ? 'bg-[#00DFB8]/15 border-[#00DFB8] text-white ring-1 ring-[#00DFB8]'
                          : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{t.label}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Next Button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#534AB7] to-[#685ED8] hover:from-[#473e9e] hover:to-[#5a50be] text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[#534AB7]/25 transition-all cursor-pointer"
                >
                  Continue to AI Key <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: 1-Click BYOK Setup */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="text-center space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Step 2 • 100% Free Chatbolt Tier
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Connect Your AI Provider Key
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Zero Chatbolt subscription fee. You pay $0 to us. Use Groq's blazing fast 100% free tier or OpenAI/Anthropic.
                </p>
              </div>

              {/* Provider Radio Tabs */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'groq', name: '⚡ Groq (100% Free Tier)', sub: '500 tok/s • Recommended' },
                  { id: 'openai', name: 'OpenAI (GPT-4o)', sub: 'Pay raw token cost' },
                  { id: 'anthropic', name: 'Anthropic (Claude 3.5)', sub: 'Direct billing' },
                  { id: 'openrouter', name: 'OpenRouter', sub: '200+ AI Models' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setByokProvider(p.id as any)
                      setValidated(false)
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      byokProvider === p.id
                        ? 'bg-[#534AB7]/20 border-[#534AB7] text-white ring-1 ring-[#534AB7]'
                        : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{p.name}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{p.sub}</div>
                  </button>
                ))}
              </div>

              {/* Key Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    {byokProvider.toUpperCase()} API Key
                  </label>
                  <a
                    href={byokProvider === 'groq' ? 'https://console.groq.com/keys' : 'https://platform.openai.com/api-keys'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#00DFB8] hover:underline flex items-center gap-1 font-medium"
                  >
                    Get instant key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => {
                    setApiKey(e.target.value)
                    setValidated(false)
                  }}
                  placeholder={byokProvider === 'groq' ? 'gsk_...' : 'sk-...'}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-[#00DFB8]"
                />
              </div>

              {/* Zero Markup Platform Guarantee */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1 text-xs text-zinc-400">
                <div className="text-white font-bold flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-[#00DFB8]" />
                  <span>No Chatbolt Platform Fees • Zero Markup</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Your keys are encrypted in a sovereign AES-256 vault. Chatbolt never resells your tokens or charges a monthly fee for your personal companion.
                </p>
              </div>

              {/* Navigation Footer */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  disabled={validating}
                  onClick={async () => {
                    if (!apiKey.trim()) {
                      // Allow testing with default sandbox demo key
                      setApiKey('gsk_chatbolt_personal_trial_key_2026')
                    }
                    const ok = await handleValidateKey()
                    if (ok) setCurrentStep(3)
                  }}
                  className="px-8 py-3.5 rounded-xl bg-[#00DFB8] hover:bg-[#00c9a7] text-black font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[#00DFB8]/20 transition-all cursor-pointer"
                >
                  {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify & Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: 1-Click First Real Task */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="text-center space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Step 3 • Instant Execution
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Try Your First Real Task with {assistantName}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Pick any realistic task below to watch {assistantName} delegate to specialized agents and deliver a unified result.
                </p>
              </div>

              {/* Task Options */}
              <div className="space-y-3">
                {[
                  {
                    title: 'Plan a 4-Day Trip to Kyoto',
                    desc: 'Coordinates Researcher for attractions, Data specialist for budget table, and Writer for daily itinerary.',
                    prompt: 'Plan a 4-day trip to Kyoto in autumn. Include top cultural sites, daily schedule, and estimated budget in USD.'
                  },
                  {
                    title: 'Write & Verify a Python Helper Script',
                    desc: 'Coordinates Code specialist to write script with unit tests, type hints, and error handling.',
                    prompt: 'Write a Python script that reads a CSV file, strips duplicate rows, sorts by date, and saves clean output. Include unit tests.'
                  },
                  {
                    title: 'Draft Morning Executive Briefing',
                    desc: 'Coordinates Writer to summarize key active priorities and draft an email briefing.',
                    prompt: 'Draft an executive morning briefing summarizing my active tasks, team updates, and key priorities for today.'
                  }
                ].map((t, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#00DFB8]/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-white group-hover:text-[#00DFB8] transition-colors">{t.title}</h3>
                      <p className="text-[11px] text-zinc-400 leading-snug">{t.desc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={executingTask}
                      onClick={() => handleLaunchFirstTask(t)}
                      className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-[#00DFB8] hover:text-black text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer shrink-0"
                    >
                      {executingTask && firstTaskPrompt === t.prompt ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" /> Run Now
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {/* Skip to Dashboard */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/assistant')}
                  className="text-xs text-zinc-400 hover:text-white underline font-medium"
                >
                  Skip directly to Assistant Chat →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto py-6 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 border-t border-white/5 z-10 font-mono">
        <div>Chatbolt Sovereign Personal Assistant • AES-256 Vault Encryption</div>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="hover:text-zinc-300">100% Free BYOK</Link>
          <Link href="/dashboard" className="hover:text-zinc-300">Dashboard</Link>
        </div>
      </footer>
    </div>
  )
}
