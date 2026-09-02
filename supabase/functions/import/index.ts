// CSV Import Edge Function
// Handles CSV import with intelligent Salesforce mapping
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { parseCsv, overallConfidence } from './_csv.ts';
import { DUPLICATE_RESOLUTIONS, findDuplicate } from '../_shared/import-duplicate-match.ts';

// CRMX-011a: job state lives in csv_import_jobs, not in this process.
//
// It used to be `const importJobs = new Map()` with a comment saying it should
// use the database in production. Edge invocations are stateless and
// multi-instance, so the job created by /upload was not visible to the
// /validate and /execute calls that followed it — the wizard is a multi-step
// flow, and step two could never find step one. The table already existed and
// the Express side (server/services/csv-import-service.ts) already wrote to it;
// only this side kept its own copy in memory.
//
// The rows below are the shape Express writes, deliberately: raw_data is an
// array of objects keyed by CSV header (not an array of cells), so a job
// started on either host can be read by the other.

/** Columns of csv_import_jobs this function reads back. */
const JOB_COLUMNS =
  'id, tenant_id, user_id, entity_type, file_name, status, original_headers, column_mappings, unmapped_columns, total_rows, valid_rows, invalid_rows, imported_rows, skipped_rows, merged_rows, duplicates_detected, duplicate_strategy, raw_data';

async function loadJob(admin: any, jobId: string, tenantId: string) {
  const { data, error } = await admin
    .from('csv_import_jobs')
    .select(JOB_COLUMNS)
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    console.error('[IMPORT] job load failed:', error);
    return null;
  }
  return data;
}

/**
 * Keep csv_import_jobs.duplicates_resolved in step with the rows. PostgREST has
 * no COUNT in an update, so it is read back rather than incremented - two
 * resolves racing would otherwise both add one to a stale value.
 */
