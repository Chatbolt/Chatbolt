import React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all select-none rounded-[6px] cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-sky-500 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed'
    
    const variants = {
      primary: 'bg-action-primary hover:bg-action-primary-hover text-white border border-action-primary shadow-sm active:bg-slate-900',
      secondary: 'bg-surface hover:bg-surface-elevated text-primary border border-border shadow-sm active:bg-surface-subtle',
      outline: 'bg-white hover:bg-surface-subtle text-primary border border-border hover:border-slate-400 active:bg-surface-subtle',
      danger: 'bg-action-danger hover:bg-action-danger-hover text-white border border-action-danger shadow-sm active:bg-red-800',
      ghost: 'bg-transparent hover:bg-surface-subtle text-secondary hover:text-primary active:bg-surface-subtle',
    }

    const sizes = {
      sm: 'h-7 px-2.5 text-xs gap-1.5',
      md: 'h-9 px-3.5 text-xs font-semibold gap-2',
      lg: 'h-11 px-5 text-sm font-semibold gap-2.5',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
