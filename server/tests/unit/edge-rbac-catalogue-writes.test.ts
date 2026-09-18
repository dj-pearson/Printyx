/**
 * The product catalogue is no longer writable by every authenticated user
 * (SEC-EDGE-001).
 *
 * 281 of 284 edge functions authenticate the user, resolve the tenant and stop.
 * Production serves the catalogue from these functions, so any member of a
 * tenant - a technician, an inside sales rep - could add, edit or delete a
 * product model, a supply or a vendor. The Express handlers beside them DID
 * carry a gate, which is the sharper version of the finding: somebody noticed,
 * fixed it on the side that stopped running, and the fix has been inert since
 * the prefix was proxied.
 *
 * Reads stay open, because the pages beside them set no minimum level: a rep
 * pricing a quote and a technician looking up a part both have to see the
 * catalogue. What was open and should not have been is the write.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  _clearPermissionCache,
  denyBelowLevel,
  denyWithoutPermission,
  roleLevelClaim,
} from '../../../supabase/functions/_shared/rbac.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
/**
 * Source with comments blanked. An absence assertion that reads raw source
 * matches the COMMENT explaining why the thing is absent - which is how
 * "deliberately NOT finance.bill.approve" failed the test asserting that
 * finance.bill.approve is not there. CLAUDE.md records this trap for
 * check:edge-coverage and it has now fired in a unit test too.
 */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const GATED = [
  'product-models',
  'product-accessories',
  'products',
  'supplies',
  'inventory',
  'vendors',
];

/** A stub that answers the one users→roles join these helpers make. */
function stubAdmin(row: unknown, throws = false) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) chain[m] = () => chain;
  chain.maybeSingle = async () => {
    if (throws) throw new Error('connection reset');
    return { data: row, error: null };
  };
  return { from: () => chain } as never;
}

describe('the gate is on every write and on no read', () => {
  for (const fn of GATED) {
    const src = read(`supabase/functions/${fn}/index.ts`);

    it(`${fn} gates non-GET methods`, () => {
      expect(src).toContain("req.method !== 'GET' && req.method !== 'HEAD'");
      expect(src).toContain('denyWithoutPermission(admin, user, WRITE_PERMISSION)');
    });

    it(`${fn} names a code the seeder creates`, () => {
      // SEC-EDGE-002's whole point: a gate on an unseeded code denies every
      // role below platform admin, so copying the old Express code here would
      // have swapped one wrong answer for another.
      const seeded = read('server/database-updater/seeders/rbac-seeder.ts');
      const code = /const WRITE_PERMISSION = '([^']+)'/.exec(src)?.[1];
      expect(code).toBe('operations.inventory.manage');
      expect(seeded).toContain(`code: '${code}'`);
    });

    it(`${fn} gates before it dispatches`, () => {
      // After the gate the handler branches on method and path. A gate placed
      // after the first branch guards nothing that returns early.
      const gateAt = src.indexOf('denyWithoutPermission');
      const firstBranch = src.search(/if \(req\.method === '(POST|PUT|PATCH|DELETE)'/);
      expect(gateAt).toBeGreaterThan(0);
      if (firstBranch > 0) expect(gateAt).toBeLessThan(firstBranch);
    });
  }
});

describe('a stale token does not lock its owner out', () => {
  it('an absent level claim falls through to the database', async () => {
    // getRoleLevel answers 1 with no claim, which is right for a claim check
    // and wrong as an authorisation decision: WF-R-03 writes the claim at role
    // assignment plus a backfill, so a token minted before then carries none.
    // Gating on the claim alone would 403 a company admin out of their own
    // catalogue on deploy day and tell them their role was too low.
    _clearPermissionCache();
    const user = { id: 'u1', app_metadata: {} };
    expect(roleLevelClaim(user)).toBe(null);
    expect(await denyBelowLevel(stubAdmin({ role: { level: 5 } }), user, 4)).toBe(null);
  });

  it('a present claim is trusted without a query', async () => {
    _clearPermissionCache();
    // The claim is signed. Re-reading it would cost a query per request.
    const denied = await denyBelowLevel(
      stubAdmin(null, true),
      { id: 'u2', app_metadata: { roleLevel: 6 } },
      4,
    );
    expect(denied).toBe(null);
  });

  it('a permission claim missing from the token is read from the role', async () => {
    _clearPermissionCache();
    const denied = await denyWithoutPermission(
      stubAdmin({ role: { permissions: { operations: { inventory: ['manage'] } } } }),
      { id: 'u3', app_metadata: {} },
      'operations.inventory.manage',
    );
    expect(denied).toBe(null);
  });
});

