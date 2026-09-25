/**
 * Round 161: integration_audit_logs gets a writer on the host production runs.
 *
 * Its only writer was the Node manufacturer-integration-service, reachable only
 * from the dev Express router, so the audit tab was empty in production. The
 * edge function now records every outcome of test and discover.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
const fn = stripComments(
  readFileSync('supabase/functions/manufacturer-integrations/index.ts', 'utf8'),
);

describe('manufacturer integration audit trail', () => {
  it('writes integration_audit_logs through one helper that checks its result', () => {
    const helper = fn.slice(
      fn.indexOf('async function recordIntegrationAudit('),
      fn.indexOf('export default async function handler'),
    );
    expect(helper).toMatch(/from\('integration_audit_logs'\)\.insert\(/);
    expect(helper).toMatch(/tenant_id: entry\.tenantId/);
    expect(helper).toMatch(/const \{ error \} = await admin/);
  });

  it('test records its outcome', () => {
    const at = fn.indexOf("endpoint === 'test'");
    const branch = fn.slice(at, fn.indexOf("endpoint === 'discover'", at));
    expect(branch).toMatch(/recordIntegrationAudit\(admin, \{[\s\S]*?action: 'test'/);
  });

  it('discover records every outcome: failure, empty, registration error, success', () => {
    const at = fn.indexOf("endpoint === 'discover'");
    const branch = fn.slice(
      at,
      fn.indexOf("return createCorsResponse({ error: 'Endpoint not found' }", at),
    );
    const statuses = [...branch.matchAll(/action: 'discover',\s*status: '(\w+)'/g)].map(
      (m) => m[1],
    );
    expect(statuses).toEqual(['error', 'warning', 'error', 'success']);
  });
});
