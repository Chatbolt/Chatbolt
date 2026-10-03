'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  FolderOpen, Plus, Play, Square, RefreshCw, Clock, CheckCircle2,
  AlertCircle, ChevronRight, FileText, Zap, Brain, Bot, Activity,
  ExternalLink, Trash2, Search, Workflow, XCircle, Loader2, Calendar,
  Database, UserCheck, ShieldAlert, BadgeDollarSign, Heart, ChevronDown,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'

const RUN_STATUS_MAP: Record<string, { label: string; color: string; badge: string }> = {
  COMPLETED: { label: 'Completed', color: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  EXECUTING: { label: 'Running', color: 'text-sky-700', badge: 'bg-sky-50 text-sky-800 border-sky-300' },
  PLANNING: { label: 'Planning', color: 'text-purple-700', badge: 'bg-purple-50 text-purple-800 border-purple-300' },
  WAITING: { label: 'Awaiting Approval', color: 'text-amber-700', badge: 'bg-amber-50 text-amber-900 border-amber-300' },
  FAILED: { label: 'Failed', color: 'text-red-700', badge: 'bg-red-50 text-red-900 border-red-300' },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-700', badge: 'bg-gray-100 text-gray-700 border-gray-300' },
}

const AGENT_STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  idle: { label: 'Idle / Ready', color: 'text-gray-600', dot: 'bg-gray-500' },
  running: { label: 'Running Task', color: 'text-sky-700', dot: 'bg-sky-600 animate-pulse' },
  waiting: { label: 'Approval Required', color: 'text-amber-800', dot: 'bg-amber-600' },
  paused: { label: 'Paused', color: 'text-gray-500', dot: 'bg-gray-400' },
  blocked: { label: 'Budget Exhausted', color: 'text-red-700', dot: 'bg-red-600' },
  failed: { label: 'Failed', color: 'text-red-700', dot: 'bg-red-600' },
  completed: { label: 'Completed', color: 'text-emerald-700', dot: 'bg-emerald-600' },
}

type Workspace = { id: string; name: string }
type Project = { id: string; name: string; description?: string }
type AgentHeartbeat = {
  agent_id: string
  name: string
  role: string
  status: string
  budget_allocated: string
  budget_spent: string
  last_seen: string | null
  current_task_id: string | null
}

type WorkflowRun = {
  id: string
  workflow_id: string
  workflow_name?: string
  status: string
  created_at: string
  completed_at?: string
  final_output?: any
  inputs?: any
}

