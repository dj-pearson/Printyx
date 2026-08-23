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

  // Never auto-select when the top score is tied. A generic word like "toner"
  // or "cartridge" scores 1 against every toner in the catalogue (0.5 substring
  // + 0.5 full token overlap), and picking candidates[0] silently deducted the
  // FIRST match from the technician's truck — black toner when they may have
  // fitted cyan. An ambiguous match asks the tech instead of guessing.
  const ambiguous = candidates.length > 1 && candidates[0].score === candidates[1].score;
  const chosenSku =
    candidates.length > 0 && !ambiguous && candidates[0].score >= SKU_AUTO_MATCH_THRESHOLD
      ? candidates[0].sku
      : null;

  return { candidates, chosenSku };
}

/**
 * Storage-host allowlist for a voice note's audioUrl (CR-005), ported from
 * server/routes-voice-ticket-close.ts under PROD-008b.
 *
 * The edge function previously gated this with
 * `audioUrl.startsWith(Deno.env.get('SUPABASE_URL'))`. That is a prefix match on
 * the whole URL, not a host check, so with SUPABASE_URL = 'https://api.printyx.net'
 * the string 'https://api.printyx.net.evil.com/a.webm' passes it — an attacker
 * registers a subdomain of their own domain and the function fetches whatever it
 * points at. The Express implementation parsed the hostname, which does not have
 * that hole, and it was the tested one. Porting the parsing version and keeping
 * the Express suffix set.
 *
 * Takes the configured storage origin explicitly so this stays a pure function:
 * Deno.env is not reachable from a module the Node test suite loads.
 */
export function isAllowedAudioHost(rawUrl: string, configuredStorageUrl?: string): boolean {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  const suffixes = ['.supabase.co', '.supabase.in', '.printyx.net'];
  if (suffixes.some((s) => host.endsWith(s))) return true;
  if (configuredStorageUrl) {
    try {
      if (host === new URL(configuredStorageUrl).hostname.toLowerCase()) return true;
    } catch {
      /* malformed configuration is not a match */
    }
  }
  return false;
}
