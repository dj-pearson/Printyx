#!/usr/bin/env node
// Mark a PRD story's `passes` flag and optionally append a note.
// Usage: node scripts/prd-mark.mjs <STORY-ID> <true|false> ["completion note"]
// Preserves the file's CRLF line endings so the git diff stays minimal.
import fs from 'node:fs';

const [, , id, passStr, note] = process.argv;
if (!id || !passStr) {
  console.error('Usage: node scripts/prd-mark.mjs <STORY-ID> <true|false> ["note"]');
  process.exit(1);
}

const path = 'prd.json';
const raw = fs.readFileSync(path, 'utf8');
const usesCrlf = raw.includes('\r\n');
const obj = JSON.parse(raw);
const story = (obj.userStories || []).find((s) => s.id === id);
if (!story) {
  console.error(`Story ${id} not found`);
  process.exit(1);
}
story.passes = passStr === 'true';
if (note) {
  story.notes = story.notes ? `${story.notes}\n\n[COMPLETED] ${note}` : `[COMPLETED] ${note}`;
}

let out = JSON.stringify(obj, null, 2) + '\n';
if (usesCrlf) out = out.replace(/\n/g, '\r\n');
fs.writeFileSync(path, out);
console.log(`Marked ${id} passes=${story.passes}`);
