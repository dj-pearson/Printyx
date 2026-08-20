// White Label Edge Function (PROD-014)
//
// Production counterpart to server/routes-white-label.ts. That domain had no
// edge function, so every /api/white-label/* call 404'd in production while
// working in dev — WhiteLabelDashboard.tsx could not load or save branding.
//
// Two shape rules drive this file:
//   1. The tables are white_label_config / white_label_email_templates /
//      white_label_presets (migration 0000). PostgREST returns snake_case, but
//      WhiteLabelDashboard.tsx reads camelCase (companyName, colorPrimary,
//      customDomainVerified, ...), so rows are converted on the way out and
//      request bodies are mapped to real columns on the way in. An unmapped key
//      would make PostgREST throw PGRST204.
//   2. The tenant comes from the verified JWT, never from a query param or
//      header. The Express handlers read x-tenant-id directly; that is only safe
//      there because resolveTenant rejects a mismatched header first.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse, getCorsHeaders } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  defaultEmailTemplates,
  generateCssVariables,
  renderEmailTemplate,
} from '../_shared/white-label.ts';

type Row = Record<string, any>;

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function camelRow(row: Row | null | undefined): Row | null {
  if (!row) return null;
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}

const camelRows = (rows: Row[] | null | undefined): Row[] => (rows || []).map((r) => camelRow(r)!);

// Writable columns, per the migration 0000 DDL. tenant_id, id and the timestamps
// are server-owned and deliberately absent.
const CONFIG_COLUMNS = new Set([
  'company_name',
  'company_tagline',
  'logo_url',
  'logo_square_url',
  'favicon_url',
  'custom_domain',
  'custom_domain_verified',
  'custom_domain_verified_at',
  'color_primary',
  'color_secondary',
  'color_accent',
  'color_success',
  'color_warning',
  'color_error',
  'color_background',
  'color_text',
  'font_family',
  'font_heading_family',
  'welcome_title',
  'welcome_message',
  'welcome_banner_url',
  'support_email',
  'support_phone',
  'support_hours_text',
  'terms_of_service_url',
  'privacy_policy_url',
  'custom_terms_of_service',
  'custom_privacy_policy',
  'features',
  'custom_css',
  'custom_js',
  'analytics_code',
  'social_links',
  'mobile_app_name',
  'mobile_app_icon_url',
  'mobile_app_splash_screen_url',
  'is_active',
]);

const TEMPLATE_COLUMNS = new Set([
  'template_key',
  'template_name',
  'description',
  'from_name',
  'from_email',
  'reply_to_email',
  'subject',
  'html_body',
  'text_body',
  'available_variables',
  'include_header',
  'include_footer',
  'custom_header',
  'custom_footer',
  'is_active',
  'is_default',
]);

/** Accepts camelCase or snake_case input; drops anything not a real column. */
function toColumns(body: Row, allowed: Set<string>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(body || {})) {
    const column = allowed.has(k) ? k : toSnake(k);
    if (allowed.has(column)) out[column] = v;
  }
  return out;
}

