/**
 * Locks the customer-portal service classifier ported to Deno in
 * supabase/functions/portal-service/classify.ts (PROD-011).
 *
 * The edge function is now the only implementation that runs (dev proxies
 * /api/portal-service to it; production has no Express), and there is no Deno in
 * CI, so nothing else in the suite can reach this code.
 *
 * What this drives: a customer types a problem in plain English, and the output
 * sets a dispatch PRIORITY and the PARTS a technician is told to bring. The AI
 * path is best-effort — the rule path is the floor and must always produce
 * something usable, so the coercion boundary (where a bad model reply is
 * rejected) matters as much as the rules themselves.
 */

import { describe, it, expect } from 'vitest';
import {
  GENERAL_PLAYBOOK,
  buildClassifyPrompt,
  buildTimeline,
  coerceParts,
  coercePlaybook,
  coercePriority,
  fallbackClassify,
  isMissingTableOrTypeError,
  parseAiClassification,
  reachedAtFromHistory,
  statusToStepIndex,
  toRequestPriority,
} from '../../../supabase/functions/portal-service/classify.ts';

describe('fallbackClassify', () => {
  it('routes each symptom family to its category and priority', () => {
    expect(fallbackClassify('the machine is making a grinding noise')).toMatchObject({
      category: 'mechanical_noise',
      suggestedPriority: 'high',
      source: 'fallback',
    });
    expect(fallbackClassify('paper keeps jamming in tray 2')).toMatchObject({
      category: 'paper_jam',
      suggestedPriority: 'medium',
    });
    expect(fallbackClassify('prints have streaks down the page')).toMatchObject({
      category: 'print_quality',
      suggestedPriority: 'medium',
    });
    expect(fallbackClassify('we are out of toner')).toMatchObject({
      category: 'supplies',
      suggestedPriority: 'low',
    });
    expect(fallbackClassify('the network connection dropped')).toMatchObject({
      category: 'connectivity',
      suggestedPriority: 'high',
    });
  });

  /**
   * KNOWN DEFECT, ported faithfully and pinned here so a fix shows up as an
   * intentional test change rather than a surprise.
   *
   * print_quality's pattern includes the bare word `line`, and "offLINE"
   * contains it. Because print_quality is checked BEFORE connectivity, ANY text
   * containing "offline" — the single most common way a customer reports a
   * connectivity fault — is classified as a print-quality defect instead.
   *
   * Consequence: priority is set to medium rather than high, and the technician
   * is told to bring a drum unit and transfer belt instead of a NIC.
   *
   * Not fixed here: this is a prod-404 port, and silently changing which
   * category a customer's issue lands in is a behavior change beyond that scope.
   * The fix is a word-boundary pattern (`\\blines?\\b`), which needs its own
   * review against the other rules.
   */
  it('MISCLASSIFIES "offline" as print_quality — known defect, see comment', () => {
    expect(fallbackClassify('the printer shows offline on the network')).toMatchObject({
      category: 'print_quality',
      suggestedPriority: 'medium',
    });
    expect(fallbackClassify('printer is offline')).toMatchObject({ category: 'print_quality' });
  });

  it('falls through to general with a usable playbook and no parts', () => {
    const c = fallbackClassify('something feels off with the device');
    expect(c.category).toBe('general');
    expect(c.recommendedParts).toEqual([]);
    expect(c.playbook).toEqual(GENERAL_PLAYBOOK);
    // Lower confidence than a matched rule — nothing was actually recognised.
    expect(c.confidence).toBe(0.3);
  });

  it('is case-insensitive', () => {
    expect(fallbackClassify('GRINDING NOISE').category).toBe('mechanical_noise');
  });

  it('applies FIRST-match ordering, which is behavior and not decoration', () => {
    // Mentions both a noise and a jam — mechanical_noise is listed first because
    // grinding is the more urgent symptom, so it must win.
    expect(fallbackClassify('grinding noise and the paper jams').category).toBe('mechanical_noise');
    // "low" is a supplies keyword, but print_quality is checked first and
    // "quality" matches, so a quality complaint is not demoted to supplies.
    expect(fallbackClassify('print quality is low').category).toBe('print_quality');
  });

  it('always returns a non-empty playbook, whatever the text', () => {
    for (const text of ['', '???', 'grinding', 'zzzz']) {
      expect(fallbackClassify(text).playbook.steps.length).toBeGreaterThan(0);
    }
  });
});