describe('it fails closed', () => {
  it('a failed level lookup denies rather than admits', async () => {
    _clearPermissionCache();
    const denied = await denyBelowLevel(stubAdmin(null, true), { id: 'u4', app_metadata: {} }, 4);
    expect(denied?.code).toBe('INSUFFICIENT_ROLE');
    expect(denied?.actual).toBe(1);
  });

  it('a failed permission lookup denies rather than admits', async () => {
    _clearPermissionCache();
    const denied = await denyWithoutPermission(
      stubAdmin(null, true),
      { id: 'u5', app_metadata: {} },
      'operations.inventory.manage',
    );
    expect(denied?.code).toBe('MISSING_PERMISSION');
  });

  it('a user with a different permission is denied', async () => {
    _clearPermissionCache();
    const denied = await denyWithoutPermission(
      stubAdmin({ role: { permissions: { operations: { inventory: ['view'] } } } }),
      { id: 'u6', app_metadata: {} },
      'operations.inventory.manage',
    );
    expect(denied?.required).toEqual(['operations.inventory.manage']);
  });

  it('a platform admin passes without a lookup', async () => {
    _clearPermissionCache();
    const denied = await denyWithoutPermission(
      stubAdmin(null, true),
      { id: 'u7', app_metadata: { roleLevel: 8 } },
      'operations.inventory.manage',
    );
    expect(denied).toBe(null);
  });
});

describe('the denial says what is needed', () => {
  it('names the permission, not just "forbidden"', async () => {
    // A 403 that says only "forbidden" sends the user to support.
    _clearPermissionCache();
    const denied = await denyWithoutPermission(
      stubAdmin({ role: { permissions: {} } }),
      { id: 'u8', app_metadata: {} },
      'operations.inventory.manage',
    );
    expect(denied?.error).toContain('operations.inventory.manage');
  });

  it('names the level held and the level required', async () => {
    _clearPermissionCache();
    const denied = await denyBelowLevel(
      stubAdmin({ role: { level: 2 } }),
      { id: 'u9', app_metadata: {} },
      5,
    );
    expect(denied?.required).toBe(5);
    expect(denied?.actual).toBe(2);
  });
});

describe('the ratchet moved', () => {
  it('none of the six is still recorded as open to all roles', () => {
    const baseline = JSON.parse(read('docs/edge-rbac-baseline.json'));
    for (const fn of GATED) {
      expect(baseline.openToAllRoles, fn).not.toContain(fn);
    }
  });
});

/**
 * The finance surface (SEC-EDGE-001, second batch).
 *
 * Sharper than the catalogue: production served the general ledger, the chart
 * of accounts and both sides of the ledger to every authenticated member of a
 * tenant with no permission check, so a technician could post a journal entry.
 *
 * These gate the READ too, which the catalogue deliberately does not. The
 * difference is the page: /journal-entries and /chart-of-accounts need
 * finance.gl.view at level 4 to open at all, so an ungated read on the endpoint
 * behind them is a hole rather than a convenience.
 */
