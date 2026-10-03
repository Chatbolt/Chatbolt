import React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-primary"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full h-9 px-3 bg-white border border-border rounded-[6px] text-xs text-primary placeholder:text-muted',
            'focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20 transition-all',
            'disabled:opacity-50 disabled:bg-surface-subtle disabled:cursor-not-allowed',
            error && 'border-signal-red focus:border-signal-red focus:ring-signal-red/20',
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-[11px] text-signal-red font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-secondary">{helperText}</p>
        ) : null}
      </div>
    )
  }
)
Input.displayName = 'Input'
