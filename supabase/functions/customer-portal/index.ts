// Customer Portal Edge Function
// Handles customer-facing portal operations including dashboard, service requests,
// equipment, supply orders, and knowledge base access
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Extract customer ID from JWT metadata (for customer portal users)
    const customerId =
      (user.app_metadata?.customer_id as string) || (user.user_metadata?.customer_id as string);

    // Use service_role client for database operations (bypasses RLS)
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'customer-portal');
    // Path structure after function-name strip: /<sub-route>/<id>
    const subRoute = parts[0]; // dashboard, service-requests, equipment, supply-orders, knowledge-base
    const resourceId = parts[1]; // Optional ID

    // =========================================================================
    // GET /customer-portal/dashboard - Get customer dashboard data
    // =========================================================================
    if (req.method === 'GET' && subRoute === 'dashboard') {
      // For dashboard, customer ID is required
      const queryCustomerId =
        url.searchParams.get('customerId') || url.searchParams.get('customer_id') || customerId;

      if (!queryCustomerId) {
        return createCorsResponse({ error: 'Customer ID required for dashboard' }, 400, req);
      }

      // Verify customer belongs to tenant
      const { data: customer, error: customerError } = await admin
        .from('business_records')
        .select('id, company_name, primary_contact_name, primary_contact_email')
        .eq('id', queryCustomerId)
        .eq('tenant_id', tenantId)
        .single();

      if (customerError || !customer) {
        return createCorsResponse({ error: 'Customer not found or access denied' }, 404, req);
      }

      // Fetch dashboard metrics in parallel
      const [
        serviceRequestsResult,
        equipmentResult,
        supplyOrdersResult,
        notificationsResult,
        recentActivityResult,
      ] = await Promise.all([
        // Service requests summary
        admin
          .from('customer_service_requests')
          .select('id, status', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .eq('customer_id', queryCustomerId),

        // Equipment count
        admin
          .from('equipment')
          .select('id, equipment_status', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .eq('customer_id', queryCustomerId),

        // Supply orders summary
        admin
          .from('customer_supply_orders')
          .select('id, status', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .eq('customer_id', queryCustomerId),

        // Unread notifications
        admin
          .from('customer_notifications')
          .select('id', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .eq('customer_id', queryCustomerId)
          .eq('is_portal_read', false),

        // Recent activity log
        admin
          .from('customer_portal_activity_log')
          .select('id, action, description, timestamp')
          .eq('tenant_id', tenantId)
          .eq('customer_id', queryCustomerId)
          .order('timestamp', { ascending: false })
          .limit(10),
      ]);

      // Calculate service request stats
      const serviceRequests = serviceRequestsResult.data || [];
      const pendingRequests = serviceRequests.filter((r) =>
        ['submitted', 'acknowledged', 'assigned', 'in_progress'].includes(r.status),
      ).length;
      const completedRequests = serviceRequests.filter((r) => r.status === 'completed').length;

      // Calculate equipment stats
      const equipment = equipmentResult.data || [];
      const activeEquipment = equipment.filter((e) => e.equipment_status === 'active').length;

      // Calculate supply order stats
      const supplyOrders = supplyOrdersResult.data || [];
      const pendingOrders = supplyOrders.filter((o) =>
        ['submitted', 'confirmed', 'processing', 'shipped'].includes(o.status),
      ).length;

      const dashboard = {
        customer: {
          id: customer.id,
          companyName: customer.company_name,
          contactName: customer.primary_contact_name,
          contactEmail: customer.primary_contact_email,
        },
        metrics: {
          totalServiceRequests: serviceRequestsResult.count || 0,
          pendingServiceRequests: pendingRequests,
          completedServiceRequests: completedRequests,
          totalEquipment: equipmentResult.count || 0,
          activeEquipment: activeEquipment,
          totalSupplyOrders: supplyOrdersResult.count || 0,
          pendingSupplyOrders: pendingOrders,
          unreadNotifications: notificationsResult.count || 0,
        },
        recentActivity: recentActivityResult.data || [],
      };

      return createCorsResponse({ success: true, data: dashboard }, 200, req);
    }

    // =========================================================================
    // GET /customer-portal/service-requests - List service requests for customer
    // POST /customer-portal/service-requests - Create service request
    // =========================================================================
    if (subRoute === 'service-requests') {
      const queryCustomerId =
        url.searchParams.get('customerId') || url.searchParams.get('customer_id') || customerId;

      if (!queryCustomerId) {
        return createCorsResponse({ error: 'Customer ID required' }, 400, req);
      }

      // GET - List service requests
      if (req.method === 'GET' && !resourceId) {
        const status = url.searchParams.get('status');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = admin
          .from('customer_service_requests')
          .select(
            `
            id,
            request_number,
            title,
            description,
            type,
            priority,
            status,
            equipment_id,
            equipment_serial_number,
            equipment_model,
            equipment_location,
            contact_name,
            contact_phone,
            contact_email,
            preferred_date,
            preferred_time,
            submitted_at,
            acknowledged_at,
            completed_at,
            customer_rating,
            customer_feedback,
            created_at,
            updated_at
          `,
            { count: 'exact' },
          )
          .eq('tenant_id', tenantId)
          .eq('customer_id', queryCustomerId)
          .order('submitted_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (status) {
          query = query.eq('status', status);
        }

        const { data: requests, error, count } = await query;

        if (error) {
          console.error('Error fetching service requests:', error);
          return createCorsResponse({ error: 'Failed to fetch service requests' }, 500, req);
        }

        return createCorsResponse(
          {
            success: true,
            data: requests || [],
            total: count || 0,
            limit,
            offset,
          },
          200,
          req,
        );
      }

      // GET - Get single service request
      if (req.method === 'GET' && resourceId) {
        const { data: request, error } = await admin
          .from('customer_service_requests')
          .select(
            `
            *,
            status_history:customer_service_request_status_history(
              id,
              previous_status,
              new_status,
              change_reason,
              customer_visible_notes,
              changed_by_name,
              created_at
            )
          `,
          )
          .eq('id', resourceId)
          .eq('tenant_id', tenantId)
          .eq('customer_id', queryCustomerId)
          .single();

        if (error) {
          console.error('Error fetching service request:', error);
          return createCorsResponse({ error: 'Service request not found' }, 404, req);
        }

        return createCorsResponse({ success: true, data: request }, 200, req);
      }

      // POST - Create service request
      if (req.method === 'POST') {
        const body = await req.json();

        // Generate request number
        const requestNumber = `SR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        // Get customer portal user ID if available
        let portalUserId = null;
        if (customerId) {
          const { data: portalUser } = await admin
            .from('customer_portal_access')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('customer_id', queryCustomerId)
            .eq('status', 'active')
            .limit(1)
            .single();

          if (portalUser) {
            portalUserId = portalUser.id;
          }
        }

        const requestData = {
          tenant_id: tenantId,
          customer_id: queryCustomerId,
          customer_portal_user_id: portalUserId,
          request_number: requestNumber,
          title: body.title,
          description: body.description,
          type: body.type || 'maintenance',
          priority: body.priority || 'normal',
          status: 'submitted',
          equipment_id: body.equipmentId || body.equipment_id || null,
          equipment_serial_number:
            body.equipmentSerialNumber || body.equipment_serial_number || null,
          equipment_model: body.equipmentModel || body.equipment_model || null,
          equipment_location: body.equipmentLocation || body.equipment_location || null,
          contact_name: body.contactName || body.contact_name,
          contact_phone: body.contactPhone || body.contact_phone || null,
          contact_email: body.contactEmail || body.contact_email || null,
          preferred_date: body.preferredDate || body.preferred_date || null,
          preferred_time: body.preferredTime || body.preferred_time || null,
          urgency_notes: body.urgencyNotes || body.urgency_notes || null,
          customer_notes: body.customerNotes || body.customer_notes || null,
          attachments: body.attachments || [],
          submitted_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: request, error } = await admin
          .from('customer_service_requests')
          .insert(requestData)
          .select()
          .single();

        if (error) {
          console.error('Error creating service request:', error);
          return createCorsResponse(
            { error: 'Failed to create service request', details: error },
            500,
            req,
          );
        }

        // Create initial status history entry
        await admin.from('customer_service_request_status_history').insert({
          tenant_id: tenantId,
          service_request_id: request.id,
          new_status: 'submitted',
          customer_visible_notes: 'Service request submitted',
          changed_by_type: 'customer',
          changed_by_id: user.id,
          changed_by_name: body.contactName || body.contact_name || 'Customer',
          created_at: new Date().toISOString(),
        });

        return createCorsResponse({ success: true, data: request }, 201, req);
      }

      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // =========================================================================
    // GET /customer-portal/equipment - Get customer's equipment
    // =========================================================================
    if (req.method === 'GET' && subRoute === 'equipment') {
      const queryCustomerId =
        url.searchParams.get('customerId') || url.searchParams.get('customer_id') || customerId;

      if (!queryCustomerId) {
        return createCorsResponse({ error: 'Customer ID required' }, 400, req);
      }

      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = admin
        .from('equipment')
        .select(
          `
          id,
          serial_number,
          model_number,
          manufacturer,
          description,
          asset_tag,
          location_description,
          install_date,
          equipment_status,
          is_color_capable,
          meter_type,
          last_service_date,
          next_service_due_date,
          warranty_expires_date,
          service_contract_number,
          created_at,
          updated_at
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .eq('customer_id', queryCustomerId)
        .order('install_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('equipment_status', status);
      }

      const { data: equipment, error, count } = await query;

      if (error) {
        console.error('Error fetching equipment:', error);
        return createCorsResponse({ error: 'Failed to fetch equipment' }, 500, req);
      }

      return createCorsResponse(
        {
          success: true,
          data: equipment || [],
          total: count || 0,
          limit,
          offset,
        },
        200,
        req,
      );
    }

    // =========================================================================
    // GET /customer-portal/supply-orders - Get supply orders
    // =========================================================================
    if (req.method === 'GET' && subRoute === 'supply-orders') {
      const queryCustomerId =
        url.searchParams.get('customerId') || url.searchParams.get('customer_id') || customerId;

      if (!queryCustomerId) {
        return createCorsResponse({ error: 'Customer ID required' }, 400, req);
      }

      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = admin
        .from('customer_supply_orders')
        .select(
          `
          id,
          order_number,
          status,
          delivery_address,
          delivery_instructions,
          requested_delivery_date,
          actual_delivery_date,
          subtotal,
          tax,
          shipping,
          total,
          is_contract_covered,
          tracking_number,
          carrier,
          shipped_at,
          customer_notes,
          submitted_at,
          created_at,
          updated_at,
          items:customer_supply_order_items(
            id,
            product_sku,
            product_name,
            product_description,
            quantity,
            unit_price,
            total_price,
            in_stock,
            estimated_ship_date
          )
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .eq('customer_id', queryCustomerId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: orders, error, count } = await query;

      if (error) {
        console.error('Error fetching supply orders:', error);
        return createCorsResponse({ error: 'Failed to fetch supply orders' }, 500, req);
      }

      return createCorsResponse(
        {
          success: true,
          data: orders || [],
          total: count || 0,
          limit,
          offset,
        },
        200,
        req,
      );
    }

    // =========================================================================
    // GET /customer-portal/knowledge-base - Get knowledge base articles
    // =========================================================================
    if (req.method === 'GET' && subRoute === 'knowledge-base') {
      const categoryId = url.searchParams.get('categoryId') || url.searchParams.get('category_id');
      const search = url.searchParams.get('search');
      const contentType =
        url.searchParams.get('contentType') || url.searchParams.get('content_type');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // If requesting a specific article
      if (resourceId) {
        const { data: article, error } = await admin
          .from('knowledge_articles')
          .select(
            `
            id,
            title,
            slug,
            excerpt,
            content,
            html_content,
            content_type,
            difficulty_level,
            category_id,
            tags,
            keywords,
            word_count,
            estimated_reading_time,
            featured_image,
            media_attachments,
            view_count,
            helpful_votes,
            unhelpful_votes,
            average_rating,
            published_at,
            created_at,
            updated_at,
            category:knowledge_categories(id, name, slug, description)
          `,
          )
          .eq('id', resourceId)
          .eq('tenant_id', tenantId)
          .eq('status', 'published')
          .eq('is_public', true)
          .single();

        if (error) {
          console.error('Error fetching article:', error);
          return createCorsResponse({ error: 'Article not found' }, 404, req);
        }

        // Increment view count
        await admin
          .from('knowledge_articles')
          .update({ view_count: (article.view_count || 0) + 1 })
          .eq('id', resourceId);

        return createCorsResponse({ success: true, data: article }, 200, req);
      }

      // List articles
      let query = admin
        .from('knowledge_articles')
        .select(
          `
          id,
          title,
          slug,
          excerpt,
          content_type,
          difficulty_level,
          category_id,
          tags,
          keywords,
          word_count,
          estimated_reading_time,
          featured_image,
          view_count,
          helpful_votes,
          average_rating,
          featured,
          published_at,
          created_at,
          category:knowledge_categories(id, name, slug)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .eq('status', 'published')
        .eq('is_public', true)
        .order('published_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      if (contentType) {
        query = query.eq('content_type', contentType);
      }

      if (search) {
        query = query.or(
          `title.ilike.%${search}%,excerpt.ilike.%${search}%,plain_text_content.ilike.%${search}%`,
        );
      }

      const { data: articles, error, count } = await query;

      if (error) {
        console.error('Error fetching knowledge base articles:', error);
        return createCorsResponse({ error: 'Failed to fetch knowledge base articles' }, 500, req);
      }

      // Also fetch categories for navigation
      const { data: categories } = await admin
        .from('knowledge_categories')
        .select(
          'id, name, slug, description, icon, article_count, parent_category_id, category_order',
        )
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('is_public', true)
        .order('category_order', { ascending: true });

      return createCorsResponse(
        {
          success: true,
          data: {
            articles: articles || [],
            categories: categories || [],
          },
          total: count || 0,
          limit,
          offset,
        },
        200,
        req,
      );
    }

    // =========================================================================
    // Fallback - Method not allowed
    // =========================================================================
    return createCorsResponse({ error: 'Method not allowed or invalid route' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in customer-portal function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
