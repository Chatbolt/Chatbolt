'use client'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Play, Save, Share, Settings, Sparkles, Plus, Search, ZoomIn, ZoomOut, Maximize, AlertTriangle, X } from 'lucide-react'
import { api, getSession } from '@/lib/api'
import { AgentNode } from './AgentNode'
import { ConnectionLines } from './ConnectionLines'
import { EditAgentModal } from './EditAgentModal'
import { DetailsPanel } from './DetailsPanel'
import { TestPanel } from './TestPanel'
import { OutputPanel } from './OutputPanel'
import { useToast } from '@/components/ui/Toast'

interface PlaygroundMainProps {
  initialWorkflowId?: string
}

function calculatePositions(agentCount: number, canvasW: number, canvasH: number) {
  const w = 220, h = 160, hGap = 80, vGap = 60
  const pos = []
  if (agentCount <= 3) {
    const startX = (canvasW - (agentCount * w + (agentCount - 1) * hGap)) / 2
    for (let i = 0; i < agentCount; i++) pos.push({ x: startX + i * (w + hGap), y: (canvasH - h) / 2 })
  } else if (agentCount === 4) {
    const startX = (canvasW - (2 * w + hGap)) / 2
    const startY = (canvasH - (2 * h + vGap)) / 2
    pos.push({ x: startX, y: startY })
    pos.push({ x: startX + w + hGap, y: startY })
    pos.push({ x: startX, y: startY + h + vGap })
    pos.push({ x: startX + w + hGap, y: startY + h + vGap })
  } else {
    const cols = 3
    for (let i = 0; i < agentCount; i++) {
      const col = i % cols, row = Math.floor(i / cols)
      const colsInRow = Math.min(agentCount - row * cols, cols)
      const startX = (canvasW - (colsInRow * w + (colsInRow - 1) * hGap)) / 2
      pos.push({ x: startX + col * (w + hGap), y: (canvasH - (Math.ceil(agentCount/cols) * h + (Math.ceil(agentCount/cols)-1)*vGap)) / 2 + row * (h + vGap) })
    }
  }
  return pos
}

