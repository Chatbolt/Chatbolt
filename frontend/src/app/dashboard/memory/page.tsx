'use client'
import { useState, useEffect } from 'react'
import {
  Brain, Trash2, Loader2, Shield, Search, User, Briefcase, MapPin,
  Star, Zap, Edit2, Check, X, ChevronDown, ChevronRight, Lock,
  RefreshCw, Database, Sparkles, Filter, CheckCircle2, ShieldCheck, HardDrive
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import DataSovereigntyModal from '@/components/dashboard/DataSovereigntyModal'

type Fact = { id: string; key: string; value: string; category: string; importance?: number; confidence?: number; source?: string; created_at: string; updated_at?: string }
type Skill = { id: string; key: string; task: string; quality: string; confidence: number; learned_at: string }
type ProfileEntry = { key: string; label: string; icon: any; value?: string }

type Tab = 'Facts' | 'Skills' | 'Profile'

const PROFILE_FIELDS: Omit<ProfileEntry, 'value'>[] = [
  { key: 'user_name',   label: 'Name',       icon: User },
  { key: 'company',     label: 'Company',     icon: Briefcase },
  { key: 'role',        label: 'Role',        icon: Star },
  { key: 'location',    label: 'Location',    icon: MapPin },
  { key: 'preference',  label: 'Preference',  icon: Zap },
]

function catColor(cat: string) {
  const m: Record<string, string> = {
    preference: 'bg-sky-50 text-sky-800 border-sky-200',
    skill:      'bg-indigo-50 text-indigo-800 border-indigo-200',
    person:     'bg-emerald-50 text-emerald-800 border-emerald-200',
    entity:     'bg-amber-50 text-amber-800 border-amber-200',
    pattern:    'bg-purple-50 text-purple-800 border-purple-200',
    fact:       'bg-gray-100 text-gray-800 border-gray-200',
  }
  return m[cat] || 'bg-gray-100 text-gray-700 border-gray-200'
}

function sourceLabel(source?: string) {
  if (!source) return 'Inferred'
  if (source === 'manual') return 'Set by you'
  if (source === 'auto-learned') return 'Auto-learned'
  if (source === 'task_harvest') return 'Learned from task'
  return source
}

function ConfidenceBar({ value }: { value?: number }) {
  const pct = Math.round((value || 0.8) * 100)
  const barColor = pct >= 80 ? 'bg-emerald-600' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden border border-border/40">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono text-muted w-8 text-right font-medium">{pct}%</span>
    </div>
  )
}

// ── Facts Tab ─────────────────────────────────────────────────────────────────

