import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * SEC-TENANT-002. Two privileged writes took their target straight off the
 * request and bound it to nothing.
 *
 * Both sit behind an admin gate, and the gate is the reason they read as safe:
 * it proves the CALLER is an admin and says nothing at all about whose user the
 * target is. These functions use the service-role client, so a tenant filter is
 * the only isolation there is.
 *
 * Source-level assertions, because neither endpoint can be exercised from a
 * Node test - the edge tree pulls https: specifiers. The check is that the
 * binding is present and that the shape it replaced has not come back.
 */

const root = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('mfa admin reset', () => {
  const fn = read('supabase/functions/mfa/index.ts');

  it('confirms the target user is in the caller tenant before stripping MFA', () => {
    // Without this an admin in one tenant could disable MFA for a user in
    // another - a security control removed across a tenancy boundary.
    const reset = fn.slice(fn.indexOf("p1 === 'reset'"));
    const guard = reset.slice(0, reset.indexOf('mfa_enrollments'));
    expect(guard).toContain("from('users')");
    expect(guard).toContain("eq('tenant_id', auth.tenantId)");
  });

  it('answers 404, not 403, for a user outside the tenant', () => {
    // A 403 would confirm that the uuid exists somewhere, which is not
    // something this endpoint should tell a caller.
    const reset = fn.slice(fn.indexOf("p1 === 'reset'"));
    expect(reset.slice(0, reset.indexOf('mfa_enrollments'))).toContain('404');
  });

  it('still stamps the audit row, which was the only record and was misfiled', () => {
    // The audit insert writes the CALLER's tenant_id, so before the fix the
    // victim's tenant had no record of the reset at all.
    expect(fn).toContain('event_type: ');
    expect(fn).toContain("'admin_reset'");
  });
});

describe('rbac role assignment', () => {
  const fn = read('supabase/functions/rbac/index.ts');

  it('filters the role update by tenant as well as by user id', () => {
    const update = fn.slice(fn.indexOf('update({ role_id: roleId'));
    expect(update.slice(0, 300)).toContain("eq('tenant_id', tenantId)");
  });

  it('does not rely on the role level check for tenancy', () => {
    // `roles` has no tenant_id, so the level comparison constrains WHICH role
    // may be granted, never WHOSE user may receive it.
    const rolesSchema = read('shared/schema.ts');
    const table = rolesSchema.slice(rolesSchema.indexOf("pgTable('roles'"));
    expect(table.slice(0, table.indexOf('});'))).not.toContain("'tenant_id'");
  });
});
