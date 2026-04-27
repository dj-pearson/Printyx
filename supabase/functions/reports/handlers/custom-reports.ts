// Custom user-defined reports — /reports/custom/*.
//
// Replaces server/routes-custom-reports.ts. The Express version had
// 7 endpoints; we port the surface that the frontend's CustomReportBuilder
// actually calls (list / create / preview) plus the get-by-id / update /
// delete CRUD that's expected by the same page even if not currently wired
// up.
//
// Schema reality:
//   - report_definitions table has the columns we expect (validated against
//     shared/reporting-schema.ts)
//   - The execute path is intentionally limited to plain SELECT with
//     equality filters and an optional limit — no aggregation, no GROUP BY.
//     PostgREST can't do dynamic SQL safely (see SESSION-STATUS-2026-04-26.md
//     reporting-engine note). Aggregation paths are flagged with
//     `degraded.aggregationsUnsupported: true`.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

interface CustomReportConfig {
  name: string;
  description?: string;
  category?: string;
  dataSource: string;
  columns: Array<{
    id?: string;
    columnId: string;
    columnName?: string;
    aggregation?: string;
    alias?: string;
  }>;
  filters?: Array<{
    columnId: string;
    operator: string;
    value: string | number | boolean;
    value2?: string | number;
  }>;
  groupings?: Array<{ columnId: string; columnName?: string }>;
  visualization?: string;
  chartConfig?: Record<string, unknown>;
  isPublic?: boolean;
  cacheDuration?: number;
}

const DATA_SOURCE_TABLES: Record<string, string> = {
  business_records: 'business_records',
  opportunities: 'opportunities',
  equipment: 'equipment',
  contacts: 'business_records', // contacts share business_records
  invoices: 'invoices',
};

const SOURCE_COLUMN_MAPPINGS: Record<string, Record<string, { dbColumn: string; type: string }>> = {
  business_records: {
    companyName: { dbColumn: 'company_name', type: 'string' },
    recordType: { dbColumn: 'record_type', type: 'string' },
    status: { dbColumn: 'status', type: 'string' },
    industry: { dbColumn: 'industry', type: 'string' },
    city: { dbColumn: 'city', type: 'string' },
    state: { dbColumn: 'state', type: 'string' },
    leadSource: { dbColumn: 'lead_source', type: 'string' },
    annualRevenue: { dbColumn: 'annual_revenue', type: 'currency' },
    employeeCount: { dbColumn: 'employee_count', type: 'number' },
    createdAt: { dbColumn: 'created_at', type: 'date' },
    updatedAt: { dbColumn: 'updated_at', type: 'date' },
  },
  opportunities: {
    name: { dbColumn: 'name', type: 'string' },
    stage: { dbColumn: 'stage_name', type: 'string' },
    amount: { dbColumn: 'amount', type: 'currency' },
    probability: { dbColumn: 'probability', type: 'number' },
    expectedCloseDate: { dbColumn: 'expected_close_date', type: 'date' },
    createdAt: { dbColumn: 'created_at', type: 'date' },
    closedAt: { dbColumn: 'close_date', type: 'date' },
    assignedTo: { dbColumn: 'owner_id', type: 'string' },
  },
  equipment: {
    serialNumber: { dbColumn: 'serial_number', type: 'string' },
    model: { dbColumn: 'model', type: 'string' },
    manufacturer: { dbColumn: 'manufacturer', type: 'string' },
    status: { dbColumn: 'status', type: 'string' },
    location: { dbColumn: 'location', type: 'string' },
    installDate: { dbColumn: 'install_date', type: 'date' },
    lastServiceDate: { dbColumn: 'last_service_date', type: 'date' },
    meterReading: { dbColumn: 'meter_reading', type: 'number' },
    contractEndDate: { dbColumn: 'contract_end_date', type: 'date' },
  },
  contacts: {
    firstName: { dbColumn: 'first_name', type: 'string' },
    lastName: { dbColumn: 'last_name', type: 'string' },
    email: { dbColumn: 'email', type: 'string' },
    phone: { dbColumn: 'phone', type: 'string' },
    title: { dbColumn: 'title', type: 'string' },
    department: { dbColumn: 'department', type: 'string' },
    isPrimary: { dbColumn: 'is_primary', type: 'boolean' },
    createdAt: { dbColumn: 'created_at', type: 'date' },
  },
  invoices: {
    invoiceNumber: { dbColumn: 'invoice_number', type: 'string' },
    status: { dbColumn: 'invoice_status', type: 'string' },
    amount: { dbColumn: 'total_amount', type: 'currency' },
    balance: { dbColumn: 'balance_due', type: 'currency' },
    invoiceDate: { dbColumn: 'invoice_date', type: 'date' },
    dueDate: { dbColumn: 'due_date', type: 'date' },
    paidDate: { dbColumn: 'paid_date', type: 'date' },
  },
};

