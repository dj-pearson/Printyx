#!/usr/bin/env node
/**
 * Hard gate at zero. Four properties, no baseline - none of them has a correct
 * non-zero version.
 *
 * 1. STALE FILE. `client/public/_headers` must be exactly what
 *    `shared/security-headers.ts` renders. Cloudflare Pages serves the document
 *    in production, so that file is the only thing carrying a CSP, HSTS or a
 *    frame policy to a real user; Helmet covers Express, which never answers
 *    printyx.net. A hand-edit that drifts from the module is a policy nobody
 *    reviewed.
 *
 * 2. A REFUSED CAPABILITY THE APP USES. Permissions-Policy `camera=()` does not
 *    warn, it makes the browser reject getUserMedia. The client tree is walked
 *    for each feature's API, and a feature that is used may not be refused.
 *    This is the check that would have caught the original defect: the policy
 *    shipped with camera, microphone and geolocation all at `()` while routed
 *    pages used all three.
 *
 * 3. AN EMBEDDABLE SURFACE WITH NO EXEMPTION. `frame-ancestors 'none'` breaks
 *    any surface the product asks a customer to embed. Every file that builds
 *    an `<iframe src=` snippet pointing at our own origin must name a path
 *    prefix listed in EMBEDDABLE_PATH_PREFIXES. BLIND SPOT, stated so a pass is
 *    never read as proof: the origin and the path have to appear in the SAME
 *    file, so a snippet built through a helper (client/src/lib/booking-link.ts
 *    is one) is invisible here.
 *
 * 4. AN EXECUTABLE INLINE SCRIPT IN THE DOCUMENT. A static host cannot mint a
 *    per-request nonce, so `script-src 'self'` is the whole allowance and an
 *    inline script would be blocked. `application/ld+json` blocks are exempt
 *    because the HTML spec never prepares a data block as a script, so CSP
 *    never applies to one.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('tsx/cjs');

const repoRoot = resolve(fileURLToPath(import.meta.url), '../..');
const HEADERS_PATH = resolve(repoRoot, 'client/public/_headers');
const CLIENT_SRC = resolve(repoRoot, 'client/src');
const INDEX_HTML = resolve(repoRoot, 'client/index.html');
const DIST_INDEX_HTML = resolve(repoRoot, 'dist/index.html');

const policy = require(resolve(repoRoot, 'shared/security-headers.ts'));

/** Source extensions worth walking. */
const SOURCE_EXT = new Set(['.ts', '.tsx']);

export function clientFiles() {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else if (SOURCE_EXT.has(extname(entry))) out.push(full);
    }
  };
  walk(CLIENT_SRC);
  return out;
}

/**
 * Line comments first, then block comments blanked to spaces so reported line
 * numbers stay honest. The `(?<![:/])` lookbehind keeps `https://` intact -
 * stripping block comments first reads a line comment ending in `/*` as an
 * opener and blanks whatever follows.
 */
