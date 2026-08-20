/**
 * Crisis response for conversational AI surfaces (LEGAL-012) - Deno copy.
 *
 * Byte-for-byte mirror of server/lib/crisis-response.ts. The Node original is
 * the source of truth for the wording; this copy exists because edge functions
 * cannot import from server/. server/tests/unit/gpt5-prompts-parity.test.ts
 * imports BOTH and fails the moment they drift, so a change to the resources,
 * the detector patterns or the directive has to land in both files.
 *
 * See the Node file for why there are two layers (a deterministic detector and
 * a system-prompt directive) rather than one.
 */

export const CRISIS_RESOURCES_US = [
  '988 Suicide & Crisis Lifeline: call or text 988 (24/7, free, confidential)',
  'Crisis Text Line: text HOME to 741741',
  'Emergency services: 911 if someone is in immediate danger',
];

const CRISIS_PATTERNS: RegExp[] = [
  /\bkill(ing)?\s+my\s?self\b/i,
  /\bkms\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend\s+(my|it)\s+(life|all)\b/i,
  /\btake\s+my\s+own\s+life\b/i,
  /\bdon'?t\s+want\s+to\s+(be\s+alive|live)\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bharm(ing)?\s+my\s?self\b/i,
  /\bhurt(ing)?\s+my\s?self\b/i,
  /\bself[-\s]?harm\b/i,
  /\bno\s+reason\s+to\s+(live|go\s+on)\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
];

/** Does this message need a crisis response regardless of what a model would say? */
export function detectsCrisis(message: string): boolean {
  const text = String(message ?? '');
  if (!text.trim()) return false;
  return CRISIS_PATTERNS.some((p) => p.test(text));
}

export function crisisResponse(): string {
  return [
    'It sounds like you might be going through something serious, and that matters more than anything I can help with here.',
    '',
    'Please reach out to someone who can help right now:',
    ...CRISIS_RESOURCES_US.map((r) => `- ${r}`),
    '',
    'If you would rather talk to a person you know, calling someone you trust counts too.',
  ].join('\n');
}

export const CRISIS_SYSTEM_DIRECTIVE = `
SAFETY: If the user expresses thoughts of suicide, self-harm, or being in danger, stop the task you were doing and respond to that first. Acknowledge it briefly and without judgement, and give these resources: 988 Suicide & Crisis Lifeline (call or text 988), Crisis Text Line (text HOME to 741741), and 911 if anyone is in immediate danger. Do not continue with product, sales or support content in the same reply. Do not refuse the conversation or tell the user you cannot discuss it - being shut out is not a safe response. If the user mentions a medical or safety emergency, direct them to emergency services first.
`.trim();

/** Attach the safety directive to a system prompt. Idempotent. */
export function withCrisisGuardrail(systemPrompt: string): string {
  const base = String(systemPrompt ?? '');
  if (base.includes('988 Suicide & Crisis Lifeline')) return base;
  return `${base}\n\n${CRISIS_SYSTEM_DIRECTIVE}`;
}
