'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Compass, Clock, Terminal, Shield, Keyboard, X, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelectShortcut: (prompt: string, autoSubmit: boolean) => void
  onOpenHistory: () => void
}

interface PaletteItem {
  id: string
  label: string
  category: 'Actions' | 'Recent' | 'Quick access'
  icon: React.ReactNode
  prompt?: string
  action?: () => void
  autoSubmit?: boolean
}

export default function CommandPalette({
  isOpen,
  onClose,
  onSelectShortcut,
  onOpenHistory
}: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentRuns, setRecentRuns] = useState<any[]>([])
  const [connectedServices, setConnectedServices] = useState<string[]>([])
  const containerRef = useFocusTrap(isOpen) as React.MutableRefObject<HTMLDivElement | null>
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    
    setQuery('')
    setSelectedIndex(0)
    setTimeout(() => inputRef.current?.focus(), 100)

    const fetchData = async () => {
      try {
        const intRes = await api.integrations.list().catch(() => ({ integrations: [] }))
        const connected = (intRes.integrations || [])
          .filter((i: any) => i.connected)
          .map((i: any) => i.service)
        setConnectedServices(connected)

        const runRes = await api.workflows.listRuns({ limit: 5 }).catch(() => ({ runs: [] }))
        setRecentRuns(runRes.runs || [])
      } catch (err) {
        console.warn('Failed to pre-fetch commands data:', err)
      }
    }
    fetchData()
  }, [isOpen])

  const defaultItems: PaletteItem[] = useMemo(() => {
    const list: PaletteItem[] = [
      {
        id: 'new-task',
        label: 'Start new task',
        category: 'Actions',
        icon: <Terminal size={14} className="text-primary" />,
        action: () => {
          onClose()
          setTimeout(() => document.getElementById('terminal-input')?.focus(), 50)
        }
      },
      {
        id: 'view-history',
        label: 'View execution history',
        category: 'Actions',
        icon: <Clock size={14} className="text-secondary" />,
        action: () => {
          onClose()
          onOpenHistory()
        }
      },
      {
        id: 'view-security',
        label: 'Manage integrations & permissions',
        category: 'Actions',
        icon: <Shield size={14} className="text-secondary" />,
        action: () => {
          onClose()
          router.push('/dashboard/plugins')
        }
      }
    ]

    // Service based shortcuts
    if (connectedServices.includes('gmail')) {
      list.push({
        id: 'quick-unread-emails',
        label: 'Check unread emails',
        category: 'Quick access',
        icon: <span className="text-xs">✉️</span>,
        prompt: 'Check my latest unread emails and draft replies for priority messages',
        autoSubmit: true
      })
    }
    if (connectedServices.includes('google-calendar') || connectedServices.includes('calendar')) {
      list.push({
        id: 'quick-calendar-prep',
        label: 'Prepare for tomorrow\'s meetings',
        category: 'Quick access',
        icon: <span className="text-xs">📅</span>,
        prompt: 'Look at my calendar events for tomorrow and prepare a meeting prep summary',
        autoSubmit: true
      })
    }
    if (connectedServices.includes('slack')) {
      list.push({
        id: 'quick-slack-summary',
        label: 'Summarize Slack channels',
        category: 'Quick access',
        icon: <span className="text-xs">💬</span>,
        prompt: 'Scan recent messages in my priority Slack channels and list action items',
        autoSubmit: true
      })
    }

    // Default suggestions
    list.push(
      {
        id: 'quick-competitor-research',
        label: 'Research competitors',
        category: 'Quick access',
        icon: <span className="text-xs">🔍</span>,
        prompt: 'Research top 5 competitors to [my product] and create a comparison table',
        autoSubmit: false
      },
      {
        id: 'quick-weekly-brief',
        label: 'Build project brief',
        category: 'Quick access',
        icon: <span className="text-xs">📄</span>,
        prompt: 'Create a one-page project brief for [project description]',
        autoSubmit: false
      }
    )

    // Recent runs
    recentRuns.forEach(r => {
      if (r.prompt) {
        list.push({
          id: `recent-${r.id}`,
          label: r.prompt,
          category: 'Recent',
          icon: <Clock size={13} className="text-muted" />,
          prompt: r.prompt,
          autoSubmit: true
        })
      }
    })

    return list
  }, [connectedServices, recentRuns, router, onClose, onOpenHistory])

  const filteredItems = useMemo(() => {
    if (!query.trim()) return defaultItems
    const q = query.toLowerCase()
    return defaultItems.filter(item => 
      item.label.toLowerCase().includes(q) || 
      item.category.toLowerCase().includes(q) ||
      (item.prompt && item.prompt.toLowerCase().includes(q))
    )
  }, [defaultItems, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredItems, selectedIndex, onClose])

  const handleSelect = (item: PaletteItem) => {
    if (item.action) {
      item.action()
    } else if (item.prompt !== undefined) {
      onSelectShortcut(item.prompt, item.autoSubmit || false)
      onClose()
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div 
        ref={containerRef}
        className="w-full max-w-[560px] min-h-[380px] max-h-[80vh] bg-surface border border-border rounded-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search header */}
        <div className="flex items-center gap-3 border-b border-border px-4 bg-subtle/50">
          <Search size={16} className="text-secondary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent py-3.5 text-xs text-primary focus:outline-none placeholder:text-muted/60 font-medium"
          />
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-secondary bg-secondary border border-border rounded px-1.5 py-0.5 font-semibold uppercase tracking-wider">ESC</span>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-secondary gap-2">
              <Compass size={24} className="text-muted" />
              <p className="text-xs font-semibold">No results found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {['Actions', 'Quick access', 'Recent'].map(cat => {
                const catItems = filteredItems.filter(item => item.category === cat)
                if (catItems.length === 0) return null

                return (
                  <div key={cat} className="space-y-1">
                    <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider px-3 py-1.5">
                      {cat}
                    </h4>
                    {catItems.map((item) => {
                      const absoluteIndex = filteredItems.findIndex(fi => fi.id === item.id)
                      const isSelected = absoluteIndex === selectedIndex

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150
                            ${isSelected 
                              ? 'bg-secondary text-primary shadow-xs' 
                              : 'text-secondary hover:text-primary hover:bg-subtle'
                            }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="shrink-0 flex items-center justify-center w-5 h-5 rounded bg-surface border border-border">
                              {item.icon}
                            </div>
                            <span className="truncate pr-4">{item.label}</span>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-1 shrink-0 text-sky-700">
                              <span className="text-[10px] font-semibold uppercase tracking-wider">Select</span>
                              <Check size={12} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-subtle/50 text-[11px] text-secondary font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Keyboard size={12} /> Arrow keys to navigate
            </span>
            <span>↵ Enter to select</span>
          </div>
          <span>Chatbolt Commands</span>
        </div>
      </div>
    </div>
  )
}
