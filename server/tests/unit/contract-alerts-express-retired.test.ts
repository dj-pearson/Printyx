/**
 * The contract-alerts router and its workflow service are gone (QUALITY-002).
 *
 * `server/routes-contract-alerts.ts` was 442 lines serving four `/api/alerts/*`
 * handlers. It was registered, and:
 *
 *   - NO client tree called any of its paths;
 *   - no edge function serves `/api/alerts`, so it 404'd in production;
 *   - it named seven columns that do not exist - `contracts.contractType`,
 *     `service_contracts.includedPages`, `overageRate`, `billingCycle` - so it
 *     would have 500'd in dev had anyone called it.
 *
 * `server/services/contract-renewal-workflow.ts` was its only consumer, 309
 * lines, and named two more phantoms (`service_contracts.assignedSalesRepId`,
 * `tasks.relatedRecordId`). Neither file has ever been able to run.
 *
 * DELETED RATHER THAN ANNOTATED, and the distinction from PROD-008c matters:
 * that story kept `advanced-billing-routes.ts` because it was real, working,
 * unwired work. This is unwired work that cannot work. What users see is served
 * elsewhere and correctly - see the assertions below.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('neither file comes back', () => {
  for (const file of [
    'server/routes-contract-alerts.ts',
    'server/services/contract-renewal-workflow.ts',
  ]) {
    it(`${file} is gone`, () => {
      expect(existsSync(join(repo, file))).toBe(false);
    });
  }

  it('the registry does not mount it', () => {
    const registry = read('server/routes-registry.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(registry).not.toContain('routes-contract-alerts');
  });
});

describe('what it was for is served by code that works', () => {
  it('the alert bell still gets contract expirations, off real columns', () => {
    // This is the load-bearing assertion: the deletion is only safe because
    // this derivation exists and uses columns the table actually has.
    const alerts = read('supabase/functions/_shared/operational-alerts.ts');
    expect(alerts).toContain("from('service_contracts')");
    expect(alerts).toContain('contract_expiration_');
    for (const column of ['contract_number', 'end_date', 'monthly_base_rate']) {
      expect(alerts, column).toContain(column);
    }
    // And the columns the deleted router invented are not here.
    for (const phantom of ['included_pages', 'overage_rate', 'billing_cycle']) {
      expect(alerts, phantom).not.toContain(phantom);
    }
  });

  it('and the performance function serves them', () => {
    const fn = read('supabase/functions/performance/index.ts');
    expect(fn).toContain('deriveOperationalAlerts');
  });

  it('the renewal book is the contract-renewal function', () => {
    const fn = read('supabase/functions/contract-renewal/index.ts');
    expect(fn).toContain("normalizePath(url.pathname, 'contract-renewal')");
  });
});

describe('the feature that really went is recorded, not lost', () => {
  it('milestone automation is named in the registry note', () => {
    // 180/90/60/30-day renewal milestones raising a task and a notification.
    // Nothing else implements it, so deleting the broken attempt without
    // writing that down would quietly retire the idea.
    expect(read('server/routes-registry.ts')).toContain('milestone automation');
  });
});
