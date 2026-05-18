// Shared helpers for parsing JSON out of LLM completions.
//
// Models intermittently wrap JSON in ```fences``` or add a sentence of prose
// before/after it. These extractors tolerate that by slicing the first
// balanced object/array. Used by every blog LLM-generation endpoint
// (intent classifier, meta-suggest, briefs, draft generator).

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

/** Slice and parse the first balanced `{ ... }` object. Throws on failure. */
export function extractJsonObject(text: string): Record<string, unknown> {
  const t = stripFences(text);
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
}

/** Slice and parse the first balanced `[ ... ]` array. Throws on failure. */
export function extractJsonArray(text: string): unknown[] {
  const t = stripFences(text);
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in model response');
  }
  const parsed = JSON.parse(t.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('Parsed value is not an array');
  return parsed;
}

/** Coerce an unknown into a bounded string array (dedup-free, falsy-filtered). */
export function asStringArray(v: unknown, max = 30): string[] {
  return Array.isArray(v)
    ? v
        .map((x) => String(x))
        .filter(Boolean)
        .slice(0, max)
    : [];
}
