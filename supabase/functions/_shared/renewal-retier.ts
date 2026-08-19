// Renewal re-tier helpers (US-SUPER-010 / PROD-011).
//
// KEEP IN SYNC with num()/pickTier() in server/routes-renewal-autoquote.ts.
// These two functions decide which CPC band a projected volume falls into, so a
// divergence between the backends would produce DIFFERENT QUOTED RATES for the
// same contract — the one failure mode here that is worse than a 404.
//
// Locked by server/tests/unit/renewal-retier.test.ts, which runs the same cases
// against both copies.

export interface CpcTier {
  minVolume: number;
  maxVolume: number | null;
  cpc: number;
}

export function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Pick the CPC tier whose volume band contains `vol`; fall back to the highest. */
export function pickTier(tiers: CpcTier[], vol: number): CpcTier | null {
  if (tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.minVolume - b.minVolume);
  for (const t of sorted) {
    const lo = t.minVolume ?? 0;
    const hi = t.maxVolume == null ? Number.POSITIVE_INFINITY : t.maxVolume;
    if (vol >= lo && vol <= hi) return t;
  }
  // Above every band → use the open-ended / highest tier.
  return sorted[sorted.length - 1];
}
