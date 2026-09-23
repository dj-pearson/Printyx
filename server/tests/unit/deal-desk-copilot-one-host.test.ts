// Round 172 (route-divergence: deal-desk-copilot). The two hosts disagreed in
// three ways: Express checked no ownership on any per-quote route, the edge
// similar-deals cohort skipped the machine-class and headcount matching
// Express ran (reporting both as 'stub'), and the edge objections prompt had
// no crisis guardrail. The edge function now runs the shared matcher and the
// guardrail, the prefix is proxied, and the Express router is deleted.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const EDGE = strip(readFileSync('supabase/functions/deal-desk-copilot/index.ts', 'utf8'));
const PROXY = strip(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
const REGISTRY = strip(readFileSync('server/routes-registry.ts', 'utf8'));

function similarDealsBody(): string {
  const at = EDGE.indexOf('async function handleSimilarDeals(');
  expect(at).toBeGreaterThan(0);
  return EDGE.slice(at, EDGE.indexOf('\nasync function handleMargin(', at));
}

describe('similar-deals on the edge runs the shared matcher', () => {
  it('filters the cohort through dealMatches with a full profile', () => {
    const body = similarDealsBody();
    expect(body).toMatch(/if \(!dealMatches\(quoteProfile, candProfile\)\) return false;/);
    expect(body).toMatch(/machineClass: machineClassOf\(/);
    expect(body).toMatch(/headcountBand: headcountBand\(/);
  });

  it('imports those from shared/deal-desk-margin.ts, not a local copy', () => {
    const imp = EDGE.slice(0, EDGE.indexOf("from '../../../shared/deal-desk-margin.ts'"));
    const block = imp.slice(imp.lastIndexOf('import {'));
    for (const name of ['dealMatches', 'headcountBand', 'machineClassOf']) {
      expect(block).toMatch(new RegExp(`\\b${name}\\b(?!\\s+as\\b)`));
      expect(EDGE).not.toMatch(new RegExp(`function ${name}\\(`));
    }
  });

  it('no longer reports the matching dimensions as stubs', () => {
    expect(EDGE).not.toMatch(/'stub'/);
    const body = similarDealsBody();
    expect(body).toMatch(/machineClass: quoteMachineClass,/);
    expect(body).toMatch(/headcountBand: quoteHeadcountBand,/);
  });

  it('keys the cache on the matching dimensions, or two quotes share a cohort', () => {
    expect(similarDealsBody()).toMatch(
      /cacheKey = `[^`]*\$\{quoteMachineClass\}[^`]*\$\{quoteHeadcountBand\}`/,
    );
  });
});

describe('the objections prompt carries the crisis guardrail', () => {
  it('wraps its system text in withCrisisGuardrail', () => {
    expect(EDGE).toMatch(/import \{ withCrisisGuardrail \} from '..\/_shared\/crisis-response.ts'/);
    expect(EDGE).toMatch(/withCrisisGuardrail\('You are a deal-desk advisor/);
  });
});

describe('one host', () => {
  it('proxies the whole prefix to the edge function', () => {
    expect(PROXY).toMatch(/'\/api\/deal-desk-copilot':\s*'deal-desk-copilot'/);
  });

  it('the Express router is gone and nothing mounts it', () => {
    expect(existsSync('server/routes-deal-desk-copilot.ts')).toBe(false);
    expect(REGISTRY).not.toMatch(/registerDealDeskCopilotRoutes/);
  });

  it('every per-quote read the edge serves is scoped to the caller', () => {
    expect(EDGE).toMatch(/rowInScope\(/);
  });
});
