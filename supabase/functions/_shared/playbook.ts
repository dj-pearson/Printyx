/**
 * Playbook write-back, completion, and the starter motions (COP-B13).
 *
 * Pure. Three things live here, and the first one is why the file exists at all.
 *
 * 1. WRITE_BACK_FIELDS IS AN ALLOW-LIST, NOT A CONVENIENCE.
 *
 *    A playbook question names the column its answer fills. That string is
 *    authored by a tenant admin through a UI, so if it reached PostgREST
 *    unchecked, anybody who could write a playbook could write ANY column on
 *    `deals`, `company_contacts` or `business_records` — tenant_id and owner_id
 *    included — through a path that looks like filling in a discovery question.
 *    Only the keys below resolve; anything else is dropped and reported.
 *
 *    This is also why the allow-list carries the TABLE. A key cannot be pointed
 *    at a different table by editing the playbook, and a deal playbook can
 *    never write a contact row.
 *
 * 2. COERCION IS PART OF THE WRITE, not a formatting nicety. A currency answer
 *    typed as "$12,500" has to reach a numeric column as 12500 or the write
 *    fails with a 22P02 that surfaces as "could not save". An answer that
 *    cannot be coerced is REFUSED rather than written as null, because a null
 *    overwrites a real value that was already there.
 *
 * 3. COMPLETION IS COUNTED FROM REQUIRED QUESTIONS ONLY. A playbook with twelve
 *    optional questions is not 8% complete because a rep answered one.
 */

import type { PlaybookAnswerType, PlaybookQuestion } from '../../../shared/playbook-schema.ts';

export type WriteBackTable = 'deals' | 'company_contacts' | 'business_records';

export interface WriteBackField {
  /** Human label, for the authoring UI's field picker. */
  label: string;
  table: WriteBackTable;
  column: string;
  /** The answer types that make sense for this column. */
  accepts: PlaybookAnswerType[];
}

/**
 * Every column a playbook answer may fill. Adding one here is a deliberate act;
 * there is no wildcard and no "any column on deals" escape.
 *
 * Deliberately absent, and they must stay absent: tenant_id, owner_id, id,
 * status, stage_id, amount. Ownership, tenancy and pipeline position are not
 * discovery answers, and a question that moved a deal's stage or its owner
 * would be an authorization hole wearing a questionnaire.
 */
export const WRITE_BACK_FIELDS: Record<string, WriteBackField> = {
  // ── COP-M04 copier facts on the deal ──────────────────────────────
  deal_incumbent_vendor: {
    label: 'Incumbent vendor',
    table: 'deals',
    column: 'incumbent_vendor',
    accepts: ['text', 'select'],
  },
  deal_lease_buyout_exposure: {
    label: 'Lease buyout exposure',
    table: 'deals',
    column: 'lease_buyout_exposure',
    accepts: ['currency', 'number'],
  },
  deal_trade_in_value: {
    label: 'Trade-in value',
    table: 'deals',
    column: 'trade_in_value',
    accepts: ['currency', 'number'],
  },
  deal_monthly_volume_bw: {
    label: 'Current monthly B/W volume',
    table: 'deals',
    column: 'current_monthly_volume_bw',
    accepts: ['number'],
  },
  deal_monthly_volume_color: {
    label: 'Current monthly colour volume',
    table: 'deals',
    column: 'current_monthly_volume_color',
    accepts: ['number'],
  },
  deal_target_cpc_black: {
    label: 'Target CPC (B/W)',
    table: 'deals',
    column: 'target_cpc_black',
    accepts: ['number', 'currency'],
  },
  deal_target_cpc_color: {
    label: 'Target CPC (colour)',
    table: 'deals',
    column: 'target_cpc_color',
    accepts: ['number', 'currency'],
  },
  deal_motion: {
    label: 'Deal motion',
    table: 'deals',
    column: 'deal_motion',
    accepts: ['select', 'text'],
  },
  deal_forecast_category: {
    label: 'Forecast category',
    table: 'deals',
    column: 'forecast_category',
    accepts: ['select'],
  },
  deal_estimated_monthly_value: {
    label: 'Estimated recurring monthly value',
    table: 'deals',
    column: 'estimated_monthly_value',
    accepts: ['currency', 'number'],
  },
  deal_expected_close_date: {
    label: 'Expected close date',
    table: 'deals',
    column: 'expected_close_date',
    accepts: ['date'],
  },
  deal_next_follow_up_date: {
    label: 'Next step date',
    table: 'deals',
    column: 'next_follow_up_date',
    accepts: ['date'],
  },

  // ── Committee mapping, on the contact ─────────────────────────────
  contact_title: {
    label: 'Title',
    table: 'company_contacts',
    column: 'title',
    accepts: ['text'],
  },
  contact_department: {
    label: 'Department',
    table: 'company_contacts',
    column: 'department',
    accepts: ['text', 'select'],
  },
  contact_reports_to: {
    label: 'Reports to',
    table: 'company_contacts',
    column: 'reports_to',
    accepts: ['text'],
  },
  contact_is_primary: {
    label: 'Primary contact',
    table: 'company_contacts',
    column: 'is_primary_contact',
    accepts: ['boolean'],
  },

  // ── Account-level discovery ───────────────────────────────────────
  account_competitor_name: {
    label: 'Competitor',
    table: 'business_records',
    column: 'competitor_name',
    accepts: ['text', 'select'],
  },
};

