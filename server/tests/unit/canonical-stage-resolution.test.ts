/**
 * WF-C-08: an accepted proposal lands in the tenant's Closed Won stage.
 *
 * `deals.stage_id` lives in the legacy deal_stages id space (CRMX-005), while
 * what a stage MEANS lives on pipeline_stages. Two surfaces cross that bridge
 * and they crossed it differently.
 *
 * pipeline-config's /deals/:id/move resolved `(s.legacy_stage_id ?? s.id)`.
 * proposals' getWonStageId read deal_stages.is_won_stage, then matched the NAME
 * 'Closed Won', then FELL BACK TO THE FIRST STAGE - and the pipeline
 * configuration UI edits pipeline_stages only and never mirrors back. So a
 * tenant that renamed its closed-won stage, or added a second one, had every
 * accepted proposal land at the front of its pipeline. That is worse than
 * failing to move the deal: a won deal sitting in Prospecting is counted as open
 * pipeline by the forecast.
 *
 * AC2 asks for a fixture test proving both endpoints pick the same id. That is
 * the last block, and it runs the resolution both handlers now call rather than
 * asserting on their text.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
  PROPOSAL_SENT_STAGE_NAMES,
  findClosedWonStage,
  firstStage,
  resolveProposalSentStageId,
  resolveStage,
  resolveWonStageId,
  stageLegacyId,
  type CanonicalStage,
} from '../../../supabase/functions/_shared/canonical-stage';

const strip = (src: string) =>
  src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

/** One tenant's canonical pipeline, mirrored from legacy stages. */
const PIPELINE: CanonicalStage[] = [
  { id: 'ps-1', legacy_stage_id: 'ds-1', name: 'Prospecting', order: 1, is_active: true },
  { id: 'ps-2', legacy_stage_id: 'ds-2', name: 'Proposal Sent', order: 2, is_active: true },
  {
    id: 'ps-3',
    legacy_stage_id: 'ds-3',
    name: 'Signed and Delivered',
    order: 3,
    is_closed_won: true,
    is_active: true,
  },
  {
    id: 'ps-4',
    legacy_stage_id: 'ds-4',
    name: 'Closed Lost',
    order: 4,
    is_closed_lost: true,
    is_active: true,
  },
];

describe('which id gets written', () => {
  it('the legacy id where the bridge exists, the canonical id where it does not', () => {
    expect(stageLegacyId(PIPELINE[0])).toBe('ds-1');
    expect(stageLegacyId({ id: 'ps-9', name: 'New stage' })).toBe('ps-9');
    expect(stageLegacyId(null)).toBeNull();
  });

  it('resolves a deal stage_id back to its canonical stage', () => {
    expect(resolveStage(PIPELINE, 'ds-3')?.id).toBe('ps-3');
    expect(resolveStage(PIPELINE, 'ps-9')).toBeNull();
    expect(resolveStage(PIPELINE, null)).toBeNull();
  });
});

describe('the closed-won stage', () => {
  it('is found by the FLAG, not by the name - which is the whole defect', () => {
    // "Signed and Delivered" is what this tenant calls it. The old resolution
    // matched the literal name 'Closed Won', found nothing, and fell back to the
    // first stage.
    expect(findClosedWonStage(PIPELINE)?.id).toBe('ps-3');
    expect(resolveWonStageId(PIPELINE)).toBe('ds-3');
  });

  it('a two-step close ends at the LAST won stage', () => {
    const twoStep: CanonicalStage[] = [
      ...PIPELINE,
      {
        id: 'ps-5',
        legacy_stage_id: 'ds-5',
        name: 'Onboarded',
        order: 5,
        is_closed_won: true,
        is_active: true,
      },
    ];
    // Picking the first would short-circuit the second step.
    expect(resolveWonStageId(twoStep)).toBe('ds-5');
  });

  it('ignores an inactive stage', () => {
    const retired = PIPELINE.map((s) => (s.id === 'ps-3' ? { ...s, is_active: false } : s));
    expect(findClosedWonStage(retired)).toBeNull();
  });

  it('falls back to the seeded NAME only when no stage carries the flag', () => {
    // A pipeline where nothing is flagged was never configured, not a pipeline
    // with no close.
    const unflagged: CanonicalStage[] = [
      { id: 'ps-1', legacy_stage_id: 'ds-1', name: 'Prospecting', order: 1 },
      { id: 'ps-2', legacy_stage_id: 'ds-2', name: 'Closed Won', order: 2 },
    ];
    expect(resolveWonStageId(unflagged)).toBe('ds-2');
  });

  it('NEVER falls back to the first stage', () => {
    // The old code did, so a won deal landed in Prospecting and the forecast
    // counted it as open pipeline.
    const noClose: CanonicalStage[] = [
      { id: 'ps-1', legacy_stage_id: 'ds-1', name: 'Prospecting', order: 1 },
      { id: 'ps-2', legacy_stage_id: 'ds-2', name: 'Negotiation', order: 2 },
    ];
    expect(resolveWonStageId(noClose)).toBeNull();
    expect(resolveWonStageId([])).toBeNull();
  });
});

