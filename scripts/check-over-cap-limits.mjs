#!/usr/bin/env node
/**
 * A client asking for more rows than the server will give (COP-I01).
 *
 * Every CRM list endpoint clamps `limit` to `MAX_CRM_PAGE_SIZE`
 * (`supabase/functions/_shared/crm-list-query.ts`). A page that requests 500
 * receives that cap and has NO WAY TO TELL: the response is a full-looking
 * array, and the code that asked for 500 carries on as though 500 arrived.
 *
 * Three live instances, each with a different consequence:
 *
 *   - EnhancedPipelineBoard asked for 500 and rendered 200, so the per-stage
 *     badge on every column and the money total under it described a subset of
 *     the pipeline with nothing saying so.
 *   - Contacts.tsx's company picker asked for 500, held 200, and filtered THOSE
 *     client-side - so a company past the cap could not be selected, and the
 *     dialog offered to CREATE IT, turning a cap into a duplicate record.
 *   - ProspectsPage did the same for prospects.
 *
 * WHAT COUNTS AS A FINDING: a literal `limit` above the cap, in a request whose
 * URL names an endpoint that HAS that cap. Which endpoints those are is read
 * from the tree - the functions importing `parseCrmListQuery` - rather than
 * assumed, because the first version of this guard assumed every list shared
 * one cap and reported `BlogCalendar.tsx` asking `blog-posts` for 500. That
 * endpoint clamps at 500 and is correct. A baseline holding a known false
 * positive is where a real one hides, so the rule narrowed instead.
 *
 * BLIND SPOTS, stated so a clean run is not read as proof: a limit assembled at
 * runtime, one read from config, a request whose URL is built far from the
 * limit, and a page that asks for exactly the cap while needing more - the cap
 * is still a cap, and whether the UI SAYS so is `boardTruncation`'s job.
 *
 * Usage:
 *   node scripts/check-over-cap-limits.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientSrc = join(repo, 'client/src');

const spec = readFileSync(join(repo, 'supabase/functions/_shared/crm-list-query.ts'), 'utf8');
const cap = Number(/export const MAX_CRM_PAGE_SIZE = (\d+)/.exec(spec)?.[1]);
if (!Number.isFinite(cap) || cap <= 0) {
  console.error('✗ Could not read MAX_CRM_PAGE_SIZE from _shared/crm-list-query.ts.');
  process.exit(1);
}

function stripComments(src) {
  return src.replace(/(^|[^:])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * The endpoints that actually carry `MAX_CRM_PAGE_SIZE`, read from the edge
 * tree. A directory name is its URL segment (`getApiUrl` rewrites `/api/<seg>`
 * straight to the functions host), so this is the prefix list.
 */
function cappedEndpoints() {
  const fns = join(repo, 'supabase/functions');
  const out = [];
  for (const entry of readdirSync(fns)) {
    try {
      if (readFileSync(join(fns, entry, 'index.ts'), 'utf8').includes('parseCrmListQuery')) {
        out.push(entry);
      }
    } catch {
      /* not a function directory */
    }
  }
  return out;
}

const CAPPED = cappedEndpoints();
if (CAPPED.length === 0) {
  console.error('✗ No edge function imports parseCrmListQuery - the scan would match nothing.');
  process.exit(1);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Files that take their endpoint from the CRM object registry, whose
 * `apiEndpoint` values include capped ones. Checked rather than assumed: if
 * the registry stops pointing at a capped endpoint this set empties itself.
 */
const registryPointsAtCapped = (() => {
  const registry = readFileSync(join(clientSrc, 'lib/crm-object-registry.ts'), 'utf8');
  return CAPPED.some((fn) => registry.includes(`apiEndpoint: '/api/${fn}'`));
})();

/** `limit=500` in a URL, `limit: '500'` / `limit: 500` in an object or params. */
const PATTERNS = [/[?&]limit=(\d+)/g, /\blimit['"]?\s*:\s*['"]?(\d+)/g];

const files = walk(clientSrc);
const registryDriven = new Set(
  registryPointsAtCapped
    ? files.filter((f) => readFileSync(f, 'utf8').includes('getCrmObjectConfig'))
    : [],
);

const findings = [];
for (const file of files) {
  const src = stripComments(readFileSync(file, 'utf8'));
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(lines[i])) !== null) {
        const value = Number(match[1]);
        if (value <= cap) continue;
        // The endpoint has to be one that carries this cap. The URL is usually
        // on the same line; a params object is usually within a few lines of
        // the apiRequest that sends it, so look at a small window.
        const window = lines.slice(Math.max(0, i - 6), i + 7).join('\n');
        let endpoint = CAPPED.find((fn) => window.includes(`/api/${fn}`));
        /**
         * A registry-driven caller builds its URL from `config.apiEndpoint`, so
         * the literal path is never near the limit. EnhancedPipelineBoard is
         * exactly that, and it is the case this guard was written for - the
         * first narrowing let its 500 through, which a mutation caught. A file
         * that resolves an endpoint through the CRM object registry is treated
         * as hitting whichever capped endpoint the registry maps.
         */
        if (!endpoint && registryDriven.has(file)) endpoint = 'deals (via the CRM registry)';
        if (!endpoint) continue;
        findings.push({ file: relative(repo, file), line: i + 1, value, endpoint });
      }
    }
  }
}

if (findings.length > 0) {
  console.error(
    `✗ ${findings.length} request(s) ask for more rows than the server will return (cap ${cap}):\n`,
  );
  for (const f of findings) {
    console.error(`    ${f.file}:${f.line}  limit ${f.value}  ->  /api/${f.endpoint}`);
  }
  console.error(
    `\n  The endpoint clamps to ${cap} and the response gives no sign it did, so the caller\n` +
      '  renders a subset believing it has everything. Import CRM_PAGE_SIZE from\n' +
      "  '@shared/board-truncation' and, where the list can be short, say so with\n" +
      '  boardTruncation() rather than letting an absence read as "that is all there is".',
  );
  process.exit(1);
}

console.log(
  `✓ No client requests a limit above the ${cap}-row cap on /api/${CAPPED.join(', /api/')}.`,
);
