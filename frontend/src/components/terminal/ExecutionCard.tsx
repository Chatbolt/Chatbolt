import React, { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Loader2, Play, Check } from 'lucide-react'
import { TERMINAL_STRINGS, sanitizeUserFacingText } from './strings'

interface StepItem {
  id?: string
  position: number
  name: string
  role: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting'
}

interface ExecutionCardProps {
  status: string
  progress?: number
  steps?: StepItem[]
  logs?: string[]
  runId?: string
  workflowId?: string
  taskReceipt?: string
  templateCandidate?: boolean
  onCancel: () => void
}

const ExecutionCard = React.memo(({
  status,
  progress,
  steps = [],
  logs = [],
  runId,
  workflowId,
  taskReceipt,
  templateCandidate = false,
  onCancel
}: ExecutionCardProps) => {
  const isExecuting = status === 'executing' || status === 'planning'
  const isCompleted = status === 'completed'
  const isFailed = status === 'failed'

  const totalSteps = steps.length
  const completedStepsCount = steps.filter(s => s.status === 'completed').length

  const [showTemplateChip, setShowTemplateChip] = useState(templateCandidate)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templatePrompt, setTemplatePrompt] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  useEffect(() => {
    setShowTemplateChip(templateCandidate)
  }, [templateCandidate])

  const handleOpenSave = async () => {
    if (!runId || !workflowId) return
    try {
      const { api } = await import('@/lib/api')
      const res = await api.workflows.getRun(workflowId, runId)
      if (res?.run) {
        setTemplateName(res.run.workflow_name || 'My Custom Template')
        setTemplatePrompt(res.run.original_prompt || '')
        setTemplateDescription(res.run.task_receipt || '')
        setShowSaveModal(true)
      }
    } catch (err) {
      console.warn('Failed to load run details for template:', err)
    }
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateName.trim() || !templatePrompt.trim()) return
    setSavingTemplate(true)
    try {
      const { api } = await import('@/lib/api')
      await api.templates.create({
        name: templateName,
        description: templateDescription,
        prompt: templatePrompt,
        task_type: 'custom'
      })
      setShowSaveModal(false)
      setShowTemplateChip(false)
      if (runId && workflowId) {
        await api.workflows.updateRun(workflowId, runId, { template_candidate: false })
      }
    } catch (err) {
      console.warn('Failed to save template:', err)
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDismissTemplate = async () => {
    setShowTemplateChip(false)
    try {
      const { api } = await import('@/lib/api')
      if (runId && workflowId) {
        await api.workflows.updateRun(workflowId, runId, { template_candidate: false })
      }
    } catch (err) {
      console.warn('Failed to dismiss template:', err)
    }
  }

  // If completed, transition the entire card into a compact receipt card
  if (isCompleted) {
    return (
      <div className="bg-surface border border-emerald-200 rounded-xl p-4.5 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-800">
            Task Resolved • {completedStepsCount} of {totalSteps} steps completed
          </span>
        </div>
        {taskReceipt ? (
          <p className="text-xs text-primary leading-relaxed font-normal bg-secondary/50 p-3 rounded-lg border border-border">
            {taskReceipt}
          </p>
        ) : (
          <p className="text-xs text-secondary leading-relaxed">
            Your task has been executed successfully.
          </p>
        )}

        {/* Save as Template Prompt */}
        {showTemplateChip && (
          <div className="flex items-center justify-between p-3 bg-secondary/40 border border-border rounded-lg mt-2">
            <span className="text-xs font-medium text-secondary">Save this setup as a template?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDismissTemplate}
                className="px-2.5 py-1 text-secondary hover:text-primary bg-surface border border-border rounded-md text-xs font-medium transition-all cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleOpenSave}
                className="px-2.5 py-1 text-action-primary-text bg-action-primary hover:bg-action-primary-hover rounded-md text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Save Modal */}
        {showSaveModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={() => setShowSaveModal(false)} />
            <form onSubmit={handleSaveTemplate} className="bg-surface border border-border rounded-xl max-w-md w-full p-6 relative z-10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-semibold text-primary">
                  Save Personal Template
                </span>
                <button type="button" onClick={() => setShowSaveModal(false)} className="text-xs text-muted hover:text-primary transition-colors cursor-pointer">
                  Close
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider block">Template Name</label>
                  <input 
                    type="text" 
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="e.g. Daily Outbound Report"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-primary outline-none focus:border-border-strong placeholder:text-muted/60"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider block">Original Prompt</label>
                  <textarea 
                    value={templatePrompt}
                    onChange={e => setTemplatePrompt(e.target.value)}
                    className="w-full h-20 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-primary outline-none focus:border-border-strong placeholder:text-muted/60 resize-none font-medium"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider block">Description (Optional)</label>
                  <textarea 
                    value={templateDescription}
                    onChange={e => setTemplateDescription(e.target.value)}
                    placeholder="Brief description of the template purpose..."
                    className="w-full h-16 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-primary outline-none focus:border-border-strong placeholder:text-muted/60 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowSaveModal(false)} className="px-3.5 py-1.5 bg-secondary border border-border rounded-lg text-xs font-medium text-primary hover:bg-subtle cursor-pointer">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingTemplate}
                  className="px-3.5 py-1.5 bg-action-primary text-action-primary-text rounded-lg text-xs font-semibold hover:bg-action-primary-hover transition-colors cursor-pointer shadow-xs"
                >
                  {savingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl shadow-xs space-y-4 p-4.5">
      {/* Execution Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isFailed ? 'bg-rose-600' : 'bg-sky-600 animate-pulse'
          }`} />
          <span className="text-xs font-semibold text-primary">
            {TERMINAL_STRINGS.processProgressTitle}
          </span>
        </div>
        
        {isExecuting && (
          <button
            onClick={onCancel}
            className="hover:bg-rose-50 border border-border rounded-md text-secondary hover:text-rose-700 transition-all cursor-pointer text-[11px] font-medium px-2 py-1"
          >
            {TERMINAL_STRINGS.cancelLabel}
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {progress !== undefined && (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-semibold text-secondary">
            <span>Overall Completion</span>
            <span className="text-sky-700 font-mono font-medium">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-secondary border border-border rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps List */}
      {steps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
          {steps.map((s) => {
            const isDone = s.status === 'completed'
            return (
              <div
                key={s.position}
                className={`rounded-lg border flex items-center gap-2.5 p-2.5 transition-all ${
                  s.status === 'running'
                    ? 'bg-sky-50 border-sky-200 shadow-xs'
                    : isDone
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : s.status === 'failed'
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-subtle border-border'
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                  isDone
                    ? 'bg-emerald-100 text-emerald-800'
                    : s.status === 'running'
                    ? 'bg-sky-600 text-white animate-pulse'
                    : s.status === 'failed'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-secondary text-secondary'
                }`}>
                  {isDone ? <Check size={11} /> : s.status === 'failed' ? <XCircle size={11} /> : s.position}
                </div>
                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <p className="text-xs font-semibold text-primary truncate">{sanitizeUserFacingText(s.name)}</p>
                  {!isDone && (
                    <p className="text-[10px] text-secondary truncate">
                      Phase {s.position}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Console Log Narration */}
      {logs.length > 0 && (
        <div className="space-y-1">
          <div className="bg-secondary border border-border rounded-lg p-3 h-28 overflow-y-auto font-mono text-[11px] text-primary space-y-1 custom-scrollbar">
            {logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed whitespace-pre-wrap">
                {sanitizeUserFacingText(log)}
              </div>
            ))}
            {isExecuting && (
              <div className="flex items-center gap-1.5 mt-1.5 text-sky-700">
                <Loader2 size={10} className="animate-spin" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Processing</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

ExecutionCard.displayName = 'ExecutionCard'

export default ExecutionCard
