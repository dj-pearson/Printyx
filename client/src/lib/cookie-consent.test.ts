/**
 * LEGAL-001: the consent gate is the thing every non-essential script asks
 * before loading, so its default-deny behavior is worth pinning down. A
 * regression here silently re-enables collection without consent, which is
 * exactly the failure this story was opened for.
 */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  CONSENT_VERSION,
  allGranted,
  essentialOnly,
  getConsent,
  hasConsent,
  hasDecided,
  setConsent,
} from './cookie-consent';

const STORAGE_KEY = 'printyx-cookie-consent';

/** Minimal localStorage for the node test environment. */
function installLocalStorage() {
  const map = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = stub;
  return stub;
}

function setGpc(on: boolean) {
  (globalThis as { navigator?: unknown }).navigator = { globalPrivacyControl: on };
}

/**
 * These three globals must be REMOVED again after each test, not just
 * overwritten (CR-033 follow-up).
 *
 * vitest runs this whole repo in ONE fork (vitest.config.ts sets
 * pool: 'forks', singleFork: true), so anything left on globalThis outlives the
 * file that put it there and is visible to every file that runs afterwards.
 * This suite used to install window, localStorage and navigator in beforeEach
 * and clear only the store, which left a `window` with no `document` and no
 * `location` on the global object for the rest of the run. Two separate
 * order-dependent failures came from exactly that, each passing in isolation and
 * failing about one run in four depending on file order:
 *
 *   - client/src/lib/mobile-logger.ts guards on `typeof window !== 'undefined'`
 *     and then reaches for document and window.location, so it threw at module
 *     scope and took down every test importing queryClient.
 *   - isomorphic-dompurify picks its browser implementation when a global
 *     `window` exists, and that implementation has no `.sanitize` without a
 *     document — so server/middleware/input-sanitization.ts died with
 *     "DOMPurify.sanitize is not a function" in
 *     server/tests/unit/input-sanitization.test.ts.
 *
 * Restoring the previous descriptor (usually "absent") is what makes this file
 * safe to run next to server tests.
 */
const LEAKED_GLOBALS = ['window', 'localStorage', 'navigator'] as const;

describe('cookie consent gate', () => {
  let store: ReturnType<typeof installLocalStorage>;
  let priorDescriptors: Array<[string, PropertyDescriptor | undefined]>;

  beforeEach(() => {
    priorDescriptors = LEAKED_GLOBALS.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]);
    store = installLocalStorage();
    setGpc(false);
    // setConsent dispatches on window; give it one that swallows the event.
    (globalThis as { window?: unknown }).window = {
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
  });

  afterEach(() => {
    store.clear();
    for (const [name, descriptor] of priorDescriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as Record<string, unknown>)[name];
    }
  });

  it('denies every non-essential category before any choice is made', () => {
    expect(hasDecided()).toBe(false);
    expect(hasConsent('analytics')).toBe(false);
    expect(hasConsent('preferences')).toBe(false);
    expect(hasConsent('marketing')).toBe(false);
  });

  it('always allows strictly-necessary, with or without a record', () => {
    expect(hasConsent('essential')).toBe(true);
    setConsent(essentialOnly(), 'reject_all');
    expect(hasConsent('essential')).toBe(true);
  });

  it('grants only what the visitor actually selected', () => {
    setConsent({ ...essentialOnly(), analytics: true }, 'custom');
    expect(hasConsent('analytics')).toBe(true);
    expect(hasConsent('marketing')).toBe(false);
    expect(hasConsent('preferences')).toBe(false);
  });

  it('treats a stale consent version as no decision at all', () => {
    setConsent(allGranted(), 'accept_all');
    expect(hasConsent('analytics')).toBe(true);

    const stored = JSON.parse(store.getItem(STORAGE_KEY)!);
    store.setItem(STORAGE_KEY, JSON.stringify({ ...stored, version: CONSENT_VERSION + 1 }));

    expect(getConsent()).toBeNull();
    expect(hasDecided()).toBe(false);
    expect(hasConsent('analytics')).toBe(false);
  });

  it('treats an unparseable record as no decision rather than throwing', () => {
    store.setItem(STORAGE_KEY, 'not json');
    expect(getConsent()).toBeNull();
    expect(hasConsent('analytics')).toBe(false);
  });

  it('lets a live GPC signal override a stored grant for sale/sharing categories', () => {
    setConsent(allGranted(), 'accept_all');
    expect(hasConsent('analytics')).toBe(true);

    setGpc(true);
    expect(hasConsent('analytics')).toBe(false);
    expect(hasConsent('marketing')).toBe(false);
    // Preferences is not a sale/sharing category, so an explicit grant stands.
    expect(hasConsent('preferences')).toBe(true);
    expect(hasConsent('essential')).toBe(true);
  });

  it('records the GPC signal and method on the stored choice', () => {
    setGpc(true);
    const record = setConsent(essentialOnly(), 'gpc');
    expect(record.gpc).toBe(true);
    expect(record.method).toBe('gpc');
    expect(record.version).toBe(CONSENT_VERSION);
    expect(record.categories.essential).toBe(true);
  });
});
