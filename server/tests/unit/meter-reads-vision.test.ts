/**
 * PROD-011 — pure logic behind the meter-reads edge function
 * (supabase/functions/meter-reads/vision.ts).
 *
 * This pipeline writes BILLING rows, so most of these tests are about the ways a
 * bad read must be stopped before it becomes an invoice.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CLARIFY_TEMPLATE,
  DEFAULT_CONFIRM_TEMPLATE,
  FALLBACK_EXTRACTION,
  VALIDATION_STATUSES,
  blackDelta,
  computeValidation,
  credSetMarkers,
  matchCustomerByPhone,
  parseApprove,
  parseInbound,
  parseSettings,
  parseStatusFilter,
  parseSubmit,
  parseVisionResponse,
  projectSettings,
  renderTemplate,
  rollingStats,
  toCamelSubmission,
} from '../../../supabase/functions/meter-reads/vision';

describe('parseVisionResponse', () => {
  it('reads the counters and confidence out of a clean JSON reply', () => {
    const out = parseVisionResponse(
      '{"black":120345,"color":4021,"scan":88,"fax":0,"confidence":0.93}',
    );
    expect(out).toEqual({
      black: 120345,
      color: 4021,
      scan: 88,
      fax: 0,
      confidence: 0.93,
      source: 'ai',
    });
  });

  it('finds the JSON object inside surrounding prose', () => {
    const out = parseVisionResponse(
      'Sure! Here you go:\n{"black":10,"color":0,"scan":0,"fax":0}\nHope that helps.',
    );
    expect(out?.black).toBe(10);
  });

  it('floors negative counters at 0 — a page counter cannot be negative', () => {
    const out = parseVisionResponse('{"black":-500,"color":-1,"scan":0,"fax":0,"confidence":1}');
    expect(out?.black).toBe(0);
    expect(out?.color).toBe(0);
  });

  it('rounds fractional counters — a billing row takes whole pages', () => {
    expect(parseVisionResponse('{"black":1234.7,"color":0,"scan":0,"fax":0}')?.black).toBe(1235);
  });

  it('coerces numeric strings and zeroes anything unusable', () => {
    const out = parseVisionResponse('{"black":"120345","color":"abc","scan":null,"fax":{}}');
    expect(out?.black).toBe(120345);
    expect(out?.color).toBe(0);
    expect(out?.scan).toBe(0);
    expect(out?.fax).toBe(0);
  });

  it('clamps confidence into [0,1] and defaults an unreadable one to 0.5', () => {
    expect(parseVisionResponse('{"black":1,"confidence":5}')?.confidence).toBe(1);
    expect(parseVisionResponse('{"black":1,"confidence":-2}')?.confidence).toBe(0);
    // Absent confidence is "unknown", not "certain".
    expect(parseVisionResponse('{"black":1}')?.confidence).toBe(0.5);
    expect(parseVisionResponse('{"black":1,"confidence":"high"}')?.confidence).toBe(0.5);
  });

  it('returns null when there is no JSON or it will not parse', () => {
    // null makes the caller substitute FALLBACK_EXTRACTION, which is flagged.
    expect(parseVisionResponse("I can't read that photo.")).toBeNull();
    expect(parseVisionResponse('{not json}')).toBeNull();
    expect(parseVisionResponse('')).toBeNull();
  });

  it('marks a parsed result as ai, never fallback', () => {
    expect(parseVisionResponse('{"black":1}')?.source).toBe('ai');
    expect(FALLBACK_EXTRACTION.source).toBe('fallback');
  });
});

describe('rollingStats', () => {
  it('takes the FIRST row as the last reading — rows must be newest-first', () => {
    // A wrong sort compares the new read against the oldest one in the window.
    const out = rollingStats([
      { bw_meter_reading: 500 },
      { bw_meter_reading: 400 },
      { bw_meter_reading: 300 },
    ]);
    expect(out.lastBlack).toBe(500);
    expect(out.rollingAvg).toBe(400);
  });

  it('coerces numeric strings, which is how numeric columns arrive over PostgREST', () => {
    const out = rollingStats([{ bw_meter_reading: '500' }, { bw_meter_reading: '300' }]);
    expect(out.lastBlack).toBe(500);
    expect(out.rollingAvg).toBe(400);
  });

  it('skips nulls and non-numbers rather than treating them as 0', () => {
    // Counting a null as 0 would drag the average down and let a huge jump pass.
    const out = rollingStats([
      { bw_meter_reading: null },
      { bw_meter_reading: 400 },
      { bw_meter_reading: 'n/a' },
      { bw_meter_reading: 200 },
    ]);
    expect(out.lastBlack).toBe(400);
    expect(out.rollingAvg).toBe(300);
  });

  it('reports nulls when there is no usable history', () => {
    expect(rollingStats([])).toEqual({ lastBlack: null, rollingAvg: null });
    expect(rollingStats([{ bw_meter_reading: null }])).toEqual({
      lastBlack: null,
      rollingAvg: null,
    });
  });
});

describe('computeValidation', () => {
  const base = {
    lastBlack: 1000,
    rollingAvg: 1000,
    newBlack: 1200,
    maxDeltaMultiplier: 3,
    extractionSource: 'ai' as const,
  };

  it('passes a normal increase', () => {
    expect(computeValidation(base)).toEqual({ flagged: false, reason: 'Within expected range.' });
  });

  it('flags a counter that went backwards', () => {
    const out = computeValidation({ ...base, newBlack: 900 });
    expect(out.flagged).toBe(true);
    expect(out.reason).toContain('backwards');
    expect(out.reason).toContain('1000 → 900');
  });

  it('flags a jump beyond the multiplier', () => {
    const out = computeValidation({ ...base, newBlack: 1000 + 3001 });
    expect(out.flagged).toBe(true);
    expect(out.reason).toContain('exceeds 3×');
  });

  it('allows a delta exactly at the multiplier — the bound is strict', () => {
    expect(computeValidation({ ...base, newBlack: 1000 + 3000 }).flagged).toBe(false);
  });

  it('honours a changed multiplier', () => {
    expect(computeValidation({ ...base, newBlack: 6000, maxDeltaMultiplier: 10 }).flagged).toBe(
      false,
    );
    expect(computeValidation({ ...base, newBlack: 6000, maxDeltaMultiplier: 1 }).flagged).toBe(
      true,
    );
  });

  it('ALWAYS flags a fallback extraction, even when the numbers look fine', () => {
    // This is the one that matters most: without it a keyless deployment
    // auto-bills every customer a meter read of 0.
    expect(computeValidation({ ...base, extractionSource: 'fallback' }).flagged).toBe(true);
    expect(
      computeValidation({
        lastBlack: null,
        rollingAvg: null,
        newBlack: 0,
        maxDeltaMultiplier: 3,
        extractionSource: 'fallback',
      }).reason,
    ).toContain('fallback');
  });

  it('auto-approves a first-ever read from a real extraction', () => {
    // Nothing to compare against, so the delta checks cannot fire. Intended.
    expect(
      computeValidation({
        lastBlack: null,
        rollingAvg: null,
        newBlack: 50_000,
        maxDeltaMultiplier: 3,
        extractionSource: 'ai',
      }).flagged,
    ).toBe(false);
  });

  it('does not divide by a zero rolling average', () => {
    expect(
      computeValidation({
        lastBlack: 0,
        rollingAvg: 0,
        newBlack: 99_999,
        maxDeltaMultiplier: 3,
        extractionSource: 'ai',
      }).flagged,
    ).toBe(false);
  });

  it('reports the backwards reason ahead of the fallback one', () => {
    // Order matters for the reviewer: "counter went backwards" says which photo
    // to distrust; "extraction unavailable" does not.
    const out = computeValidation({ ...base, newBlack: 900, extractionSource: 'fallback' });
    expect(out.reason).toContain('backwards');
  });
});

describe('blackDelta', () => {
  it('is null with no history and the difference otherwise', () => {
    expect(blackDelta(null, 100)).toBeNull();
    expect(blackDelta(100, 250)).toBe(150);
    expect(blackDelta(250, 100)).toBe(-150);
  });
});

describe('renderTemplate', () => {
  it('substitutes the known tokens', () => {
    expect(renderTemplate('black {{black}}, color {{color}}', { black: 10, color: 2 })).toBe(
      'black 10, color 2',
    );
  });

  it('leaves an unknown token verbatim rather than blanking it', () => {
    // A customer seeing "{{serial}}" knows something is misconfigured; a blank
    // reads as a real, empty value.
    expect(renderTemplate('serial {{serial}}', { black: 1 })).toBe('serial {{serial}}');
  });

  it('does not resolve inherited Object properties', () => {
    expect(renderTemplate('{{toString}}', { black: 1 })).toBe('{{toString}}');
  });

  it('substitutes a repeated token everywhere', () => {
    expect(renderTemplate('{{black}}/{{black}}', { black: 7 })).toBe('7/7');
  });

  it('renders the shipped default confirm template', () => {
    const out = renderTemplate(DEFAULT_CONFIRM_TEMPLATE, { black: 1200, color: 45 });
    expect(out).toContain('black 1200');
    expect(out).toContain('color 45');
    expect(out).not.toContain('{{');
  });
});

describe('matchCustomerByPhone', () => {
  const candidates = [
    { id: 'c1', phone: '(555) 867-5309' },
    { id: 'c2', phone: '555-000-1111' },
    { id: 'c3', phone: null },
  ];

  it('matches on the last 10 digits, ignoring formatting', () => {
    expect(matchCustomerByPhone(candidates, '+1 555 867 5309')).toBe('c1');
    expect(matchCustomerByPhone(candidates, '5550001111')).toBe('c2');
  });

  it('returns null when nothing matches', () => {
    expect(matchCustomerByPhone(candidates, '5559999999')).toBeNull();
  });

  it('returns null for too-few digits rather than matching loosely', () => {
    expect(matchCustomerByPhone(candidates, '5309')).toBeNull();
    expect(matchCustomerByPhone(candidates, '')).toBeNull();
    expect(matchCustomerByPhone(candidates, null)).toBeNull();
  });

  it('AMBIGUITY LOSES — two records on the same number resolve to nobody', () => {
    // Deliberate divergence from Express, which took the first hit. Attributing
    // a meter read to the wrong customer bills the wrong company.
    const dupes = [
      { id: 'c1', phone: '555-867-5309' },
      { id: 'c2', phone: '(555) 867-5309' },
    ];
    expect(matchCustomerByPhone(dupes, '5558675309')).toBeNull();
  });

  it('ignores records with no phone', () => {
    expect(matchCustomerByPhone([{ id: 'c3', phone: null }], '5558675309')).toBeNull();
  });
});

describe('credSetMarkers', () => {
  it('reports the vault envelope shape as set', () => {
    const out = credSetMarkers({
      twilioAccountSid: { blob: 'abc', v: 1 },
      twilioAuthToken: { blob: 'def', v: 1 },
    });
    expect(out.twilioAccountSidSet).toBe(true);
    expect(out.twilioAuthTokenSet).toBe(true);
    expect(out.twilioFromNumberSet).toBe(false);
  });

  it('still reports the legacy base64 string shape as set', () => {
    // Tenants configured before the vault switch must keep reading "configured".
    expect(credSetMarkers({ twilioAccountSid: 'QUMxMjM=' }).twilioAccountSidSet).toBe(true);
  });

  it('reports empty, missing and malformed values as not set', () => {
    expect(credSetMarkers(null).twilioAccountSidSet).toBe(false);
    expect(credSetMarkers({}).twilioAuthTokenSet).toBe(false);
    expect(credSetMarkers({ twilioAccountSid: '' }).twilioAccountSidSet).toBe(false);
    expect(credSetMarkers({ twilioAccountSid: { blob: '' } }).twilioAccountSidSet).toBe(false);
    expect(credSetMarkers({ twilioAccountSid: { v: 1 } }).twilioAccountSidSet).toBe(false);
    expect(credSetMarkers({ twilioAccountSid: 12345 }).twilioAccountSidSet).toBe(false);
  });

  it('never returns anything but booleans', () => {
    const out = credSetMarkers({ twilioAuthToken: { blob: 'secret-ciphertext', v: 1 } });
    for (const value of Object.values(out)) expect(typeof value).toBe('boolean');
    expect(JSON.stringify(out)).not.toContain('secret-ciphertext');
  });
});

describe('projectSettings', () => {
  it('projects templates, threshold and markers — and no credentials', () => {
    const out = projectSettings('t1', {
      max_delta_multiplier: 5,
      confirm_template: 'ok {{black}}',
      clarify_template: 'which machine?',
      encrypted_config: { twilioAuthToken: { blob: 'ciphertext', v: 1 } },
      updated_at: '2026-08-07T00:00:00.000Z',
    });
    expect(out).toEqual({
      tenantId: 't1',
      maxDeltaMultiplier: 5,
      confirmTemplate: 'ok {{black}}',
      clarifyTemplate: 'which machine?',
      updatedAt: '2026-08-07T00:00:00.000Z',
      twilioAccountSidSet: false,
      twilioAuthTokenSet: true,
      twilioFromNumberSet: false,
    });
    expect(JSON.stringify(out)).not.toContain('ciphertext');
  });

  it('falls back to the shipped defaults for a null row', () => {
    const out = projectSettings('t1', null);
    expect(out.maxDeltaMultiplier).toBe(3);
    expect(out.confirmTemplate).toBe(DEFAULT_CONFIRM_TEMPLATE);
    expect(out.clarifyTemplate).toBe(DEFAULT_CLARIFY_TEMPLATE);
  });

  it('coerces the multiplier, which arrives as a string over PostgREST', () => {
    expect(projectSettings('t1', { max_delta_multiplier: '7' }).maxDeltaMultiplier).toBe(7);
    expect(projectSettings('t1', { max_delta_multiplier: 'oops' }).maxDeltaMultiplier).toBe(3);
  });
});

describe('toCamelSubmission', () => {
  const row = {
    id: 's1',
    tenant_id: 't1',
    source: 'sms',
    from_phone: '5558675309',
    customer_id: 'c1',
    machine_id: 'm1',
    raw_image_url: 'https://example.test/a.jpg',
    image_hash: 'deadbeef',
    extracted_values: { black: 120, color: 4, source: 'ai' },
    validation_status: 'flagged',
    validation_detail: { reason: 'Black counter went backwards (500 → 120).', lastBlack: 500 },
    outbound_message: 'which machine?',
    meter_reading_id: null,
    submitted_at: '2026-08-07T00:00:00.000Z',
    reviewed_by_user_id: null,
    reviewed_at: null,
    created_at: '2026-08-07T00:00:00.000Z',
  };

  it('emits the camelCase keys the review page reads', () => {
    const out = toCamelSubmission(row);
    expect(out.validationStatus).toBe('flagged');
    expect(out.fromPhone).toBe('5558675309');
    expect(out.rawImageUrl).toBe('https://example.test/a.jpg');
    expect(out.machineId).toBe('m1');
    expect(out.submittedAt).toBe('2026-08-07T00:00:00.000Z');
  });

  it('emits no snake_case keys at all', () => {
    for (const key of Object.keys(toCamelSubmission(row))) expect(key).not.toContain('_');
  });

  it('leaves the jsonb columns untouched', () => {
    // The page reads extractedValues.black and validationDetail.reason — those
    // inner keys are data we wrote, not columns to convert.
    const out = toCamelSubmission(row);
    expect(out.extractedValues).toEqual({ black: 120, color: 4, source: 'ai' });
    expect((out.validationDetail as { reason: string }).reason).toContain('backwards');
  });

  it('nulls absent columns instead of leaving them undefined', () => {
    const out = toCamelSubmission({ id: 's2' });
    expect(out.validationStatus).toBeNull();
    expect(out.extractedValues).toBeNull();
    expect(out.rawImageUrl).toBeNull();
  });
});

describe('parseStatusFilter', () => {
  it('accepts every real status', () => {
    for (const status of VALIDATION_STATUSES) expect(parseStatusFilter(status)).toBe(status);
  });

  it('treats absent and "all" as no filter', () => {
    expect(parseStatusFilter(null)).toBeNull();
    expect(parseStatusFilter('all')).toBeNull();
  });

  it('drops an unrecognised status rather than filtering on it', () => {
    // Filtering on a value no row can hold would show an empty queue and read as
    // "nothing to review".
    expect(parseStatusFilter('APPROVED')).toBeNull();
    expect(parseStatusFilter('; drop table')).toBeNull();
  });
});

describe('parseInbound', () => {
  it('accepts an empty body — every field is optional', () => {
    expect(parseInbound({})).toEqual({ ok: true, value: {} });
  });

  it('carries the supplied fields through', () => {
    const out = parseInbound({ fromPhone: '5551234567', imageUrl: 'https://x.test/a.jpg' });
    expect(out.ok && out.value).toEqual({
      fromPhone: '5551234567',
      imageUrl: 'https://x.test/a.jpg',
    });
  });

  it('rejects an empty string rather than storing it', () => {
    expect(parseInbound({ fromPhone: '' }).ok).toBe(false);
    expect(parseInbound({ machineId: 123 }).ok).toBe(false);
  });
});

describe('parseSubmit', () => {
  it('requires machineId and defaults source to web', () => {
    expect(parseSubmit({ machineId: 'm1' })).toEqual({
      ok: true,
      value: { machineId: 'm1', source: 'web' },
    });
    expect(parseSubmit({}).ok).toBe(false);
    expect(parseSubmit({ machineId: '' }).ok).toBe(false);
  });

  it('accepts only web or manual as the source', () => {
    expect(parseSubmit({ machineId: 'm1', source: 'manual' }).ok).toBe(true);
    // 'sms' belongs to the inbound webhook, not a web submission.
    expect(parseSubmit({ machineId: 'm1', source: 'sms' }).ok).toBe(false);
  });
});

describe('parseApprove', () => {
  it('accepts an empty body — the reviewer may approve the extracted values as-is', () => {
    expect(parseApprove({})).toEqual({ ok: true, value: {} });
  });

  it('accepts non-negative integer overrides', () => {
    expect(parseApprove({ black: 0, color: 5 })).toEqual({
      ok: true,
      value: { black: 0, color: 5 },
    });
  });

  it('rejects negative, fractional and non-numeric counters', () => {
    // These become a billing row, so a fractional or negative override is a
    // rejection, not something to coerce.
    expect(parseApprove({ black: -1 }).ok).toBe(false);
    expect(parseApprove({ black: 1.5 }).ok).toBe(false);
    expect(parseApprove({ black: '100' }).ok).toBe(false);
  });

  it('treats an omitted counter as "keep the extracted value"', () => {
    const out = parseApprove({ black: undefined, color: null });
    expect(out.ok && 'black' in out.value).toBe(false);
    expect(out.ok && 'color' in out.value).toBe(false);
  });
});

describe('parseSettings', () => {
  it('accepts an empty body', () => {
    expect(parseSettings({})).toEqual({ ok: true, value: {} });
  });

  it('bounds the multiplier to an integer in [1,100]', () => {
    expect(parseSettings({ maxDeltaMultiplier: 1 }).ok).toBe(true);
    expect(parseSettings({ maxDeltaMultiplier: 100 }).ok).toBe(true);
    expect(parseSettings({ maxDeltaMultiplier: 0 }).ok).toBe(false);
    expect(parseSettings({ maxDeltaMultiplier: 101 }).ok).toBe(false);
    expect(parseSettings({ maxDeltaMultiplier: 2.5 }).ok).toBe(false);
    expect(parseSettings({ maxDeltaMultiplier: '3' }).ok).toBe(false);
  });

  it('allows an EMPTY template — clearing one is a legitimate edit', () => {
    expect(parseSettings({ confirmTemplate: '' })).toEqual({
      ok: true,
      value: { confirmTemplate: '' },
    });
  });

  it('caps templates at 1000 characters', () => {
    expect(parseSettings({ clarifyTemplate: 'x'.repeat(1000) }).ok).toBe(true);
    expect(parseSettings({ clarifyTemplate: 'x'.repeat(1001) }).ok).toBe(false);
  });

  it('rejects an EMPTY credential, unlike a template', () => {
    // Storing '' would flip the *_set marker on for a credential that is not
    // there, so the operator would believe Twilio is configured.
    expect(parseSettings({ twilioAuthToken: '' }).ok).toBe(false);
    expect(parseSettings({ twilioAccountSid: 'AC123' }).ok).toBe(true);
  });
});