describe('the finance surface is gated on both sides', () => {
  const FINANCE: Record<string, { read: string; write: string }> = {
    'journal-entries': { read: 'finance.gl.view', write: 'finance.gl.post' },
    'chart-of-accounts': { read: 'finance.gl.view', write: 'finance.gl.post' },
    'account-payable': { read: 'finance.ap.view', write: 'finance.bill.enter' },
    'account-receivable': { read: 'finance.ar.view', write: 'finance.invoice.create' },
  };

  const seeded = read('server/database-updater/seeders/rbac-seeder.ts');
  const nav = read('client/src/lib/navigation-permissions.ts');

  for (const [fn, codes] of Object.entries(FINANCE)) {
    const src = read(`supabase/functions/${fn}/index.ts`);

    it(`${fn} reads on ${codes.read} and writes on ${codes.write}`, () => {
      expect(src).toContain(`const READ_PERMISSION = '${codes.read}'`);
      expect(src).toContain(`const WRITE_PERMISSION = '${codes.write}'`);
      expect(src).toMatch(/READ_PERMISSION : WRITE_PERMISSION/);
    });

    it(`${fn} names codes the seeder creates`, () => {
      expect(seeded).toContain(`code: '${codes.read}'`);
      expect(seeded).toContain(`code: '${codes.write}'`);
    });

    it(`${fn} gates the read, unlike the catalogue`, () => {
      // The page will not open without the read code, so leaving the endpoint
      // open would be a hole rather than a convenience.
      expect(nav).toContain(`'${codes.read}'`);
      expect(src).not.toMatch(/req\.method !== 'GET' && req\.method !== 'HEAD'/);
    });
  }

  it('entering a payable is not approving one', () => {
    // The two halves of a payable are what nobody should hold at once.
    const src = code('supabase/functions/account-payable/index.ts');
    expect(src).toContain('finance.bill.enter');
    expect(src).not.toContain('finance.bill.approve');
  });

  it('every gated finance function is out of the open-to-all baseline', () => {
    const baseline = JSON.parse(read('docs/edge-rbac-baseline.json'));
    for (const fn of Object.keys(FINANCE)) {
      expect(baseline.openToAllRoles, fn).not.toContain(fn);
    }
  });
});

/**
 * Minting an API key was open to everyone (SEC-EDGE-001, third batch).
 *
 * createKey takes `scopes` and `permissions` straight from the request body and
 * returns the plaintext key once, so any authenticated member of a tenant could
 * mint a credential carrying whatever scopes they asked for and then use it.
 * That is a privilege-escalation path, not an ungated list.
 */
describe('api-keys requires the level its page requires', () => {
  const src = read('supabase/functions/api-keys/index.ts');

  it('gates on level 4, matching /settings/api-keys', () => {
    const nav = read('client/src/lib/navigation-permissions.ts');
    const entry = nav.slice(nav.indexOf("'/settings/api-keys': {"));
    expect(entry.slice(0, 200)).toContain('minLevel: 4');
    expect(src).toContain('ROLE_LEVEL.MANAGER');
    expect(src).toContain('denyBelowLevel(');
  });

  it('a level and not a code, because the page names an unseeded one', () => {
    // /settings/api-keys gates on admin.settings.update, which the seeder did
    // not create until this pass - the SEC-EDGE-002 class on the nav side.
    // Level 4 is what the page means and what a seeded role can satisfy.
    expect(code('supabase/functions/api-keys/index.ts')).not.toContain('admin.settings.update');
  });

  it('POST /validate stays above the gate', () => {
    // It is called by other edge functions to check a key, not by a user.
    // Requiring level 4 there would break every integration holding a service
    // key.
    const validateAt = src.indexOf("first === 'validate'");
    const gateAt = src.indexOf('denyBelowLevel(');
    expect(validateAt).toBeGreaterThan(0);
    expect(validateAt).toBeLessThan(gateAt);
  });

  it('the scopes it would mint are caller-supplied, which is why this matters', () => {
    expect(src).toMatch(/scopes: \(body\.scopes \?\? \[\]\)/);
  });

  it('is out of the open-to-all baseline', () => {
    expect(JSON.parse(read('docs/edge-rbac-baseline.json')).openToAllRoles).not.toContain(
      'api-keys',
    );
  });
});

/**
 * Money and tenant configuration (SEC-EDGE-001, fourth batch).
 *
 * Each gate is the code its own page already requires, so the route and the
 * screen in front of it agree. The read/write split follows the page: where the
 * page will not open without a code, the read carries it too; where the page is
 * open and only the write is privileged, only the write is gated.
 */
