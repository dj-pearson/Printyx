/**
 * Two edge endpoints fetched a URL the caller chose and handed the answer back
 * (SEC-002, round 118).
 *
 * An edge function runs inside the deployment's network with the service-role
 * key in scope, so an unchecked outbound request is a request from there to
 * anywhere the cluster can reach. These two were worse than blind requests:
 *
 *   seo   POST /seo/check/security takes `body.url`, fetches it, and returns
 *         the RESPONSE HEADERS. POST /seo/detect/redirect-chains takes
 *         `body.sourceUrl` and returns every hop with its status and Location.
 *   webhooks  POST /webhooks/:id/test POSTs to a caller-configured URL and
 *         stores `response_body` in webhook_logs, where the caller reads it.
 *
 * The control already existed and reached exactly one function. A SUPERVISOR
 * gate gets no credit here: a role check says who may make the request, not
 * where it goes.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { summariseRedirectChain } from '@shared/seo-checks';
import { validateUrl } from '../../middleware/ssrf-protection';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (src: string) =>
  src
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const SEO = stripComments(read('supabase/functions/seo/index.ts'));
const WEBHOOKS = stripComments(read('supabase/functions/webhooks/index.ts'));

/** A branch body, bounded by the next branch rather than by a character count. */
function branchAfter(src: string, marker: string): string {
  const at = src.indexOf(marker);
  expect({ marker, found: at > -1 }).toEqual({ marker, found: true });
  const rest = src.slice(at + marker.length);
  const next = rest.search(/\n\s{4}if \(req\.method/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('the SEO analyser no longer fetches whatever it is handed', () => {
  it('check/security goes through safeFetch', () => {
    const body = branchAfter(SEO, "resourceId === 'security'");
    expect(body).toMatch(/await safeFetch\(targetUrl\)/);
    // The bare call is gone, not merely joined by a safe one.
    expect(body).not.toMatch(/=\s*await fetch\(targetUrl\)/);
  });

  it('a refusal is 400, not the 502 that claims we tried', () => {
    const body = branchAfter(SEO, "resourceId === 'security'");
    const at = body.indexOf('err instanceof SSRFError');
    expect(at).toBeGreaterThan(-1);
    // Bounded by the NEXT branch, not by a character count. Block comments are
    // blanked to spaces so line numbers stay honest, which means a fixed window
    // spans that whitespace and runs into the branch after this one - the fifth
    // costume of "a window is not a scope" in this repo's history.
    const unreachable = body.indexOf('Could not reach', at);
    expect(unreachable).toBeGreaterThan(at);
    const block = body.slice(at, unreachable);
    expect(block).toMatch(/BLOCKED_URL/);
    // The status, wherever prettier put it - a newline-anchored match asserts
    // the formatter's choices rather than the response's.
    expect(block).toMatch(/,\s*400,\s*req\)/);
    // And the unreachable branch still exists for a real network failure.
    expect(body).toMatch(/Could not reach \$\{targetUrl\}/);
  });

  it('the https probe validates rather than delegating, because it must see the 3xx', () => {
    const body = branchAfter(SEO, "resourceId === 'security'");
    const assertAt = body.indexOf('await assertSafeUrl(insecure.href)');
    const probeAt = body.indexOf('await fetch(insecure.href');
    expect(assertAt).toBeGreaterThan(-1);
    expect(probeAt).toBeGreaterThan(assertAt);
    // safeFetch would resolve the redirect and answer the wrong question.
    expect(body).not.toMatch(/safeFetch\(insecure\.href/);
    expect(body).toMatch(/redirect: 'manual'/);
  });

  it('the redirect walker validates every hop, not just the one the caller sent', () => {
    const body = branchAfter(SEO, "resourceId === 'redirect-chains'");
    const loopAt = body.indexOf('for (let hop = 0');
    const assertAt = body.indexOf('await assertSafeUrl(currentUrl)');
    const fetchAt = body.indexOf('await fetch(currentUrl');
    expect(loopAt).toBeGreaterThan(-1);
    // Inside the loop, and above the request it guards.
    expect(assertAt).toBeGreaterThan(loopAt);
    expect(fetchAt).toBeGreaterThan(assertAt);
  });

  it('a hop refused mid-chain is reported, not swallowed', () => {
    const body = branchAfter(SEO, "resourceId === 'redirect-chains'");
    // It used to fall into `if (steps.length === 0)`, miss, and vanish - so a
    // chain cut short at a private address summarised as a normal terminus.
    expect(body).toMatch(/blockedAt = currentUrl;/);
    expect(body).toMatch(/summariseRedirectChain\(steps, \{ loop, truncated, blockedAt \}\)/);
  });
});

describe('a chain with no destination is not stored as though it had one', () => {
  it('the edge function withholds the row and says why', () => {
    const body = branchAfter(SEO, "resourceId === 'redirect-chains'");
    const guard = body.indexOf('result.destinationUrl === null');
    const insert = body.indexOf("from('seo_redirect_analysis').insert(");
    expect(guard).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(guard);
    expect(body).toMatch(/stored: false/);
    expect(body).toMatch(/unstoredReason/);
  });

  it('the Express twin does the same, and stops spreading into the insert', () => {
    // `destination_url` is NOT NULL, so a null would be a 23502 on the edge
    // side and a type error on this one - and the spread also carried
    // `blockedAt`, which has no column: drizzle drops an unknown key silently.
    const src = stripComments(read('server/routes-seo.ts'));
    const at = src.indexOf('const redirects = await detectRedirectChains(sourceUrl);');
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, src.indexOf('res.json(stored);', at));
    expect(body).toMatch(/redirects\.destinationUrl === null/);
    expect(body).not.toMatch(/\.\.\.redirects,\n\s+checkedAt/);
    expect(body).toMatch(/destinationUrl: redirects\.destinationUrl,/);
  });

  it('the column really is NOT NULL, which is why the row is withheld', () => {
    // Read from the DECLARATION rather than through drizzle's getTableConfig.
    // Importing @shared/drizzle-schema here pulled the whole schema into the
    // worker and broke storage-tenant-scope.test.ts nine tests later - green
    // alone, green in a pair, red in the full run - so the cheap check that
    // needs no module graph is the right one. shared/seo-schema.ts IS the
    // source of truth for this column.
    const schema = read('shared/seo-schema.ts');
    const start = schema.indexOf('export const seoRedirectAnalysis = pgTable(');
    expect(start).toBeGreaterThan(-1);
    const body = schema.slice(start, schema.indexOf('\n);', start));
    const decl = body.split('\n').find((l) => /^\s+destinationUrl:/.test(l));
    expect(decl).toBeTruthy();
    expect(decl).toMatch(/\.notNull\(\)/);
  });
});

describe('a chain that did not reach an end has no destination', () => {
  const hop = (url: string, statusCode: number, location: string | null = null) => ({
    url,
    statusCode,
    location,
  });

  it('reports the destination when the walk finished', () => {
    const r = summariseRedirectChain([
      hop('http://a.example/', 301, 'https://a.example/'),
      hop('https://a.example/', 200),
    ]);
    expect(r.destinationUrl).toBe('https://a.example/');
    expect(r.blockedAt).toBeNull();
    expect(r.truncated).toBe(false);
  });

  it('answers null and names the hop when one was refused', () => {
    const r = summariseRedirectChain(
      [hop('https://a.example/', 302, 'http://169.254.169.254/latest/meta-data/')],
      { blockedAt: 'http://169.254.169.254/latest/meta-data/' },
    );
    expect(r.destinationUrl).toBeNull();
    expect(r.blockedAt).toBe('http://169.254.169.254/latest/meta-data/');
    expect(r.issues.join(' ')).toMatch(/private or reserved address/);
    // The hops that WERE observed are still returned; only the claim about
    // where the chain ends is withheld.
    expect(r.chainLength).toBe(1);
  });

  it('answers null when the walk hit the hop limit', () => {
    // The module's header has always said returning the last hop is "a claim
    // that the redirect ended there"; it used to return it anyway.
    const r = summariseRedirectChain([hop('https://a.example/', 301, 'https://b.example/')], {
      truncated: true,
    });
    expect(r.destinationUrl).toBeNull();
    expect(r.truncated).toBe(true);
  });

  it('a loop keeps its destination, because it has one', () => {
    const r = summariseRedirectChain([hop('https://a.example/', 301, 'https://a.example/')], {
      loop: true,
    });
    expect(r.destinationUrl).toBe('https://a.example/');
    expect(r.issues).toContain('Redirect loop detected');
  });

  it('does not also call a blocked chain "multiple redirects"', () => {
    const r = summariseRedirectChain(
      [
        hop('https://a/', 301, 'https://b/'),
        hop('https://b/', 302, 'http://10.0.0.1/'),
        hop('http://10.0.0.1/', 0),
      ],
      { blockedAt: 'http://10.0.0.1/' },
    );
    expect(r.issues.some((i) => i.includes('private or reserved'))).toBe(true);
    expect(r.issues).not.toContain('Multiple redirects in chain');
  });
});

describe('the page does not print a destination it was not given', () => {
  const PAGE = read('client/src/pages/SEODashboard.tsx');

  it('types destinationUrl as nullable', () => {
    expect(PAGE).toMatch(/destinationUrl: string \| null;/);
  });

  it('renders the reason instead of an empty "Final:"', () => {
    expect(PAGE).toMatch(/chain\.destinationUrl \? \(/);
    expect(PAGE).toMatch(/chain\.blockedAt/);
  });
});

describe('the webhook test delivery', () => {
  it('goes through safeFetch', () => {
    const at = WEBHOOKS.indexOf("subResource === 'test'");
    expect(at).toBeGreaterThan(-1);
    const body = WEBHOOKS.slice(at, WEBHOOKS.indexOf("subResource === 'regenerate-secret'", at));
    expect(body).toMatch(/await safeFetch\(webhook\.url,/);
    expect(body).not.toMatch(/await fetch\(webhook\.url,/);
  });

  it('tells the operator whether it was refused or unreachable', () => {
    const at = WEBHOOKS.indexOf("subResource === 'test'");
    const body = WEBHOOKS.slice(at, WEBHOOKS.indexOf("subResource === 'regenerate-secret'", at));
    expect(body).toMatch(/error instanceof SSRFError/);
    expect(body).toMatch(/private or reserved address/);
    expect(body).toMatch(/Failed to reach webhook URL/);
  });

  it('the role gate is still there, and is not the control', () => {
    // SEC-EDGE-001 gated this function at SUPERVISOR. That says who may send
    // the request; safeFetch says where it may go. Both, or neither is enough.
    expect(WEBHOOKS).toMatch(/requireIntegrationAdmin\(\)/);
    expect(WEBHOOKS).toMatch(/safeFetch\(/);
  });
});

describe('the addresses this closes', () => {
  it('the metadata endpoint and loopback are refused', () => {
    // Behavioural, against the Node copy the edge copy is asserted to match by
    // ssrf-parity.test.ts.
    expect(validateUrl('http://169.254.169.254/latest/meta-data/').valid).toBe(false);
    expect(validateUrl('http://127.0.0.1:5432/').valid).toBe(false);
    expect(validateUrl('http://10.0.0.5/').valid).toBe(false);
    expect(validateUrl('http://kubernetes.default.svc/').valid).toBe(false);
  });

  it('an ordinary customer site still analyses', () => {
    expect(validateUrl('https://www.example.com/pricing').valid).toBe(true);
  });
});

describe('the guard that finds the rest', () => {
  it('reports nothing new, and its baseline is triaged rather than listed', async () => {
    const { findings } = await import('../../../scripts/check-ssrf-fetch.mjs');
    const baseline = JSON.parse(read('docs/ssrf-fetch-baseline.json'));
    const keys = [...new Set((findings() as { key: string }[]).map((f) => f.key))].sort();
    expect(keys).toEqual([...baseline.entries].sort());
    expect(baseline.entries.length).toBeGreaterThan(0);
    expect(new Set(baseline.entries).size).toBe(baseline.entries.length);
    // Groups, with a reason each - not an undifferentiated list.
    expect(baseline.note).toMatch(/TENANT-CONFIGURED ENDPOINT/);
    expect(baseline.note).toMatch(/URL FOUND IN CONTENT/);
    expect(baseline.note).toMatch(/WORKLIST, NOT SETTLED DEBT/);
  });

  it('the walk reads a real corpus, so one that stops matching fails here', async () => {
    const { edgeFiles } = await import('../../../scripts/check-ssrf-fetch.mjs');
    const files = edgeFiles() as string[];
    expect(files.length).toBeGreaterThan(400);
    expect(files.every((f) => f.endsWith('.ts'))).toBe(true);
    // The two functions this round fixed are in it, so the walk reaches them.
    expect(files.some((f) => f.endsWith('functions/seo/index.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('functions/webhooks/index.ts'))).toBe(true);
  });

  it('the two it was written for are NOT in it', () => {
    const baseline = JSON.parse(read('docs/ssrf-fetch-baseline.json'));
    for (const fn of ['functions/seo/index.ts', 'functions/webhooks/index.ts']) {
      expect({ fn, baselined: baseline.entries.some((e: string) => e.includes(fn)) }).toEqual({
        fn,
        baselined: false,
      });
    }
  });

  it('it strips line comments before block comments', async () => {
    // A line comment ending in `/*` is read as a block opener by a block-first
    // pass, and everything to the next `*/` is blanked. That cost this guard
    // its first run - ai-gpt5's URL constant vanished and the fetch beside it
    // reported as caller-supplied - and CLAUDE.md records the same failure in
    // check:shared-helper-imports.
    const { findings } = await import('../../../scripts/check-ssrf-fetch.mjs');
    const keys = (findings() as { key: string }[]).map((f) => f.key);
    expect(keys.some((k) => k.includes('ai-gpt5'))).toBe(false);
    expect(read('scripts/check-ssrf-fetch.mjs')).toContain('LINE COMMENTS FIRST');
  });

  it('is wired into CI, not merely runnable', () => {
    expect(read('package.json')).toMatch(/"check:ssrf-fetch"/);
    expect(read('.github/workflows/ci.yml')).toMatch(/npm run check:ssrf-fetch/);
  });
});
