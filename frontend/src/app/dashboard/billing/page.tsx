'use client'
import { useEffect, useState } from 'react'
import { api, getSession } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  CreditCard, 
  Check, 
  ArrowUpRight, 
  History, 
  PieChart, 
  Zap, 
  Crown, 
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Gem,
  Cpu,
  Download,
  ExternalLink
} from 'lucide-react'

const plans = [
  { 
    id: 'pro', 
    name: 'Pro', 
    price: 25, 
    credits: '2,500', 
    agents: 3, 
    features: ['3 Orchestrated Assistants', '2,500 Neural Credits/mo', 'Web Research capabilities', 'WhatsApp + Email Engine', 'Standard API Access', 'Standard Support'], 
    highlight: true,
    desc: 'Professional grade automation.'
  },
  { 
    id: 'premium', 
    name: 'Premium', 
    price: 59, 
    credits: '10,000', 
    agents: 10, 
    features: ['10 Elite Assistants', '10,000 Neural Credits/mo', 'Custom Process Builder', 'Full API & Webhooks', 'Team Collaboration (3 seats)', 'Dedicated Success Manager'],
    desc: 'Enterprise workforce logic.'
  },
]

export default function BillingPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [credits, setCredits] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState('')

  useEffect(() => {
    getSession().then(s => setTenant(s?.tenant))
    api.billing.credits().then(r => { setCredits(r); setHistory(r.history || []) }).catch(() => {})
  }, [])

  async function checkout(plan: string) {
    setLoading(plan)
    try {
      const r = await api.billing.checkout(plan)
      window.location.href = r.url
    } catch (err: any) { 
      toastError('Checkout failed', err.message)
    } finally { 
      setLoading('') 
    }
  }

  async function openPortal() {
    try {
      const r = await api.billing.portal()
      window.location.href = r.url
    } catch (err: any) { 
      toastError('Failed to open billing portal', err.message)
    }
  }

  const currentPlan = credits?.plan || tenant?.plan || 'hobby'
  const used = (credits?.credits_monthly || 500) - (credits?.credits_remaining || 0)
  const pct = Math.min(100, Math.round((used / (credits?.credits_monthly || 500)) * 100))

  return (
    <div className="flex flex-col h-full bg-background text-primary overflow-y-auto">
      
      {/* Sub-header Navigation */}
      <div className="h-14 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0 sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <CreditCard size={15} className="text-secondary" /> Neural Economics & Ledger
           </div>
           <div className="h-4 w-px bg-border" />
           <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-primary border-b-2 border-primary pb-3.5 mt-3.5">
                Subscription & Quotas
              </span>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={openPortal}
             className="px-3 py-1.5 bg-surface border border-border rounded-md text-xs font-medium text-secondary hover:text-primary hover:bg-secondary transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
           >
              Stripe Customer Portal <ExternalLink size={12} />
           </button>
        </div>
      </div>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          
          <div className="flex justify-between items-end border-b border-border pb-6">
             <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[10px] font-medium border border-emerald-200">
                   <ShieldCheck size={12} /> Stripe Verified Ledger
                </div>
                <h1 className="text-2xl font-bold text-primary tracking-tight">Billing & Quota Management</h1>
                <p className="text-xs text-secondary max-w-xl leading-relaxed">
                   Manage your subscription tier, track token quotas, and scale inference capacity across your autonomous workforce.
                </p>
             </div>
          </div>

          {/* RESOURCE UTILIZATION CARD */}
          <div className="bg-surface border border-border p-6 rounded-lg shadow-xs relative overflow-hidden">
             <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                <div className="col-span-1 md:col-span-7 space-y-4">
                   <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-secondary border border-border flex items-center justify-center text-primary">
                         <PieChart size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-primary">Neural Quota Manifest</h3>
                        <p className="text-xs text-muted">Monthly inference tokens and execution cycles</p>
                      </div>
                   </div>
                   <p className="text-xs text-secondary leading-relaxed max-w-md">
                      Monthly credit allotment powers autonomous multi-step reasoning, vector searches, and live tool integrations.
                   </p>
                   <div className="flex gap-8 pt-2">
                      <div>
                         <div className="text-[11px] font-mono text-muted mb-0.5">Total Monthly Allotment</div>
                         <div className="text-lg font-bold font-mono text-primary">
                           {(credits?.credits_monthly ?? 0).toLocaleString()} <span className="text-xs font-normal text-muted">Credits</span>
                         </div>
                      </div>
                      <div>
                         <div className="text-[11px] font-mono text-muted mb-0.5">Operating Status</div>
                         <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border ${
                           pct > 90 ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                         }`}>
                            {pct > 90 ? 'Near Capacity' : 'Nominal Operations'}
                         </div>
                      </div>
                   </div>
                </div>

                <div className="col-span-1 md:col-span-5 md:text-right space-y-4">
                   <div className="space-y-0.5">
                      <div className="text-4xl font-bold font-mono text-primary tracking-tight">
                        {(credits?.credits_remaining ?? 0).toLocaleString()}
                      </div>
                      <div className="text-xs font-mono text-muted">Available Inference Credits</div>
                   </div>
                   <div className="space-y-2">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-border">
                         <div 
                           className={`h-full transition-all duration-500 rounded-full ${
                             pct > 80 ? 'bg-amber-500' : 'bg-emerald-600'
                           }`}
                           style={{ width: `${pct}%` }}
                         />
                      </div>
                      <div className="flex justify-between text-xs font-mono text-muted">
                         <span>{pct}% Consumed</span>
                         <span>Auto-resets next billing cycle</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* PRICING PLANS */}
          <div className="space-y-4">
             <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-semibold text-primary">Workforce Scaling Options</h2>
                <div className="flex items-center gap-2 px-2.5 py-1 bg-surface border border-border rounded-md shadow-xs">
                   <Gem size={13} className="text-amber-600" />
                   <span className="text-xs text-muted">Current Plan:</span>
                   <span className="text-xs font-semibold text-primary uppercase">{currentPlan} Tier</span>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map(p => (
                  <div 
                    key={p.id} 
                    className={`relative flex flex-col bg-surface border p-6 rounded-lg transition-all shadow-xs ${
                      p.highlight 
                      ? 'border-border-strong ring-1 ring-border-strong' 
                      : 'border-border'
                    }`}
                  >
                    {p.highlight && (
                      <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-action-primary text-action-primary-text text-[10px] font-medium rounded-bl-md shadow-xs">
                         Popular Option
                      </div>
                    )}

                    <div className="space-y-4 flex-1">
                       <div>
                          <h3 className="text-base font-bold text-primary">{p.name} Plan</h3>
                          <p className="text-xs text-muted mt-0.5">{p.desc}</p>
                       </div>

                       <div className="flex items-baseline gap-1 py-3 border-y border-border">
                          <span className="text-3xl font-bold font-mono text-primary">${p.price}</span>
                          <span className="text-xs text-muted">/ month</span>
                       </div>

                       <div className="space-y-2.5">
                          {p.features.map(f => (
                            <div key={f} className="flex items-start gap-2">
                               <Check size={14} className="text-emerald-700 mt-0.5 shrink-0" />
                               <span className="text-xs text-secondary leading-snug">{f}</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    <button 
                      className={`w-full py-2.5 mt-6 rounded-md text-xs font-medium transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                        p.highlight 
                        ? 'bg-action-primary text-action-primary-text hover:bg-action-primary-hover' 
                        : 'bg-surface border border-border text-primary hover:bg-secondary'
                      }`}
                      disabled={!!loading} 
                      onClick={() => checkout(p.id)}
                    >
                       {loading === p.id ? 'Connecting to Stripe...' : <><ArrowUpRight size={14} /> Provision {p.name}</>}
                    </button>
                  </div>
                ))}
                
                {/* ENTERPRISE CARD */}
                <div className="bg-surface border border-border p-6 rounded-lg shadow-xs flex flex-col justify-between">
                   <div className="space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                         <div className="p-1.5 rounded-md bg-secondary border border-border">
                           <Cpu size={16} />
                         </div>
                         <h3 className="text-base font-bold">Custom Cluster</h3>
                      </div>
                      <p className="text-xs text-secondary leading-relaxed">
                         High-volume distributed architecture with dedicated agent instances, private VPC deployment, and priority GPU inference nodes.
                      </p>
                   </div>
                   <button 
                     onClick={() => toastSuccess('Support ticket created. An enterprise specialist will contact you.')} 
                     className="w-full py-2.5 mt-6 bg-surface border border-border text-primary rounded-md text-xs font-medium hover:bg-secondary transition-all cursor-pointer shadow-xs"
                   >
                      Contact Enterprise Architect
                   </button>
                </div>
             </div>
          </div>

          {/* FINANCIAL HISTORY */}
          <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
             <div className="p-4 border-b border-border flex items-center justify-between bg-surface">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-md bg-secondary border border-border flex items-center justify-center text-primary">
                      <History size={16} />
                   </div>
                   <div>
                      <h3 className="text-xs font-semibold text-primary">Economic Transaction Ledger</h3>
                      <p className="text-[11px] text-muted">Audit log of resource injections and renewals</p>
                   </div>
                </div>
                <button 
                  onClick={() => toastSuccess('Downloading invoice statement...')}
                  className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary transition-colors cursor-pointer px-2.5 py-1 bg-secondary border border-border rounded-md shadow-xs"
                >
                   <Download size={12} /> Statement Export
                </button>
             </div>
             
             <div className="divide-y divide-border">
                {history.length === 0 ? (
                  <div className="p-12 text-center space-y-2 text-muted">
                     <TrendingUp size={24} className="mx-auto text-muted" />
                     <p className="text-xs font-medium text-secondary">No transaction records found</p>
                     <p className="text-[11px] text-muted">Invoices and credit additions will appear here automatically.</p>
                  </div>
                ) : history.slice(0, 5).map((h, i) => (
                  <div key={i} className="px-6 py-3.5 flex items-center justify-between hover:bg-secondary/40 transition-all">
                     <div className="flex items-center gap-3.5">
                        <div className="w-8 h-8 bg-secondary border border-border rounded-md flex items-center justify-center text-primary">
                           {h.amount > 0 ? <Zap size={14} className="text-emerald-700" /> : <Crown size={14} className="text-muted" />}
                        </div>
                        <div>
                           <div className="text-xs font-semibold text-primary">{h.description}</div>
                           <div className="text-[11px] text-muted">{new Date(h.created_at).toLocaleDateString()}</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className={`text-xs font-mono font-semibold ${h.amount > 0 ? 'text-emerald-700' : 'text-primary'}`}>
                           {h.amount > 0 ? '+' : ''}{h.amount.toLocaleString()} Credits
                        </div>
                        <ChevronRight size={14} className="text-muted" />
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