export function PlaygroundMain({ initialWorkflowId }: PlaygroundMainProps) {
  const router = useRouter()
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast()
  const canvasRef = useRef<HTMLDivElement>(null)
  
  const [workflowId, setWorkflowId] = useState<string | null>(initialWorkflowId || null)
  const [workflowName, setWorkflowName] = useState('Untitled Workflow')
  const [prompt, setPrompt] = useState('')
  const [agents, setAgents] = useState<any[]>([])
  const [missingInputs, setMissingInputs] = useState<any[]>([])
  const [userInputs, setUserInputs] = useState<Record<string, string>>({})
  
  const [runState, setRunState] = useState<'idle' | 'generating' | 'running' | 'complete' | 'error'>('idle')
  const [logs, setLogs] = useState<any[]>([])
  const [agentSteps, setAgentSteps] = useState<Record<string, any>>({})
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [openPanel, setOpenPanel] = useState<'edit' | 'details' | 'test' | null>(null)
  
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [dragNode, setDragNode] = useState<{ id: string, startX: number, startY: number } | null>(null)
  const [validationModal, setValidationModal] = useState<{ isOpen: boolean, missing: any[] }>({ isOpen: false, missing: [] })

  // Load existing
  useEffect(() => {
    if (initialWorkflowId) {
      api.workflows.get(initialWorkflowId).then(res => {
        setWorkflowName(res.workflow.name)
        setAgents(res.agents)
      }).catch(err => toastError('Failed to load workflow', err.message))
    }
  }, [initialWorkflowId])

  // Derive connections
  const connections = useMemo(() => {
    const conns: any[] = []
    if (agents.length <= 1) return conns
    if (agents.length === 4) {
      conns.push({ fromPos: agents[0], toPos: agents[1], status: agentSteps[agents[0].id]?.status === 'running' ? 'active' : agentSteps[agents[0].id]?.status === 'completed' ? 'complete' : 'idle' })
      conns.push({ fromPos: agents[1], toPos: agents[3], status: agentSteps[agents[1].id]?.status === 'running' ? 'active' : agentSteps[agents[1].id]?.status === 'completed' ? 'complete' : 'idle' })
      conns.push({ fromPos: agents[0], toPos: agents[2], status: agentSteps[agents[0].id]?.status === 'running' ? 'active' : agentSteps[agents[0].id]?.status === 'completed' ? 'complete' : 'idle' })
      conns.push({ fromPos: agents[2], toPos: agents[3], status: agentSteps[agents[2].id]?.status === 'running' ? 'active' : agentSteps[agents[2].id]?.status === 'completed' ? 'complete' : 'idle' })
    } else {
      for (let i = 0; i < agents.length - 1; i++) {
        conns.push({ 
          fromPos: agents[i], 
          toPos: agents[i+1],
          status: agentSteps[agents[i].id]?.status === 'running' ? 'active' : agentSteps[agents[i].id]?.status === 'completed' ? 'complete' : 'idle'
        })
      }
    }
    return conns
  }, [agents, agentSteps])

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setRunState('generating')
    try {
      const res = await api.workflows.parse(prompt)
      setWorkflowName(res.workflow_name)
      setMissingInputs(res.missing_inputs || [])
      
      const canvasW = canvasRef.current?.clientWidth || 800
      const canvasH = canvasRef.current?.clientHeight || 600
      const pos = calculatePositions(res.agents.length, canvasW, canvasH)
      
      const newAgents = res.agents.map((a: any, i: number) => ({
        ...a, id: `temp-${i}`, x: pos[i].x, y: pos[i].y
      }))
      setAgents(newAgents)
      setRunState('idle')
    } catch (err: any) {
      toastError('Generation failed', err.message)
      setRunState('idle')
    }
  }

  const handleRun = async () => {
    const missing = missingInputs.filter(input => input.required && !userInputs[input.field]);
    if (missing.length > 0) {
      const fieldNames = missing.map(m => m.question || m.field).join(', ');
      setLogs(p => [...p, { 
        id: `err-${Date.now()}`, 
        timestamp: new Date().toLocaleTimeString(), 
        type: 'workflow_error', 
        message: `Execution blocked: Missing required input(s): ${fieldNames}` 
      }]);
      setValidationModal({ isOpen: true, missing });
      toastError('Data Required', 'Some required information is missing.');
      setRunState('error');
      return;
    }

    if (!workflowId) {
      try {
        const res = await api.workflows.create({ name: workflowName, prompt, type: 'custom', agents })
        setWorkflowId(res.workflow.id)
        setAgents(res.agents.map((a: any, i: number) => ({ ...a, x: agents[i].x, y: agents[i].y })))
        startExecution(res.workflow.id)
      } catch (err: any) {
        toastError('Failed to save workflow', err.message)
      }
    } else {
      startExecution(workflowId)
    }
  }

  const startExecution = async (wId: string) => {
    setRunState('running')
    setLogs([{ id: 'start', timestamp: new Date().toLocaleTimeString(), type: 'workflow_start', message: 'Workflow pipeline initialized' }])
    setAgentSteps({})
    
    try {
      const { run_id } = await api.workflows.run(wId, userInputs)
      setActiveRunId(run_id)
      const session = await getSession()
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const eventSource = new EventSource(`${baseUrl}/workflows/${wId}/runs/${run_id}/stream?token=${session?.token || ''}`, { withCredentials: true })

      eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data)
        setLogs(p => [...p, { id: Math.random().toString(36).substr(2), timestamp: new Date().toLocaleTimeString(), type: data.type, message: data.message }])

        if (data.type === 'agent_start') {
          setAgentSteps(p => ({ ...p, [data.agent_id]: { status: 'running' } }))
        } else if (data.type === 'agent_screenshot') {
          setAgentSteps(p => ({ ...p, [data.agent_id]: { ...p[data.agent_id], screenshot: data.screenshot } }))
        } else if (data.type === 'agent_done') {
          setAgentSteps(p => ({ ...p, [data.agent_id]: { ...p[data.agent_id], status: 'completed', duration_ms: data.duration_ms, outputSummary: data.output_summary } }))
        } else if (data.type === 'agent_error') {
          setAgentSteps(p => ({ ...p, [data.agent_id]: { status: 'failed' } }))
        } else if (data.type === 'workflow_done') {
          setRunState('complete')
          eventSource.close()
        } else if (data.type === 'workflow_error') {
          setRunState('error')
          eventSource.close()
        }
      }
      eventSource.onerror = () => { eventSource.close(); setRunState('error') }
    } catch (err: any) {
      toastError('Execution failed', err.message)
      setRunState('error')
    }
  }

  // Pan & Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      setTransform(p => ({ ...p, scale: Math.max(0.2, Math.min(2, p.scale - e.deltaY * 0.01)) }))
    } else {
      setTransform(p => ({ ...p, x: p.x - e.deltaX, y: p.y - e.deltaY }))
    }
  }

  // Node Dragging
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setSelectedAgentId(id)
    setDragNode({ id, startX: e.clientX, startY: e.clientY })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragNode) {
        setAgents(p => p.map(a => a.id === dragNode.id 
          ? { ...a, x: a.x + (e.clientX - dragNode.startX) / transform.scale, y: a.y + (e.clientY - dragNode.startY) / transform.scale } 
          : a))
        setDragNode({ id: dragNode.id, startX: e.clientX, startY: e.clientY })
      } else if (isPanning) {
        setTransform(p => ({ ...p, x: p.x + e.movementX, y: p.y + e.movementY }))
      }
    }
    const handleMouseUp = () => {
      if (dragNode && workflowId && !dragNode.id.startsWith('temp-')) {
        const agent = agents.find(a => a.id === dragNode.id)
        if (agent) api.workflows.saveAgentPosition(workflowId, agent.id, agent.x, agent.y).catch(()=>{})
      }
      setDragNode(null)
      setIsPanning(false)
    }
    if (dragNode || isPanning) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
  }, [dragNode, isPanning, transform.scale, agents, workflowId])

  const selectedAgent = agents.find(a => a.id === selectedAgentId)

  return (
    <div className="flex flex-col h-screen bg-background font-sans overflow-hidden text-primary">
      {/* Topbar */}
      <div className="h-13 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/dashboard/workflows')} 
            className="p-1.5 hover:bg-secondary rounded-md text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="text-xs font-semibold text-secondary">Workflows / Pipeline Canvas</div>
          <div className="w-px h-4 bg-border mx-1" />
          <input 
            value={workflowName} 
            onChange={e => setWorkflowName(e.target.value)}
            className="text-xs font-bold text-primary bg-transparent border border-transparent hover:border-border focus:border-border-strong px-2 py-1 rounded-md transition-colors w-48 shadow-xs"
          />
          <div className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-secondary border border-border text-secondary uppercase">
            {runState}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => toastSuccess('Workflow blueprint saved')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary hover:bg-secondary rounded-md border border-border transition-all cursor-pointer shadow-xs"
          >
            <Save size={12} /> Save
          </button>
          <button 
            onClick={() => toastInfo('Shareable link copied')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary hover:bg-secondary rounded-md border border-border transition-all cursor-pointer shadow-xs"
          >
            <Share size={12} /> Share
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button 
            onClick={handleRun}
            disabled={runState === 'running'}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-action-primary text-action-primary-text hover:bg-action-primary-hover rounded-md text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
          >
            <Play size={12} fill="currentColor" /> {runState === 'running' ? 'Running...' : 'Execute Pipeline'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {/* Left Panel */}
        <div className="w-80 bg-surface border-r border-border flex flex-col shrink-0 z-10 shadow-xs">
          <div className="p-4 flex flex-col gap-3 border-b border-border">
            <div>
              <div className="text-xs font-semibold text-primary">Natural Language Directives</div>
              <div className="text-[11px] text-muted">Describe the desired multi-agent task flow</div>
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. Conduct market intelligence on competitor pricing and draft weekly executive digest..."
              className="w-full h-28 bg-surface border border-border rounded-md p-2.5 text-xs text-primary focus:outline-none focus:border-border-strong transition-all placeholder:text-muted resize-none shadow-xs leading-relaxed"
            />
            <button 
              onClick={handleGenerate}
              disabled={runState === 'generating' || !prompt.trim()}
              className="w-full py-2 bg-action-primary text-action-primary-text hover:bg-action-primary-hover rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
            >
              {runState === 'generating' ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles size={12} />}
              {runState === 'generating' ? 'Synthesizing...' : 'Synthesize Agents'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="text-xs font-semibold text-primary">Required Task Parameters</div>

            {missingInputs.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <Search size={20} className="mx-auto mb-1.5 text-muted" />
                <div className="text-xs font-medium">No external inputs required</div>
                <p className="text-[11px] text-muted mt-0.5">Pipeline will run autonomously</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {missingInputs.map((input: any, i: number) => (
                  <div key={i} className="bg-secondary/30 border border-border rounded-md p-2.5 shadow-xs">
                    <div className="text-xs font-semibold text-primary mb-0.5">{input.question}</div>
                    <div className="text-[10px] text-muted mb-1.5 font-mono">Bound to: {input.agentName || 'Agent node'}</div>
                    <input 
                      value={userInputs[input.field] || ''}
                      onChange={e => setUserInputs(p => ({ ...p, [input.field]: e.target.value }))}
                      placeholder={`Enter ${input.field}...`}
                      className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-primary focus:outline-none focus:border-border-strong shadow-xs"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Canvas */}
        <div 
          className="flex-1 relative overflow-hidden bg-background" 
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={() => { setIsPanning(true); setSelectedAgentId(null) }}
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        >
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
              backgroundSize: `${32 * transform.scale}px ${32 * transform.scale}px`,
              backgroundPosition: `${transform.x}px ${transform.y}px`
            }}
          />

          <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0', width: '100%', height: '100%' }}>
            {agents.length === 0 && runState !== 'generating' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center p-8 text-center bg-surface/90 shadow-xs max-w-sm">
                  <div className="w-10 h-10 bg-secondary border border-border rounded-lg flex items-center justify-center mb-3 text-secondary">
                    <Sparkles size={20} />
                  </div>
                  <div className="text-sm font-semibold text-primary mb-1">Canvas Ready for Blueprint</div>
                  <div className="text-xs text-muted">Type a directive on the left and click Synthesize Agents to generate the graph</div>
                </div>
              </div>
            )}

            {runState === 'generating' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-surface border border-border rounded-lg p-5 shadow-lg max-w-xs w-full">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
                    <div className="text-xs font-semibold text-primary">Synthesizing node graph...</div>
                  </div>
                  <div className="space-y-1.5 text-[11px] font-mono text-muted">
                    <div>→ Deconstructing directives...</div>
                    <div>→ Allocating specialized agents...</div>
                    <div className="animate-pulse">→ Wiring inputs and outputs...</div>
                  </div>
                </div>
              </div>
            )}

            <ConnectionLines connections={connections} canvasW={2000} canvasH={2000} />

            {agents.map((agent, i) => (
              <AgentNode
                key={agent.id}
                agent={agent}
                position={i + 1}
                x={agent.x}
                y={agent.y}
                status={agentSteps[agent.id]?.status || 'idle'}
                outputSummary={agentSteps[agent.id]?.outputSummary}
                selected={selectedAgentId === agent.id}
                onMouseDown={(e) => handleNodeMouseDown(e, agent.id)}
                onEdit={() => { setSelectedAgentId(agent.id); setOpenPanel('edit') }}
                onDetails={() => { setSelectedAgentId(agent.id); setOpenPanel('details') }}
                onTest={() => { setSelectedAgentId(agent.id); setOpenPanel('test') }}
              />
            ))}
          </div>

          {/* Canvas Controls */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2 z-10">
            <button 
              onClick={() => {
                const newId = `temp-${Date.now()}`
                setAgents(p => [...p, { id: newId, name: 'Custom Node', role: 'researcher', description: 'User-added execution step', x: 200, y: 200 }])
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-md shadow-xs text-xs font-medium hover:bg-secondary transition-all text-primary cursor-pointer"
            >
              <Plus size={13} /> Add Agent Node
            </button>
          </div>
          <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-10">
            <div className="flex flex-col bg-surface border border-border rounded-md shadow-xs overflow-hidden">
              <button onClick={() => setTransform(p => ({ ...p, scale: p.scale + 0.1 }))} className="p-1.5 hover:bg-secondary text-secondary hover:text-primary transition-colors cursor-pointer"><ZoomIn size={14} /></button>
              <div className="w-full h-px bg-border" />
              <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.2, p.scale - 0.1) }))} className="p-1.5 hover:bg-secondary text-secondary hover:text-primary transition-colors cursor-pointer"><ZoomOut size={14} /></button>
              <div className="w-full h-px bg-border" />
              <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} className="p-1.5 hover:bg-secondary text-secondary hover:text-primary transition-colors cursor-pointer"><Maximize size={14} /></button>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <OutputPanel 
          logs={logs} 
          agents={agents} 
          agentSteps={agentSteps} 
          runStatus={runState === 'generating' ? 'idle' : runState}
          workflowId={workflowId || undefined}
          runId={activeRunId || undefined}
        />

        {/* Overlays */}
        {openPanel === 'edit' && selectedAgent && (
          <EditAgentModal 
            agent={selectedAgent} 
            workflowId={workflowId || 'temp'}
            onClose={() => setOpenPanel(null)}
            onSaved={(updated) => setAgents(p => p.map(a => a.id === updated.id ? updated : a))}
          />
        )}
        
        {openPanel === 'details' && selectedAgent && (
          <DetailsPanel 
            agent={selectedAgent}
            workflowId={workflowId || 'temp'}
            stepData={agentSteps[selectedAgent.id]}
            onClose={() => setOpenPanel(null)}
            onEdit={() => setOpenPanel('edit')}
          />
        )}

        {openPanel === 'test' && selectedAgent && (
          <TestPanel 
            agent={selectedAgent}
            workflowId={workflowId || 'temp'}
            userInputs={userInputs}
            onClose={() => setOpenPanel(null)}
          />
        )}

        {validationModal.isOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full shadow-xl">
              <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm mb-2">
                <AlertTriangle size={16} />
                <span>Required Execution Parameters Missing</span>
              </div>
              <p className="text-xs text-secondary mb-4">
                Please provide the required values on the left panel before executing this pipeline.
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setValidationModal({ isOpen: false, missing: [] })}
                  className="px-4 py-1.5 bg-action-primary text-action-primary-text hover:bg-action-primary-hover text-xs font-medium rounded-md cursor-pointer shadow-xs"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
