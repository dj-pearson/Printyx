/**
 * SEC-EDGE-001, round 75: a shared function with two differently-gated pages,
 * and an auth check that fell through.
 *
 * `maintenance` is reached by `/preventive-maintenance` (a view page, no
 * minLevel) and by `/preventive-maintenance-automation` (minLevel 3 with
 * `service.schedule.manage`). Gating the whole function at the higher level
 * would lock out the lower page - the `webhooks` mistake - and leaving it open
 * lets any member create the schedules that dispatch a technician to a
 * customer site. So reads stay open and writes take SUPERVISOR.
 *
 * `printer-monitoring` is the other shape: an AGENT credential, where a role
 * check is a category error, with one branch whose comment claimed an auth
 * check the code did not make.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');

const maintenance = read('supabase/functions/maintenance/index.ts');
const printer = read('supabase/functions/printer-monitoring/index.ts');
const nav = read('client/src/lib/navigation-permissions.ts');

describe('maintenance gates writes at the level its automation page claims', () => {
  it('the two pages really are gated differently, which is what decides the seam', () => {
    const view = nav.slice(
      nav.indexOf("'/preventive-maintenance': {"),
      nav.indexOf("'/preventive-maintenance-automation'"),
    );
    const automation = nav.slice(nav.indexOf("'/preventive-maintenance-automation': {"));
    expect(view).not.toContain('minLevel');
    expect(automation.slice(0, 220)).toContain('minLevel: 3');
  });

  it('every non-GET requires a supervisor', () => {
    expect(maintenance).toContain("req.method !== 'GET' && req.method !== 'HEAD'");
    expect(maintenance).toContain('ROLE_LEVEL.SUPERVISOR');
  });

  it('the gate precedes every write branch, so none can miss it', () => {
    const gateAt = maintenance.indexOf("if (req.method !== 'GET' && req.method !== 'HEAD')");
    expect(gateAt).toBeGreaterThan(-1);
    for (const branch of [
      "endpoint === 'auto-generate'",
      "req.method === 'POST' && endpoint === 'schedules'",
      "req.method === 'PUT' && endpoint === 'schedules'",
      "req.method === 'DELETE' && endpoint === 'schedules'",
    ]) {
      expect(maintenance.indexOf(branch), branch).toBeGreaterThan(gateAt);
    }
  });

  it('reads stay open, or the view page breaks', () => {
    // The lower of two pages reaching one function sets the read level.
    const gate = maintenance.slice(
      maintenance.indexOf('const denySupervisor'),
      maintenance.indexOf('const url = new URL'),
    );
    expect(gate).toContain("req.method !== 'GET'");
    expect(gate).toContain('throw err;');
  });
});

describe('printer-monitoring no longer serves presets to nobody', () => {
  it('both oid-presets branches answer 401 when neither credential is present', () => {
    // `if (jwt) {...} else if (apiKey) {...}` with no final branch meant both
    // checks were skipped and the catalogue was served anonymously.
    const branches = [
      ...printer.matchAll(/resource === 'oid-presets'[\s\S]*?const \{ data: presets/g),
    ];
    expect(branches.length).toBe(2);
    for (const [branch] of branches) {
      expect(branch).toContain('} else {');
      expect(branch).toContain("{ error: 'Unauthorized' }, 401");
    }
  });

  it('the agent ingest is still authenticated by its device key, not a role', () => {
    // monitoring_clients.api_key is a DEVICE credential; a role check on an
    // agent submission is a category error.
    const ingest = printer.slice(printer.indexOf('// Client-authenticated endpoints'));
    expect(ingest).toContain(".eq('api_key', apiKey)");
    expect(ingest).toContain(".eq('status', 'active')");
    expect(ingest).toContain("{ error: 'Invalid or inactive API key' }, 401");
  });

  it('and the dashboard read is tenant-scoped', () => {
    const dashboard = printer.slice(printer.indexOf("resource === 'dashboard'"));
    expect(dashboard.slice(0, 700)).toContain(".eq('tenant_id', tenantId)");
  });
});

describe('the triage keeps its shape', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json'));
  const entries: Array<Record<string, string>> = triage.triage;

  it('maintenance has left the open-to-all list', () => {
    const baseline = JSON.parse(read('docs/edge-rbac-baseline.json'));
    expect(baseline.openToAllRoles).not.toContain('maintenance');
    expect(entries.some((e) => e.fn === 'maintenance')).toBe(false);
  });

  it('the two examined this round record which paths were read', () => {
    for (const fn of ['technician-sessions', 'printer-monitoring']) {
      const entry = entries.find((e) => e.fn === fn);
      expect(entry?.verdict, fn).not.toBe('unexamined');
      // A verdict from reading some paths looks identical to one that read
      // them all, which is why this field exists.
      expect(entry?.pathsRead, fn).toBeTruthy();
    }
  });

  it('the counts block still matches the entries', () => {
    const derived: Record<string, number> = {};
    for (const e of entries) derived[e.verdict] = (derived[e.verdict] ?? 0) + 1;
    expect(triage.counts).toEqual(derived);
  });
});
