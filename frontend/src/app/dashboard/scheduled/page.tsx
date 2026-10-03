'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Clock, Plus, Calendar, ArrowRight, CheckCircle2,
  Workflow, Trash2, Loader2, Sparkles, RefreshCw, X, Play,
  ChevronRight, Zap, Pause, AlarmClock, Layers, Bolt,
  Search, ExternalLink, ToggleLeft, ToggleRight
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduledTask = {
  id: string
  workflow_name: string
  workflow_id: string
  cron_expression: string
  is_active: boolean
  last_triggered?: string
  description?: string
}

type WorkflowItem = {
  id: string
  name: string
}

// ─── Cron Humanizer ───────────────────────────────────────────────────────────

function humanizeCron(cron: string): string {
  if (!cron || typeof cron !== 'string') return 'Invalid schedule'
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return `Custom: ${cron}`

  const [minute, hour, dom, month, dow] = parts

  const pad = (n: number) => String(n).padStart(2, '0')
  const fmtTime = (h: string, m: string) => {
    const hNum = parseInt(h, 10)
    const mNum = parseInt(m, 10)
    if (isNaN(hNum) || isNaN(mNum)) return `${h}:${m}`
    const suffix = hNum >= 12 ? 'PM' : 'AM'
    const h12 = hNum % 12 === 0 ? 12 : hNum % 12
    return `${h12}:${pad(mNum)} ${suffix}`
  }

  const DOW_NAMES: Record<string, string> = {
    '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday',
    '4': 'Thursday', '5': 'Friday', '6': 'Saturday',
    'sun': 'Sunday', 'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday',
    'thu': 'Thursday', 'fri': 'Friday', 'sat': 'Saturday',
  }

  const MONTH_NAMES: Record<string, string> = {
    '1': 'January', '2': 'February', '3': 'March', '4': 'April',
    '5': 'May', '6': 'June', '7': 'July', '8': 'August',
    '9': 'September', '10': 'October', '11': 'November', '12': 'December',
  }

  const isNum = (v: string) => /^\d+$/.test(v)
  const isWild = (v: string) => v === '*'

  // Every minute
  if (minute === '*' && hour === '*' && dom === '*' && month === '*' && dow === '*')
    return 'Every minute'

  // Every N minutes
  if (minute.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const n = minute.slice(2)
    return `Every ${n} minutes`
  }

  // Every hour at minute X
  if (isNum(minute) && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return `Every hour at :${pad(parseInt(minute, 10))}`
  }

  // Weekdays (1-5) at specific time
  if (dow === '1-5' && isNum(hour) && isNum(minute) && isWild(dom) && isWild(month)) {
    return `Weekdays at ${fmtTime(hour, minute)}`
  }

  // Mon-Fri
  if (dow === 'mon-fri' && isNum(hour) && isNum(minute) && isWild(dom) && isWild(month)) {
    return `Weekdays at ${fmtTime(hour, minute)}`
  }

  // Every day at specific time
  if (isNum(hour) && isNum(minute) && isWild(dom) && isWild(month) && isWild(dow)) {
    return `Every day at ${fmtTime(hour, minute)}`
  }

  // Specific day of week
  if (isNum(dow) && isNum(hour) && isNum(minute) && isWild(dom) && isWild(month)) {
    const dayName = DOW_NAMES[dow] || `Day ${dow}`
    return `Every ${dayName} at ${fmtTime(hour, minute)}`
  }

  // Named day of week
  if (!isNum(dow) && dow !== '*' && !dow.includes('-') && isNum(hour) && isNum(minute)) {
    const dayName = DOW_NAMES[dow.toLowerCase()] || dow
    return `Every ${dayName} at ${fmtTime(hour, minute)}`
  }

  // Every N hours
  if (hour.startsWith('*/') && minute === '0' && isWild(dom) && isWild(month) && isWild(dow)) {
    const n = hour.slice(2)
    return `Every ${n} hours`
  }

  // Specific day of month
  if (isNum(dom) && isNum(hour) && isNum(minute) && isWild(month) && isWild(dow)) {
    const suffix = parseInt(dom, 10) === 1 ? 'st' : parseInt(dom, 10) === 2 ? 'nd' : parseInt(dom, 10) === 3 ? 'rd' : 'th'
    return `Monthly on the ${dom}${suffix} at ${fmtTime(hour, minute)}`
  }

  // Specific month + dom
  if (isNum(month) && isNum(dom) && isNum(hour) && isNum(minute) && isWild(dow)) {
    return `${MONTH_NAMES[month] || month} ${dom} at ${fmtTime(hour, minute)}`
  }

  return `Custom: ${cron}`
}

