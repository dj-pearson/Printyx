/**
 * Round 239: auto-order read device.manufacturer, which device_registrations
 * does not have, so the toner lookup fell to a colour-only LIKE pattern and
 * would order the first cartridge of that colour in the catalogue - and a
 * product with no rep price was ordered at an invented 99.99.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';

vi.mock('../../db', () => ({ db: {} }));
const { tonerPatterns } = await import('../../services/auto-order');

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const SRC = strip(readFileSync('server/services/auto-order.ts', 'utf8'));

describe('tonerPatterns', () => {
  it('refuses without a model: a colour alone matches every cartridge', () => {
    expect(tonerPatterns('HP', null, 'black')).toBeNull();
    expect(tonerPatterns(null, '  ', 'black')).toBeNull();
  });

  it('names the model in every pattern, with the maker when known', () => {
    const withMaker = tonerPatterns('HP', 'LaserJet M404', 'black')!;
    expect(withMaker.every((p) => p.includes('LASERJET-M404') && p.includes('HP'))).toBe(true);
    const modelOnly = tonerPatterns(null, 'C5540i', 'cyan')!;
    expect(modelOnly.length).toBeGreaterThan(0);
    expect(modelOnly.every((p) => p.includes('C5540I') && p.includes('CYAN'))).toBe(true);
  });
});

describe('maybeAutoOrder', () => {
  it('reads the manufacturer from the discovered-device row, not the registration', () => {
    expect(SRC).not.toMatch(/device\.manufacturer/);
    expect(SRC).toMatch(/clientDiscoveredDevices\.registeredDeviceId, device\.id/);
  });

  it('never invents a price', () => {
    expect(SRC).not.toMatch(/99\.99/);
    expect(SRC).toMatch(/product\.unitPrice === null/);
  });

  it('stamps the alert inside the tenant', () => {
    expect(SRC).toMatch(
      /\.set\(\{ triggeredOrderId: order\.id[\s\S]*?\.where\(\s*and\(eq\(deviceAlerts\.id, input\.alertId\), eq\(deviceAlerts\.tenantId, input\.tenantId\)\)/,
    );
  });
});
