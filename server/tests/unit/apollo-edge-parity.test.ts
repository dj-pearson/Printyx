/**
 * Apollo bulk-add and stats 404'd in production (WF-S-05).
 *
 * The page calls /api/apollo/leads/bulk-add and /api/apollo/stats and the edge
 * function served neither, while dev was covered by server/routes/apollo-routes.ts.
 *
 * READING IT TURNED UP TWO THINGS THE STORY DOES NOT NAME, and both are worse
 * than a 404.
 *
 *   add-to-crm COULD NEVER FIRE ON EITHER PATH SHAPE. The branch tested
 *   `endpoint === 'add-to-crm'`, where endpoint is parts[0], while the page
 *   calls POST /apollo/leads/:contactId/add-to-crm - so parts[0] is 'leads' and
 *   the condition was false on every request. It also expected an
 *   { apolloId, contactData } body and the page sends none. "The branch exists"
 *   was never the same as "the endpoint works".
 *
 *   THE EXPRESS HANDLER WAS THROWING THE CONTACT AWAY. It wrote firstName,
 *   lastName, email, jobTitle, linkedinUrl and leadSource through Drizzle, and
 *   business_records has none of those six. Drizzle iterates the TABLE's
 *   columns and picks each out of the object, so an unknown key is dropped
 *   with no error: every lead added from Apollo landed with a company name, a
 *   website and an industry, and no way to contact the person. That is the DEV
 *   path - the one that appeared to work.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

const edge = code('supabase/functions/apollo/index.ts');
const page = read('client/src/pages/ApolloLeadEnrichment.tsx');

describe('the edge function serves the shapes the page calls', () => {
  it('bulk-add', () => {
    expect(page).toContain("'/api/apollo/leads/bulk-add'");
    expect(edge).toMatch(/endpoint === 'leads' && resourceId === 'bulk-add'/);
  });

  it('stats', () => {
    expect(page).toContain("'/api/apollo/stats'");
    expect(edge).toMatch(/endpoint === 'stats'/);
  });

  it('add-to-crm at the path the page actually uses', () => {
    expect(page).toMatch(/\/api\/apollo\/leads\/\$\{contactId\}\/add-to-crm/);
    expect(edge).toMatch(/endpoint === 'leads' &&\s*resourceId &&\s*parts\[2\] === 'add-to-crm'/);
  });
});

describe('the contact details are written to columns that exist', () => {
  // business_records, verbatim. There is no first_name, email, job_title,
  // linkedin_url or lead_source on this table.
  const REAL = [
    'primary_contact_name',
    'primary_contact_email',
    'primary_contact_phone',
    'primary_contact_title',
    'source',
  ];
  const PHANTOM = ['first_name', 'last_name', 'job_title', 'linkedin_url', 'lead_source'];

  const insert = edge.slice(
    edge.indexOf("from('business_records')\n    .insert("),
    edge.indexOf("from('business_records')\n    .insert(") + 1200,
  );

  for (const col of REAL) {
    it(`writes ${col}`, () => {
      expect(insert).toContain(`${col}:`);
    });
  }

  for (const col of PHANTOM) {
    it(`never writes ${col}, which the table does not have`, () => {
      expect(insert).not.toMatch(new RegExp(`\\b${col}:`));
    });
  }

  it('the schema still says so', () => {
    // The slice has to END at the table, not at a fixed offset: a 14k window
    // ran on into the NEXT pgTable, which does have first_name, and the
    // assertion failed on a column belonging to something else entirely.
    const schema = read('shared/schema.ts');
    const from = schema.indexOf("'business_records',");
    const table = schema.slice(from, schema.indexOf('\n);', from));
    expect(table.length).toBeGreaterThan(2000);
    for (const col of REAL) expect(table, `${col} missing`).toContain(`'${col}'`);
    for (const col of PHANTOM) expect(table, `${col} present`).not.toContain(`'${col}'`);
  });

  it('names the LinkedIn URL as unstored rather than smuggling it into notes', () => {
    // Quietly relocating a value is how the original defect reads to the next
    // person, so it is reported instead.
    expect(edge).toContain('unbacked');
    expect(edge).not.toMatch(/account_notes:.*linkedin/i);
  });
});

describe('the duplicate check looks at a real column, and at one tenant', () => {
  it('matches on primary_contact_email', () => {
    expect(edge).toContain("eq('primary_contact_email', contact.email)");
  });

  it('is scoped to the tenant', () => {
    // The Express original checked business_records.email with NO tenant
    // filter, so one tenant having the contact blocked every other tenant from
    // adding it.
    const dupe = edge.slice(edge.indexOf('if (contact.email)'));
    expect(dupe.slice(0, 500)).toContain("eq('tenant_id', tenantId)");
  });
});

describe('bulk-add reports what happened to each id', () => {
  it('counts failures, not only successes', () => {
    // A count of successes with no count of failures is the AUDIT-038 shape,
    // and here a silent skip looks exactly like a contact already in the CRM.
    expect(edge).toContain('skipped.push(');
    expect(edge).toMatch(/skipped: skipped\.length/);
    expect(edge).toContain('skippedDetail');
  });
});

describe('stats counts the same rows /usage reads', () => {
  it('reads apollo_api_usage over a stated window', () => {
    const branch = edge.slice(edge.indexOf("endpoint === 'stats'"));
    expect(branch.slice(0, 900)).toContain("from('apollo_api_usage')");
    expect(branch.slice(0, 900)).toContain('periodDays');
  });
});

describe('the prefix is proxied now, because the edge function covers it (WF-S-05 AC3)', () => {
  // INVERTED DELIBERATELY. This block used to assert the OPPOSITE - that
  // /api/apollo must stay off crmProxies because the edge function served no
  // credentials branch, and CLAUDE.md is right that proxying an un-migrated
  // prefix takes it from working-in-dev to 404-in-dev. The way out was never to
  // keep the assertion; it was to migrate the prefix. All four credential
  // endpoints are on the edge function now, so the reason has gone.
  const proxy = read('server/middleware/edge-function-proxy.ts');

  it('crmProxies carries the whole prefix', () => {
    expect(proxy).toContain("'/api/apollo': 'apollo'");
  });

  it('the Express router is gone, not merely unmounted', () => {
    expect(existsSync(join(repo, 'server/routes/apollo-routes.ts'))).toBe(false);
    expect(read('server/routes-registry.ts')).not.toContain("'./routes/apollo-routes'");
  });

  it('every path the client calls has a branch', () => {
    const called = new Set<string>();
    for (const file of [
      'client/src/pages/ApolloLeadEnrichment.tsx',
      'client/src/components/integrations/ApolloCredentialManager.tsx',
    ]) {
      for (const m of read(file).matchAll(/\/api\/apollo\/([a-z-]+)/g)) called.add(m[1]);
    }
    expect(called).toEqual(new Set(['search', 'leads', 'stats', 'credentials']));
    for (const resource of called) {
      expect(edge, `no branch for ${resource}`).toContain(`endpoint === '${resource}'`);
    }
  });
});

describe('search really calls Apollo (WF-S-05 AC3)', () => {
  const shared = code('supabase/functions/_shared/apollo-client.ts');

  it('the placeholder is gone', () => {
    // It answered { contacts: [], message: 'Apollo API integration required' }
    // at status 200, which a rep reads as "nobody matched your filters".
    expect(edge).not.toContain('Apollo API integration required');
    expect(edge).not.toContain('Apollo API enrichment required');
  });

  it('posts to the endpoints the Node client used', () => {
    expect(shared).toContain('/v1/mixed_people/search');
    expect(shared).toContain('/v1/people/match');
    expect(shared).toContain("'X-Api-Key'");
  });

  it('a missing key is an error, not an empty list', () => {
    expect(edge).toContain('APOLLO_NOT_CONFIGURED');
  });

  it('looks the cache up by the digest, not by the raw filter JSON', () => {
    // apollo_search_cache.search_hash holds a digest. The old branch matched it
    // against JSON.stringify(body), so the cache could never hit even once the
    // rest of the endpoint worked.
    expect(edge).not.toContain("eq('search_hash', JSON.stringify(");
    expect(edge).toContain("eq('search_hash', hash)");
  });

  it('records usage for a failed call too', () => {
    // Credits are not spent on a rejected call, so a failure row carries zero -
    // but it is still a row, or the usage panel says nothing happened.
    expect(edge).toMatch(/success: false/);
    expect(edge).toMatch(/credits_used: 0/);
  });
});

describe('the branches that queried tables nobody declared are gone', () => {
  // apollo_tenant_leads (the ledger is tenant_apollo_leads), apollo_contacts
  // (the cache is centralized_apollo_contacts) and apollo_saved_searches, which
  // is in no schema and no migration and had no caller either.
  for (const table of ['apollo_tenant_leads', 'apollo_contacts', 'apollo_saved_searches']) {
    it(`never queries ${table}`, () => {
      expect(edge).not.toContain(`from('${table}')`);
    });
  }

  it('the real ledger and cache are still read', () => {
    expect(edge).toContain("from('tenant_apollo_leads')");
    expect(edge).toContain("from('centralized_apollo_contacts')");
  });

  it('and the schema agrees about which names are real', () => {
    const schema = read('shared/apollo-schema.ts');
    for (const table of ['tenant_apollo_leads', 'centralized_apollo_contacts']) {
      expect(schema).toContain(`'${table}'`);
    }
    for (const table of ['apollo_tenant_leads', 'apollo_contacts', 'apollo_saved_searches']) {
      expect(schema).not.toContain(`'${table}'`);
    }
  });
});

describe('the API key is never returned to the client', () => {
  it('GET /credentials sends a mask', () => {
    const branch = edge.slice(edge.indexOf("req.method === 'GET' && endpoint === 'credentials'"));
    expect(branch.slice(0, 900)).toContain('maskApiKey(credential.api_key)');
    expect(branch.slice(0, 900)).not.toMatch(/apiKey: credential\.api_key/);
  });
});
