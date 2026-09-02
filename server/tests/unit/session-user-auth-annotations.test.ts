/**
 * Every file that cannot authenticate anyone says so (SEC-SESSION-001).
 *
 * Twelve registered routers read `req.session.user` as their only source of
 * identity. Nothing assigns it - session login sets the flat req.session.userId
 * and the JWT path sets req.user - so each answers 401 in dev exactly as it does
 * in production, and has never run. The type augmentation makes them compile, so
 * tsc reports clean files and no test mounts them.
 *
 * The header on each file is the only thing standing between that and a future
 * reader concluding "Express serves this in dev", which has already happened
 * more than once. This test is what keeps the headers on.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** Source files only - a path named in a SECURITY.md is documentation. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'build') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx|js|jsx|swift|kt|java|vue)$/.test(entry)) out.push(full);
  }
  return out;
}
const baseline = JSON.parse(read('docs/session-user-auth-baseline.json'));

describe('the baselined files are annotated, not just listed', () => {
  it('every one names the story in its first 40 lines', () => {
    // A ratchet entry is a number; a header is what a reader finds when they
    // open the file wondering why the endpoint 401s.
    for (const file of baseline.files as string[]) {
      const head = read(file).split('\n').slice(0, 40).join('\n');
      expect(head, file).toMatch(/SEC-SESSION-001/);
    }
  });

  it('covers all eleven, with no file left implicit', () => {
    expect(baseline.files).toHaveLength(11);
    expect(baseline.totalReads).toBe(365);
  });
});

describe('the guard recognises a fallback written through a cast', () => {
  it('accepts (req as any).user, not only a bare req.user', () => {
    // mfa-enforcement.ts reads `(req as any).user || req.session?.user` - req.user
    // FIRST - so it was never a session-only file. The word-boundary pattern
    // could not see it because the cast sits between the two words.
    const guard = read('scripts/check-session-user-auth.mjs');
    expect(guard).toMatch(/\\\(req as \[\^\)\]\+\\\)\\\.user\\b/);
    expect(baseline.files).not.toContain('server/middleware/mfa-enforcement.ts');
  });

  it('does not claim mfa-enforcement is blocked by this story', () => {
    // Its header said mounting it would deny every request. It would not.
    const src = read('server/middleware/mfa-enforcement.ts');
    expect(src).toMatch(/CORRECTED 2026-09-01/);
    expect(src).toMatch(/Two separate things stop it/);
    // The two real blockers, both still true.
    expect(src).toMatch(/Nothing imports enforceMfaForAdmins/);
    expect(src).toMatch(/mfa_enrollments/);
  });
});

describe('the email-marketing router has no caller on any of its seven prefixes', () => {
  // These used to assert the header's exact wording - that /email-campaigns was
  // "the only one anything calls" and was proxied to
  // supabase/functions/email-campaigns/. Both went red the hour AUDIT-037 made
  // them false, which is the fourth time a test pinned to a description of
  // current debt has failed on its own story's success. They assert the fact
  // instead: nothing calls these prefixes, so the file's dead-ness does not
  // depend on how the header phrases it.
  const CLIENT_TREES = [
    'client/src',
    'printyx-client/src',
    'mobile-app',
    'mobile',
    'printyx-desktop',
    'browser-extensions',
    'printyx-extension',
    'ios',
  ];
  const PREFIXES = [
    'email-templates',
    'email-campaigns',
    'email-lists',
    'email-list-members',
    'email-sends',
    'email-events',
    'email-unsubscribes',
  ];

  it.each(PREFIXES)('nothing calls /api/%s', (prefix) => {
    // Stop at any character outside [a-z0-9-] so /api/email-list does not match
    // /api/email-list-members, and so a longer sibling cannot mask a real hit.
    const pattern = new RegExp(`/api/${prefix}(?![a-z0-9-])`);
    const hits: string[] = [];
    for (const tree of CLIENT_TREES) {
      const abs = join(repo, tree);
      if (!existsSync(abs)) continue;
      for (const file of sourceFiles(abs)) {
        // Comments first, then blocks. useEmailSequences.ts explains in prose
        // that it used to call /api/email-campaigns, and without this the test
        // reads that explanation as the caller it is asserting is gone - the
        // trap this repo keeps walking into.
        const src = readFileSync(file, 'utf8')
          .replace(/^\s*\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
        if (pattern.test(src)) hits.push(relative(repo, file));
      }
    }
    expect(hits).toEqual([]);
  });

  it('the canonical implementation serves all seven', () => {
    const index = read('supabase/functions/email-marketing/index.ts');
    for (const prefix of PREFIXES) expect(index).toContain(`case '${prefix}':`);
  });
});
