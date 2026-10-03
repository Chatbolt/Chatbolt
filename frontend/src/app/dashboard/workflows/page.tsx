'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  ArrowRight,
  Search,
  Sparkles,
  Bot,
  Database,
  Mail,
  Zap,
  Code2,
  LineChart,
  Users,
  Briefcase,
  HelpCircle,
  Terminal,
  Play,
  History,
  Settings,
  ChevronRight,
  Workflow as WorkflowIcon,
  Upload,
  Activity,
  Map,
  Smartphone,
  Shield,
  Cloud,
  Scale,
  Layout
} from 'lucide-react'
import { api, getSession } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PipelineVisualizer } from '@/components/dashboard/PipelineVisualizer'
import { ActivityLog, LogEntry } from '@/components/dashboard/ActivityLog'

const CATEGORIES = ['All', 'Research', 'Security', 'CloudOps', 'Legal', 'Product', 'Marketing', 'Productivity', 'Coding', 'Data']

const WORKFLOW_CARDS = [
  { category: 'Security', title: 'Automated SAST Security Audit', desc: 'Scan a GitHub repository for OWASP Top 10 vulnerabilities (SQLi, XSS) and autonomously generate code patches.', icon: Shield, platforms: ['GitHub', 'Code'] },
  { category: 'CloudOps', title: 'FinOps Cost Optimization', desc: 'Analyze AWS/GCP usage metrics and architecture to recommend cost-saving downscaling and resource cleanup.', icon: Cloud, platforms: ['AWS', 'GCP'] },
  { category: 'Legal', title: 'SOC2 & GDPR Compliance Scan', desc: 'Analyze enterprise contracts and policies against GDPR/SOC2 frameworks to identify risks and missing clauses.', icon: Scale, platforms: ['Google Docs', 'PDF'] },
  { category: 'Marketing', title: 'Programmatic SEO Generation', desc: 'Generate highly optimized, semantic HTML landing pages based on targeted keywords and competitor analysis.', icon: Search, platforms: ['Web', 'HTML'] },
  { category: 'Marketing', title: 'Viral Trend & Social Sentiment', desc: 'Track brand sentiment on Twitter/LinkedIn and autonomously draft viral response posts and threads.', icon: Zap, platforms: ['Twitter', 'LinkedIn'] },
  { category: 'Product', title: 'CRO A/B Test Generator', desc: 'Scrape a live webpage to find UX bottlenecks and generate React/Tailwind code variants to improve conversions.', icon: Layout, platforms: ['React', 'Next.js'] },
  { category: 'Marketing', title: 'Automated CSV Email Forwarder', desc: 'Read target accounts from a CSV and execute a mass email forward sequence.', icon: Mail, platforms: ['Google Sheets', 'Gmail'] },
  { category: 'Coding', title: 'Self-Healing CI/CD Pipeline', desc: 'Analyze failed build logs, fetch the broken file, and push a fixed commit back to the branch.', icon: Code2, platforms: ['GitHub', 'Terminal'] },
  { category: 'Research', title: 'Deep dive competitor research', desc: 'Search the web, read sources, compile a structured report with citations into a Google Doc.', icon: Sparkles, platforms: ['Web Search', 'Google Docs'] },
]

