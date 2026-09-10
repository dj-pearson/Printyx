#!/usr/bin/env node
/**
 * REPORT, not a gate. Every PostgREST call chain in an edge function that names
 * a table Drizzle declares with a tenant_id, and does not mention tenant_id
 * anywhere in the chain.
 *
 * These functions use the SERVICE-ROLE client, which bypasses RLS, so a tenant
 * filter is the only isolation there is. The output is NOT a defect list: most
 * findings are guarded by an ownership fetch a few lines earlier (saved-views
 * checks the owner, monitoring-clients calls findClientForTenant, the
 * knowledge-base handlers scope by user_id), and this script cannot see that.
 * It is a place to start reading.
 *
 * It found parts-orders, where three handlers on /:id/items and the DELETE took
 * the order id from the URL with no ownership check at all - a cross-tenant
 * read, write and delete, the last of which answered { success: true } after
 * stripping another tenant's order lines.
 *
 * Known limits, stated so a clean line is never read as proof: the chain ends
 * at the first ';', so a query built across statements is split and may look
 * unfiltered; a table name held in a variable is invisible; and the 107 tables
 * in no Drizzle schema are not classified as tenant-scoped at all.
 *
 * Usage: node scripts/report-untenanted-postgrest.mjs
 */
import fs from 'fs'; import path from 'path';
// 1. tables that HAVE tenant_id, per Drizzle
const shared=fs.readdirSync('shared').filter(f=>f.endsWith('.ts')).map(f=>'shared/'+f);
const tenantTables=new Set();
for(const f of shared){
  const s=fs.readFileSync(f,'utf8');
  const re=/pgTable\(\s*['"]([a-z0-9_]+)['"]\s*,\s*\{/g; let m;
  while((m=re.exec(s))){
    const st=re.lastIndex-1; let d=0,end=-1;
    for(let i=st;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'&&--d===0){end=i;break;}}
    if(end<0)continue;
    if(/['"]tenant_id['"]/.test(s.slice(st,end))) tenantTables.add(m[1]);
  }
}
// 2. edge fn call chains
const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(e.name.endsWith('.ts'))files.push(p);}})('supabase/functions');
const findings=[];
for(const f of files){
  const src=fs.readFileSync(f,'utf8').replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).split('\n').map(l=>l.replace(/\/\/.*$/,'')).join('\n');
  const re=/\.from\(\s*['"]([a-z0-9_]+)['"]\s*\)/g; let m;
  while((m=re.exec(src))){
    const table=m[1];
    if(!tenantTables.has(table)) continue;
    // chain = up to the next statement boundary (;) or 900 chars
    const rest=src.slice(m.index, m.index+1200);
    const stop=rest.indexOf(';');
    const chain=stop>0?rest.slice(0,stop):rest;
    if(/tenant_id/.test(chain)) continue;
    // writes: insert/update/upsert with tenant_id in the payload counts
    const line=src.slice(0,m.index).split('\n').length;
    const op=/\.insert\(/.test(chain)?'insert':/\.update\(/.test(chain)?'update':/\.upsert\(/.test(chain)?'upsert':/\.delete\(/.test(chain)?'delete':'select';
    findings.push({f,line,table,op});
  }
}
const byOp={};
for(const x of findings)(byOp[x.op] ||= []).push(x);
for(const op of Object.keys(byOp)){
  console.log(`\n### ${op}: ${byOp[op].length}`);
  byOp[op].slice(0,25).forEach(x=>console.log(`  ${x.f}:${x.line}  ${x.table}`));
}
console.log('\ntenant-scoped tables:',tenantTables.size,'| total findings:',findings.length);
