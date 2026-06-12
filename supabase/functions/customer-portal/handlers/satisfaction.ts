// Customer satisfaction survey handlers (EDGE-002b).
// Ports server/routes-customer-portal.ts satisfaction endpoints, used by
// ServiceRequestsDashboard.tsx, CustomerSatisfactionForm.tsx and
// CustomerSatisfactionAnalyticsDashboard.tsx:
//   GET  /satisfaction/surveys
//   GET  /satisfaction/surveys/:id          (survey + questions + existingResponses)
//   POST /satisfaction/surveys/:id/start
//   POST /satisfaction/surveys/:id/submit   ({ responses: [...] })
//   GET  /satisfaction/analytics[?timeRange=]
import { createCorsResponse } from '../../_shared/cors.ts';
import {
  isMissingTableError,
  mapQuestionRow,
  mapResponseRow,
  mapSurveyRow,
  resolveCustomerId,
  type PortalCtx,
} from './_context.ts';

interface SurveyRow {
  id: string;
  template_id: string;
  status: string;
  expires_at?: string | null;
  first_viewed_at?: string | null;
  started_at?: string | null;
  [key: string]: unknown;
}

async function fetchSurveyForCustomer(
  ctx: PortalCtx,
  surveyId: string,
  customerId: string,
): Promise<SurveyRow | null> {
  const { data, error } = await ctx.admin
    .from('customer_satisfaction_surveys')
    .select('*')
    .eq('id', surveyId)
    .eq('tenant_id', ctx.tenantId)
    .eq('customer_id', customerId)
    .single();
  if (error) return null;
  return data;
}

function isExpired(survey: { expires_at?: string | null }): boolean {
  return Boolean(survey.expires_at && new Date() > new Date(survey.expires_at));
}

