'use client'

import React, { useState, useEffect } from 'react'
import { Search, PenTool, MessageSquare, Layers, ArrowRight, Trash2, Heart } from 'lucide-react'
import { api } from '@/lib/api'

interface TemplateLibraryProps {
  onSelectTemplate: (templateText: string) => void
  visible: boolean
}

type Category = 'Research' | 'Writing' | 'Communication' | 'Productivity' | 'My templates'

const TEMPLATE_CATEGORIES: Record<Exclude<Category, 'My templates'>, { icon: React.ReactNode; templates: string[] }> = {
  Research: {
    icon: <Search size={14} className="text-sky-600" />,
    templates: [
      "Research the top 5 competitors to [my product] and build a comparison table",
      "Find recent news about [topic] and summarize the key developments",
      "Analyze [company name] — what do they do, who are their customers, and how are they doing?",
      "What are the most common customer complaints about [product or service]?",
      "Research pricing models used by [industry] companies and make a spreadsheet"
    ]
  },
  Writing: {
    icon: <PenTool size={14} className="text-purple-600" />,
    templates: [
      "Write a professional bio for me based on what you know about me",
      "Draft a [formal/casual] email to [recipient] about [topic]",
      "Write a LinkedIn post about [topic or achievement]",
      "Create a one-page project brief for [project name and description]",
      "Summarize this long document into 5 key bullet points: [paste text]"
    ]
  },
  Communication: {
    icon: <MessageSquare size={14} className="text-amber-600" />,
    templates: [
      "Check my emails and tell me what needs my attention today",
      "Draft replies to my 3 most important unread emails",
      "Post a status update to [Slack channel] saying [message]",
      "Schedule a [duration] meeting with [name] for [timeframe] and send an invite",
      "Write a follow-up message to [name] about our last conversation"
    ]
  },
  Productivity: {
    icon: <Layers size={14} className="text-emerald-600" />,
    templates: [
      "Look at my calendar this week and tell me where I have free time",
      "Take these notes and turn them into a structured action plan: [paste notes]",
      "Build me a weekly task tracker spreadsheet for [project or goal]",
      "Create a presentation summarizing [topic] in 8 slides",
      "Save this file to my Google Drive: [describe file or paste content]"
    ]
  }
}

export default function TemplateLibrary({ onSelectTemplate, visible }: TemplateLibraryProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('Research')
  const [personalTemplates, setPersonalTemplates] = useState<any[]>([])

  useEffect(() => {
    if (visible && activeCategory === 'My templates') {
      api.templates.list()
        .then(res => setPersonalTemplates(res.templates || []))
        .catch(err => console.warn('Failed to load templates:', err))
    }
  }, [visible, activeCategory])

  if (!visible) return null

  const getIcon = (cat: Category) => {
    if (cat === 'My templates') return <Heart size={14} className="text-rose-600" />
    return TEMPLATE_CATEGORIES[cat].icon
  }

  const isPersonalTab = activeCategory === 'My templates'
  const templatesToRender = isPersonalTab
    ? personalTemplates
    : TEMPLATE_CATEGORIES[activeCategory as Exclude<Category, 'My templates'>].templates.map(prompt => ({ prompt }))

  const handleDeleteTemplate = async (id: string) => {
    try {
      await api.templates.delete(id)
      setPersonalTemplates(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.warn('Failed to delete template:', err)
    }
  }

  return (
    <div className="mt-3 p-4 bg-surface border border-border rounded-xl shadow-md animate-in slide-in-from-bottom-2 duration-200">
      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 border-b border-border custom-scrollbar">
        {(['Research', 'Writing', 'Communication', 'Productivity', 'My templates'] as Category[]).map(cat => {
          const isActive = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-action-primary text-action-primary-text shadow-xs'
                  : 'bg-secondary/60 hover:bg-secondary text-secondary hover:text-primary'
              }`}
            >
              {getIcon(cat)}
              <span>{cat}</span>
            </button>
          )
        })}
      </div>

      {/* Grid of templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {isPersonalTab && templatesToRender.length === 0 ? (
          <div className="col-span-1 md:col-span-2 p-6 text-center text-muted italic text-xs">
            Your personal templates will appear here after you save them.
          </div>
        ) : (
          templatesToRender.map((tpl, idx) => {
            const renderedText = tpl.prompt.split(/(\[.*?\])/g).map((part: string, pIdx: number) => {
              if (part.startsWith('[') && part.endsWith(']')) {
                return (
                  <span key={pIdx} className="text-sky-800 font-semibold bg-sky-100 px-1 rounded">
                    {part}
                  </span>
                )
              }
              return <React.Fragment key={pIdx}>{part}</React.Fragment>
            })

            return (
              <div
                key={tpl.id || idx}
                className="group relative flex flex-col justify-between p-3.5 bg-surface hover:bg-subtle border border-border hover:border-border-strong rounded-lg transition-all duration-150 shadow-xs"
              >
                <div className="flex-1 cursor-pointer" onClick={() => onSelectTemplate(tpl.prompt)}>
                  {tpl.name && (
                    <h4 className="text-xs font-semibold text-primary mb-1">{tpl.name}</h4>
                  )}
                  <p className="text-xs text-secondary group-hover:text-primary leading-relaxed">
                    {renderedText}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                  {isPersonalTab ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTemplate(tpl.id)
                      }}
                      className="p-1 text-muted hover:text-rose-700 hover:bg-rose-50 rounded transition-all cursor-pointer"
                      title="Delete Template"
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : (
                    <div />
                  )}
                  <div 
                    className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-semibold text-sky-700" 
                    onClick={() => onSelectTemplate(tpl.prompt)}
                  >
                    <span className="mr-1">Use Template</span>
                    <ArrowRight size={12} />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
