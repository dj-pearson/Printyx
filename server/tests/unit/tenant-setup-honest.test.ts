import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const strip = (s: string) => s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const PAGE = strip(read('client/src/pages/TenantSetup.tsx'));
const ROOT_ADMIN = read('supabase/functions/root-admin/index.ts');

describe('tenant onboarding page (round 221)', () => {
  it('offers no create button, because nothing an admin screen can call creates a tenant', () => {
    expect(PAGE).not.toContain('Create Tenant Instance');
    // Root-admin serves tenants for list, detail, suspend and activate only.
    expect(ROOT_ADMIN).not.toMatch(
      /req\.method === 'POST' && endpoint === 'tenants' && !resourceId/,
    );
  });

  it('sends new organisations to self-service signup, which is what creates a tenant', () => {
    expect(PAGE).toContain("SIGNUP_PATH = '/signup'");
    expect(read('client/src/hooks/useSupabaseAuth.ts')).toContain("'/api/signup'");
    expect(read('supabase/functions/signup/index.ts')).toMatch(/from\('tenants'\)/);
  });

  it('prices plans from the one module Stripe is set up from, not typed-in figures', () => {
    expect(PAGE).toMatch(/import \{ PRICING_PLANS \} from '@shared\/pricing-plans'/);
    expect(PAGE).not.toMatch(/\$\d+\/month/);
  });

  it('claims no subdomain and no hardcoded tenant status', () => {
    for (const s of ['printyx.net`', '550e8400', 'printyx-demo', 'Current Demo Tenant']) {
      expect(PAGE).not.toContain(s);
    }
  });
});
