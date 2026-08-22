#!/usr/bin/env node
/**
 * AUDIT, NOT A GATE. Candidates for the edge-function equivalent of
 * check:route-shadowing: a branch testing `x === 'literal'` that sits BELOW a
 * branch testing `x` for truthiness, in the same ordered if-chain.
 *
 * Express matches routes in registration order and edge functions dispatch
 * through an if-chain, so the same mistake is available on both sides - but the
 * edge side is the one production runs. Three real instances were found and
 * fixed with this: GET /leads/map-data, GET /manufacturer-integrations/stats
 * and /audit-logs, and PUT /tenant-settings/features. The first three had live
 * callers and were returning "not found" in production.
 *
 * WHY THIS IS NOT WIRED INTO CI. It reports roughly 30 candidates and only a
 * handful are real: the rest are branches whose OTHER conditions already
 * separate them (`poId === 'suggestions' && subResource === 'low-stock'` is not
 * shadowed by `poId && subResource === 'line-items'`). Deciding that
 * automatically means proving the generic branch's conditions are a superset of
 * the literal branch's - real analysis, not a regex. A gate that cries wolf
 * 25 times out of 30 would be turned off, and this session already learned that
 * lesson twice (a chained-where regex that reported 500 sites, and a baseline
 * keyed by line number that churned on every edit).
 *
 * So: run it by hand when touching an edge function's dispatch, and read each
 * hit. Promote it to a gate when the condition comparison is implemented.
 *
 *   node scripts/audit-edge-dispatch-order.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = 'supabase/functions';
function walk(d, out = []) {
  for (const e of readdirSync(d)) {
    const f = join(d, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (e.endsWith('.ts')) out.push(f);
  }
  return out;
}
const METHOD = /(?:req\.)?method(?:\.toUpperCase\(\))?\s*===\s*'(GET|POST|PUT|PATCH|DELETE)'/;
let hits = 0;
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  const conds = [];
  const re = /\bif\s*\(([\s\S]{0,220}?)\)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const c = m[1].replace(/\s+/g, ' ');
    const meth = c.match(METHOD)?.[1];
    if (!meth) continue;
    // discriminator === 'literal'
    for (const d of c.matchAll(/(\w+)\s*===\s*'([a-z0-9_-]+)'/g)) {
      if (d[1] === 'method' || /^(GET|POST|PUT|PATCH|DELETE)$/.test(d[2])) continue;
      conds.push({ kind: 'lit', v: d[1], lit: d[2], meth, i: m.index, c });
    }
    // discriminator truthy with no literal test on it
    for (const d of c.matchAll(/&&\s*(\w+)\s*(?=&&|$|\))/g)) {
      const v = d[1];
      if (/^(req|url|body|method)$/.test(v)) continue;
      if (new RegExp(`${v}\\s*===`).test(c)) continue;
      conds.push({ kind: 'any', v, meth, i: m.index, c });
    }
  }
  for (const lit of conds.filter((x) => x.kind === 'lit')) {
    const swallow = conds.find(
      (g) => g.kind === 'any' && g.v === lit.v && g.meth === lit.meth && g.i < lit.i,
    );
    if (swallow) {
      hits++;
      const line = src.slice(0, lit.i).split('\n').length;
      console.log(
        `${file}:${line}  ${lit.meth} ${lit.v}==='${lit.lit}' after generic ${swallow.v} at line ${src.slice(0, swallow.i).split('\n').length}`,
      );
    }
  }
}
console.log(`\n${hits} candidate(s)`);
