/**
 * Outreach AI logic — Deno port.
 *
 * Exports:
 *   - generateSequence(input)   : builds a 2-email / 3-LinkedIn sequence
 *   - generateDraft(input)      : builds a per-prospect draft
 *   - lintForSpam(text)         : basic spam-word scanner
 *
 * Ports server/services/outreach/outreach-ai-service.ts to Deno.
 * Uses _shared/anthropic.ts for Claude calls and local specialty-knowledge-packs.ts
 * for domain expertise injection.
 */

import { generateCompletion } from '../_shared/anthropic.ts';
import { createLogger } from '../_shared/logger.ts';
import {
  getPacksForSpecialties,
  SPECIALTY_PACKS,
  type SpecialtyKnowledgePack,
} from './specialty-knowledge-packs.ts';

const log = createLogger('outreach-ai');

// ==================== Row types (inline mirrors of shared schema) ====================
// Deno edge functions don't import shared/ at runtime. If you add schema columns
// that the AI prompt uses, add them here too.

export interface BusinessContextRow {
  icpSummary?: string | null;
  icpCompanySize?: string | null;
  icpIndustries?: string[] | null;
  icpGeographies?: string[] | null;
  icpBuyerTitles?: string[] | null;
  icpPainPoints?: string[] | null;
  icpTriggerSignals?: string[] | null;
  offerSummary?: string | null;
  offerOutcomes?: string[] | null;
  offerDifferentiators?: string[] | null;
  offerProof?: string[] | null;
  positioningStatement?: string | null;
  positioningObjections?: Array<{ objection: string; response: string }> | null;
  pastWins?: Array<{
    company: string;
    industry?: string;
    size?: string;
    howFound?: string;
    triggerToBuy?: string;
    outcome?: string;
  }> | null;
  additionalNotes?: string | null;
  id?: string;
}

export interface OutreachSequenceRow {
  id: string;
  angle?: string | null;
  name?: string;
}

export interface OutreachSequenceStepRow {
  id: string;
  subjectTemplate?: string | null;
  bodyTemplate: string;
}

export interface OutreachProspectRow {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  companyName?: string | null;
  companyWebsite?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  city?: string | null;
  state?: string | null;
  triggerSignal?: string | null;
}

// ==================== Inputs ====================

export interface BuildPromptInput {
  businessContext: BusinessContextRow | null;
  specialties: Array<{ specialty: string; weight: number }>;
  repNotes?: string;
}

export interface GenerateSequenceInput extends BuildPromptInput {
  angle: string;
  includeEmail: boolean;
  includeLinkedin: boolean;
  sequenceName?: string;
}

export interface GenerateDraftInput extends BuildPromptInput {
  sequence?: OutreachSequenceRow;
  step?: OutreachSequenceStepRow;
  prospect: OutreachProspectRow;
  channel: 'email' | 'linkedin_connect' | 'linkedin_message' | 'linkedin_inmail';
  variantCount?: number;
}

// ==================== Outputs ====================

export interface GeneratedSequenceStep {
  stepOrder: number;
  channel: 'email' | 'linkedin_connect' | 'linkedin_message' | 'linkedin_inmail';
  dayOffset: number;
  subjectTemplate?: string;
  bodyTemplate: string;
  variants: Array<{ subject?: string; body: string; rationale?: string }>;
  spamFlags: string[];
  rationale?: string;
}

export interface GeneratedSequence {
  name: string;
  description: string;
  steps: GeneratedSequenceStep[];
  targetSpecialty?: string;
}

export interface GeneratedDraft {
  subject?: string;
  body: string;
  variants: Array<{ subject?: string; body: string; rationale?: string }>;
  spamFlags: string[];
  recommendedVariantIndex: number;
}

// ==================== Spam Linter ====================

const SPAM_TRIGGERS = [
  'free',
  'guaranteed',
  'act now',
  'limited time',
  'urgent',
  'no cost',
  'risk-free',
  'click here',
  'buy now',
  'cash bonus',
  'discount',
  '100%',
  'winner',
  'congratulations',
  'this is not spam',
  'no obligation',
  'opportunity',
  'promise',
  'offer expires',
  '$$$',
  'earn money',
  'make money',
  'double your',
  'amazing',
  'unbelievable',
];

