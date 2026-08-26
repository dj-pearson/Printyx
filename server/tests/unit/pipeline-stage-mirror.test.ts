// COP-M07: the legacy -> canonical stage mapping.
//
// deals.stage_id lives in the LEGACY deal_stages id space and
// pipeline_stages.legacy_stage_id is the bridge. The bridge is only useful if it
// is complete, so both deal_stages writers now mirror. This pins the field
// mapping; the write path itself is exercised against a real database by
// `npm run check:stage-resolution`.
import { describe, it, expect } from 'vitest';

import { canonicalFieldsFor } from '../../lib/pipeline-stage-mirror';

const base = { id: 's1', tenantId: 't1', name: 'Discovery' };

describe('canonicalFieldsFor', () => {
  it('carries name, colour and order across', () => {
    const fields = canonicalFieldsFor({ ...base, color: '#123456', sortOrder: 3 });
    expect(fields.name).toBe('Discovery');
    expect(fields.displayName).toBe('Discovery');
    expect(fields.color).toBe('#123456');
    expect(fields.order).toBe(3);
  });

  it('defaults a missing colour and order rather than writing null', () => {
    const fields = canonicalFieldsFor(base);
    expect(fields.color).toBe('#3B82F6');
    expect(fields.order).toBe(0);
  });

  it('derives 100 on a won stage', () => {
    const fields = canonicalFieldsFor({ ...base, isClosingStage: true, isWonStage: true });
    expect(fields).toMatchObject({
      isFinalStage: true,
      isClosedWon: true,
      isClosedLost: false,
      defaultProbability: 100,
    });
  });

  it('derives 0 on a lost stage', () => {
    const fields = canonicalFieldsFor({ ...base, isClosingStage: true, isWonStage: false });
    expect(fields).toMatchObject({
      isFinalStage: true,
      isClosedWon: false,
      isClosedLost: true,
      defaultProbability: 0,
    });
  });

  it('uses a neutral 50 on an open stage, because deal_stages has no probability column', () => {
    expect(canonicalFieldsFor(base).defaultProbability).toBe(50);
  });

  it('treats a won flag without a closing flag as won but not final', () => {
    // deal_stages allows the combination; the reading has to be deterministic.
    const fields = canonicalFieldsFor({ ...base, isWonStage: true });
    expect(fields.isClosedWon).toBe(true);
    expect(fields.isFinalStage).toBe(false);
    expect(fields.defaultProbability).toBe(100);
  });

  it('is active unless the legacy stage says otherwise', () => {
    expect(canonicalFieldsFor(base).isActive).toBe(true);
    expect(canonicalFieldsFor({ ...base, isActive: false }).isActive).toBe(false);
    // null is how an untouched legacy row reads, and it is not "inactive".
    expect(canonicalFieldsFor({ ...base, isActive: null }).isActive).toBe(true);
  });

  it('includes every stage in the forecast by default', () => {
    expect(canonicalFieldsFor(base).includeInForecast).toBe(true);
  });
});
