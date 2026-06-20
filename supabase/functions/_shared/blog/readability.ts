// Readability helpers (US-BLOG-026)
//
// Pure, dependency-free Flesch-Kincaid grade-level + reading-ease computation
// and sentence segmentation. Deterministic (no external calls) so the editor's
// live gauge and the pre-publish gate behave identically everywhere.

/** Strip markdown/HTML to plain prose so syllable/word counts aren't skewed. */
export function stripMarkup(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → anchor text
    .replace(/<[^>]+>/g, ' ') // html tags
    .replace(/[#>*_~|-]+/g, ' ') // md punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split prose into sentences. Naive but stable: split on .!? followed by space. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/([.!?])\s+/g, '$1')
    .split('')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function countWords(text: string): number {
  const m = text.trim().match(/[A-Za-z0-9']+/g);
  return m ? m.length : 0;
}

/** Heuristic syllable count — the standard vowel-group approximation. */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  let cleaned = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '');
  const groups = cleaned.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function countTextSyllables(text: string): number {
  const words = text.match(/[A-Za-z']+/g) ?? [];
  let total = 0;
  for (const w of words) total += countSyllables(w);
  return total;
}

export interface ReadabilityScore {
  /** Flesch-Kincaid grade level (US school grade). */
  gradeLevel: number;
  /** Flesch reading ease (0-100, higher = easier). */
  readingEase: number;
  words: number;
  sentences: number;
  syllables: number;
}

/** Flesch-Kincaid grade + Flesch reading ease for a block of prose. */
export function fleschKincaid(rawText: string): ReadabilityScore {
  const text = stripMarkup(rawText);
  const sentences = Math.max(splitSentences(text).length, 1);
  const words = Math.max(countWords(text), 1);
  const syllables = Math.max(countTextSyllables(text), 1);

  const wordsPerSentence = words / sentences;
  const syllablesPerWord = syllables / words;

  const gradeLevel = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  const readingEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;

  return {
    gradeLevel: Math.round(gradeLevel * 10) / 10,
    readingEase: Math.round(readingEase * 10) / 10,
    words,
    sentences,
    syllables,
  };
}

export type HighlightLevel = 'ok' | 'hard' | 'very_hard';

export interface SentenceReadability {
  sentence: string;
  gradeLevel: number;
  level: HighlightLevel;
}

/**
 * Per-sentence grade + highlight level relative to a target grade. Sentences
 * up to +2 over target are 'hard' (yellow); beyond +5 are 'very_hard' (red).
 */
export function sentenceReadability(
  rawText: string,
  targetGrade: number,
): SentenceReadability[] {
  const text = stripMarkup(rawText);
  return splitSentences(text).map((sentence) => {
    const { gradeLevel } = fleschKincaid(sentence);
    let level: HighlightLevel = 'ok';
    if (gradeLevel > targetGrade + 5) level = 'very_hard';
    else if (gradeLevel > targetGrade + 2) level = 'hard';
    return { sentence, gradeLevel, level };
  });
}

/** Map a "grade-N" target string (from brand voice) to a numeric grade. */
export function parseTargetGrade(target: string | null | undefined, fallback = 8): number {
  if (!target) return fallback;
  const m = String(target).match(/(\d+)/);
  return m ? Number(m[1]) : fallback;
}
