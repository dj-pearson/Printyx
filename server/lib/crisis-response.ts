/**
 * Crisis response for conversational AI surfaces (LEGAL-012).
 *
 * Nothing in this codebase handled a user disclosing self-harm, suicidal
 * intent, or an emergency. Today that is low risk: every conversational surface
 * is authenticated internal B2B, and the only unauthenticated endpoints are a
 * calculator, forms, booking, signup and auth plumbing. None of them talk back.
 *
 * It stops being low risk the day a chatbot is exposed to end customers or a
 * public widget ships, and that is a routing change, not a redesign. The point
 * of doing this now is that the guardrail exists before the exposure does,
 * rather than being remembered afterwards.
 *
 * Two layers, deliberately:
 *
 * 1. A DETERMINISTIC detector. A system-prompt instruction is a request to a
 *    model, and a prompt edit, a model swap or a long conversation can all erode
 *    it. The detector does not care: if the text matches, the caller can respond
 *    with resources without asking a model anything.
 *
 * 2. A SYSTEM-PROMPT directive, for everything the detector misses. Phrasing is
 *    endlessly various and a keyword list will always be behind it, so the model
 *    is told what to do as well.
 *
 * Neither layer is sufficient alone, which is why there are two.
 */

/**
 * US crisis resources. Deliberately specific: "seek help" is not a response,
 * it is a way of appearing to respond.
 *
 * If Printyx ever serves users outside the US, this needs a locale-aware
 * equivalent rather than a US number shown to someone in another country. That
 * is noted in docs/ai-surface-exposure-policy.md as a prerequisite for any
 * non-US public exposure.
 */
export const CRISIS_RESOURCES_US = [
  '988 Suicide & Crisis Lifeline: call or text 988 (24/7, free, confidential)',
  'Crisis Text Line: text HOME to 741741',
  'Emergency services: 911 if someone is in immediate danger',
];

/**
 * Phrases that should trigger a crisis response.
 *
 * Kept narrow on purpose. A detector that fires on "this deadline is killing
 * me" trains people to ignore it, and an ignored safety response is worse than
 * none because it looks like coverage. Ambiguous phrasing is left to the model
 * directive instead.
 */
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

/**
 * The response, when the detector fires.
 *
 * Does not continue the product conversation. Someone disclosing this does not
 * need their meter-billing question answered in the same breath, and answering
 * it signals that the disclosure was processed as noise.
 */
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

/**
 * Safety directive appended to conversational system prompts.
 *
 * Written as an instruction about what to do rather than a topic ban, because a
 * refusal is not a safe response either: someone who discloses distress and gets
 * "I cannot discuss that" has been shut out at the worst possible moment.
 */
export const CRISIS_SYSTEM_DIRECTIVE = `
SAFETY: If the user expresses thoughts of suicide, self-harm, or being in danger, stop the task you were doing and respond to that first. Acknowledge it briefly and without judgement, and give these resources: 988 Suicide & Crisis Lifeline (call or text 988), Crisis Text Line (text HOME to 741741), and 911 if anyone is in immediate danger. Do not continue with product, sales or support content in the same reply. Do not refuse the conversation or tell the user you cannot discuss it - being shut out is not a safe response. If the user mentions a medical or safety emergency, direct them to emergency services first.
`.trim();

/**
 * Attach the safety directive to a system prompt.
 *
 * Idempotent, so a prompt built in layers does not end up carrying it twice.
 */
export function withCrisisGuardrail(systemPrompt: string): string {
  const base = String(systemPrompt ?? '');
  if (base.includes('988 Suicide & Crisis Lifeline')) return base;
  return `${base}\n\n${CRISIS_SYSTEM_DIRECTIVE}`;
}
