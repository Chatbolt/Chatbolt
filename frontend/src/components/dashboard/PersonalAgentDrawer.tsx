'use client'

import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  Bot,
  Brain,
  X,
  Edit2,
  Trash2,
  Plus,
  Check,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  User,
  Zap,
  Sliders,
  Calendar,
  Layers,
  Search,
  Filter,
  AlertCircle,
  Loader2,
  CheckCircle2,
  HardDrive,
  Clock
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import DataSovereigntyModal from './DataSovereigntyModal'
import BackgroundDigestModal from './BackgroundDigestModal'
import YourDataAndPrivacyModal from './YourDataAndPrivacyModal'

interface PersonalAgentDrawerProps {
  isOpen: boolean
  onClose: () => void
  onOpenOnboarding: () => void
  agent: any
  onAgentUpdated: (agent: any) => void
}

type TabType = 'overview' | 'memory' | 'delegations'

export default function PersonalAgentDrawer({
  isOpen,
  onClose,
  onOpenOnboarding,
  agent,
  onAgentUpdated
}: PersonalAgentDrawerProps) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [memories, setMemories] = useState<any[]>([])
  const [loadingMemories, setLoadingMemories] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showSovereigntyModal, setShowSovereigntyModal] = useState(false)
  const [showDigestModal, setShowDigestModal] = useState(false)
  const [showYourDataModal, setShowYourDataModal] = useState(false)
  const [yourDataTab, setYourDataTab] = useState<'data' | 'memory' | 'permissions' | 'trust'>('data')

  // Edit memory state
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Add memory state
  const [isAddingMemory, setIsAddingMemory] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newCategory, setNewCategory] = useState('preference')
  const [savingNew, setSavingNew] = useState(false)

  // Load memories whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      loadMemories()
    }
  }, [isOpen])

  const loadMemories = async () => {
    setLoadingMemories(true)
    try {
      const res = await api.personalAgent.getMemories()
      if (res.success) {
        setMemories(res.memories || [])
      }
    } catch (err: any) {
      console.warn('Failed to load personal agent memories:', err)
    } finally {
      setLoadingMemories(false)
    }
  }

  const handleStartEdit = (mem: any) => {
    setEditingMemoryId(mem.id)
    setEditValue(mem.value)
  }

  const handleSaveEdit = async (id: string) => {
    if (!editValue.trim()) return
    setSavingEdit(true)
    try {
      const res = await api.personalAgent.updateMemory(id, { value: editValue.trim() })
      if (res.success && res.memory) {
        setMemories(prev => prev.map(m => (m.id === id ? res.memory : m)))
        setEditingMemoryId(null)
        toastSuccess('Memory Corrected', 'Updated fact in assistant knowledge.')
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
        toastSuccess('Memory Removed', 'Fact removed from persistent context.')
      }
    } catch (err: any) {
      toastError('Delete Failed', err.message || 'Could not delete fact.')
    }
  }

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKey.trim() || !newValue.trim()) return
    setSavingNew(true)
    try {
      const res = await api.personalAgent.addMemory({
        key: newKey.trim(),
        value: newValue.trim(),
        category: newCategory,
        importance: 8
      })
      if (res.success && res.memory) {
        setMemories(prev => [res.memory, ...prev])
        setNewKey('')
        setNewValue('')
        setIsAddingMemory(false)
        toastSuccess('Memory Added', 'Assistant will now remember this preference.')
      }
    } catch (err: any) {
      toastError('Add Failed', err.message || 'Could not save new memory.')
    } finally {
      setSavingNew(false)
    }
  }

  if (!isOpen) return null

  const filteredMemories = memories.filter(m => {
    const matchesSearch =
      m.key?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.value?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCat = selectedCategory === 'all' || m.category === selectedCategory
    return matchesSearch && matchesCat
  })

  const agentName = agent?.name || 'Aria'
  const agentTone = agent?.persona?.tone || 'thoughtful'
  const runningSummary = agent?.runningSummary || 'Learning your workflow patterns, tech preferences, and ongoing goals.'
  const createdDate = agent?.createdAt ? new Date(agent.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-surface border-l border-border h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-border bg-surface-subtle shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-action-primary flex items-center justify-center text-white shadow-xs">
                <Sparkles size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-primary tracking-tight">
                    {agentName}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Personal Assistant
                  </span>
                </div>
                <p className="text-xs text-muted flex items-center gap-2 mt-0.5">
                  <span>Companion since {createdDate}</span>
                  <span>•</span>
                  <span className="capitalize">{agentTone} tone</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowDigestModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-md transition-colors cursor-pointer"
                title="View background tasks, approvals & executive digest"
              >
                <Clock size={12} />
                <span>What Did {agentName} Do?</span>
              </button>
              <button
                onClick={() => {
                  setYourDataTab('data')
                  setShowYourDataModal(true)
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-md transition-colors cursor-pointer"
                title="Inspect Data Sovereignty, Storage, Export & Trust"
              >
                <HardDrive size={12} />
                <span>Your Data & Privacy</span>
              </button>
              <button
                onClick={onOpenOnboarding}
                className="px-2.5 py-1 text-xs font-medium text-secondary hover:text-primary rounded-md border border-border hover:bg-surface transition-colors cursor-pointer"
                title="Edit Assistant Context"
              >
                Customize
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-secondary hover:text-primary rounded-md hover:bg-surface transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border-subtle">
            {[
              { id: 'overview', label: 'Identity & Context', icon: User },
              { id: 'memory', label: `Inspectable Memory (${memories.length})`, icon: Brain },
              { id: 'delegations', label: 'Specialist Delegation', icon: Layers }
            ].map(tab => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-action-primary text-white shadow-xs'
                      : 'text-secondary hover:text-primary hover:bg-surface'
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* TAB 1: OVERVIEW & RUNNING SUMMARY */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Running Summary Card */}
              <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain size={15} className="text-action-primary" />
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                      Running User Understanding
                    </h3>
                  </div>
                  <span className="text-[10px] text-muted">Auto-accumulated</span>
                </div>
                <p className="text-xs text-secondary leading-relaxed bg-surface p-3 rounded-lg border border-border-subtle">
                  {runningSummary}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                  <span>Persisted indefinitely across sessions & devices</span>
                  <button
                    onClick={() => setActiveTab('memory')}
                    className="text-action-primary hover:underline font-medium cursor-pointer"
                  >
                    View learned facts →
                  </button>
                </div>
              </div>

              {/* Core Attributes */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                  Personal Assistant Identity
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-surface border border-border">
                    <p className="text-[10px] text-muted font-medium">Assigned Name</p>
                    <p className="text-xs font-bold text-primary mt-0.5">{agentName}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-border">
                    <p className="text-[10px] text-muted font-medium">Primary Role</p>
                    <p className="text-xs font-bold text-primary mt-0.5">Continuous Orchestrator</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-border">
                    <p className="text-[10px] text-muted font-medium">Preferred Model</p>
                    <p className="text-xs font-bold text-primary mt-0.5">{agent?.preferredModel || 'GPT-4o'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-border">
                    <p className="text-[10px] text-muted font-medium">Domain Focus</p>
                    <p className="text-xs font-bold text-primary mt-0.5 truncate">{agent?.onboardingAnswers?.userRole || 'Engineering Architecture'}</p>
                  </div>
                </div>
              </div>

              {/* Goals & Initial Notes */}
              {agent?.onboardingAnswers?.primaryGoals && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                    Active Goals & Priorities
                  </h4>
                  <div className="space-y-1.5">
                    {agent.onboardingAnswers.primaryGoals.map((g: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-surface border border-border text-xs text-secondary">
                        <CheckCircle2 size={13} className="text-signal-green shrink-0" />
                        <span>{g}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INSPECTABLE & CORRECTABLE MEMORY */}
          {activeTab === 'memory' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-primary">
                    Inspectable & Correctable Memory
                  </h3>
                  <p className="text-[11px] text-muted">
                    Facts and preferences learned by {agentName}. Edit or delete any entry to correct its understanding.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddingMemory(!isAddingMemory)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-action-primary text-white rounded-md hover:bg-action-primary-hover transition-colors cursor-pointer shadow-xs"
                >
                  <Plus size={13} />
                  Teach Fact
                </button>
              </div>

              {/* Add New Memory Form */}
              {isAddingMemory && (
                <form onSubmit={handleAddMemory} className="p-4 rounded-xl bg-surface-subtle border border-border space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">Teach New Fact / Preference</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingMemory(false)}
                      className="text-muted hover:text-primary"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newKey}
                      onChange={e => setNewKey(e.target.value)}
                      placeholder="Fact Key (e.g. preferred_database)"
                      className="px-2.5 py-1.5 text-xs rounded bg-surface border border-border text-primary focus:outline-none focus:border-action-primary"
                      required
                    />
                    <select
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded bg-surface border border-border text-primary focus:outline-none focus:border-action-primary"
                    >
                      <option value="preference">Preference</option>
                      <option value="fact">Fact</option>
                      <option value="goal">Goal</option>
                      <option value="decision">Decision</option>
                      <option value="workflow">Workflow</option>
                    </select>
                  </div>
                  <textarea
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    rows={2}
                    placeholder="Fact description or value (e.g. Always use PostgreSQL with indexed foreign keys)"
                    className="w-full px-2.5 py-1.5 text-xs rounded bg-surface border border-border text-primary focus:outline-none focus:border-action-primary resize-none"
                    required
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingMemory(false)}
                      className="px-3 py-1 text-xs text-secondary hover:text-primary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingNew}
                      className="px-3 py-1 text-xs font-semibold bg-action-primary text-white rounded hover:bg-action-primary-hover disabled:opacity-50"
                    >
                      {savingNew ? 'Saving...' : 'Save to Memory'}
                    </button>
                  </div>
                </form>
              )}

              {/* Filters & Search */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Filter memories..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-surface-subtle border border-border text-primary focus:outline-none focus:border-action-primary"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-md bg-surface-subtle border border-border text-primary focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="preference">Preferences</option>
                  <option value="fact">Facts</option>
                  <option value="goal">Goals</option>
                  <option value="decision">Decisions</option>
                </select>
              </div>

              {/* Memories List */}
              {loadingMemories ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted">
                  <Loader2 size={15} className="animate-spin text-action-primary" />
                  <span>Loading persistent memory index...</span>
                </div>
              ) : filteredMemories.length === 0 ? (
                <div className="py-8 text-center p-6 bg-surface-subtle rounded-xl border border-border">
                  <Brain size={24} className="mx-auto text-muted mb-2" />
                  <p className="text-xs font-semibold text-primary">No memories match your filter</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {agentName} learns as you chat and execute tasks together.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredMemories.map(mem => {
                    const isEditing = editingMemoryId === mem.id
                    return (
                      <div
                        key={mem.id}
                        className="p-3.5 rounded-xl bg-surface border border-border shadow-xs hover:border-border-strong transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold font-mono text-primary">
                              {mem.key}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-subtle border border-border uppercase text-secondary">
                              {mem.category}
                            </span>
                            {mem.isUserCorrected && (
                              <span className="px-1.5 py-0.2 text-[9px] font-semibold rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                <Check size={10} /> User Corrected
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {!isEditing && (
                              <>
                                <button
                                  onClick={() => handleStartEdit(mem)}
                                  className="p-1 text-secondary hover:text-primary rounded hover:bg-surface-subtle transition-colors cursor-pointer"
                                  title="Edit fact"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteMemory(mem.id)}
                                  className="p-1 text-secondary hover:text-rose-500 rounded hover:bg-surface-subtle transition-colors cursor-pointer"
                                  title="Delete fact"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Memory value / edit form */}
                        {isEditing ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              rows={2}
                              className="w-full p-2 text-xs rounded bg-surface-subtle border border-action-primary text-primary focus:outline-none resize-none"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingMemoryId(null)}
                                className="px-2 py-1 text-xs text-secondary hover:text-primary"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(mem.id)}
                                disabled={savingEdit}
                                className="px-2.5 py-1 text-xs font-semibold bg-action-primary text-white rounded hover:bg-action-primary-hover disabled:opacity-50"
                              >
                                {savingEdit ? 'Saving...' : 'Update Fact'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-secondary leading-relaxed">
                            {mem.value}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-muted pt-1 border-t border-border-subtle">
                          <span>Source: {mem.source || 'Inferred from interaction'}</span>
                          <span>Importance: {mem.importance || 8}/10</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLEAN WORKFORCE DELEGATION */}
          {activeTab === 'delegations' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-signal-green" />
                  <h3 className="text-xs font-bold text-primary">
                    Architectural Separation of Concerns
                  </h3>
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  <strong>{agentName}</strong> is your dedicated personal orchestrator and continuous point of contact. To prevent system bloating into a giant monolithic agent, actual heavy execution is dispatched to specialized team agents.
                </p>
              </div>

              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                Specialist Workforce Roster (Adapted for Personal Tasks)
              </h4>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  { role: 'code', name: 'Code & Technical Specialist', desc: 'Debug scripts, write functions, regex, queries, and sandbox verification', icon: '💻', model: 'gpt-4o' },
                  { role: 'researcher', name: 'Deep Research & Web Intelligence', desc: 'Travel research, comparison shopping, docs, and factual synthesis', icon: '🔍', model: 'gpt-4o' },
                  { role: 'writer', name: 'Editorial & Communications', desc: 'Draft emails, trip itineraries, letters, and structured documents', icon: '✍️', model: 'gpt-4o' },
                  { role: 'data_processor', name: 'Data & Financial Analyst', desc: 'Calculate budgets, currency conversions, math, and CSV tables', icon: '📊', model: 'gpt-4o' },
                  { role: 'calendar', name: 'Calendar & Scheduling', desc: 'Coordinate time slots, agenda prep, and conflict detection', icon: '📅', model: 'gpt-4o' },
                  { role: 'planner', name: 'Strategic Planner', desc: 'Personal DAG decomposition, milestone roadmaps, and workflows', icon: '🧭', model: 'gpt-4o' }
                ].map(spec => (
                  <div key={spec.role} className="p-3 rounded-lg bg-surface border border-border flex items-center justify-between hover:border-border-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{spec.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-primary">{spec.name}</p>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            Handoff-Ready
                          </span>
                        </div>
                        <p className="text-[11px] text-muted">{spec.desc}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-surface-subtle border border-border text-secondary shrink-0">
                      {spec.model}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-subtle shrink-0 flex items-center justify-between text-xs text-muted">
          <span>Single Persistent Identity (Supabase synced)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSovereigntyModal(true)}
              className="text-xs text-action-primary hover:underline font-medium cursor-pointer"
            >
              Storage Settings
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold bg-surface border border-border hover:bg-surface-subtle text-primary rounded-md transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Sovereign Storage & Where Is My Data Modal */}
      <DataSovereigntyModal
        isOpen={showSovereigntyModal}
        onClose={() => setShowSovereigntyModal(false)}
        agentName={agentName}
      />

      {/* Non-Technical Inspectable "Your Data, Memory & Privacy" Modal */}
      <YourDataAndPrivacyModal
        isOpen={showYourDataModal}
        onClose={() => setShowYourDataModal(false)}
        agentName={agentName}
        initialTab={yourDataTab}
      />
    </div>
  )
}
