// Platform Customer Success Edge Function
// Health scoring, churn prediction, success interventions, and CS metrics for
// the platform CRM. Root-admin only (role level >= 7 OR can_access_all_tenants).
//
// Ported from server/routes-platform-customer-success.ts (EDGE-004). Express
// 404s in production where the frontend hits functions.printyx.net/platform-cs
// directly. All queries use the canonical platform_* tables in
// shared/platform-crm-schema.ts.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { cachedRoleLookup } from '../_shared/auth-cache.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();

    // AUDIT-005: this users->roles gate ran on EVERY request to this fn, a second
    // serialized hop after auth.getUser. Cached by user id for ROLE_CACHE_TTL_MS
    // (default 30s) — a role change takes effect within that window.
    const { data: userWithRole } = await cachedRoleLookup(user.id, () =>
      admin
        .from('users')
        .select('role_id, roles!inner(level, can_access_all_tenants)')
        .eq('id', user.id)
        .single(),
    );

    const roleLevel = (userWithRole?.roles as any)?.level || 0;
    const canAccessAllTenants = (userWithRole?.roles as any)?.can_access_all_tenants || false;

    if (roleLevel < 7 && !canAccessAllTenants) {
      return createCorsResponse({ error: 'Root admin access required' }, 403, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'platform-cs');
    const resource = parts[0];
    const sub = parts[1];

    // ----------------------------------------------------------------------
    // METRICS
    // ----------------------------------------------------------------------
    if (req.method === 'GET' && resource === 'metrics') {
      try {
        const counts = await Promise.all([
          admin.from('platform_health_scores').select('*', { count: 'exact', head: true }),
          admin
            .from('platform_health_scores')
            .select('*', { count: 'exact', head: true })
            .eq('health_status', 'healthy'),
          admin
            .from('platform_health_scores')
            .select('*', { count: 'exact', head: true })
            .eq('health_status', 'at_risk'),
          admin
            .from('platform_health_scores')
            .select('*', { count: 'exact', head: true })
            .eq('health_status', 'critical'),
        ]);
        const total = counts[0].count || 0;
        const healthy = counts[1].count || 0;
        const atRisk = counts[2].count || 0;
        const critical = counts[3].count || 0;

        // AUDIT-006: this averaged overall_score over a plain select of every row.
        // PostgREST silently caps a response at db-max-rows (1000) WITHOUT erroring,
        // so past 1000 health scores the average was computed over an arbitrary
        // subset — a wrong number, not just a slow one. Page explicitly so the mean
        // is over the full set. (The counts above already use head:true correctly.)
        const scoreRows: Array<{ overall_score: number | null }> = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await admin
            .from('platform_health_scores')
            .select('overall_score')
            .range(offset, offset + 999);
          if (error || !data || data.length === 0) break;
          scoreRows.push(...data);
          if (data.length < 1000) break;
        }
        const avg =
          scoreRows.length > 0
            ? scoreRows.reduce((s: number, r: any) => s + (r.overall_score || 0), 0) /
              scoreRows.length
            : 0;

        return createCorsResponse(
          {
            totalCustomers: total,
            healthyCount: healthy,
            atRiskCount: atRisk,
            criticalCount: critical,
            averageHealthScore: Math.round(avg * 10) / 10,
            retentionRate: total > 0 ? Math.round(((total - critical) / total) * 1000) / 10 : 100,
          },
          200,
          req,
        );
      } catch (_e) {
        return createCorsResponse(
          {
            totalCustomers: 0,
            healthyCount: 0,
            atRiskCount: 0,
            criticalCount: 0,
            averageHealthScore: 0,
            retentionRate: 100,
          },
          200,
          req,
        );
      }
    }

    // ----------------------------------------------------------------------
    // CSMS
    // ----------------------------------------------------------------------
    if (req.method === 'GET' && resource === 'csms') {
      const { data: rows } = await admin
        .from('platform_health_scores')
        .select('assigned_csm')
        .not('assigned_csm', 'is', null);
      const seen = new Set<string>();
      const csms: { id: string; name: string }[] = [];
      for (const r of rows || []) {
        const id = (r as any).assigned_csm;
        if (id && !seen.has(id)) {
          seen.add(id);
          csms.push({ id, name: id });
        }
      }
      return createCorsResponse(csms, 200, req);
    }

    // ----------------------------------------------------------------------
    // HEALTH SCORES
    // ----------------------------------------------------------------------
    if (resource === 'health-scores') {
      // POST /health-scores/calculate
      if (req.method === 'POST' && sub === 'calculate') {
        const body = await req.json().catch(() => ({}));
        const businessRecordId = body.businessRecordId;
        if (!businessRecordId) {
          return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
        }
        const { data: br } = await admin
          .from('platform_business_records')
          .select('*')
          .eq('id', businessRecordId)
          .single();
        if (!br) return createCorsResponse({ error: 'Business record not found' }, 404, req);
        if (br.record_type !== 'tenant') {
          return createCorsResponse({ error: 'Health scores are only for tenants' }, 400, req);
        }

        const usageScore = Math.min(100, br.engagement_score || 0);
        const daysSinceLastActivity = br.last_engagement_date
          ? Math.floor((Date.now() - new Date(br.last_engagement_date).getTime()) / 86400000)
          : 999;
        const engagementScore = Math.max(0, 100 - daysSinceLastActivity * 2);
        const adoptionScore = 70;
        const supportScore = 85;
        const paymentScore = br.current_mrr ? 100 : 50;
        const satisfactionScore = br.nps_score
          ? Math.max(0, Math.min(100, (br.nps_score + 100) / 2))
          : 50;

        const overallScore = Math.round(
          usageScore * 0.2 +
            engagementScore * 0.2 +
            adoptionScore * 0.15 +
            supportScore * 0.15 +
            paymentScore * 0.2 +
            satisfactionScore * 0.1,
        );

        let healthStatus: string;
        if (overallScore >= 90) healthStatus = 'excellent';
        else if (overallScore >= 70) healthStatus = 'healthy';
        else if (overallScore >= 50) healthStatus = 'at_risk';
        else healthStatus = 'critical';

        const { data: prev } = await admin
          .from('platform_health_scores')
          .select('overall_score')
          .eq('business_record_id', businessRecordId)
          .single();
        let trend: string | null = null;
        if (prev) {
          if (overallScore > prev.overall_score + 5) trend = 'improving';
          else if (overallScore < prev.overall_score - 5) trend = 'declining';
          else trend = 'stable';
        }

        const riskFactors: string[] = [];
        if (usageScore < 50) riskFactors.push('Low usage');
        if (engagementScore < 50) riskFactors.push('Low engagement');
        if (daysSinceLastActivity > 30) riskFactors.push('No recent activity');
        if (!br.current_mrr) riskFactors.push('No active subscription');
        if (br.nps_score && br.nps_score < 0) riskFactors.push('Negative NPS');

        const strengthFactors: string[] = [];
        if (usageScore >= 80) strengthFactors.push('High usage');
        if (engagementScore >= 80) strengthFactors.push('High engagement');
        if (br.nps_score && br.nps_score > 50) strengthFactors.push('High NPS');
        if (br.current_mrr && Number(br.current_mrr) > 1000)
          strengthFactors.push('High-value customer');

        const recommendations: string[] = [];
        if (overallScore < 70) {
          recommendations.push('Schedule check-in call');
          if (engagementScore < 50) recommendations.push('Send re-engagement campaign');
          if (usageScore < 50) recommendations.push('Offer training session');
        }

        const row = {
          business_record_id: businessRecordId,
          tenant_id: br.tenant_id || null,
          overall_score: overallScore,
          health_status: healthStatus,
          trend,
          usage_score: usageScore,
          engagement_score: engagementScore,
          adoption_score: adoptionScore,
          support_score: supportScore,
          payment_score: paymentScore,
          satisfaction_score: satisfactionScore,
          days_since_last_login: daysSinceLastActivity,
          nps_score: br.nps_score ?? null,
          csat_score: br.csat_score ?? null,
          risk_factors: riskFactors,
          strength_factors: strengthFactors,
          recommendations,
          calculated_at: new Date().toISOString(),
          calculated_by: user.id,
          next_calculation_due: new Date(Date.now() + 7 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: healthScore, error } = await admin
          .from('platform_health_scores')
          .upsert(row, { onConflict: 'business_record_id' })
          .select()
          .single();
        if (error) {
          console.error('Error calculating health score:', error);
          return createCorsResponse({ error: 'Failed to calculate health score' }, 500, req);
        }

        await admin
          .from('platform_business_records')
          .update({
            churn_risk:
              healthStatus === 'critical'
                ? 'critical'
                : healthStatus === 'at_risk'
                  ? 'high'
                  : healthStatus === 'healthy'
                    ? 'low'
                    : 'very_low',
            updated_at: new Date().toISOString(),
          })
          .eq('id', businessRecordId);

        return createCorsResponse(healthScore, 200, req);
      }

      // GET /health-scores/:businessRecordId
      if (req.method === 'GET' && sub) {
        const { data: hs } = await admin
          .from('platform_health_scores')
          .select('*')
          .eq('business_record_id', sub)
          .single();
        if (!hs) return createCorsResponse({ error: 'Health score not found' }, 404, req);
        return createCorsResponse(hs, 200, req);
      }

      // GET /health-scores — list with filters + pagination
      if (req.method === 'GET') {
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;
        const healthStatus = url.searchParams.get('healthStatus');
        const scoreLessThan = url.searchParams.get('scoreLessThan');
        const scoreGreaterThan = url.searchParams.get('scoreGreaterThan');
        const trend = url.searchParams.get('trend');

        let query = admin
          .from('platform_health_scores')
          .select('*', { count: 'exact' })
          .order('overall_score', { ascending: true })
          .range(offset, offset + limit - 1);

        if (healthStatus) query = query.eq('health_status', healthStatus);
        if (scoreLessThan) query = query.lte('overall_score', parseInt(scoreLessThan));
        if (scoreGreaterThan) query = query.gte('overall_score', parseInt(scoreGreaterThan));
        if (trend) query = query.eq('trend', trend);

        const { data: scores, error, count } = await query;
        if (error) {
          console.error('Error fetching health scores:', error);
          return createCorsResponse({ error: 'Failed to fetch health scores' }, 500, req);
        }

        const ids = (scores || []).map((s: any) => s.business_record_id).filter(Boolean);
        let records: any[] = [];
        if (ids.length > 0) {
          const { data: brs } = await admin
            .from('platform_business_records')
            .select('*')
            .in('id', ids);
          records = brs || [];
        }
        const results = (scores || []).map((s: any) => ({
          ...s,
          businessRecord: records.find((r) => r.id === s.business_record_id),
        }));

        const totalPages = Math.ceil((count || 0) / limit);
        return createCorsResponse(
          {
            healthScores: results,
            pagination: {
              page,
              limit,
              totalRecords: count || 0,
              totalPages,
              hasMore: page < totalPages,
            },
          },
          200,
          req,
        );
      }
    }

    // ----------------------------------------------------------------------
    // CHURN PREDICTIONS
    // ----------------------------------------------------------------------
    if (resource === 'churn-predictions') {
      // POST /churn-predictions/predict
      if (req.method === 'POST' && sub === 'predict') {
        const body = await req.json().catch(() => ({}));
        const businessRecordId = body.businessRecordId;
        if (!businessRecordId) {
          return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
        }
        const { data: br } = await admin
          .from('platform_business_records')
          .select('*')
          .eq('id', businessRecordId)
          .single();
        if (!br || br.record_type !== 'tenant') {
          return createCorsResponse({ error: 'Invalid business record or not a tenant' }, 400, req);
        }
        const { data: hs } = await admin
          .from('platform_health_scores')
          .select('overall_score')
          .eq('business_record_id', businessRecordId)
          .single();

        let churnProbability = hs ? (100 - hs.overall_score) / 100 : 0.5;
        if (!br.current_mrr) churnProbability += 0.3;
        if (br.nps_score && br.nps_score < 0) churnProbability += 0.2;
        if (br.last_engagement_date) {
          const days = Math.floor(
            (Date.now() - new Date(br.last_engagement_date).getTime()) / 86400000,
          );
          if (days > 60) churnProbability += 0.2;
        }
        churnProbability = Math.min(1.0, churnProbability);

        let churnRisk: string;
        if (churnProbability < 0.2) churnRisk = 'very_low';
        else if (churnProbability < 0.4) churnRisk = 'low';
        else if (churnProbability < 0.6) churnRisk = 'medium';
        else if (churnProbability < 0.8) churnRisk = 'high';
        else churnRisk = 'critical';

        const daysUntilChurn =
          churnRisk === 'critical'
            ? 30
            : churnRisk === 'high'
              ? 60
              : churnRisk === 'medium'
                ? 90
                : 180;

        const primaryRiskFactors: string[] = [];
        const secondaryRiskFactors: string[] = [];
        if (hs && hs.overall_score < 50) primaryRiskFactors.push('Low health score');
        if (!br.current_mrr) primaryRiskFactors.push('No active subscription');
        if (br.nps_score && br.nps_score < 0) primaryRiskFactors.push('Negative NPS');
        if (br.engagement_score && br.engagement_score < 30)
          secondaryRiskFactors.push('Low engagement');

        const { data: prediction, error } = await admin
          .from('platform_churn_predictions')
          .insert({
            business_record_id: businessRecordId,
            tenant_id: br.tenant_id || null,
            churn_risk: churnRisk,
            churn_probability: churnProbability.toFixed(4),
            confidence_level: '0.75',
            predicted_churn_date: new Date(Date.now() + daysUntilChurn * 86400000).toISOString(),
            days_until_churn: daysUntilChurn,
            primary_risk_factors: primaryRiskFactors,
            secondary_risk_factors: secondaryRiskFactors,
            model_version: 'v1.0',
            model_type: 'rules_based',
            predicted_at: new Date().toISOString(),
            predicted_by: 'system',
          })
          .select()
          .single();
        if (error) {
          console.error('Error predicting churn:', error);
          return createCorsResponse({ error: 'Failed to predict churn' }, 500, req);
        }

        await admin
          .from('platform_business_records')
          .update({
            churn_risk: churnRisk,
            churn_probability: churnProbability.toFixed(4),
            updated_at: new Date().toISOString(),
          })
          .eq('id', businessRecordId);

        return createCorsResponse(prediction, 200, req);
      }

      // GET /churn-predictions — list
      if (req.method === 'GET') {
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;
        const churnRisk = url.searchParams.get('churnRisk');
        const daysUntilChurn = url.searchParams.get('daysUntilChurn');

        let query = admin
          .from('platform_churn_predictions')
          .select('*')
          .order('churn_probability', { ascending: false })
          .range(offset, offset + limit - 1);
        if (churnRisk) query = query.eq('churn_risk', churnRisk);
        if (daysUntilChurn) query = query.lte('days_until_churn', parseInt(daysUntilChurn));

        const { data: predictions, error } = await query;
        if (error) {
          return createCorsResponse({ error: 'Failed to fetch churn predictions' }, 500, req);
        }
        const ids = (predictions || []).map((p: any) => p.business_record_id).filter(Boolean);
        let records: any[] = [];
        if (ids.length > 0) {
          const { data: brs } = await admin
            .from('platform_business_records')
            .select('*')
            .in('id', ids);
          records = brs || [];
        }
        const results = (predictions || []).map((p: any) => ({
          ...p,
          businessRecord: records.find((r) => r.id === p.business_record_id),
        }));
        return createCorsResponse({ predictions: results, pagination: { page, limit } }, 200, req);
      }
    }

    // ----------------------------------------------------------------------
    // SUCCESS INTERVENTIONS
    // ----------------------------------------------------------------------
    if (resource === 'interventions') {
      // PATCH /interventions/:id
      if (req.method === 'PATCH' && sub) {
        const body = await req.json().catch(() => ({}));
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        // Pass through a known-safe subset of snake_case columns.
        for (const k of [
          'status',
          'priority',
          'title',
          'description',
          'assigned_to',
          'outcome',
          'completed_at',
        ]) {
          if (body[k] !== undefined) update[k] = body[k];
        }
        const { data: updated, error } = await admin
          .from('platform_success_interventions')
          .update(update)
          .eq('id', sub)
          .select()
          .single();
        if (error || !updated) {
          return createCorsResponse({ error: 'Intervention not found' }, 404, req);
        }
        return createCorsResponse(updated, 200, req);
      }

      // POST /interventions
      if (req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        if (!body.businessRecordId) {
          return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
        }
        if (!body.title) {
          return createCorsResponse({ error: 'title is required' }, 400, req);
        }
        const insert: Record<string, unknown> = {
          business_record_id: body.businessRecordId,
          title: body.title,
          description: body.description ?? null,
          status: body.status ?? null,
          priority: body.priority ?? null,
          assigned_to: body.assignedTo ?? null,
          created_by: user.id,
        };
        const { data: intervention, error } = await admin
          .from('platform_success_interventions')
          .insert(insert)
          .select()
          .single();
        if (error) {
          console.error('Error creating intervention:', error);
          return createCorsResponse({ error: 'Failed to create intervention' }, 500, req);
        }
        // Best-effort activity log
        await admin
          .from('platform_activities')
          .insert({
            business_record_id: body.businessRecordId,
            activity_type: 'note',
            subject: 'Success intervention created',
            description: `Intervention: ${body.title}`,
            activity_date: new Date().toISOString(),
            created_by: user.id,
          })
          .then(
            () => {},
            () => {},
          );
        return createCorsResponse(intervention, 201, req);
      }

      // GET /interventions
      if (req.method === 'GET') {
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;
        let query = admin
          .from('platform_success_interventions')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        for (const [param, col] of [
          ['status', 'status'],
          ['priority', 'priority'],
          ['assignedTo', 'assigned_to'],
          ['businessRecordId', 'business_record_id'],
        ] as const) {
          const v = url.searchParams.get(param);
          if (v) query = query.eq(col, v);
        }
        const { data: interventions, error } = await query;
        if (error) {
          return createCorsResponse({ error: 'Failed to fetch interventions' }, 500, req);
        }
        return createCorsResponse({ interventions: interventions || [] }, 200, req);
      }
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in platform-cs function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
