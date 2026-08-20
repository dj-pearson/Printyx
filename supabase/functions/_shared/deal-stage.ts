/**
 * Stage resolution for deals (COP-M01).
 *
 * deals.stage_id is NOT NULL and references deal_stages.id, but every surface
 * that creates a deal sends a stage SLUG ('prospecting', 'qualification', ...)
 * from a hardcoded select — there is no stage picker bound to real ids. The
 * previous handler sidestepped this by writing to a `stage` column that does not
 * exist, so creation failed outright.
 *
 * These helpers resolve a slug against the tenant's own deal_stages rows at
 * request time. That is deliberately a LOOKUP and not a schema change: CRMX-005
 * keys deals.stage_id on the legacy deal_stages id space and COP-M07 warns that
 * repointing any writer to the pipeline_stages id space without verifying every
 * existing deal orphans them. Nothing here repoints anything — it only turns a
 * guaranteed failure into a correct insert.
 */

export interface DealStageRow {
  id: string;
  name?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

/** 'Closed Won' / 'closed_won' / 'closed-won' all normalize to 'closedwon'. */
export function normalizeStageKey(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** stage_id -> display name, for rendering a Stage column without an FK embed. */
export function buildStageNameMap(stages: DealStageRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const stage of stages ?? []) {
    if (stage?.id) map[stage.id] = String(stage.name ?? '');
  }
  return map;
}

/**
 * Exact stage_id for a requested stage: an id match, then a normalized name
 * match. Returns null when nothing matches.
 *
 * Use this for FILTERING. A filter must not fall back to a default stage — that
 * would quietly return a different column of the board than the one asked for.
 */
export function findStageId(
  stages: DealStageRow[],
  requested: string | null | undefined,
): string | null {
  const rows = (stages ?? []).filter((s) => s && s.id);
  const wanted = String(requested ?? '').trim();
  if (rows.length === 0 || !wanted) return null;

  const byId = rows.find((s) => s.id === wanted);
  if (byId) return byId.id;

  const key = normalizeStageKey(wanted);
  if (!key) return null;
  return rows.find((s) => normalizeStageKey(s.name) === key)?.id ?? null;
}

/**
 * stage_id for a NEW deal: findStageId, then the active stage with the lowest
 * sort_order. Returns null only when the tenant has no stages at all — which the
 * caller should report as a 400 naming the missing setup, not as a 500.
 *
 * Falling back is right here and wrong for a filter: stage_id is NOT NULL, so a
 * deal has to land somewhere, and the front of the pipeline is where an
 * unrecognized slug belongs.
 */
export function resolveStageId(
  stages: DealStageRow[],
  requested: string | null | undefined,
): string | null {
  return findStageId(stages, requested) ?? firstStageId(stages);
}

/** Lowest sort_order among active stages, falling back to all stages. */
export function firstStageId(stages: DealStageRow[]): string | null {
  const rows = (stages ?? []).filter((s) => s && s.id);
  if (rows.length === 0) return null;
  const active = rows.filter((s) => s.is_active !== false);
  const pool = active.length > 0 ? active : rows;
  const sorted = [...pool].sort((a, b) => {
    const ao = Number.isFinite(Number(a.sort_order))
      ? Number(a.sort_order)
      : Number.MAX_SAFE_INTEGER;
    const bo = Number.isFinite(Number(b.sort_order))
      ? Number(b.sort_order)
      : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return String(a.name ?? '').localeCompare(String(b.name ?? ''));
  });
  return sorted[0]?.id ?? null;
}
