'use client'
import React from 'react'
import { Bot, Search, PenLine, Mail, Code2, Database, Table2, BarChart2, Play, Edit3, Info } from 'lucide-react'

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  researcher:     { bg: '#EFF6FF', text: '#1E40AF', label: 'Researcher' },
  writer:         { bg: '#FAF5FF', text: '#6B21A8', label: 'Writer' },
  email_sender:   { bg: '#ECFDF5', text: '#065F46', label: 'Email Sender' },
  scraper:        { bg: '#FFF7ED', text: '#9A3412', label: 'Scraper' },
  web_scraper:    { bg: '#FFF7ED', text: '#9A3412', label: 'Scraper' },
  spreadsheet:    { bg: '#ECFDF5', text: '#047857', label: 'Spreadsheet' },
  data_processor: { bg: '#ECFEFF', text: '#155E75', label: 'Data' },
  code:           { bg: '#FFF1F2', text: '#9F1239', label: 'Coder' },
  coder:          { bg: '#FFF1F2', text: '#9F1239', label: 'Coder' },
  analyzer:       { bg: '#FEFCE8', text: '#854D0E', label: 'Analyzer' },
  summarizer:     { bg: '#FAF5FF', text: '#6B21A8', label: 'Summarizer' },
  reporter:       { bg: '#FAF5FF', text: '#6B21A8', label: 'Reporter' },
}

const ROLE_ICONS: Record<string, any> = {
  researcher: Search, writer: PenLine, email_sender: Mail,
  scraper: Code2, web_scraper: Code2, data_processor: Database,
  spreadsheet: Table2, code: Code2, coder: Code2,
  analyzer: BarChart2, summarizer: PenLine, reporter: PenLine,
}

const STATUS_CONFIG = {
  idle:      { dot: 'bg-gray-400',  text: 'Idle',       border: 'border-border', shadow: 'shadow-xs' },
  running:   { dot: 'bg-sky-600 animate-pulse', text: 'Running...', border: 'border-border-strong ring-1 ring-border-strong', shadow: 'shadow-xs' },
  completed: { dot: 'bg-emerald-600', text: 'Completed', border: 'border-emerald-200', shadow: 'shadow-xs' },
  failed:    { dot: 'bg-rose-600',   text: 'Failed',     border: 'border-rose-200', shadow: 'shadow-xs' },
  waiting:   { dot: 'bg-amber-500', text: 'Waiting...', border: 'border-amber-200', shadow: 'shadow-xs' },
}

interface AgentNodeProps {
  agent: any
  position: number
  x: number
  y: number
  status: 'idle' | 'running' | 'completed' | 'failed' | 'waiting'
  outputSummary?: string
  onMouseDown: (e: React.MouseEvent) => void
  onEdit: () => void
  onDetails: () => void
  onTest: () => void
  selected: boolean
}

export function AgentNode({ agent, position, x, y, status, outputSummary, onMouseDown, onEdit, onDetails, onTest, selected }: AgentNodeProps) {
  const role = agent.role || 'researcher'
  const roleConfig = ROLE_COLORS[role] || ROLE_COLORS.researcher
  const RoleIcon = ROLE_ICONS[role] || Bot
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle

  return (
    <div
      style={{ position: 'absolute', left: x, top: y, width: 220, zIndex: selected ? 20 : 10, userSelect: 'none' }}
      onMouseDown={onMouseDown}
    >
      <div className={`bg-surface border rounded-lg transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${statusCfg.border} ${statusCfg.shadow} ${selected ? 'ring-2 ring-action-primary border-transparent' : 'hover:border-border-strong'}`}>
        
        {/* Header */}
        <div className="px-3.5 pt-3 pb-1.5 flex items-center justify-between">
          <div className="w-5 h-5 rounded bg-secondary border border-border flex items-center justify-center text-primary text-[10px] font-mono font-bold shrink-0">
            {String(position).padStart(2,'0')}
          </div>
          <div className="px-2 py-0.5 rounded text-[10px] font-semibold border"
            style={{ background: roleConfig.bg, color: roleConfig.text, borderColor: `${roleConfig.text}25` }}>
            {roleConfig.label}
          </div>
        </div>

        {/* Body */}
        <div className="px-3.5 pb-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <RoleIcon size={13} style={{ color: roleConfig.text }} className="shrink-0" />
            <div className="text-xs font-bold text-primary truncate leading-tight">{agent.name}</div>
          </div>
          <p className="text-[11px] text-secondary leading-snug line-clamp-2">{agent.description}</p>
        </div>

        {/* Output preview */}
        {outputSummary && (
          <div className="mx-3.5 mb-2 px-2 py-1 bg-secondary rounded border border-border">
            <p className="text-[10px] text-secondary line-clamp-2">{outputSummary}</p>
          </div>
        )}

        {/* Status */}
        <div className="px-3.5 pb-2 flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider">{statusCfg.text}</span>
        </div>

        {/* Actions */}
        <div className="px-3 pb-3 grid grid-cols-3 gap-1" onMouseDown={e => e.stopPropagation()}>
          {[
            { label: 'Details', icon: Info, fn: onDetails },
            { label: 'Edit', icon: Edit3, fn: onEdit },
            { label: 'Test', icon: Play, fn: onTest },
          ].map(({ label, icon: Icon, fn }) => (
            <button key={label} onClick={fn}
              className="py-1 rounded bg-surface border border-border text-[10px] font-medium text-secondary hover:text-primary hover:bg-secondary transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs">
              <Icon size={10} />{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
