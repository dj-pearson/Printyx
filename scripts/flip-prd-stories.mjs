#!/usr/bin/env node
// Flip prd.json stories to passes=true and append a verification note.
// Usage: node scripts/flip-prd-stories.mjs '{"US-BLOG-028":"note text", ...}'
import fs from 'node:fs';

const path = new URL('../prd.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const updates = JSON.parse(process.argv[2]);

let flipped = 0;
for (const story of data.userStories) {
  if (Object.prototype.hasOwnProperty.call(updates, story.id)) {
    story.passes = true;
    const note = updates[story.id];
    if (note) {
      story.notes = (story.notes ? story.notes.trimEnd() + ' ' : '') + note;
    }
    flipped++;
  }
}

fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
const remaining = data.userStories.filter((s) => s.passes === false).length;
console.log(`Flipped ${flipped} stories. Remaining passes=false: ${remaining}`);
