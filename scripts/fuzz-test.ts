#!/usr/bin/env tsx
/**
 * API Fuzz-Test Script (SEC-006)
 *
 * Generates edge-case / adversarial inputs and tests them against
 * the OpenAPI validation middleware to verify it correctly rejects
 * dangerous payloads while accepting valid ones.
 *
 * Usage:
 *   npm run test:fuzz
 *   npx tsx scripts/fuzz-test.ts
 *
 * The script exits 0 when all cases behave as expected and writes
 * results to stdout as a JSON report.
 */

import {
  exceedsMaxDepth,
  findDangerousStrings,
  findUnknownProperties,
} from '../server/middleware/openapi-validator';
import { businessRecordSchemas, dealSchemas, userSchemas } from '../server/middleware/enhanced-validation';
import { z, ZodSchema } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FuzzCase {
  /** Human-readable name of the test. */
  name: string;
  /** The input payload. */
  payload: unknown;
  /** Which check this targets. */
  check: 'schema' | 'depth' | 'dangerous_chars' | 'unknown_props' | 'boundary';
  /** Schema to validate against (if applicable). */
  schema?: ZodSchema;
  /** Whether we expect the input to be accepted (true) or rejected (false). */
  expectValid: boolean;
}

interface FuzzResult {
  name: string;
  check: string;
  expectValid: boolean;
  actualValid: boolean;
  pass: boolean;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Fuzz payloads
// ---------------------------------------------------------------------------

function buildFuzzCases(): FuzzCase[] {
  const cases: FuzzCase[] = [];

  // ---- 1. Boundary values -------------------------------------------------

  cases.push({
    name: 'Empty object to business-records create',
    payload: {},
    check: 'schema',
    schema: businessRecordSchemas.create,
    expectValid: false,
  });

  cases.push({
    name: 'Valid minimal business-record',
    payload: { companyName: 'Acme Corp' },
    check: 'schema',
    schema: businessRecordSchemas.create,
    expectValid: true,
  });

  cases.push({
    name: 'Extremely long company name (10k chars)',
    payload: { companyName: 'A'.repeat(10_000) },
    check: 'schema',
    schema: businessRecordSchemas.create,
    expectValid: false,
  });

  cases.push({
    name: 'Zero-length string for required field',
    payload: { companyName: '' },
    check: 'schema',
    schema: businessRecordSchemas.create,
    expectValid: false,
  });

  // ---- 2. Type confusion ---------------------------------------------------

  cases.push({
    name: 'Number where string expected (companyName)',
    payload: { companyName: 12345 },
    check: 'schema',
    schema: businessRecordSchemas.create,
    expectValid: false,
  });

  cases.push({
    name: 'Array where string expected',
    payload: { companyName: ['Acme', 'Corp'] },
    check: 'schema',
    schema: businessRecordSchemas.create,
    expectValid: false,
  });

  cases.push({
    name: 'Boolean where string expected',
    payload: { companyName: true },
    check: 'schema',
    schema: businessRecordSchemas.create,
    expectValid: false,
  });

  cases.push({
    name: 'Object where string expected',
    payload: { companyName: { nested: 'value' } },
    check: 'schema',
    schema: businessRecordSchemas.create,
    expectValid: false,
  });

  cases.push({
    name: 'String where number expected (deal amount)',
    payload: { name: 'Deal', customerId: '550e8400-e29b-41d4-a716-446655440000', amount: 'not-a-number' },
    check: 'schema',
    schema: dealSchemas.create,
    expectValid: false,
  });

  // ---- 3. Null bytes & control characters ----------------------------------

  cases.push({
    name: 'Null byte in company name',
    payload: { companyName: 'Acme\x00Corp' },
    check: 'dangerous_chars',
    expectValid: false,
  });

  cases.push({
    name: 'Bell character in string',
    payload: { name: 'Hello\x07World' },
    check: 'dangerous_chars',
    expectValid: false,
  });

  cases.push({
    name: 'DEL character in string',
    payload: { description: 'test\x7Fvalue' },
    check: 'dangerous_chars',
    expectValid: false,
  });

  cases.push({
    name: 'C1 control character (0x8F)',
    payload: { notes: 'data\x8Fhere' },
    check: 'dangerous_chars',
    expectValid: false,
  });

  cases.push({
    name: 'Allowed whitespace characters (tab, newline)',
    payload: { description: 'line1\tline2\nline3' },
    check: 'dangerous_chars',
    expectValid: true,
  });

  cases.push({
    name: 'Clean string - no dangerous chars',
    payload: { companyName: 'Perfectly Normal Company LLC' },
    check: 'dangerous_chars',
    expectValid: true,
  });

  cases.push({
    name: 'Null byte nested inside array',
    payload: { items: [{ name: 'ok' }, { name: 'bad\x00value' }] },
    check: 'dangerous_chars',
    expectValid: false,
  });

  // ---- 4. Deeply nested objects --------------------------------------------

  const deepObject = (depth: number): unknown => {
    let obj: unknown = { value: 'leaf' };
    for (let i = 0; i < depth; i++) {
      obj = { nested: obj };
    }
    return obj;
  };

  cases.push({
    name: 'Object at depth 5 (within limit)',
    payload: deepObject(5),
    check: 'depth',
    expectValid: true,
  });

  cases.push({
    name: 'Object at depth 11 (exceeds limit)',
    payload: deepObject(11),
    check: 'depth',
    expectValid: false,
  });

  cases.push({
    name: 'Object at depth 50 (far exceeds limit)',
    payload: deepObject(50),
    check: 'depth',
    expectValid: false,
  });

  cases.push({
    name: 'Deeply nested arrays',
    payload: { data: [[[[[[[[[[['too deep']]]]]]]]]]] },
    check: 'depth',
    expectValid: false,
  });

  // ---- 5. Unknown / additional properties ----------------------------------

  cases.push({
    name: 'Known property only',
    payload: { companyName: 'Acme' },
    check: 'unknown_props',
    schema: businessRecordSchemas.create,
    expectValid: true,
  });

  cases.push({
    name: 'Extra unknown property __proto__',
    payload: { companyName: 'Acme', __proto__: { admin: true } },
    check: 'unknown_props',
    schema: businessRecordSchemas.create,
    expectValid: false,
  });

  cases.push({
    name: 'Extra unknown property isAdmin',
    payload: { companyName: 'Acme', isAdmin: true },
    check: 'unknown_props',
    schema: businessRecordSchemas.create,
    expectValid: false,
  });

  cases.push({
    name: 'Extra unknown property constructor',
    payload: { companyName: 'Acme', constructor: {} },
    check: 'unknown_props',
    schema: businessRecordSchemas.create,
    expectValid: false,
  });

  // ---- 6. Unicode edge cases -----------------------------------------------

  cases.push({
    name: 'Unicode emoji in company name',
    payload: { companyName: 'Rocket Co 🚀' },
    check: 'schema',
    schema: businessRecordSchemas.create,
    expectValid: true,
  });

  cases.push({
    name: 'RTL override character',
    payload: { companyName: 'Hello \u202E dlroW' },
    check: 'dangerous_chars',
    expectValid: false,
  });

  cases.push({
    name: 'Zero-width joiner (harmless unicode)',
    payload: { companyName: 'Test\u200DCompany' },
    check: 'dangerous_chars',
    expectValid: true,
  });

  // ---- 7. Oversized payloads -----------------------------------------------

  cases.push({
    name: 'Payload with 1000 keys',
    payload: Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [`key_${i}`, `value_${i}`]),
    ),
    check: 'unknown_props',
    schema: businessRecordSchemas.create,
    expectValid: false,
  });

  return cases;
}

