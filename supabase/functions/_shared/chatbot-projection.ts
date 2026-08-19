/**
 * Chatbot console row projections (PROD-014).
 *
 * ChatbotConsole.tsx was Express-only, so in production every panel on the page
 * 404'd. Porting it means the projections run on both backends, and they are
 * where a port of this shape goes wrong twice over:
 *
 *  1. CASING. Express returns Drizzle rows, which are already camelCase;
 *     PostgREST returns snake_case. The page reads `platformUserId`,
 *     `printyxUserId`, `toolsCalled`, `responseExcerpt` off the row directly, so
 *     an edge function handing back raw rows renders a table of blanks — no
 *     error, just empty cells.
 *  2. TOKENS. chatbot_connections.encrypted_tokens holds the workspace bot
 *     token. It must never leave the server; the row the page gets says only
 *     whether one is set. A port that spread the row would publish it.
 *
 * Both copies read either casing, so each works against either backend.
 * server/tests/unit/chatbot-projection-parity.test.ts fails on drift.
 *
 * Deno copy — kept textually identical to
 * server/lib/chatbot-projection.ts.
 */

type Row = Record<string, unknown>;

/** First defined value among the given keys. */
function pick(row: Row, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return undefined;
}

/** ISO string for a Date, a string, or nothing. */
function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Base64 of the UTF-8 bytes.
 *
 * Named for what it does. The column is called encrypted_tokens, but this is
 * obfuscation, not encryption — anyone holding the row can reverse it. It is
 * carried across unchanged so the two backends read each other's rows; making
 * it real encryption is a separate change that has to migrate what is stored.
 */
export function obfuscateCredential(plaintext: string): string {
  const bytes = new TextEncoder().encode(plaintext);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** The connection shape the console reads. Never carries the token itself. */
export function projectConnection(row: Row) {
  const tokens = (pick(row, 'encryptedTokens', 'encrypted_tokens') ?? {}) as Record<
    string,
    unknown
  >;
  return {
    id: row.id,
    platform: row.platform,
    teamId: pick(row, 'teamId', 'team_id') ?? null,
    teamName: pick(row, 'teamName', 'team_name') ?? null,
    enabled: pick(row, 'enabled') ?? false,
    installedByUserId: pick(row, 'installedByUserId', 'installed_by_user_id') ?? null,
    tokensSet: typeof tokens.botToken === 'string' && tokens.botToken.length > 0,
    createdAt: iso(pick(row, 'createdAt', 'created_at')),
    updatedAt: iso(pick(row, 'updatedAt', 'updated_at')),
  };
}

/** The Slack/Teams -> Printyx user mapping the console lists. */
export function projectUserLink(row: Row) {
  return {
    id: row.id,
    platform: row.platform,
    platformUserId: pick(row, 'platformUserId', 'platform_user_id') ?? null,
    email: pick(row, 'email') ?? null,
    printyxUserId: pick(row, 'printyxUserId', 'printyx_user_id') ?? null,
    verified: pick(row, 'verified') ?? false,
    createdAt: iso(pick(row, 'createdAt', 'created_at')),
  };
}

/** One audit row of the append-only query log. */
export function projectQueryLogRow(row: Row) {
  return {
    id: row.id,
    platform: pick(row, 'platform') ?? null,
    channel: pick(row, 'channel') ?? null,
    platformUserId: pick(row, 'platformUserId', 'platform_user_id') ?? null,
    printyxUserId: pick(row, 'printyxUserId', 'printyx_user_id') ?? null,
    question: pick(row, 'question') ?? null,
    toolsCalled: pick(row, 'toolsCalled', 'tools_called') ?? null,
    responseExcerpt: pick(row, 'responseExcerpt', 'response_excerpt') ?? null,
    createdAt: iso(pick(row, 'createdAt', 'created_at')),
  };
}
