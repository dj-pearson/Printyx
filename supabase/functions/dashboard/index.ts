// Dashboard Edge Function (PROD-014)
//
// ModularDashboard.tsx reads /api/dashboard/modules and /card-config.
//
// This function used to answer `modules` with FOUR HARDCODED CARDS — '$125,430'
// monthly revenue, 48 active deals, 1,247 customers — under card ids
// ('revenue', 'deals', 'tasks', 'customers') that no other part of the system
// uses, as a bare array rather than the { modules, userRole, roleConfig } the
// page destructures. So the fabricated numbers never actually rendered: the
// page's default [] applied and production showed the "no modules" empty state.
// card-config answered with the same invented ids, so nothing a user switched
// on matched anything either.
//
// It now computes the same per-tenant aggregates Express computes, using the
// role -> cards map and card presentation from _shared/dashboard-cards.ts so
// both backends emit identical card ids, titles and categories.
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  buildCard,
  formatCurrency,
  parseEnabledParam,
  resolveActiveCards,
  roleCards,
  sumNumeric,
} from '../_shared/dashboard-cards.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createCorsResponse({ error: 'Missing or invalid Authorization header' }, 401, req);
    }
    const jwt = authHeader.slice(7);

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();

    // Tenant from the verified JWT; the header is a fallback, never an override.
    const jwtTenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);
    const headerTenantId = req.headers.get('x-tenant-id') || undefined;
    const isPlatformAdmin =
      user.app_metadata?.isPlatformAdmin === true || user.app_metadata?.role === 'platform_admin';
    if (headerTenantId && jwtTenantId && headerTenantId !== jwtTenantId && !isPlatformAdmin) {
      return createCorsResponse(
        { message: 'Tenant access denied', code: 'TENANT_ACCESS_DENIED' },
        403,
        req,
      );
    }
    let tenantId = jwtTenantId || headerTenantId;
    if (!tenantId) {
      const { data: dbUser } = await admin
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();
      tenantId = dbUser?.tenant_id;
    }

    const userRole = (user.app_metadata as Record<string, unknown>)?.role as string | undefined;

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'dashboard');
    const endpoint = parts[0];

    // ------------------------------------------------------------------
    // GET /dashboard/card-config
    // ------------------------------------------------------------------
    if (endpoint === 'card-config') {
      const config = roleCards(userRole ?? 'sales');
      return createCorsResponse(
        {
          role: userRole ?? 'sales',
          defaultCards: config.defaultCards,
          availableCards: config.availableCards,
          allCards: [...config.defaultCards, ...config.availableCards],
        },
        200,
        req,
      );
    }

    // ------------------------------------------------------------------
    // GET /dashboard/modules
    // ------------------------------------------------------------------
    if (endpoint === 'modules') {
      if (!tenantId) {
        return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
      }

      // The page sends the switched-on cards as ?enabled=a,b — the same
      // parameter Express reads.
      const enabledCards = parseEnabledParam(url.searchParams.get('enabled'));
      const { config: roleConfig, activeCards } = resolveActiveCards(
        userRole ?? 'sales',
        enabledCards,
      );

      const monthStart = (() => {
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      })();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

      /** Invoiced total since `since`. numeric arrives as a string. */
      const invoicedSince = async (since: string): Promise<number> => {
        const { data } = await admin
          .from('invoices')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', since);
        return sumNumeric((data ?? []).map((r: Record<string, unknown>) => r.total_amount));
      };

      // Counts are written as direct .from(...).select(...) chains rather than
      // through a helper taking a callback: scripts/check-phantom-columns.ts
      // resolves a column literal against the table its call chain is on, and a
      // filter applied inside a lambda is attributed to the wrong table. Writing
      // code the checker cannot read is how a 42703 gets through.
      const countAll = async (table: string): Promise<number> => {
        const { count } = await admin
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);
        return count ?? 0;
      };

      const countRecords = async (recordType: string): Promise<number> => {
        const { count } = await admin
          .from('business_records')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('record_type', recordType);
        return count ?? 0;
      };

      const countOpenTickets = async (): Promise<number> => {
        const { count } = await admin
          .from('service_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['open', 'in_progress']);
        return count ?? 0;
      };

      const countActiveContracts = async (): Promise<number> => {
        const { count } = await admin
          .from('contracts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'active');
        return count ?? 0;
      };

      const modules: Array<Record<string, unknown>> = [];
      const push = (card: Record<string, unknown> | null) => {
        if (card) modules.push(card);
      };

      try {
        if (activeCards.includes('personal_revenue')) {
          push(buildCard('personal_revenue', formatCurrency(await invoicedSince(monthStart))));
        }

        if (activeCards.includes('personal_deals')) {
          push(buildCard('personal_deals', await countAll('deals')));
        }

        if (activeCards.includes('personal_leads')) {
          push(buildCard('personal_leads', await countRecords('lead')));
        }

        if (activeCards.includes('personal_tickets')) {
          push(buildCard('personal_tickets', await countAll('service_tickets')));
        }

        if (activeCards.includes('team_revenue')) {
          push(
            buildCard('team_revenue', formatCurrency(await invoicedSince(monthStart)), {
              enabled: enabledCards.includes('team_revenue'),
            }),
          );
        }

        if (activeCards.includes('company_customers')) {
          push(
            buildCard('company_customers', await countRecords('customer'), {
              enabled: enabledCards.includes('company_customers'),
            }),
          );
        }

        if (activeCards.includes('inventory_alerts')) {
          // PostgREST cannot compare two columns, so the comparison happens
          // here. The column is quantity_on_hand — Express named a
          // current_stock column that does not exist and raised 42703.
          const { data: stock } = await admin
            .from('inventory_items')
            .select('quantity_on_hand,reorder_point')
            .eq('tenant_id', tenantId);
          const low = (stock ?? []).filter((r: Record<string, unknown>) => {
            const onHand = Number(r.quantity_on_hand ?? 0);
            const reorder = Number(r.reorder_point ?? 0);
            return Number.isFinite(onHand) && Number.isFinite(reorder) && onHand <= reorder;
          }).length;
          push(
            buildCard('inventory_alerts', low, {
              enabled: enabledCards.includes('inventory_alerts'),
            }),
          );
        }

        if (activeCards.includes('service_overview')) {
          const [total, open] = await Promise.all([
            countAll('service_tickets'),
            countOpenTickets(),
          ]);
          push(
            buildCard('service_overview', open, {
              subtitle: `${total} total tickets`,
              enabled: enabledCards.includes('service_overview'),
            }),
          );
        }

        if (activeCards.includes('revenue_overview')) {
          push(
            buildCard('revenue_overview', formatCurrency(await invoicedSince(monthStart)), {
              enabled: enabledCards.includes('revenue_overview'),
            }),
          );
        }

        if (activeCards.includes('business_overview')) {
          const [customers, activeContracts, revenue, pendingTickets] = await Promise.all([
            countRecords('customer'),
            countActiveContracts(),
            invoicedSince(thirtyDaysAgo),
            countOpenTickets(),
          ]);
          push(
            buildCard('business_overview', 0, {
              data: { customers, activeContracts, monthlyRevenue: revenue, pendingTickets },
            }),
          );
        }

        if (activeCards.includes('revenue_summary')) {
          push(buildCard('revenue_summary', formatCurrency(await invoicedSince(thirtyDaysAgo))));
        }

        if (activeCards.includes('customer_summary')) {
          push(buildCard('customer_summary', await countRecords('customer')));
        }

        if (activeCards.includes('service_summary')) {
          push(buildCard('service_summary', await countOpenTickets()));
        }
      } catch (queryError) {
        console.error('Error building dashboard modules:', queryError);
        // Same fallback card Express uses, so a failed query looks the same on
        // both backends rather than silently showing fewer cards.
        modules.length = 0;
        modules.push({
          id: 'fallback',
          category: 'sales',
          title: 'Dashboard Loading...',
          value: '---',
          subtitle: 'Data loading in progress',
          icon: 'BarChart3',
        });
      }

      return createCorsResponse(
        {
          modules,
          userRole: userRole ?? 'sales',
          roleConfig: {
            defaultCards: roleConfig.defaultCards,
            availableCards: roleConfig.availableCards,
            activeCards,
          },
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Dashboard function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