export function isWriteBackField(key: unknown): key is string {
  return typeof key === 'string' && Object.hasOwn(WRITE_BACK_FIELDS, key);
}

/** The picker payload for the authoring UI. */
export function writeBackFieldOptions() {
  return Object.entries(WRITE_BACK_FIELDS).map(([key, field]) => ({
    key,
    label: field.label,
    table: field.table,
    accepts: field.accepts,
  }));
}

// ── Coercion ──────────────────────────────────────────────────────────

export type Coerced =
  | { ok: true; value: string | number | boolean | string[] | null }
  | { ok: false; reason: string };

/** '$12,500.00' -> 12500. Currency and thousands separators are what reps type. */
function toNumeric(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw ?? '')
    .replace(/[$,\s]/g, '')
    .trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function coerceAnswer(question: PlaybookQuestion, raw: unknown): Coerced {
  // An empty answer is "not answered", which is a legitimate state and must not
  // become a write. Clearing a field is an edit on the record, not a blank
  // question - otherwise skipping a question wipes whatever was already there.
  if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) {
    return { ok: true, value: null };
  }

  switch (question.answerType) {
    case 'number':
    case 'currency': {
      const n = toNumeric(raw);
      if (n == null) return { ok: false, reason: `"${String(raw)}" is not a number` };
      return { ok: true, value: n };
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return { ok: true, value: raw };
      const s = String(raw).toLowerCase();
      if (['true', 'yes', 'y', '1'].includes(s)) return { ok: true, value: true };
      if (['false', 'no', 'n', '0'].includes(s)) return { ok: true, value: false };
      return { ok: false, reason: `"${String(raw)}" is not a yes or no` };
    }
    case 'date': {
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) return { ok: false, reason: `"${String(raw)}" is not a date` };
      return { ok: true, value: d.toISOString() };
    }
    case 'select': {
      const s = String(raw);
      if (question.options?.length && !question.options.includes(s)) {
        return { ok: false, reason: `"${s}" is not one of the offered answers` };
      }
      return { ok: true, value: s };
    }
    case 'multiselect': {
      const list = (Array.isArray(raw) ? raw : [raw]).map((v) => String(v));
      const bad = question.options?.length
        ? list.filter((v) => !question.options!.includes(v))
        : [];
      if (bad.length) return { ok: false, reason: `${bad.join(', ')} not offered` };
      return { ok: true, value: list };
    }
    default:
      return { ok: true, value: String(raw) };
  }
}

// ── Write-back ────────────────────────────────────────────────────────

