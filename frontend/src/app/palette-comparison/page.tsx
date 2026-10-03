'use client'

import React, { useState } from 'react'
import {
  Shield,
  Lock,
  Cpu,
  ShoppingBag,
  Users,
  Briefcase,
  AlertTriangle,
  Play,
  CheckCircle2,
  TrendingUp,
  Terminal,
  FileText,
  Sliders,
  DollarSign,
  Activity,
  Layers,
} from 'lucide-react'

// Token definitions for the 3 directions
export interface PaletteTheme {
  id: 'direction-a' | 'direction-b' | 'direction-c'
  name: string
  tagline: string
  tokens: {
    canvas: string
    recessed: string
    surface: string
    surfaceHover: string
    surfaceSubtle: string
    border: string
    borderSubtle: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    actionPrimary: string
    actionPrimaryHover: string
    actionPrimaryText: string
    actionDanger: string
    actionDangerText: string
    actionOutlineBorder: string
    actionOutlineHover: string
    
    // Semantic Badges
    badgeIdleBg: string
    badgeIdleText: string
    badgeIdleBorder: string
    badgeIdleDot: string

    badgeActiveBg: string
    badgeActiveText: string
    badgeActiveBorder: string
    badgeActiveDot: string

    badgeGatedBg: string
    badgeGatedText: string
    badgeGatedBorder: string
    badgeGatedDot: string

    badgeFaultBg: string
    badgeFaultText: string
    badgeFaultBorder: string
    badgeFaultDot: string

    badgeNominalBg: string
    badgeNominalText: string
    badgeNominalBorder: string
    badgeNominalDot: string

    // Focus & Highlights
    focusRing: string
    codeAccent: string
    spendPositive: string
  }
}

