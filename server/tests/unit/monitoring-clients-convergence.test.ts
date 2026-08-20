// EDGE-016 convergence lock.
//
// The Monitoring Clients admin surface exists twice: as handlers in
// server/routes-client-monitoring.ts and as the monitoring-clients edge
// function. Production hits the edge function directly, and dev forwards the
// whole /api/monitoring-clients prefix to it via crmProxies, so the Express
// admin handlers are unreachable on both.
//
// That is a hazard rather than harmless duplication, because the two already
// disagree: the UI calls /:id/regenerate-key and Express implements
// /:id/rotate-key, Express has no installer.zip at all, and its list returns a
// bare array where the UI expects { clients }. Feature work landing on the
// dead copy would look done and change nothing - which is exactly what this
// story exists to stop.
//
// These tests read the sources rather than booting anything, so they hold in CI
// without a database or an edge runtime.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf-8');

const EXPRESS = read('server/routes-client-monitoring.ts');
const PROXY = read('server/middleware/edge-function-proxy.ts');
const EDGE = read('supabase/functions/monitoring-clients/index.ts');
const REGISTRY = read('server/routes-registry.ts');

/** Every /api/... path Express registers in the monitoring file, with its verb. */
function expressRoutes(): Array<{ verb: string; path: string }> {
  return [...EXPRESS.matchAll(/app\.(get|post|put|patch|delete)\(\s*'(\/api\/[^']+)'/g)].map(
    (m) => ({ verb: m[1], path: m[2] }),
  );
}

describe('monitoring-clients convergence (EDGE-016)', () => {
  it('the /api/monitoring-clients prefix is proxied to the edge function', () => {
    expect(PROXY).toContain("'/api/monitoring-clients': 'monitoring-clients'");
  });

  it('the proxy is registered before the Express monitoring routes, so it wins', () => {
    const proxyAt = REGISTRY.indexOf('registerEdgeFunctionProxy(app)');
    const expressAt = REGISTRY.indexOf('registerClientMonitoringRoutes(app)');
    expect(proxyAt).toBeGreaterThan(-1);
    expect(expressAt).toBeGreaterThan(-1);
    // If this ever flips, the dead Express handlers below become live again and
    // start serving the divergent shapes described at the top of this file.
    expect(proxyAt).toBeLessThan(expressAt);
  });

  it('agent ingest stays on Express and is NOT proxied', () => {
    // The agent posts metrics, heartbeats, config and install reports to
    // /api/client-metrics/*. Those must keep working on the Express host.
    const ingest = expressRoutes().filter((r) => r.path.startsWith('/api/client-metrics'));
    expect(ingest.length).toBeGreaterThan(0);
    expect(PROXY).not.toContain("'/api/client-metrics':");
  });

  /** Sub-actions the edge function actually dispatches on (`action === '...'`). */
  function edgeActions(): string[] {
    return [...EDGE.matchAll(/action === '([^']+)'/g)].map((m) => m[1]);
  }

  it('every admin path the UI calls is served by the edge function', () => {
    // Taken from the Monitoring Clients page: list, detail, commands,
    // enrollment-token, installer.zip, regenerate-key.
    const actions = edgeActions();
    for (const action of ['commands', 'enrollment-token', 'regenerate-key', 'installer.zip']) {
      expect(actions).toContain(action);
    }
  });

  it('Express registers no /api/monitoring-clients handlers at all', () => {
    // The nine admin handlers that used to live in routes-client-monitoring.ts
    // were unreachable and had drifted from the live copy. They are gone; the
    // edge function owns the prefix. Re-adding one here fails this test,
    // because it would be dead on arrival.
    const admin = expressRoutes().filter((r) => r.path.startsWith('/api/monitoring-clients'));
    expect(
      admin.map((r) => `${r.verb.toUpperCase()} ${r.path}`),
      'Express monitoring-clients routes are shadowed by the proxy and never run. ' +
        'Implement admin endpoints in supabase/functions/monitoring-clients/ instead.',
    ).toEqual([]);
  });

  it('the two handlers ported off Express are served by the edge function', () => {
    // activity and discovered-devices had no edge counterpart when the Express
    // copies were retired, so they moved rather than being deleted.
    const actions = edgeActions();
    expect(actions).toContain('activity');
    expect(actions).toContain('discovered-devices');
  });
});
