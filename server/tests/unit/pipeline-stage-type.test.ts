// COP-M07: the stage-type mapping that replaced two phantom columns.
//
// PipelineConfiguration.tsx offers a Stage Type select, and the create endpoint
// wrote it through as `stage_type` — a column pipeline_stages does not have. Every
// template create answered 42703 and returned "Template saved but stage insert
// failed", leaving an orphan template. These are the real columns it maps onto.
import { describe, it, expect } from 'vitest';

import {
  flagsToStageType,
  stageTypeToFlags,
} from '../../../supabase/functions/_shared/pipeline-stage-type';

describe('stageTypeToFlags', () => {
  it('marks won as a closing stage that is won', () => {
    expect(stageTypeToFlags('won')).toEqual({
      is_final_stage: true,
      is_closed_won: true,
      is_closed_lost: false,
      is_active: true,
    });
  });

  it('marks lost as a closing stage that is lost', () => {
    expect(stageTypeToFlags('lost')).toEqual({
      is_final_stage: true,
      is_closed_won: false,
      is_closed_lost: true,
      is_active: true,
    });
  });

  it('treats inactive as no-longer-offered, NOT as a closing stage', () => {
    expect(stageTypeToFlags('inactive')).toEqual({
      is_final_stage: false,
      is_closed_won: false,
      is_closed_lost: false,
      is_active: false,
    });
  });

  it('defaults anything unrecognised to open rather than guessing', () => {
    for (const value of ['open', undefined, null, '', 'nonsense', 42]) {
      expect(stageTypeToFlags(value)).toEqual({
        is_final_stage: false,
        is_closed_won: false,
        is_closed_lost: false,
        is_active: true,
      });
    }
  });
});

describe('flagsToStageType', () => {
  it('round-trips every stage type', () => {
    for (const type of ['open', 'won', 'lost', 'inactive'] as const) {
      expect(flagsToStageType(stageTypeToFlags(type))).toBe(type);
    }
  });

  it('reads a row with no flags set as open', () => {
    expect(flagsToStageType({})).toBe('open');
  });

  it('prefers won over lost when a row contradicts itself', () => {
    expect(flagsToStageType({ is_closed_won: true, is_closed_lost: true })).toBe('won');
  });

  it('reports inactive only when nothing closed it', () => {
    expect(flagsToStageType({ is_active: false })).toBe('inactive');
    expect(flagsToStageType({ is_active: false, is_closed_won: true })).toBe('won');
  });
});
