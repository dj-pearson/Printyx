/**
 * Who may read a meeting recording (SEC-EDGE-001).
 *
 * `meeting-transcription` filtered every read on `tenant_id` and nothing else,
 * so any authenticated member of the tenant could list every recording in the
 * company, fetch any transcript in full, read the AI notes and highlights, and
 * run `POST /content/search` - which `ilike`s across every transcript and hands
 * back a snippet around the match. A word in a search box returned what was
 * said in someone else's call.
 *
 * THE ACCESS MODEL WAS ALREADY IN THE SCHEMA. `meeting_recordings` declares
 * `uploaded_by NOT NULL`, `is_public DEFAULT false` and `access_permissions
 * DEFAULT '[]'`; no handler read any of the three, so a recording created
 * private behaved as public while the column said otherwise.
 *
 * The page is `alwaysVisible`, so the fix narrows ROWS rather than refusing the
 * request (COP-I06), and it lands on the item routes as well as the lists -
 * scoping a list and leaving `/:id` open is the half-measure COP-B04 recorded.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const fn = (p: string) => read(join('supabase/functions/meeting-transcription', p));

/** Comments blanked: these files explain the defect being asserted, and an
 *  absence check that matches its own explanation reports the fix as the bug. */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const ACCESS = strip(fn('_access.ts'));
const INDEX = strip(fn('index.ts'));
const RECORDINGS = strip(fn('handlers/recordings.ts'));
const TRANSCRIPTION = strip(fn('handlers/transcription.ts'));
const NOTES = strip(fn('handlers/notes.ts'));
const CONTENT = strip(fn('handlers/content.ts'));
const PAGE = read('client/src/pages/MeetingTranscription.tsx');
const DDL = read('drizzle/rls/meeting-transcription-tables.sql');

