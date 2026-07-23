import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import {
  COOKIE_CATEGORIES,
  CONSENT_VERSION,
  NON_ESSENTIAL_CATEGORIES,
  OPEN_COOKIE_SETTINGS_EVENT,
  allGranted,
  essentialOnly,
  getConsent,
  getGpcSignal,
  hasDecided,
  setConsent,
  type ConsentMethod,
  type CookieCategory,
} from '@/lib/cookie-consent';

type View = 'banner' | 'preferences';

export function CookieConsent() {
  const { user, isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState<View>('banner');
  const [selection, setSelection] = useState<Record<CookieCategory, boolean>>(essentialOnly());
  const gpc = getGpcSignal();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Seed the toggle state from any existing record (for re-entry via footer).
  const seedSelection = useCallback(() => {
    const existing = getConsent();
    setSelection(existing ? { ...essentialOnly(), ...existing.categories } : essentialOnly());
  }, []);

  useEffect(() => {
    if (!hasDecided()) {
      seedSelection();
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [seedSelection]);

  // Allow reopening the preferences dialog from anywhere (e.g. footer link).
  useEffect(() => {
    const open = () => {
      seedSelection();
      setView('preferences');
      setVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
  }, [seedSelection]);

  useEffect(() => {
    if (visible && view === 'preferences') headingRef.current?.focus();
  }, [visible, view]);

  /**
   * Best-effort: mirror the choice into the server consent ledger for logged-in
   * users so authenticated consent is auditable. Anonymous visitors are recorded
   * client-side only (standard for pre-auth cookie consent). Never blocks the UI.
   */
  const syncToServer = useCallback(
    async (categories: Record<CookieCategory, boolean>) => {
      if (!isAuthenticated || !user?.id) return;
      // The record endpoint marks status 'given'. Only sync GRANTED categories;
      // denied categories are simply absent from the ledger (reads as not_given).
      // Withdrawal of a previously-granted category is handled by the consent
      // center (roadmap P1), not this best-effort banner sync.
      const grantedCategories = NON_ESSENTIAL_CATEGORIES.filter((c) => categories[c] === true);
      await Promise.all(
        grantedCategories.map((category) =>
          apiRequest('/api/gdpr/consent', 'POST', {
            subjectType: 'user',
            subjectId: user.id,
            subjectEmail: user.email,
            consentType: `cookie_${category}`,
            source: 'cookie_banner',
            legalBasis: 'consent',
            version: String(CONSENT_VERSION),
            consentText: `Cookie consent (${category}): granted`,
          }).catch(() => undefined),
        ),
      ).catch(() => undefined);
    },
    [isAuthenticated, user?.id, user?.email],
  );

  const persist = useCallback(
    (categories: Record<CookieCategory, boolean>, method: ConsentMethod) => {
      setConsent(categories, method);
      void syncToServer(categories);
      setVisible(false);
      setView('banner');
    },
    [syncToServer],
  );

  const acceptAll = () => persist(allGranted(), 'accept_all');
  const rejectAll = () => persist(essentialOnly(), 'reject_all');
  const savePreferences = () => persist(selection, gpc ? 'gpc' : 'custom');

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal={view === 'preferences'}
      aria-labelledby="cookie-consent-heading"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg md:p-6"
    >
      <div className="mx-auto max-w-5xl">
        {view === 'banner' ? (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="cookie-consent-heading" className="sr-only">
                Cookie consent
              </h2>
              <p className="text-sm text-muted-foreground">
                We use cookies to run the site, and — with your consent — to analyze usage and
                improve your experience. You can accept all, reject non-essential, or choose which
                categories to allow. See our{' '}
                <a href="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
                </a>
                .
                {gpc && (
                  <span className="mt-1 block text-xs">
                    We detected a Global Privacy Control signal and have turned off analytics and
                    marketing cookies by default.
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => setView('preferences')}>
                Customize
              </Button>
              <Button variant="outline" size="sm" onClick={rejectAll}>
                Reject non-essential
              </Button>
              <Button size="sm" onClick={acceptAll}>
                Accept all
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h2
              id="cookie-consent-heading"
              ref={headingRef}
              tabIndex={-1}
              className="text-base font-semibold outline-none"
            >
              Manage cookie preferences
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose which categories of cookies to allow. Strictly-necessary cookies are always
              active. Read more in our{' '}
              <a href="/privacy" className="underline hover:text-foreground">
                Privacy Policy
              </a>
              .
            </p>

            <ul className="mt-4 divide-y">
              {COOKIE_CATEGORIES.map((category) => (
                <li key={category.key} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <label
                      htmlFor={`cookie-${category.key}`}
                      className="text-sm font-medium text-foreground"
                    >
                      {category.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{category.description}</p>
                  </div>
                  <Switch
                    id={`cookie-${category.key}`}
                    checked={category.essential ? true : selection[category.key]}
                    disabled={category.essential}
                    aria-label={`${category.label} cookies`}
                    onCheckedChange={(checked) =>
                      setSelection((prev) => ({ ...prev, [category.key]: checked }))
                    }
                  />
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={rejectAll}>
                Reject non-essential
              </Button>
              <Button variant="outline" size="sm" onClick={acceptAll}>
                Accept all
              </Button>
              <Button size="sm" onClick={savePreferences}>
                Save preferences
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
