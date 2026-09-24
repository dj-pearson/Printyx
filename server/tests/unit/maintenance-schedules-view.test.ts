import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createScheduleBody,
  dueState,
  frequencyLabel,
  scheduleFromRow,
} from '@/lib/maintenance-schedules';

const root = resolve(__dirname, '../../..');
const strip = (s: string) => s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const PAGE = strip(
  readFileSync(resolve(root, 'client/src/pages/PreventiveMaintenanceAutomation.tsx'), 'utf8'),
);

describe('maintenance schedule rows (round 225)', () => {
  it('maps the snake_case row the endpoint sends, and tolerates camelCase', () => {
    const v = scheduleFromRow({
      id: 's1',
      equipment_id: 'eq-1',
      name: 'Quarterly PM',
      frequency: 'quarterly',
      frequency_value: 2,
      next_due_date: '2026-10-01T00:00:00Z',
      estimated_duration: 45,
    });
    expect(v).toMatchObject({ equipmentId: 'eq-1', frequencyValue: 2, estimatedDuration: 45 });
    expect(v.nextDueDate?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(scheduleFromRow({ id: 's', equipmentId: 'eq-9' }).equipmentId).toBe('eq-9');
  });

  it('a missing field is missing, not a fixture value', () => {
    const v = scheduleFromRow({ id: 's' });
    expect(v.nextDueDate).toBeNull();
    expect(v.lastCompletedDate).toBeNull();
    expect(v.estimatedDuration).toBeNull();
    expect(v.frequencyValue).toBe(1);
  });

  it('due state comes from the date, and an undated schedule is neither overdue nor fine', () => {
    const now = new Date('2026-09-24T12:00:00Z');
    expect(dueState(null, now)).toBe('undated');
    expect(dueState(new Date('2026-09-20'), now)).toBe('overdue');
    expect(dueState(new Date('2026-09-28'), now)).toBe('due-soon');
    expect(dueState(new Date('2026-12-01'), now)).toBe('scheduled');
    expect(frequencyLabel('monthly', 1)).toBe('Every month');
    expect(frequencyLabel('weekly', 2)).toBe('Every 2 weeks');
  });

  it('create refuses what the table cannot store rather than letting the server default it', () => {
    const ok = {
      equipmentId: 'eq-1',
      name: 'PM',
      frequency: 'monthly',
      frequencyValue: '1',
      nextDueDate: '2026-10-01',
      estimatedDuration: '',
    };
    expect(createScheduleBody(ok)).toMatchObject({ equipmentId: 'eq-1', frequencyValue: 1 });
    expect(createScheduleBody(ok)).not.toHaveProperty('estimatedDuration');
    expect(createScheduleBody({ ...ok, nextDueDate: '' })).toBeNull();
    expect(createScheduleBody({ ...ok, equipmentId: '' })).toBeNull();
    expect(createScheduleBody({ ...ok, name: '  ' })).toBeNull();
    expect(createScheduleBody({ ...ok, frequency: 'fortnightly' })).toBeNull();
    expect(createScheduleBody({ ...ok, frequencyValue: '0' })).toBeNull();
  });
});

describe('maintenance automation page (round 225)', () => {
  it('maps rows through the view instead of a fixture select', () => {
    expect(PAGE).toMatch(/\.map\(scheduleFromRow\)/);
    for (const s of [
      'serviceHistory',
      'urgencyScore',
      'predictiveInsights',
      'requiredSkills',
      'would be implemented here',
      'Schedule Now',
    ]) {
      expect(PAGE).not.toContain(s);
    }
  });

  it('complete, history and create each call a real branch', () => {
    expect(PAGE).toMatch(/`\/api\/maintenance\/schedules\/\$\{schedule\?\.id\}\/complete`/);
    expect(PAGE).toMatch(/`\/api\/maintenance\/history\?equipmentId=/);
    expect(PAGE).toMatch(/apiRequest\('\/api\/maintenance\/schedules', 'POST', body\)/);
  });

  it('auto-generate compares string ids, so a scheduled machine is not scheduled twice', () => {
    expect(PAGE).toMatch(/scheduledEquipmentIds\.has\(String\(e\.id\)\)/);
  });
});
