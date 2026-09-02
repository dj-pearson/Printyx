/**
 * WF-S-07: the CRM core tables, and the page that read them from the browser.
 *
 * `companies` and `business_records` appeared in NO policy file. Contacts.tsx read
 * `companies`, `company_contacts` and `users` straight from the browser with the
 * anon-key Supabase client, isolated by an `.eq('tenant_id', tenantId)` written in
 * that same file - a filter the caller supplies is not a boundary. Anyone holding
 * a valid tenant JWT and curl could read another tenant's account list.
 *
 * The policies themselves are verified against a real PostgreSQL 16 (recorded in
 * the story note, not runnable here); these tests pin the things that would
 * silently regress: the policy file's contents, and the page no longer reaching
 * past the server.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';

const rls = (f: string) => readFileSync(`drizzle/rls/${f}`, 'utf8');

describe('WF-S-07: the policy file', () => {
  const sql = rls('crm-core.sql');

  it('covers the five tables the browser could reach', () => {
    for (const table of ['companies', 'business_records', 'company_contacts', 'deals', 'users']) {
      expect(sql, table).toMatch(new RegExp(`'${table}'`));
    }
  });

  it('uses apply_tenant_rls rather than hand-written policies', () => {
    // One definition of the four-policy template means one place to fix it.
    expect(sql).toMatch(/PERFORM apply_tenant_rls\(t\)/);
    expect(sql).not.toMatch(/CREATE POLICY/);
  });

  it('skips a table that does not exist instead of failing the whole file', () => {
    expect(sql).toMatch(/information_schema\.tables/);
    expect(sql).toMatch(/RAISE NOTICE/);
  });

  it('is one transaction, so a partial apply cannot leave RLS half on', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
  });

  it('says plainly that RLS does not constrain the edge functions', () => {
    // Every edge function uses the service-role client, which holds BYPASSRLS.
    // Overreading this file as "the API is now protected twice" is the mistake it
    // exists to prevent.
    expect(sql).toMatch(/service-role|service_role/);
    expect(sql).toMatch(/BYPASSRLS|bypass/i);
  });
});

describe('WF-S-07: the template it relies on', () => {
  const sql = rls('apply-rls.sql');

  it('writes USING and WITH CHECK on UPDATE, so a row cannot be re-parented', () => {
    expect(sql).toMatch(/FOR UPDATE TO authenticated USING \(tenant_id = %s\) WITH CHECK/);
  });

  it('grants table privileges as well as policies', () => {
    // RLS policies alone produce 403s: PostgREST needs the GRANT too.
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated/);
  });
});

describe('WF-S-07: no page reaches a table directly any more', () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(p));
      else if (/\.tsx?$/.test(entry.name)) out.push(p);
    }
    return out;
  }

  it('client/src/pages has zero supabase.from( calls', () => {
    const offenders = walk('client/src/pages').filter((f) =>
      /supabase\s*\.\s*from\(/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders, `pages reading a table directly: ${offenders.join(', ')}`).toEqual([]);
  });

  it('Contacts.tsx goes through the API for all four of its old direct calls', () => {
    const page = readFileSync('client/src/pages/Contacts.tsx', 'utf8');
    expect(page).not.toMatch(/from '@\/lib\/supabase'/);
    expect(page).toMatch(/apiRequest\('\/api\/companies\?limit=500', 'GET'\)/);
    expect(page).toMatch(/apiRequest\('\/api\/users', 'GET'\)/);
    expect(page).toMatch(/apiRequest\('\/api\/companies', 'POST'/);
    expect(page).toMatch(/apiRequest\('\/api\/contacts', 'POST'/);
  });

  // COMMENTS STRIPPED FIRST. The comment explaining why a line was removed names
  // the line, so an absence assertion over the raw file reports its own
  // explanation as the defect. This fired here on the first run.
  const contactsCode = () =>
    readFileSync('client/src/pages/Contacts.tsx', 'utf8')
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
      })
      .join('\n');

  it('stops sending a client-chosen tenant_id on the writes', () => {
    // The write half of the same hole: an insert that names its own tenant_id is
    // only as good as the client that sent it.
    expect(contactsCode()).not.toMatch(/tenant_id: tenantId/);
  });

  it('no longer takes the new contact owner from the list filter', () => {
    // `owner_id: filters.contactOwner` assigned a contact to whoever the list
    // happened to be filtered by - and to the literal string 'all' when it was
    // not filtered at all. The server defaults it to the caller.
    expect(contactsCode()).not.toMatch(/owner_id: filters\.contactOwner/);
  });
});
