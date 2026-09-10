/**
 * Every same-origin asset the static <head> and the SEO route table point at
 * must exist in client/public (SEO-002).
 *
 * The head advertised four files that had never existed: /og-image.png,
 * /twitter-image.png, /logo.png (the Organization logo in JSON-LD) and
 * /browserconfig.xml. Nothing reported any of them. A missing og:image means
 * every shared link renders blank on LinkedIn, Slack, X and iMessage; a
 * missing Organization logo drops the Organization rich result; and none of it
 * shows up in a build, a test or a page load, because the browser silently
 * skips a head reference it cannot fetch.
 *
 * Checks:
 *   1. Local asset URLs in client/index.html resolve to a file in client/public.
 *   2. Same for absolute https://printyx.net/... URLs in the head's JSON-LD,
 *      which are the ones a crawler fetches.
 *   3. seoConfig's DEFAULT_OG_IMAGE and every ogImage override resolve too.
 *   4. Every JSON-LD block in the head parses.
 *
 * Exits non-zero on any miss. Deliberately not a ratchet: the correct count is
 * zero, and it was zero the moment the four dead references were fixed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = resolve(ROOT, 'client/public');
const SITE_URL = 'https://printyx.net';

const html = readFileSync(resolve(ROOT, 'client/index.html'), 'utf8');
const seoConfig = readFileSync(resolve(ROOT, 'client/src/lib/seo/seoConfig.ts'), 'utf8');

const failures = [];

/** A path is an asset if it has a file extension; bare paths are SPA routes. */
const isAsset = (p) => /\.[a-z0-9]{2,5}$/i.test(p.split('?')[0]);

function requireAsset(urlPath, where) {
  const clean = urlPath.split(/[?#]/)[0];
  if (!isAsset(clean)) return;
  // /src/main.tsx is Vite's entry, resolved from client/src at build time.
  if (clean.startsWith('/src/')) return;
  if (existsSync(resolve(PUBLIC_DIR, `.${clean}`))) return;
  failures.push(`${where}: ${urlPath} -> no such file under client/public`);
}

// 1. href="/..." and content="/..." in the head.
for (const m of html.matchAll(/(?:href|content|src)="(\/[^"]*)"/g)) {
  requireAsset(m[1], 'index.html');
}

// 2. Absolute site URLs anywhere in the head, JSON-LD included.
for (const m of html.matchAll(new RegExp(`${SITE_URL}(/[^"'\\s]*)`, 'g'))) {
  requireAsset(m[1], 'index.html (absolute)');
}

// 3. seoConfig image references.
for (const m of seoConfig.matchAll(new RegExp(`\\\${SITE_URL}(/[^\`'"]*)`, 'g'))) {
  requireAsset(m[1], 'seoConfig.ts');
}
for (const m of seoConfig.matchAll(/ogImage: '([^']+)'/g)) {
  const value = m[1];
  requireAsset(value.startsWith(SITE_URL) ? value.slice(SITE_URL.length) : value, 'seoConfig.ts ogImage');
}

// 4. Every JSON-LD block parses. An unparseable block is ignored wholesale by
//    every consumer, so a typo silently costs the entire rich result.
const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
if (blocks.length === 0) failures.push('index.html: no JSON-LD blocks found at all');
blocks.forEach((block, i) => {
  try {
    const parsed = JSON.parse(block[1]);
    if (!parsed['@context'] || !parsed['@type'])
      failures.push(`index.html: JSON-LD block ${i + 1} is missing @context or @type`);
  } catch (error) {
    failures.push(`index.html: JSON-LD block ${i + 1} does not parse (${error.message})`);
  }
});

// 5. A declared width/height must match the file. The Organization logo said
//    512x512 for a 2000x600 wordmark - a consumer that trusts the declaration
//    to lay out a rich result gets the wrong box.
function pngSize(publicPath) {
  const buf = readFileSync(resolve(PUBLIC_DIR, `.${publicPath}`));
  if (buf.slice(1, 4).toString() !== 'PNG') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
for (const block of blocks) {
  for (const m of block[1].matchAll(
    /"url":\s*"([^"]+\.png)"[\s\S]{0,120}?"width":\s*(\d+),\s*"height":\s*(\d+)/g
  )) {
    const path = m[1].startsWith(SITE_URL) ? m[1].slice(SITE_URL.length) : m[1];
    if (!existsSync(resolve(PUBLIC_DIR, `.${path}`))) continue; // already reported above
    const actual = pngSize(path);
    if (actual && (actual.width !== Number(m[2]) || actual.height !== Number(m[3]))) {
      failures.push(
        `index.html: JSON-LD declares ${path} as ${m[2]}x${m[3]}, the file is ${actual.width}x${actual.height}`
      );
    }
  }
}

// 6. A fabricated aggregateRating is the specific claim LEGAL-002 removed.
//    Comments are stripped first: this file's own explanation names it, and so
//    does the comment left in index.html.
const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
if (/aggregateRating/.test(withoutComments)) {
  failures.push(
    'index.html: aggregateRating is back in the static head. Printyx has no countable reviews (LEGAL-002).'
  );
}

if (failures.length) {
  console.error('SEO asset check failed:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`✓ SEO assets resolve and ${blocks.length} JSON-LD blocks parse.`);