export function lintForSpam(text: string): string[] {
  const lower = text.toLowerCase();
  const hits = new Set<string>();
  for (const trigger of SPAM_TRIGGERS) {
    if (lower.includes(trigger)) hits.add(trigger);
  }
  const excl = (text.match(/!/g) || []).length;
  if (excl > 2) hits.add(`too many exclamation marks (${excl})`);
  if (/\b[A-Z]{3,}\b/.test(text)) {
    const allCaps = text.match(/\b[A-Z]{3,}\b/g) || [];
    if (allCaps.length > 0) hits.add(`all-caps words: ${allCaps.join(', ')}`);
  }
  return Array.from(hits);
}

// ==================== Prompt Builders ====================

function buildSpecialtyBlock(
  packs: Array<{ pack: SpecialtyKnowledgePack; normalizedWeight: number }>,
): string {
  if (packs.length === 0) {
    return 'SPECIALTY: Generic B2B sales — no vertical specialty configured.';
  }
  const primary = packs[0].pack;
  const secondaryBlend =
    packs.length > 1
      ? `\nSecondary specialties (${packs
          .slice(1)
          .map((p) => `${p.pack.displayName} ${Math.round(p.normalizedWeight * 100)}%`)
          .join(', ')}) — weave in relevant elements where natural.`
      : '';

  return `
SPECIALTY EXPERTISE (primary ${Math.round(packs[0].normalizedWeight * 100)}%): ${primary.displayName}
${primary.expertisePositioning}

Typical buyers: ${primary.commonBuyerTitles.join(', ')}
Avoid these titles (gatekeepers / irrelevant): ${primary.avoidTitles.join(', ')}

Common buyer pains (pick ONE per email that matches the angle):
${primary.commonPains.map((p) => `  - ${p}`).join('\n')}

Trigger signals that indicate buying intent:
${primary.triggerSignals.map((s) => `  - ${s}`).join('\n')}

Strongest value props (use ONE, not a list):
${primary.valueProps.map((v) => `  - ${v}`).join('\n')}

Objections to preempt (do NOT directly quote the objection in the email, but write copy that defuses it):
${primary.objectionBank.map((o) => `  - "${o.objection}" → ${o.reframe}`).join('\n')}

Industry jargon (use AT MOST ONE to signal credibility, never more):
${primary.industryJargon.join(', ')}

Hard rules for first touch:
${primary.avoidInFirstTouch.map((r) => `  - ${r}`).join('\n')}
${secondaryBlend}
`.trim();
}

function buildBusinessContextBlock(ctx: BusinessContextRow | null): string {
  if (!ctx) {
    return 'BUSINESS CONTEXT: Not configured — ask rep to complete /outreach/business-context.';
  }
  const lines: string[] = [];
  if (ctx.icpSummary) lines.push(`ICP summary: ${ctx.icpSummary}`);
  if (ctx.icpCompanySize) lines.push(`Company size: ${ctx.icpCompanySize}`);
  if (ctx.icpIndustries?.length) lines.push(`Industries: ${ctx.icpIndustries.join(', ')}`);
  if (ctx.icpGeographies?.length) lines.push(`Geographies: ${ctx.icpGeographies.join(', ')}`);
  if (ctx.icpBuyerTitles?.length) lines.push(`Target titles: ${ctx.icpBuyerTitles.join(', ')}`);
  if (ctx.icpPainPoints?.length) lines.push(`ICP pains: ${ctx.icpPainPoints.join('; ')}`);
  if (ctx.icpTriggerSignals?.length)
    lines.push(`Known triggers: ${ctx.icpTriggerSignals.join('; ')}`);
  if (ctx.offerSummary) lines.push(`Offer: ${ctx.offerSummary}`);
  if (ctx.offerOutcomes?.length) lines.push(`Outcomes we deliver: ${ctx.offerOutcomes.join('; ')}`);
  if (ctx.offerDifferentiators?.length)
    lines.push(`Differentiators: ${ctx.offerDifferentiators.join('; ')}`);
  if (ctx.offerProof?.length) lines.push(`Proof points: ${ctx.offerProof.join('; ')}`);
  if (ctx.positioningStatement) lines.push(`Positioning: ${ctx.positioningStatement}`);
  if (ctx.positioningObjections?.length) {
    lines.push('Common objections:');
    for (const obj of ctx.positioningObjections) {
      lines.push(`  - "${obj.objection}" → ${obj.response}`);
    }
  }
  if (ctx.pastWins?.length) {
    lines.push('Past wins (reference for credibility, do not name-drop in cold):');
    for (const win of ctx.pastWins.slice(0, 5)) {
      lines.push(
        `  - ${win.company} (${win.industry || 'industry unknown'}, ${win.size || 'size unknown'}): ${
          win.triggerToBuy || 'trigger unknown'
        } → ${win.outcome || 'outcome unknown'}`,
      );
    }
  }
  if (ctx.additionalNotes) lines.push(`Additional context: ${ctx.additionalNotes}`);
  return `BUSINESS CONTEXT:\n${lines.join('\n')}`;
}

