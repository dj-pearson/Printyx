/**
 * The two edge functions built on a `devices` table are gone (AUDIT-037).
 *
 * There is no `devices` table - not in any Drizzle schema, not in any
 * migration. supabase/functions/devices/ named it in five of its seven queries
 * and supabase/functions/order-toner/ in one, so a list, a detail read, a
 * create, an update and a delete were each a 42P01. AUDIT-028 recorded this in
 * August and left both as "belongs to whoever takes the repoint". The repoint
 * happened under other names: PA-054 moved the only page to
 * /api/device-monitoring, and AUDIT-031 rebuilt order-toner there over
 * device_supply_orders after finding the supply_orders version had never once
 * succeeded. Both originals were left behind.
 *
 * WHAT KEPT `devices` OFF THE UNREFERENCED LIST is the finding worth locking.
 * check:unreferenced-edge-fns did not strip comments from client sources, and
 * ManufacturerIntegrationDevices.tsx carries a note saying the page stopped
 * calling that prefix - so the comment recording the removal was counted as the
 * caller. Stripping comments surfaced exactly one function: this one.
 *
 * Outcome assertions. Comments stripped before every absence check, line
 * comments first.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the functions over a nonexistent table are deleted', () => {
  it.each(['supabase/functions/devices', 'supabase/functions/order-toner'])('%s is gone', (p) => {
    expect(existsSync(join(repo, p))).toBe(false);
  });

  it('there is still no devices table, so nothing should be rebuilt on one', () => {
    for (const p of ['shared/schema.ts', 'shared/drizzle-schema.ts']) {
      expect(read(p)).not.toContain("pgTable('devices'");
    }
  });

  it('device-monitoring serves what the pages actually call', () => {
    const fn = read('supabase/functions/device-monitoring/index.ts');
    expect(fn).toContain("resource === 'devices'");
    expect(fn).toContain("parts[2] === 'metrics'");
    expect(fn).toContain("parts[2] === 'collect'");
    expect(fn).toContain("parts[2] === 'order-toner'");
  });

  it('the pages call device-monitoring, not the deleted prefix', () => {
    for (const p of [
      'client/src/pages/ManufacturerIntegrationDevices.tsx',
      'client/src/pages/FleetMonitoringDashboard.tsx',
    ]) {
      const src = stripComments(read(p));
      expect(src).toContain('/api/device-monitoring/');
      // Stop at any character outside [a-z0-9-] so /api/device-monitoring is
      // not read as a hit on /api/devices.
      expect(src).not.toMatch(/\/api\/devices(?![a-z0-9-])/);
      expect(src).not.toMatch(/\/api\/order-toner(?![a-z0-9-])/);
    }
  });
});

describe('the guard that hid it strips comments now', () => {
  it('the client scan strips before matching', () => {
    const guard = read('scripts/check-unreferenced-edge-fns.mjs');
    const at = guard.indexOf('function clientSegments()');
    expect(at).toBeGreaterThan(-1);
    const body = guard.slice(at, guard.indexOf('\n}', at));
    // A raw readFileSync feeding the matcher is the bug this closed.
    expect(body).toMatch(/stripComments\(readFileSync\(/);
  });
});
