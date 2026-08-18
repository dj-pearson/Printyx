/**
 * Unit Tests: server/services/tenant-purge-service.ts (LEGAL-005)
 *
 * The Privacy Policy promises deletion within 30 days of termination, with a
 * stated set of longer holds. Nothing implemented it, so the promise was simply
 * untrue.
 *
 * The risk in fixing it runs both ways, and that is what these tests pin down:
 * purging too little leaves data we said we deleted, and purging too much
 * destroys records we are required to keep. The classification is therefore the
 * part worth testing hardest, because it is where either mistake originates.
 */

import { describe, it, expect } from 'vitest';
import {
  PURGE_GRACE_DAYS,
  RETAINED_TABLES,
  classifyTables,
  listTenantScopedTables,
  retentionReasonFor,
} from '../../services/tenant-purge-service';

describe('grace period', () => {
  it('is the 30 days the Privacy Policy states', () => {
    // If this changes, section 5.2 of the Privacy Policy has to change with it.
    expect(PURGE_GRACE_DAYS).toBe(30);
  });
});

describe('retentionReasonFor', () => {
  it('holds financial records, which the policy keeps for 7 years', () => {
    for (const table of [
      'invoices',
      'invoice_line_items',
      'payments',
      'accounts_payable',
      'accounts_receivable',
      'credit_memos',
      'tenant_subscriptions',
    ]) {
      expect(retentionReasonFor(table), table).toContain('Financial');
    }
  });

  it('holds audit and security records', () => {
    for (const table of ['audit_logs', 'data_access_logs', 'security_sessions', 'access_reviews']) {
      expect(retentionReasonFor(table), table).toBeTruthy();
    }
  });

  it('holds the evidence that a privacy request was honored', () => {
    // Deleting the record of a deletion request defeats the point of having one.
    expect(retentionReasonFor('gdpr_requests')).toBeTruthy();
    expect(retentionReasonFor('consent_records')).toBeTruthy();
  });

  it('purges ordinary business data, which is what the promise covers', () => {
    for (const table of [
      'business_records',
      'company_contacts',
      'deals',
      'equipment',
      'meter_readings',
      'service_tickets',
      'proposals',
      'qbr_reports',
    ]) {
      expect(retentionReasonFor(table), table).toBeNull();
    }
  });

  it('catches a newly added financial table by shape, not by memory', () => {
    // The point of using patterns: nobody has to remember to add this here.
    expect(retentionReasonFor('billing_adjustments')).toBeTruthy();
    expect(retentionReasonFor('payment_reconciliations')).toBeTruthy();
  });
});

describe('listTenantScopedTables', () => {
  it('discovers the tenant-scoped schema at runtime rather than from a written list', () => {
    const tables = listTenantScopedTables();
    // A hand-maintained list of this many tables would be stale within a release.
    expect(tables.length).toBeGreaterThan(400);
    expect(tables).toContain('business_records');
    expect(tables).toContain('service_tickets');
  });

  it('returns sorted, unique names', () => {
    const tables = listTenantScopedTables();
    expect([...new Set(tables)]).toHaveLength(tables.length);
    expect([...tables].sort()).toEqual(tables);
  });

  it("excludes tables with no tenant_id, which are not a tenant's to delete", () => {
    const tables = listTenantScopedTables();
    expect(tables).not.toContain('tenants');
  });
});

describe('classifyTables', () => {
  it('splits the schema into purge and retain with no table left unhandled', () => {
    const tables = listTenantScopedTables();
    const { purge, retained } = classifyTables(tables);
    expect(purge.length + retained.length).toBe(tables.length);
    expect(purge.length).toBeGreaterThan(0);
    expect(retained.length).toBeGreaterThan(0);
  });

  it('gives every retained table a stated reason a reviewer can check', () => {
    const { retained } = classifyTables(listTenantScopedTables());
    for (const r of retained) {
      expect(r.reason.length, r.table).toBeGreaterThan(20);
    }
  });

  it('never puts the same table in both lists', () => {
    const { purge, retained } = classifyTables(listTenantScopedTables());
    const retainedNames = new Set(retained.map((r) => r.table));
    expect(purge.filter((t) => retainedNames.has(t))).toEqual([]);
  });
});

describe('RETAINED_TABLES rules', () => {
  it('each rule states its legal basis, not just that it is retained', () => {
    for (const rule of RETAINED_TABLES) {
      expect(rule.reason).toMatch(/year|obligation|evidence|Privacy Policy|claims|parent/i);
    }
  });
});
