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
import { readFileSync } from 'node:fs';
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

describe('the prefix is deliberately NOT proxied yet', () => {
  it('because the edge function does not serve credentials', () => {
    // CLAUDE.md: proxying an un-migrated prefix takes it from working-in-dev to
    // 404-in-dev, because the proxy falls through only on a network error and
    // never on a 404. ApolloCredentialManager calls four /api/apollo/credentials
    // endpoints that exist on Express alone - a fourth family the story does not
    // count - so proxying now would break a component that works today.
    expect(read('client/src/components/integrations/ApolloCredentialManager.tsx')).toContain(
      '/api/apollo/credentials',
    );
    expect(edge).not.toContain("endpoint === 'credentials'");
    expect(read('server/middleware/edge-function-proxy.ts')).not.toContain("'/api/apollo'");
  });
});