describe('the money and configuration surface is gated', () => {
  const SPLIT: Record<string, { read: string; write: string }> = {
    billing: { read: 'finance.ar.view', write: 'finance.invoice.create' },
    subscriptions: { read: 'finance.ar.view', write: 'admin.settings.update' },
  };
  const SAME: Record<string, string> = {
    'pricing-settings': 'operations.inventory.manage',
    'customer-numbers': 'admin.settings.update',
    'contract-pnl': 'finance.reports.view',
    quickbooks: 'admin.settings.integrations',
  };

  const seeder = read('server/database-updater/seeders/rbac-seeder.ts');
  const baseline = JSON.parse(read('docs/edge-rbac-baseline.json'));

  for (const [fn, codes] of Object.entries(SPLIT)) {
    it(`${fn} reads on ${codes.read} and writes on ${codes.write}`, () => {
      const src = read(`supabase/functions/${fn}/index.ts`);
      expect(src).toContain(`const READ_PERMISSION = '${codes.read}'`);
      expect(src).toContain(`const WRITE_PERMISSION = '${codes.write}'`);
      expect(seeder).toContain(`code: '${codes.read}'`);
      expect(seeder).toContain(`code: '${codes.write}'`);
    });
  }

  for (const [fn, codeName] of Object.entries(SAME)) {
    it(`${fn} requires ${codeName} on both sides`, () => {
      const src = read(`supabase/functions/${fn}/index.ts`);
      expect(src).toContain(`const REQUIRED_PERMISSION = '${codeName}'`);
      expect(seeder).toContain(`code: '${codeName}'`);
    });
  }

  it('white-label is a LEVEL check, because the page puts it above the admins', () => {
    // admin.settings.update is granted to several admin roles; /white-label
    // deliberately requires level 6 on top of it, and the level is the
    // distinguishing constraint.
    const src = read('supabase/functions/white-label/index.ts');
    const nav = read('client/src/lib/navigation-permissions.ts');
    expect(
      nav.slice(nav.indexOf("'/white-label': {"), nav.indexOf("'/white-label': {") + 200),
    ).toContain('minLevel: 6');
    expect(src).toContain('ROLE_LEVEL.REGIONAL_MANAGER');
  });

  it('every one of the seven is out of the open-to-all baseline', () => {
    for (const fn of [...Object.keys(SPLIT), ...Object.keys(SAME), 'white-label']) {
      expect(baseline.openToAllRoles, fn).not.toContain(fn);
    }
  });

  it('pricing settings are gated on the read as well, because the numbers are the policy', () => {
    // maxDiscountPercentage and requireApprovalBelowMargin are what the quote
    // guardrails enforce. Loosening them is silent.
    const src = read('supabase/functions/pricing-settings/index.ts');
    expect(src).not.toMatch(/req\.method !== 'GET'/);
  });
});

/**
 * The service surface (SEC-EDGE-001, fifth batch).
 *
 * Different from the finance one in the way that matters: TECHNICIANS MUST BE
 * ABLE TO WRITE. A field technician is level 1 or 2, so a level gate would
 * break the daily job, and a permission gate is only safe if the seeded
 * FIELD_TECHNICIAN template actually holds the code. Each gate below is checked
 * against that template rather than chosen by name - the failure mode here is
 * not a hole, it is a technician who cannot close a ticket from the van.
 */
