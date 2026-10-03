'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Panel, PanelHeader, PanelContent, PanelFooter } from '@/components/ui/Panel'
import { StatusBadge, OperationalStatus } from '@/components/ui/StatusBadge'
import {
  DataTable,
  DataTableHeader,
  DataTableRow,
  DataTableHead,
  DataTableCell,
} from '@/components/ui/DataTable'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

interface AgentRow {
  id: string
  name: string
  role: string
  status: OperationalStatus
  statusLabel: string
  tokensUsed: string
  cost: string
  lastStep: string
}

export default function DesignSystemPage() {
  const [autonomyLevel, setAutonomyLevel] = useState('act_with_approval')
  const [activeTask, setActiveTask] = useState('Q3 Enterprise Campaign Synthesizer')
  const [spendLimit, setSpendLimit] = useState('250.00')
  const [isSyncing, setIsSyncing] = useState(false)
  const [emergencyHalted, setEmergencyHalted] = useState(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [telemetryOpen, setTelemetryOpen] = useState(true)

  const [agents, setAgents] = useState<AgentRow[]>([
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
  ])

  const showNotification = (msg: string) => {
    setActionNotice(msg)
    setTimeout(() => {
      setActionNotice((current) => (current === msg ? null : current))
    }, 4000)
  }

  // Button Action Handlers
  const handleEmergencyHalt = () => {
    if (!emergencyHalted) {
      setEmergencyHalted(true)
      setAgents((prev) =>
        prev.map((a) => ({
          ...a,
          status: 'fault',
          statusLabel: 'HALTED (Interlock Active)',
        }))
      )
      showNotification('EMERGENCY HALT TRIGGERED: All 5 agent sandboxes frozen immediately.')
    } else {
      setEmergencyHalted(false)
      setAgents([
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
      ])
      showNotification('Runtime reset: Agent pool returned to nominal state.')
    }
  }

  const handleExportAudit = () => {
    const auditData = {
      timestamp: new Date().toISOString(),
      sessionSpend: '$0.138',
      agents,
      securityStatus: '100% Secret Scrubbed',
    }
    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chatbolt-audit-ledger-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showNotification('Exported audit ledger JSON successfully.')
  }

  const handleDeploySwarm = () => {
    const newId = `agent_${String(agents.length + 1).padStart(2, '0')}`
    const newAgent: AgentRow = {
      id: newId,
      name: `Agent_${newId}`,
      role: 'Dynamic Sub-Task Worker',
      status: 'active',
      statusLabel: 'Executing Step 1/3',
      tokensUsed: '420',
      cost: '$0.001',
      lastStep: 'Task initialized from prompt blueprint',
    }
    setAgents((prev) => [...prev, newAgent])
    showNotification(`Spawned new worker sandbox [${newAgent.name}] into local runtime pool.`)
  }

  const handleApproveAgent = (id: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'nominal',
              statusLabel: 'Approved & Dispatched',
              lastStep: 'Human signature verified. Output released to outbound queue.',
            }
          : a
      )
    )
    showNotification(`Cryptographic approval signature applied to [${id}]. Action dispatched.`)
  }

  const handleReplayAgent = (id: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'active',
              statusLabel: 'Replaying ReAct Trace',
              lastStep: 'Re-evaluating step telemetry from immutable audit ledger...',
            }
          : a
      )
    )
    showNotification(`Replaying deterministic execution trace for [${id}].`)
  }

  const handleToggleSync = () => {
    setIsSyncing(true)
    setTimeout(() => {
      setIsSyncing(false)
      showNotification('Ledger synchronized across Go Runtime and PostgreSQL backend.')
    }, 1200)
  }

  return (
    <div className="min-h-screen bg-background text-primary p-6 lg:p-10 font-sans space-y-8 max-w-7xl mx-auto">
      {/* Dynamic Action Notification Toast Bar */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white px-4 py-3 rounded-[6px] shadow-lg text-xs font-medium flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{actionNotice}</span>
          <button
            onClick={() => setActionNotice(null)}
            className="text-gray-400 hover:text-white text-sm font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border pb-5 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary">
            Chatbolt Operational Visual Identity & Component System
          </h1>
          <p className="text-xs text-secondary mt-1">
            Direction B: Architectural Paper & Precision Ink — high-density operational software for supervised AI workforce management.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <StatusBadge
            status={emergencyHalted ? 'fault' : 'nominal'}
            label={emergencyHalted ? 'System Halted' : 'Runtime: Nominal (11.5MB)'}
          />
          <Button variant="outline" size="sm" onClick={handleExportAudit}>
            Export Audit Spec
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleEmergencyHalt}
          >
            {emergencyHalted ? 'Reset Runtime' : 'Emergency Halt'}
          </Button>
        </div>
      </div>

      {/* Grid: Buttons & Interactive Controls */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-primary tracking-tight">
            1. Control & Action Buttons (Click to Test Interactions)
          </h2>
          <span className="text-[11px] text-muted">All variants interactive with active states</span>
        </div>
        <Panel>
          <PanelContent className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleDeploySwarm}
            >
              Deploy Task Swarm
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => showNotification('Primary action triggered.')}
            >
              Primary Action
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => showNotification('Launched 20-agent workforce pool.')}
            >
              Launch Workforce
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setTelemetryOpen(!telemetryOpen)
                showNotification(`Execution stream ${!telemetryOpen ? 'expanded' : 'collapsed'}.`)
              }}
            >
              {telemetryOpen ? 'Hide Telemetry' : 'Inspect Telemetry'}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => showNotification('Sandbox environment: Isolated Go worker pool (PID 4192).')}
            >
              Configure Sandbox
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleEmergencyHalt}
            >
              {emergencyHalted ? 'Restore Swarm' : 'Kill Swarm'}
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => showNotification('Ghost action dismissed.')}
            >
              Dismiss
            </Button>
            <Button
              variant="primary"
              size="md"
              isLoading={isSyncing}
              onClick={handleToggleSync}
            >
              {isSyncing ? 'Syncing...' : 'Sync Ledger'}
            </Button>
          </PanelContent>
        </Panel>
      </section>

      {/* Grid: Status Badges (Deterministic Lifecycle States) */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-primary tracking-tight">
          2. Operational Lifecycle Status Badges (High Contrast Light Mode)
        </h2>
        <Panel>
          <PanelContent className="flex flex-wrap items-center gap-4">
            <StatusBadge status="idle" label="Idle / Ready" />
            <StatusBadge status="active" label="Executing (Step 3/5)" pulse />
            <StatusBadge status="gated" label="Awaiting Approval" />
            <StatusBadge status="fault" label="Runtime Panic" />
            <StatusBadge status="nominal" label="Nominal (100% Passed)" />
          </PanelContent>
        </Panel>
      </section>

      {/* Grid: Forms & Parameter Controls */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-primary tracking-tight">
          3. Precision Form Controls & Runtime Parameters
        </h2>
        <Panel>
          <PanelContent className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Input
              label="Active swarm task description"
              value={activeTask}
              onChange={(e) => setActiveTask(e.target.value)}
              helperText="Decomposes across marketing and research agents."
            />
            <Select
              label="Autonomy governance tier"
              value={autonomyLevel}
              onChange={(e) => {
                setAutonomyLevel(e.target.value)
                showNotification(`Autonomy tier changed to: ${e.target.value}`)
              }}
              options={[
                { value: 'observe_only', label: 'Observe only (read logs)' },
                { value: 'suggest_only', label: 'Suggest only (draft actions)' },
                { value: 'act_with_approval', label: 'Act with human approval' },
                { value: 'fully_autonomous', label: 'Fully autonomous' },
              ]}
              helperText="Requires cryptographic signature for external dispatch."
            />
            <Input
              label="Pre-execution spend cap ($ USD)"
              value={spendLimit}
              onChange={(e) => setSpendLimit(e.target.value)}
              helperText="Hard stop triggered if estimated tokens exceed ceiling."
            />
          </PanelContent>
        </Panel>
      </section>

      {/* High-Density Data Table: Live Agent Supervision Ledger */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-primary tracking-tight">
            4. Live Agent Supervision & Accountability Ledger (Interactive Row Actions)
          </h2>
          <span className="text-[11px] text-secondary tabular-nums">
            Active Swarm: {agents.length}/20 Concurrency Pool
          </span>
        </div>
        <Panel>
          <DataTable>
            <DataTableHeader>
              <tr>
                <DataTableHead>Agent ID</DataTableHead>
                <DataTableHead>Specialized Role</DataTableHead>
                <DataTableHead>Operational Status</DataTableHead>
                <DataTableHead>Tokens Metered</DataTableHead>
                <DataTableHead>Itemized Cost</DataTableHead>
                <DataTableHead>Current Step / State</DataTableHead>
                <DataTableHead className="text-right">Action</DataTableHead>
              </tr>
            </DataTableHeader>
            <tbody>
              {agents.map((agent) => (
                <DataTableRow key={agent.id}>
                  <DataTableCell className="font-mono text-primary text-xs font-semibold">
                    {agent.name}
                  </DataTableCell>
                  <DataTableCell className="text-secondary">{agent.role}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      status={agent.status}
                      label={agent.statusLabel}
                      pulse={agent.status === 'active'}
                      size="sm"
                    />
                  </DataTableCell>
                  <DataTableCell className="tabular-nums font-mono text-secondary text-xs">
                    {agent.tokensUsed}
                  </DataTableCell>
                  <DataTableCell className="tabular-nums font-mono text-primary text-xs font-bold">
                    {agent.cost}
                  </DataTableCell>
                  <DataTableCell className="text-secondary text-xs truncate max-w-xs">
                    {agent.lastStep}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    {agent.status === 'gated' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApproveAgent(agent.id)}
                      >
                        Approve Step
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReplayAgent(agent.id)}
                      >
                        Replay
                      </Button>
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </DataTable>
          <PanelFooter>
            <div className="flex items-center gap-4 text-[11px] text-secondary">
              <span>Total Session Spend: <strong className="text-primary tabular-nums font-mono font-bold">$0.138</strong></span>
              <span>Memory Footprint: <strong className="text-primary tabular-nums font-mono font-bold">11.5 MB</strong></span>
              <span>Secret Scrubbing: <strong className="text-emerald-700 font-semibold">100% Active</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportAudit}>
                Download Audit Ledger (JSON)
              </Button>
            </div>
          </PanelFooter>
        </Panel>
      </section>

      {/* Recessed Console Stream Demo */}
      {telemetryOpen && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-primary tracking-tight">
            5. Recessed Console Well: Live Execution Stream
          </h2>
          <Panel variant="recessed">
            <PanelHeader
              title="Isolated Go Runtime Worker [Worker-03]"
              description="LangGraph ReAct Loop / Sandboxed Execution Stream"
              action={<StatusBadge status={emergencyHalted ? 'fault' : 'active'} label={emergencyHalted ? 'Halted' : 'Stream Live'} size="sm" pulse={!emergencyHalted} />}
            />
            <PanelContent className="font-mono text-[11px] space-y-1.5 p-4 bg-console border-t border-border">
              <div className="text-muted">21:40:02.104 [RUNTIME] Sandbox worker spawned with PID 4192 (env secrets stripped).</div>
              <div className="text-primary font-semibold">21:40:02.180 [PLAN] Decomposing task: Generate B2B value propositions for growth agencies.</div>
              <div className="text-sky-700">21:40:03.012 [TOOL:SEARCH] Query: &quot;enterprise agent workforce benchmarks 2026&quot;</div>
              <div className="text-secondary">21:40:03.850 [OBSERVATION] 14 authoritative sources parsed (2,410 tokens returned).</div>
              <div className="text-amber-800 font-medium">21:40:04.210 [APPROVAL_GATE] External dispatch proposed. Awaiting operator signature.</div>
            </PanelContent>
          </Panel>
        </section>
      )}
    </div>
  )
}
