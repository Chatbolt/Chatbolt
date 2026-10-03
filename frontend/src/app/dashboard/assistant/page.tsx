'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Bot,
  Brain,
  Send,
  Loader2,
  HardDrive,
  Clock,
  Key,
  Layers,
  Mail,
  Chrome,
  CheckCircle2,
  Copy,
  Check,
  Shield,
  Zap,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Sliders,
  Settings2,
  AlertCircle,
  HelpCircle,
  Compass,
  Paperclip,
  User,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { voiceManager } from '@/lib/voice-manager'
import PersonalAgentDrawer from '@/components/dashboard/PersonalAgentDrawer'
import DataSovereigntyModal from '@/components/dashboard/DataSovereigntyModal'
import BackgroundDigestModal from '@/components/dashboard/BackgroundDigestModal'
import AssistantCapabilityExplorerModal from '@/components/dashboard/AssistantCapabilityExplorerModal'
import YourDataAndPrivacyModal from '@/components/dashboard/YourDataAndPrivacyModal'
import PersonalVoiceSettingsModal from '@/components/dashboard/PersonalVoiceSettingsModal'

export default function AssistantDashboardPage() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()
  
  const [agent, setAgent] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [backgroundDigestSummary, setBackgroundDigestSummary] = useState<string>(
    'Aria is active in the background — monitoring scheduled routines and email triggers.'
  )

  // Voice Interaction States (Prompt 32)
  const [isListening, setIsListening] = useState(false)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const [voiceSettingsModalOpen, setVoiceSettingsModalOpen] = useState(false)
  const [voiceSettings, setVoiceSettings] = useState<any>(null)

  // Modals & Drawers
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sovereigntyModalOpen, setSovereigntyModalOpen] = useState(false)
  const [digestModalOpen, setDigestModalOpen] = useState(false)
  const [byokModalOpen, setByokModalOpen] = useState(false)
  const [capabilityExplorerOpen, setCapabilityExplorerOpen] = useState(false)
  const [yourDataModalOpen, setYourDataModalOpen] = useState(false)
  const [yourDataInitialTab, setYourDataInitialTab] = useState<'data' | 'memory' | 'permissions' | 'trust'>('data')

  // BYOK fast state
  const [byokStatus, setByokStatus] = useState<any>(null)
  const [byokKey, setByokKey] = useState('')
  const [byokProvider, setByokProvider] = useState<'groq' | 'openai' | 'anthropic' | 'openrouter'>('groq')
  const [validatingKey, setValidatingKey] = useState(false)
  const [validationResult, setValidationResult] = useState<any>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadAgentData()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const loadAgentData = async () => {
    try {
      const [agentRes, msgRes, byokRes, digestRes] = await Promise.all([
        api.personalAgent.getProfile(),
        api.personalAgent.getMessages(50),
        fetch('/api/personal-agent/byok/status').then(r => r.json()).catch(() => ({ success: true, isFreeTier: true })),
        fetch('/api/personal-agent/background/digest?timeframe=24h').then(r => r.json()).catch(() => null)
      ])

      if (agentRes.success && (agentRes.profile || agentRes.agent)) {
        setAgent(agentRes.profile || agentRes.agent)
      }
      if (msgRes.success && msgRes.messages) {
        setMessages(msgRes.messages)
      }
      if (byokRes?.success) {
        setByokStatus(byokRes)
      }
      if (digestRes?.success && digestRes.digest) {
        const d = digestRes.digest
        if (d.summaryText) {
          setBackgroundDigestSummary(d.summaryText)
        } else if (d.totalRunsCount !== undefined) {
          setBackgroundDigestSummary(
            `Today: Completed ${d.totalRunsCount || 0} background checks • 0 pending approvals`
          )
        }
      }

      // Load voice settings
      const voiceRes = await api.personalAgent.getVoiceSettings().catch(() => null)
      if (voiceRes?.success && voiceRes.settings) {
        setVoiceSettings(voiceRes.settings)
      }
    } catch (err: any) {
      console.warn('Failed loading assistant dashboard data:', err)
    } finally {
      setInitialLoading(false)
    }
  }

  const toggleListening = () => {
    if (isListening) {
      voiceManager.stopListening()
      setIsListening(false)
    } else {
      voiceManager.startListening(
        (transcript, isFinal) => {
          // Fill message box without auto-sending (Safe user review)
          setInputMessage(transcript)
        },
        (state, errorMsg) => {
          if (state === 'listening') {
            setIsListening(true)
          } else if (state === 'idle') {
            setIsListening(false)
          } else if (state === 'error') {
            setIsListening(false)
            toastError('Voice Input', errorMsg || 'Microphone error')
          } else if (state === 'unsupported') {
            setIsListening(false)
            toastInfo('Voice Input', errorMsg || 'Speech recognition not supported in this browser.')
          }
        }
      )
    }
  }

  const toggleReadAloud = (msgId: string, text: string) => {
    if (speakingMessageId === msgId) {
      voiceManager.stopSpeaking()
      setSpeakingMessageId(null)
    } else {
      voiceManager.speak(
        text,
        {
          rate: voiceSettings?.browserRate || 1.0,
          pitch: voiceSettings?.browserPitch || 1.0,
          voiceURI: voiceSettings?.browserVoiceURI
        },
        () => setSpeakingMessageId(msgId),
        () => setSpeakingMessageId(null),
        (err) => {
          setSpeakingMessageId(null)
          toastError('Speech Output', err)
        }
      )
    }
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputMessage.trim() || loading) return

    // Stop listening if user hits send
    if (isListening) {
      voiceManager.stopListening()
      setIsListening(false)
    }

    const userText = inputMessage.trim()
    setInputMessage('')
    setLoading(true)

    // Optimistically add user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userText,
      createdAt: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const res = await api.personalAgent.chat(userText)
      const assistantMsg = res.message || res.assistantMessage
      if (res.success && assistantMsg) {
        setMessages(prev => [...prev, assistantMsg])
        if (res.delegatedSpecialists?.length) {
          toastInfo(
            'Handled by Specialist Roster',
            `Coordinated: ${res.delegatedSpecialists.join(', ')}`
          )
        }
      }
    } catch (err: any) {
      toastError('Message Failed', err.message || 'Could not send message to assistant.')
    } finally {
      setLoading(false)
    }
  }

  const handleValidateAndSaveKey = async () => {
    if (!byokKey.trim()) return
    setValidatingKey(true)
    setValidationResult(null)

    try {
      // 1. Validate
      const valRes = await fetch('/api/personal-agent/byok/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: byokProvider, apiKey: byokKey.trim() })
      }).then(r => r.json())

      setValidationResult(valRes)

      if (valRes.valid) {
        // 2. Save
        const saveRes = await fetch('/api/personal-agent/byok/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: byokProvider, apiKey: byokKey.trim(), model: valRes.model })
        }).then(r => r.json())

        if (saveRes.success) {
          toastSuccess('Key Configured & Verified!', 'Your personal assistant is active with $0 platform markup.')
          setByokStatus({
            configured: true,
            provider: byokProvider,
            model: valRes.model,
            isFreeTier: valRes.freeTier
          })
          setTimeout(() => setByokModalOpen(false), 1200)
        }
      } else {
        toastError('Key Verification Failed', valRes.error || 'Please check the key and try again.')
      }
    } catch (err: any) {
      toastError('Validation Error', err.message || 'Failed to validate API key.')
    } finally {
      setValidatingKey(false)
    }
  }

  const agentName = agent?.name || 'Aria'
  const agentTone = agent?.persona?.tone || 'thoughtful'
  const inboundEmail = `assistant-${(agent?.tenantId || 'd34930ea').replace(/-/g, '').slice(0, 8)}@in.chatbolt.ai`

  const copyEmail = () => {
    navigator.clipboard.writeText(inboundEmail)
    setCopiedEmail(true)
    toastSuccess('Inbound Address Copied', 'Forward emails here to automatically route to your assistant.')
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] bg-[#070709] text-white overflow-hidden relative font-sans selection:bg-[#534AB7]/30">
      
      {/* Background Soft Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] rounded-full bg-[#534AB7]/5 blur-[160px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-[#00DFB8]/5 blur-[160px]" />
      </div>

      {/* Top Calm Header (Optimized for Mobile & Desktop) */}
      <header className="px-4 sm:px-6 py-3 border-b border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#534AB7] to-[#3B3299] flex items-center justify-center text-white shadow-lg shadow-[#534AB7]/25 border border-white/10">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0c0c12] animate-pulse" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                {agentName}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Ready & Listening
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate flex items-center gap-1.5">
              <span>Personal Partner</span>
              <span>•</span>
              <span className="capitalize">{agentTone}</span>
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => {
              setYourDataInitialTab('data')
              setYourDataModalOpen(true)
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-xl transition-all cursor-pointer shadow-xs"
            title="Inspect Your Data, Storage, Memory & Privacy"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Your Data</span>
          </button>

          <button
            onClick={() => setVoiceSettingsModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 rounded-xl transition-all cursor-pointer shadow-xs"
            title="Voice Controls (Mic Dictation & Spoken Read Aloud)"
          >
            <Mic className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Voice</span>
          </button>

          <button
            onClick={() => setCapabilityExplorerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all cursor-pointer shadow-xs"
            title="Explore Capabilities"
          >
            <Compass className="w-3.5 h-3.5 text-[#00DFB8]" />
            <span className="hidden sm:inline">Capabilities</span>
          </button>

          <button
            onClick={() => {
              setYourDataInitialTab('memory')
              setYourDataModalOpen(true)
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-[#534AB7] hover:bg-[#473e9e] rounded-xl transition-all cursor-pointer shadow-md shadow-[#534AB7]/20"
            title="Assistant Memory & Learned Facts"
          >
            <Brain className="w-3.5 h-3.5 text-purple-200" />
            <span className="hidden sm:inline">Memory</span>
          </button>

          <button
            onClick={() => setByokModalOpen(true)}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            title="AI Key & BYOK Settings"
          >
            <Key className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </header>

      {/* Quiet Glanceable Background Activity Summary Pill */}
      <div className="px-4 sm:px-6 py-2 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between text-xs text-zinc-400 shrink-0 z-10">
        <button
          onClick={() => setDigestModalOpen(true)}
          className="flex items-center gap-2 text-left hover:text-zinc-200 transition-colors group cursor-pointer min-w-0"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#00DFB8] shrink-0" />
          <span className="truncate text-[11px] sm:text-xs">
            {backgroundDigestSummary}
          </span>
          <span className="text-[10px] text-purple-300 font-semibold group-hover:underline shrink-0 flex items-center gap-0.5">
            Details <ChevronRight className="w-3 h-3" />
          </span>
        </button>

        <div className="hidden md:flex items-center gap-3 text-[11px] text-zinc-500 shrink-0">
          <button
            onClick={() => {
              setYourDataInitialTab('data')
              setYourDataModalOpen(true)
            }}
            className="hover:text-emerald-300 text-emerald-400/80 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <HardDrive className="w-3 h-3 text-emerald-400" />
            <span>Sovereign Storage (Inspect)</span>
          </button>
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5 custom-scrollbar z-10">
        {initialLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-3 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin text-[#534AB7]" />
            <p className="text-xs font-medium">Connecting to {agentName}...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="max-w-xl mx-auto py-8 sm:py-16 text-center space-y-8 animate-in fade-in">
            {/* Friendly Greeting Card */}
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#534AB7] to-[#3B3299] flex items-center justify-center text-white mx-auto shadow-xl shadow-[#534AB7]/30 border border-white/10">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                How can I help you today?
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                I'm your continuous personal assistant. I remember your context and coordinate specialist agents for writing, research, code, and scheduling.
              </p>
            </div>

            {/* Starter Suggestion Grid */}
            <div className="space-y-2 text-left">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between px-1">
                <span>Starter Recipes</span>
                <button
                  onClick={() => setCapabilityExplorerOpen(true)}
                  className="text-[#00DFB8] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  Explore all <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    title: 'Plan a Trip & Itinerary',
                    sub: 'Kyoto autumn trip with sights and budget table',
                    prompt: 'Plan a 4-day trip to Kyoto in autumn. Include top cultural sites, daily schedule, and estimated budget in USD.'
                  },
                  {
                    title: 'Debug & Write a Script',
                    sub: 'Python helper to clean messy CSVs',
                    prompt: 'Write a Python script that reads a CSV file, strips duplicate rows, standardizes dates, and saves clean output with unit tests.'
                  },
                  {
                    title: 'Draft Executive Update',
                    sub: 'Nuanced weekly memo for leadership',
                    prompt: 'Draft an executive weekly update memo covering our key engineering milestones, launch timeline, and blockers.'
                  },
                  {
                    title: 'Inspect Learned Memory',
                    sub: 'See what I remember about you',
                    prompt: 'What facts and preferences do you currently know about me?'
                  }
                ].map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputMessage(chip.prompt)
                    }}
                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-[#534AB7] hover:bg-white/[0.05] transition-all text-left space-y-1 group cursor-pointer shadow-xs"
                  >
                    <p className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">{chip.title}</p>
                    <p className="text-[11px] text-zinc-400 line-clamp-1">{chip.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Multi-Channel Reach Tip */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  <strong>Reach from email:</strong> Forward anything to <code className="text-zinc-200 font-mono text-[11px] bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{inboundEmail}</code>
                </span>
              </div>
              <button
                onClick={copyEmail}
                className="px-2.5 py-1 text-[11px] font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors cursor-pointer shrink-0"
              >
                {copiedEmail ? 'Copied!' : 'Copy Address'}
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user'
            const isEmail = msg.metadata?.channel === 'email' || msg.content?.startsWith('[Incoming Email]')
            const msgId = msg.id || `msg-${idx}`
            const isCurrentSpeaking = speakingMessageId === msgId
            
            return (
              <div
                key={msgId}
                className={`flex gap-3 max-w-2xl sm:max-w-3xl ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'} animate-in fade-in duration-200`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#534AB7] to-[#3B3299] flex items-center justify-center text-white shrink-0 shadow-md shadow-[#534AB7]/20 border border-white/10 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed space-y-2.5 max-w-[90%] sm:max-w-[85%] ${
                    isUser
                      ? 'bg-[#534AB7] text-white rounded-tr-xs shadow-md shadow-[#534AB7]/20'
                      : 'bg-[#111117] border border-white/[0.08] text-zinc-100 rounded-tl-xs shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 text-[10px] opacity-70 pb-1.5 border-b border-white/10">
                    <span className="font-bold tracking-tight">
                      {isUser ? 'You' : agentName}
                      {isEmail && ' (via Email ✉️)'}
                    </span>
                    <div className="flex items-center gap-2">
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => toggleReadAloud(msgId, msg.content)}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            isCurrentSpeaking
                              ? 'text-emerald-400 bg-emerald-500/20 animate-pulse'
                              : 'text-zinc-400 hover:text-white hover:bg-white/10'
                          }`}
                          title={isCurrentSpeaking ? 'Stop speech' : 'Read aloud with browser speech'}
                        >
                          {isCurrentSpeaking ? (
                            <VolumeX className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                      <span>{new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="whitespace-pre-wrap font-sans leading-relaxed text-zinc-200">
                    {msg.content}
                  </div>

                  {/* Specialist Footnote */}
                  {msg.metadata?.specialistsUsed && msg.metadata.specialistsUsed.length > 0 && (
                    <div className="pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                      <Layers className="w-3 h-3 text-[#00DFB8]" />
                      <span>Coordinated: {msg.metadata.specialistsUsed.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}

        {loading && (
          <div className="flex gap-3 max-w-2xl mr-auto animate-in fade-in">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#534AB7] to-[#3B3299] flex items-center justify-center text-white shrink-0 shadow-md shadow-[#534AB7]/20 border border-white/10">
              <Sparkles className="w-4 h-4 animate-spin text-white" />
            </div>
            <div className="bg-[#111117] border border-white/[0.08] rounded-2xl rounded-tl-xs p-4 text-xs text-zinc-400 flex items-center gap-2.5 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-[#00DFB8]" />
              <span>{agentName} is thinking and coordinating specialists...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Mobile-First Composer (Sticky Bottom) */}
      <div className="p-3 sm:p-4 border-t border-white/[0.08] bg-[#0c0c12]/95 backdrop-blur-md shrink-0 z-20 pb-safe">
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto space-y-2">
          
          {/* Quick Action Chips Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] custom-scrollbar">
            <button
              type="button"
              onClick={() => setCapabilityExplorerOpen(true)}
              className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-medium whitespace-nowrap flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Compass className="w-3 h-3 text-[#00DFB8]" />
              <span>Capabilities</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMessage('Summarize my recent active tasks and priority items')}
              className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-medium whitespace-nowrap transition-colors cursor-pointer"
            >
              Briefing
            </button>
            <button
              type="button"
              onClick={() => setInputMessage('Plan a 3-day weekend itinerary')}
              className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-medium whitespace-nowrap transition-colors cursor-pointer"
            >
              Plan Trip
            </button>
            <button
              type="button"
              onClick={() => setInputMessage('Write a Python script to ')}
              className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-medium whitespace-nowrap transition-colors cursor-pointer"
            >
              Code Helper
            </button>
          </div>

          {/* Input Box with Voice Dictation & Send Button */}
          <div className={`relative flex items-center bg-[#15151c] border rounded-2xl shadow-lg transition-all ${
            isListening ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-950/20' : 'border-white/10 focus-within:border-[#534AB7]'
          }`}>
            {/* Microphone Dictation Trigger */}
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2.5 ml-1.5 rounded-xl transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
              title={isListening ? 'Listening... (tap to stop dictation)' : 'Dictate with Voice (Browser Web Speech)'}
            >
              <Mic className={`w-4 h-4 ${isListening ? 'animate-bounce text-rose-400' : ''}`} />
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder={isListening ? 'Listening to your voice... (text appears here for review)' : `Message ${agentName}...`}
              className="w-full bg-transparent pl-2 pr-12 py-3.5 text-sm sm:text-base text-white placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="absolute right-2 p-2 bg-[#534AB7] hover:bg-[#473e9e] disabled:opacity-40 disabled:hover:bg-[#534AB7] text-white rounded-xl transition-all cursor-pointer shadow-md shadow-[#534AB7]/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#00DFB8]" />
              <span>100% Free BYOK • Browser Voice Active</span>
            </span>
            <span className="hidden sm:inline">Press Enter to send</span>
          </div>
        </form>
      </div>

      {/* Capability Explorer Modal */}
      <AssistantCapabilityExplorerModal
        isOpen={capabilityExplorerOpen}
        onClose={() => setCapabilityExplorerOpen(false)}
        onSelectPrompt={(prompt) => setInputMessage(prompt)}
        agentName={agentName}
      />

      {/* Personal Agent Memory Drawer */}
      <PersonalAgentDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenOnboarding={() => {}}
        agent={agent}
        onAgentUpdated={setAgent}
      />

      {/* Data Sovereignty Modal */}
      <DataSovereigntyModal
        isOpen={sovereigntyModalOpen}
        onClose={() => setSovereigntyModalOpen(false)}
        agentName={agentName}
      />

      {/* Background Activity Digest Modal */}
      <BackgroundDigestModal
        isOpen={digestModalOpen}
        onClose={() => setDigestModalOpen(false)}
        agentName={agentName}
      />

      {/* BYOK Fast Setup Modal */}
      {byokModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0f0f15] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">AI Provider & BYOK Key</h3>
                  <p className="text-xs text-zinc-400">2-minute setup • 100% Free Chatbolt Platform</p>
                </div>
              </div>
              <button
                onClick={() => setByokModalOpen(false)}
                className="text-zinc-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Provider Select Cards */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Select Your AI Provider
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'groq', name: 'Groq Cloud', tag: 'Recommended (100% Free)', sub: '500 tok/s • Llama 3.3 70B' },
                  { id: 'openai', name: 'OpenAI', tag: 'Direct Usage', sub: 'GPT-4o & GPT-4o Mini' },
                  { id: 'anthropic', name: 'Anthropic', tag: 'Direct Usage', sub: 'Claude 3.5 Sonnet' },
                  { id: 'openrouter', name: 'OpenRouter', tag: 'All Models', sub: 'Unified Key' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setByokProvider(p.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      byokProvider === p.id
                        ? 'bg-[#534AB7]/20 border-[#534AB7] text-white ring-1 ring-[#534AB7]'
                        : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{p.name}</span>
                      {p.id === 'groq' && (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Free
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{p.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Key Input Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300">
                  {byokProvider.toUpperCase()} API Key
                </label>
                <a
                  href={byokProvider === 'groq' ? 'https://console.groq.com/keys' : 'https://platform.openai.com/api-keys'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#00DFB8] hover:underline flex items-center gap-1 font-medium"
                >
                  Get free key here <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="password"
                value={byokKey}
                onChange={e => setByokKey(e.target.value)}
                placeholder={byokProvider === 'groq' ? 'gsk_...' : 'sk-...'}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-[#00DFB8]"
              />
            </div>

            {/* Validation Result */}
            {validationResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                validationResult.valid
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {validationResult.valid ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{validationResult.message}</span>
              </div>
            )}

            {/* Zero Cost Platform Guarantee */}
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[11px] text-zinc-400 space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#00DFB8]" />
                <span>Zero Subscription Fee Guarantee</span>
              </div>
              <p>
                Chatbolt charges $0 for your Personal Assistant. You only pay your AI provider directly (or $0.00 with Groq). Keys are encrypted in your sovereign local vault.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setByokModalOpen(false)}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!byokKey.trim() || validatingKey}
                onClick={handleValidateAndSaveKey}
                className="px-5 py-2.5 bg-[#534AB7] hover:bg-[#473e9e] disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-[#534AB7]/20"
              >
                {validatingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Validate & Save Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-Technical Inspectable "Your Data, Memory & Privacy" Modal */}
      <YourDataAndPrivacyModal
        isOpen={yourDataModalOpen}
        onClose={() => setYourDataModalOpen(false)}
        agentName={agentName}
        initialTab={yourDataInitialTab}
      />

      {/* Personal Voice Settings Modal (Prompt 32) */}
      <PersonalVoiceSettingsModal
        isOpen={voiceSettingsModalOpen}
        onClose={() => setVoiceSettingsModalOpen(false)}
        agentName={agentName}
        onSettingsChanged={(updated) => setVoiceSettings(updated)}
      />
    </div>
  )
}
