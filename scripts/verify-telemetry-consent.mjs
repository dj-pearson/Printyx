#!/usr/bin/env node
/**
 * LEGAL-001 end-to-end proof: load the real production bundle in a real browser
 * and observe what Sentry actually does before, during and after consent.
 *
 * The unit test pins the gate's logic and `check:telemetry` pins the wiring, but
 * neither can prove the shipped bundle stays quiet before a visitor decides.
 * That claim is the whole point of the story, so it gets a check that watches
 * the network rather than the source.
 *
 * Manual, not CI: it needs a production build and a browser binary.
 *
 *   npm run build && node scripts/verify-telemetry-consent.mjs
 *
 * Set PW_CHROMIUM to override the browser binary if Playwright's own download
 * is not present (in the Claude Code sandbox that is
 * /opt/pw-browsers/chromium-1194/chrome-linux/chrome).
 *
 * Requests to sentry.io are aborted, never delivered, so running this does not
 * write anything into the live Sentry project.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 45771);
const CONSENT_KEY = 'printyx-cookie-consent';
const CHANGE_EVENT = 'printyx:cookie-consent-changed';

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('No production build found at dist/. Run `npm run build` first.');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const requested = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(DIST, requested);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, 'index.html');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(PORT, resolve));

const launchOptions = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage();

const hits = [];
await page.route('**://*.sentry.io/**', (route) => {
  const body = route.request().postData() || '';
  const kinds = [...body.matchAll(/"type"\s*:\s*"([a-z_]+)"/g)].map((m) => m[1]);
  hits.push({ kinds, isReplay: kinds.some((k) => k.startsWith('replay')) });
  route.abort();
});

/** Read the live client's integration list and trace sample rate. */
const probe = () => {
  const carrier = window.__SENTRY__;
  if (!carrier) return { integrations: [], tracesSampleRate: null };
  for (const entry of Object.values(carrier)) {
    if (!entry || typeof entry !== 'object') continue;
    const client =
      entry.acs?.getCurrentScope?.()?.getClient?.() ||
      entry.stack?.[0]?.client ||
      entry.defaultCurrentScope?.getClient?.();
    if (client) {
      return {
        integrations: Object.keys(client._integrations || {}),
        tracesSampleRate: client.getOptions?.()?.tracesSampleRate ?? null,
      };
    }
  }
  return { integrations: [], tracesSampleRate: null };
};

const setConsent = (categories, gpc = false) =>
  page.evaluate(
    ({ categories, gpc, key, event }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          timestamp: new Date().toISOString(),
          method: 'custom',
          gpc: false,
          categories,
        }),
      );
      if (gpc) {
        Object.defineProperty(navigator, 'globalPrivacyControl', {
          value: true,
          configurable: true,
        });
      }
      window.dispatchEvent(new CustomEvent(event));
    },
    { categories, gpc, key: CONSENT_KEY, event: CHANGE_EVENT },
  );

const ALL_ON = { essential: true, analytics: true, preferences: true, marketing: true };
const ALL_OFF = { essential: true, analytics: false, preferences: false, marketing: false };
const GATED = ['BrowserTracing', 'Replay', 'BrowserSession'];
const loaded = (state) => state.integrations.filter((name) => GATED.includes(name));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
const before = await page.evaluate(probe);
const requestsBeforeConsent = hits.length;
const replaysBeforeConsent = hits.filter((h) => h.isReplay).length;

await setConsent(ALL_ON);
await page.waitForTimeout(3000);
const granted = await page.evaluate(probe);

await setConsent(ALL_OFF);
await page.waitForTimeout(2500);
const withdrawn = await page.evaluate(probe);

await setConsent(ALL_ON, true); // stored accept-all, but GPC is now signalling
await page.waitForTimeout(1500);
const underGpc = await page.evaluate(probe);

await browser.close();
server.close();

const checks = [
  ['no Sentry traffic at all before consent', requestsBeforeConsent === 0, `${requestsBeforeConsent} request(s)`],
  ['no session replay before consent', replaysBeforeConsent === 0, `${replaysBeforeConsent} replay envelope(s)`],
  ['tracing/replay/session not loaded before consent', loaded(before).length === 0, loaded(before).join(', ') || 'none'],
  ['tracing sampled at zero before consent', before.tracesSampleRate === 0, String(before.tracesSampleRate)],
  ['all three attach once analytics is granted', loaded(granted).length === 3, loaded(granted).join(', ') || 'none'],
  ['tracing samples once granted', granted.tracesSampleRate > 0, String(granted.tracesSampleRate)],
  ['tracing stops on withdrawal, no reload', withdrawn.tracesSampleRate === 0, String(withdrawn.tracesSampleRate)],
  ['live GPC overrides a stored accept-all', underGpc.tracesSampleRate === 0, String(underGpc.tracesSampleRate)],
];

let failed = 0;
for (const [label, ok, detail] of checks) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (${detail})`);
}

if (failed > 0) {
  console.error(`\nverify:telemetry FAILED: ${failed} of ${checks.length} checks.\n`);
  process.exit(1);
}
console.log(`\nverify:telemetry passed - ${checks.length}/${checks.length} checks.`);