describe('the service surface gates on codes technicians actually hold', () => {
  const seeder = read('server/database-updater/seeders/rbac-seeder.ts');

  /** The permission list of one seeded role template. */
  const templateOf = (roleCode: string): string[] => {
    const at = seeder.indexOf(`code: '${roleCode}'`);
    expect(at, `${roleCode} is not a seeded role`).toBeGreaterThan(0);
    const block = seeder.slice(at, seeder.indexOf(']', seeder.indexOf('permissions: [', at)));
    return [...block.matchAll(/'([a-z_]+\.[a-z_.]+)'/g)].map((m) => m[1]);
  };

  const tech = templateOf('FIELD_TECHNICIAN');
  const manager = templateOf('SERVICE_MANAGER');

  it('a technician can still close a ticket by voice', () => {
    const src = code('supabase/functions/voice-ticket-close/index.ts');
    expect(src).toContain("'service.ticket.close'");
    expect(tech, 'FIELD_TECHNICIAN cannot close a ticket').toContain('service.ticket.close');
  });

  it('and a service manager is not locked out of it', () => {
    // The seeded SERVICE_MANAGER has void and assign but NOT close, which looks
    // like a gap. Naming both avoids the lockout without asserting a change to
    // what a role holds.
    const src = code('supabase/functions/voice-ticket-close/index.ts');
    expect(manager).not.toContain('service.ticket.close');
    expect(manager).toContain('service.ticket.void');
    expect(src).toContain("'service.ticket.void'");
  });

  it('a technician can still read and restock their van', () => {
    const src = code('supabase/functions/truck-stock/index.ts');
    expect(src).toContain("const READ_PERMISSION = 'service.parts.view'");
    expect(tech).toContain('service.parts.view');
    expect(tech).toContain('service.parts.request');
    expect(src).toContain("'service.parts.request'");
  });

  it('and a manager restocking a van is not denied either', () => {
    // service.parts.order is the manager's code; a gate aimed at technicians
    // must not exclude the person who orders the parts.
    //
    // code(), not read(): the comment beside the gate NAMES service.parts.order
    // while explaining it, so a raw-source assertion passes even when the code
    // itself has been changed - the mutation that caught this replaced the real
    // constant and the test stayed green.
    expect(manager).toContain('service.parts.order');
    expect(code('supabase/functions/truck-stock/index.ts')).toContain("'service.parts.order'");
  });

  it('phone-in tickets need the code the people who answer phones hold', () => {
    const src = code('supabase/functions/phone-in-tickets/index.ts');
    expect(src).toContain("const WRITE_PERMISSION = 'service.ticket.create'");
    // Held by the manager, the dispatcher and the CSR - and deliberately not by
    // a field technician, who does not take these calls.
    expect(manager).toContain('service.ticket.create');
    expect(templateOf('CSR')).toContain('service.ticket.create');
    expect(tech).not.toContain('service.ticket.create');
  });

  it('all three are out of the open-to-all baseline', () => {
    const baseline = JSON.parse(read('docs/edge-rbac-baseline.json'));
    for (const fn of ['phone-in-tickets', 'voice-ticket-close', 'truck-stock']) {
      expect(baseline.openToAllRoles, fn).not.toContain(fn);
    }
  });
});

/**
 * The CRM surface (SEC-EDGE-001, sixth batch).
 *
 * The rule this batch established, and it is not a belt-and-braces habit: the
 * seeded SALES_REP holds `edit_own` and NOT `create`, while SALES_MANAGER holds
 * `create` and NOT `edit_own`. A write gate naming either code alone locks out
 * one of the two roles that do this work every day. Every gate here names both,
 * and the test asserts the split against the templates so a future seeder
 * change that closes it does not silently make the second code redundant.
 *
 * Reads stay open on the record functions, deliberately. A technician opening a
 * ticket and a billing clerk chasing an invoice both read a customer, and none
 * of those pages sets a minimum level - gating the read on a SALES code would
 * be the inversion the service batch warned about, one surface closing the
 * daily job of another.
 */
