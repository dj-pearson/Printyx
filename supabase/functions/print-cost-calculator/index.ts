// Print Cost Calculator Edge Function (EDGE-005f) — PUBLIC / UNAUTHENTICATED.
//
// Ports the public marketing calculator endpoints from
// server/routes-print-cost-calculator.ts. These power the anonymous lead-capture
// flow on PrintCostCalculator.tsx + EmailCaptureModal.tsx, so the function runs
// WITHOUT a JWT (config.toml: [functions.print-cost-calculator] verify_jwt=false;
// under the Coolify server.ts dispatcher there is no gateway auth either).
//
// Routing: the frontend used to call /api/public/calculator/* with a raw relative
// fetch (worked only because Express served the SPA origin). That can't reach an
// edge function in prod — getApiUrl strips /api/ and routes the first path
// segment to a function dir. So the dir is named to match the new canonical
// prefix /api/print-cost-calculator/* and the frontend now fetches via getApiUrl.
//
// Tables (shared/print-cost-calculator-schema.ts) are GLOBAL marketing tables —
// they have NO tenant_id column, so there is no tenant scoping here.
//
// Endpoints:
//   POST /sessions                  — calculate + persist a session
//   GET  /sessions/:sessionKey      — fetch a stored session + recommendations
//   POST /leads                     — capture an email lead for a session
//   POST /track/pdf-download        — mark a session's report as downloaded
//   POST /track/event               — record an analytics event
//   GET  /benchmarks/:industry      — industry benchmark rows
//
// DEGRADED vs Express: the Day-0..7 email nurture sequence
// (startEmailSequence + sendCalculatorReportEmail) is NOT ported — it depends on
// in-process Node email services. Lead capture (the conversion-critical path)
// still works; emailSequenceStarted stays false. Wiring the sequence to an edge
// mailer is tracked for the Express-sunset follow-ups (EDGE-008/011).

import { createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  calculatePrintCosts,
  calculateLeadScore,
  determineLeadTemperature,
  generateRecommendations,
  type FleetInputs,
} from '../_shared/print-cost-calculator/calculator.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'print-cost-calculator');
    const seg0 = parts[0]; // sessions | leads | track | benchmarks
    const seg1 = parts[1]; // :sessionKey | event | pdf-download | :industry

    if (req.method === 'POST' && seg0 === 'sessions' && !seg1)
      return await createSession(admin, req);
    if (req.method === 'GET' && seg0 === 'sessions' && seg1)
      return await getSession(admin, seg1, req);
    if (req.method === 'POST' && seg0 === 'leads' && !seg1) return await captureLead(admin, req);
    if (req.method === 'POST' && seg0 === 'track' && seg1 === 'pdf-download')
      return await trackPdfDownload(admin, req);
    if (req.method === 'POST' && seg0 === 'track' && seg1 === 'event')
      return await trackEvent(admin, req);
    if (req.method === 'GET' && seg0 === 'benchmarks' && seg1)
      return await getBenchmarks(admin, seg1, req);

    return createCorsResponse({ message: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in print-cost-calculator function:', error);
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

function toFleetInputs(src: Record<string, unknown>): FleetInputs {
  return {
    deviceCount: Number(src.deviceCount),
    deviceTypes: Array.isArray(src.deviceTypes) ? (src.deviceTypes as string[]) : [],
    fleetAge: String(src.fleetAge ?? ''),
    monthlyPageVolume: Number(src.monthlyPageVolume),
    colorRatio: Number(src.colorRatio),
    employeeCount: Number(src.employeeCount),
    industry: String(src.industry ?? 'other'),
    painPoints: Array.isArray(src.painPoints) ? (src.painPoints as string[]) : [],
    monthlySupplieCost: src.monthlySupplieCost != null ? Number(src.monthlySupplieCost) : undefined,
    monthlyServiceCost: src.monthlyServiceCost != null ? Number(src.monthlyServiceCost) : undefined,
    monthlyDowntimeHours:
      src.monthlyDowntimeHours != null ? Number(src.monthlyDowntimeHours) : undefined,
    monthlyEnergyCost: src.monthlyEnergyCost != null ? Number(src.monthlyEnergyCost) : undefined,
  };
}

// ─── handlers ────────────────────────────────────────────────────────────────

async function createSession(admin: Admin, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Minimal required-field validation (mirrors the Express zod schema's core).
  if (
    !Number.isFinite(Number(body.deviceCount)) ||
    !Number.isFinite(Number(body.monthlyPageVolume)) ||
    !Number.isFinite(Number(body.colorRatio)) ||
    !Number.isFinite(Number(body.employeeCount)) ||
    !body.fleetAge ||
    !body.industry
  ) {
    return createCorsResponse({ message: 'Invalid input data' }, 400, req);
  }

  const fleetInputs = toFleetInputs(body);
  const results = calculatePrintCosts(fleetInputs);
  const recommendations = generateRecommendations(fleetInputs, results);

  const sessionKey = crypto.randomUUID();
  const visitorId = (body.visitorId as string) || crypto.randomUUID();

  const { data: session, error } = await admin
    .from('calculator_sessions')
    .insert({
      session_key: sessionKey,
      visitor_id: visitorId,
      device_count: fleetInputs.deviceCount,
      device_types: fleetInputs.deviceTypes,
      fleet_age: fleetInputs.fleetAge,
      monthly_page_volume: fleetInputs.monthlyPageVolume,
      color_ratio: fleetInputs.colorRatio,
      monthly_supplie_cost: fleetInputs.monthlySupplieCost ?? null,
      monthly_service_cost: fleetInputs.monthlyServiceCost ?? null,
      monthly_downtime_hours: fleetInputs.monthlyDowntimeHours ?? null,
      monthly_energy_cost: fleetInputs.monthlyEnergyCost ?? null,
      employee_count: fleetInputs.employeeCount,
      industry: fleetInputs.industry,
      pain_points: fleetInputs.painPoints,
      calculated_results: results,
      is_completed: true,
      completed_at: new Date().toISOString(),
      source_url: (body.sourceUrl as string) ?? null,
      utm_source: (body.utmSource as string) ?? null,
      utm_medium: (body.utmMedium as string) ?? null,
      utm_campaign: (body.utmCampaign as string) ?? null,
      referrer: (body.referrer as string) ?? null,
    })
    .select()
    .single();

  if (error || !session) {
    console.error('Error creating calculator session:', error);
    return createCorsResponse({ message: 'Failed to calculate print costs' }, 500, req);
  }

  // Best-effort analytics event (don't fail the calc if it errors).
  await admin
    .from('calculator_analytics_events')
    .insert({
      session_id: session.id,
      visitor_id: session.visitor_id,
      event_type: 'calculation_complete',
      event_category: 'engagement',
      event_data: {
        deviceCount: fleetInputs.deviceCount,
        industry: fleetInputs.industry,
        annualTCO: results.annualTCO,
      },
      user_agent: req.headers.get('user-agent'),
      ip_address: clientIp(req),
    })
    .then(undefined, (e) => console.error('analytics insert failed:', e));

  return createCorsResponse(
    { sessionKey, sessionId: session.id, results, recommendations },
    200,
    req,
  );
}

async function getSession(admin: Admin, sessionKey: string, req: Request): Promise<Response> {
  const { data: session, error } = await admin
    .from('calculator_sessions')
    .select('*')
    .eq('session_key', sessionKey)
    .maybeSingle();

  if (error || !session) {
    return createCorsResponse({ message: 'Session not found' }, 404, req);
  }

  const fleetInputs: FleetInputs = {
    deviceCount: session.device_count,
    deviceTypes: (session.device_types as string[]) ?? [],
    fleetAge: session.fleet_age,
    monthlyPageVolume: session.monthly_page_volume,
    colorRatio: Number(session.color_ratio),
    employeeCount: session.employee_count,
    industry: session.industry,
    painPoints: (session.pain_points as string[]) ?? [],
    monthlySupplieCost:
      session.monthly_supplie_cost != null ? Number(session.monthly_supplie_cost) : undefined,
    monthlyServiceCost:
      session.monthly_service_cost != null ? Number(session.monthly_service_cost) : undefined,
    monthlyDowntimeHours:
      session.monthly_downtime_hours != null ? Number(session.monthly_downtime_hours) : undefined,
    monthlyEnergyCost:
      session.monthly_energy_cost != null ? Number(session.monthly_energy_cost) : undefined,
  };

  const recommendations = generateRecommendations(fleetInputs, session.calculated_results);
  return createCorsResponse({ session, recommendations }, 200, req);
}

async function captureLead(admin: Admin, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const sessionKey = body.sessionKey as string;
  const email = body.email as string;
  const companyName = body.companyName as string;
  const role = body.role as string;

  if (!sessionKey || !email || !email.includes('@') || !companyName || !role) {
    return createCorsResponse({ message: 'Invalid input data' }, 400, req);
  }

  const { data: session } = await admin
    .from('calculator_sessions')
    .select('*')
    .eq('session_key', sessionKey)
    .maybeSingle();

  if (!session) {
    return createCorsResponse({ message: 'Session not found' }, 404, req);
  }

  const wantsQuarterlyUpdates = Boolean(body.wantsQuarterlyUpdates);
  const fullName = (body.fullName as string) ?? null;
  const phone = (body.phone as string) ?? null;

  const { data: existingLead } = await admin
    .from('calculator_leads')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  let lead: Record<string, any> | null = null;

  if (existingLead) {
    const { data, error } = await admin
      .from('calculator_leads')
      .update({
        session_count: (existingLead.session_count ?? 1) + 1,
        company_name: companyName,
        full_name: fullName,
        phone,
        role,
        wants_quarterly_updates: wantsQuarterlyUpdates,
      })
      .eq('id', existingLead.id)
      .select()
      .single();
    if (error || !data) {
      console.error('Error updating lead:', error);
      return createCorsResponse({ message: 'Failed to capture lead' }, 500, req);
    }
    lead = data;
  } else {
    const fleetInputs: FleetInputs = {
      deviceCount: session.device_count,
      deviceTypes: (session.device_types as string[]) ?? [],
      fleetAge: session.fleet_age,
      monthlyPageVolume: session.monthly_page_volume,
      colorRatio: Number(session.color_ratio),
      employeeCount: session.employee_count,
      industry: session.industry,
      painPoints: (session.pain_points as string[]) ?? [],
    };
    const leadScore = calculateLeadScore(fleetInputs, session.calculated_results);
    const leadTemperature = determineLeadTemperature(leadScore);
    const isDealerAccount = role === 'copier_dealer';

    const { data, error } = await admin
      .from('calculator_leads')
      .insert({
        email,
        company_name: companyName,
        full_name: fullName,
        phone,
        role,
        wants_quarterly_updates: wantsQuarterlyUpdates,
        is_dealer_account: isDealerAccount,
        first_session_id: session.id,
        lead_score: leadScore,
        lead_temperature: leadTemperature,
        utm_source: session.utm_source ?? null,
        utm_medium: session.utm_medium ?? null,
        utm_campaign: session.utm_campaign ?? null,
      })
      .select()
      .single();
    if (error || !data) {
      console.error('Error creating lead:', error);
      return createCorsResponse({ message: 'Failed to capture lead' }, 500, req);
    }
    lead = data;
  }

  if (!lead) return createCorsResponse({ message: 'Failed to capture lead' }, 500, req);

  // Link the session to the lead.
  await admin
    .from('calculator_sessions')
    .update({
      lead_id: lead.id,
      has_email_capture: true,
      email_captured_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  // Best-effort conversion analytics.
  await admin
    .from('calculator_analytics_events')
    .insert({
      session_id: session.id,
      visitor_id: session.visitor_id,
      event_type: 'email_captured',
      event_category: 'conversion',
      event_data: {
        role,
        isDealerAccount: lead.is_dealer_account,
        leadScore: lead.lead_score,
      },
      user_agent: req.headers.get('user-agent'),
      ip_address: clientIp(req),
    })
    .then(undefined, (e) => console.error('analytics insert failed:', e));

  return createCorsResponse({ leadId: lead.id, message: 'Email captured successfully' }, 200, req);
}

async function trackPdfDownload(admin: Admin, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sessionKey = body.sessionKey as string;
  if (!sessionKey) return createCorsResponse({ message: 'sessionKey is required' }, 400, req);

  const { data: session } = await admin
    .from('calculator_sessions')
    .select('id, visitor_id')
    .eq('session_key', sessionKey)
    .maybeSingle();

  if (!session) return createCorsResponse({ message: 'Session not found' }, 404, req);

  await admin.from('calculator_sessions').update({ pdf_downloaded: true }).eq('id', session.id);

  await admin
    .from('calculator_analytics_events')
    .insert({
      session_id: session.id,
      visitor_id: session.visitor_id,
      event_type: 'pdf_download',
      event_category: 'conversion',
      event_data: {},
      user_agent: req.headers.get('user-agent'),
      ip_address: clientIp(req),
    })
    .then(undefined, (e) => console.error('analytics insert failed:', e));

  return createCorsResponse({ message: 'PDF download tracked' }, 200, req);
}

async function trackEvent(admin: Admin, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const visitorId = body.visitorId as string;
  const eventType = body.eventType as string;
  const eventCategory = body.eventCategory as string;
  if (!visitorId || !eventType || !eventCategory) {
    return createCorsResponse({ message: 'Invalid input data' }, 400, req);
  }

  let sessionId: string | undefined;
  if (body.sessionKey) {
    const { data: session } = await admin
      .from('calculator_sessions')
      .select('id')
      .eq('session_key', body.sessionKey as string)
      .maybeSingle();
    sessionId = session?.id;
  }

  const { error } = await admin.from('calculator_analytics_events').insert({
    session_id: sessionId ?? null,
    visitor_id: visitorId,
    event_type: eventType,
    event_category: eventCategory,
    event_data: (body.eventData as Record<string, unknown>) ?? {},
    user_agent: req.headers.get('user-agent'),
    ip_address: clientIp(req),
  });

  if (error) {
    console.error('Error tracking event:', error);
    return createCorsResponse({ message: 'Failed to track event' }, 500, req);
  }
  return createCorsResponse({ message: 'Event tracked' }, 200, req);
}

async function getBenchmarks(admin: Admin, industry: string, req: Request): Promise<Response> {
  const { data, error } = await admin
    .from('industry_benchmarks')
    .select('*')
    .eq('industry', industry)
    .limit(5);

  if (error) {
    console.error('Error fetching benchmarks:', error);
    return createCorsResponse({ message: 'Failed to fetch benchmarks' }, 500, req);
  }
  return createCorsResponse(data ?? [], 200, req);
}
