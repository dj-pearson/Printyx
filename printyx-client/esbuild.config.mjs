// Bundle the monitoring client into a single, self-contained CommonJS file.
//
// Output: dist/printyx-client.cjs — every dependency inlined, no node_modules
// needed at runtime. This is what the platform ships to customer print
// servers so the installer never has to run `npm install` or `tsc`.
//
// All runtime deps (net-snmp, bonjour-service, winston, axios, commander,
// node-cron, ip-range-check, dotenv) are pure JS, so a single-file node
// bundle works without native addons.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const outfile = join(root, 'dist', 'printyx-client.cjs');

await build({
  entryPoints: [join(root, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile,
  // No banner: src/index.ts already starts with `#!/usr/bin/env node` and
  // esbuild preserves that shebang on line 1. Adding our own would produce a
  // second shebang on line 2, which Node parses as invalid JS.
  // package.json is `require()`d by src/index.ts for the version string;
  // esbuild inlines it at build time, so nothing on disk is needed at runtime.
  loader: { '.json': 'json' },
  legalComments: 'none',
  minify: false, // keep readable stack traces in the field; size is already tiny
  logLevel: 'info',
  define: {
    'process.env.PRINTYX_CLIENT_VERSION': JSON.stringify(pkg.version),
  },
});

// chmod +x for POSIX targets (no-op semantics on Windows).
try {
  chmodSync(outfile, 0o755);
} catch {
  /* Windows — ignore */
}

// Drop a tiny manifest next to the bundle so the installer and the platform
// can show which version a zip carries without unpacking the JS.
writeFileSync(
  join(root, 'dist', 'bundle-manifest.json'),
  JSON.stringify({ name: pkg.name, version: pkg.version, entry: 'printyx-client.cjs' }, null, 2),
);

console.log(`\nBundled ${pkg.name} v${pkg.version} -> dist/printyx-client.cjs`);