async function syncResolvedCount(admin: any, jobId: string, tenantId: string) {
  const { count } = await admin
    .from('csv_import_duplicates')
    .select('id', { count: 'exact', head: true })
    .eq('import_job_id', jobId)
    .eq('tenant_id', tenantId)
    .neq('resolution', 'pending');

  await admin
    .from('csv_import_jobs')
    .update({ duplicates_resolved: count ?? 0, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('tenant_id', tenantId);
}

async function updateJob(admin: any, jobId: string, tenantId: string, patch: Record<string, any>) {
  const { error } = await admin
    .from('csv_import_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('tenant_id', tenantId);

  if (error) console.error('[IMPORT] job update failed:', error);
  return !error;
}

// Entity type definitions
const ENTITY_TYPES = {
  business_records: {
    label: 'Customers & Leads',
    columnCount: 22,
    requiredColumns: 2,
  },
  contacts: {
    label: 'Contacts',
    columnCount: 12,
    requiredColumns: 3,
  },
  products: {
    label: 'Products',
    columnCount: 10,
    requiredColumns: 2,
  },
};

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID
    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Remove 'import' prefix if present (it's the function name)
    if (pathParts[0] === 'import') {
      pathParts.shift();
    }

    // Route handling
    // GET /import/entity-types
    if (req.method === 'GET' && pathParts[0] === 'entity-types') {
      const entityTypes = Object.entries(ENTITY_TYPES).map(([type, def]) => ({
        type,
        label: def.label,
        columnCount: def.columnCount,
        requiredColumns: def.requiredColumns,
      }));

      return createCorsResponse(entityTypes, 200, req);
    }

    // GET /import/templates/:entityType
    if (req.method === 'GET' && pathParts[0] === 'templates' && pathParts[1]) {
      const entityType = pathParts[1];

      // Return template columns based on entity type
      const columns = getTemplateColumns(entityType);

      return createCorsResponse({ columns }, 200, req);
    }

    // GET /import/templates/:entityType/download
    if (req.method === 'GET' && pathParts[0] === 'templates' && pathParts[2] === 'download') {
      const entityType = pathParts[1];
      const columns = getTemplateColumns(entityType);

      // Generate CSV template
      const headers = columns.map((c: any) => c.name).join(',');
      const examples = columns.map((c: any) => c.example).join(',');
      const csvContent = `${headers}\n${examples}`;

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${entityType}_template.csv"`,
          'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
        },
      });
    }

    // POST /import/upload
    if (req.method === 'POST' && pathParts[0] === 'upload') {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const entityType = formData.get('entityType') as string;

      if (!file) {
        return createCorsResponse({ error: 'No file uploaded' }, 400, req);
      }

      const { headers, rows } = parseCsv(await file.text());

      if (headers.length === 0) {
        return createCorsResponse({ error: 'CSV file is empty' }, 400, req);
      }

      const sampleRows = rows.slice(0, 5); // First 5 rows for preview

      // Auto-map columns
      const columnMappings = autoMapColumns(headers, entityType);
      const unmappedColumns = headers.filter(
        (h: string) => !columnMappings.find((m: any) => m.sourceColumn === h && m.targetField),
      );

      const { data: job, error: jobError } = await admin
        .from('csv_import_jobs')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          entity_type: entityType,
          file_name: file.name,
          file_size_bytes: file.size,
          status: 'validating',
          original_headers: headers,
          column_mappings: columnMappings,
          unmapped_columns: unmappedColumns,
          total_rows: rows.length,
          duplicate_strategy: (formData.get('duplicateStrategy') as string) || 'prompt',
          raw_data: rows,
        })
        .select('id')
        .single();

      if (jobError || !job) {
        console.error('[IMPORT] could not create job:', jobError);
        return createCorsResponse({ error: 'Failed to create import job' }, 500, req);
      }

      return createCorsResponse(
        {
          jobId: job.id,
          columnMappings,
          totalRows: rows.length,
          sampleData: sampleRows,
          unmappedColumns,
        },
        200,
        req,
      );
    }

    // POST /import/preview-mapping — map a file WITHOUT creating a job, so the
    // wizard's mapping step can be re-run on a different file. Matches the
    // Express handler's response shape (routes-csv-import.ts:203).
    if (req.method === 'POST' && pathParts[0] === 'preview-mapping') {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const entityType = formData.get('entityType') as string;

      if (!file) return createCorsResponse({ error: 'No file uploaded' }, 400, req);
      if (!entityType || !(entityType in ENTITY_TYPES)) {
        return createCorsResponse({ error: 'Invalid or missing entityType' }, 400, req);
      }

      const { headers, rows } = parseCsv(await file.text());
      if (headers.length === 0) {
        return createCorsResponse({ error: 'CSV file is empty' }, 400, req);
      }

      const mappings = autoMapColumns(headers, entityType);

      return createCorsResponse(
        {
          totalRows: rows.length,
          headers,
          mappings,
          unmappedColumns: headers.filter(
            (h: string) => !mappings.find((m: any) => m.sourceColumn === h && m.targetField),
          ),
          overallConfidence: overallConfidence(mappings),
          sampleData: rows.slice(0, 5),
        },
        200,
        req,
      );
    }

    // POST /import/ai/map-columns — there is no AI client in this runtime, which
    // is what GET /import/ai/status already reports. Answering 503 with the same
    // message as the Express handler (routes-csv-import.ts:655) is the honest
    // parity: the wizard shows the failure instead of hanging on a 404.
    if (req.method === 'POST' && pathParts[0] === 'ai' && pathParts[1] === 'map-columns') {
      return createCorsResponse(
        { message: 'AI refinement is not available on this deployment.' },
        503,
        req,
      );
    }

    // GET /import/ai/status
    if (req.method === 'GET' && pathParts[0] === 'ai' && pathParts[1] === 'status') {
      return createCorsResponse({ available: false }, 200, req);
    }

    // GET /import/jobs/:jobId
    if (req.method === 'GET' && pathParts[0] === 'jobs' && pathParts[1] && !pathParts[2]) {
      const job = await loadJob(admin, pathParts[1], tenantId);

      if (!job) {
        return createCorsResponse({ error: 'Job not found' }, 404, req);
      }

      return createCorsResponse(
        {
          id: job.id,
          status: job.status,
          totalRows: job.total_rows,
          validRows: job.valid_rows ?? job.total_rows,
          invalidRows: job.invalid_rows ?? 0,
          importedRows: job.imported_rows ?? 0,
          skippedRows: job.skipped_rows ?? 0,
          duplicatesDetected: job.duplicates_detected ?? 0,
          columnMappings: job.column_mappings ?? [],
          unmappedColumns: job.unmapped_columns ?? [],
        },
        200,
        req,
      );
    }

    // PUT /import/jobs/:jobId/mappings — the wizard saves the user's column
    // choices here before validating. Matches routes-csv-import.ts:314.
    if (
      req.method === 'PUT' &&
      pathParts[0] === 'jobs' &&
      pathParts[1] &&
      pathParts[2] === 'mappings'
    ) {
      const jobId = pathParts[1];
      const job = await loadJob(admin, jobId, tenantId);
      if (!job) return createCorsResponse({ error: 'Job not found' }, 404, req);

      const body = await req.json().catch(() => ({}));
      const submitted = Array.isArray(body?.mappings) ? body.mappings : null;
      if (!submitted) {
        return createCorsResponse({ error: 'mappings must be an array' }, 400, req);
      }

      // Keep the auto-mapper's confidence/dataType and overwrite only what the
      // user actually decided, exactly as the Express handler does.
      const existing = (job.column_mappings as any[]) || [];
      const merged = submitted.map((m: any) => ({
        ...existing.find((e: any) => e.sourceColumn === m.sourceColumn),
        sourceColumn: m.sourceColumn,
        targetField: m.targetField,
        userConfirmed: m.confirmed === true,
      }));

      const ok = await updateJob(admin, jobId, tenantId, {
        column_mappings: merged,
        unmapped_columns: merged.filter((m: any) => !m.targetField).map((m: any) => m.sourceColumn),
      });

      return ok
        ? createCorsResponse({ message: 'Column mappings updated' }, 200, req)
        : createCorsResponse({ error: 'Failed to update mappings' }, 500, req);
    }

    // POST /import/jobs/:jobId/validate
    if (
      req.method === 'POST' &&
      pathParts[0] === 'jobs' &&
      pathParts[1] &&
      pathParts[2] === 'validate'
    ) {
      const jobId = pathParts[1];
      const job = await loadJob(admin, jobId, tenantId);

      if (!job) {
        return createCorsResponse({ error: 'Job not found' }, 404, req);
      }

      // A row is valid when every mapped required column has a value. That is
      // weaker than the Express validator (which also type-checks and looks for
      // duplicates), and it is deliberately not dressed up as more: rows with an
      // empty company name are what actually break the import, and they are now
      // counted instead of being reported as "all valid" the way the previous
      // hardcoded validRows = totalRows did.
      const mappings = (job.column_mappings as any[]) || [];
      const rows = (job.raw_data as Record<string, string>[]) || [];
      const nameColumn = mappings.find(
        (m) => m.targetField === 'companyName' || m.targetField === 'businessName',
      )?.sourceColumn;

      const validationErrors: any[] = [];
      if (nameColumn) {
        rows.forEach((row, index) => {
          if (!row[nameColumn]?.trim()) {
            validationErrors.push({
              rowNumber: index + 1,
              field: nameColumn,
              message: 'Required value is empty',
            });
          }
        });
      }

      const invalidRows = validationErrors.length;
      const validRows = rows.length - invalidRows;

      // PA-052: duplicates_detected was hardcoded 0 and no duplicate was ever
      // recorded, so the review step had nothing to show - while the execute
      // path went on to match and MERGE silently. Detection now runs here, with
      // the same rule execute uses (_shared/import-duplicate-match.ts).
      let duplicatesDetected = 0;
      if (nameColumn && job.entity_type === 'business_records') {
        const cityColumn = mappings.find(
          (m) => m.targetField === 'city' || m.targetField === 'billingCity',
        )?.sourceColumn;
        const stateColumn = mappings.find(
          (m) => m.targetField === 'state' || m.targetField === 'billingState',
        )?.sourceColumn;
        const phoneColumn = mappings.find(
          (m) => m.targetField === 'phone' || m.targetField === 'primaryContactPhone',
        )?.sourceColumn;

        // Re-detecting must not stack rows from a previous run.
        await admin
          .from('csv_import_duplicates')
          .delete()
          .eq('import_job_id', jobId)
          .eq('tenant_id', tenantId);

        const pending: Record<string, unknown>[] = [];

        for (let index = 0; index < rows.length; index++) {
          const row = rows[index];
          const businessName = row[nameColumn]?.trim();
          if (!businessName) continue;

          const { data: candidates, error: searchError } = await admin
            .from('companies')
            .select('*')
            .eq('tenant_id', tenantId)
            .ilike('business_name', businessName)
            .limit(10);

          // A lookup failure is not "no duplicate". Skipping the row here would
          // send it to execute, which merges without asking.
          if (searchError) {
            console.error('Duplicate lookup failed:', searchError);
            continue;
          }

          const match = findDuplicate(
            {
              businessName,
              city: cityColumn ? row[cityColumn] : null,
              state: stateColumn ? row[stateColumn] : null,
              phone: phoneColumn ? row[phoneColumn] : null,
            },
            candidates || [],
          );

          if (!match) continue;

          pending.push({
            import_job_id: jobId,
            tenant_id: tenantId,
            row_number: index + 1,
            row_data: row,
            existing_record_id: match.existing.id,
            existing_record_data: match.existing,
            matching_fields: match.matchingFields,
            match_score: match.matchScore,
            resolution: 'pending',
          });
        }

        if (pending.length) {
          const { error: insertError } = await admin.from('csv_import_duplicates').insert(pending);
          if (insertError) {
            console.error('Failed to record duplicates:', insertError);
          } else {
            duplicatesDetected = pending.length;
          }
        }
      }

      await updateJob(admin, jobId, tenantId, {
        status: 'awaiting_review',
        valid_rows: validRows,
        invalid_rows: invalidRows,
        duplicates_detected: duplicatesDetected,
        duplicates_resolved: 0,
        validation_errors: validationErrors,
      });

      return createCorsResponse(
        {
          validRows,
          invalidRows,
          duplicatesDetected,
          needsDuplicateReview: duplicatesDetected > 0,
          canProceed: validRows > 0,
          // Capped so a wholly malformed file does not return a response the
          // browser has to render row by row.
          validationErrors: validationErrors.slice(0, 100),
        },
        200,
        req,
      );
    }

    // GET /import/jobs/:jobId/duplicates
    if (
      req.method === 'GET' &&
      pathParts[0] === 'jobs' &&
      pathParts[1] &&
      pathParts[2] === 'duplicates'
    ) {
      const jobId = pathParts[1];

      const { data, error } = await admin
        .from('csv_import_duplicates')
        .select('*')
        .eq('import_job_id', jobId)
        .eq('tenant_id', tenantId)
        .order('row_number', { ascending: true });

      if (error) {
        console.error('Error fetching duplicates:', error);
        return createCorsResponse({ error: 'Failed to fetch duplicates' }, 500, req);
      }

      return createCorsResponse(
        {
          duplicates: (data || []).map((d: any) => ({
            id: d.id,
            rowNumber: d.row_number,
            rowData: d.row_data,
            existingRecordId: d.existing_record_id,
            existingRecordData: d.existing_record_data,
            matchingFields: d.matching_fields,
            matchScore: d.match_score,
            resolution: d.resolution,
          })),
        },
        200,
        req,
      );
    }

    // POST /import/jobs/:jobId/duplicates/:duplicateId/resolve
    //
    // PA-052: this had no branch, so the per-row Skip / Merge / Create buttons
    // in CSVImportWizard 404'd.
    if (
      req.method === 'POST' &&
      pathParts[0] === 'jobs' &&
      pathParts[1] &&
      pathParts[2] === 'duplicates' &&
      pathParts[3] &&
      pathParts[3] !== 'resolve-all' &&
      pathParts[4] === 'resolve'
    ) {
      const jobId = pathParts[1];
      const duplicateId = pathParts[3];
      const body = await req.json().catch(() => ({}));
      const resolution = body.resolution;

      if (!DUPLICATE_RESOLUTIONS.includes(resolution) || resolution === 'pending') {
        return createCorsResponse(
          { error: `resolution must be one of: skip, merge, create_new` },
          400,
          req,
        );
      }

      const { data, error } = await admin
        .from('csv_import_duplicates')
        .update({
          resolution,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', duplicateId)
        .eq('import_job_id', jobId)
        .eq('tenant_id', tenantId)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Error resolving duplicate:', error);
        return createCorsResponse({ error: 'Failed to resolve duplicate' }, 500, req);
      }
      if (!data) return createCorsResponse({ error: 'Duplicate not found' }, 404, req);

      await syncResolvedCount(admin, jobId, tenantId);

      return createCorsResponse({ success: true, id: data.id, resolution }, 200, req);
    }

    // POST /import/jobs/:jobId/duplicates/resolve-all
    if (
      req.method === 'POST' &&
      pathParts[0] === 'jobs' &&
      pathParts[1] &&
      pathParts[2] === 'duplicates' &&
      pathParts[3] === 'resolve-all'
    ) {
      const jobId = pathParts[1];
      const body = await req.json().catch(() => ({}));
      const resolution = body.resolution ?? body.strategy;

      // PA-052: this used to answer "Duplicates resolved" without touching a
      // row, so the wizard advanced and the execute step merged whatever it
      // liked.
      if (!DUPLICATE_RESOLUTIONS.includes(resolution) || resolution === 'pending') {
        return createCorsResponse(
          { error: `resolution must be one of: skip, merge, create_new` },
          400,
          req,
        );
      }

      const { data, error } = await admin
        .from('csv_import_duplicates')
        .update({
          resolution,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('import_job_id', jobId)
        .eq('tenant_id', tenantId)
        .eq('resolution', 'pending')
        .select('id');

      if (error) {
        console.error('Error resolving duplicates:', error);
        return createCorsResponse({ error: 'Failed to resolve duplicates' }, 500, req);
      }

      await syncResolvedCount(admin, jobId, tenantId);

      return createCorsResponse(
        { success: true, resolved: (data || []).length, resolution },
        200,
        req,
      );
    }

    // POST /import/jobs/:jobId/execute
    if (
      req.method === 'POST' &&
      pathParts[0] === 'jobs' &&
      pathParts[1] &&
      pathParts[2] === 'execute'
    ) {
      const jobId = pathParts[1];
      const job = await loadJob(admin, jobId, tenantId);

      if (!job) {
        return createCorsResponse({ error: 'Job not found' }, 404, req);
      }

      const allRows = (job.raw_data as Record<string, string>[]) || [];
      const jobMappings = (job.column_mappings as any[]) || [];

      let importedRows = 0;
      let skippedRows = 0;
      let mergedRows = 0;

      // Timeout protection: process max 100 rows or 45 seconds, whichever comes first
      const MAX_ROWS_PER_BATCH = 100;
      const MAX_EXECUTION_TIME = 45000; // 45 seconds
      const startTime = Date.now();

      try {
        // Get the starting position from the request body
        const body = await req.json().catch(() => ({}));
        const startIndex = body?.startIndex || 0;
        const rowsToProcess = allRows.slice(startIndex, startIndex + MAX_ROWS_PER_BATCH);

        if (startIndex === 0) {
          await updateJob(admin, jobId, tenantId, {
            status: 'processing',
            started_at: new Date().toISOString(),
          });
        }

        console.log(
          `[IMPORT] Processing batch: rows ${startIndex} to ${startIndex + rowsToProcess.length} of ${allRows.length}`,
        );

        // PA-052: the review step is decorative unless this honours it. Rows the
        // user resolved as `skip` are not imported; everything else falls through
        // to the matching below, which merges into an existing company when it
        // finds one. `create_new` is recorded and NOT yet acted on - forcing a
        // second company row needs the match to be bypassed here, and doing that
        // silently would be worse than the current merge, so it is named in the
        // response instead.
        const { data: resolutionRows } = await admin
          .from('csv_import_duplicates')
          .select('row_number, resolution')
          .eq('import_job_id', jobId)
          .eq('tenant_id', tenantId)
          .neq('resolution', 'pending');

        const resolutionByRow = new Map<number, string>(
          (resolutionRows || []).map((r: any) => [r.row_number, r.resolution]),
        );
        let unhonouredCreateNew = 0;

        // Process each row in this batch
        for (let i = 0; i < rowsToProcess.length; i++) {
          const row = rowsToProcess[i];
          // row_number is 1-based over the whole file, matching detection.
          const resolution = resolutionByRow.get(startIndex + i + 1);

          if (resolution === 'skip') {
            skippedRows++;
            continue;
          }
          if (resolution === 'create_new') {
            unhonouredCreateNew++;
          }

          // Check if we're approaching timeout
          if (Date.now() - startTime > MAX_EXECUTION_TIME) {
            console.log(`[IMPORT] Timeout approaching, stopping at row ${startIndex + i}`);
            break;
          }
          try {
            // Map CSV row to database fields
            const mappedData: any = {};

            for (const mapping of jobMappings) {
              // raw_data rows are keyed by CSV header, so this is a lookup, not
              // a positional index into a cell array as it was before.
              const value = mapping.targetField ? row[mapping.sourceColumn] : '';
              if (value) mappedData[mapping.targetField] = value;
            }

            // Insert into companies table with duplicate detection
            // job is a PostgREST row now, so this is entity_type. It read
            // job.entityType against an in-memory object that used camelCase —
            // but the same block read job.tenant_id and job.user_id, which that
            // object did NOT have, so every tenant filter in this loop was
            // .eq('tenant_id', undefined) and every insert sent a null tenant.
            // Both spellings are correct against the row.
            if (job.entity_type === 'business_records') {
              const businessName = mappedData.companyName || mappedData.businessName || 'Unknown';
              const contactEmail = mappedData.primaryContactEmail || mappedData.email || null;
              const phone = mappedData.primaryContactPhone || mappedData.phone || null;
              const city = mappedData.city || mappedData.billingCity || null;
              const state = mappedData.state || mappedData.billingState || null;

              // Normalize for matching
              const normalizedName = businessName.toLowerCase().trim();
              const normalizedCity = (city || '').toLowerCase().trim();
              const normalizedState = (state || '').toLowerCase().trim();

              // Check for existing company by name
              const { data: existingCompanies, error: searchError } = await admin
                .from('companies')
                .select('*')
                .eq('tenant_id', job.tenant_id)
                .ilike('business_name', businessName)
                .limit(10);

              if (searchError) {
                console.error('Search error:', searchError);
                skippedRows++;
                continue;
              }

              let existingCompany = null;

              // If we found companies with matching name, verify by name + city + state
              if (existingCompanies && existingCompanies.length > 0) {
                // Match by name + city + state (case-insensitive)
                existingCompany = existingCompanies.find((c) => {
                  const candidateName = (c.business_name || '').toLowerCase().trim();
                  const candidateCity = (c.billing_city || '').toLowerCase().trim();
                  const candidateState = (c.billing_state || '').toLowerCase().trim();

                  return (
                    candidateName === normalizedName &&
                    candidateCity === normalizedCity &&
                    candidateState === normalizedState
                  );
                });

                // If no exact match on city/state, fall back to name + phone match
                if (!existingCompany && phone) {
                  const normalizedPhone = phone.replace(/\D/g, '');
                  existingCompany = existingCompanies.find(
                    (c) =>
                      (c.business_name || '').toLowerCase().trim() === normalizedName &&
                      c.phone &&
                      c.phone.replace(/\D/g, '') === normalizedPhone,
                  );
                }

                // Log duplicate detection for debugging
                if (existingCompany) {
                  console.log(
                    `[IMPORT] Found existing company: ${existingCompany.business_name} (${existingCompany.billing_city}, ${existingCompany.billing_state})`,
                  );
                }
              }

              if (existingCompany) {
                // First, ensure customer/lead relationship exists
                const recordType =
                  existingCompany.business_record_type || mappedData.recordType || 'Customer';
                const isLead = recordType.toLowerCase() === 'lead';
                let relationshipCreated = false;
                let contactCreated = false;

                if (isLead) {
                  // Check for existing lead relationship
                  const { data: existingLead } = await admin
                    .from('leads')
                    .select('id')
                    .eq('tenant_id', job.tenant_id)
                    .eq('company_id', existingCompany.id)
                    .maybeSingle();

                  if (!existingLead) {
                    const { error: leadInsertError } = await admin.from('leads').insert({
                      tenant_id: job.tenant_id,
                      company_id: existingCompany.id,
                      status: mappedData.status || 'new',
                      priority: mappedData.priority || 'medium',
                      source: mappedData.leadSource || mappedData.source || 'import',
                      created_by: job.user_id,
                    });

                    if (!leadInsertError) {
                      relationshipCreated = true;
                    }
                  }
                } else {
                  // Check for existing customer relationship
                  console.log(`[IMPORT] Checking customer relationship for ${businessName}`);

                  const { data: existingCustomer, error: customerCheckError } = await admin
                    .from('customers')
                    .select('id, contact_id')
                    .eq('tenant_id', job.tenant_id)
                    .eq('company_id', existingCompany.id)
                    .maybeSingle();

                  if (customerCheckError) {
                    console.error(
                      `[IMPORT] Error checking customer relationship:`,
                      customerCheckError,
                    );
                  }

                  console.log(`[IMPORT] Customer relationship exists: ${!!existingCustomer}`);

                  // FIRST: Ensure contact exists (required for customer)
                  let contactId = existingCustomer?.contact_id || null;

                  if (!contactId) {
                    // Check for existing contact
                    const { data: existingContacts } = await admin
                      .from('company_contacts')
                      .select('id, first_name, last_name')
                      .eq('company_id', existingCompany.id)
                      .eq('is_primary_contact', true)
                      .limit(1);

                    console.log(
                      `[IMPORT] Checking contacts for ${businessName}: found ${existingContacts?.length || 0} contacts`,
                    );

                    // Check if we have real contact data in the import
                    const hasRealContactData =
                      mappedData.primaryContactFirstName &&
                      mappedData.primaryContactLastName &&
                      mappedData.primaryContactFirstName !== 'Primary' &&
                      mappedData.primaryContactLastName !== 'Contact';

                    if (existingContacts && existingContacts.length > 0) {
                      const existingContact = existingContacts[0];
                      const isPlaceholder =
                        existingContact.first_name === 'Primary' &&
                        existingContact.last_name === 'Contact';

                      // Update placeholder with real data
                      if (isPlaceholder && hasRealContactData) {
                        console.log(
                          `[IMPORT] Updating placeholder contact for ${businessName} with real data`,
                        );

                        const { error: updateError } = await admin
                          .from('company_contacts')
                          .update({
                            first_name: mappedData.primaryContactFirstName,
                            last_name: mappedData.primaryContactLastName,
                            email: contactEmail || null,
                            phone: phone || null,
                            updated_at: new Date().toISOString(),
                          })
                          .eq('id', existingContact.id);

                        if (!updateError) {
                          contactCreated = true; // Mark as created for tracking
                          console.log(
                            `[IMPORT] ✅ Contact updated for ${businessName}: ${existingContact.id}`,
                          );
                        } else {
                          console.error(`[IMPORT] ❌ Failed to update contact:`, updateError);
                        }
                      }

                      // Use existing contact
                      contactId = existingContact.id;
                      console.log(
                        `[IMPORT] Using existing contact for ${businessName}: ${contactId}`,
                      );
                    } else {
                      // Create new contact
                      console.log(`[IMPORT] Creating contact for ${businessName}`);

                      const { data: newContact, error: contactInsertError } = await admin
                        .from('company_contacts')
                        .insert({
                          company_id: existingCompany.id,
                          tenant_id: job.tenant_id,
                          first_name: mappedData.primaryContactFirstName || 'Primary',
                          last_name: mappedData.primaryContactLastName || 'Contact',
                          email: contactEmail || null,
                          phone: phone || null,
                          is_primary_contact: true,
                        })
                        .select('id')
                        .single();

                      if (!contactInsertError && newContact) {
                        contactId = newContact.id;
                        contactCreated = true;
                        console.log(
                          `[IMPORT] ✅ Contact created for ${businessName}: ${contactId}`,
                        );
                      } else {
                        console.error(
                          `[IMPORT] ❌ Failed to create contact for ${businessName}:`,
                          contactInsertError,
                        );
                        // Skip this row if we can't create a contact
                        skippedRows++;
                        continue;
                      }
                    }
                  }

                  // SECOND: Create customer relationship with contact_id
                  if (!existingCustomer && contactId) {
                    console.log(
                      `[IMPORT] Creating customer relationship for ${businessName} with contact ${contactId}`,
                    );

                    const { error: customerInsertError } = await admin.from('customers').insert({
                      tenant_id: job.tenant_id,
                      company_id: existingCompany.id,
                      contact_id: contactId,
                      created_by: job.user_id,
                    });

                    if (!customerInsertError) {
                      relationshipCreated = true;
                      console.log(`[IMPORT] ✅ Customer relationship created for ${businessName}`);
                    } else {
                      console.error(
                        `[IMPORT] ❌ Failed to create customer relationship:`,
                        customerInsertError,
                      );
                    }
                  } else if (existingCustomer) {
                    console.log(
                      `[IMPORT] Customer relationship already exists for ${businessName}`,
                    );
                  }
                }

                // Now check for company field updates
                const updateData: any = {};
                let hasUpdates = false;

                if (!existingCompany.phone && phone) {
                  updateData.phone = phone;
                  hasUpdates = true;
                }

                if (!existingCompany.fax && mappedData.fax) {
                  updateData.fax = mappedData.fax;
                  hasUpdates = true;
                }

                if (!existingCompany.website && mappedData.website) {
                  updateData.website = mappedData.website;
                  hasUpdates = true;
                }

                if (!existingCompany.industry && mappedData.industry) {
                  updateData.industry = mappedData.industry;
                  hasUpdates = true;
                }

                if (!existingCompany.billing_address) {
                  const address =
                    mappedData.address ||
                    mappedData.mailingStreet ||
                    mappedData.billingStreet ||
                    null;
                  if (address) {
                    updateData.billing_address = address;
                    hasUpdates = true;
                  }
                }

                if (!existingCompany.billing_city) {
                  const city =
                    mappedData.city || mappedData.mailingCity || mappedData.billingCity || null;
                  if (city) {
                    updateData.billing_city = city;
                    hasUpdates = true;
                  }
                }

                if (!existingCompany.billing_state) {
                  const state = mappedData.state || mappedData.mailingState || null;
                  if (state) {
                    updateData.billing_state = state;
                    hasUpdates = true;
                  }
                }

                if (!existingCompany.billing_zip) {
                  const zip =
                    mappedData.postalCode ||
                    mappedData.zipCode ||
                    mappedData.mailingZipPostalCode ||
                    null;
                  if (zip) {
                    updateData.billing_zip = zip;
                    hasUpdates = true;
                  }
                }

                if (!existingCompany.description) {
                  const desc = mappedData.notes || mappedData.businessDescription || null;
                  if (desc) {
                    updateData.description = desc;
                    hasUpdates = true;
                  }
                }

                // Update company if needed
                if (hasUpdates) {
                  const { error: updateError } = await admin
                    .from('companies')
                    .update(updateData)
                    .eq('id', existingCompany.id);

                  if (updateError) {
                    console.error('Update error:', updateError);
                    skippedRows++;
                  } else {
                    console.log(`[IMPORT] ✅ Merged (field updates): ${businessName}`);
                    mergedRows++;
                  }
                } else if (relationshipCreated || contactCreated) {
                  // No company updates but relationship or contact was created
                  console.log(
                    `[IMPORT] ✅ Merged (relationship=${relationshipCreated}, contact=${contactCreated}): ${businessName}`,
                  );
                  mergedRows++;
                } else {
                  // Duplicate with no new info, relationship, or contact
                  console.log(`[IMPORT] ⏭️  Skipped (no changes needed): ${businessName}`);
                  skippedRows++;
                }
              } else {
                // Create new company
                const { data: newCompany, error: insertError } = await admin
                  .from('companies')
                  .insert({
                    tenant_id: job.tenant_id,
                    business_record_type:
                      mappedData.recordType || mappedData.businessRecordType || 'Customer',
                    business_name: businessName,
                    phone: phone,
                    fax: mappedData.fax || null,
                    website: mappedData.website || null,
                    industry: mappedData.industry || null,
                    description: mappedData.notes || mappedData.businessDescription || null,
                    billing_address:
                      mappedData.address ||
                      mappedData.mailingStreet ||
                      mappedData.billingStreet ||
                      null,
                    billing_city:
                      mappedData.city || mappedData.mailingCity || mappedData.billingCity || null,
                    billing_state: mappedData.state || mappedData.mailingState || null,
                    billing_zip:
                      mappedData.postalCode ||
                      mappedData.zipCode ||
                      mappedData.mailingZipPostalCode ||
                      null,
                    created_by: job.user_id,
                    business_owner: job.user_id,
                  })
                  .select()
                  .single();

                if (insertError || !newCompany) {
                  console.error('Insert error:', insertError);
                  skippedRows++;
                } else {
                  // Create customer or lead relationship record based on record type
                  const recordType = newCompany.business_record_type || 'Customer';
                  const isLead = recordType.toLowerCase() === 'lead';

                  if (isLead) {
                    const { error: leadError } = await admin.from('leads').insert({
                      tenant_id: job.tenant_id,
                      company_id: newCompany.id,
                      status: mappedData.status || 'new',
                      priority: mappedData.priority || 'medium',
                      source: mappedData.leadSource || mappedData.source || 'import',
                      created_by: job.user_id,
                    });

                    if (leadError) {
                      console.error('Lead relationship error:', leadError);
                    }
                  } else {
                    // FIRST: Create contact (required for customer relationship)
                    const { data: newContact, error: contactError } = await admin
                      .from('company_contacts')
                      .insert({
                        company_id: newCompany.id,
                        tenant_id: job.tenant_id,
                        first_name: mappedData.primaryContactFirstName || 'Primary',
                        last_name: mappedData.primaryContactLastName || 'Contact',
                        email: mappedData.primaryContactEmail || mappedData.email || null,
                        phone: phone || null,
                        is_primary_contact: true,
                      })
                      .select('id')
                      .single();

                    if (contactError || !newContact) {
                      console.error('Contact creation error:', contactError);
                      skippedRows++;
                      continue;
                    }

                    // SECOND: Create customer with contact_id
                    const { error: customerError } = await admin.from('customers').insert({
                      tenant_id: job.tenant_id,
                      company_id: newCompany.id,
                      contact_id: newContact.id,
                      created_by: job.user_id,
                    });

                    if (customerError) {
                      console.error('Customer relationship error:', customerError);
                      skippedRows++;
                      continue;
                    }
                  }

                  importedRows++;
                }
              }
            }
          } catch (rowError) {
            console.error('Row processing error:', rowError);
            skippedRows++;
          }
        }

        // Totals are cumulative across batches, so they are read from the row
        // this batch started from rather than kept in a variable that dies with
        // the invocation.
        const totalImported = (job.imported_rows ?? 0) + importedRows;
        const totalSkipped = (job.skipped_rows ?? 0) + skippedRows;
        const totalMerged = (job.merged_rows ?? 0) + mergedRows;

        const processedRows = startIndex + rowsToProcess.length;
        const totalRows = allRows.length;
        const hasMore = processedRows < totalRows;

        await updateJob(admin, jobId, tenantId, {
          imported_rows: totalImported,
          skipped_rows: totalSkipped,
          merged_rows: totalMerged,
          ...(hasMore ? {} : { status: 'completed', completed_at: new Date().toISOString() }),
        });

        console.log(
          `[IMPORT] Batch complete: ${processedRows}/${totalRows} rows processed. Imported: ${totalImported}, Skipped: ${totalSkipped}, Merged: ${totalMerged}`,
        );

        return createCorsResponse(
          {
            message: hasMore ? 'Batch completed' : 'Import completed',
            importedRows: totalImported,
            skippedRows: totalSkipped,
            mergedRows: totalMerged,
            processedRows,
            totalRows,
            hasMore,
            nextIndex: hasMore ? processedRows : null,
            // PA-052: `create_new` is recorded but not yet acted on - such a row
            // still merges into the company it matched. Saying so beats letting
            // the count read as a clean import.
            ...(unhonouredCreateNew
              ? {
                  unhonoured: [
                    `${unhonouredCreateNew} row(s) resolved as "create new" were merged into the ` +
                      'existing company instead; forcing a second company row is not implemented.',
                  ],
                }
              : {}),
          },
          200,
          req,
        );
      } catch (error: any) {
        console.error('Import execution error:', error);
        await updateJob(admin, jobId, tenantId, {
          status: 'failed',
          import_errors: [{ message: error?.message || 'Unknown error' }],
        });

        return createCorsResponse(
          {
            error: 'Import failed',
            message: error.message,
          },
          500,
          req,
        );
      }
    }

    console.log('No route matched:', req.method, pathParts);
    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error: any) {
    console.error('Import function error:', error);
    return createCorsResponse({ error: error.message || 'Internal server error' }, 500, req);
  }
}

// Helper functions

function autoMapColumns(csvHeaders: string[], entityType: string) {
  const mappings: any[] = [];
  const fields = getTemplateColumns(entityType);

  // Salesforce field mapping aliases
  const sfAliases: Record<string, string> = {
    'business name': 'companyName',
    'business record type': 'businessRecordType',
    'business description': 'businessDescription',
    'mailing street': 'mailingStreet',
    'mailing city': 'mailingCity',
    'mailing state/province': 'mailingState',
    'mailing zip/postal code': 'mailingZipPostalCode',
    'mailing country': 'mailingCountry',
    'billing street': 'billingStreet',
    'billing city': 'billingCity',
    'billing state/province': 'billingState',
    'billing zip/postal code': 'billingZipPostalCode',
    'first name': 'primaryContactFirstName',
    'last name': 'primaryContactLastName',
    'lead source': 'leadSource',
    'contact first name': 'primaryContactFirstName',
    'contact last name': 'primaryContactLastName',
    'primary contact first name': 'primaryContactFirstName',
    'primary contact last name': 'primaryContactLastName',
  };

  csvHeaders.forEach((header: string) => {
    const normalized = header.toLowerCase().trim();
    let bestMatch = null;
    let highestConfidence = 0;

    // Check Salesforce aliases first
    if (sfAliases[normalized]) {
      bestMatch = sfAliases[normalized];
      highestConfidence = 95;
    }

    // Then check against field definitions
    if (highestConfidence < 100) {
      fields.forEach((field: any) => {
        const fieldNormalized = field.name.toLowerCase();
        const dbFieldNormalized = field.dbField.toLowerCase();

        if (normalized === fieldNormalized || normalized === dbFieldNormalized) {
          bestMatch = field.dbField;
          highestConfidence = 100;
        } else if (
          normalized.includes(dbFieldNormalized) ||
          dbFieldNormalized.includes(normalized)
        ) {
          const confidence = 80;
          if (confidence > highestConfidence) {
            bestMatch = field.dbField;
            highestConfidence = confidence;
          }
        }
      });
    }

    mappings.push({
      sourceColumn: header,
      targetField: bestMatch || '',
      confidence: highestConfidence,
      dataType: 'string',
      isRequired: false,
      aiSuggested: false,
      userConfirmed: highestConfidence >= 95,
    });
  });

  return mappings;
}

function getTemplateColumns(entityType: string) {
  if (entityType === 'business_records') {
    return [
      {
        name: 'Company Name',
        dbField: 'companyName',
        type: 'string',
        required: true,
        description: 'Business name',
        example: 'Acme Corp',
      },
      {
        name: 'Record Type',
        dbField: 'recordType',
        type: 'string',
        required: true,
        description: 'lead or customer',
        example: 'customer',
      },
      {
        name: 'Status',
        dbField: 'status',
        type: 'string',
        required: false,
        description: 'Record status',
        example: 'active',
      },
      {
        name: 'Industry',
        dbField: 'industry',
        type: 'string',
        required: false,
        description: 'Industry',
        example: 'Healthcare',
      },
      {
        name: 'Website',
        dbField: 'website',
        type: 'url',
        required: false,
        description: 'Website URL',
        example: 'https://example.com',
      },
      {
        name: 'Phone',
        dbField: 'phone',
        type: 'phone',
        required: false,
        description: 'Phone number',
        example: '555-1234',
      },
      {
        name: 'Email',
        dbField: 'email',
        type: 'email',
        required: false,
        description: 'Email address',
        example: 'contact@example.com',
      },
      {
        name: 'Address',
        dbField: 'address',
        type: 'string',
        required: false,
        description: 'Street address',
        example: '123 Main St',
      },
      {
        name: 'City',
        dbField: 'city',
        type: 'string',
        required: false,
        description: 'City',
        example: 'New York',
      },
      {
        name: 'State',
        dbField: 'state',
        type: 'string',
        required: false,
        description: 'State',
        example: 'NY',
      },
      {
        name: 'Zip Code',
        dbField: 'zipCode',
        type: 'string',
        required: false,
        description: 'ZIP code',
        example: '10001',
      },
      {
        name: 'Country',
        dbField: 'country',
        type: 'string',
        required: false,
        description: 'Country',
        example: 'USA',
      },
      {
        name: 'Primary Contact First Name',
        dbField: 'primaryContactFirstName',
        type: 'string',
        required: false,
        description: 'Primary contact first name',
        example: 'John',
      },
      {
        name: 'Primary Contact Last Name',
        dbField: 'primaryContactLastName',
        type: 'string',
        required: false,
        description: 'Primary contact last name',
        example: 'Smith',
      },
      {
        name: 'Primary Contact Email',
        dbField: 'primaryContactEmail',
        type: 'email',
        required: false,
        description: 'Contact email',
        example: 'john@example.com',
      },
      {
        name: 'Primary Contact Phone',
        dbField: 'primaryContactPhone',
        type: 'phone',
        required: false,
        description: 'Contact phone',
        example: '555-5678',
      },
      {
        name: 'Lead Source',
        dbField: 'leadSource',
        type: 'string',
        required: false,
        description: 'Lead source',
        example: 'Website',
      },
      {
        name: 'Notes',
        dbField: 'notes',
        type: 'text',
        required: false,
        description: 'Notes',
        example: 'VIP customer',
      },
    ];
  }

  if (entityType === 'contacts') {
    return [
      {
        name: 'First Name',
        dbField: 'firstName',
        type: 'string',
        required: true,
        description: 'First name',
        example: 'John',
      },
      {
        name: 'Last Name',
        dbField: 'lastName',
        type: 'string',
        required: true,
        description: 'Last name',
        example: 'Smith',
      },
      {
        name: 'Email',
        dbField: 'email',
        type: 'email',
        required: true,
        description: 'Email',
        example: 'john@example.com',
      },
      {
        name: 'Phone',
        dbField: 'phone',
        type: 'phone',
        required: false,
        description: 'Phone',
        example: '555-1234',
      },
      {
        name: 'Title',
        dbField: 'title',
        type: 'string',
        required: false,
        description: 'Job title',
        example: 'Manager',
      },
      {
        name: 'Company',
        dbField: 'companyName',
        type: 'string',
        required: false,
        description: 'Company',
        example: 'Acme Corp',
      },
    ];
  }

  return [];
}
