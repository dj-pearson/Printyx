import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

/**
 * Standardized form field wrapper (UX-004).
 * Wraps any input element with a consistent label, required indicator,
 * error message, and help text layout.
 */
export function FormField({
  label,
  error,
  required,
  helpText,
  children,
  className,
  htmlFor,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {!error && helpText && <p className="text-sm text-muted-foreground">{helpText}</p>}
    </div>
  );
}
