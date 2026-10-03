'use client'

import React from 'react'
import { Sparkles, ArrowRight, Check, Zap } from 'lucide-react'

interface UpgradePromptProps {
  message: string
  taskType?: string
  onUpgradeClick?: () => void
  isDark?: boolean
}

export default function UpgradePrompt({
  message,
  taskType = 'other',
  onUpgradeClick,
  isDark = false
}: UpgradePromptProps) {
  const handleCheckout = () => {
    if (onUpgradeClick) {
      onUpgradeClick()
      return
    }
    window.location.href = `/dashboard/settings/billing?source=${taskType}`
  }

  return (
    <div className="my-4 p-5 rounded-xl border border-amber-200 bg-amber-50/50 text-primary shadow-xs">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-amber-100 border border-amber-200 text-amber-800">
          <Zap size={18} />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold uppercase tracking-wider">
              <Sparkles size={12} />
              <span>Usage Limit Reached</span>
            </div>
            <p className="mt-1 text-xs text-primary font-medium leading-relaxed">
              {message}
            </p>
          </div>

          {/* Plan Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-1">
            <div className="p-3.5 rounded-lg border border-border bg-surface shadow-xs">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Free Plan</div>
              <ul className="space-y-1.5 text-xs text-secondary">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-border" />
                  20 tasks per month
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-border" />
                  Standard concurrency
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-border" />
                  2 integrations limit
                </li>
              </ul>
            </div>

            <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 shadow-xs">
              <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                <span>Pro Upgrade</span>
                <Sparkles size={11} className="text-emerald-700" />
              </div>
              <ul className="space-y-1.5 text-xs text-emerald-900">
                <li className="flex items-center gap-2">
                  <Check size={12} className="text-emerald-700 shrink-0" />
                  500 tasks / month
                </li>
                <li className="flex items-center gap-2">
                  <Check size={12} className="text-emerald-700 shrink-0" />
                  High reasoning models
                </li>
                <li className="flex items-center gap-2">
                  <Check size={12} className="text-emerald-700 shrink-0" />
                  Unlimited integrations
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={handleCheckout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold
                bg-action-primary hover:bg-action-primary-hover text-action-primary-text transition-all cursor-pointer shadow-xs"
            >
              <span>Upgrade to Pro</span>
              <ArrowRight size={13} />
            </button>
            <a
              href="/pricing"
              className="text-xs font-medium text-secondary hover:text-primary transition-colors"
            >
              Compare plans
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
