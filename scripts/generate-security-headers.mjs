#!/usr/bin/env node
/**
 * Writes `client/public/_headers` from `shared/security-headers.ts`.
 *
 * Vite copies `client/public/*` into `dist/`, and `wrangler.toml` points
 * Cloudflare Pages at `dist`, so this file is what puts a CSP, HSTS and a
 * frame policy in front of the document a user actually loads. Helmet covers
 * Express only.
 *
 * Run: npm run security:headers
 * Check: npm run check:security-headers
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('tsx/cjs');

const repoRoot = resolve(fileURLToPath(import.meta.url), '../..');
export const HEADERS_PATH = resolve(repoRoot, 'client/public/_headers');

export function renderHeaders() {
  const mod = require(resolve(repoRoot, 'shared/security-headers.ts'));
  return mod.renderHeadersFile();
}

function main() {
  const text = renderHeaders();
  writeFileSync(HEADERS_PATH, text, 'utf8');
  console.log(`Wrote ${HEADERS_PATH} (${text.split('\n').length} lines)`);
}

const isEntryPoint =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) main();
