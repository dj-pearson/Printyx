/**
 * The control ai-gpt5 always wanted, taken from the function that already had it
 * (SEC-EDGE-001).
 *
 * `ai-gpt5` sat on the needs-gate worklist from the day that story opened, with
 * the reason recorded honestly: zero writes, but every call costs money at
 * OpenAI and any tenant member can make one, so a level check would look like a
 * fix and change nothing - a manager runs up the same bill. What it wanted was
 * a rate limit or a spend cap.
 *
 * `ai-employee` already had exactly that and nobody had connected the two. The
 * same preset now guards ai-gpt5, and this test locks both sides so the pattern
 * does not drift apart again.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const GPT5 = strip(read('supabase/functions/ai-gpt5/index.ts'));
const EMPLOYEE = strip(read('supabase/functions/ai-employee/index.ts'));

describe('every paid GPT-5 call passes a per-tenant limit', () => {
  it('uses the shared preset rather than a local number', () => {
    // A hand-rolled bucket here would drift from ai-employee's, and the point
    // of the preset is that "expensive AI generation" means one thing.
    expect(GPT5).toContain('PRESETS.aiGenerationPerTenant');
    expect(EMPLOYEE).toContain('PRESETS.aiGenerationPerTenant');
  });

  it('buckets by TENANT, not by user', () => {
    // The bill is the tenant's, and a per-user bucket is defeated by any
    // tenant with several accounts.
    expect(GPT5).toMatch(/requireRateLimit\(\s*`gpt5:\$\{tenantId\}`/);
  });

  it('runs after the method check, so the free config read is not limited', () => {
    // GET /configs returns a static list and costs nothing. Limiting it would
    // spend the tenant's budget on a request that never reaches OpenAI.
    const methodGate = GPT5.indexOf("req.method !== 'POST'");
    const limitAt = GPT5.indexOf('requireRateLimit');
    const configsAt = GPT5.indexOf("action === 'configs'");
    expect(methodGate).toBeGreaterThan(0);
    expect(configsAt).toBeLessThan(methodGate);
    expect(limitAt).toBeGreaterThan(methodGate);
  });

  it('runs before the body is parsed and before any action dispatches', () => {
    // A limit checked after the work has started is not a limit.
    const limitAt = GPT5.indexOf('requireRateLimit');
    expect(limitAt).toBeLessThan(GPT5.indexOf('await req.json()'));
    expect(limitAt).toBeLessThan(GPT5.indexOf("case 'analyze-lead'"));
  });

  it('answers 429 with a retry hint, and rethrows anything else', () => {
    const block = GPT5.slice(GPT5.indexOf('requireRateLimit'));
    expect(block.slice(0, 900)).toContain('err instanceof RateLimitError');
    expect(block.slice(0, 900)).toContain('retryAfterSeconds');
    expect(block.slice(0, 900)).toContain('429');
    expect(block.slice(0, 900)).toContain('throw err;');
  });

  it('ai-employee still limits only the calls that reach Claude', () => {
    // Its cheap list and detail calls deliberately do not pay the cost. If that
    // narrowing were dropped, the tenant budget would be spent on reads.
    expect(EMPLOYEE).toContain('needsAiLimit');
    expect(EMPLOYEE).toMatch(/needsAiLimit[\s\S]{0,200}method === 'POST'/);
  });
});

describe('the worklist reflects it', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json'));
  const byFn = new Map(triage.triage.map((e: { fn: string }) => [e.fn, e]));

  it('ai-gpt5 has left needs-gate', () => {
    const entry = byFn.get('ai-gpt5') as { verdict: string; reason: string };
    expect(entry.verdict).toBe('open-by-design');
    // The reason records WHY it left, so the next reader does not re-file it.
    expect(entry.reason).toContain('rate limit');
  });

  it('the entries that remain still say why a role would not fix them', () => {
    const open = triage.triage.filter((e: { verdict: string }) => e.verdict === 'needs-gate');
    for (const entry of open) {
      expect(entry.reason, `${entry.fn} gives no reason`).toMatch(
        /spend cap|spend limit|rate limit|approval|NOT GATED/i,
      );
    }
  });
});
