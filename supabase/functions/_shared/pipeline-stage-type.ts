/**
 * Pipeline stage type <-> the columns that actually exist (COP-M07).
 *
 * PipelineConfiguration.tsx offers a "Stage Type" select of open | won | lost |
 * inactive, and the create endpoint wrote it straight through as `stage_type`.
 * `pipeline_stages` has NO stage_type column, so PostgREST answered 42703 and
 * every template create returned "Template saved but stage insert failed",
 * leaving an orphan template behind. The real columns are is_final_stage,
 * is_closed_won, is_closed_lost and is_active.
 *
 * `allowed_transitions` was written the same way and has no column either, but
 * unlike stage type it has no reader anywhere, so it is dropped rather than
 * mapped — inventing a column to store something nothing reads is how the
 * previous round of drift happened.
 */

export type StageType = 'open' | 'won' | 'lost' | 'inactive';

export interface StageFlags {
  is_final_stage: boolean;
  is_closed_won: boolean;
  is_closed_lost: boolean;
  is_active: boolean;
}

/** The UI's stage type as the four booleans the table stores. */
export function stageTypeToFlags(stageType: unknown): StageFlags {
  switch (stageType) {
    case 'won':
      return {
        is_final_stage: true,
        is_closed_won: true,
        is_closed_lost: false,
        is_active: true,
      };
    case 'lost':
      return {
        is_final_stage: true,
        is_closed_won: false,
        is_closed_lost: true,
        is_active: true,
      };
    case 'inactive':
      // Not a closing stage; a stage that is no longer offered.
      return {
        is_final_stage: false,
        is_closed_won: false,
        is_closed_lost: false,
        is_active: false,
      };
    case 'open':
    default:
      return {
        is_final_stage: false,
        is_closed_won: false,
        is_closed_lost: false,
        is_active: true,
      };
  }
}

/**
 * The stored booleans back as the UI's stage type, so a stage round-trips
 * through create and read unchanged. Won wins over lost when a row somehow
 * carries both, because a deal marked won is the safer reading of a
 * contradiction.
 */
export function flagsToStageType(row: {
  is_closed_won?: boolean | null;
  is_closed_lost?: boolean | null;
  is_active?: boolean | null;
}): StageType {
  if (row.is_closed_won) return 'won';
  if (row.is_closed_lost) return 'lost';
  if (row.is_active === false) return 'inactive';
  return 'open';
}
