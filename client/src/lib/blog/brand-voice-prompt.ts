/**
 * Brand Voice → System-Prompt Fragment (US-BLOG-004)
 *
 * Serializes a `blog_brand_voices` row into the text fragment that gets
 * concatenated into every AI-step system prompt (draft generator, rewrite
 * toolbar, fact-checker, critique loop, auto-refresh agent, etc.).
 *
 * Lives under `client/src/lib/blog/` so the admin form can show a live
 * preview without round-tripping to the server. The same logic must be
 * mirrored on the edge-function side once the AI steps land — recommend
 * extracting to a shared file under `supabase/functions/_shared/blog/`
 * at that point and importing from both surfaces.
 */

export interface BrandVoiceLike {
  name?: string | null;
  tone?: string | null;
  banned_phrases?: string[] | null;
  preferred_phrases?: string[] | null;
  reading_level_target?: string | null;
  persona_description?: string | null;
  sample_corpus?: string | null;
  pov?: string | null;
  voice_attributes?: Record<string, unknown> | null;
}

const POV_LABELS: Record<string, string> = {
  first: 'first person ("we", "I")',
  second: 'second person ("you")',
  third: 'third person ("they", "the company")',
};

const READING_LEVEL_LABELS: Record<string, string> = {
  'grade-6': 'a sixth-grade reading level (very accessible)',
  'grade-8': 'an eighth-grade reading level (accessible)',
  'grade-10': 'a tenth-grade reading level (general adult)',
  'grade-12': 'a twelfth-grade reading level (informed adult)',
  'grade-14': 'a fourteenth-grade reading level (technical / professional)',
};

function describeAttribute(key: string, value: unknown): string | null {
  if (typeof value !== 'number' || value < 1 || value > 5) return null;
  const label = key.replace(/_/g, ' ');
  const intensity = ['barely', 'mildly', 'moderately', 'noticeably', 'highly'][value - 1];
  return `${intensity} ${label}`;
}

/**
 * Render the voice as a Markdown-ish prompt fragment. Returns `null` if the
 * voice has no usable signal.
 */
export function serializeBrandVoiceToPrompt(voice: BrandVoiceLike): string | null {
  const lines: string[] = [];

  if (voice.name) {
    lines.push(`# Brand voice: ${voice.name}`);
  }

  if (voice.tone) {
    lines.push(`Tone: ${voice.tone.trim()}`);
  }

  if (voice.persona_description) {
    lines.push(`Persona: ${voice.persona_description.trim()}`);
  }

  if (voice.pov) {
    const povLabel = POV_LABELS[voice.pov] ?? voice.pov;
    lines.push(`Point of view: write in ${povLabel}.`);
  }

  if (voice.reading_level_target) {
    const levelLabel =
      READING_LEVEL_LABELS[voice.reading_level_target] ?? voice.reading_level_target;
    lines.push(`Reading level: target ${levelLabel}.`);
  }

  if (voice.voice_attributes && typeof voice.voice_attributes === 'object') {
    const attrLines: string[] = [];
    for (const [key, value] of Object.entries(voice.voice_attributes)) {
      const desc = describeAttribute(key, value);
      if (desc) attrLines.push(desc);
    }
    if (attrLines.length > 0) {
      lines.push(`Voice attributes: ${attrLines.join(', ')}.`);
    }
  }

  if (voice.preferred_phrases && voice.preferred_phrases.length > 0) {
    lines.push(`Prefer phrases like: ${voice.preferred_phrases.map((p) => `"${p}"`).join(', ')}.`);
  }

  if (voice.banned_phrases && voice.banned_phrases.length > 0) {
    lines.push(`Never use these phrases: ${voice.banned_phrases.map((p) => `"${p}"`).join(', ')}.`);
  }

  if (voice.sample_corpus && voice.sample_corpus.trim().length > 0) {
    const sample = voice.sample_corpus.trim().slice(0, 4000); // bound for prompt size
    lines.push(`Reference samples (mimic the cadence and word choice):\n\n${sample}`);
  }

  if (lines.length === 0) return null;

  return lines.join('\n\n');
}
