import React, { useState } from 'react'
import { Bot, User, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import ExecutionCard from './ExecutionCard'
import PermissionCard from './PermissionCard'
import UpgradePrompt from './UpgradePrompt'
import { TERMINAL_STRINGS, sanitizeUserFacingText } from './strings'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content?: string
  isTask?: boolean
  taskConfig?: any
  runId?: string
  workflowId?: string
  status?: string
  steps?: any[]
  logs?: string[]
  screenshot?: string
  progress?: number
  isTyping?: boolean
  taskReceipt?: string
  templateCandidate?: boolean
}

interface ChatThreadProps {
  messages: ChatMessage[]
  onApprovePermission: (msgIndex: number) => void
  onRejectPermission: (msgIndex: number) => void
  onCancelRun: (runId: string) => void
  onSubmitCalibration: (msgIndex: number, values: Record<string, string>) => void
  onDismissCancel?: (msgIndex: number) => void
}

// Inline Markdown formatter
function formatMarkdown(text: string): string {
  if (!text) return ''
  return text
    // Code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="code-block font-mono text-[11px] bg-secondary border border-border text-primary p-3.5 rounded-lg my-2 whitespace-pre-wrap"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-secondary border border-border rounded px-1.5 py-0.5 font-mono text-[11px] text-primary">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-primary">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em class="italic text-primary">$1</em>')
    // Bullet lists
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-primary">$1</li>')
}