export default function WorkflowsMainPage() {
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast()
  const [prompt, setPrompt] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [view, setView] = useState<'browse' | 'synthesizing' | 'review' | 'running'>('browse')
  
  // State for synthesis
  const [config, setConfig] = useState<any>(null)
  const [thinking, setThinking] = useState<string[]>([])
  
  // State for execution
  const [currentWorkflow, setCurrentWorkflow] = useState<any>(null)
  const [currentAgents, setCurrentAgents] = useState<any[]>([])
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [steps, setSteps] = useState<any[]>([])
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [finalOutput, setFinalOutput] = useState<Record<string, any> | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const activeWorkflowIdRef = useRef<string | null>(null) // persists across re-renders for RESTART

  const filteredCards = activeCategory === 'All' 
    ? WORKFLOW_CARDS 
    : WORKFLOW_CARDS.filter(c => c.category === activeCategory)

  // 1. Handle Synthesis
  const handleSynthesize = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;
    
    setView('synthesizing')
    setThinking([])
    
    try {
      const res = await api.workflows.parse(prompt)
      setConfig(res)
      
      // Simulate thinking lines
      const lines = res.thinking.split('\n').filter(l => l.includes('→'))
      for (let i = 0; i < lines.length; i++) {
        setThinking(prev => [...prev, lines[i]])
        await new Promise(r => setTimeout(r, 600))
      }
      
      setView('review')
    } catch (err: any) {
      toastError("Synthesis failed", err.message)
      setView('browse')
    }
  }

  // 2. Handle Creation
  const handleDeploy = async () => {
    // Validate all required inputs before deploy
    const missingRequired = (config?.missing_inputs || []).filter(
      (m: any) => m.required && !inputs[m.field]?.trim()
    )
    if (missingRequired.length > 0) {
      toastError('Missing Required Inputs', `Please fill: ${missingRequired.map((m: any) => m.field).join(', ')}`)
      return
    }
    try {
      const res = await api.workflows.create({
        name: config?.workflow_name || 'Untitled Workflow',
        prompt: prompt,
        type: config?.workflow_type || 'general',
        agents: config?.agents || []
      })
      setCurrentWorkflow(res.workflow)
      setCurrentAgents(res.agents)
      setView('running')
      if ((config?.missing_inputs?.length || 0) === 0 || Object.keys(inputs).length > 0) {
        handleRun(res.workflow.id)
      }
    } catch (err: any) {
      toastError('Deployment failed', err.message)
    }
  }

  // 3. Handle Execution & SSE
  const handleRun = async (workflowId: string) => {
    if (!workflowId) {
      toastError('No workflow', 'Cannot restart: workflow ID is missing.')
      return
    }
    activeWorkflowIdRef.current = workflowId // persist for RESTART
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    setLogs([])
    setSteps([])
    setFinalOutput(null) // clear previous output on each run
    setView('running')
    
    try {
      const { run_id } = await api.workflows.run(workflowId, inputs)
      setCurrentRunId(run_id)
      
      // Connect to SSE with token in query string (EventSource doesn't support headers)
      const session = await getSession()
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const streamUrl = `${baseUrl}/workflows/${workflowId}/runs/${run_id}/stream?token=${session?.token || ''}`
      
      const eventSource = new EventSource(streamUrl, {
        withCredentials: true
      })
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        // Add to logs
        const newLog: LogEntry = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          type: data.type === 'agent_error' ? 'error' : 
                data.type === 'agent_done' ? 'success' :
                data.type === 'agent_start' ? 'agent' : 'info',
          message: data.message,
          data: data.output_summary ? { summary: data.output_summary } : null
        }
        setLogs(prev => [...prev, newLog])

        // Update pipeline steps
        if (data.type === 'agent_start') {
          setSteps(prev => [...prev, { 
            agent_id: data.agent_id, 
            status: 'running', 
            step_number: data.step 
          }])
        } else if (data.type === 'agent_done') {
          setSteps(prev => prev.map(s => 
            s.agent_id === data.agent_id ? { ...s, status: 'completed', duration_ms: data.duration_ms } : s
          ))
        } else if (data.type === 'agent_error') {
          setSteps(prev => prev.map(s => 
            s.agent_id === data.agent_id ? { ...s, status: 'failed' } : s
          ))
        }

        if (data.type === 'workflow_done') {
          setFinalOutput(data.outputs || {})
          setLogs(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            type: 'success',
            message: data.message || '✅ Workflow complete',
            data: null
          }])
          eventSource.close()
        } else if (data.type === 'workflow_error') {
          setLogs(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            type: 'error',
            message: data.message || '✗ Workflow failed',
            data: null
          }])
          eventSource.close()
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
      }

    } catch (err: any) {
      toastError("Execution failed", err.message)
    }
  }

  // VIEW: SYNTHESIZING
  if (view === 'synthesizing') {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center space-y-8 p-8">
        <div className="relative">
           <div className="w-24 h-24 rounded-full border border-border flex items-center justify-center bg-surface shadow-xs">
              <div className="w-16 h-16 rounded-full border-2 border-t-signal-blue border-r-transparent border-b-transparent border-l-transparent animate-spin duration-[1.5s]" />
           </div>
           <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles size={24} className="text-signal-blue animate-pulse" />
           </div>
        </div>

        <div className="text-center space-y-4 max-w-md w-full">
           <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Autonomous Orchestration</h2>
           <div className="space-y-2 text-left bg-surface border border-border p-6 rounded-lg min-h-[160px] shadow-xs">
              {thinking.map((line, i) => (
                <div key={i} className="text-xs font-mono text-signal-blue animate-in slide-in-from-bottom-1 duration-500">
                  {line}
                </div>
              ))}
              <div className="w-1.5 h-3.5 bg-signal-blue animate-pulse inline-block ml-1 align-middle" />
           </div>
        </div>
      </div>
    )
  }

  // VIEW: REVIEW
  if (view === 'review' && config) {
    return (
      <div className="flex flex-col h-full bg-background p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto w-full space-y-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between border-b border-border pb-4">
             <div className="space-y-1">
                <div className="text-xs font-bold text-signal-blue uppercase tracking-wider">Manifest Ready</div>
                <h3 className="text-xl font-bold text-primary">{config.workflow_name}</h3>
             </div>
             <button 
               onClick={() => setView('browse')}
               className="text-xs font-semibold text-muted hover:text-primary transition-all cursor-pointer px-3 py-1.5 rounded-md hover:bg-secondary"
             >
                Discard
             </button>
          </div>
          
          <div className="grid grid-cols-3 gap-6">
             <div className="col-span-2 space-y-4">
                <div className="space-y-3">
                   <div className="text-xs font-bold text-secondary uppercase tracking-wider">Execution Pipeline</div>
                   <div className="space-y-2.5">
                      {config?.agents?.map((a: any) => (
                        <div key={a.position} className="p-4 bg-surface border border-border rounded-lg flex items-start gap-4 group hover:border-signal-blue/40 transition-all shadow-xs">
                           <div className="w-9 h-9 rounded-md bg-secondary border border-border flex items-center justify-center shrink-0">
                              <Bot size={18} className="text-primary" />
                           </div>
                           <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                 <div className="text-xs font-bold text-primary">{a.name}</div>
                                 <div className="text-[11px] font-semibold text-signal-blue">{a.role}</div>
                              </div>
                              <p className="text-xs text-muted leading-relaxed">{a.description}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             <div className="space-y-4">
                <div className="p-5 bg-surface border border-border rounded-lg space-y-5 shadow-xs">
                   <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                      <Settings size={14} className="text-signal-blue" /> Signal Inputs
                   </div>
                   {(config?.missing_inputs?.length || 0) > 0 ? (
                      <div className="space-y-3.5">
                         {config.missing_inputs.map((m: any) => {
                           const isMissing = m.required && !inputs[m.field]?.trim()
                           const isFileType = m.type === 'file' || m.question?.toLowerCase().includes('upload') || m.question?.toLowerCase().includes('csv') || m.question?.toLowerCase().includes('pdf')
                           return (
                           <div key={m.field} className="space-y-1.5">
                              <label className="flex items-center gap-1.5 text-xs font-semibold">
                                <span className={isMissing ? 'text-signal-red' : 'text-secondary'}>{m.question}</span>
                                {m.required && <span className="text-signal-red">*</span>}
                              </label>
                              {isFileType ? (
                                <div className="relative group cursor-pointer">
                                  <input 
                                    type="file"
                                    accept=".csv,.pdf,.xlsx,.txt,.docx"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) {
                                        const reader = new FileReader()
                                        reader.onload = () => setInputs(prev => ({ ...prev, [m.field]: reader.result as string, [`${m.field}_name`]: file.name }))
                                        reader.readAsDataURL(file)
                                      }
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  />
                                  <div className={`w-full border border-dashed rounded-md px-4 py-4 text-center transition-all flex flex-col items-center gap-1.5 ${isMissing ? 'border-signal-red/50 bg-signal-red-bg' : 'border-border group-hover:border-signal-blue bg-subtle'}`}>
                                    <Upload size={16} className={inputs[m.field] ? 'text-signal-blue' : isMissing ? 'text-signal-red' : 'text-muted'} />
                                    <span className={`text-xs font-semibold ${inputs[`${m.field}_name`] ? 'text-signal-blue' : isMissing ? 'text-signal-red' : 'text-muted'}`}>
                                      {inputs[`${m.field}_name`] || 'Upload CSV, PDF, Excel or Text file'}
                                    </span>
                                    <span className="text-[10px] text-muted">csv · pdf · xlsx · txt · docx</span>
                                  </div>
                                </div>
                              ) : (
                                <input 
                                  value={inputs[m.field] || ''}
                                  onChange={(e) => setInputs(prev => ({ ...prev, [m.field]: e.target.value }))}
                                  className={`w-full bg-surface border rounded-md px-3.5 py-2 text-primary text-xs outline-none transition-all ${isMissing ? 'border-signal-red focus:ring-1 focus:ring-signal-red' : 'border-border focus:border-signal-blue focus:ring-1 focus:ring-signal-blue'}`}
                                  placeholder={`Enter ${m.field}...`}
                                />
                              )}
                           </div>
                         )})}
                      </div>
                    ) : (
                      <div className="text-xs text-muted font-medium italic">No manual inputs required. All signals autocalibrated.</div>
                    )}

                    {(config?.missing_inputs || []).some((m: any) => m.required && !inputs[m.field]?.trim()) && (
                      <div className="text-xs text-signal-red font-semibold text-center mt-2">
                        Fill all required fields (*) before deploying
                      </div>
                    )}
                    <button 
                      onClick={handleDeploy}
                      className="w-full py-2.5 bg-action-primary text-action-primary-text rounded-md text-xs font-semibold hover:bg-action-primary-hover transition-all shadow-xs flex items-center justify-center gap-2 mt-3 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                       <Zap size={14} fill="currentColor" /> Initiate Deployment
                    </button>
                 </div>
              </div>
          </div>
        </div>
      </div>
    )
  }

  // VIEW: RUNNING
  if (view === 'running') {
    return (
      <div className="flex flex-col h-full bg-background p-8 overflow-hidden">
        <div className="max-w-6xl mx-auto w-full h-full flex flex-col space-y-6 animate-in fade-in duration-500">
           {/* HEADER */}
           <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
              <div className="flex items-center gap-3.5">
                 <div className="w-9 h-9 rounded-md bg-action-primary text-action-primary-text flex items-center justify-center shadow-xs">
                    <WorkflowIcon size={18} />
                 </div>
                 <div>
                    <div className="text-xs font-bold text-signal-blue uppercase tracking-wider">Live Pipeline</div>
                    <h3 className="text-base font-bold text-primary">{currentWorkflow?.name}</h3>
                 </div>
              </div>
              <div className="flex items-center gap-2.5">
                 <button 
                   onClick={() => {
                     if (eventSourceRef.current) {
                       eventSourceRef.current.close()
                       eventSourceRef.current = null
                     }
                     setView('browse')
                   }}
                   className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-secondary hover:text-primary hover:bg-subtle transition-all cursor-pointer"
                 >
                    Exit Runtime
                 </button>
                  <button 
                    onClick={() => {
                      const wfId = activeWorkflowIdRef.current || currentWorkflow?.id
                      if (!wfId) { toastError('Error', 'Workflow not found — please re-deploy.'); return }
                      setFinalOutput(null)
                      handleRun(wfId)
                    }}
                    className="px-4 py-2 bg-action-primary text-action-primary-text rounded-md text-xs font-semibold hover:bg-action-primary-hover transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                     <Play size={12} fill="currentColor" /> Restart
                  </button>
              </div>
           </div>

           {/* VISUALIZER */}
           <div className="bg-surface border border-border rounded-lg p-6 shrink-0 shadow-xs">
              <PipelineVisualizer agents={currentAgents} steps={steps} />
           </div>

           {/* LOGS */}
           <div className="flex-1 min-h-0">
              <ActivityLog logs={logs} />
           </div>

           {/* FINAL OUTPUT PANEL */}
           {finalOutput && Object.keys(finalOutput).length > 0 && (
             <div className="shrink-0 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-500">
               <div className="text-xs font-bold text-signal-blue uppercase tracking-wider flex items-center gap-2">
                 <Zap size={12} fill="currentColor" /> Final Output
               </div>
               {Object.entries(finalOutput).filter(([k]) => !k.startsWith('agent_')).map(([agentName, output]: [string, any]) => {
                 const content = output?.data?.content || output?.summary || ''
                 if (!content) return null
                 return (
                   <div key={agentName} className="bg-surface border border-border rounded-lg p-5 space-y-2 shadow-xs">
                     <div className="flex items-center justify-between">
                       <div className="text-xs font-bold text-signal-blue">{agentName}</div>
                       <button
                         onClick={() => { navigator.clipboard.writeText(content); toastSuccess('Copied!') }}
                         className="text-[11px] font-semibold text-muted hover:text-primary uppercase tracking-wider transition-all px-2 py-1 rounded hover:bg-secondary cursor-pointer"
                       >Copy</button>
                     </div>
                     <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap">{content}</p>
                   </div>
                 )
               })}
             </div>
           )}
        </div>
      </div>
    )
  }

  // VIEW: BROWSE
  return (
    <div className="flex flex-col h-full bg-background text-primary font-sans selection:bg-accent/30 overflow-y-auto custom-scrollbar">
      <div className="max-w-[1000px] mx-auto w-full px-6 py-16 space-y-14">
        
        {/* HERO */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-signal-blue-bg border border-signal-blue-border text-signal-blue text-xs font-bold uppercase tracking-wider">
             <Zap size={12} fill="currentColor" /> Autonomous Engine
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary max-w-2xl mx-auto leading-tight">
            Deploy an autonomous workforce in seconds.
          </h1>
          <p className="text-secondary text-sm md:text-base font-normal max-w-xl mx-auto leading-relaxed">
            Describe your mission. We'll architect the logic, provision the agents, and execute the pipeline end-to-end.
          </p>

          <form onSubmit={handleSynthesize} className="relative max-w-3xl mx-auto mt-8">
            <div className="relative">
              <textarea
                className="w-full bg-surface border border-border hover:border-border-focus focus:border-signal-blue focus:ring-1 focus:ring-signal-blue rounded-xl px-6 py-5 text-primary text-sm md:text-base resize-none outline-none transition-all placeholder:text-muted shadow-xs min-h-[130px]"
                placeholder="Describe a mission for your AI team..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSynthesize();
                  }
                }}
              />
              <div className="absolute bottom-4 right-4 flex items-center gap-3">
                 <div className="text-xs font-medium text-muted hidden sm:block">
                   Press Enter to Initiate
                 </div>
                 <button 
                   type="submit"
                   disabled={!prompt.trim()}
                   className="w-10 h-10 bg-action-primary hover:bg-action-primary-hover disabled:bg-secondary disabled:text-muted text-action-primary-text rounded-lg flex items-center justify-center transition-all disabled:cursor-not-allowed shadow-xs cursor-pointer"
                 >
                   <ArrowRight size={18} />
                 </button>
              </div>
            </div>
          </form>
        </div>

        {/* TEMPLATES */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="space-y-1 text-left">
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Mission Blueprints</h3>
                <p className="text-xs text-muted">Pre-calibrated orchestration templates</p>
             </div>
             <div className="flex flex-wrap items-center justify-center gap-1.5">
               {CATEGORIES.map(cat => (
                 <button
                   key={cat}
                   onClick={() => setActiveCategory(cat)}
                   className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                     activeCategory === cat 
                     ? 'bg-action-primary text-action-primary-text shadow-xs' 
                     : 'bg-surface text-secondary border border-border hover:bg-subtle hover:text-primary'
                   }`}
                 >
                   {cat}
                 </button>
               ))}
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCards.map((card, idx) => (
              <button 
                key={idx}
                onClick={() => setPrompt(card.desc)}
                className="group bg-surface border border-border hover:border-signal-blue/40 rounded-lg p-5 text-left transition-all hover:bg-subtle flex flex-col h-full relative cursor-pointer shadow-xs"
              >
                <div className="mb-4">
                   <div className="w-10 h-10 rounded-md bg-secondary border border-border flex items-center justify-center text-primary group-hover:bg-action-primary group-hover:text-action-primary-text transition-all">
                      <card.icon size={18} />
                   </div>
                </div>

                <div className="space-y-2 mt-auto">
                   <div className="inline-flex text-[11px] font-bold text-signal-blue uppercase tracking-wider">{card.category}</div>
                   <h3 className="text-sm font-bold text-primary group-hover:text-signal-blue transition-colors">
                     {card.title}
                   </h3>
                   <p className="text-xs text-muted font-normal leading-relaxed">
                     {card.desc}
                   </p>
                   {card.platforms && (
                     <div className="flex flex-wrap gap-1.5 pt-2">
                       {card.platforms.map(p => (
                         <span key={p} className="px-2 py-0.5 rounded bg-secondary border border-border text-[10px] font-semibold text-secondary">
                           {p}
                         </span>
                       ))}
                     </div>
                   )}
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
