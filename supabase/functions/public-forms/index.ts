// Public Web Forms Edge Function (CRMX-011)
//
// Serves the UNAUTHENTICATED lead-capture surface the embedded/hosted forms hit
// at /api/public/forms/*. Like public-calculator (EDGE-005f), this performs NO
// JWT verification — a form is resolved by its opaque public_token, and the
// service-role client writes the raw capture. All heavy lifting (dedup, lead
// creation, scoring, routing, form.submitted workflow) is done later by the Node
// processor server/services/web-form-processor.ts, so this handler stays thin.
//
// Routes (token = web_forms.public_token):
//   GET  /forms/:token           → public form definition (for rendering)
//   POST /forms/:token/submit    → capture a submission (honeypot + rate-limit)
//
// Routing: production server.ts aliases `public` + subPath[0]==='forms' → this
// dir; dev proxies /api/public/forms/* here. The handler locates the `forms`
// segment itself, so it is robust to either prefix.

import { createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

// Honeypot field name — a hidden input real users never fill; bots do.
const HONEYPOT_FIELD = '_hp';
// Per-IP, per-form submissions allowed within the window.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function clientMeta(req: Request): { userAgent: string | null; ipAddress: string | null } {
  const fwd = req.headers.get('x-forwarded-for');
  return {
    userAgent: req.headers.get('user-agent'),
    ipAddress: fwd ? fwd.split(',')[0].trim() : req.headers.get('x-real-ip'),
  };
}

// Locate the token (and optional trailing action) after the `forms` segment.
function parsePath(pathname: string): { token: string | null; action: string | null } {
  const parts = pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('forms');
  if (idx === -1) return { token: null, action: null };
  return { token: parts[idx + 1] ?? null, action: parts[idx + 2] ?? null };
}

// deno-lint-ignore no-explicit-any
function publicFieldView(fields: any[]): any[] {
  // Only expose what the renderer needs — never the internal mapTo/lead mapping.
  return (Array.isArray(fields) ? fields : [])
    .slice()
    .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
    .map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: !!f.required,
      placeholder: f.placeholder ?? null,
      options: f.options ?? null,
    }));
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const { token, action } = parsePath(url.pathname);
    if (!token) {
      return createCorsResponse({ error: 'Form token required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();

    // Resolve the form by its public token.
    const { data: form, error: formError } = await admin
      .from('web_forms')
      .select('id, tenant_id, name, description, fields, settings, status, is_active')
      .eq('public_token', token)
      .maybeSingle();

    if (formError || !form) {
      return createCorsResponse({ error: 'Form not found' }, 404, req);
    }

    // ─── GET /forms/:token — public definition ──────────────────────────────
    if (req.method === 'GET' && !action) {
      if (form.status !== 'published' || !form.is_active) {
        return createCorsResponse({ error: 'Form is not available' }, 404, req);
      }
      const settings = (form.settings ?? {}) as Record<string, unknown>;
      return createCorsResponse(
        {
          id: form.id,
          name: form.name,
          description: form.description,
          fields: publicFieldView(form.fields ?? []),
          submitButtonText: settings.submitButtonText ?? 'Submit',
          successMessage: settings.successMessage ?? 'Thanks! We received your submission.',
          honeypotField: HONEYPOT_FIELD,
        },
        200,
        req,
      );
    }

    // ─── POST /forms/:token/submit — capture ────────────────────────────────
    if (req.method === 'POST' && action === 'submit') {
      if (form.status !== 'published' || !form.is_active) {
        return createCorsResponse({ error: 'Form is not accepting submissions' }, 404, req);
      }

      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

      // Honeypot: silently accept (200) so bots don't learn they were caught,
      // but record nothing.
      const honeypot = body[HONEYPOT_FIELD];
      if (typeof honeypot === 'string' && honeypot.trim() !== '') {
        return createCorsResponse({ success: true }, 200, req);
      }

      const { userAgent, ipAddress } = clientMeta(req);

      // Per-IP rate limit for this form.
      if (ipAddress) {
        const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
        const { count } = await admin
          .from('web_form_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('form_id', form.id)
          .eq('ip_address', ipAddress)
          .gte('created_at', since);
        if ((count ?? 0) >= RATE_LIMIT) {
          return createCorsResponse({ error: 'Too many submissions, try again later' }, 429, req);
        }
      }

      // Required-field validation against the form definition.
      // deno-lint-ignore no-explicit-any
      const fields: any[] = Array.isArray(form.fields) ? form.fields : [];
      const missing = fields
        .filter((f) => f?.required)
        .filter((f) => {
          const v = body[f.key];
          return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
        })
        .map((f) => f.key);
      if (missing.length > 0) {
        return createCorsResponse({ error: 'Missing required fields', fields: missing }, 400, req);
      }

      // Split out control keys; collect UTM from body._utm or query string.
      const utmFromQuery: Record<string, string> = {};
      for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
        const v = url.searchParams.get(k);
        if (v) utmFromQuery[k] = v;
      }
      const utm =
        (body._utm as Record<string, string> | undefined) ??
        (Object.keys(utmFromQuery).length ? utmFromQuery : undefined);

      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) {
        if (k === HONEYPOT_FIELD || k === '_utm') continue;
        payload[k] = v;
      }

      const { error: insertError } = await admin.from('web_form_submissions').insert({
        tenant_id: form.tenant_id,
        form_id: form.id,
        payload,
        utm: utm ?? null,
        referrer: req.headers.get('referer'),
        ip_address: ipAddress,
        user_agent: userAgent,
        status: 'new',
      });
      if (insertError) {
        return createCorsResponse({ error: 'Failed to record submission' }, 500, req);
      }

      const settings = (form.settings ?? {}) as Record<string, unknown>;
      return createCorsResponse(
        {
          success: true,
          message: settings.successMessage ?? 'Thanks! We received your submission.',
          redirectUrl: settings.redirectUrl ?? null,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('Error in public-forms function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
