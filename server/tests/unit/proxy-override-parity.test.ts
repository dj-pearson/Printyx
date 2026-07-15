import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * PA-019 guard: every crmProxies `{ fn, pathPrefix }` entry rewrites a URL prefix
 * to a differently-named edge function IN DEV ONLY. Production hits
 * functions.printyx.net/<segment> directly, so it 404s unless server.ts has a
 * matching route override for that URL segment. This test fails if a
 * pathPrefix proxy entry is added without the corresponding server.ts override
 * (the PA-019 / PA-020 / PA-021 root cause).
 */
const PROXY_FILE = path.resolve(process.cwd(), 'server/middleware/edge-function-proxy.ts');
const SERVER_FILE = path.resolve(process.cwd(), 'supabase/functions/server.ts');

/** First path segment of an `/api/<seg>...` key — what prod resolves as the fn name. */
function firstSegment(apiPath: string): string {
  return apiPath.replace(/^\/api\//, '').split('/')[0];
}

describe('PA-019 pathPrefix proxy ↔ server.ts override parity', () => {
  const proxySrc = fs.readFileSync(PROXY_FILE, 'utf8');
  const serverSrc = fs.readFileSync(SERVER_FILE, 'utf8');

  // Collect `'/api/...': { fn: '...', pathPrefix: '...' }` entries.
  const entryRe = /'(\/api\/[^']+)'\s*:\s*\{\s*fn:\s*'([^']+)'\s*,\s*pathPrefix:/g;
  const entries: Array<{ apiPath: string; segment: string }> = [];
  for (let m = entryRe.exec(proxySrc); m; m = entryRe.exec(proxySrc)) {
    entries.push({ apiPath: m[1], segment: firstSegment(m[1]) });
  }

  // Segments that server.ts overrides via `functionName === '<seg>'`.
  const overrideSegments = new Set<string>();
  const ovRe = /functionName === '([^']+)'/g;
  for (let m = ovRe.exec(serverSrc); m; m = ovRe.exec(serverSrc)) {
    overrideSegments.add(m[1]);
  }

  it('finds the known pathPrefix proxy entries', () => {
    // Sanity: the model must actually be extracting entries.
    expect(entries.length).toBeGreaterThanOrEqual(4);
    expect(entries.map((e) => e.segment)).toEqual(
      expect.arrayContaining(['kpis', 'reporting', 'scheduled-reports', 'public']),
    );
  });

  for (const entry of [
    { apiPath: '/api/kpis', segment: 'kpis' },
    { apiPath: '/api/reporting', segment: 'reporting' },
    { apiPath: '/api/scheduled-reports', segment: 'scheduled-reports' },
    { apiPath: '/api/public/calculator', segment: 'public' },
  ]) {
    it(`server.ts overrides '${entry.segment}' (backs ${entry.apiPath} in prod)`, () => {
      expect(overrideSegments.has(entry.segment)).toBe(true);
    });
  }

  it('EVERY pathPrefix proxy entry has a server.ts override (no prod 404s)', () => {
    const missing = entries.filter((e) => !overrideSegments.has(e.segment));
    expect(missing.map((e) => e.apiPath)).toEqual([]);
  });
});
