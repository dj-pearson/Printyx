// Compact generic CRUD helper — used across field-service handlers where
// endpoints are simple list/get/post/patch/delete with no special logic.
//
// Usage:
//   return crud(req, ctx, {
//     table: 'installations',
//     idColumn: 'id',
//     defaultOrder: { column: 'created_at', ascending: false },
//     filters: { status: (url) => url.searchParams.get('status') },
//   });

import { errorResponse, jsonResponse } from '../_shared/http.ts';
import type { HandlerCtx } from './_context.ts';

export interface CrudOpts {
  table: string;
  idColumn?: string;
  // Columns to pull on SELECT; defaults to '*'
  selectColumns?: string;
  defaultOrder?: { column: string; ascending?: boolean };
  listLimit?: number;
  // Map body → row. Used to strip unknown keys.
  mapRow: (body: Record<string, unknown>) => Record<string, unknown>;
  // Validate required fields on create
  requiredOnCreate?: string[];
  // Auto-populated on create
  stamps?: { tenantId?: boolean; createdBy?: string /* column */ };
  // Auto-populated on update
  updateStamps?: { updatedBy?: string /* column */; updatedAt?: boolean };
  // Query-string filters: name → how to read + which column
  queryFilters?: Array<{ param: string; column: string; type?: 'string' | 'bool' | 'int' }>;
}

export async function crud(
  req: Request,
  ctx: HandlerCtx,
  opts: CrudOpts,
): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const id = pathParts[0];
  const idCol = opts.idColumn ?? 'id';

  if (method === 'GET' && !id) {
    let q = db
      .from(opts.table)
      .select(opts.selectColumns ?? '*')
      .eq('tenant_id', auth.tenantId);
    for (const f of opts.queryFilters ?? []) {
      const raw = url.searchParams.get(f.param);
      if (raw === null) continue;
      let v: unknown = raw;
      if (f.type === 'bool') v = raw === 'true';
      else if (f.type === 'int') v = parseInt(raw, 10);
      q = q.eq(f.column, v);
    }
    if (opts.defaultOrder) {
      q = q.order(opts.defaultOrder.column, { ascending: opts.defaultOrder.ascending ?? false });
    }
    q = q.limit(opts.listLimit ?? 500);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, `Failed to list ${opts.table}`, error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id) {
    const { data, error } = await db
      .from(opts.table)
      .select(opts.selectColumns ?? '*')
      .eq(idCol, id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, `Failed to fetch ${opts.table}`, error);
    if (!data) return errorResponse(404, 'Not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = opts.mapRow(body);
    if (opts.stamps?.tenantId !== false) row.tenant_id = auth.tenantId;
    if (opts.stamps?.createdBy) row[opts.stamps.createdBy] = auth.userId;
    for (const req_field of opts.requiredOnCreate ?? []) {
      if (row[req_field] === undefined) {
        return errorResponse(400, `${req_field} is required`, req, {
          code: 'VALIDATION_ERROR',
          requestId,
        });
      }
    }
    const { data, error } = await db.from(opts.table).insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, `Failed to create ${opts.table}`, error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = opts.mapRow(body);
    if (opts.updateStamps?.updatedAt !== false) row.updated_at = new Date().toISOString();
    if (opts.updateStamps?.updatedBy) row[opts.updateStamps.updatedBy] = auth.userId;
    const { data, error } = await db
      .from(opts.table)
      .update(row)
      .eq(idCol, id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, `Failed to update ${opts.table}`, error);
    if (!data) return errorResponse(404, 'Not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && id) {
    const { error } = await db
      .from(opts.table)
      .delete()
      .eq(idCol, id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, `Failed to delete ${opts.table}`, error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

export function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