// ─── Next-Run Calculator ──────────────────────────────────────────────────────

function getNextRunTimes(cron: string, count: number = 3): Date[] {
  if (!cron || typeof cron !== 'string') return []
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return []

  const [minuteExpr, hourExpr, domExpr, , dowExpr] = parts

  function parseField(expr: string, min: number, max: number): number[] {
    if (expr === '*') {
      const result: number[] = []
      for (let i = min; i <= max; i++) result.push(i)
      return result
    }
    if (expr.startsWith('*/')) {
      const step = parseInt(expr.slice(2), 10)
      if (isNaN(step) || step <= 0) return []
      const result: number[] = []
      for (let i = min; i <= max; i += step) result.push(i)
      return result
    }
    if (expr.includes('-')) {
      const [start, end] = expr.split('-').map(Number)
      const result: number[] = []
      for (let i = start; i <= end; i++) result.push(i)
      return result
    }
    if (expr.includes(',')) {
      return expr.split(',').map(Number).filter(n => n >= min && n <= max)
    }
    const val = parseInt(expr, 10)
    if (!isNaN(val) && val >= min && val <= max) return [val]
    return []
  }

  const validMinutes = parseField(minuteExpr, 0, 59)
  const validHours   = parseField(hourExpr,   0, 23)
  const validDows    = dowExpr === '*' ? null : parseField(dowExpr, 0, 6)
  const validDoms    = domExpr === '*' ? null : parseField(domExpr, 1, 31)

  const results: Date[] = []
  const now = new Date()
  // Start from next minute
  const cursor = new Date(now)
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)

  const maxIterations = 60 * 24 * 366 // search up to a year forward
  let iterations = 0

  while (results.length < count && iterations < maxIterations) {
    iterations++
    const m   = cursor.getMinutes()
    const h   = cursor.getHours()
    const dom = cursor.getDate()
    const dow = cursor.getDay() // 0=Sun

    const minuteOk = validMinutes.includes(m)
    const hourOk   = validHours.includes(h)
    const dowOk    = validDows === null || validDows.includes(dow)
    const domOk    = validDoms === null || validDoms.includes(dom)

    if (minuteOk && hourOk && dowOk && domOk) {
      results.push(new Date(cursor))
      // Advance by 1 minute to find next occurrence
      cursor.setMinutes(cursor.getMinutes() + 1)
    } else if (!minuteOk) {
      // Find next valid minute
      const nextMin = validMinutes.find(v => v > m)
      if (nextMin !== undefined) {
        cursor.setMinutes(nextMin)
      } else {
        // Roll over to next hour
        cursor.setMinutes(validMinutes[0])
        cursor.setHours(cursor.getHours() + 1)
      }
    } else if (!hourOk) {
      // Find next valid hour
      const nextHour = validHours.find(v => v > h)
      if (nextHour !== undefined) {
        cursor.setHours(nextHour)
        cursor.setMinutes(validMinutes[0])
      } else {
        // Roll over to next day
        cursor.setDate(cursor.getDate() + 1)
        cursor.setHours(validHours[0])
        cursor.setMinutes(validMinutes[0])
      }
    } else {
      // day mismatch — advance one day
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(validHours[0])
      cursor.setMinutes(validMinutes[0])
    }
  }

  return results
}

function formatRelative(date: Date): string {
  const now = Date.now()
  const diff = date.getTime() - now
  if (diff <= 0) return 'Now'
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days > 0)  return `in ${days}d ${hours % 24}h`
  if (hours > 0) return `in ${hours}h ${mins % 60}m`
  return `in ${mins}m`
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

// ─── Preset Schedules ─────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Every day at 9 AM',    cron: '0 9 * * *'   },
  { label: 'Weekdays at 8 AM',     cron: '0 8 * * 1-5' },
  { label: 'Every Monday at 9 AM', cron: '0 9 * * 1'   },
]

// ─── Empty State Ideas ────────────────────────────────────────────────────────

