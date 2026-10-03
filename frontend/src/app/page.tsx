'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import {
  Terminal,
  Shield,
  Zap,
  Sparkles,
  ArrowRight,
  Code2,
  Users,
  Layers,
  Cpu,
  CheckCircle2,
  Play,
  Key,
  Database,
  Lock,
  Award,
  Sliders,
  BarChart3,
  Bot,
  Mail,
  Calendar,
  Rocket,
  Check,
  ChevronRight,
  GitBranch,
  Copy,
  ExternalLink
} from 'lucide-react'
import { getSession } from '@/lib/api'

type TeamPreviewKey = 'technical' | 'marketing' | 'support' | 'operations'

interface TeamTabConfig {
  key: TeamPreviewKey
  name: string
  icon: string
  tag: string
  taskPrompt: string
  steps: Array<{
    agent: string
    action: string
    detail: string
    type: 'research' | 'code' | 'qa' | 'complete'
  }>
  metrics: {
    runtime: string
    passRate: string
    cost: string
  }
}

const TEAM_PREVIEWS: Record<TeamPreviewKey, TeamTabConfig> = {
  technical: {
    key: 'technical',
    name: 'Technical Engineering Squad',
    icon: '⚙️',
    tag: 'Go Sandbox + LangGraph',
    taskPrompt: 'Fix connection pool leak in auth middleware and generate regression test suite.',
    steps: [
      { agent: 'Lead Architect AI', action: 'Decomposed Technical Plan', detail: 'Identified unclosed client in auth.middleware.ts:L45. Assigned diff to Senior Dev AI.', type: 'research' },
      { agent: 'Full-Stack Developer AI', action: 'Generated Patch in Go Sandbox', detail: 'Applied unified diff @@ -45,7 +45,8 @@ with defer client.release() wrapper.', type: 'code' },
      { agent: 'Test Automation AI', action: 'Executed Sandbox Test Suite', detail: 'Passed 14/14 concurrency regression tests (0 leaks across 500 parallel workers).', type: 'qa' },
      { agent: 'Lead Architect AI', action: 'Mission Complete', detail: 'Synthesized PR diff and architecture summary. Ready for 1-click human merge.', type: 'complete' }
    ],
    metrics: { runtime: '38s', passRate: '98.5%', cost: '$0.018' }
  },
  marketing: {
    key: 'marketing',
    name: 'Autonomous Marketing Squad',
    icon: '📣',
    tag: 'Web Intelligence + SEO',
    taskPrompt: 'Launch multi-channel product announcement with competitive teardown and SEO email campaign.',
    steps: [
      { agent: 'Marketing Director AI', action: 'Formulated Campaign Strategy', detail: 'Decomposed deliverables: Product Hunt pitch, email sequence, and SEO keywords.', type: 'research' },
      { agent: 'Market Intelligence AI', action: 'Researched Competitor Gaps', detail: 'Scraped 8 competitor profiles. Identified pricing pain points and market whitespace.', type: 'research' },
      { agent: 'Copywriting & Content AI', action: 'Drafted High-Converting Copy', detail: 'Produced 5-part email nurture sequence, Twitter launch thread, and markdown announcement.', type: 'code' },
      { agent: 'Performance Analyst AI', action: 'Audited SEO Density & Readability', detail: 'Scored 94/100 headline conversion index. Formatted all assets for review.', type: 'complete' }
    ],
    metrics: { runtime: '29s', passRate: '96.4%', cost: '$0.012' }
  },
  support: {
    key: 'support',
    name: 'Customer Support & Success Squad',
    icon: '💬',
    tag: '24/7 Knowledge & Triage',
    taskPrompt: 'Triage unread user tickets, synthesize recurring pain points, and draft resolution guides.',
    steps: [
      { agent: 'Support Director AI', action: 'Triaged Inbound Inquiries', detail: 'Categorized 42 tickets by urgency. Flagged 3 billing requests for manager review.', type: 'research' },
      { agent: 'Ticket Resolver AI', action: 'Drafted Personalized Replies', detail: 'Generated empathetic, step-by-step troubleshooting replies matching company policy.', type: 'code' },
      { agent: 'Knowledge Base AI', action: 'Compiled Help Center FAQ', detail: 'Identified top 3 recurring questions and generated searchable troubleshooting guide.', type: 'qa' },
      { agent: 'Sentiment Analyst AI', action: 'Generated CSAT & UX Summary', detail: 'Reported 92% positive resolution score and flagged 1 UI checkout friction point.', type: 'complete' }
    ],
    metrics: { runtime: '22s', passRate: '99.1%', cost: '$0.008' }
  },
  operations: {
    key: 'operations',
    name: 'Site Reliability & Ops Squad',
    icon: '🛡️',
    tag: 'Automated SRE Runbooks',
    taskPrompt: 'Audit cluster health logs, isolate latency spike anomaly, and run maintenance cleanup.',
    steps: [
      { agent: 'Incident Commander AI', action: 'Initiated Telemetry Inspection', detail: 'Coordinated logs audit across worker nodes. Isolated memory anomaly on node-04.', type: 'research' },
      { agent: 'Telemetry Analyst AI', action: 'Correlated Log Spikes', detail: 'Traced latency spike to unindexed query in transaction table during peak cron window.', type: 'code' },
      { agent: 'Operations Engineer AI', action: 'Executed Verification Runbook', detail: 'Ran verified read-only diagnostic check and validated garbage collection tuning.', type: 'qa' },
      { agent: 'Incident Commander AI', action: 'Generated Post-Mortem Briefing', detail: 'Compiled RFC-compliant incident report and composite indexing recommendation.', type: 'complete' }
    ],
    metrics: { runtime: '34s', passRate: '97.8%', cost: '$0.014' }
  }
}

