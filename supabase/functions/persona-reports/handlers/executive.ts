// Executive reports — /persona-reports/executive/*
// Replaces server/routes/executive-reports-api.ts (3 endpoints, 131 lines).
//
// /dashboard          — level 7+ (executive), tenant-scoped financials + KPIs
// /platform-admin     — level 8 only, cross-tenant platform metrics
// /clear-cache        — level 7+, stateless no-op

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { hasMinLevel, parseDateRange } from '../_context.ts';

export async function handleExecutive(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts, url } = ctx;
  // pathParts: ['executive', ...]
  const [, second] = pathParts;

  // GET /executive/dashboard — level 7+
  if (method === 'GET' && second === 'dashboard') {
    if (!hasMinLevel(auth, 7)) {
      return errorResponse(403, 'Executive access required', req, {
        code: 'FORBIDDEN',
        details: { minLevel: 7 },
        requestId,
      });
    }

    const { dateFrom, dateTo } = parseDateRange(url);
    const { data, error } = await db.rpc('report_executive_dashboard', {
      p_tenant_id: auth.tenantId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (error) {
      return errorResponse(500, 'Failed to fetch executive dashboard', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    const payload = (data ?? {}) as {
      kpis?: Array<{ status: 'green' | 'yellow' | 'red' }>;
      financial?: { netProfit?: number; totalRevenue?: number; revenueGrowth?: number };
      operational?: { customerChurn?: number; nps?: number };
    };

    const kpis = payload.kpis ?? [];
    const greenCount = kpis.filter((k) => k.status === 'green').length;
    const redCount = kpis.filter((k) => k.status === 'red').length;
    const netProfit = Number(payload.financial?.netProfit ?? 0);
    const totalRevenue = Number(payload.financial?.totalRevenue ?? 0);
    const revenueGrowth = Number(payload.financial?.revenueGrowth ?? 0);
    const churn = Number(payload.operational?.customerChurn ?? 0);
    const nps = Number(payload.operational?.nps ?? 0);

    return jsonResponse(
      {
        ...payload,
        insights: {
          overallHealth: greenCount >= 3 ? 'strong' : redCount >= 2 ? 'concerning' : 'moderate',
          profitability:
            totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(2)) : 0,
          growthTrajectory:
            revenueGrowth >= 15 ? 'accelerating' : revenueGrowth >= 5 ? 'steady' : 'slowing',
          customerHealth:
            churn < 3 && nps > 40
              ? 'excellent'
              : churn < 5 && nps > 30
                ? 'good'
                : 'needs_attention',
        },
      },
      200,
      req,
      requestId,
    );
  }

  // GET /executive/platform-admin — level 8 only
  if (method === 'GET' && second === 'platform-admin') {
    if (!hasMinLevel(auth, 8)) {
      return errorResponse(403, 'Platform admin access required', req, {
        code: 'FORBIDDEN',
        details: { minLevel: 8 },
        requestId,
      });
    }

    const { data, error } = await db.rpc('report_platform_admin_dashboard');

    if (error) {
      return errorResponse(500, 'Failed to fetch platform admin dashboard', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    const payload = (data ?? {}) as {
      system?: { uptime?: number; errorRate?: number };
      tenants?: { total?: number; active?: number; churned?: number };
      billing?: { expansionRevenue?: number; contractionRevenue?: number };
      usage?: { dailyActiveUsers?: number; monthlyActiveUsers?: number };
    };

    const uptime = Number(payload.system?.uptime ?? 0);
    const errorRate = Number(payload.system?.errorRate ?? 0);
    const totalTenants = Number(payload.tenants?.total ?? 0);
    const activeTenants = Number(payload.tenants?.active ?? 0);
    const churnedTenants = Number(payload.tenants?.churned ?? 0);
    const expansion = Number(payload.billing?.expansionRevenue ?? 0);
    const contraction = Number(payload.billing?.contractionRevenue ?? 0);
    const dau = Number(payload.usage?.dailyActiveUsers ?? 0);
    const mau = Number(payload.usage?.monthlyActiveUsers ?? 1);

    return jsonResponse(
      {
        ...payload,
        insights: {
          systemHealth:
            uptime >= 99.9 && errorRate < 0.1
              ? 'excellent'
              : uptime >= 99.5 && errorRate < 0.5
                ? 'good'
                : 'needs_attention',
          tenantGrowth:
            totalTenants > 0
              ? `${(((activeTenants - churnedTenants) / totalTenants) * 100).toFixed(1)}%`
              : '0.0%',
          revenueHealth: expansion > contraction ? 'positive' : 'negative',
          userEngagement: mau > 0 ? Number(((dau / mau) * 100).toFixed(2)) : 0,
        },
      },
      200,
      req,
      requestId,
    );
  }

  // POST /executive/clear-cache — level 7+, stateless no-op
  if (method === 'POST' && second === 'clear-cache') {
    if (!hasMinLevel(auth, 7)) {
      return errorResponse(403, 'Executive access required', req, {
        code: 'FORBIDDEN',
        details: { minLevel: 7 },
        requestId,
      });
    }
    return jsonResponse(
      {
        message: 'Cache cleared successfully',
        note: 'Edge functions are stateless; cache was a no-op.',
      },
      200,
      req,
      requestId,
    );
  }

  return null;
}
