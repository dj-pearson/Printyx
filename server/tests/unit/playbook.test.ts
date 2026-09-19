// COP-B13: the write-back allow-list, answer coercion, and completion.
//
// The allow-list is a SECURITY BOUNDARY, not a convenience. `writeBackField` is
// authored through a UI by a tenant admin, so an unchecked string would let
// anybody who can write a playbook write any column on deals, company_contacts
// or business_records — tenant_id and owner_id included — through a path that
// looks like filling in a discovery question. Most of this suite exists to hold
// that line.
import { describe, it, expect } from 'vitest';

import {
  STARTER_PLAYBOOKS,
  WRITE_BACK_FIELDS,
  buildWriteBack,
  coerceAnswer,
  completionOf,
  isWriteBackField,
  writeBackFieldOptions,
} from '../../../supabase/functions/_shared/playbook';
import type { PlaybookQuestion } from '../../../shared/playbook-schema';

const q = (over: Partial<PlaybookQuestion> = {}): PlaybookQuestion => ({
  id: 'q1',
  prompt: 'How many devices?',
  answerType: 'number',
  ...over,
});

describe('WRITE_BACK_FIELDS is an allow-list, and stays one', () => {
  it('rejects a field nobody put on the list', () => {
    expect(isWriteBackField('deal_incumbent_vendor')).toBe(true);
    expect(isWriteBackField('tenant_id')).toBe(false);
    expect(isWriteBackField('deals.tenant_id')).toBe(false);
    expect(isWriteBackField('')).toBe(false);
    expect(isWriteBackField(null)).toBe(false);
  });

  it('cannot be fooled by a prototype key', () => {
    // A plain `key in obj` would say true for these.
    expect(isWriteBackField('constructor')).toBe(false);
    expect(isWriteBackField('toString')).toBe(false);
    expect(isWriteBackField('__proto__')).toBe(false);
  });

  it('NEVER exposes tenancy, ownership, identity or pipeline position', () => {
    const forbidden = [
      'tenant_id',
      'owner_id',
      'id',
      'status',
      'stage_id',
      'amount',
      'created_by_id',
    ];
    const columns = Object.values(WRITE_BACK_FIELDS).map((f) => f.column);
    for (const column of forbidden) {
      expect(columns, `${column} must not be writable from a playbook`).not.toContain(column);
    }
  });

  it('only ever names the three tables a record can own', () => {
    const tables = new Set(Object.values(WRITE_BACK_FIELDS).map((f) => f.table));
    expect([...tables].sort()).toEqual(['business_records', 'company_contacts', 'deals']);
  });

  it('offers every field to the authoring picker, so nobody types a column name', () => {
    expect(writeBackFieldOptions()).toHaveLength(Object.keys(WRITE_BACK_FIELDS).length);
    for (const option of writeBackFieldOptions()) {
      expect(option.label.trim()).not.toBe('');
      expect(option.accepts.length).toBeGreaterThan(0);
    }
  });
});

describe('coerceAnswer', () => {
  it('reads currency the way a rep types it', () => {
    expect(coerceAnswer(q({ answerType: 'currency' }), '$12,500.00')).toEqual({
      ok: true,
      value: 12500,
    });
  });

  it('REFUSES an uncoercible answer rather than writing null over a real value', () => {
    const result = coerceAnswer(q({ answerType: 'number' }), 'about a dozen');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('not a number');
  });

  it('treats an empty answer as unanswered, not as a value', () => {
    for (const blank of ['', null, undefined, []]) {
      expect(coerceAnswer(q(), blank)).toEqual({ ok: true, value: null });
    }
  });

  it('reads the yes/no words people actually use', () => {
    const b = q({ answerType: 'boolean' });
    expect(coerceAnswer(b, 'Yes')).toEqual({ ok: true, value: true });
    expect(coerceAnswer(b, 'n')).toEqual({ ok: true, value: false });
    expect(coerceAnswer(b, false)).toEqual({ ok: true, value: false });
    expect(coerceAnswer(b, 'maybe').ok).toBe(false);
  });

  it('holds a select to its own options', () => {
    const s = q({ answerType: 'select', options: ['Meter read', 'Invoice'] });
    expect(coerceAnswer(s, 'Invoice')).toEqual({ ok: true, value: 'Invoice' });
    expect(coerceAnswer(s, 'Vibes').ok).toBe(false);
  });

  it('rejects a date that is not one', () => {
    expect(coerceAnswer(q({ answerType: 'date' }), 'next Thursday-ish').ok).toBe(false);
    expect(coerceAnswer(q({ answerType: 'date' }), '2026-12-31').ok).toBe(true);
  });
});

