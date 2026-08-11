import { useEffect } from 'react';

/**
 * COP-I02: consume `?action=new` and open the page's create dialog.
 *
 * The command palette's "Create ..." entries have always navigated with this
 * query param, but no page ever read it — so those actions silently did nothing
 * except move the user to a list. This hook is the missing half.
 *
 * It fires once on mount and then strips the param via history.replaceState, so
 * a refresh or a back-navigation does not re-open the dialog. It is deliberately
 * mount-only: this is a one-shot handoff, not a piece of reactive state.
 *
 * Used by both the CrmIndexShell pages and the legacy index pages, so the same
 * palette entry behaves identically wherever navigation happens to point today.
 */
export function useCreateFromUrl(onCreateNew?: () => void) {
  useEffect(() => {
    if (typeof window === 'undefined' || !onCreateNew) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('action') !== 'new') return;

    onCreateNew();

    params.delete('action');
    const qs = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
