'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  Search, Plus, CheckCircle2, ChevronRight, X, Loader2, Sparkles, 
  Layers, ChevronDown, Compass, ShieldAlert, Laptop, Eye, HelpCircle, AlertCircle,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'

type IntegrationItem = {
  service: string
  service_name: string
  display_name: string
  description: string
  connected: boolean
}

function ServiceLogo({ service }: { service: string }) {
  switch (service) {
    case 'browser':
      return (
        <div className="w-10 h-10 rounded-[6px] bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-bold shrink-0">
          <Laptop size={20} />
        </div>
      )
    case 'gmail':
      return (
        <div className="w-10 h-10 rounded-[6px] bg-red-50 border border-red-200 flex items-center justify-center text-red-600 font-bold text-sm shrink-0">
          M
        </div>
      )
    case 'google-calendar':
      return (
        <div className="w-10 h-10 rounded-[6px] bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
          Cal
        </div>
      )
    case 'google-drive':
      return (
        <div className="w-10 h-10 rounded-[6px] bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-sm shrink-0">
          Drv
        </div>
      )
    case 'slack':
      return (
        <div className="w-10 h-10 rounded-[6px] bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
          #
        </div>
      )
    case 'notion':
      return (
        <div className="w-10 h-10 rounded-[6px] bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 font-bold text-sm shrink-0">
          N
        </div>
      )
    case 'github':
      return (
        <div className="w-10 h-10 rounded-[6px] bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
          GH
        </div>
      )
    case 'linear':
      return (
        <div className="w-10 h-10 rounded-[6px] bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
          Ln
        </div>
      )
    case 'hubspot':
      return (
        <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 font-bold text-sm shrink-0">
          Hub
        </div>
      )
    case 'stripe':
      return (
        <div className="w-10 h-10 rounded-[6px] bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-bold text-sm shrink-0">
          $
        </div>
      )
    default:
      return (
        <div className="w-10 h-10 rounded-[6px] bg-surface-subtle border border-border flex items-center justify-center text-sm shrink-0 font-bold text-secondary">
          🔌
        </div>
      )
  }
}

