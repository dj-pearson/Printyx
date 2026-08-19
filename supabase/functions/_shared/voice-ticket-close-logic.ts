// Pure SKU-matching logic for voice ticket close (US-SUPER-005 / PROD-012).
//
// KEEP IN SYNC with server/routes-voice-ticket-close.ts. This decides which
// inventory SKU a spoken part name resolves to, and whether the match is strong
// enough to auto-select — and on confirm, the chosen SKU's quantity is DEDUCTED
// FROM THE TECHNICIAN'S TRUCK. A drift between backends would take the wrong
// part off the truck, or auto-select where the tech should have been asked.
//
// Locked by server/tests/unit/voice-ticket-close-logic-parity.test.ts.

/** A chosen SKU is auto-selected only when the top candidate's score clears this. */
export const SKU_AUTO_MATCH_THRESHOLD = 0.45;

export interface SkuCandidate {
  sku: string;
  name: string;
  score: number;
}

export interface InventoryRow {
  partNumber?: string | null;
  name?: string | null;
  itemDescription?: string | null;
}

/** Token-overlap + substring fuzzy score in [0,1]. */
export function fuzzyScore(needle: string, haystack: string): number {
  const a = needle.toLowerCase().trim();
  const b = (haystack ?? '').toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 1;
  let score = 0;
  if (b.includes(a) || a.includes(b)) score += 0.5;
  const aTokens = a.split(/\s+/).filter(Boolean);
  const bTokens = new Set(b.split(/\s+/).filter(Boolean));
  if (aTokens.length > 0) {
    const overlap = aTokens.filter((t) => bTokens.has(t) || b.includes(t)).length;
    score += 0.5 * (overlap / aTokens.length);
  }
  return Math.min(1, score);
}

/**
 * Score, rank and threshold inventory rows against a spoken part name. The DB
 * read stays in each backend; this is the part that decides the outcome.
 */
export function rankSkuCandidates(
  raw: string,
  rows: InventoryRow[],
  topN = 3,
): { candidates: SkuCandidate[]; chosenSku: string | null } {
  const term = (raw ?? '').trim();
  if (!term) return { candidates: [], chosenSku: null };

  const candidates = rows
    .map((r) => {
      const sku = r.partNumber ?? '';
      if (!sku) return null;
      const name = r.name ?? r.itemDescription ?? sku;
      const score = Math.max(
        fuzzyScore(term, sku),
        fuzzyScore(term, r.name ?? ''),
        fuzzyScore(term, r.itemDescription ?? ''),
      );
      return { sku, name, score: Math.round(score * 1000) / 1000 };
    })
    .filter((c): c is SkuCandidate => !!c && c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  const chosenSku =
    candidates.length > 0 && candidates[0].score >= SKU_AUTO_MATCH_THRESHOLD
      ? candidates[0].sku
      : null;

  return { candidates, chosenSku };
}
