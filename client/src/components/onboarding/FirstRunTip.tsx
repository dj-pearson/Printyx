/**
 * CRMX-014: lightweight first-visit coach mark. A dismissible contextual tip
 * shown once per `tipKey` (persisted in localStorage). Renders nothing after the
 * user dismisses it. Use on first visit to core pages to orient new users.
 */
import { useEffect, useState } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FirstRunTipProps {
  tipKey: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}

const STORAGE_PREFIX = 'coachmark:dismissed:';

export function FirstRunTip({ tipKey, title, children, className }: FirstRunTipProps) {
  const storageKey = `${STORAGE_PREFIX}${tipKey}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // ignore storage errors
    }
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3',
        className,
      )}
      role="note"
    >
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="flex-1 min-w-0 pr-6">
        <p className="text-sm font-medium">{title}</p>
        {children && <div className="text-sm text-muted-foreground">{children}</div>}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