const IDEA_ROWS: { text: string; cron: string; description: string }[] = [
  {
    text: 'Set up automated monitoring for any topic, competitor, or keyword.',
    cron: '0 8 * * 1-5',
    description: 'Monitor competitors and keywords every weekday morning',
  },
  {
    text: "Get a daily summary of what's in your inbox before starting your day.",
    cron: '0 7 * * *',
    description: 'Daily inbox summary at 7 AM',
  },
  {
    text: 'Turn any manual, multi-step process into an automated pipeline on schedule.',
    cron: '0 9 * * 1',
    description: 'Weekly automated pipeline run every Monday morning',
  },
]

// ─── Mock seed data ───────────────────────────────────────────────────────────

const MOCK_TASKS: ScheduledTask[] = [
  {
    id: 'sc_1',
    workflow_name: 'Competitor B2B Enrichment Specialist',
    workflow_id: 'wf_mock_1',
    cron_expression: '0 9 * * 1-5',
    is_active: true,
    last_triggered: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    description: 'Runs competitor enrichment every weekday morning',
  },
  {
    id: 'sc_2',
    workflow_name: 'SMTP Email Outreach Sequence Builder',
    workflow_id: 'wf_mock_2',
    cron_expression: '0 10 * * 1-5',
    is_active: true,
    last_triggered: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    description: 'Builds daily outreach sequences weekdays at 10 AM',
  },
]

// ─── Page Component ───────────────────────────────────────────────────────────

type PageTab = 'Scheduled' | 'Templates' | 'Event Triggers'

// ─── Templates Sub-component ─────────────────────────────────────────────────

