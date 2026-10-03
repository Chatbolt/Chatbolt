'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  Zap, Plus, ExternalLink, Shield, Code, Settings2, Globe, X,
  Activity, RefreshCw, Play, Cpu, CheckCircle, XCircle,
  MoreHorizontal, Edit3, Trash2, Clock, Terminal, ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-sky-800 bg-sky-50 border-sky-300',
  POST: 'text-emerald-800 bg-emerald-50 border-emerald-300',
  PUT: 'text-amber-800 bg-amber-50 border-amber-300',
  PATCH: 'text-purple-800 bg-purple-50 border-purple-300',
  DELETE: 'text-red-800 bg-red-50 border-red-300',
}

type Tool = {
  id: string
  name: string
  description: string
  endpoint_url: string
  method: string
  auth_type: string
  auth_header?: string
  is_active: boolean
  call_count: number
  last_called_at?: string
  avg_latency_ms?: number
  created_at: string
}

type ToolStats = {
  total: string
  active: string
  total_calls: string
  avg_latency: string
}

type InvokeResult = {
  success: boolean
  status_code: number
  latency_ms: number
  response: any
  error: string | null
}

export default function ActionsPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [tools, setTools] = useState<Tool[]>([])
  const [stats, setStats] = useState<ToolStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editTool, setEditTool] = useState<Tool | null>(null)
  const [invokeToolId, setInvokeToolId] = useState<string | null>(null)
  const [invokePayload, setInvokePayload] = useState('{}')
  const [invokeResult, setInvokeResult] = useState<InvokeResult | null>(null)
  const [invoking, setInvoking] = useState(false)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', description: '', endpoint_url: '', method: 'POST',
    auth_type: 'none', auth_value: '', auth_header: '', timeout_ms: 10000
  })

  const loadTools = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.customTools.list()
      setTools(res.tools || [])
      setStats(res.stats || null)
    } catch (err: any) {
      toastError('Failed to load tools', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTools() }, [loadTools])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.customTools.create({ ...form, timeout_ms: Number(form.timeout_ms) })
      toastSuccess('Tool created')
      setShowAddModal(false)
      resetForm()
      loadTools()
    } catch (err: any) {
      toastError('Failed to create tool', err.message)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTool) return
    try {
      await api.customTools.update(editTool.id, { ...form, timeout_ms: Number(form.timeout_ms) })
      toastSuccess('Tool updated')
      setEditTool(null)
      resetForm()
      loadTools()
    } catch (err: any) {
      toastError('Failed to update tool', err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom action?')) return
    try {
      await api.customTools.delete(id)
      toastSuccess('Tool deleted')
      loadTools()
    } catch (err: any) {
      toastError('Failed to delete tool', err.message)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await api.customTools.toggle(id)
      toastSuccess('Tool status updated')
      loadTools()
    } catch (err: any) {
      toastError('Failed to update tool status', err.message)
    }
  }

  const handleInvoke = async () => {
    if (!invokeToolId) return
    try {
      setInvoking(true)
      let parsed = {}
      try { parsed = JSON.parse(invokePayload) } catch { /* pass */ }
      const res = await api.customTools.invoke(invokeToolId, parsed)
      setInvokeResult(res)
    } catch (err: any) {
      toastError('Invoke failed', err.message)
    } finally {
      setInvoking(false)
    }
  }

  const resetForm = () => {
    setForm({
      name: '', description: '', endpoint_url: '', method: 'POST',
      auth_type: 'none', auth_value: '', auth_header: '', timeout_ms: 10000
    })
  }

  const openEdit = (t: Tool) => {
    setEditTool(t)
    setForm({
      name: t.name, description: t.description || '', endpoint_url: t.endpoint_url,
      method: t.method, auth_type: t.auth_type, auth_value: '', auth_header: t.auth_header || '',
      timeout_ms: 10000
    })
    setActionMenuId(null)
  }

  const statCards = [
    { label: 'Total Actions', value: stats?.total || tools.length, icon: Cpu, color: 'text-sky-700' },
    { label: 'Active Endpoints', value: stats?.active || tools.filter(t => t.is_active).length, icon: Activity, color: 'text-emerald-700' },
    { label: 'Total Invocations', value: stats?.total_calls || '0', icon: Zap, color: 'text-amber-700' },
    { label: 'Avg Latency', value: stats?.avg_latency ? `${stats.avg_latency}ms` : '—', icon: Clock, color: 'text-purple-700' },
  ]

  const FormContent = ({ onSubmit, title }: { onSubmit: (e: React.FormEvent) => void, title: string }) => (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-border rounded-[8px] p-6 max-w-lg w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-xs font-bold text-primary">{title}</h3>
          <button onClick={() => { setShowAddModal(false); setEditTool(null) }} className="text-secondary hover:text-primary cursor-pointer">
            <X size={15} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <div>
            <label className="text-xs font-semibold text-primary block mb-1">Action Name</label>
            <input className="w-full bg-white border border-border rounded-[6px] px-3 py-2 text-xs text-primary focus:border-sky-600 outline-none" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sync CRM Records" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-primary block mb-1">Description</label>
            <textarea className="w-full bg-white border border-border rounded-[6px] px-3 py-2 text-xs text-primary focus:border-sky-600 outline-none resize-none h-16" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Webhook for real-time customer data syncing..." />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-xs font-semibold text-primary block mb-1">Method</label>
              <select className="w-full bg-white border border-border rounded-[6px] px-2 py-2 text-xs text-primary outline-none focus:border-sky-600" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <label className="text-xs font-semibold text-primary block mb-1">Endpoint URL</label>
              <input className="w-full bg-white border border-border rounded-[6px] px-3 py-2 text-xs text-primary focus:border-sky-600 outline-none" value={form.endpoint_url} onChange={e => setForm(f => ({ ...f, endpoint_url: e.target.value }))} placeholder="https://api.example.com/v1/sync" required />
            </div>
          </div>
          <div className="pt-2 flex justify-end gap-2 border-t border-border">
            <Button variant="outline" size="sm" type="button" onClick={() => { setShowAddModal(false); setEditTool(null) }}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              {title.includes('Create') ? 'Create Action' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans" onClick={() => setActionMenuId(null)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary">Custom Actions & Webhooks</h1>
          <p className="text-xs text-secondary mt-0.5">
            Define programmatic REST tool endpoints for autonomous agent execution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadTools}>
            <RefreshCw size={13} className="mr-1.5" />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setShowAddModal(true); setEditTool(null); resetForm() }}>
            <Plus size={13} className="mr-1.5" />
            New Action
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className="bg-surface border border-border rounded-[6px] p-4 shadow-xs space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-secondary">
              <s.icon size={14} className={s.color} />
              <span>{s.label}</span>
            </div>
            <div className="text-xl font-bold text-primary tabular-nums">{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      {/* Tools Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-surface border border-border rounded-[6px] animate-pulse p-4" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map(t => (
            <div key={t.id} className="bg-surface border border-border rounded-[6px] p-4 flex flex-col justify-between shadow-xs hover:border-slate-400 transition-all" onClick={e => e.stopPropagation()}>
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-[5px] bg-surface-subtle border border-border flex items-center justify-center text-primary font-bold text-xs">
                      <Globe size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-primary">{t.name}</h3>
                      <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold border ${METHOD_COLORS[t.method] || METHOD_COLORS.POST}`}>
                        {t.method}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={t.is_active ? 'nominal' : 'idle'} label={t.is_active ? 'Active' : 'Paused'} size="sm" />
                </div>
                {t.description && <p className="text-[11px] text-secondary line-clamp-2 my-2">{t.description}</p>}
                <div className="text-[10px] text-muted font-mono truncate bg-surface-subtle border border-border-subtle rounded px-2 py-1 my-2">
                  {t.endpoint_url}
                </div>
              </div>

              <div className="pt-2 border-t border-border-subtle flex items-center justify-between gap-2 mt-2">
                <Button variant="outline" size="sm" className="h-7 text-[11px] flex-1" onClick={() => { setInvokeToolId(t.id); setInvokeResult(null) }}>
                  <Play size={11} className="mr-1" /> Test Invoke
                </Button>
                <Button variant="secondary" size="sm" className="h-7 text-[11px]" onClick={() => openEdit(t)}>
                  <Edit3 size={11} />
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-[11px] text-red-700 hover:text-red-900" onClick={() => handleDelete(t.id)}>
                  <Trash2 size={11} />
                </Button>
              </div>
            </div>
          ))}

          {/* Add tool dashed card */}
          <div
            onClick={() => { setShowAddModal(true); resetForm() }}
            className="border-2 border-dashed border-border hover:border-slate-400 bg-surface/50 rounded-[6px] p-6 flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer min-h-[160px]"
          >
            <div className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center text-secondary">
              <Plus size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-primary block">Connect New Action</span>
              <span className="text-[11px] text-muted">REST API, webhook, or microservice endpoint</span>
            </div>
          </div>
        </div>
      )}

      {/* Invoke Modal */}
      {invokeToolId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => { setInvokeToolId(null); setInvokeResult(null) }}>
          <div className="bg-white border border-border rounded-[8px] p-6 max-w-lg w-full shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-primary" />
                <h3 className="text-xs font-bold text-primary">Test Action Invocation</h3>
              </div>
              <button onClick={() => { setInvokeToolId(null); setInvokeResult(null) }} className="text-secondary hover:text-primary cursor-pointer">
                <X size={15} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-primary block mb-1">JSON Payload</label>
                <textarea
                  rows={4}
                  className="w-full bg-surface-subtle border border-border rounded-[6px] p-3 text-xs font-mono text-primary focus:border-sky-600 outline-none resize-none"
                  value={invokePayload}
                  onChange={e => setInvokePayload(e.target.value)}
                />
              </div>
              <Button variant="primary" size="md" className="w-full" onClick={handleInvoke} isLoading={invoking}>
                <Play size={13} className="mr-1.5" /> Execute Action
              </Button>
              {invokeResult && (
                <div className={`rounded-[6px] border p-3 text-xs ${invokeResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-red-50 border-red-300 text-red-950'}`}>
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {invokeResult.success ? <CheckCircle size={14} className="text-emerald-700" /> : <XCircle size={14} className="text-red-700" />}
                    <span>Status {invokeResult.status_code} ({invokeResult.latency_ms}ms)</span>
                  </div>
                  <pre className="text-[11px] font-mono overflow-auto max-h-36 whitespace-pre-wrap mt-1">
                    {JSON.stringify(invokeResult.response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddModal && <FormContent onSubmit={handleCreate} title="Create New Action Tool" />}
      {editTool && <FormContent onSubmit={handleUpdate} title="Edit Action Tool" />}
    </div>
  )
}
