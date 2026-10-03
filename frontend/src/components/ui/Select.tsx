import React from 'react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helperText?: string
  error?: string
  options?: SelectOption[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, helperText, error, id, options, children, disabled, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-primary"
          >
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full h-9 px-3 bg-white border border-border rounded-[6px] text-xs text-primary cursor-pointer',
            'focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20 transition-all',
            'disabled:opacity-50 disabled:bg-surface-subtle disabled:cursor-not-allowed',
            error && 'border-signal-red focus:border-signal-red focus:ring-signal-red/20',
            className
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-white text-primary">
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error ? (
          <p className="text-[11px] text-signal-red font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-secondary">{helperText}</p>
        ) : null}
      </div>
    )
  }
)
Select.displayName = 'Select'
