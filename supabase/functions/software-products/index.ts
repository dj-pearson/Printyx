// Software Products Edge Function
// Handles CRUD operations for software products
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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

    // Extract tenant ID from JWT metadata
    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Server strips function name, so /software-products/import becomes /import
    const productId = pathParts[0]; // Get ID or action from path

    // GET /software-products - paginated list (or distinct categories)
    if (req.method === 'GET' && !productId) {
      const params = url.searchParams;

      // Distinct categories for the filter dropdown (one lightweight call).
      if (params.get('distinct') === 'categories') {
        const { data, error } = await admin
          .from('software_products')
          .select('category')
          .eq('tenant_id', tenantId);
        if (error) {
          console.error('Error fetching categories:', error);
          return createCorsResponse({ error: error.message }, 500, req);
        }
        const categories = Array.from(
          new Set((data || []).map((r: any) => r.category).filter(Boolean)),
        ).sort();
        return createCorsResponse({ categories }, 200, req);
      }

      const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
      const limitRaw = parseInt(params.get('limit') || '50', 10) || 50;
      const limit = Math.min(Math.max(1, limitRaw), 500); // hard cap to protect the function
      const search = (params.get('search') || '').trim();
      const category = params.get('category');

      let query = admin
        .from('software_products')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('product_name', { ascending: true });

      if (search) {
        // Strip chars that break PostgREST's .or() filter grammar.
        const safe = search.replace(/[,()]/g, ' ').trim();
        if (safe) {
          query = query.or(
            `product_name.ilike.%${safe}%,product_code.ilike.%${safe}%,description.ilike.%${safe}%`,
          );
        }
      }
      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const from = (page - 1) * limit;
      query = query.range(from, from + limit - 1);

      const { data: products, error, count } = await query;
      if (error) {
        console.error('Error fetching software products:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse(
        { data: products || [], total: count ?? products?.length ?? 0, page, limit },
        200,
        req,
      );
    }

    // GET /software-products/:id - Get single software product
    if (req.method === 'GET' && productId) {
      const { data: product, error } = await admin
        .from('software_products')
        .select('*')
        .eq('id', productId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching software product:', error);
        return createCorsResponse({ error: error.message }, 404, req);
      }

      return createCorsResponse(product, 200, req);
    }

    // POST /software-products/import - CSV import
    if (req.method === 'POST' && productId === 'import') {
      try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
          return createCorsResponse({ message: 'No file uploaded' }, 400, req);
        }

        const text = await file.text();
        const lines = text.split('\n').filter((line: string) => line.trim());

        if (lines.length < 2) {
          return createCorsResponse({ message: 'CSV file is empty or has no data rows' }, 400, req);
        }

        // Parse CSV header and rows
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
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
          return result.map((cell) => cell.replace(/^"|"$/g, '').trim());
        };

        const headers = parseCSVLine(lines[0]);
        const rows = lines.slice(1).map((line: string) => parseCSVLine(line));

        // Optional explicit column mapping from the UI: { targetField: csvHeaderName }.
        // Takes precedence over alias auto-detection so ANY CSV layout can import.
        let mapping: Record<string, string> = {};
        const mappingRaw = formData.get('mapping');
        if (typeof mappingRaw === 'string' && mappingRaw.trim()) {
          try {
            mapping = JSON.parse(mappingRaw) || {};
          } catch {
            mapping = {};
          }
        }

        // Build header-to-index map. Normalize aggressively (strip all non-alphanum)
        // so "Manufacturer Code", "manufacturer_code", "manufacturerCode" all match.
        const normalize = (s: string) =>
          String(s ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
        const headerMap: Record<string, number> = {};
        headers.forEach((h, i) => {
          headerMap[normalize(h)] = i;
        });

        // Alias table — mirrors shared/software-import-fields.ts (Deno can't import it).
        const ALIASES: Record<string, string[]> = {
          productCode: [
            'code',
            'sku',
            'manufacturer code',
            'mfg code',
            'manufacturer part number',
            'item',
            'item no',
            'item number',
            'ad product code',
            'part number',
            'part no',
          ],
          productName: [
            'name',
            'title',
            'product description',
            'description',
            'software name',
            'item description',
          ],
          vendor: ['brand', 'manufacturer', 'publisher', 'make'],
          productType: ['type'],
          category: ['product category', 'model', 'group', 'family'],
          accessoryType: ['accessory type'],
          paymentType: ['payment type', 'billing', 'term'],
          description: ['sub description', 'long description', 'details'],
          summary: ['short description'],
          standardCost: [
            'dealer price',
            'dealer cost',
            'cost',
            'our cost',
            'wholesale',
            'buy price',
          ],
          standardRepPrice: [
            'msrp',
            'list price',
            'retail',
            'retail price',
            'rep price',
            'sell price',
            'price',
          ],
          newCost: ['new cost'],
          newRepPrice: ['new rep price', 'new price'],
          upgradeCost: ['upgrade cost'],
          upgradeRepPrice: ['upgrade rep price', 'upgrade price'],
          isActive: ['active', 'enabled'],
          availableForAll: ['available for all'],
          salesRepCredit: ['sales rep credit'],
          funding: ['fundable'],
          lease: ['leasable'],
        };

        const idxForField = (field: string): number | undefined => {
          // 1) explicit mapping wins
          const mapped = mapping[field];
          if (mapped) {
            const idx = headerMap[normalize(mapped)];
            if (idx !== undefined) return idx;
          }
          // 2) the field name itself (covers camel/snake/Title via normalize)
          let idx = headerMap[normalize(field)];
          if (idx !== undefined) return idx;
          // 3) aliases
          for (const a of ALIASES[field] || []) {
            idx = headerMap[normalize(a)];
            if (idx !== undefined) return idx;
          }
          return undefined;
        };

        const getField = (row: string[], field: string): string | null => {
          const idx = idxForField(field);
          if (idx !== undefined && row[idx] !== undefined && row[idx] !== '') {
            return row[idx];
          }
          return null;
        };

        const isMeaningfulCode = (code: string | null | undefined): boolean => {
          if (!code) return false;
          const t = String(code).trim().toLowerCase();
          return !['', '-', '--', 'n/a', 'na', 'none'].includes(t);
        };

        const parseBool = (val: string | null): boolean => {
          if (!val) return false;
          const lower = val.toLowerCase().trim();
          return lower === 'true' || lower === 'yes' || lower === '1';
        };

        const parseNum = (val: string | null): number | null => {
          if (!val) return null;
          const cleaned = val.replace(/[,$]/g, '').trim();
          const num = parseFloat(cleaned);
          return isNaN(num) ? null : num;
        };

        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        // Pre-fetch existing products for dedup — by code (when meaningful) and by name.
        const { data: existingProducts } = await admin
          .from('software_products')
          .select('id, product_code, product_name')
          .eq('tenant_id', tenantId);

        const existingByCode = new Map<string, string>();
        const existingByName = new Map<string, string>();
        for (const p of existingProducts || []) {
          if (isMeaningfulCode(p.product_code)) {
            existingByCode.set(p.product_code.toLowerCase().trim(), p.id);
          }
          if (p.product_name) {
            existingByName.set(p.product_name.toLowerCase().trim(), p.id);
          }
        }

        // Auto-enable a pricing tier when that tier has cost/price but no explicit flag.
        const tierActive = (
          explicit: string | null,
          cost: number | null,
          price: number | null,
        ): boolean => (explicit !== null ? parseBool(explicit) : cost !== null || price !== null);

        // ── Pass 1: classify rows in memory (NO per-row DB calls) ────────────
        // A 1,800-row file with sequential awaits exceeds the edge time limit and
        // the gateway returns a CORS-less 503. Build batches instead.
        const toInsert: Record<string, any>[] = [];
        const toUpdate: { id: string; data: Record<string, any> }[] = [];
        const seenInFile = new Set<string>();
        const nowIso = new Date().toISOString();

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

          const productCode = getField(row, 'productCode');
          const productName = getField(row, 'productName');

          if (!productCode && !productName) {
            if (errors.length < 100) errors.push(`Row ${i + 2}: Product code or name required`);
            skipped++;
            continue;
          }

          const codeMeaningful = isMeaningfulCode(productCode);
          const standardCost = parseNum(getField(row, 'standardCost'));
          const standardRepPrice = parseNum(getField(row, 'standardRepPrice'));
          const newCost = parseNum(getField(row, 'newCost'));
          const newRepPrice = parseNum(getField(row, 'newRepPrice'));
          const upgradeCost = parseNum(getField(row, 'upgradeCost'));
          const upgradeRepPrice = parseNum(getField(row, 'upgradeRepPrice'));

          const dbData: Record<string, any> = {
            tenant_id: tenantId,
            product_code: codeMeaningful ? (productCode as string).trim() : null,
            product_name: productName || productCode || 'Unknown',
            vendor: getField(row, 'vendor') || null,
            product_type: getField(row, 'productType') || null,
            category: getField(row, 'category') || null,
            accessory_type: getField(row, 'accessoryType') || null,
            description: getField(row, 'description') || null,
            summary: getField(row, 'summary') || null,
            note: getField(row, 'note') || null,
            ea_notes: getField(row, 'eaNotes') || null,
            config_note: getField(row, 'configNote') || null,
            related_products: getField(row, 'relatedProducts') || null,
            is_active: parseBool(getField(row, 'isActive') || 'true'),
            available_for_all: parseBool(getField(row, 'availableForAll')),
            repost_edit: parseBool(getField(row, 'repostEdit')),
            sales_rep_credit: parseBool(getField(row, 'salesRepCredit') || 'true'),
            funding: parseBool(getField(row, 'funding') || 'true'),
            lease: parseBool(getField(row, 'lease')),
            payment_type: getField(row, 'paymentType') || null,
            standard_active: tierActive(
              getField(row, 'standardActive'),
              standardCost,
              standardRepPrice,
            ),
            standard_cost: standardCost,
            standard_rep_price: standardRepPrice,
            new_active: tierActive(getField(row, 'newActive'), newCost, newRepPrice),
            new_cost: newCost,
            new_rep_price: newRepPrice,
            upgrade_active: tierActive(
              getField(row, 'upgradeActive'),
              upgradeCost,
              upgradeRepPrice,
            ),
            upgrade_cost: upgradeCost,
            upgrade_rep_price: upgradeRepPrice,
            price_book_id: getField(row, 'priceBookId') || null,
            updated_at: nowIso,
          };

          // Dedup key: meaningful code first, else product name.
          const nameKey = (productName || '').toLowerCase().trim();
          const dedupKey = codeMeaningful
            ? 'c:' + (productCode as string).toLowerCase().trim()
            : nameKey
              ? 'n:' + nameKey
              : '';
          if (dedupKey && seenInFile.has(dedupKey)) {
            skipped++; // duplicate within this same file
            continue;
          }
          if (dedupKey) seenInFile.add(dedupKey);

          const existingId = codeMeaningful
            ? existingByCode.get((productCode as string).toLowerCase().trim())
            : nameKey
              ? existingByName.get(nameKey)
              : undefined;

          if (existingId) {
            const { tenant_id: _t, ...updateData } = dbData;
            toUpdate.push({ id: existingId, data: updateData });
          } else {
            dbData.created_at = nowIso;
            toInsert.push(dbData);
          }
        }

        // ── Pass 2: batched writes ───────────────────────────────────────────
        const chunk = <T>(arr: T[], n: number): T[][] => {
          const out: T[][] = [];
          for (let j = 0; j < arr.length; j += n) out.push(arr.slice(j, j + n));
          return out;
        };

        // Bulk inserts (one round-trip per 500 rows).
        for (const batch of chunk(toInsert, 500)) {
          const { error: insErr } = await admin.from('software_products').insert(batch);
          if (insErr) {
            if (errors.length < 100) errors.push(`Insert batch failed: ${insErr.message}`);
            skipped += batch.length;
          } else {
            imported += batch.length;
          }
        }

        // Updates in parallel batches (25 concurrent).
        for (const batch of chunk(toUpdate, 25)) {
          const results = await Promise.all(
            batch.map((u) =>
              admin
                .from('software_products')
                .update(u.data)
                .eq('id', u.id)
                .eq('tenant_id', tenantId),
            ),
          );
          results.forEach((r: any, idx: number) => {
            if (r.error) {
              if (errors.length < 100)
                errors.push(`Update failed (${batch[idx].id}): ${r.error.message}`);
              skipped++;
            } else {
              updated++;
            }
          });
        }

        return createCorsResponse(
          {
            success: errors.length === 0,
            imported,
            updated,
            skipped,
            errors,
          },
          200,
          req,
        );
      } catch (importError: any) {
        console.error('Error importing software products:', importError);
        return createCorsResponse(
          { message: 'Failed to import software products', error: importError.message },
          500,
          req,
        );
      }
    }

    // POST /software-products/dedupe - find/remove duplicate rows.
    // Body: { dryRun?: boolean }. Groups by meaningful product_code, else by
    // product_name (case-insensitive). Keeps the most-complete/newest row in each
    // group and removes the rest.
    if (req.method === 'POST' && productId === 'dedupe') {
      const body = await req.json().catch(() => ({}));
      const dryRun = body?.dryRun === true;

      const { data: all, error } = await admin
        .from('software_products')
        .select('*')
        .eq('tenant_id', tenantId);
      if (error) {
        return createCorsResponse({ error: error.message }, 500, req);
      }

      const meaningful = (code: any): boolean => {
        if (!code) return false;
        const t = String(code).trim().toLowerCase();
        return !['', '-', '--', 'n/a', 'na', 'none'].includes(t);
      };
      const completeness = (p: any): number => {
        const fields = [
          'standard_rep_price',
          'new_rep_price',
          'upgrade_rep_price',
          'standard_cost',
          'new_cost',
          'upgrade_cost',
          'vendor',
          'category',
          'description',
          'product_type',
        ];
        return fields.reduce((n, f) => n + (p[f] != null && p[f] !== '' ? 1 : 0), 0);
      };
      const ts = (p: any): number => {
        const v = p.updated_at || p.created_at;
        const n = v ? Date.parse(v) : 0;
        return Number.isFinite(n) ? n : 0;
      };

      // Group by dedup key.
      const groups = new Map<string, any[]>();
      for (const p of all || []) {
        const key = meaningful(p.product_code)
          ? 'c:' + String(p.product_code).trim().toLowerCase()
          : p.product_name
            ? 'n:' + String(p.product_name).trim().toLowerCase()
            : '';
        if (!key) continue;
        const arr = groups.get(key) || [];
        arr.push(p);
        groups.set(key, arr);
      }

      const deleteIds: string[] = [];
      let dupeGroups = 0;
      const sample: Array<{ key: string; kept: string; removed: number }> = [];
      for (const [key, arr] of groups) {
        if (arr.length < 2) continue;
        dupeGroups++;
        // Keeper: most complete, then newest.
        arr.sort((a, b) => completeness(b) - completeness(a) || ts(b) - ts(a));
        const [keeper, ...dups] = arr;
        deleteIds.push(...dups.map((d) => d.id));
        if (sample.length < 20) sample.push({ key, kept: keeper.id, removed: dups.length });
      }

      if (dryRun) {
        return createCorsResponse(
          { dryRun: true, duplicateGroups: dupeGroups, toRemove: deleteIds.length, sample },
          200,
          req,
        );
      }

      // Delete in chunks.
      let removed = 0;
      for (let i = 0; i < deleteIds.length; i += 200) {
        const batch = deleteIds.slice(i, i + 200);
        const { error: delErr } = await admin
          .from('software_products')
          .delete()
          .in('id', batch)
          .eq('tenant_id', tenantId);
        if (delErr) {
          return createCorsResponse(
            { error: delErr.message, removedBeforeError: removed },
            500,
            req,
          );
        }
        removed += batch.length;
      }

      return createCorsResponse({ duplicateGroups: dupeGroups, removed }, 200, req);
    }

    // POST /software-products - Create new software product
    if (req.method === 'POST') {
      const body = await req.json();

      // Map camelCase fields to snake_case for database
      const dbData: Record<string, any> = {
        tenant_id: tenantId,
        product_code: body.productCode,
        product_name: body.productName,
        vendor: body.vendor || null,
        product_type: body.productType || null,
        category: body.category || null,
        accessory_type: body.accessoryType || null,
        description: body.description || null,
        summary: body.summary || null,
        note: body.note || null,
        ea_notes: body.eaNotes || null,
        config_note: body.configNote || null,
        related_products: body.relatedProducts || null,
        is_active: body.isActive !== undefined ? body.isActive : true,
        available_for_all: body.availableForAll !== undefined ? body.availableForAll : false,
        repost_edit: body.repostEdit !== undefined ? body.repostEdit : false,
        sales_rep_credit: body.salesRepCredit !== undefined ? body.salesRepCredit : true,
        funding: body.funding !== undefined ? body.funding : true,
        lease: body.lease !== undefined ? body.lease : false,
        payment_type: body.paymentType || null,
        standard_active: body.standardActive !== undefined ? body.standardActive : false,
        standard_cost: body.standardCost || null,
        standard_rep_price: body.standardRepPrice || null,
        new_active: body.newActive !== undefined ? body.newActive : false,
        new_cost: body.newCost || null,
        new_rep_price: body.newRepPrice || null,
        upgrade_active: body.upgradeActive !== undefined ? body.upgradeActive : false,
        upgrade_cost: body.upgradeCost || null,
        upgrade_rep_price: body.upgradeRepPrice || null,
        price_book_id: body.priceBookId || null,
        temp_key: body.tempKey || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newProduct, error } = await admin
        .from('software_products')
        .insert(dbData)
        .select()
        .single();

      if (error) {
        console.error('Error creating software product:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse(newProduct, 201, req);
    }

    // PUT /software-products/:id - Update software product
    if (req.method === 'PUT' && productId) {
      const body = await req.json();

      // Map camelCase fields to snake_case for database
      const dbData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Only include fields that are present in the request
      if (body.productCode !== undefined) dbData.product_code = body.productCode;
      if (body.productName !== undefined) dbData.product_name = body.productName;
      if (body.vendor !== undefined) dbData.vendor = body.vendor;
      if (body.productType !== undefined) dbData.product_type = body.productType;
      if (body.category !== undefined) dbData.category = body.category;
      if (body.accessoryType !== undefined) dbData.accessory_type = body.accessoryType;
      if (body.description !== undefined) dbData.description = body.description;
      if (body.summary !== undefined) dbData.summary = body.summary;
      if (body.note !== undefined) dbData.note = body.note;
      if (body.eaNotes !== undefined) dbData.ea_notes = body.eaNotes;
      if (body.configNote !== undefined) dbData.config_note = body.configNote;
      if (body.relatedProducts !== undefined) dbData.related_products = body.relatedProducts;
      if (body.isActive !== undefined) dbData.is_active = body.isActive;
      if (body.availableForAll !== undefined) dbData.available_for_all = body.availableForAll;
      if (body.repostEdit !== undefined) dbData.repost_edit = body.repostEdit;
      if (body.salesRepCredit !== undefined) dbData.sales_rep_credit = body.salesRepCredit;
      if (body.funding !== undefined) dbData.funding = body.funding;
      if (body.lease !== undefined) dbData.lease = body.lease;
      if (body.paymentType !== undefined) dbData.payment_type = body.paymentType;
      if (body.standardActive !== undefined) dbData.standard_active = body.standardActive;
      if (body.standardCost !== undefined) dbData.standard_cost = body.standardCost;
      if (body.standardRepPrice !== undefined) dbData.standard_rep_price = body.standardRepPrice;
      if (body.newActive !== undefined) dbData.new_active = body.newActive;
      if (body.newCost !== undefined) dbData.new_cost = body.newCost;
      if (body.newRepPrice !== undefined) dbData.new_rep_price = body.newRepPrice;
      if (body.upgradeActive !== undefined) dbData.upgrade_active = body.upgradeActive;
      if (body.upgradeCost !== undefined) dbData.upgrade_cost = body.upgradeCost;
      if (body.upgradeRepPrice !== undefined) dbData.upgrade_rep_price = body.upgradeRepPrice;
      if (body.priceBookId !== undefined) dbData.price_book_id = body.priceBookId;
      if (body.tempKey !== undefined) dbData.temp_key = body.tempKey;

      const { data: updatedProduct, error } = await admin
        .from('software_products')
        .update(dbData)
        .eq('id', productId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating software product:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse(updatedProduct, 200, req);
    }

    // DELETE /software-products/:id - Delete software product
    if (req.method === 'DELETE' && productId) {
      const { error } = await admin
        .from('software_products')
        .delete()
        .eq('id', productId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting software product:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse({ success: true }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return createCorsResponse({ error: error.message || 'Internal server error' }, 500, req);
  }
}
