// Public meeting booking pages — CRMX-016 (Calendly-style self-scheduling).
//
// UNAUTHENTICATED surface the frontend calls at /api/public/booking/*
// (PublicBooking.tsx). Mirrors the public-calculator pattern: no JWT check,
// service-role client, config.toml verify_jwt=false, server.ts route-override
// (public + booking -> public-booking) + a dev crmProxies entry. So the path
// here always starts with /booking.
//
// Routes:
//   GET  /booking/:slug                          -> public page config
//   GET  /booking/:slug/availability?date=&tz=   -> open slots for a local date
//   POST /booking/:slug                          -> create a booking
//   GET  /booking/manage/:token                  -> resolve booking for manage page
//   POST /booking/manage/:token/cancel           -> cancel
//   POST /booking/manage/:token/reschedule       -> reschedule
//
// Booking creates: a calendar_events row (+ best-effort provider push), a
// business_record_activities meeting activity linked to a matched/created lead
// (CRMX-006), and a confirmation email (best-effort via SendGrid). None of the
// downstream steps can fail the booking — the booking_page_bookings row is
// authoritative.

import { createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import type { SupabaseClient } from '../_shared/db.ts';
import {
  computeSlotsForDate,
  localParts,
  zonedWallTimeToUtc,
  type AvailabilityRule,
  type BusyWindow,
  type SlotConfig,
} from './_slots.ts';
import { pushInsert, pushPatch, pushDelete, type ProviderEvent } from './_provider.ts';
import {
  sendConfirmation,
  sendReschedule,
  sendCancellation,
  type BookingEmailInfo,
} from './_email.ts';

const APP_URL = Deno.env.get('PUBLIC_APP_URL') || 'https://app.printyx.net';

interface BookingPageRow {
  id: string;
  tenant_id: string;
  owner_user_id: string;
  slug: string;
  title: string;
  description: string | null;
  timezone: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  date_range_days: number;
  slot_interval_minutes: number;
  availability_rules: AvailabilityRule[] | null;
  booking_type: string;
  team_member_ids: string[] | null;
  calendar_connection_id: string | null;
  branding: Record<string, unknown> | null;
  location: string | null;
  confirmation_message: string | null;
  is_active: boolean;
}

function slotConfig(page: BookingPageRow): SlotConfig {
  return {
    timezone: page.timezone,
    durationMinutes: page.duration_minutes,
    slotIntervalMinutes: page.slot_interval_minutes,
    bufferBeforeMinutes: page.buffer_before_minutes,
    bufferAfterMinutes: page.buffer_after_minutes,
    minNoticeMinutes: page.min_notice_minutes,
    availabilityRules: page.availability_rules ?? [],
  };
}

function hostsForPage(page: BookingPageRow): string[] {
  if (page.booking_type === 'round_robin') {
    const members = (page.team_member_ids ?? []).filter(Boolean);
    return members.length > 0 ? members : [page.owner_user_id];
  }
  return [page.owner_user_id];
}

function brandName(page: BookingPageRow): string {
  const b = page.branding as { companyName?: string } | null;
  return b?.companyName || 'Printyx';
}

async function loadPageBySlug(db: SupabaseClient, slug: string): Promise<BookingPageRow | null> {
  const { data } = await db
    .from('booking_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  return (data as BookingPageRow) ?? null;
}

/** UTC day bounds (widened one hour each side) for a local date in `tz`. */
function dayBoundsUtc(localDate: string, tz: string): { startIso: string; endIso: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate)!;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const start = zonedWallTimeToUtc(y, mo, d, 0, 0, tz).getTime() - 3_600_000;
  const end = zonedWallTimeToUtc(y, mo, d, 23, 59, tz).getTime() + 3_600_000;
  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
}

/** Busy windows (epoch ms) for a host across a UTC window: calendar + confirmed bookings. */
async function busyForHost(
  db: SupabaseClient,
  tenantId: string,
  hostUserId: string,
  startIso: string,
  endIso: string,
): Promise<BusyWindow[]> {
  const busy: BusyWindow[] = [];

  const { data: events } = await db
    .from('calendar_events')
    .select('start_time, end_time, status')
    .eq('tenant_id', tenantId)
    .eq('user_id', hostUserId)
    .neq('status', 'cancelled')
    .lt('start_time', endIso)
    .gt('end_time', startIso);
  for (const ev of events ?? []) {
    busy.push({ start: new Date(ev.start_time).getTime(), end: new Date(ev.end_time).getTime() });
  }

  const { data: bookings } = await db
    .from('booking_page_bookings')
    .select('start_time, end_time, status')
    .eq('tenant_id', tenantId)
    .eq('assigned_user_id', hostUserId)
    .eq('status', 'confirmed')
    .lt('start_time', endIso)
    .gt('end_time', startIso);
  for (const b of bookings ?? []) {
    busy.push({ start: new Date(b.start_time).getTime(), end: new Date(b.end_time).getTime() });
  }

  return busy;
}

/** Slots open for a local date across all hosts (union), plus per-host maps for assignment. */
async function computeDaySlots(
  db: SupabaseClient,
  page: BookingPageRow,
  localDate: string,
): Promise<{ union: string[]; perHost: Map<string, Set<string>> }> {
  const cfg = slotConfig(page);
  const { startIso, endIso } = dayBoundsUtc(localDate, page.timezone);
  const now = new Date();
  const perHost = new Map<string, Set<string>>();
  const union = new Set<string>();

  for (const host of hostsForPage(page)) {
    const busy = await busyForHost(db, page.tenant_id, host, startIso, endIso);
    const slots = computeSlotsForDate(localDate, cfg, busy, now);
    perHost.set(host, new Set(slots));
    for (const s of slots) union.add(s);
  }

  return { union: Array.from(union).sort(), perHost };
}

function publicPagePayload(page: BookingPageRow, hostName: string) {
  return {
    slug: page.slug,
    title: page.title,
    description: page.description,
    timezone: page.timezone,
    durationMinutes: page.duration_minutes,
    dateRangeDays: page.date_range_days,
    minNoticeMinutes: page.min_notice_minutes,
    location: page.location,
    branding: page.branding ?? {},
    hostName,
    bookingType: page.booking_type,
  };
}

async function hostName(db: SupabaseClient, userId: string): Promise<string> {
  const { data } = await db
    .from('users')
    .select('first_name, last_name, email')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return 'Your host';
  const full = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  return full || data.email || 'Your host';
}

// ─── CRM linkage (best-effort) ──────────────────────────────────────────────
//
// Best-effort is the right design: a booking must not fail because CRM linkage
// did. What was wrong (AUDIT-038) is that a failure left no trace anywhere.
// Each step sat inside a try/catch, and PostgREST does not THROW - it returns
// `{ data, error }` - so those catches could only fire on a network fault while
// the actual failure mode returned quietly. Every error was destructured away
// or not destructured at all, so a linkage failing on every booking looked
// exactly like a booking with nothing to link: business_record_id null on the
// row and nothing in the log.
//
// The errors are surfaced now. The catches stay, because a network fault is
// still possible and still must not fail the booking.
async function linkCrm(
  db: SupabaseClient,
  page: BookingPageRow,
  booking: {
    inviteeName: string;
    inviteeEmail: string;
    inviteePhone: string | null;
    inviteeCompany: string | null;
    inviteeNotes: string | null;
    startTime: string;
    assignedUserId: string;
  },
): Promise<{
  businessRecordId: string | null;
  contactId: string | null;
  activityId: string | null;
}> {
  const result = {
    businessRecordId: null as string | null,
    contactId: null as string | null,
    activityId: null as string | null,
  };
  const tenantId = page.tenant_id;

  try {
    // Match existing lead/account by primary contact email.
    const { data: matched, error: matchErr } = await db
      .from('business_records')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('primary_contact_email', booking.inviteeEmail)
      .limit(1)
      .maybeSingle();
    if (matchErr) console.error('[public-booking] lead match failed', matchErr);

    if (matched?.id) {
      result.businessRecordId = matched.id;
    } else {
      const { data: created, error: createErr } = await db
        .from('business_records')
        .insert({
          tenant_id: tenantId,
          record_type: 'lead',
          status: 'new',
          company_name: booking.inviteeCompany || booking.inviteeName,
          primary_contact_name: booking.inviteeName,
          primary_contact_email: booking.inviteeEmail,
          primary_contact_phone: booking.inviteePhone,
          source: 'booking_page',
          owner_id: booking.assignedUserId,
        })
        .select('id')
        .maybeSingle();
      if (createErr) console.error('[public-booking] lead create failed', createErr);
      if (created?.id) result.businessRecordId = created.id;
    }
  } catch {
    // ignore — lead match/create is best-effort
  }

  // Match an existing contact by email (read-only; company_contacts needs a company FK).
  try {
    const { data: contact, error: contactErr } = await db
      .from('company_contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('email', booking.inviteeEmail)
      .limit(1)
      .maybeSingle();
    if (contactErr) console.error('[public-booking] contact match failed', contactErr);
    if (contact?.id) result.contactId = contact.id;
  } catch {
    // ignore
  }

  // Record the meeting as a CRM activity on the timeline.
  try {
    const { data: activity, error: activityErr } = await db
      .from('business_record_activities')
      .insert({
        tenant_id: tenantId,
        business_record_id: result.businessRecordId,
        activity_type: 'meeting',
        subject: `${page.title} — ${booking.inviteeName}`,
        description:
          `Booked via public page /book/${page.slug}.` +
          (booking.inviteeNotes ? `\n\nNotes: ${booking.inviteeNotes}` : '') +
          `\n\nInvitee: ${booking.inviteeName} <${booking.inviteeEmail}>` +
          (booking.inviteePhone ? ` ${booking.inviteePhone}` : ''),
        scheduled_date: booking.startTime,
        created_by: booking.assignedUserId,
      })
      .select('id')
      .maybeSingle();
    if (activityErr) console.error('[public-booking] activity create failed', activityErr);
    if (activity?.id) result.activityId = activity.id;
  } catch {
    // ignore
  }

  // Polymorphic association activity -> contact (CRMX-006), best-effort.
  if (result.activityId && result.contactId) {
    try {
      const { error: assocErr } = await db.from('crm_associations').insert({
        tenant_id: tenantId,
        source_type: 'activity',
        source_id: result.activityId,
        target_type: 'contact',
        target_id: result.contactId,
        relation: 'related',
        created_by: booking.assignedUserId,
      });
      if (assocErr) console.error('[public-booking] association create failed', assocErr);
    } catch {
      // ignore
    }
  }

  return result;
}

function manageUrl(token: string): string {
  return `${APP_URL.replace(/\/$/, '')}/book/manage/${token}`;
}

// ─── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req: Request): Promise<Response> {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const url = new URL(req.url);
    const all = url.pathname.split('/').filter(Boolean);
    const seg = all[0] === 'booking' ? all.slice(1) : all;
    const db = createSupabaseServiceClient();

    // ── Manage routes: /booking/manage/:token[/cancel|/reschedule] ──
    if (seg[0] === 'manage' && seg[1]) {
      return await handleManage(req, db, seg[1], seg[2]);
    }

    const slug = seg[0];
    if (!slug) return createCorsResponse({ message: 'Booking page not found' }, 404, req);

    // ── GET /booking/:slug/availability ──
    if (req.method === 'GET' && seg[1] === 'availability') {
      const page = await loadPageBySlug(db, slug);
      if (!page) return createCorsResponse({ message: 'Booking page not found' }, 404, req);
      const date = url.searchParams.get('date');
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return createCorsResponse({ message: 'A valid ?date=YYYY-MM-DD is required' }, 400, req);
      }
      const { union } = await computeDaySlots(db, page, date);
      const slots = union.map((start) => ({
        start,
        end: new Date(new Date(start).getTime() + page.duration_minutes * 60_000).toISOString(),
      }));
      return createCorsResponse({ date, timezone: page.timezone, slots }, 200, req);
    }

    // ── GET /booking/:slug ──
    if (req.method === 'GET' && !seg[1]) {
      const page = await loadPageBySlug(db, slug);
      if (!page) return createCorsResponse({ message: 'Booking page not found' }, 404, req);
      const host =
        page.booking_type === 'round_robin'
          ? brandName(page)
          : await hostName(db, page.owner_user_id);
      return createCorsResponse(publicPagePayload(page, host), 200, req);
    }

    // ── POST /booking/:slug — create booking ──
    if (req.method === 'POST' && !seg[1]) {
      return await handleCreate(req, db, slug);
    }

    return createCorsResponse({ message: 'Not found' }, 404, req);
  } catch (err) {
    console.error('[public-booking] unhandled', err);
    return createCorsResponse({ message: 'Internal error' }, 500, req);
  }
}

