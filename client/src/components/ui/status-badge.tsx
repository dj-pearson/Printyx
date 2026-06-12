import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  CircleDashed,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * StatusBadge - accessible status indicator (WCAG 1.4.1 Use of Color).
 *
 * Pairs every status color with an icon so meaning is never conveyed by
 * color alone. Color pairs meet WCAG AA 4.5:1 text contrast in both modes.
 */
const statusBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      status: {
        success:
          'border-transparent bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
        error: 'border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
        warning:
          'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
        info: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
        pending:
          'border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        neutral: 'border-border bg-transparent text-foreground',
      },
    },
    defaultVariants: {
      status: 'neutral',
    },
  },
);

const statusIcons: Record<NonNullable<StatusBadgeProps['status']>, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  pending: Clock,
  neutral: CircleDashed,
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  /** Hide the icon (only when an icon is already provided alongside). */
  hideIcon?: boolean;
}

function StatusBadge({ className, status, hideIcon, children, ...props }: StatusBadgeProps) {
  const Icon = statusIcons[status ?? 'neutral'];
  return (
    <span className={cn(statusBadgeVariants({ status }), className)} {...props}>
      {!hideIcon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

export { StatusBadge, statusBadgeVariants };
