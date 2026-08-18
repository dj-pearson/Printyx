/**
 * Unit Tests: supabase/functions/meeting-transcription/_consent.ts (LEGAL-009)
 *
 * The platform recorded and stored conversations with no consent step anywhere.
 * Eleven US states require every party to agree; California's CIPA carries
 * $5,000 statutory damages per violation and the claim belongs to the person
 * recorded, not to the customer who bought the software.
 *
 * No software can verify that someone actually agreed. What these tests pin down
 * is that the system REFUSES to record unless the caller states, on the record,
 * how consent was obtained and from whom - and that a failure to write that
 * evidence fails closed rather than recording anyway.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RECORDING_NOTICE,
  recordRecordingConsent,
  validateConsentAssertion,
  type ConsentDb,
} from '../../../supabase/functions/meeting-transcription/_consent';

/** Stand-in for the multipart form the upload handler parses. */
function form(fields: Record<string, string>) {
  return { get: (name: string) => (name in fields ? fields[name] : null) };
}

const VALID = {
  consentConfirmed: 'true',
  consentMethod: 'verbal',
  consentParticipants: 'Dana Reeves, Sam Okonjo',
};

describe('validateConsentAssertion', () => {
  it('accepts a complete assertion', () => {
    const result = validateConsentAssertion(form(VALID));
    expect(result.ok).toBe(true);
    expect(result.assertion?.method).toBe('verbal');
    expect(result.assertion?.participants).toEqual(['Dana Reeves', 'Sam Okonjo']);
  });

  it('refuses when consent is not confirmed', () => {
    const result = validateConsentAssertion(form({ ...VALID, consentConfirmed: 'false' }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('consentConfirmed');
  });

  it('refuses when the consent fields are absent entirely', () => {
    // The pre-LEGAL-009 request shape: a file and a meeting id, nothing else.
    const result = validateConsentAssertion(form({}));
    expect(result.ok).toBe(false);
  });

  it('refuses a method it does not recognize', () => {
    const result = validateConsentAssertion(form({ ...VALID, consentMethod: 'assumed' }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('consentMethod');
  });

  it('refuses when nobody is named, because that evidences nothing', () => {
    const result = validateConsentAssertion(form({ ...VALID, consentParticipants: '   ' }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('at least one person');
  });

  it('splits participants on commas, semicolons and newlines', () => {
    const result = validateConsentAssertion(form({ ...VALID, consentParticipants: 'A, B; C\nD' }));
    expect(result.assertion?.participants).toEqual(['A', 'B', 'C', 'D']);
  });

  it('falls back to the default notice when the caller supplies none', () => {
    const result = validateConsentAssertion(form(VALID));
    expect(result.assertion?.noticeText).toBe(DEFAULT_RECORDING_NOTICE);
  });

  it('keeps the caller-supplied notice, which is what participants actually heard', () => {
    const custom = 'Heads up, I am recording this call for our notes.';
    const result = validateConsentAssertion(form({ ...VALID, consentNoticeText: custom }));
    expect(result.assertion?.noticeText).toBe(custom);
  });

  it('accepts every documented method', () => {
    for (const method of ['verbal', 'written', 'checkbox', 'in_meeting_announcement']) {
      expect(validateConsentAssertion(form({ ...VALID, consentMethod: method })).ok).toBe(true);
    }
  });
});

function fakeDb(opts: { fail?: string } = {}) {
  const inserted: Record<string, unknown>[] = [];
  const db: ConsentDb = {
    from() {
      return {
        insert(values: Record<string, unknown>) {
          inserted.push(values);
          return {
            select() {
              return {
                async single() {
                  if (opts.fail) return { data: null, error: { message: opts.fail } };
                  return { data: { id: 'consent-1' }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return { db, inserted };
}

describe('recordRecordingConsent', () => {
  const input = {
    tenantId: 't1',
    userId: 'u1',
    recordingId: 'rec-1',
    meetingId: 'meet-1',
    assertion: {
      method: 'verbal' as const,
      participants: ['Dana Reeves'],
      noticeText: DEFAULT_RECORDING_NOTICE,
    },
    ipAddress: '203.0.113.9',
    userAgent: 'test-agent',
  };

  it('writes a consent record tied to the recording by proof_reference', async () => {
    const { db, inserted } = fakeDb();
    const result = await recordRecordingConsent(db, input);

    expect(result.ok).toBe(true);
    expect(result.consentRecordId).toBe('consent-1');

    const row = inserted[0];
    expect(row.consent_type).toBe('recording');
    expect(row.status).toBe('given');
    expect(row.legal_basis).toBe('consent');
    // This is how a recording finds its consent later, since meeting_recordings
    // is a drift table nothing else can safely be added to.
    expect(row.proof_reference).toBe('rec-1');
    expect(row.given_at).toBeTruthy();
    expect(row.created_by).toBe('u1');
    expect(row.proof_type).toBe('verbal');
    expect(String(row.notes)).toContain('Dana Reeves');
  });

  it('records the actual notice text, so a dispute can be answered with wording', async () => {
    const { db, inserted } = fakeDb();
    await recordRecordingConsent(db, input);
    expect(inserted[0].consent_text).toBe(DEFAULT_RECORDING_NOTICE);
  });

  it('captures ip and user agent as contemporaneous evidence', async () => {
    const { db, inserted } = fakeDb();
    await recordRecordingConsent(db, input);
    expect(inserted[0].ip_address).toBe('203.0.113.9');
    expect(inserted[0].user_agent).toBe('test-agent');
  });

  it('maps a checkbox method to a web_form source and verbal to in_person', async () => {
    const { db, inserted } = fakeDb();
    await recordRecordingConsent(db, {
      ...input,
      assertion: { ...input.assertion, method: 'checkbox' },
    });
    expect(inserted[0].source).toBe('web_form');

    const second = fakeDb();
    await recordRecordingConsent(second.db, input);
    expect(second.inserted[0].source).toBe('in_person');
  });

  it('reports failure rather than throwing, so the caller can refuse the upload', async () => {
    const { db } = fakeDb({ fail: 'invalid input value for enum consent_type' });
    const result = await recordRecordingConsent(db, input);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('enum consent_type');
  });
});
