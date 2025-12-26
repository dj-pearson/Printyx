import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LoadingButtonProps extends ButtonProps {
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Text to display while loading (defaults to children) */
  loadingText?: string;
  /** Accessible label for the loading state */
  loadingLabel?: string;
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      children,
      loading = false,
      loadingText,
      loadingLabel = 'Loading, please wait',
      disabled,
      className,
      'aria-label': ariaLabel,
      ...props
    },
    ref,
  ) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        className={cn(className)}
        aria-busy={loading}
        aria-label={loading ? loadingLabel : ariaLabel}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {loading ? loadingText || children : children}
      </Button>
    );
  },
);

LoadingButton.displayName = 'LoadingButton';

export { LoadingButton };
