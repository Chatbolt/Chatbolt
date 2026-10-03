'use client'

import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Paperclip, Mic, ArrowUp } from 'lucide-react'
import { TERMINAL_STRINGS } from './strings'

export interface InputBarProps {
  onSend: (text: string) => void
  disabled?: boolean
  value: string
  onChange: (val: string) => void
  onFocus?: () => void
  onBlur?: () => void
  placeholder?: string
}

export interface InputBarRef {
  focus: () => void
  selectPlaceholder: () => void
}

const InputBar = forwardRef<InputBarRef, InputBarProps>(({ 
  onSend, 
  disabled, 
  value, 
  onChange,
  onFocus,
  onBlur,
  placeholder
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const inputHistory = useRef<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isFocused, setIsFocused] = useState(false)
  
  // File upload and parsing states
  const [fileContext, setFileContext] = useState<{ filename: string; content: string } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus()
    },
    selectPlaceholder: () => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      const text = textarea.value
      // Match brackets like [my product]
      const match = text.match(/\[.*?\]/)
      if (match && match.index !== undefined) {
        textarea.setSelectionRange(match.index, match.index + match[0].length)
      }
    }
  }))

  // Auto-resize textarea logic
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [value])

  // Ctrl+/ listener to focus textarea
  useEffect(() => {
    const handleFocusKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleFocusKey)
    return () => window.removeEventListener('keydown', handleFocusKey)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
      return
    }

    // Do not navigate history when the textarea contains multi-line content (newlines present)
    const hasNewlines = value.includes('\n')
    if (hasNewlines) {
      setHistoryIndex(-1)
      return
    }

    const textarea = textareaRef.current
    const cursorAtStart = textarea ? textarea.selectionStart === 0 : true

    if (e.key === 'ArrowUp') {
      if (value === '' || cursorAtStart) {
        e.preventDefault()
        if (inputHistory.current.length === 0) return

        const nextIndex = historyIndex === -1 ? inputHistory.current.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(nextIndex)
        onChange(inputHistory.current[nextIndex])
      }
    } else if (e.key === 'ArrowDown') {
      if (historyIndex !== -1) {
        e.preventDefault()
        const nextIndex = historyIndex + 1
        if (nextIndex >= inputHistory.current.length) {
          setHistoryIndex(-1)
          onChange('')
        } else {
          setHistoryIndex(nextIndex)
          onChange(inputHistory.current[nextIndex])
        }
      }
    }
  }

  const handleSubmit = () => {
    if ((!value.trim() && !fileContext) || disabled || uploading) return

    let finalPrompt = value.trim()
    if (fileContext) {
      finalPrompt = `${finalPrompt}\n\n[Attached File: ${fileContext.filename}]\n${fileContext.content}`
    }

    // Save to history (avoid consecutive duplicates, limit to 20)
    const history = inputHistory.current
    if (history.length === 0 || history[history.length - 1] !== value.trim()) {
      inputHistory.current = [...history, value.trim()].slice(-20)
    }
    setHistoryIndex(-1)

    onSend(finalPrompt)
    setFileContext(null)
    setUploadError(null)
  }

  const handlePaperclipClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10MB limit')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const res = await fetch(`${baseUrl}/files/upload`, {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload/parse file')
      }

      setFileContext({
        filename: file.name,
        content: data.text || data.content || ''
      })
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        className={`border transition-all duration-200 flex items-end gap-2 shadow-xs bg-surface rounded-xl px-2 py-1.5
          ${isFocused
            ? 'border-border-strong ring-1 ring-border-strong'
            : 'border-border'
          }`}
      >
        
        {/* File Attachment Button */}
        <button
          type="button"
          onClick={handlePaperclipClick}
          disabled={disabled || uploading}
          title={TERMINAL_STRINGS.attachButton}
          className="p-2 hover:bg-secondary rounded-lg text-secondary hover:text-primary transition-all cursor-pointer disabled:opacity-50"
        >
          <Paperclip size={16} />
        </button>

        {/* Auto-growing Textarea Input */}
        <textarea
          id="terminal-input"
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            setIsFocused(true)
            onFocus?.()
          }}
          onBlur={(e) => {
            setIsFocused(false)
            onBlur?.()
          }}
          placeholder={placeholder || TERMINAL_STRINGS.inputPlaceholder}
          disabled={disabled || uploading}
          className="flex-1 bg-transparent border-0 outline-none text-primary text-xs font-sans py-2 px-1 resize-none min-h-[36px] max-h-[120px] custom-scrollbar placeholder:text-muted/60"
        />

        {/* Voice Input Button */}
        <button
          type="button"
          title={TERMINAL_STRINGS.voiceButton}
          disabled={disabled || uploading}
          className="p-2 hover:bg-secondary rounded-lg text-secondary hover:text-primary transition-all cursor-pointer disabled:opacity-50"
        >
          <Mic size={16} />
        </button>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || uploading || !value.trim()}
          className={`p-2 rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-xs ${
            value.trim() && !disabled && !uploading
              ? 'bg-action-primary text-action-primary-text hover:bg-action-primary-hover active:scale-[0.98]'
              : 'bg-secondary text-muted cursor-not-allowed'
          }`}
        >
          <ArrowUp size={15} />
        </button>
        
      </div>

      {/* File chip and inline error messages */}
      {(fileContext || uploading || uploadError) && (
        <div className="flex flex-col gap-1 px-1">
          {uploading && (
            <div className="text-[11px] text-secondary flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-ping" />
              Uploading and parsing file...
            </div>
          )}
          {fileContext && (
            <div className="flex items-center gap-1.5 bg-secondary border border-border rounded-lg px-2.5 py-1.5 max-w-xs text-primary shadow-xs">
              <span className="text-xs text-primary truncate max-w-[180px] font-medium">📎 {fileContext.filename}</span>
              <button 
                onClick={() => setFileContext(null)} 
                className="ml-auto text-muted hover:text-rose-700 transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
          )}
          {uploadError && (
            <div className="text-[11px] text-rose-700 font-medium">
              ⚠️ {uploadError}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

InputBar.displayName = 'InputBar'

export default InputBar
