#!/usr/bin/env node
/**
 * HARD GATE at zero (PERF-ROWCAP-002 took the last 33 to none). Every unbounded
 * .select() on a high-volume table whose result is then summed with .reduce().
 *
 * PostgREST truncates a response at db-max-rows (1000) WITHOUT erroring and
 * with no marker in the payload, so a plain select that is summed gives a total
 * that is simply wrong once the tenant passes that line - quietly, and always
 * in the direction of "business is smaller than it is". financial/'s metrics,
 * expenses, forecasts, profit-loss and mrr-analysis all did this, which is a
 * revenue dashboard, a P&L and an MRR analysis reading partial sets.
 *
 * The fix shape is supabase/functions/_shared/paged-select.ts. Prefer a HEAD
 * count ({ count: 'exact', head: true }) when only the number is needed - that
 * transfers no rows at all.
 *
 * The high-volume list is a JUDGEMENT, not a measurement: these are the tables a
 * real copier dealer accumulates thousands of rows in. A reference table with
 * forty rows does not need paging and listing it would bury the real ones.
 *
 * Limits: the .reduce() must appear within 30 lines of the .from(), so a longer
 * handler is missed; a sum written as a for-loop is not detected at all; and the
 * table list is hand-maintained. A clean line is not proof.
 *
 * Usage: node scripts/report-unbounded-sums.mjs
 */
import fs from 'fs'; import path from 'path';
const HIGH_VOLUME=new Set(['meter_readings','service_tickets','invoices','deals','business_records','equipment','payments','accounts_receivable','accounts_payable','activities','tasks','audit_logs','contracts','purchase_orders','inventory_items','device_metrics']);
const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(e.name.endsWith('.ts'))files.push(p);}})('supabase/functions');
const out=[];
for(const f of files){
  const src=fs.readFileSync(f,'utf8').replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).split('\n').map(l=>l.replace(/\/\/.*$/,'')).join('\n');
  const lines=src.split('\n');
  const re=/\.from\(\s*['"]([a-z0-9_]+)['"]\s*\)/g; let m;
  while((m=re.exec(src))){
    if(!HIGH_VOLUME.has(m[1])) continue;
    const rest=src.slice(m.index, m.index+900); const stop=rest.indexOf(';');
    const chain=stop>0?rest.slice(0,stop):rest;
    if(!/\.select\(/.test(chain)) continue;
    if(/\.limit\(|\.range\(|\.single\(|\.maybeSingle\(|count:\s*'exact'|head:\s*true/.test(chain)) continue;
    // Already paged. Without this the report can never show progress: the inner
    // chain inside fetchAllRows(() => admin.from(...).select(...)) carries no
    // .range of its own, so a fixed call still looks unbounded.
    const before=src.slice(Math.max(0,m.index-160), m.index);
    // The receiver (`admin`, `db`) sits on its own line between the arrow and
    // the .from(, so anchor on "fetchAllRows(() =>" followed by at most one
    // identifier rather than on a fixed character window.
    if(/fetchAllRows\s*(?:<[^(]*>)?\s*\(\s*\(\)\s*=>\s*(?:[A-Za-z_$][\w$]*\s*)?$/.test(before.replace(/\s+$/,''))) continue;
    const startLine=src.slice(0,m.index).split('\n').length;
    const after=lines.slice(startLine-1, startLine+30).join('\n');
    if(!/\.reduce\(/.test(after)) continue;   // a SUM, not a list
    out.push({f,line:startLine,table:m[1]});
  }
}
out.forEach(o=>console.log(`${o.f}:${o.line}  ${o.table}`));
console.log('\nunbounded select on a high-volume table, then summed:', out.length);
if(out.length){
  console.error('\nPage it with fetchAllRows from supabase/functions/_shared/paged-select.ts,');
  console.error('or switch to { count: \'exact\', head: true } when only the number is wanted.');
  process.exit(1);
}
