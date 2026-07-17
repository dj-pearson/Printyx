/**
 * Static guard for the root-admin SQL console (AUDIT-003).
 *
 * THIS IS DEFENCE-IN-DEPTH, NOT THE SAFETY BOUNDARY.
 * The actual boundary is Postgres itself: the console runs the statement inside a
 * `SET TRANSACTION READ ONLY` transaction (see routes-root-admin.ts), so any write —
 * INSERT/UPDATE/DELETE/DDL — is rejected by the ENGINE with "cannot execute ... in a
 * read-only transaction" no matter what gets past the text checks below. That is what
 * makes the console safe by construction; this module just rejects obvious junk early
 * and gives a better error message than a 25006 from the driver.
 *
 * WHY THE OLD CHECK NEEDED REPLACING: it stripped literals with
 * `query.replace(/'[^']*'/g, '')`, which does not understand
 *   - '' escapes:      'it''s'          (the regex re-pairs the quotes and mis-parses)
 *   - dollar quoting:  $$ ... $$ / $tag$ ... $tag$   (not stripped at all)
 *   - E'' strings:     E'\'' backslash escapes
 * so its idea of "what is inside a string literal" drifts from Postgres's. Every
 * divergence we found happened to fail SAFE (it over-blocks), but a text filter whose
 * parse disagrees with the server's is not something to rely on, which is exactly the
 * point of the story.
 *
 * The scanner below implements Postgres's real lexical rules for the constructs that
 * matter, so `stripLiterals` agrees with the server about what is code and what is data.
 */

export interface QueryGuardResult {
  ok: boolean;
  /** Present when ok — the query with a LIMIT appended if it had none. */
  limitedQuery?: string;
  /** Present when !ok — a safe, user-facing reason. */
  reason?: string;
}

export const MAX_ROWS = 1000;

/**
 * Replace every string literal / quoted identifier / comment with spaces, preserving
 * length and leaving SQL *code* intact. Implements Postgres lexing for:
 *   'single quoted'  with '' escapes
 *   E'escaped'       with backslash escapes
 *   "quoted ident"   with "" escapes
 *   $$ body $$ and $tag$ body $tag$   (dollar quoting, incl. nested different tags)
 *   -- line comments
 *   /* block comments *\/ (nestable in Postgres)
 */
export function stripLiterals(sql: string): string {
  const out: string[] = [];
  let i = 0;
  const n = sql.length;
  const blank = (len: number) => out.push(' '.repeat(len));

  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];

    // -- line comment
    if (c === '-' && next === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      blank(stop - i);
      i = stop;
      continue;
    }

    // /* block comment */ — Postgres allows nesting
    if (c === '/' && next === '*') {
      let depth = 1;
      let j = i + 2;
      while (j < n && depth > 0) {
        if (sql[j] === '/' && sql[j + 1] === '*') {
          depth++;
          j += 2;
        } else if (sql[j] === '*' && sql[j + 1] === '/') {
          depth--;
          j += 2;
        } else j++;
      }
      blank(j - i);
      i = j;
      continue;
    }

    // E'...' / e'...' — backslash escapes are active
    if ((c === 'E' || c === 'e') && next === "'") {
      let j = i + 2;
      while (j < n) {
        if (sql[j] === '\\') j += 2;
        else if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") {
          j++;
          break;
        } else j++;
      }
      blank(j - i);
      i = j;
      continue;
    }

    // '...' with '' escapes
    if (c === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") {
          j++;
          break;
        } else j++;
      }
      blank(j - i);
      i = j;
      continue;
    }

    // "..." quoted identifier with "" escapes
    if (c === '"') {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === '"' && sql[j + 1] === '"') j += 2;
        else if (sql[j] === '"') {
          j++;
          break;
        } else j++;
      }
      blank(j - i);
      i = j;
      continue;
    }

    // $tag$ ... $tag$ dollar quoting (tag may be empty: $$)
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const close = sql.indexOf(tag, i + tag.length);
        const stop = close === -1 ? n : close + tag.length;
        blank(stop - i);
        i = stop;
        continue;
      }
    }

    out.push(c);
    i++;
  }
  return out.join('');
}

/**
 * Keywords that must never appear in console SQL. Redundant with the read-only
 * transaction for writes, but still worth rejecting early — and it also covers
 * non-write dangers a read-only transaction happily permits (pg_read_file, pg_sleep,
 * pg_terminate_backend, SET ROLE ...).
 */
const DANGEROUS =
  /\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|DROP\s+|ALTER\s+|CREATE\s+|TRUNCATE\s+|GRANT\s+|REVOKE\s+|EXEC\s*\(|EXECUTE\s+|COPY\s+|pg_read_file|pg_write_file|lo_import|lo_export|pg_sleep|pg_terminate_backend|pg_cancel_backend|set\s+role|set\s+session)\b/i;

export function validateReadOnlyQuery(query: unknown): QueryGuardResult {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return { ok: false, reason: 'Query is required' };
  }

  const code = stripLiterals(query);

  // Must be a SELECT (or a CTE feeding one). Checked on the STRIPPED text so a
  // leading comment can't disguise the statement.
  const firstWord = code.trim().toLowerCase();
  if (!firstWord.startsWith('select') && !firstWord.startsWith('with')) {
    return { ok: false, reason: 'Only SELECT queries are allowed for security reasons' };
  }

  // Multiple statements. A trailing semicolon is fine; anything AFTER one is not.
  const semi = code.indexOf(';');
  if (semi !== -1 && code.slice(semi + 1).trim() !== '') {
    return { ok: false, reason: 'Multiple SQL statements are not allowed' };
  }

  if (DANGEROUS.test(code)) {
    return { ok: false, reason: 'Query contains disallowed SQL operations' };
  }

  // Append a LIMIT when the query has none (checked on stripped code so a LIMIT
  // mentioned inside a string doesn't count).
  const withoutTrailingSemi = semi === -1 ? query : query.slice(0, semi);
  const limitedQuery = /\blimit\b/i.test(code)
    ? withoutTrailingSemi
    : `${withoutTrailingSemi} LIMIT ${MAX_ROWS}`;

  return { ok: true, limitedQuery };
}
