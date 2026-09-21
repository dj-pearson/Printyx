import { describe, it, expect } from 'vitest';
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cspDirectives,
  isEmbeddablePath,
  permissionsPolicy,
  PERMISSIONS_POLICY_FEATURES,
  CSP_REPORT_PATH,
} from '../../../shared/security-headers';

const repoRoot = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

/**
 * The app under test is built from the SAME functions server/index.ts calls.
 *
 * The previous version of this file hand-copied the directive object out of
 * server/index.ts and asserted against its own copy, so every assertion was
 * about the fixture. It passed while asserting `camera=()` - the defect that
 * refused geolocation, the camera and the microphone to three routed pages -
 * and while asserting a `report-uri` that only ever resolved on a host which
 * does not serve the document. A test that builds its own subject cannot fail
 * on the thing it is named for, so the wiring is asserted separately below.
 */
function createApp(opts: { dev: boolean }) {
  const app = express();

  app.use((_req, res, next) => {
    (res as any).cspNonce = randomUUID().replace(/-/g, '');
    next();
  });

  app.use((req, res, next) => {
    const nonce = (res as any).cspNonce;
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: cspDirectives({
          nonce,
          dev: opts.dev,
          pathname: req.path,
          reportUri: CSP_REPORT_PATH,
        }) as Record<string, string[]>,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: isEmbeddablePath(req.path) ? false : { action: 'deny' as const },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      hidePoweredBy: true,
      xContentTypeOptions: true,
    })(req, res, next);
  });

  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', permissionsPolicy());
    next();
  });

  app.get('/test', (_req, res) => res.json({ ok: true }));
  app.get('/f/:token', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('Security headers on Express (SEC-003)', () => {
  const prod = createApp({ dev: false });
  const dev = createApp({ dev: true });

  it('serves a CSP whose script-src carries the per-request nonce', async () => {
    const res = await request(prod).get('/test');
    expect(res.headers['content-security-policy']).toMatch(/script-src[^;]*'nonce-[a-f0-9]+'/);
  });

  it('gives two requests two different nonces', async () => {
    const [a, b] = await Promise.all([request(prod).get('/test'), request(prod).get('/test')]);
    const nonceOf = (r: { headers: Record<string, string> }) =>
      /'nonce-([a-f0-9]+)'/.exec(r.headers['content-security-policy'])?.[1];
    expect(nonceOf(a)).toBeTruthy();
    expect(nonceOf(a)).not.toBe(nonceOf(b));
  });

  it.each([
    ["default-src 'self'", 'default-src'],
    ["object-src 'none'", 'object-src'],
    ["base-uri 'self'", 'base-uri'],
    ["form-action 'self'", 'form-action'],
  ])('locks down %s', async (fragment) => {
    const res = await request(prod).get('/test');
    expect(res.headers['content-security-policy']).toContain(fragment);
  });

  it('permits the API hosts the client talks to', async () => {
    const csp = (await request(prod).get('/test')).headers['content-security-policy'];
    expect(csp).toContain('https://api.printyx.net');
    expect(csp).toContain('https://functions.printyx.net');
  });

  it('permits the Sentry ingest hosts, so error reporting is not CSP-blocked', async () => {
    const csp = (await request(prod).get('/test')).headers['content-security-policy'];
    // client/src/lib/telemetry.ts ships to *.ingest.us.sentry.io in production.
    expect(csp).toContain('ingest.us.sentry.io');
  });

  it('permits a blob: frame, which is how the invoice PDF preview renders', async () => {
    const csp = (await request(prod).get('/test')).headers['content-security-policy'];
    expect(csp).toMatch(/frame-src[^;]*blob:/);
  });

  it('refuses framing everywhere except the hosted web form', async () => {
    const page = await request(prod).get('/test');
    expect(page.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(page.headers['x-frame-options']).toBe('DENY');

    const form = await request(prod).get('/f/abc123');
    expect(form.headers['content-security-policy']).toContain('frame-ancestors *');
    expect(form.headers['content-security-policy']).not.toContain("frame-ancestors 'none'");
    // No "allow any origin" value exists for the legacy header - only absence.
    expect(form.headers['x-frame-options']).toBeUndefined();
  });

  it.each([
    ['x-content-type-options', 'nosniff'],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
    ['cross-origin-opener-policy', 'same-origin'],
  ])('sets %s', async (header, value) => {
    const res = await request(prod).get('/test');
    expect(res.headers[header]).toBe(value);
  });

  it('sets a one-year preloadable HSTS', async () => {
    const hsts = (await request(prod).get('/test')).headers['strict-transport-security'];
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('removes the Express fingerprint', async () => {
    expect((await request(prod).get('/test')).headers['x-powered-by']).toBeUndefined();
  });

  it('permits the browser capabilities the app uses rather than refusing them', async () => {
    const pp = (await request(prod).get('/test')).headers['permissions-policy'];
    // geolocation: MobileFieldService's GPS watch. camera: the barcode scanner
    // in useExternalIntegrations. microphone: VoiceTicketClose's MediaRecorder.
    // An empty allowlist makes the browser reject all three.
    expect(pp).toContain('geolocation=(self)');
    expect(pp).toContain('camera=(self)');
    expect(pp).toContain('microphone=(self)');
    expect(pp).not.toMatch(/(camera|microphone|geolocation)=\(\)/);
  });

  it('keeps a CSP in development rather than switching it off', async () => {
    const csp = (await request(dev).get('/test')).headers['content-security-policy'];
    expect(csp).toBeDefined();
    // Vite HMR needs eval and inline; everything structural stays.
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('keeps the form embeddable in development too', async () => {
    const csp = (await request(dev).get('/f/abc123')).headers['content-security-policy'];
    expect(csp).toContain('frame-ancestors *');
  });
});

describe('server/index.ts reads the shared policy (SEC-003)', () => {
  const src = stripComments(read('server/index.ts'));

  it('builds helmet directives from cspDirectives, not a local copy', () => {
    expect(src).toMatch(/directives:\s*cspDirectives\(/);
    expect(src).toContain("from '../shared/security-headers'");
  });

  it('sets Permissions-Policy from the shared function', () => {
    expect(src).toMatch(/setHeader\(\s*'Permissions-Policy',\s*permissionsPolicy\(\)/);
  });

  it('drops frameguard on the embeddable surface', () => {
    expect(src).toMatch(/frameguard:\s*isEmbeddablePath\(req\.path\)\s*\?\s*false/);
  });

  it('no longer hand-writes a directive map beside the helmet call', () => {
    // The literal that used to live here is what drifted from the real policy.
    expect(src).not.toMatch(/'connect-src':\s*\[/);
    expect(src).not.toMatch(/'frame-ancestors':\s*\[/);
  });
});

function renderedHeaders(): string {
  return read('client/public/_headers');
}

describe('the policy reflects what the app actually does (SEC-003)', () => {
  it('refuses no Permissions-Policy feature the client tree uses', () => {
    const usage: Record<string, RegExp> = {
      geolocation: /navigator\s*\.\s*geolocation/,
      camera: /getUserMedia\s*\(\s*\{[^}]*\bvideo\b/,
      microphone: /new\s+MediaRecorder\s*\(/,
    };
    const files = [
      'client/src/pages/MobileFieldService.tsx',
      'client/src/hooks/useExternalIntegrations.ts',
      'client/src/pages/VoiceTicketClose.tsx',
    ].map((f) => read(f));

    for (const [feature, pattern] of Object.entries(usage)) {
      const used = files.some((src) => pattern.test(src));
      expect(used, `${feature} should still be used by the tree this claim rests on`).toBe(true);
      expect(PERMISSIONS_POLICY_FEATURES[feature]).not.toBe('()');
    }
  });

  it('omits wss: only while the websocket hook short-circuits in production', () => {
    // Dropping the permission is only correct while the hook never connects.
    // If that guard goes, connect-src owes a wss: origin.
    const hook = read('client/src/hooks/useWebSocket.ts');
    expect(hook).toMatch(/if\s*\(config\.isProduction\)\s*\{\s*\n?\s*return;/);
    expect(cspDirectives({ dev: false })['connect-src']).not.toContain('wss:');
  });

  it('asks for a report-uri only when the host can receive one', () => {
    // /api/csp-report is an Express route, so Express asks for it. On
    // printyx.net that path is served by Cloudflare Pages, which answers the
    // SPA shell, so a report would be POSTed into a 200 of HTML - the
    // generated _headers asks for none, and the gap is named rather than
    // pointed at something that swallows it.
    expect(cspDirectives({ dev: false })['report-uri']).toBeUndefined();
    expect(cspDirectives({ dev: false, reportUri: CSP_REPORT_PATH })['report-uri']).toEqual([
      CSP_REPORT_PATH,
    ]);
    expect(renderedHeaders()).not.toContain('report-uri');
  });

  it("keeps the directive check:uncalled-express names as csp-report's caller", () => {
    // That guard excludes csp-report BY RULE on the stated grounds that the
    // report-uri in server/index.ts names it. Dropping the directive would
    // have made the exclusion's reason false.
    const rule = read('scripts/check-uncalled-express-routes.mjs');
    expect(rule).toContain('report-uri directive set in server/index.ts');
    expect(stripComments(read('server/index.ts'))).toContain('reportUri: CSP_REPORT_PATH');
  });
});
