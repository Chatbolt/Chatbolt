'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  MessageSquare, Search, RefreshCw, Clock, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Bot, User, ExternalLink, Filter, Activity,
  ThumbsUp, ThumbsDown, AlertCircle, Copy, CheckCheck, Calendar
} from 'lucide-react'

type Conversation = {
  id: string
  session_id: string
  agent_id: string
  agent_name?: string
  user_message: string
  assistant_message: string
  resolved: boolean
  created_at: string
  rating?: number | null
  tokens_used?: number
}

const truncate = (s: string, n: number) => s && s.length > n ? s.slice(0, n) + '…' : s

export default function ActivityPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'resolved' | 'open'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [copied, setCopied] = useState<string | null>(null)
  const limit = 25

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true)
      const agents = await api.agents.list().catch(() => ({ agents: [] }))
      const agentList = agents.agents || []

      // Fetch conversations for all agents
      const convPromises = agentList.map((a: any) =>
        api.chat.conversations(a.id).catch(() => ({ conversations: [] })).then((r: any) =>
          (r.conversations || []).map((c: any) => ({ ...c, agent_name: a.name }))
        )
      )
      const all = (await Promise.all(convPromises)).flat()
      all.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setConversations(all)
    } catch (err: any) {
      toastError('Failed to load conversations', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  const handleResolve = async (agentId: string, convId: string) => {
    try {
      await api.chat.resolve(agentId, convId)
      toastSuccess('Conversation resolved')
      loadConversations()
    } catch (err: any) {
      toastError('Failed to resolve', err.message)
    }
  }

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const filtered = conversations.filter(c => {
    const matchSearch = !search || c.user_message?.toLowerCase().includes(search.toLowerCase()) || c.assistant_message?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'resolved' ? c.resolved : !c.resolved)
    return matchSearch && matchFilter
  })

  const paginated = filtered.slice((page - 1) * limit, page * limit)
  const totalPages = Math.ceil(filtered.length / limit)

  const stats = {
    total: conversations.length,
    resolved: conversations.filter(c => c.resolved).length,
    open: conversations.filter(c => !c.resolved).length,
  }

  return (
    <div className="flex flex-col h-full bg-background text-primary overflow-y-auto custom-scrollbar">

      {/* Header */}
      <div className="h-14 border-b border-border bg-surface/90 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare size={16} className="text-signal-blue" />
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">Conversations</span>
          <div className="h-3.5 w-px bg-border" />
          <span className="text-xs text-muted font-medium">{conversations.length} total</span>
        </div>
        <button onClick={loadConversations} className="p-2 bg-surface border border-border rounded-md text-muted hover:text-primary hover:bg-subtle transition-all cursor-pointer">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: MessageSquare, color: 'text-primary' },
            { label: 'Resolved', value: stats.resolved, icon: CheckCircle2, color: 'text-signal-green' },
            { label: 'Open', value: stats.open, icon: AlertCircle, color: 'text-signal-amber' },
          ].map((s, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-5 flex items-center gap-4 shadow-xs">
              <div className={`w-10 h-10 rounded-md bg-secondary border border-border flex items-center justify-center ${s.color}`}>
                <s.icon size={18} />
              </div>
              <div>
                <div className="text-xl font-bold text-primary">{loading ? '—' : s.value}</div>
                <div className="text-xs font-semibold text-muted uppercase tracking-wider">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-md text-xs text-primary outline-none focus:border-signal-blue focus:ring-1 focus:ring-signal-blue placeholder-muted transition-all shadow-xs"
              placeholder="Search messages..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div className="flex items-center gap-1 bg-surface border border-border rounded-md p-1 shadow-xs">
            {(['all', 'open', 'resolved'] as const).map(f => (
              <button key={f} onClick={() => { setFilter(f); setPage(1) }}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all capitalize cursor-pointer ${filter === f ? 'bg-action-primary text-action-primary-text' : 'text-muted hover:text-primary'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="space-y-2.5">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-border border-t-signal-blue rounded-full animate-spin" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center bg-surface border border-border rounded-lg shadow-xs">
              <MessageSquare size={32} className="text-muted/60 mb-2" />
              <div className="text-secondary text-sm font-semibold">No conversations found</div>
            </div>
          ) : paginated.map((conv) => {
            const isOpen = expanded === conv.id
            return (
              <div key={conv.id} className="bg-surface border border-border rounded-lg overflow-hidden hover:border-signal-blue/40 transition-colors shadow-xs">
                
                {/* Row */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : conv.id)}
                >
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${conv.resolved ? 'bg-signal-green' : 'bg-signal-amber'}`} />

                  {/* Agent badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-secondary border border-border rounded text-xs font-medium text-secondary shrink-0">
                    <Bot size={13} className="text-signal-blue" />
                    {conv.agent_name || 'Agent'}
                  </div>

                  {/* Message preview */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-primary font-semibold truncate">{truncate(conv.user_message || '', 80)}</div>
                    <div className="text-[11px] text-muted truncate mt-0.5">{truncate(conv.assistant_message || '', 80)}</div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1 text-[11px] text-muted font-medium">
                      <Calendar size={12} />
                      {new Date(conv.created_at).toLocaleDateString()}
                    </div>
                    <div className={`text-[11px] font-semibold px-2.5 py-0.5 rounded border ${
                      conv.resolved
                        ? 'text-signal-green bg-signal-green-bg border-signal-green-border'
                        : 'text-signal-amber bg-signal-amber-bg border-signal-amber-border'
                    }`}>
                      {conv.resolved ? 'Resolved' : 'Open'}
                    </div>
                    {isOpen ? <ChevronUp size={15} className="text-muted" /> : <ChevronDown size={15} className="text-muted" />}
                  </div>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div className="border-t border-border bg-subtle px-5 py-4 space-y-3.5">
                    {/* User message */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5">
                        <User size={12} className="text-secondary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">User</div>
                        <div className="text-xs text-primary leading-relaxed">{conv.user_message}</div>
                      </div>
                    </div>

                    {/* Assistant message */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-signal-blue-bg border border-signal-blue-border flex items-center justify-center shrink-0 mt-0.5">
                        <Bot size={12} className="text-signal-blue" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-signal-blue uppercase tracking-wider mb-1">Assistant</div>
                        <div className="text-xs text-secondary leading-relaxed whitespace-pre-wrap">{conv.assistant_message}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <button onClick={() => copyText(conv.assistant_message || '', conv.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-md text-xs font-semibold text-secondary hover:text-primary transition-all cursor-pointer">
                        {copied === conv.id ? <CheckCheck size={13} className="text-signal-green" /> : <Copy size={13} />}
                        {copied === conv.id ? 'Copied' : 'Copy'}
                      </button>
                      {!conv.resolved && (
                        <button onClick={() => handleResolve(conv.agent_id, conv.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-signal-green-bg border border-signal-green-border rounded-md text-xs font-semibold text-signal-green hover:bg-signal-green/20 transition-all cursor-pointer">
                          <CheckCircle2 size={13} /> Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted pt-2">
            <span>{filtered.length} conversations · Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 bg-surface border border-border rounded-md disabled:opacity-30 hover:text-primary transition-all font-semibold cursor-pointer">
                Prev
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 bg-surface border border-border rounded-md disabled:opacity-30 hover:text-primary transition-all font-semibold cursor-pointer">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
