#!/usr/bin/env node
/**
 * REPORT, not a gate. Every loop in the edge tree containing an awaited
 * PostgREST call - the "one query per row" shape.
 *
 * It is a reading list, not a defect list. Many hits are legitimate: explicit
 * pagination loops (`for (let offset = 0; ; offset += 1000)`), insert batching
 * (`for (const batch of chunk(rows, 500))`), and retry loops. The ones that
 * matter iterate over TENANT DATA, where the row count is the customer's
 * business rather than a constant.
 *
 * It found predictive-failure, which ran two queries per active machine: a
 * dealer with 800 machines made 1,600 sequential round trips in a single
 * invocation, so the endpoint timed out for precisely the customers the feature
 * exists for. It passed testing because a seeded tenant has a dozen machines.
 *
 * The fix shape is in supabase/functions/_shared/batch-fetch.ts - chunked
 * `.in()` reads, explicit paging past PostgREST's silent 1000-row cap, and
 * grouping in memory.
 *
 * Limits: the loop body is read by indentation for 45 lines, so a longer body
 * or an unusually formatted one is missed, and a query behind a helper function
 * call is invisible. A clean line here is not proof.
 *
 * Usage: node scripts/report-nplus1-loops.mjs
 */
import fs from 'fs'; import path from 'path';
const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(e.name.endsWith('.ts'))files.push(p);}})('supabase/functions');
const out=[];
for(const f of files){
  const src=fs.readFileSync(f,'utf8').replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' '));
  const lines=src.split('\n').map(l=>l.replace(/\/\/.*$/,''));
  lines.forEach((l,i)=>{
    if(!/\b(for|while)\s*\(|\.map\(\s*async|\.forEach\(\s*async/.test(l)) return;
    // scan the next 40 lines for an await on a db call, stopping at a dedent
    const indent=l.search(/\S/);
    let body=[];
    for(let k=i+1;k<Math.min(lines.length,i+45);k++){
      const cur=lines[k];
      if(cur.trim() && cur.search(/\S/)<=indent) break;
      body.push(cur);
    }
    const b=body.join('\n');
    const m=b.match(/await\s+(?:admin|db|supabase|client)[\s\S]{0,60}?\.from\(\s*['"]([a-z0-9_]+)['"]/);
    if(!m) return;
    // Promise.all wrapping means it's parallel, still N queries but not serial
    const parallel=/Promise\.all/.test(l)||/Promise\.all/.test(lines[Math.max(0,i-1)]);
    out.push({f,line:i+1,table:m[1],parallel,head:l.trim().slice(0,80)});
  });
}
out.filter(o=>!o.parallel).forEach(o=>console.log(`${o.f}:${o.line}  -> ${o.table}\n      ${o.head}`));
console.log('serial db call inside a loop:',out.filter(o=>!o.parallel).length,'| parallel:',out.filter(o=>o.parallel).length);
