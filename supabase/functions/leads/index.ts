// Leads Edge Function
// Handles lead management operations
//
// Routes (function name stripped by Coolify's server.ts; normalizePath handles both):
//   GET    /              → list leads
//   POST   /              → create lead
//   GET    /map-data      → leads with geo/equipment metadata for the map viewer
//   POST   /geocode       → delegate to the geocode-leads edge function
//   POST   /import-eda    → bulk import EDA CSV (multipart upload)
//   GET    /:id           → single lead
//   PUT    /:id           → update lead
//   DELETE /:id           → delete lead
//   GET    /:id/contacts  → list lead contacts
//   POST   /:id/contacts  → attach a contact to a lead
//   POST   /:id/convert   → convert lead to customer
//   POST   /:id/qualify   → qualify lead
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import geocodeHandler from '../geocode-leads/index.ts';

// First-segment reserved words that are NOT lead ids.
const RESERVED = new Set(['map-data', 'geocode', 'import-eda']);

// ─── EDA CSV helpers (ported from server/routes-lead-map.ts) ──────────────

interface EdaRow {
  BUYCOMP1?: string;
  BUYCITY?: string;
  BUYZIP?: string;
  BUYC1FIRST?: string;
  BUYC1LAST?: string;
  BUYC1TITLE?: string;
  EQTMAN?: string;
  EQTMODEL?: string;
  EQTDESC?: string;
  PRIMARYBRAND?: string;
  UCCSTATUS?: string;
  UCCDATE?: string;
  BUYID?: string;
  UCCID?: string;
  [key: string]: string | undefined;
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields, embedded commas,
// "" escapes, CRLF). Deno has no csv-parser, so this stands in for it.
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // swallow; \n handles the line break
    } else {
      field += ch;
    }
  }
  // flush trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  const records: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const values = rows[r];
    // skip fully-empty lines
    if (values.length === 1 && values[0].trim() === '') continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = (values[c] ?? '').trim();
    }
    records.push(obj);
  }
  return records;
}

function groupByCompany(rows: EdaRow[]): Map<string, EdaRow[]> {
  const companies = new Map<string, EdaRow[]>();
  for (const r of rows) {
    if (!r.BUYCOMP1?.trim()) continue;
    const key = r.BUYCOMP1.toUpperCase().trim();
    if (!companies.has(key)) companies.set(key, []);
    companies.get(key)!.push(r);
  }
  return companies;
}

function buildEquipmentNotes(companyRows: EdaRow[]): string {
  const lines = companyRows.map(
    (r, i) =>
      `Unit ${i + 1}: ${r.EQTMAN || ''} ${r.EQTMODEL || ''} - ${r.EQTDESC || ''} | Brand: ${r.PRIMARYBRAND || ''} | UCC: ${r.UCCSTATUS || ''} (${r.UCCDATE || ''}) | BuyID: ${r.BUYID || ''} | UCCID: ${r.UCCID || ''}`,
  );
  return `EDA Import - ${companyRows.length} equipment unit(s)\n\n${lines.join('\n')}`;
}

function buildEdaLeadRow(companyRows: EdaRow[], tenantId: string, userId: string) {
  const first = companyRows[0];
  const withTitle = companyRows.find((r) => r.BUYC1TITLE?.trim()) || first;
  const firstName = (withTitle.BUYC1FIRST || first.BUYC1FIRST || '').trim();
  const lastName = (withTitle.BUYC1LAST || first.BUYC1LAST || '').trim();
  const title = (withTitle.BUYC1TITLE || '').trim();
  const city = (first.BUYCITY || '').trim();
  const zip = (first.BUYZIP || '').trim();
  const contactName = [firstName, lastName].filter(Boolean).join(' ');

  const now = new Date().toISOString();
  return {
    tenant_id: tenantId,
    record_type: 'lead',
    status: 'new',
    company_name: (first.BUYCOMP1 || '').trim(),
    primary_contact_name: contactName || '',
    primary_contact_title: title || '',
    source: 'EDA Import', // leadSource column is named `source`
    billing_city: city || '',
    billing_state: 'IA',
    billing_zip_code: zip || '',
    city: city || '',
    state: 'IA',
    postal_code: zip || '',
    country: 'US',
    interest_level: 'warm',
    priority: 'medium',
    notes: buildEquipmentNotes(companyRows),
    created_by: userId,
    owner_id: userId,
    created_at: now,
    updated_at: now,
  };
}

