// Email templates — CRUD.
//
// Paths (dispatcher already stripped /email-marketing/email-templates):
//   GET    /                    (?templateType, ?isActive, ?category filters)
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   DELETE /:id

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleTemplates(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const id = pathParts[0];

  if (method === 'GET' && !id) {
    let q = db.from('email_templates').select('*').eq('tenant_id', auth.tenantId);
    const templateType = url.searchParams.get('templateType');
    const isActive = url.searchParams.get('isActive');
    const category = url.searchParams.get('category');
    if (templateType) q = q.eq('template_type', templateType);
    if (isActive !== null) q = q.eq('is_active', isActive === 'true');
    if (category) q = q.eq('category', category);
    q = q.order('updated_at', { ascending: false });
    const { data, error } = await q;
    if (error) return dbError(req, requestId, 'Failed to fetch templates', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id) {
    const { data, error } = await db
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to fetch template', error);
    if (!data)
      return errorResponse(404, 'Template not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapTemplate(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (!row.template_name || !row.template_type || !row.subject || !row.html_content) {
      return errorResponse(
        400,
        'template_name, template_type, subject, html_content required',
        req,
        {
          code: 'VALIDATION_ERROR',
          requestId,
        },
      );
    }
    const { data, error } = await db.from('email_templates').insert(row).select().maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to create template', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapTemplate(body);
    row.last_modified_by = auth.userId;
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('email_templates')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to update template', error);
    if (!data)
      return errorResponse(404, 'Template not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && id) {
    const { error } = await db
      .from('email_templates')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbError(req, requestId, 'Failed to delete template', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

function mapTemplate(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  if (src('templateName', 'template_name') !== undefined)
    r.template_name = src('templateName', 'template_name');
  if (src('templateDescription', 'template_description') !== undefined)
    r.template_description = src('templateDescription', 'template_description');
  if (src('templateType', 'template_type') !== undefined)
    r.template_type = src('templateType', 'template_type');
  if (body.subject !== undefined) r.subject = body.subject;
  if (src('preheaderText', 'preheader_text') !== undefined)
    r.preheader_text = src('preheaderText', 'preheader_text');
  if (src('htmlContent', 'html_content') !== undefined)
    r.html_content = src('htmlContent', 'html_content');
  if (src('textContent', 'text_content') !== undefined)
    r.text_content = src('textContent', 'text_content');
  if (src('designJson', 'design_json') !== undefined)
    r.design_json = src('designJson', 'design_json');
  if (src('variableFields', 'variable_fields') !== undefined)
    r.variable_fields = src('variableFields', 'variable_fields');
  if (body.category !== undefined) r.category = body.category;
  if (body.tags !== undefined) r.tags = body.tags;
  if (body.version !== undefined) r.version = body.version;
  if (src('isActive', 'is_active') !== undefined) r.is_active = src('isActive', 'is_active');
  return r;
}

function dbError(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