describe('coercion of model output', () => {
  it('accepts only the four real priorities and defaults the rest to medium', () => {
    expect(coercePriority('urgent')).toBe('urgent');
    expect(coercePriority('HIGH')).toBe('high');
    // A model inventing a severity must not reach dispatch.
    expect(coercePriority('catastrophic')).toBe('medium');
    expect(coercePriority(null)).toBe('medium');
    expect(coercePriority(7)).toBe('medium');
  });

  it('accepts both camelCase and snake_case part numbers', () => {
    const parts = coerceParts([
      { partNumber: 'A-1', name: 'Roller', reason: 'worn' },
      { part_number: 'B-2', name: 'Belt', reason: 'slipping' },
    ]);
    expect(parts).toEqual([
      { partNumber: 'A-1', name: 'Roller', reason: 'worn' },
      { partNumber: 'B-2', name: 'Belt', reason: 'slipping' },
    ]);
  });

  it('drops junk entries and caps the list at five', () => {
    expect(coerceParts('not an array')).toEqual([]);
    expect(coerceParts([null, 'x', 42])).toEqual([]);
    // An entry with neither a name nor a part number tells a technician nothing.
    expect(coerceParts([{ reason: 'because' }])).toEqual([]);
    expect(coerceParts(Array.from({ length: 20 }, (_, i) => ({ name: `p${i}` })))).toHaveLength(5);
  });

  it('keeps the rule playbook when the model supplies none or an empty one', () => {
    const fb = GENERAL_PLAYBOOK;
    expect(coercePlaybook(null, fb)).toEqual(fb);
    expect(coercePlaybook('nope', fb)).toEqual(fb);
    // Steps are the actionable part — an empty array must not replace real ones.
    expect(coercePlaybook({ key: 'k', title: 't', steps: [] }, fb).steps).toEqual(fb.steps);
    expect(coercePlaybook({ steps: ['do a thing'] }, fb)).toEqual({
      key: fb.key,
      title: fb.title,
      steps: ['do a thing'],
    });
  });
});

describe('parseAiClassification', () => {
  const fb = fallbackClassify('grinding noise');

  it('extracts a classification from a reply with surrounding prose', () => {
    const out = parseAiClassification(
      'Sure:\n{"category":"paper_jam","suggestedPriority":"high","recommendedParts":[],"playbook":{"key":"pj","title":"PJ","steps":["a"]},"confidence":0.9}\nthanks',
      fb,
    );
    expect(out).toMatchObject({ category: 'paper_jam', suggestedPriority: 'high', source: 'ai' });
    expect(out!.confidence).toBe(0.9);
  });

  it('returns null on unusable replies so the caller falls back', () => {
    expect(parseAiClassification('no json at all', fb)).toBeNull();
    expect(parseAiClassification('{ broken json', fb)).toBeNull();
  });

  it('falls back field-by-field rather than rejecting a partly-good reply', () => {
    const out = parseAiClassification('{"confidence":0.5}', fb)!;
    // Category and playbook come from the rule result; nothing is invented.
    expect(out.category).toBe(fb.category);
    expect(out.playbook).toEqual(fb.playbook);
    expect(out.suggestedPriority).toBe('medium');
    expect(out.source).toBe('ai');
  });

  it('clamps confidence into 0..1 and defaults a garbled one to 0.7', () => {
    expect(parseAiClassification('{"confidence":5}', fb)!.confidence).toBe(1);
    expect(parseAiClassification('{"confidence":-3}', fb)!.confidence).toBe(0);
    // Not the rule's 0.4 — an AI answer with a missing score is still an AI answer.
    expect(parseAiClassification('{"confidence":"high"}', fb)!.confidence).toBe(0.7);
    expect(parseAiClassification('{}', fb)!.confidence).toBe(0.7);
  });

  it('ignores a blank category instead of emitting one', () => {
    expect(parseAiClassification('{"category":"   "}', fb)!.category).toBe(fb.category);
  });
});

