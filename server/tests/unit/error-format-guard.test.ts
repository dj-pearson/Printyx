import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * CR-023 guard: the route files migrated to the standardized error helper must
 * not reintroduce ad-hoc `res.status(4xx|5xx).json({ error|message: ... })`
 * shapes. New error responses in these files should call `sendError(...)` so the
 * canonical { message, code, details, requestId } contract is preserved.
 *
 * Extend `MIGRATED_FILES` as more route files adopt sendError.
 */
const MIGRATED_FILES = [
  'server/routes-financial-forecasting.ts',
  'server/routes-tasks.ts',
  'server/routes-billing-core.ts',
];

const AD_HOC_ERROR = /res\.status\((4|5)\d\d\)\.json\(\{\s*(error|message)\s*:/g;

describe('CR-023 standardized error-format guard', () => {
  for (const rel of MIGRATED_FILES) {
    it(`${rel} uses sendError for error responses (no ad-hoc error json)`, () => {
      const abs = path.resolve(process.cwd(), rel);
      const src = fs.readFileSync(abs, 'utf8');
      const matches = src.match(AD_HOC_ERROR) ?? [];
      expect(matches).toEqual([]);
    });
  }
});