// Extract brand/equipment/UCC metadata from the notes blob (mirrors Express).
function extractNoteMeta(notes: string | null) {
  const text = notes || '';
  const brands: string[] = [];
  const equipment: string[] = [];
  const uccStatuses: string[] = [];

  const brandMatches = text.match(/Brand:\s*([^\s|]+)/g);
  if (brandMatches) {
    for (const m of brandMatches) {
      const b = m.replace('Brand:', '').trim();
      if (b && !brands.includes(b)) brands.push(b);
    }
  }

  const descMatches = text.match(/Unit \d+:\s*([^|]+)/g);
  if (descMatches) {
    for (const m of descMatches) equipment.push(m.trim());
  }

  const uccMatches = text.match(/UCC:\s*(\w+)/g);
  if (uccMatches) {
    for (const m of uccMatches) {
      const s = m.replace('UCC:', '').trim();
      if (s && !uccStatuses.includes(s)) uccStatuses.push(s);
    }
  }

  const unitMatch = text.match(/(\d+) equipment unit/);
  const unitCount = unitMatch ? parseInt(unitMatch[1]) : equipment.length;

  return { brands, equipment, uccStatuses, unitCount };
}

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

    // Resolve tenant ID: x-tenant-id header → app_metadata → user_metadata → DB lookup
    let tenantId =
      req.headers.get('x-tenant-id') ||
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      const admin2 = createSupabaseServiceClient();
      const { data: dbUser } = await admin2
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();
      if (dbUser?.tenant_id) {
        tenantId = dbUser.tenant_id;
      } else if (user.email) {
        const { data: emailUser } = await admin2
          .from('users')
          .select('tenant_id')
          .ilike('email', user.email)
          .limit(1)
          .maybeSingle();
        tenantId = emailUser?.tenant_id;
      }
    }

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const rawParts = url.pathname.split('/').filter(Boolean);
    // Normalize: strip function name from path if the relay preserved it
    const pathParts = rawParts[0] === 'leads' ? rawParts.slice(1) : rawParts;
    const leadId = pathParts[0];
    const subResource = pathParts[1];
    const isReserved = leadId && RESERVED.has(leadId);

    // ─── GET /leads/map-data ────────────────────────────────────────────
    if (req.method === 'GET' && leadId === 'map-data') {
      const source = url.searchParams.get('source');
      const city = url.searchParams.get('city');
      const brand = url.searchParams.get('brand');
      const filterStatus = url.searchParams.get('status');
      const hasCoords = url.searchParams.get('hasCoords');

      const { data: rows, error } = await admin
        .from('business_records')
        .select(
          'id, company_name, record_type, status, primary_contact_name, primary_contact_title, ' +
            'billing_city, billing_state, billing_zip_code, address_line1, city, state, postal_code, ' +
            'latitude, longitude, source, notes, owner_id, assigned_sales_rep, created_at',
        )
        .eq('tenant_id', tenantId)
        .eq('record_type', 'lead');

      if (error) {
        console.error('Error fetching map data:', error);
        return createCorsResponse({ error: 'Failed to load map data' }, 500, req);
      }

      let filtered: any[] = (rows as any[]) || [];
      if (source) filtered = filtered.filter((r) => r.source === source);
      if (city) {
        const c = city.toLowerCase();
        filtered = filtered.filter((r) =>
          (r.billing_city || r.city || '').toLowerCase().includes(c),
        );
      }
      if (brand) {
        const b = brand.toLowerCase();
        filtered = filtered.filter((r) => (r.notes || '').toLowerCase().includes(b));
      }
      if (filterStatus) filtered = filtered.filter((r) => r.status === filterStatus);
      if (hasCoords === 'true') filtered = filtered.filter((r) => r.latitude && r.longitude);

      const leadsWithMeta = filtered.map((r) => {
        const meta = extractNoteMeta(r.notes);
        return {
          id: r.id,
          companyName: r.company_name,
          recordType: r.record_type,
          status: r.status,
          primaryContactName: r.primary_contact_name,
          primaryContactTitle: r.primary_contact_title,
          billingCity: r.billing_city,
          billingState: r.billing_state,
          billingPostalCode: r.billing_zip_code,
          addressLine1: r.address_line1,
          city: r.city,
          state: r.state,
          postalCode: r.postal_code,
          latitude: r.latitude,
          longitude: r.longitude,
          lat: r.latitude != null ? parseFloat(String(r.latitude)) : null,
          lng: r.longitude != null ? parseFloat(String(r.longitude)) : null,
          leadSource: r.source,
          notes: r.notes,
          ownerId: r.owner_id,
          assignedSalesRep: r.assigned_sales_rep,
          createdAt: r.created_at,
          ...meta,
        };
      });

      const allBrands: Record<string, number> = {};
      const allCities: Record<string, number> = {};
      const allUccStatuses: Record<string, number> = {};
      let geocodedCount = 0;

      for (const lead of leadsWithMeta) {
        if (lead.lat && lead.lng) geocodedCount++;
        const c = lead.billingCity || lead.city || 'Unknown';
        allCities[c] = (allCities[c] || 0) + 1;
        for (const b of lead.brands) allBrands[b] = (allBrands[b] || 0) + 1;
        for (const s of lead.uccStatuses) allUccStatuses[s] = (allUccStatuses[s] || 0) + 1;
      }

      return createCorsResponse(
        {
          leads: leadsWithMeta,
          stats: {
            total: leadsWithMeta.length,
            geocoded: geocodedCount,
            pending: leadsWithMeta.length - geocodedCount,
            geocodedPct: leadsWithMeta.length
              ? Math.round((geocodedCount / leadsWithMeta.length) * 100)
              : 0,
            brands: allBrands,
            cities: allCities,
            uccStatuses: allUccStatuses,
          },
        },
        200,
        req,
      );
    }

    // ─── POST /leads/geocode ────────────────────────────────────────────
    // Delegate to the geocode-leads edge function (it owns the Places API +
    // batching). Forward the original request untouched.
    if (req.method === 'POST' && leadId === 'geocode') {
      return geocodeHandler(req);
    }

    // ─── POST /leads/import-eda ─────────────────────────────────────────
    if (req.method === 'POST' && leadId === 'import-eda') {
      let form: FormData;
      try {
        form = await req.formData();
      } catch (_e) {
        return createCorsResponse({ message: 'Expected multipart/form-data upload' }, 400, req);
      }
      const file = form.get('file');
      if (!file || typeof (file as File).text !== 'function') {
        return createCorsResponse({ message: 'No file uploaded' }, 400, req);
      }

      const text = await (file as File).text();
      const rows = parseCSV(text) as EdaRow[];
      if (rows.length === 0) {
        return createCorsResponse({ message: 'CSV file is empty' }, 400, req);
      }
      if (!('BUYCOMP1' in rows[0])) {
        return createCorsResponse(
          {
            message:
              'Invalid CSV format. Expected EDA export columns (BUYCOMP1, BUYCITY, BUYZIP, etc.)',
          },
          400,
          req,
        );
      }

      const companies = groupByCompany(rows);

      // Skip companies already imported (by name) for this tenant.
      const { data: existing } = await admin
        .from('business_records')
        .select('company_name')
        .eq('tenant_id', tenantId)
        .eq('source', 'EDA Import');
      const existingNames = new Set(
        (existing || []).map((r) => (r.company_name || '').toUpperCase().trim()),
      );

      let imported = 0;
      let skipped = 0;
      let duplicates = 0;
      const errors: string[] = [];

      for (const [, companyRows] of companies) {
        const displayName = (companyRows[0].BUYCOMP1 || '').trim();
        if (existingNames.has(displayName.toUpperCase())) {
          duplicates++;
          continue;
        }
        try {
          const record = buildEdaLeadRow(companyRows, tenantId, user.id);
          const { error } = await admin.from('business_records').insert(record);
          if (error) throw new Error(error.message);
          imported++;
        } catch (e) {
          errors.push(`${displayName}: ${e instanceof Error ? e.message : 'insert failed'}`);
          skipped++;
        }
      }

      return createCorsResponse(
        {
          success: true,
          imported,
          skipped,
          duplicates,
          errors,
          totalRows: rows.length,
          totalCompanies: companies.size,
          message: `Imported ${imported} leads from ${rows.length} rows (${companies.size} companies). ${duplicates > 0 ? `${duplicates} duplicates skipped.` : ''}`,
        },
        200,
        req,
      );
    }

    // GET /leads - List leads
    if (req.method === 'GET' && !leadId) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;
      const status = url.searchParams.get('status');
      const source = url.searchParams.get('source');
      const assignedTo = url.searchParams.get('assignedTo');

      let query = admin
        .from('business_records')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('status', 'lead')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('lead_status', status);
      if (source) query = query.eq('source', source);
      if (assignedTo) query = query.eq('assigned_to', assignedTo);

      const { data: leads, error } = await query;

      if (error) {
        console.error('Error fetching leads:', error);
        return createCorsResponse({ error: 'Failed to fetch leads' }, 500, req);
      }

      // Return plain array — iOS JSONDecoder expects [BusinessRecord] directly
      return createCorsResponse(leads || [], 200, req);
    }

    // GET /leads/:id - Get single lead
    if (req.method === 'GET' && leadId && !isReserved && !subResource) {
      const { data: lead, error } = await admin
        .from('business_records')
        .select('*')
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Lead not found' }, 404, req);
      }

      return createCorsResponse(lead, 200, req);
    }

    // GET /leads/:id/contacts - List contacts attached to a lead
    if (req.method === 'GET' && leadId && !isReserved && subResource === 'contacts') {
      const { data: contacts, error } = await admin
        .from('lead_contacts')
        .select('*')
        .eq('lead_id', leadId)
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching lead contacts:', error);
        return createCorsResponse({ error: 'Failed to fetch contacts' }, 500, req);
      }

      return createCorsResponse(contacts || [], 200, req);
    }

    // POST /leads/:id/contacts - Attach a contact to a lead
    if (req.method === 'POST' && leadId && !isReserved && subResource === 'contacts') {
      const body = await req.json().catch(() => ({}));

      const firstName = (body.firstName || body.first_name || '').trim();
      const lastName = (body.lastName || body.last_name || '').trim();
      if (!firstName || !lastName) {
        return createCorsResponse({ message: 'First name and last name are required' }, 400, req);
      }

      const now = new Date().toISOString();
      const contactRow = {
        tenant_id: tenantId,
        lead_id: leadId,
        first_name: firstName,
        last_name: lastName,
        title: body.title ?? null,
        department: body.department ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        is_primary: body.isPrimary ?? body.is_primary ?? false,
        created_at: now,
        updated_at: now,
      };

      const { data: contact, error } = await admin
        .from('lead_contacts')
        .insert(contactRow)
        .select()
        .single();

      if (error) {
        console.error('Error creating lead contact:', error);
        return createCorsResponse({ message: 'Failed to create contact' }, 500, req);
      }

      return createCorsResponse(contact, 201, req);
    }

    // POST /leads - Create lead
    if (req.method === 'POST' && !leadId) {
      const body = await req.json();

      const leadData = {
        tenant_id: tenantId,
        company_name: body.companyName || body.company_name,
        primary_contact_name: body.contactName || body.primary_contact_name,
        primary_contact_email: body.email || body.primary_contact_email,
        primary_contact_phone: body.phone || body.primary_contact_phone,
        website: body.website,
        industry: body.industry,
        source: body.source || 'manual',
        status: 'lead',
        lead_status: body.leadStatus || body.lead_status || 'new',
        assigned_to: body.assignedTo || body.assigned_to,
        notes: body.notes,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: lead, error } = await admin
        .from('business_records')
        .insert(leadData)
        .select()
        .single();

      if (error) {
        console.error('Error creating lead:', error);
        return createCorsResponse({ error: 'Failed to create lead' }, 500, req);
      }

      return createCorsResponse(lead, 201, req);
    }

    // PUT /leads/:id - Update lead
    if (req.method === 'PUT' && leadId && !isReserved && !subResource) {
      const body = await req.json();

      const { data: lead, error } = await admin
        .from('business_records')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update lead' }, 500, req);
      }

      return createCorsResponse(lead, 200, req);
    }

    // POST /leads/:id/convert - Convert lead to customer
    if (req.method === 'POST' && leadId && !isReserved && subResource === 'convert') {
      const { data: lead, error } = await admin
        .from('business_records')
        .update({
          status: 'customer',
          lead_status: 'converted',
          converted_at: new Date().toISOString(),
          converted_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to convert lead' }, 500, req);
      }

      return createCorsResponse({ success: true, customer: lead }, 200, req);
    }

    // POST /leads/:id/qualify - Qualify lead
    if (req.method === 'POST' && leadId && !isReserved && subResource === 'qualify') {
      const body = await req.json();

      const { data: lead, error } = await admin
        .from('business_records')
        .update({
          lead_status: 'qualified',
          qualification_score: body.score,
          qualification_notes: body.notes,
          qualified_at: new Date().toISOString(),
          qualified_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to qualify lead' }, 500, req);
      }

      return createCorsResponse(lead, 200, req);
    }

    // DELETE /leads/:id - Delete lead
    if (req.method === 'DELETE' && leadId && !isReserved) {
      const { error } = await admin
        .from('business_records')
        .delete()
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .eq('status', 'lead');

      if (error) {
        return createCorsResponse({ error: 'Failed to delete lead' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Lead deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in leads function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
