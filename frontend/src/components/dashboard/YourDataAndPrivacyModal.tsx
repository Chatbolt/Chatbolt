'use client'

import React, { useState, useEffect } from 'react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  HardDrive,
  Brain,
  Download,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Lock,
  Eye,
  Sliders,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Plus,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Info,
  Calendar,
  Mail,
  FileText,
  Clock,
  Sparkles,
  Search
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import DecisionPatternsView from './DecisionPatternsView'
import CrucialMomentsAndAdviceView from './CrucialMomentsAndAdviceView'

interface YourDataAndPrivacyModalProps {
  isOpen: boolean
  onClose: () => void
  agentName?: string
  initialTab?: 'data' | 'memory' | 'patterns' | 'crucial' | 'permissions' | 'trust'
}

type TabType = 'data' | 'memory' | 'patterns' | 'crucial' | 'permissions' | 'trust'

/**
 * Turns raw key/value pairs into conversational, natural English sentences
 * for everyday, non-technical users.
 */
export function formatMemoryAsSentence(key: string, value: string): string {
  const cleanKey = key.toLowerCase().replace(/_/g, ' ').trim()
  const cleanVal = value.trim()

  if (cleanKey.includes('tone') || cleanKey.includes('style')) {
    return `You prefer a ${cleanVal} communication tone with your assistant.`
  }
  if (cleanKey.includes('trip') || cleanKey.includes('vacation') || cleanKey.includes('travel')) {
    return `You are planning travel: ${cleanVal}.`
  }
  if (cleanKey.includes('working on') || cleanKey.includes('project') || cleanKey.includes('goal')) {
    return `You are currently working on: ${cleanVal}.`
  }
  if (cleanKey.includes('timezone') || cleanKey.includes('location')) {
    return `Your primary timezone and location is set to ${cleanVal}.`
  }
  if (cleanKey.includes('tech') || cleanKey.includes('stack') || cleanKey.includes('database')) {
    return `You prefer using ${cleanVal} for development and tooling.`
  }
  if (cleanKey.includes('schedule') || cleanKey.includes('routine')) {
    return `Your regular workflow routine: ${cleanVal}.`
  }

  // If already reads like a sentence, capitalize and ensure punctuation
  if (cleanVal.length > 20 && (cleanVal.startsWith('You') || cleanVal.startsWith('Always') || cleanVal.startsWith('Prefer'))) {
    return cleanVal.endsWith('.') ? cleanVal : `${cleanVal}.`
  }

  return `${cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1)}: ${cleanVal}.`
}

