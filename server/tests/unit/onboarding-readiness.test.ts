/**
 * WF-L-11: the two existence checks the Network Setup step runs.
 *
 * The interesting half is coverage resolution, because `oid_mappings.model_series`
 * is free text and nullable, so "does a mapping exist for this device" is the
 * same resolution problem COP-B10 and COP-B09 already paid for. The seeded
 * catalogue carries both awkward shapes on day one: a null series meaning every
 * model of that manufacturer, and 'VersaLink/AltaLink' meaning either of two.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  modelMatchesSeries,
  normalizeManufacturer,
  normalizeText,
  requiresScanToEmail,
  resolveOidCoverage,
  seriesVariants,
  summariseOidCoverage,
  type OidMappingRow,
} from '@shared/onboarding-readiness';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Shaped like the rows server/seed-oid-mappings.ts actually writes. */
const CATALOGUE: OidMappingRow[] = [
  {
    id: 1,
    manufacturer: 'Canon',
    model_series: 'imageRUNNER ADVANCE',
    mapping_name: 'Canon imageRUNNER ADVANCE Standard',
    is_default: true,
  },
  {
    id: 2,
    manufacturer: 'Canon',
    model_series: null,
    mapping_name: 'Canon Generic (Printer MIB)',
    is_default: false,
  },
  {
    id: 3,
    manufacturer: 'Xerox',
    model_series: 'VersaLink/AltaLink',
    mapping_name: 'Xerox VersaLink/AltaLink',
    is_default: true,
  },
  {
    id: 4,
    manufacturer: 'HP',
    model_series: 'LaserJet',
    mapping_name: 'HP LaserJet',
    is_default: true,
  },
];

describe('normalizing', () => {
  it('turns punctuation into a space, never into nothing', () => {
    // 'iR-ADV' collapsing to 'iradv' would let it match inside unrelated words.
    expect(normalizeText('iR-ADV')).toBe('ir adv');
    expect(normalizeText('  C5870i ')).toBe('c5870i');
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(42)).toBe('');
  });

  it('strips corporate suffixes from a manufacturer, one deep or several', () => {
    expect(normalizeManufacturer('Canon U.S.A., Inc.')).toBe('canon');
    expect(normalizeManufacturer('Canon')).toBe('canon');
    expect(normalizeManufacturer('Konica Minolta Business Solutions')).toBe(
      'konica minolta business solutions',
    );
  });

  it('never strips the only token, or a distinguishing word', () => {
    // A manufacturer literally called "Co" is still a manufacturer, and
    // 'HP Enterprise' may be a different catalogue from 'HP' (COP-B10).
    expect(normalizeManufacturer('Co')).toBe('co');
    expect(normalizeManufacturer('HP Enterprise')).toBe('hp enterprise');
  });

  it('reads a slash or a comma in model_series as a list, because the seed has one', () => {
    expect(seriesVariants('VersaLink/AltaLink')).toEqual(['versalink', 'altalink']);
    expect(seriesVariants('bizhub, bizhub PRESS')).toEqual(['bizhub', 'bizhub press']);
    expect(seriesVariants(null)).toEqual([]);
    expect(seriesVariants('   ')).toEqual([]);
  });

  it('matches a series only at token boundaries', () => {
    expect(modelMatchesSeries('imagerunner advance dx c5870i', 'imagerunner advance')).toBe(true);
    expect(modelMatchesSeries('versalink c7025', 'versalink')).toBe(true);
    expect(modelMatchesSeries('versalink', 'versalink')).toBe(true);
    // 'jet' must not match inside 'LaserJet' once normalized to one token.
    expect(modelMatchesSeries('laserjet m607', 'jet')).toBe(false);
    expect(modelMatchesSeries('laserjet m607', '')).toBe(false);
    expect(modelMatchesSeries('', 'laserjet')).toBe(false);
  });
});