async function handleCreate(req: Request, db: SupabaseClient, slug: string): Promise<Response> {
  const page = await loadPageBySlug(db, slug);
  if (!page) return createCorsResponse({ message: 'Booking page not found' }, 404, req);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return createCorsResponse({ message: 'Invalid request body' }, 400, req);
  }
  const b = body as Record<string, unknown>;
  const start = typeof b.start === 'string' ? b.start : '';
  const inviteeName = typeof b.inviteeName === 'string' ? b.inviteeName.trim() : '';
  const inviteeEmail = typeof b.inviteeEmail === 'string' ? b.inviteeEmail.trim() : '';
  if (!start || Number.isNaN(Date.parse(start))) {
    return createCorsResponse({ message: 'A valid start time is required' }, 400, req);
  }
  if (!inviteeName || !inviteeEmail || !/^\S+@\S+\.\S+$/.test(inviteeEmail)) {
    return createCorsResponse({ message: 'Name and a valid email are required' }, 400, req);
  }
  const inviteeTimezone = typeof b.inviteeTimezone === 'string' ? b.inviteeTimezone : page.timezone;
  const inviteePhone = typeof b.inviteePhone === 'string' ? b.inviteePhone : null;
  const inviteeCompany = typeof b.inviteeCompany === 'string' ? b.inviteeCompany : null;
  const inviteeNotes = typeof b.inviteeNotes === 'string' ? b.inviteeNotes : null;

  // Re-validate the slot is still open and pick the assigned host.
  const startDate = localParts(new Date(start), page.timezone).dateStr.replace(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    (_m, y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  );
  const { perHost } = await computeDaySlots(db, page, startDate);
  const startIso = new Date(start).toISOString();
  let assignedUserId: string | null = null;
  for (const [host, set] of perHost) {
    if (set.has(startIso)) {
      assignedUserId = host;
      break;
    }
  }
  if (!assignedUserId) {
    return createCorsResponse(
      { message: 'That time is no longer available. Please pick another slot.' },
      409,
      req,
    );
  }

  const endIso = new Date(new Date(start).getTime() + page.duration_minutes * 60_000).toISOString();
  const manageToken = crypto.randomUUID();

  // 1) Local calendar event (authoritative host-side record).
  let calendarEventId: string | null = null;
  let externalEventId: string | null = null;
  try {
    const { data: ev } = await db
      .from('calendar_events')
      .insert({
        tenant_id: page.tenant_id,
        user_id: assignedUserId,
        calendar_connection_id: page.calendar_connection_id,
        title: `${page.title} — ${inviteeName}`,
        description: inviteeNotes,
        start_time: startIso,
        end_time: endIso,
        location: page.location,
        attendees: [{ email: inviteeEmail, displayName: inviteeName }],
        status: 'confirmed',
        event_type: 'meeting',
        related_entity_type: 'booking_page',
        related_entity_id: page.id,
      })
      .select('id')
      .maybeSingle();
    calendarEventId = ev?.id ?? null;
  } catch (err) {
    console.error('[public-booking] calendar_events insert failed', err);
  }

  // 2) Best-effort provider push.
  let propagation = { status: 'skipped' as string };
  if (page.calendar_connection_id) {
    const providerEvent: ProviderEvent = {
      title: `${page.title} — ${inviteeName}`,
      description: inviteeNotes,
      start_time: startIso,
      end_time: endIso,
      location: page.location,
      attendees: [{ email: inviteeEmail, displayName: inviteeName }],
    };
    const push = await pushInsert(db, page.tenant_id, page.calendar_connection_id, providerEvent);
    propagation = { status: push.status };
    if (push.status === 'success' && push.externalEventId) {
      externalEventId = push.externalEventId;
      if (calendarEventId) {
        await db
          .from('calendar_events')
          .update({ external_event_id: externalEventId })
          .eq('id', calendarEventId);
      }
    }
  }

  // 3) CRM linkage (best-effort).
  const crm = await linkCrm(db, page, {
    inviteeName,
    inviteeEmail,
    inviteePhone,
    inviteeCompany,
    inviteeNotes,
    startTime: startIso,
    assignedUserId,
  });

  // 4) Persist the booking (authoritative).
  const { data: booking, error: bookingErr } = await db
    .from('booking_page_bookings')
    .insert({
      tenant_id: page.tenant_id,
      booking_page_id: page.id,
      assigned_user_id: assignedUserId,
      invitee_name: inviteeName,
      invitee_email: inviteeEmail,
      invitee_phone: inviteePhone,
      invitee_company: inviteeCompany,
      invitee_notes: inviteeNotes,
      invitee_timezone: inviteeTimezone,
      start_time: startIso,
      end_time: endIso,
      status: 'confirmed',
      calendar_event_id: calendarEventId,
      external_event_id: externalEventId,
      business_record_id: crm.businessRecordId,
      contact_id: crm.contactId,
      activity_id: crm.activityId,
      manage_token: manageToken,
    })
    .select('*')
    .maybeSingle();

  if (bookingErr || !booking) {
    console.error('[public-booking] booking insert failed', bookingErr);
    return createCorsResponse({ message: 'Could not complete booking' }, 500, req);
  }

  // 5) Confirmation email (best-effort).
  const host = await hostName(db, assignedUserId);
  const emailInfo: BookingEmailInfo = {
    inviteeName,
    inviteeEmail,
    inviteeTimezone,
    hostName: host,
    title: page.title,
    startTime: startIso,
    endTime: endIso,
    location: page.location,
    brandName: brandName(page),
    manageUrl: manageUrl(manageToken),
  };
  const emailed = await sendConfirmation(emailInfo);
  if (emailed) {
    await db
      .from('booking_page_bookings')
      .update({ confirmation_email_sent: true })
      .eq('id', booking.id);
  }

  return createCorsResponse(
    {
      booking: {
        id: booking.id,
        startTime: startIso,
        endTime: endIso,
        hostName: host,
        title: page.title,
        location: page.location,
        confirmationMessage: page.confirmation_message,
      },
      manageToken,
      manageUrl: manageUrl(manageToken),
      propagation,
    },
    201,
    req,
  );
}

