'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  FileText, Plus, Lock, Unlock, Clock, History, CheckCircle2,
  AlertCircle, ChevronRight, Layers, Bot, Calendar, Eye, Loader2,
  Trash2, X, RefreshCw, Sparkles, Database, FileSpreadsheet,
  Tv, Clipboard, HelpCircle, HardDrive
} from 'lucide-react'

type Workspace = { id: string; name: string }
type Project = { id: string; name: string; description?: string }
type Artifact = {
  id: string
  name: string
  artifact_type: 'pdf' | 'spreadsheet' | 'presentation' | 'dataset' | 'brief' | 'website'
  locked_by_user_id: string | null
  locked_at: string | null
  metadata: {
    linked_agents: string[]
    linked_memory: string[]
    source_tasks: string[]
  }
  latest_version?: number
  latest_summary?: string
  created_at: string
}

type ArtifactVersion = {
  id: string
  version_number: number
  summary: string
  change_description?: string
  created_by: string
  created_at: string
}

export default function ArtifactsPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  
  // Scopes
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  
  // Artifact lists
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingScopes, setLoadingScopes] = useState(true)

  // Selected Artifact for explorer
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null)
  const [versions, setVersions] = useState<ArtifactVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  // Creation modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newArtifactName, setNewArtifactName] = useState('')
  const [newArtifactType, setNewArtifactType] = useState<Artifact['artifact_type']>('brief')

  // Version Commit modals
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [versionContents, setVersionContents] = useState('')
  const [versionDescription, setVersionDescription] = useState('')

  // Load scopes
  useEffect(() => {
    async function loadScopes() {
      try {
        setLoadingScopes(true)
        const res = await api.workspaces.list()
        const wsList = res.workspaces || []
        setWorkspaces(wsList)
        if (wsList.length > 0) {
          setSelectedWorkspaceId(wsList[0].id)
        }
      } catch (err: any) {
        toastError('Failed to load workspaces', err.message)
      } finally {
        setLoadingScopes(false)
      }
    }
    loadScopes()
  }, [])

  // Load projects when workspace changes
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
          setArtifacts([])
        }
      } catch (err: any) {
        toastError('Failed to load projects', err.message)
      }
    }
    loadProjects()
  }, [selectedWorkspaceId])

  // Load artifacts
  const loadArtifacts = useCallback(async () => {
    if (!selectedProjectId) return
    try {
      setLoading(true)
      const res = await api.artifacts.list(selectedProjectId)
      setArtifacts(res.artifacts || [])
    } catch (err: any) {
      toastError('Failed to load artifacts', err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => {
    loadArtifacts()
    setSelectedArtifact(null)
  }, [selectedProjectId, loadArtifacts])

  // Load version timeline for selected artifact
  const loadVersions = async (artifact: Artifact) => {
    try {
      setLoadingVersions(true)
      const res = await api.artifacts.versions(artifact.id)
      setVersions(res.versions || [])
    } catch (err: any) {
      toastError('Failed to load versions timeline', err.message)
    } finally {
      setLoadingVersions(false)
    }
  }

  const handleSelectArtifact = (art: Artifact) => {
    setSelectedArtifact(art)
    loadVersions(art)
  }

  // Create new first-class artifact
  const handleCreateArtifact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId) return
    try {
      await api.artifacts.create(selectedProjectId, {
        name: newArtifactName,
        artifact_type: newArtifactType,
        metadata: { linked_agents: [], linked_memory: [], source_tasks: [] }
      })
      toastSuccess('Artifact created successfully')
      setShowCreateModal(false)
      setNewArtifactName('')
      loadArtifacts()
    } catch (err: any) {
      toastError('Failed to create artifact', err.message)
    }
  }

  // Lock acquisition
  const handleLock = async (art: Artifact) => {
    try {
      const res = await api.artifacts.lock(art.id)
      toastSuccess(`Edit Lock acquired by: ${res.locked_by}`)
      
      const updatedArt = { ...art, locked_by_user_id: res.locked_by, locked_at: new Date().toISOString() }
      setSelectedArtifact(updatedArt)
      setArtifacts(prev => prev.map(a => a.id === art.id ? updatedArt : a))
    } catch (err: any) {
      toastError('Lock acquisition rejected', err.message)
    }
  }

  // Lock release
  const handleUnlock = async (art: Artifact) => {
    try {
      await api.artifacts.unlock(art.id)
      toastSuccess('Edit Lock released')

      const updatedArt = { ...art, locked_by_user_id: null, locked_at: null }
      setSelectedArtifact(updatedArt)
      setArtifacts(prev => prev.map(a => a.id === art.id ? updatedArt : a))
    } catch (err: any) {
      toastError('Lock release rejected', err.message)
    }
  }

  // Save new version
  const handleCommitVersion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedArtifact) return
    try {
      const nextVer = (selectedArtifact.latest_version || 0) + 1
      const res = await api.artifacts.saveVersion(selectedArtifact.id, {
        version_number: nextVer,
        raw_contents: versionContents,
        change_description: versionDescription
      })

      toastSuccess(`Version ${nextVer} committed! Cached semantic summary successfully.`)
      setShowVersionModal(false)
      setVersionContents('')
      setVersionDescription('')

      // Reload artifact info
      const updatedArt = { 
        ...selectedArtifact, 
        latest_version: nextVer, 
        latest_summary: res.summary,
        locked_by_user_id: null,
        locked_at: null
      }
      setSelectedArtifact(updatedArt)
      setArtifacts(prev => prev.map(a => a.id === selectedArtifact.id ? updatedArt : a))
      loadVersions(updatedArt)
    } catch (err: any) {
      toastError('Failed to commit version', err.message)
    }
  }

  const getTypeIcon = (type: Artifact['artifact_type']) => {
    switch (type) {
      case 'pdf': return <FileText className="text-signal-red" size={16} />
      case 'spreadsheet': return <FileSpreadsheet className="text-signal-green" size={16} />
      case 'presentation': return <Tv className="text-signal-blue" size={16} />
      case 'brief': return <Clipboard className="text-signal-amber" size={16} />
      case 'dataset': return <Database className="text-primary" size={16} />
      default: return <HardDrive className="text-muted" size={16} />
    }
  }

  return (
    <div className="flex flex-col h-full bg-background text-primary overflow-y-auto custom-scrollbar font-sans">

      {/* Header Panel */}
      <div className="h-14 border-b border-border bg-surface/90 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Layers size={16} className="text-signal-blue" />
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">Versioned Artifacts Explorer</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedProjectId && (
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-3.5 py-1.5 bg-action-primary text-action-primary-text rounded-md text-xs font-semibold hover:bg-action-primary-hover transition-all shadow-xs cursor-pointer">
              <Plus size={13} /> Create Artifact
            </button>
          )}
        </div>
      </div>

      {/* Scope Selectors */}
      <div className="bg-subtle border-b border-border px-6 py-3 flex items-center gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted">Workspace</span>
          <select 
            value={selectedWorkspaceId} 
            onChange={e => setSelectedWorkspaceId(e.target.value)}
            className="bg-surface border border-border text-xs text-primary rounded-md px-2.5 py-1.5 outline-none focus:border-signal-blue cursor-pointer shadow-xs"
          >
            {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted">Project</span>
          <select 
            value={selectedProjectId} 
            onChange={e => setSelectedProjectId(e.target.value)}
            className="bg-surface border border-border text-xs text-primary rounded-md px-2.5 py-1.5 outline-none focus:border-signal-blue min-w-[140px] cursor-pointer shadow-xs"
            disabled={projects.length === 0}
          >
            {projects.length === 0 ? (
              <option value="">No Projects</option>
            ) : (
              projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
            )}
          </select>
        </div>
      </div>

      {/* Dual Column Workspace layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Left Column: Artifacts list */}
        <div className="w-1/2 border-r border-border flex flex-col min-h-0 bg-subtle">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0 bg-surface">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">Project Assets ({artifacts.length})</span>
            <button onClick={loadArtifacts} className="p-1 bg-surface border border-border rounded text-muted hover:text-primary transition-all cursor-pointer">
              <RefreshCw size={12} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-signal-blue" size={20} />
              </div>
            ) : artifacts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto text-muted/60 mb-2" size={28} />
                <div className="text-muted text-xs font-medium">No versioned artifacts in this project.</div>
              </div>
            ) : (
              artifacts.map(art => {
                const isSelected = selectedArtifact?.id === art.id
                const isLocked = !!art.locked_by_user_id
                return (
                  <div
                    key={art.id}
                    onClick={() => handleSelectArtifact(art)}
                    className={`bg-surface border rounded-lg p-4 cursor-pointer hover:border-signal-blue/40 transition-all relative group shadow-xs ${
                      isSelected ? 'border-signal-blue ring-1 ring-signal-blue bg-signal-blue-bg/30' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary border border-border rounded-md">
                        {getTypeIcon(art.artifact_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-primary truncate flex items-center gap-2">
                          {art.name}
                          {isLocked && (
                            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-signal-amber-bg text-signal-amber border border-signal-amber-border rounded font-semibold">
                              <Lock size={9} /> locked
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted truncate mt-0.5">
                          Type: <span className="text-secondary font-medium uppercase font-mono">{art.artifact_type}</span> · Version: <span className="text-signal-blue font-bold">v{art.latest_version || 0}</span>
                        </div>
                      </div>
                    </div>
                    {art.latest_summary && (
                      <div className="mt-2.5 text-xs text-secondary bg-secondary p-2.5 rounded-md border border-border italic line-clamp-2">
                        {art.latest_summary}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Versions timeline & metadata panel */}
        <div className="w-1/2 flex flex-col min-h-0 bg-background">
          {selectedArtifact ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Header Details */}
              <div className="bg-surface border border-border rounded-lg p-5 space-y-4 shadow-xs">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-secondary border border-border rounded-md shrink-0">
                      {getTypeIcon(selectedArtifact.artifact_type)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-primary">{selectedArtifact.name}</h4>
                      <div className="text-xs text-muted uppercase font-mono mt-0.5">{selectedArtifact.artifact_type}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedArtifact.locked_by_user_id ? (
                      <button 
                        onClick={() => handleUnlock(selectedArtifact)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-signal-amber-bg text-signal-amber border border-signal-amber-border rounded-md text-xs font-semibold hover:bg-signal-amber/20 cursor-pointer"
                      >
                        <Unlock size={12} /> Release Lock
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleLock(selectedArtifact)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-surface border border-border text-secondary rounded-md text-xs font-semibold hover:text-primary hover:bg-subtle cursor-pointer shadow-xs"
                      >
                        <Lock size={12} /> Edit Lock
                      </button>
                    )}
                    
                    {(!selectedArtifact.locked_by_user_id || selectedArtifact.locked_by_user_id === 'agent') && (
                      <button
                        onClick={() => setShowVersionModal(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-action-primary text-action-primary-text rounded-md text-xs font-semibold hover:bg-action-primary-hover shadow-xs cursor-pointer"
                      >
                        <Plus size={12} /> Commit Version
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata tags */}
                <div className="border-t border-border pt-3.5 grid grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="text-muted font-semibold">Linked Agents</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedArtifact.metadata?.linked_agents?.length > 0 ? (
                        selectedArtifact.metadata.linked_agents.map((a, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-secondary text-secondary rounded border border-border text-[11px]">{a}</span>
                        ))
                      ) : (
                        <span className="text-muted italic">None linked</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-muted font-semibold">Linked Memory</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedArtifact.metadata?.linked_memory?.length > 0 ? (
                        selectedArtifact.metadata.linked_memory.map((m, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-secondary text-secondary rounded border border-border text-[11px]">{m}</span>
                        ))
                      ) : (
                        <span className="text-muted italic">None linked</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-muted font-semibold">Source Tasks</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedArtifact.metadata?.source_tasks?.length > 0 ? (
                        selectedArtifact.metadata.source_tasks.map((t, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-secondary text-secondary rounded border border-border text-[11px]">{t}</span>
                        ))
                      ) : (
                        <span className="text-muted italic">None linked</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Version History Log */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2">
                  <History size={15} className="text-signal-blue" />
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary">Immutable Rollback Timeline</span>
                </div>

                {loadingVersions ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="animate-spin text-muted" size={18} />
                  </div>
                ) : versions.length === 0 ? (
                  <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted text-xs shadow-xs">
                    No committed versions. Lock and save a draft to create version v1.
                  </div>
                ) : (
                  <div className="relative border-l-2 border-border ml-2 pl-6 space-y-4">
                    {versions.map(ver => (
                      <div key={ver.id} className="relative group">
                        {/* Timeline dot */}
                        <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-signal-blue border-2 border-surface shadow-xs" />
                        
                        <div className="bg-surface border border-border rounded-lg p-4 space-y-2 hover:border-signal-blue/40 transition-colors shadow-xs">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs font-bold text-primary">Version v{ver.version_number}</span>
                            <span className="text-xs text-muted font-mono">{new Date(ver.created_at).toLocaleString()}</span>
                          </div>
                          
                          {ver.change_description && (
                            <div className="text-xs text-signal-blue font-semibold bg-signal-blue-bg px-2.5 py-1 rounded border border-signal-blue-border inline-block">
                              {ver.change_description}
                            </div>
                          )}

                          <div className="text-xs text-secondary bg-subtle p-3 rounded-md border border-border space-y-1 font-mono leading-relaxed whitespace-pre-wrap">
                            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Cached Semantic Summary</div>
                            {ver.summary}
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted pt-1">
                            <span className="flex items-center gap-1"><Bot size={12} className="text-signal-blue" /> Author: {ver.created_by}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <FileText className="text-muted/50 mb-3" size={42} />
              <h4 className="text-primary font-bold mb-1 text-sm">Select an Artifact</h4>
              <p className="text-muted text-xs max-w-xs">Click on any artifact in the left column to view its immutable rollback timelines, edit locks, and semantic caches.</p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL: CREATE ARTIFACT */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowCreateModal(false)} />
          <form onSubmit={handleCreateArtifact} className="bg-surface border border-border rounded-lg max-w-md w-full p-6 relative z-10 space-y-4 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="text-signal-blue" size={16} />
                <span className="text-sm font-bold text-primary">Create First-Class Asset</span>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-muted hover:text-primary transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-secondary">Asset Title</label>
                <input 
                  type="text" 
                  value={newArtifactName}
                  onChange={e => setNewArtifactName(e.target.value)}
                  placeholder="Competitor pricing model brief..."
                  className="w-full bg-surface border border-border rounded-md px-3.5 py-2 text-xs text-primary outline-none focus:border-signal-blue focus:ring-1 focus:ring-signal-blue placeholder-muted"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-secondary">Asset Format Type</label>
                <select
                  value={newArtifactType}
                  onChange={e => setNewArtifactType(e.target.value as any)}
                  className="w-full bg-surface border border-border text-xs text-primary rounded-md px-3.5 py-2 outline-none focus:border-signal-blue cursor-pointer"
                >
                  <option value="pdf">PDF Document</option>
                  <option value="spreadsheet">Spreadsheet Ledger</option>
                  <option value="presentation">Presentation Deck</option>
                  <option value="brief">Knowledge Brief / Memo</option>
                  <option value="dataset">Enriched Data Set</option>
                  <option value="website">Static Landing Page</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-3.5 py-2 bg-surface border border-border rounded-md text-xs font-semibold text-secondary hover:text-primary cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-action-primary text-action-primary-text rounded-md text-xs font-semibold hover:bg-action-primary-hover shadow-xs cursor-pointer">
                Generate Asset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: COMMIT NEW VERSION */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowVersionModal(false)} />
          <form onSubmit={handleCommitVersion} className="bg-surface border border-border rounded-lg max-w-lg w-full p-6 relative z-10 space-y-4 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Layers className="text-signal-blue" size={16} />
                <span className="text-sm font-bold text-primary">Commit Asset Snapshot (v{(selectedArtifact?.latest_version || 0) + 1})</span>
              </div>
              <button type="button" onClick={() => setShowVersionModal(false)} className="text-muted hover:text-primary transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-secondary">Change Description / Commit Message</label>
                <input 
                  type="text" 
                  value={versionDescription}
                  onChange={e => setVersionDescription(e.target.value)}
                  placeholder="Updated financial projections or edited market research outline..."
                  className="w-full bg-surface border border-border rounded-md px-3.5 py-2 text-xs text-primary outline-none focus:border-signal-blue focus:ring-1 focus:ring-signal-blue placeholder-muted"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-secondary">Raw Text Contents</label>
                <textarea 
                  value={versionContents}
                  onChange={e => setVersionContents(e.target.value)}
                  placeholder="Paste the full, raw text content of the artifact to version, summarize, and semantically index..."
                  className="w-full h-44 bg-surface border border-border rounded-md px-3.5 py-2 text-xs text-primary outline-none focus:border-signal-blue focus:ring-1 focus:ring-signal-blue placeholder-muted font-mono resize-none custom-scrollbar"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setShowVersionModal(false)} className="px-3.5 py-2 bg-surface border border-border rounded-md text-xs font-semibold text-secondary hover:text-primary cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-action-primary text-action-primary-text rounded-md text-xs font-semibold hover:bg-action-primary-hover shadow-xs cursor-pointer">
                Commit & Unlock
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}
