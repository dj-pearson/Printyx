// Predictive Maintenance Edge Function
// Replaces server/routes-predictive-maintenance-hub.ts (628 lines, 6 endpoints).
//
// URL layout (under /predictive-maintenance):
//   GET  /dashboard                 — equipment health scores + summary stats
//   GET  /parts-forecast            — toner/fuser/drum needs from latest metrics
//   POST /:equipmentId/schedule     — schedule proactive service (degraded — wraps Express service)
//   POST /analyze/:serialNumber     — single-device AI analysis (degraded — needs Claude integration)
//   POST /analyze-batch             — batch AI analysis (degraded)
//   POST /analyze-fleet             — fleet-wide AI analysis (degraded)
//
// Tables: equipment, business_records (joined for customer name),
// client_collected_metrics (toner_black, fuser_life, drum_life, etc.).
//
// Health-score logic + parts-forecast aggregation are pure JS over DB rows
// (portable). AI prediction integration with predictive-service-dispatch-service
// is in-process Express memory and not portable — those paths return
// shape-compatible degraded responses.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'predictive-maintenance');
    const first = parts[0];
    const second = parts[1];

    if (req.method === 'GET' && first === 'dashboard') return await dashboard(admin, tenantId, req);
    if (req.method === 'GET' && first === 'parts-forecast') {
      return await partsForecast(admin, tenantId, req);
    }
    if (req.method === 'POST' && first === 'analyze-fleet') {
      return await aiDegraded(req, 'fleet-wide AI analysis');
    }
    if (req.method === 'POST' && first === 'analyze-batch') {
      return await aiDegraded(req, 'batch AI analysis');
    }
    if (req.method === 'POST' && first === 'analyze' && second) {
      return await aiDegraded(req, 'single-device AI analysis');
    }
    if (req.method === 'POST' && first && second === 'schedule') {
      return await scheduleProactiveService(admin, tenantId, first, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in predictive-maintenance function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ─── /dashboard ─────────────────────────────────────────────────────────────

async function dashboard(admin: Admin, tenantId: string, req: Request): Promise<Response> {
  const { data: equipmentRows, error } = await admin
    .from('equipment')
    .select(
      'id, serial_number, make, model, customer_id, location, current_meter_reading, last_service_date, next_service_due_date, install_date, status',
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('next_service_due_date', { ascending: true });

  if (error) {
    return createCorsResponse({ error: 'Failed to fetch equipment' }, 500, req);
  }

  // Pull customer names in one batch
  const customerIds = Array.from(
    new Set(
      ((equipmentRows ?? []) as Array<{ customer_id: string | null }>)
        .map((e) => e.customer_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const { data: customers } = customerIds.length
    ? await admin.from('business_records').select('id, company_name').in('id', customerIds)
    : { data: [] as Array<{ id: string; company_name: string }> };
  const customerMap = new Map<string, string>();
  for (const c of (customers ?? []) as Array<{ id: string; company_name: string }>) {
    customerMap.set(c.id, c.company_name);
  }

  const now = new Date();
  const equipmentHealth = ((equipmentRows ?? []) as Array<Record<string, unknown>>).map((item) => {
    const lastService = item.last_service_date ? new Date(item.last_service_date as string) : null;
    const nextDueRaw = item.next_service_due_date
      ? new Date(item.next_service_due_date as string)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const daysSinceService = lastService
      ? Math.floor((now.getTime() - lastService.getTime()) / (1000 * 60 * 60 * 24))
      : 9999;
    const daysUntilDue = Math.floor((nextDueRaw.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let healthScore = 100;
    if (daysUntilDue < 0) healthScore -= Math.min(50, Math.abs(daysUntilDue) * 2);
    if (daysSinceService > 180) healthScore -= Math.min(30, (daysSinceService - 180) / 10);

    const meterReading = (item.current_meter_reading as number) || 0;
    const recommendedPages = 50000;
    if (meterReading > recommendedPages) {
      healthScore -= Math.min(20, ((meterReading - recommendedPages) / recommendedPages) * 20);
    }
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

    let urgency: 'overdue' | 'urgent' | 'soon' | 'scheduled';
    let riskLevel: 'critical' | 'high' | 'medium' | 'low';
    if (daysUntilDue <= 0) {
      urgency = 'overdue';
      riskLevel = 'critical';
    } else if (daysUntilDue <= 7) {
      urgency = 'urgent';
      riskLevel = 'high';
    } else if (daysUntilDue <= 30) {
      urgency = 'soon';
      riskLevel = 'medium';
    } else {
      urgency = 'scheduled';
      riskLevel = 'low';
    }

    const estimatedIssues: string[] = [];
    if (healthScore < 40) estimatedIssues.push('High risk of failure');
    else if (healthScore < 60) estimatedIssues.push('Preventive maintenance recommended');
    else if (healthScore < 80) estimatedIssues.push('Minor adjustments may be needed');
    if (daysUntilDue < 0) estimatedIssues.push(`${Math.abs(daysUntilDue)} days overdue`);

    return {
      equipmentId: item.id,
      serialNumber: (item.serial_number as string) || 'N/A',
      make: (item.make as string) || 'Unknown',
      model: (item.model as string) || 'Unknown',
      customerName: customerMap.get(item.customer_id as string) || 'Unknown Customer',
      customerId: item.customer_id,
      location: (item.location as string) || 'Unknown',
      lastServiceDate: item.last_service_date,
      daysSinceService,
      nextServiceDue: nextDueRaw.toISOString(),
      daysUntilDue,
      healthScore,
      meterReading,
      recommendedPages,
      urgency,
      riskLevel,
      estimatedIssues: estimatedIssues.length > 0 ? estimatedIssues : undefined,
      // AI prediction is degraded (see file header).
      aiPrediction: null,
    };
  });

  const overdueCount = equipmentHealth.filter((i) => i.urgency === 'overdue').length;
  const urgentCount = equipmentHealth.filter((i) => i.urgency === 'urgent').length;
  const soonCount = equipmentHealth.filter((i) => i.urgency === 'soon').length;
  const scheduledCount = equipmentHealth.filter((i) => i.urgency === 'scheduled').length;
  const averageHealthScore =
    equipmentHealth.length > 0
      ? Math.round(equipmentHealth.reduce((s, i) => s + i.healthScore, 0) / equipmentHealth.length)
      : 100;

  const devicesAtRisk = equipmentHealth.filter((i) => i.healthScore < 60).length;
  const preventableEmergencies = Math.floor(devicesAtRisk * 0.7);
  const downtimePreventedHours = preventableEmergencies * 4;
  const costSavings = preventableEmergencies * 200;
  const totalPossibleDowntime = equipmentHealth.length * 30 * 24;
  const uptimeImprovement =
    totalPossibleDowntime > 0
      ? ((downtimePreventedHours / totalPossibleDowntime) * 100).toFixed(2)
      : '0.00';

  return createCorsResponse(
    {
      success: true,
      overview: {
        totalEquipment: equipmentHealth.length,
        devicesMonitored: equipmentHealth.length,
        devicesAtRisk,
        overdueCount,
        urgentCount,
        soonCount,
        scheduledCount,
        averageHealthScore,
        preventableEmergencies,
        downtimePreventedHours,
        costSavings,
        uptimeImprovement: `${uptimeImprovement}%`,
        period: '30 days',
      },
      equipment: equipmentHealth,
      degraded: {
        aiPrediction: true,
        reason:
          'AI failure-risk prediction integrates with predictive-service-dispatch-service (in-process Express memory). Health score is computed from meter + service-date heuristics; AI-augmented prediction returns null until that service is ported or replaced with a Claude API call.',
      },
    },
    200,
    req,
  );
}

// ─── /parts-forecast ────────────────────────────────────────────────────────

async function partsForecast(admin: Admin, tenantId: string, req: Request): Promise<Response> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: equipmentList } = await admin
    .from('equipment')
    .select('id, serial_number, make, model')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');

  const partsForecast: Record<
    string,
    {
      partName: string;
      category: string;
      quantity: number;
      priority: string;
      estimatedCost: number;
      devices: string[];
    }
  > = {};

  for (const device of (equipmentList ?? []) as Array<Record<string, unknown>>) {
    const serial = device.serial_number as string | null;
    if (!serial) continue;

    // Latest metrics for this device (one row, ordered by collection_timestamp desc)
    const { data: latestList } = await admin
      .from('client_collected_metrics')
      .select('toner_black, toner_cyan, toner_magenta, toner_yellow, fuser_life, drum_life')
      .eq('serial_number', serial)
      .eq('tenant_id', Number(tenantId)) // tenantId on this table is integer per Express code
      .gte('collection_timestamp', thirtyDaysAgo.toISOString())
      .order('collection_timestamp', { ascending: false })
      .limit(1);

    const latest = (latestList ?? [])[0] as Record<string, unknown> | undefined;
    if (!latest) continue;

    // Toner check (4 colors)
    const tonerLevels: Array<{ color: string; level: unknown; cost: number }> = [
      { color: 'black', level: latest.toner_black, cost: 50 },
      { color: 'cyan', level: latest.toner_cyan, cost: 50 },
      { color: 'magenta', level: latest.toner_magenta, cost: 50 },
      { color: 'yellow', level: latest.toner_yellow, cost: 50 },
    ];
    for (const toner of tonerLevels) {
      if (typeof toner.level === 'number' && toner.level < 15) {
        const partKey = `toner_${toner.color}`;
        if (!partsForecast[partKey]) {
          partsForecast[partKey] = {
            partName: `Toner Cartridge - ${toner.color}`,
            category: 'consumable',
            quantity: 0,
            priority: toner.level < 5 ? 'urgent' : 'high',
            estimatedCost: 0,
            devices: [],
          };
        }
        partsForecast[partKey].quantity += 1;
        partsForecast[partKey].estimatedCost += toner.cost;
        partsForecast[partKey].devices.push(serial);
      }
    }

    // Fuser life
    if (typeof latest.fuser_life === 'number' && latest.fuser_life < 10) {
      const key = 'fuser_assembly';
      if (!partsForecast[key]) {
        partsForecast[key] = {
          partName: 'Fuser Assembly',
          category: 'component',
          quantity: 0,
          priority: latest.fuser_life < 5 ? 'critical' : 'high',
          estimatedCost: 0,
          devices: [],
        };
      }
      partsForecast[key].quantity += 1;
      partsForecast[key].estimatedCost += 300;
      partsForecast[key].devices.push(serial);
    }

    // Drum life
    if (typeof latest.drum_life === 'number' && latest.drum_life < 15) {
      const key = 'drum_unit';
      if (!partsForecast[key]) {
        partsForecast[key] = {
          partName: 'Drum Unit',
          category: 'component',
          quantity: 0,
          priority: latest.drum_life < 5 ? 'urgent' : 'medium',
          estimatedCost: 0,
          devices: [],
        };
      }
      partsForecast[key].quantity += 1;
      partsForecast[key].estimatedCost += 150;
      partsForecast[key].devices.push(serial);
    }
  }

  const forecast = Object.values(partsForecast);
  const totalCost = forecast.reduce((s, p) => s + p.estimatedCost, 0);

  return createCorsResponse(
    {
      success: true,
      forecast,
      summary: {
        totalParts: forecast.reduce((s, p) => s + p.quantity, 0),
        uniqueParts: forecast.length,
        totalEstimatedCost: totalCost,
        criticalParts: forecast.filter((p) => p.priority === 'critical').length,
        urgentParts: forecast.filter((p) => p.priority === 'urgent').length,
      },
    },
    200,
    req,
  );
}

// ─── /:id/schedule (proactive service scheduling) ───────────────────────────

async function scheduleProactiveService(
  admin: Admin,
  tenantId: string,
  equipmentId: string,
  req: Request,
): Promise<Response> {
  let body: { scheduledDate?: string; serviceType?: string; notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }

  // Verify equipment exists in tenant
  const { data: eq } = await admin
    .from('equipment')
    .select('id, serial_number')
    .eq('id', equipmentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!eq) {
    return createCorsResponse({ error: 'Equipment not found' }, 404, req);
  }

  // Create a service ticket as the scheduled-maintenance record. The Express
  // service-dispatch path also writes additional fields like priority and
  // service-window assignment; those depend on services we haven't ported.
  const scheduledDate =
    body.scheduledDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: ticket, error } = await admin
    .from('service_tickets')
    .insert({
      tenant_id: tenantId,
      equipment_id: equipmentId,
      ticket_type: 'preventive_maintenance',
      status: 'scheduled',
      priority: 'medium',
      title: `Proactive maintenance — ${(eq as Record<string, unknown>).serial_number ?? equipmentId}`,
      description: body.notes ?? 'Auto-scheduled from predictive maintenance hub',
      scheduled_date: scheduledDate,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return createCorsResponse(
      {
        error: 'Failed to create scheduled service ticket',
        degraded: {
          serviceDispatchIntegration: true,
          reason:
            'Express version integrates with predictive-service-dispatch-service for assignment + priority scoring; only the basic ticket creation is portable to edge runtime.',
        },
      },
      500,
      req,
    );
  }

  return createCorsResponse(
    {
      success: true,
      ticketId: (ticket as Record<string, unknown>)?.id,
      scheduledDate,
      message:
        'Service scheduled. Note: full predictive-dispatch integration (priority + tech assignment) is degraded.',
      degraded: {
        serviceDispatchIntegration: true,
        reason:
          'Express version sets a calculated priority and pre-assigns a technician via predictive-service-dispatch-service. This port creates the ticket only.',
      },
    },
    201,
    req,
  );
}

// ─── AI degraded paths ──────────────────────────────────────────────────────

function aiDegraded(req: Request, label: string): Response {
  return createCorsResponse(
    {
      success: false,
      results: [],
      degraded: {
        aiAnalysis: true,
        label,
        reason:
          'AI fleet/device analysis integrates with predictive-service-dispatch-service (in-process Express memory + Claude orchestration). Replace with a direct Claude API call from the edge function or move the analyzer to a Postgres-backed table.',
      },
    },
    503,
    req,
  );
}
