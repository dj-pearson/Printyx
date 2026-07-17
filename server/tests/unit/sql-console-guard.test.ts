/**
 * AUDIT-003 — root-admin SQL console guard.
 *
 * The AC asks for "a test that a query with a dollar-quoted or escaped-quote payload
 * cannot execute a second statement or a write".
 *
 * Two layers are involved and it matters which is which:
 *   1. Postgres `SET TRANSACTION READ ONLY` — the real boundary. A write raises
 *      SQLSTATE 25006 in the engine. That cannot be unit-tested here (no DB is
 *      reachable from this environment), and it does not depend on parsing at all,
 *      which is the entire point of the change.
 *   2. This static guard — defence-in-depth + readable errors. It IS parsing, so it
 *      is exactly what needs the adversarial tests below.
 *
 * The payloads here are the ones the old `.replace(/'[^']*'/g,'')` could not lex:
 * '' escapes, E'\'' backslash escapes, and $$ / $tag$ dollar quoting.
 */
import { describe, it, expect } from 'vitest';
import { stripLiterals, validateReadOnlyQuery } from '../../lib/sql-console-guard';

const ok = (q: string) => validateReadOnlyQuery(q).ok;
const reason = (q: string) => validateReadOnlyQuery(q).reason;

describe('AUDIT-003: stripLiterals lexes like Postgres', () => {
  it('preserves length so offsets stay meaningful', () => {
    const q = "SELECT 'abc' FROM t";
    expect(stripLiterals(q)).toHaveLength(q.length);
  });

  it("handles '' escapes without re-pairing the quotes", () => {
    // ONE literal: a'; SELECT 1; --   The old regex re-paired these quotes and
    // produced a different idea of where the string ended.
    const stripped = stripLiterals("SELECT 'a''; SELECT 1; --'");
    expect(stripped).not.toContain(';'); // the semicolons are DATA, correctly blanked
    expect(stripped.trim()).toBe('SELECT');
  });

  it('handles $$ dollar quoting (invisible to the old regex)', () => {
    const stripped = stripLiterals('SELECT $$; DROP TABLE users; $$');
    expect(stripped).not.toContain(';');
    expect(stripped).not.toMatch(/DROP/i);
  });

  it('handles $tag$ dollar quoting', () => {
    const stripped = stripLiterals('SELECT $x$ ; DELETE FROM users $x$ FROM t');
    expect(stripped).not.toContain(';');
    expect(stripped).toContain('FROM t'); // code outside the literal survives
  });

  it("handles E'' strings with backslash escapes", () => {
    const stripped = stripLiterals("SELECT E'a\\'; DROP TABLE t; ' FROM x");
    expect(stripped).not.toContain(';');
    expect(stripped).toContain('FROM x');
  });

  it('blanks line and block comments (incl. nested block comments)', () => {
    expect(stripLiterals('SELECT 1 -- ; DROP TABLE t')).not.toContain(';');
    expect(stripLiterals('SELECT /* ; DROP */ 1')).not.toContain(';');
    expect(stripLiterals('SELECT /* a /* ; */ ; */ 1')).not.toContain(';');
  });

  it('leaves real code alone', () => {
    expect(stripLiterals('SELECT a, b FROM t WHERE x = 1').trim()).toBe(
      'SELECT a, b FROM t WHERE x = 1',
    );
  });
});

describe('AUDIT-003: a second statement cannot slip past', () => {
  it('blocks a plain piggybacked statement', () => {
    expect(ok('SELECT 1; DROP TABLE users')).toBe(false);
    expect(reason('SELECT 1; DROP TABLE users')).toMatch(/Multiple SQL statements/);
  });

  it('blocks a second statement hidden after a dollar-quoted literal', () => {
    // The literal is legitimate; the DANGER is the statement AFTER it.
    expect(ok('SELECT $$x$$; DROP TABLE users')).toBe(false);
  });

  it('blocks a second statement after an escaped-quote literal', () => {
    expect(ok("SELECT 'it''s'; DELETE FROM users")).toBe(false);
  });

  it('blocks a second statement after an E-string', () => {
    expect(ok("SELECT E'a\\''; UPDATE users SET x = 1")).toBe(false);
  });

  it('blocks a statement hidden behind a comment-terminated line', () => {
    expect(ok('SELECT 1 --\n; DROP TABLE users')).toBe(false);
  });

  it('allows a single trailing semicolon (not a second statement)', () => {
    expect(ok('SELECT 1;')).toBe(true);
  });

  it('does NOT false-block semicolons that are genuinely data', () => {
    // The old regex left dollar-quoted semicolons visible and over-blocked these.
    expect(ok("SELECT 'a;b' FROM t")).toBe(true);
    expect(ok('SELECT $$a;b$$ FROM t')).toBe(true);
    expect(ok("SELECT 'it''s; fine' FROM t")).toBe(true);
  });
});

describe('AUDIT-003: writes and non-SELECT are rejected', () => {
  it.each([
    'INSERT INTO users (id) VALUES (1)',
    'UPDATE users SET x = 1',
    'DELETE FROM users',
    'DROP TABLE users',
    'ALTER TABLE users ADD COLUMN x int',
    'TRUNCATE users',
    'CREATE TABLE x (id int)',
    'GRANT ALL ON users TO public',
  ])('rejects %s', (q) => {
    expect(ok(q)).toBe(false);
  });

  it('rejects a write disguised by a leading comment', () => {
    expect(ok('/* SELECT */ DROP TABLE users')).toBe(false);
  });

  it('rejects dangerous non-write functions a read-only txn would still allow', () => {
    // SET TRANSACTION READ ONLY does NOT stop these, so the denylist earns its keep.
    expect(ok("SELECT pg_read_file('/etc/passwd')")).toBe(false);
    expect(ok('SELECT pg_sleep(60)')).toBe(false);
    expect(ok('SELECT pg_terminate_backend(1)')).toBe(false);
    expect(ok('SELECT 1; SET ROLE postgres')).toBe(false);
  });

  it('rejects empty / non-string input', () => {
    expect(ok('')).toBe(false);
    expect(validateReadOnlyQuery(null).ok).toBe(false);
    expect(validateReadOnlyQuery(42 as unknown as string).ok).toBe(false);
  });
});

describe('AUDIT-003: SELECT/CTE allowed, row cap applied', () => {
  it('allows a plain SELECT and appends a LIMIT', () => {
    const r = validateReadOnlyQuery('SELECT * FROM users');
    expect(r.ok).toBe(true);
    expect(r.limitedQuery).toBe('SELECT * FROM users LIMIT 1000');
  });

  it('allows a WITH (CTE) query', () => {
    expect(ok('WITH x AS (SELECT 1) SELECT * FROM x')).toBe(true);
  });

  it('does not double-append when a LIMIT is present', () => {
    const r = validateReadOnlyQuery('SELECT * FROM users LIMIT 5');
    expect(r.limitedQuery).toBe('SELECT * FROM users LIMIT 5');
  });

  it('appends a LIMIT when "limit" only appears inside a string', () => {
    const r = validateReadOnlyQuery("SELECT 'limit' FROM t");
    expect(r.limitedQuery).toBe("SELECT 'limit' FROM t LIMIT 1000");
  });

  it('strips a trailing semicolon before appending LIMIT (else invalid SQL)', () => {
    const r = validateReadOnlyQuery('SELECT * FROM users;');
    expect(r.limitedQuery).toBe('SELECT * FROM users LIMIT 1000');
  });
});
