'use client'

import React, { useState, useEffect } from 'react'
import {
  Mic,
  Volume2,
  VolumeX,
  Sparkles,
  Shield,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  DollarSign,
  Zap,
  Info,
  Sliders,
  Settings2,
  HelpCircle,
  Layers,
  Radio
} from 'lucide-react'
import { api } from '@/lib/api'
import { voiceManager, BrowserSupportInfo } from '@/lib/voice-manager'
import { useToast } from '@/components/ui/Toast'

interface PersonalVoiceSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  agentName?: string
  onSettingsChanged?: (settings: any) => void
}

export default function PersonalVoiceSettingsModal({
  isOpen,
  onClose,
  agentName = 'Aria',
  onSettingsChanged
}: PersonalVoiceSettingsModalProps) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingVoice, setTestingVoice] = useState(false)
  
  // Settings state
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(true)
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true)
  const [inputMode, setInputMode] = useState<'browser' | 'provider'>('browser')
  const [outputMode, setOutputMode] = useState<'browser' | 'provider'>('browser')
  const [spokenNotificationsEnabled, setSpokenNotificationsEnabled] = useState(false)
  const [browserRate, setBrowserRate] = useState(1.0)
  const [browserPitch, setBrowserPitch] = useState(1.0)
  const [browserVoiceURI, setBrowserVoiceURI] = useState('')
  const [providerTtsVoice, setProviderTtsVoice] = useState<'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'>('nova')

  // Browser and usage diagnostics
  const [browserSupport, setBrowserSupport] = useState<BrowserSupportInfo | null>(null)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceUsage, setVoiceUsage] = useState<any>(null)

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    setLoading(true)
    try {
      // 1. Detect browser support
      const support = voiceManager.detectSupport()
      setBrowserSupport(support)

      // 2. Load available browser voices
      const voices = voiceManager.getVoices()
      setAvailableVoices(voices)

      // 3. Load backend settings and usage ledger
      const [settingsRes, usageRes] = await Promise.all([
        api.personalAgent.getVoiceSettings().catch(() => null),
        api.personalAgent.getVoiceUsage().catch(() => null)
      ])

      if (settingsRes?.success && settingsRes.settings) {
        const s = settingsRes.settings
        setVoiceInputEnabled(s.voiceInputEnabled ?? true)
        setVoiceOutputEnabled(s.voiceOutputEnabled ?? true)
        setInputMode(s.inputMode || 'browser')
        setOutputMode(s.outputMode || 'browser')
        setSpokenNotificationsEnabled(s.spokenNotificationsEnabled ?? false)
        setBrowserRate(s.browserRate || 1.0)
        setBrowserPitch(s.browserPitch || 1.0)
        setBrowserVoiceURI(s.browserVoiceURI || '')
        setProviderTtsVoice(s.providerTtsVoice || 'nova')
      }

      if (usageRes?.success && usageRes.usage) {
        setVoiceUsage(usageRes.usage)
      }
    } catch (err: any) {
      console.warn('Failed loading voice settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        voiceInputEnabled,
        voiceOutputEnabled,
        inputMode,
        outputMode,
        spokenNotificationsEnabled,
        browserRate,
        browserPitch,
        browserVoiceURI,
        providerTtsVoice
      }

      const res = await api.personalAgent.updateVoiceSettings(payload)
      if (res.success) {
        toastSuccess('Voice Settings Updated', 'Your voice interaction preferences have been saved.')
        onSettingsChanged?.(res.settings)
        onClose()
      }
    } catch (err: any) {
      toastError('Save Failed', err.message || 'Failed to update voice preferences.')
    } finally {
      setSaving(false)
    }
  }

  const handleTestSpeech = () => {
    if (testingVoice) {
      voiceManager.stopSpeaking()
      setTestingVoice(false)
      return
    }

    const phrase = `Hello! I'm ${agentName}, your personal assistant. Voice output is working perfectly.`
    setTestingVoice(true)

    voiceManager.speak(
      phrase,
      {
        rate: browserRate,
        pitch: browserPitch,
        voiceURI: browserVoiceURI
      },
      () => setTestingVoice(true),
      () => setTestingVoice(false),
      (err) => {
        setTestingVoice(false)
        toastError('Audio Playback Error', err)
      }
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0f0f15] border border-white/10 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Personal Voice Controls & Settings
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Browser-Native Zero Cost
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Speech-to-text dictation, spoken read-aloud responses, and background voice alerts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 text-sm cursor-pointer rounded-lg hover:bg-white/5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto py-4 space-y-6 flex-1 pr-1 custom-scrollbar">
          {/* Section 1: Browser Detection & Safe Review Guarantee */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <p className="text-xs font-bold text-white">
                  {browserSupport?.speechRecognitionSupported
                    ? 'Browser Web Speech API: Active & Ready'
                    : 'Browser Web Speech: Limited or Restricted'}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {browserSupport?.speechRecognitionSupported
                    ? 'Works directly in Chrome, Edge, and Android without third-party audio transmission.'
                    : browserSupport?.supportMessage}
                </p>
              </div>
            </div>
            <div className="text-[10px] text-zinc-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              100% Client-Side
            </div>
          </div>

          {/* Section 2: Voice Input (STT) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Voice Input (Speech-to-Text)</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceInputEnabled}
                  onChange={e => setVoiceInputEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#534AB7]"></div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Option 1: Browser Native */}
              <button
                type="button"
                onClick={() => setInputMode('browser')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  inputMode === 'browser'
                    ? 'bg-[#534AB7]/20 border-[#534AB7] text-white ring-1 ring-[#534AB7]'
                    : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Browser-Native STT</span>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    $0.00 Free
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Zero latency, uses local browser speech engine with zero API key requirement.
                </p>
              </button>

              {/* Option 2: Provider Whisper */}
              <button
                type="button"
                onClick={() => setInputMode('provider')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  inputMode === 'provider'
                    ? 'bg-[#534AB7]/20 border-[#534AB7] text-white ring-1 ring-[#534AB7]'
                    : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Whisper STT (BYOK)</span>
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Higher Accuracy
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">
                  High-accuracy OpenAI Whisper transcription using your configured BYOK key.
                </p>
              </button>
            </div>

            {/* Safeguard note */}
            <div className="p-2.5 bg-blue-500/5 border border-blue-500/10 rounded-xl text-[11px] text-blue-300 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-blue-400" />
              <span>
                <strong>Review Safeguard:</strong> Speech is transcribed directly into your message box so you can inspect and edit before sending.
              </span>
            </div>
          </div>

          {/* Section 3: Voice Output (TTS) & Read Aloud */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Voice Output (Text-to-Speech)</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceOutputEnabled}
                  onChange={e => setVoiceOutputEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00DFB8]"></div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Option 1: Browser SpeechSynthesis */}
              <button
                type="button"
                onClick={() => setOutputMode('browser')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  outputMode === 'browser'
                    ? 'bg-[#00DFB8]/20 border-[#00DFB8] text-white ring-1 ring-[#00DFB8]'
                    : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Browser SpeechSynthesis</span>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    $0.00 Free
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Uses device-native voices (Siri, Google US, Samantha) with instant playback.
                </p>
              </button>

              {/* Option 2: Provider Neural TTS */}
              <button
                type="button"
                onClick={() => setOutputMode('provider')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  outputMode === 'provider'
                    ? 'bg-[#00DFB8]/20 border-[#00DFB8] text-white ring-1 ring-[#00DFB8]'
                    : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Neural TTS (BYOK)</span>
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Hyper-Realistic
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Human-grade neural voices (Nova, Alloy, Echo) with natural cadence.
                </p>
              </button>
            </div>

            {/* Voice Tuning Controls */}
            {outputMode === 'browser' ? (
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">Device Voice Selection</label>
                  <button
                    type="button"
                    onClick={handleTestSpeech}
                    className="text-xs font-bold text-[#00DFB8] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {testingVoice ? <Square className="w-3 h-3 fill-[#00DFB8]" /> : <Play className="w-3 h-3 fill-[#00DFB8]" />}
                    {testingVoice ? 'Stop Test' : 'Test Voice'}
                  </button>
                </div>
                {availableVoices.length > 0 ? (
                  <select
                    value={browserVoiceURI}
                    onChange={e => setBrowserVoiceURI(e.target.value)}
                    className="w-full bg-[#15151c] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00DFB8]"
                  >
                    <option value="">Default System Voice</option>
                    {availableVoices.map(v => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[11px] text-zinc-400">Default device voice will be used automatically.</p>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                      <span>Speed Rate</span>
                      <span className="text-white font-mono">{browserRate.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.75"
                      step="0.05"
                      value={browserRate}
                      onChange={e => setBrowserRate(parseFloat(e.target.value))}
                      className="w-full accent-[#00DFB8]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                      <span>Pitch</span>
                      <span className="text-white font-mono">{browserPitch.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.05"
                      value={browserPitch}
                      onChange={e => setBrowserPitch(parseFloat(e.target.value))}
                      className="w-full accent-[#00DFB8]"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl space-y-3">
                <label className="text-xs font-semibold text-zinc-300">Provider Persona Voice</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setProviderTtsVoice(v)}
                      className={`p-2 rounded-lg border text-xs capitalize text-center transition-all cursor-pointer ${
                        providerTtsVoice === v
                          ? 'bg-[#00DFB8]/20 border-[#00DFB8] text-white font-bold'
                          : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/[0.05]'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Spoken Proactive Notifications */}
          <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span>Spoken Proactive Notifications</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Have {agentName} speak high-priority background alerts aloud — ideal for always-on background use when working in other tabs.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={spokenNotificationsEnabled}
                onChange={e => setSpokenNotificationsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Section 5: Transparent Cost Breakdown Ledger */}
          <div className="p-3.5 bg-black/40 border border-white/10 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Real-Time Voice Cost & Metering
              </span>
              <span className="text-[10px] text-zinc-400">Direct BYOK Billing</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2 bg-white/[0.02] rounded-lg border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Browser Voice</span>
                <span className="text-xs font-bold text-emerald-400">$0.00 / min</span>
              </div>
              <div className="p-2 bg-white/[0.02] rounded-lg border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Whisper STT</span>
                <span className="text-xs font-bold text-white">$0.006 / min</span>
              </div>
              <div className="p-2 bg-white/[0.02] rounded-lg border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Neural TTS</span>
                <span className="text-xs font-bold text-white">$0.015 / 1k ch</span>
              </div>
            </div>
            {voiceUsage && (
              <div className="pt-2 text-[11px] text-zinc-400 flex items-center justify-between border-t border-white/5">
                <span>Recorded Usage: {voiceUsage.totalSttSeconds || 0}s STT • {voiceUsage.totalTtsCharacters || 0} chars TTS</span>
                <span className="text-emerald-400 font-mono font-bold">${(voiceUsage.totalVoiceCostUSD || 0).toFixed(4)} total</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-zinc-400 hover:text-white rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2.5 bg-[#534AB7] hover:bg-[#473e9e] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-[#534AB7]/20"
          >
            {saving ? 'Saving...' : 'Save Voice Preferences'}
          </button>
        </div>
      </div>
    </div>
  )
}
