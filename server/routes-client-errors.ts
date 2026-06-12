/**
 * Client Error Reporting Routes (US-024)
 *
 * Receives React error-boundary reports from the frontend and writes them to
 * server-side structured logs so production page crashes are observable.
 *
 * Deliberately unauthenticated: errors can occur on public pages (login,
 * marketing) and during broken auth states - exactly when reporting matters
 * most. The endpoint writes nothing to the database; input is Zod-validated
 * with hard length caps and covered by the global tiered rate limiter.
 */

import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { createModuleLogger } from './lib/logger';
import { getUserId, getTenantId } from './utils/auth-helpers';

const log = createModuleLogger('client-errors');

const clientErrorSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(10000).optional(),
  componentStack: z.string().max(10000).optional(),
  boundary: z.string().max(200).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  timestamp: z.string().max(50).optional(),
});

export function registerClientErrorRoutes(app: Express) {
  app.post('/api/client-errors', (req: Request, res: Response) => {
    const parsed = clientErrorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }

    const report = parsed.data;
    log.error(
      {
        clientError: report,
        userId: getUserId(req),
        tenantId: getTenantId(req),
        ip: req.ip,
        requestId: (req as any).requestId,
      },
      `Client error [${report.boundary ?? 'unknown'}]: ${report.message}`,
    );

    return res.status(204).end();
  });
}

export default registerClientErrorRoutes;
