// Booking pages admin CRUD — CRMX-016.
//
// Authenticated companion to the public-booking edge fn. Reps/admins manage
// their own Calendly-style booking pages here; the prospect-facing surface is
// public-booking (unauth). Frontend calls /api/booking-pages/* (BookingPages.tsx).
//
// Routes (server.ts strips the `booking-pages` segment, so paths start at /):
//   GET    /                       -> list pages for the tenant
//   GET    /:id                    -> one page
//   GET    /:id/bookings           -> bookings against a page
//   POST   /                       -> create
//   PUT    /:id  | PATCH /:id       -> update
//   DELETE /:id                    -> deactivate (soft; keeps existing bookings)
//
// Service-role client for DB (RLS bypass) with an explicit tenant filter on
// every query, per the multi-tenant isolation rule.

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { jsonResponse, errorResponse, generateRequestId } from '../_shared/http.ts';

const RESERVED_SLUGS = new Set(['manage', 'availability', 'api', 'admin']);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function randomSuffix(): string {
  return crypto.randomUUID().slice(0, 6);
}

// Whitelist of columns a client may set. tenant_id / owner / created_by are
// server-injected; id / timestamps are DB-managed.
const WRITABLE: Array<[string, string]> = [
  ['title', 'title'],
  ['description', 'description'],
  ['timezone', 'timezone'],
  ['durationMinutes', 'duration_minutes'],
  ['bufferBeforeMinutes', 'buffer_before_minutes'],
  ['bufferAfterMinutes', 'buffer_after_minutes'],
  ['minNoticeMinutes', 'min_notice_minutes'],
  ['dateRangeDays', 'date_range_days'],
  ['slotIntervalMinutes', 'slot_interval_minutes'],
  ['availabilityRules', 'availability_rules'],
  ['bookingType', 'booking_type'],
  ['teamMemberIds', 'team_member_ids'],
  ['calendarConnectionId', 'calendar_connection_id'],
  ['branding', 'branding'],
  ['location', 'location'],
  ['confirmationMessage', 'confirmation_message'],
  ['isActive', 'is_active'],
];

function mapWritable(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [camel, snake] of WRITABLE) {
    if (camel in body) out[snake] = body[camel];
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[0];
  const sub = parts[1];

  try {
    const auth = await requireAuth(req);
    const db = getDb();

    // GET / — list
    if (method === 'GET' && !id) {
      const { data, error } = await db
        .from('booking_pages')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: false });
      if (error) {
        return errorResponse(500, 'Failed to list booking pages', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    // GET /:id/bookings
    if (method === 'GET' && id && sub === 'bookings') {
      const { data, error } = await db
        .from('booking_page_bookings')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('booking_page_id', id)
        .order('start_time', { ascending: false });
      if (error) {
        return errorResponse(500, 'Failed to list bookings', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    // GET /:id
    if (method === 'GET' && id) {
      const { data, error } = await db
        .from('booking_pages')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();
      if (error) {
        return errorResponse(500, 'Failed to fetch booking page', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      if (!data) return errorResponse(404, 'Booking page not found', req, { requestId });
      return jsonResponse(data, 200, req, requestId);
    }

    // POST / — create
    if (method === 'POST' && !id) {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body.title !== 'string' || !body.title.trim()) {
        return errorResponse(400, 'title is required', req, { code: 'VALIDATION', requestId });
      }

      // Resolve a unique, non-reserved slug.
      let slug =
        typeof body.slug === 'string' && body.slug.trim()
          ? slugify(body.slug)
          : slugify(body.title);
      if (!slug || RESERVED_SLUGS.has(slug)) slug = `${slug || 'book'}-${randomSuffix()}`;
      // Ensure global uniqueness (slug has a unique index).
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: existing } = await db
          .from('booking_pages')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();
        if (!existing) break;
        slug = `${slugify(body.title)}-${randomSuffix()}`;
      }

      const insertRow = {
        ...mapWritable(body),
        tenant_id: auth.tenantId,
        owner_user_id: (body.ownerUserId as string) || auth.userId,
        created_by: auth.userId,
        slug,
      };

      const { data, error } = await db
        .from('booking_pages')
        .insert(insertRow)
        .select('*')
        .maybeSingle();
      if (error) {
        return errorResponse(500, 'Failed to create booking page', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse(data, 201, req, requestId);
    }

    // PUT / PATCH /:id — update
    if ((method === 'PUT' || method === 'PATCH') && id) {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return errorResponse(400, 'Invalid body', req, { code: 'VALIDATION', requestId });

      const updates = mapWritable(body);
      // Allow slug change with the same reserved/uniqueness guards.
      if (typeof body.slug === 'string' && body.slug.trim()) {
        let slug = slugify(body.slug);
        if (!slug || RESERVED_SLUGS.has(slug)) {
          return errorResponse(400, 'Invalid or reserved slug', req, {
            code: 'VALIDATION',
            requestId,
          });
        }
        const { data: clash } = await db
          .from('booking_pages')
          .select('id')
          .eq('slug', slug)
          .neq('id', id)
          .maybeSingle();
        if (clash) {
          return errorResponse(409, 'That link is already taken', req, {
            code: 'SLUG_TAKEN',
            requestId,
          });
        }
        updates.slug = slug;
      }
      updates.updated_at = new Date().toISOString();

      const { data, error } = await db
        .from('booking_pages')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', auth.tenantId)
        .select('*')
        .maybeSingle();
      if (error) {
        return errorResponse(500, 'Failed to update booking page', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      if (!data) return errorResponse(404, 'Booking page not found', req, { requestId });
      return jsonResponse(data, 200, req, requestId);
    }

    // DELETE /:id — soft deactivate (keeps historical bookings valid)
    if (method === 'DELETE' && id) {
      const { data, error } = await db
        .from('booking_pages')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', auth.tenantId)
        .select('id')
        .maybeSingle();
      if (error) {
        return errorResponse(500, 'Failed to delete booking page', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      if (!data) return errorResponse(404, 'Booking page not found', req, { requestId });
      return jsonResponse({ success: true, id }, 200, req, requestId);
    }

    return errorResponse(404, 'Not found', req, { requestId });
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, { code: err.code, requestId });
    }
    console.error('[booking-pages] unhandled', err);
    return errorResponse(500, 'Internal error', req, { code: 'INTERNAL', requestId });
  }
}
