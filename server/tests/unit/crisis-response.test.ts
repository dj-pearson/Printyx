/**
 * Unit Tests: server/lib/crisis-response.ts (LEGAL-012)
 *
 * Nothing handled a user disclosing self-harm or an emergency. That is low risk
 * today, because every conversational surface is authenticated internal B2B and
 * the only unauthenticated endpoints do not talk back. It stops being low risk
 * the day a chatbot is exposed to end customers, which is a routing change.
 *
 * Two properties are worth pinning down, and they pull against each other:
 * the detector must fire on a real disclosure, and it must NOT fire on ordinary
 * frustrated business English. A detector that trips on "this deadline is
 * killing me" trains people to ignore it, and an ignored safety response is
 * worse than none because it looks like coverage.
 */

import { describe, it, expect } from 'vitest';
import {
  CRISIS_SYSTEM_DIRECTIVE,
  crisisResponse,
  detectsCrisis,
  withCrisisGuardrail,
} from '../../lib/crisis-response';

describe('detectsCrisis - fires on a real disclosure', () => {
  const disclosures = [
    'i want to kill myself',
    'I am going to kill my self',
    'thinking about suicide',
    'I feel suicidal',
    'I want to end my life',
    'I want to die',
    "I don't want to live anymore",
    'I have been harming myself',
    'i keep hurting myself',
    'self-harm is the only thing that helps',
    'there is no reason to go on',
    'everyone would be better off without me',
    'kms',
  ];

  for (const text of disclosures) {
    it(`fires on: "${text}"`, () => {
      expect(detectsCrisis(text)).toBe(true);
    });
  }

  it('fires when the disclosure is buried in an ordinary question', () => {
    expect(
      detectsCrisis('can you pull the meter reading for unit 4? honestly i want to die lately'),
    ).toBe(true);
  });
});

describe('detectsCrisis - stays quiet on ordinary business English', () => {
  const benign = [
    'this deadline is killing me',
    'the printer is dead again',
    'kill the job in the queue',
    'that contract is dead in the water',
    'my laptop died',
    'we killed the feature last sprint',
    'this quote is a nightmare',
    'I am dying to see the new dashboard',
    'end of life for this device model',
    'terminate the lease early',
  ];

  for (const text of benign) {
    it(`stays quiet on: "${text}"`, () => {
      // A detector that fires here trains people to ignore it.
      expect(detectsCrisis(text)).toBe(false);
    });
  }

  it('treats empty input as nothing to act on', () => {
    expect(detectsCrisis('')).toBe(false);
    expect(detectsCrisis('   ')).toBe(false);
  });
});

describe('crisisResponse', () => {
  it('gives specific resources, not a gesture at getting help', () => {
    const r = crisisResponse();
    expect(r).toContain('988');
    expect(r).toContain('741741');
    expect(r).toContain('911');
  });

  it('does not continue the product conversation', () => {
    // Answering the meter-billing question in the same breath signals that the
    // disclosure was processed as noise.
    const r = crisisResponse().toLowerCase();
    for (const word of ['quote', 'invoice', 'subscription', 'printyx', 'contract']) {
      expect(r).not.toContain(word);
    }
  });

  it('does not refuse the person', () => {
    // Someone who discloses distress and is told "I cannot discuss that" has
    // been shut out at the worst possible moment.
    const r = crisisResponse().toLowerCase();
    expect(r).not.toContain('cannot help');
    expect(r).not.toContain("can't discuss");
  });
});

describe('withCrisisGuardrail', () => {
  it('appends the directive to a system prompt', () => {
    const result = withCrisisGuardrail('You are a support assistant.');
    expect(result).toContain('You are a support assistant.');
    expect(result).toContain('988');
  });

  it('is idempotent, so a layered prompt does not carry it twice', () => {
    const once = withCrisisGuardrail('base');
    const twice = withCrisisGuardrail(once);
    expect(twice).toBe(once);
  });

  it('tolerates an empty prompt rather than throwing', () => {
    expect(withCrisisGuardrail('')).toContain('988');
  });
});

describe('CRISIS_SYSTEM_DIRECTIVE', () => {
  it('instructs the model to stop the task rather than answer alongside it', () => {
    expect(CRISIS_SYSTEM_DIRECTIVE).toMatch(/stop the task/i);
    expect(CRISIS_SYSTEM_DIRECTIVE).toMatch(/do not continue/i);
  });

  it('tells the model not to refuse, which is its own unsafe response', () => {
    expect(CRISIS_SYSTEM_DIRECTIVE).toMatch(/do not refuse/i);
  });
});