function stripComments(src) {
  const withoutLine = src.replace(/(?<![:/])\/\/.*$/gm, '');
  return withoutLine.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/** A Permissions-Policy feature and how to spot it being used in the client. */
const FEATURE_USAGE = {
  geolocation: /navigator\s*\.\s*geolocation/,
  camera: /getUserMedia\s*\(\s*\{[^}]*\bvideo\b/,
  microphone: /getUserMedia\s*\(\s*\{[^}]*\baudio\b|new\s+MediaRecorder\s*\(/,
  payment: /new\s+PaymentRequest\s*\(/,
};

/**
 * The three content rules are pure so they can be exercised against fixtures
 * with an accept case AND a reject case. A source-level check of the guard
 * cannot tell a working rule from a dead one - the constant it matches is
 * still in the file either way.
 */
export function capabilityFindings(features, sources) {
  const out = [];
  for (const [feature, pattern] of Object.entries(FEATURE_USAGE)) {
    if (features[feature] !== '()') continue;
    const user = sources.find(({ src }) => pattern.test(src));
    if (user) {
      out.push({
        kind: 'refused-capability',
        detail:
          `Permissions-Policy refuses "${feature}" with an empty allowlist, but ` +
          `${user.file} uses it. The browser will reject the API.`,
      });
    }
  }
  return out;
}

export function embedFindings(prefixes, sources) {
  const out = [];
  for (const { file, src } of sources) {
    if (!/<iframe\s+src=/.test(src)) continue;
    const paths = new Set();
    for (const m of src.matchAll(/window\s*\.\s*location\s*\.\s*origin\}?(\/[a-zA-Z0-9-]+)\//g)) {
      paths.add(`${m[1]}/`);
    }
    for (const path of paths) {
      if (!prefixes.includes(path)) {
        out.push({
          kind: 'unexempted-embed',
          detail:
            `${file} builds an <iframe> snippet pointing at "${path}", which ` +
            "frame-ancestors 'none' blocks. Add it to EMBEDDABLE_PATH_PREFIXES in " +
            'shared/security-headers.ts, or the embed is dead.',
        });
      }
    }
  }
  return out;
}

export function inlineScriptFindings(documents) {
  const out = [];
  for (const { file, html } of documents) {
    for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      const attrs = m[1];
      const body = m[2].trim();
      if (/\bsrc\s*=/.test(attrs)) continue; // external, governed by the origin
      if (!body) continue;
      const type = /type\s*=\s*["']([^"']*)["']/.exec(attrs)?.[1]?.toLowerCase() ?? '';
      // A data block is never prepared as a script, so CSP does not reach it.
      const isDataBlock = type && !/^(module|text\/javascript|application\/javascript)$/.test(type);
      if (isDataBlock) continue;
      out.push({
        kind: 'inline-script',
        detail:
          `${file} carries an executable inline <script> (type="${type || 'classic'}"). ` +
          "A static host cannot nonce it, so script-src 'self' blocks it and the page " +
          'does not boot.',
      });
    }
  }
  return out;
}

export function findings() {
  const out = [];

  // (1) staleness
  const expected = policy.renderHeadersFile();
  if (!existsSync(HEADERS_PATH)) {
    out.push({
      kind: 'missing-headers-file',
      detail:
        'client/public/_headers does not exist, so Cloudflare Pages serves the app with no CSP, ' +
        'no frame policy and no HSTS. Run `npm run security:headers`.',
    });
  } else if (readFileSync(HEADERS_PATH, 'utf8') !== expected) {
    out.push({
      kind: 'stale-headers-file',
      detail:
        'client/public/_headers disagrees with shared/security-headers.ts. ' +
        'Run `npm run security:headers` and review the diff.',
    });
  }

  const files = clientFiles();
  const rel = (f) => f.slice(repoRoot.length + 1);
  const sources = files.map((f) => ({
    file: rel(f),
    src: stripComments(readFileSync(f, 'utf8')),
  }));

  out.push(...capabilityFindings(policy.PERMISSIONS_POLICY_FEATURES, sources));
  out.push(...embedFindings([...policy.EMBEDDABLE_PATH_PREFIXES], sources));
  out.push(
    ...inlineScriptFindings(
      [INDEX_HTML, DIST_INDEX_HTML]
        .filter((p) => existsSync(p))
        .map((p) => ({ file: rel(p), html: readFileSync(p, 'utf8') })),
    ),
  );

  return { findings: out, corpus: files.length };
}

function main() {
  const { findings: out, corpus } = findings();

  if (corpus < 200) {
    console.error(
      `check:security-headers walked only ${corpus} client source files - the walk is broken, ` +
        'so a clean run would mean nothing.',
    );
    process.exit(2);
  }

  if (out.length === 0) {
    console.log(
      `✓ Security headers: client/public/_headers is current, every Permissions-Policy ` +
        `feature the app uses is permitted, every embed snippet has a frame exemption, and the ` +
        `document carries no inline script (${corpus} client files scanned).`,
    );
    return;
  }

  console.error(`check:security-headers found ${out.length} problem(s):\n`);
  for (const f of out) console.error(`  [${f.kind}] ${f.detail}`);
  console.error('');
  process.exit(1);
}

const isEntryPoint =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) main();
