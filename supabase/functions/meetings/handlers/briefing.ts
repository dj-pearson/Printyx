// Pre-meeting briefing - GET /meetings/briefing?eventId=... (COP-B12 AC4).
//
// The one criterion on that story needing no transcript, no speech-to-text
// provider and no entity that does not exist: what should a rep know before
// they walk into this meeting. Four reads over tables a dealer already fills,
// assembled by `shared/meeting-briefing.ts`.
//
// WHOSE ACCOUNT IS SCOPED, AND HOW. The briefing is gated on the EVENT being
// the caller's, not on the account being in their book - a rep meeting an
// account they do not own still needs to walk in informed, and refusing them
// would make the feature useless in exactly the case it matters (a manager
// joining a rep's call, a colleague covering). The event row is the
// authorization: `calendar_events` is filtered by tenant AND `user_id`, so a
// caller can only brief themselves on their own calendar.
//
// EACH SECTION IS READ INDEPENDENTLY and a failure answers null rather than an
// empty list. A briefing is read minutes before a conversation, and "no open
// deals" is a different fact from "we could not look".

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { createLogger } from '../../_shared/logger.ts';
import { buildMeetingBriefing } from '../../../../shared/meeting-briefing.ts';

const log = createLogger('meetings-briefing');

/** How far back "recent activity" reaches. Stated, not implied. */
const ACTIVITY_WINDOW_DAYS = 30;

type Row = Record<string, any>;

/** Read a section, or null when it could not be read. Never an empty array. */
async function section<T>(name: string, run: () => Promise<T[]>): Promise<T[] | null> {
  try {
    return await run();
  } catch (err) {
    log.error(`briefing section failed: ${name}`, err);
    return null;
  }
}

export async function handleBriefing(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, url } = ctx;
  if (method !== 'GET') return null;

  const eventId = url.searchParams.get('eventId');
  if (!eventId) {
    return errorResponse(400, 'eventId is required', req, {
      code: 'MISSING_EVENT_ID',
      requestId,
    });
  }

  const { data: event, error: eventError } = await db
    .from('calendar_events')
    .select(
      'id, title, start_time, end_time, location, attendees, related_entity_id, related_entity_type',
    )
    .eq('id', eventId)
    .eq('tenant_id', auth.tenantId)
    .eq('user_id', auth.userId)
    .maybeSingle();

  if (eventError) {
    return errorResponse(500, 'Could not load the meeting', req, {
      code: 'DB_ERROR',
      details: eventError.message,
      requestId,
    });
  }
  // Not found and not yours are the same answer on purpose: distinguishing
  // them tells a caller whether an event id exists on somebody else's calendar.
  if (!event) {
    return errorResponse(404, 'Meeting not found', req, { requestId });
  }

  const accountId = (event as Row).related_entity_id as string | null;
  const accountType = ((event as Row).related_entity_type as string | null) ?? null;

  const meeting = {
    id: (event as Row).id,
    title: (event as Row).title,
    startTime: (event as Row).start_time,
    endTime: (event as Row).end_time,
    location: (event as Row).location,
    attendees: (event as Row).attendees ?? [],
    accountId,
    accountType,
  };

  // An event linked to nothing has no account to brief on. Saying so beats
  // guessing one from the attendee list, which would silently brief the rep
  // on the wrong company.
  if (!accountId) {
    return jsonResponse(
      {
        meeting,
        account: null,
        briefing: null,
        unbacked: [
          'This meeting is not linked to an account, so there is nothing to brief on. Link it to a company, lead or deal to get a briefing.',
        ],
      },
      200,
      req,
      requestId,
    );
  }

  const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000).toISOString();

  const [account, deals, equipment, tickets, activities] = await Promise.all([
    section('account', async () => {
      const { data, error } = await db
        .from('business_records')
        .select('id, company_name, industry, status, territory')
        .eq('id', accountId)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();
      if (error) throw error;
      return data ? [data as Row] : [];
    }),
    section('deals', async () => {
      const { data, error } = await db
        .from('deals')
        .select('id, title, amount, status, expected_close_date')
        .eq('tenant_id', auth.tenantId)
        .eq('status', 'open')
        .or(`source_business_record_id.eq.${accountId},customer_id.eq.${accountId}`);
      if (error) throw error;
      return (data ?? []) as Row[];
    }),
    section('equipment', async () => {
      const { data, error } = await db
        .from('equipment')
        .select('id, model_number, serial_number, equipment_status')
        .eq('tenant_id', auth.tenantId)
        .eq('customer_id', accountId);
      if (error) throw error;
      return (data ?? []) as Row[];
    }),
    section('tickets', async () => {
      const { data, error } = await db
        .from('service_tickets')
        .select('id, status, priority, created_at')
        .eq('tenant_id', auth.tenantId)
        .eq('customer_id', accountId);
      if (error) throw error;
      return (data ?? []) as Row[];
    }),
    section('activities', async () => {
      const { data, error } = await db
        .from('business_record_activities')
        .select('activity_type, subject, created_at')
        .eq('tenant_id', auth.tenantId)
        // `created_at` is an INSTANT, so it is compared to one - no day
        // snapping (DATE-LOCAL-002 draws that line).
        .gte('created_at', since)
        .or(`business_record_id.eq.${accountId},company_id.eq.${accountId}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    }),
  ]);

  const briefing = buildMeetingBriefing({
    deals:
      deals?.map((d) => ({
        id: d.id,
        title: d.title,
        amount: d.amount,
        status: d.status,
        expectedCloseDate: d.expected_close_date,
      })) ?? null,
    equipment:
      equipment?.map((e) => ({
        id: e.id,
        modelNumber: e.model_number,
        serialNumber: e.serial_number,
        equipmentStatus: e.equipment_status,
      })) ?? null,
    tickets:
      tickets?.map((t) => ({
        id: t.id,
        status: t.status,
        priority: t.priority,
        createdAt: t.created_at,
      })) ?? null,
    activities:
      activities?.map((a) => ({
        activityType: a.activity_type,
        subject: a.subject,
        createdAt: a.created_at,
      })) ?? null,
  });

  const accountRow = account?.[0] ?? null;

  return jsonResponse(
    {
      meeting,
      account: accountRow
        ? {
            id: accountRow.id,
            companyName: accountRow.company_name,
            industry: accountRow.industry,
            status: accountRow.status,
            territory: accountRow.territory,
          }
        : null,
      activityWindowDays: ACTIVITY_WINDOW_DAYS,
      briefing,
      unbacked: [
        ...briefing.unbacked,
        ...(account === null ? ['The account record could not be read.'] : []),
        // Named rather than silently absent: COP-B12's other criteria want a
        // transcript, and this briefing does not have one to draw on.
        'Transcripts and action items from past meetings are not included: speech-to-text runs in stub mode unless TRANSCRIPTION_PROVIDER is set.',
      ],
    },
    200,
    req,
    requestId,
  );
}