describe('resolveOidCoverage', () => {
  it('prefers a series mapping over the manufacturer-wide one', () => {
    const c = resolveOidCoverage(
      { manufacturer: 'Canon', model: 'imageRUNNER ADVANCE DX C5870i' },
      CATALOGUE,
    );
    expect(c.basis).toBe('model-series');
    expect(c.mappingName).toBe('Canon imageRUNNER ADVANCE Standard');
    expect(c.matchedSeries).toBe('imagerunner advance');
  });

  it('falls back to a null model_series row, and calls that generic', () => {
    const c = resolveOidCoverage({ manufacturer: 'Canon', model: 'PIXMA TR4520' }, CATALOGUE);
    expect(c.basis).toBe('manufacturer-default');
    expect(c.mappingName).toBe('Canon Generic (Printer MIB)');
    expect(c.matchedSeries).toBeNull();
  });

  it('matches either half of a slash-separated series', () => {
    for (const model of ['VersaLink C7025', 'AltaLink C8145']) {
      expect(resolveOidCoverage({ manufacturer: 'Xerox', model }, CATALOGUE).basis).toBe(
        'model-series',
      );
    }
  });

  it('is none when the manufacturer has no row at all', () => {
    const c = resolveOidCoverage({ manufacturer: 'Sharp', model: 'MX-3071' }, CATALOGUE);
    expect(c).toMatchObject({ basis: 'none', mappingName: null, matchedSeries: null });
  });

  it('is none when the manufacturer matches but only a non-matching series exists', () => {
    // Xerox has no null-series row, so a Phaser resolves to nothing rather than
    // borrowing the VersaLink bundle.
    const c = resolveOidCoverage({ manufacturer: 'Xerox', model: 'Phaser 6510' }, CATALOGUE);
    expect(c.basis).toBe('none');
  });

  it('is UNKNOWN, not none, when the model or manufacturer was never typed in', () => {
    // The distinction is the whole point: "not set up" over a blank field sends
    // a technician to fix something that is not broken.
    expect(resolveOidCoverage({ manufacturer: 'Canon', model: '' }, CATALOGUE).basis).toBe(
      'unknown',
    );
    expect(resolveOidCoverage({ manufacturer: null, model: 'C5870i' }, CATALOGUE).basis).toBe(
      'unknown',
    );
    // 'Unknown' is what this form's own equipment default writes, so it is an
    // absence wearing a value.
    expect(resolveOidCoverage({ manufacturer: 'Unknown', model: 'C5870i' }, CATALOGUE).basis).toBe(
      'unknown',
    );
  });

  it('ignores corporate suffix drift between the device and the catalogue', () => {
    expect(
      resolveOidCoverage(
        { manufacturer: 'Canon U.S.A., Inc.', model: 'imageRUNNER ADVANCE C3530i' },
        CATALOGUE,
      ).basis,
    ).toBe('model-series');
  });

  it('picks the LONGER series when two match, so a narrower row takes effect', () => {
    const narrower: OidMappingRow[] = [
      ...CATALOGUE,
      {
        id: 9,
        manufacturer: 'Canon',
        model_series: 'imageRUNNER ADVANCE DX',
        mapping_name: 'Canon imageRUNNER ADVANCE DX',
        is_default: false,
      },
    ];
    const c = resolveOidCoverage(
      { manufacturer: 'Canon', model: 'imageRUNNER ADVANCE DX C5870i' },
      narrower,
    );
    expect(c.mappingName).toBe('Canon imageRUNNER ADVANCE DX');
  });

  it('breaks a tie on is_default, then on id, so the answer is stable', () => {
    const tied: OidMappingRow[] = [
      { id: 20, manufacturer: 'HP', model_series: 'LaserJet', mapping_name: 'B', is_default: true },
      {
        id: 10,
        manufacturer: 'HP',
        model_series: 'LaserJet',
        mapping_name: 'A',
        is_default: false,
      },
    ];
    expect(
      resolveOidCoverage({ manufacturer: 'HP', model: 'LaserJet M607' }, tied).mappingName,
    ).toBe('B');
    const noDefault = tied.map((t) => ({ ...t, is_default: false }));
    expect(
      resolveOidCoverage({ manufacturer: 'HP', model: 'LaserJet M607' }, noDefault).mappingName,
    ).toBe('A');
  });

  it('an abbreviation nobody spelled out is a visible gap, not a guess', () => {
    // 'iR-ADV' is the trade abbreviation for 'imageRUNNER ADVANCE'. Matching it
    // would mean deciding unreviewed that two spellings are one thing; the
    // admin closes it with one row instead (COP-B10).
    const abbreviated: OidMappingRow[] = [
      { id: 1, manufacturer: 'Canon', model_series: 'iR-ADV', mapping_name: 'Canon iR-ADV' },
    ];
    expect(
      resolveOidCoverage(
        { manufacturer: 'Canon', model: 'imageRUNNER ADVANCE DX C5870i' },
        abbreviated,
      ).basis,
    ).toBe('none');
  });
});