describe('buildClassifyPrompt', () => {
  it('embeds the customer text and demands JSON only', () => {
    const p = buildClassifyPrompt('it grinds');
    expect(p).toContain('it grinds');
    expect(p).toContain('Return ONLY JSON');
    expect(p).toContain('suggestedPriority');
  });
});

describe('toRequestPriority', () => {
  it('maps onto the enum, translating medium to normal', () => {
    expect(toRequestPriority('urgent')).toBe('urgent');
    expect(toRequestPriority('high')).toBe('high');
    expect(toRequestPriority('low')).toBe('low');
    // The request enum has no 'medium'.
    expect(toRequestPriority('medium')).toBe('normal');
  });
});

describe('isMissingTableOrTypeError', () => {
  it('recognises the schema-not-deployed codes that degrade dispatch', () => {
    expect(isMissingTableOrTypeError({ code: '42P01' })).toBe(true); // undefined_table
    expect(isMissingTableOrTypeError({ code: '42703' })).toBe(true); // undefined_column
    expect(isMissingTableOrTypeError({ code: '42704' })).toBe(true); // undefined_object
    expect(isMissingTableOrTypeError({ message: 'relation "x" does not exist' })).toBe(true);
    expect(isMissingTableOrTypeError({ message: 'invalid input value for enum' })).toBe(true);
  });

  it('does NOT swallow real write failures', () => {
    // These must propagate — degrading them would lose a ticket silently.
    expect(isMissingTableOrTypeError({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isMissingTableOrTypeError({ code: '23503', message: 'foreign key violation' })).toBe(
      false,
    );
    expect(isMissingTableOrTypeError(null)).toBe(false);
    expect(isMissingTableOrTypeError({})).toBe(false);
  });
});

describe('timeline', () => {
  it('maps each request status to its furthest reached step', () => {
    expect(statusToStepIndex('submitted')).toBe(0);
    expect(statusToStepIndex('acknowledged')).toBe(0);
    expect(statusToStepIndex('on_hold')).toBe(0);
    expect(statusToStepIndex('assigned')).toBe(1);
    expect(statusToStepIndex('in_progress')).toBe(3);
    expect(statusToStepIndex('completed')).toBe(4);
    expect(statusToStepIndex('cancelled')).toBe(-1);
    expect(statusToStepIndex(null)).toBe(0);
    expect(statusToStepIndex('nonsense')).toBe(0);
  });

  it('marks earlier steps done and the reached step current', () => {
    const steps = buildTimeline('assigned');
    expect(steps.map((s) => s.status)).toEqual([
      'done',
      'current',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('marks a COMPLETED request final step done, not current', () => {
    // Otherwise "Resolved" renders as still-in-progress forever.
    const steps = buildTimeline('completed');
    expect(steps.map((s) => s.status)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('leaves every step pending for a cancelled request', () => {
    // The work stopped rather than progressed — nothing should be highlighted.
    expect(buildTimeline('cancelled').every((s) => s.status === 'pending')).toBe(true);
  });

  it('attaches the FIRST timestamp each step was reached', () => {
    const history = [
      { newStatus: 'submitted', createdAt: '2026-01-01T00:00:00Z' },
      { newStatus: 'acknowledged', createdAt: '2026-01-02T00:00:00Z' }, // same step 0 — ignored
      { newStatus: 'assigned', createdAt: '2026-01-03T00:00:00Z' },
    ];
    const reached = reachedAtFromHistory(history);
    expect(reached[0]).toBe('2026-01-01T00:00:00.000Z');
    expect(reached[1]).toBe('2026-01-03T00:00:00.000Z');

    const steps = buildTimeline('assigned', reached);
    expect(steps[0].at).toBe('2026-01-01T00:00:00.000Z');
    expect(steps[2].at).toBeNull();
  });

  it('ignores cancelled and timestamp-less history rows', () => {
    const reached = reachedAtFromHistory([
      { newStatus: 'cancelled', createdAt: '2026-01-01T00:00:00Z' },
      { newStatus: 'assigned', createdAt: null },
    ]);
    expect(reached).toEqual({});
  });
});