export default function WorkspacePage() {
  const { error: toastError, success: toastSuccess } = useToast()
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  const [heartbeats, setHeartbeats] = useState<AgentHeartbeat[]>([])
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [consoleMode, setConsoleMode] = useState<'simple' | 'expert' | 'developer'>('simple')
  const [artifacts, setArtifacts] = useState<any[]>([])
  const [artifactsLoading, setArtifactsLoading] = useState(false)
  const [selectedArtifact, setSelectedArtifact] = useState<any | null>(null)

  const [observatoryData, setObservatoryData] = useState({
    cumulativeSpend: 0.0435,
    laborTimeSaved: 2.4,
    netRoi: 71.95,
    orgsAndUsersCount: 12,
    cSuiteDecisionsCount: 34,
    vectorChunksCount: 156,
    ceoStatus: 'DELEGATING',
    ctoStatus: 'AUTHORIZED',
    cfoLimit: '$15.00 MAX'
  })

  const [showCreateProjModal, setShowCreateProjModal] = useState(false)
  const [newProjName, setNewProjName] = useState('')
  const [newProjDesc, setNewProjDesc] = useState('')

  // 1. Load Workspaces
  useEffect(() => {
    async function loadWorkspaces() {
      try {
        const res = await api.workspaces.list()
        const wsList = res.workspaces || []
        setWorkspaces(wsList)
        if (wsList.length > 0) {
          setSelectedWorkspaceId(wsList[0].id)
        }
      } catch (err: any) {
        toastError('Failed to load workspaces', err.message)
      }
    }
    loadWorkspaces()
  }, [])

  // 2. Load Projects
  useEffect(() => {
    if (!selectedWorkspaceId) return
    async function loadProjects() {
      try {
        const res = await api.workspaces.listProjects(selectedWorkspaceId)
        const projList = res.projects || []
        setProjects(projList)
        if (projList.length > 0) {
          setSelectedProjectId(projList[0].id)
        } else {
          setSelectedProjectId('')
          setRuns([])
        }
      } catch (err: any) {
        toastError('Failed to load projects', err.message)
      }
    }
    loadProjects()
  }, [selectedWorkspaceId])

  // 3. Load Metrics
  const loadProjectMetrics = useCallback(async () => {
    if (!selectedProjectId) return
    try {
      setLoading(true)
      const runsRes = await api.workflows.listRuns({ limit: 40 }).catch(() => ({ runs: [] }))
      const allRuns: WorkflowRun[] = runsRes.runs || []
      setRuns(allRuns)

      const hbRes = await api.workspaces.listHeartbeats().catch(() => ({ heartbeats: [] }))
      setHeartbeats(hbRes.heartbeats || [])
    } catch (err: any) {
      toastError('Failed to load metrics', err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => {
    loadProjectMetrics()
  }, [selectedProjectId, loadProjectMetrics])

  // Load artifacts
  useEffect(() => {
    if (!selectedProjectId) { setArtifacts([]); return }
    setArtifactsLoading(true)
    api.artifacts.list(selectedProjectId)
      .then(res => setArtifacts(res.artifacts || []))
      .catch(() => setArtifacts([]))
      .finally(() => setArtifactsLoading(false))
  }, [selectedProjectId])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkspaceId) return
    try {
      await api.workspaces.createProject(selectedWorkspaceId, {
        name: newProjName,
        description: newProjDesc,
        status: 'active'
      })
      toastSuccess('Project created successfully')
      setShowCreateProjModal(false)
      setNewProjName('')
      setNewProjDesc('')
      
      const res = await api.workspaces.listProjects(selectedWorkspaceId)
      setProjects(res.projects || [])
    } catch (err: any) {
      toastError('Failed to create project', err.message)
    }
  }

  const filteredRuns = runs.filter(r => {
    const matchesSearch = !search || (r.workflow_name || '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !statusFilter || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const activeAgentCount = heartbeats.filter(h => h.status === 'running').length
  const blockedAgentCount = heartbeats.filter(h => h.status === 'blocked').length

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
            <FolderOpen size={16} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-primary">Workspace Library & Project Manifest</h1>
            <p className="text-xs text-secondary mt-0.5">
              Supervise active task runs, deliverable files, and project agent fleets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadProjectMetrics}>
            <RefreshCw size={13} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreateProjModal(true)}>
            <Plus size={13} className="mr-1.5" />
            New Project
          </Button>
        </div>
      </div>

      {/* Scope Filter Controls */}
      <div className="bg-surface border border-border rounded-[6px] p-3.5 flex items-center justify-between flex-wrap gap-4 shadow-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-secondary">Workspace</span>
            <select 
              value={selectedWorkspaceId} 
              onChange={e => setSelectedWorkspaceId(e.target.value)}
              className="bg-white border border-border text-xs text-primary rounded-[6px] px-2.5 py-1.5 outline-none focus:border-sky-600 cursor-pointer"
            >
              {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-secondary">Project</span>
            <select 
              value={selectedProjectId} 
              onChange={e => setSelectedProjectId(e.target.value)}
              className="bg-white border border-border text-xs text-primary rounded-[6px] px-2.5 py-1.5 outline-none focus:border-sky-600 min-w-[140px] cursor-pointer"
              disabled={projects.length === 0}
            >
              {projects.length === 0 ? (
                <option value="">No Projects</option>
              ) : (
                projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
              )}
            </select>
          </div>

          {/* Console Mode Selector */}
          <div className="flex items-center gap-1 pl-4 border-l border-border">
            {(['simple', 'expert', 'developer'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setConsoleMode(mode)}
                className={`px-2.5 py-1 rounded-[5px] text-xs font-semibold transition-all border outline-none cursor-pointer capitalize ${
                  consoleMode === mode
                    ? 'bg-action-primary text-white border-action-primary'
                    : 'bg-white border-border text-secondary hover:text-primary'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {selectedWorkspaceId && (
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setShowCreateProjModal(true)}
          >
            <Plus size={12} className="mr-1" /> Create Project
          </Button>
        )}
      </div>

      {/* Metrics Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-[6px] p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <span className="text-xs font-semibold text-secondary flex items-center gap-1.5">
              <BadgeDollarSign size={14} className="text-sky-700" /> Cost Intelligence
            </span>
            <StatusBadge status="nominal" label="Active" size="sm" />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-secondary">Cumulative Spend</span>
              <span className="text-base font-bold text-primary tabular-nums font-mono">${observatoryData.cumulativeSpend.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-secondary">Labor Time Saved</span>
              <span className="text-xs font-bold text-emerald-700 tabular-nums font-mono">{observatoryData.laborTimeSaved.toFixed(1)} hrs</span>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-[6px] p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <span className="text-xs font-semibold text-secondary flex items-center gap-1.5">
              <Brain size={14} className="text-purple-700" /> Memory Graph
            </span>
            <StatusBadge status="active" label="Syncing" size="sm" pulse />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-secondary">Entities & Orgs</span>
              <span className="text-xs font-bold text-primary tabular-nums font-mono">{observatoryData.orgsAndUsersCount} nodes</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-secondary">Vector Chunks</span>
              <span className="text-xs font-bold text-emerald-700 tabular-nums font-mono">{observatoryData.vectorChunksCount} embeddings</span>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-[6px] p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <span className="text-xs font-semibold text-secondary flex items-center gap-1.5">
              <Bot size={14} className="text-primary" /> Active Swarm Fleet
            </span>
            <span className="text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-[4px]">
              {activeAgentCount} Running
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-secondary">CTO Technical Gate</span>
              <span className="text-xs font-bold text-emerald-700">{observatoryData.ctoStatus}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-secondary">CFO Cost Limit</span>
              <span className="text-xs font-bold text-secondary font-mono">{observatoryData.cfoLimit}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Task Runs Manifest Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-primary tracking-tight">Project Task Manifest & Workflow Runs</h2>
          <span className="text-[11px] text-muted">{runs.length} runs recorded</span>
        </div>

        <div className="bg-surface border border-border rounded-[6px] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-surface-subtle border-b border-border text-[11px] font-semibold text-secondary">
                <tr>
                  <th className="py-2.5 px-4">Workflow Task Name</th>
                  <th className="py-2.5 px-4">Run ID</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Created At</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted italic">
                      No workflow runs logged for this project yet.
                    </td>
                  </tr>
                ) : (
                  filteredRuns.map((run) => {
                    const statusMeta = RUN_STATUS_MAP[run.status] || RUN_STATUS_MAP.COMPLETED
                    return (
                      <tr key={run.id} className="border-b border-border-subtle last:border-0 hover:bg-surface-subtle transition-colors">
                        <td className="py-3 px-4 font-semibold text-primary">
                          {run.workflow_name || 'Autonomous Task Run'}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted text-[11px]">
                          #{run.id.slice(0, 8)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border text-[11px] font-semibold ${statusMeta.badge}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-secondary tabular-nums">
                          {new Date(run.created_at).toLocaleDateString()} {new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link href="/dashboard/terminal" className="no-underline">
                            <Button variant="outline" size="sm" className="h-7 text-[11px]">
                              Inspect Stream
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Generated Artifacts Library */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-primary tracking-tight">Generated Artifacts & Files</h2>
          <span className="text-[11px] text-muted">{artifacts.length} files saved</span>
        </div>

        {artifacts.length === 0 ? (
          <div className="bg-surface border border-border rounded-[6px] p-6 text-center text-xs text-muted italic">
            No deliverable files generated yet. Run a workflow in the terminal to produce output artifacts.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {artifacts.map((art) => (
              <div 
                key={art.id}
                onClick={() => setSelectedArtifact(art)}
                className="bg-surface border border-border rounded-[6px] p-3.5 flex items-center justify-between hover:border-slate-400 transition-all cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-[5px] bg-surface-subtle border border-border flex items-center justify-center text-primary shrink-0">
                    <FileText size={15} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-primary truncate">{art.name}</h3>
                    <p className="text-[10px] text-muted font-mono uppercase">{art.artifact_type || 'Document'}</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-secondary shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Artifact Preview Modal */}
      {selectedArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setSelectedArtifact(null)} />
          <div className="bg-white border border-border rounded-[8px] max-w-2xl w-full p-6 relative z-10 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                <h3 className="text-xs font-bold text-primary">{selectedArtifact.name}</h3>
              </div>
              <button onClick={() => setSelectedArtifact(null)} className="text-secondary hover:text-primary cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-surface-subtle border border-border rounded-[6px] p-4 font-mono text-xs text-primary whitespace-pre-wrap">
              {selectedArtifact.content || 'No text content available.'}
            </div>
            <div className="pt-2 flex justify-end gap-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setSelectedArtifact(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setShowCreateProjModal(false)} />
          <form onSubmit={handleCreateProject} className="bg-white border border-border rounded-[8px] max-w-md w-full p-6 relative z-10 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xs font-bold text-primary">Create Workspace Project</h3>
              <button type="button" onClick={() => setShowCreateProjModal(false)} className="text-secondary hover:text-primary cursor-pointer">
                <X size={15} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-primary block mb-1">Project Name</label>
                <input 
                  type="text" 
                  value={newProjName}
                  onChange={e => setNewProjName(e.target.value)}
                  placeholder="Competitor Research Q3..."
                  className="w-full bg-white border border-border rounded-[6px] px-3 py-2 text-xs text-primary outline-none focus:border-sky-600"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-primary block mb-1">Description</label>
                <textarea 
                  value={newProjDesc}
                  onChange={e => setNewProjDesc(e.target.value)}
                  placeholder="Describe the project scope and deliverables..."
                  className="w-full h-20 bg-white border border-border rounded-[6px] px-3 py-2 text-xs text-primary outline-none focus:border-sky-600 resize-none"
                />
              </div>
            </div>
            <div className="pt-2 flex justify-end gap-2 border-t border-border">
              <Button variant="outline" size="sm" type="button" onClick={() => setShowCreateProjModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Create Project
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