describe('summariseOidCoverage', () => {
  it('counts each outcome separately and flags an empty catalogue', () => {
    const summary = summariseOidCoverage(
      [
        { manufacturer: 'Canon', model: 'imageRUNNER ADVANCE C3530i' },
        { manufacturer: 'Canon', model: 'PIXMA TR4520' },
        { manufacturer: 'Sharp', model: 'MX-3071' },
        { manufacturer: 'Unknown', model: '' },
      ],
      CATALOGUE,
    );
    expect(summary).toMatchObject({ covered: 2, uncovered: 1, unknown: 1, catalogueEmpty: false });
    expect(summary.devices).toHaveLength(4);
  });

  it('an empty catalogue is its own fact, separate from every device missing', () => {
    const summary = summariseOidCoverage([{ manufacturer: 'Canon', model: 'C3530i' }], []);
    expect(summary).toMatchObject({ covered: 0, uncovered: 1, catalogueEmpty: true });
  });

  it('no devices is no claim either way', () => {
    expect(summariseOidCoverage([], CATALOGUE)).toMatchObject({
      covered: 0,
      uncovered: 0,
      unknown: 0,
    });
  });
});

describe('requiresScanToEmail', () => {
  it('is false for plain printers, and says why', () => {
    const r = requiresScanToEmail([
      { manufacturer: 'HP', model: 'LaserJet M607', equipmentType: 'printer' },
    ]);
    expect(r.required).toBe(false);
    expect(r.devices).toEqual([]);
    expect(r.reason).toMatch(/MFP or scanner/);
  });

  it('is true for an MFP or a scanner, and names the device', () => {
    expect(requiresScanToEmail([{ model: 'C5870i', equipmentType: 'mfp' }]).devices).toEqual([
      'C5870i',
    ]);
    expect(requiresScanToEmail([{ model: 'DR-C240', equipmentType: 'scanner' }]).required).toBe(
      true,
    );
  });

  it('is true when a feature names scanning or an SMTP host is already set', () => {
    expect(
      requiresScanToEmail([{ model: 'X', equipmentType: 'copier', features: ['Scan to folder'] }])
        .required,
    ).toBe(true);
    expect(
      requiresScanToEmail([{ model: 'Y', equipmentType: 'copier', smtpName: 'smtp.acme.test' }])
        .required,
    ).toBe(true);
    // An empty SMTP name is not a signal.
    expect(
      requiresScanToEmail([{ model: 'Z', equipmentType: 'copier', smtpName: '   ' }]).required,
    ).toBe(false);
  });

  it('falls back through model, manufacturer, then a placeholder for the name', () => {
    expect(requiresScanToEmail([{ manufacturer: 'Canon', equipmentType: 'mfp' }]).devices).toEqual([
      'Canon',
    ]);
    expect(requiresScanToEmail([{ equipmentType: 'mfp' }]).devices).toEqual(['Unnamed device']);
  });

  it('says the derivation out loud, because no field on the checklist asks', () => {
    expect(requiresScanToEmail([{ model: 'A', equipmentType: 'mfp' }]).reason).toMatch(
      /no scan-to-email field/i,
    );
  });
});

