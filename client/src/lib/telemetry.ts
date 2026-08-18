/**
 * Consent-gated telemetry (LEGAL-001).
 *
 * Single owner of the Sentry lifecycle in the browser. Nothing else in the app
 * may call Sentry.init, add a telemetry integration, or load a third-party
 * pixel; `scripts/check-telemetry-consent.mjs` fails the build if it does.
 *
 * Split of what runs when, and why:
 *
 *   Error reporting (always on, no consent)
 *     Strictly necessary: without it a crash in production is invisible and we
 *     cannot keep the service secure and available. It captures the exception
 *     and stack, not the visitor's behavior. Declared as strictly necessary in
 *     the Cookie Policy, so it must stay narrow enough for that to remain true.
 *
 *   Performance tracing + Session Replay (analytics consent required)
 *     Both measure behavior rather than fix faults, and the Cookie Policy puts
 *     "aggregated usage and performance" in the Analytics category. Neither is
 *     loaded until hasConsent('analytics') is true, and Replay stops on
 *     withdrawal without needing a reload.
 *
 * Sampling is unchanged from before the gate: the integrations read the rates
 * off the client options and do their own sampling, so consenting visitors are
 * still sampled at 10% rather than all being recorded.
 */

import * as Sentry from '@sentry/react';
import { CONSENT_CHANGE_EVENT, hasConsent } from '@/lib/cookie-consent';

// The Printyx Sentry DSN is a public identifier (it ships in this browser
// bundle by design), so it is safe to commit as a default. An explicit
// VITE_SENTRY_DSN always overrides it; the baked-in default only applies in
// production builds so local dev doesn't report to the shared project.
const DEFAULT_SENTRY_DSN =
  'https://dcc5602397f3cdc991f4c4aabed199b4@o4510398791352320.ingest.us.sentry.io/4511770291273728';

const SENTRY_DSN =
  import.meta.env.VITE_SENTRY_DSN || (import.meta.env.PROD ? DEFAULT_SENTRY_DSN : undefined);

/** Sentry's registered name for the replay integration, used to look it up later. */
const REPLAY_INTEGRATION_NAME = 'Replay';
/** Sentry's registered name for the browser tracing integration. */
const BROWSER_TRACING_INTEGRATION_NAME = 'BrowserTracing';
/**
 * Sentry's registered name for release-health session tracking. This is a
 * DEFAULT integration, so it has to be filtered out of the defaults at boot
 * rather than simply not added: left on, it pings Sentry once per page load
 * before the visitor has decided anything, which is a usage signal rather than
 * a fault report and does not belong in the strictly-necessary tier.
 */
const BROWSER_SESSION_INTEGRATION_NAME = 'BrowserSession';

/** Sampling rate for traces once analytics consent is granted. */
const TRACES_SAMPLE_RATE = import.meta.env.PROD ? 0.1 : 1.0;

/** Guards against adding the analytics integrations twice. */
let analyticsStarted = false;

/**
 * CR-016: mask all text and inputs in session replay so customer PII is not
 * captured, and block media so uploaded documents are never recorded. Consent
 * is the legal basis; masking is the belt-and-braces on top of it.
 */
function buildReplayIntegration() {
  return Sentry.replayIntegration({
    maskAllText: true,
    maskAllInputs: true,
    blockAllMedia: true,
  });
}

/** Strip credential-bearing query params out of breadcrumb URLs. */
function scrubBreadcrumbs(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((bc) => {
      if (bc.data?.url && typeof bc.data.url === 'string') {
        try {
          const url = new URL(bc.data.url, window.location.origin);
          url.searchParams.delete('token');
          url.searchParams.delete('key');
          bc.data.url = url.toString();
        } catch {
          // keep original
        }
      }
      return bc;
    });
  }
  return event;
}

/**
 * Attach performance tracing and session replay. Called only from the consent
 * gate, never at boot.
 */
function startAnalyticsTelemetry(): void {
  if (analyticsStarted) return;
  const client = Sentry.getClient();
  if (!client) return;

  analyticsStarted = true;

  // Tracing is sampled at zero until consent, so raise it before the
  // integration starts deciding which transactions to keep.
  client.getOptions().tracesSampleRate = TRACES_SAMPLE_RATE;

  if (!client.getIntegrationByName(BROWSER_TRACING_INTEGRATION_NAME)) {
    Sentry.addIntegration(Sentry.browserTracingIntegration());
  }
  if (!client.getIntegrationByName(BROWSER_SESSION_INTEGRATION_NAME)) {
    Sentry.addIntegration(Sentry.browserSessionIntegration());
  }
  if (!client.getIntegrationByName(REPLAY_INTEGRATION_NAME)) {
    Sentry.addIntegration(buildReplayIntegration());
  }
}

/**
 * Stop recording on withdrawal. Replay is stopped rather than removed (Sentry
 * has no remove-integration API), and tracing is sampled back down to zero so
 * no further transactions are sent. Takes effect without a page reload.
 */
function stopAnalyticsTelemetry(): void {
  const client = Sentry.getClient();
  if (!client) return;

  client.getOptions().tracesSampleRate = 0;

  const replay =
    client.getIntegrationByName<ReturnType<typeof buildReplayIntegration>>(REPLAY_INTEGRATION_NAME);
  if (replay) {
    // Flush what was already recorded under a valid consent, then stop. Never
    // let a telemetry failure surface to the visitor.
    void Promise.resolve(replay.stop()).catch(() => undefined);
  }

  analyticsStarted = false;
}

/** Apply the current consent state. Safe to call repeatedly. */
export function applyTelemetryConsent(): void {
  if (!Sentry.getClient()) return;
  if (hasConsent('analytics')) {
    startAnalyticsTelemetry();
  } else {
    stopAnalyticsTelemetry();
  }
}

/**
 * Boot the browser telemetry stack. Call once, as early as possible, so errors
 * during startup are still captured. Analytics-tier telemetry attaches later,
 * if and when the visitor consents.
 */
export function initTelemetry(): void {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    // Sentry's default integrations cover error capture, minus release-health
    // session tracking, which pings on every page load and is therefore held
    // back with the rest of the analytics tier. Tracing, Replay and session
    // tracking are all added by startAnalyticsTelemetry() on consent.
    integrations: (defaults) =>
      defaults.filter((integration) => integration.name !== BROWSER_SESSION_INTEGRATION_NAME),
    // Zero until consent. startAnalyticsTelemetry() raises it.
    tracesSampleRate: 0,
    // These are read by the replay integration when it is added later; they are
    // inert until then because the integration is not loaded.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend: scrubBreadcrumbs,
  });

  // Apply any choice this visitor already made on a previous visit, then follow
  // it as it changes. Default-deny means a first-time visitor gets error
  // reporting only until they act on the banner.
  applyTelemetryConsent();
  window.addEventListener(CONSENT_CHANGE_EVENT, applyTelemetryConsent);
}