function buildSystemPrompt(input: BuildPromptInput): string {
  const packs = getPacksForSpecialties(input.specialties);
  const specialtyBlock = buildSpecialtyBlock(packs);
  const contextBlock = buildBusinessContextBlock(input.businessContext);

  const voiceNotes = input.repNotes?.trim()
    ? `\n\nREP VOICE / STYLE NOTES:\n${input.repNotes.trim()}`
    : '';

  return `You are an elite B2B cold email and LinkedIn copywriter for the copier / print / managed-services industry. You write the copy. A human rep reviews and sends.

HARD RULES — follow without exception:
- Cold email bodies: UNDER 75 words. Every word earns its place.
- Subject lines: UNDER 4 words, no title-case marketing pitches.
- Write like a human peer, not a marketer. Lowercase subjects when natural.
- NEVER use these phrases: "I hope this email finds you well", "I wanted to reach out", "quick question", "just checking in", "circling back", "touch base", "leverage", "synergy", "solution", "empower", "ecosystem", "best-in-class", "cutting-edge".
- No exclamation marks unless quoting someone.
- No bullet lists in cold emails (OK in LinkedIn long-form only).
- Open with a reason tied to the prospect or the trigger signal — never with your product.
- One clear, specific CTA. NO "grab 15 min" — propose a specific time or a specific low-friction ask.
- Do not lie. If we do not know something, do not assume it.
- Never use em-dashes (—). Use regular hyphens or rephrase.

${specialtyBlock}

${contextBlock}${voiceNotes}

OUTPUT FORMAT: You must return ONLY valid JSON. No markdown fences, no commentary. Exactly the schema requested.`;
}

// ==================== Sequence Generation ====================

export async function generateSequence(input: GenerateSequenceInput): Promise<GeneratedSequence> {
  const system = buildSystemPrompt(input);

  const channels: string[] = [];
  if (input.includeEmail) channels.push('email');
  if (input.includeLinkedin) channels.push('linkedin');

  const userPrompt = `Create a cold outbound sequence targeting the angle: "${input.angle}".

Channels to include: ${channels.join(' + ')}

Sequence requirements:
${input.includeEmail ? '- 2 emails spaced 3-4 days apart. Second email is a reply to the first thread (no new subject).' : ''}
${input.includeLinkedin ? '- 3 LinkedIn touches, only for dream accounts: (1) connection request under 200 chars with no pitch, (2) value-only message day 3 post-accept, (3) soft pitch day 7 tied to the same angle.' : ''}
${input.includeEmail && input.includeLinkedin ? '- Email + LinkedIn voice must match so a prospect seeing both feels one human reached out.' : ''}

For each step, produce 3 variants. Use {{firstName}}, {{companyName}}, {{title}}, {{industry}}, {{triggerSignal}}, {{city}}, {{state}} as merge tokens where personalization makes sense.

Return JSON with this exact schema:
{
  "name": "short sequence name",
  "description": "one-line internal description",
  "targetSpecialty": "optional specialty key",
  "steps": [
    {
      "stepOrder": 1,
      "channel": "email" | "linkedin_connect" | "linkedin_message" | "linkedin_inmail",
      "dayOffset": 0,
      "subjectTemplate": "...",
      "bodyTemplate": "...",
      "variants": [
        { "subject": "...", "body": "...", "rationale": "why this version" },
        { "subject": "...", "body": "...", "rationale": "..." },
        { "subject": "...", "body": "...", "rationale": "..." }
      ],
      "rationale": "the thinking behind this step"
    }
  ]
}`;

  log.info({ angle: input.angle, channels }, 'generating_sequence');

  const raw = await generateCompletion({
    system,
    messages: [{ role: 'user', content: userPrompt }],
    temperature: 0.8,
    max_tokens: 4000,
  });

  const parsed = parseJsonResponse<GeneratedSequence>(raw);

  for (const step of parsed.steps) {
    const flags = lintForSpam(`${step.subjectTemplate || ''} ${step.bodyTemplate}`);
    step.spamFlags = flags;
  }

  return parsed;
}

