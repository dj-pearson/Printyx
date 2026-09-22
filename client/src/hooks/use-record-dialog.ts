/**
 * One dialog that both creates and edits, and the state that decides which.
 *
 * FOUR CATALOGUE PAGES GOT THIS WRONG IN THREE DIFFERENT WAYS, because each was
 * written by copying the last:
 *
 *   - ManagedServices and ProfessionalServices had an Edit button that called
 *     `setSelected(row)` and nothing read it, so the button did nothing. eslint
 *     reported it only as "assigned a value but never used", which reads like
 *     dead state rather than a dead control.
 *   - EnhancedProductAccessories DID read it, and its Add button did not clear
 *     it - so opening Add after a cancelled Edit left the form populated with
 *     the previous row AND submitted a PATCH against it. That is the worse
 *     failure: it looks like a prefilled duplicate and silently edits.
 *   - Supplies had the dead button too.
 *
 * The rule that makes all three impossible is that the MODE and the FORM are
 * reset together, always, by whoever opens or closes the dialog. Callers get
 * `startCreate` / `startEdit` / `close` and never touch `setOpen` themselves.
 *
 * `reset` is the form's own reset, passed in rather than imported, so this hook
 * stays free of react-hook-form.
 *
 * The decision is a PURE FUNCTION below (`recordDialogTransition`) and the hook
 * is a thin wrapper over it, so the property that actually broke - the mode and
 * the form moving together - is testable without a React renderer. This repo
 * has no @testing-library/react, and adding one to test three state
 * transitions would be the wrong trade.
 */
import { useCallback, useState } from 'react';

export type RecordDialogAction = 'create' | 'edit' | 'close';

export interface RecordDialogTransition<T> {
  open: boolean;
  editing: T | null;
  /**
   * What to pass to the form's reset. `undefined` means "empty it" - which is
   * NOT the same as not calling reset at all, and conflating the two is how Add
   * after an Edit kept the previous row's values on screen.
   */
  resetWith: T | undefined;
}

export function recordDialogTransition<T>(
  action: RecordDialogAction,
  row?: T,
): RecordDialogTransition<T> {
  switch (action) {
    case 'edit':
      return { open: true, editing: (row ?? null) as T | null, resetWith: row };
    case 'create':
      return { open: true, editing: null, resetWith: undefined };
    case 'close':
      return { open: false, editing: null, resetWith: undefined };
  }
}

export interface RecordDialog<T> {
  /** Whether the dialog is open. */
  open: boolean;
  /** The row being edited, or null when creating. */
  editing: T | null;
  /** True when submitting should update rather than create. */
  isEditing: boolean;
  startCreate: () => void;
  startEdit: (row: T) => void;
  close: () => void;
  /**
   * Spread onto `<Dialog {...dialogProps}>`. Handles the CLOSE half only:
   * every opening path goes through startCreate or startEdit, which set the
   * mode that submit reads, so an `onOpenChange(true)` that bypassed them
   * would open the dialog in whatever mode was last used.
   */
  dialogProps: { open: boolean; onOpenChange: (next: boolean) => void };
}

export function useRecordDialog<T>(options: {
  /** Called with the row when editing and with nothing when creating. */
  reset: (row?: T) => void;
}): RecordDialog<T> {
  const { reset } = options;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);

  /**
   * ONE application site for every action, so no path can move the mode without
   * moving the form. Three separate bodies is how the four pages ended up with
   * three different bugs.
   */
  const apply = useCallback(
    (action: RecordDialogAction, row?: T) => {
      const next = recordDialogTransition<T>(action, row);
      setEditing(next.editing);
      reset(next.resetWith);
      setOpen(next.open);
    },
    [reset],
  );

  const startCreate = useCallback(() => apply('create'), [apply]);
  const startEdit = useCallback((row: T) => apply('edit', row), [apply]);
  const close = useCallback(() => apply('close'), [apply]);

  return {
    open,
    editing,
    isEditing: editing !== null,
    startCreate,
    startEdit,
    close,
    dialogProps: {
      open,
      onOpenChange: (next: boolean) => {
        if (!next) close();
      },
    },
  };
}
