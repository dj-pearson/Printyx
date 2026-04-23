/**
 * Sales Pipeline edge function.
 *
 * Replaces server/routes-sales-pipeline.ts. Six endpoints:
 *
 *   GET    /sales-pipeline/opportunities                     — list (stage/rep filter)
 *   POST   /sales-pipeline/opportunities                     — create lead
 *   PATCH  /sales-pipeline/opportunities/:id/stage           — move stage + log activity
 *   POST   /sales-pipeline/opportunities/:id/activity        — log activity
 *   GET    /sales-pipeline/rep-metrics                       — per-rep rollups (rpc)
 *   GET    /sales-pipeline/summary                           — tenant-wide KPIs (rpc)
 *
 * Complex CTE queries live in drizzle/functions/sales-pipeline.sql as
 * `sales_pipeline_rep_metrics` and `sales_pipeline_summary`. This dispatcher
 * uses the Supabase JS client for straightforward CRUD and .rpc() for the two
 * analytics endpoints.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { z } from 'https://esm.sh/zod@3.22.4';
import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import {
  errorResponse,
  generateRequestId,
  jsonResponse,
  validateBody,
  ValidationError,
} from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('sales-pipeline');

const PIPELINE_STAGES = [
  { id: 'lead', name: 'New Lead', order: 1 },
  { id: 'contacted', name: 'First Contact', order: 2 },
  { id: 'demo_scheduled', name: 'Demo Scheduled', order: 3 },
  { id: 'demo_completed', name: 'Demo Completed', order: 4 },
  { id: 'proposal_prep', name: 'Proposal Prep', order: 5 },
  { id: 'proposal_sent', name: 'Proposal Sent', order: 6 },
  { id: 'negotiation', name: 'Negotiation', order: 7 },
  { id: 'closed_won', name: 'Closed Won', order: 8 },
  { id: 'closed_lost', name: 'Closed Lost', order: 9 },
];

const createOpportunitySchema = z.object({
  company_name: z.string().min(1),
  contact_name: z.string().min(1),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
  stage: z.string(),
  estimated_value: z.number().min(0),
  probability: z.number().min(0).max(100),
  expected_close_date: z.string(),
  lead_source: z.string().optional(),
  notes: z.string().optional(),
});

const stageUpdateSchema = z.object({
  stage: z.string(),
  notes: z.string().optional(),
});

const activitySchema = z.object({
  activity_type: z.string(),
  notes: z.string(),
});

function stripPrefix(path: string): string {
  return path.replace(/^\/+/, '/').replace(/^\/sales-pipeline/, '') || '/';
}

serve(async (req) => {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  const requestId = generateRequestId();
  const startedAt = Date.now();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const path = stripPrefix(url.pathname);

  log.info({ requestId, method, path }, 'request_received');

  try {
    const ctx = await requireAuth(req);
    const db = getDb();

    // ─── GET /opportunities ────────────────────────────────────────────────
    if (path === '/opportunities' && method === 'GET') {
      const stage = url.searchParams.get('stage');
      const rep = url.searchParams.get('rep');

      let query = db
        .from('business_records')
        .select(
          [
            'id',
            'company_name',
            'primary_contact_name',
            'primary_contact_email',
            'primary_contact_phone',
            'status',
            'estimated_deal_value',
            'probability',
            'close_date',
            'source',
            'notes',
            'owner_id',
            'last_contact_date',
            'next_follow_up_date',
            'created_at',
            'updated_at',
          ].join(','),
        )
        .eq('tenant_id', ctx.tenantId)
        .eq('record_type', 'lead')
        .not('status', 'in', '(closed_won,closed_lost)')
        .order('updated_at', { ascending: false });

      if (stage && stage !== 'all') query = query.eq('status', stage);
      if (rep && rep !== 'all') query = query.eq('owner_id', rep);

      const { data, error } = await query;
      if (error) {
        return errorResponse(500, 'Failed to fetch pipeline opportunities', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }

      const now = Date.now();
      const opportunities = (data ?? []).map((row: Record<string, unknown>) => {
        const updatedAt = row.updated_at ? new Date(row.updated_at as string).getTime() : now;
        const daysInStage = Math.max(0, Math.floor((now - updatedAt) / 86400000));
        const nextFollowUp = row.next_follow_up_date as string | null;
        return {
          id: row.id,
          company_name: row.company_name,
          contact_name: row.primary_contact_name,
          contact_email: row.primary_contact_email,
          contact_phone: row.primary_contact_phone,
          stage: row.status || 'lead',
          estimated_value: parseFloat(String(row.estimated_deal_value ?? 0)) || 0,
          probability: parseInt(String(row.probability ?? 50)) || 50,
          expected_close_date:
            (row.close_date as string | null) ?? new Date(now + 30 * 86400000).toISOString(),
          assigned_rep: row.owner_id,
          last_activity: (row.last_contact_date as string | null) ?? row.created_at,
          next_action: nextFollowUp
            ? `Follow up on ${new Date(nextFollowUp).toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
              })}`
            : 'Update required',
          days_in_stage: daysInStage,
          created_at: row.created_at,
          notes: row.notes || '',
          lead_source: row.source || 'Unknown',
        };
      });

      return jsonResponse(opportunities, 200, req, requestId);
    }

    // ─── POST /opportunities ───────────────────────────────────────────────
    if (path === '/opportunities' && method === 'POST') {
      let input: z.infer<typeof createOpportunitySchema>;
      try {
        input = await validateBody(createOpportunitySchema, req);
      } catch (err) {
        if (err instanceof ValidationError) {
          return errorResponse(400, 'Invalid input', req, {
            code: 'VALIDATION_ERROR',
            details: err.issues,
            requestId,
          });
        }
        throw err;
      }

      const { data, error } = await db
        .from('business_records')
        .insert({
          tenant_id: ctx.tenantId,
          record_type: 'lead',
          company_name: input.company_name,
          primary_contact_name: input.contact_name,
          primary_contact_email: input.contact_email,
          primary_contact_phone: input.contact_phone ?? null,
          status: input.stage,
          estimated_deal_value: input.estimated_value,
          probability: input.probability,
          close_date: input.expected_close_date,
          source: input.lead_source ?? 'Manual Entry',
          owner_id: ctx.userId,
          created_by: ctx.userId,
          notes: input.notes ?? '',
        })
        .select()
        .single();

      if (error || !data) {
        return errorResponse(500, 'Failed to create opportunity', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }

      return jsonResponse({ success: true, opportunity: data }, 201, req, requestId);
    }

    // ─── PATCH /opportunities/:id/stage ────────────────────────────────────
    const stageMatch = path.match(/^\/opportunities\/([^/]+)\/stage$/);
    if (stageMatch && method === 'PATCH') {
      const id = stageMatch[1];
      let input: z.infer<typeof stageUpdateSchema>;
      try {
        input = await validateBody(stageUpdateSchema, req);
      } catch (err) {
        if (err instanceof ValidationError) {
          return errorResponse(400, 'Invalid input', req, {
            code: 'VALIDATION_ERROR',
            details: err.issues,
            requestId,
          });
        }
        throw err;
      }

      const noteSuffix = input.notes
        ? `\n[${new Date().toISOString()}] Stage moved to ${input.stage}: ${input.notes}`
        : '';

      // Fetch existing notes so we can append
      const existing = await db
        .from('business_records')
        .select('notes')
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .limit(1)
        .maybeSingle();

      if (existing.error || !existing.data) {
        return errorResponse(404, 'Opportunity not found', req, {
          code: 'NOT_FOUND',
          requestId,
        });
      }

      const newNotes = (existing.data.notes ? String(existing.data.notes) : '') + noteSuffix;

      const now = new Date().toISOString();
      const updated = await db
        .from('business_records')
        .update({
          status: input.stage,
          notes: newNotes,
          updated_at: now,
          last_contact_date: now,
        })
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .select()
        .maybeSingle();

      if (updated.error || !updated.data) {
        return errorResponse(500, 'Failed to update opportunity stage', req, {
          code: 'DB_ERROR',
          details: updated.error,
          requestId,
        });
      }

      const stageLabel = PIPELINE_STAGES.find((s) => s.id === input.stage)?.name ?? input.stage;

      // Best-effort activity log — failure is non-fatal
      const activityInsert = await db.from('business_record_activities').insert({
        business_record_id: id,
        tenant_id: ctx.tenantId,
        activity_type: 'stage_change',
        subject: `Stage changed to ${stageLabel}`,
        description: input.notes || `Moved to ${input.stage} stage`,
        created_by: ctx.userId,
      });
      if (activityInsert.error) {
        log.warn({ requestId, err: activityInsert.error }, 'Failed to log stage-change activity');
      }

      return jsonResponse({ success: true, opportunity: updated.data }, 200, req, requestId);
    }

    // ─── POST /opportunities/:id/activity ──────────────────────────────────
    const activityMatch = path.match(/^\/opportunities\/([^/]+)\/activity$/);
    if (activityMatch && method === 'POST') {
      const id = activityMatch[1];
      let input: z.infer<typeof activitySchema>;
      try {
        input = await validateBody(activitySchema, req);
      } catch (err) {
        if (err instanceof ValidationError) {
          return errorResponse(400, 'Invalid input', req, {
            code: 'VALIDATION_ERROR',
            details: err.issues,
            requestId,
          });
        }
        throw err;
      }

      const activityTitle =
        input.activity_type.charAt(0).toUpperCase() + input.activity_type.slice(1) + ' Activity';

      const insertResult = await db.from('business_record_activities').insert({
        business_record_id: id,
        tenant_id: ctx.tenantId,
        activity_type: input.activity_type,
        subject: activityTitle,
        description: input.notes,
        created_by: ctx.userId,
      });

      if (insertResult.error) {
        return errorResponse(500, 'Failed to log activity', req, {
          code: 'DB_ERROR',
          details: insertResult.error,
          requestId,
        });
      }

      const now = new Date().toISOString();
      await db
        .from('business_records')
        .update({ last_contact_date: now, updated_at: now })
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId);

      return jsonResponse({ success: true }, 200, req, requestId);
    }

    // ─── GET /rep-metrics ──────────────────────────────────────────────────
    if (path === '/rep-metrics' && method === 'GET') {
      const { data, error } = await db.rpc('sales_pipeline_rep_metrics', {
        p_tenant_id: ctx.tenantId,
      });
      if (error) {
        return errorResponse(500, 'Failed to fetch rep metrics', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    // ─── GET /summary ──────────────────────────────────────────────────────
    if (path === '/summary' && method === 'GET') {
      const { data, error } = await db.rpc('sales_pipeline_summary', {
        p_tenant_id: ctx.tenantId,
      });
      if (error) {
        return errorResponse(500, 'Failed to fetch pipeline summary', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data ?? {}, 200, req, requestId);
    }

    return errorResponse(404, 'Not found', req, {
      code: 'NOT_FOUND',
      details: { path, method },
      requestId,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, {
      code: 'INTERNAL',
      requestId,
    });
  } finally {
    log.info({ requestId, path, method, durationMs: Date.now() - startedAt }, 'request_complete');
  }
});