// ==================== Draft Generation ====================

export async function generateDraft(input: GenerateDraftInput): Promise<GeneratedDraft> {
  const system = buildSystemPrompt(input);

  const p = input.prospect;
  const prospectBlock = [
    p.firstName && `First name: ${p.firstName}`,
    p.lastName && `Last name: ${p.lastName}`,
    p.title && `Title: ${p.title}`,
    p.companyName && `Company: ${p.companyName}`,
    p.industry && `Industry: ${p.industry}`,
    p.employeeCount && `Employees: ${p.employeeCount}`,
    p.city && `City: ${p.city}`,
    p.state && `State: ${p.state}`,
    p.companyWebsite && `Website: ${p.companyWebsite}`,
    p.linkedinUrl && `LinkedIn: ${p.linkedinUrl}`,
    p.triggerSignal && `Trigger signal: ${p.triggerSignal}`,
  ]
    .filter(Boolean)
    .join('\n');

  const channelRules: Record<GenerateDraftInput['channel'], string> = {
    email: 'Cold email. Under 75 words. Subject under 4 words.',
    linkedin_connect:
      'LinkedIn connection request. UNDER 200 characters. No pitch. Reference one specific thing.',
    linkedin_message: 'LinkedIn message post-accept. Value-only, no pitch. 2-3 sentences max.',
    linkedin_inmail:
      'LinkedIn InMail. 50-75 words. Can be slightly more direct than connect request.',
  };
  const channelRule = channelRules[input.channel];

  const templateBlock = input.step
    ? `\nBase this on the following sequence-step template, but personalize it to this specific prospect. Replace tokens and tighten language:
Subject template: ${input.step.subjectTemplate || '(none)'}
Body template: ${input.step.bodyTemplate}`
    : '';

  const angleBlock = input.sequence?.angle
    ? `\nAngle driving this sequence: ${input.sequence.angle}`
    : '';

  const variantCount = input.variantCount || 3;

  const userPrompt = `Write a personalized ${input.channel} for this specific prospect.

PROSPECT:
${prospectBlock || '(no details provided — keep copy generic but still high-quality)'}

CHANNEL: ${channelRule}${angleBlock}${templateBlock}

Produce ${variantCount} variants. Rank them — recommendedVariantIndex points to the strongest.

Return ONLY JSON:
{
  "subject": "strongest variant subject (or null for linkedin)",
  "body": "strongest variant body",
  "variants": [
    { "subject": "...", "body": "...", "rationale": "why this works" }
  ],
  "recommendedVariantIndex": 0
}`;

  log.info({ channel: input.channel, prospectId: p.id }, 'generating_draft');

  const raw = await generateCompletion({
    system,
    messages: [{ role: 'user', content: userPrompt }],
    temperature: 0.85,
    max_tokens: 2000,
  });

  const parsed = parseJsonResponse<GeneratedDraft>(raw);
  parsed.spamFlags = lintForSpam(`${parsed.subject || ''} ${parsed.body}`);
  return parsed;
}

// ==================== Helpers ====================

function parseJsonResponse<T>(raw: string): T {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const firstBrace = Math.min(
    ...['{', '['].map((c) => {
      const idx = cleaned.indexOf(c);
      return idx === -1 ? Infinity : idx;
    }),
  );
  if (Number.isFinite(firstBrace) && firstBrace > 0) {
    cleaned = cleaned.slice(firstBrace);
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch (_err) {
    log.error({ raw: raw.slice(0, 500) }, 'ai_invalid_json');
    throw new Error('AI returned invalid JSON. Try again or lower temperature.');
  }
}

export { SPECIALTY_PACKS };
