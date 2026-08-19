// Pure logic for sales-rep email autopilot (US-SUPER-016 / PROD-012).
//
// KEEP IN SYNC with server/routes-email-autopilot.ts. These decide whether an
// inbound email gets a drafted reply at all, and how much the rep changed the
// draft — the edit-distance feeds avgEditDistancePct and toneMissRate, which is
// how a rep judges whether the autopilot is worth using. A drift would classify
// differently on each backend, or report a different quality score for the same
// edit.
//
// Locked by server/tests/unit/email-autopilot-logic-parity.test.ts.

export type EmailClassification = 'needs_reply' | 'fyi' | 'spam';

export interface InboxEmail {
  from: string;
  subject: string;
  snippet: string;
}

export interface Classification {
  classification: EmailClassification;
  confidence: number;
  source: 'ai' | 'fallback';
}

export interface VoiceFingerprint {
  signature?: string | null;
  [k: string]: unknown;
}

export interface DraftedReply {
  subject: string;
  body: string;
  source: 'ai' | 'fallback';
}

/** editDistancePct above this counts as a "tone-miss". */
export const TONE_MISS_THRESHOLD = 50;

export const SPAM_KEYWORDS = [
  'congratulations',
  'free prize',
  'act now',
  'click here',
  'unsubscribe offer',
];

export const FYI_KEYWORDS = [
  'fyi',
  'no action needed',
  'newsletter',
  'report is ready',
  'do not reply',
];

/** Deterministic keyword classification, used whenever Claude is unavailable. */
export function fallbackClassify(email: InboxEmail): Classification {
  const hay = `${email.subject} ${email.snippet} ${email.from}`.toLowerCase();
  if (SPAM_KEYWORDS.some((k) => hay.includes(k))) {
    return { classification: 'spam', confidence: 0.6, source: 'fallback' };
  }
  if (FYI_KEYWORDS.some((k) => hay.includes(k))) {
    return { classification: 'fyi', confidence: 0.6, source: 'fallback' };
  }
  return { classification: 'needs_reply', confidence: 0.55, source: 'fallback' };
}

/** Deterministic templated reply, used whenever Claude is unavailable. */
export function fallbackDraft(
  email: InboxEmail,
  fingerprint: VoiceFingerprint,
  crmContext: string | null,
): DraftedReply {
  const subject = email.subject.toLowerCase().startsWith('re:')
    ? email.subject
    : `Re: ${email.subject}`;
  const sig = fingerprint.signature ?? 'Best regards';
  const ctx = crmContext ? `\n\n(For context on our account: ${crmContext})` : '';
  const body =
    `Hi,\n\n` +
    `Thanks for reaching out about "${email.subject}". ` +
    `I've reviewed your note and will follow up shortly with the details you asked for.${ctx}\n\n` +
    `Please let me know if there's anything else I can help with in the meantime.\n\n` +
    `${sig}`;
  return { subject, body, source: 'fallback' };
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Levenshtein-based percentage (0..100) of how much the rep changed the draft. */
export function editDistancePct(a: string, b: string): number {
  const original = a ?? '';
  const edited = b ?? '';
  const denom = Math.max(original.length, edited.length);
  if (denom === 0) return 0;
  const dist = levenshtein(original, edited);
  return Math.round((dist / denom) * 1000) / 10;
}
