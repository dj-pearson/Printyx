/**
 * The one security-header policy, read by both hosts that can serve the app.
 *
 * SEC-003 shipped a correct Helmet configuration in `server/index.ts` and
 * marked itself COMPLETE. Helmet sets headers on EXPRESS responses. In
 * production the document a user loads is served by Cloudflare Pages
 * (`wrangler.toml`: `pages_build_output_dir = "dist"`), and there was no
 * `_headers` file in `client/public`, so printyx.net answered with NO
 * Content-Security-Policy, NO X-Frame-Options, NO HSTS, NO Referrer-Policy
 * and NO nosniff. The control existed, was correct, and reached nothing.
 *
 * So the policy lives here and both sides read it:
 *   - `server/index.ts` builds Helmet's directives from `cspDirectives()`.
 *   - `scripts/generate-security-headers.mjs` renders `client/public/_headers`,
 *     which Vite copies to `dist/_headers` for Cloudflare Pages.
 *   - `npm run check:security-headers` fails when the committed file is stale
 *     or when the policy would block a capability the app actually uses.
 *
 * Four things the Express policy carried that would have BROKEN the product the
 * day it reached a real document, each proven against the tree rather than
 * assumed:
 *
 * 1. `camera=(), microphone=(), geolocation=()` in Permissions-Policy. All
 *    three are used by routed pages: geolocation by MobileFieldService (a
 *    technician's GPS watch) and MobileServiceApp, the camera by the barcode
 *    scanner in `useExternalIntegrations.ts`, the microphone by
 *    VoiceTicketClose's MediaRecorder. An empty allowlist makes the browser
 *    reject those APIs outright. Express DOES serve the document in dev, so
 *    this was enforced on every developer machine and on nobody in production -
 *    the usual dev/prod split running backwards. They are `(self)` now.
 *
 * 2. `frame-ancestors 'none'` everywhere. `/f/:token` is the HOSTED WEB FORM,
 *    and WebFormBuilder generates an `<iframe src=...>` snippet for a dealer to
 *    paste into their own website - being embedded on another origin is the
 *    whole feature. `/f/*` is exempt; every other path is not.
 *
 * 3. No `frame-src`. `invoice-pdf-preview.tsx` renders `<iframe src={blobUrl}>`,
 *    and `frame-src` falls back through `child-src` to `default-src 'self'`,
 *    which does not permit `blob:`.
 *
 * 4. No Sentry origin in `connect-src`. `client/src/lib/telemetry.ts` ships to
 *    `*.ingest.us.sentry.io` in production, so error reporting would have been
 *    blocked by the CSP that claimed to be production-ready.
 *
 * The `report-uri` is HOST-SPECIFIC, which is why it is an option rather than a
 * constant. `/api/csp-report` is an Express route, so Express asks for it and
 * gets real reports in dev; on printyx.net that same path resolves to
 * Cloudflare Pages, which answers the SPA shell, so a report would be POSTed
 * into a 200 of HTML and silently discarded. The generated `_headers` therefore
 * carries none, and an endpoint reachable from the Pages origin is a gap named
 * rather than faked. (`check:uncalled-express` excludes `csp-report` on the
 * stated grounds that this directive names it, so dropping it outright would
 * have made that exclusion's reason false.)
 */

export interface CspOptions {
  /** Per-request nonce. Express only - a static host emits one fixed header. */
  nonce?: string;
  /** Relaxed directives for Vite HMR. */
  dev?: boolean;
  /** Request path, so the embeddable surface gets its own frame-ancestors. */
  pathname?: string;
  /**
   * Where violation reports go. Only a host that can actually receive them
   * should pass one - see the note above.
   */
  reportUri?: string;
}

/**
 * Paths the product asks other people to embed. Derived from the embed
 * snippets the UI generates - `check:security-headers` compares this list
 * against the `<iframe src=` snippets in the client tree, so a second
 * embeddable surface fails the guard until it is listed here.
 */
export const EMBEDDABLE_PATH_PREFIXES = ['/f/'] as const;

/** Sentry's ingest hosts, as Sentry's own CSP guidance spells them. */
export const SENTRY_INGEST_ORIGINS = [
  'https://*.ingest.sentry.io',
  'https://*.ingest.us.sentry.io',
] as const;

/** The Express route that receives CSP violation reports. */
export const CSP_REPORT_PATH = '/api/csp-report';

export const API_ORIGINS = ['https://api.printyx.net', 'https://functions.printyx.net'] as const;

