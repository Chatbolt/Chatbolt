'use client'
import React, { useState } from 'react'
import { X, Play, CheckCircle2, XCircle, Clock, Terminal, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'

interface TestPanelProps {
  agent: any
  workflowId?: string
  userInputs?: Record<string, string>
  onClose: () => void
}

export function TestPanel({ agent, workflowId = 'temp', userInputs = {}, onClose }: TestPanelProps) {
  const [task, setTask] = useState(agent.description || '')
  const [simPrevOutput, setSimPrevOutput] = useState('')
  const [simEnabled, setSimEnabled] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [showRaw, setShowRaw] = useState(false)

  const handleRun = async () => {
    setRunning(true)
    setResult(null)
    try {
      const inputs = { ...userInputs }
      if (simEnabled && simPrevOutput) inputs._previous_output = simPrevOutput
      const res = await api.workflows.testAgent(workflowId, agent.id, inputs, task)
      setResult(res)
    } catch (e: any) {
      setResult({ error: e.message, duration_ms: 0, output: null })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-end bg-black/30 backdrop-blur-xs" onClick={onClose}>
      <div 
        className="bg-surface border-t border-border rounded-t-2xl shadow-2xl w-full max-w-5xl mx-auto overflow-hidden animate-slide-up"
        style={{ maxHeight: '50vh' }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-subtle/50">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-secondary border border-border">
              <Terminal size={14} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary">{agent.name}</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 bg-secondary text-secondary rounded border border-border">
                  {agent.role}
                </span>
              </div>
              <p className="text-[10px] text-muted">Isolated execution sandbox & schema validation</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-md hover:bg-secondary text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex h-full" style={{ maxHeight: 'calc(50vh - 60px)' }}>
          {/* Left — Input */}
          <div className="w-1/2 border-r border-border p-5 flex flex-col gap-4 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Test Instruction</label>
              <textarea
                value={task}
                onChange={e => setTask(e.target.value)}
                rows={3}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted/60 resize-none focus:outline-none focus:border-border-strong font-sans shadow-xs"
                placeholder="Specify execution scenario or parameter payload..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Mock Upstream Context</label>
                <button
                  onClick={() => setSimEnabled(!simEnabled)}
                  className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer ${simEnabled ? 'bg-primary' : 'bg-border'}`}
                >
                  <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${simEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {simEnabled && (
                <textarea
                  value={simPrevOutput}
                  onChange={e => setSimPrevOutput(e.target.value)}
                  rows={3}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted/60 resize-none focus:outline-none focus:border-border-strong font-mono shadow-xs"
                  placeholder="Paste mock upstream agent JSON payload..."
                />
              )}
            </div>

            <div className="mt-auto pt-2">
              <button
                onClick={handleRun}
                disabled={running || !task.trim()}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-action-primary text-action-primary-text rounded-lg text-xs font-semibold hover:bg-action-primary-hover active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
              >
                {running ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Executing Evaluation...</span>
                  </>
                ) : (
                  <>
                    <Play size={13} fill="currentColor" />
                    <span>Execute Agent Evaluation</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right — Output */}
          <div className="w-1/2 p-5 overflow-y-auto bg-subtle/30">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Telemetry & Result</label>
              {result && (
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-[10px] font-medium text-secondary hover:text-primary transition-colors cursor-pointer underline underline-offset-2"
                >
                  {showRaw ? 'Render Formatted' : 'View Raw JSON'}
                </button>
              )}
            </div>

            {!result && !running && (
              <div className="h-44 flex flex-col items-center justify-center text-muted border border-dashed border-border rounded-xl bg-surface/50">
                <Terminal size={20} className="mb-2 stroke-1 text-muted" />
                <div className="text-xs font-medium text-secondary">Awaiting test trigger</div>
                <div className="text-[11px] text-muted">Run agent evaluation to stream responses</div>
              </div>
            )}

            {running && (
              <div className="space-y-3 p-4 bg-surface border border-border rounded-xl">
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <div className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                  <span>Agent running evaluation steps...</span>
                </div>
                <div className="space-y-2">
                  <div className="h-2.5 bg-secondary rounded animate-pulse w-3/4" />
                  <div className="h-2.5 bg-secondary rounded animate-pulse w-full" />
                  <div className="h-2.5 bg-secondary rounded animate-pulse w-1/2" />
                </div>
              </div>
            )}

            {result && !running && (
              <div className="space-y-3">
                {/* Status bar */}
                <div className="flex items-center justify-between px-3 py-2 bg-surface border border-border rounded-lg shadow-xs">
                  <div className="flex items-center gap-2">
                    {result.error ? (
                      <XCircle size={14} className="text-rose-600" />
                    ) : (
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    )}
                    <span className={`text-xs font-semibold ${result.error ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {result.error ? 'Execution Failed' : 'Success 200 OK'}
                    </span>
                  </div>
                  {result.duration_ms !== undefined && (
                    <span className="text-[11px] font-mono text-muted flex items-center gap-1">
                      <Clock size={11} />
                      {(result.duration_ms / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>

                {/* Content */}
                {result.error ? (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <div>{result.error}</div>
                  </div>
                ) : showRaw ? (
                  <pre className="bg-secondary text-primary border border-border rounded-lg p-3.5 text-[11px] overflow-auto max-h-48 font-mono shadow-xs">
                    {JSON.stringify(result.output, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-surface rounded-lg p-3.5 border border-border max-h-48 overflow-y-auto shadow-xs">
                    <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap font-mono">
                      {result.output?.data?.content || result.output?.summary || JSON.stringify(result.output, null, 2)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
