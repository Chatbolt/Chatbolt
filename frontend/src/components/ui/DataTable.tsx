import React from 'react'
import { cn } from '@/lib/utils'

export interface DataTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode
}

export const DataTable: React.FC<DataTableProps> = ({ className, children, ...props }) => {
  return (
    <div className="w-full overflow-x-auto custom-scrollbar border border-border rounded-[6px] bg-surface">
      <table className="w-full text-left border-collapse" {...props}>
        {children}
      </table>
    </div>
  )
}

export const DataTableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <thead className={cn('bg-surface-subtle border-b border-border text-secondary text-[11px] font-semibold', className)} {...props}>
      {children}
    </thead>
  )
}

export const DataTableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <tr
      className={cn(
        'border-b border-border-subtle last:border-0 hover:bg-surface-elevated/50 transition-colors text-xs text-primary',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  )
}

export const DataTableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <th className={cn('py-2.5 px-3.5 tracking-normal select-none', className)} {...props}>
      {children}
    </th>
  )
}

export const DataTableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <td className={cn('py-2.5 px-3.5 align-middle', className)} {...props}>
      {children}
    </td>
  )
}