describe('buildWriteBack', () => {
  const question = q({
    id: 'vol',
    answerType: 'number',
    writeBackField: 'deal_monthly_volume_color',
  });

  it('writes an allow-listed field to its own table and column', () => {
    const plan = buildWriteBack([question], { vol: '4200' }, ['deals']);
    expect(plan.patches).toEqual({ deals: { current_monthly_volume_color: 4200 } });
    expect(plan.written).toEqual([
      {
        questionId: 'vol',
        field: 'deal_monthly_volume_color',
        table: 'deals',
        column: 'current_monthly_volume_color',
      },
    ]);
  });

  it('DROPS a field that is not on the list, and says why', () => {
    const plan = buildWriteBack(
      [q({ id: 'evil', answerType: 'text', writeBackField: 'tenant_id' })],
      { evil: 'another-tenant' },
      ['deals'],
    );
    expect(plan.patches).toEqual({});
    expect(plan.rejected[0].reason).toContain('not a field a playbook may write');
  });

  it('refuses a field whose table this record cannot write', () => {
    // A deal playbook must not reach a contact row: a deal has many contacts
    // and picking one would be a guess about who an answer describes.
    const plan = buildWriteBack(
      [q({ id: 'title', answerType: 'text', writeBackField: 'contact_title' })],
      { title: 'CFO' },
      ['deals', 'business_records'],
    );
    expect(plan.patches).toEqual({});
    expect(plan.rejected[0].reason).toContain('company_contacts');
  });

  it('never writes null — a skipped question must not wipe the record', () => {
    const plan = buildWriteBack([question], { vol: '' }, ['deals']);
    expect(plan.patches).toEqual({});
    expect(plan.rejected).toEqual([]);
  });

  it('leaves an unanswered question alone entirely', () => {
    expect(buildWriteBack([question], {}, ['deals']).patches).toEqual({});
  });

  it('reports a bad answer rather than writing a coerced-to-zero value', () => {
    const plan = buildWriteBack([question], { vol: 'lots' }, ['deals']);
    expect(plan.patches).toEqual({});
    expect(plan.rejected).toHaveLength(1);
  });

  it('groups several answers into one patch per table', () => {
    const plan = buildWriteBack(
      [
        q({ id: 'bw', answerType: 'number', writeBackField: 'deal_monthly_volume_bw' }),
        q({ id: 'color', answerType: 'number', writeBackField: 'deal_monthly_volume_color' }),
        q({ id: 'comp', answerType: 'text', writeBackField: 'account_competitor_name' }),
      ],
      { bw: 9000, color: 1200, comp: 'Xerox' },
      ['deals', 'business_records'],
    );
    expect(plan.patches.deals).toEqual({
      current_monthly_volume_bw: 9000,
      current_monthly_volume_color: 1200,
    });
    expect(plan.patches.business_records).toEqual({ competitor_name: 'Xerox' });
  });

  it('ignores a question with no write-back target', () => {
    const plan = buildWriteBack([q({ id: 'note', answerType: 'text' })], { note: 'hi' }, ['deals']);
    expect(plan.patches).toEqual({});
    expect(plan.rejected).toEqual([]);
  });
});

describe('completionOf', () => {
  const questions = [
    q({ id: 'a', required: true }),
    q({ id: 'b', required: true }),
    q({ id: 'c' }),
  ];

  it('counts REQUIRED questions, not every question', () => {
    const c = completionOf(questions, { a: 1, c: 'optional' });
    expect(c.requiredTotal).toBe(2);
    expect(c.requiredAnswered).toBe(1);
    expect(c.isComplete).toBe(false);
  });

  it('is complete once every required question is answered', () => {
    expect(completionOf(questions, { a: 1, b: 2 }).isComplete).toBe(true);
  });

  it('does not count a blank as an answer', () => {
    expect(completionOf(questions, { a: '', b: null }).requiredAnswered).toBe(0);
    expect(completionOf(questions, { a: [], b: 0 }).requiredAnswered).toBe(1);
  });

  it('an all-optional playbook completes on any answer, so a gate cannot freeze a deal', () => {
    const optional = [q({ id: 'x' }), q({ id: 'y' })];
    expect(completionOf(optional, {}).isComplete).toBe(false);
    expect(completionOf(optional, { x: 'something' }).isComplete).toBe(true);
  });

  it('an empty playbook is not complete, and does not divide by zero', () => {
    const c = completionOf([], {});
    expect(c.isComplete).toBe(false);
    expect(c.total).toBe(0);
  });
});

describe('STARTER_PLAYBOOKS', () => {
  it('ships the four core copier motions', () => {
    expect(STARTER_PLAYBOOKS.map((p) => p.motion).sort()).toEqual([
      'committee_mapping',
      'fleet_walk',
      'lease_position',
      'volume_qualification',
    ]);
  });

  it('NAMES ONLY FIELDS THAT RESOLVE — a starter that does not silently discards answers', () => {
    for (const playbook of STARTER_PLAYBOOKS) {
      for (const question of playbook.questions) {
        if (!question.writeBackField) continue;
        expect(
          isWriteBackField(question.writeBackField),
          `${playbook.motion}/${question.id} names ${question.writeBackField}`,
        ).toBe(true);
      }
    }
  });

  it('uses an answer type each target column accepts', () => {
    for (const playbook of STARTER_PLAYBOOKS) {
      for (const question of playbook.questions) {
        if (!question.writeBackField) continue;
        const field = WRITE_BACK_FIELDS[question.writeBackField];
        expect(
          field.accepts,
          `${playbook.motion}/${question.id} is ${question.answerType} into ${field.column}`,
        ).toContain(question.answerType);
      }
    }
  });

  it('gives every question a stable, unique id — answers are keyed on it', () => {
    for (const playbook of STARTER_PLAYBOOKS) {
      const ids = playbook.questions.map((q2) => q2.id);
      expect(new Set(ids).size, playbook.motion).toBe(ids.length);
      for (const id of ids) expect(id.trim()).not.toBe('');
    }
  });

  it('asks something required in every motion, so completion means something', () => {
    for (const playbook of STARTER_PLAYBOOKS) {
      expect(
        playbook.questions.some((q2) => q2.required),
        playbook.motion,
      ).toBe(true);
    }
  });

  it('actually writes back somewhere in every motion — otherwise it is a notes template', () => {
    for (const playbook of STARTER_PLAYBOOKS) {
      expect(
        playbook.questions.some((q2) => q2.writeBackField),
        playbook.motion,
      ).toBe(true);
    }
  });
});
