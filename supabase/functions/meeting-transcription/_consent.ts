// Recording consent (LEGAL-009).
//
// Eleven US states require every party to a conversation to agree before it is
// recorded. California's CIPA (Penal Code 632) carries $5,000 statutory damages
// per violation, and the claim belongs to the person who was recorded, not to
// the customer who bought the software. This platform recorded and stored audio
// with no consent step anywhere in the flow.
//
// Consent goes into the existing `consent_records` ledger rather than a table of
// its own, so withdrawal, subject-access export and erasure keep working through
// paths that already exist. A recording is tied to its consent by
// `proof_reference`, which holds the recording id: `meeting_recordings` is a
// drift table present in no Drizzle schema, and bolting a column onto it would
// put the evidence somewhere nothing else knows how to look.
//
// FAILS CLOSED. If the consent row cannot be written, the recording does not
// happen. The alternative is keeping audio of a conversation with nothing to
// show that anyone agreed to it, which is the exact position this story exists
// to get out of.

export type ConsentMethod = 'verbal' | 'written' | 'checkbox' | 'in_meeting_announcement';

const VALID_METHODS: ConsentMethod[] = ['verbal', 'written', 'checkbox', 'in_meeting_announcement'];

export interface ConsentAssertion {
  method: ConsentMethod;
  /** Free-text list of who agreed, as captured by the caller. */
  participants: string[];
  /** The wording the participants were actually given. */
  noticeText: string;
}

export interface ConsentValidationResult {
  ok: boolean;
  error?: string;
  assertion?: ConsentAssertion;
}

/** The notice a caller is expected to have given, when it supplies none of its own. */
export const DEFAULT_RECORDING_NOTICE =
  'This meeting is being recorded and transcribed. The recording and its transcript ' +
  'are stored by Printyx on behalf of the organizing company. Tell the host now if ' +
  'you do not agree to be recorded.';

/**
 * Validate what the caller claims about consent.
 *
 * This cannot verify that anyone actually agreed - no software can. What it can
 * do is refuse to record unless the caller states, on the record, how consent
 * was obtained and from whom, so there is contemporaneous evidence rather than a
 * reconstruction months later during a dispute.
 */
export function validateConsentAssertion(form: {
  get(name: string): unknown;
}): ConsentValidationResult {
  const confirmed = String(form.get('consentConfirmed') ?? '').toLowerCase();
  if (confirmed !== 'true') {
    return {
      ok: false,
      error:
        'consentConfirmed must be "true". Every party to a recorded conversation must agree ' +
        'before recording starts; several US states make it a criminal matter and give the ' +
        'recorded person a private right of action.',
    };
  }

  const method = String(form.get('consentMethod') ?? '').trim() as ConsentMethod;
  if (!VALID_METHODS.includes(method)) {
    return {
      ok: false,
      error: `consentMethod must be one of: ${VALID_METHODS.join(', ')}.`,
    };
  }

  const rawParticipants = String(form.get('consentParticipants') ?? '').trim();
  const participants = rawParticipants
    .split(/[\n,;]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (participants.length === 0) {
    return {
      ok: false,
      error:
        'consentParticipants must name at least one person who agreed. A recording with no ' +
        'identified consenting party is evidence of nothing.',
    };
  }

  const noticeText = String(form.get('consentNoticeText') ?? '').trim() || DEFAULT_RECORDING_NOTICE;

  return { ok: true, assertion: { method, participants, noticeText } };
}

/** Minimal client surface, so this is testable without a live Supabase. */
export interface ConsentDb {
  from(table: string): {
    insert(values: Record<string, unknown>): {
      select(columns: string): {
        single(): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
  };
}

export interface RecordConsentInput {
  tenantId: string;
  userId: string;
  recordingId: string;
  meetingId: string;
  assertion: ConsentAssertion;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface RecordConsentResult {
  ok: boolean;
  consentRecordId?: string;
  error?: string;
}

/**
 * Persist the consent. Returns a failure rather than throwing so the caller can
 * refuse the upload and say why.
 */
export async function recordRecordingConsent(
  db: ConsentDb,
  input: RecordConsentInput,
): Promise<RecordConsentResult> {
  const now = new Date().toISOString();

  try {
    const { data, error } = await db
      .from('consent_records')
      .insert({
        tenant_id: input.tenantId,
        // The actor attesting to consent is the person doing the recording.
        // Individual participants are named in processing metadata below;
        // consent_records.subject_id is a uuid and meeting attendees generally
        // have no account here.
        subject_type: 'user',
        subject_id: input.userId,
        consent_type: 'recording',
        status: 'given',
        legal_basis: 'consent',
        source: input.assertion.method === 'checkbox' ? 'web_form' : 'in_person',
        source_details: `meeting:${input.meetingId}`,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        proof_type: input.assertion.method,
        // How a recording finds its consent. See the header for why it is here
        // rather than a column on meeting_recordings.
        proof_reference: input.recordingId,
        consent_text: input.assertion.noticeText,
        processing_purposes: ['meeting_recording', 'transcription', 'ai_analysis'],
        data_categories: ['audio_recording', 'transcript', 'participant_names'],
        given_at: now,
        notes: `Participants who agreed: ${input.assertion.participants.join(', ')}`,
        created_by: input.userId,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? 'consent record insert returned no row' };
    }
    return { ok: true, consentRecordId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
