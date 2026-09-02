/**
 * Meter-read vision edge function (PROD-011) — port of
 * server/routes-meter-read-vision.ts (US-SUPER-002).
 *
 * Customers text or email a photo of their MFP meter panel; Claude vision reads
 * the counters, the read is validated against the machine's rolling 90-day
 * average, and a clean read becomes a billable meter_readings row. Anything that
 * fails validation lands in a review queue instead.
 *
 * WHY: Express-only, so MeterReadReview.tsx worked in dev and hard-404'd in
 * production, where getApiUrl() rewrites /api/meter-reads ->
 * functions.printyx.net/meter-reads with no Express fallback.
 *
 * ROUTES — all EIGHT Express endpoints, which is everything the page calls:
 *   POST /inbound                     simulated Twilio inbound webhook
 *   POST /submit                      web/manual submission (machineId required)
 *   GET  /submissions?status=         review queue, newest first
 *   GET  /submissions/:id             single submission
 *   POST /submissions/:id/approve     reviewer approve (+ value/machine overrides)
 *   POST /submissions/:id/reject      reviewer reject
 *   GET  /settings                    templates + threshold + *_set markers
 *   PUT  /settings                    update (encrypts Twilio creds)
 *
 * THIS ENDPOINT WRITES BILLING ROWS, so the failure modes matter more than usual
 * and three are preserved exactly:
 *
 * 1. A FALLBACK EXTRACTION IS NEVER AUTO-BILLED. With no key, or on any vision
 *    failure, the counters come back as zeros marked 'fallback', and
 *    computeValidation flags on that alone. Without it a keyless deployment
 *    would auto-bill every customer a meter read of 0.
 * 2. THE BILLABLE INSERT IS TOLERATED SEPARATELY. If meter_readings rejects the
 *    row, auto-approve degrades to 'flagged' and reviewer-approve still records
 *    the approval with a note — the submission is never lost because billing
 *    was unavailable.
 * 3. IDENTICAL IMAGES REUSE THE PRIOR EXTRACTION, keyed on SHA-256 of the image.
 *    That is cost control, not caching: a customer re-sending the same photo
 *    must not be re-billed for a vision call.
 *
 * TWO DELIBERATE DIVERGENCES FROM EXPRESS, both called out at their call sites:
 *   - Twilio credentials go through the real credential vault (AES-256-GCM)
 *     instead of the base64 "obfuscation" the Express file itself marks
 *     TODO(vault). Writing NEW code that stores an auth token as base64 under a
 *     field named encryptedConfig is not a port worth doing.
 *   - An AMBIGUOUS phone match resolves to nobody rather than to the first hit.
 *
 * Still stubbed, as in Express: outbound SMS is recorded on the submission but
 * not sent, and /inbound trusts the authenticated tenant rather than verifying a
 * Twilio signature.
 */

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { encryptCredential } from '../_shared/credential-vault.ts';
import {
  DEFAULT_CLARIFY_TEMPLATE,
  DEFAULT_CONFIRM_TEMPLATE,
  FALLBACK_EXTRACTION,
  NINETY_DAYS_MS,
  blackDelta,
  computeValidation,
  matchCustomerByPhone,
  parseApprove,
  parseInbound,
  parseSettings,
  parseStatusFilter,
  parseSubmit,
  parseVisionResponse,
  projectSettings,
  renderTemplate,
  rollingStats,
  toCamelSubmission,
  type ExtractedMeter,
  type ValidationStatus,
} from './vision.ts';
import { accessibleCustomerIds, resolveScope } from '../_shared/scope.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const VISION_MODEL = 'claude-opus-4-8';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // Idempotent — the dispatcher strips segment 0 before the handler runs.
    const { parts } = normalizePath(url.pathname, 'meter-reads');
    const [resource, second, third] = parts;
    const method = req.method.toUpperCase();

    if (method === 'POST' && resource === 'inbound') {
      return await inbound(req, admin, tenantId, user.id);
    }
    if (method === 'POST' && resource === 'submit') {
      return await submit(req, admin, tenantId, user.id);
    }
    if (resource === 'submissions') {
      if (method === 'GET' && !second)
        return await listSubmissions(admin, tenantId, url, req, user);
      if (method === 'GET' && second && !third)
        return await getSubmission(admin, tenantId, second, req);
      if (method === 'POST' && second && third === 'approve')
        return await approve(req, admin, tenantId, user.id, second);
      if (method === 'POST' && second && third === 'reject')
        return await reject(admin, tenantId, user.id, second, req);
    }
    if (resource === 'settings') {
      if (method === 'GET') return await getSettings(admin, tenantId, req);
      if (method === 'PUT') return await putSettings(req, admin, tenantId, user.id);
    }

    return createCorsResponse({ message: 'Not found' }, 404, req);
  } catch (error) {
    console.error('meter-reads error:', error);
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ---------------------------------------------------------------------------
// Vision adapter
// ---------------------------------------------------------------------------

/**
 * Read the counters off a photo. Returns FALLBACK_EXTRACTION on ANY failure —
 * no key, no image, API error, unparseable reply — and that value is flagged
 * downstream, so a degraded vision path can never produce a billable read.
 */
async function extractMeterFromImage(args: {
  imageBase64?: string;
  mediaType?: string;
  imageUrl?: string;
}): Promise<ExtractedMeter> {
  try {
    if (!args.imageBase64 && !args.imageUrl) return FALLBACK_EXTRACTION;

    const imageBlock = args.imageBase64
      ? {
          type: 'image',
          source: {
            type: 'base64',
            media_type: args.mediaType ?? 'image/jpeg',
            data: args.imageBase64,
          },
        }
      : { type: 'image', source: { type: 'url', url: args.imageUrl } };

    const text = await generateCompletion({
      model: VISION_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            imageBlock,
            {
              type: 'text',
              text:
                'You are reading the meter / counter panel of a multifunction office printer (MFP). ' +
                'Identify the lifetime page counters. Return ONLY a JSON object, no prose, of the form ' +
                '{"black":int,"color":int,"scan":int,"fax":int,"confidence":0..1}. ' +
                'Use 0 for any counter not visible. "confidence" is your overall confidence (0..1).',
            },
          ],
        },
      ],
    });

    return parseVisionResponse(text) ?? FALLBACK_EXTRACTION;
  } catch (err) {
    console.warn('vision extraction failed; using fallback (offline-safe):', err);
    return FALLBACK_EXTRACTION;
  }
}