async function handleManage(
  req: Request,
  db: SupabaseClient,
  token: string,
  action: string | undefined,
): Promise<Response> {
  const { data: booking } = await db
    .from('booking_page_bookings')
    .select('*')
    .eq('manage_token', token)
    .maybeSingle();
  if (!booking) return createCorsResponse({ message: 'Booking not found' }, 404, req);

  const { data: page } = await db
    .from('booking_pages')
    .select('*')
    .eq('id', booking.booking_page_id)
    .maybeSingle();
  if (!page) return createCorsResponse({ message: 'Booking page not found' }, 404, req);
  const p = page as BookingPageRow;

  // GET /booking/manage/:token
  if (req.method === 'GET' && !action) {
    const host = await hostName(db, booking.assigned_user_id);
    return createCorsResponse(
      {
        id: booking.id,
        title: p.title,
        slug: p.slug,
        status: booking.status,
        startTime: booking.start_time,
        endTime: booking.end_time,
        inviteeName: booking.invitee_name,
        inviteeEmail: booking.invitee_email,
        inviteeTimezone: booking.invitee_timezone,
        durationMinutes: p.duration_minutes,
        timezone: p.timezone,
        location: p.location,
        branding: p.branding ?? {},
        hostName: host,
      },
      200,
      req,
    );
  }

  const host = await hostName(db, booking.assigned_user_id);
  const emailBase: Omit<BookingEmailInfo, 'startTime' | 'endTime'> = {
    inviteeName: booking.invitee_name,
    inviteeEmail: booking.invitee_email,
    inviteeTimezone: booking.invitee_timezone,
    hostName: host,
    title: p.title,
    location: p.location,
    brandName: brandName(p),
    manageUrl: manageUrl(token),
  };

  // POST /booking/manage/:token/cancel
  if (req.method === 'POST' && action === 'cancel') {
    if (booking.status === 'cancelled') {
      return createCorsResponse({ message: 'Already cancelled', status: 'cancelled' }, 200, req);
    }
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason : null;

    await db
      .from('booking_page_bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    if (booking.calendar_event_id) {
      await db
        .from('calendar_events')
        .update({ status: 'cancelled' })
        .eq('id', booking.calendar_event_id);
    }
    if (p.calendar_connection_id && booking.external_event_id) {
      await pushDelete(db, p.tenant_id, p.calendar_connection_id, booking.external_event_id);
    }
    if (booking.activity_id) {
      await db
        .from('business_record_activities')
        .update({ outcome: 'cancelled' })
        .eq('id', booking.activity_id)
        .then(
          () => {},
          () => {},
        );
    }

    await sendCancellation({
      ...emailBase,
      startTime: booking.start_time,
      endTime: booking.end_time,
    });
    return createCorsResponse({ status: 'cancelled' }, 200, req);
  }

  // POST /booking/manage/:token/reschedule
  if (req.method === 'POST' && action === 'reschedule') {
    if (booking.status === 'cancelled') {
      return createCorsResponse({ message: 'Cannot reschedule a cancelled booking' }, 409, req);
    }
    const body = await req.json().catch(() => null);
    const start = typeof body?.start === 'string' ? body.start : '';
    if (!start || Number.isNaN(Date.parse(start))) {
      return createCorsResponse({ message: 'A valid start time is required' }, 400, req);
    }
    const startIso = new Date(start).toISOString();

    // Validate against availability for the assigned host on that date.
    const dateStr = localParts(new Date(startIso), p.timezone).dateStr.replace(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      (_m, y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    );
    const { perHost } = await computeDaySlots(db, p, dateStr);
    const hostSet = perHost.get(booking.assigned_user_id);
    if (!hostSet || !hostSet.has(startIso)) {
      return createCorsResponse({ message: 'That time is not available' }, 409, req);
    }

    const endIso = new Date(
      new Date(startIso).getTime() + p.duration_minutes * 60_000,
    ).toISOString();

    await db
      .from('booking_page_bookings')
      .update({ start_time: startIso, end_time: endIso, updated_at: new Date().toISOString() })
      .eq('id', booking.id);

    if (booking.calendar_event_id) {
      await db
        .from('calendar_events')
        .update({ start_time: startIso, end_time: endIso })
        .eq('id', booking.calendar_event_id);
    }
    if (p.calendar_connection_id && booking.external_event_id) {
      await pushPatch(db, p.tenant_id, p.calendar_connection_id, booking.external_event_id, {
        title: `${p.title} — ${booking.invitee_name}`,
        description: booking.invitee_notes,
        start_time: startIso,
        end_time: endIso,
        location: p.location,
        attendees: [{ email: booking.invitee_email, displayName: booking.invitee_name }],
      });
    }
    if (booking.activity_id) {
      await db
        .from('business_record_activities')
        .update({ scheduled_date: startIso })
        .eq('id', booking.activity_id)
        .then(
          () => {},
          () => {},
        );
    }

    await sendReschedule({ ...emailBase, startTime: startIso, endTime: endIso });
    return createCorsResponse(
      { status: 'confirmed', startTime: startIso, endTime: endIso },
      200,
      req,
    );
  }

  return createCorsResponse({ message: 'Not found' }, 404, req);
}
