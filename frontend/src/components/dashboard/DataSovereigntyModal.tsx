'use client'

import React, { useState, useEffect } from 'react'
import {
  Shield,
  ShieldCheck,
  HardDrive,
  Database,
  Lock,
  Download,
  Trash2,
  Check,
  AlertTriangle,
  RefreshCw,
  X,
  Loader2,
  Server,
  Cloud,
  FolderLock,
  Key,
  Info,
  ArrowRight,
  CheckCircle2,
  ExternalLink
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

interface DataSovereigntyModalProps {
  isOpen: boolean
  onClose: () => void
  agentName?: string
}

type TabType = 'where' | 'storage_backend' | 'encryption' | 'export_delete'

export default function DataSovereigntyModal({
  isOpen,
  onClose,
  agentName = 'Aria'
}: DataSovereigntyModalProps) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('where')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<any>(null)

  // Storage Switcher State
  const [selectedBackend, setSelectedBackend] = useState<string>('hosted_postgres')
  const [customPostgresUri, setCustomPostgresUri] = useState('')
  const [customS3Bucket, setCustomS3Bucket] = useState('')
  const [customS3Endpoint, setCustomS3Endpoint] = useState('')
  const [customS3Region, setCustomS3Region] = useState('us-east-1')
  const [customLocalPath, setCustomLocalPath] = useState('')
  const [migrateDataOnSwitch, setMigrateDataOnSwitch] = useState(true)

  // Testing & Configuring
  const [testingConn, setTestingConn] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [savingBackend, setSavingBackend] = useState(false)

  // Encryption Passphrase
  const [passphraseInput, setPassphraseInput] = useState('')
  const [savingPassphrase, setSavingPassphrase] = useState(false)

  // Permanent Delete Modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingData, setDeletingData] = useState(false)

  // Export State
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadStorageOverview()
    }
  }, [isOpen])

  const loadStorageOverview = async () => {
    setLoading(true)
    try {
      const res = await api.personalAgent.getStorageOverview()
      if (res.success) {
        setOverview(res)
        if (res.activeConfig?.backendType) {
          setSelectedBackend(res.activeConfig.backendType)
          setCustomPostgresUri(res.activeConfig.postgresUri || '')
          setCustomS3Bucket(res.activeConfig.s3Bucket || '')
          setCustomS3Endpoint(res.activeConfig.s3Endpoint || '')
          setCustomLocalPath(res.activeConfig.localFilePath || '')
        }
      }
    } catch (err: any) {
      console.warn('Failed to load storage overview:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setTestingConn(true)
    setTestResult(null)
    try {
      const res = await api.personalAgent.testStorageConnection({
        backendType: selectedBackend,
        postgresUri: customPostgresUri,
        s3Bucket: customS3Bucket,
        s3Endpoint: customS3Endpoint,
        s3Region: customS3Region,
        localFilePath: customLocalPath
      })
      setTestResult(res)
      if (res.ok) {
        toastSuccess('Connection Verified', `Storage responded in ${res.latencyMs}ms.`)
      } else {
        toastError('Test Failed', res.error || 'Could not verify storage destination.')
      }
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message })
      toastError('Connection Error', err.message)
    } finally {
      setTestingConn(false)
    }
  }

  const handleApplyStorageBackend = async () => {
    setSavingBackend(true)
    try {
      const res = await api.personalAgent.configureStorage({
        config: {
          backendType: selectedBackend,
          postgresUri: customPostgresUri,
          s3Bucket: customS3Bucket,
          s3Endpoint: customS3Endpoint,
          s3Region: customS3Region,
          localFilePath: customLocalPath
        },
        migrateExistingData: migrateDataOnSwitch
      })

      if (res.success) {
        toastSuccess(
          'Storage Switched',
          `Active backend is now ${selectedBackend}.${res.migratedRecords ? ` Migrated ${res.migratedRecords} records.` : ''}`
        )
        await loadStorageOverview()
        setActiveTab('where')
      }
    } catch (err: any) {
      toastError('Switch Failed', err.message || 'Could not switch storage backend.')
    } finally {
      setSavingBackend(false)
    }
  }

  const handleSavePassphrase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passphraseInput.length < 6) {
      toastError('Invalid Passphrase', 'Passphrase must be at least 6 characters.')
      return
    }
    setSavingPassphrase(true)
    try {
      const res = await api.personalAgent.setPassphrase(passphraseInput)
      if (res.success) {
        toastSuccess('Encryption Enabled', 'PersonalAgent data is now encrypted with your custom passphrase.')
        setPassphraseInput('')
        await loadStorageOverview()
      }
    } catch (err: any) {
      toastError('Error', err.message || 'Could not update passphrase.')
    } finally {
      setSavingPassphrase(false)
    }
  }

  const handleExportDownload = async () => {
    setIsExporting(true)
    try {
      const downloadUrl = api.personalAgent.exportDataUrl()
      const session = await (window as any).localStorage.getItem('chatbolt_token') || ''
      const res = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${session}`
        }
      })
      if (!res.ok) throw new Error('Export download failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chatbolt-sovereign-data-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toastSuccess('Export Ready', 'Downloaded verified sovereign data package.')
    } catch (err: any) {
      toastError('Export Failed', err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handlePermanentHardDelete = async () => {
    if (deleteConfirmText !== 'PERMANENT_DELETE') {
      toastError('Confirmation Mismatch', 'Please type PERMANENT_DELETE exactly to confirm.')
      return
    }
    setDeletingData(true)
    try {
      const res = await api.personalAgent.permanentDelete(deleteConfirmText)
      if (res.success) {
        toastSuccess('Data Shredded', `Physically wiped ${res.deletedMemories} memories and conversation history.`)
        setShowDeleteConfirm(false)
        setDeleteConfirmText('')
        await loadStorageOverview()
      }
    } catch (err: any) {
      toastError('Delete Failed', err.message || 'Could not delete storage records.')
    } finally {
      setDeletingData(false)
    }
  }

  if (!isOpen) return null

  const metrics = overview?.metrics
  const activeConfig = overview?.activeConfig
  const isZeroCloud = metrics?.isZeroCloudStorage

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-border bg-surface-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-primary tracking-tight">
                  Data Sovereignty & Storage Control
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                    isZeroCloud
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : 'bg-sky-500/10 text-sky-600 border-sky-500/20'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isZeroCloud ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                  {isZeroCloud ? 'Zero-Cloud Sovereign' : 'Hosted Vault (Exportable)'}
                </span>
              </div>
              <p className="text-[11px] text-muted">
                Your data lives in storage you control • Inspectable, exportable & permanently deletable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-secondary hover:text-primary hover:bg-surface rounded-md transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-border bg-surface shrink-0">
          {[
            { id: 'where', label: 'Where Is My Data?', icon: HardDrive },
            { id: 'storage_backend', label: 'Storage Backend Switcher', icon: Database },
            { id: 'encryption', label: 'Passphrase Encryption', icon: Lock },
            { id: 'export_delete', label: 'Export & Hard Delete', icon: Download }
          ].map(tab => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-action-primary text-white shadow-xs'
                    : 'text-secondary hover:text-primary hover:bg-surface-subtle'
                }`}
              >
                <Icon size={12} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted">
              <Loader2 size={18} className="animate-spin text-action-primary" />
              <span>Inspecting active storage backend & cryptographic status...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: WHERE IS MY DATA? */}
              {activeTab === 'where' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Active Storage Card */}
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server size={15} className="text-action-primary" />
                        <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                          Active Storage Location
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-muted">
                        Verified at: {new Date(metrics?.lastVerifiedAt || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="p-3 bg-surface rounded-lg border border-border space-y-1.5">
                      <p className="text-xs font-bold text-primary font-mono">
                        {metrics?.backendName || 'Hosted Managed PostgreSQL'}
                      </p>
                      <p className="text-[11px] font-mono text-secondary break-all">
                        {metrics?.physicalLocation || 'Hosted Cluster'}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="p-2.5 rounded-lg bg-surface border border-border">
                        <p className="text-[10px] text-muted font-medium">Facts & Memories</p>
                        <p className="text-sm font-bold text-primary font-mono mt-0.5">
                          {metrics?.totalMemoriesCount ?? 0}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-surface border border-border">
                        <p className="text-[10px] text-muted font-medium">History Messages</p>
                        <p className="text-sm font-bold text-primary font-mono mt-0.5">
                          {metrics?.totalMessagesCount ?? 0}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-surface border border-border">
                        <p className="text-[10px] text-muted font-medium">Estimated Payload</p>
                        <p className="text-sm font-bold text-primary font-mono mt-0.5">
                          {Math.round((metrics?.estimatedSizeBytes || 1024) / 1024)} KB
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Encryption Status Card */}
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lock size={14} className="text-emerald-600" />
                        <h3 className="text-xs font-bold text-primary">
                          At-Rest Encryption Posture
                        </h3>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                        AES-256-GCM Active
                      </span>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">
                      {metrics?.hasCustomPassphrase
                        ? 'Encrypted at rest using keys derived directly from your personal passphrase. The server cannot decrypt this data without your key.'
                        : 'Encrypted at rest using a per-tenant isolated encryption vault. You can switch to a client-controlled passphrase anytime.'}
                    </p>
                  </div>

                  {/* Threat Model & Guarantee Disclosure */}
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary">
                      <Info size={14} className="text-sky-600" />
                      <span>Sovereignty Guarantees & Non-Guarantees</span>
                    </div>
                    
                    <div className="space-y-1.5 text-[11px] text-secondary">
                      <div className="flex items-start gap-1.5">
                        <CheckCircle2 size={12} className="text-signal-green shrink-0 mt-0.5" />
                        <span><strong>What it guarantees:</strong> Chatbolt holds zero standing storage when Local Disk, S3, or Self-Hosted DB is active. Full hard-delete physically wipes records immediately.</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>What it does not guarantee:</strong> Transient LLM inference prompts necessarily flow to your configured model provider (OpenAI, Anthropic) during active requests, unless you use a self-hosted local model (Ollama).</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: STORAGE BACKEND SWITCHER */}
              {activeTab === 'storage_backend' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-xs font-bold text-primary mb-1">
                      Select Storage Engine for {agentName}
                    </h3>
                    <p className="text-[11px] text-muted">
                      Route memories and conversation history into infrastructure you control.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {[
                      {
                        id: 'hosted_postgres',
                        name: 'Hosted Managed PostgreSQL',
                        icon: Server,
                        desc: 'Default cloud storage with AES-256-GCM at rest, one-click JSON export, and verified physical wipe.',
                        isZero: false
                      },
                      {
                        id: 'local_encrypted_file',
                        name: 'Local Encrypted Disk Vault (Zero Cloud)',
                        icon: FolderLock,
                        desc: 'Stores encrypted JSON containers directly on your local disk. Zero data touches external servers.',
                        isZero: true
                      },
                      {
                        id: 'self_hosted_postgres',
                        name: 'Self-Hosted PostgreSQL / Supabase',
                        icon: Database,
                        desc: 'Connect your own private PostgreSQL or Supabase instance via custom connection string.',
                        isZero: true
                      },
                      {
                        id: 'byo_s3',
                        name: 'User-Controlled S3 / R2 / MinIO Bucket',
                        icon: Cloud,
                        desc: 'Direct encrypted object storage in your AWS S3, Cloudflare R2, or MinIO bucket.',
                        isZero: true
                      }
                    ].map(engine => {
                      const isSelected = selectedBackend === engine.id
                      const Icon = engine.icon
                      return (
                        <div
                          key={engine.id}
                          onClick={() => setSelectedBackend(engine.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-action-primary bg-action-primary/5 ring-1 ring-action-primary'
                              : 'border-border bg-surface hover:bg-surface-subtle'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`p-2 rounded-lg ${isSelected ? 'bg-action-primary text-white' : 'bg-surface-subtle text-secondary'}`}>
                                <Icon size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-primary">{engine.name}</p>
                                <p className="text-[11px] text-muted mt-0.5">{engine.desc}</p>
                              </div>
                            </div>
                            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border uppercase shrink-0 ${
                              engine.isZero
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-surface-subtle text-secondary border-border'
                            }`}>
                              {engine.isZero ? 'Zero Cloud' : 'Cloud Vault'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Dynamic Backend Config Inputs */}
                  {selectedBackend === 'self_hosted_postgres' && (
                    <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2">
                      <label className="block text-xs font-semibold text-primary">
                        PostgreSQL Connection URI
                      </label>
                      <input
                        type="password"
                        value={customPostgresUri}
                        onChange={e => setCustomPostgresUri(e.target.value)}
                        placeholder="postgresql://username:password@your-db.internal:5432/chatbolt"
                        className="w-full px-3 py-2 text-xs rounded-md bg-surface border border-border text-primary font-mono focus:outline-none focus:border-action-primary"
                      />
                    </div>
                  )}

                  {selectedBackend === 'byo_s3' && (
                    <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-primary mb-1">
                          S3 Bucket Name
                        </label>
                        <input
                          type="text"
                          value={customS3Bucket}
                          onChange={e => setCustomS3Bucket(e.target.value)}
                          placeholder="my-sovereign-agent-vault"
                          className="w-full px-3 py-2 text-xs rounded-md bg-surface border border-border text-primary font-mono focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-muted mb-1">
                            Endpoint (Optional for MinIO/R2)
                          </label>
                          <input
                            type="text"
                            value={customS3Endpoint}
                            onChange={e => setCustomS3Endpoint(e.target.value)}
                            placeholder="https://<account>.r2.cloudflarestorage.com"
                            className="w-full px-3 py-2 text-xs rounded-md bg-surface border border-border text-primary font-mono focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-muted mb-1">
                            Region
                          </label>
                          <input
                            type="text"
                            value={customS3Region}
                            onChange={e => setCustomS3Region(e.target.value)}
                            placeholder="us-east-1"
                            className="w-full px-3 py-2 text-xs rounded-md bg-surface border border-border text-primary font-mono focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedBackend === 'local_encrypted_file' && (
                    <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2">
                      <label className="block text-xs font-semibold text-primary">
                        Local Vault Directory Path
                      </label>
                      <input
                        type="text"
                        value={customLocalPath}
                        onChange={e => setCustomLocalPath(e.target.value)}
                        placeholder="./data/sovereign-storage"
                        className="w-full px-3 py-2 text-xs rounded-md bg-surface border border-border text-primary font-mono focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Migrate Checkbox */}
                  <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={migrateDataOnSwitch}
                      onChange={e => setMigrateDataOnSwitch(e.target.checked)}
                      className="rounded border-border text-action-primary focus:ring-action-primary"
                    />
                    <span>Automatically copy existing memories and conversations to the new storage backend</span>
                  </label>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testingConn}
                      className="px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary rounded-md border border-border hover:bg-surface transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {testingConn ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Test Connectivity
                    </button>

                    <button
                      type="button"
                      onClick={handleApplyStorageBackend}
                      disabled={savingBackend}
                      className="px-4 py-1.5 text-xs font-semibold bg-action-primary hover:bg-action-primary-hover text-white rounded-md transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {savingBackend ? 'Applying...' : 'Apply Storage Backend'}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: PASSPHRASE ENCRYPTION */}
              {activeTab === 'encryption' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <div className="flex items-center gap-2">
                      <Lock size={15} className="text-action-primary" />
                      <h3 className="text-xs font-bold text-primary">
                        Client-Derived AES-256-GCM Encryption
                      </h3>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">
                      Derive encryption keys using a passphrase only you know (PBKDF2 with SHA-512, 100,000 iterations). Once set, all facts, memories, and messages are encrypted at rest with your key.
                    </p>

                    <form onSubmit={handleSavePassphrase} className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-primary mb-1">
                          Set or update passphrase
                        </label>
                        <input
                          type="password"
                          value={passphraseInput}
                          onChange={e => setPassphraseInput(e.target.value)}
                          placeholder="Enter a strong passphrase..."
                          className="w-full px-3 py-2 text-xs rounded-md bg-surface-subtle border border-border text-primary focus:outline-none focus:border-action-primary"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={savingPassphrase || passphraseInput.length < 6}
                          className="px-4 py-1.5 text-xs font-semibold bg-action-primary text-white rounded-md hover:bg-action-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {savingPassphrase ? 'Deriving Key...' : 'Activate Passphrase Key'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 4: ONE-CLICK EXPORT & HARD DELETE */}
              {activeTab === 'export_delete' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Export Box */}
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Download size={15} className="text-action-primary" />
                        <h3 className="text-xs font-bold text-primary">
                          One-Click Full Data Export
                        </h3>
                      </div>
                      <span className="text-[10px] text-muted">JSON / Checksum verified</span>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">
                      Download a complete, verified archive of everything {agentName} knows: all inspectable memories, preferences, indefinite conversation histories, and SHA-256 cryptographic verification checksum.
                    </p>
                    <button
                      onClick={handleExportDownload}
                      disabled={isExporting}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-action-primary hover:bg-action-primary-hover text-white rounded-md transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      Download Sovereign Data Package (.json)
                    </button>
                  </div>

                  {/* Hard Delete Box */}
                  <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2.5">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <Trash2 size={15} />
                      <h3 className="text-xs font-bold">
                        One-Click Permanent Physical Wipe
                      </h3>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">
                      Immediately drops and securely shreds all facts, preferences, and conversations from your active storage medium. This is a real physical wipe (NOT a soft-delete).
                    </p>

                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors cursor-pointer shadow-xs"
                      >
                        Permanently Wipe All Data
                      </button>
                    ) : (
                      <div className="p-3 rounded-lg bg-surface border border-rose-500/30 space-y-2 animate-in fade-in duration-150">
                        <p className="text-xs text-primary font-semibold">
                          Type <code className="px-1 py-0.5 bg-rose-500/10 text-rose-600 rounded">PERMANENT_DELETE</code> to confirm:
                        </p>
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={e => setDeleteConfirmText(e.target.value)}
                          placeholder="PERMANENT_DELETE"
                          className="w-full px-3 py-1.5 text-xs rounded border border-border text-primary font-mono focus:outline-none focus:border-rose-600"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setShowDeleteConfirm(false)
                              setDeleteConfirmText('')
                            }}
                            className="px-3 py-1 text-xs text-secondary hover:text-primary"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handlePermanentHardDelete}
                            disabled={deletingData || deleteConfirmText !== 'PERMANENT_DELETE'}
                            className="px-3 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded disabled:opacity-50 cursor-pointer"
                          >
                            {deletingData ? 'Shredding...' : 'Confirm Hard Delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-surface-subtle flex items-center justify-between text-xs text-muted shrink-0">
          <div className="flex items-center gap-1.5">
            <Lock size={12} className="text-emerald-600" />
            <span>Zero-trust cryptographic isolation</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-surface border border-border hover:bg-surface-subtle text-primary rounded-md transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
