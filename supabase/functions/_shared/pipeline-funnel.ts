/**
 * Pipeline funnel bucketing (COP-M07).
 *
 * Kept separate from the report handler so the arithmetic can be tested without
 * a database, and so the stage source can change without touching the maths.
 *
 * Stage identity note: `deals.stage_id` holds a LEGACY `deal_stages.id`, and the
 * canonical `pipeline_stages` row points back at it through `legacy_stage_id`.
 * So the funnel reads its stage LIST from the canonical table (name, order, the
 * closed flags) but buckets deals by the legacy id. Repointing deals into the
 * canonical id space is what COP-M07 warns orphans them.
 */

export interface FunnelStage {
  /** The legacy deal_stages.id that deals.stage_id actually holds. */
  legacyStageId: string | null;
  name: string;
  order: number | null;
  isActive?: boolean | null;
}

export interface FunnelDeal {
  stage_id: string;
  amount: string | number | null;
  status?: string | null;
}

export interface FunnelBucket {
  stage: string;
  value: number;
  count: number;
  conversionRate: number;
}

function sum(deals: FunnelDeal[]): number {
  return Math.round(deals.reduce((total, d) => total + Number(d.amount ?? 0), 0));
}

/**
 * One bucket per stage, in pipeline order, with a stage-to-stage conversion rate.
 *
 * An INACTIVE stage is dropped only when it holds no deals. Dropping it outright
 * would make the counts stop adding up to the pipeline — deals parked in a
 * retired stage are still real money, and a funnel that quietly omits them is
 * worse than one with an extra column.
 *
 * The conversion rate assumes sequential progression by order, which is
 * approximate: nothing records stage transitions, so this is a ratio of current
 * occupancy, not a measured flow. The first stage is always 0 because it has no
 * predecessor to convert from.
 */
export function buildFunnel(stages: FunnelStage[], deals: FunnelDeal[]): FunnelBucket[] {
  const byStage = new Map<string, FunnelDeal[]>();
  for (const deal of deals) {
    const list = byStage.get(deal.stage_id) ?? [];
    list.push(deal);
    byStage.set(deal.stage_id, list);
  }

  const ordered = [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const kept = ordered.filter((stage) => {
    const held = stage.legacyStageId ? (byStage.get(stage.legacyStageId)?.length ?? 0) : 0;
    return stage.isActive !== false || held > 0;
  });

  const out = kept.map((stage) => {
    const subset = stage.legacyStageId ? (byStage.get(stage.legacyStageId) ?? []) : [];
    return { stage: stage.name, value: sum(subset), count: subset.length, conversionRate: 0 };
  });

  for (let i = 1; i < out.length; i++) {
    const previous = out[i - 1].count;
    out[i].conversionRate = previous > 0 ? Math.round((out[i].count / previous) * 100) : 0;
  }
  return out;
}

/**
 * The status buckets used when a tenant has no stages at all. Kept here so the
 * fallback is as testable as the real path.
 */
export function buildStatusFallback(deals: FunnelDeal[]): FunnelBucket[] {
  return ['open', 'won', 'lost'].map((status) => {
    const subset = deals.filter((d) => d.status === status);
    return { stage: status, value: sum(subset), count: subset.length, conversionRate: 0 };
  });
}
