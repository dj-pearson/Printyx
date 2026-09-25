/**
 * The four manufacturer adapters exist twice and must stay one implementation.
 *
 * PA-054 ported them to supabase/functions/_shared/manufacturer-adapters.ts so
 * device discovery runs in production - the browser cannot reach Express there,
 * because getApiUrl sends /api/* to the functions host. If the two copies drift,
 * dev and prod ask different vendor endpoints and map different fields, and each
 * keeps passing its own tests while doing so.
 *
 * The Deno copy uses .ts specifiers and cannot be imported from vitest, so this
 * compares the two SOURCES on the things that must agree: the vendor endpoints,
 * the status vocabularies, and the field maps.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
/**
 * Round 161: server/manufacturer-integration-service.ts - the Node copy this
 * compared against - was deleted with the Express router that was its only
 * caller. Its vendor contract is frozen here as it stood, so the edge adapters
 * are still locked to the same endpoints and the same status mapping rather
 * than being free to drift now that there is nothing to drift from.
 */
const NODE_ENDPOINTS: string[] = [
  '${}/api/devices',
  '${}/api/devices/${}/meters',
  '${}/api/login',
  '${}/auth',
  '${}/auth/validate',
  '${}/devices',
  '${}/devices',
  '${}/devices',
  '${}/devices/${}/metrics',
  '${}/devices/${}/usage',
  '${}/devices/${}/usage',
  '${}/oauth/token',
];
const NODE_STATUS_MAPS: string[] = [
  "case 'ready':\n        return 'online'",
  "case 'offline':\n        return 'offline'",
  "case 'fault':\n        return 'error'",
  "case 'maintenance':\n        return 'maintenance'",
  "case 'idle':\n        return 'online'",
  "case 'unreachable':\n        return 'offline'",
  "case 'fault':\n        return 'error'",
  "case 'maintenance':\n        return 'maintenance'",
  "case 'idle':\n        return 'online'",
  "case 'offline':\n        return 'offline'",
  "case 'fault':\n        return 'error'",
  "case 'maintenance':\n        return 'maintenance'",
  "case 'ready':\n        return 'online'",
  "case 'offline':\n        return 'offline'",
  "case 'error':\n        return 'error'",
  "case 'maintenance':\n        return 'maintenance'",
];
const edgeSrc = readFileSync(
  join(repo, 'supabase/functions/_shared/manufacturer-adapters.ts'),
  'utf8',
);
const fnSrc = readFileSync(
  join(repo, 'supabase/functions/manufacturer-integrations/index.ts'),
  'utf8',
);

/** Only the adapter classes: the Node file also holds the service. */
function adapterSection(src: string): string {
  const start = src.indexOf('// Base adapter interface');
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf('export class ManufacturerIntegrationService {');
  return end > -1 ? src.slice(start, end) : src.slice(start);
}

/** Every template-literal URL the adapters fetch, normalized. */
function endpoints(src: string): string[] {
  return [...adapterSection(src).matchAll(/fetch\(\s*`([^`]+)`/g)]
    .map((m) => m[1].replace(/\$\{[^}]+\}/g, '${}'))
    .sort();
}

describe('the two adapter copies agree', () => {
  it('call the same vendor endpoints', () => {
    // Four adapters, each with connect + discover + collect at minimum.
    expect(NODE_ENDPOINTS.length).toBeGreaterThanOrEqual(8);
    expect(endpoints(edgeSrc)).toEqual(NODE_ENDPOINTS);
  });

  it('define the same four adapters and the same factory', () => {
    for (const name of ['CanonAdapter', 'XeroxAdapter', 'HPAdapter', 'FMAuditAdapter']) {
      expect(edgeSrc).toContain(`class ${name}`);
    }
    for (const key of ['canon', 'xerox', 'hp', 'fmaudit']) {
      expect(edgeSrc).toContain(`case '${key}':`);
    }
  });

  it('map vendor status onto the same vocabulary', () => {
    // device_registrations.status is an enum; a spelling that drifts here lands
    // a value the fleet page cannot filter on.
    for (const status of ['online', 'offline', 'error', 'maintenance', 'unknown']) {
      expect(edgeSrc).toContain(`'${status}'`);
    }
    const edgeMaps = adapterSection(edgeSrc).match(/case '[a-z]+':\n\s+return '(\w+)'/g) ?? [];
    expect(edgeMaps).toEqual(NODE_STATUS_MAPS);
  });

  it('shape a discovered device from the same fields', () => {
    for (const field of ['serialNumber', 'macAddress', 'ipAddress', 'capabilities']) {
      expect(edgeSrc).toContain(field);
    }
  });
});

describe('the discovery branch', () => {
  it('no longer answers 501', () => {
    const code = fnSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/Device discovery is not available on this host/);
    expect(code).toMatch(/createAdapter\(/);
  });

  it('does not report a vendor failure as an empty fleet', () => {
    // Every adapter's discoverDevices catches its own fetch error and returns
    // [], so "registered 0" and "could not reach the vendor" were the same
    // answer in the Express version.
    expect(fnSrc).toMatch(/502/);
    expect(fnSrc).toMatch(/Device discovery failed/);
  });

  it('does not upsert, because there is no unique constraint to conflict on', () => {
    // device_registrations indexes (tenant_id, device_id) and integration_id,
    // neither unique. An onConflict upsert would fail; re-running discovery
    // without one would duplicate the fleet.
    const code = fnSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/onConflict/);
    expect(code).toMatch(/existingByDeviceId/);
  });
});
