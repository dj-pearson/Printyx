// PROD-014 parity lock.
//
// ChatbotConsole.tsx was Express-only, so in production every panel on the page
// 404'd. Both backends now serve it, which puts the row projections in two
// places:
//
//   server/lib/chatbot-projection.ts
//   supabase/functions/_shared/chatbot-projection.ts
//
// Two properties are worth more than the rest. The bot token must never appear
// in a response — the row says only whether one is set. And the page reads
// camelCase keys straight off each row, so a projection that let a snake_case
// row through renders a table of blank cells with no error anywhere.
import { describe, it, expect } from 'vitest';

import * as node from '../../lib/chatbot-projection';
import * as edge from '../../../supabase/functions/_shared/chatbot-projection';

const CREATED = new Date('2026-08-19T12:00:00.000Z');

const drizzleConnection = {
  id: 'conn-1',
  platform: 'slack',
  teamId: 'T123',
  teamName: 'Acme HQ',
  encryptedTokens: { botToken: 'eG94Yi1zZWNyZXQ=' },
  enabled: true,
  installedByUserId: 'user-1',
  createdAt: CREATED,
  updatedAt: CREATED,
};

const postgrestConnection = {
  id: 'conn-1',
  platform: 'slack',
  team_id: 'T123',
  team_name: 'Acme HQ',
  encrypted_tokens: { botToken: 'eG94Yi1zZWNyZXQ=' },
  enabled: true,
  installed_by_user_id: 'user-1',
  created_at: CREATED.toISOString(),
  updated_at: CREATED.toISOString(),
};

describe('the token never leaves the server', () => {
  it('reports only whether one is set', () => {
    for (const project of [node.projectConnection, edge.projectConnection]) {
      const out = project(drizzleConnection);
      expect(out.tokensSet).toBe(true);
      expect(JSON.stringify(out)).not.toContain('eG94Yi1zZWNyZXQ=');
      expect(Object.keys(out)).not.toContain('encryptedTokens');
      expect(Object.keys(out)).not.toContain('encrypted_tokens');
    }
  });

  it('says no token when the jsonb is empty, missing or blank', () => {
    for (const tokens of [{}, null, undefined, { botToken: '' }, { botToken: 42 }]) {
      const row = { ...drizzleConnection, encryptedTokens: tokens };
      expect(node.projectConnection(row).tokensSet).toBe(false);
      expect(edge.projectConnection(row).tokensSet).toBe(false);
    }
  });
});

describe('both backends produce the same camelCase row', () => {
  it('projects a Drizzle row and a PostgREST row identically', () => {
    expect(edge.projectConnection(postgrestConnection)).toEqual(
      node.projectConnection(drizzleConnection),
    );
  });

  it('emits the keys the console reads, not the columns the table has', () => {
    const out = edge.projectConnection(postgrestConnection);
    expect(Object.keys(out).sort()).toEqual(
      [
        'createdAt',
        'enabled',
        'id',
        'installedByUserId',
        'platform',
        'teamId',
        'teamName',
        'tokensSet',
        'updatedAt',
      ].sort(),
    );
  });

  it('projects a user link from either casing', () => {
    const drizzle = {
      id: 'link-1',
      platform: 'slack',
      platformUserId: 'U9',
      email: 'rep@example.com',
      printyxUserId: 'user-2',
      verified: true,
      createdAt: CREATED,
    };
    const postgrest = {
      id: 'link-1',
      platform: 'slack',
      platform_user_id: 'U9',
      email: 'rep@example.com',
      printyx_user_id: 'user-2',
      verified: true,
      created_at: CREATED.toISOString(),
    };
    expect(edge.projectUserLink(postgrest)).toEqual(node.projectUserLink(drizzle));
    expect(edge.projectUserLink(postgrest).platformUserId).toBe('U9');
    expect(edge.projectUserLink(postgrest).printyxUserId).toBe('user-2');
  });

  it('projects a query-log row from either casing', () => {
    const tools = [{ tool: 'pipeline_status', args: {}, source: 'fallback' }];
    const drizzle = {
      id: 'log-1',
      platform: 'slack',
      channel: 'C1',
      platformUserId: 'U9',
      printyxUserId: 'user-2',
      question: 'what changed this week?',
      toolsCalled: tools,
      responseExcerpt: 'Two deals moved.',
      createdAt: CREATED,
    };
    const postgrest = {
      id: 'log-1',
      platform: 'slack',
      channel: 'C1',
      platform_user_id: 'U9',
      printyx_user_id: 'user-2',
      question: 'what changed this week?',
      tools_called: tools,
      response_excerpt: 'Two deals moved.',
      created_at: CREATED.toISOString(),
    };
    expect(edge.projectQueryLogRow(postgrest)).toEqual(node.projectQueryLogRow(drizzle));
    expect(edge.projectQueryLogRow(postgrest).toolsCalled).toEqual(tools);
    expect(edge.projectQueryLogRow(postgrest).responseExcerpt).toBe('Two deals moved.');
  });

  it('nulls a missing value rather than dropping the key', () => {
    // The console renders `row.teamName ?? '—'`; an absent key and a null read
    // the same there, but only if the key is present in the JSON at all.
    const sparse = { id: 'conn-2', platform: 'teams' };
    for (const project of [node.projectConnection, edge.projectConnection]) {
      const out = project(sparse);
      expect(out.teamName).toBeNull();
      expect(out.createdAt).toBeNull();
      expect('teamId' in out).toBe(true);
    }
  });
});

describe('obfuscateCredential parity', () => {
  it('produces the same base64 on both sides', () => {
    for (const secret of ['xoxb-secret', '', 'a'.repeat(100), 'tok:with/punct+uation==']) {
      expect(edge.obfuscateCredential(secret)).toBe(node.obfuscateCredential(secret));
    }
  });

  it('encodes UTF-8 bytes, not code units', () => {
    // A multi-byte character is where a naive btoa(string) throws and a
    // Buffer-based copy silently differs.
    const secret = 'clé-café-ü';
    expect(edge.obfuscateCredential(secret)).toBe(node.obfuscateCredential(secret));
    expect(Buffer.from(edge.obfuscateCredential(secret), 'base64').toString('utf8')).toBe(secret);
  });

  it('is reversible, which is why it is not called encryption', () => {
    // The column is named encrypted_tokens; this is base64. Stating it in a
    // test so nobody reads the column name as a security guarantee.
    const secret = 'xoxb-not-really-encrypted';
    expect(Buffer.from(node.obfuscateCredential(secret), 'base64').toString('utf8')).toBe(secret);
  });
});
