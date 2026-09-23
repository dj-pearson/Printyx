// Round 170. Express gates AI CSV import on the ai_csv_import plan feature.
// The import edge function carries no plan check, and that is only safe
// because it serves no AI path at all. This test holds that premise: it fails
// the day an AI branch there does real work without a plan or feature check.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const EDGE = strip(readFileSync('supabase/functions/import/index.ts', 'utf8'));
const hasPlanCheck =
  /ai_csv_import|requireFeature|planFeature|subscription_plans|tenant_subscriptions/.test(EDGE);

describe('import edge function: AI paths', () => {
  it('status reports AI unavailable, unless a plan check exists', () => {
    const at = EDGE.indexOf("pathParts[1] === 'status'");
    expect(at).toBeGreaterThan(0);
    if (!hasPlanCheck) {
      expect(EDGE.slice(at, at + 200)).toMatch(/available:\s*false/);
    }
  });

  it('map-columns refuses with 503, unless a plan check exists', () => {
    const at = EDGE.indexOf("pathParts[1] === 'map-columns'");
    expect(at).toBeGreaterThan(0);
    const branch = EDGE.slice(at, EDGE.indexOf("pathParts[1] === 'status'", at));
    if (!hasPlanCheck) {
      expect(branch).toMatch(/\n\s*503,/);
      expect(branch).not.toMatch(/anthropic|openai|claude/i);
    }
  });

  it('has no ai-process branch, unless a plan check exists', () => {
    if (!hasPlanCheck) expect(EDGE).not.toContain('ai-process');
  });
});