const PALETTES: Record<string, PaletteTheme> = {
  'direction-a': {
    id: 'direction-a',
    name: 'Direction A: Refined Dark Console',
    tagline: 'Deep Mineral & Aeronautical Slate (Evolution of current console)',
    tokens: {
      canvas: '#161B22',
      recessed: '#0E1217',
      surface: '#212731',
      surfaceHover: '#2A323F',
      surfaceSubtle: '#1A2028',
      border: '#374151',
      borderSubtle: '#28313E',
      textPrimary: '#F3F4F6',
      textSecondary: '#9CA3AF',
      textMuted: '#6B7280',
      actionPrimary: '#2563EB',
      actionPrimaryHover: '#1D4ED8',
      actionPrimaryText: '#FFFFFF',
      actionDanger: '#DC2626',
      actionDangerText: '#FFFFFF',
      actionOutlineBorder: '#374151',
      actionOutlineHover: '#2A323F',

      badgeIdleBg: '#1A2028',
      badgeIdleText: '#9CA3AF',
      badgeIdleBorder: '#374151',
      badgeIdleDot: '#6B7280',

      badgeActiveBg: 'rgba(56, 189, 248, 0.12)',
      badgeActiveText: '#7DD3FC',
      badgeActiveBorder: 'rgba(56, 189, 248, 0.35)',
      badgeActiveDot: '#38BDF8',

      badgeGatedBg: 'rgba(251, 191, 36, 0.12)',
      badgeGatedText: '#FDE68A',
      badgeGatedBorder: 'rgba(251, 191, 36, 0.35)',
      badgeGatedDot: '#FBBF24',

      badgeFaultBg: 'rgba(248, 113, 113, 0.12)',
      badgeFaultText: '#FECACA',
      badgeFaultBorder: 'rgba(248, 113, 113, 0.35)',
      badgeFaultDot: '#F87171',

      badgeNominalBg: 'rgba(52, 211, 153, 0.12)',
      badgeNominalText: '#A7F3D0',
      badgeNominalBorder: 'rgba(52, 211, 153, 0.35)',
      badgeNominalDot: '#34D399',

      focusRing: '#38BDF8',
      codeAccent: '#38BDF8',
      spendPositive: '#34D399',
    },
  },
  'direction-b': {
    id: 'direction-b',
    name: 'Direction B: Light-Mode Operational Surface',
    tagline: 'Architectural Paper & Precision Ink (Approachable daytime ops)',
    tokens: {
      canvas: '#F4F5F7',
      recessed: '#EAECEF',
      surface: '#FFFFFF',
      surfaceHover: '#F8F9FA',
      surfaceSubtle: '#F1F3F5',
      border: '#D2D6DC',
      borderSubtle: '#E2E5E9',
      textPrimary: '#111827',
      textSecondary: '#4B5563',
      textMuted: '#6B7280',
      actionPrimary: '#0F172A',
      actionPrimaryHover: '#1E293B',
      actionPrimaryText: '#FFFFFF',
      actionDanger: '#B91C1C',
      actionDangerText: '#FFFFFF',
      actionOutlineBorder: '#D2D6DC',
      actionOutlineHover: '#EAECEF',

      badgeIdleBg: '#EAECEF',
      badgeIdleText: '#4B5563',
      badgeIdleBorder: '#D2D6DC',
      badgeIdleDot: '#6B7280',

      badgeActiveBg: 'rgba(3, 105, 161, 0.08)',
      badgeActiveText: '#0369A1',
      badgeActiveBorder: 'rgba(3, 105, 161, 0.28)',
      badgeActiveDot: '#0284C7',

      badgeGatedBg: 'rgba(180, 83, 9, 0.08)',
      badgeGatedText: '#92400E',
      badgeGatedBorder: 'rgba(180, 83, 9, 0.28)',
      badgeGatedDot: '#B45309',

      badgeFaultBg: 'rgba(185, 28, 28, 0.08)',
      badgeFaultText: '#991B1B',
      badgeFaultBorder: 'rgba(185, 28, 28, 0.28)',
      badgeFaultDot: '#B91C1C',

      badgeNominalBg: 'rgba(4, 120, 87, 0.08)',
      badgeNominalText: '#047857',
      badgeNominalBorder: 'rgba(4, 120, 87, 0.28)',
      badgeNominalDot: '#059669',

      focusRing: '#0284C7',
      codeAccent: '#0369A1',
      spendPositive: '#047857',
    },
  },
  'direction-c': {
    id: 'direction-c',
    name: 'Direction C: Trust & Audit Ledger',
    tagline: 'Nordic Petroleum & Machined Bronze (Institutional accountability)',
    tokens: {
      canvas: '#10171D',
      recessed: '#0B1015',
      surface: '#18232C',
      surfaceHover: '#202D38',
      surfaceSubtle: '#131B22',
      border: '#2A3A47',
      borderSubtle: '#1E2B35',
      textPrimary: '#EBF2F8',
      textSecondary: '#8BA2B5',
      textMuted: '#576F82',
      actionPrimary: '#0284C7',
      actionPrimaryHover: '#0369A1',
      actionPrimaryText: '#FFFFFF',
      actionDanger: '#EF4444',
      actionDangerText: '#FFFFFF',
      actionOutlineBorder: '#2A3A47',
      actionOutlineHover: '#202D38',

      badgeIdleBg: '#131B22',
      badgeIdleText: '#8BA2B5',
      badgeIdleBorder: '#2A3A47',
      badgeIdleDot: '#576F82',

      badgeActiveBg: 'rgba(56, 189, 248, 0.12)',
      badgeActiveText: '#7DD3FC',
      badgeActiveBorder: 'rgba(56, 189, 248, 0.35)',
      badgeActiveDot: '#38BDF8',

      badgeGatedBg: 'rgba(245, 158, 11, 0.12)',
      badgeGatedText: '#FCD34D',
      badgeGatedBorder: 'rgba(245, 158, 11, 0.35)',
      badgeGatedDot: '#F59E0B',

      badgeFaultBg: 'rgba(239, 68, 68, 0.12)',
      badgeFaultText: '#FCA5A5',
      badgeFaultBorder: 'rgba(239, 68, 68, 0.35)',
      badgeFaultDot: '#EF4444',

      badgeNominalBg: 'rgba(16, 185, 129, 0.12)',
      badgeNominalText: '#6EE7B7',
      badgeNominalBorder: 'rgba(16, 185, 129, 0.35)',
      badgeNominalDot: '#10B981',

      focusRing: '#38BDF8',
      codeAccent: '#38BDF8',
      spendPositive: '#10B981',
    },
  },
}