function FactsTab() {
  const [grouped, setGrouped] = useState<Record<string, Fact[]>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['preference', 'fact']))
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [showSovereigntyModal, setShowSovereigntyModal] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [factsRes, paRes] = await Promise.allSettled([
        api.memory.facts(),
        api.personalAgent.getMemories()
      ])

      const groupedFacts: Record<string, Fact[]> =
        factsRes.status === 'fulfilled' && factsRes.value?.grouped
          ? { ...factsRes.value.grouped }
          : {}

      let runningTotal = factsRes.status === 'fulfilled' ? (factsRes.value?.total || 0) : 0

      if (paRes.status === 'fulfilled' && paRes.value?.memories) {
        for (const mem of paRes.value.memories) {
          const cat = mem.category || 'preference'
          if (!groupedFacts[cat]) groupedFacts[cat] = []
          if (!groupedFacts[cat].some(f => f.id === mem.id || f.key === mem.key)) {
            groupedFacts[cat].push({
              id: mem.id,
              key: mem.key,
              value: mem.value,
              category: cat,
              importance: mem.importance,
              confidence: (mem.importance || 8) / 10,
              source: mem.isUserCorrected ? 'manual' : mem.source || 'personal_agent',
              created_at: mem.createdAt || new Date().toISOString(),
              updated_at: mem.updatedAt
            })
            runningTotal++
          }
        }
      }

      setGrouped(groupedFacts)
      setTotal(runningTotal)
      if (Object.keys(groupedFacts).length > 0) {
        setExpanded(new Set(Object.keys(groupedFacts).slice(0, 4)))
      }
    } catch { /* silently fallback */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const deleteFact = async (id: string, category: string) => {
    try {
      await api.memory.deleteFact(id)
      setGrouped(prev => {
        const updated = { ...prev }
        if (updated[category]) updated[category] = updated[category].filter(f => f.id !== id)
        return updated
      })
      setTotal(t => Math.max(0, t - 1))
      toast({ title: 'Fact removed from memory', type: 'success' })
    } catch {
      toast({ title: 'Could not delete fact', type: 'error' })
    }
  }

  const wipeAll = async () => {
    setWiping(true)
    try {
      await api.memory.wipeAll()
      setGrouped({})
      setTotal(0)
      setConfirmWipe(false)
      toast({ title: 'All memories wiped successfully', type: 'success' })
    } catch {
      toast({ title: 'Could not clear memories', type: 'error' })
    } finally { setWiping(false) }
  }

  const toggleSection = (cat: string) => {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(cat) ? s.delete(cat) : s.add(cat)
      return s
    })
  }

  const filteredGrouped = Object.entries(grouped).reduce<Record<string, Fact[]>>((acc, [cat, facts]) => {
    if (!search) { acc[cat] = facts; return acc }
    const f = facts.filter(f =>
      f.key.toLowerCase().includes(search.toLowerCase()) ||
      f.value.toLowerCase().includes(search.toLowerCase())
    )
    if (f.length) acc[cat] = f
    return acc
  }, {})

  const categories = Object.keys(filteredGrouped)
  const avgConf = total > 0
    ? Math.round(Object.values(grouped).flat().reduce((s, f) => s + (f.confidence || 0.8), 0) / total * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Facts Stored', value: total, helper: 'Active knowledge entries' },
          { label: 'Category Clusters', value: categories.length || Object.keys(grouped).length, helper: 'Structured taxonomies' },
          { label: 'Avg Confidence Score', value: total ? `${avgConf}%` : '—', helper: 'Validated accuracy baseline' },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-lg p-4 shadow-xs">
            <p className="text-2xl font-bold font-mono tracking-tight text-primary">{s.value}</p>
            <p className="text-xs font-medium text-primary mt-1">{s.label}</p>
            <p className="text-[11px] text-muted">{s.helper}</p>
          </div>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter facts by keyword or property..."
            className="w-full bg-surface border border-border rounded-md pl-9 pr-4 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-action-primary/20 shadow-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSovereigntyModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 rounded-md text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            title="Inspect Data Sovereignty, Pluggable Storage & Export"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Where is my data?</span>
          </button>
          <button
            onClick={load}
            className="p-2 bg-surface border border-border rounded-md text-secondary hover:text-primary hover:bg-secondary transition-colors shadow-xs cursor-pointer"
            title="Refresh memory store"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setConfirmWipe(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md text-xs font-medium transition-colors shadow-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Wipe Memory Store
          </button>
        </div>
      </div>

      {/* Facts Grouped Accordion */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-surface border border-border rounded-lg p-4 flex flex-col justify-center gap-2">
              <div className="h-3 bg-secondary rounded w-1/4" />
              <div className="h-3 bg-secondary rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted text-center px-4 bg-surface border border-border rounded-lg shadow-xs">
          <div className="w-12 h-12 rounded-lg bg-secondary border border-border flex items-center justify-center text-secondary">
            <Brain className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">No memory facts stored yet</p>
            <p className="text-xs text-muted max-w-sm">
              Chatbolt automatically extracts domain facts, operational constraints, and workflow preferences as your agents run.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => {
            const facts = filteredGrouped[cat]
            const isOpen = expanded.has(cat)
            return (
              <div key={cat} className="bg-surface border border-border rounded-lg overflow-hidden shadow-xs">
                <button
                  onClick={() => toggleSection(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-secondary/60 transition-colors border-b border-border/60 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium uppercase tracking-wider text-[10px] ${catColor(cat)}`}>
                      {cat}
                    </span>
                    <span className="text-xs text-muted font-medium">{facts.length} {facts.length === 1 ? 'record' : 'records'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <span className="text-xs">{isOpen ? 'Collapse' : 'Expand'}</span>
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="divide-y divide-border/60 bg-surface">
                    {facts.map(f => (
                      <div key={f.id} className="px-4 py-3 hover:bg-secondary/40 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-semibold text-primary font-mono bg-secondary px-1.5 py-0.5 rounded border border-border/50">
                                {f.key.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] font-medium text-muted bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">
                                {sourceLabel(f.source)}
                              </span>
                              <span className="text-[10px] text-muted">
                                {new Date(f.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-secondary font-normal leading-relaxed">{f.value}</p>
                            <div className="mt-2.5 max-w-xs">
                              <div className="flex items-center justify-between text-[10px] text-muted mb-0.5">
                                <span>Confidence</span>
                              </div>
                              <ConfidenceBar value={f.confidence} />
                            </div>
                          </div>
                          <button
                            onClick={() => deleteFact(f.id, cat)}
                            className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-md transition-colors shrink-0 cursor-pointer"
                            title="Delete fact"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmWipe && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full shadow-lg">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-primary">Wipe All Agent Memories?</h3>
                <p className="text-xs text-secondary mt-1 leading-relaxed">
                  This action permanently removes all {total} stored knowledge records, learned constraints, and preference tags. Your agents will start with a fresh memory baseline.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmWipe(false)}
                className="px-4 py-2 rounded-md border border-border bg-surface text-secondary hover:bg-secondary text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={wipeAll}
                disabled={wiping}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {wiping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Wipe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Sovereignty & Pluggable Storage Modal */}
      <DataSovereigntyModal
        isOpen={showSovereigntyModal}
        onClose={() => setShowSovereigntyModal(false)}
      />
    </div>
  )
}

// ── Skills Tab ─────────────────────────────────────────────────────────────────

function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.memory.skills()
      .then(res => setSkills(res.skills || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    )
  }

  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted text-center px-4 bg-surface border border-border rounded-lg shadow-xs">
        <div className="w-12 h-12 rounded-lg bg-secondary border border-border flex items-center justify-center text-secondary">
          <Zap className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-primary">No learned skills recorded yet</p>
          <p className="text-xs text-muted max-w-sm">
            When agents execute complex multi-step workflows, successful task execution heuristics are synthesized into reusable skills.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          Autonomous skills synthesized from successful agent runs and execution patterns.
        </p>
        <span className="text-xs font-mono text-secondary font-medium">
          {skills.length} skills active
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {skills.map(s => {
          const pct = Math.round(s.confidence * 100)
          const isExc = s.quality === 'excellent'
          return (
            <div key={s.id} className="bg-surface border border-border rounded-lg p-4 shadow-xs hover:border-border-strong transition-all">
              <div className="flex items-start gap-3.5">
                <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 border ${
                  isExc ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  <Star className="w-4 h-4 fill-current" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-primary capitalize truncate">{s.task}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      isExc ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {isExc ? 'Optimal' : 'Standard'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted">
                    <span>Quality: <span className="font-medium text-primary capitalize">{s.quality}</span></span>
                    <span>Learned {new Date(s.learned_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-3">
                    <ConfidenceBar value={s.confidence} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Profile Tab ────────────────────────────────────────────────────────────────

function ProfileTab() {
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    api.memory.profile()
      .then(res => setProfile(res.profile || {}))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async (key: string) => {
    setSaving(true)
    try {
      await api.memory.setPreference(key, editValue)
      setProfile(prev => ({ ...prev, [key]: editValue }))
      setEditing(null)
      toast({ title: 'Profile parameter updated', type: 'success' })
    } catch {
      toast({ title: 'Could not update profile', type: 'error' })
    } finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile Header Banner */}
      <div className="bg-surface border border-border rounded-lg p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
            <span className="text-xl font-bold font-mono text-primary">
              {(profile['user_name'] || 'U')[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-primary text-base truncate">{profile['user_name'] || 'Operator Account'}</h3>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
            {profile['role'] && profile['company'] ? (
              <p className="text-xs text-secondary mt-0.5">{profile['role']} · {profile['company']}</p>
            ) : (
              <p className="text-xs text-muted mt-0.5">Fleet Operator & System Administrator</p>
            )}
          </div>
        </div>
      </div>

      {/* Fields List */}
      <div className="bg-surface border border-border rounded-lg divide-y divide-border shadow-xs overflow-hidden">
        {PROFILE_FIELDS.map(({ key, label, icon: Icon }) => {
          const value = profile[key]
          const isEditing = editing === key
          return (
            <div key={key} className="px-4 py-3.5 hover:bg-secondary/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-secondary border border-border/60 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted">{label}</p>
                  {isEditing ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') save(key); if (e.key === 'Escape') setEditing(null) }}
                        className="flex-1 bg-surface border border-border-strong rounded-md px-2.5 py-1 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-action-primary/20"
                        placeholder={`Enter ${label.toLowerCase()}...`}
                      />
                      <button
                        onClick={() => save(key)}
                        disabled={saving}
                        className="p-1.5 bg-action-primary text-action-primary-text rounded-md hover:bg-action-primary-hover transition-colors cursor-pointer shadow-xs"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="p-1.5 bg-surface border border-border text-secondary hover:text-primary rounded-md transition-colors cursor-pointer shadow-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className={`text-sm mt-0.5 ${value ? 'text-primary font-medium' : 'text-muted italic'}`}>
                      {value || 'Not configured'}
                    </p>
                  )}
                </div>
                {!isEditing && (
                  <button
                    onClick={() => { setEditing(key); setEditValue(value || '') }}
                    className="p-1.5 text-muted hover:text-primary hover:bg-secondary rounded-md border border-transparent hover:border-border transition-colors cursor-pointer"
                    title={`Edit ${label}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Security Info Card */}
      <div className="flex items-start gap-3 bg-secondary/40 border border-border rounded-lg p-4">
        <ShieldCheck className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
        <p className="text-xs text-secondary leading-relaxed">
          Memory data is partitioned per tenant and strictly scoped to authorized agent tasks. Context injection is evaluated dynamically with zero external telemetry sharing.
        </p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const [tab, setTab] = useState<Tab>('Facts')
  const tabs: Tab[] = ['Facts', 'Skills', 'Profile']

  return (
    <div className="min-h-screen bg-background text-primary">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-medium text-muted uppercase tracking-wider">Storage & Context</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                Encrypted · AES-256
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-primary mt-1">Memory & Persona Engine</h1>
            <p className="text-xs text-secondary mt-1">
              Transparent inspection, categorical fact recall, and learned behavioral models.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center p-1 bg-surface border border-border rounded-lg shadow-xs self-start">
            {tabs.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  tab === t
                    ? 'bg-action-primary text-action-primary-text shadow-xs'
                    : 'text-secondary hover:text-primary hover:bg-secondary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {tab === 'Facts'   && <FactsTab />}
        {tab === 'Skills'  && <SkillsTab />}
        {tab === 'Profile' && <ProfileTab />}
      </div>
    </div>
  )
}
