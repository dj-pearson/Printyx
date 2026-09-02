/**
 * Which canonical stage, and which id to write (WF-C-08).
 *
 * `deals.stage_id` lives in the LEGACY deal_stages id space (CRMX-005), while
 * everything that decides what a stage MEANS - closed won, closed lost, default
 * probability - lives on `pipeline_stages`. Two surfaces need to cross that
 * bridge and were doing it differently:
 *
 *   pipeline-config's /deals/:id/move resolved a stage as
 *   `(s.legacy_stage_id ?? s.id)`, so an unmirrored canonical stage still
 *   answers with its own id.
 *
 *   proposals' getWonStageId read deal_stages.is_won_stage, then matched the
 *   NAME 'Closed Won', then fell back to the FIRST stage in the pipeline. The
 *   configuration UI edits pipeline_stages only and never mirrors back, so a
 *   tenant that renamed its closed-won stage - or added a second one - had every
 *   accepted proposal land at the front of the pipeline instead of at the end.
 *   Landing a won deal in "Prospecting" is worse than failing to move it: the
 *   forecast counts it as open pipeline.
 *
 * Both now go through this module, and a fixture test asserts they pick the same
 * id for the same tenant. Everything here is pure; the callers read the stages.
 */

export interface CanonicalStage {
  id: string;
  legacy_stage_id?: string | null;
  name?: string | null;
  display_name?: string | null;
  order?: number | null;
  is_closed_won?: boolean | null;
  is_closed_lost?: boolean | null;
  is_final_stage?: boolean | null;
  is_active?: boolean | null;
  default_probability?: number | null;
}

/**
 * The id to WRITE for a canonical stage: its legacy id where the bridge exists,
 * its own id otherwise. This is the rule pipeline-config already applied, and
 * the reason it is a function rather than an inline `??` in two files.
 */
export function stageLegacyId(stage: CanonicalStage | null | undefined): string | null {
  if (!stage) return null;
  return stage.legacy_stage_id ?? stage.id ?? null;
}

/** The canonical stage a legacy deals.stage_id points at. */
export function resolveStage(
  stages: CanonicalStage[],
  legacyId: string | null | undefined,
): CanonicalStage | null {
  if (!legacyId) return null;
  return (stages ?? []).find((s) => stageLegacyId(s) === legacyId) ?? null;
}

const norm = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

function active(stages: CanonicalStage[]): CanonicalStage[] {
  return (stages ?? []).filter((s) => s && s.is_active !== false);
}

/** Lowest `order` first, then id, so the same tenant resolves the same way twice. */
function ordered(stages: CanonicalStage[]): CanonicalStage[] {
  return [...stages].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id)),
  );
}

/**
 * The tenant's closed-won stage.
 *
 * A tenant with two of them gets the LAST one by order, which is where a deal
 * that has run the whole pipeline belongs; picking the first would short-circuit
 * a two-step close.
 */
export function findClosedWonStage(stages: CanonicalStage[]): CanonicalStage | null {
  const won = ordered(active(stages).filter((s) => s.is_closed_won === true));
  if (won.length > 0) return won[won.length - 1];
  // No flag set anywhere is a pipeline that was never configured, not a pipeline
  // with no close. The name is the next best evidence, and it is evidence rather
  // than a guess because it is the name the seeder writes.
  return ordered(active(stages)).find((s) => norm(s.name) === 'closedwon') ?? null;
}

/** The stage a sent proposal sits in, by the names a copier pipeline uses. */
export const PROPOSAL_SENT_STAGE_NAMES = [
  'Contract Sent',
  'Proposal Sent',
  'Presentation Scheduled',
];

export function findStageByNames(stages: CanonicalStage[], names: string[]): CanonicalStage | null {
  const rows = ordered(active(stages));
  for (const name of names) {
    const match = rows.find(
      (s) => norm(s.name) === norm(name) || norm(s.display_name) === norm(name),
    );
    if (match) return match;
  }
  return null;
}

/** First by order - where a deal with nowhere better to go belongs. */
export function firstStage(stages: CanonicalStage[]): CanonicalStage | null {
  return ordered(active(stages))[0] ?? null;
}

/**
 * The legacy id an accepted proposal writes.
 *
 * Never falls back to the first stage: a won deal in "Prospecting" is counted as
 * open pipeline by the forecast, so the honest answer when a tenant has no
 * closed-won stage is null and the caller reports it.
 */
export function resolveWonStageId(stages: CanonicalStage[]): string | null {
  return stageLegacyId(findClosedWonStage(stages));
}

/**
 * The legacy id a SENT proposal writes.
 *
 * This one does fall back to the first stage, and the asymmetry is deliberate:
 * a proposal has genuinely been sent, the deal has to sit somewhere, and the
 * front of the pipeline is where a deal with no better stage belongs. That is
 * the same rule _shared/deal-stage.ts applies on create.
 */
export function resolveProposalSentStageId(stages: CanonicalStage[]): string | null {
  return stageLegacyId(findStageByNames(stages, PROPOSAL_SENT_STAGE_NAMES) ?? firstStage(stages));
}
