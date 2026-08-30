import { useEffect, useState } from 'react';

/**
 * Reads the `?action=` query parameter a quick-action link carries.
 *
 * WHY THIS EXISTS. The breadcrumb in main-layout renders quick actions on every
 * page - "Add Equipment", "Generate Invoice", "Add Part" - and each was a link
 * to `<list page>?action=new`. No page in the app read that parameter
 * (AUDIT-014), so all nine buttons dropped the user on a list and did nothing.
 * They looked like create buttons and were not.
 *
 * THE PARAMETER IS CONSUMED ONCE. It is stripped from the URL with
 * history.replaceState as soon as it is read, so reloading the page - or
 * closing the dialog and pressing back - does not reopen it. Without that, a
 * dialog opened this way is impossible to dismiss by refreshing.
 *
 * Usage:
 *   const action = useActionParam();
 *   useEffect(() => {
 *     if (action === 'new') setIsCreateOpen(true);
 *   }, [action]);
 */
export function useActionParam(): string | null {
  const [action, setAction] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const value = params.get('action');
    if (!value) return;

    setAction(value);
    params.delete('action');
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (query ? `?${query}` : '') + window.location.hash,
    );
  }, []);

  return action;
}