export default function HomePage() {
  const [activeTeam, setActiveTeam] = useState<TeamPreviewKey>('technical')
  const [copiedCurl, setCopiedCurl] = useState(false)

  const activeConfig = TEAM_PREVIEWS[activeTeam]

  const handleCopyCurl = () => {
    navigator.clipboard.writeText('git clone https://github.com/AbhinavKatare/Chatbolt.git && cd chatbolt && docker compose up -d')
    setCopiedCurl(true)
    setTimeout(() => setCopiedCurl(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#F4F4F6] font-sans antialiased flex flex-col justify-between selection:bg-[#534AB7]/30 relative overflow-x-hidden">
      
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-[#534AB7]/12 blur-[140px]" />
        <div className="absolute top-[35%] -left-[10%] w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[150px]" />
      </div>

      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 pt-32 pb-24 space-y-24 z-10">

        {/* ─── Hero Section ─── */}
        <section className="text-center space-y-7 max-w-4xl mx-auto pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-[#00DFB8]" />
            <span>Open-Core Autonomous Agent Workforce Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.08]">
            Simulate an entire company <br className="hidden sm:inline" />
            with <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-white to-emerald-300">autonomous agent teams.</span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed font-normal">
            Deploy specialized squads for Engineering, Marketing, Operations, and Support.
            Bring your own API keys. 100% data ownership with isolated sandbox execution.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard/terminal"
              className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-zinc-200 text-zinc-950 font-bold rounded-xl text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all shadow-xl shadow-white/5 hover:scale-[1.02] active:scale-95 no-underline"
            >
              <Terminal className="w-4 h-4" />
              <span>Launch Live Terminal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            
            <Link
              href="/onboarding"
              className="w-full sm:w-auto px-7 py-3.5 bg-white/[0.05] hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all border border-white/10 no-underline"
            >
              <span>Founder Guided Setup</span>
            </Link>
          </div>

          {/* Quickstart Command Bar */}
          <div className="pt-2 max-w-md mx-auto">
            <button
              onClick={handleCopyCurl}
              className="w-full bg-black/40 hover:bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs font-mono text-zinc-400 group transition-all"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-[#00DFB8]">$</span>
                <span className="truncate">docker compose up -d</span>
              </div>
              <span className="text-[10px] text-zinc-500 group-hover:text-white uppercase font-bold tracking-wider shrink-0 flex items-center gap-1">
                {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCurl ? 'Copied' : 'Copy'}
              </span>
            </button>
          </div>
        </section>

        {/* ─── Interactive Multi-Agent Team Simulator ─── */}
        <section id="teams" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#00DFB8]">Interactive Blueprint Simulator</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Specialized Teams, Zero Prompt Engineering
              </h2>
            </div>
            
            {/* Team Switcher Tabs */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl">
              {(Object.keys(TEAM_PREVIEWS) as TeamPreviewKey[]).map(key => {
                const tab = TEAM_PREVIEWS[key]
                const isActive = activeTeam === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTeam(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[#534AB7] text-white shadow-md'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.name.split(' ')[1] || tab.name.split(' ')[0]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Interactive Terminal Window */}
          <div className="bg-[#09090c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* Window Header */}
            <div className="bg-white/[0.02] border-b border-white/5 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs font-mono text-zinc-400 pl-2 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#00DFB8]" />
                  {activeConfig.name} <span className="text-zinc-600">•</span> <span className="text-zinc-500 text-[11px]">{activeConfig.tag}</span>
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-zinc-400">Runtime: <strong className="text-white">{activeConfig.metrics.runtime}</strong></span>
                <span className="text-zinc-400">Pass Rate: <strong className="text-emerald-400">{activeConfig.metrics.passRate}</strong></span>
                <span className="text-zinc-400">Raw Token Cost: <strong className="text-[#00DFB8]">{activeConfig.metrics.cost}</strong></span>
              </div>
            </div>

            {/* Prompt Banner */}
            <div className="px-6 py-4 bg-white/[0.01] border-b border-white/5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-zinc-300 font-mono truncate">
                <span className="text-[#00DFB8] shrink-0 font-bold">&gt; Mission:</span>
                <span className="truncate">{activeConfig.taskPrompt}</span>
              </div>
              <Link
                href={`/dashboard/terminal?team=${activeTeam}`}
                className="px-3 py-1.5 rounded-lg bg-[#00DFB8] hover:bg-[#00c9a7] text-black font-bold text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1.5 transition-all no-underline"
              >
                <Play className="w-3 h-3 fill-current" /> Run Live
              </Link>
            </div>

            {/* Execution Stream Steps */}
            <div className="p-6 space-y-3 font-mono text-xs">
              {activeConfig.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="bg-black/40 border border-white/5 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:border-white/10 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-purple-300 border border-white/5">
                        {step.agent}
                      </span>
                      <span className="text-white font-bold">{step.action}</span>
                    </div>
                    <p className="text-zinc-400 text-[11px] leading-relaxed pl-0.5">
                      {step.detail}
                    </p>
                  </div>
                  <span className="self-start text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3" /> Verified
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Transparent Architecture & Tri-Tier Polyglot Engine ─── */}
        <section id="architecture" className="space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-[10px] font-mono uppercase tracking-widest text-purple-400">System Architecture</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Engineered for Isolation, Concurrency & Speed
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Unlike toy agent frameworks, Chatbolt separates reasoning, memory, and code execution into dedicated polyglot engines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Box 1: Go Sandbox Runtime */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4 hover:border-white/20 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold">Execution Tier</div>
                <h3 className="text-lg font-bold text-white mt-1">Go Agent Sandbox Runtime</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Supervises 20+ concurrent agents with ~11.5MB baseline RAM. Strips secrets, enforces CPU limits, and runs builds in isolated ephemeral sandboxes.
                </p>
              </div>
              <ul className="space-y-1.5 text-xs text-zinc-400 pt-2 border-t border-white/5">
                <li className="flex items-center gap-2">✓ 0-leak host environment isolation</li>
                <li className="flex items-center gap-2">✓ Bounded worker pool concurrency</li>
                <li className="flex items-center gap-2">✓ Real-time Goroutine metrics</li>
              </ul>
            </div>

            {/* Box 2: Python LangGraph Brain */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4 hover:border-white/20 transition-all">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-purple-400 font-bold">Reasoning Tier</div>
                <h3 className="text-lg font-bold text-white mt-1">Python LangGraph ReAct Brain</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Autonomous Plan $\rightarrow$ Act $\rightarrow$ Observe loops with structured XML prompt delimiters, tool registries, and multi-provider adapters.
                </p>
              </div>
              <ul className="space-y-1.5 text-xs text-zinc-400 pt-2 border-t border-white/5">
                <li className="flex items-center gap-2">✓ Claude 3.5, GPT-4o, Llama 3.3, Qwen</li>
                <li className="flex items-center gap-2">✓ Recursive goal decomposition</li>
                <li className="flex items-center gap-2">✓ Multi-agent delegation bus</li>
              </ul>
            </div>

            {/* Box 3: Node.js Orchestrator & Memory */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4 hover:border-white/20 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-blue-400 font-bold">Persistence & Governance</div>
                <h3 className="text-lg font-bold text-white mt-1">Node Gateway & Vector Memory</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Postgres + pgvector shared team facts, immutable audit ledgers, AES-256 key vault, and real-time Server-Sent Events (SSE) streaming.
                </p>
              </div>
              <ul className="space-y-1.5 text-xs text-zinc-400 pt-2 border-t border-white/5">
                <li className="flex items-center gap-2">✓ Cross-session learned facts</li>
                <li className="flex items-center gap-2">✓ 1-click human approval gates</li>
                <li className="flex items-center gap-2">✓ Offline SQLite fallback support</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ─── BYOK Pricing & Radical Transparency ─── */}
        <section id="pricing" className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-3xl p-8 sm:p-12 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#00DFB8]">Radical Pricing Transparency</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Bring Your Own Key. Pay $0 Platform Markups.
              </h2>
            </div>
            <Link
              href="/pricing"
              className="text-xs font-mono text-[#00DFB8] hover:underline flex items-center gap-1 shrink-0"
            >
              View Full Pricing Specs <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Traditional SaaS AI Markups</h3>
                <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">300% – 500% Surcharge</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Most platforms charge $50–$200/month for crippled single-agent wrappers while locking you into proprietary tokens and hidden inference markups.
              </p>
              <div className="text-xs text-zinc-500 font-mono space-y-1">
                <div>• Per-seat fees even for idle team members</div>
                <div>• Strict prompt rate limits and black-box prompts</div>
              </div>
            </div>

            <div className="bg-[#534AB7]/10 border border-[#534AB7]/30 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Chatbolt Open-Core Model</h3>
                <span className="text-[10px] font-mono text-[#00DFB8] bg-[#00DFB8]/10 px-2 py-0.5 rounded">0% Markup • Raw Token Cost</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Connect your OpenAI, Anthropic, OpenRouter, or local Ollama endpoint directly. Run entire 4-agent teams for literally <strong>$0.01 to $0.03 per mission</strong>.
              </p>
              <div className="text-xs text-purple-300 font-mono space-y-1">
                <div>✓ Free Community Tier included forever</div>
                <div>✓ 100% data and key encryption in your local vault</div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Bottom Call to Action ─── */}
        <section className="text-center space-y-6 py-12 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Ready to deploy your digital workforce?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Open the workspace immediately or follow the 2-minute founder setup guide.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard/terminal"
              className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-zinc-200 text-zinc-950 font-bold rounded-xl text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all shadow-xl shadow-white/5 no-underline"
            >
              <Terminal className="w-4 h-4" /> Open Terminal Directly
            </Link>
            <Link
              href="/onboarding"
              className="w-full sm:w-auto px-8 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider inline-flex items-center justify-center transition-all border border-white/10 no-underline"
            >
              Start Guided Onboarding
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  )
}
