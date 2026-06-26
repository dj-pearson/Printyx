// Public Print Cost Calculator Edge Function (EDGE-005f)
//
// Serves the UNAUTHENTICATED marketing-site calculator flow that the frontend
// calls at /api/public/calculator/* (PrintCostCalculator.tsx + EmailCaptureModal.tsx).
// In production the frontend hits functions.printyx.net directly, where Express
// (server/routes-print-cost-calculator.ts) is unreachable — so these endpoints
// 404'd. This function ports the public routes.
//
// AUTH BYPASS (the architectural decision EDGE-005f calls for): this is a public
// lead-capture surface, so it intentionally performs NO JWT verification. It uses
// the service-role client to write to the calculator_* / industry_benchmarks /
// email_sequence_tracking tables, exactly as the Express version did. config.toml
// sets `verify_jwt = false` for the native Supabase runtime; the Coolify server.ts
// dispatcher enforces auth per-handler (it doesn't read config.toml), so the
// bypass is simply this handler never checking a token.
//
// Routing: the frontend prefix is /api/public/calculator/<sub>. In production
// server.ts route-overrides `public` (+ subPath[0]==='calculator') → this dir and
// strips the `public` segment, so the handler sees /calculator/<sub>. In dev the
// edge-function-proxy forwards /api/public/calculator/* → public-calculator with
// a /calculator pathPrefix. Either way the path here starts with /calculator.
//
// DEFERRED: the Day-0..7 email nurture sequence rows are recorded
// (email_sequence_tracking) but NOT actually sent — no email provider is wired
// into this edge function (mirrors the Express path's best-effort, non-blocking
// send, and the established "stub the provider call" pattern, e.g. signatures
// /send). Lead capture itself is fully functional.

import { createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import {
  calculatePrintCosts,
  calculateLeadScore,
  determineLeadTemperature,
  generateRecommendations,
  type FleetInputs,
} from '../_shared/print-cost-calculator.ts';

function uuid(): string {
  return crypto.randomUUID();
}

function clientMeta(req: Request): { userAgent: string | null; ipAddress: string | null } {
  const fwd = req.headers.get('x-forwarded-for');
  return {
    userAgent: req.headers.get('user-agent'),
    ipAddress: fwd ? fwd.split(',')[0].trim() : req.headers.get('x-real-ip'),
  };
}

// Build the pure-function FleetInputs from a calculator_sessions row (snake_case).
function fleetInputsFromSession(s: Record<string, any>): FleetInputs {
  return {
    deviceCount: s.device_count,
    deviceTypes: (s.device_types as string[]) || [],
    fleetAge: s.fleet_age,
    monthlyPageVolume: s.monthly_page_volume,
    colorRatio: parseFloat(s.color_ratio),
    employeeCount: s.employee_count,
    industry: s.industry,
    painPoints: (s.pain_points as string[]) || [],
    monthlySupplieCost:
      s.monthly_supplie_cost != null ? parseFloat(s.monthly_supplie_cost) : undefined,
    monthlyServiceCost:
      s.monthly_service_cost != null ? parseFloat(s.monthly_service_cost) : undefined,
    monthlyDowntimeHours:
      s.monthly_downtime_hours != null ? parseFloat(s.monthly_downtime_hours) : undefined,
    monthlyEnergyCost:
      s.monthly_energy_cost != null ? parseFloat(s.monthly_energy_cost) : undefined,
  };
}

export default async function handler(req: Request): Promise<Response> {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const allParts = url.pathname.split('/').filter(Boolean);
    // Drop a leading `calculator` segment so `seg` is the resource path.
    const seg = allParts[0] === 'calculator' ? allParts.slice(1) : allParts;
    const resource = seg[0]; // 'sessions' | 'leads' | 'track' | 'benchmarks'

    const admin = createSupabaseServiceClient();

    // ---------- POST /calculator/sessions — create session + calculate ----------
    if (req.method === 'POST' && resource === 'sessions' && !seg[1]) {
      const body = await req.json().catch(() => null);
      const v = validateSessionInput(body);
      if ('error' in v) return createCorsResponse({ message: v.error }, 400, req);

      const fleetInputs = v.value;
      const results = calculatePrintCosts(fleetInputs);
      const recommendations = generateRecommendations(fleetInputs, results);

      const sessionKey = uuid();
      const visitorId = body.visitorId || uuid();

      const { data: session, error } = await admin
        .from('calculator_sessions')
        .insert({
          id: uuid(),
          session_key: sessionKey,
          visitor_id: visitorId,
          device_count: fleetInputs.deviceCount,
          device_types: fleetInputs.deviceTypes,
          fleet_age: fleetInputs.fleetAge,
          monthly_page_volume: fleetInputs.monthlyPageVolume,
          color_ratio: String(fleetInputs.colorRatio),
          monthly_supplie_cost: fleetInputs.monthlySupplieCost?.toString() ?? null,
          monthly_service_cost: fleetInputs.monthlyServiceCost?.toString() ?? null,
          monthly_downtime_hours: fleetInputs.monthlyDowntimeHours?.toString() ?? null,
          monthly_energy_cost: fleetInputs.monthlyEnergyCost?.toString() ?? null,
          employee_count: fleetInputs.employeeCount,
          industry: fleetInputs.industry,
          pain_points: fleetInputs.painPoints,
          calculated_results: results,
          is_completed: true,
          completed_at: new Date().toISOString(),
          source_url: body.sourceUrl ?? null,
          utm_source: body.utmSource ?? null,
          utm_medium: body.utmMedium ?? null,
          utm_campaign: body.utmCampaign ?? null,
          referrer: body.referrer ?? null,
        })
        .select()
        .single();

      if (error || !session) {
        console.error('Error creating calculator session:', error);
        return createCorsResponse({ message: 'Failed to calculate print costs' }, 500, req);
      }

      const meta = clientMeta(req);
      await admin.from('calculator_analytics_events').insert({
        id: uuid(),
        session_id: session.id,
        visitor_id: session.visitor_id,
        event_type: 'calculation_complete',
        event_category: 'engagement',
        event_data: {
          deviceCount: fleetInputs.deviceCount,
          industry: fleetInputs.industry,
          annualTCO: results.annualTCO,
        },
        user_agent: meta.userAgent,
        ip_address: meta.ipAddress,
      });

      return createCorsResponse(
        { sessionKey, sessionId: session.id, results, recommendations },
        200,
        req,
      );
    }

    // ---------- GET /calculator/sessions/:sessionKey ----------
    if (req.method === 'GET' && resource === 'sessions' && seg[1]) {
      const sessionKey = seg[1];
      const { data: session, error } = await admin
        .from('calculator_sessions')
        .select('*')
        .eq('session_key', sessionKey)
        .maybeSingle();

      if (error) {
        console.error('Error fetching calculator session:', error);
        return createCorsResponse({ message: 'Failed to fetch session' }, 500, req);
      }
      if (!session) return createCorsResponse({ message: 'Session not found' }, 404, req);

      const recommendations = generateRecommendations(
        fleetInputsFromSession(session),
        session.calculated_results,
      );
      return createCorsResponse({ session, recommendations }, 200, req);
    }

    // ---------- POST /calculator/leads — capture email lead ----------
    if (req.method === 'POST' && resource === 'leads' && !seg[1]) {
      const body = await req.json().catch(() => null);
      const v = validateLeadInput(body);
      if ('error' in v) return createCorsResponse({ message: v.error }, 400, req);
      const input = v.value;

      const { data: session } = await admin
        .from('calculator_sessions')
        .select('*')
        .eq('session_key', input.sessionKey)
        .maybeSingle();

      if (!session) return createCorsResponse({ message: 'Session not found' }, 404, req);

      const { data: existingLead } = await admin
        .from('calculator_leads')
        .select('*')
        .eq('email', input.email)
        .maybeSingle();

      let lead: Record<string, any>;

      if (existingLead) {
        const { data: updated, error: updErr } = await admin
          .from('calculator_leads')
          .update({
            session_count: (existingLead.session_count || 1) + 1,
            company_name: input.companyName,
            full_name: input.fullName ?? null,
            phone: input.phone ?? null,
            role: input.role,
            wants_quarterly_updates: input.wantsQuarterlyUpdates,
          })
          .eq('id', existingLead.id)
          .select()
          .single();
        if (updErr || !updated) {
          console.error('Error updating lead:', updErr);
          return createCorsResponse({ message: 'Failed to capture lead' }, 500, req);
        }
        lead = updated;
      } else {
        const fleetInputs = fleetInputsFromSession(session);
        const leadScore = calculateLeadScore(fleetInputs, session.calculated_results);
        const leadTemperature = determineLeadTemperature(leadScore);
        const isDealerAccount = input.role === 'copier_dealer';

        const { data: created, error: insErr } = await admin
          .from('calculator_leads')
          .insert({
            id: uuid(),
            email: input.email,
            company_name: input.companyName,
            full_name: input.fullName ?? null,
            phone: input.phone ?? null,
            role: input.role,
            wants_quarterly_updates: input.wantsQuarterlyUpdates,
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
        if (insErr || !created) {
          console.error('Error creating lead:', insErr);
          return createCorsResponse({ message: 'Failed to capture lead' }, 500, req);
        }
        lead = created;

        // Record the nurture sequence (provider send deferred — see header).
        await recordEmailSequence(admin, lead.id, isDealerAccount);
      }

      await admin
        .from('calculator_sessions')
        .update({
          lead_id: lead.id,
          has_email_capture: true,
          email_captured_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      const meta = clientMeta(req);
      await admin.from('calculator_analytics_events').insert({
        id: uuid(),
        session_id: session.id,
        visitor_id: session.visitor_id,
        event_type: 'email_captured',
        event_category: 'conversion',
        event_data: {
          role: input.role,
          isDealerAccount: lead.is_dealer_account,
          leadScore: lead.lead_score,
        },
        user_agent: meta.userAgent,
        ip_address: meta.ipAddress,
      });

      return createCorsResponse(
        { leadId: lead.id, message: 'Email captured successfully' },
        200,
        req,
      );
    }

    // ---------- POST /calculator/track/pdf-download ----------
    if (req.method === 'POST' && resource === 'track' && seg[1] === 'pdf-download') {
      const body = await req.json().catch(() => ({}));
      const sessionKey = body?.sessionKey;
      if (!sessionKey) return createCorsResponse({ message: 'sessionKey is required' }, 400, req);

      const { data: session } = await admin
        .from('calculator_sessions')
        .select('id, visitor_id')
        .eq('session_key', sessionKey)
        .maybeSingle();
      if (!session) return createCorsResponse({ message: 'Session not found' }, 404, req);

      await admin.from('calculator_sessions').update({ pdf_downloaded: true }).eq('id', session.id);

      const meta = clientMeta(req);
      await admin.from('calculator_analytics_events').insert({
        id: uuid(),
        session_id: session.id,
        visitor_id: session.visitor_id,
        event_type: 'pdf_download',
        event_category: 'conversion',
        event_data: {},
        user_agent: meta.userAgent,
        ip_address: meta.ipAddress,
      });

      return createCorsResponse({ message: 'PDF download tracked' }, 200, req);
    }

    // ---------- POST /calculator/track/event ----------
    if (req.method === 'POST' && resource === 'track' && seg[1] === 'event') {
      const body = await req.json().catch(() => null);
      if (
        !body ||
        typeof body.visitorId !== 'string' ||
        typeof body.eventType !== 'string' ||
        typeof body.eventCategory !== 'string'
      ) {
        return createCorsResponse({ message: 'Invalid input data' }, 400, req);
      }

      let sessionId: string | undefined;
      if (body.sessionKey) {
        const { data: session } = await admin
          .from('calculator_sessions')
          .select('id')
          .eq('session_key', body.sessionKey)
          .maybeSingle();
        sessionId = session?.id;
      }

      const meta = clientMeta(req);
      await admin.from('calculator_analytics_events').insert({
        id: uuid(),
        session_id: sessionId ?? null,
        visitor_id: body.visitorId,
        event_type: body.eventType,
        event_category: body.eventCategory,
        event_data: body.eventData || {},
        user_agent: meta.userAgent,
        ip_address: meta.ipAddress,
      });

      return createCorsResponse({ message: 'Event tracked' }, 200, req);
    }

    // ---------- GET /calculator/benchmarks/:industry ----------
    if (req.method === 'GET' && resource === 'benchmarks' && seg[1]) {
      const industry = seg[1];
      const { data: benchmarks, error } = await admin
        .from('industry_benchmarks')
        .select('*')
        .eq('industry', industry)
        .limit(5);
      if (error) {
        console.error('Error fetching benchmarks:', error);
        return createCorsResponse({ message: 'Failed to fetch benchmarks' }, 500, req);
      }
      return createCorsResponse(benchmarks || [], 200, req);
    }

    return createCorsResponse({ message: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in public-calculator function:', error);
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ==================== Input validation (mirrors the Express zod schemas) ====================

type Validated<T> = { value: T } | { error: string };

function validateSessionInput(body: any): Validated<FleetInputs> {
  if (!body || typeof body !== 'object') return { error: 'Invalid input data' };
  const isInt = (n: any, min: number, max: number) =>
    typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
  const isNum = (n: any, min: number, max: number) => typeof n === 'number' && n >= min && n <= max;

  if (!isInt(body.deviceCount, 1, 500)) return { error: 'deviceCount must be an integer 1-500' };
  if (!Array.isArray(body.deviceTypes)) return { error: 'deviceTypes must be an array' };
  if (typeof body.fleetAge !== 'string') return { error: 'fleetAge is required' };
  if (!isInt(body.monthlyPageVolume, 0, 10000000))
    return { error: 'monthlyPageVolume must be an integer 0-10000000' };
  if (!isNum(body.colorRatio, 0, 100)) return { error: 'colorRatio must be 0-100' };
  if (!isInt(body.employeeCount, 1, 100000))
    return { error: 'employeeCount must be an integer 1-100000' };
  if (typeof body.industry !== 'string') return { error: 'industry is required' };
  if (!Array.isArray(body.painPoints)) return { error: 'painPoints must be an array' };

  const optNum = (n: any) => (typeof n === 'number' ? n : undefined);
  return {
    value: {
      deviceCount: body.deviceCount,
      deviceTypes: body.deviceTypes,
      fleetAge: body.fleetAge,
      monthlyPageVolume: body.monthlyPageVolume,
      colorRatio: body.colorRatio,
      employeeCount: body.employeeCount,
      industry: body.industry,
      painPoints: body.painPoints,
      monthlySupplieCost: optNum(body.monthlySupplieCost),
      monthlyServiceCost: optNum(body.monthlyServiceCost),
      monthlyDowntimeHours: optNum(body.monthlyDowntimeHours),
      monthlyEnergyCost: optNum(body.monthlyEnergyCost),
    },
  };
}

interface LeadInput {
  sessionKey: string;
  email: string;
  companyName: string;
  fullName?: string;
  phone?: string;
  role: string;
  wantsQuarterlyUpdates: boolean;
}

function validateLeadInput(body: any): Validated<LeadInput> {
  if (!body || typeof body !== 'object') return { error: 'Invalid input data' };
  if (typeof body.sessionKey !== 'string' || !body.sessionKey)
    return { error: 'sessionKey is required' };
  if (typeof body.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email))
    return { error: 'A valid email is required' };
  if (typeof body.companyName !== 'string' || body.companyName.length < 1)
    return { error: 'companyName is required' };
  if (typeof body.role !== 'string' || !body.role) return { error: 'role is required' };

  return {
    value: {
      sessionKey: body.sessionKey,
      email: body.email,
      companyName: body.companyName,
      fullName: typeof body.fullName === 'string' ? body.fullName : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      role: body.role,
      wantsQuarterlyUpdates: body.wantsQuarterlyUpdates === true,
    },
  };
}

// ==================== Email nurture sequence (recorded, send deferred) ====================

async function recordEmailSequence(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  leadId: string,
  isDealerAccount: boolean,
): Promise<void> {
  try {
    await admin
      .from('calculator_leads')
      .update({ email_sequence_started: true, email_sequence_day: 0 })
      .eq('id', leadId);

    const now = new Date();
    const rows: Record<string, any>[] = [
      {
        id: uuid(),
        lead_id: leadId,
        sequence_day: 0,
        email_subject: 'Your Print Fleet Analysis Report + First Action Step',
        email_template: isDealerAccount ? 'day_0_dealer' : 'day_0_standard',
        // Provider send is deferred in the edge function — record as pending
        // rather than claiming 'sent'. A future worker (or the Express path)
        // delivers and flips the status.
        status: 'pending',
        scheduled_for: now.toISOString(),
      },
    ];

    for (const day of [1, 2, 3, 5, 6, 7]) {
      const scheduled = new Date(now);
      scheduled.setDate(scheduled.getDate() + day);
      rows.push({
        id: uuid(),
        lead_id: leadId,
        sequence_day: day,
        email_subject: emailSubjectForDay(day, isDealerAccount),
        email_template: `day_${day}_${isDealerAccount ? 'dealer' : 'standard'}`,
        status: 'pending',
        scheduled_for: scheduled.toISOString(),
      });
    }

    await admin.from('email_sequence_tracking').insert(rows);
  } catch (error) {
    // Never let sequence bookkeeping block lead capture (matches Express).
    console.error('Error recording email sequence:', error);
  }
}

function emailSubjectForDay(day: number, isDealer: boolean): string {
  const subjects: Record<number, { standard: string; dealer: string }> = {
    1: {
      standard: "The hidden cost of printer downtime (it's worse than you think)",
      dealer: 'Sales Tool: Show This Calculator to Your Prospects',
    },
    2: {
      standard: 'Case Study: Regional law firm saves $47K with print management',
      dealer: 'Dealer Success: Close More Deals with Print Cost Analysis',
    },
    3: {
      standard: 'Your custom print policy template (based on your fleet)',
      dealer: 'White-Label Calculator: Co-Brand for Your Business',
    },
    5: {
      standard: 'Supply management is costing you more than you think',
      dealer: 'Dealer Resources: Email Templates & Sales Scripts',
    },
    6: {
      standard: 'ROI Calculator: When does new equipment pay for itself?',
      dealer: 'Partner Program: Earn Revenue Share on Referrals',
    },
    7: {
      standard: 'Special offer: 30 days free + implementation support',
      dealer: 'Exclusive Dealer Offer: Free Printyx Account + Bonuses',
    },
  };
  return subjects[day]?.[isDealer ? 'dealer' : 'standard'] || 'Printyx Print Management Update';
}