// Fields the customer portal may see for an unauthenticated domain lookup.
// Mirrors the Express handler's explicit allowlist — custom_js, analytics_code
// and the legal-document overrides are deliberately excluded.
const PUBLIC_DOMAIN_FIELDS = [
  'company_name',
  'company_tagline',
  'logo_url',
  'logo_square_url',
  'favicon_url',
  'color_primary',
  'color_secondary',
  'color_accent',
  'color_success',
  'color_warning',
  'color_error',
  'color_background',
  'color_text',
  'font_family',
  'font_heading_family',
  'welcome_title',
  'welcome_message',
  'welcome_banner_url',
  'support_email',
  'support_phone',
  'support_hours_text',
  'social_links',
  'features',
];

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const { parts } = normalizePath(url.pathname, 'white-label');
  const resource = parts[0];

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const user = userData.user;
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      null;

    const admin = createSupabaseServiceClient();

    const loadConfig = async (): Promise<Row | null> => {
      const { data } = await admin
        .from('white_label_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return (data as Row) || null;
    };

    const requireTenant = () =>
      tenantId ? null : createCorsResponse({ error: 'Tenant ID required' }, 400, req);

    // ─── /presets ───────────────────────────────────────────────────
    // Presets are global (no tenant_id column), so this is the one read that
    // does not need a tenant.
    if (resource === 'presets' && req.method === 'GET') {
      const { data, error } = await admin
        .from('white_label_presets')
        .select('*')
        .eq('is_public', true);
      if (error) throw new Error(error.message);
      const presets = camelRows(data as Row[]);
      return createCorsResponse({ presets, count: presets.length }, 200, req);
    }

    // ─── /config-by-domain/:domain ──────────────────────────────────
    if (resource === 'config-by-domain' && req.method === 'GET') {
      const domain = parts[1] ? decodeURIComponent(parts[1]) : '';
      if (!domain) {
        return createCorsResponse({ error: 'Domain required' }, 400, req);
      }
      const { data } = await admin
        .from('white_label_config')
        .select(PUBLIC_DOMAIN_FIELDS.join(','))
        .eq('custom_domain', domain)
        .eq('custom_domain_verified', true)
        .eq('is_active', true)
        .maybeSingle();

      if (!data) {
        return createCorsResponse({ error: 'Configuration not found for this domain' }, 404, req);
      }
      return createCorsResponse(camelRow(data as Row), 200, req);
    }

    // ─── /config ────────────────────────────────────────────────────
    if (resource === 'config') {
      const missing = requireTenant();
      if (missing) return missing;

      if (req.method === 'GET') {
        const config = await loadConfig();
        if (!config) {
          return createCorsResponse({ error: 'White-label configuration not found' }, 404, req);
        }
        return createCorsResponse(camelRow(config), 200, req);
      }

      if (req.method === 'PUT') {
        const body = (await req.json()) as Row;
        const values = toColumns(body, CONFIG_COLUMNS);
        const existing = await loadConfig();

        if (existing) {
          const { data, error } = await admin
            .from('white_label_config')
            .update({ ...values, updated_at: new Date().toISOString() })
            .eq('tenant_id', tenantId)
            .select()
            .single();
          if (error) throw new Error(error.message);
          return createCorsResponse(
            {
              success: true,
              message: 'Configuration updated successfully',
              config: camelRow(data as Row),
            },
            200,
            req,
          );
        }

        // company_name is NOT NULL with no default, so a first-time create
        // without it would fail at the database rather than at the API.
        if (!values.company_name) {
          return createCorsResponse(
            { error: 'Invalid configuration data', details: 'companyName is required' },
            400,
            req,
          );
        }

        const { data, error } = await admin
          .from('white_label_config')
          .insert({ ...values, tenant_id: tenantId })
          .select()
          .single();
        if (error) throw new Error(error.message);

        // Same as the Express path: a brand new config seeds the default
        // templates so the tenant is not left with an empty template list.
        const seeds = defaultEmailTemplates().map((t) => ({ ...t, tenant_id: tenantId }));
        const { error: seedError } = await admin.from('white_label_email_templates').insert(seeds);
        if (seedError) {
          console.error('[WHITE-LABEL] default template seeding failed:', seedError.message);
        }

        return createCorsResponse(
          {
            success: true,
            message: 'Configuration updated successfully',
            config: camelRow(data as Row),
          },
          200,
          req,
        );
      }
    }

    // ─── /css ───────────────────────────────────────────────────────
    if (resource === 'css' && req.method === 'GET') {
      const missing = requireTenant();
      if (missing) return missing;
      const config = await loadConfig();
      if (!config) {
        return createCorsResponse({ error: 'Configuration not found' }, 404, req);
      }
      // Returned as text/css, not JSON — this is consumed by a stylesheet link.
      return new Response(generateCssVariables(config), {
        status: 200,
        headers: {
          ...getCorsHeaders(req.headers.get('origin')),
          'Content-Type': 'text/css',
        },
      });
    }

    // ─── /verify-domain ─────────────────────────────────────────────
    if (resource === 'verify-domain' && req.method === 'POST') {
      const missing = requireTenant();
      if (missing) return missing;
      const { domain } = (await req.json()) as Row;
      if (!domain) {
        return createCorsResponse({ error: 'Domain required' }, 400, req);
      }

      // Parity note: like the Express handler, this marks the domain verified
      // without performing a DNS lookup. Real TXT/CNAME verification is still
      // outstanding on both sides.
      const now = new Date().toISOString();
      const { error } = await admin
        .from('white_label_config')
        .update({
          custom_domain_verified: true,
          custom_domain_verified_at: now,
          updated_at: now,
        })
        .eq('tenant_id', tenantId)
        .eq('custom_domain', domain);
      if (error) throw new Error(error.message);

      return createCorsResponse(
        { success: true, message: 'Domain verified successfully', domain },
        200,
        req,
      );
    }

    // ─── /apply-preset/:presetSlug ──────────────────────────────────
    if (resource === 'apply-preset' && req.method === 'POST') {
      const missing = requireTenant();
      if (missing) return missing;
      const slug = parts[1];
      if (!slug) {
        return createCorsResponse({ error: 'Preset slug required' }, 400, req);
      }

      const { data: preset } = await admin
        .from('white_label_presets')
        .select('*')
        .eq('preset_slug', slug)
        .maybeSingle();
      if (!preset) {
        return createCorsResponse({ error: 'Preset not found' }, 404, req);
      }

      const values = toColumns((preset as Row).config || {}, CONFIG_COLUMNS);
      const existing = await loadConfig();
      if (!existing) {
        return createCorsResponse(
          { error: 'Create a white-label configuration before applying a preset' },
          404,
          req,
        );
      }

      const { data, error } = await admin
        .from('white_label_config')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .select()
        .single();
      if (error) throw new Error(error.message);

      return createCorsResponse(
        {
          success: true,
          message: 'Preset applied successfully',
          config: camelRow(data as Row),
        },
        200,
        req,
      );
    }

    // ─── /email-templates[/:key][/preview] ──────────────────────────
    if (resource === 'email-templates') {
      const missing = requireTenant();
      if (missing) return missing;
      const key = parts[1];
      const action = parts[2];

      if (!key && req.method === 'GET') {
        const { data, error } = await admin
          .from('white_label_email_templates')
          .select('*')
          .eq('tenant_id', tenantId);
        if (error) throw new Error(error.message);
        const templates = camelRows(data as Row[]);
        return createCorsResponse({ templates, count: templates.length }, 200, req);
      }

      const loadTemplate = async (): Promise<Row | null> => {
        const { data } = await admin
          .from('white_label_email_templates')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('template_key', key)
          .maybeSingle();
        return (data as Row) || null;
      };

      if (key && action === 'preview' && req.method === 'POST') {
        const body = (await req.json().catch(() => ({}))) as Row;
        const [config, template] = await Promise.all([loadConfig(), loadTemplate()]);
        if (!config || !template) {
          return createCorsResponse({ error: 'Configuration or template not found' }, 404, req);
        }
        const preview = renderEmailTemplate(template, body.variables || {}, config);
        return createCorsResponse({ success: true, preview }, 200, req);
      }

      if (key && req.method === 'GET') {
        const template = await loadTemplate();
        if (!template) {
          return createCorsResponse({ error: 'Template not found' }, 404, req);
        }
        return createCorsResponse(camelRow(template), 200, req);
      }

      if (key && req.method === 'PUT') {
        const body = (await req.json()) as Row;
        const values = toColumns(body, TEMPLATE_COLUMNS);
        const existing = await loadTemplate();
        const now = new Date().toISOString();

        let saved: Row;
        if (existing) {
          const { data, error } = await admin
            .from('white_label_email_templates')
            .update({ ...values, updated_at: now })
            .eq('tenant_id', tenantId)
            .eq('template_key', key)
            .select()
            .single();
          if (error) throw new Error(error.message);
          saved = data as Row;
        } else {
          // template_name, subject and html_body are NOT NULL on this table.
          const required = ['template_name', 'subject', 'html_body'].filter((c) => !values[c]);
          if (required.length) {
            return createCorsResponse(
              {
                error: 'Invalid template data',
                details: `Missing required field(s): ${required.map(toCamel).join(', ')}`,
              },
              400,
              req,
            );
          }
          const { data, error } = await admin
            .from('white_label_email_templates')
            .insert({ ...values, tenant_id: tenantId, template_key: key })
            .select()
            .single();
          if (error) throw new Error(error.message);
          saved = data as Row;
        }

        return createCorsResponse(
          { success: true, message: 'Template updated successfully', template: camelRow(saved) },
          200,
          req,
        );
      }

      // The Express route deletes by template ID here while GET/PUT key off
      // template_key; the id is matched first so both spellings work.
      if (key && req.method === 'DELETE') {
        // `id` is a uuid column, so an `id.eq.<non-uuid>` filter is a database
        // type error rather than a miss — only offer that clause for a value
        // that could actually be an id.
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
        const query = admin.from('white_label_email_templates').delete().eq('tenant_id', tenantId);
        const { error } = isUuid
          ? await query.or(`id.eq.${key},template_key.eq.${key}`)
          : await query.eq('template_key', key);
        if (error) throw new Error(error.message);
        return createCorsResponse(
          { success: true, message: 'Template deleted successfully' },
          200,
          req,
        );
      }
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('[WHITE-LABEL] error:', error);
    return createCorsResponse({ error: (error as Error).message || 'Request failed' }, 500, req);
  }
}
