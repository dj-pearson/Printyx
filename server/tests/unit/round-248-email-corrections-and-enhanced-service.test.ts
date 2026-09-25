/**
 * Round 248.
 * (1) POST /api/email-parser/corrections inserted into parsing_corrections with
 *     no tenant_id (NOT NULL), so every correction failed, and accepted any
 *     emailId, another tenant's included.
 * (2) routes-enhanced-service.ts is retired: its /service-tickets handlers were
 *     shadowed by the proxy, /parts-requests/:id/approve|reject updated by id
 *     with no tenant filter, /phone-tickets/* took the tenant from an
 *     x-tenant-id header, and nothing called any of it.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

describe('email parser corrections', () => {
  const src = strip(readFileSync('server/routes-email-parser.ts', 'utf8'));
  const handler = src.slice(src.indexOf("router.post('/corrections'"));
  const insert = handler.indexOf('.insert(parsingCorrections)');

  it('writes the tenant it is required to write', () => {
    expect(handler.slice(insert, insert + 200)).toMatch(/tenantId,/);
  });

  it('refuses an email the tenant does not own, before writing', () => {
    const check = handler.indexOf('eq(processedEmails.tenantId, tenantId)');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(insert);
    expect(handler.slice(check, insert)).toMatch(/status\(404\)/);
  });
});

describe('routes-enhanced-service is retired', () => {
  it('is deleted and unmounted', () => {
    expect(existsSync('server/routes-enhanced-service.ts')).toBe(false);
    expect(strip(readFileSync('server/routes-registry.ts', 'utf8'))).not.toMatch(
      /enhancedServiceRoutes/,
    );
    expect(strip(readFileSync('server/domains/service.ts', 'utf8'))).not.toMatch(
      /routes-enhanced-service/,
    );
  });
});
