// Import Export Edge Function
// Handles data import and export operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[1];
    const jobId = pathParts[2];

    // GET /import-export/jobs - List import/export jobs
    if (req.method === 'GET' && endpoint === 'jobs' && !jobId) {
      const jobType = url.searchParams.get('type');
      const status = url.searchParams.get('status');

      let query = admin
        .from('import_export_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (jobType) query = query.eq('job_type', jobType);
      if (status) query = query.eq('status', status);

      const { data: jobs, error } = await query.limit(50);

      if (error) {
        console.error('Error fetching jobs:', error);
        return createCorsResponse({ error: 'Failed to fetch jobs' }, 500, req);
      }

      return createCorsResponse(jobs || [], 200, req);
    }

    // GET /import-export/jobs/:id - Get job details
    if (req.method === 'GET' && endpoint === 'jobs' && jobId) {
      const { data: job, error } = await admin
        .from('import_export_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Job not found' }, 404, req);
      }

      return createCorsResponse(job, 200, req);
    }

    // POST /import-export/import - Start import job
    if (req.method === 'POST' && endpoint === 'import') {
      const body = await req.json();

      const jobData = {
        tenant_id: tenantId,
        job_type: 'import',
        entity_type: body.entityType || body.entity_type,
        status: 'pending',
        file_name: body.fileName || body.file_name,
        file_url: body.fileUrl || body.file_url,
        options: body.options || {},
        total_records: body.totalRecords || 0,
        processed_records: 0,
        success_count: 0,
        error_count: 0,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: job, error } = await admin
        .from('import_export_jobs')
        .insert(jobData)
        .select()
        .single();

      if (error) {
        console.error('Error creating import job:', error);
        return createCorsResponse({ error: 'Failed to create import job' }, 500, req);
      }

      // In production, this would trigger background processing
      return createCorsResponse(
        {
          job,
          message: 'Import job created',
        },
        201,
        req,
      );
    }

    // POST /import-export/export - Start export job
    if (req.method === 'POST' && endpoint === 'export') {
      const body = await req.json();

      const jobData = {
        tenant_id: tenantId,
        job_type: 'export',
        entity_type: body.entityType || body.entity_type,
        status: 'pending',
        options: {
          format: body.format || 'csv',
          filters: body.filters || {},
          fields: body.fields || [],
        },
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: job, error } = await admin
        .from('import_export_jobs')
        .insert(jobData)
        .select()
        .single();

      if (error) {
        console.error('Error creating export job:', error);
        return createCorsResponse({ error: 'Failed to create export job' }, 500, req);
      }

      // Perform simple export immediately (for small datasets)
      const entityType = body.entityType || body.entity_type;
      let tableName = entityType;
      if (entityType === 'customers' || entityType === 'leads') {
        tableName = 'business_records';
      }

      let query = admin.from(tableName).select('*').eq('tenant_id', tenantId);

      // Apply filters
      if (body.filters) {
        for (const [key, value] of Object.entries(body.filters)) {
          query = query.eq(key, value);
        }
      }

      const { data: records, error: exportError } = await query.limit(10000);

      if (exportError) {
        await admin
          .from('import_export_jobs')
          .update({
            status: 'failed',
            error_message: exportError.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        return createCorsResponse({ error: 'Export failed' }, 500, req);
      }

      // Update job with results
      await admin
        .from('import_export_jobs')
        .update({
          status: 'completed',
          total_records: records?.length || 0,
          processed_records: records?.length || 0,
          success_count: records?.length || 0,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return createCorsResponse(
        {
          job: { ...job, status: 'completed' },
          data: records || [],
          recordCount: records?.length || 0,
        },
        200,
        req,
      );
    }

    // GET /import-export/templates - Get import templates
    if (req.method === 'GET' && endpoint === 'templates') {
      const entityType = url.searchParams.get('entityType');

      const templates: Record<string, any> = {
        customers: {
          headers: [
            'company_name',
            'email',
            'phone',
            'address',
            'city',
            'state',
            'zip_code',
            'industry',
          ],
          required: ['company_name'],
          sampleData: [
            {
              company_name: 'Acme Corp',
              email: 'contact@acme.com',
              phone: '555-0100',
              industry: 'Technology',
            },
          ],
        },
        contacts: {
          headers: ['first_name', 'last_name', 'email', 'phone', 'title', 'company_id'],
          required: ['first_name', 'last_name', 'email'],
          sampleData: [
            { first_name: 'John', last_name: 'Doe', email: 'john@example.com', title: 'Manager' },
          ],
        },
        equipment: {
          headers: [
            'name',
            'serial_number',
            'model',
            'manufacturer',
            'customer_id',
            'install_date',
          ],
          required: ['name', 'serial_number'],
          sampleData: [
            { name: 'Printer A', serial_number: 'SN12345', model: 'Model X', manufacturer: 'HP' },
          ],
        },
        products: {
          headers: ['name', 'sku', 'description', 'price', 'category'],
          required: ['name', 'sku'],
          sampleData: [
            { name: 'Toner Cartridge', sku: 'TON-001', price: 49.99, category: 'Supplies' },
          ],
        },
      };

      if (entityType && templates[entityType]) {
        return createCorsResponse(templates[entityType], 200, req);
      }

      return createCorsResponse(templates, 200, req);
    }

    // POST /import-export/validate - Validate import data
    if (req.method === 'POST' && endpoint === 'validate') {
      const body = await req.json();
      const { entityType, data } = body;

      const errors: any[] = [];
      const warnings: any[] = [];

      // Basic validation
      if (!Array.isArray(data) || data.length === 0) {
        return createCorsResponse(
          {
            valid: false,
            errors: [{ row: 0, message: 'No data to import' }],
            warnings: [],
          },
          200,
          req,
        );
      }

      // Validate each row
      data.forEach((row: any, index: number) => {
        // Check required fields based on entity type
        if (entityType === 'customers' && !row.company_name) {
          errors.push({
            row: index + 1,
            field: 'company_name',
            message: 'Company name is required',
          });
        }
        if (entityType === 'contacts' && !row.email) {
          errors.push({ row: index + 1, field: 'email', message: 'Email is required' });
        }
        // Add more validations as needed
      });

      return createCorsResponse(
        {
          valid: errors.length === 0,
          totalRows: data.length,
          errors,
          warnings,
        },
        200,
        req,
      );
    }

    // DELETE /import-export/jobs/:id - Cancel/delete job
    if (req.method === 'DELETE' && endpoint === 'jobs' && jobId) {
      const { error } = await admin
        .from('import_export_jobs')
        .delete()
        .eq('id', jobId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete job' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Job deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in import-export function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
