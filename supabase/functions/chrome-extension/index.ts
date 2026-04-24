/**
 * Chrome Extension edge function.
 *
 * Replaces: server/routes/chrome-extension-routes.ts (4 endpoints, 532 lines).
 *
 * URL layout (under /chrome-extension):
 *   POST /leads/quick-import       — import LinkedIn/Salesforce prospect
 *   GET  /leads/check-duplicate    — duplicate check
 *   POST /auth/generate-key        — mint a per-user API key
 *   GET  /health                   — connectivity + Apollo config status
 *
 * Apollo enrichment: the Express version called Apollo inline. The Apollo
 * integration already lives in its own edge function (Phase 2 US-008), so
 * this function DOES NOT re-implement enrichment. quick-import inserts the
 * business_record from user-supplied data; the frontend / extension can
 * call /apollo/enrich separately before POSTing here.
 *
 * API key generation uses the existing `api_keys` table from Phase 5 US-021,
 * with key_type='integration' and service='chrome-extension'. The plaintext
 * key is returned ONCE on creation; subsequent lookups use the hash.
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('chrome-extension');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/chrome-extension(?=\/|$)/, '')
      .replace(/\/$/, '') || '/'
  );
}

function parseFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(req);
    const db = getDb();

    const rest = stripPrefix(url.pathname);
    const parts = rest.split('/').filter(Boolean);
    const [first, second, third] = parts;

    // POST /leads/quick-import
    if (method === 'POST' && first === 'leads' && second === 'quick-import') {
      let body: {
        source?: 'linkedin' | 'salesforce';
        name?: string;
        firstName?: string;
        lastName?: string;
        jobTitle?: string;
        company?: string;
        location?: string;
        linkedinUrl?: string;
        email?: string;
        phone?: string;
      } = {};
      try {
        body = await req.json();
      } catch {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      if (!body.name || !body.company || !body.source) {
        return errorResponse(400, 'name, company, and source are required', req, {
          code: 'VALIDATION',
          requestId,
        });
      }

      let firstName = body.firstName;
      let lastName = body.lastName;
      if (!firstName || !lastName) {
        const parsed = parseFullName(body.name);
        firstName = firstName || parsed.firstName;
        lastName = lastName || parsed.lastName;
      }

      // Duplicate check
      const dupe = await checkDuplicate(db, auth.tenantId, {
        linkedinUrl: body.linkedinUrl,
        email: body.email,
        name: body.name,
        company: body.company,
      });

      if (dupe.exists) {
        return jsonResponse(
          {
            success: true,
            alreadyExists: true,
            matchType: dupe.matchType,
            businessRecord: dupe.record,
            message: `This contact already exists in your CRM (matched by ${dupe.matchType})`,
          },
          200,
          req,
          requestId,
        );
      }

      const { data: record, error } = await db
        .from('business_records')
        .insert({
          tenant_id: auth.tenantId,
          record_type: 'lead',
          status: 'new',
          first_name: firstName ?? '',
          last_name: lastName ?? '',
          job_title: body.jobTitle ?? null,
          company_name: body.company,
          linkedin_url: body.linkedinUrl ?? null,
          email: body.email?.toLowerCase() ?? null,
          phone: body.phone ?? null,
          lead_source: `Chrome Extension - ${body.source === 'linkedin' ? 'LinkedIn' : 'Salesforce'}`,
          created_by: auth.userId,
          owner_id: auth.userId,
          tags: ['Chrome Extension'],
        })
        .select('*')
        .single();

      if (error) {
        return errorResponse(500, 'Failed to import contact', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }

      return jsonResponse(
        {
          success: true,
          alreadyExists: false,
          businessRecord: record,
          enrichmentSource: 'manual',
          message:
            'Contact added successfully. Call /apollo/enrich separately if Apollo integration is configured.',
        },
        201,
        req,
        requestId,
      );
    }

    // GET /leads/check-duplicate
    if (method === 'GET' && first === 'leads' && second === 'check-duplicate') {
      const params = {
        linkedinUrl: url.searchParams.get('linkedinUrl') ?? undefined,
        email: url.searchParams.get('email') ?? undefined,
        name: url.searchParams.get('name') ?? undefined,
        company: url.searchParams.get('company') ?? undefined,
      };
      const result = await checkDuplicate(db, auth.tenantId, params);
      return jsonResponse(
        {
          exists: result.exists,
          matchType: result.matchType,
          record: result.exists
            ? {
                id: result.record.id,
                name: `${result.record.first_name ?? ''} ${result.record.last_name ?? ''}`.trim(),
                email: result.record.email,
                company: result.record.company_name,
                jobTitle: result.record.job_title,
                status: result.record.status,
                createdAt: result.record.created_at,
              }
            : null,
        },
        200,
        req,
        requestId,
      );
    }

    // POST /auth/generate-key
    if (method === 'POST' && first === 'auth' && second === 'generate-key') {
      // Mint a secure plaintext key (`pyx_ext_` + 64 hex chars).
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const hex = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const apiKey = `pyx_ext_${hex}`;

      // Hash for storage. api_keys from Phase 5 expects key_hash + salt; we
      // generate a random salt and SHA-256 of (salt + apiKey).
      const saltBytes = new Uint8Array(16);
      crypto.getRandomValues(saltBytes);
      const salt = Array.from(saltBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const enc = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', enc.encode(salt + apiKey));
      const keyHash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const { data, error } = await db
        .from('api_keys')
        .insert({
          tenant_id: auth.tenantId,
          user_id: auth.userId,
          name: 'Chrome Extension',
          key_type: 'integration',
          key_hash: keyHash,
          salt,
          service: 'chrome-extension',
          status: 'active',
          created_by: auth.userId,
        })
        .select('id, name, key_type, status, created_at')
        .single();

      if (error) {
        return errorResponse(500, 'Failed to generate API key', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }

      return jsonResponse(
        {
          success: true,
          apiKey, // plaintext returned ONCE
          keyId: data.id,
          tenantId: auth.tenantId,
          userId: auth.userId,
          expiresAt: null,
          message: 'API key generated successfully. Keep this secure!',
          warning: 'This key will only be shown once. Store it securely in the Chrome extension.',
        },
        201,
        req,
        requestId,
      );
    }

    // GET /health
    if (method === 'GET' && first === 'health' && !second) {
      // Check if the tenant has an active Apollo integration credential.
      const { data: apolloCred } = await db
        .from('integration_credentials')
        .select('status')
        .eq('tenant_id', auth.tenantId)
        .eq('provider', 'apollo')
        .maybeSingle();
      const apolloConfigured = apolloCred?.status === 'active';

      return jsonResponse(
        {
          status: 'healthy',
          version: '1.0.0',
          tenant: {
            id: auth.tenantId,
            userId: auth.userId,
          },
          integrations: {
            apollo: apolloConfigured,
            zoominfo: false,
          },
          features: {
            quickImport: true,
            duplicateCheck: true,
            enrichment: apolloConfigured,
          },
        },
        200,
        req,
        requestId,
      );
    }

    return errorResponse(404, 'Not found', req, {
      code: 'NOT_FOUND',
      details: { path: url.pathname, method },
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
    log.error({ requestId, err: String(err) }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, {
      code: 'INTERNAL',
      requestId,
    });
  } finally {
    log.info(
      { requestId, path: url.pathname, method, durationMs: Date.now() - startedAt },
      'request_complete',
    );
  }
}

// ─── Duplicate check helper ─────────────────────────────────────────────────

interface DuplicateParams {
  linkedinUrl?: string;
  email?: string;
  name?: string;
  company?: string;
}

interface DuplicateResult {
  exists: boolean;
  record: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    company_name: string | null;
    job_title: string | null;
    status: string | null;
    created_at: string | null;
  } | null;
  matchType: 'linkedinUrl' | 'email' | 'nameAndCompany' | null;
}

async function checkDuplicate(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  params: DuplicateParams,
): Promise<DuplicateResult> {
  const selectCols =
    'id, first_name, last_name, email, company_name, job_title, status, linkedin_url, created_at';

  // LinkedIn URL (most reliable)
  if (params.linkedinUrl) {
    const normalized = params.linkedinUrl
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/$/, '')
      .toLowerCase();
    // Supabase-js has no sql-expression helper for normalized ilike; use ilike
    // against the raw column + the trailing portion of the URL.
    const { data } = await db
      .from('business_records')
      .select(selectCols)
      .eq('tenant_id', tenantId)
      .ilike('linkedin_url', `%${normalized.split('/').slice(-2).join('/')}%`)
      .limit(1);
    if (data && data.length > 0) {
      return { exists: true, record: data[0], matchType: 'linkedinUrl' };
    }
  }

  // Email
  if (params.email) {
    const { data } = await db
      .from('business_records')
      .select(selectCols)
      .eq('tenant_id', tenantId)
      .ilike('email', params.email)
      .limit(1);
    if (data && data.length > 0) {
      return { exists: true, record: data[0], matchType: 'email' };
    }
  }

  // Name + company (exact, case-insensitive)
  if (params.name && params.company) {
    const { data } = await db
      .from('business_records')
      .select(selectCols)
      .eq('tenant_id', tenantId)
      .ilike('company_name', params.company);

    const match = (data ?? []).find((r) => {
      const full = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim().toLowerCase();
      const reverse = `${r.last_name ?? ''} ${r.first_name ?? ''}`.trim().toLowerCase();
      const q = params.name!.toLowerCase();
      return full === q || reverse === q;
    });
    if (match) {
      return { exists: true, record: match, matchType: 'nameAndCompany' };
    }
  }

  return { exists: false, record: null, matchType: null };
}