// ---------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------

function runCase(c: FuzzCase): FuzzResult {
  let actualValid: boolean;
  let detail: string | undefined;

  try {
    switch (c.check) {
      case 'schema': {
        if (!c.schema) throw new Error('Schema required for schema check');
        const result = c.schema.safeParse(c.payload);
        actualValid = result.success;
        if (!result.success) {
          detail = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        }
        break;
      }

      case 'depth': {
        const tooDeep = exceedsMaxDepth(c.payload, 10);
        actualValid = !tooDeep;
        if (tooDeep) detail = 'Exceeds max nesting depth of 10';
        break;
      }

      case 'dangerous_chars': {
        const violations = findDangerousStrings(c.payload);
        actualValid = violations.length === 0;
        if (violations.length > 0) {
          detail = `Dangerous chars at: ${violations.join(', ')}`;
        }
        break;
      }

      case 'unknown_props': {
        if (!c.schema) throw new Error('Schema required for unknown_props check');
        const unknowns = findUnknownProperties(
          c.payload as Record<string, unknown>,
          c.schema,
        );
        actualValid = unknowns.length === 0;
        if (unknowns.length > 0) {
          detail = `Unknown properties: ${unknowns.join(', ')}`;
        }
        break;
      }

      case 'boundary': {
        if (!c.schema) throw new Error('Schema required for boundary check');
        const result = c.schema.safeParse(c.payload);
        actualValid = result.success;
        break;
      }

      default:
        throw new Error(`Unknown check type: ${c.check}`);
    }
  } catch (err) {
    actualValid = false;
    detail = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  return {
    name: c.name,
    check: c.check,
    expectValid: c.expectValid,
    actualValid,
    pass: actualValid === c.expectValid,
    ...(detail ? { detail } : {}),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const cases = buildFuzzCases();
  const results: FuzzResult[] = cases.map(runCase);

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = results.length;

  const report = {
    summary: {
      total,
      passed,
      failed,
      passRate: `${((passed / total) * 100).toFixed(1)}%`,
      timestamp: new Date().toISOString(),
    },
    results,
  };

  // Output full JSON report to stdout
  console.log(JSON.stringify(report, null, 2));

  // Also print a human-readable summary to stderr
  console.error(`\nFuzz Test Results: ${passed}/${total} passed (${failed} failed)`);

  if (failed > 0) {
    console.error('\nFailed cases:');
    for (const r of results.filter((r) => !r.pass)) {
      console.error(`  FAIL: ${r.name}`);
      console.error(`    Expected valid=${r.expectValid}, got valid=${r.actualValid}`);
      if (r.detail) console.error(`    Detail: ${r.detail}`);
    }
    process.exit(1);
  }

  console.error('All fuzz tests passed.');
  process.exit(0);
}

main();
