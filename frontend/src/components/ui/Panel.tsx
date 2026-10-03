import React from 'react'
import { cn } from '@/lib/utils'

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'recessed' | 'subtle'
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-surface border border-border rounded-[6px]',
      recessed: 'bg-console border border-border-subtle rounded-[6px]',
      subtle: 'bg-surface-subtle border border-border-subtle rounded-[6px]',
    }

    return (
      <div
        ref={ref}
        className={cn(variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Panel.displayName = 'Panel'

export interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  action?: React.ReactNode
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  className,
  title,
  description,
  action,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 border-b border-border text-primary',
        className
      )}
      {...props}
    >
      <div>
        {title && <h3 className="text-xs font-semibold tracking-normal text-primary">{title}</h3>}
        {description && <p className="text-[11px] text-secondary mt-0.5">{description}</p>}
        {children}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}

export const PanelContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  )
}

export const PanelFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'px-4 py-2.5 bg-surface-subtle border-t border-border-subtle rounded-b-[6px] text-xs text-secondary flex items-center justify-between',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
