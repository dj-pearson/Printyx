// Executive + platform-admin reports — /reports/executive/*
// Replaces server/routes/executive-reports-api.ts.
//
// Endpoints:
//   GET  /reports/executive/dashboard         — strategic KPIs (Level 7+)
//   GET  /reports/executive/platform-admin    — platform-wide (Level 8 only)
//   POST /reports/executive/clear-cache
//
// Express used `requireLevel(7|8)`. We don't have level-based RBAC here yet;
// for `/platform-admin` we explicitly require platform admin via the JWT
// claim that requireAuth surfaces, since exposing all-tenant data to a
// regular user would be a serious leak.
//
// The original service is heavy on hardcoded placeholder values
// (revenueGrowth: 15.3, marketShare: 12.5, etc.). We preserve them here so
// the frontend keeps rendering, but mark them in `degraded` so it's
// traceable when each metric is wired to a real source.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { rangeFromQuery } from '../_date.ts';
import { cached, paramKey, clear as clearCache } from '../_cache.ts';
import { fetchExecutiveSnapshot, fetchPlatformSnapshot } from '../_queries/executive.ts';

const TTL_SECONDS = 300;

interface ExecutiveDashboard {
  financial: {
    totalRevenue: number;
    revenueGrowth: number;
    grossMargin: number;
    netProfit: number;
    arr: number | null;
    mrr: number | null;
  };
  operational: {
    totalEmployees: number;
    customerCount: number;
    customerGrowth: number;
    customerChurn: number;
    nps: number;
    csat: number | null;
  };
  strategic: {
    marketShare: number;
    cac: number;
    ltv: number;
    ltvCacRatio: number;
    monthsToRecover: number;
  };
  kpis: Array<{ name: string; value: number; target: number; status: 'green' | 'yellow' | 'red' }>;
  insights: {
    overallHealth: 'strong' | 'moderate' | 'concerning';
    profitability: number;
    growthTrajectory: 'accelerating' | 'steady' | 'slowing';
    customerHealth: 'excellent' | 'good' | 'needs_attention';
  };
  degraded: {
    revenueGrowth: boolean;
    grossMargin: boolean;
    netProfit: boolean;
    arr: boolean;
    mrr: boolean;
    customerGrowth: boolean;
    customerChurn: boolean;
    nps: boolean;
    marketShare: boolean;
    cacLtv: boolean;
  };
}

interface PlatformAdminDashboard {
  system: {
    uptime: number;
    apiResponseTime: number;
    errorRate: number;
    activeUsers: number;
    requestsPerMinute: number;
  };
  tenants: {
    total: number;
    active: number;
    trial: number;
    paid: number;
    churned: number;
    avgRevenuePerTenant: number;
  };
  billing: {
    totalMRR: number;
    totalARR: number;
    churnRate: number;
    expansionRevenue: number;
    contractionRevenue: number;
  };
  usage: {
    totalUsers: number;
    dailyActiveUsers: number;
    monthlyActiveUsers: number;
    avgSessionDuration: number;
    featureAdoption: Record<string, number>;
  };
  insights: {
    systemHealth: 'excellent' | 'good' | 'needs_attention';
    tenantGrowth: string;
    revenueHealth: 'positive' | 'negative';
    userEngagement: number;
  };
  degraded: {
    system: boolean;
    billing: boolean;
    avgRevenuePerTenant: boolean;
    avgSessionDuration: boolean;
    featureAdoption: boolean;
  };
}

export async function handleExecutive(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts } = ctx;
  // pathParts: ['executive', ...]
  const sub = pathParts[1];

  if (method === 'GET' && sub === 'dashboard') {
    return await cachedDashboard(req, ctx);
  }
  if (method === 'GET' && sub === 'platform-admin') {
    return await cachedPlatformAdmin(req, ctx);
  }
  if (method === 'POST' && sub === 'clear-cache') {
    return await handleClearCache(req, ctx);
  }
  return null;
}

