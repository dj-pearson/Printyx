// Dev-only route divergence detector (EDGE-013).
//
// In production the frontend calls functions.printyx.net/<route> directly, so
// edge functions are the live handlers. In dev, /api/* goes to Express, which
// serves locally except for the prefixes in edge-function-proxy.ts. That means
// for any "both-divergent" domain (Express handler + edge function exists, not
// proxied) a developer is testing STALE Express code that production never
// runs — a silent trap.
//
// This logs those domains at startup so the divergence is loud, not silent.
// It reads docs/route-divergence.json (produced by `npm run audit:routes`).
// No-op in production and when the report is absent.
import * as fs from 'fs';
import * as path from 'path';
import { createModuleLogger } from '../lib/logger';
import { PROXIED_PREFIXES } from './edge-function-proxy';

const log = createModuleLogger('route-divergence');

export function logRouteDivergence(): void {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.PRINTYX_SKIP_DIVERGENCE_CHECK === 'true') return;

  try {
    const reportPath = path.resolve(process.cwd(), 'docs', 'route-divergence.json');
    if (!fs.existsSync(reportPath)) {
      log.debug(
        'No route-divergence.json — run `npm run audit:routes` to enable the dev divergence check.',
      );
      return;
    }
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as {
      bothDivergent?: string[];
      missingEdge?: string[];
    };

    // Exclude anything since folded into the proxy map (dev now matches prod).
    const stillDivergent = (report.bothDivergent || []).filter((d) => !PROXIED_PREFIXES.has(d));

    const preview = (list: string[], n = 15) =>
      list.length <= n
        ? list.join(', ')
        : `${list.slice(0, n).join(', ')}, …+${list.length - n} more`;

    if (stillDivergent.length > 0) {
      log.warn(
        `⚠ ${stillDivergent.length} route domains diverge dev↔prod: dev serves Express, ` +
          `PROD serves the edge function (not proxied) — you may be testing stale code. ` +
          `Confirm parity, then fold into edge-function-proxy.ts (EDGE-013). ` +
          `See docs/route-parity-matrix.md. Domains: ${preview(stillDivergent)}`,
      );
    }

    const missing = report.missingEdge || [];
    if (missing.length > 0) {
      log.warn(
        `⚠ ${missing.length} route domains are called by the frontend but have NO matching edge ` +
          `function (heuristic — some are name mismatches). These fail in PROD, not dev (EDGE-014). ` +
          `Domains: ${preview(missing)}`,
      );
    }

    if (stillDivergent.length === 0 && missing.length === 0) {
      log.info('Route parity check: no divergence flagged.');
    }
  } catch (err) {
    log.debug('Route divergence check skipped', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