describe('the CRM write paths are gated without closing the reads', () => {
  const seeder = read('server/database-updater/seeders/rbac-seeder.ts');
  const templateOf = (roleCode: string): string[] => {
    const at = seeder.indexOf(`code: '${roleCode}'`);
    const block = seeder.slice(at, seeder.indexOf(']', seeder.indexOf('permissions: [', at)));
    return [...block.matchAll(/'([a-z_]+\.[a-z_.]+)'/g)].map((m) => m[1]);
  };
  const rep = templateOf('SALES_REP');
  const manager = templateOf('SALES_MANAGER');

  it('the rep and the manager hold DIFFERENT halves, which is why both are named', () => {
    expect(rep).toContain('sales.customer.edit_own');
    expect(rep).not.toContain('sales.customer.create');
    expect(manager).toContain('sales.customer.create');
    expect(manager).not.toContain('sales.customer.edit_own');
  });

  for (const fn of ['contacts', 'company-contacts', 'customers']) {
    it(`${fn} names both customer codes and gates writes only`, () => {
      const src = code(`supabase/functions/${fn}/index.ts`);
      expect(src).toContain("'sales.customer.edit_own'");
      expect(src).toContain("'sales.customer.create'");
      expect(src).toContain("req.method !== 'GET' && req.method !== 'HEAD'");
    });
  }

  it('opportunities does the same with the opportunity codes', () => {
    const src = code('supabase/functions/opportunities/index.ts');
    expect(src).toContain("'sales.opportunity.edit_own'");
    expect(src).toContain("'sales.opportunity.create'");
    expect(rep).toContain('sales.opportunity.edit_own');
  });

  it('custom-fields is a LEVEL gate, because the page names no permission', () => {
    // Defining custom FIELDS is a schema act - it changes what every row of an
    // object carries. /settings/custom-fields requires level 4 and lists no
    // code, so the level is the gate the product already chose.
    const nav = read('client/src/lib/navigation-permissions.ts');
    const entry = nav.slice(nav.indexOf("'/settings/custom-fields': {"));
    expect(entry.slice(0, 160)).toContain('minLevel: 4');
    expect(code('supabase/functions/custom-fields/index.ts')).toContain('ROLE_LEVEL.MANAGER');
  });

  it('auto-lead-routing gates reads too, because the table IS the distribution', () => {
    const src = code('supabase/functions/auto-lead-routing/index.ts');
    expect(src).toContain("'sales.lead.assign'");
    expect(src).toContain("'sales.territory.manage_assignments'");
    expect(src).not.toContain("req.method !== 'GET'");
    // Both are the manager's, neither is the rep's - which is the point.
    expect(manager).toContain('sales.lead.assign');
    expect(rep).not.toContain('sales.lead.assign');
  });

  it('all six are out of the open-to-all baseline', () => {
    const baseline = JSON.parse(read('docs/edge-rbac-baseline.json'));
    for (const fn of [
      'contacts',
      'company-contacts',
      'customers',
      'opportunities',
      'custom-fields',
      'auto-lead-routing',
    ]) {
      expect(baseline.openToAllRoles, fn).not.toContain(fn);
    }
  });
});

/**
 * Integrations and bulk import (SEC-EDGE-001, seventh batch).
 */
describe('the integration and import surfaces are gated', () => {
  it('integrations carries the code its own page requires, on both sides', () => {
    // system_integrations holds OAuth tokens and API keys in `credentials`.
    // Writing here connects or disconnects the tenant's integrations; reading
    // lists what is connected, and /integrations gates on the same code at
    // level 3.
    const src = code('supabase/functions/integrations/index.ts');
    expect(src).toContain("const REQUIRED_PERMISSION = 'admin.settings.integrations'");
    expect(src).not.toMatch(/req\.method !== 'GET'/);
  });

  it('import gates writes on the import codes and leaves job status readable', () => {
    // One request creates what would otherwise be hundreds of records.
    // sales.lead.import is the seeded code for that; operations.inventory.manage
    // is named beside it because /import/products is the same wizard pointed at
    // the catalogue. The read stays on the lead view every rep holds, because
    // whoever started an import has to be able to poll it.
    const src = code('supabase/functions/import/index.ts');
    expect(src).toContain("'sales.lead.import'");
    expect(src).toContain("'operations.inventory.manage'");
    expect(src).toContain("const READ_PERMISSION = 'sales.lead.view_own'");
  });

  it('both are out of the open-to-all baseline', () => {
    const baseline = JSON.parse(read('docs/edge-rbac-baseline.json'));
    for (const fn of ['integrations', 'import']) {
      expect(baseline.openToAllRoles, fn).not.toContain(fn);
    }
  });
});
