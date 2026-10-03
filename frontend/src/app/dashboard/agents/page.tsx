'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  Plus,
  MessageSquare,
  Sparkles,
  Search,
  Copy,
  Check,
  ChevronRight,
  X,
  Send,
  Loader2,
  FileText,
  Brain,
  Zap,
  Shield,
  Settings,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Agent {
  id: string
  name: string
  description?: string
  config?: {
    model?: string
    [key: string]: any
  }
  conversation_count?: number
  document_count?: number
  created_at?: string
  [key: string]: any
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

// ── Skeleton loader ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-[6px] border border-border bg-surface p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[6px] bg-surface-subtle" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface-subtle rounded w-3/5" />
          <div className="h-3 bg-surface-subtle rounded w-4/5" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-5 bg-surface-subtle rounded w-20" />
        <div className="h-5 bg-surface-subtle rounded w-16" />
      </div>
      <div className="flex gap-2 mt-auto pt-2 border-t border-border-subtle">
        <div className="h-8 bg-surface-subtle rounded flex-1" />
        <div className="h-8 bg-surface-subtle rounded flex-1" />
      </div>
    </div>
  )
}

// ── Test Chat Modal ────────────────────────────────────────────────────────────
interface TestChatModalProps {
  agent: Agent
  onClose: () => void
}

