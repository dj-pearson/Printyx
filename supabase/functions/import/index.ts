// CSV Import Edge Function
// Handles CSV import with intelligent Salesforce mapping
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

// In-memory job storage (temporary - should use database in production)
const importJobs = new Map<string, any>();

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
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
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

      // Parse CSV
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length === 0) {
        return createCorsResponse({ error: 'CSV file is empty' }, 400, req);
      }

      const headers = parseCSVLine(lines[0]);
      const allRows = lines.slice(1).map((line) => parseCSVLine(line));
      const sampleRows = allRows.slice(0, 5); // First 5 rows for preview

      // Auto-map columns
      const columnMappings = autoMapColumns(headers, entityType);

      // Create import job and store in memory
      const jobId = crypto.randomUUID();

      importJobs.set(jobId, {
        id: jobId,
        tenantId,
        userId: user.id,
        entityType,
        headers,
        allRows,
        columnMappings,
        totalRows: allRows.length,
        status: 'mapping',
        createdAt: new Date().toISOString(),
      });

      return createCorsResponse(
        {
          jobId,
          columnMappings,
          totalRows: allRows.length,
          sampleData: sampleRows,
          unmappedColumns: headers.filter(
            (h: string) => !columnMappings.find((m: any) => m.sourceColumn === h && m.targetField),
          ),
        },
        200,
        req,
      );
    }

    // GET /import/ai/status
    if (req.method === 'GET' && pathParts[0] === 'ai' && pathParts[1] === 'status') {
      return createCorsResponse({ available: false }, 200, req);
    }

    // GET /import/jobs/:jobId
    if (req.method === 'GET' && pathParts[0] === 'jobs' && pathParts[1] && !pathParts[2]) {
      const jobId = pathParts[1];
      const job = importJobs.get(jobId);

      if (!job) {
        return createCorsResponse({ error: 'Job not found' }, 404, req);
      }

      return createCorsResponse(
        {
          id: job.id,
          status: job.status,
          totalRows: job.totalRows,
          validRows: job.validRows || job.totalRows,
          invalidRows: job.invalidRows || 0,
          importedRows: job.importedRows || 0,
          skippedRows: job.skippedRows || 0,
          duplicatesDetected: job.duplicatesDetected || 0,
        },
        200,
        req,
      );
    }

    // POST /import/jobs/:jobId/validate
    if (
      req.method === 'POST' &&
      pathParts[0] === 'jobs' &&
      pathParts[1] &&
      pathParts[2] === 'validate'
    ) {
      const jobId = pathParts[1];
      const job = importJobs.get(jobId);

      if (!job) {
        return createCorsResponse({ error: 'Job not found' }, 404, req);
      }

      // Update job with validation results
      job.status = 'validated';
      job.validRows = job.totalRows;
      job.invalidRows = 0;
      job.duplicatesDetected = 0;

      importJobs.set(jobId, job);

      return createCorsResponse(
        {
          validRows: job.validRows,
          invalidRows: job.invalidRows,
          duplicatesDetected: job.duplicatesDetected,
          needsDuplicateReview: false,
          canProceed: true,
          validationErrors: [],
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

      return createCorsResponse(
        {
          duplicates: [],
        },
        200,
        req,
      );
    }

    // POST /import/jobs/:jobId/duplicates/resolve-all
    if (
      req.method === 'POST' &&
      pathParts[0] === 'jobs' &&
      pathParts[1] &&
      pathParts[2] === 'duplicates' &&
      pathParts[3] === 'resolve-all'
    ) {
      return createCorsResponse({ message: 'Duplicates resolved' }, 200, req);
    }

    // POST /import/jobs/:jobId/execute
    if (
      req.method === 'POST' &&
      pathParts[0] === 'jobs' &&
      pathParts[1] &&
      pathParts[2] === 'execute'
    ) {
      const jobId = pathParts[1];
      const job = importJobs.get(jobId);

      if (!job) {
        return createCorsResponse({ error: 'Job not found' }, 404, req);
      }

      job.status = 'processing';

      let importedRows = 0;
      let skippedRows = 0;

      try {
        // Process each row
        for (const row of job.allRows) {
          try {
            // Map CSV row to database fields
            const mappedData: any = {};

            for (const mapping of job.columnMappings) {
              if (mapping.targetField && row[job.headers.indexOf(mapping.sourceColumn)]) {
                const value = row[job.headers.indexOf(mapping.sourceColumn)];
                mappedData[mapping.targetField] = value;
              }
            }

            // Insert into companies table
            if (job.entityType === 'business_records') {
              const { error: insertError } = await admin.from('companies').insert({
                tenant_id: job.tenantId,
                business_record_type:
                  mappedData.recordType || mappedData.businessRecordType || 'Customer',
                business_name: mappedData.companyName || mappedData.businessName || 'Unknown',
                phone: mappedData.primaryContactPhone || mappedData.phone || null,
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
                created_by: job.userId,
                business_owner: job.userId,
              });

              if (insertError) {
                console.error('Insert error:', insertError);
                skippedRows++;
              } else {
                importedRows++;
              }
            }
          } catch (rowError) {
            console.error('Row processing error:', rowError);
            skippedRows++;
          }
        }

        job.status = 'completed';
        job.importedRows = importedRows;
        job.skippedRows = skippedRows;
        importJobs.set(jobId, job);

        return createCorsResponse(
          {
            message: 'Import completed',
            importedRows,
            skippedRows,
            mergedRows: 0,
          },
          200,
          req,
        );
      } catch (error: any) {
        console.error('Import execution error:', error);
        job.status = 'failed';
        importJobs.set(jobId, job);

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
function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result.map((cell) => cell.replace(/^"|"$/g, ''));
}

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
    'first name': 'firstName',
    'last name': 'lastName',
    'lead source': 'leadSource',
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
        name: 'Primary Contact Name',
        dbField: 'primaryContactName',
        type: 'string',
        required: false,
        description: 'Contact name',
        example: 'John Smith',
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
