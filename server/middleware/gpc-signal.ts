/**
 * Global Privacy Control (GPC) support — CCPA/CPRA.
 *
 * GPC is a browser signal (the `Sec-GPC: 1` request header) that a business must
 * treat as a valid opt-out of the "sale"/"sharing" of personal information.
 *
 * - `gpcSignal` attaches `req.gpc` so any handler that would sell/share data (or
 *   set cross-context advertising cookies) can suppress that behavior.
 * - `gpcWellKnown` serves the standard `/.well-known/gpc.json` discovery file
 *   declaring that this site honors GPC, which regulators and browsers can check.
 */

import type { Request, Response, NextFunction } from 'express';

export interface GpcRequest extends Request {
  gpc?: boolean;
}

export function gpcSignal(req: GpcRequest, _res: Response, next: NextFunction): void {
  // Header values other than "1" (including absent) are treated as no signal.
  req.gpc = req.header('Sec-GPC') === '1';
  next();
}

// Static: the date the site's GPC support was last affirmed.
const GPC_LAST_UPDATE = '2026-07-23';

export function gpcWellKnown(_req: Request, res: Response): void {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.json({ gpc: true, lastUpdate: GPC_LAST_UPDATE });
}
