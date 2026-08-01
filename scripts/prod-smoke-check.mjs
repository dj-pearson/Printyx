// Production smoke check (PROD-020) — the honesty gate on the route-parity analysis.
//
// Everything in the prod-404 gap analysis (PROD-006, PROD-008, PROD-010..014) is
// STATICALLY derived: scripts/lib/route-parity.mjs greps the client for /api/*
// calls and the repo for edge-function directories. That inference has already
// produced one confirmed false positive (quote-templates was an api-shaped
// TanStack CACHE KEY, never a network call), and static parity fundamentally
// cannot distinguish a 404 from a 200 carrying the WRONG SHAPE — which CLAUDE.md
// flags as strictly worse, because pages fall back to mock data with `|| [...]`
// and silently render fabricated numbers.
//
// This script replaces inference with measurement: one real request per /api
// prefix against a deployed environment, reported per domain.
//
// ---------------------------------------------------------------------------
// WHY THIS WORKS WITHOUT CREDENTIALS
// ---------------------------------------------------------------------------
// The committed anon keys are rotated/stale (GoTrue /auth/v1/health returns 401),
// so requiring auth would make this script unrunnable — which is how the gap
// analysis stayed unverified in the first place. It does not need auth to answer
// the central question, because the Coolify dispatcher resolves the function from
// URL segment 0 BEFORE any handler runs, and enforces auth PER HANDLER:
//
//   * function not deployed  -> dispatcher 404 with a DISTINCTIVE body:
//                               { error: 'Function not found', available: [...] }
//                               (supabase/functions/server.ts)
//   * function deployed, needs auth -> 401/403 from the handler
//   * function deployed, sub-path unhandled -> 404 WITHOUT the marker body
//
// So `404 + marker` proves absence, and 401/403/2xx proves presence, with no
// credentials at all. Distinguishing the two kinds of 404 is what makes this
// trustworthy — a naive status-only check would report every function that simply
// does not serve GET / as "missing".
//
// BONUS: that marker body carries `available[]` — the COMPLETE list of deployed
// functions — so a single request to a deliberately bogus name enumerates the
// whole deployment. That list is reported as corroboration; the per-domain probe
// stays authoritative, because aliases in server.ts (accounts-payable ->
// account-payable, deployment -> deployment-readiness, integration-hub ->
// integrations, public/calculator -> public-calculator, ...) mean a prefix can
// resolve fine while its literal name is absent from `available`.
//
// Supplying PRINTYX_SMOKE_TOKEN upgrades the run: authenticated requests reach
// the handlers, so 2xx responses become real shape evidence rather than just
// proof-of-existence.
//
// ---------------------------------------------------------------------------
// Usage:
//   node scripts/prod-smoke-check.mjs                    # unauthenticated
//   PRINTYX_SMOKE_TOKEN=<user-jwt> node scripts/prod-smoke-check.mjs
//   node scripts/prod-smoke-check.mjs --all              # every domain, not just live
//   node scripts/prod-smoke-check.mjs --out docs/prod-smoke-2026-08-01.md
//   node scripts/prod-smoke-check.mjs --strict           # exit 2 if predictions were wrong
//   node scripts/prod-smoke-check.mjs --json             # machine-readable to stdout
//
// Env:
//   PRINTYX_FUNCTIONS_URL  base URL (default https://functions.printyx.net)
//   PRINTYX_SMOKE_TOKEN    user JWT, sent as Authorization: Bearer. NEVER commit one.
//   PRINTYX_SMOKE_ANON_KEY anon key, sent as the `apikey` header. NEVER commit one.
//                          See .env.example for where these come from and how they rotate.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeParity } from './lib/route-parity.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);
const flagValue = (f, fallback) => {
  const i = argv.indexOf(f);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const BASE = flagValue(
  '--base',
  process.env.PRINTYX_FUNCTIONS_URL || 'https://functions.printyx.net',
).replace(/\/$/, '');
const TOKEN = process.env.PRINTYX_SMOKE_TOKEN || '';
const ANON_KEY = process.env.PRINTYX_SMOKE_ANON_KEY || '';
const CONCURRENCY = Number(flagValue('--concurrency', '6'));
const TIMEOUT_MS = Number(flagValue('--timeout', '15000'));
const CHECK_ALL = hasFlag('--all');
const STRICT = hasFlag('--strict');
const AS_JSON = hasFlag('--json');
const OUT = flagValue('--out', null);

// A name no function will ever be called. Its 404 carries `available[]`.
const BOGUS_FUNCTION = '__printyx_smoke_probe_nonexistent__';

const headers = () => {
  const h = { Accept: 'application/json' };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  if (ANON_KEY) h.apikey = ANON_KEY;
  return h;
};

/**
 * One request. Never throws — a transport failure is a result ('unreachable'),
 * not a crash, so one dead domain cannot abort the sweep.
 */
async function probe(path) {
  const url = `${BASE}/${path}`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: headers(),
      signal: controller.signal,
      redirect: 'manual',
    });
    // Cap the body read: some list endpoints return large payloads and we only
    // need the marker and a shape sample.
    const text = (await res.text().catch(() => '')).slice(0, 4000);
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* non-JSON is itself a signal; keep the raw text */
    }
    return { url, status: res.status, ms: Date.now() - started, text, body, error: null };
  } catch (e) {
    return {
      url,
      status: 0,
      ms: Date.now() - started,
      text: '',
      body: null,
      error: e?.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : String(e?.message || e),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** True when this response is the DISPATCHER saying the function is not deployed. */
const isDispatcherMissing = (r) =>
  r.status === 404 && r.body && r.body.error === 'Function not found';

function classify(r) {
  if (r.status === 0) return 'unreachable';
  if (isDispatcherMissing(r)) return 'missing';
  if (r.status === 401 || r.status === 403) return 'exists-auth';
  if (r.status >= 200 && r.status < 300) return 'ok';
  if (r.status === 404) return 'exists-subpath-404';
  if (r.status >= 500) return 'server-error';
  return 'exists-other';
}

const VERDICT_MEANING = {
  missing: 'function NOT deployed — a real prod 404',
  'exists-auth': 'function deployed, refused unauthenticated (expected without a token)',
  ok: 'function deployed and returned 2xx',
  'exists-subpath-404':
    'function deployed; GET / is not one of its routes (NOT a missing function)',
  'server-error': 'function deployed but errored (5xx)',
  'exists-other': 'function deployed; non-2xx, non-auth status',
  unreachable: 'no response — network/DNS/proxy blocked, or the host is down',
};

/** Run tasks with a bounded number in flight. */
async function pooled(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const parity = computeParity(repo);

  // Domains the frontend actually calls. Default to the LIVE set — a call in an
  // orphaned file can never run, so probing it measures nothing. --all includes them.
  const domains = parity.rows
    .filter((r) => (CHECK_ALL ? r.frontend : r.frontendLive))
    .map((r) => ({
      domain: r.domain,
      klass: r.klass,
      // The static claim under test: missing-edge means "no edge fn" => predicted 404.
      predicted: r.klass === 'missing-edge' ? 'missing' : 'present',
      express: r.express,
      edge: r.edge,
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain));

  if (!AS_JSON) {
    console.log(`Printyx production smoke check`);
    console.log(`  base        ${BASE}`);
    console.log(
      `  domains     ${domains.length} (${CHECK_ALL ? 'all frontend-called' : 'live only'})`,
    );
    console.log(
      `  auth        ${TOKEN ? 'Bearer token supplied' : 'NONE (existence-only verdicts)'}`,
    );
    console.log('');
  }

  // 1. Enumerate the deployment in a single request.
  const enumProbe = await probe(BOGUS_FUNCTION);
  const deployed =
    isDispatcherMissing(enumProbe) && Array.isArray(enumProbe.body.available)
      ? enumProbe.body.available
      : null;

  // HANDSHAKE — refuse to report unless this probe proves we are talking to the
  // real dispatcher.
  //
  // This guard is the whole difference between measurement and fiction. A proxy,
  // WAF, CDN or captive portal in front of the deployment answers EVERY path
  // uniformly, and the natural answers are exactly the ones that mean "fine" to a
  // status-only classifier: a blanket 403 reads as `exists-auth` for all 182
  // domains, producing a confident report that the deployment is healthy when in
  // fact nothing was ever reached. (Observed for real: the sandbox this was
  // developed in returns 403 to every CONNECT, which is precisely how the bug was
  // found.) Only the dispatcher emits `{error:'Function not found', available:[]}`
  // for a name that cannot exist, so requiring that marker proves the endpoint on
  // the other end is server.ts and not an interceptor.
  //
  // There is deliberately no override flag: every failure mode this catches
  // produces plausible-looking output, and "wrong but confident" is the one
  // outcome this story exists to prevent.
  if (enumProbe.status === 0 || !isDispatcherMissing(enumProbe)) {
    const unreachable = enumProbe.status === 0;
    const reason = unreachable ? 'unreachable' : 'not-the-dispatcher';
    const detail = unreachable
      ? `Could not reach ${BASE} — ${enumProbe.error}`
      : `${BASE} answered, but it is NOT the Printyx edge dispatcher.\n` +
        `Probing a function name that cannot exist returned HTTP ${enumProbe.status}, ` +
        `expected 404 with {"error":"Function not found"}.\n` +
        `Response head: ${JSON.stringify(enumProbe.text.slice(0, 200))}\n` +
        `Something is answering on its behalf — a proxy, WAF, CDN or login wall.`;

    if (AS_JSON) {
      console.log(
        JSON.stringify({ ok: false, reason, base: BASE, status: enumProbe.status }, null, 2),
      );
    } else {
      console.error(
        `${detail}\n\n` +
          `NOTHING WAS MEASURED. This is a run failure, not a finding: no conclusion\n` +
          `about any route may be drawn from it, and in particular this is NOT evidence\n` +
          `that the routes are healthy. Re-run from a host with direct egress to the\n` +
          `deployment.`,
      );
    }
    process.exit(1);
  }

  // 2. Probe each domain.
  const results = await pooled(domains, CONCURRENCY, async (d) => {
    const r = await probe(d.domain);
    const verdict = classify(r);
    const observedPresent = verdict !== 'missing' && verdict !== 'unreachable';
    const agrees =
      verdict === 'unreachable'
        ? null
        : d.predicted === 'missing'
          ? verdict === 'missing'
          : observedPresent;
    return { ...d, status: r.status, ms: r.ms, verdict, agrees, error: r.error };
  });

  const counts = {};
  for (const r of results) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
  const confirmed = results.filter((r) => r.agrees === true);
  const corrected = results.filter((r) => r.agrees === false);

  if (!AS_JSON) {
    const pad = Math.max(...results.map((r) => r.domain.length), 8);
    console.log(
      `${'domain'.padEnd(pad)}  ${'predicted'.padEnd(9)}  ${'status'.padEnd(6)}  verdict`,
    );
    console.log('-'.repeat(pad + 34));
    for (const r of results) {
      const mark = r.agrees === false ? ' <- CONTRADICTS STATIC ANALYSIS' : '';
      console.log(
        `${r.domain.padEnd(pad)}  ${r.predicted.padEnd(9)}  ${String(r.status).padEnd(6)}  ${r.verdict}${mark}`,
      );
    }
    console.log('');
    for (const [k, v] of Object.entries(counts).sort()) {
      console.log(`  ${String(v).padStart(4)}  ${k.padEnd(20)} ${VERDICT_MEANING[k] || ''}`);
    }
    console.log('');
    console.log(`  confirmed:  ${confirmed.length}`);
    console.log(`  corrected:  ${corrected.length}`);
    if (deployed) console.log(`  deployed functions reported by dispatcher: ${deployed.length}`);
    if (!TOKEN) {
      console.log('');
      console.log(
        'NOTE: unauthenticated run. Verdicts prove DEPLOYMENT, not correctness —\n' +
          '      a deployed function can still return 200 with the wrong shape, which is\n' +
          '      the failure mode CLAUDE.md calls worse than a 404. Set PRINTYX_SMOKE_TOKEN\n' +
          '      to check response shapes.',
      );
    }
  }

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    base: BASE,
    authenticated: Boolean(TOKEN),
    domainScope: CHECK_ALL ? 'all-frontend-called' : 'live-only',
    counts,
    confirmed: confirmed.map((r) => r.domain),
    corrected: corrected.map((r) => ({
      domain: r.domain,
      predicted: r.predicted,
      verdict: r.verdict,
    })),
    deployedFunctions: deployed,
    results,
  };

  if (AS_JSON) console.log(JSON.stringify(report, null, 2));

  if (OUT) {
    // Resolve relative to the repo, but honor an absolute path as given — joining
    // repo with an absolute path silently writes somewhere else entirely while
    // reporting the path the caller asked for.
    const path = isAbsolute(OUT) ? OUT : join(repo, OUT);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, renderMarkdown(report));
    if (!AS_JSON) console.log(`\nWrote ${path}`);
  }

  if (STRICT && corrected.length > 0) process.exit(2);
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Production smoke check — ${report.generatedAt.slice(0, 10)}`);
  lines.push('');
  lines.push(`Generated by \`node scripts/prod-smoke-check.mjs\` (PROD-020).`);
  lines.push('');
  lines.push(`- **Target:** ${report.base}`);
  lines.push(
    `- **Authenticated:** ${report.authenticated ? 'yes' : 'no (existence-only verdicts)'}`,
  );
  lines.push(`- **Scope:** ${report.domainScope}`);
  lines.push(`- **Domains probed:** ${report.results.length}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| verdict | count | meaning |');
  lines.push('| --- | ---: | --- |');
  for (const [k, v] of Object.entries(report.counts).sort()) {
    lines.push(`| \`${k}\` | ${v} | ${VERDICT_MEANING[k] || ''} |`);
  }
  lines.push('');
  lines.push(`Confirmed the static prediction: **${report.confirmed.length}**`);
  lines.push('');
  lines.push(`Contradicted the static prediction: **${report.corrected.length}**`);
  if (report.corrected.length) {
    lines.push('');
    for (const c of report.corrected) {
      lines.push(`- \`${c.domain}\` — predicted \`${c.predicted}\`, observed \`${c.verdict}\``);
    }
  }
  lines.push('');
  lines.push('## Per-domain results');
  lines.push('');
  lines.push('| domain | predicted | status | verdict |');
  lines.push('| --- | --- | ---: | --- |');
  for (const r of report.results) {
    lines.push(`| \`${r.domain}\` | ${r.predicted} | ${r.status} | \`${r.verdict}\` |`);
  }
  if (report.deployedFunctions) {
    lines.push('');
    lines.push(
      `## Deployed functions (${report.deployedFunctions.length}) as reported by the dispatcher`,
    );
    lines.push('');
    lines.push(report.deployedFunctions.map((f) => `\`${f}\``).join(', '));
  }
  lines.push('');
  return lines.join('\n');
}

main().catch((e) => {
  console.error(`prod-smoke-check failed: ${e?.stack || e}`);
  process.exit(1);
});
