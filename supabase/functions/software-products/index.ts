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
    const productId = pathParts[1]; // Get ID from path if present

    // GET /software-products - List all software products
    if (req.method === 'GET' && !productId) {
      const { data: products, error } = await admin
        .from('software_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('product_name', { ascending: true });

      if (error) {
        console.error('Error fetching software products:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse({ data: products || [], total: products?.length || 0 }, 200, req);
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

        // Build header-to-index map (case-insensitive, underscore/camelCase tolerant)
        const normalize = (s: string) => s.toLowerCase().replace(/[_\s]/g, '');
        const headerMap: Record<string, number> = {};
        headers.forEach((h, i) => {
          headerMap[normalize(h)] = i;
        });

        const getVal = (row: string[], ...keys: string[]): string | null => {
          for (const key of keys) {
            const idx = headerMap[normalize(key)];
            if (idx !== undefined && row[idx] !== undefined && row[idx] !== '') {
              return row[idx];
            }
          }
          return null;
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
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

          const productCode = getVal(row, 'productCode', 'product_code');
          const productName = getVal(row, 'productName', 'product_name');

          if (!productCode && !productName) {
            errors.push(`Row ${i + 2}: Product code or product name is required`);
            skipped++;
            continue;
          }

          const dbData: Record<string, any> = {
            tenant_id: tenantId,
            product_code: productCode || null,
            product_name: productName || productCode || 'Unknown',
            vendor: getVal(row, 'vendor') || null,
            product_type: getVal(row, 'productType', 'product_type') || null,
            category: getVal(row, 'category') || null,
            accessory_type: getVal(row, 'accessoryType', 'accessory_type') || null,
            description: getVal(row, 'description') || null,
            summary: getVal(row, 'summary') || null,
            note: getVal(row, 'note') || null,
            ea_notes: getVal(row, 'eaNotes', 'ea_notes') || null,
            config_note: getVal(row, 'configNote', 'config_note') || null,
            related_products: getVal(row, 'relatedProducts', 'related_products') || null,
            is_active: parseBool(getVal(row, 'isActive', 'is_active') || 'true'),
            available_for_all: parseBool(getVal(row, 'availableForAll', 'available_for_all')),
            repost_edit: parseBool(getVal(row, 'repostEdit', 'repost_edit')),
            sales_rep_credit: parseBool(
              getVal(row, 'salesRepCredit', 'sales_rep_credit') || 'true',
            ),
            funding: parseBool(getVal(row, 'funding') || 'true'),
            lease: parseBool(getVal(row, 'lease')),
            payment_type: getVal(row, 'paymentType', 'payment_type') || null,
            standard_active: parseBool(getVal(row, 'standardActive', 'standard_active')),
            standard_cost: parseNum(getVal(row, 'standardCost', 'standard_cost')),
            standard_rep_price: parseNum(getVal(row, 'standardRepPrice', 'standard_rep_price')),
            new_active: parseBool(getVal(row, 'newActive', 'new_active')),
            new_cost: parseNum(getVal(row, 'newCost', 'new_cost')),
            new_rep_price: parseNum(getVal(row, 'newRepPrice', 'new_rep_price')),
            upgrade_active: parseBool(getVal(row, 'upgradeActive', 'upgrade_active')),
            upgrade_cost: parseNum(getVal(row, 'upgradeCost', 'upgrade_cost')),
            upgrade_rep_price: parseNum(getVal(row, 'upgradeRepPrice', 'upgrade_rep_price')),
            price_book_id: getVal(row, 'priceBookId', 'price_book_id') || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          try {
            const { error: insertError } = await admin.from('software_products').insert(dbData);

            if (insertError) {
              errors.push(`Row ${i + 2}: ${insertError.message}`);
              skipped++;
            } else {
              imported++;
            }
          } catch (rowError: any) {
            errors.push(`Row ${i + 2}: ${rowError.message || 'Unknown error'}`);
            skipped++;
          }
        }

        return createCorsResponse(
          {
            success: errors.length === 0,
            imported,
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