// Inline config form for missing parameters
function InlineCalibrationForm({
  fields,
  onSubmit
}: {
  fields: any[]
  onSubmit: (values: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const missing = fields.filter(f => f.required && !values[f.field]?.trim())
    if (missing.length > 0) return
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 mt-2 bg-surface border border-border p-4.5 rounded-xl shadow-xs">
      <div className="space-y-0.5">
        <h5 className="text-xs font-semibold text-primary">
          {TERMINAL_STRINGS.needsInputsTitle}
        </h5>
        <p className="text-xs text-secondary">
          {TERMINAL_STRINGS.needsInputsSubtitle}
        </p>
      </div>

      {fields.map(f => (
        <div key={f.field} className="space-y-1">
          <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider block">
            {f.question} {f.required && <span className="text-rose-600">*</span>}
          </label>
          <input
            type={f.type === 'number' ? 'number' : 'text'}
            placeholder={`Enter ${f.field}...`}
            value={values[f.field] || ''}
            onChange={(e) => setValues(prev => ({ ...prev, [f.field]: e.target.value }))}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted/60 outline-none focus:border-border-strong shadow-xs transition-colors"
            required={f.required}
          />
        </div>
      ))}
      <button
        type="submit"
        className="w-full py-2 bg-action-primary hover:bg-action-primary-hover text-action-primary-text font-semibold rounded-lg text-xs transition-all cursor-pointer shadow-xs"
      >
        Confirm Parameters
      </button>
    </form>
  )
}

// Sub-component for cancel confirmation
function CancelConfirmationCard({
  runId,
  idx,
  onDismissCancel,
  onCancelRun
}: {
  runId?: string
  idx: number
  onDismissCancel?: (idx: number) => void
  onCancelRun: (runId: string) => void
}) {
  const containerRef = useFocusTrap(true) as React.MutableRefObject<HTMLDivElement | null>

  return (
    <div ref={containerRef} className="w-full min-w-[280px] md:min-w-[420px] bg-surface border border-rose-200 p-4.5 rounded-xl flex flex-col gap-3 shadow-xs">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
        <span className="text-xs font-semibold text-rose-700">Cancel Task Confirmation</span>
      </div>
      <p className="text-xs text-secondary">
        Are you sure you want to cancel the currently running process?
      </p>
      <div className="flex items-center gap-2.5 mt-1">
        <button
          type="button"
          onClick={() => {
            if (onDismissCancel) {
              onDismissCancel(idx)
            }
          }}
          className="flex-1 py-1.5 bg-secondary hover:bg-subtle text-primary font-medium rounded-lg text-xs transition-all cursor-pointer border border-border"
        >
          Keep going
        </button>
        <button
          type="button"
          onClick={() => {
            if (runId) onCancelRun(runId)
          }}
          className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs transition-all cursor-pointer shadow-xs"
        >
          Yes, cancel
        </button>
      </div>
    </div>
  )
}

const MessageBubble = React.memo(({
  msg,
  idx,
  onApprovePermission,
  onRejectPermission,
  onCancelRun,
  onSubmitCalibration,
  onDismissCancel
}: {
  msg: ChatMessage
  idx: number
  onApprovePermission: (msgIndex: number) => void
  onRejectPermission: (msgIndex: number) => void
  onCancelRun: (runId: string) => void
  onSubmitCalibration: (msgIndex: number, values: Record<string, string>) => void
  onDismissCancel?: (msgIndex: number) => void
}) => {
  const isUser = msg.role === 'user'
  const isError = !isUser && msg.content && (msg.content.toLowerCase().startsWith('error') || msg.content.toLowerCase().includes('failed to fetch'))

  return (
    <div className={`flex gap-3.5 max-w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      
      {/* Left side avatar for Assistant */}
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary shrink-0 shadow-xs">
          <Bot size={15} />
        </div>
      )}

      {/* Bubble Contents */}
      <div className={`flex flex-col gap-2.5 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Text Bubble */}
        {(msg.content || msg.isTyping) && (
          <div className={`rounded-xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
            isUser
              ? 'bg-surface border border-border text-primary font-medium'
              : isError
              ? 'bg-rose-50 border border-rose-200 text-rose-800 font-medium'
              : 'bg-surface border border-border text-primary'
          }`}>
            <div 
              dangerouslySetInnerHTML={{ __html: formatMarkdown(sanitizeUserFacingText(msg.content || '')) }} 
              className="space-y-1.5"
            />
            {msg.isTyping && (
              <span className="inline-block w-1.5 h-3.5 bg-sky-600 ml-1.5 animate-pulse align-middle" />
            )}
          </div>
        )}

        {/* Step Progress Tracker Card */}
        {msg.isTask && msg.status !== 'needs_inputs' && (
          <div className="w-full min-w-[280px] md:min-w-[420px]">
            <ExecutionCard
              status={msg.status || 'planning'}
              progress={msg.progress}
              steps={msg.steps}
              logs={msg.logs}
              runId={msg.runId}
              taskReceipt={msg.taskReceipt}
              templateCandidate={msg.templateCandidate}
              onCancel={() => msg.runId && onCancelRun(msg.runId)}
            />
          </div>
        )}

        {/* Inline Permission Gates */}
        {msg.isTask && msg.status === 'waiting' && (
          <div className="w-full min-w-[280px] md:min-w-[420px]">
            <PermissionCard
              onApprove={() => onApprovePermission(idx)}
              onReject={() => onRejectPermission(idx)}
            />
          </div>
        )}

        {/* Inline Calibration Setup form */}
        {msg.isTask && msg.status === 'needs_inputs' && msg.taskConfig && (
          <div className="w-full min-w-[280px] md:min-w-[420px]">
            <InlineCalibrationForm
              fields={msg.taskConfig.missing_inputs || []}
              onSubmit={(values) => onSubmitCalibration(idx, values)}
            />
          </div>
        )}

        {/* Inline Integration Connection card */}
        {msg.isTask && msg.status === 'integration_required' && msg.taskConfig && (
          <div className="w-full min-w-[280px] md:min-w-[420px] bg-surface border border-border p-5 rounded-xl flex flex-col items-center gap-3.5 text-center shadow-xs">
            <div className="w-9 h-9 bg-secondary border border-border rounded-lg flex items-center justify-center text-primary font-bold">
              ⚡
            </div>
            <p className="text-xs text-primary font-medium">
              {msg.taskConfig.userMessage}
            </p>
            <a
              href={msg.taskConfig.actionUrl}
              className="px-4 py-2 bg-action-primary hover:bg-action-primary-hover text-action-primary-text font-semibold rounded-lg text-xs transition-all cursor-pointer shadow-xs no-underline"
            >
              Connect {msg.taskConfig.service === 'google-calendar' ? 'Google Calendar' : msg.taskConfig.service === 'google-drive' ? 'Google Drive' : msg.taskConfig.service.charAt(0).toUpperCase() + msg.taskConfig.service.slice(1)}
            </a>
          </div>
        )}

        {/* Inline Billing Upgrade card */}
        {msg.isTask && msg.status === 'billing_required' && msg.taskConfig && (
          <UpgradePrompt
            message={msg.taskConfig.userMessage}
            taskType={msg.taskConfig.taskType}
            onUpgradeClick={() => {
              window.location.href = msg.taskConfig.actionUrl
            }}
            isDark={false}
          />
        )}

        {/* Inline Cancel Confirmation */}
        {msg.isTask && msg.status === 'cancel_confirmation' && (
          <CancelConfirmationCard
            runId={msg.runId}
            idx={idx}
            onDismissCancel={onDismissCancel}
            onCancelRun={onCancelRun}
          />
        )}

      </div>

      {/* Right side avatar for User */}
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-action-primary border border-border flex items-center justify-center text-action-primary-text shrink-0 shadow-xs">
          <User size={15} />
        </div>
      )}

    </div>
  )
})

MessageBubble.displayName = 'MessageBubble'

export default function ChatThread({
  messages,
  onApprovePermission,
  onRejectPermission,
  onCancelRun,
  onSubmitCalibration,
  onDismissCancel
}: ChatThreadProps) {
  return (
    <div className="space-y-6">
      {messages.map((msg, idx) => (
        <MessageBubble
          key={msg.id || idx}
          msg={msg}
          idx={idx}
          onApprovePermission={onApprovePermission}
          onRejectPermission={onRejectPermission}
          onCancelRun={onCancelRun}
          onSubmitCalibration={onSubmitCalibration}
          onDismissCancel={onDismissCancel}
        />
      ))}
    </div>
  )
}
