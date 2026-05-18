// Meta title/description scoring (US-BLOG-036)
//
// Pure, dependency-free (Deno-safe). Scores a {title, description} variant on
// the deterministic on-SERP signals that move CTR, then folds in the LLM's
// emotional-value rating to produce a single 0-100 "CTR index".
//
// This is a *relative* index for ranking variants against each other, not a
// predicted click-through percentage — a real % needs Search Console history
// (the US-BLOG-036 feedback loop, deferred until GSC integration exists).

// Curated power/emotion words that lift headline CTR. Lowercased; matched as
// whole words. Kept deliberately small and high-signal.
export const POWER_WORDS = [
  'free',
  'new',
  'proven',
  'easy',
  'fast',
  'ultimate',
  'essential',
  'complete',
  'guide',
  'best',
  'top',
  'how',
  'why',
  'secret',
  'mistake',
  'avoid',
  'boost',
  'save',
  'win',
  'instantly',
  'powerful',
  'simple',
  'step-by-step',
  'checklist',
  'now',
  'today',
  'expert',
  'real',
  'results',
  'increase',
  'reduce',
  'cut',
];

export interface MetaVariantInput {
  title: string;
  description: string;
  /** 0-10 emotional value from the LLM rubric. */
  emotionalValue: number;
  /** One-line LLM rationale, surfaced in the UI. */
  rationale: string;
}

export interface MetaScoreBreakdown {
  titleLength: { value: number; score: number; ok: boolean };
  descriptionLength: { value: number; score: number; ok: boolean };
  keywordInTitle: boolean;
  keywordInDescription: boolean;
  hasNumber: boolean;
  hasBracket: boolean;
  hasQuestion: boolean;
  powerWords: string[];
  emotionalValue: number;
  /** 0-100 composite CTR index. */
  ctrIndex: number;
}

export interface ScoredMetaVariant extends MetaVariantInput {
  breakdown: MetaScoreBreakdown;
}

function lengthScore(len: number, lo: number, hi: number): number {
  if (len === 0) return 0;
  if (len >= lo && len <= hi) return 100;
  // Linear falloff: lose ~3 points per char outside the band, floor 0.
  const dist = len < lo ? lo - len : len - hi;
  return Math.max(0, 100 - dist * 3);
}

function wholeWordPresent(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\W)${esc}(\\W|$)`, 'i').test(haystack);
}

export function scoreMetaVariant(
  variant: MetaVariantInput,
  targetKeyword: string,
): MetaScoreBreakdown {
  const title = variant.title.trim();
  const desc = variant.description.trim();
  const kw = targetKeyword.trim().toLowerCase();

  const titleLenScore = lengthScore(title.length, 50, 60);
  const descLenScore = lengthScore(desc.length, 140, 160);

  const keywordInTitle = kw ? title.toLowerCase().includes(kw) : false;
  const keywordInDescription = kw ? desc.toLowerCase().includes(kw) : false;

  const hasNumber = /\d/.test(title);
  const hasBracket = /[[\]()]/.test(title);
  const hasQuestion = title.includes('?');

  const titleLower = title.toLowerCase();
  const powerWords = POWER_WORDS.filter((w) => wholeWordPresent(titleLower, w));

  const emotional = Math.max(0, Math.min(10, variant.emotionalValue));

  // Composite CTR index — weighted blend. Length compliance is table stakes;
  // keyword presence and emotional pull are the big movers; signals are minor
  // boosters with diminishing returns.
  const lengthComponent = (titleLenScore * 0.6 + descLenScore * 0.4) * 0.3; // 30%
  const keywordComponent =
    ((keywordInTitle ? 1 : 0) * 0.7 + (keywordInDescription ? 1 : 0) * 0.3) * 100 * 0.25; // 25%
  const emotionalComponent = (emotional / 10) * 100 * 0.25; // 25%
  const signalCount = (hasNumber ? 1 : 0) + (hasBracket ? 1 : 0) + (hasQuestion ? 1 : 0);
  const signalComponent = Math.min(1, signalCount / 2) * 100 * 0.1; // 10%
  const powerComponent = Math.min(1, powerWords.length / 3) * 100 * 0.1; // 10%

  const ctrIndex = Math.round(
    lengthComponent + keywordComponent + emotionalComponent + signalComponent + powerComponent,
  );

  return {
    titleLength: {
      value: title.length,
      score: Math.round(titleLenScore),
      ok: title.length >= 50 && title.length <= 60,
    },
    descriptionLength: {
      value: desc.length,
      score: Math.round(descLenScore),
      ok: desc.length >= 140 && desc.length <= 160,
    },
    keywordInTitle,
    keywordInDescription,
    hasNumber,
    hasBracket,
    hasQuestion,
    powerWords,
    emotionalValue: emotional,
    ctrIndex: Math.max(0, Math.min(100, ctrIndex)),
  };
}
