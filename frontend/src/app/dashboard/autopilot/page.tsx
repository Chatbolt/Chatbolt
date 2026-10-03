'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { 
  Sparkles, 
  Rocket, 
  CheckCircle2, 
  Cpu, 
  Layers, 
  ShieldCheck, 
  Zap, 
  ArrowRight,
  Bot,
  Building2,
  Target,
  FileText,
  ChevronRight,
  Plus
} from 'lucide-react'

export default function AutopilotPage() {
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: Form, 2: Progress, 3: Success
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    company_type: '',
    description: '',
    goals: ''
  })
  const [generatedAgents, setGeneratedAgents] = useState<any[]>([])
  const [progressIndex, setProgressIndex] = useState(0)

  const progressSteps = [
    { title: 'Operational Blueprinting', desc: 'Analyzing business architecture & requirements' },
    { title: 'Agent Fleet Synthesis', desc: 'Assembling specialized functional personas' },
    { title: 'Knowledge Vector Mapping', desc: 'Partitioning operational data to vector index' },
    { title: 'Integration Linking', desc: 'Connecting APIs, webhooks, and communication relays' },
    { title: 'Fleet Verification', desc: 'Testing autonomy boundaries & execution gates' }
  ]

  useEffect(() => {
    if (step === 2) {
      const interval = setInterval(() => {
        setProgressIndex(i => {
          if (i >= progressSteps.length - 1) {
            clearInterval(interval)
            return i
          }
          return i + 1
        })
      }, 4000)
      return () => clearInterval(interval)
    }
  }, [step])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setStep(2)
    
    try {
      const result = await api.autopilot.generate(form)
      setGeneratedAgents(result.agents)
      
      setTimeout(() => {
        setStep(3)
      }, 20000) 
    } catch (err: any) {
      setError(err.message || 'Failed to initialize autopilot fleet')
      setStep(1)
      setLoading(false)
    }
  }

  if (step === 1) {
    return (
      <div className="min-h-full bg-background flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <div className="space-y-6">
             <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border text-primary rounded-md text-xs font-medium shadow-xs">
                <Sparkles size={13} className="text-secondary" /> Autonomous Workforce Provisioner
             </div>
             <h1 className="text-3xl font-bold text-primary tracking-tight leading-tight">
                Assemble your specialized agent team in minutes.
             </h1>
             <p className="text-sm text-secondary leading-relaxed">
                Provide your company domain and goals. Chatbolt will automatically configure, align, and orchestrate specialized agents to handle your operational workloads.
             </p>
             
             <div className="space-y-3 pt-4 border-t border-border">
                {[
                  { icon: Bot, text: 'Customer Support & Escalation Agents' },
                  { icon: Target, text: 'Lead Qualification & Data Enrichment' },
                  { icon: Zap, text: 'Instant API & Tool Mapping' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-md bg-surface border border-border flex items-center justify-center text-primary shrink-0 shadow-xs">
                        <item.icon size={15} />
                     </div>
                     <span className="text-xs font-semibold text-primary">{item.text}</span>
                  </div>
                ))}
             </div>
          </div>

          <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-800 text-xs font-medium">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-secondary flex items-center gap-1.5">
                   <Building2 size={13} /> Industry & Business Type
                </label>
                <input 
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs font-medium focus:border-border-strong focus:outline-none shadow-xs"
                  placeholder="e.g. B2B Enterprise SaaS or Logistics Provider"
                  value={form.company_type}
                  onChange={e => setForm(f => ({ ...f, company_type: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-secondary flex items-center gap-1.5">
                   <FileText size={13} /> Operational Workflow Overview
                </label>
                <textarea 
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs focus:border-border-strong focus:outline-none h-24 resize-none shadow-xs leading-relaxed"
                  placeholder="What key tasks and processes occur regularly?"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-secondary flex items-center gap-1.5">
                   <Target size={13} /> Autopilot Objectives
                </label>
                <textarea 
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs focus:border-border-strong focus:outline-none h-24 resize-none shadow-xs leading-relaxed"
                  placeholder="What specific tasks should the agents automate?"
                  value={form.goals}
                  onChange={e => setForm(f => ({ ...f, goals: e.target.value }))}
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-2.5 bg-action-primary text-action-primary-text hover:bg-action-primary-hover rounded-md font-medium text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? 'Initializing Autopilot...' : <><Rocket size={14} /> Provision Agent Fleet</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="min-h-full bg-background flex flex-col items-center justify-center p-8">
        <div className="max-w-xl w-full bg-surface rounded-xl p-8 shadow-md border border-border">
          
          {/* Progress Bar */}
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-8 border border-border">
            <div 
              className="h-full bg-action-primary rounded-full transition-all duration-500" 
              style={{ width: `${(progressIndex + 1) * 20}%` }} 
            />
          </div>
          
          <div className="text-center mb-8 space-y-1">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center text-primary mx-auto mb-3 border border-border shadow-xs">
              <Cpu size={24} />
            </div>
            <h2 className="text-lg font-bold text-primary tracking-tight">Synthesizing Agent Fleet</h2>
            <p className="text-xs text-muted">Configuring specialized runtime execution instances</p>
          </div>

          <div className="space-y-4">
            {progressSteps.map((s, i) => (
              <div key={i} className={`flex items-start gap-3.5 transition-all duration-300 ${i <= progressIndex ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 text-xs border ${
                  i < progressIndex 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                  : i === progressIndex ? 'bg-action-primary text-action-primary-text border-transparent animate-pulse' : 'bg-secondary border-border text-muted'
                }`}>
                  {i < progressIndex ? <CheckCircle2 size={13} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                </div>
                <div>
                   <div className={`text-xs font-semibold ${i === progressIndex ? 'text-primary' : 'text-secondary'}`}>{s.title}</div>
                   <div className="text-[11px] text-muted">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-3 bg-secondary/40 border border-border rounded-md text-xs text-muted text-center font-mono">
            Provisioning instances. Please remain on this screen.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background flex flex-col items-center py-12 px-6 overflow-y-auto">
      <div className="max-w-4xl w-full text-center space-y-3 mb-8">
        <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-center mx-auto shadow-xs">
          <Zap size={24} />
        </div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Agent Fleet Successfully Deployed</h1>
        <p className="text-xs text-secondary max-w-xl mx-auto">
          We have generated tailored agent personas based on your specifications. They are ready to test, refine, and dispatch.
        </p>
      </div>

      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {generatedAgents.map((a, idx) => (
          <div key={a.id || idx} className="bg-surface border border-border p-5 rounded-lg shadow-xs hover:border-border-strong transition-all flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 bg-secondary border border-border rounded-md flex items-center justify-center text-primary mb-3">
                 {a.icon || <Bot size={18} />}
              </div>
              <h3 className="text-sm font-semibold text-primary mb-1">{a.name}</h3>
              <p className="text-xs text-secondary leading-relaxed line-clamp-3 mb-4">
                 {a.description}
              </p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
               <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-medium">
                 Ready
               </span>
               <ChevronRight size={14} className="text-muted" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center pb-8">
        <Link 
          href="/dashboard/agents" 
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-action-primary text-action-primary-text no-underline rounded-md font-medium text-xs shadow-xs hover:bg-action-primary-hover transition-all cursor-pointer"
        >
          View Agents Fleet <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