export default function PaletteComparisonPage() {
  const [selectedDirection, setSelectedDirection] = useState<'direction-a' | 'direction-b' | 'direction-c'>('direction-a')
  const [activeScreen, setActiveScreen] = useState<'supervision' | 'onboarding' | 'both'>('both')

  const theme = PALETTES[selectedDirection]

  const agents = [
    {
      id: 'agent_01',
      name: 'MarketScanner',
      role: 'Intelligence Gathering',
      status: 'nominal',
      statusLabel: 'Completed',
      tokensUsed: '14,280',
      cost: '$0.028',
      lastStep: '14 sources synthesized',
    },
    {
      id: 'agent_02',
      name: 'CopyLead_V2',
      role: 'Campaign Copy Generation',
      status: 'active',
      statusLabel: 'Executing Step 4/6',
      tokensUsed: '48,120',
      cost: '$0.096',
      lastStep: 'Formulating B2B value propositions',
    },
    {
      id: 'agent_03',
      name: 'ComplianceGate',
      role: 'Policy & SLA Validator',
      status: 'gated',
      statusLabel: 'Awaiting human sign-off',
      tokensUsed: '6,400',
      cost: '$0.012',
      lastStep: 'Outbound dispatch verification required',
    },
    {
      id: 'agent_04',
      name: 'SRE_Watchdog',
      role: 'Sandbox Isolation Monitor',
      status: 'nominal',
      statusLabel: 'Nominal (11.5MB RAM)',
      tokensUsed: '1,100',
      cost: '$0.002',
      lastStep: 'Zero secret leakage detected',
    },
    {
      id: 'agent_05',
      name: 'AdChannelDispatcher',
      role: 'Multi-Network Sync',
      status: 'idle',
      statusLabel: 'Standby',
      tokensUsed: '0',
      cost: '$0.000',
      lastStep: 'Queued on ComplianceGate resolution',
    },
  ]

  const getBadgeStyle = (status: string) => {
    switch (status) {
      case 'active':
        return {
          bg: theme.tokens.badgeActiveBg,
          text: theme.tokens.badgeActiveText,
          border: theme.tokens.badgeActiveBorder,
          dot: theme.tokens.badgeActiveDot,
        }
      case 'gated':
        return {
          bg: theme.tokens.badgeGatedBg,
          text: theme.tokens.badgeGatedText,
          border: theme.tokens.badgeGatedBorder,
          dot: theme.tokens.badgeGatedDot,
        }
      case 'fault':
        return {
          bg: theme.tokens.badgeFaultBg,
          text: theme.tokens.badgeFaultText,
          border: theme.tokens.badgeFaultBorder,
          dot: theme.tokens.badgeFaultDot,
        }
      case 'nominal':
        return {
          bg: theme.tokens.badgeNominalBg,
          text: theme.tokens.badgeNominalText,
          border: theme.tokens.badgeNominalBorder,
          dot: theme.tokens.badgeNominalDot,
        }
      default:
        return {
          bg: theme.tokens.badgeIdleBg,
          text: theme.tokens.badgeIdleText,
          border: theme.tokens.badgeIdleBorder,
          dot: theme.tokens.badgeIdleDot,
        }
    }
  }

  return (
    <div
      style={{ backgroundColor: theme.tokens.canvas, color: theme.tokens.textPrimary }}
      className="min-h-screen transition-colors duration-200 p-6 lg:p-10 font-sans"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Direction Switcher Bar */}
        <div
          style={{
            backgroundColor: theme.tokens.surface,
            borderColor: theme.tokens.border,
          }}
          className="border rounded-[6px] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sticky top-4 z-50 shadow-sm"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Palette Direction
              </span>
              <span className="text-xs font-semibold" style={{ color: theme.tokens.textPrimary }}>
                {theme.name}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: theme.tokens.textSecondary }}>
              {theme.tagline}
            </p>
          </div>

          {/* Selector Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {(['direction-a', 'direction-b', 'direction-c'] as const).map((dirKey) => {
              const item = PALETTES[dirKey]
              const isSelected = selectedDirection === dirKey
              return (
                <button
                  key={dirKey}
                  onClick={() => setSelectedDirection(dirKey)}
                  style={{
                    backgroundColor: isSelected ? theme.tokens.actionPrimary : theme.tokens.surfaceSubtle,
                    color: isSelected ? theme.tokens.actionPrimaryText : theme.tokens.textSecondary,
                    borderColor: isSelected ? 'transparent' : theme.tokens.border,
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-[5px] border transition-colors cursor-pointer"
                >
                  {item.name.split(':')[0]}
                </button>
              )
            })}
          </div>

          {/* View Filter */}
          <div className="flex items-center gap-1 border-l pl-3" style={{ borderColor: theme.tokens.border }}>
            <span className="text-[11px] text-muted mr-1">View:</span>
            {(['both', 'supervision', 'onboarding'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setActiveScreen(view)}
                style={{
                  backgroundColor: activeScreen === view ? theme.tokens.surfaceHover : 'transparent',
                  color: activeScreen === view ? theme.tokens.textPrimary : theme.tokens.textMuted,
                }}
                className="px-2 py-1 text-xs rounded capitalize transition-colors"
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SCREEN 1: LIVE SUPERVISION TABLE (DATA-DENSE OPERATIONAL CONSOLE)        */}
        {/* ========================================================================= */}
        {(activeScreen === 'both' || activeScreen === 'supervision') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: theme.tokens.border }}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: theme.tokens.textPrimary }}>
                  Screen 1: Live Agent Supervision & Accountability Ledger
                </h2>
                <p className="text-xs" style={{ color: theme.tokens.textSecondary }}>
                  High-density operational monitoring, execution topology, and pre-execution budget locks.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    backgroundColor: theme.tokens.badgeNominalBg,
                    color: theme.tokens.badgeNominalText,
                    borderColor: theme.tokens.badgeNominalBorder,
                  }}
                  className="inline-flex items-center text-xs px-2.5 py-1 rounded-[4px] border font-medium gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.tokens.badgeNominalDot }} />
                  Runtime: Nominal (11.5MB RAM)
                </span>
                <button
                  style={{
                    backgroundColor: theme.tokens.actionDanger,
                    color: theme.tokens.actionDangerText,
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-[5px] cursor-pointer"
                >
                  Emergency Halt
                </button>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Active Agent Pool', value: '4 / 20 Instances', sub: 'Bounded Go Sandbox', tag: 'Normal' },
                { label: 'Session Token Meter', value: '69,900 Tokens', sub: '$0.138 Direct Cost', tag: 'Budget Ok' },
                { label: 'Pre-Execution Guard', value: '$250.00 Ceiling', sub: '$107.70 Remaining', tag: 'Armed' },
                { label: 'Sandbox Isolation', value: '100% Scrubbed', sub: 'Zero Host Secret Leakage', tag: 'Secure' },
              ].map((card, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: theme.tokens.surface,
                    borderColor: theme.tokens.border,
                  }}
                  className="p-3.5 rounded-[6px] border space-y-1"
                >
                  <div className="text-[11px]" style={{ color: theme.tokens.textSecondary }}>
                    {card.label}
                  </div>
                  <div className="text-base font-semibold tabular-nums" style={{ color: theme.tokens.textPrimary }}>
                    {card.value}
                  </div>
                  <div className="text-[11px]" style={{ color: theme.tokens.textMuted }}>
                    {card.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Supervision Data Table */}
            <div
              style={{
                backgroundColor: theme.tokens.surface,
                borderColor: theme.tokens.border,
              }}
              className="border rounded-[6px] overflow-hidden"
            >
              <div
                style={{
                  backgroundColor: theme.tokens.surfaceSubtle,
                  borderColor: theme.tokens.border,
                  color: theme.tokens.textSecondary,
                }}
                className="px-4 py-2.5 border-b flex items-center justify-between text-xs font-medium"
              >
                <span>Live Swarm Execution Manifest</span>
                <span className="text-[11px] tabular-nums" style={{ color: theme.tokens.textMuted }}>
                  Last cycle tick: 0.18s ago
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr
                      style={{
                        backgroundColor: theme.tokens.recessed,
                        borderColor: theme.tokens.borderSubtle,
                        color: theme.tokens.textSecondary,
                      }}
                      className="border-b text-[11px]"
                    >
                      <th className="py-2.5 px-4 font-semibold">Agent ID</th>
                      <th className="py-2.5 px-4 font-semibold">Specialized Role</th>
                      <th className="py-2.5 px-4 font-semibold">Lifecycle State</th>
                      <th className="py-2.5 px-4 font-semibold">Tokens Metered</th>
                      <th className="py-2.5 px-4 font-semibold">Cost</th>
                      <th className="py-2.5 px-4 font-semibold">Current Execution State</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Action Gate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => {
                      const badge = getBadgeStyle(agent.status)
                      return (
                        <tr
                          key={agent.id}
                          style={{
                            borderColor: theme.tokens.borderSubtle,
                          }}
                          className="border-b last:border-0 hover:opacity-90 transition-opacity"
                        >
                          <td className="py-3 px-4 font-mono font-medium" style={{ color: theme.tokens.textPrimary }}>
                            {agent.name}
                          </td>
                          <td className="py-3 px-4" style={{ color: theme.tokens.textSecondary }}>
                            {agent.role}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              style={{
                                backgroundColor: badge.bg,
                                color: badge.text,
                                borderColor: badge.border,
                              }}
                              className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-[4px] border font-medium gap-1.5 select-none"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${agent.status === 'active' ? 'animate-pulse' : ''}`}
                                style={{ backgroundColor: badge.dot }}
                              />
                              {agent.statusLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums" style={{ color: theme.tokens.textSecondary }}>
                            {agent.tokensUsed}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-semibold" style={{ color: theme.tokens.textPrimary }}>
                            {agent.cost}
                          </td>
                          <td className="py-3 px-4 truncate max-w-xs" style={{ color: theme.tokens.textSecondary }}>
                            {agent.lastStep}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {agent.status === 'gated' ? (
                              <button
                                style={{
                                  backgroundColor: theme.tokens.actionPrimary,
                                  color: theme.tokens.actionPrimaryText,
                                }}
                                className="px-2.5 py-1 text-xs font-medium rounded-[4px] cursor-pointer"
                              >
                                Approve Step
                              </button>
                            ) : (
                              <button
                                style={{
                                  borderColor: theme.tokens.border,
                                  color: theme.tokens.textSecondary,
                                }}
                                className="px-2 py-1 text-xs font-medium rounded-[4px] border hover:opacity-80"
                              >
                                Replay
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div
                style={{
                  backgroundColor: theme.tokens.surfaceSubtle,
                  borderColor: theme.tokens.borderSubtle,
                  color: theme.tokens.textSecondary,
                }}
                className="px-4 py-2.5 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-2"
              >
                <div className="flex items-center gap-4 text-[11px]">
                  <span>Direct API Spend: <strong style={{ color: theme.tokens.textPrimary }}>$0.138</strong></span>
                  <span>Context Saturation: <strong style={{ color: theme.tokens.textPrimary }}>38% Nominal</strong></span>
                  <span>Audit Trail: <strong style={{ color: theme.tokens.spendPositive }}>Immutable RFC-4180</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    style={{
                      borderColor: theme.tokens.border,
                      color: theme.tokens.textSecondary,
                    }}
                    className="px-2.5 py-1 text-xs rounded-[4px] border hover:opacity-80"
                  >
                    Export JSON Ledger
                  </button>
                </div>
              </div>
            </div>

            {/* Recessed Execution Stream Log */}
            <div
              style={{
                backgroundColor: theme.tokens.recessed,
                borderColor: theme.tokens.borderSubtle,
              }}
              className="p-4 rounded-[6px] border font-mono text-[11px] space-y-1"
            >
              <div style={{ color: theme.tokens.textMuted }}>
                21:35:01.010 [SANDBOX] Worker pool pid=3194 spawned. Env secret scrubbing: Active.
              </div>
              <div style={{ color: theme.tokens.textPrimary }}>
                21:35:01.082 [PLAN] CopyLead_V2 ReAct step: Synthesizing multi-channel messaging copy.
              </div>
              <div style={{ color: theme.tokens.codeAccent }}>
                21:35:01.450 [TOOL:SEARCH] Query: "enterprise AI governance benchmarks" (14 sources parsed)
              </div>
              <div style={{ color: theme.tokens.badgeGatedText }}>
                21:35:02.100 [APPROVAL_GATE] Outbound email broadcast proposed. Blocked on operator signature.
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 2: ONBOARDING & PROVISIONING FLOW (NARRATIVE / TRUST BUILDING)     */}
        {/* ========================================================================= */}
        {(activeScreen === 'both' || activeScreen === 'onboarding') && (
          <section className="space-y-4 pt-4 border-t" style={{ borderColor: theme.tokens.border }}>
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: theme.tokens.border }}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: theme.tokens.textPrimary }}>
                  Screen 2: Workforce Provisioning & Onboarding
                </h2>
                <p className="text-xs" style={{ color: theme.tokens.textSecondary }}>
                  Persuasive workflow setup: business domain selection, autonomy governance tier, and security guardrails.
                </p>
              </div>
              <span
                style={{
                  backgroundColor: theme.tokens.surfaceSubtle,
                  borderColor: theme.tokens.border,
                  color: theme.tokens.textSecondary,
                }}
                className="text-xs px-2.5 py-1 rounded-[4px] border"
              >
                Step 2 of 4: Team Topology
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Business Selection */}
              <div className="lg:col-span-2 space-y-4">
                <div
                  style={{
                    backgroundColor: theme.tokens.surface,
                    borderColor: theme.tokens.border,
                  }}
                  className="p-5 rounded-[6px] border space-y-4"
                >
                  <div>
                    <h3 className="text-xs font-semibold" style={{ color: theme.tokens.textPrimary }}>
                      Select Primary Business Domain
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: theme.tokens.textSecondary }}>
                      Chatbolt configures pre-tested agent role topologies and guardrails for your specific workflow.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      {
                        title: 'SaaS & Technical Product',
                        desc: 'Autonomous code reviews, API scaffolding, and SRE incident triage.',
                        selected: true,
                      },
                      {
                        title: 'Digital Marketing & Growth',
                        desc: 'Multi-channel copywriting, SEO keyword clustering, and ad copy synthesis.',
                        selected: false,
                      },
                      {
                        title: 'E-commerce & Brand Operations',
                        desc: 'Catalog enrichment, customer support escalation, and order reconciliation.',
                        selected: false,
                      },
                      {
                        title: 'Enterprise Legal & Compliance',
                        desc: 'Contract redlining, NDA verification, and compliance policy mapping.',
                        selected: false,
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: item.selected ? theme.tokens.surfaceHover : theme.tokens.recessed,
                          borderColor: item.selected ? theme.tokens.focusRing : theme.tokens.borderSubtle,
                        }}
                        className="p-3.5 rounded-[6px] border transition-colors cursor-pointer space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold" style={{ color: theme.tokens.textPrimary }}>
                            {item.title}
                          </span>
                          {item.selected && (
                            <span
                              style={{
                                backgroundColor: theme.tokens.badgeNominalBg,
                                color: theme.tokens.badgeNominalText,
                                borderColor: theme.tokens.badgeNominalBorder,
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded border font-medium"
                            >
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-[11px]" style={{ color: theme.tokens.textSecondary }}>
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Autonomy Presets */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-medium" style={{ color: theme.tokens.textSecondary }}>
                      Autonomy Governance Level
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { title: 'Observe Only', subtitle: 'Read logs, zero write access' },
                        { title: 'Act With Approval', subtitle: 'Human signature for external actions', active: true },
                        { title: 'Full Autonomy', subtitle: 'Bounded strictly by spend budget' },
                      ].map((preset, idx) => (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: preset.active ? theme.tokens.surfaceHover : theme.tokens.recessed,
                            borderColor: preset.active ? theme.tokens.focusRing : theme.tokens.borderSubtle,
                          }}
                          className="p-3 rounded-[5px] border cursor-pointer space-y-1"
                        >
                          <div className="text-xs font-semibold" style={{ color: theme.tokens.textPrimary }}>
                            {preset.title}
                          </div>
                          <div className="text-[11px]" style={{ color: theme.tokens.textSecondary }}>
                            {preset.subtitle}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Pre-Execution Budget & Security Summary */}
              <div className="space-y-4">
                <div
                  style={{
                    backgroundColor: theme.tokens.surface,
                    borderColor: theme.tokens.border,
                  }}
                  className="p-5 rounded-[6px] border space-y-4"
                >
                  <h3 className="text-xs font-semibold" style={{ color: theme.tokens.textPrimary }}>
                    Security & Spend Safeguards
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div
                      style={{ backgroundColor: theme.tokens.recessed, borderColor: theme.tokens.borderSubtle }}
                      className="p-3 rounded-[5px] border space-y-1"
                    >
                      <span className="text-[11px] text-muted">Pre-Execution Budget Guard</span>
                      <div className="text-sm font-semibold tabular-nums" style={{ color: theme.tokens.textPrimary }}>
                        $100.00 / month hard cap
                      </div>
                      <p className="text-[11px]" style={{ color: theme.tokens.textSecondary }}>
                        Execution freezes before any token overage occurs.
                      </p>
                    </div>

                    <div
                      style={{ backgroundColor: theme.tokens.recessed, borderColor: theme.tokens.borderSubtle }}
                      className="p-3 rounded-[5px] border space-y-1"
                    >
                      <span className="text-[11px] text-muted">Sandbox Secret Stripping</span>
                      <div className="text-xs font-semibold" style={{ color: theme.tokens.spendPositive }}>
                        100% Host Isolation Active
                      </div>
                      <p className="text-[11px]" style={{ color: theme.tokens.textSecondary }}>
                        API keys, tokens, and credentials sanitized from agent memory.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      style={{
                        backgroundColor: theme.tokens.actionPrimary,
                        color: theme.tokens.actionPrimaryText,
                      }}
                      className="w-full h-9 text-xs font-semibold rounded-[5px] transition-colors cursor-pointer"
                    >
                      Provision & Deploy Agent Swarm
                    </button>
                    <button
                      style={{
                        borderColor: theme.tokens.border,
                        color: theme.tokens.textSecondary,
                      }}
                      className="w-full h-9 text-xs font-medium rounded-[5px] border hover:opacity-80 transition-opacity"
                    >
                      Inspect Architecture Spec
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
