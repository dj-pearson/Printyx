/**
 * UNHARDENED SCAN, not a guard. Deliberately not in package.json and not in CI.
 *
 * Reports every <Button> in client/src whose label carries an action verb and
 * whose attributes have no onClick, no type="submit", no asChild and no href.
 * It skips a button within 15 lines of a Dialog/Popover/Sheet/Dropdown trigger
 * or a <form>, which is a LINE WINDOW rather than real ancestry - so a submit
 * button in a form declared further up reads as dead. Around 115 candidates
 * today; treat that as an upper bound.
 *
 * UI-DEAD-BUTTONS-001 is the story that turns this into scripts/check-dead-buttons.mjs
 * with a shrink-only baseline. Do not baseline this version: a baseline holding
 * known false positives is where a real one hides.
 *
 * Confirmed true positives already fixed by hand: SEODashboard's Save Settings,
 * and View Details + Download on every row of Invoices.tsx.
 *
 * Run: node scripts/scan-dead-buttons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
const files=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.tsx'))files.push(p);}})('client/src');

const ACTION_WORDS=/\b(save|submit|create|add|update|delete|remove|send|apply|generate|export|import|run|start|assign|approve|reject|confirm|schedule|invite|publish|sync|refresh|upload|download|print|resolve|archive|convert|record|log|book|pay|renew|cancel)\b/i;

let total=0;
for(const f of files){
  const src=fs.readFileSync(f,'utf8');
  const lines=src.split('\n');
  // find <Button ...> ... </Button> blocks
  const re=/<Button\b([^]*?)>([^]*?)<\/Button>/g;
  let m;
  while((m=re.exec(src))!==null){
    const attrs=m[1];
    const label=m[2].replace(/<[^>]*>/g,'').replace(/\{[^}]*\}/g,'').trim();
    if(!label) continue;
    if(/onClick|type="submit"|type={'submit'}|asChild|href=/.test(attrs)) continue;
    if(!ACTION_WORDS.test(label)) continue;
    // skip if wrapped by a <form onSubmit> — crude: file has onSubmit and button has no type at all
    const line=src.slice(0,m.index).split('\n').length;
    // check the ~30 lines before for a DialogTrigger/form
    const before=lines.slice(Math.max(0,line-15),line).join('\n');
    if(/DialogTrigger|AlertDialogTrigger|PopoverTrigger|SheetTrigger|DropdownMenuTrigger|<form/.test(before)) continue;
    console.log(`${f}:${line}  "${label.replace(/\s+/g,' ').slice(0,50)}"`);
    total++;
  }
}
console.log('total candidates',total);
