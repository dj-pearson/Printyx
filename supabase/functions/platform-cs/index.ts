// Platform Customer Success Edge Function
// Ports server/routes-platform-customer-success.ts (mounted at /api/platform-cs).
// Manages customer health scoring, churn prediction, and success interventions
// at the platform level (Root Admin only).
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    // Check for root admin access (role level 7+)
    const { data: userWithRole } = await admin
      .from('users')
      .select('role_id, roles!inner(level, can_access_all_tenants)')
      .eq('id', user.id)
      .single();

    const roleLevel = (userWithRole?.roles as any)?.level || 0;
    const canAccessAllTenants = (userWithRole?.roles as any)?.can_access_all_tenants || false;

    if (roleLevel < 7 && !canAccessAllTenants) {
      return createCorsResponse({ error: 'Root admin access required' }, 403, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'platform-cs');
    const endpoint = parts[0];
    const resourceId = parts[1];
    const subResource = parts[2];

    // ========================================================================
    // HEALTH SCORES
    // ========================================================================

    // POST /platform-cs/health-scores/calculate - Calculate/recalculate a health score
    // (Matched BEFORE the :businessRecordId path route, mirroring Express ordering.)
    if (req.method === 'POST' && endpoint === 'health-scores' && resourceId === 'calculate') {
      const body = await req.json().catch(() => ({}));
      const businessRecordId = body?.businessRecordId;

      if (!businessRecordId) {
        return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
      }

      // Get business record
      const { data: businessRecord } = await admin
        .from('platform_business_records')
        .select('*')
        .eq('id', businessRecordId)
        .single();

      if (!businessRecord) {
        return createCorsResponse({ error: 'Business record not found' }, 404, req);
      }

      // Only calculate for tenants
      if (businessRecord.record_type !== 'tenant') {
        return createCorsResponse({ error: 'Health scores are only for tenants' }, 400, req);
      }

      // Usage score (based on engagement metrics)
      const usageScore = Math.min(100, Number(businessRecord.engagement_score) || 0);

      // Engagement score (based on activity levels)
      const lastEngagementMs = businessRecord.last_engagement_date
        ? new Date(businessRecord.last_engagement_date).getTime()
        : null;
      const daysSinceLastActivity =
        lastEngagementMs !== null
          ? Math.floor((Date.now() - lastEngagementMs) / (1000 * 60 * 60 * 24))
          : 999;
      const engagementScore = Math.max(0, 100 - daysSinceLastActivity * 2); // -2 pts/day inactive

      // Adoption score (placeholder)
      const adoptionScore = 70;

      // Support score (placeholder; higher is better)
      const supportScore = 85;

      // Payment score (based on payment history)
      const paymentScore = businessRecord.current_mrr ? 100 : 50;

      // Satisfaction score (based on NPS/CSAT)
      const npsScore =
        businessRecord.nps_score !== null && businessRecord.nps_score !== undefined
          ? Number(businessRecord.nps_score)
          : null;
      const satisfactionScore =
        npsScore !== null ? Math.max(0, Math.min(100, (npsScore + 100) / 2)) : 50;

      // Overall score (weighted average)
      const overallScore = Math.round(
        usageScore * 0.2 +
          engagementScore * 0.2 +
          adoptionScore * 0.15 +
          supportScore * 0.15 +
          paymentScore * 0.2 +
          satisfactionScore * 0.1,
      );

      // Health status
      let healthStatus: 'excellent' | 'healthy' | 'at_risk' | 'critical' | 'churned';
      if (overallScore >= 90) healthStatus = 'excellent';
      else if (overallScore >= 70) healthStatus = 'healthy';
      else if (overallScore >= 50) healthStatus = 'at_risk';
      else healthStatus = 'critical';

      // Trend (compared to previous score)
      const { data: previousHealthScore } = await admin
        .from('platform_health_scores')
        .select('*')
        .eq('business_record_id', businessRecordId)
        .maybeSingle();

      let trend: string | null = null;
      if (previousHealthScore) {
        const prevScore = Number(previousHealthScore.overall_score) || 0;
        if (overallScore > prevScore + 5) trend = 'improving';
        else if (overallScore < prevScore - 5) trend = 'declining';
        else trend = 'stable';
      }

      // Risk factors
      const riskFactors: string[] = [];
      if (usageScore < 50) riskFactors.push('Low usage');
      if (engagementScore < 50) riskFactors.push('Low engagement');
      if (daysSinceLastActivity > 30) riskFactors.push('No recent activity');
      if (!businessRecord.current_mrr) riskFactors.push('No active subscription');
      if (npsScore !== null && npsScore < 0) riskFactors.push('Negative NPS');

      // Strengths
      const strengthFactors: string[] = [];
      if (usageScore >= 80) strengthFactors.push('High usage');
      if (engagementScore >= 80) strengthFactors.push('High engagement');
      if (npsScore !== null && npsScore > 50) strengthFactors.push('High NPS');
      if (businessRecord.current_mrr && Number(businessRecord.current_mrr) > 1000)
        strengthFactors.push('High-value customer');

      // Recommendations
      const recommendations: string[] = [];
      if (overallScore < 70) {
        recommendations.push('Schedule check-in call');
        if (engagementScore < 50) recommendations.push('Send re-engagement campaign');
        if (usageScore < 50) recommendations.push('Offer training session');
      }

      const nowIso = new Date().toISOString();
      const nextDueIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const baseValues: Record<string, any> = {
        business_record_id: businessRecordId,
        tenant_id: businessRecord.tenant_id ?? null,
        overall_score: overallScore,
        health_status: healthStatus,
        trend: trend,
        usage_score: usageScore,
        engagement_score: engagementScore,
        adoption_score: adoptionScore,
        support_score: supportScore,
        payment_score: paymentScore,
        satisfaction_score: satisfactionScore,
        days_since_last_login: daysSinceLastActivity,
        nps_score: businessRecord.nps_score ?? null,
        csat_score: businessRecord.csat_score ?? null,
        risk_factors: riskFactors,
        strength_factors: strengthFactors,
        recommendations: recommendations,
        calculated_at: nowIso,
        calculated_by: user.id || 'system',
        next_calculation_due: nextDueIso,
        updated_at: nowIso,
      };

      // Upsert health score (unique on business_record_id)
      const { data: healthScore, error: upsertError } = await admin
        .from('platform_health_scores')
        .upsert(baseValues, { onConflict: 'business_record_id' })
        .select()
        .single();

      if (upsertError) {
        console.error('Error upserting health score:', upsertError);
        return createCorsResponse(
          { error: 'Failed to calculate health score', message: upsertError.message },
          500,
          req,
        );
      }

      // Update business record with churn risk derived from health status
      const churnRisk =
        healthStatus === 'critical'
          ? 'critical'
          : healthStatus === 'at_risk'
            ? 'high'
            : healthStatus === 'healthy'
              ? 'low'
              : 'very_low';

      await admin
        .from('platform_business_records')
        .update({ churn_risk: churnRisk, updated_at: nowIso })
        .eq('id', businessRecordId);

      return createCorsResponse(healthScore, 200, req);
    }

    // GET /platform-cs/health-scores - List health scores with filtering
    if (req.method === 'GET' && endpoint === 'health-scores' && !resourceId) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      const healthStatus = url.searchParams.getAll('healthStatus');
      const scoreLessThan = url.searchParams.get('scoreLessThan');
      const scoreGreaterThan = url.searchParams.get('scoreGreaterThan');
      const trend = url.searchParams.get('trend');
      const businessRecordId = url.searchParams.get('businessRecordId');

      let query = admin
        .from('platform_health_scores')
        .select('*', { count: 'exact' })
        .order('overall_score', { ascending: true }) // Lowest (most at-risk) first
        .range(offset, offset + limit - 1);

      if (healthStatus.length === 1) query = query.eq('health_status', healthStatus[0]);
      else if (healthStatus.length > 1) query = query.in('health_status', healthStatus);
      if (scoreLessThan) query = query.lte('overall_score', parseInt(scoreLessThan));
      if (scoreGreaterThan) query = query.gte('overall_score', parseInt(scoreGreaterThan));
      if (trend) query = query.eq('trend', trend);
      if (businessRecordId) query = query.eq('business_record_id', businessRecordId);

      const { data: healthScores, error, count } = await query;

      if (error) {
        console.error('Error fetching health scores:', error);
        return createCorsResponse(
          { error: 'Failed to fetch health scores', message: error.message },
          500,
          req,
        );
      }

      const rows = healthScores || [];

      // Get associated business records (manual merge, mirrors Express join)
      const businessRecordIds = rows.map((hs: any) => hs.business_record_id).filter(Boolean);
      let businessRecords: any[] = [];
      if (businessRecordIds.length > 0) {
        const { data: brs } = await admin
          .from('platform_business_records')
          .select('*')
          .in('id', businessRecordIds);
        businessRecords = brs || [];
      }

      const results = rows.map((hs: any) => ({
        ...hs,
        businessRecord: businessRecords.find((br) => br.id === hs.business_record_id),
      }));

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return createCorsResponse(
        {
          healthScores: results,
          pagination: {
            page,
            limit,
            totalRecords: totalCount,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        200,
        req,
      );
    }

    // GET /platform-cs/health-scores/:businessRecordId - Get health score for a record
    if (req.method === 'GET' && endpoint === 'health-scores' && resourceId) {
      const { data: healthScore } = await admin
        .from('platform_health_scores')
        .select('*')
        .eq('business_record_id', resourceId)
        .maybeSingle();

      if (!healthScore) {
        return createCorsResponse({ error: 'Health score not found' }, 404, req);
      }

      return createCorsResponse(healthScore, 200, req);
    }

    // ========================================================================
    // CHURN PREDICTIONS
    // ========================================================================

    // POST /platform-cs/churn-predictions/predict - Generate a churn prediction
    // (Matched BEFORE any :id-style route, mirroring Express ordering.)
    if (req.method === 'POST' && endpoint === 'churn-predictions' && resourceId === 'predict') {
      const body = await req.json().catch(() => ({}));
      const businessRecordId = body?.businessRecordId;

      if (!businessRecordId) {
        return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
      }

      const { data: businessRecord } = await admin
        .from('platform_business_records')
        .select('*')
        .eq('id', businessRecordId)
        .single();

      if (!businessRecord || businessRecord.record_type !== 'tenant') {
        return createCorsResponse({ error: 'Invalid business record or not a tenant' }, 400, req);
      }

      const { data: healthScore } = await admin
        .from('platform_health_scores')
        .select('*')
        .eq('business_record_id', businessRecordId)
        .maybeSingle();

      // Simple rule-based churn prediction
      let churnProbability = 0.0;
      let churnRisk: 'very_low' | 'low' | 'medium' | 'high' | 'critical';

      if (healthScore) {
        churnProbability = (100 - (Number(healthScore.overall_score) || 0)) / 100;
      } else {
        churnProbability = 0.5; // Unknown health = medium risk
      }

      const nps =
        businessRecord.nps_score !== null && businessRecord.nps_score !== undefined
          ? Number(businessRecord.nps_score)
          : null;

      if (!businessRecord.current_mrr) churnProbability += 0.3;
      if (nps !== null && nps < 0) churnProbability += 0.2;
      if (businessRecord.last_engagement_date) {
        const daysSinceEngagement = Math.floor(
          (Date.now() - new Date(businessRecord.last_engagement_date).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (daysSinceEngagement > 60) churnProbability += 0.2;
      }

      churnProbability = Math.min(1.0, churnProbability);

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

      if (healthScore && (Number(healthScore.overall_score) || 0) < 50)
        primaryRiskFactors.push('Low health score');
      if (!businessRecord.current_mrr) primaryRiskFactors.push('No active subscription');
      if (nps !== null && nps < 0) primaryRiskFactors.push('Negative NPS');
      const engScore =
        businessRecord.engagement_score !== null && businessRecord.engagement_score !== undefined
          ? Number(businessRecord.engagement_score)
          : null;
      if (engScore !== null && engScore < 30) secondaryRiskFactors.push('Low engagement');

      const probStr = churnProbability.toFixed(4);

      const { data: prediction, error: insertError } = await admin
        .from('platform_churn_predictions')
        .insert({
          business_record_id: businessRecordId,
          tenant_id: businessRecord.tenant_id ?? null,
          churn_risk: churnRisk,
          churn_probability: probStr,
          confidence_level: '0.75',
          predicted_churn_date: new Date(
            Date.now() + daysUntilChurn * 24 * 60 * 60 * 1000,
          ).toISOString(),
          days_until_churn: daysUntilChurn,
          primary_risk_factors: primaryRiskFactors,
          secondary_risk_factors: secondaryRiskFactors,
          model_version: 'v1.0',
          model_type: 'rules_based',
          estimated_mrr: businessRecord.current_mrr ?? null,
          estimated_arr: businessRecord.current_arr ?? null,
          estimated_ltv: businessRecord.lifetime_value ?? null,
          predicted_at: new Date().toISOString(),
          predicted_by: 'system',
          next_prediction: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          intervention_required: churnRisk === 'critical' || churnRisk === 'high',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error predicting churn:', insertError);
        return createCorsResponse(
          { error: 'Failed to predict churn', message: insertError.message },
          500,
          req,
        );
      }

      // Update business record with churn risk
      await admin
        .from('platform_business_records')
        .update({
          churn_risk: churnRisk,
          churn_probability: probStr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessRecordId);

      return createCorsResponse(prediction, 200, req);
    }

    // GET /platform-cs/churn-predictions - List churn predictions with filtering
    if (req.method === 'GET' && endpoint === 'churn-predictions' && !resourceId) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      const churnRisk = url.searchParams.getAll('churnRisk');
      const daysUntilChurn = url.searchParams.get('daysUntilChurn');

      let query = admin
        .from('platform_churn_predictions')
        .select('*')
        .order('churn_probability', { ascending: false }) // Highest risk first
        .range(offset, offset + limit - 1);

      if (churnRisk.length === 1) query = query.eq('churn_risk', churnRisk[0]);
      else if (churnRisk.length > 1) query = query.in('churn_risk', churnRisk);
      if (daysUntilChurn) query = query.lte('days_until_churn', parseInt(daysUntilChurn));

      const { data: predictions, error } = await query;

      if (error) {
        console.error('Error fetching churn predictions:', error);
        return createCorsResponse(
          { error: 'Failed to fetch churn predictions', message: error.message },
          500,
          req,
        );
      }

      const rows = predictions || [];

      // Manual merge of associated business records
      const businessRecordIds = rows.map((p: any) => p.business_record_id).filter(Boolean);
      let businessRecords: any[] = [];
      if (businessRecordIds.length > 0) {
        const { data: brs } = await admin
          .from('platform_business_records')
          .select('*')
          .in('id', businessRecordIds);
        businessRecords = brs || [];
      }

      const results = rows.map((p: any) => ({
        ...p,
        businessRecord: businessRecords.find((br) => br.id === p.business_record_id),
      }));

      return createCorsResponse(
        {
          predictions: results,
          pagination: { page, limit },
        },
        200,
        req,
      );
    }

    // ========================================================================
    // SUCCESS INTERVENTIONS
    // ========================================================================

    // GET /platform-cs/interventions - List success interventions
    if (req.method === 'GET' && endpoint === 'interventions' && !resourceId) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      const status = url.searchParams.get('status');
      const priority = url.searchParams.get('priority');
      const assignedTo = url.searchParams.get('assignedTo');
      const businessRecordId = url.searchParams.get('businessRecordId');

      let query = admin
        .from('platform_success_interventions')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);
      if (priority) query = query.eq('priority', priority);
      if (assignedTo) query = query.eq('assigned_to', assignedTo);
      if (businessRecordId) query = query.eq('business_record_id', businessRecordId);

      const { data: interventions, error } = await query;

      if (error) {
        console.error('Error fetching interventions:', error);
        return createCorsResponse(
          { error: 'Failed to fetch interventions', message: error.message },
          500,
          req,
        );
      }

      return createCorsResponse({ interventions: interventions || [] }, 200, req);
    }

    // POST /platform-cs/interventions - Create success intervention
    if (req.method === 'POST' && endpoint === 'interventions' && !resourceId) {
      const data = await req.json().catch(() => ({}));

      if (!data?.businessRecordId && !data?.business_record_id) {
        return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
      }

      if (!data?.title) {
        return createCorsResponse({ error: 'title is required' }, 400, req);
      }

      const businessRecordId = data.businessRecordId ?? data.business_record_id;

      const { data: intervention, error: insertError } = await admin
        .from('platform_success_interventions')
        .insert({
          ...data,
          business_record_id: businessRecordId,
          created_by: user.id || 'system',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating intervention:', insertError);
        return createCorsResponse(
          { error: 'Failed to create intervention', message: insertError.message },
          500,
          req,
        );
      }

      // Log activity
      await admin.from('platform_activities').insert({
        business_record_id: businessRecordId,
        activity_type: 'note',
        subject: 'Success intervention created',
        description: `Intervention: ${data.title}`,
        activity_date: new Date().toISOString(),
        created_by: user.id || 'system',
      });

      return createCorsResponse(intervention, 201, req);
    }

    // PATCH /platform-cs/interventions/:id - Update success intervention
    if (req.method === 'PATCH' && endpoint === 'interventions' && resourceId) {
      const updates = await req.json().catch(() => ({}));

      const { data: updatedIntervention, error: updateError } = await admin
        .from('platform_success_interventions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error('Error updating intervention:', updateError);
        return createCorsResponse(
          { error: 'Failed to update intervention', message: updateError.message },
          500,
          req,
        );
      }

      if (!updatedIntervention) {
        return createCorsResponse({ error: 'Intervention not found' }, 404, req);
      }

      return createCorsResponse(updatedIntervention, 200, req);
    }

    // ========================================================================
    // METRICS
    // ========================================================================

    // GET /platform-cs/metrics - Aggregate customer-success metrics
    if (req.method === 'GET' && endpoint === 'metrics') {
      try {
        const { count: totalCount } = await admin
          .from('platform_health_scores')
          .select('*', { count: 'exact', head: true });
        const total = totalCount || 0;

        const { count: healthyCount } = await admin
          .from('platform_health_scores')
          .select('*', { count: 'exact', head: true })
          .eq('health_status', 'healthy');
        const healthy = healthyCount || 0;

        const { count: atRiskCount } = await admin
          .from('platform_health_scores')
          .select('*', { count: 'exact', head: true })
          .eq('health_status', 'at_risk');
        const atRisk = atRiskCount || 0;

        const { count: criticalCount } = await admin
          .from('platform_health_scores')
          .select('*', { count: 'exact', head: true })
          .eq('health_status', 'critical');
        const critical = criticalCount || 0;

        // Average overall score (compute in JS; Supabase has no aggregate builder here)
        const { data: scoreRows } = await admin
          .from('platform_health_scores')
          .select('overall_score');
        const scores = (scoreRows || []).map((r: any) => Number(r.overall_score) || 0);
        const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;

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
      } catch (metricsError) {
        console.error('Error fetching metrics:', metricsError);
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

    // ========================================================================
    // CSMS (Customer Success Managers)
    // ========================================================================

    // GET /platform-cs/csms - Distinct CSMs assigned on health scores
    if (req.method === 'GET' && endpoint === 'csms') {
      try {
        const { data: rows, error } = await admin
          .from('platform_health_scores')
          .select('assigned_csm')
          .not('assigned_csm', 'is', null);

        if (error) {
          console.error('Error fetching CSMs:', error);
          return createCorsResponse([], 200, req);
        }

        const seen = new Set<string>();
        const csms: { id: string; name: string }[] = [];
        for (const r of rows || []) {
          const csm = (r as any).assigned_csm;
          if (csm && !seen.has(csm)) {
            seen.add(csm);
            csms.push({ id: csm, name: csm });
          }
        }

        return createCorsResponse(csms, 200, req);
      } catch (csmError) {
        console.error('Error fetching CSMs:', csmError);
        return createCorsResponse([], 200, req);
      }
    }

    // Method/endpoint not found
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
