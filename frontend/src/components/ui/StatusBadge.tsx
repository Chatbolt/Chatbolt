import React from 'react'
import { cn } from '@/lib/utils'

export type OperationalStatus = 'idle' | 'active' | 'gated' | 'fault' | 'nominal'

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: OperationalStatus
  label?: string
  pulse?: boolean
  size?: 'sm' | 'md'
}

const statusConfig: Record<
  OperationalStatus,
  { defaultLabel: string; dotClass: string; badgeClass: string }
> = {
  idle: {
    defaultLabel: 'Idle',
    dotClass: 'bg-gray-500',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  active: {
    defaultLabel: 'Executing',
    dotClass: 'bg-sky-600',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-300',
  },
  gated: {
    defaultLabel: 'Awaiting approval',
    dotClass: 'bg-amber-600',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
  },
  fault: {
    defaultLabel: 'Runtime fault',
    dotClass: 'bg-red-600',
    badgeClass: 'bg-red-50 text-red-900 border-red-300',
  },
  nominal: {
    defaultLabel: 'Nominal',
    dotClass: 'bg-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  },
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  pulse = false,
  size = 'md',
  className,
  ...props
}) => {
  const config = statusConfig[status]
  const displayLabel = label || config.defaultLabel

  const sizes = {
    sm: 'h-5 px-2 text-[11px] gap-1.5',
    md: 'h-6 px-2.5 text-xs gap-2',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-[4px] border select-none',
        sizes[size],
        config.badgeClass,
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          config.dotClass,
          pulse && 'animate-pulse'
        )}
      />
      <span>{displayLabel}</span>
    </span>
  )
}
