'use client'
import { useState, useEffect } from 'react'
import {
  Key, Code, Zap, Plus, Trash2, Copy, Check,
  Globe, Terminal, Webhook, RefreshCw, X, Loader2, Bot
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

type Tab = 'API Access' | 'Embed Widget' | 'Zapier/Make'
type ApiKey = { id: string; name: string; key_prefix: string; last_used_at: string | null; created_at: string }
type Agent = { id: string; name: string; description?: string }

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="relative bg-secondary/50 border border-border rounded-lg overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/80">
        <span className="text-[11px] text-muted font-mono font-medium">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[11px] text-muted hover:text-primary transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-surface"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3.5 text-xs text-primary font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">{code}</pre>
    </div>
  )
}

// ── API Access Tab ─────────────────────────────────────────────────────────────

function ApiAccessTab({ agents }: { agents: Agent[] }) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyAgentId, setNewKeyAgentId] = useState('')
  const [showNewKey, setShowNewKey] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    api.apiKeys.list().then(res => setKeys(res.keys || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const res = await api.apiKeys.create(newKeyName.trim(), newKeyAgentId || undefined)
      if (res.full_key) setShowNewKey(res.full_key)
      setKeys(prev => [res.key || res, ...prev])
      setNewKeyName('')
      setNewKeyAgentId('')
      toast({ title: 'API key provisioned', type: 'success' })
    } catch (err: any) {
      toast({ title: 'Failed to create key', message: err.message, type: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const deleteKey = async (id: string) => {
    if (!confirm('Revoke this API key? External callers will receive HTTP 401.')) return
    try {
      await api.apiKeys.delete(id)
      setKeys(prev => prev.filter(k => k.id !== id))
      toast({ title: 'Key revoked', type: 'success' })
    } catch (err: any) {
      toast({ title: 'Failed to delete key', message: err.message, type: 'error' })
    }
  }

  const exampleCode = `# Submit an autonomous task
curl -X POST https://your-chatbolt-domain.com/api/v1/tasks \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Analyze customer support tickets and draft SLA summaries"}'

# Query task execution status
curl https://your-chatbolt-domain.com/api/v1/tasks/TASK_ID \\
  -H "X-API-Key: YOUR_API_KEY"`

  return (
    <div className="space-y-6">
      {/* New key alert */}
      {showNewKey && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-emerald-800 mb-0.5">New API Key Generated — Copy it now</p>
              <p className="text-[11px] text-emerald-700 mb-2">This token cannot be displayed again after you navigate away.</p>
              <code className="text-xs text-primary font-mono bg-surface border border-emerald-200 px-3 py-1.5 rounded block break-all">{showNewKey}</code>
            </div>
            <button onClick={() => setShowNewKey(null)} className="text-muted hover:text-primary transition-colors cursor-pointer p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create new key */}
      <div className="bg-surface border border-border rounded-lg p-5 shadow-xs">
        <h3 className="text-xs font-semibold text-primary flex items-center gap-2 mb-3">
          <Plus className="w-3.5 h-3.5 text-secondary" />
          Provision New Access Token
        </h3>
        <form onSubmit={createKey} className="flex flex-wrap gap-2">
          <input
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder="Token identifier (e.g. Production Webhook)"
            className="flex-1 min-w-[200px] bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-primary placeholder-muted focus:outline-none focus:border-border-strong shadow-xs"
            required
          />
          <select
            value={newKeyAgentId}
            onChange={e => setNewKeyAgentId(e.target.value)}
            className="bg-surface border border-border rounded-md px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:border-border-strong shadow-xs cursor-pointer"
          >
            <option value="">All agent workflows</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button
            type="submit"
            disabled={creating || !newKeyName.trim()}
            className="px-3.5 py-1.5 bg-action-primary text-action-primary-text text-xs font-medium rounded-md hover:bg-action-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
            Generate Token
          </button>
        </form>
      </div>

      {/* Keys list */}
      <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface">
          <h3 className="text-xs font-semibold text-primary flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-secondary" />
            Active Platform Tokens ({keys.length})
          </h3>
        </div>
        {loading ? (
          <div className="p-4 space-y-2 animate-pulse">
            {[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-secondary rounded-md" />)}
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted gap-1 text-xs">
            <Key className="w-6 h-6 text-muted mb-1" />
            <p className="font-semibold text-primary">No API keys created</p>
            <p className="text-[11px] text-muted">Generate a key above to enable programmatic invocations.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {keys.map(k => (
              <div key={k.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary">{k.name}</p>
                  <p className="text-[11px] text-muted font-mono">{k.key_prefix}••••••••</p>
                </div>
                <p className="text-[11px] text-muted font-mono">
                  {k.last_used_at ? `Used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never invoked'}
                </p>
                <button
                  onClick={() => deleteKey(k.id)}
                  className="p-1 text-muted hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Revoke token"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Code Example */}
      <div>
        <h3 className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-secondary" />
          HTTP Endpoint Invocation Reference
        </h3>
        <CodeBlock code={exampleCode} language="bash" />
      </div>
    </div>
  )
}

// ── Embed Widget Tab ───────────────────────────────────────────────────────────

function EmbedWidgetTab({ agents }: { agents: Agent[] }) {
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || '')
  const [copied, setCopied] = useState(false)

  const embedCode = `<script 
  src="https://your-chatbolt-domain.com/widget.js"
  data-agent="${selectedAgent || 'YOUR_AGENT_ID'}"
  data-theme="light"
  data-position="bottom-right"
  data-welcome="Hi! How can I assist you today?"
></script>`

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">
      {/* Agent Selector */}
      <div className="bg-surface border border-border rounded-lg p-4 shadow-xs space-y-2">
        <h3 className="text-xs font-semibold text-primary flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-secondary" />
          Select Target Agent Persona
        </h3>
        <select
          value={selectedAgent}
          onChange={e => setSelectedAgent(e.target.value)}
          className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-primary focus:outline-none focus:border-border-strong shadow-xs cursor-pointer"
        >
          <option value="">Select agent...</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Widget Preview */}
      <div className="bg-surface border border-border rounded-lg p-4 shadow-xs">
        <h3 className="text-xs font-semibold text-primary flex items-center gap-1.5 mb-3">
          <Globe className="w-3.5 h-3.5 text-secondary" />
          Live Widget Layout Preview
        </h3>
        <div className="relative h-48 bg-secondary/30 rounded-lg border border-border overflow-hidden p-4">
          <div className="space-y-2 opacity-40">
            <div className="h-2.5 bg-gray-300 rounded w-1/2" />
            <div className="h-2.5 bg-gray-300 rounded w-3/4" />
          </div>
          {/* Chat Widget Simulated Bubble */}
          <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
            <div className="bg-surface border border-border rounded-lg p-2 text-[11px] text-secondary shadow-xs max-w-[180px]">
              Hi! How can I assist you today? 👋
            </div>
            <div className="w-9 h-9 rounded-full bg-action-primary text-action-primary-text flex items-center justify-center shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Embed Code */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-secondary" />
            HTML Embed Snippet
          </h3>
          <button
            onClick={copyEmbed}
            className="flex items-center gap-1 text-xs text-secondary hover:text-primary transition-colors px-2 py-0.5 rounded border border-border bg-surface hover:bg-secondary cursor-pointer shadow-xs"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy Snippet'}
          </button>
        </div>
        <CodeBlock code={embedCode} language="html" />
        <p className="text-[11px] text-muted mt-2">
          Place this snippet immediately before the closing <code className="bg-secondary px-1 rounded">&lt;/body&gt;</code> tag of your web application.
        </p>
      </div>
    </div>
  )
}

// ── Zapier/Make Tab ────────────────────────────────────────────────────────────

function ZapierTab() {
  const [webhookToken, setWebhookToken] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const webhookUrl = webhookToken
    ? `https://your-chatbolt-domain.com/webhooks-receiver/receive/${webhookToken}`
    : ''

  const generateToken = async () => {
    setGenerating(true)
    try {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(20)))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      setWebhookToken(token)
      toast({ title: 'Webhook endpoint generated', type: 'success' })
    } catch {
      toast({ title: 'Failed to generate token', type: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const steps = [
    { step: '1', title: 'Retrieve API token', desc: 'Copy an access token from the API Access tab' },
    { step: '2', title: 'Open Zapier or Make', desc: 'Create a Webhook trigger or HTTP action module' },
    { step: '3', title: 'Bind webhook URL', desc: 'Paste the generated URL as the incoming endpoint' },
    { step: '4', title: 'Configure action schema', desc: 'Map task inputs to workflow trigger properties' },
  ]

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="bg-surface border border-border rounded-lg p-5 shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-secondary" />
          <h3 className="text-sm font-semibold text-primary">Connect to 5,000+ Third-Party Apps</h3>
        </div>
        <p className="text-xs text-secondary leading-relaxed">
          Trigger autonomous agent tasks from HubSpot, Slack, Airtable, or custom webhooks and ingest outcomes directly back to your stack.
        </p>
      </div>

      {/* Steps */}
      <div className="grid md:grid-cols-2 gap-3">
        {steps.map(({ step, title, desc }) => (
          <div key={step} className="bg-surface border border-border rounded-lg p-3.5 flex gap-3 shadow-xs">
            <div className="w-6 h-6 rounded bg-secondary border border-border text-primary flex items-center justify-center text-xs font-mono font-bold shrink-0">
              {step}
            </div>
            <div>
              <p className="text-xs font-semibold text-primary mb-0.5">{title}</p>
              <p className="text-[11px] text-muted">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Webhook Generator */}
      <div className="bg-surface border border-border rounded-lg p-5 shadow-xs space-y-3">
        <h3 className="text-xs font-semibold text-primary flex items-center gap-1.5">
          <Webhook className="w-3.5 h-3.5 text-secondary" />
          Dedicated Webhook Ingestion Endpoint
        </h3>
        {webhookToken ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-primary font-mono bg-secondary/40 border border-border px-3 py-1.5 rounded-md break-all">
                {webhookUrl}
              </code>
              <button
                onClick={copyWebhook}
                className="p-1.5 text-secondary hover:text-primary rounded-md border border-border bg-surface hover:bg-secondary transition-colors cursor-pointer shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={generateToken}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-primary transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Generate new token
            </button>
          </div>
        ) : (
          <button
            onClick={generateToken}
            disabled={generating}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-action-primary text-action-primary-text hover:bg-action-primary-hover text-xs font-medium rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Webhook className="w-3.5 h-3.5" />}
            Generate Webhook URL
          </button>
        )}
      </div>

      {/* HTTP Payload Example */}
      <div>
        <h3 className="text-xs font-semibold text-primary mb-2">Sample Webhook Payload Format</h3>
        <CodeBlock
          code={`URL: https://your-chatbolt-domain.com/api/v1/tasks
Method: POST
Headers:
  X-API-Key: YOUR_API_KEY
  Content-Type: application/json

Body:
{
  "prompt": "Process incoming form response from {{customer_email}}"
}`}
          language="http"
        />
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DeployPage() {
  const [tab, setTab] = useState<Tab>('API Access')
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    api.agents.list().then(res => setAgents(res.agents || [])).catch(() => {})
  }, [])

  const tabs: Tab[] = ['API Access', 'Embed Widget', 'Zapier/Make']
  const tabIcons = { 'API Access': Key, 'Embed Widget': Globe, 'Zapier/Make': Zap }

  return (
    <div className="min-h-screen bg-background text-primary">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <span className="text-xs font-mono font-medium text-muted uppercase tracking-wider">Integrations & Interfaces</span>
            <h1 className="text-2xl font-bold tracking-tight text-primary mt-1">Deploy & Integrate</h1>
            <p className="text-xs text-secondary mt-1">
              Connect Chatbolt agents to third-party endpoints, embed chat widgets, or invoke via REST APIs.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center p-1 bg-surface border border-border rounded-lg shadow-xs self-start">
            {tabs.map(t => {
              const Icon = tabIcons[t]
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    tab === t
                      ? 'bg-action-primary text-action-primary-text shadow-xs'
                      : 'text-secondary hover:text-primary hover:bg-secondary'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        {tab === 'API Access' && <ApiAccessTab agents={agents} />}
        {tab === 'Embed Widget' && <EmbedWidgetTab agents={agents} />}
        {tab === 'Zapier/Make' && <ZapierTab />}
      </div>
    </div>
  )
}