describe('the proposal-sent stage, and why it is allowed a fallback', () => {
  it('matches the names a copier pipeline uses, by order', () => {
    expect(resolveProposalSentStageId(PIPELINE)).toBe('ds-2');
    expect(PROPOSAL_SENT_STAGE_NAMES).toEqual([
      'Contract Sent',
      'Proposal Sent',
      'Presentation Scheduled',
    ]);
  });

  it('matches on display_name too', () => {
    const renamed: CanonicalStage[] = [
      {
        id: 'ps-1',
        legacy_stage_id: 'ds-1',
        name: 'stage_two',
        display_name: 'Contract Sent',
        order: 2,
      },
      { id: 'ps-0', legacy_stage_id: 'ds-0', name: 'Prospecting', order: 1 },
    ];
    expect(resolveProposalSentStageId(renamed)).toBe('ds-1');
  });

  it('DOES fall back to the first stage, unlike the won stage', () => {
    // A proposal has genuinely been sent; the deal has to sit somewhere. A won
    // deal has no such excuse.
    const noSentStage: CanonicalStage[] = [
      { id: 'ps-2', legacy_stage_id: 'ds-2', name: 'Negotiation', order: 2 },
      { id: 'ps-1', legacy_stage_id: 'ds-1', name: 'Prospecting', order: 1 },
    ];
    expect(firstStage(noSentStage)?.id).toBe('ps-1');
    expect(resolveProposalSentStageId(noSentStage)).toBe('ds-1');
  });
});

describe('AC2: both endpoints pick the same stage for the same tenant', () => {
  it('acceptance and the board move agree on Closed Won', () => {
    // The board move takes a legacy id from the UI and asks resolveStage what it
    // means. Acceptance asks resolveWonStageId which legacy id to write. Both go
    // through the same module, so the id acceptance writes is the id the board
    // reads back as closed-won.
    const wonId = resolveWonStageId(PIPELINE);
    expect(wonId).not.toBeNull();
    const asTheBoardSeesIt = resolveStage(PIPELINE, wonId);
    expect(asTheBoardSeesIt?.is_closed_won).toBe(true);
    expect(asTheBoardSeesIt?.id).toBe(findClosedWonStage(PIPELINE)?.id);
  });

  it('and on an unmirrored stage, where both use the canonical id', () => {
    const unmirrored: CanonicalStage[] = [
      { id: 'ps-1', name: 'Prospecting', order: 1 },
      { id: 'ps-2', name: 'Won', order: 2, is_closed_won: true },
    ];
    const wonId = resolveWonStageId(unmirrored);
    expect(wonId).toBe('ps-2');
    expect(resolveStage(unmirrored, wonId)?.is_closed_won).toBe(true);
  });

  it('the sent stage round-trips the same way', () => {
    const sentId = resolveProposalSentStageId(PIPELINE);
    expect(resolveStage(PIPELINE, sentId)?.name).toBe('Proposal Sent');
  });
});

describe('both handlers call it', () => {
  it('proposals resolves through pipeline_stages', () => {
    const src = strip(readFileSync('supabase/functions/proposals/index.ts', 'utf8'));
    expect(src).toContain('resolveWonStageId(await loadCanonicalStages(db, tenantId))');
    expect(src).toContain('resolveProposalSentStageId(await loadCanonicalStages(db, tenantId))');
    // The legacy flag read is gone.
    expect(src).not.toContain('is_won_stage');
  });

  it('pipeline-config uses the same resolver rather than its own inline rule', () => {
    const src = strip(readFileSync('supabase/functions/pipeline-config/index.ts', 'utf8'));
    expect(src).toContain('resolveStage(stages as CanonicalStage[], legacyId)');
    expect(src).not.toContain('(s.legacy_stage_id ?? s.id) === legacyId');
  });

  it('a tenant with no canonical rows still resolves by name', () => {
    // Stages that predate the bridge have no pipeline_stages row at all.
    const src = strip(readFileSync('supabase/functions/proposals/index.ts', 'utf8'));
    expect(src).toContain("getStageIdByName(db, tenantId, 'Closed Won')");
  });
});
