#!/usr/bin/env tsx
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const want = new Set(process.argv.slice(2));
const seen = new Set<string>();
for (const f of readdirSync(join(repo, 'shared')).filter((f) => f.endsWith('.ts'))) {
  let mod: Record<string, unknown>;
  try {
    mod = await import(join(repo, 'shared', f));
  } catch {
    continue;
  }
  for (const v of Object.values(mod)) {
    if (!is(v, PgTable)) continue;
    const cfg = getTableConfig(v as PgTable);
    if (want.size && !want.has(cfg.name)) continue;
    if (seen.has(cfg.name)) continue;
    seen.add(cfg.name);
    console.log('### ' + cfg.name);
    console.log(cfg.columns.map((c) => c.name).join(', '));
  }
}
for (const w of want) if (!seen.has(w)) console.log('### ' + w + '  -- NOT IN ANY DRIZZLE SCHEMA');
