/**
 * Cookie / tracking-consent model (GDPR ePrivacy + CCPA/CPRA).
 *
 * This is the single source of truth for what the visitor has consented to.
 * Non-essential categories DEFAULT TO DENIED until the visitor makes a choice,
 * and any script/pixel that is not strictly necessary MUST be gated behind
 * `hasConsent(category)` so it never loads without consent.
 *
 * Records are versioned and timestamped. Bumping CONSENT_VERSION re-prompts
 * every visitor (use when the cookie inventory or purposes materially change).
 *
 * The Global Privacy Control (GPC) signal is honored: when a browser sends GPC,
 * we treat it as a valid opt-out of "sale"/"sharing" (analytics + marketing)
 * per CPRA, and pre-set those categories to denied.
 */

export type CookieCategory = 'essential' | 'analytics' | 'preferences' | 'marketing';

export const COOKIE_CATEGORIES: {
  key: CookieCategory;
  label: string;
  description: string;
  essential: boolean;
}[] = [
  {
    key: 'essential',
    label: 'Strictly necessary',
    description:
      'Required for the site to function — authentication, security, and saving your consent choices. These cannot be switched off.',
    essential: true,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description:
      'Help us understand how the site is used so we can improve it. Aggregated usage and performance measurement.',
    essential: false,
  },
  {
    key: 'preferences',
    label: 'Preferences',
    description:
      'Remember choices you make (such as language or region) to give you a more personalized experience.',
    essential: false,
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description:
      'Used to measure and deliver marketing that is more relevant to you, including across other sites.',
    essential: false,
  },
];

export const NON_ESSENTIAL_CATEGORIES: CookieCategory[] = ['analytics', 'preferences', 'marketing'];

/** Categories treated as "sale/sharing" for CPRA GPC opt-out purposes. */
export const GPC_OPT_OUT_CATEGORIES: CookieCategory[] = ['analytics', 'marketing'];

/** Bump to re-prompt all visitors after a material change to cookies/purposes. */
export const CONSENT_VERSION = 1;

const STORAGE_KEY = 'printyx-cookie-consent';

export type ConsentMethod = 'accept_all' | 'reject_all' | 'custom' | 'gpc';

export interface ConsentRecord {
  version: number;
  timestamp: string; // ISO 8601
  method: ConsentMethod;
  /** Whether a GPC signal was present when this choice was recorded. */
  gpc: boolean;
  categories: Record<CookieCategory, boolean>;
}

export const CONSENT_CHANGE_EVENT = 'printyx:cookie-consent-changed';
export const OPEN_COOKIE_SETTINGS_EVENT = 'printyx:open-cookie-settings';

/** True when the browser is sending the Global Privacy Control signal. */
export function getGpcSignal(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  );
}

/** All non-essential categories granted. */
export function allGranted(): Record<CookieCategory, boolean> {
  return { essential: true, analytics: true, preferences: true, marketing: true };
}

/** Only strictly-necessary cookies. */
export function essentialOnly(): Record<CookieCategory, boolean> {
  return { essential: true, analytics: false, preferences: false, marketing: false };
}

/**
 * GPC-aware default used when no explicit choice has been made yet: everything
 * off, and if GPC is present the opt-out categories stay off (they already are).
 */
export function gpcDefault(): Record<CookieCategory, boolean> {
  return essentialOnly();
}

export function getConsent(): ConsentRecord | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    // Ignore stale records from an older consent version — re-prompt instead.
    if (!parsed || parsed.version !== CONSENT_VERSION || !parsed.categories) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Whether the visitor has made an explicit choice this consent version. */
export function hasDecided(): boolean {
  return getConsent() !== null;
}

/**
 * Gate for non-essential scripts/pixels. Returns false (deny) until the visitor
 * has explicitly granted the category. `essential` is always allowed.
 *
 * A live GPC signal is authoritative and overrides a stored grant for the
 * opt-out categories (LEGAL-001). CPRA treats GPC as a valid opt-out of
 * sale/sharing, so we honor the signal the browser is sending right now rather
 * than a grant recorded before it was turned on. The banner tells GPC visitors
 * that analytics and marketing are off. Erring toward not collecting is the
 * recoverable direction; collecting against a live opt-out is not.
 */
export function hasConsent(category: CookieCategory): boolean {
  if (category === 'essential') return true;
  if (getGpcSignal() && GPC_OPT_OUT_CATEGORIES.includes(category)) return false;
  const consent = getConsent();
  if (!consent) return false; // default-deny
  return consent.categories[category] === true;
}

export function setConsent(
  categories: Record<CookieCategory, boolean>,
  method: ConsentMethod,
): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
    method,
    gpc: getGpcSignal(),
    categories: { ...categories, essential: true },
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // storage unavailable (private mode / blocked) — consent is session-only
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: record }));
  }
  return record;
}

/** Open the cookie-preferences dialog from anywhere (e.g. a footer link). */
export function openCookieSettings(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
  }
}