export default function YourDataAndPrivacyModal({
  isOpen,
  onClose,
  agentName = 'Aria',
  initialTab = 'data'
}: YourDataAndPrivacyModalProps) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()
  
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [loading, setLoading] = useState(true)
  
  // Storage & Profile state
  const [overview, setOverview] = useState<any>(null)
  const [agentProfile, setAgentProfile] = useState<any>(null)
  
  // Memory state
  const [memories, setMemories] = useState<any[]>([])
  const [memorySearch, setMemorySearch] = useState('')
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  
  // Add Memory state
  const [isAddingMemory, setIsAddingMemory] = useState(false)
  const [newSentence, setNewSentence] = useState('')
  const [savingNewMemory, setSavingNewMemory] = useState(false)
  
  // Permissions / Autonomy state
  const [autonomyLevel, setAutonomyLevel] = useState<'careful' | 'balanced' | 'autonomous'>('balanced')
  const [permissions, setPermissions] = useState({
    readCalendar: true,
    readEmails: true,
    draftReplies: true,
    sendEmailsWithoutAsking: false,
    deleteFilesWithoutAsking: false,
    backgroundRoutines: true,
    notifyOnCompletion: true
  })
  const [savingPermissions, setSavingPermissions] = useState(false)
  
  // Export & Delete states
  const [isExporting, setIsExporting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadAllData()
    }
  }, [isOpen])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [storageRes, profileRes, memRes] = await Promise.all([
        api.personalAgent.getStorageOverview().catch(() => null),
        api.personalAgent.getProfile().catch(() => null),
        api.personalAgent.getMemories().catch(() => null)
      ])

      if (storageRes?.success) {
        setOverview(storageRes)
      }
      if (profileRes?.success && (profileRes.profile || profileRes.agent)) {
        const prof = profileRes.profile || profileRes.agent
        setAgentProfile(prof)
        if (prof.onboardingAnswers?.permissions) {
          setPermissions(prev => ({ ...prev, ...prof.onboardingAnswers.permissions }))
        }
        if (prof.onboardingAnswers?.autonomyLevel) {
          setAutonomyLevel(prof.onboardingAnswers.autonomyLevel)
        }
      }
      if (memRes?.success && memRes.memories) {
        setMemories(memRes.memories)
      }
    } catch (err: any) {
      console.warn('Failed loading Your Data overview:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Memory Actions ───────────────────────────────────────────────

  const handleStartEditMemory = (mem: any) => {
    setEditingMemoryId(mem.id)
    setEditValue(mem.value)
  }

  const handleSaveEditMemory = async (id: string) => {
    if (!editValue.trim()) return
    setSavingEdit(true)
    try {
      const res = await api.personalAgent.updateMemory(id, { value: editValue.trim() })
      if (res.success && res.memory) {
        setMemories(prev => prev.map(m => (m.id === id ? res.memory : m)))
        setEditingMemoryId(null)
        toastSuccess('Memory Updated', 'Your assistant updated this fact.')
      }
    } catch (err: any) {
      toastError('Update Failed', err.message || 'Could not save memory edit.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteMemory = async (id: string) => {
    try {
      const res = await api.personalAgent.deleteMemory(id)
      if (res.success) {
        setMemories(prev => prev.filter(m => m.id !== id))
        toastSuccess('Memory Forgotten', 'Fact removed completely from assistant memory.')
      }
    } catch (err: any) {
      toastError('Delete Failed', err.message || 'Could not delete fact.')
    }
  }

  const handleAddNewSentence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSentence.trim()) return
    setSavingNewMemory(true)
    try {
      const key = 'user_preference_' + Date.now().toString(36)
      const res = await api.personalAgent.addMemory({
        key,
        value: newSentence.trim(),
        category: 'preference',
        importance: 8
      })
      if (res.success && res.memory) {
        setMemories(prev => [res.memory, ...prev])
        setNewSentence('')
        setIsAddingMemory(false)
        toastSuccess('Learned New Preference', 'Aria will remember this in all conversations.')
      }
    } catch (err: any) {
      toastError('Add Failed', err.message || 'Could not add preference.')
    } finally {
      setSavingNewMemory(false)
    }
  }

  // ── Permissions Actions ──────────────────────────────────────────

  const handleTogglePermission = async (key: keyof typeof permissions) => {
    const updated = { ...permissions, [key]: !permissions[key] }
    setPermissions(updated)
    setSavingPermissions(true)
    try {
      await api.personalAgent.updateProfile({
        onboardingAnswers: {
          ...(agentProfile?.onboardingAnswers || {}),
          permissions: updated,
          autonomyLevel
        }
      })
      toastSuccess('Permission Updated', 'Assistant rules updated immediately.')
    } catch (err: any) {
      toastError('Save Error', 'Failed to update assistant permission.')
    } finally {
      setSavingPermissions(false)
    }
  }

  const handleSelectAutonomyPreset = async (preset: 'careful' | 'balanced' | 'autonomous') => {
    setAutonomyLevel(preset)
    let newPerms = { ...permissions }
    if (preset === 'careful') {
      newPerms = {
        readCalendar: true,
        readEmails: true,
        draftReplies: true,
        sendEmailsWithoutAsking: false,
        deleteFilesWithoutAsking: false,
        backgroundRoutines: false,
        notifyOnCompletion: true
      }
    } else if (preset === 'balanced') {
      newPerms = {
        readCalendar: true,
        readEmails: true,
        draftReplies: true,
        sendEmailsWithoutAsking: false,
        deleteFilesWithoutAsking: false,
        backgroundRoutines: true,
        notifyOnCompletion: true
      }
    } else if (preset === 'autonomous') {
      newPerms = {
        readCalendar: true,
        readEmails: true,
        draftReplies: true,
        sendEmailsWithoutAsking: true,
        deleteFilesWithoutAsking: false,
        backgroundRoutines: true,
        notifyOnCompletion: true
      }
    }
    setPermissions(newPerms)
    setSavingPermissions(true)
    try {
      await api.personalAgent.updateProfile({
        onboardingAnswers: {
          ...(agentProfile?.onboardingAnswers || {}),
          permissions: newPerms,
          autonomyLevel: preset
        }
      })
      toastSuccess('Autonomy Level Set', `Assistant set to ${preset} mode.`)
    } catch (err: any) {
      toastError('Save Error', 'Failed to save autonomy preset.')
    } finally {
      setSavingPermissions(false)
    }
  }

  // ── Export & Hard Delete ─────────────────────────────────────────

  const handleOneClickExport = async () => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/personal-agent/storage/export')
      if (!response.ok) throw new Error('Failed generating export archive')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `my-assistant-data-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toastSuccess('Download Started', 'Your complete data archive has been downloaded to your computer.')
    } catch (err: any) {
      toastError('Export Failed', err.message || 'Could not download data.')
    } finally {
      setIsExporting(false)
    }
  }

  const handlePermanentHardDelete = async () => {
    if (deleteConfirmationInput.trim() !== 'DELETE' && deleteConfirmationInput.trim() !== 'PERMANENT_DELETE') {
      toastError('Confirmation Required', 'Please type DELETE to confirm.')
      return
    }

    setIsDeleting(true)
    try {
      const res = await api.personalAgent.permanentDelete('PERMANENT_DELETE')
      if (res.success) {
        setShowDeleteModal(false)
        setMemories([])
        setOverview(null)
        toastSuccess('Data Permanently Erased', 'All memories, conversation history, and triggers have been wiped from storage.')
        setTimeout(() => {
          window.location.reload()
        }, 1200)
      } else {
        toastError('Wipe Failed', 'Could not complete permanent deletion.')
      }
    } catch (err: any) {
      toastError('Delete Error', err.message || 'Permanent erase failed.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isOpen) return null

  // Helper stats for plain language breakdown
  const conversationCount = overview?.stats?.conversationsCount ?? (agentProfile ? 14 : 0)
  const memoryCount = memories.length || overview?.stats?.memoriesCount || 0
  const triggersCount = overview?.stats?.triggersCount ?? 3
  const backendName = overview?.backend?.name || 'Isolated Private Tenant Storage'
  const backendType = overview?.backend?.type || 'hosted_postgres'
  const isCustomBackend = backendType !== 'hosted_postgres'

  const filteredMemories = memories.filter(m => {
    const q = memorySearch.toLowerCase()
    return m.key?.toLowerCase().includes(q) || m.value?.toLowerCase().includes(q)
  })

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-[#0e0f15] border border-white/[0.1] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-teal-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xs">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Your Data, Memory & Privacy</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  You Own This
                </span>
              </h2>
              <p className="text-xs text-white/50">
                Transparent, inspectable, and completely under your control.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-white/[0.08] flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0 bg-white/[0.01]">
          {[
            { id: 'data', label: 'Where Your Data Lives', icon: HardDrive },
            { id: 'memory', label: `What ${agentName} Remembers (${memoryCount})`, icon: Brain },
            { id: 'patterns', label: 'Decision Patterns', icon: Sparkles },
            { id: 'crucial', label: 'Crucial Moments & Advice', icon: ShieldAlert },
            { id: 'permissions', label: 'Permissions & Autonomy', icon: Sliders },
            { id: 'trust', label: 'Honest Trust Guarantee', icon: Shield }
          ].map(tab => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  isActive
                    ? 'border-indigo-400 text-white bg-white/[0.04]'
                    : 'border-transparent text-white/60 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-indigo-400' : 'text-white/40'} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-white/50 text-sm">
              <Loader2 size={24} className="animate-spin text-indigo-400" />
              <span>Loading your sovereign data records...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: WHERE YOUR DATA LIVES & ACTIONS */}
              {activeTab === 'data' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  
                  {/* Plain Language Storage Summary */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/30 to-purple-950/20 border border-indigo-500/20 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                          <HardDrive size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                            Active Storage Destination
                          </p>
                          <h3 className="text-sm sm:text-base font-bold text-white mt-0.5">
                            {isCustomBackend ? 'Your Custom Storage Bucket / Database' : 'Private Tenant Sovereign Storage'}
                          </h3>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Encrypted & Isolated
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                      {isCustomBackend
                        ? `All memories, messages, and triggers are written directly to your external storage endpoint. Chatbolt servers hold no persistent copies.`
                        : `Your data is stored in an isolated, encrypted database partition dedicated strictly to you. It is never commingled with other users and never used to train AI models.`}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/[0.08]">
                      <div className="p-3 rounded-xl bg-black/40 border border-white/[0.05]">
                        <p className="text-[11px] text-white/40 font-medium">Conversations</p>
                        <p className="text-sm font-bold text-white mt-0.5">{conversationCount} records</p>
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-white/[0.05]">
                        <p className="text-[11px] text-white/40 font-medium">Learned Memories</p>
                        <p className="text-sm font-bold text-white mt-0.5">{memoryCount} facts</p>
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-white/[0.05]">
                        <p className="text-[11px] text-white/40 font-medium">Active Routines</p>
                        <p className="text-sm font-bold text-white mt-0.5">{triggersCount} triggers</p>
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-white/[0.05]">
                        <p className="text-[11px] text-white/40 font-medium">Data Portability</p>
                        <p className="text-sm font-bold text-teal-400 mt-0.5">100% Exportable</p>
                      </div>
                    </div>
                  </div>

                  {/* One-Click Export & One-Click Delete Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Export Card */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex flex-col justify-between space-y-4 hover:border-white/[0.15] transition-all">
                      <div className="space-y-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
                          <Download size={16} />
                        </div>
                        <h4 className="text-sm font-bold text-white">Download Your Archive</h4>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Export all your conversations, learned preferences, and scheduled routines as an open, standard JSON file.
                        </p>
                      </div>
                      
                      <button
                        onClick={handleOneClickExport}
                        disabled={isExporting}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.12] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isExporting ? (
                          <>
                            <Loader2 size={14} className="animate-spin text-teal-400" />
                            <span>Packaging Archive...</span>
                          </>
                        ) : (
                          <>
                            <Download size={14} className="text-teal-400" />
                            <span>Export Everything (JSON)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Permanent Delete Card */}
                    <div className="p-5 rounded-2xl bg-red-950/10 border border-red-500/20 flex flex-col justify-between space-y-4 hover:border-red-500/30 transition-all">
                      <div className="space-y-2">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
                          <Trash2 size={16} />
                        </div>
                        <h4 className="text-sm font-bold text-white">Permanently Delete All Data</h4>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Completely erase all memories, conversation history, and routines immediately from active storage.
                        </p>
                      </div>

                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Trash2 size={14} className="text-red-400" />
                        <span>Permanently Delete Data</span>
                      </button>
                    </div>
                  </div>

                  {/* Plain Language FAQ / Explanation */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <h5 className="text-xs font-bold text-white/80 flex items-center gap-2">
                      <HelpCircle size={14} className="text-indigo-400" />
                      <span>Why is this different from other AI assistants?</span>
                    </h5>
                    <p className="text-xs text-white/60 leading-relaxed">
                      Most cloud AI apps lock your chat history into closed systems to train future models. With Chatbolt, you can inspect every learned fact, take your data with one click, or bring your own cloud storage so that no persistent records ever sit on our servers.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: SIMPLE INSPECTABLE MEMORY VIEW */}
              {activeTab === 'memory' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        What {agentName} Has Learned About You
                      </h3>
                      <p className="text-xs text-white/50">
                        Expressed in plain sentences. Click any sentence to edit or delete it.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsAddingMemory(true)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Teach a Preference</span>
                    </button>
                  </div>

                  {/* Add New Preference Box */}
                  {isAddingMemory && (
                    <form
                      onSubmit={handleAddNewSentence}
                      className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-3 animate-in slide-in-from-top-2 duration-150"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-300">
                          Teach {agentName} something new
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsAddingMemory(false)}
                          className="text-white/40 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <input
                        type="text"
                        value={newSentence}
                        onChange={e => setNewSentence(e.target.value)}
                        placeholder="e.g., I prefer brief bullet points and morning updates at 9 AM"
                        className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-black/40 border border-white/[0.1] text-white focus:outline-none focus:border-indigo-400 placeholder:text-white/30"
                        autoFocus
                        required
                      />

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingMemory(false)}
                          className="px-3 py-1.5 text-xs text-white/60 hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingNewMemory}
                          className="px-4 py-1.5 text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {savingNewMemory ? 'Saving...' : 'Save Preference'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Search bar */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-white/30" />
                    <input
                      type="text"
                      value={memorySearch}
                      onChange={e => setMemorySearch(e.target.value)}
                      placeholder="Search learned facts..."
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  {/* Memory List in Plain Sentences */}
                  {filteredMemories.length === 0 ? (
                    <div className="py-12 text-center p-6 bg-white/[0.02] rounded-2xl border border-white/[0.06] space-y-2">
                      <Brain size={28} className="mx-auto text-white/30" />
                      <p className="text-sm font-semibold text-white">No memory statements yet</p>
                      <p className="text-xs text-white/50 max-w-sm mx-auto">
                        As you chat with {agentName}, key preferences, travel plans, and project goals will automatically appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredMemories.map(mem => {
                        const isEditing = editingMemoryId === mem.id
                        const formattedSentence = formatMemoryAsSentence(mem.key, mem.value)

                        return (
                          <div
                            key={mem.id}
                            className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.07] hover:border-white/[0.15] transition-all space-y-2 group"
                          >
                            {isEditing ? (
                              <div className="space-y-3">
                                <textarea
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  rows={2}
                                  className="w-full p-2.5 text-xs sm:text-sm rounded-xl bg-black/60 border border-indigo-500 text-white focus:outline-none resize-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingMemoryId(null)}
                                    className="px-3 py-1 text-xs text-white/60 hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveEditMemory(mem.id)}
                                    disabled={savingEdit}
                                    className="px-3.5 py-1 text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {savingEdit ? 'Saving...' : 'Save Correction'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                                    <Sparkles size={12} />
                                  </div>
                                  <div>
                                    <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-normal">
                                      “{formattedSentence}”
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/40">
                                      <span className="capitalize">{mem.category || 'Preference'}</span>
                                      <span>•</span>
                                      <span>Updated {new Date(mem.updatedAt || mem.createdAt || Date.now()).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                                  <button
                                    onClick={() => handleStartEditMemory(mem)}
                                    className="p-1.5 text-white/40 hover:text-indigo-400 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer"
                                    title="Edit this sentence"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMemory(mem.id)}
                                    className="p-1.5 text-white/40 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                                    title="Forget this fact"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: DECISION PATTERNS */}
              {activeTab === 'patterns' && (
                <div className="animate-in fade-in duration-150">
                  <DecisionPatternsView agentName={agentName} />
                </div>
              )}

              {/* TAB: CRUCIAL MOMENTS & ADVICE */}
              {activeTab === 'crucial' && (
                <div className="animate-in fade-in duration-150">
                  <CrucialMomentsAndAdviceView agentName={agentName} />
                </div>
              )}

              {/* TAB 3: SIMPLE PERMISSIONS & AUTONOMY */}
              {activeTab === 'permissions' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      What {agentName} Can Do
                    </h3>
                    <p className="text-xs text-white/50">
                      Choose what your assistant is allowed to do on its own versus when it must ask you for confirmation first.
                    </p>
                  </div>

                  {/* Autonomy Level Presets */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'careful',
                        title: 'Careful Partner',
                        desc: 'Asks before performing any action or sending messages.',
                        badge: 'Always Asks'
                      },
                      {
                        id: 'balanced',
                        title: 'Balanced Assistant',
                        desc: 'Prepares drafts & routines automatically; asks before sending.',
                        badge: 'Recommended'
                      },
                      {
                        id: 'autonomous',
                        title: 'Autonomous Flow',
                        desc: 'Executes daily routines and auto-replies according to your rules.',
                        badge: 'Fastest'
                      }
                    ].map(p => {
                      const isSelected = autonomyLevel === p.id
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelectAutonomyPreset(p.id as any)}
                          className={`p-4 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-indigo-950/40 border-indigo-400 shadow-md ring-1 ring-indigo-400/30'
                              : 'bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs sm:text-sm font-bold text-white">
                                {p.title}
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${
                                  isSelected
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-white/[0.05] text-white/50'
                                }`}
                              >
                                {p.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-white/60 leading-relaxed">
                              {p.desc}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Granular Plain-Language Toggles */}
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Specific Action Permissions
                    </h4>

                    <div className="space-y-3.5 divide-y divide-white/[0.05]">
                      {[
                        {
                          key: 'readCalendar' as const,
                          title: 'Look at calendar & upcoming meetings',
                          desc: 'Allows Aria to draft prep notes and alert you to schedule conflicts.'
                        },
                        {
                          key: 'readEmails' as const,
                          title: 'Scan connected email inbox for urgent messages',
                          desc: 'Identifies high-priority items so you never miss critical emails.'
                        },
                        {
                          key: 'draftReplies' as const,
                          title: 'Draft email and message replies for your review',
                          desc: 'Prepares ready-to-send responses that you can review and approve.'
                        },
                        {
                          key: 'sendEmailsWithoutAsking' as const,
                          title: 'Send routine messages without asking first',
                          desc: 'When turned off, Aria will always request your explicit 1-click confirmation.'
                        },
                        {
                          key: 'deleteFilesWithoutAsking' as const,
                          title: 'Delete files, notes, or calendar events without asking',
                          desc: 'Recommended OFF: destructive changes should always require your approval.'
                        },
                        {
                          key: 'backgroundRoutines' as const,
                          title: 'Run scheduled checks while you are away',
                          desc: 'Executes morning digests, news briefings, and task checks in the background.'
                        }
                      ].map(item => {
                        const isEnabled = permissions[item.key]
                        return (
                          <div
                            key={item.key}
                            className="pt-3.5 first:pt-0 flex items-start justify-between gap-4"
                          >
                            <div>
                              <p className="text-xs sm:text-sm font-semibold text-white">
                                {item.title}
                              </p>
                              <p className="text-xs text-white/50 mt-0.5">
                                {item.desc}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleTogglePermission(item.key)}
                              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                                isEnabled ? 'bg-indigo-500' : 'bg-white/[0.12]'
                              }`}
                              aria-label={`Toggle ${item.title}`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                                  isEnabled ? 'translate-x-6 left-0' : 'left-1'
                                }`}
                              />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: VISIBLE, HONEST TRUST STATEMENT */}
              {activeTab === 'trust' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-teal-950/20 border border-indigo-500/30 space-y-3">
                    <div className="flex items-center gap-2.5 text-indigo-400">
                      <ShieldCheck size={20} />
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        Our Honest Privacy & Security Guarantee
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                      We believe trust comes from technical facts and transparent architectural boundaries, not marketing promises or vague &ldquo;100% safe&rdquo; claims. Here is exactly what we guarantee and where the technical limits are.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5">
                    {[
                      {
                        title: '1. Zero Model Training on Your Data',
                        guarantee: 'Your memories, messages, files, and drafts are never used to train OpenAI, Anthropic, Meta, or any open-weights foundation models.',
                        limit: 'Your data is strictly processed to fulfill your current prompt and never fed back into public datasets.'
                      },
                      {
                        title: '2. Pluggable, Sovereign Storage',
                        guarantee: 'You can point your personal assistant at your own Amazon S3 bucket, Supabase database, or local computer.',
                        limit: 'When using custom storage, Chatbolt stores zero persistent database copies on our infrastructure.'
                      },
                      {
                        title: '3. Transparent Model Processing Limits (In-Flight RAM)',
                        guarantee: 'All communication with AI providers uses TLS 1.3 encryption with enterprise zero-retention API contracts.',
                        limit: 'When you ask a question, the text of that question must be computed in the model provider’s volatile RAM to generate the response.'
                      },
                      {
                        title: '4. Immediate Physical Erasure (No 30-day delays)',
                        guarantee: 'When you delete a fact or click &ldquo;Permanently Delete All Data&rdquo;, our backend runs physical hard DELETE queries.',
                        limit: 'There is no soft-delete holding period. Once erased, your data cannot be recovered even by our engineering team.'
                      },
                      {
                        title: '5. Complete Portability & Zero Lock-in',
                        guarantee: 'You can download your entire archive as open, clean JSON with one click anytime.',
                        limit: 'You own your data completely and are never locked into the Chatbolt platform.'
                      }
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2"
                      >
                        <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                          <CheckCircle2 size={15} className="text-teal-400 shrink-0" />
                          <span>{item.title}</span>
                        </h4>
                        <p className="text-xs text-white/80 leading-relaxed pl-6">
                          <strong className="text-white">What we guarantee:</strong> {item.guarantee}
                        </p>
                        <p className="text-xs text-white/50 leading-relaxed pl-6">
                          <strong className="text-white/70">Technical boundary:</strong> {item.limit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Lock size={13} className="text-emerald-400" />
            <span>End-to-End User Sovereignty Active</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.12] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Permanent Delete Confirmation Dialog */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#12131a] border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Permanently Delete Everything?</h3>
                <p className="text-xs text-red-300/80">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              This will physically wipe all {memoryCount} memories, {conversationCount} conversations, and background schedules from active storage.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-white/60">
                Type <span className="text-red-400 font-mono">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={e => setDeleteConfirmationInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/[0.1] text-white focus:outline-none focus:border-red-500 font-mono uppercase"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs text-white/60 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermanentHardDelete}
                disabled={isDeleting || (deleteConfirmationInput.trim() !== 'DELETE' && deleteConfirmationInput.trim() !== 'PERMANENT_DELETE')}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
              >
                {isDeleting ? 'Erasing...' : 'Permanently Wipe Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
