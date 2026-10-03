import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { TERMINAL_STRINGS, sanitizeUserFacingText } from './strings'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface PermissionCardProps {
  onApprove: () => void
  onReject: () => void
}

export default function PermissionCard({ onApprove, onReject }: PermissionCardProps) {
  const containerRef = useFocusTrap(true) as React.MutableRefObject<HTMLDivElement | null>

  return (
    <div ref={containerRef} className="p-4.5 bg-amber-50 border border-amber-200 rounded-xl space-y-3.5 shadow-xs">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-700 shrink-0 mt-0.5" size={16} />
        <div className="space-y-0.5">
          <h5 className="text-xs font-semibold text-amber-900">
            Authorization Request
          </h5>
          <p className="text-xs text-amber-800 leading-relaxed">
            {sanitizeUserFacingText("A planned execution step requires your confirmation to execute outbound actions.")}
          </p>
        </div>
      </div>
      
      <div className="flex gap-2 justify-end">
        <button
          onClick={onReject}
          className="px-3.5 py-1.5 bg-surface border border-border hover:bg-rose-50 hover:text-rose-700 rounded-lg text-xs font-medium text-secondary transition-all cursor-pointer shadow-xs"
        >
          {TERMINAL_STRINGS.rejectLabel}
        </button>
        <button
          onClick={onApprove}
          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-all cursor-pointer shadow-xs"
        >
          {TERMINAL_STRINGS.approveLabel}
        </button>
      </div>
    </div>
  )
}