export function isEmbeddablePath(pathname: string): boolean {
  const path = String(pathname ?? '').split('?')[0];
  return EMBEDDABLE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * The browser capabilities the app uses. Each maps to a Permissions-Policy
 * feature; `(self)` permits it for this origin, `()` refuses it for everyone.
 * The guard derives usage from the client tree, so refusing one of these fails
 * rather than silently disabling a feature.
 */
export const PERMISSIONS_POLICY_FEATURES: Record<string, string> = {
  camera: '(self)',
  microphone: '(self)',
  geolocation: '(self)',
  payment: '(self)',
};

export function permissionsPolicy(): string {
  return Object.entries(PERMISSIONS_POLICY_FEATURES)
    .map(([feature, allowlist]) => `${feature}=${allowlist}`)
    .join(', ');
}

export function cspDirectives(options: CspOptions = {}): Record<string, string[]> {
  const { nonce, dev = false, pathname = '/', reportUri } = options;

  // A blob: iframe is how the invoice PDF preview renders, and frame-src falls
  // back to default-src, which does not cover it.
  const frameSrc = ["'self'", 'blob:'];

  const frameAncestors = isEmbeddablePath(pathname) ? ['*'] : ["'none'"];

  if (dev) {
    return {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https:'],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'font-src': ["'self'", 'https:', 'data:'],
      'connect-src': [
        "'self'",
        'ws:',
        'wss:',
        'http://localhost:*',
        // Local dev signs in against the hosted GoTrue/edge functions -
        // without these the login form is CSP-blocked in the browser.
        ...API_ORIGINS,
        ...SENTRY_INGEST_ORIGINS,
      ],
      'frame-src': frameSrc,
      'frame-ancestors': frameAncestors,
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      ...(reportUri ? { 'report-uri': [reportUri] } : {}),
    };
  }

  return {
    'default-src': ["'self'"],
    // The built document carries exactly one executable script, the same-origin
    // module bundle - proven against `dist/index.html` and asserted by the
    // guard. The four inline `application/ld+json` blocks are DATA BLOCKS: the
    // HTML spec never prepares them as scripts, so CSP does not apply to them.
    // A nonce is added when a host can mint one per request; a static host
    // cannot, which is why 'self' has to be sufficient on its own.
    'script-src': nonce ? ["'self'", `'nonce-${nonce}'`] : ["'self'"],
    // Radix and Tailwind both write inline style attributes at runtime.
    'style-src': ["'self'", "'unsafe-inline'"],
    // Storage objects and OpenStreetMap tiles are https:; blob: is the
    // logo-upload preview; data: is inline icons.
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    // No wss:. `useWebSocket` returns before connecting when
    // `config.isProduction`, so a websocket permission here would grant
    // something the app never uses. A test asserts that short-circuit is still
    // there, so this stays true rather than outliving its reason.
    'connect-src': ["'self'", ...API_ORIGINS, ...SENTRY_INGEST_ORIGINS],
    'frame-src': frameSrc,
    'frame-ancestors': frameAncestors,
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': [],
    ...(reportUri ? { 'report-uri': [reportUri] } : {}),
  };
}

export function serializeCsp(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

/**
 * Headers that do not vary per request. `Strict-Transport-Security` is here
 * rather than in the CSP because it is its own header and both hosts owe it.
 */
export function staticSecurityHeaders(): Array<[string, string]> {
  return [
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', permissionsPolicy()],
    ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Cross-Origin-Resource-Policy', 'cross-origin'],
  ];
}

const GENERATED_BANNER = [
  '# GENERATED by `npm run security:headers` from shared/security-headers.ts.',
  '# Do not edit by hand - `npm run check:security-headers` fails when this file',
  '# and that module disagree.',
  '#',
  '# Cloudflare Pages serves the document in production, so this file is the',
  '# ONLY thing that puts a CSP, HSTS or a frame policy in front of the app.',
  '# Helmet in server/index.ts covers Express, which serves the app in dev and',
  '# answers the API on its own host - it never reaches printyx.net.',
  '#',
  '# Rules are applied top to bottom and a later rule wins for a header it',
  '# repeats, so the /f/* block below must stay AFTER /*. That ordering and the',
  '# `! Header` removal syntax are Cloudflare Pages behaviours this repo has not',
  '# executed against a deploy: confirm the embed with one curl -I after the',
  '# first deployment that carries this file.',
].join('\n');

export function renderHeadersFile(): string {
  const lines: string[] = [GENERATED_BANNER, ''];

  lines.push('/*');
  for (const [name, value] of staticSecurityHeaders()) {
    lines.push(`  ${name}: ${value}`);
  }
  lines.push(`  Content-Security-Policy: ${serializeCsp(cspDirectives({ pathname: '/' }))}`);
  lines.push('');

  lines.push("# The hosted web form is meant to be embedded on a dealer customer's own");
  lines.push('# site - WebFormBuilder hands them the <iframe> snippet - so this surface');
  lines.push('# and only this surface drops the frame policy.');
  lines.push('/f/*');
  lines.push('  ! X-Frame-Options');
  lines.push(`  Content-Security-Policy: ${serializeCsp(cspDirectives({ pathname: '/f/x' }))}`);
  lines.push('');

  return lines.join('\n');
}
