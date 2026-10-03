'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { 
  MessageSquare, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  Bot, 
  MoreHorizontal,
  Hash
} from 'lucide-react'

export default function ConversationsPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [agentId, setAgentId] = useState('')
  const [conversations, setConversations] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [filter, setFilter] = useState<'all'|'escalated'|'resolved'>('all')
  const [total, setTotal] = useState(0)

  useEffect(() => {
    api.agents.list().then(r => {
      setAgents(r.agents)
      if (r.agents[0]) setAgentId(r.agents[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!agentId) return
    const escalated = filter === 'escalated' ? true : undefined
    api.chat.conversations(agentId, 1, escalated).then(r => {
      setConversations(r.conversations)
      setTotal(r.total)
    }).catch(() => {})
  }, [agentId, filter])

  async function openConversation(conv: any) {
    setSelected(conv)
    const r = await api.chat.messages(agentId, conv.id).catch(() => ({ messages: [] }))
    setMessages(r.messages)
  }

  async function resolve(convId: string) {
    await api.chat.resolve(agentId, convId).catch(() => {})
    setConversations(c => c.map(x => x.id === convId ? { ...x, resolved: true } : x))
    if (selected?.id === convId) setSelected((s: any) => ({ ...s, resolved: true }))
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <div className="flex h-full bg-background text-primary overflow-hidden">
      {/* CONVERSATION LIST PANEL */}
      <div className="w-96 flex flex-col border-r border-border bg-surface shrink-0">
        <div className="p-5 border-b border-border space-y-4">
           <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-primary tracking-tight">Conversations</h1>
                <p className="text-xs text-muted">Customer & inbound channels</p>
              </div>
              <div className="px-2 py-0.5 rounded-full bg-secondary border border-border text-xs font-mono font-semibold text-primary">
                {total}
              </div>
           </div>
           
           <div className="space-y-2.5">
              {agents.length > 0 && (
                <div className="relative">
                   <select 
                     className="w-full appearance-none bg-surface border border-border px-3 py-2 rounded-md text-xs font-medium text-primary outline-none cursor-pointer focus:border-border-strong shadow-xs"
                     value={agentId} 
                     onChange={e => setAgentId(e.target.value)}
                   >
                     {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                   </select>
                   <ChevronRight size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted rotate-90 pointer-events-none" />
                </div>
              )}

              <div className="flex items-center p-0.5 bg-secondary border border-border rounded-md shadow-xs">
                 {(['all','escalated','resolved'] as const).map(f => (
                    <button 
                      key={f} 
                      onClick={() => setFilter(f)} 
                      className={`flex-1 py-1 rounded text-xs font-medium capitalize transition-all cursor-pointer ${
                        filter === f ? 'bg-surface text-primary shadow-xs' : 'text-muted hover:text-primary'
                      }`}
                    >
                      {f}
                    </button>
                 ))}
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {conversations.length === 0 ? (
            <div className="p-12 text-center space-y-2 text-muted">
               <MessageSquare size={24} className="mx-auto text-muted" />
               <p className="text-xs font-medium text-primary">No conversations found</p>
               <p className="text-[11px] text-muted">Inbound interactions will be cataloged here.</p>
            </div>
          ) : conversations.map(c => (
            <div 
              key={c.id} 
              onClick={() => openConversation(c)}
              className={`p-4 cursor-pointer transition-all border-l-4 ${
                selected?.id === c.id ? 'bg-secondary/60 border-l-action-primary' : 'bg-surface border-l-transparent hover:bg-secondary/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                 <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-primary font-mono">Session #{c.session_id?.slice(0, 8)}</span>
                 </div>
                 <span className="text-[10px] text-muted font-mono">{timeAgo(c.last_message_at || c.created_at)}</span>
              </div>
              <p className="text-xs text-secondary line-clamp-2 mb-2.5 leading-relaxed">
                 {c.last_message || 'Waiting for first message...'}
              </p>
              <div className="flex items-center gap-2">
                 {c.escalated && (
                   <span className="flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={10} /> Escalated
                   </span>
                 )}
                 {c.resolved ? (
                   <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={10} /> Resolved
                   </span>
                 ) : (
                   <span className="flex items-center gap-1 text-[10px] font-medium text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                      <Clock size={10} /> Active
                   </span>
                 )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT PANEL */}
      <div className="flex-1 flex flex-col bg-background">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-12 h-12 bg-surface border border-border rounded-lg shadow-xs flex items-center justify-center mb-4 text-secondary">
               <MessageSquare size={24} />
            </div>
            <h2 className="text-base font-semibold text-primary mb-1">Select a Conversation</h2>
            <p className="text-xs text-muted max-w-xs">Click on any session entry on the left to inspect conversation traces.</p>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div className="h-16 px-6 flex items-center justify-between border-b border-border bg-surface sticky top-0 z-10 shadow-xs">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-secondary border border-border flex items-center justify-center text-primary">
                     <Hash size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-primary font-mono">Session #{selected.session_id?.slice(0, 12)}</h3>
                    <p className="text-[11px] text-muted">{selected.channel || 'Direct Webhook'} · {new Date(selected.created_at).toLocaleString()}</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-2">
                  {!selected.resolved ? (
                    <button 
                      onClick={() => resolve(selected.id)}
                      className="px-3.5 py-1.5 bg-action-primary text-action-primary-text hover:bg-action-primary-hover text-xs font-medium rounded-md shadow-xs transition-all cursor-pointer"
                    >
                      Mark as Resolved
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-medium rounded-md border border-emerald-200">
                       <CheckCircle2 size={13} /> Resolved
                    </div>
                  )}
                  <button className="p-1.5 bg-surface border border-border text-secondary hover:text-primary rounded-md hover:bg-secondary transition-all cursor-pointer shadow-xs">
                     <MoreHorizontal size={16} />
                  </button>
               </div>
            </div>

            {/* MESSAGES VIEW */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
               {messages.length === 0 ? (
                 <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-muted">No messages recorded for this session.</p>
                 </div>
               ) : messages.map((m, idx) => {
                 const isUser = m.role === 'user';
                 return (
                   <div key={m.id || idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex flex-col max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                         <div className={`flex items-center gap-1.5 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${
                              isUser ? 'bg-action-primary text-action-primary-text' : 'bg-secondary border border-border text-primary'
                            }`}>
                               {isUser ? <User size={11} /> : <Bot size={11} />}
                            </div>
                            <span className="text-[10px] font-medium text-muted">{isUser ? 'Customer' : 'Agent Fleet'}</span>
                         </div>
                         
                         <div className={`p-4 rounded-lg shadow-xs border text-xs leading-relaxed ${
                           isUser 
                           ? 'bg-action-primary text-action-primary-text border-transparent' 
                           : 'bg-surface text-primary border-border'
                         }`}>
                            <p>{m.content}</p>
                            <div className={`mt-2 text-[10px] font-mono ${isUser ? 'text-white/70' : 'text-muted'}`}>
                               {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                         </div>
                      </div>
                   </div>
                 );
               })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
