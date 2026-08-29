#!/usr/bin/env node
// PRD loop helper: next | show <id> | pass <id>
import fs from 'fs';
const PRD = new URL('../prd.json', import.meta.url);
const load = () => JSON.parse(fs.readFileSync(PRD, 'utf8'));
const save = (p) => fs.writeFileSync(PRD, JSON.stringify(p, null, 2) + '\n');
const [cmd, arg] = process.argv.slice(2);
const p = load();
const rem = p.userStories.filter((s) => s.passes !== true).sort((a, b) => a.priority - b.priority);
if (cmd === 'next') {
  const n = parseInt(arg || '5', 10);
  for (const s of rem.slice(0, n)) console.log(`[p${s.priority}] ${s.id} — ${s.title}`);
  console.log(`\n(${rem.length} remaining)`);
} else if (cmd === 'show') {
  const s = p.userStories.find((x) => x.id === arg);
  console.log(JSON.stringify(s, null, 2));
} else if (cmd === 'pass') {
  const s = p.userStories.find((x) => x.id === arg);
  if (!s) {
    console.error('not found', arg);
    process.exit(1);
  }
  s.passes = true;
  save(p);
  console.log('marked passes=true:', arg, '—', s.title);
} else {
  console.log('usage: prd-loop.mjs next [N] | show <id> | pass <id>');
}