export async function handleSatisfaction(ctx: PortalCtx): Promise<Response> {
  const { req, admin, tenantId, url, parts } = ctx;
  const section = parts[1]; // 'surveys' | 'analytics'
  const surveyId = parts[2];
  const action = parts[3]; // 'start' | 'submit'

  const customerId = resolveCustomerId(ctx);
  if (!customerId) {
    return createCorsResponse(
      { success: false, message: 'Missing tenant or customer context' },
      400,
      req,
    );
  }

  // ── GET /satisfaction/surveys — list with template names ────────────────
  if (req.method === 'GET' && section === 'surveys' && !surveyId) {
    const { data: surveys, error } = await admin
      .from('customer_satisfaction_surveys')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        return createCorsResponse({ success: true, data: [], count: 0 }, 200, req);
      }
      console.error('Error fetching satisfaction surveys:', error);
      return createCorsResponse(
        { success: false, message: 'Failed to fetch satisfaction surveys' },
        500,
        req,
      );
    }

    // Manual template join — avoids relying on a PostgREST FK relationship
    // that may not exist if the live DB was provisioned without constraints.
    const templateIds = [
      ...new Set(
        (surveys || []).map((s: { template_id: string }) => s.template_id).filter(Boolean),
      ),
    ];
    const templateMap = new Map<string, { name?: string; description?: string }>();
    if (templateIds.length > 0) {
      const { data: templates } = await admin
        .from('customer_satisfaction_survey_templates')
        .select('id, name, description')
        .in('id', templateIds);
      for (const t of templates || []) templateMap.set(t.id, t);
    }

    const data = (surveys || []).map((row: Record<string, unknown>) => ({
      ...mapSurveyRow(row),
      templateName: templateMap.get(String(row.template_id))?.name ?? null,
      templateDescription: templateMap.get(String(row.template_id))?.description ?? null,
    }));

    return createCorsResponse({ success: true, data, count: data.length }, 200, req);
  }

  // ── GET /satisfaction/surveys/:id — details + questions + responses ─────
  if (req.method === 'GET' && section === 'surveys' && surveyId && !action) {
    const survey = await fetchSurveyForCustomer(ctx, surveyId, customerId);
    if (!survey) {
      return createCorsResponse({ success: false, message: 'Survey not found' }, 404, req);
    }
    if (isExpired(survey)) {
      return createCorsResponse({ success: false, message: 'Survey has expired' }, 410, req);
    }

    const [questionsResult, responsesResult] = await Promise.all([
      admin
        .from('customer_satisfaction_survey_questions')
        .select('*')
        .eq('template_id', survey.template_id)
        .order('order_index', { ascending: true }),
      admin.from('customer_satisfaction_survey_responses').select('*').eq('survey_id', surveyId),
    ]);

    // Mark first viewed (mirrors the Express side effect)
    if (!survey.first_viewed_at) {
      await admin
        .from('customer_satisfaction_surveys')
        .update({
          first_viewed_at: new Date().toISOString(),
          status: survey.status === 'invited' ? 'started' : survey.status,
        })
        .eq('id', surveyId)
        .eq('tenant_id', tenantId);
    }

    return createCorsResponse(
      {
        success: true,
        data: {
          survey: mapSurveyRow(survey),
          questions: (questionsResult.data || []).map(mapQuestionRow),
          existingResponses: (responsesResult.data || []).map(mapResponseRow),
        },
      },
      200,
      req,
    );
  }

  // ── POST /satisfaction/surveys/:id/start ─────────────────────────────────
  if (req.method === 'POST' && section === 'surveys' && surveyId && action === 'start') {
    const survey = await fetchSurveyForCustomer(ctx, surveyId, customerId);
    if (!survey) {
      return createCorsResponse({ success: false, message: 'Survey not found' }, 404, req);
    }
    if (isExpired(survey)) {
      return createCorsResponse({ success: false, message: 'Survey has expired' }, 410, req);
    }
    if (survey.status === 'completed') {
      return createCorsResponse(
        { success: false, message: 'Survey is already completed' },
        400,
        req,
      );
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await admin
      .from('customer_satisfaction_surveys')
      .update({
        started_at: survey.started_at || now,
        first_viewed_at: survey.first_viewed_at || now,
        status: 'started',
        user_agent: req.headers.get('user-agent') || null,
      })
      .eq('id', surveyId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !updated) {
      console.error('Error starting survey:', error);
      return createCorsResponse({ success: false, message: 'Failed to start survey' }, 500, req);
    }

    return createCorsResponse(
      { success: true, data: mapSurveyRow(updated), message: 'Survey started successfully' },
      200,
      req,
    );
  }

  // ── POST /satisfaction/surveys/:id/submit ────────────────────────────────
  if (req.method === 'POST' && section === 'surveys' && surveyId && action === 'submit') {
    const body = await req.json().catch(() => null);
    const responses = body?.responses;
    if (!responses || !Array.isArray(responses)) {
      return createCorsResponse(
        { success: false, message: 'Responses array is required' },
        400,
        req,
      );
    }

    const survey = await fetchSurveyForCustomer(ctx, surveyId, customerId);
    if (!survey) {
      return createCorsResponse({ success: false, message: 'Survey not found' }, 404, req);
    }
    if (isExpired(survey)) {
      return createCorsResponse({ success: false, message: 'Survey has expired' }, 410, req);
    }
    if (survey.status === 'completed') {
      return createCorsResponse(
        { success: false, message: 'Survey is already completed' },
        400,
        req,
      );
    }

    const { data: questions } = await admin
      .from('customer_satisfaction_survey_questions')
      .select('*')
      .eq('template_id', survey.template_id);
    const questionMap = new Map<string, Record<string, unknown>>(
      (questions || []).map((q: { id: string }) => [q.id, q]),
    );

    const responseRows = [];
    for (const response of responses) {
      const question = questionMap.get(response.questionId);
      if (!question) {
        return createCorsResponse(
          { success: false, message: `Invalid question ID: ${response.questionId}` },
          400,
          req,
        );
      }
      responseRows.push({
        survey_id: surveyId,
        question_id: response.questionId,
        rating_value: typeof response.ratingValue === 'number' ? response.ratingValue : null,
        text_value: response.textValue ?? null,
        selected_options: Array.isArray(response.selectedOptions) ? response.selectedOptions : [],
        boolean_value: typeof response.booleanValue === 'boolean' ? response.booleanValue : null,
        time_spent_seconds:
          typeof response.timeSpentSeconds === 'number' ? response.timeSpentSeconds : null,
        response_order: typeof response.responseOrder === 'number' ? response.responseOrder : null,
      });
    }

    // Score calculation — same weighting as the Express implementation.
    let npsScore: number | null = null;
    let totalWeightedScore = 0;
    let totalWeight = 0;
    for (const row of responseRows) {
      const question = questionMap.get(String(row.question_id)) as
        | { question_type?: string; weight?: string }
        | undefined;
      if (!question || row.rating_value === null) continue;
      if (question.question_type === 'nps_score') {
        npsScore = row.rating_value;
      } else if (question.question_type === 'rating_scale') {
        const weight = parseFloat(question.weight || '1.00') || 1;
        totalWeightedScore += row.rating_value * weight;
        totalWeight += weight;
      }
    }
    const overallScore =
      totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 100) / 100 : null;

    // Replace responses then complete the survey. supabase-js has no
    // transactions; ordered writes keep the survey re-submittable if a step fails.
    const { error: deleteError } = await admin
      .from('customer_satisfaction_survey_responses')
      .delete()
      .eq('survey_id', surveyId);
    if (deleteError) {
      console.error('Error clearing previous responses:', deleteError);
      return createCorsResponse(
        { success: false, message: 'Failed to submit survey responses' },
        500,
        req,
      );
    }

    if (responseRows.length > 0) {
      const { error: insertError } = await admin
        .from('customer_satisfaction_survey_responses')
        .insert(responseRows);
      if (insertError) {
        console.error('Error inserting survey responses:', insertError);
        return createCorsResponse(
          { success: false, message: 'Failed to submit survey responses' },
          500,
          req,
        );
      }
    }

    const { data: updatedSurvey, error: updateError } = await admin
      .from('customer_satisfaction_surveys')
      .update({
        completed_at: new Date().toISOString(),
        status: 'completed',
        overall_score: overallScore,
        nps_score: npsScore,
      })
      .eq('id', surveyId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError || !updatedSurvey) {
      console.error('Error completing survey:', updateError);
      return createCorsResponse(
        { success: false, message: 'Failed to submit survey responses' },
        500,
        req,
      );
    }

    return createCorsResponse(
      {
        success: true,
        data: {
          survey: mapSurveyRow(updatedSurvey),
          responsesSubmitted: responseRows.length,
          overallScore,
          npsScore,
        },
        message: 'Survey responses submitted successfully',
      },
      200,
      req,
    );
  }

  // ── GET /satisfaction/analytics ──────────────────────────────────────────
  if (req.method === 'GET' && section === 'analytics') {
    const timeRange = url.searchParams.get('timeRange') || '1y';
    const now = new Date();
    const startDate = new Date(now);
    switch (timeRange) {
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '6m':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1y':
      default:
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const { data: surveys, error } = await admin
      .from('customer_satisfaction_surveys')
      .select(
        'id, survey_type, template_id, completed_at, overall_score, nps_score, related_service_request_id, related_maintenance_appointment_id',
      )
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .order('completed_at', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        return createCorsResponse(
          {
            success: true,
            data: {
              summary: {
                totalSurveys: 0,
                averageScore: null,
                averageNpsScore: null,
                timeRange,
                periodStart: startDate.toISOString(),
                periodEnd: now.toISOString(),
              },
              byType: {},
              recentSurveys: [],
            },
          },
          200,
          req,
        );
      }
      console.error('Error fetching satisfaction analytics:', error);
      return createCorsResponse(
        { success: false, message: 'Failed to fetch satisfaction analytics' },
        500,
        req,
      );
    }

    interface CompletedSurvey {
      id: unknown;
      surveyType: unknown;
      completedAt: unknown;
      overallScore: number | null;
      npsScore: number | null;
      relatedServiceRequestId: unknown;
      relatedMaintenanceAppointmentId: unknown;
    }
    const completed: CompletedSurvey[] = (surveys || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      surveyType: row.survey_type,
      completedAt: row.completed_at,
      overallScore: row.overall_score === null ? null : parseFloat(String(row.overall_score)),
      npsScore: row.nps_score as number | null,
      relatedServiceRequestId: row.related_service_request_id,
      relatedMaintenanceAppointmentId: row.related_maintenance_appointment_id,
    }));

    const withScores = completed.filter((s) => s.overallScore !== null);
    const withNps = completed.filter((s) => s.npsScore !== null);
    const averageScore =
      withScores.length > 0
        ? withScores.reduce((sum, s) => sum + (s.overallScore || 0), 0) / withScores.length
        : null;
    const averageNpsScore =
      withNps.length > 0
        ? withNps.reduce((sum, s) => sum + (s.npsScore || 0), 0) / withNps.length
        : null;

    const byType: Record<string, { count: number; scores: number[]; npsScores: number[] }> = {};
    for (const survey of completed) {
      const type = String(survey.surveyType);
      if (!byType[type]) byType[type] = { count: 0, scores: [], npsScores: [] };
      byType[type].count++;
      if (survey.overallScore !== null) byType[type].scores.push(survey.overallScore);
      if (survey.npsScore !== null) byType[type].npsScores.push(survey.npsScore);
    }
    const summaryByType: Record<string, unknown> = {};
    for (const [type, data] of Object.entries(byType)) {
      summaryByType[type] = {
        count: data.count,
        averageScore:
          data.scores.length > 0
            ? data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length
            : null,
        averageNpsScore:
          data.npsScores.length > 0
            ? data.npsScores.reduce((sum, s) => sum + s, 0) / data.npsScores.length
            : null,
      };
    }

    return createCorsResponse(
      {
        success: true,
        data: {
          summary: {
            totalSurveys: completed.length,
            averageScore: averageScore !== null ? Math.round(averageScore * 100) / 100 : null,
            averageNpsScore:
              averageNpsScore !== null ? Math.round(averageNpsScore * 100) / 100 : null,
            timeRange,
            periodStart: startDate.toISOString(),
            periodEnd: now.toISOString(),
          },
          byType: summaryByType,
          recentSurveys: completed.slice(0, 10),
        },
        meta: { totalSurveys: completed.length, timeRange },
      },
      200,
      req,
    );
  }

  return createCorsResponse({ error: 'Method not allowed' }, 405, req);
}
