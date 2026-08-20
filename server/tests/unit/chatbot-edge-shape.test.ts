// PROD-014: the chatbot console had no edge function, so in production every
// panel on ChatbotConsole.tsx 404'd.
//
// What a port of this shape gets wrong quietly: a query that forgets the tenant
// filter (one dealer's workspace installs and chat-to-user mappings shown to
// another), a column that is not there, and the bot token escaping in a
// response. All three are checked against the real Drizzle columns here rather
// than trusted to review.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';

import { chatbotConnections, chatbotUserLinks, chatbotQueryLog } from '@shared/chatbot-schema';

const edge = readFileSync(join(process.cwd(), 'supabase/functions/chatbot/index.ts'), 'utf-8');
const express = readFileSync(join(process.cwd(), 'server/routes-chatbot.ts'), 'utf-8');
const page = readFileSync(join(process.cwd(), 'client/src/pages/ChatbotConsole.tsx'), 'utf-8');

const cols = (table: unknown) =>
  new Set(
    Object.values(getTableColumns(table as never) as Record<string, { name: string }>).map(
      (c) => c.name,
    ),
  );

const connectionColumns = cols(chatbotConnections);
const linkColumns = cols(chatbotUserLinks);
const logColumns = cols(chatbotQueryLog);

/**
 * Every column literal handed to a PostgREST filter or write payload.
 *
 * Payload keys are read only from inside an .insert/.update/.upsert literal —
 * scanning every indented key would pick up the response bodies, which are not
 * columns at all.
 */
function columnLiterals(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\.(?:eq|neq|order)\(\s*'([a-z_]+)'/g)) out.push(m[1]);
  for (const m of text.matchAll(/\.(?:insert|update|upsert)\(\s*\{([\s\S]*?)\n\s*\}/g)) {
    for (const k of m[1].matchAll(/^\s+([a-z_]+):/gm)) out.push(k[1]);
  }
  return out;
}

function block(from: string, to: string): string {
  const at = edge.indexOf(from);
  expect(at, `block not found: ${from}`).toBeGreaterThan(-1);
  const end = edge.indexOf(to, at);
  return edge.slice(at, end === -1 ? edge.length : end);
}

describe('every query is tenant-scoped', () => {
  const tables = ['chatbot_connections', 'chatbot_user_links', 'chatbot_query_log'];

  it.each(tables)('%s is never queried without tenant_id', (table) => {
    // Each .from('<table>') chain must carry an eq('tenant_id', ...) — except
    // the upsert, which sets tenant_id in the payload instead.
    const chains = edge.split(`.from('${table}')`).slice(1);
    expect(chains.length).toBeGreaterThan(0);
    for (const chain of chains) {
      const head = chain.slice(0, 700);
      expect(
        head.includes("eq('tenant_id', tenantId)") || head.includes('tenant_id: tenantId'),
        `an unscoped ${table} query: ${head.slice(0, 120)}`,
      ).toBe(true);
    }
  });

  it('resolves a link email against this tenant only', () => {
    // Matching the email across all tenants would map a Slack account onto
    // someone else's employee and mark it verified.
    const links = block("resource === 'links' && !id", 'DELETE /chatbot/links/:id');
    const at = links.indexOf(".from('users')");
    expect(links.slice(at, at + 300)).toContain("eq('tenant_id', tenantId)");
  });

  it('takes the tenant from the JWT, not the header', () => {
    expect(edge).toContain('TENANT_ACCESS_DENIED');
    const jwtAt = edge.indexOf('const jwtTenantId');
    const headerAt = edge.indexOf('const headerTenantId');
    expect(jwtAt).toBeGreaterThan(-1);
    expect(jwtAt).toBeLessThan(headerAt);
    expect(edge).toContain('jwtTenantId || headerTenantId');
  });
});

describe('every column named exists', () => {
  it.each([
    ['chatbot_connections', connectionColumns],
    ['chatbot_user_links', linkColumns],
    ['chatbot_query_log', logColumns],
  ] as const)('%s', (table, columns) => {
    for (const chain of edge.split(`.from('${table}')`).slice(1)) {
      // Stop at the next .from so keys of a later payload are not attributed here.
      const scope = chain.split('.from(')[0];
      for (const literal of columnLiterals(scope)) {
        if (literal === 'tenant_id') continue; // present on all three
        expect(columns.has(literal) || literal === 'id', `${table}.${literal}`).toBe(true);
      }
    }
  });
});

describe('the bot token never leaves', () => {
  it('returns projections, never the raw row', () => {
    const connect = block("resource === 'connect'", 'PUT /chatbot/connections/:id');
    expect(connect).toContain('projectConnection(row)');
    expect(connect).not.toMatch(/createCorsResponse\(\s*row/);
    expect(connect).not.toContain('...row');
  });

  it('obfuscates a pasted token before storing it', () => {
    expect(edge).toContain('obfuscateCredential(String(botToken))');
    expect(express).toContain('obfuscateCredential(botToken)');
  });

  it('lists connections through the projection', () => {
    expect(edge).toContain('(data ?? []).map(projectConnection)');
  });
});

describe('the console gets the keys it reads', () => {
  it('the page reads camelCase off each row', () => {
    expect(page).toContain('platformUserId');
    expect(page).toContain('responseExcerpt');
    expect(page).toContain('toolsCalled');
  });

  it('links and the query log go through their projections, not raw', () => {
    // PostgREST returns snake_case. Handing those rows back renders a table of
    // blank cells with no error anywhere.
    expect(edge).toContain('(data ?? []).map(projectUserLink)');
    expect(edge).toContain('(data ?? []).map(projectQueryLogRow)');
    expect(express).toContain('rows.map(projectUserLink)');
    expect(express).toContain('rows.map(projectQueryLogRow)');
  });

  it('wraps every list as { data, total }', () => {
    const wrapped = [...edge.matchAll(/\{ data: rows, total: rows\.length \}/g)];
    expect(wrapped.length).toBe(3);
    expect(page).toContain('ListResponse');
  });
});

describe('the answer engine is refused, not faked', () => {
  it('names the reason instead of 404ing anonymously', () => {
    expect(edge).toContain('CHATBOT_QUERY_NOT_PORTED');
    const at = edge.indexOf('CHATBOT_QUERY_NOT_PORTED');
    expect(edge.slice(at, at + 120)).toContain('501');
  });

  it('still lives on Express, so dev keeps working', () => {
    expect(express).toContain("app.post('/api/chatbot/query'");
  });

  it('does not attempt a partial tool registry', () => {
    // A half-ported registry answers with the wrong account rather than an
    // error, which is worse than not answering.
    for (const tool of ['account_summary', 'rep_activity', 'at_risk_customers']) {
      expect(edge).not.toContain(`${tool}(`);
    }
  });
});