function TemplatesTab({ workflows, prefillName }: { workflows: WorkflowItem[]; prefillName?: string }) {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(prefillName || '')
  const [category, setCategory] = useState('All')
  const [activating, setActivating] = useState<string | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<Record<string, string>>({})
  const { success, error } = useToast()

  useEffect(() => {
    if (prefillName) {
      setTimeout(() => {
        const el = document.getElementById('template-search-input')
        if (el) el.focus()
      }, 150)
    }
  }, [prefillName])

  useEffect(() => {
    api.automations.templates()
      .then(r => setTemplates(r.templates || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const cats = ['All', ...Array.from(new Set(templates.map(t => t.category)))]

  const filtered = templates.filter(t => {
    const matchCat = category === 'All' || t.category === category
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const activate = async (templateId: string, templateName: string) => {
    const wfId = selectedWorkflow[templateId]
    if (!wfId) { error('Select a process first', 'Choose which process to trigger'); return }
    setActivating(templateId)
    try {
      await api.automations.fromTemplate(templateId, wfId)
      success('Automation activated', `"${templateName}" is now scheduled`)
    } catch (e: any) {
      error('Could not activate', e.message)
    } finally {
      setActivating(null)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input id="template-search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..." className="w-full bg-surface border border-border rounded-md pl-9 pr-4 py-2 text-xs text-primary placeholder-muted focus:outline-none focus:border-signal-blue focus:ring-1 focus:ring-signal-blue shadow-xs" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {cats.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                category === c ? 'bg-action-primary text-action-primary-text shadow-xs' : 'bg-surface text-secondary border border-border hover:bg-subtle hover:text-primary'
              }`}>{c}</button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(t => (
          <div key={t.id} className="bg-surface border border-border rounded-lg p-5 hover:border-signal-blue/40 transition-all shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 border border-border/50" style={{ background: `${t.color}15` }}>
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary">{t.name}</p>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{t.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] text-secondary bg-secondary border border-border px-2 py-0.5 rounded font-mono">{t.cron}</span>
                <span className="text-[11px] text-muted">{humanizeCron(t.cron)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-border/60">
              <select
                value={selectedWorkflow[t.id] || ''}
                onChange={e => setSelectedWorkflow(prev => ({ ...prev, [t.id]: e.target.value }))}
                className="flex-1 bg-surface border border-border rounded-md px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:border-signal-blue cursor-pointer"
              >
                <option value="">— Choose process —</option>
                {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <button
                onClick={() => activate(t.id, t.name)}
                disabled={activating === t.id || !selectedWorkflow[t.id]}
                className="px-3.5 py-1.5 bg-action-primary text-action-primary-text text-xs font-semibold rounded-md hover:bg-action-primary-hover disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {activating === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Activate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Event Triggers Sub-component ────────────────────────────────────────────

function EventTriggersTab({ workflows }: { workflows: WorkflowItem[] }) {
  const [types, setTypes] = useState<any[]>([])
  const [active, setActive] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState('')
  const [selectedWf, setSelectedWf] = useState('')
  const [creating, setCreating] = useState(false)
  const { success, error } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const [typesRes, activeRes] = await Promise.all([
      api.automations.eventTriggerTypes().catch(() => ({ triggers: [] })),
      api.automations.activeEventTriggers().catch(() => ({ rules: [] })),
    ])
    setTypes(typesRes.triggers || [])
    setActive(activeRes.rules || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!selectedType || !selectedWf) return
    setCreating(true)
    try {
      await api.automations.createEventTrigger({ trigger_type: selectedType, workflow_id: selectedWf })
      success('Trigger created', 'Now listening for events')
      setSelectedType('')
      setSelectedWf('')
      await load()
    } catch (e: any) {
      error('Could not create trigger', e.message)
    } finally {
      setCreating(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await api.automations.deleteEventTrigger(id)
      setActive(prev => prev.filter(r => r.id !== id))
    } catch { error('Could not remove trigger') }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
      {/* Trigger type cards */}
      <div>
        <h3 className="text-xs font-bold text-secondary uppercase tracking-wider mb-3">Choose a trigger</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {types.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedType(selectedType === t.id ? '' : t.id)}
              className={`p-4 rounded-lg border text-left transition-all cursor-pointer shadow-xs ${
                selectedType === t.id
                  ? 'border-signal-blue bg-signal-blue-bg ring-1 ring-signal-blue'
                  : 'border-border bg-surface hover:border-border-focus hover:bg-subtle'
              }`}
            >
              <div className="text-2xl mb-2">{t.icon}</div>
              <p className="text-xs font-bold text-primary">{t.name}</p>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Workflow + create */}
      {selectedType && (
        <div className="bg-surface border border-border rounded-lg p-5 flex items-end gap-3 flex-wrap shadow-xs">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-secondary block mb-1.5">Process to trigger</label>
            <select
              value={selectedWf}
              onChange={e => setSelectedWf(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-primary focus:outline-none focus:border-signal-blue cursor-pointer"
            >
              <option value="">— Choose process —</option>
              {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <button
            onClick={create}
            disabled={creating || !selectedWf}
            className="px-5 py-2.5 bg-action-primary text-action-primary-text text-xs font-semibold rounded-md hover:bg-action-primary-hover disabled:opacity-50 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bolt className="w-3.5 h-3.5" />}
            Enable Trigger
          </button>
        </div>
      )}

      {/* Active triggers */}
      {active.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-secondary uppercase tracking-wider mb-3">Active triggers ({active.length})</h3>
          <div className="bg-surface border border-border rounded-lg divide-y divide-border overflow-hidden shadow-xs">
            {active.map(r => (
              <div key={r.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-subtle transition-colors">
                <div className="w-2 h-2 rounded-full bg-signal-green shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary">{r.trigger_type.replace(/_/g, ' ')}</p>
                  <p className="text-[11px] text-muted">{r.workflow_name || 'Linked process'}</p>
                </div>
                <button onClick={() => remove(r.id)} className="p-1.5 text-muted hover:text-signal-red rounded transition-colors cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {active.length === 0 && !selectedType && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted">
          <Bolt className="w-8 h-8 text-muted/60" />
          <p className="text-sm font-semibold text-secondary">No event triggers active</p>
          <p className="text-xs text-muted">Pick a trigger above to get started</p>
        </div>
      )}
    </div>
  )
}

export default function ScheduledPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [activeTab, setActiveTab] = useState<PageTab>('Scheduled')

  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([])
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('')
  const [cronExpression, setCronExpression] = useState('0 9 * * *')
  const [taskDescription, setTaskDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [prefillTemplate, setPrefillTemplate] = useState('')

  // ── Load data ───────────────────────────────────────────────────────────────

  useEffect(() => {
    loadData()
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const prefill = params.get('prefill')
      if (prefill === 'briefing') {
        setActiveTab('Templates')
        setPrefillTemplate('Daily Email Digest')
      }
    }
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const wfRes = await api.workflows.list().catch(() => ({ workflows: [] }))
      setWorkflows(wfRes.workflows || [])
      
      const schedulesRes = await api.schedules.list().catch(() => ({ schedules: [] }))
      setScheduledTasks(schedulesRes.schedules || [])
    } catch (err: any) {
      toastError('Failed to load scheduler', err?.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Modal helpers ────────────────────────────────────────────────────────────

  function openModal(prefillCron?: string, prefillDesc?: string) {
    setCronExpression(prefillCron ?? '0 9 * * *')
    setTaskDescription(prefillDesc ?? '')
    setSelectedWorkflowId('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setSelectedWorkflowId('')
    setCronExpression('0 9 * * *')
    setTaskDescription('')
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedWorkflowId) return
    setSubmitting(true)
    try {
      const selectedWf = workflows.find(w => w.id === selectedWorkflowId)
      const res = await api.schedules.create({
        workflow_id: selectedWorkflowId,
        workflow_name: selectedWf?.name || 'Scheduled Task',
        cron_expression: cronExpression,
        description: taskDescription,
        task_prompt: taskDescription || selectedWf?.name || 'Run workflow',
      })
      const newSchedule = res.schedule
      setScheduledTasks(prev => [...prev, newSchedule])
      toastSuccess('Schedule Created', `Runs: ${humanizeCron(cronExpression)}`)
      closeModal()
    } catch (err: any) {
      toastError('Failed to schedule', err?.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(id: string) {
    const task = scheduledTasks.find(t => t.id === id)
    if (!task) return
    const nextState = !task.is_active
    try {
      await api.schedules.toggle(id, nextState)
      setScheduledTasks(prev =>
        prev.map(t => (t.id === id ? { ...t, is_active: nextState } : t))
      )
      toastSuccess(nextState ? 'Schedule Activated' : 'Schedule Paused')
    } catch (err: any) {
      toastError('Failed to update schedule status', err?.message)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.schedules.delete(id)
      setScheduledTasks(prev => prev.filter(t => t.id !== id))
      toastSuccess('Schedule Removed')
    } catch (err: any) {
      toastError('Failed to remove schedule', err?.message)
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  const totalSchedules  = scheduledTasks.length
  const activeSchedules = scheduledTasks.filter(t => t.is_active).length
  const tasksCompleted  = 247 // mock

  const nextRunDate: Date | null = (() => {
    const runs = scheduledTasks
      .filter(t => t.is_active)
      .flatMap(t => getNextRunTimes(t.cron_expression, 1))
      .sort((a, b) => a.getTime() - b.getTime())
    return runs[0] ?? null
  })()

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background text-primary overflow-y-auto custom-scrollbar font-sans selection:bg-accent/30 relative">

      {/* ── Header ── */}
      <div className="h-14 border-b border-border bg-surface/90 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-1">
          {(['Scheduled', 'Templates', 'Event Triggers'] as PageTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                activeTab === tab
                  ? 'bg-secondary text-primary font-bold shadow-xs'
                  : 'text-muted hover:text-primary hover:bg-subtle'
              }`}
            >
              {tab === 'Scheduled' && <AlarmClock className="inline w-3.5 h-3.5 mr-1 text-signal-blue" />}
              {tab === 'Templates' && <Layers className="inline w-3.5 h-3.5 mr-1 text-signal-amber" />}
              {tab === 'Event Triggers' && <Bolt className="inline w-3.5 h-3.5 mr-1 text-signal-green" />}
              {tab}
            </button>
          ))}
        </div>
        {activeTab === 'Scheduled' && scheduledTasks.length > 0 && (
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-action-primary text-action-primary-text rounded-md text-xs font-semibold hover:bg-action-primary-hover active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <Plus size={13} /> Add Schedule
          </button>
        )}
      </div>

      {activeTab === 'Templates' && <TemplatesTab workflows={workflows} prefillName={prefillTemplate} />}
      {activeTab === 'Event Triggers' && <EventTriggersTab workflows={workflows} />}
      {activeTab === 'Scheduled' && (
        loading ? (
            // ── Loading Skeleton ──
            <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-4 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-surface border border-border rounded-lg p-5 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-md bg-secondary shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-secondary rounded w-[40%]" />
                    <div className="h-3 bg-subtle rounded w-[60%]" />
                  </div>
                </div>
              ))}
            </div>
          ) : scheduledTasks.length === 0 ? (
            // ── Empty State ──
            <div className="flex-grow flex flex-col items-center justify-center px-6 py-16">
              <div className="max-w-xl w-full flex flex-col items-center text-center space-y-6">
                {/* Icon */}
                <div className="w-16 h-16 rounded-xl bg-surface border border-border flex items-center justify-center text-muted shadow-xs">
                  <Clock size={28} className="text-signal-blue" />
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <h1 className="text-xl font-bold text-primary tracking-tight">No automations yet</h1>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    Automate your business tasks on deterministic operational schedules.
                  </p>
                </div>

                {/* Idea rows */}
                <div className="w-full space-y-2">
                  {IDEA_ROWS.map((idea, idx) => (
                    <div
                      key={idx}
                      onClick={() => openModal(idea.cron, idea.description)}
                      className="bg-surface border border-border rounded-lg p-3.5 flex items-center justify-between text-left hover:border-signal-blue/50 hover:bg-subtle cursor-pointer transition-all group shadow-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <Sparkles size={13} className="text-signal-blue mt-0.5 shrink-0" />
                        <span className="text-xs text-secondary font-medium leading-relaxed">{idea.text}</span>
                      </div>
                      <ArrowRight size={13} className="text-muted group-hover:text-signal-blue shrink-0 ml-3 transition-colors" />
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={() => openModal()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-action-primary text-action-primary-text font-semibold text-xs rounded-md hover:bg-action-primary-hover active:scale-95 transition-all shadow-xs cursor-pointer"
                >
                  <Plus size={13} />
                  Create your first automation
                </button>
              </div>
            </div>
        ) : (
          // ── Tasks View ──
          <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-6">

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Schedules', value: String(totalSchedules),  icon: <Calendar size={13} />,     color: 'text-primary' },
                { label: 'Active',          value: String(activeSchedules), icon: <CheckCircle2 size={13} />, color: 'text-signal-green' },
                { label: 'Next Run In',     value: nextRunDate ? formatRelative(nextRunDate) : '—', icon: <Clock size={13} />, color: 'text-signal-blue' },
                { label: 'Tasks Completed', value: String(tasksCompleted),  icon: <Zap size={13} />,          color: 'text-signal-amber' },
              ].map((stat, i) => (
                <div key={i} className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-1.5 shadow-xs">
                  <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${stat.color}`}>
                    {stat.icon}
                    <span>{stat.label}</span>
                  </div>
                  <div className="text-xl font-bold text-primary">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Table card */}
            <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-xs">
              {/* Table header */}
              <div className="px-6 py-3.5 border-b border-border bg-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-signal-blue" />
                  <span className="text-xs font-bold text-primary">Configured Execution Schedules</span>
                </div>
                <button
                  onClick={loadData}
                  className="p-1.5 text-muted hover:text-primary rounded hover:bg-secondary transition-colors cursor-pointer"
                  title="Refresh"
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* Table rows */}
              <div className="divide-y divide-border">
                {scheduledTasks.map(task => {
                  const nextRuns = getNextRunTimes(task.cron_expression, 1)
                  const nextRun  = nextRuns[0] ?? null

                  return (
                    <div key={task.id} className="px-6 py-4 flex items-center gap-4 flex-wrap hover:bg-subtle transition-colors group">
                      {/* Workflow icon + name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-secondary border border-border flex items-center justify-center text-primary shrink-0">
                          <Workflow size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-primary truncate">{task.workflow_name}</div>
                          {task.description && (
                            <div className="text-[11px] text-muted truncate mt-0.5">{task.description}</div>
                          )}
                        </div>
                      </div>

                      {/* Humanized schedule */}
                      <div className="hidden sm:flex flex-col gap-0.5 min-w-[160px]">
                        <div className="text-xs font-medium text-secondary">{humanizeCron(task.cron_expression)}</div>
                        <div className="text-[11px] text-muted font-mono">{task.cron_expression}</div>
                      </div>

                      {/* Next run */}
                      <div className="hidden md:flex flex-col gap-0.5 min-w-[120px]">
                        <div className="text-[10px] text-muted font-semibold">Next Run</div>
                        {nextRun ? (
                          <>
                            <div className="text-xs font-semibold text-signal-blue">{formatRelative(nextRun)}</div>
                            <div className="text-[10px] text-muted">{formatDateTime(nextRun)}</div>
                          </>
                        ) : (
                          <div className="text-xs text-muted">—</div>
                        )}
                      </div>

                      {/* Status pill */}
                      <div className="flex items-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border ${
                          task.is_active
                            ? 'bg-signal-green-bg text-signal-green border-signal-green-border'
                            : 'bg-secondary text-muted border-border'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${task.is_active ? 'bg-signal-green' : 'bg-muted'}`} />
                          {task.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggle(task.id)}
                          title={task.is_active ? 'Pause' : 'Resume'}
                          className="p-2 text-muted hover:text-primary rounded hover:bg-secondary transition-colors cursor-pointer"
                        >
                          {task.is_active ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          title="Delete"
                          className="p-2 text-muted hover:text-signal-red rounded hover:bg-signal-red-bg transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={closeModal}
          />

          <form
            onSubmit={handleCreateSchedule}
            className="bg-surface border border-border rounded-lg max-w-md w-full p-6 relative z-10 space-y-4 shadow-lg"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-signal-blue" />
                <span className="text-sm font-bold text-primary">Schedule Automated Task</span>
              </div>
              <button type="button" onClick={closeModal} className="text-muted hover:text-primary transition-colors p-1 rounded cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Workflow picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary">Select Process</label>
              <select
                value={selectedWorkflowId}
                onChange={e => setSelectedWorkflowId(e.target.value)}
                className="w-full bg-surface border border-border text-xs text-primary rounded-md px-3.5 py-2 outline-none focus:border-signal-blue focus:ring-1 focus:ring-signal-blue transition-colors cursor-pointer"
                required
              >
                <option value="">— Choose a process —</option>
                {workflows.length === 0 && (
                  <option value="demo_wf" className="text-muted">Demo Process (no processes found)</option>
                )}
                {workflows.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Cron expression */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-secondary">Cron Expression</label>

              {/* Preset pills */}
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.cron}
                    type="button"
                    onClick={() => setCronExpression(p.cron)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                      cronExpression === p.cron
                        ? 'bg-action-primary text-action-primary-text border-action-primary'
                        : 'bg-surface border-border text-secondary hover:bg-subtle hover:text-primary'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Cron input */}
              <input
                type="text"
                value={cronExpression}
                onChange={e => setCronExpression(e.target.value)}
                placeholder="0 9 * * *"
                className="w-full bg-surface border border-border rounded-md px-3.5 py-2 text-xs text-primary outline-none focus:border-signal-blue focus:ring-1 focus:ring-signal-blue placeholder-muted font-mono transition-colors"
                required
              />

              {/* Live humanized preview */}
              <div className="flex items-center gap-1.5 px-0.5">
                <Sparkles size={11} className="text-signal-blue" />
                <span className="text-[11px] text-muted">
                  Runs:{' '}
                  <span className="text-primary font-semibold">{humanizeCron(cronExpression)}</span>
                </span>
              </div>
            </div>

            {/* Next run preview */}
            {cronExpression && (() => {
              const upcoming = getNextRunTimes(cronExpression, 3)
              if (upcoming.length === 0) return null
              return (
                <div className="bg-secondary border border-border rounded-md px-3.5 py-2.5 space-y-1.5">
                  <div className="text-[10px] font-semibold text-muted">Next Scheduled Runs</div>
                  <div className="space-y-1">
                    {upcoming.map((d, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[11px] text-secondary">{formatDateTime(d)}</span>
                        <span className="text-[11px] text-signal-blue font-semibold">{formatRelative(d)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary">Description (optional)</label>
              <textarea
                value={taskDescription}
                onChange={e => setTaskDescription(e.target.value)}
                placeholder="What does this scheduled task do?"
                rows={2}
                className="w-full bg-surface border border-border rounded-md px-3.5 py-2 text-xs text-primary outline-none focus:border-signal-blue focus:ring-1 focus:ring-signal-blue placeholder-muted resize-none transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={closeModal}
                className="px-3.5 py-2 bg-surface border border-border rounded-md text-xs font-semibold text-secondary hover:text-primary hover:bg-subtle transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedWorkflowId}
                className="flex items-center gap-2 px-4 py-2 bg-action-primary text-action-primary-text rounded-md text-xs font-semibold hover:bg-action-primary-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                {submitting ? (
                  <><Loader2 size={13} className="animate-spin" /> Creating…</>
                ) : (
                  <><Clock size={13} /> Schedule Task</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
