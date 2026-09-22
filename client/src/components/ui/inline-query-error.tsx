/**
 * A failed request inside a card or a panel, said out loud.
 *
 * CR-033's guard exists because a component that renders identically on success
 * and on failure tells the reader something false: "no competitor recorded on
 * this deal" when the request 500'd, "no playbooks" when the endpoint 404'd.
 * The full-page `ErrorState` is right for a page and wrong for a 20-pixel card
 * slot - it is twelve rems of centred illustration - so every panel that hit
 * this ended up returning `null` instead, which is the defect.
 *
 * This is the card-sized version: one line, the destructive colour, and a retry
 * when the caller can offer one. It says the data could not be LOADED, never
 * that there is none.
 */
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InlineQueryErrorProps {
  /** What failed to load, in the words the surrounding UI uses ("battlecards"). */
  label: string;
  /** The query's own refetch, when there is one. */
  onRetry?: () => void;
  className?: string;
}

export function InlineQueryError({ label, onRetry, className }: InlineQueryErrorProps) {
  return (
    <div className={cn('flex items-start gap-2 text-sm text-destructive', className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Could not load {label}.{' '}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        ) : null}
      </span>
    </div>
  );
}
