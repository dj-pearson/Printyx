// Catalog Edge Function
//
// `/api/catalog` IS THE PLATFORM MASTER CATALOGUE, not the dealer's own product
// list. This function used to read and write `product_models` - the TENANT's
// catalogue - on every branch, while Express served the same prefix off
// `master_product_models` and `enabled_products`. Both hosts answered 200 and
// they answered about different things (AUDIT-031), so the one page that calls
// this prefix, ProductHubUnified, browsed the platform catalogue on a developer
// machine and the dealer's own models in production:
//
//   - GET  /models        returned tenant rows in snake_case under a type that
//                         reads camelCase, so every cell rendered blank
//   - POST /models/:id/enable  updated `product_models` by an id that belongs to
//                         `master_product_models`, matched nothing, and 500'd
//   - POST /models/bulk-enable  wanted `productIds` where the page sends
//                         `masterProductIds`, so it answered 400 every time
//   - POST /import-enhanced  had no branch at all and 404'd
//
// The tenant-catalogue CRUD this file used to carry is not lost: it is
// `supabase/functions/product-models/`, which serves `/api/product-models` off
// the same table for the routed ProductModels page. This was a duplicate of
// that function wearing the wrong prefix word.
//
// The master tables carry NO tenant_id: a write here changes what every dealer
// sees, so those branches need a PLATFORM ADMIN and a manager is not enough
// (the `oid_mappings` lesson - a global table is a cross-tenant write). Enabling
// a product writes `enabled_products`, which IS tenant-scoped, and decides what
// a rep can sell and at what price, so that is a manager.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { ROLE_LEVEL, RbacError, requirePlatformAdmin, requireRoleLevel } from '../_shared/rbac.ts';
import type { AuthContext } from '../_shared/auth.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { toCamelShallow } from '../_shared/case.ts';
import { ilikeAnyFilter } from '../_shared/postgrest-or.ts';
import {
  importRowKey,
  normalizeCategoryName,
  planMasterCatalogImport,
  type MasterCatalogImportRow,
} from '../../../shared/master-catalog-import.ts';

const MODEL_COLUMNS =
  'id, manufacturer, model_code, display_name, specs_json, msrp, dealer_cost, ' +
  'margin_percentage, new_active, new_rep_price, upgrade_active, upgrade_rep_price, ' +
  'lexmark_active, lexmark_rep_price, status, discontinued_at, version, category, ' +
  'product_type, created_at, updated_at';

const ACCESSORY_COLUMNS =
  'id, manufacturer, accessory_code, display_name, specs_json, msrp, status, ' +
  'discontinued_at, version, category, created_at, updated_at';

/** Fields a platform admin may change on a master product, and nothing else. */
const EDITABLE_MODEL_FIELDS: Record<string, string> = {
  displayName: 'display_name',
  display_name: 'display_name',
  msrp: 'msrp',
  dealerCost: 'dealer_cost',
  dealer_cost: 'dealer_cost',
  marginPercentage: 'margin_percentage',
  margin_percentage: 'margin_percentage',
  category: 'category',
  productType: 'product_type',
  product_type: 'product_type',
  status: 'status',
};

/** Columns an enable override may set on the tenant's enabled_products row. */
const ENABLE_OVERRIDE_FIELDS: Record<string, string> = {
  customSku: 'custom_sku',
  custom_sku: 'custom_sku',
  customName: 'custom_name',
  custom_name: 'custom_name',
  dealerCost: 'dealer_cost',
  dealer_cost: 'dealer_cost',
  companyPrice: 'company_price',
  company_price: 'company_price',
  markupRuleId: 'markup_rule_id',
  markup_rule_id: 'markup_rule_id',
  priceOverridden: 'price_overridden',
  price_overridden: 'price_overridden',
};

