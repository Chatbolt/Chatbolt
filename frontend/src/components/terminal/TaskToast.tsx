'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, X, ExternalLink, Sparkles, AlertCircle } from 'lucide-react'

export interface TaskToastData {
  id: string
  title: string
  description?: string
  runId?: string
  type?: 'success' | 'error' | 'info'
}

interface TaskToastProps {
  tasks: TaskToastData[]
  onDismiss: (id: string) => void
  onViewTask?: (runId: string) => void
}

export function useTaskToast() {
  const [toasts, setToasts] = useState<TaskToastData[]>([])

  const addToast = useCallback((data: Omit<TaskToastData, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setToasts(prev => [...prev, { ...data, id }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, dismissToast }
}

function SingleToast({
  task,
  onDismiss,
  onViewTask
}: {
  task: TaskToastData
  onDismiss: (id: string) => void
  onViewTask?: (runId: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  const dismiss = useCallback(() => {
    setExiting(true)
    setTimeout(() => onDismiss(task.id), 350)
  }, [task.id, onDismiss])

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 50)
    const dismissTimer = setTimeout(dismiss, 8000)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(dismissTimer)
    }
  }, [dismiss])

  const isError = task.type === 'error'

  return (
    <div
      className={`
        w-80 rounded-xl border ${isError ? 'border-rose-200 bg-rose-50/95' : 'border-border bg-surface/95'} backdrop-blur-xs p-4
        shadow-xl
        transition-all duration-300 ease-out
        ${visible && !exiting ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${isError ? 'text-rose-600' : 'text-emerald-600'}`}>
          {isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Sparkles size={11} className={isError ? 'text-rose-600' : 'text-sky-600'} />
            <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">
              {isError ? 'Task Failed' : 'Task Complete'}
            </p>
          </div>
          <p className="text-xs font-semibold text-primary mt-0.5 truncate">{task.title}</p>
          {task.description && (
            <p className="text-xs text-secondary mt-1 line-clamp-2">{task.description}</p>
          )}
          {task.runId && onViewTask && (
            <button
              onClick={() => onViewTask(task.runId!)}
              className="mt-2 flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
            >
              <span>View results</span>
              <ExternalLink size={11} />
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          className="text-muted hover:text-primary transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${isError ? 'bg-rose-600' : 'bg-emerald-600'} rounded-full`}
          style={{ animation: 'shrink 8s linear forwards' }}
        />
      </div>
      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}

export default function TaskToast({ tasks, onDismiss, onViewTask }: TaskToastProps) {
  if (tasks.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center">
      {tasks.map((task) => (
        <SingleToast
          key={task.id}
          task={task}
          onDismiss={onDismiss}
          onViewTask={onViewTask}
        />
      ))}
    </div>
  )
}
