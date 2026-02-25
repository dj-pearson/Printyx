import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SubmitButtonProps {
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  type?: 'submit' | 'button';
  onClick?: () => void;
}

/**
 * Consistent submit button with loading state (UX-004).
 * Shows a spinner when loading and disables interaction
 * during loading or when explicitly disabled.
 */
export function SubmitButton({
  loading = false,
  disabled = false,
  children,
  className,
  type = 'submit',
  onClick,
}: SubmitButtonProps) {
  return (
    <Button
      type={type}
      disabled={loading || disabled}
      className={cn('min-w-[120px]', className)}
      onClick={onClick}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
