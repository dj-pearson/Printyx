/**
 * The network and print-management steps get their own rows (WF-L-10).
 *
 * EnhancedOnboardingForm has collected a twenty-two-field networkConfig step
 * and a twenty-one-field printManagement step since it was written, and
 * POST /onboarding/checklists dropped both on the floor. Nothing wrote
 * onboarding_network_config or onboarding_print_management, the storage methods
 * for them in server/storage.ts were called by nothing, and the checklist PDF
 * renderer ALREADY READ both tables - so it printed an empty section every
 * time, for every tenant.
 *
 * The cost is not only a blank PDF. "Which devices have SNMP disabled, or
 * scan-to-email unset" is a question a dealer's IT team asks constantly, and
 * answering it means a column, not a key buried in an equipment_details blob.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildNetworkConfigRow,
  buildPrintManagementRow,
  networkIsConfigured,
  printIsConfigured,
  splitList,
  unpersistedFields,
  NETWORK_FIELDS_WITHOUT_COLUMNS,
  PRINT_FIELDS_WITHOUT_COLUMNS,
} from '../../../supabase/functions/_shared/onboarding-config.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  read(p)
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

const ctx = { tenantId: 't-1', checklistId: 'c-1' };

describe('is_configured is not "the step was submitted"', () => {
  it('an untouched step is not configured', () => {
    // A form posts its defaults whether or not anybody filled anything in.
    // Treating that as configured would mark every checklist done and make the
    // installed -> active gate meaningless.
    expect(networkIsConfigured({})).toBe(false);
    expect(printIsConfigured({})).toBe(false);
  });

  it('a static assignment needs an address', () => {
    expect(networkIsConfigured({ ipAssignment: 'static' })).toBe(false);
    expect(networkIsConfigured({ ipAssignment: 'static', staticIpAddress: '10.0.0.7' })).toBe(true);
  });

  it('a whitespace-only address is not an address', () => {
    expect(networkIsConfigured({ ipAssignment: 'static', staticIpAddress: '   ' })).toBe(false);
  });

  it('dhcp needs something an installer could act on', () => {
    expect(networkIsConfigured({ ipAssignment: 'dhcp' })).toBe(false);
    expect(networkIsConfigured({ ipAssignment: 'dhcp', switchPort: 'Gi1/0/12' })).toBe(true);
    expect(networkIsConfigured({ ipAssignment: 'reserved', vlanConfig: '40' })).toBe(true);
  });

  it("'none' is a real print answer and is not a configuration", () => {
    // This site does not use print management. Saying so is an answer.
    expect(printIsConfigured({ system: 'none', serverAddress: 'print01' })).toBe(false);
  });

  it('a print system needs somewhere to reach it', () => {
    expect(printIsConfigured({ system: 'papercut' })).toBe(false);
    expect(printIsConfigured({ system: 'papercut', serverAddress: 'print01' })).toBe(true);
    expect(printIsConfigured({ system: 'equitrac', queueName: 'FloorTwo' })).toBe(true);
  });
});

describe('the network row', () => {
  it('maps the form names onto the column names', () => {
    const row = buildNetworkConfigRow(
      {
        ipAssignment: 'static',
        staticIpAddress: '10.0.0.7',
        subnetMask: '255.255.255.0',
        gateway: '10.0.0.1',
        vlanConfig: '40',
        namingConvention: 'MFP-{floor}',
        dnsUpdate: true,
      },
      ctx,
    );
    // staticIpAddress -> ip_address, vlanConfig -> vlan_id,
    // namingConvention -> hostname_convention.
    expect(row).toMatchObject({
      ip_address: '10.0.0.7',
      vlan_id: '40',
      hostname_convention: 'MFP-{floor}',
      dns_update_required: true,
      is_configured: true,
      tenant_id: 't-1',
      checklist_id: 'c-1',
    });
  });

  it('splits the DNS line, because the column is jsonb and the form is one field', () => {
    expect(splitList('8.8.8.8, 1.1.1.1')).toEqual(['8.8.8.8', '1.1.1.1']);
    expect(splitList('  ')).toEqual([]);
    expect(splitList(['8.8.8.8'])).toEqual(['8.8.8.8']);
    expect(buildNetworkConfigRow({ dnsServers: '8.8.8.8\n1.1.1.1' }, ctx).dns_servers).toEqual([
      '8.8.8.8',
      '1.1.1.1',
    ]);
  });

  it('stores an empty string as null rather than as an empty value', () => {
    expect(buildNetworkConfigRow({ gateway: '' }, ctx).gateway).toBeNull();
  });
});

describe('the print row', () => {
  it('flattens the three nested groups the form collects', () => {
    const row = buildPrintManagementRow(
      {
        system: 'papercut',
        serverAddress: 'print01',
        userGroups: ['finance'],
        printQuotas: { dailyLimit: 200 },
        restrictions: { colorPrinting: false },
        accountCodes: { required: true, validCodes: ['A1'], defaultCode: 'A1' },
      },
      ctx,
    );
    expect(row).toMatchObject({
      system: 'papercut',
      authorized_groups: ['finance'],
      print_quotas: { dailyLimit: 200 },
      print_restrictions: { colorPrinting: false },
      account_codes_required: true,
      valid_account_codes: ['A1'],
      default_account_code: 'A1',
      is_configured: true,
    });
  });

  it("defaults system to 'none', because the column is NOT NULL", () => {
    expect(buildPrintManagementRow({}, ctx).system).toBe('none');
  });

  it('never leaves an array column null', () => {
    const row = buildPrintManagementRow({ system: 'ysoft' }, ctx);
    expect(row.authorized_groups).toEqual([]);
    expect(row.valid_account_codes).toEqual([]);
  });
});

describe('fields with no column are named, not dropped', () => {
  it('reports only the ones a caller actually sent', () => {
    // A default false or an empty array is not something the caller supplied.
    expect(unpersistedFields({ trunkingRequired: false }, NETWORK_FIELDS_WITHOUT_COLUMNS)).toEqual(
      [],
    );
    expect(unpersistedFields({ capabilities: [] }, PRINT_FIELDS_WITHOUT_COLUMNS)).toEqual([]);
    expect(unpersistedFields({ wirelessSSID: 'Guest' }, NETWORK_FIELDS_WITHOUT_COLUMNS)).toEqual([
      'wirelessSSID',
    ]);
  });

  it('includes wirelessPassword, which nothing should be persisting anyway', () => {
    expect(NETWORK_FIELDS_WITHOUT_COLUMNS).toContain('wirelessPassword');
    expect(buildNetworkConfigRow({ wirelessPassword: 'hunter2' }, ctx)).not.toHaveProperty(
      'wireless_password',
    );
  });
});

describe('the endpoints', () => {
  const fn = code('supabase/functions/onboarding/index.ts');

  it('the checklist create writes both tables', () => {
    expect(fn).toContain("from('onboarding_network_config')");
    expect(fn).toContain("from('onboarding_print_management')");
    expect(fn).toContain('buildNetworkConfigRow(');
    expect(fn).toContain('buildPrintManagementRow(');
  });

  it('a failed config write does not lose the checklist', () => {
    // PostgREST has no transaction, so the checklist is already committed by
    // the time these run. Throwing here would tell the caller the checklist
    // was not created.
    expect(fn).toContain('configWarnings');
  });

  it('gains network-config and print-management as siblings of /:id/equipment', () => {
    expect(fn).toContain("subResource === 'network-config'");
    expect(fn).toContain("subResource === 'print-management'");
  });

  it('confirms the checklist belongs to the tenant before writing against its id', () => {
    // A checklist id travels in URLs; hard to guess is not an authorisation
    // check (SEC-TENANT-005).
    const branch = fn.slice(fn.indexOf("req.method === 'PUT' || req.method === 'POST'"));
    expect(branch).toContain("from('equipment_onboarding_checklists')");
    expect(branch).toContain("eq('tenant_id', tenantId)");
    expect(branch).toContain('Checklist not found');
  });

  it('replaces the row rather than upserting without a unique index', () => {
    expect(fn).not.toContain('onConflict');
  });
});

describe('the lifecycle gate this unblocks', () => {
  it('network_configured is no longer awaiting a writer', () => {
    const evidence = code('supabase/functions/_shared/lifecycle-evidence.ts');
    const set = evidence.slice(
      evidence.indexOf('AWAITING_WRITER = new Set'),
      evidence.indexOf(']);', evidence.indexOf('AWAITING_WRITER = new Set')),
    );
    expect(set).not.toContain('network_configured');
  });

  it('and the classification it used is kept for the next one', () => {
    expect(code('supabase/functions/_shared/lifecycle-evidence.ts')).toContain('AWAITING_WRITER');
  });
});