function TestChatModal({ agent, onClose }: TestChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I'm **${agent.name}**. ${agent.description ? agent.description + ' ' : ''}How can I help you today?`,
    },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionId = useRef(`test-${agent.id}-${Date.now()}`)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function buildHistory(msgs: ChatMessage[]) {
    return msgs
      .filter((m) => !m.streaming)
      .map((m) => ({ role: m.role, content: m.content }))
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content: text }
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', streaming: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setStreaming(true)

    const history = buildHistory([...messages, userMsg])

    try {
      abortRef.current = new AbortController()
      const res = await api.chat.sendStream(agent.id, text, sessionId.current, history)

      if (!res.ok || !res.body) {
        throw new Error(`Stream failed: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })

        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              const delta =
                parsed?.choices?.[0]?.delta?.content ??
                parsed?.delta ??
                parsed?.content ??
                parsed?.text ??
                ''
              accumulated += delta
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: accumulated,
                  streaming: true,
                }
                return updated
              })
            } catch {
              // raw text chunk
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${err.message}` },
        ])
      }
    } finally {
      setStreaming(false)
      setMessages((prev) =>
        prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
      )
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg h-[580px] bg-surface border border-border rounded-[8px] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[6px] bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-800 font-bold text-xs">
              <Bot size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-primary">{agent.name}</h3>
              <p className="text-[11px] text-muted">Test Sandbox Session</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-secondary hover:text-primary rounded hover:bg-white transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3 bg-background">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-[6px] px-3.5 py-2.5 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-action-primary text-white'
                    : 'bg-white border border-border text-primary shadow-xs'
                }`}
              >
                {m.content}
                {m.streaming && (
                  <span className="inline-block w-1.5 h-3 ml-1 bg-current animate-pulse align-middle" />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-border bg-surface">
          <div className="flex items-center gap-2 bg-white border border-border rounded-[6px] px-3 py-1.5 focus-within:border-sky-600 transition-all">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Test agent prompt..."
              disabled={streaming}
              className="flex-1 bg-transparent text-xs text-primary placeholder-muted outline-none min-w-0"
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              className="h-7 px-2.5"
            >
              {streaming ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Agent Card ─────────────────────────────────────────────────────────────────
interface AgentCardProps {
  agent: Agent
  onTestChat: (agent: Agent) => void
  onViewDetails: (id: string) => void
  onEmbed: (id: string) => void
  copiedId: string | null
}

function AgentCard({ agent, onTestChat, onViewDetails, onEmbed, copiedId }: AgentCardProps) {
  const model = agent.config?.model ?? 'gpt-4o'
  const convCount = agent.conversation_count ?? 0
  const docCount = agent.document_count ?? 0
  const isCopied = copiedId === agent.id

  return (
    <div className="rounded-[6px] border border-border bg-surface hover:border-slate-400 transition-all p-4 flex flex-col gap-3.5 shadow-xs">
      {/* Top row: avatar + name + status */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-[6px] bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-primary truncate">{agent.name}</h3>
            <StatusBadge status="nominal" label="Active" size="sm" />
          </div>
          {agent.description && (
            <p className="text-[11px] text-secondary mt-0.5 line-clamp-2 leading-normal">
              {agent.description}
            </p>
          )}
        </div>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-surface-subtle border border-border-subtle text-[11px] text-secondary font-medium font-mono">
          <Brain size={10} />
          {model}
        </span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-surface-subtle border border-border-subtle text-[11px] text-secondary font-medium tabular-nums">
          <MessageSquare size={10} />
          {convCount.toLocaleString()} runs
        </span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-surface-subtle border border-border-subtle text-[11px] text-secondary font-medium tabular-nums">
          <FileText size={10} />
          {docCount} files
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-auto pt-2.5 border-t border-border-subtle">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onTestChat(agent)}
          className="flex-1 text-[11px] h-7"
        >
          <MessageSquare size={11} className="mr-1" />
          Test
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onViewDetails(agent.id)}
          className="flex-1 text-[11px] h-7"
        >
          Inspect
          <ChevronRight size={11} className="ml-1" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEmbed(agent.id)}
          title="Copy embed code"
          className="w-7 h-7 p-0 flex items-center justify-center"
        >
          {isCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
        </Button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()

  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [chatAgent, setChatAgent] = useState<Agent | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.agents
      .list()
      .then(({ agents: data }) => {
        if (!cancelled) setAgents(data ?? [])
      })
      .catch((err) => {
        if (!cancelled) toastError('Failed to load agents', err?.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalConversations = agents.reduce((acc, a) => acc + (a.conversation_count ?? 0), 0)
  const totalDocuments = agents.reduce((acc, a) => acc + (a.document_count ?? 0), 0)
  const uniqueModels = new Set(agents.map((a) => a.config?.model ?? 'gpt-4o')).size

  async function handleEmbed(id: string) {
    try {
      const { embed_code } = await api.agents.embedCode(id)
      await navigator.clipboard.writeText(embed_code)
      setCopiedId(id)
      success('Embed code copied', 'Code copied to clipboard.')
      setTimeout(() => setCopiedId(null), 2500)
    } catch (err: any) {
      toastError('Could not copy embed code', err?.message)
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary">Autonomous Agents</h1>
          <p className="text-xs text-secondary mt-0.5">
            {loading ? 'Scanning workforce...' : `${agents.length} agent sandboxes deployed and monitored`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push('/dashboard/autopilot')}
          >
            <Plus size={14} className="mr-1.5" />
            Deploy Agent
          </Button>
        </div>
      </div>

      {/* ── Metrics Ribbon ── */}
      {!loading && agents.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-[6px] border border-border bg-surface space-y-1">
            <span className="text-[11px] text-secondary">Active Agents</span>
            <div className="text-lg font-bold text-primary tabular-nums">{agents.length}</div>
            <span className="text-[10px] text-muted">Go worker pool</span>
          </div>
          <div className="p-3.5 rounded-[6px] border border-border bg-surface space-y-1">
            <span className="text-[11px] text-secondary">Conversations Handled</span>
            <div className="text-lg font-bold text-primary tabular-nums">{totalConversations.toLocaleString()}</div>
            <span className="text-[10px] text-muted">Session transcripts</span>
          </div>
          <div className="p-3.5 rounded-[6px] border border-border bg-surface space-y-1">
            <span className="text-[11px] text-secondary">Context Artifacts</span>
            <div className="text-lg font-bold text-primary tabular-nums">{totalDocuments.toLocaleString()}</div>
            <span className="text-[10px] text-muted">Vector indexed</span>
          </div>
          <div className="p-3.5 rounded-[6px] border border-border bg-surface space-y-1">
            <span className="text-[11px] text-secondary">LLM Models Active</span>
            <div className="text-lg font-bold text-primary tabular-nums">{uniqueModels}</div>
            <span className="text-[10px] text-muted">Multi-provider router</span>
          </div>
        </div>
      )}

      {/* ── Search Bar ── */}
      {!loading && agents.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[6px] bg-white border border-border max-w-md focus-within:border-sky-600 transition-colors">
          <Search size={14} className="text-secondary shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents by role or identifier..."
            className="flex-1 bg-transparent text-xs text-primary placeholder-muted outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-secondary hover:text-primary cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* ── Loading State ── */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && agents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-border rounded-[6px] bg-surface p-8 space-y-3">
          <div className="w-12 h-12 rounded-[6px] bg-surface-subtle border border-border flex items-center justify-center">
            <Bot size={24} className="text-secondary" />
          </div>
          <h2 className="text-sm font-bold text-primary">No agents deployed yet</h2>
          <p className="text-xs text-secondary max-w-sm">
            Deploy your first supervised agent sandbox to handle customer workflows and task executions.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push('/dashboard/autopilot')}
          >
            <Plus size={14} className="mr-1.5" />
            Deploy First Agent
          </Button>
        </div>
      )}

      {/* ── Agents Grid ── */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onTestChat={(a) => setChatAgent(a)}
              onViewDetails={(id) => router.push(`/dashboard/agents/${id}`)}
              onEmbed={handleEmbed}
              copiedId={copiedId}
            />
          ))}
        </div>
      )}

      {/* ── Test Chat Modal ── */}
      {chatAgent && (
        <TestChatModal
          agent={chatAgent}
          onClose={() => setChatAgent(null)}
        />
      )}
    </div>
  )
}