export default function PluginsPage() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()
  const [search, setSearch] = useState('')
  const [plugins, setPlugins] = useState<IntegrationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showExtensionModal, setShowExtensionModal] = useState(false)

  const loadPlugins = async () => {
    try {
      setLoading(true)
      const res = await api.integrations.list()
      const list = (res.integrations || []).map((item: any) => ({
        service: item.service,
        service_name: item.service_name,
        display_name: item.display_name,
        description: item.description,
        connected: item.connected
      }))
      setPlugins(list)
    } catch (err: any) {
      toastError('Failed to load plugins', err.message || 'Backend unreachable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlugins()
  }, [])

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const backendOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').origin
      if (event.origin !== backendOrigin) return
      if (event.data?.type === 'oauth_success') {
        toastSuccess('Connected', `Successfully connected ${event.data.service || 'plugin'}!`)
        loadPlugins()
      }
    }
    window.addEventListener('message', handleOAuthMessage)
    return () => window.removeEventListener('message', handleOAuthMessage)
  }, [])

  const handleConnect = async (service: string) => {
    if (service === 'browser') {
      setShowExtensionModal(true)
      return
    }

    try {
      const res = await api.integrations.authUrl(service)
      const connectUrl = res.url
      
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      
      window.open(
        connectUrl,
        `connect_${service}`,
        `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
      )
    } catch (err: any) {
      toastError('Connection Failed', err.message || 'Failed to retrieve auth URL.')
    }
  }

  const handleDisconnect = async (service: string, displayName: string) => {
    try {
      await api.integrations.revoke(service)
      toastInfo('Disconnected', `Credential access for ${displayName} revoked.`)
      loadPlugins()
    } catch (err: any) {
      try {
        await api.integrations.disconnect(service)
        toastInfo('Disconnected', `Credential access for ${displayName} revoked.`)
        loadPlugins()
      } catch (err2: any) {
        toastError('Revocation Failed', err2.message || `Failed to disconnect ${displayName}.`)
      }
    }
  }

  const filteredPlugins = plugins.filter(p => 
    p.display_name.toLowerCase().includes(search.toLowerCase()) || 
    p.description.toLowerCase().includes(search.toLowerCase())
  )

  const featured = [
    { service: 'browser', title: 'Chrome Operator', desc: 'Securely run tasks in your real browser using active sessions.' },
    { service: 'gmail', title: 'Gmail Triage', desc: 'Draft context-rich responses and triage high-volume threads instantly.' },
    { service: 'github', title: 'Git Engine', desc: 'Automate code reviews, issue tracking, and repository updates.' }
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary">Integration Plugins & Tools</h1>
          <p className="text-xs text-secondary mt-0.5">
            Grant your autonomous agent sandboxes secure read/write access to external APIs and web operators.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadPlugins}>
            Refresh Connectors
          </Button>
        </div>
      </div>

      {/* Featured Connectors */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-primary tracking-tight">Featured Connectors</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {featured.map(f => (
            <div 
              key={f.title}
              className="bg-surface border border-border rounded-[6px] p-4 flex flex-col justify-between h-34 hover:border-slate-400 transition-all cursor-pointer shadow-xs"
              onClick={() => handleConnect(f.service)}
            >
              <div className="flex items-center justify-between">
                <ServiceLogo service={f.service} />
                <Button variant="outline" size="sm" className="h-6 text-[11px]">
                  Connect
                </Button>
              </div>
              <div className="mt-2">
                <h3 className="text-xs font-bold text-primary">{f.title}</h3>
                <p className="text-[11px] text-secondary mt-0.5 line-clamp-1">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-[6px] bg-white border border-border max-w-md focus-within:border-sky-600 transition-colors">
        <Search size={14} className="text-secondary shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search connectors by name or capability..."
          className="flex-1 bg-transparent text-xs text-primary placeholder-muted outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-secondary hover:text-primary cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* All Plugins Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-primary tracking-tight">Available Integrations</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-surface border border-border rounded-[6px] animate-pulse p-4" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlugins.map(p => (
              <div 
                key={p.service}
                className="bg-surface border border-border rounded-[6px] p-4 flex flex-col justify-between h-36 shadow-xs hover:border-slate-400 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <ServiceLogo service={p.service} />
                    <div>
                      <h3 className="text-xs font-bold text-primary">{p.display_name}</h3>
                      <p className="text-[11px] text-secondary line-clamp-2 mt-0.5">{p.description}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-subtle mt-2">
                  <StatusBadge 
                    status={p.connected ? 'nominal' : 'idle'} 
                    label={p.connected ? 'Connected' : 'Not Connected'} 
                    size="sm" 
                  />
                  {p.connected ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-6 text-[11px] text-red-700 hover:text-red-900 hover:bg-red-50 border-red-200"
                      onClick={() => handleDisconnect(p.service, p.display_name)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button 
                      variant="primary" 
                      size="sm" 
                      className="h-6 text-[11px]"
                      onClick={() => handleConnect(p.service)}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extension Modal */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setShowExtensionModal(false)} />
          <div className="bg-white border border-border rounded-[8px] max-w-md w-full p-6 relative z-10 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xs font-bold text-primary">Chatbolt Chrome Operator</h3>
              <button onClick={() => setShowExtensionModal(false)} className="text-secondary hover:text-primary cursor-pointer">
                <X size={15} />
              </button>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              The Chrome Operator extension allows your agent workforce to automate research, scraping, and form filling using active browser sessions with complete sandbox isolation.
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowExtensionModal(false)}>
                Close
              </Button>
              <Button variant="primary" size="sm" onClick={() => { setShowExtensionModal(false); toastSuccess('Extension Ready', 'Extension paired with local agent-runtime.') }}>
                Pair Extension
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