async function cachedDashboard(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:executive:dashboard:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached<ExecutiveDashboard>(key, TTL_SECONDS, () => computeDashboard(ctx));
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch executive dashboard', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

async function cachedPlatformAdmin(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, requestId } = ctx;

  // Platform-admin endpoint exposes data across ALL tenants — gate strictly
  // on the platform_admin claim. requireAuth has already verified the JWT.
  const isPlatformAdmin =
    auth.supabaseUser.app_metadata?.isPlatformAdmin === true ||
    auth.supabaseUser.app_metadata?.role === 'platform_admin';
  if (!isPlatformAdmin) {
    return errorResponse(403, 'Platform admin access required', req, {
      code: 'FORBIDDEN',
      requestId,
    });
  }

  const key = `platform:executive:platform-admin`;
  try {
    const result = await cached<PlatformAdminDashboard>(key, TTL_SECONDS, () =>
      computePlatformAdmin(ctx),
    );
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch platform admin dashboard', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

async function handleClearCache(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, requestId } = ctx;
  // Clear both tenant-scoped (executive dashboard) and platform-scoped
  // (platform-admin) entries the caller is allowed to evict. Platform-admin
  // clear is included only when the caller has the claim — same gate as the
  // GET endpoint.
  const isPlatformAdmin =
    auth.supabaseUser.app_metadata?.isPlatformAdmin === true ||
    auth.supabaseUser.app_metadata?.role === 'platform_admin';
  let removed = clearCache(`${auth.tenantId}:executive:`);
  if (isPlatformAdmin) removed += clearCache('platform:executive:');
  return jsonResponse({ message: 'Executive report cache cleared', removed }, 200, req, requestId);
}

// ─── Compute ────────────────────────────────────────────────────────────────

async function computeDashboard(ctx: HandlerCtx): Promise<ExecutiveDashboard> {
  const { auth, db, url } = ctx;
  const range = rangeFromQuery(url);
  const snap = await fetchExecutiveSnapshot(db, auth.tenantId, range.start, range.end);
  const customerCount = snap.customerCount > 0 ? snap.customerCount : 1;

  // Hardcoded placeholders preserved for UI compatibility — see `degraded`.
  const revenueGrowth = 15.3;
  const grossMargin = 65.0;
  const netProfit = snap.totalRevenue * 0.2;
  const customerGrowth = 8.5;
  const customerChurn = 2.1;
  const nps = 45;
  const marketShare = 12.5;

  const csatStatus: 'green' | 'yellow' | 'red' =
    snap.csat !== null && snap.csat >= 4.5 ? 'green' : 'yellow';

  const kpis: ExecutiveDashboard['kpis'] = [
    { name: 'Revenue Growth', value: revenueGrowth, target: 20, status: 'yellow' },
    { name: 'Gross Margin', value: grossMargin, target: 60, status: 'green' },
    {
      name: 'Customer Satisfaction',
      value: snap.csat ?? 0,
      target: 4.5,
      status: csatStatus,
    },
    { name: 'NPS', value: nps, target: 50, status: 'yellow' },
    { name: 'Churn Rate', value: customerChurn, target: 3.0, status: 'green' },
  ];

  const greenCount = kpis.filter((k) => k.status === 'green').length;
  const redCount = kpis.filter((k) => k.status === 'red').length;
  const overallHealth: ExecutiveDashboard['insights']['overallHealth'] =
    greenCount >= 3 ? 'strong' : redCount >= 2 ? 'concerning' : 'moderate';

  const growthTrajectory: ExecutiveDashboard['insights']['growthTrajectory'] =
    revenueGrowth >= 15 ? 'accelerating' : revenueGrowth >= 5 ? 'steady' : 'slowing';

  const customerHealth: ExecutiveDashboard['insights']['customerHealth'] =
    customerChurn < 3 && nps > 40
      ? 'excellent'
      : customerChurn < 5 && nps > 30
        ? 'good'
        : 'needs_attention';

  return {
    financial: {
      totalRevenue: round2(snap.totalRevenue),
      revenueGrowth,
      grossMargin,
      netProfit: round2(netProfit),
      arr: null,
      mrr: null,
    },
    operational: {
      totalEmployees: snap.totalEmployees,
      customerCount: snap.customerCount,
      customerGrowth,
      customerChurn,
      nps,
      csat: snap.csat,
    },
    strategic: {
      marketShare,
      cac: round2((snap.totalRevenue / customerCount) * 0.3),
      ltv: round2((snap.totalRevenue / customerCount) * 3),
      ltvCacRatio: 3.0,
      monthsToRecover: 8,
    },
    kpis,
    insights: {
      overallHealth,
      profitability: snap.totalRevenue > 0 ? round2((netProfit / snap.totalRevenue) * 100) : 0,
      growthTrajectory,
      customerHealth,
    },
    degraded: {
      revenueGrowth: true,
      grossMargin: true,
      netProfit: true,
      arr: true,
      mrr: true,
      customerGrowth: true,
      customerChurn: true,
      nps: true,
      marketShare: true,
      cacLtv: true,
    },
  };
}

async function computePlatformAdmin(ctx: HandlerCtx): Promise<PlatformAdminDashboard> {
  const { db } = ctx;
  const snap = await fetchPlatformSnapshot(db);

  const avgRevenuePerTenant = 2500; // placeholder — no billing source yet
  const totalMRR = snap.totalTenants * avgRevenuePerTenant;
  const totalARR = totalMRR * 12;
  const expansionRevenue = snap.totalTenants * 250;
  const contractionRevenue = snap.totalTenants * 50;

  const tenantGrowth =
    snap.totalTenants > 0
      ? `${(((snap.activeTenants - snap.churnedTenants) / snap.totalTenants) * 100).toFixed(1)}%`
      : '0.0%';

  return {
    system: {
      uptime: 99.95,
      apiResponseTime: 145,
      errorRate: 0.02,
      activeUsers: snap.dau,
      requestsPerMinute: 1250,
    },
    tenants: {
      total: snap.totalTenants,
      active: snap.activeTenants,
      trial: snap.trialTenants,
      paid: snap.paidTenants,
      churned: snap.churnedTenants,
      avgRevenuePerTenant,
    },
    billing: {
      totalMRR,
      totalARR,
      churnRate: 1.8,
      expansionRevenue,
      contractionRevenue,
    },
    usage: {
      totalUsers: snap.totalUsers,
      dailyActiveUsers: snap.dau,
      monthlyActiveUsers: snap.mau,
      avgSessionDuration: 28,
      featureAdoption: {},
    },
    insights: {
      systemHealth: 'good', // placeholder pending real telemetry
      tenantGrowth,
      revenueHealth: expansionRevenue > contractionRevenue ? 'positive' : 'negative',
      userEngagement: snap.mau > 0 ? round2((snap.dau / snap.mau) * 100) : 0,
    },
    degraded: {
      system: true,
      billing: true,
      avgRevenuePerTenant: true,
      avgSessionDuration: true,
      featureAdoption: true,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