export interface WriteBackPlan {
  /** table -> { column: value }. One patch per table. */
  patches: Record<string, Record<string, unknown>>;
  /** Field keys that were written, for the run's log. */
  written: Array<{ questionId: string; field: string; table: string; column: string }>;
  /** Questions whose answer could not be used, and why. Reported, never silent. */
  rejected: Array<{ questionId: string; reason: string }>;
}

/**
 * Turn a set of answers into per-table patches.
 *
 * Skips, by rule and in this order: a question whose writeBackField is not in
 * the allow-list; an answer that does not coerce; a null answer (see
 * coerceAnswer — a blank question must not wipe the record); and a field whose
 * table does not match the record being worked, so a deal playbook cannot write
 * a contact row.
 */
export function buildWriteBack(
  questions: PlaybookQuestion[],
  answers: Record<string, unknown>,
  allowedTables: WriteBackTable[],
): WriteBackPlan {
  const patches: Record<string, Record<string, unknown>> = {};
  const written: WriteBackPlan['written'] = [];
  const rejected: WriteBackPlan['rejected'] = [];

  for (const question of questions ?? []) {
    const key = question.writeBackField;
    if (!key) continue;

    if (!isWriteBackField(key)) {
      rejected.push({
        questionId: question.id,
        reason: `"${key}" is not a field a playbook may write`,
      });
      continue;
    }

    const field = WRITE_BACK_FIELDS[key];
    if (!allowedTables.includes(field.table)) {
      rejected.push({
        questionId: question.id,
        reason: `${field.label} lives on ${field.table}, which this record cannot write`,
      });
      continue;
    }

    if (!Object.hasOwn(answers ?? {}, question.id)) continue;

    const coerced = coerceAnswer(question, answers[question.id]);
    if (!coerced.ok) {
      rejected.push({ questionId: question.id, reason: coerced.reason });
      continue;
    }
    if (coerced.value === null) continue;

    patches[field.table] ??= {};
    patches[field.table][field.column] = coerced.value;
    written.push({
      questionId: question.id,
      field: key,
      table: field.table,
      column: field.column,
    });
  }

  return { patches, written, rejected };
}

// ── Completion ────────────────────────────────────────────────────────

export interface PlaybookCompletion {
  requiredTotal: number;
  requiredAnswered: number;
  total: number;
  answered: number;
  isComplete: boolean;
}

