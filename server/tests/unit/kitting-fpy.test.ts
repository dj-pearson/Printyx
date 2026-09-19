/**
 * Kitting, QA and first-pass yield (WF-L-05).
 *
 * WarehouseOperations.tsx had a Build tab and a Serial Numbers tab that both
 * said "will be implemented here", above dead useForm state bound to a schema
 * describing a shape warehouse_kitting_operations does not have.
 * server/routes-warehouse-fpy.ts had the real CRUD underneath it, with no
 * caller in any of the seven client trees - and it would have 404'd in
 * production regardless, because nothing proxied that prefix and no edge
 * function served it.
 *
 * The arithmetic is tested here rather than asserted from source because
 * first-pass yield is a number an operations manager judges technicians by.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  completionUpdate,
  computeFpy,
  periodStart,
  satisfiedRequirements,
  type KittingRow,
} from '../../../supabase/functions/_shared/kitting-fpy.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const done = (over: Partial<KittingRow> = {}): KittingRow => ({
  operation_status: 'completed',
  assigned_technician: 'tech-1',
  equipment_model: 'MX-3071',
  first_pass_yield: true,
  ...over,
});

describe('first-pass yield', () => {
  it('is null over an empty window, not zero', () => {
    // 0% on a quality card reads as every build failing QA, which is the worst
    // possible misreading and indistinguishable from a real collapse. The
    // Express version returned 0.
    const metrics = computeFpy([]);
    expect(metrics.fpyPercentage).toBeNull();
    expect(metrics.reworkRate).toBeNull();
    expect(metrics.totalOperations).toBe(0);
  });

  it('counts the builds that passed without rework', () => {
    const metrics = computeFpy([
      done(),
      done({ first_pass_yield: false, rework_required: true }),
      done({ assigned_technician: 'tech-2' }),
      done({ assigned_technician: 'tech-2', first_pass_yield: false }),
    ]);
    expect(metrics.totalOperations).toBe(4);
    expect(metrics.firstPassOperations).toBe(2);
    expect(metrics.fpyPercentage).toBe(50);
    expect(metrics.reworkRate).toBe(25);
  });

  it('breaks down by technician and by model, each with its own denominator', () => {
    const metrics = computeFpy([
      done({ assigned_technician: 'a' }),
      done({ assigned_technician: 'a', first_pass_yield: false }),
      done({ assigned_technician: 'b' }),
    ]);
    expect(metrics.fpyByTechnician.a).toEqual({ total: 2, firstPass: 1, percentage: 50 });
    expect(metrics.fpyByTechnician.b).toEqual({ total: 1, firstPass: 1, percentage: 100 });
    expect(metrics.fpyByEquipmentType['MX-3071'].total).toBe(3);
  });

  it('names an unassigned build rather than dropping it', () => {
    const metrics = computeFpy([done({ assigned_technician: null })]);
    expect(metrics.fpyByTechnician.unassigned.total).toBe(1);
  });

  it('ranks defects by share of BUILDS, which need not sum to 100', () => {
    // One build can carry several defects, so these are a share of operations
    // rather than of defects.
    const metrics = computeFpy([
      done({ defects_found: [{ defectType: 'scratch' }, { defectType: 'firmware' }] }),
      done({ defects_found: [{ defectType: 'scratch' }] }),
    ]);
    expect(metrics.topDefectTypes[0]).toEqual({ defectType: 'scratch', count: 2, percentage: 100 });
    expect(metrics.topDefectTypes[1]).toEqual({
      defectType: 'firmware',
      count: 1,
      percentage: 50,
    });
  });

  it('ignores a defect with no type instead of bucketing it as empty', () => {
    const metrics = computeFpy([done({ defects_found: [{ defectType: '  ' }] })]);
    expect(metrics.topDefectTypes).toEqual([]);
  });
});

describe('the QA decision', () => {
  it('a clean pass is a first pass', () => {
    const update = completionUpdate({ rework_count: 0 }, { passed: true });
    expect(update.first_pass_yield).toBe(true);
    expect(update.quality_status).toBe('passed');
    expect(update.operation_status).toBe('completed');
    expect(update.rework_required).toBe(false);
  });

  it('a failure records rework and clears the completion', () => {
    const update = completionUpdate({ rework_count: 0 }, { passed: false, notes: 'bad fuser' });
    expect(update.operation_status).toBe('failed');
    expect(update.rework_count).toBe(1);
    expect(update.rework_notes).toBe('bad fuser');
    expect(update.completed_at).toBeNull();
    expect(update.first_pass_yield).toBe(false);
  });

  it('a pass AFTER rework is not a first pass, and re-running QA cannot promote it', () => {
    // This is the whole point of the metric. It reads rework_count on the row
    // rather than the current attempt's result.
    const update = completionUpdate({ rework_count: 2 }, { passed: true });
    expect(update.first_pass_yield).toBe(false);
    expect(update.quality_status).toBe('passed');
    expect(update.rework_count).toBe(2);
  });

  it('measures the build from started_at, and leaves it null without one', () => {
    const now = new Date('2026-09-18T12:00:00Z');
    const withStart = completionUpdate(
      { rework_count: 0, started_at: '2026-09-18T10:30:00Z' },
      { passed: true },
      now,
    );
    expect(withStart.total_duration_minutes).toBe(90);
    expect(
      completionUpdate({ rework_count: 0 }, { passed: true }, now).total_duration_minutes,
    ).toBeNull();
  });
});

describe('the evidence WF-L-13 will check', () => {
  it('a completed pass satisfies quality_control_passed', () => {
    expect(
      satisfiedRequirements({ operation_status: 'completed', quality_status: 'passed' }),
    ).toContain('quality_control_passed');
  });

  it('a failed QA satisfies nothing', () => {
    expect(satisfiedRequirements({ operation_status: 'failed', quality_status: 'failed' })).toEqual(
      [],
    );
  });

  it('serial_number_verified means serials were RECORDED, not that one exists', () => {
    expect(satisfiedRequirements({ serial_numbers: [] })).toEqual([]);
    expect(satisfiedRequirements({ serial_numbers: ['SN-1'] })).toContain('serial_number_verified');
  });

  it('answers nothing for a build that is not there', () => {
    expect(satisfiedRequirements(null)).toEqual([]);
  });
});

describe('periods', () => {
  it('falls back to a week for an unknown one rather than throwing', () => {
    const now = new Date('2026-09-18T00:00:00Z');
    expect(periodStart('nonsense', now).toISOString()).toBe(periodStart('week', now).toISOString());
    expect(periodStart('day', now).toISOString()).toBe('2026-09-17T00:00:00.000Z');
  });
});

describe('both hosts run the same handler', () => {
  const edge = read('supabase/functions/warehouse-operations/index.ts');
  const proxy = read('server/middleware/edge-function-proxy.ts');

  it('the edge function serves kitting, fpy-metrics and serials', () => {
    for (const branch of [
      "endpoint === 'kitting'",
      "endpoint === 'fpy-metrics'",
      "endpoint === 'serials'",
    ]) {
      expect(edge, branch).toContain(branch);
    }
  });

  it('and they are inside the already-proxied prefix', () => {
    expect(proxy).toMatch(/'\/api\/warehouse-operations':\s*'warehouse-operations'/);
  });

  it('the named endpoints guard lists them, so the id branch cannot swallow one', () => {
    const named = edge.slice(edge.indexOf('const NAMED_ENDPOINTS'), edge.indexOf(']);'));
    for (const name of ['kitting', 'fpy-metrics', 'serials']) {
      expect(named, name).toContain(`'${name}'`);
    }
  });

  it('the Express kitting and FPY handlers are gone, auto-invoice is kept', () => {
    const express = read('server/routes-warehouse-fpy.ts');
    expect(express).not.toContain("router.post('/warehouse-kitting-operations'");
    expect(express).not.toContain("router.get('/fpy-metrics'");
    // Real feature over the billing engine with no edge counterpart: PROD-008c.
    expect(express).toContain("router.post('/auto-invoice/:sourceType/:sourceId'");
  });

  it('serials read equipment_lifecycle, which is where the stage lives', () => {
    // `equipment` has equipment_status and model_number - a different
    // vocabulary and a different column name.
    expect(edge).toContain("from('equipment_lifecycle')");
    expect(edge).toContain("in('current_stage', PRE_STAGE_STAGES)");
  });
});

describe('the two tabs', () => {
  const page = read('client/src/pages/WarehouseOperations.tsx');

  it('neither still says it will be implemented', () => {
    expect(page).not.toContain('Build process management interface will be implemented here');
    expect(page).not.toContain('Serial number management interface will be implemented here');
  });

  it('the build form is bound to columns the table has', () => {
    // It described modelId, scheduledDate, an accessories[] and a buildSteps[],
    // none of which exist on warehouse_kitting_operations.
    expect(page).toContain('orderNumber: z.string()');
    expect(page).toContain('kitName: z.string()');
    expect(page).not.toContain('modelId: z.string()');
    expect(page).not.toContain('buildSteps: z.array');
  });

  it('calls the three endpoints', () => {
    for (const path of [
      '/api/warehouse-operations/kitting',
      '/api/warehouse-operations/serials',
      '/api/warehouse-operations/fpy-metrics',
    ]) {
      expect(page, path).toContain(path);
    }
  });

  it('renders an absent yield as a dash rather than zero percent', () => {
    expect(page).toContain('function pct(');
    expect(page).toContain("? '—'");
  });

  it('keeps the shared module, so the page and the handler agree', () => {
    expect(existsSync(join(repo, 'supabase/functions/_shared/kitting-fpy.ts'))).toBe(true);
  });
});
