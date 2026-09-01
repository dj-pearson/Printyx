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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
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

describe('the email-marketing header records what was actually checked', () => {
  const src = read('server/routes/email-marketing-routes.ts');

  it('names the one prefix with a caller, and where it is really served', () => {
    expect(src).toMatch(/email-campaigns is the only one anything calls/);
    expect(src).toMatch(/supabase\/functions\/email-campaigns\//);
  });

  it('says the other six have no caller in any client tree', () => {
    // The shadowed-express baseline called retiring this a per-prefix job on
    // uneven edge coverage. That is true and this narrows it: with no caller,
    // the question is whether anyone wants the feature, not how to port it.
    // Flattened: the sentence wraps across comment lines.
    const flat = src.replace(/\s*\n\s*\*\s*/g, ' ');
    expect(flat).toMatch(/have NO caller in any client tree/);
  });
});
