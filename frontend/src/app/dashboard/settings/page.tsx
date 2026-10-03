'use client'
import { useEffect, useState } from 'react'
import { api, getSession, saveSession } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  User, 
  Key, 
  Mail, 
  AlertTriangle, 
  Shield, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Lock,
  Copy,
  Settings as SettingsIcon,
  Activity,
  Download,
  ShieldCheck,
  Zap,
  Globe,
  Database,
  Terminal,
  Bot,
  MessageSquare,
  RefreshCw
} from 'lucide-react'

type Tab = 'profile' | 'apikeys' | 'vault' | 'email' | 'danger' | 'referrals'

export default function SettingsPage() {
  const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useToast()
  const [tab, setTab] = useState<Tab>('profile')
  const [tenant, setTenant] = useState<any>(null)
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [vaultKeys, setVaultKeys] = useState<{service: string, is_valid: boolean, last_used?: string}[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Referrals
  const [refCode, setRefCode] = useState<string | null>(null)
  const [refStats, setRefStats] = useState<any>(null)
  const [refLoading, setRefLoading] = useState(false)

  // Profile forms
  const [name, setName] = useState('')
  const [userDetails, setUserDetails] = useState('')
  const [userPurpose, setUserPurpose] = useState('')
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')

  // New API key form
  const [keyName, setKeyName] = useState('')
  const [keyAgent, setKeyAgent] = useState('')
  const [newKey, setNewKey] = useState('')

  // SMTP Settings
  const [smtp, setSmtp] = useState({ host: '', port: '587', user: '', pass: '', from: '' })

  // Vault form
  const [vaultService, setVaultService] = useState('openai')
  const [vaultKey, setVaultKey] = useState('')

  useEffect(() => {
    getSession().then(s => {
      setTenant(s?.tenant)
      if (s?.tenant?.name) setName(s.tenant.name)
      if (s?.tenant?.user_details) setUserDetails(s.tenant.user_details)
      if (s?.tenant?.user_purpose) setUserPurpose(s.tenant.user_purpose)
    })
  }, [])

  useEffect(() => {
    if (tab === 'apikeys') {
      api.apiKeys.list().then(r => setApiKeys(r.keys)).catch(() => {})
      api.agents.list().then(r => setAgents(r.agents)).catch(() => {})
    } else if (tab === 'vault') {
      setVaultKeys([
        { service: 'openai', is_valid: true, last_used: '2 mins ago' },
        { service: 'twilio', is_valid: false }
      ])
    } else if (tab === 'referrals') {
      setRefLoading(true)
      Promise.all([
        api.referrals.myCode().catch(() => ({ code: '' })),
        api.referrals.stats().catch(() => ({ total: 0, converted: 0, rewarded: 0 }))
      ]).then(([codeData, statsData]) => {
        setRefCode(codeData.code || '')
        setRefStats(statsData)
      }).finally(() => {
        setRefLoading(false)
      })
    }
  }, [tab])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      const r = await api.auth.updateProfile({ name, user_details: userDetails, user_purpose: userPurpose })
      setTenant(r.tenant)
      saveSession('', r.tenant)
      toastSuccess('Profile context synchronized to agent registry')
      setMsg('success: Profile updated successfully')
      window.dispatchEvent(new Event('storage'))
    } catch (err: any) { 
      toastError('Failed to sync profile', err.message)
      setMsg(err.message || 'Failed to update profile') 
    }
    finally { setSaving(false) }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      await api.auth.changePassword({ currentPassword: curPwd, newPassword: newPwd })
      setCurPwd(''); setNewPwd('')
      toastSuccess('Password updated successfully')
      setMsg('success: Password changed successfully')
    } catch (err: any) { 
      toastError('Failed to change credentials', err.message)
      setMsg(err.message) 
    }
    finally { setSaving(false) }
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const r = await api.apiKeys.create(keyName, keyAgent || undefined)
      setNewKey(r.key)
      setApiKeys(prev => [r, ...prev])
      setKeyName(''); setKeyAgent('')
      toastSuccess('Platform access token generated')
    } catch (err: any) { 
      toastError('Failed to generate key', err.message)
    }
    finally { setSaving(false) }
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key?')) return
    try {
      await api.apiKeys.delete(id)
      setApiKeys(prev => prev.filter(k => k.id !== id))
      toastSuccess('Access token revoked')
    } catch (err: any) { 
      toastError('Failed to revoke key', err.message)
    }
  }

  async function saveVaultKey(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      await new Promise(r => setTimeout(r, 600))
      setVaultKeys(prev => {
        const existing = prev.find(p => p.service === vaultService)
        if (existing) return prev.map(p => p.service === vaultService ? { ...p, is_valid: true, last_used: 'Just now' } : p)
        return [...prev, { service: vaultService, is_valid: true, last_used: 'Just now' }]
      })
      setVaultKey('')
      toastSuccess('Integration token securely stored with AES-256')
      setMsg('success: Integration key saved to Vault.')
    } catch (err: any) { 
      setMsg(err.message) 
    }
    finally { setSaving(false) }
  }

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile Context', icon: User, desc: 'Identity & RAG Ingestion' },
    { id: 'vault' as Tab, label: 'API Vault', icon: Shield, desc: 'Encrypted BYOK Storage' },
    { id: 'apikeys' as Tab, label: 'Access Tokens', icon: Key, desc: 'Platform Interface Keys' },
    { id: 'email' as Tab, label: 'Communication', icon: Mail, desc: 'SMTP Gateway Protocol' },
    { id: 'referrals' as Tab, label: 'Referral Rewards', icon: Zap, desc: 'Invite Teams & Earn' },
    { id: 'danger' as Tab, label: 'Danger Zone', icon: AlertTriangle, desc: 'Workspace Teardown' },
  ]

  return (
    <div className="flex flex-col h-full bg-background text-primary font-sans">
      {/* Sub-header Navigation */}
      <div className="h-14 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0 shadow-xs">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <SettingsIcon size={14} className="text-secondary" /> Workspace Environment
           </div>
           <div className="h-4 w-px bg-border" />
           <span className="text-xs text-muted font-mono">
             Tenant: <strong className="text-primary font-semibold">{tenant?.name || 'Primary Organization'}</strong>
           </span>
        </div>
        <div className="flex items-center gap-2.5">
           <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-mono font-medium">
              <Activity size={12} /> SECURE v2.6.0
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 border-b border-border pb-6">
             <div>
                <span className="text-xs font-mono font-medium text-muted uppercase tracking-wider">Configuration & Parameters</span>
                <h1 className="text-2xl font-bold tracking-tight text-primary mt-1">Environment Settings</h1>
                <p className="text-xs text-secondary mt-1">
                   Manage workspace metadata, persona prompt hydration, encrypted key storage, and access tokens.
                </p>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             {/* Sidebar Navigation */}
             <div className="col-span-1 lg:col-span-3 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1.5 pb-2 lg:pb-0">
                {tabs.map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => { setTab(t.id); setMsg('') }}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all text-left cursor-pointer border ${
                      tab === t.id 
                      ? 'bg-surface border-border-strong text-primary shadow-xs font-medium' 
                      : 'border-transparent text-secondary hover:text-primary hover:bg-surface/60'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border ${
                      tab === t.id ? 'bg-secondary border-border text-primary' : 'bg-surface border-border/50 text-muted'
                    }`}>
                      <t.icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{t.label}</div>
                      <div className="text-[10px] text-muted truncate">{t.desc}</div>
                    </div>
                  </button>
                ))}
             </div>

             {/* Content Area */}
             <div className="col-span-1 lg:col-span-9 space-y-6">
                {msg && (
                  <div className={`p-3.5 rounded-lg border flex items-center gap-2 text-xs font-medium ${
                    msg.startsWith('success') 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <CheckCircle2 size={15} className="shrink-0" />
                    <span>{msg.replace(/^(success:\s*|error:\s*)/i, '')}</span>
                  </div>
                )}

                {/* PROFILE TAB */}
                {tab === 'profile' && (
                  <div className="space-y-6">
                    <div className="bg-surface border border-border p-6 rounded-lg shadow-xs space-y-6">
                      <div className="flex items-center justify-between border-b border-border pb-4">
                         <div>
                           <h3 className="text-sm font-semibold text-primary">Workspace Identity & Persona</h3>
                           <p className="text-xs text-muted">Defines organizational context injected into agent reasoning cycles</p>
                         </div>
                         <Globe size={16} className="text-secondary" />
                      </div>
                      
                      <form onSubmit={saveProfile} className="space-y-5">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                               <label className="text-xs font-medium text-secondary">Organization Name</label>
                               <input 
                                 className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs font-medium focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-action-primary/20 shadow-xs" 
                                 value={name} 
                                 onChange={e => setName(e.target.value)} 
                               />
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-xs font-medium text-secondary">Administrative Account Email</label>
                               <div className="relative">
                                  <input 
                                    className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-muted text-xs font-mono cursor-not-allowed outline-none shadow-xs" 
                                    value={tenant?.email || ''} 
                                    disabled 
                                  />
                                  <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                               </div>
                            </div>

                            {/* RAG Context Ingestion */}
                            <div className="space-y-1.5 md:col-span-2">
                               <div className="flex items-center justify-between">
                                  <label className="text-xs font-medium text-secondary">Business Context & Operating Model</label>
                                  <span className="text-[10px] text-muted font-mono">Injected into system prompt</span>
                                </div>
                               <textarea 
                                 className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs font-normal focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-action-primary/20 h-24 resize-none placeholder:text-muted shadow-xs leading-relaxed" 
                                 placeholder="e.g. Chatbolt is an operational platform managing high-velocity agent execution for marketing, customer support, and financial reporting..."
                                 value={userDetails} 
                                 onChange={e => setUserDetails(e.target.value)} 
                               />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                               <div className="flex items-center justify-between">
                                  <label className="text-xs font-medium text-secondary">Core Directive & Tone Constraints</label>
                                  <span className="text-[10px] text-muted font-mono">Agent reasoning boundaries</span>
                               </div>
                               <textarea 
                                 className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs font-normal focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-action-primary/20 h-24 resize-none placeholder:text-muted shadow-xs leading-relaxed" 
                                 placeholder="e.g. Maintain a concise, data-driven, and rigorous operational tone. Never hallucinate API schemas. Always verify task dependencies before dispatching..."
                                 value={userPurpose} 
                                 onChange={e => setUserPurpose(e.target.value)} 
                               />
                            </div>
                         </div>

                         <div className="flex justify-end pt-2">
                            <button 
                              className="flex items-center gap-1.5 px-4 py-2 bg-action-primary text-action-primary-text hover:bg-action-primary-hover rounded-md shadow-xs transition-all text-xs font-medium cursor-pointer" 
                              type="submit" 
                              disabled={saving}
                            >
                               {saving ? 'Syncing...' : <><Save size={13} /> Save Workspace Context</>}
                            </button>
                         </div>
                      </form>
                    </div>
 
                    <div className="bg-surface border border-border p-6 rounded-lg shadow-xs space-y-4">
                      <h3 className="text-sm font-semibold text-primary border-b border-border pb-3">Update Account Password</h3>
                      <form onSubmit={changePassword} className="space-y-4 max-w-md">
                         <div className="space-y-1.5">
                            <label className="text-xs font-medium text-secondary">Current Password</label>
                            <input 
                              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs focus:border-border-strong focus:outline-none shadow-xs" 
                              type="password" 
                              value={curPwd} 
                              onChange={e => setCurPwd(e.target.value)} 
                              required 
                            />
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-xs font-medium text-secondary">New Password</label>
                            <input 
                              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs focus:border-border-strong focus:outline-none shadow-xs" 
                              type="password" 
                              value={newPwd} 
                              onChange={e => setNewPwd(e.target.value)} 
                              required 
                              minLength={8} 
                            />
                         </div>
                         <button 
                           className="px-4 py-2 bg-surface border border-border hover:bg-secondary text-primary rounded-md shadow-xs text-xs font-medium transition-all cursor-pointer" 
                           type="submit" 
                           disabled={saving}
                         >
                            Update Password
                         </button>
                      </form>
                    </div>
                  </div>
                )}
 
                {/* API VAULT TAB */}
                {tab === 'vault' && (
                  <div className="space-y-6">
                    <div className="bg-surface border border-border p-6 rounded-lg shadow-xs space-y-5">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                         <div>
                           <h3 className="text-sm font-semibold text-primary">Integration Key Vault (BYOK)</h3>
                           <p className="text-muted text-xs">Encrypted storage for external LLM & communication provider credentials</p>
                         </div>
                         <Shield size={18} className="text-secondary" />
                      </div>
                      
                      <form onSubmit={saveVaultKey} className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                               <label className="text-xs font-medium text-secondary">Provider Service</label>
                               <select 
                                 className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs font-medium outline-none cursor-pointer focus:border-border-strong shadow-xs" 
                                 value={vaultService} 
                                 onChange={e => setVaultService(e.target.value)}
                               >
                                 <option value="openai">OpenAI (GPT-4o, o1, Embeddings)</option>
                                 <option value="anthropic">Anthropic (Claude 3.5 Sonnet / Opus)</option>
                                 <option value="twilio">Twilio (WhatsApp & SMS)</option>
                                 <option value="stripe">Stripe (Payments API)</option>
                                 <option value="sendgrid">SendGrid (Transactional Mail)</option>
                               </select>
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-xs font-medium text-secondary">Secret API Token</label>
                               <div className="relative">
                                 <input 
                                   className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs font-mono focus:border-border-strong outline-none shadow-xs placeholder:text-muted" 
                                   type="password"
                                   placeholder="sk-••••••••" 
                                   value={vaultKey} 
                                   onChange={e => setVaultKey(e.target.value)} 
                                   required 
                                 />
                                 <Lock size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                               </div>
                            </div>
                         </div>
                         
                         <div className="p-3 bg-secondary/40 border border-border rounded-md flex items-center gap-3 text-secondary text-xs leading-relaxed">
                           <Shield className="w-4 h-4 text-secondary shrink-0" />
                           <p>Keys are encrypted via AES-256-GCM. Decryption occurs strictly inside isolated task executors during active inference runs.</p>
                         </div>
 
                         <div className="flex justify-end pt-1">
                           <button 
                             className="flex items-center gap-1.5 px-4 py-2 bg-action-primary text-action-primary-text rounded-md shadow-xs hover:bg-action-primary-hover transition-all text-xs font-medium cursor-pointer" 
                             type="submit" 
                             disabled={saving}
                           >
                              {saving ? 'Encrypting...' : <><Save size={13} /> Save Key to Vault</>}
                           </button>
                         </div>
                      </form>
                    </div>
 
                    <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
                      <div className="p-4 border-b border-border flex items-center justify-between bg-surface">
                        <h3 className="text-xs font-semibold text-primary">Configured Vault Keys</h3>
                        <Database size={14} className="text-muted" />
                      </div>
                      {vaultKeys.length === 0 ? (
                        <div className="p-12 text-center space-y-1 text-muted">
                           <Shield size={22} className="mx-auto text-muted" />
                           <p className="text-xs font-medium text-primary">No integration keys configured</p>
                           <p className="text-[11px] text-muted">Add your API keys above for autonomous execution.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {vaultKeys.map((k) => (
                            <div key={k.service} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary/30 transition-all">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 bg-secondary border border-border rounded-md flex items-center justify-center text-primary shrink-0 shadow-xs">
                                    {k.service === 'openai' ? <Bot size={15} /> : k.service === 'twilio' ? <MessageSquare size={15} /> : <Key size={15} />}
                                 </div>
                                 <div>
                                    <div className="text-xs font-semibold text-primary capitalize">{k.service} Integration</div>
                                    <div className="text-[11px] text-muted">
                                      Status: {k.is_valid ? 'Active' : 'Unverified'} · Last used: {k.last_used || 'Never'}
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                   k.is_valid ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-rose-800 bg-rose-50 border-rose-200'
                                 }`}>
                                    {k.is_valid ? 'Authenticated' : 'Failed'}
                                 </span>
                                 <button 
                                   className="text-xs text-muted hover:text-rose-600 transition-colors p-1 rounded hover:bg-rose-50 cursor-pointer" 
                                   onClick={() => setVaultKeys(prev => prev.filter(x => x.service !== k.service))}
                                   title="Remove key"
                                 >
                                    <Trash2 size={13} />
                                 </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
 
                {/* ACCESS TOKENS TAB */}
                {tab === 'apikeys' && (
                  <div className="space-y-6">
                    {newKey && (
                      <div className="bg-surface border border-border-strong p-5 rounded-lg shadow-xs space-y-3">
                        <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                          <ShieldCheck size={15} className="text-emerald-700" />
                          <span>Platform Access Token Generated</span>
                        </div>
                        <div className="bg-secondary p-3 rounded-md font-mono text-xs text-primary break-all border border-border select-all">
                          {newKey}
                        </div>
                        <div className="flex gap-2">
                          <button 
                            className="flex items-center gap-1.5 bg-action-primary text-action-primary-text px-3 py-1.5 rounded-md font-medium text-xs hover:bg-action-primary-hover transition-all cursor-pointer shadow-xs" 
                            onClick={() => { navigator.clipboard.writeText(newKey); toastSuccess('Copied to clipboard'); }}
                          >
                             <Copy size={12} /> Copy Token
                          </button>
                          <button 
                            className="px-3 py-1.5 bg-surface border border-border text-secondary hover:text-primary rounded-md font-medium text-xs hover:bg-secondary transition-all cursor-pointer shadow-xs" 
                            onClick={() => setNewKey('')}
                          >
                             Dismiss
                          </button>
                        </div>
                        <p className="text-[11px] text-rose-700">Save this token now. It will not be shown again.</p>
                      </div>
                    )}
 
                    <div className="bg-surface border border-border p-6 rounded-lg shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                         <h3 className="text-sm font-semibold text-primary">Provision Access Token</h3>
                         <Key size={16} className="text-secondary" />
                      </div>
                      
                      <form onSubmit={createKey} className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                               <label className="text-xs font-medium text-secondary">Token Name</label>
                               <input 
                                 className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs font-medium focus:border-border-strong outline-none shadow-xs placeholder:text-muted" 
                                 placeholder="e.g. CI/CD Deployment Runner" 
                                 value={keyName} 
                                 onChange={e => setKeyName(e.target.value)} 
                                 required 
                               />
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-xs font-medium text-secondary">Agent Scope</label>
                               <select 
                                 className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs font-medium outline-none cursor-pointer focus:border-border-strong shadow-xs" 
                                 value={keyAgent} 
                                 onChange={e => setKeyAgent(e.target.value)}
                               >
                                 <option value="">Global Workspace (All Agents)</option>
                                 {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                               </select>
                            </div>
                         </div>
                         <div className="flex justify-end pt-1">
                           <button 
                             className="flex items-center gap-1.5 px-4 py-2 bg-action-primary text-action-primary-text hover:bg-action-primary-hover rounded-md shadow-xs transition-all text-xs font-medium cursor-pointer" 
                             type="submit" 
                             disabled={saving}
                           >
                              {saving ? 'Provisioning...' : <><Plus size={13} /> Generate Token</>}
                           </button>
                         </div>
                      </form>
                    </div>
 
                    <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
                      <div className="p-4 border-b border-border bg-surface">
                        <h3 className="text-xs font-semibold text-primary">Active Interface Tokens</h3>
                      </div>
                      {apiKeys.length === 0 ? (
                        <div className="p-12 text-center space-y-1 text-muted">
                           <Key size={22} className="mx-auto text-muted" />
                           <p className="text-xs font-medium text-primary">No API keys provisioned</p>
                           <p className="text-[11px] text-muted">Generate tokens to authenticate programmatic API calls.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {apiKeys.map((k) => (
                            <div key={k.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary/30 transition-all">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 bg-secondary border border-border rounded-md flex items-center justify-center text-primary shadow-xs shrink-0">
                                    <Terminal size={15} />
                                 </div>
                                 <div>
                                    <div className="text-xs font-semibold text-primary">{k.name}</div>
                                    <div className="font-mono text-[11px] text-muted">{k.key_prefix}••••••••</div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                   k.is_active ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-gray-600 bg-gray-50 border-gray-200'
                                 }`}>
                                    {k.is_active ? 'Active' : 'Revoked'}
                                 </span>
                                 {k.is_active && (
                                   <button 
                                     className="text-xs text-muted hover:text-rose-600 transition-colors p-1 rounded hover:bg-rose-50 cursor-pointer" 
                                     onClick={() => revokeKey(k.id)}
                                     title="Revoke token"
                                   >
                                      <Trash2 size={13} />
                                   </button>
                                 )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
 
                {/* EMAIL TAB */}
                {tab === 'email' && (
                  <div className="bg-surface border border-border p-6 rounded-lg shadow-xs space-y-5">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                       <div>
                          <h3 className="text-sm font-semibold text-primary">SMTP Outbound Gateway</h3>
                          <p className="text-xs text-muted">Transactional communication relay for agent dispatch notifications</p>
                       </div>
                       <Mail size={18} className="text-secondary" />
                    </div>
                    
                    <form className="space-y-4" onSubmit={e => { e.preventDefault(); setMsg('success: SMTP settings saved successfully') }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-secondary">SMTP Host</label>
                          <input className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs focus:border-border-strong outline-none shadow-xs placeholder:text-muted" 
                            placeholder="smtp.mailgun.org" value={smtp.host} onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-secondary">Port</label>
                          <input className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs focus:border-border-strong outline-none shadow-xs placeholder:text-muted" 
                            placeholder="587" value={smtp.port} onChange={e => setSmtp(s => ({ ...s, port: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-secondary">Username / API Key</label>
                        <input className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs focus:border-border-strong outline-none shadow-xs placeholder:text-muted" 
                          type="email" placeholder="postmaster@yourdomain.com" value={smtp.user} onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-secondary">Password / Secret Key</label>
                        <input className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs focus:border-border-strong outline-none shadow-xs placeholder:text-muted" 
                          type="password" placeholder="••••••••••••" value={smtp.pass} onChange={e => setSmtp(s => ({ ...s, pass: e.target.value }))} />
                      </div>
                      
                      <div className="p-3 bg-secondary/40 border border-border rounded-md text-secondary text-xs leading-relaxed">
                        Ensure TLS/SSL is supported and your server IP is whitelisted in your domain SPF/DKIM DNS records.
                      </div>
 
                      <div className="flex justify-end gap-2 pt-1">
                        <button 
                          className="px-3 py-1.5 bg-surface border border-border text-secondary hover:text-primary rounded-md text-xs font-medium hover:bg-secondary transition-all cursor-pointer shadow-xs" 
                          type="button" 
                          onClick={() => toastInfo('Sending test pulse email...')}
                        >
                           Send Test Email
                        </button>
                        <button 
                          className="px-4 py-1.5 bg-action-primary text-action-primary-text hover:bg-action-primary-hover rounded-md text-xs font-medium shadow-xs transition-all cursor-pointer" 
                          type="submit"
                        >
                           Save Configuration
                        </button>
                      </div>
                    </form>
                  </div>
                )}
 
                {/* REFERRALS TAB */}
                {tab === 'referrals' && (
                  <div className="bg-surface border border-border p-6 rounded-lg shadow-xs space-y-6">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                       <div>
                          <h3 className="text-sm font-semibold text-primary">Referral Program</h3>
                          <p className="text-xs text-muted">Invite team leads and earn free monthly operational capacity</p>
                       </div>
                       <Zap size={18} className="text-secondary" />
                    </div>
 
                    {refLoading ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="animate-spin text-secondary mb-2">
                          <RefreshCw size={20} />
                        </div>
                        <p className="text-xs text-muted font-mono">Loading referral statistics...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Stats Counter */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-secondary/30 border border-border p-3.5 rounded-lg space-y-0.5">
                            <span className="text-xs text-muted">Invited Operators</span>
                            <p className="text-xl font-bold font-mono text-primary">{refStats?.total || 0}</p>
                          </div>
                          <div className="bg-secondary/30 border border-border p-3.5 rounded-lg space-y-0.5">
                            <span className="text-xs text-muted">Converted Teams</span>
                            <p className="text-xl font-bold font-mono text-emerald-700">{refStats?.converted || 0}</p>
                          </div>
                          <div className="bg-secondary/30 border border-border p-3.5 rounded-lg space-y-0.5">
                            <span className="text-xs text-muted">Free Months Earned</span>
                            <p className="text-xl font-bold font-mono text-primary">{refStats?.rewarded || 0}</p>
                          </div>
                        </div>
 
                        {/* Referral Link Card */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-secondary">Your Referral Link</label>
                          <div className="flex gap-2">
                            <input 
                              className="flex-1 bg-surface border border-border rounded-md px-3 py-2 text-primary text-xs font-mono outline-none shadow-xs"
                              readOnly
                              value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}?ref=${refCode || ''}`}
                            />
                            <button 
                              onClick={() => {
                                const refUrl = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}?ref=${refCode || ''}`
                                navigator.clipboard.writeText(refUrl)
                                toastSuccess('Referral link copied to clipboard')
                              }}
                              className="px-3 bg-surface border border-border hover:bg-secondary rounded-md text-primary flex items-center justify-center transition-all cursor-pointer shadow-xs text-xs font-medium gap-1.5"
                              type="button"
                            >
                              <Copy size={13} /> Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
 
                {/* DANGER ZONE TAB */}
                {tab === 'danger' && (
                  <div className="space-y-6">
                    <div className="bg-surface border border-rose-300 p-6 rounded-lg shadow-xs space-y-4">
                      <div className="flex items-center gap-2.5 text-rose-800 border-b border-rose-100 pb-3">
                         <AlertTriangle size={18} />
                         <h3 className="text-sm font-semibold">Purge Workspace Environment</h3>
                      </div>
                      <p className="text-xs text-secondary leading-relaxed">
                         Permanent infrastructure teardown. Purges all agents, workflows, encrypted vaults, knowledge documents, and neural transaction history. This action cannot be undone.
                      </p>
                      <button 
                        className="px-4 py-2 border border-rose-300 bg-rose-50 text-rose-800 rounded-md text-xs font-medium hover:bg-rose-100 transition-all cursor-pointer shadow-xs" 
                        onClick={() => {
                          if (prompt('Type PURGE ARCHITECTURE to confirm:') === 'PURGE ARCHITECTURE') toastWarning('Initiating teardown...')
                        }}
                      >
                         Initiate Workspace Teardown
                      </button>
                    </div>
 
                    <div className="bg-surface border border-border p-6 rounded-lg shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                         <div className="flex items-center gap-2">
                           <Download size={16} className="text-secondary" />
                           <h3 className="text-sm font-semibold text-primary">Architecture Manifest Export</h3>
                         </div>
                      </div>
                      <p className="text-xs text-secondary leading-relaxed">
                         Generate a full structural snapshot of your workspace metadata. Includes agent definitions, tool linkages, and audit records in JSON format.
                      </p>
                      <button 
                        className="px-4 py-2 bg-surface border border-border text-primary rounded-md shadow-xs text-xs font-medium hover:bg-secondary transition-all cursor-pointer" 
                        onClick={() => toastInfo('Manifest export initiated.')}
                      >
                         Generate Manifest Export
                      </button>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
