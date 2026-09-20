/**
 * The mount table check:shadowed-express could not see (QUALITY-002).
 *
 * `routes-registry.ts` mounts five routers from a `lazyModules` table of
 * [path, module, label] tuples. The guard's tuple pattern required the closing
 * bracket straight after the module string, so every THREE-element entry was
 * invisible - and two of the five sat on prefixes the edge-function proxy
 * claims, which means 26 handlers were dead on arrival with nothing saying so.
 *
 * Both are deleted. The deletions are safe for different reasons, so both
 * reasons are asserted rather than assumed:
 *
 *   - cross-module: supabase/functions/cross-module serves the same seven
 *     endpoints and a live page (ServiceHub) calls them.
 *   - territories: supabase/functions/lead-assignment covers territories,
 *     rules, capacity and history over the same four tables, and no client tree
 *     calls /api/territories on either host.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** Comments first - this file names every deleted path in its own header. */
function stripComments(src: string): string {
  return src.replace(/(^|[^:])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('the two proxy-shadowed lazy mounts are retired', () => {
  it('the router and service files are gone', () => {
    for (const f of [
      'server/routes-cross-module.ts',
      'server/routes-territory-management.ts',
      'server/services/territory-management-service.ts',
    ]) {
      expect(existsSync(join(repo, f))).toBe(false);
    }
  });

  it('the registry no longer mounts them', () => {
    const registry = stripComments(read('server/routes-registry.ts'));
    expect(registry).not.toContain('routes-cross-module');
    expect(registry).not.toContain('routes-territory-management');
    // The other three entries stay - none of their prefixes is proxied.
    expect(registry).toContain('routes-gdpr-core');
    expect(registry).toContain('routes-oid-mappings');
    expect(registry).toContain('routes-address-books');
  });

  it('the guard now reads a three-element mount tuple', () => {
    // The blind spot itself: a pattern that stops at the module string cannot
    // match an entry carrying a label, and a mount table is exactly where a
    // router goes to be forgotten.
    const guard = stripComments(read('scripts/check-shadowed-express.mjs'));
    const tuples = [...guard.matchAll(/matchAll\(\s*(\/\\\[[^\n]*)/g)].map((m) => m[1]);
    expect(tuples.length).toBeGreaterThan(0);
    // The tuple pattern has to tolerate whatever follows the module string.
    expect(tuples.some((t) => t.includes('(?:,[^\\]]*)?'))).toBe(true);
  });

  it('cross-module endpoints all survive in the edge function', () => {
    const fn = stripComments(read('supabase/functions/cross-module/index.ts'));
    for (const endpoint of [
      'status',
      'parts-availability',
      'trigger-service',
      'check-inventory',
      'trigger-billing',
      'schedule-maintenance',
      'log-event',
    ]) {
      expect(fn).toContain(`endpoint === '${endpoint}'`);
    }
  });

  it('lead-assignment covers what the territory router did', () => {
    const handlers = readdirSync(join(repo, 'supabase/functions/lead-assignment/handlers'));
    for (const h of ['territories.ts', 'rules.ts', 'capacity.ts', 'history.ts']) {
      expect(handlers).toContain(h);
    }
  });
});

describe('cross-module reports what it cannot measure', () => {
  const fn = read('supabase/functions/cross-module/index.ts');
  const code = stripComments(fn);

  it('status no longer asserts health it has no way to know', () => {
    const branch = code.slice(
      code.indexOf("endpoint === 'status'"),
      code.indexOf('parts-availability'),
    );
    expect(branch).not.toContain('healthy: true');
    expect(branch).not.toContain("status: 'connected'");
    expect(branch).toContain('unbacked');
  });

  it('the two counters are null, not zero', () => {
    // A 0 here reads as "no backlog", which is a measurement; there is no
    // cross-module event table to count.
    const branch = code.slice(
      code.indexOf("endpoint === 'status'"),
      code.indexOf('parts-availability'),
    );
    expect(branch).toContain('pendingEvents: null');
    expect(branch).toContain('processedToday: null');
  });

  it('log-event refuses instead of inventing an event id', () => {
    const branch = code.slice(code.indexOf("endpoint === 'log-event'"));
    expect(branch).not.toContain('EVT-');
    expect(branch).toContain('NOT_IMPLEMENTED');
    expect(branch).toContain('501');
  });
});

describe('the cross-module page drops the fabricated health card', () => {
  const page = stripComments(read('client/src/components/CrossModuleIntegration.tsx'));
  const hook = stripComments(read('client/src/hooks/useCrossModuleIntegration.ts'));

  it('no health percentage, progress bar or last-sync claim', () => {
    expect(page).not.toContain('integrationHealth');
    expect(page).not.toContain('% Healthy');
    expect(page).not.toContain('lastSyncTime');
  });

  it('the hook stops deriving helpers from constants', () => {
    expect(hook).not.toContain('isIntegrationHealthy');
    expect(hook).not.toContain('lastSyncTime');
    // logCrossModuleEvent had no caller and posted to the endpoint that
    // discarded it.
    expect(hook).not.toContain('logCrossModuleEvent');
  });

  it('the pipeline step reads the trigger, not a constant', () => {
    expect(page).toContain('triggerServiceFromCustomer.isSuccess');
  });
});
