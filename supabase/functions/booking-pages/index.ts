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
import { isCronRequest } from '../_shared/cron-auth.ts';
import { sendReminder } from '../public-booking/_email.ts';

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
    /**
     * COP-B14 AC6: the reminder sweep.
     *
     * BEFORE requireAuth, because pg_cron carries the internal cron token and
     * no user JWT - the pattern _shared/cron-auth.ts documents and which,
     * until now, nothing in the tree used. A human can still force-run it with
     * a normal JWT; the branch simply accepts either.
     *
     * It lives HERE and not on the public surface on purpose: public-booking
     * routes its first path segment as a page slug, so a `/booking/reminders`
     * endpoint would be shadowed by any tenant that named a page "reminders" -
     * the SUPA-024 shape with a slug instead of an id.
     */
    if (method === 'POST' && id === 'reminders' && sub === 'sweep') {
      if (!isCronRequest(req)) {
        // Not cron: fall through to the normal JWT check, which throws its own
        // AuthError for an anonymous caller.
        await requireAuth(req);
      }
      return await sweepReminders(req, requestId);
    }

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

/**
 * COP-B14 AC6. One reminder per booking, for meetings starting inside the
 * window.
 *
 * IDEMPOTENT BY COLUMN, NOT BY SCHEDULE. `reminder_email_sent_at` is stamped
 * before the send is attempted, and only rows where it IS NULL are selected -
 * so a cron that fires twice, or a human who force-runs it, cannot double-send.
 * Stamping first means a crashed send loses that reminder rather than sending
 * it repeatedly, which is the right way round for email: a prospect who gets
 * four identical reminders is a worse outcome than one who gets none and still
 * has the confirmation in their inbox.
 *
 * Cancelled bookings are excluded, and so is anything already past - a reminder
 * for a meeting that has started is noise.
 */
async function sweepReminders(req: Request, requestId: string): Promise<Response> {
  const db = getDb();
  const now = new Date();
  const windowMinutes = Number(new URL(req.url).searchParams.get('windowMinutes')) || 1440;
  const until = new Date(now.getTime() + windowMinutes * 60_000);

  const { data, error } = await db
    .from('booking_page_bookings')
    .select(
      'id, tenant_id, booking_page_id, invitee_name, invitee_email, invitee_timezone, start_time, end_time, manage_token, status',
    )
    .is('reminder_email_sent_at', null)
    .eq('status', 'confirmed')
    .gte('start_time', now.toISOString())
    .lte('start_time', until.toISOString())
    .limit(500);

  if (error) {
    return errorResponse(500, 'Failed to read bookings due a reminder', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  const rows = (data ?? []) as Array<Record<string, any>>;
  const pageIds = [...new Set(rows.map((r) => r.booking_page_id).filter(Boolean))];
  const pages = new Map<string, Record<string, any>>();
  if (pageIds.length > 0) {
    const { data: pageRows } = await db
      .from('booking_pages')
      .select('id, title, timezone, location, branding')
      .in('id', pageIds);
    for (const p of pageRows ?? []) pages.set(String(p.id), p as Record<string, any>);
  }

  const appUrl = (Deno.env.get('APP_URL') || 'https://printyx.net').replace(/\/$/, '');
  let sent = 0;
  let failed = 0;

  /**
   * ONE claim for the whole batch, not one per booking.
   *
   * The atomic part is `.is('reminder_email_sent_at', null)` in the WHERE, not
   * the row-at-a-time loop: PostgREST returns the rows it actually updated, so
   * a single statement both claims the batch and says which ones it won. A
   * concurrent sweep gets the rows this one did not. (`check:nplus1` is what
   * caught the per-row version - it was correct that a write inside a loop is
   * a round trip per booking, and the fix is better than the baseline entry
   * would have been.)
   */
  const claimedIds = new Set<string>();
  if (rows.length > 0) {
    const { data: claimed, error: claimError } = await db
      .from('booking_page_bookings')
      .update({ reminder_email_sent_at: new Date().toISOString() })
      .in(
        'id',
        rows.map((r) => r.id),
      )
      .is('reminder_email_sent_at', null)
      .select('id');
    if (claimError) {
      return errorResponse(500, 'Failed to claim bookings for reminders', req, {
        code: 'DB_ERROR',
        details: claimError.message,
        requestId,
      });
    }
    for (const c of claimed ?? []) claimedIds.add(String((c as Record<string, any>).id));
  }

  for (const row of rows) {
    // Another sweep won this one. Not a failure, just not ours.
    if (!claimedIds.has(String(row.id))) continue;

    const page = pages.get(String(row.booking_page_id));
    const ok = await sendReminder({
      inviteeName: String(row.invitee_name ?? ''),
      inviteeEmail: String(row.invitee_email ?? ''),
      inviteeTimezone: String(row.invitee_timezone ?? 'America/New_York'),
      hostName: String(page?.branding?.companyName ?? 'Printyx'),
      title: String(page?.title ?? 'Meeting'),
      startTime: String(row.start_time),
      endTime: String(row.end_time),
      location: page?.location ?? null,
      brandName: String(page?.branding?.companyName ?? 'Printyx'),
      manageUrl: `${appUrl}/book/manage/${row.manage_token}`,
    });
    if (ok) sent += 1;
    else failed += 1;
  }

  return jsonResponse(
    {
      due: rows.length,
      claimed: claimedIds.size,
      sent,
      failed,
      windowMinutes,
      // Stated rather than implied: SENDGRID_API_KEY unset means the shared
      // helper simulates, so `sent` counts attempts that did not throw.
      unbacked:
        'Sends run through the shared SendGrid helper, which simulates when SENDGRID_API_KEY is unset - `sent` counts attempts that did not throw, not deliveries.',
    },
    200,
    req,
    requestId,
  );
}