/** Keep only the keys a table can store, and say which were dropped (COP-M01). */
function buildPlan(
  body: Record<string, unknown>,
  allowed: Record<string, string>,
): { plan: Record<string, unknown>; ignoredFields: string[] } {
  const plan: Record<string, unknown> = {};
  const ignoredFields: string[] = [];

  for (const [key, value] of Object.entries(body ?? {})) {
    const column = allowed[key];
    if (!column) {
      ignoredFields.push(key);
      continue;
    }
    if (value === undefined) continue;
    plan[column] = value;
  }

  return { plan, ignoredFields };
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
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // SEC-TENANT-003: user_metadata is writable by the session holder through
    // supabase.auth.updateUser, and this client uses the service role, which
    // bypasses RLS - so a tenant read from that bag is a tenant of the
    // caller's choosing. resolveTenantId takes app_metadata, then the
    // caller's users row, which neither the user nor the browser can write.
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const ctx = {
      userId: user.id,
      tenantId,
      email: user.email,
      jwt: jwt ?? '',
      supabaseUser: user,
    } as AuthContext;

    /**
     * SEC-EDGE-001, gated per BRANCH rather than per function: browsing the
     * catalogue is the whole point of the page, which has no minLevel.
     */
    const requireCatalogOwner = () => requirePlatformAdmin(ctx);
    const requireManager = () => requireRoleLevel(ctx, ROLE_LEVEL.MANAGER);

    const deny = (err: unknown, message: string) => {
      if (err instanceof RbacError) {
        return createCorsResponse(
          { error: message, code: 'INSUFFICIENT_ROLE', details: err.details },
          403,
          req,
        );
      }
      // Never 403 on a failure that is not a role failure: that turns a
      // database outage into "your role is too low".
      throw err;
    };

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /catalog, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'catalog');
    const resource = parts[0];
    const resourceId = parts[1];
    const action = parts[2];

    // GET /catalog/manufacturers - every manufacturer in the master catalogue
    if (req.method === 'GET' && resource === 'manufacturers') {
      const rows = await fetchAllRows<{ manufacturer: string | null }>(() =>
        admin
          .from('master_product_models')
          .select('manufacturer')
          .not('manufacturer', 'is', null)
          .order('manufacturer', { ascending: true }),
      );

      const manufacturers = [...new Set(rows.map((r) => r.manufacturer).filter(Boolean))].sort();
      return createCorsResponse(manufacturers, 200, req);
    }

    // GET /catalog/categories - every category in the master catalogue
    if (req.method === 'GET' && resource === 'categories') {
      const rows = await fetchAllRows<{ category: string | null }>(() =>
        admin
          .from('master_product_models')
          .select('category')
          .not('category', 'is', null)
          .order('category', { ascending: true }),
      );

      const categories = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
      return createCorsResponse(categories, 200, req);
    }

    // POST /catalog/models/bulk-enable - enable several master products at once
    if (req.method === 'POST' && resource === 'models' && resourceId === 'bulk-enable') {
      try {
        requireManager();
      } catch (err) {
        return deny(err, 'Enabling products for your company requires a manager role');
      }

      const body = await req.json().catch(() => ({}));
      const requestedIds: unknown = body?.masterProductIds ?? body?.productIds;

      if (!Array.isArray(requestedIds)) {
        return createCorsResponse(
          { error: 'masterProductIds array is required', code: 'MISSING_IDS' },
          400,
          req,
        );
      }

      const ids = [...new Set(requestedIds.map((id) => String(id)))];
      const { plan: overrides, ignoredFields } = buildPlan(
        body?.defaultOverrides ?? {},
        ENABLE_OVERRIDE_FIELDS,
      );

      // A stale selection and an already-enabled product are different answers,
      // so an id with no master row is NAMED rather than folded into `skipped`,
      // which the page renders as "already enabled".
      const known = ids.length
        ? ((await admin.from('master_product_models').select('id').in('id', ids)).data ?? []).map(
            (r: { id: string }) => r.id,
          )
        : [];
      const knownIds = new Set(known);
      const notFound = ids.filter((id) => !knownIds.has(id));

      const existing = knownIds.size
        ? ((
            await admin
              .from('enabled_products')
              .select('enabled_product_id, master_product_id')
              .eq('tenant_id', tenantId)
              .in('master_product_id', [...knownIds])
          ).data ?? [])
        : [];
      const existingByMaster = new Map(
        existing.map((row: Record<string, string>) => [row.master_product_id, row]),
      );

      let enabled = 0;
      let skipped = 0;
      const failed: string[] = [];

      // The new rows all carry the same shape, so they go in ONE insert rather
      // than a round trip each: a rep selecting a page of the catalogue is the
      // common case and it should cost one write.
      const toEnable = [...knownIds].filter((id) => !existingByMaster.has(id));

      if (toEnable.length) {
        const { data: insertedRows, error } = await admin
          .from('enabled_products')
          .insert(
            toEnable.map((id) => ({
              tenant_id: tenantId,
              master_product_id: id,
              source: 'master_catalog',
              enabled: true,
              ...overrides,
            })),
          )
          .select('master_product_id');

        if (error) {
          console.error('Error enabling products:', error);
          failed.push(...toEnable);
        } else {
          // Count what came back, not what was sent.
          enabled = insertedRows?.length ?? 0;
        }
      }

      // An already-enabled row needs its own UPDATE: each one is addressed by
      // its own primary key and PostgREST cannot upsert here, because
      // enabled_products has an INDEX on (tenant_id, master_product_id) and no
      // unique constraint for on_conflict to resolve against.
      for (const id of knownIds) {
        const row = existingByMaster.get(id);
        if (!row) continue;

        const { error } = await admin
          .from('enabled_products')
          .update({ ...overrides, enabled: true, updated_at: new Date().toISOString() })
          .eq('enabled_product_id', row.enabled_product_id)
          .eq('tenant_id', tenantId);
        if (error) {
          console.error('Error re-enabling product:', error);
          failed.push(id);
          continue;
        }
        skipped++;
      }

      return createCorsResponse(
        {
          // What the write touched, not what the request asked for.
          enabled,
          skipped,
          notFound,
          failed,
          requested: ids.length,
          ...(ignoredFields.length ? { ignoredFields } : {}),
        },
        200,
        req,
      );
    }

    // POST /catalog/models/:id/enable - enable one master product for the tenant
    if (req.method === 'POST' && resource === 'models' && resourceId && action === 'enable') {
      try {
        requireManager();
      } catch (err) {
        return deny(err, 'Enabling products for your company requires a manager role');
      }

      const body = await req.json().catch(() => ({}));
      const { plan: overrides, ignoredFields } = buildPlan(body ?? {}, ENABLE_OVERRIDE_FIELDS);

      const { data: master, error: masterError } = await admin
        .from('master_product_models')
        .select('id')
        .eq('id', resourceId)
        .maybeSingle();

      if (masterError) {
        console.error('Error reading master product:', masterError);
        return createCorsResponse({ error: 'Failed to read master product' }, 500, req);
      }
      if (!master) {
        return createCorsResponse(
          { error: 'Master product not found', code: 'NOT_FOUND' },
          404,
          req,
        );
      }

      const { data: existing, error: existingError } = await admin
        .from('enabled_products')
        .select('enabled_product_id')
        .eq('tenant_id', tenantId)
        .eq('master_product_id', resourceId)
        .maybeSingle();

      if (existingError) {
        console.error('Error reading enabled product:', existingError);
        return createCorsResponse({ error: 'Failed to enable product' }, 500, req);
      }

      const write = existing
        ? admin
            .from('enabled_products')
            .update({ ...overrides, enabled: true, updated_at: new Date().toISOString() })
            .eq('enabled_product_id', existing.enabled_product_id)
            .eq('tenant_id', tenantId)
            .select()
            .single()
        : admin
            .from('enabled_products')
            .insert({
              tenant_id: tenantId,
              master_product_id: resourceId,
              source: 'master_catalog',
              enabled: true,
              ...overrides,
            })
            .select()
            .single();

      const { data: row, error } = await write;

      if (error) {
        console.error('Error enabling product:', error);
        return createCorsResponse({ error: 'Failed to enable product' }, 500, req);
      }

      return createCorsResponse(
        {
          ...toCamelShallow(row as Record<string, unknown>),
          alreadyEnabled: Boolean(existing),
          ...(ignoredFields.length ? { ignoredFields } : {}),
        },
        200,
        req,
      );
    }

    // POST /catalog/import-enhanced - master catalogue CSV import
    if (req.method === 'POST' && resource === 'import-enhanced') {
      try {
        requireCatalogOwner();
      } catch (err) {
        return deny(err, 'Importing the master catalogue requires a platform admin');
      }
      return await importMasterCatalog(admin, req);
    }

    // GET /catalog/models/:id - one master product with its accessories
    if (req.method === 'GET' && resource === 'models' && resourceId && !action) {
      const { data: model, error } = await admin
        .from('master_product_models')
        .select(MODEL_COLUMNS)
        .eq('id', resourceId)
        .maybeSingle();

      if (error) {
        console.error('Error reading master product:', error);
        return createCorsResponse({ error: 'Failed to read master product' }, 500, req);
      }
      if (!model) {
        return createCorsResponse(
          { error: 'Master product not found', code: 'NOT_FOUND' },
          404,
          req,
        );
      }

      return createCorsResponse(toCamelShallow(model as Record<string, unknown>), 200, req);
    }

    // An unknown sub-resource is refused rather than answered with the parent
    // record: falling through is what makes such a gap invisible.
    if (req.method === 'GET' && resource === 'models' && resourceId && action) {
      return createCorsResponse({ error: `Unknown catalog sub-resource: ${action}` }, 404, req);
    }

    // GET /catalog/models - browse the master catalogue
    if (req.method === 'GET' && (resource === 'models' || !resource)) {
      const manufacturer = url.searchParams.get('manufacturer') ?? '';
      const category = url.searchParams.get('category') ?? '';
      const search = url.searchParams.get('search') ?? '';
      const status = url.searchParams.get('status') ?? '';

      const applyFilters = <T extends Record<string, unknown>>(
        query: any,
        nameColumn: string,
        codeColumn: string,
      ) => {
        let q = query;
        if (manufacturer && manufacturer !== 'all') q = q.eq('manufacturer', manufacturer);
        if (category && category !== 'all') q = q.eq('category', category);
        if (status && status !== 'all') q = q.eq('status', status);
        if (search) {
          q = q.or(ilikeAnyFilter([nameColumn, codeColumn], search));
        }
        return q as T;
      };

      const [models, accessories] = await Promise.all([
        fetchAllRows<Record<string, unknown>>(() =>
          applyFilters(
            admin
              .from('master_product_models')
              .select(MODEL_COLUMNS)
              .order('display_name', { ascending: true }),
            'display_name',
            'model_code',
          ),
        ),
        fetchAllRows<Record<string, unknown>>(() =>
          applyFilters(
            admin
              .from('master_product_accessories')
              .select(ACCESSORY_COLUMNS)
              .order('display_name', { ascending: true }),
            'display_name',
            'accessory_code',
          ),
        ),
      ]);

      const rows = [
        ...models.map((row) => ({
          ...toCamelShallow(row),
          itemType: 'model',
        })),
        ...accessories.map((row) => {
          const camel = toCamelShallow(row) as Record<string, unknown>;
          const { accessoryCode, ...rest } = camel;
          return {
            ...rest,
            modelCode: accessoryCode,
            // An accessory carries no dealer cost or margin of its own. Null
            // says "not recorded"; a 0 would say the accessory is free.
            dealerCost: null,
            marginPercentage: null,
            productType: 'accessory',
            itemType: 'accessory',
          };
        }),
      ];

      return createCorsResponse(rows, 200, req);
    }

    // POST /catalog/models - create or fill a master product
    if (req.method === 'POST' && resource === 'models' && !resourceId) {
      try {
        requireCatalogOwner();
      } catch (err) {
        return deny(err, 'Changing the master catalogue requires a platform admin');
      }

      const body = await req.json().catch(() => ({}));
      const manufacturer = String(body?.manufacturer ?? '').trim();
      const modelCode = String(body?.modelCode ?? body?.model_code ?? '').trim();
      const displayName = String(body?.displayName ?? body?.display_name ?? '').trim();

      if (!manufacturer || !modelCode || !displayName) {
        return createCorsResponse(
          {
            error: 'manufacturer, modelCode and displayName are required',
            code: 'MISSING_FIELDS',
          },
          400,
          req,
        );
      }

      const { plan, ignoredFields } = buildPlan(body ?? {}, EDITABLE_MODEL_FIELDS);
      if (typeof plan.category === 'string') {
        plan.category = normalizeCategoryName(plan.category);
      }

      const { data: existing } = await admin
        .from('master_product_models')
        .select('id')
        .eq('manufacturer', manufacturer)
        .eq('model_code', modelCode)
        .maybeSingle();

      const write = existing
        ? admin
            .from('master_product_models')
            .update({ ...plan, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select(MODEL_COLUMNS)
            .single()
        : admin
            .from('master_product_models')
            .insert({ ...plan, manufacturer, model_code: modelCode, display_name: displayName })
            .select(MODEL_COLUMNS)
            .single();

      const { data: row, error } = await write;

      if (error) {
        console.error('Error saving master product:', error);
        return createCorsResponse({ error: 'Failed to save master product' }, 500, req);
      }

      return createCorsResponse(
        {
          ...toCamelShallow(row as Record<string, unknown>),
          ...(ignoredFields.length ? { ignoredFields } : {}),
        },
        existing ? 200 : 201,
        req,
      );
    }

    // PATCH /catalog/models/:id - amend a master product
    if ((req.method === 'PATCH' || req.method === 'PUT') && resource === 'models' && resourceId) {
      try {
        requireCatalogOwner();
      } catch (err) {
        return deny(err, 'Changing the master catalogue requires a platform admin');
      }

      const body = await req.json().catch(() => ({}));
      const { plan, ignoredFields } = buildPlan(body ?? {}, EDITABLE_MODEL_FIELDS);

      if (Object.keys(plan).length === 0) {
        // Never a 200 that bumps updated_at and reports success (COP-M01).
        return createCorsResponse(
          {
            error: 'No writable fields in request',
            code: 'NO_WRITABLE_FIELDS',
            ignoredFields,
          },
          400,
          req,
        );
      }

      if (typeof plan.category === 'string') {
        plan.category = normalizeCategoryName(plan.category);
      }

      const { data: row, error } = await admin
        .from('master_product_models')
        .update({ ...plan, updated_at: new Date().toISOString() })
        .eq('id', resourceId)
        .select(MODEL_COLUMNS)
        .maybeSingle();

      if (error) {
        console.error('Error updating master product:', error);
        return createCorsResponse({ error: 'Failed to update master product' }, 500, req);
      }
      if (!row) {
        return createCorsResponse(
          { error: 'Master product not found', code: 'NOT_FOUND' },
          404,
          req,
        );
      }

      return createCorsResponse(
        {
          success: true,
          product: toCamelShallow(row as Record<string, unknown>),
          ...(ignoredFields.length ? { ignoredFields } : {}),
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in catalog function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/**
 * Read a master-catalogue CSV and create or fill the products it names.
 *
 * Existing rows are read in ONE query keyed by the manufacturers in the file,
 * rather than one lookup per row: a price list is thousands of lines and a
 * round trip each would be an N+1 on a request an operator waits on.
 */
async function importMasterCatalog(admin: any, req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return createCorsResponse(
      { error: 'Expected multipart/form-data with a "file" field' },
      400,
      req,
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return createCorsResponse({ error: 'CSV file required' }, 400, req);
  }
  if (file.size === 0) {
    return createCorsResponse({ error: 'CSV file is empty' }, 400, req);
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return createCorsResponse(
      { error: `CSV exceeds the ${MAX_IMPORT_BYTES / 1024 / 1024}MB limit` },
      413,
      req,
    );
  }

  const plan = planMasterCatalogImport(await file.text());

  if (!plan.ok) {
    return createCorsResponse(
      {
        error: plan.message,
        code: plan.reason,
        detectedHeaders: plan.fieldMappings.headersFound,
        suggestedMappings: plan.fieldMappings.suggestions,
        fieldMappings: plan.fieldMappings.mappings,
      },
      400,
      req,
    );
  }

  const manufacturers = [...new Set(plan.rows.map((row) => row.manufacturer))];
  const existingRows = manufacturers.length
    ? await fetchAllRows<Record<string, unknown>>(() =>
        admin
          .from('master_product_models')
          .select(
            'id, manufacturer, model_code, display_name, msrp, dealer_cost, ' +
              'margin_percentage, category, product_type, status',
          )
          .in('manufacturer', manufacturers),
      )
    : [];

  const existingByKey = new Map<string, Record<string, unknown>>(
    existingRows.map((row) => [`${row.manufacturer}-${row.model_code}`, row]),
  );

  const errors = [...plan.errors];
  const processedItems: Record<string, unknown>[] = [];
  const toInsert: Record<string, unknown>[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  // A row already in the catalogue FILLS BLANKS ONLY: a re-import of a partial
  // price list must not blank a field an admin has since corrected by hand.
  const FILLABLE: Array<[keyof MasterCatalogImportRow, string]> = [
    ['displayName', 'display_name'],
    ['msrp', 'msrp'],
    ['dealerCost', 'dealer_cost'],
    ['category', 'category'],
    ['productType', 'product_type'],
    ['status', 'status'],
  ];

  for (const row of plan.rows) {
    const existing = existingByKey.get(importRowKey(row));

    if (!existing) {
      toInsert.push({
        manufacturer: row.manufacturer,
        model_code: row.modelCode,
        display_name: row.displayName,
        msrp: row.msrp ?? null,
        dealer_cost: row.dealerCost ?? null,
        category: row.category,
        product_type: row.productType,
        status: row.status,
      });
      continue;
    }

    const fill: Record<string, unknown> = {};
    for (const [field, column] of FILLABLE) {
      const value = row[field];
      if (!existing[column] && value !== undefined && value !== '') fill[column] = value;
    }

    if (Object.keys(fill).length === 0) {
      skipped++;
      processedItems.push({ action: 'skipped', ...row, reason: 'No new data to fill' });
      continue;
    }

    const { error } = await admin
      .from('master_product_models')
      .update({ ...fill, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (error) {
      console.error('Error filling master product:', error);
      errors.push(`${row.modelCode}: ${error.message ?? 'update failed'}`);
      continue;
    }

    updated++;
    processedItems.push({ action: 'updated', ...row, fieldsUpdated: Object.keys(fill) });
  }

  if (toInsert.length) {
    // The result is read rather than discarded: an insert that answers 200
    // having stored nothing is what makes a fabricated count possible.
    const { data: insertedRows, error } = await admin
      .from('master_product_models')
      .insert(toInsert)
      .select('model_code');

    if (error) {
      console.error('Error creating master products:', error);
      errors.push(`Creating ${toInsert.length} product(s): ${error.message ?? 'insert failed'}`);
    } else {
      created = insertedRows?.length ?? 0;
      for (const row of toInsert.slice(0, 10)) {
        processedItems.push({ action: 'created', ...row });
      }
    }
  }

  return createCorsResponse(
    {
      success: errors.length === 0,
      summary: {
        totalRows: plan.totalRows,
        created,
        updated,
        skipped,
        duplicatesMerged: plan.duplicatesMerged,
        errors: errors.length,
      },
      fieldMappings: plan.fieldMappings.mappings,
      processedItems: processedItems.slice(0, 10),
      errors: errors.slice(0, 10),
    },
    200,
    req,
  );
}