describe('the predicate matches the columns the table actually declares', () => {
  it('meeting_recordings carries the owner and share flag the filter uses', () => {
    // The whole fix rests on these existing. A phantom column here would be a
    // filter that never matches, which fails closed but for the wrong reason.
    const create = DDL.slice(
      DDL.indexOf('CREATE TABLE IF NOT EXISTS meeting_recordings'),
      DDL.indexOf('CREATE INDEX IF NOT EXISTS idx_meeting_recordings_meeting'),
    );
    expect(create).toContain('uploaded_by uuid NOT NULL');
    expect(create).toContain('is_public boolean DEFAULT false');
    expect(create).toContain("access_permissions jsonb DEFAULT '[]'");
  });

  it('visibility is owner-in-scope OR public, in ONE disjunction', () => {
    // Two .or() calls on a PostgREST query are ANDed, so the public clause
    // cannot be a second call - it has to sit inside the same or().
    const body = ACCESS.slice(ACCESS.indexOf('export function applyRecordingScope'));
    const fnBody = body.slice(0, body.indexOf('\n}'));
    expect(fnBody).toContain('uploaded_by.in.');
    expect(fnBody).toContain('is_public.is.true');
    expect(fnBody.match(/\.or\(/g) ?? []).toHaveLength(1);
  });

  it('a company-tier caller is not narrowed at all', () => {
    expect(ACCESS).toMatch(/if \(isUnscoped\(scope\)\) return query;/);
  });

  it('the resolver fails CLOSED when the database errors', () => {
    // An access resolver that answers "everything" during an outage turns the
    // outage into the exposure it exists to close.
    const resolver = ACCESS.slice(ACCESS.indexOf('export async function resolveRecordingAccess'));
    const errBranch = resolver.slice(
      resolver.indexOf('if (error)'),
      resolver.indexOf('const rows'),
    );
    expect(errBranch).toContain('recordingIds: []');
    expect(errBranch).toContain('meetingIds: []');
  });

  it('access_permissions is not filtered on, because nothing writes it', () => {
    // Honouring a read with no write would add a sharing control no UI can
    // grant. Stated in unbacked rather than half-built.
    expect(ACCESS).not.toContain('access_permissions.cs');
    expect(ACCESS).toMatch(/RECORDING_UNBACKED/);
  });
});

describe('the scope is resolved once and reaches every read', () => {
  it('the dispatcher resolves it and puts it on the context', () => {
    expect(INDEX).toContain('await resolveScope(db, {');
    expect(INDEX).toContain('appMetadata: auth.supabaseUser?.app_metadata');
    expect(INDEX).toMatch(/const ctx = \{ auth, db, scope,/);
  });

  it('both recording lists are narrowed', () => {
    // Bound to each query, not counted: a presence check passes while one of
    // the two is left open, which is this repo's most repeated assertion bug.
    const listCalls = [...RECORDINGS.matchAll(/\.from\('meeting_recordings'\)/g)];
    expect(listCalls.length).toBeGreaterThanOrEqual(2);
    const selects = [...RECORDINGS.matchAll(/recording_name, recording_format/g)];
    expect(selects).toHaveLength(2);
    for (const m of selects) {
      const before = RECORDINGS.slice(Math.max(0, (m.index ?? 0) - 400), m.index ?? 0);
      expect(before).toContain('applyRecordingScope(');
    }
  });

  it('every item route checks access BEFORE it looks the row up', () => {
    const cases: [string, string, string][] = [
      ['consent', RECORDINGS, "from('consent_records')"],
      ['process', RECORDINGS, 'return await processRecording('],
      ['transcription', TRANSCRIPTION, "from('meeting_transcriptions')"],
    ];
    for (const [name, src, lookup] of cases) {
      const check = src.indexOf('canAccessRecording(');
      const at = src.indexOf(lookup);
      expect({ name, checked: check > -1 }).toEqual({ name, checked: true });
      expect({ name, before: check < at }).toEqual({ name, before: true });
    }
  });

  it('notes and highlights are gated on the meeting, each on its own', () => {
    const guards = [...NOTES.matchAll(/canAccessMeeting\(/g)];
    expect(guards).toHaveLength(2);
    for (const table of ["from('meeting_notes')", "from('meeting_highlights')"]) {
      const at = NOTES.indexOf(table);
      expect({ table, found: at > -1 }).toEqual({ table, found: true });
      const before = NOTES.slice(0, at);
      expect({ table, guarded: before.includes('canAccessMeeting(') }).toEqual({
        table,
        guarded: true,
      });
    }
  });

  it('content search is narrowed to reachable recordings and short-circuits on none', () => {
    // An .in.() with no values is rejected by PostgREST, so an empty
    // accessible set has to answer rather than query.
    expect(CONTENT).toContain('await resolveRecordingAccess(db, auth, scope)');
    expect(CONTENT).toMatch(/access\.recordingIds !== null && access\.recordingIds\.length === 0/);
    expect(CONTENT).toMatch(/search\.in\('recording_id', access\.recordingIds\)/);
  });

  it('labelling a speaker needs the same access as reading the meeting', () => {
    const guard = CONTENT.indexOf('canAccessMeeting(');
    const write = CONTENT.indexOf("from('meeting_speakers')");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(write);
  });

  it('a caller who cannot reach a recording gets 404, never 403', () => {
    // Distinguishing "not yours" from "does not exist" confirms which ids are
    // real on someone else's calendar.
    for (const src of [RECORDINGS, TRANSCRIPTION]) {
      expect(src).toContain("code: 'NOT_FOUND'");
    }
    expect(RECORDINGS).not.toContain("code: 'FORBIDDEN'");
    expect(TRANSCRIPTION).not.toContain("code: 'FORBIDDEN'");
  });
});

describe('the narrowing reaches the screen', () => {
  it('the console list is an envelope carrying the scope note', () => {
    // Bound to the returned object, not the file: `describeRecordingScope` is
    // imported either way, and a file-wide check stays green when the spread
    // is dropped from what is actually sent.
    const at = RECORDINGS.indexOf('recordings: data ?? []');
    expect(at).toBeGreaterThan(-1);
    const payload = RECORDINGS.slice(at, at + 260);
    expect(payload).toContain('...describeScope(scope)');
    expect(payload).toContain('unbacked: RECORDING_UNBACKED');
  });

  it('the page reads the envelope keys the endpoint sends', () => {
    // PA-040: nothing else here compares the key names a page reads against
    // the ones its endpoint sends.
    for (const key of ['recordings', 'coversWholeTenant', 'scopeTier', 'scopeTruncated']) {
      expect({ key, read: PAGE.includes(key) }).toEqual({ key, read: true });
    }
    expect(PAGE).toContain('useQuery<RecordingsResponse>');
    expect(PAGE).toContain('data.recordings.map(');
  });

  it('the empty state still fires, now that the payload is not an array', () => {
    // QueryState's defaultIsEmpty only knows about arrays - without an explicit
    // isEmpty the "no recordings yet" copy would never render again.
    expect(PAGE).toMatch(/isEmpty=\{\(data\) => data\.recordings\.length === 0\}/);
  });

  it('a narrowed list says so, and a whole-tenant one stays quiet', () => {
    expect(PAGE).toMatch(/!data\.coversWholeTenant && \(/);
  });
});

describe('the verdict is recorded with the paths behind it', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json')) as {
    counts: Record<string, number>;
    triage: { fn: string; verdict: string; reason?: string; pathsRead?: string }[];
  };

  it('is filed row-scoped, not open-by-design', () => {
    const entry = triage.triage.find((e) => e.fn === 'meeting-transcription');
    expect(entry?.verdict).toBe('row-scoped');
    expect((entry?.pathsRead ?? '').length).toBeGreaterThan(60);
  });

  it('the counts block still matches the entries it summarises', () => {
    const actual: Record<string, number> = {};
    for (const e of triage.triage) actual[e.verdict] = (actual[e.verdict] ?? 0) + 1;
    expect(triage.counts).toEqual(actual);
    // Round 91 emptied the unexamined worklist by settling the last entry
    // (handoff-task-templates). The floor here used to be `> 0`, guarding
    // against clearing the list by GUESSING verdicts rather than reading the
    // handlers. That property does not depend on the list being non-empty, so
    // it is asserted once over every entry in
    // server/tests/unit/edge-rbac-triage-integrity.test.ts.
    expect(triage.counts.unexamined ?? 0).toBe(0);
  });
});
