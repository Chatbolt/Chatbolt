'use client'
import React, { useState, useEffect, useRef } from 'react'
import { Clock, Copy, CheckCircle2, Terminal } from 'lucide-react'

interface LogEntry { id: string; timestamp: string; type: string; message: string }

interface OutputPanelProps {
  logs: LogEntry[]
  agents: any[]
  agentSteps: Record<string, any>
  runStatus: 'idle' | 'running' | 'complete' | 'error'
  runDuration?: number
  workflowId?: string
  runId?: string
}

const LOG_COLORS: Record<string, string> = {
  agent_start: '#4B5563', agent_done: '#047857', agent_error: '#B91C1C',
  workflow_start: '#0F172A', workflow_done: '#047857', workflow_error: '#B91C1C',
  info: '#6B7280', success: '#047857', error: '#B91C1C',
}

const LOG_PREFIXES: Record<string, string> = {
  agent_start: '→', agent_done: '✓', agent_error: '✗',
  workflow_start: '⬡', workflow_done: '✅', workflow_error: '✗',
  info: '·', success: '✓', error: '✗',
}

export function OutputPanel({ logs, agents, agentSteps, runStatus, runDuration, workflowId, runId }: OutputPanelProps) {
  const [tab, setTab] = useState<'output' | 'log' | 'history'>('output')
  const [copied, setCopied] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  const handleSandboxClick = async (e: React.MouseEvent<HTMLImageElement>, wId: string, rId: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      let token = ''
      try {
        const stored = localStorage.getItem('supabase.auth.token')
        if (stored) {
          const parsed = JSON.parse(stored)
          token = parsed?.currentSession?.access_token || ''
        }
      } catch {}

      await fetch(`${baseUrl}/workflows/${wId}/runs/${rId}/browser/click-relative`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ xPercent, yPercent })
      })
    } catch (err: any) {
      console.error('Failed to forward click coordinate:', err.message)
    }
  }
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (runStatus === 'running' || runStatus === 'error') setTab('log')
    if (runStatus === 'complete') setTimeout(() => setTab('output'), 1000)
  }, [runStatus])

  useEffect(() => {
    if (autoScroll && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs, autoScroll])

  const allOutputs = Object.values(agentSteps).filter(s => s?.output_data || s?.outputSummary)

  const copyOutput = () => {
    const text = allOutputs.map(s => s.outputSummary || JSON.stringify(s.output_data)).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabs = [
    { id: 'output', label: 'Output' },
    { id: 'log', label: 'Live Log', badge: runStatus === 'running' },
    { id: 'history', label: 'History' },
  ] as const

  return (
    <div className="w-80 bg-surface border-l border-border flex flex-col shrink-0 h-full text-primary shadow-xs">
      {/* Tabs */}
      <div className="flex border-b border-border shrink-0 bg-surface">
        {tabs.map(t => (
          <button 
            key={t.id} 
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-all relative cursor-pointer ${
              tab === t.id ? 'text-primary font-semibold' : 'text-muted hover:text-primary hover:bg-secondary/40'
            }`}
          >
            {t.label}
            {t.id === 'log' && (t as any).badge && (
              <span className="ml-1 w-1.5 h-1.5 bg-emerald-600 rounded-full inline-block animate-pulse" />
            )}
            {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-action-primary" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* OUTPUT TAB */}
        {tab === 'output' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {runStatus === 'idle' && logs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center text-muted">
                <Clock size={20} className="mb-2 text-muted" />
                <div className="text-xs font-medium text-secondary">Execute pipeline to stream outputs</div>
              </div>
            )}

            {agents.map((agent) => {
              const step = agentSteps[agent.id] || {}
              const isRunning = step.status === 'running'
              const isDone = step.status === 'completed'
              const isWaiting = !step.status && runStatus === 'running'
              return (
                <div key={agent.id} className="border border-border rounded-lg overflow-hidden bg-surface shadow-xs">
                  <div className={`flex items-center justify-between px-3 py-2 border-b border-border ${
                    isDone ? 'bg-emerald-50/50' : isRunning ? 'bg-sky-50' : 'bg-secondary/30'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      {isDone && <CheckCircle2 size={12} className="text-emerald-700" />}
                      {isRunning && <div className="w-2 h-2 bg-sky-600 rounded-full animate-pulse" />}
                      {isWaiting && <div className="w-2 h-2 bg-amber-500 rounded-full" />}
                      {!isDone && !isRunning && !isWaiting && <div className="w-2 h-2 bg-gray-400 rounded-full" />}
                      <span className="text-xs font-semibold text-primary">{agent.name}</span>
                    </div>
                    {step.duration_ms && (
                      <span className="text-[10px] font-mono text-muted">{(step.duration_ms / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  <div className="p-3 bg-surface">
                    {isRunning && !step.screenshot && <div className="text-xs text-muted animate-pulse">Running task...</div>}
                    {isWaiting && <div className="text-xs text-muted">Waiting on upstream node...</div>}
                    {isDone && step.outputSummary && (
                      <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap">{step.outputSummary}</p>
                    )}
                    {!isDone && !isRunning && !isWaiting && (
                      <div className="text-xs text-muted">Not yet executed</div>
                    )}
                    {(isRunning || isDone) && step.screenshot && (
                      <div className="mt-2 border border-border rounded-md overflow-hidden bg-secondary shadow-xs">
                        <div className="px-2 py-1 bg-surface border-b border-border text-[10px] text-muted flex justify-between items-center select-none font-mono">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full inline-block animate-ping" />
                            Live Sandbox Screen
                          </span>
                        </div>
                        <img 
                          src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${step.screenshot}`} 
                          alt="Live Sandbox Screen" 
                          className="w-full h-auto max-h-40 object-cover cursor-crosshair select-none"
                          onClick={(e) => {
                            if (workflowId && runId) {
                              handleSandboxClick(e, workflowId, runId)
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {runStatus === 'complete' && (
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="text-[10px] text-muted font-mono">
                  {runDuration ? `${(runDuration / 1000).toFixed(0)}s · ${agents.length}/${agents.length} nodes` : `${agents.length} nodes complete`}
                </div>
                <button 
                  onClick={copyOutput}
                  className="flex items-center gap-1 px-2.5 py-1 bg-surface border border-border rounded text-xs font-medium text-secondary hover:text-primary hover:bg-secondary transition-all cursor-pointer shadow-xs"
                >
                  {copied ? <CheckCircle2 size={11} className="text-emerald-700" /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* LOG TAB */}
        {tab === 'log' && (
          <div className="flex-1 flex flex-col min-h-0 p-3">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-1 text-xs font-semibold text-secondary">
                <Terminal size={12} /> Execution Log
              </div>
              <button 
                onClick={() => setAutoScroll(!autoScroll)}
                className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-all cursor-pointer ${
                  autoScroll ? 'bg-action-primary text-action-primary-text border-transparent' : 'border-border text-muted bg-surface'
                }`}
              >
                Auto-scroll
              </button>
            </div>
            <div ref={logRef} className="flex-1 bg-surface border border-border rounded-lg p-2.5 overflow-y-auto font-mono text-[11px] space-y-1 shadow-xs">
              {logs.length === 0 && (
                <div className="text-muted">Awaiting pipeline execution...</div>
              )}
              {logs.map(log => {
                const color = LOG_COLORS[log.type] || '#4B5563'
                const prefix = LOG_PREFIXES[log.type] || '·'
                return (
                  <div key={log.id} className="flex gap-1.5 leading-tight">
                    <span className="text-muted shrink-0">[{log.timestamp}]</span>
                    <span style={{ color }} className="shrink-0 font-bold">{prefix}</span>
                    <span className="text-secondary break-all">{log.message}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div className="flex-1 overflow-y-auto p-4 text-center text-muted">
            <div className="py-12">
              <Clock size={20} className="mx-auto mb-2 text-muted" />
              <div className="text-xs text-secondary">Execution history will be stored here</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
