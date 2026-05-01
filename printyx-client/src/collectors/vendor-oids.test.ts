// Unit tests for vendor detection. Run with:
//   npx tsx --test src/collectors/vendor-oids.test.ts
//
// Uses Node's built-in test runner (no jest/vitest dependency needed).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { detectVendor, counterOidsFor, VENDOR_COUNTERS } from './vendor-oids';

test('detectVendor: sysObjectID prefix matches HP', () => {
  assert.equal(detectVendor('1.3.6.1.4.1.11.2.3.9.1.1.7.0'), 'hp');
});

test('detectVendor: sysObjectID prefix matches Konica Minolta', () => {
  assert.equal(detectVendor('1.3.6.1.4.1.18334.1.1.1.1'), 'konicaMinolta');
});

test('detectVendor: sysObjectID with leading dot is normalised', () => {
  assert.equal(detectVendor('.1.3.6.1.4.1.1602.5.4.7.1'), 'canon');
});

test('detectVendor: unrelated sysObjectID falls through to sysDescr', () => {
  assert.equal(detectVendor('1.3.6.1.4.1.99999.1.2.3', 'Brother HL-L8360CDW series'), 'brother');
});

test('detectVendor: bizhub keyword maps to Konica Minolta', () => {
  assert.equal(detectVendor(undefined, 'KONICA MINOLTA bizhub C658'), 'konicaMinolta');
});

test('detectVendor: TASKalfa keyword maps to Kyocera', () => {
  assert.equal(detectVendor(undefined, 'KYOCERA TASKalfa 3554ci'), 'kyocera');
});

test('detectVendor: returns "unknown" with no input', () => {
  assert.equal(detectVendor(), 'unknown');
});

test('detectVendor: bare "HP" abbreviation in sysDescr', () => {
  assert.equal(detectVendor(undefined, 'HP LaserJet Pro M404dn'), 'hp');
  // Make sure we don't trip on substrings inside other words.
  assert.equal(detectVendor(undefined, 'Sharp MX-3050N'), 'sharp');
  assert.notEqual(detectVendor(undefined, 'Sharp MX-3050N'), 'hp');
});

test('counterOidsFor: returns empty for unknown vendor', () => {
  assert.deepEqual(counterOidsFor('unknown'), {});
});

test('counterOidsFor: returns the same object as VENDOR_COUNTERS for known vendor', () => {
  assert.equal(counterOidsFor('xerox'), VENDOR_COUNTERS.xerox);
});

test('VENDOR_COUNTERS: every entry has at least a total or fallback path', () => {
  // Each vendor map must either expose a total counter, or the collector
  // will fall back to walking prtMarkerLifeCount. This test catches an
  // accidentally empty map when adding a new vendor.
  for (const [vendor, oids] of Object.entries(VENDOR_COUNTERS)) {
    const hasAny = Boolean(oids.total || oids.bw || oids.color || oids.large || oids.serialNumber);
    assert.ok(hasAny, `${vendor} has an empty OID map`);
  }
});