describe('the endpoint that serves the panel', () => {
  const FN = stripComments(read('supabase/functions/onboarding/index.ts'));

  it('is a GET on its own segment, so it needs no saved checklist', () => {
    // The wizard step runs BEFORE the checklist is created; a branch keyed on a
    // checklist id could never answer it.
    expect(FN).toMatch(/req\.method === 'GET' && pathParts\[0\] === 'config-readiness'/);
  });

  it('reads the shared catalogue through fetchAllRows, not a bare select', () => {
    // A coverage count over a truncated catalogue reports gaps that are not
    // there - a wrong measurement, not a short list. Bound to the CALL and its
    // table rather than to line layout: prettier wraps this chain onto four
    // lines the moment the select list grows, and a test that pins adjacency
    // breaks on correct work (round 70).
    const at = FN.indexOf('fetchAllRows<OidMappingRow>(');
    expect(at).toBeGreaterThan(-1);
    expect(FN.slice(at, at + 300)).toMatch(/from\('oid_mappings'\)/);
    // And nothing in the branch reads that table any other way.
    const branchAt = FN.indexOf("'config-readiness'");
    const branch = FN.slice(branchAt, FN.indexOf("subResource === 'network-config'", branchAt));
    expect([...branch.matchAll(/from\('oid_mappings'\)/g)]).toHaveLength(1);
  });

  it('filters address_books on tenant AND customer, and skips soft-deleted books', () => {
    const at = FN.indexOf("from('address_books')");
    expect(at).toBeGreaterThan(-1);
    const chain = FN.slice(at, at + 400);
    expect(chain).toMatch(/\.eq\('tenant_id', tenantId\)/);
    expect(chain).toMatch(/\.eq\('customer_id', customerId\)/);
    expect(chain).toMatch(/\.is\('deleted_at', null\)/);
  });

  it('answers null for the OID half when its read failed, never an empty summary', () => {
    expect(FN).toMatch(/const oid = oidReadFailed \? null : summariseOidCoverage\(/);
  });

  it('reports bookCount null when no customer was selected, not zero', () => {
    // Zero is a measurement: "this customer has no address book". Null is "we
    // did not look".
    expect(FN).toMatch(/bookCount: books \? books\.length : null/);
  });

  it('names what could not be read rather than blanking the panel', () => {
    expect(FN).toMatch(/degraded\.push\('oid_mappings'\)/);
    expect(FN).toMatch(/degraded\.push\('address_books'\)/);
  });

  it('writes nothing - AC3 is read-only existence checks', () => {
    const at = FN.indexOf("'config-readiness'");
    // Bound on the NEXT branch's own condition, not on a comment - comments
    // are stripped here and a fixed window would run into a neighbour that
    // does write (round 84's window-crossing trap, five times over).
    const branch = FN.slice(at, FN.indexOf("subResource === 'network-config'", at));
    expect(branch.length).toBeGreaterThan(500);
    expect(branch).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  });
});

describe('the Network Setup step it lives on', () => {
  const FORM = read('client/src/pages/EnhancedOnboardingForm.tsx');

  it('case 6 exists at all', () => {
    // It fell to `default: return null` since the page was written, so the
    // nineteen networkConfig fields the schema declares were unreachable and
    // WF-L-10's is_configured could never become true.
    expect(FORM).toMatch(/\n {6}case 6:\n/);
  });

  it('renders the readiness panel with the selected customer and the equipment', () => {
    const at = FORM.indexOf('<ConfigReadinessPanel');
    expect(at).toBeGreaterThan(-1);
    const el = FORM.slice(at, FORM.indexOf('/>', at));
    expect(el).toMatch(
      /customerId=\{selectedBusinessRecord\?\.id \|\| form\.watch\('businessRecordId'\)/,
    );
    expect(el).toMatch(/devices=\{readinessDevices\}/);
  });

  it('renders every networkConfig field that has a column, and none that does not', () => {
    // A form input whose value the write path discards is worse than an absent
    // one (COP-M01). The two lists are derived from the module that decides.
    const config = read('supabase/functions/_shared/onboarding-config.ts');
    const declared = /NETWORK_FIELDS_WITHOUT_COLUMNS = \[([^\]]*)\]/.exec(config);
    expect(declared).not.toBeNull();
    const without = [...declared![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(without.length).toBeGreaterThan(0);

    const rendered = [...FORM.matchAll(/name="networkConfig\.(\w+)"/g)].map((m) => m[1]);
    expect(rendered.length).toBeGreaterThan(8);
    for (const field of without) {
      expect({ field, rendered: rendered.includes(field) }).toEqual({ field, rendered: false });
    }
    // And the ones that DO persist are all there.
    for (const field of [
      'ipAssignment',
      'staticIpAddress',
      'subnetMask',
      'gateway',
      'dnsServers',
      'vlanConfig',
      'switchPort',
      'switchLocation',
      'namingConvention',
      'dnsUpdate',
      'firewallRules',
      'qosSettings',
    ]) {
      expect({ field, rendered: rendered.includes(field) }).toEqual({ field, rendered: true });
    }
  });

  it('sends only the fields the checks read, never serials or site contacts', () => {
    const at = FORM.indexOf('const readinessDevices');
    expect(at).toBeGreaterThan(-1);
    const body = FORM.slice(at, FORM.indexOf('}));', at));
    for (const leak of ['serialNumber', 'assetTag', 'location', 'macAddress']) {
      expect({ leak, present: body.includes(leak) }).toEqual({ leak, present: false });
    }
  });
});
