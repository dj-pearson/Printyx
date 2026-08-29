/**
 * /api/device-monitoring has a production host now.
 *
 * Three routed pages call it - DeviceMonitoring, SupplyRunway, SupplyOrders -
 * and until this port there was no edge function of that name, no proxy entry
 * and no server.ts alias, so all nine of their calls 404'd in production
 * (AUDIT-029). Three of the Express handlers were also selecting
 * r.manufacturer, a column device_registrations does not have, so those were a
 * 500 in dev on top of it. A phantom column inside raw SQL is invisible to both
 * guards that would normally catch one: tsc cannot see into a template string,
 * and check:phantom-cols reads edge functions only.
 *
 * What this asserts is coverage and contract, not behaviour - the handler needs
 * a live Postgres to exercise. The behaviour that CAN be tested without one
 * lives in _shared/device-monitoring-shape.ts and is covered by
 * device-monitoring-shape.test.ts.
 *
 * Comments are stripped before matching.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const edge = read('supabase/functions/device-monitoring/index.ts');

describe('endpoint coverage', () => {
  it.each(['latest-metrics', 'active-alerts', 'supply-forecast', 'supply-orders', 'statistics'])(
    'serves /%s',
    (resource) => {
      expect(edge).toContain(`resource === '${resource}'`);
    },
  );

  it('serves the per-device history and alerts', () => {
    expect(edge).toMatch(/resource === 'device' && parts\[1\]/);
    expect(edge).toMatch(/sub === 'alerts'/);
  });

  it('serves the five actions the pages POST', () => {
    for (const action of ['acknowledge', 'snooze', 'resolve', 'approve', 'cancel']) {
      expect(edge).toContain(`action === '${action}'`);
    }
  });
});

describe('contract', () => {
  it('shares the projection rather than reimplementing it', () => {
    expect(edge).toMatch(/from '\.\.\/_shared\/device-monitoring-shape\.ts'/);
    // The flat keys the pages read are produced in exactly one place.
    expect(edge).not.toMatch(/tonerBlack/);
    expect(edge).not.toMatch(/currentLevel:/);
  });

  it('never selects the manufacturer column, which does not exist', () => {
    expect(edge).not.toMatch(/manufacturer(?!: null)/);
    expect(existsSync(join(repo, 'server/routes-device-monitoring.ts'))).toBe(false);
  });

  it('reproduces DISTINCT ON with the ordering that makes it equivalent', () => {
    // latestPerDevice keeps the first row per device, which is only the latest
    // one under (device_id asc, collection_timestamp desc).
    // Bounded to this branch. An unbounded slice runs to end of file and picks
    // up the /statistics block, which calls latestPerDevice too - so mutating
    // the call in THIS branch left the assertion passing, which is the same
    // failure the supply-forecast swap test had.
    const from = edge.indexOf("resource === 'latest-metrics'");
    const block = edge.slice(from, edge.indexOf('return createCorsResponse({ metrics }', from));
    expect(block).toMatch(/order\('device_id', \{ ascending: true \}\)/);
    expect(block).toMatch(/order\('collection_timestamp', \{ ascending: false \}\)/);
    expect(block).toMatch(/latestPerDevice\(/);
  });

  it('restricts the forecast by serial through an inner embed, not a plain filter', () => {
    // Without the bang, PostgREST returns every device with a null registration
    // rather than none - the filter would silently do nothing.
    expect(edge).toMatch(/device_registrations!inner/);
  });
});

describe('reachability and gating', () => {
  it('is proxied so dev exercises the same handler', () => {
    expect(read('server/middleware/edge-function-proxy.ts')).toMatch(
      /'\/api\/device-monitoring':\s*'device-monitoring'/,
    );
  });

  it('gates on role level 3, matching what the pages already require', () => {
    // A level rather than a permission code, per SEC-EDGE-002: the codes the
    // Express gates name are not the codes any seeder creates.
    expect(edge).toMatch(/roleLevel < 3/);
    const nav = read('client/src/lib/navigation-permissions.ts');
    for (const page of ['/device-monitoring', '/supply-runway', '/supply-orders']) {
      const entry = nav.slice(nav.indexOf(`'${page}': {`));
      expect(entry.slice(0, 200)).toMatch(/minLevel: 3/);
    }
  });
});
