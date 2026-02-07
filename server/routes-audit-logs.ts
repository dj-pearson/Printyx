import { Express, Request, Response } from 'express';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { isPlatformAdmin } from './utils/auth-helpers';
import { queryAuditLogs } from './services/audit-log-service';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('routes-audit-logs');

export function registerAuditLogRoutes(app: Express) {
  app.get('/api/audit-logs', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isPlatformAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden: platform admin access required' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const action = req.query.action as string | undefined;
      const userId = req.query.userId as string | undefined;
      const category = req.query.category as string | undefined;

      const tenantId = (req as any).user?.tenantId || (req.headers['x-tenant-id'] as string);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const result = await queryAuditLogs({
        tenantId,
        page,
        limit,
        startDate,
        endDate,
        action,
        userId,
        category,
      });

      return res.json(result);
    } catch (error) {
      log.error('Failed to query audit logs', { error });
      return res.status(500).json({ message: 'Failed to retrieve audit logs' });
    }
  });
}

export default registerAuditLogRoutes;
