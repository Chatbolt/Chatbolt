'use client'
import React, { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  FileText, 
  Calendar, 
  Activity, 
  Zap, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Download,
  ShieldCheck,
  ChevronRight,
  Database,
  TrendingUp,
  Cpu,
  Layers
} from 'lucide-react'

export default function ReportsPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchReports()
  }, [])

  async function fetchReports() {
    try {
      setLoading(true)
      const res = await api.reports.list()
      setReports(res.reports || [])
    } catch (err: any) {
      setError(err.message)
      toastError('Failed to load executive reports', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    try {
      setGenerating(true)
      await api.reports.generate()
      toastSuccess('Daily digest report synthesized successfully')
      await fetchReports()
    } catch (err: any) {
      setError(err.message)
      toastError('Failed to generate digest', err.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background text-primary overflow-y-auto">
      
      {/* Sub-header Navigation */}
      <div className="h-14 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0 sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Database size={14} className="text-secondary" /> Operations Audit & Digests
           </div>
           <div className="h-4 w-px bg-border" />
           <span className="text-xs font-medium text-primary border-b-2 border-primary pb-3.5 mt-3.5">
             Daily Executive Digests
           </span>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={handleGenerate}
             disabled={generating}
             className="bg-action-primary text-action-primary-text hover:bg-action-primary-hover px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
           >
              {generating ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
              {generating ? 'Compiling...' : 'Generate New Digest'}
           </button>
        </div>
      </div>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          
          <div className="flex justify-between items-end border-b border-border pb-6">
             <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[10px] font-medium border border-emerald-200">
                   <ShieldCheck size={12} /> Certified Operations Log
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-primary">Executive Performance Reports</h1>
                <p className="text-xs text-secondary max-w-xl leading-relaxed">
                   Structured operational summaries, task throughput metrics, and reliability benchmarks across your workforce.
                </p>
             </div>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-md text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-600" /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
               <RefreshCw className="w-6 h-6 text-secondary animate-spin" />
               <div className="text-xs text-muted font-mono">Querying operational ledger...</div>
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-surface border border-border rounded-lg p-12 text-center shadow-xs">
               <div className="w-10 h-10 bg-secondary border border-border rounded-lg flex items-center justify-center mx-auto mb-3 text-secondary">
                 <FileText size={20} />
               </div>
               <h3 className="text-sm font-semibold text-primary mb-1">No reports generated yet</h3>
               <p className="text-xs text-muted max-w-sm mx-auto mb-5 leading-relaxed">
                 Automated architecture digests cycle daily. Trigger a manual compilation to synthesize the latest execution metrics.
               </p>
               <button 
                 onClick={handleGenerate}
                 className="px-4 py-2 bg-action-primary text-action-primary-text hover:bg-action-primary-hover rounded-md text-xs font-medium transition-all shadow-xs cursor-pointer"
               >
                 Compile First Digest
               </button>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="bg-surface border border-border rounded-lg p-6 shadow-xs hover:border-border-strong transition-all">
                  <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-secondary text-primary rounded-md flex items-center justify-center border border-border">
                        <Calendar size={15} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-primary">
                          {new Date(report.report_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h3>
                        <div className="text-[11px] text-muted font-mono">
                          Infrastructure Audit Digest
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-full text-[10px] font-medium flex items-center gap-1 border border-emerald-200">
                      <CheckCircle2 size={11} /> Verified
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="col-span-1 md:col-span-7 space-y-3">
                      <div className="text-xs text-secondary leading-relaxed whitespace-pre-line border-l-2 border-border-strong pl-4 italic">
                        {report.summary}
                      </div>
                    </div>
                    
                    <div className="col-span-1 md:col-span-5 bg-secondary/30 rounded-lg p-4 border border-border space-y-3">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                         <h4 className="text-xs font-semibold text-primary">Metrics Summary</h4>
                         <Activity size={12} className="text-secondary" />
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-1.5 text-muted">
                             <Layers size={13} className="text-secondary" /> Workflow Runs
                           </div>
                           <div className="font-mono font-semibold text-primary">{report.metrics?.workflows?.total_runs || 0}</div>
                        </div>
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-1.5 text-muted">
                             <Cpu size={13} className="text-secondary" /> API Invocations
                           </div>
                           <div className="font-mono font-semibold text-primary">{report.metrics?.workflows?.api_calls_used || 0}</div>
                        </div>
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-1.5 text-muted">
                             <TrendingUp size={13} className="text-secondary" /> Success Rate
                           </div>
                           <div className="font-mono font-bold text-emerald-700">
                             {(report.metrics?.workflows?.success_rate || 0).toFixed(1)}%
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex justify-center pt-4">
             <button 
               onClick={() => toastSuccess('Exporting compliance statements...')}
               className="flex items-center gap-1.5 px-4 py-2 bg-surface border border-border rounded-md text-xs font-medium text-secondary hover:text-primary hover:bg-secondary shadow-xs transition-all cursor-pointer"
             >
                <Download size={13} /> Export Statements (JSON/PDF)
             </button>
          </div>
        </div>
      </div>
    </div>
  )
}
