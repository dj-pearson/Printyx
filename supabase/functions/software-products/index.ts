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
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
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

    // POST /software-products - Create new software product
    if (req.method === 'POST') {
      const body = await req.json();

      // Map camelCase fields to snake_case for database
      const dbData: Record<string, any> = {
        tenant_id: tenantId,
        product_code: body.productCode,
        product_name: body.productName,
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