function isAnswered(value: unknown): boolean {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Completion counts REQUIRED questions. A playbook of twelve optional questions
 * is not 8% complete because a rep answered one, and a progress bar that says
 * so is what teaches reps to ignore progress bars.
 *
 * A playbook with no required questions is complete once ANY answer exists -
 * otherwise a purely optional playbook could never be finished and an
 * admin-configured gate on it would block the deal forever.
 */
export function completionOf(
  questions: PlaybookQuestion[],
  answers: Record<string, unknown>,
): PlaybookCompletion {
  const list = questions ?? [];
  const required = list.filter((q) => q.required);
  const requiredAnswered = required.filter((q) => isAnswered(answers?.[q.id])).length;
  const answered = list.filter((q) => isAnswered(answers?.[q.id])).length;

  return {
    requiredTotal: required.length,
    requiredAnswered,
    total: list.length,
    answered,
    isComplete: required.length > 0 ? requiredAnswered === required.length : answered > 0,
  };
}

// ── Starter playbooks (AC2) ───────────────────────────────────────────

export interface StarterPlaybook {
  motion: string;
  name: string;
  description: string;
  appliesTo: 'deal' | 'contact' | 'company';
  questions: PlaybookQuestion[];
}

/**
 * The four core copier motions, as real questions with real write-back targets.
 *
 * Every writeBackField below is checked against WRITE_BACK_FIELDS by
 * server/tests/unit/playbook.test.ts, so a starter cannot ship naming a field
 * that does not resolve - which would be a playbook that silently discards
 * every answer to that question.
 */
export const STARTER_PLAYBOOKS: StarterPlaybook[] = [
  {
    motion: 'fleet_walk',
    name: 'Fleet walk',
    description: 'What is on the floor today, and what it is costing them.',
    appliesTo: 'deal',
    questions: [
      {
        id: 'fw_device_count',
        prompt: 'How many devices are on the floor?',
        answerType: 'number',
        required: true,
      },
      {
        id: 'fw_incumbent',
        prompt: 'Whose machines are they?',
        helpText: 'The vendor on the current agreement, not the machine brand if they differ.',
        answerType: 'text',
        writeBackField: 'deal_incumbent_vendor',
        required: true,
      },
      {
        id: 'fw_oldest_age',
        prompt: 'How old is the oldest device still in service?',
        answerType: 'text',
      },
      {
        id: 'fw_pain',
        prompt: 'What breaks, and how often?',
        helpText: 'Ask for the last three service calls by name, not a general impression.',
        answerType: 'text',
      },
    ],
  },
  {
    motion: 'volume_qualification',
    name: 'Volume and workflow qualification',
    description: 'The numbers that decide the tier, and what the paper is actually for.',
    appliesTo: 'deal',
    questions: [
      {
        id: 'vq_bw_volume',
        prompt: 'Monthly B/W volume?',
        answerType: 'number',
        writeBackField: 'deal_monthly_volume_bw',
        required: true,
      },
      {
        id: 'vq_color_volume',
        prompt: 'Monthly colour volume?',
        answerType: 'number',
        writeBackField: 'deal_monthly_volume_color',
        required: true,
      },
      {
        id: 'vq_source',
        prompt: 'Where did those numbers come from?',
        helpText: 'A meter read beats an invoice; an invoice beats a guess.',
        answerType: 'select',
        options: ['Meter read', 'Invoice', 'Customer estimate', 'Our own estimate'],
        required: true,
      },
      {
        id: 'vq_peak',
        prompt: 'Is there a seasonal peak, and when?',
        answerType: 'text',
      },
    ],
  },
  {
    motion: 'lease_position',
    name: 'Lease position and buyout',
    description: 'Whose paper they are on, when it ends, and what it costs to leave.',
    appliesTo: 'deal',
    questions: [
      {
        id: 'lp_lessor',
        prompt: 'Who holds the lease?',
        helpText: 'Often not the dealer. Ask for the lessor on the invoice.',
        answerType: 'text',
        required: true,
      },
      {
        id: 'lp_end_date',
        prompt: 'When does the term end?',
        answerType: 'date',
        required: true,
      },
      {
        id: 'lp_buyout',
        prompt: 'What is the buyout figure today?',
        helpText: 'Ask them to request it in writing from the lessor before you quote.',
        answerType: 'currency',
        writeBackField: 'deal_lease_buyout_exposure',
        required: true,
      },
      {
        id: 'lp_trade_in',
        prompt: 'Is there trade-in value in the current fleet?',
        answerType: 'currency',
        writeBackField: 'deal_trade_in_value',
      },
    ],
  },
  {
    motion: 'committee_mapping',
    name: 'Decision committee',
    description: 'Who signs, who blocks, and who has to live with it.',
    appliesTo: 'deal',
    questions: [
      {
        id: 'cm_signer',
        prompt: 'Who signs the agreement?',
        answerType: 'text',
        required: true,
      },
      {
        id: 'cm_budget_owner',
        prompt: 'Whose budget does this come out of?',
        answerType: 'text',
        required: true,
      },
      {
        id: 'cm_daily_user',
        prompt: 'Who runs the devices day to day?',
        helpText: 'The person who calls for service. They rarely sign and often decide.',
        answerType: 'text',
      },
      {
        id: 'cm_blocker',
        prompt: 'Who would say no, and on what grounds?',
        answerType: 'text',
      },
      {
        id: 'cm_next_step',
        prompt: 'What is the agreed next step, and when?',
        answerType: 'date',
        writeBackField: 'deal_next_follow_up_date',
        required: true,
      },
    ],
  },
];
