/**
 * Deal narrative summary — the prompt, the bounds, and the staleness key (COP-B11).
 *
 * Pure. No network, no Supabase client, no clock: every function here takes
 * what it needs and returns a value, so the whole thing is unit-testable from
 * vitest even though it ships to Deno.
 *
 * Three rules it enforces, each of which is the reason a piece of it exists:
 *
 *  1. THE NARRATIVE IS WRITTEN FROM WHAT HAPPENED, NOT FROM THE DEAL RECORD.
 *     `hasEnoughHistory` refuses when there is no interaction history. A model
 *     handed six fields and no events will write plausible sales narration
 *     about a deal nobody has touched, and it reads exactly like a summary of
 *     real work. The panel says "nothing to summarise" instead.
 *
 *  2. COST AND LATENCY ARE BOUNDED AT THE PROMPT (AC6). The timeline is capped
 *     at MAX_TIMELINE_ENTRIES and each entry is truncated, so a deal with 900
 *     logged calls costs the same as one with 40.
 *
 *  3. STALENESS IS COMPUTED, NOT GUESSED. `buildDealFingerprint` hashes the
 *     fields a rep would expect a summary to reflect plus the timeline's own
 *     shape. A stored summary whose fingerprint still matches is current; one
 *     that disagrees is labelled out of date rather than silently re-generated
 *     or silently shown as fresh.
 */

/** Newest entries only. A narrative does not improve past this and the bill does. */
export const MAX_TIMELINE_ENTRIES = 40;

/** Per-entry cap. One pasted email thread must not become the whole prompt. */
export const MAX_ENTRY_CHARS = 400;

/** Below this there is nothing to narrate and the honest answer is to say so. */
export const MIN_TIMELINE_ENTRIES = 1;

export interface DealSummaryEntry {
  id?: string | null;
  type?: string | null;
  subject?: string | null;
  description?: string | null;
  outcome?: string | null;
  createdAt?: string | null;
}

export interface DealSummaryDeal {
  id?: string | null;
  title?: string | null;
  companyName?: string | null;
  amount?: number | string | null;
  stage?: string | null;
  status?: string | null;
  expectedCloseDate?: string | null;
  nextFollowUpDate?: string | null;
  lastActivityDate?: string | null;
  incumbentVendor?: string | null;
  forecastCategory?: string | null;
  leaseBuyoutExposure?: number | string | null;
  dealMotion?: string | null;
}

export function hasEnoughHistory(entries: DealSummaryEntry[]): boolean {
  return entries.length >= MIN_TIMELINE_ENTRIES;
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/** Newest first in, oldest first out: an LLM reads a story better in order. */
export function boundedTimeline(entries: DealSummaryEntry[]): DealSummaryEntry[] {
  return entries.slice(0, MAX_TIMELINE_ENTRIES).slice().reverse();
}

function formatEntry(entry: DealSummaryEntry): string {
  const when = entry.createdAt ? entry.createdAt.slice(0, 10) : 'undated';
  const kind = entry.type || 'note';
  const body = [entry.subject, entry.description, entry.outcome && `outcome: ${entry.outcome}`]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .join(' — ');
  return `- ${when} [${kind}] ${body ? truncate(body, MAX_ENTRY_CHARS) : '(no detail recorded)'}`;
}

function formatDealFacts(deal: DealSummaryDeal): string {
  const facts: string[] = [];
  if (deal.title) facts.push(`Deal: ${deal.title}`);
  if (deal.companyName) facts.push(`Account: ${deal.companyName}`);
  if (deal.amount != null && deal.amount !== '') facts.push(`Amount: ${deal.amount}`);
  if (deal.stage) facts.push(`Stage: ${deal.stage}`);
  if (deal.status) facts.push(`Status: ${deal.status}`);
  if (deal.dealMotion) facts.push(`Motion: ${deal.dealMotion}`);
  if (deal.forecastCategory) facts.push(`Forecast: ${deal.forecastCategory}`);
  if (deal.incumbentVendor) facts.push(`Incumbent vendor: ${deal.incumbentVendor}`);
  if (deal.leaseBuyoutExposure != null && deal.leaseBuyoutExposure !== '') {
    facts.push(`Lease buyout exposure: ${deal.leaseBuyoutExposure}`);
  }
  if (deal.expectedCloseDate) facts.push(`Expected close: ${deal.expectedCloseDate.slice(0, 10)}`);
  if (deal.nextFollowUpDate) facts.push(`Next step due: ${deal.nextFollowUpDate.slice(0, 10)}`);
  return facts.join('\n');
}

/**
 * The prompt. The instruction block is deliberately blunt about not inventing:
 * the failure this feature can produce is a confident paragraph about a
 * conversation that never happened, and a rep repeating it to a customer.
 */
export function buildDealSummaryPrompt(deal: DealSummaryDeal, entries: DealSummaryEntry[]): string {
  const timeline = boundedTimeline(entries).map(formatEntry).join('\n');
  const omitted = Math.max(0, entries.length - MAX_TIMELINE_ENTRIES);

  return [
    'You are summarising one B2B copier/MFP sales opportunity for the rep who owns it.',
    '',
    'Write 3 to 5 sentences of plain prose. No headings, no bullet points, no preamble.',
    'Cover: what has actually happened, where the deal stands, and what is unresolved.',
    '',
    'Rules you must not break:',
    '- Use ONLY the facts below. Do not infer a customer motivation, a budget, a',
    '  competitor or a decision that is not written here.',
    '- If the history is thin, say it is thin. Do not pad it.',
    '- Never state a next step that is not recorded. Say none is recorded instead.',
    '- No sales-coaching language and no recommendations. Describe, do not advise.',
    '',
    '## Deal record',
    formatDealFacts(deal) || '(no fields recorded)',
    '',
    `## Interaction history (${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}${
      omitted > 0 ? `, oldest ${omitted} omitted` : ''
    }, oldest first)`,
    timeline || '(none)',
  ].join('\n');
}

/**
 * FNV-1a, 32-bit, rendered hex. A cache key, not a security primitive: it has
 * to be stable across processes and cheap in Deno without a crypto await, and
 * the cost of a collision here is one stale summary label.
 */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * The fields a rep would expect a summary to reflect, plus the timeline's shape.
 *
 * Entry IDs rather than a count: an edited or deleted entry changes the story
 * without changing how many there are, and a count alone would call that
 * summary current.
 */
export function buildDealFingerprint(deal: DealSummaryDeal, entries: DealSummaryEntry[]): string {
  const material = [
    deal.title,
    deal.companyName,
    deal.amount,
    deal.stage,
    deal.status,
    deal.expectedCloseDate,
    deal.nextFollowUpDate,
    deal.incumbentVendor,
    deal.forecastCategory,
    deal.leaseBuyoutExposure,
    deal.dealMotion,
    ...boundedTimeline(entries).map(
      (e) => `${e.id ?? ''}:${e.createdAt ?? ''}:${truncate(e.description ?? '', 80)}`,
    ),
  ]
    .map((v) => (v == null ? '' : String(v)))
    .join('|');
  return hash(material);
}
