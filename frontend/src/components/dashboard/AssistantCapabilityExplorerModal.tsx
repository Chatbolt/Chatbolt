'use client'

import React from 'react'
import {
  Sparkles,
  X,
  ArrowRight,
  Code,
  Search,
  PenTool,
  BarChart3,
  Calendar,
  Compass,
  CheckCircle2,
  Zap
} from 'lucide-react'

interface CapabilityExplorerProps {
  isOpen: boolean
  onClose: () => void
  onSelectPrompt: (prompt: string) => void
  agentName: string
}

interface CapabilityCategory {
  id: string
  title: string
  icon: any
  tagline: string
  color: string
  specialistRole: string
  recipes: Array<{
    title: string
    prompt: string
    badge?: string
  }>
}

const CAPABILITIES: CapabilityCategory[] = [
  {
    id: 'writing',
    title: 'Editorial & Communications',
    icon: PenTool,
    tagline: 'Draft nuance-rich emails, announcements, summaries, and structured documents.',
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    specialistRole: 'Writer Specialist',
    recipes: [
      {
        title: 'Draft Executive Weekly Memo',
        prompt: 'Draft an executive weekly update memo covering our key engineering milestones, upcoming launch dates, and cross-team dependencies.',
        badge: 'Popular'
      },
      {
        title: 'Polite Follow-Up Email',
        prompt: 'Write a polite, professional follow-up email to a prospective partner after 4 days of silence regarding our proposal.',
        badge: 'Everyday'
      },
      {
        title: 'Meeting Notes Synthesizer',
        prompt: 'Synthesize the following rough notes into clear decisions, key owners, and next action items with deadlines.'
      }
    ]
  },
  {
    id: 'research',
    title: 'Deep Research & Web Intelligence',
    icon: Search,
    tagline: 'Compare options, extract citations, summarize long articles, and gather structured facts.',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    specialistRole: 'Researcher Specialist',
    recipes: [
      {
        title: 'Compare 3 Tools / Hardware',
        prompt: 'Compare the top 3 lightweight laptops for software engineering under $1,500. Compare battery life, weight, and thermals.',
        badge: 'High Value'
      },
      {
        title: 'Comprehensive Topic Brief',
        prompt: 'Give me a structured briefing on the newest advancements in local LLM quantization (GGUF, AWQ, EXL2) and their VRAM trade-offs.'
      },
      {
        title: 'Travel & Itinerary Discovery',
        prompt: 'Research top quiet work-friendly cafes and boutique stays in Kyoto with reliable high-speed fiber internet.'
      }
    ]
  },
  {
    id: 'code',
    title: 'Code, Scripts & Debugging',
    icon: Code,
    tagline: 'Fix scripts on your laptop, scaffold helpers, write SQL, and diagnose error traces.',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    specialistRole: 'Code Specialist',
    recipes: [
      {
        title: 'Python Helper / Data Cleaner',
        prompt: 'Write a Python script that reads a folder of messy CSV files, standardizes phone numbers to E.164, drops duplicates, and exports a clean parquet file.',
        badge: 'Fast Run'
      },
      {
        title: 'SQL Query & Index Helper',
        prompt: 'Write an optimized PostgreSQL query with window functions to find the top 5 highest-spending users per cohort month.'
      },
      {
        title: 'Regex & Parsing Script',
        prompt: 'Write a TypeScript regex and utility function to extract all email addresses and markdown links from arbitrary HTML text with unit tests.'
      }
    ]
  },
  {
    id: 'data',
    title: 'Data, Math & Budget Breakdown',
    icon: BarChart3,
    tagline: 'Calculate budgets, currency conversions, parse tables, and format financial estimates.',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    specialistRole: 'Data Analyst Specialist',
    recipes: [
      {
        title: 'Vacation Budget Breakdown',
        prompt: 'Calculate a line-item budget table for a 6-day family trip to Tokyo: flights, mid-range hotels, food, local transit, and contingency in both USD and JPY.',
        badge: 'Multi-Step'
      },
      {
        title: 'Unit Economics & ROI Check',
        prompt: 'Calculate the monthly break-even subscriber count for a SaaS product charging $29/mo with $4.50 COGS and $1,200 fixed server costs.'
      }
    ]
  },
  {
    id: 'planning',
    title: 'Personal DAGs & Multi-Step Missions',
    icon: Compass,
    tagline: 'Compound requests that coordinate research, budget, code, and writing sequentially.',
    color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    specialistRole: 'Planner & Squad',
    recipes: [
      {
        title: 'Plan Trip + Budget + Itinerary',
        prompt: 'Plan a 4-day autumn trip to Kyoto: research top cultural sites, build a detailed daily schedule, and draft a line-item budget table.',
        badge: 'Full Squad'
      },
      {
        title: 'Audit Project + Draft Action Plan',
        prompt: 'Review our product launch requirements, draft a 2-week checklist broken down by day, and draft the launch day announcement email.'
      }
    ]
  }
]

export default function AssistantCapabilityExplorerModal({
  isOpen,
  onClose,
  onSelectPrompt,
  agentName
}: CapabilityExplorerProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#0f0f15] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-white/[0.02] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#534AB7] to-[#3B3299] flex items-center justify-center text-white shadow-lg shadow-[#534AB7]/20 border border-white/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                What {agentName} Can Handle
              </h2>
              <p className="text-xs text-zinc-400">
                {agentName} coordinates 40+ specialized agents behind the scenes for one seamless answer.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Capabilities List */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
          {CAPABILITIES.map(cat => {
            const Icon = cat.icon
            return (
              <div key={cat.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg border ${cat.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-white">{cat.title}</h3>
                      <p className="text-[11px] text-zinc-400">{cat.tagline}</p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block text-[10px] font-mono text-zinc-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                    via {cat.specialistRole}
                  </span>
                </div>

                {/* Recipes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {cat.recipes.map((recipe, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        onSelectPrompt(recipe.prompt)
                        onClose()
                      }}
                      className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#00DFB8]/40 hover:bg-white/[0.04] transition-all cursor-pointer group flex flex-col justify-between space-y-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white group-hover:text-[#00DFB8] transition-colors">
                            {recipe.title}
                          </span>
                          {recipe.badge && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10">
                              {recipe.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                          "{recipe.prompt}"
                        </p>
                      </div>
                      <div className="flex items-center justify-end text-[10px] font-bold text-zinc-500 group-hover:text-[#00DFB8] transition-colors gap-1 pt-1">
                        <span>Try this</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-zinc-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#00DFB8]" />
            <span>Multi-agent coordination is completely automated & zero-cost</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
