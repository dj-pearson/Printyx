// Shared helpers for locating the prebuilt monitoring-client agent bundle and
// reporting the version the platform currently serves at
// /install/printyx-client.cjs. Used by the heartbeat (auto-update signal) and
// the admin client list (so the UI can show "update available").
import * as fs from 'fs';
import * as path from 'path';

/** Absolute path to the prebuilt agent bundle, or null if not present. */
export function resolveBundlePath(): string | null {
  const candidates = [
    process.env.PRINTYX_CLIENT_BUNDLE_PATH,
    path.resolve(process.cwd(), 'printyx-client', 'dist', 'printyx-client.cjs'),
  ].filter((p): p is string => !!p);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

let cached: { value: string | null; at: number } | null = null;

/**
 * Version the platform currently ships, read from bundle-manifest.json (or
 * printyx-client/package.json as a fallback). Cached for 60s so we don't hit
 * disk on every heartbeat.
 */
export function getPublishedAgentVersion(): string | null {
  const now = Date.now();
  if (cached && now - cached.at < 60_000) return cached.value;

  let version: string | null = null;
  try {
    const bundle = resolveBundlePath();
    if (bundle) {
      const manifest = path.join(path.dirname(bundle), 'bundle-manifest.json');
      if (fs.existsSync(manifest)) {
        version = JSON.parse(fs.readFileSync(manifest, 'utf-8')).version || null;
      }
    }
    if (!version) {
      const pkg = path.resolve(process.cwd(), 'printyx-client', 'package.json');
      if (fs.existsSync(pkg)) version = JSON.parse(fs.readFileSync(pkg, 'utf-8')).version || null;
    }
  } catch {
    version = null;
  }
  cached = { value: version, at: now };
  return version;
}

/** Numeric semver-ish compare. Returns 1 if a>b, -1 if a<b, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}
