/**
 * maintenance_schedules rows as the Maintenance Automation page reads them
 * (round 225).
 *
 * GET /maintenance/schedules answers raw PostgREST rows (snake_case). The page
 * was written against a fixture shape - equipmentModel, customerName,
 * serviceName, urgencyScore, predictiveInsights.costSavings, requiredSkills,
 * serviceHistory - none of which the table has, and its `select` called
 * `schedule.serviceHistory.map(...)` on every row, which threw on the first
 * real one. So the Schedules tab never rendered a schedule that existed.
 */

type Row = Record<string, unknown>;

const pick = (row: Row, snake: string, camel: string): unknown => row[snake] ?? row[camel];
const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const when = (v: unknown): Date | null => {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

export interface MaintenanceScheduleView {
  id: string;
  equipmentId: string | null;
  name: string;
  description: string | null;
  maintenanceType: string;
  frequency: string;
  frequencyValue: number;
  nextDueDate: Date | null;
  lastCompletedDate: Date | null;
  estimatedDuration: number | null;
  status: string;
}

export function scheduleFromRow(row: Row): MaintenanceScheduleView {
  const fv = Number(pick(row, 'frequency_value', 'frequencyValue'));
  const dur = pick(row, 'estimated_duration', 'estimatedDuration');
  return {
    id: String(row.id),
    equipmentId: text(pick(row, 'equipment_id', 'equipmentId')),
    name: text(row.name) ?? 'Untitled schedule',
    description: text(row.description),
    maintenanceType: text(pick(row, 'maintenance_type', 'maintenanceType')) ?? 'preventive',
    frequency: text(row.frequency) ?? 'monthly',
    frequencyValue: Number.isFinite(fv) && fv > 0 ? fv : 1,
    nextDueDate: when(pick(row, 'next_due_date', 'nextDueDate')),
    lastCompletedDate: when(pick(row, 'last_completed_date', 'lastCompletedDate')),
    estimatedDuration: dur == null || !Number.isFinite(Number(dur)) ? null : Number(dur),
    status: text(row.status) ?? 'active',
  };
}

const UNIT: Record<string, [string, string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  quarterly: ['quarter', 'quarters'],
  yearly: ['year', 'years'],
};

export function frequencyLabel(frequency: string, value: number): string {
  const unit = UNIT[frequency];
  if (!unit) return frequency;
  return value === 1 ? `Every ${unit[0]}` : `Every ${value} ${unit[1]}`;
}

/** Overdue and due-soon come from the date; an undated schedule is neither. */
export function dueState(
  next: Date | null,
  now: Date = new Date(),
): 'overdue' | 'due-soon' | 'scheduled' | 'undated' {
  if (!next) return 'undated';
  const days = (next.getTime() - now.getTime()) / 86_400_000;
  if (days < 0) return 'overdue';
  if (days <= 7) return 'due-soon';
  return 'scheduled';
}

export function equipmentLabel(row: Row): string {
  const make = text(pick(row, 'manufacturer', 'manufacturer'));
  const model = text(pick(row, 'model_number', 'modelNumber'));
  const serial = text(pick(row, 'serial_number', 'serialNumber'));
  const name = [make, model].filter(Boolean).join(' ') || 'Machine';
  return serial ? `${name} (S/N ${serial})` : name;
}

export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;

export interface CreateScheduleBody {
  equipmentId: string;
  name: string;
  frequency: (typeof FREQUENCIES)[number];
  frequencyValue: number;
  nextDueDate: string;
  estimatedDuration?: number;
}

/**
 * null when the form cannot be sent: equipment_id, name and next_due_date are
 * NOT NULL on the table, and the create branch would otherwise default the
 * due date to "now" and the frequency to monthly without asking.
 */
export function createScheduleBody(input: {
  equipmentId: string;
  name: string;
  frequency: string;
  frequencyValue: string;
  nextDueDate: string;
  estimatedDuration: string;
}): CreateScheduleBody | null {
  const name = input.name.trim();
  const due = input.nextDueDate ? new Date(`${input.nextDueDate}T00:00:00`) : null;
  const value = Math.trunc(Number(input.frequencyValue));
  if (!input.equipmentId || !name || !due || Number.isNaN(due.getTime())) return null;
  if (!(FREQUENCIES as readonly string[]).includes(input.frequency)) return null;
  if (!Number.isFinite(value) || value < 1) return null;
  const dur = input.estimatedDuration === '' ? NaN : Math.trunc(Number(input.estimatedDuration));
  return {
    equipmentId: input.equipmentId,
    name,
    frequency: input.frequency as CreateScheduleBody['frequency'],
    frequencyValue: value,
    nextDueDate: due.toISOString(),
    ...(Number.isFinite(dur) && dur > 0 ? { estimatedDuration: dur } : {}),
  };
}