/** Outbound SMS STUB, as in Express — the message is recorded, not sent. */
async function sendOutboundSms(to: string, body: string): Promise<boolean> {
  void to;
  void body;
  return false;
}

async function sha256(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function audit(action: string, ctx: { tenantId: string; userId?: string; extra?: unknown }) {
  console.log(
    JSON.stringify({
      audit: true,
      scope: 'meter-read-vision',
      action,
      tenantId: ctx.tenantId,
      userId: ctx.userId ?? 'system',
      timestamp: new Date().toISOString(),
      ...(ctx.extra ? { extra: ctx.extra } : {}),
    }),
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function loadSettings(admin: Admin, tenantId: string) {
  const { data: existing, error } = await admin
    .from('meter_read_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data: created, error: insertError } = await admin
    .from('meter_read_settings')
    .upsert(
      {
        tenant_id: tenantId,
        confirm_template: DEFAULT_CONFIRM_TEMPLATE,
        clarify_template: DEFAULT_CLARIFY_TEMPLATE,
      },
      { onConflict: 'tenant_id', ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();
  if (insertError) throw insertError;
  if (created) return created;

  // ignoreDuplicates returns nothing when a concurrent call won the race.
  const { data: reread } = await admin
    .from('meter_read_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return reread;
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

interface ProcessArgs {
  tenantId: string;
  userId?: string;
  source: 'sms' | 'email' | 'web' | 'manual';
  fromPhone?: string;
  machineId?: string;
  customerId?: string;
  imageBase64?: string;
  imageUrl?: string;
  mediaType?: string;
}

async function processSubmission(admin: Admin, args: ProcessArgs) {
  const { tenantId, source } = args;
  const settings = await loadSettings(admin, tenantId);
  const maxDeltaMultiplier = Number(settings?.max_delta_multiplier) || 3;
  const confirmTemplate = settings?.confirm_template ?? DEFAULT_CONFIRM_TEMPLATE;
  const clarifyTemplate = settings?.clarify_template ?? DEFAULT_CLARIFY_TEMPLATE;

  // --- Resolve machine + customer ------------------------------------------
  let machineId: string | null = null;
  let customerId: string | null = args.customerId ?? null;

  if (args.machineId) {
    const { data: machine } = await admin
      .from('equipment')
      .select('id, customer_id')
      .eq('id', args.machineId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (machine) {
      machineId = machine.id;
      if (!customerId) customerId = machine.customer_id ?? null;
    }
  }

  if (!customerId && args.fromPhone) {
    // Digit-suffix matching cannot be expressed as a PostgREST filter, so the
    // candidates are narrowed to rows that HAVE a phone and matched in JS.
    const { data: candidates } = await admin
      .from('business_records')
      .select('id, phone')
      .eq('tenant_id', tenantId)
      .not('phone', 'is', null);
    customerId = matchCustomerByPhone(candidates ?? [], args.fromPhone);
  }

  // A customer with exactly ONE machine resolves unambiguously; two or more do
  // not, and guessing would attach the read to the wrong device.
  if (!machineId && customerId) {
    const { data: machines } = await admin
      .from('equipment')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .limit(2);
    if (machines && machines.length === 1) machineId = machines[0].id;
  }

  // --- Image hash + de-dup --------------------------------------------------
  const imageKey = args.imageBase64 ?? args.imageUrl ?? '';
  const imageHash = imageKey ? await sha256(imageKey) : null;

  let extracted: ExtractedMeter | null = null;
  if (imageHash) {
    const { data: prior } = await admin
      .from('meter_read_submissions')
      .select('extracted_values')
      .eq('tenant_id', tenantId)
      .eq('image_hash', imageHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prior?.extracted_values) {
      extracted = prior.extracted_values as ExtractedMeter; // reuse — cost control
    }
  }
  if (!extracted) {
    extracted = await extractMeterFromImage({
      imageBase64: args.imageBase64,
      imageUrl: args.imageUrl,
      mediaType: args.mediaType,
    });
  }

  // --- Validate against the rolling 90-day average -------------------------
  let validationStatus: ValidationStatus = 'pending';
  const validationDetail: Record<string, unknown> = {
    rollingAvgBlack: null,
    lastBlack: null,
    deltaBlack: null,
    maxDeltaMultiplier,
    extractionSource: extracted.source,
    confidence: extracted.confidence,
  };
  let outboundMessage = '';
  let createdMeterReadingId: string | null = null;

  if (!machineId || !customerId) {
    validationStatus = 'pending';
    validationDetail.reason = !machineId
      ? 'Could not resolve the machine from the photo/phone.'
      : 'Could not resolve the customer.';
    outboundMessage = clarifyTemplate;
  } else {
    const since = new Date(Date.now() - NINETY_DAYS_MS).toISOString();
    const { data: recent } = await admin
      .from('meter_readings')
      .select('bw_meter_reading, reading_date')
      .eq('tenant_id', tenantId)
      .eq('equipment_id', machineId)
      .gte('reading_date', since)
      // DESCENDING: rollingStats takes rows[0] as the last reading.
      .order('reading_date', { ascending: false });

    const { lastBlack, rollingAvg } = rollingStats(recent ?? []);
    const newBlack = extracted.black;

    validationDetail.rollingAvgBlack = rollingAvg;
    validationDetail.lastBlack = lastBlack;
    validationDetail.deltaBlack = blackDelta(lastBlack, newBlack);
    validationDetail.newBlack = newBlack;

    const outcome = computeValidation({
      lastBlack,
      rollingAvg,
      newBlack,
      maxDeltaMultiplier,
      extractionSource: extracted.source,
    });
    validationDetail.reason = outcome.reason;

    if (outcome.flagged) {
      validationStatus = 'flagged';
      outboundMessage = clarifyTemplate;
    } else {
      // Auto-approve → create the billable read. A failure here degrades to
      // 'flagged' rather than throwing: the submission must survive even when
      // billing cannot accept it.
      const { data: reading, error: readingError } = await admin
        .from('meter_readings')
        .insert({
          tenant_id: tenantId,
          equipment_id: machineId,
          created_by: args.userId ?? 'system',
          reading_date: new Date().toISOString(),
          bw_meter_reading: extracted.black,
          color_meter_reading: extracted.color,
          scan_meter_reading: extracted.scan,
          fax_meter_reading: extracted.fax,
          collection_method: source === 'email' ? 'email' : 'manual',
          reading_method: source,
        })
        .select('id')
        .single();

      if (readingError) {
        console.warn('auto-approve meter_readings insert failed; flagging instead:', readingError);
        validationStatus = 'flagged';
        validationDetail.reason = 'Auto-approval billable insert failed; needs review.';
        outboundMessage = clarifyTemplate;
      } else {
        createdMeterReadingId = reading?.id ?? null;
        validationStatus = 'auto_approved';
        outboundMessage = renderTemplate(confirmTemplate, {
          black: extracted.black,
          color: extracted.color,
          scan: extracted.scan,
          fax: extracted.fax,
        });
      }
    }
  }

  if (outboundMessage && args.fromPhone) {
    await sendOutboundSms(args.fromPhone, outboundMessage);
  }

  const { data: submission, error: submissionError } = await admin
    .from('meter_read_submissions')
    .insert({
      tenant_id: tenantId,
      source,
      from_phone: args.fromPhone ?? null,
      customer_id: customerId,
      machine_id: machineId,
      raw_image_url: args.imageUrl ?? null,
      image_hash: imageHash,
      extracted_values: extracted,
      validation_status: validationStatus,
      validation_detail: validationDetail,
      outbound_message: outboundMessage || null,
      meter_reading_id: createdMeterReadingId,
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (submissionError) throw submissionError;

  return { submission: toCamelSubmission(submission), outboundMessage };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

async function inbound(req: Request, admin: Admin, tenantId: string, userId: string) {
  const parsed = parseInbound(await safeJson(req));
  if (!parsed.ok) {
    return createCorsResponse({ message: 'Invalid input', errors: parsed.message }, 400, req);
  }

  // TODO: verify the Twilio signature + resolve the tenant by inbound number.
  const result = await processSubmission(admin, {
    tenantId,
    userId,
    source: 'sms',
    ...parsed.value,
  });

  audit('INBOUND', {
    tenantId,
    userId,
    extra: { id: result.submission?.id, status: result.submission?.validationStatus },
  });
  return createCorsResponse(result, 201, req);
}

async function submit(req: Request, admin: Admin, tenantId: string, userId: string) {
  const parsed = parseSubmit(await safeJson(req));
  if (!parsed.ok) {
    return createCorsResponse({ message: 'Invalid input', errors: parsed.message }, 400, req);
  }

  const result = await processSubmission(admin, { tenantId, userId, ...parsed.value });

  audit('SUBMIT', {
    tenantId,
    userId,
    extra: { id: result.submission?.id, status: result.submission?.validationStatus },
  });
  return createCorsResponse(result, 201, req);
}

async function listSubmissions(
  admin: Admin,
  tenantId: string,
  url: URL,
  req: Request,
  user: { id: string; app_metadata?: Record<string, unknown> | null },
) {
  let query = admin
    .from('meter_read_submissions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(500);

  // WF-R-07, scoped through the CUSTOMER. A submission names two users and
  // neither is an owner: `reviewed_by_user_id` is whoever triaged it, so scoping
  // on it would show a reviewer the queue they had already cleared and nothing
  // waiting. The account the meter belongs to is the real answer. AC3 asked for
  // the equipment's customer LOCATION; `business_records` has no location FK, so
  // ownership of the account is what this can express.
  const scope = await resolveScope(admin, {
    userId: user.id,
    tenantId,
    appMetadata: user.app_metadata,
    requestedScope: url.searchParams.get('scope'),
  });
  const customers = await accessibleCustomerIds(admin, tenantId, scope);
  if (customers.ids !== null || customers.overflow) {
    // Overflow narrows to nothing: there is no user column to fall back to.
    query = query.in('customer_id', customers.overflow ? [] : (customers.ids ?? []));
  }

  const status = parseStatusFilter(url.searchParams.get('status'));
  if (status) query = query.eq('validation_status', status);

  const { data, error } = await query;
  if (error) throw error;

  const enriched = await enrich(admin, tenantId, data ?? []);
  return createCorsResponse({ data: enriched, total: enriched.length }, 200, req);
}

async function getSubmission(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('meter_read_submissions')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return createCorsResponse({ message: 'Submission not found' }, 404, req);

  const [enriched] = await enrich(admin, tenantId, [data]);
  return createCorsResponse(enriched, 200, req);
}

/**
 * Attach the machine serial/model and the customer name.
 *
 * The lookups are filtered by the ids actually referenced. Express selected the
 * tenant's ENTIRE equipment and business_records tables on every queue load and
 * then filtered in JS — correct, but it made a 500-row review queue read two
 * whole tables.
 */
async function enrich(
  admin: Admin,
  tenantId: string,
  rows: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  if (rows.length === 0) return [];
  const machineIds = Array.from(new Set(rows.map((r) => r.machine_id as string).filter(Boolean)));
  const customerIds = Array.from(new Set(rows.map((r) => r.customer_id as string).filter(Boolean)));

  const [machines, customers] = await Promise.all([
    machineIds.length
      ? admin
          .from('equipment')
          .select('id, serial_number, model_number')
          .eq('tenant_id', tenantId)
          .in('id', machineIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    customerIds.length
      ? admin
          .from('business_records')
          .select('id, company_name')
          .eq('tenant_id', tenantId)
          .in('id', customerIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const machineMap = new Map((machines.data ?? []).map((m: any) => [m.id, m]));
  const customerMap = new Map((customers.data ?? []).map((c: any) => [c.id, c]));

  return rows.map((r) => ({
    ...toCamelSubmission(r),
    serialNumber: r.machine_id
      ? (machineMap.get(r.machine_id as string)?.serial_number ?? null)
      : null,
    modelNumber: r.machine_id
      ? (machineMap.get(r.machine_id as string)?.model_number ?? null)
      : null,
    companyName: r.customer_id
      ? (customerMap.get(r.customer_id as string)?.company_name ?? null)
      : null,
  }));
}

async function approve(req: Request, admin: Admin, tenantId: string, userId: string, id: string) {
  const parsed = parseApprove(await safeJson(req));
  if (!parsed.ok) {
    return createCorsResponse({ message: 'Invalid input', errors: parsed.message }, 400, req);
  }

  const { data: submission, error } = await admin
    .from('meter_read_submissions')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!submission) return createCorsResponse({ message: 'Submission not found' }, 404, req);

  const machineId = parsed.value.machineId ?? submission.machine_id;
  if (!machineId) {
    return createCorsResponse(
      { message: 'A machine is required to approve. Provide machineId.' },
      400,
      req,
    );
  }

  const extracted = (submission.extracted_values ?? {}) as Partial<ExtractedMeter>;
  const black = parsed.value.black ?? Number(extracted.black ?? 0);
  const color = parsed.value.color ?? Number(extracted.color ?? 0);
  const scan = parsed.value.scan ?? Number(extracted.scan ?? 0);
  const fax = parsed.value.fax ?? Number(extracted.fax ?? 0);

  const now = new Date().toISOString();
  let meterReadingId: string | null = submission.meter_reading_id ?? null;
  const detail = { ...((submission.validation_detail ?? {}) as Record<string, unknown>) };

  const { data: reading, error: readingError } = await admin
    .from('meter_readings')
    .insert({
      tenant_id: tenantId,
      equipment_id: machineId,
      created_by: userId ?? 'system',
      reading_date: now,
      bw_meter_reading: black,
      color_meter_reading: color,
      scan_meter_reading: scan,
      fax_meter_reading: fax,
      collection_method: 'email',
      reading_method: 'manual',
    })
    .select('id')
    .single();

  if (readingError) {
    // The reviewer's decision is recorded either way — losing it because the
    // billing insert failed would send them back to re-review the same photo.
    console.warn('approve meter_readings insert failed; approving with a note:', readingError);
    detail.approveNote = 'Billable meter_readings insert failed (missing columns?).';
  } else {
    meterReadingId = reading?.id ?? meterReadingId;
  }

  const { data: updated, error: updateError } = await admin
    .from('meter_read_submissions')
    .update({
      validation_status: 'approved',
      machine_id: machineId,
      meter_reading_id: meterReadingId,
      validation_detail: detail,
      reviewed_by_user_id: userId ?? null,
      reviewed_at: now,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();
  if (updateError) throw updateError;

  audit('APPROVE', { tenantId, userId, extra: { id, meterReadingId } });
  return createCorsResponse(updated ? toCamelSubmission(updated) : null, 200, req);
}

async function reject(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  const { data: updated, error } = await admin
    .from('meter_read_submissions')
    .update({
      validation_status: 'rejected',
      reviewed_by_user_id: userId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!updated) return createCorsResponse({ message: 'Submission not found' }, 404, req);

  audit('REJECT', { tenantId, userId, extra: { id } });
  return createCorsResponse(toCamelSubmission(updated), 200, req);
}

async function getSettings(admin: Admin, tenantId: string, req: Request) {
  const settings = await loadSettings(admin, tenantId);
  if (!settings) return createCorsResponse({ message: 'Failed to load settings' }, 500, req);
  return createCorsResponse(projectSettings(tenantId, settings), 200, req);
}

async function putSettings(req: Request, admin: Admin, tenantId: string, userId: string) {
  const parsed = parseSettings(await safeJson(req));
  if (!parsed.ok) {
    return createCorsResponse({ message: 'Invalid input', errors: parsed.message }, 400, req);
  }
  const input = parsed.value;

  const current = await loadSettings(admin, tenantId);
  if (!current) return createCorsResponse({ message: 'Failed to load settings' }, 500, req);

  const updates: Record<string, unknown> = {
    updated_by_user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (input.maxDeltaMultiplier !== undefined)
    updates.max_delta_multiplier = input.maxDeltaMultiplier;
  if (input.confirmTemplate !== undefined) updates.confirm_template = input.confirmTemplate;
  if (input.clarifyTemplate !== undefined) updates.clarify_template = input.clarifyTemplate;

  const suppliedCreds = (
    ['twilioAccountSid', 'twilioAuthToken', 'twilioFromNumber'] as const
  ).filter((k) => input[k] !== undefined);

  if (suppliedCreds.length > 0) {
    // Real AES-256-GCM, not the base64 the Express file marks TODO(vault). The
    // vault throws when its master key is unset; that is surfaced as a 503
    // rather than falling back, because storing an auth token reversibly under a
    // field named encrypted_config is the failure this replaces. Templates and
    // the threshold are unaffected — this branch only runs when a credential is
    // actually supplied.
    const cfg: Record<string, unknown> = {
      ...((current.encrypted_config ?? {}) as Record<string, unknown>),
    };
    try {
      for (const key of suppliedCreds) {
        cfg[key] = await encryptCredential(input[key] as string);
      }
    } catch (err) {
      console.error('credential vault unavailable:', err);
      return createCorsResponse(
        {
          message:
            'Credential storage is unavailable: the edge functions service has no credential vault key configured (PRINTYX_CREDENTIAL_VAULT_KEY). Other settings can still be saved.',
        },
        503,
        req,
      );
    }
    updates.encrypted_config = cfg;
  }

  const { data: updated, error } = await admin
    .from('meter_read_settings')
    .update(updates)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();
  if (error) throw error;

  audit('UPDATE_SETTINGS', {
    tenantId,
    userId,
    extra: {
      maxDeltaMultiplier: input.maxDeltaMultiplier,
      credentialsUpdated: suppliedCreds,
    },
  });
  return createCorsResponse(projectSettings(tenantId, updated), 200, req);
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