export function isCustomReportPath(pathParts: string[]): boolean {
  return pathParts[0] === 'custom';
}

export async function handleCustomReports(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts } = ctx;
  if (pathParts[0] !== 'custom') return null;

  const sub = pathParts[1];

  // GET /reports/custom — list
  if (method === 'GET' && !sub) return await listReports(req, ctx);

  // POST /reports/custom/preview
  if (method === 'POST' && sub === 'preview') return await previewReport(req, ctx);

  // POST /reports/custom — create
  if (method === 'POST' && !sub) return await createReport(req, ctx);

  // GET /reports/custom/:identifier
  if (method === 'GET' && sub) return await getReport(req, ctx, sub);

  // PUT /reports/custom/:id
  if (method === 'PUT' && sub) return await updateReport(req, ctx, sub);

  // DELETE /reports/custom/:id
  if (method === 'DELETE' && sub) return await deleteReport(req, ctx, sub);

  // POST /reports/custom/:identifier/execute
  if (method === 'POST' && sub && pathParts[2] === 'execute') {
    return await executeReport(req, ctx, sub);
  }

  return null;
}

// ─── list ──────────────────────────────────────────────────────────────────

async function listReports(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  try {
    // Two queries (own + public) merged in JS — PostgREST's .or(...) doesn't
    // play nicely with jsonb @> array containment as an OR-side condition,
    // and a single query that combines them risks silent server errors.
    const [ownRes, publicRes] = await Promise.all([
      db
        .from('report_definitions')
        .select(
          'id, name, code, description, category, default_visualization, is_active, created_by, created_at, updated_at',
        )
        .eq('tenant_id', auth.tenantId)
        .eq('created_by', auth.userId)
        .order('updated_at', { ascending: false }),
      db
        .from('report_definitions')
        .select(
          'id, name, code, description, category, default_visualization, is_active, created_by, created_at, updated_at',
        )
        .eq('tenant_id', auth.tenantId)
        .neq('created_by', auth.userId)
        .contains('required_permissions', ['reports.custom.view_public'])
        .order('updated_at', { ascending: false }),
    ]);

    if (ownRes.error) throw ownRes.error;
    if (publicRes.error) throw publicRes.error;
    const merged = [...(ownRes.data ?? []), ...(publicRes.data ?? [])];
    return jsonResponse(merged, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch custom reports', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── preview ───────────────────────────────────────────────────────────────

async function previewReport(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  let body: CustomReportConfig;
  try {
    body = (await req.json()) as CustomReportConfig;
  } catch {
    return errorResponse(400, 'Invalid JSON body', req, {
      code: 'BAD_REQUEST',
      requestId,
    });
  }

  const {
    dataSource,
    columns,
    filters = [],
    groupings = [],
    limit,
  } = body as CustomReportConfig & {
    limit?: number;
  };
  if (!dataSource || !columns || columns.length === 0) {
    return errorResponse(400, 'Data source and columns are required', req, {
      code: 'BAD_REQUEST',
      requestId,
    });
  }
  const table = DATA_SOURCE_TABLES[dataSource];
  const columnMappings = SOURCE_COLUMN_MAPPINGS[dataSource];
  if (!table || !columnMappings) {
    return errorResponse(400, `Unsupported data source: ${dataSource}`, req, {
      code: 'BAD_REQUEST',
      requestId,
    });
  }

  const validColumns = columns.filter((c) => columnMappings[c.columnId]);
  const selectClause = validColumns.map((c) => columnMappings[c.columnId].dbColumn).join(', ');

  // deno-lint-ignore no-explicit-any
  let q: any = db.from(table).select(selectClause).eq('tenant_id', auth.tenantId);
  // contacts use the same table as business_records but are filtered by record_type
  if (dataSource === 'contacts') q = q.eq('record_type', 'contact');

  for (const f of filters) {
    const mapping = columnMappings[f.columnId];
    if (!mapping) continue;
    q = applyFilter(q, mapping.dbColumn, mapping.type, f);
  }

  q = q.limit(Math.min(limit ?? 100, 1000));

  try {
    const { data, error } = await q;
    if (error) throw error;
    return jsonResponse(
      {
        data: data ?? [],
        rowCount: (data ?? []).length,
        columns: validColumns.map((c) => ({
          id: c.columnId,
          name: c.alias || c.columnName || c.columnId,
          type: columnMappings[c.columnId]?.type,
        })),
        degraded:
          groupings.length > 0 || validColumns.some((c) => c.aggregation)
            ? { aggregationsUnsupported: true }
            : undefined,
      },
      200,
      req,
      requestId,
    );
  } catch (err) {
    return errorResponse(500, 'Failed to execute preview', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── create ────────────────────────────────────────────────────────────────

async function createReport(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  let config: CustomReportConfig;
  try {
    config = (await req.json()) as CustomReportConfig;
  } catch {
    return errorResponse(400, 'Invalid JSON body', req, {
      code: 'BAD_REQUEST',
      requestId,
    });
  }

  if (!config.name || !config.dataSource || !config.columns || config.columns.length === 0) {
    return errorResponse(400, 'Name, data source, and columns are required', req, {
      code: 'BAD_REQUEST',
      requestId,
    });
  }

  const code = `custom_${config.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
  const requiredPermissions = config.isPublic
    ? ['reports.custom.view_public']
    : ['reports.custom.view_own'];

  try {
    const { data, error } = await db
      .from('report_definitions')
      .insert({
        tenant_id: auth.tenantId,
        name: config.name,
        code,
        description: config.description ?? '',
        category: config.category ?? 'custom',
        // Stored as the JSON config — execute path reads default_parameters
        // and rebuilds the query rather than running raw SQL.
        sql_query: '',
        default_parameters: {
          dataSource: config.dataSource,
          columns: config.columns,
          filters: config.filters ?? [],
          groupings: config.groupings ?? [],
        },
        available_filters: (config.filters ?? []).reduce<Record<string, unknown>>((acc, f) => {
          acc[f.columnId] = { type: 'string', label: f.columnId };
          return acc;
        }, {}),
        available_groupings: (config.groupings ?? []).reduce<Record<string, unknown>>((acc, g) => {
          acc[g.columnId] = g.columnName ?? g.columnId;
          return acc;
        }, {}),
        required_permissions: requiredPermissions,
        organizational_scope: 'company',
        default_visualization: config.visualization ?? 'table',
        chart_config: config.chartConfig ?? {},
        cache_duration: config.cacheDuration ?? 300,
        supports_export: true,
        is_active: true,
        created_by: auth.userId,
      })
      .select('id, code, name')
      .single();

    if (error) throw error;
    return jsonResponse(
      {
        id: data!.id,
        code: data!.code,
        name: data!.name,
        message: 'Custom report created successfully',
      },
      201,
      req,
      requestId,
    );
  } catch (err) {
    return errorResponse(500, 'Failed to create custom report', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── get one ───────────────────────────────────────────────────────────────

async function getReport(req: Request, ctx: HandlerCtx, identifier: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  try {
    // Look up by id-or-code, then check visibility (own or public) in JS.
    const { data: report, error } = await db
      .from('report_definitions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .or(`id.eq.${identifier},code.eq.${identifier}`)
      .maybeSingle();

    if (error) throw error;
    if (!report) {
      return errorResponse(404, 'Report not found', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }

    const ownIt = report.created_by === auth.userId;
    const isPublic = Array.isArray(report.required_permissions)
      ? (report.required_permissions as string[]).includes('reports.custom.view_public')
      : false;
    if (!ownIt && !isPublic) {
      return errorResponse(404, 'Report not found', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }
    return jsonResponse(report, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch custom report', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── update ────────────────────────────────────────────────────────────────

async function updateReport(req: Request, ctx: HandlerCtx, reportId: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  let config: Partial<CustomReportConfig>;
  try {
    config = (await req.json()) as Partial<CustomReportConfig>;
  } catch {
    return errorResponse(400, 'Invalid JSON body', req, {
      code: 'BAD_REQUEST',
      requestId,
    });
  }

  // Verify ownership.
  try {
    const { data: existing } = await db
      .from('report_definitions')
      .select('id')
      .eq('id', reportId)
      .eq('tenant_id', auth.tenantId)
      .eq('created_by', auth.userId)
      .maybeSingle();
    if (!existing) {
      return errorResponse(404, 'Report not found or access denied', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (config.name) updates.name = config.name;
    if (config.description !== undefined) updates.description = config.description;
    if (config.category) updates.category = config.category;
    if (config.visualization) updates.default_visualization = config.visualization;
    if (config.chartConfig) updates.chart_config = config.chartConfig;
    if (config.cacheDuration !== undefined) updates.cache_duration = config.cacheDuration;
    if (config.columns && config.dataSource) {
      updates.default_parameters = {
        dataSource: config.dataSource,
        columns: config.columns,
        filters: config.filters ?? [],
        groupings: config.groupings ?? [],
      };
    }
    if (config.isPublic !== undefined) {
      updates.required_permissions = config.isPublic
        ? ['reports.custom.view_public']
        : ['reports.custom.view_own'];
    }

    const { data, error } = await db
      .from('report_definitions')
      .update(updates)
      .eq('id', reportId)
      .select('id, code')
      .single();
    if (error) throw error;

    return jsonResponse(
      { id: data!.id, code: data!.code, message: 'Report updated successfully' },
      200,
      req,
      requestId,
    );
  } catch (err) {
    return errorResponse(500, 'Failed to update custom report', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── delete ────────────────────────────────────────────────────────────────

async function deleteReport(req: Request, ctx: HandlerCtx, reportId: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  try {
    const { data, error } = await db
      .from('report_definitions')
      .delete()
      .eq('id', reportId)
      .eq('tenant_id', auth.tenantId)
      .eq('created_by', auth.userId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return errorResponse(404, 'Report not found or access denied', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }
    return jsonResponse({ message: 'Report deleted successfully' }, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to delete custom report', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── execute ───────────────────────────────────────────────────────────────

async function executeReport(req: Request, ctx: HandlerCtx, identifier: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  let body: { filters?: Record<string, unknown>; limit?: number; offset?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const startedAt = Date.now();
  try {
    const { data: report, error: defErr } = await db
      .from('report_definitions')
      .select('id, code, default_parameters')
      .eq('tenant_id', auth.tenantId)
      .or(`id.eq.${identifier},code.eq.${identifier}`)
      .maybeSingle();

    if (defErr) throw defErr;
    if (!report) {
      return errorResponse(404, 'Report not found', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }

    const cfg = report.default_parameters as {
      dataSource?: string;
      columns?: CustomReportConfig['columns'];
      filters?: CustomReportConfig['filters'];
      groupings?: CustomReportConfig['groupings'];
    } | null;
    const dataSource = cfg?.dataSource;
    const columns = cfg?.columns ?? [];
    const storedFilters = cfg?.filters ?? [];
    const groupings = cfg?.groupings ?? [];

    if (!dataSource) {
      return errorResponse(400, 'Report configuration is invalid', req, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    const table = DATA_SOURCE_TABLES[dataSource];
    const columnMappings = SOURCE_COLUMN_MAPPINGS[dataSource];
    if (!table || !columnMappings) {
      return errorResponse(400, `Unsupported data source: ${dataSource}`, req, {
        code: 'BAD_REQUEST',
        requestId,
      });
    }

    const validColumns = columns.filter((c) => columnMappings[c.columnId]);
    const selectClause = validColumns.map((c) => columnMappings[c.columnId].dbColumn).join(', ');

    // deno-lint-ignore no-explicit-any
    let q: any = db.from(table).select(selectClause).eq('tenant_id', auth.tenantId);
    if (dataSource === 'contacts') q = q.eq('record_type', 'contact');

    for (const f of storedFilters) {
      const mapping = columnMappings[f.columnId];
      if (!mapping) continue;
      q = applyFilter(q, mapping.dbColumn, mapping.type, f);
    }
    for (const [k, v] of Object.entries(body.filters ?? {})) {
      if (v === undefined || v === null || v === '') continue;
      const mapping = columnMappings[k];
      if (!mapping) continue;
      q = q.eq(mapping.dbColumn, v);
    }

    q = q.range(body.offset ?? 0, (body.offset ?? 0) + Math.min(body.limit ?? 1000, 1000) - 1);

    const { data, error } = await q;
    if (error) throw error;

    // Audit row — never block the response on this insert.
    const startedAtIso = new Date(startedAt).toISOString();
    const completedAtIso = new Date().toISOString();
    db.from('report_executions')
      .insert({
        tenant_id: auth.tenantId,
        report_definition_id: report.id,
        user_id: auth.userId,
        status: 'completed',
        row_count: (data ?? []).length,
        execution_time_ms: Date.now() - startedAt,
        started_at: startedAtIso,
        completed_at: completedAtIso,
      })
      .then(
        () => {},
        () => {},
      );

    return jsonResponse(
      {
        data: data ?? [],
        rowCount: (data ?? []).length,
        columns: validColumns.map((c) => ({
          id: c.columnId,
          name: c.alias || c.columnName || c.columnId,
          type: columnMappings[c.columnId]?.type,
        })),
        degraded:
          groupings.length > 0 || validColumns.some((c) => c.aggregation)
            ? { aggregationsUnsupported: true }
            : undefined,
      },
      200,
      req,
      requestId,
    );
  } catch (err) {
    return errorResponse(500, 'Failed to execute report', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── filter helper ─────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
function applyFilter(
  q: any,
  col: string,
  type: string,
  f: NonNullable<CustomReportConfig['filters']>[number],
): any {
  const v = f.value;
  switch (f.operator) {
    case 'eq':
    case 'equals':
      return q.eq(col, v);
    case 'ne':
    case 'not_equals':
      return q.neq(col, v);
    case 'gt':
    case 'greater_than':
      return q.gt(col, v);
    case 'gte':
      return q.gte(col, v);
    case 'lt':
    case 'less_than':
      return q.lt(col, v);
    case 'lte':
      return q.lte(col, v);
    case 'contains':
    case 'like':
      return q.ilike(col, `%${v}%`);
    case 'starts_with':
      return q.ilike(col, `${v}%`);
    case 'ends_with':
      return q.ilike(col, `%${v}`);
    case 'is_null':
      return q.is(col, null);
    case 'not_null':
      return q.not(col, 'is', null);
    case 'between':
      if (f.value2 !== undefined) return q.gte(col, v).lte(col, f.value2);
      return q;
    default:
      // Fallback to eq if operator is unknown — preserves Express behavior of
      // silently dropping invalid filter entries.
      return q.eq(col, v);
  }
}
