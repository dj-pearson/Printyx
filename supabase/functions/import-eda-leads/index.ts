// EDA Lead Import Edge Function
// Accepts CSV data (as JSON rows) and imports into business_records as leads.
// Deduplicates by company name, aggregates equipment details per company.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

interface CsvRow {
  BUYID: string;
  UCCID: string;
  EQTUNIT: string;
  BUYC1FIRST: string;
  BUYC1LAST: string;
  BUYC1TITLE: string;
  BUYCOMP1: string;
  BUYCITY: string;
  BUYZIP: string;
  UCCDATE: string;
  UCCSTATUS: string;
  EQTMAN: string;
  EQTMODEL: string;
  EQTDESC: string;
  PRIMARYBRAND: string;
}

function groupByCompany(rows: CsvRow[]): Map<string, CsvRow[]> {
  const companies = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const key = row.BUYCOMP1.toUpperCase().trim();
    if (!companies.has(key)) companies.set(key, []);
    companies.get(key)!.push(row);
  }
  return companies;
}

function buildEquipmentNotes(companyRows: CsvRow[]): string {
  const lines = companyRows.map(
    (r, i) =>
      `Unit ${i + 1}: ${r.EQTMAN || ''} ${r.EQTMODEL || ''} - ${r.EQTDESC || ''} | Brand: ${r.PRIMARYBRAND || ''} | UCC: ${r.UCCSTATUS || ''} (${r.UCCDATE || ''}) | BuyID: ${r.BUYID || ''} | UCCID: ${r.UCCID || ''}`,
  );
  return `EDA Import - ${companyRows.length} equipment unit(s)\n\n${lines.join('\n')}`;
}

function buildLeadRecord(
  companyName: string,
  companyRows: CsvRow[],
  tenantId: string,
  userId: string,
) {
  const first = companyRows[0];
  // Prefer contact with a title
  const withTitle = companyRows.find((r) => r.BUYC1TITLE) || first;
  const firstName = (withTitle.BUYC1FIRST || first.BUYC1FIRST || '').trim();
  const lastName = (withTitle.BUYC1LAST || first.BUYC1LAST || '').trim();
  const title = (withTitle.BUYC1TITLE || '').trim();
  const city = (first.BUYCITY || '').trim();
  const zip = (first.BUYZIP || '').trim();
  const contactName = [firstName, lastName].filter(Boolean).join(' ');

  return {
    tenant_id: tenantId,
    record_type: 'lead',
    status: 'new',
    company_name: companyName,
    primary_contact_name: contactName || null,
    primary_contact_title: title || null,
    source: 'EDA Import',
    billing_city: city || null,
    billing_state: 'IA',
    billing_zip_code: zip || null,
    city: city || null,
    state: 'IA',
    postal_code: zip || null,
    country: 'US',
    interest_level: 'warm',
    priority: 'medium',
    notes: buildEquipmentNotes(companyRows),
    created_by: userId,
  };
}

function parseCsv(csvText: string): CsvRow[] {
  const lines = csvText.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim();
    });
    if (row.BUYCOMP1) rows.push(row as unknown as CsvRow);
  }
  return rows;
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const body = await req.json().catch(() => null);

    if (!body) {
      return createCorsResponse({ error: 'Request body required' }, 400, req);
    }

    let rows: CsvRow[];

    if (body.csvText && typeof body.csvText === 'string') {
      // Raw CSV text posted
      rows = parseCsv(body.csvText);
    } else if (Array.isArray(body.rows)) {
      // Pre-parsed JSON rows
      rows = body.rows;
    } else {
      return createCorsResponse(
        { error: 'Provide either csvText (string) or rows (array)' },
        400,
        req,
      );
    }

    if (rows.length === 0) {
      return createCorsResponse({ error: 'No valid rows found' }, 400, req);
    }

    // Group by company
    const companies = groupByCompany(rows);

    // Check for existing EDA imports
    const { data: existing } = await admin
      .from('business_records')
      .select('company_name')
      .eq('tenant_id', tenantId)
      .eq('source', 'EDA Import');

    const existingNames = new Set(
      (existing || []).map((r: { company_name: string }) => r.company_name.toUpperCase()),
    );

    // Build records, skip duplicates
    const records: ReturnType<typeof buildLeadRecord>[] = [];
    const skipped: string[] = [];

    for (const [key, companyRows] of companies) {
      const displayName = companyRows[0].BUYCOMP1;
      if (existingNames.has(displayName.toUpperCase())) {
        skipped.push(displayName);
        continue;
      }
      records.push(buildLeadRecord(displayName, companyRows, tenantId, user.id));
    }

    if (records.length === 0) {
      return createCorsResponse(
        {
          message: 'All companies already imported',
          total_companies: companies.size,
          skipped: skipped.length,
          inserted: 0,
        },
        200,
        req,
      );
    }

    // Insert in batches of 25
    let totalInserted = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 25;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { data, error } = await admin.from('business_records').insert(batch).select('id');

      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        // Try one-by-one fallback
        for (const rec of batch) {
          const { data: single, error: singleErr } = await admin
            .from('business_records')
            .insert(rec)
            .select('id');
          if (singleErr) {
            errors.push(`${rec.company_name}: ${singleErr.message}`);
          } else {
            totalInserted += 1;
          }
        }
      } else {
        totalInserted += data?.length || 0;
      }
    }

    return createCorsResponse(
      {
        message: `Imported ${totalInserted} leads from ${rows.length} CSV rows (${companies.size} companies)`,
        total_rows: rows.length,
        total_companies: companies.size,
        inserted: totalInserted,
        skipped: skipped.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      200,
      req,
    );
  } catch (err) {
    console.error('Import error:', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}
