// Onboarding Edge Function
// Handles customer onboarding workflows, checklists, and equipment setup
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

/**
 * The installation_type Postgres enum, verbatim (migration 0000, line 56).
 * OnboardingDashboard's Quick Checklist select offered new_site,
 * equipment_upgrade, relocation and expansion - only one of which is in this
 * list - so three of its four options were a 22P02 waiting behind the 42703.
 */
const INSTALLATION_TYPES = ['new_installation', 'replacement', 'relocation', 'upgrade'];

/** estimated_duration is an integer column; a form sends it as a string. */
function toInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
import { renderChecklistPdf } from './_pdf.ts';

// Long enough to open the tab, short enough that a copied link stops working.
const PDF_SIGNED_URL_TTL_SECONDS = 900;
import { resolveTenantId } from '../_shared/tenant.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    // `: undefined` (not `: null`) — getUser's param is string | undefined, so
    // `null` trips a TS2345 under `deno check` (the known pre-existing pattern
    // across ~40 edge fns; fix the ones we touch, per CLAUDE.md).
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    // Canonical resolution (camel/snake, both metadata bags). Reading only
    // tenant_id previously 400'd every freshly signed-up tenant (PA-002/PA-003).
    const tenantId = resolveTenantId(user);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // AUDIT-012: server.ts strips the function-name segment before invoking us,
    // so a raw split never sees 'onboarding' at [0]. normalizePath is idempotent
    // (strips a LEADING '/onboarding' only if present), giving the same shape
    // under both the Coolify dispatcher and Supabase's native runtime. The
    // frontend calls /api/onboarding/checklists[/:id[/equipment|sections|tasks]],
    // so parts = ['checklists', :id?, subResource?].
    const { parts: pathParts } = normalizePath(url.pathname, 'onboarding');
    const checklistId = pathParts[1];
    const subResource = pathParts[2]; // 'equipment', 'sections', 'tasks'

    // POST /onboarding/checklists/:id/generate-pdf
    //
    // PA-052: Express-only, so the button worked in dev and 404'd in production.
    // Its implementation renders a 251-line HTML template through puppeteer,
    // which needs a headless Chrome binary. ./_pdf.ts emits the same content as
    // headings and tables through the pdf-lib section renderer the proposals
    // function already uses; the template's flex label/value divs were NOT
    // ported, because that renderer degrades unknown tags to bare text.
    //
    // The link is SIGNED and time-limited, following supabase/functions/qbr: a
    // checklist carries a customer's site details, contacts and serial numbers,
    // and a permanent public URL to that needs no login at all.
    if (req.method === 'POST' && checklistId && subResource === 'generate-pdf') {
      const { data: checklist, error: checklistError } = await admin
        .from('equipment_onboarding_checklists')
        .select('*')
        .eq('id', checklistId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (checklistError) {
        console.error('Error loading checklist:', checklistError);
        return createCorsResponse({ error: 'Failed to load checklist' }, 500, req);
      }
      if (!checklist) {
        return createCorsResponse({ error: 'Checklist not found' }, 404, req);
      }

      // Each related set is fetched independently and tolerated empty: one
      // missing table must not turn a whole checklist into a 500.
      const related = async (table: string) => {
        const { data, error } = await admin
          .from(table)
          .select('*')
          .eq('checklist_id', checklistId)
          .eq('tenant_id', tenantId);
        if (error) {
          console.error(`Error loading ${table}:`, error);
          return [];
        }
        return data || [];
      };

      const [equipment, networkConfigs, printConfigs, dynamicSections, tasks] = await Promise.all([
        related('onboarding_equipment'),
        related('onboarding_network_config'),
        related('onboarding_print_management'),
        related('onboarding_dynamic_sections'),
        related('onboarding_tasks'),
      ]);

      let pdfBytes: Uint8Array;
      try {
        pdfBytes = await renderChecklistPdf({
          checklist,
          equipment,
          networkConfigs,
          printConfigs,
          dynamicSections,
          tasks,
        });
      } catch (err) {
        console.error('Error rendering checklist PDF:', err);
        return createCorsResponse(
          {
            error: 'Failed to render PDF',
            details: err instanceof Error ? err.message : String(err),
          },
          500,
          req,
        );
      }

      // Named for the artefact, not the feature: a bucket called
      // 'onboarding-checklists' reads as a reference to the edge function
      // directory of that name, which PA-057 deleted.
      const bucket = Deno.env.get('ONBOARDING_PDF_BUCKET') || 'onboarding-checklist-pdfs';
      const path = `${tenantId}/${checklistId}.pdf`;

      const { error: uploadError } = await admin.storage.from(bucket).upload(path, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

      if (uploadError) {
        console.error('Error uploading checklist PDF:', uploadError);
        return createCorsResponse(
          { error: 'Failed to store the generated PDF', details: uploadError.message },
          500,
          req,
        );
      }

      const { data: signed, error: signError } = await admin.storage
        .from(bucket)
        .createSignedUrl(path, PDF_SIGNED_URL_TTL_SECONDS);

      if (signError || !signed?.signedUrl) {
        // The file exists but cannot be handed over. Say that rather than
        // answering 200 with no link, which the caller opens as `undefined`.
        console.error('Error signing checklist PDF URL:', signError);
        return createCorsResponse({ error: 'PDF was generated but could not be linked' }, 500, req);
      }

      // pdf_url and pdf_generated_at are real columns. The storage PATH is
      // recorded, not the signed link, which would be a dead URL in the row
      // within the quarter-hour.
      await admin
        .from('equipment_onboarding_checklists')
        .update({ pdf_url: path, pdf_generated_at: new Date().toISOString() })
        .eq('id', checklistId)
        .eq('tenant_id', tenantId);

      return createCorsResponse(
        { pdfUrl: signed.signedUrl, expiresInSeconds: PDF_SIGNED_URL_TTL_SECONDS },
        200,
        req,
      );
    }

    // GET /onboarding/checklists - List checklists
    // NOTE: this guard compared pathParts[0] to 'onboarding', which is never
    // true after the strip — list AND create (below) both 404'd in production.
    // The real discriminator is the 'checklists' collection segment.
    if (req.method === 'GET' && !checklistId && pathParts[0] === 'checklists') {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('equipment_onboarding_checklists')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data: checklists, error, count } = await query;

      if (error) {
        console.error('Error fetching checklists:', error);
        return createCorsResponse({ error: 'Failed to fetch checklists' }, 500, req);
      }

      return createCorsResponse(
        {
          data: checklists || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /onboarding/:id - Get single checklist with related data
    if (req.method === 'GET' && checklistId && !subResource) {
      const [checklist, equipment, sections, tasks] = await Promise.all([
        admin
          .from('equipment_onboarding_checklists')
          .select('*')
          .eq('id', checklistId)
          .eq('tenant_id', tenantId)
          .single(),
        admin
          .from('onboarding_equipment')
          .select('*')
          .eq('checklist_id', checklistId)
          .eq('tenant_id', tenantId),
        admin
          .from('onboarding_dynamic_sections')
          .select('*')
          .eq('checklist_id', checklistId)
          .eq('tenant_id', tenantId)
          .order('section_order', { ascending: true }),
        admin
          .from('onboarding_tasks')
          .select('*')
          .eq('checklist_id', checklistId)
          .eq('tenant_id', tenantId)
          .order('section_id', { ascending: true })
          .order('priority', { ascending: true }),
      ]);

      if (checklist.error) {
        console.error('Error fetching checklist:', checklist.error);
        return createCorsResponse({ error: 'Checklist not found' }, 404, req);
      }

      return createCorsResponse(
        {
          ...checklist.data,
          equipment: equipment.data || [],
          sections: sections.data || [],
          tasks: tasks.data || [],
        },
        200,
        req,
      );
    }

    // GET /onboarding/:id/equipment - Get checklist equipment
    if (req.method === 'GET' && checklistId && subResource === 'equipment') {
      const { data: equipment, error } = await admin
        .from('onboarding_equipment')
        .select('*')
        .eq('checklist_id', checklistId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error fetching equipment:', error);
        return createCorsResponse({ error: 'Failed to fetch equipment' }, 500, req);
      }

      return createCorsResponse(equipment || [], 200, req);
    }

    // GET /onboarding/:id/sections - Get checklist sections
    if (req.method === 'GET' && checklistId && subResource === 'sections') {
      const { data: sections, error } = await admin
        .from('onboarding_dynamic_sections')
        .select('*')
        .eq('checklist_id', checklistId)
        .eq('tenant_id', tenantId)
        .order('section_order', { ascending: true });

      if (error) {
        console.error('Error fetching sections:', error);
        return createCorsResponse({ error: 'Failed to fetch sections' }, 500, req);
      }

      return createCorsResponse(sections || [], 200, req);
    }

    // GET /onboarding/:id/tasks - Get checklist tasks
    if (req.method === 'GET' && checklistId && subResource === 'tasks') {
      const { data: tasks, error } = await admin
        .from('onboarding_tasks')
        .select('*')
        .eq('checklist_id', checklistId)
        .eq('tenant_id', tenantId)
        .order('section_id', { ascending: true })
        .order('priority', { ascending: true });

      if (error) {
        console.error('Error fetching tasks:', error);
        return createCorsResponse({ error: 'Failed to fetch tasks' }, 500, req);
      }

      return createCorsResponse(tasks || [], 200, req);
    }

    // POST /onboarding/checklists - Create checklist
    //
    // AUDIT-037: this used to write business_record_id, assigned_to,
    // installation_date and notes, none of which is a column, while setting
    // none of checklist_title, installation_type, customer_data,
    // site_information or equipment_details - and the first two are NOT NULL
    // with no default. So a create was a 42703 that would have been a 23502
    // anyway.
    //
    // The vocabulary below is EnhancedOnboardingForm's payload, which was
    // already correct: it sends checklistTitle, installationType (derived from
    // whether any equipment item is a replacement), customerId, customerData,
    // siteInformation, equipmentDetails, scheduledInstallDate and
    // estimatedDuration - the real columns in camelCase. The handler is what
    // was wrong, not the page. customer_id IS the link to business_records
    // (the schema comment says so), which is why businessRecordId maps onto it
    // rather than needing a column of its own.
    if (req.method === 'POST' && !checklistId && pathParts[0] === 'checklists') {
      const body = await req.json();

      const pick = (...keys: string[]) => {
        for (const k of keys)
          if (body[k] !== undefined && body[k] !== null && body[k] !== '') {
            return body[k];
          }
        return undefined;
      };

      const customerId = pick(
        'customerId',
        'customer_id',
        'businessRecordId',
        'business_record_id',
      );
      const checklistTitle = pick('checklistTitle', 'checklist_title');
      const installationType = pick('installationType', 'installation_type');

      // 400 naming the field beats a 23502 the caller reads as "server error".
      const missing: string[] = [];
      if (!checklistTitle) missing.push('checklistTitle');
      if (!installationType) missing.push('installationType');
      if (!customerId) missing.push('customerId');
      if (missing.length > 0) {
        return createCorsResponse(
          { error: `Missing required field(s): ${missing.join(', ')}`, missing },
          400,
          req,
        );
      }

      // installation_type is a Postgres enum. A value outside it is a 22P02,
      // which reads as a server fault rather than a bad request.
      if (!INSTALLATION_TYPES.includes(installationType)) {
        return createCorsResponse(
          {
            error: `installationType must be one of: ${INSTALLATION_TYPES.join(', ')}`,
            received: installationType,
          },
          400,
          req,
        );
      }

      const checklistData: Record<string, unknown> = {
        tenant_id: tenantId,
        customer_id: customerId,
        quote_id: pick('quoteId', 'quote_id') ?? null,
        order_id: pick('orderId', 'order_id') ?? null,
        checklist_title: checklistTitle,
        description: pick('description') ?? null,
        status: pick('status') ?? 'draft',
        installation_type: installationType,
        customer_data: pick('customerData', 'customer_data') ?? null,
        site_information: pick('siteInformation', 'site_information') ?? null,
        equipment_details: pick('equipmentDetails', 'equipment_details', 'equipment') ?? null,
        scheduled_install_date:
          pick('scheduledInstallDate', 'scheduled_install_date', 'installationDate') ?? null,
        assigned_technician_id:
          pick('assignedTechnicianId', 'assigned_technician_id', 'assignedTo') ?? null,
        estimated_duration: toInt(pick('estimatedDuration', 'estimated_duration')),
        access_requirements: pick('accessRequirements', 'access_requirements') ?? null,
        business_hours: pick('businessHours', 'business_hours') ?? null,
        special_instructions: pick('specialInstructions', 'special_instructions') ?? null,
        created_by: user.id,
        last_modified_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: checklist, error } = await admin
        .from('equipment_onboarding_checklists')
        .insert(checklistData)
        .select()
        .single();

      if (error) {
        console.error('Error creating checklist:', error);
        return createCorsResponse(
          { error: 'Failed to create checklist', details: error },
          500,
          req,
        );
      }

      // `notes` has no column. description and special_instructions do, and
      // guessing which one a caller meant would put the text somewhere it may
      // not belong, so it is reported rather than silently placed or dropped.
      const unpersisted =
        body.notes !== undefined
          ? ['notes: equipment_onboarding_checklists has description and special_instructions']
          : [];

      return createCorsResponse(
        unpersisted.length > 0 ? { ...checklist, unpersisted } : checklist,
        201,
        req,
      );
    }

    // POST /onboarding/:id/equipment - Add equipment to checklist
    if (req.method === 'POST' && checklistId && subResource === 'equipment') {
      const body = await req.json();

      // AUDIT-037: this wrote model_number, installation_location, ip_address
      // and is_primary - none of them columns - and never set manufacturer or
      // model, which are both NOT NULL. Of the nine fields OnboardingDetails'
      // dialog sends, only serialNumber landed, so adding equipment to a
      // checklist has never worked. The dialog already uses the real names.
      const val = (...keys: string[]) => {
        for (const k of keys)
          if (body[k] !== undefined && body[k] !== null && body[k] !== '') {
            return body[k];
          }
        return undefined;
      };

      const manufacturer = val('manufacturer');
      const model = val('model', 'modelNumber', 'model_number');
      const missingEquipment: string[] = [];
      if (!manufacturer) missingEquipment.push('manufacturer');
      if (!model) missingEquipment.push('model');
      if (missingEquipment.length > 0) {
        return createCorsResponse(
          {
            error: `Missing required field(s): ${missingEquipment.join(', ')}`,
            missing: missingEquipment,
          },
          400,
          req,
        );
      }

      const equipmentData: Record<string, unknown> = {
        tenant_id: tenantId,
        checklist_id: checklistId,
        equipment_id: val('equipmentId', 'equipment_id') ?? null,
        manufacturer,
        model,
        serial_number: val('serialNumber', 'serial_number') ?? null,
        asset_tag: val('assetTag', 'asset_tag') ?? null,
        target_ip_address:
          val('targetIpAddress', 'target_ip_address', 'ipAddress', 'ip_address') ?? null,
        hostname: val('hostname') ?? null,
        mac_address: val('macAddress', 'mac_address') ?? null,
        network_assignment: val('networkAssignment', 'network_assignment') ?? null,
        building_location: val('buildingLocation', 'building_location') ?? null,
        room_location: val('roomLocation', 'room_location') ?? null,
        specific_location:
          val('specificLocation', 'specific_location', 'installationLocation') ?? null,
        is_replacement: body.isReplacement === true || body.is_replacement === true,
        old_equipment_data: val('oldEquipmentData', 'old_equipment_data') ?? null,
        install_notes: val('installNotes', 'install_notes') ?? null,
      };

      const { data: equipment, error } = await admin
        .from('onboarding_equipment')
        .insert(equipmentData)
        .select()
        .single();

      if (error) {
        console.error('Error adding equipment:', error);
        return createCorsResponse({ error: 'Failed to add equipment' }, 500, req);
      }

      // No is_primary column. Which of several devices on a site is "primary"
      // is not something this table records, and adding a column for a flag
      // nothing reads would be inventing the behaviour.
      const unpersistedEquipment =
        body.isPrimary !== undefined || body.is_primary !== undefined
          ? ['isPrimary: onboarding_equipment does not record a primary device']
          : [];

      return createCorsResponse(
        unpersistedEquipment.length > 0
          ? { ...equipment, unpersisted: unpersistedEquipment }
          : equipment,
        201,
        req,
      );
    }

    // POST /onboarding/:id/sections - Add section to checklist
    if (req.method === 'POST' && checklistId && subResource === 'sections') {
      const body = await req.json();

      // Real columns: section_order, section_description. There is no
      // order_index and no section_content, so this insert always 42703'd.
      const sectionData = {
        tenant_id: tenantId,
        checklist_id: checklistId,
        section_title: body.sectionTitle || body.section_title,
        section_description: body.sectionContent || body.section_content || null,
        section_order: body.orderIndex || body.order_index || 0,
      };

      const { data: section, error } = await admin
        .from('onboarding_dynamic_sections')
        .insert(sectionData)
        .select()
        .single();

      if (error) {
        console.error('Error adding section:', error);
        return createCorsResponse({ error: 'Failed to add section' }, 500, req);
      }

      return createCorsResponse(section, 201, req);
    }

    // POST /onboarding/:id/tasks - Add task to checklist
    if (req.method === 'POST' && checklistId && subResource === 'tasks') {
      const body = await req.json();

      // onboarding_tasks has no ordering column of its own — it sequences by
      // section_id then priority — and completion is the `status` string, not an
      // is_completed flag with a completed_by. All four of those names were
      // 42703s. taskOrder is reported below rather than dropped silently.
      const taskData = {
        tenant_id: tenantId,
        checklist_id: checklistId,
        task_title: body.taskTitle || body.task_title,
        task_description: body.taskDescription || body.task_description || null,
        priority: body.priority || 'medium',
        status: 'pending',
        completed_at: null,
      };

      const { data: task, error } = await admin
        .from('onboarding_tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) {
        console.error('Error adding task:', error);
        return createCorsResponse({ error: 'Failed to add task' }, 500, req);
      }

      const unpersisted =
        body.taskOrder !== undefined || body.task_order !== undefined
          ? ['taskOrder: onboarding_tasks sequences by section_id + priority, not an order column']
          : [];

      return createCorsResponse(unpersisted.length > 0 ? { ...task, unpersisted } : task, 201, req);
    }

    // PATCH /onboarding/:id - Update checklist
    if ((req.method === 'PATCH' || req.method === 'PUT') && checklistId && !subResource) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // AUDIT-037: three of the four entries here named columns that do not
      // exist, so any edit touching one lost the whole update - including a
      // status change sent in the same request.
      const fieldMap: Record<string, string> = {
        status: 'status',
        checklistTitle: 'checklist_title',
        description: 'description',
        installationType: 'installation_type',
        customerData: 'customer_data',
        siteInformation: 'site_information',
        equipmentDetails: 'equipment_details',
        scheduledInstallDate: 'scheduled_install_date',
        actualInstallDate: 'actual_install_date',
        assignedTechnicianId: 'assigned_technician_id',
        assignedTo: 'assigned_technician_id',
        installationDate: 'scheduled_install_date',
        estimatedDuration: 'estimated_duration',
        accessRequirements: 'access_requirements',
        businessHours: 'business_hours',
        specialInstructions: 'special_instructions',
        completedSections: 'completed_sections',
        totalSections: 'total_sections',
        progressPercentage: 'progress_percentage',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      if (
        updateData.installation_type !== undefined &&
        !INSTALLATION_TYPES.includes(updateData.installation_type as string)
      ) {
        return createCorsResponse(
          {
            error: `installationType must be one of: ${INSTALLATION_TYPES.join(', ')}`,
            received: updateData.installation_type,
          },
          400,
          req,
        );
      }

      updateData.last_modified_by = user.id;

      const { data: checklist, error } = await admin
        .from('equipment_onboarding_checklists')
        .update(updateData)
        .eq('id', checklistId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating checklist:', error);
        return createCorsResponse({ error: 'Failed to update checklist' }, 500, req);
      }

      return createCorsResponse(checklist, 200, req);
    }

    // DELETE /onboarding/:id - Delete checklist
    if (req.method === 'DELETE' && checklistId && !subResource) {
      const { error } = await admin
        .from('equipment_onboarding_checklists')
        .delete()
        .eq('id', checklistId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting checklist:', error);
        return createCorsResponse({ error: 'Failed to delete checklist' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Checklist deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Invalid onboarding endpoint' }, 400, req);
  } catch (error) {
    console.error('Error in onboarding function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
