/**
 * Round 241: POST /api/database-updater/{enable,disable}/:name wrote a
 * top-level `enabledUpdaters` array onto a config that has no such key and
 * nothing reads, then answered "has been enabled/disabled". The flag an
 * updater checks before running is its own, and only the registry sets it.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';

vi.mock('../../db', () => ({ db: {}, pool: {} }));
const { DatabaseUpdaterManager } = await import('../../database-updater/DatabaseUpdaterManager');
const { UpdaterRegistry } = await import('../../database-updater/core/UpdaterRegistry');

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

function stubUpdater(name: string) {
  let enabled = true;
  return {
    name,
    isEnabled: () => enabled,
    getConfig: () => ({}),
    getMetrics: () => ({}),
    getLastExecution: () => null,
    setEnabled: (v: boolean) => {
      enabled = v;
    },
  };
}

describe('setUpdaterEnabled', () => {
  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  } as unknown as ConstructorParameters<typeof UpdaterRegistry>[0];
  const registry = new UpdaterRegistry(logger);
  const svc = stubUpdater('service_tickets');
  registry.register('service_tickets', svc as unknown as Parameters<typeof registry.register>[1]);
  const call = (name: string, on: boolean) =>
    DatabaseUpdaterManager.prototype.setUpdaterEnabled.call(
      { registry } as unknown as InstanceType<typeof DatabaseUpdaterManager>,
      name,
      on,
    );

  it('flips the flag the updater actually checks', () => {
    expect(call('service_tickets', false)).toBe(true);
    expect(svc.isEnabled()).toBe(false);
    expect(call('service_tickets', true)).toBe(true);
    expect(svc.isEnabled()).toBe(true);
  });

  it('reports an unknown name instead of pretending', () => {
    expect(call('nope', false)).toBe(false);
  });
});

describe('the enable and disable routes', () => {
  const src = strip(readFileSync('server/database-updater/api/updater-routes.ts', 'utf8'));
  it('no longer write the config key nothing reads', () => {
    expect(src).not.toMatch(/newConfig\.enabledUpdaters|enabledUpdaters: status\.config/);
  });
  it('go through the registry', () => {
    expect(src).toMatch(/setUpdaterEnabled\(updaterName, false\)/);
    expect(src).toMatch(/setUpdaterEnabled\(updaterName, true\)/);
  });
});
