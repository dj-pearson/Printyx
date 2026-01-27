// Purchase Orders Edge Function
// Handles purchase order management with approval workflow and line items
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

// Valid PO statuses
const PO_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'ordered',
  'partially_received',
  'received',
  'cancelled',
] as const;

type POStatus = (typeof PO_STATUSES)[number];

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

    // Use service_role client for database operations (bypasses RLS)
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Path structure: /purchase-orders/:id?/:subResource?/:subResourceId?
    const poId = pathParts[1];
    const subResource = pathParts[2]; // 'line-items', 'submit', 'approve', 'reject', 'receive'
    const subResourceId = pathParts[3]; // For line item operations

    // ============================================================
    // LINE ITEMS ENDPOINTS
    // ============================================================

    // GET /purchase-orders/:id/line-items - Get line items for a PO
    if (req.method === 'GET' && poId && subResource === 'line-items' && !subResourceId) {
      // Verify PO exists and belongs to tenant
      const { data: po, error: poError } = await admin
        .from('purchase_orders')
        .select('id')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (poError || !po) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      const { data: lineItems, error } = await admin
        .from('purchase_order_line_items')
        .select(
          `
          *,
          inventory_item:inventory_items(id, name, part_number, manufacturer)
        `,
        )
        .eq('purchase_order_id', poId)
        .eq('tenant_id', tenantId)
        .order('line_number', { ascending: true });

      if (error) {
        console.error('Error fetching PO line items:', error);
        return createCorsResponse({ error: 'Failed to fetch line items' }, 500, req);
      }

      return createCorsResponse(lineItems || [], 200, req);
    }

    // POST /purchase-orders/:id/line-items - Add line item to PO
    if (req.method === 'POST' && poId && subResource === 'line-items') {
      // Verify PO exists, belongs to tenant, and is in editable status
      const { data: po, error: poError } = await admin
        .from('purchase_orders')
        .select('id, status')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (poError || !po) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      if (!['draft', 'pending_approval'].includes(po.status)) {
        return createCorsResponse(
          {
            error: 'Cannot add line items to a PO that is not in draft or pending_approval status',
          },
          400,
          req,
        );
      }

      const body = await req.json();

      // Get the next line number
      const { data: maxLine } = await admin
        .from('purchase_order_line_items')
        .select('line_number')
        .eq('purchase_order_id', poId)
        .eq('tenant_id', tenantId)
        .order('line_number', { ascending: false })
        .limit(1)
        .single();

      const nextLineNumber = (maxLine?.line_number || 0) + 1;

      const quantity = parseFloat(
        body.quantity || body.quantityOrdered || body.quantity_ordered || 1,
      );
      const unitCost = parseFloat(body.unitCost || body.unit_cost || 0);
      const totalCost = quantity * unitCost;

      const lineItemData = {
        tenant_id: tenantId,
        purchase_order_id: poId,
        line_number: body.lineNumber || body.line_number || nextLineNumber,
        inventory_item_id: body.inventoryItemId || body.inventory_item_id || null,
        item_description: body.itemDescription || body.item_description || body.description,
        part_number: body.partNumber || body.part_number || null,
        manufacturer_part_number:
          body.manufacturerPartNumber || body.manufacturer_part_number || null,
        quantity_ordered: quantity,
        quantity_received: 0,
        unit_of_measure: body.unitOfMeasure || body.unit_of_measure || 'EA',
        unit_cost: unitCost,
        total_cost: totalCost,
        notes: body.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: lineItem, error } = await admin
        .from('purchase_order_line_items')
        .insert(lineItemData)
        .select()
        .single();

      if (error) {
        console.error('Error creating PO line item:', error);
        return createCorsResponse(
          { error: 'Failed to create line item', details: error },
          500,
          req,
        );
      }

      // Recalculate PO totals
      await recalculatePOTotals(admin, poId, tenantId);

      return createCorsResponse(lineItem, 201, req);
    }

    // PUT /purchase-orders/:id/line-items/:itemId - Update line item
    if (
      (req.method === 'PUT' || req.method === 'PATCH') &&
      poId &&
      subResource === 'line-items' &&
      subResourceId
    ) {
      // Verify PO exists and is editable
      const { data: po, error: poError } = await admin
        .from('purchase_orders')
        .select('id, status')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (poError || !po) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      if (!['draft', 'pending_approval'].includes(po.status)) {
        return createCorsResponse(
          {
            error:
              'Cannot update line items on a PO that is not in draft or pending_approval status',
          },
          400,
          req,
        );
      }

      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map updatable fields
      if (body.lineNumber !== undefined || body.line_number !== undefined) {
        updateData.line_number = body.lineNumber || body.line_number;
      }
      if (body.inventoryItemId !== undefined || body.inventory_item_id !== undefined) {
        updateData.inventory_item_id = body.inventoryItemId || body.inventory_item_id;
      }
      if (
        body.itemDescription !== undefined ||
        body.item_description !== undefined ||
        body.description !== undefined
      ) {
        updateData.item_description =
          body.itemDescription || body.item_description || body.description;
      }
      if (body.partNumber !== undefined || body.part_number !== undefined) {
        updateData.part_number = body.partNumber || body.part_number;
      }
      if (
        body.manufacturerPartNumber !== undefined ||
        body.manufacturer_part_number !== undefined
      ) {
        updateData.manufacturer_part_number =
          body.manufacturerPartNumber || body.manufacturer_part_number;
      }
      if (
        body.quantityOrdered !== undefined ||
        body.quantity_ordered !== undefined ||
        body.quantity !== undefined
      ) {
        updateData.quantity_ordered = parseFloat(
          body.quantityOrdered || body.quantity_ordered || body.quantity,
        );
      }
      if (body.unitOfMeasure !== undefined || body.unit_of_measure !== undefined) {
        updateData.unit_of_measure = body.unitOfMeasure || body.unit_of_measure;
      }
      if (body.unitCost !== undefined || body.unit_cost !== undefined) {
        updateData.unit_cost = parseFloat(body.unitCost || body.unit_cost);
      }
      if (body.notes !== undefined) {
        updateData.notes = body.notes;
      }

      // Recalculate total_cost if quantity or unit_cost changed
      if (updateData.quantity_ordered !== undefined || updateData.unit_cost !== undefined) {
        // Get current values if not being updated
        const { data: currentItem } = await admin
          .from('purchase_order_line_items')
          .select('quantity_ordered, unit_cost')
          .eq('id', subResourceId)
          .eq('tenant_id', tenantId)
          .single();

        const qty = updateData.quantity_ordered ?? currentItem?.quantity_ordered ?? 0;
        const cost = updateData.unit_cost ?? currentItem?.unit_cost ?? 0;
        updateData.total_cost = qty * cost;
      }

      const { data: lineItem, error } = await admin
        .from('purchase_order_line_items')
        .update(updateData)
        .eq('id', subResourceId)
        .eq('purchase_order_id', poId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating PO line item:', error);
        return createCorsResponse({ error: 'Failed to update line item' }, 500, req);
      }

      if (!lineItem) {
        return createCorsResponse({ error: 'Line item not found' }, 404, req);
      }

      // Recalculate PO totals
      await recalculatePOTotals(admin, poId, tenantId);

      return createCorsResponse(lineItem, 200, req);
    }

    // DELETE /purchase-orders/:id/line-items/:itemId - Delete line item
    if (req.method === 'DELETE' && poId && subResource === 'line-items' && subResourceId) {
      // Verify PO exists and is editable
      const { data: po, error: poError } = await admin
        .from('purchase_orders')
        .select('id, status')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (poError || !po) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      if (!['draft', 'pending_approval'].includes(po.status)) {
        return createCorsResponse(
          {
            error:
              'Cannot delete line items from a PO that is not in draft or pending_approval status',
          },
          400,
          req,
        );
      }

      const { error } = await admin
        .from('purchase_order_line_items')
        .delete()
        .eq('id', subResourceId)
        .eq('purchase_order_id', poId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting PO line item:', error);
        return createCorsResponse({ error: 'Failed to delete line item' }, 500, req);
      }

      // Recalculate PO totals
      await recalculatePOTotals(admin, poId, tenantId);

      return createCorsResponse({ success: true, message: 'Line item deleted' }, 200, req);
    }

    // ============================================================
    // WORKFLOW ACTION ENDPOINTS
    // ============================================================

    // POST /purchase-orders/:id/submit - Submit PO for approval
    if (req.method === 'POST' && poId && subResource === 'submit') {
      const { data: po, error: poError } = await admin
        .from('purchase_orders')
        .select('id, status')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (poError || !po) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      if (po.status !== 'draft') {
        return createCorsResponse(
          { error: 'Only draft purchase orders can be submitted for approval' },
          400,
          req,
        );
      }

      // Verify PO has line items
      const { count: lineItemCount } = await admin
        .from('purchase_order_line_items')
        .select('*', { count: 'exact', head: true })
        .eq('purchase_order_id', poId)
        .eq('tenant_id', tenantId);

      if (!lineItemCount || lineItemCount === 0) {
        return createCorsResponse(
          { error: 'Cannot submit a purchase order with no line items' },
          400,
          req,
        );
      }

      const { data: updatedPO, error } = await admin
        .from('purchase_orders')
        .update({
          status: 'pending_approval',
          submitted_at: new Date().toISOString(),
          submitted_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error submitting PO:', error);
        return createCorsResponse({ error: 'Failed to submit purchase order' }, 500, req);
      }

      return createCorsResponse(updatedPO, 200, req);
    }

    // POST /purchase-orders/:id/approve - Approve PO
    if (req.method === 'POST' && poId && subResource === 'approve') {
      const body = await req.json().catch(() => ({}));

      const { data: po, error: poError } = await admin
        .from('purchase_orders')
        .select('id, status')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (poError || !po) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      if (po.status !== 'pending_approval') {
        return createCorsResponse(
          { error: 'Only pending approval purchase orders can be approved' },
          400,
          req,
        );
      }

      const { data: updatedPO, error } = await admin
        .from('purchase_orders')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          approval_notes: body.notes || body.approvalNotes || body.approval_notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error approving PO:', error);
        return createCorsResponse({ error: 'Failed to approve purchase order' }, 500, req);
      }

      return createCorsResponse(updatedPO, 200, req);
    }

    // POST /purchase-orders/:id/reject - Reject PO
    if (req.method === 'POST' && poId && subResource === 'reject') {
      const body = await req.json().catch(() => ({}));

      const { data: po, error: poError } = await admin
        .from('purchase_orders')
        .select('id, status')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (poError || !po) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      if (po.status !== 'pending_approval') {
        return createCorsResponse(
          { error: 'Only pending approval purchase orders can be rejected' },
          400,
          req,
        );
      }

      const { data: updatedPO, error } = await admin
        .from('purchase_orders')
        .update({
          status: 'draft', // Return to draft for revision
          rejected_at: new Date().toISOString(),
          rejected_by: user.id,
          rejection_reason: body.reason || body.rejectionReason || body.rejection_reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error rejecting PO:', error);
        return createCorsResponse({ error: 'Failed to reject purchase order' }, 500, req);
      }

      return createCorsResponse(updatedPO, 200, req);
    }

    // POST /purchase-orders/:id/receive - Mark items as received
    if (req.method === 'POST' && poId && subResource === 'receive') {
      const body = await req.json();

      const { data: po, error: poError } = await admin
        .from('purchase_orders')
        .select('id, status')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (poError || !po) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      if (!['approved', 'ordered', 'partially_received'].includes(po.status)) {
        return createCorsResponse(
          {
            error:
              'Purchase order must be approved, ordered, or partially received to record receipts',
          },
          400,
          req,
        );
      }

      // Process received items
      const receivedItems = body.items || body.lineItems || body.line_items || [];
      const receiptDate = body.receiptDate || body.receipt_date || new Date().toISOString();
      const receiptNotes = body.notes || null;

      if (!Array.isArray(receivedItems) || receivedItems.length === 0) {
        return createCorsResponse(
          { error: 'At least one line item must be specified for receiving' },
          400,
          req,
        );
      }

      // Update each line item's received quantity
      for (const item of receivedItems) {
        const lineItemId = item.lineItemId || item.line_item_id || item.id;
        const quantityReceived = parseFloat(
          item.quantityReceived || item.quantity_received || item.quantity || 0,
        );

        if (!lineItemId || quantityReceived <= 0) continue;

        // Get current line item
        const { data: lineItem } = await admin
          .from('purchase_order_line_items')
          .select('quantity_ordered, quantity_received, inventory_item_id')
          .eq('id', lineItemId)
          .eq('purchase_order_id', poId)
          .eq('tenant_id', tenantId)
          .single();

        if (!lineItem) continue;

        const newReceivedQty = (lineItem.quantity_received || 0) + quantityReceived;

        // Update line item
        await admin
          .from('purchase_order_line_items')
          .update({
            quantity_received: newReceivedQty,
            last_received_date: receiptDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lineItemId)
          .eq('tenant_id', tenantId);

        // Update inventory if linked to an inventory item
        if (lineItem.inventory_item_id) {
          const { data: invItem } = await admin
            .from('inventory_items')
            .select('quantity_on_hand, quantity_available, quantity_on_order')
            .eq('id', lineItem.inventory_item_id)
            .eq('tenant_id', tenantId)
            .single();

          if (invItem) {
            await admin
              .from('inventory_items')
              .update({
                quantity_on_hand: (invItem.quantity_on_hand || 0) + quantityReceived,
                quantity_available: (invItem.quantity_available || 0) + quantityReceived,
                quantity_on_order: Math.max(0, (invItem.quantity_on_order || 0) - quantityReceived),
                updated_at: new Date().toISOString(),
              })
              .eq('id', lineItem.inventory_item_id)
              .eq('tenant_id', tenantId);
          }
        }
      }

      // Determine new PO status based on received quantities
      const { data: allLineItems } = await admin
        .from('purchase_order_line_items')
        .select('quantity_ordered, quantity_received')
        .eq('purchase_order_id', poId)
        .eq('tenant_id', tenantId);

      let newStatus: POStatus = po.status as POStatus;
      if (allLineItems && allLineItems.length > 0) {
        const allFullyReceived = allLineItems.every(
          (li) => (li.quantity_received || 0) >= (li.quantity_ordered || 0),
        );
        const someReceived = allLineItems.some((li) => (li.quantity_received || 0) > 0);

        if (allFullyReceived) {
          newStatus = 'received';
        } else if (someReceived) {
          newStatus = 'partially_received';
        }
      }

      // Update PO status and receipt info
      const { data: updatedPO, error } = await admin
        .from('purchase_orders')
        .update({
          status: newStatus,
          last_receipt_date: receiptDate,
          receipt_notes: receiptNotes,
          received_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .select(
          `
          *,
          vendor:vendors(id, vendor_name),
          lineItems:purchase_order_line_items(*)
        `,
        )
        .single();

      if (error) {
        console.error('Error updating PO receipt:', error);
        return createCorsResponse({ error: 'Failed to record receipt' }, 500, req);
      }

      return createCorsResponse(updatedPO, 200, req);
    }

    // ============================================================
    // MAIN CRUD ENDPOINTS
    // ============================================================

    // GET /purchase-orders - List purchase orders with filters
    if (req.method === 'GET' && !poId) {
      const vendorId = url.searchParams.get('vendorId') || url.searchParams.get('vendor_id');
      const status = url.searchParams.get('status');
      const startDate = url.searchParams.get('startDate') || url.searchParams.get('start_date');
      const endDate = url.searchParams.get('endDate') || url.searchParams.get('end_date');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('purchase_orders')
        .select(
          `
          *,
          vendor:vendors(id, vendor_name, primary_contact_name, email, phone)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('order_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }

      if (status) {
        // Support comma-separated statuses
        const statuses = status.split(',').map((s) => s.trim());
        if (statuses.length === 1) {
          query = query.eq('status', statuses[0]);
        } else {
          query = query.in('status', statuses);
        }
      }

      if (startDate) {
        query = query.gte('order_date', startDate);
      }

      if (endDate) {
        query = query.lte('order_date', endDate);
      }

      if (search) {
        query = query.or(
          `po_number.ilike.%${search}%,reference_number.ilike.%${search}%,notes.ilike.%${search}%`,
        );
      }

      const { data: purchaseOrders, error, count } = await query;

      if (error) {
        console.error('Error fetching purchase orders:', error);
        return createCorsResponse({ error: 'Failed to fetch purchase orders' }, 500, req);
      }

      return createCorsResponse(
        {
          data: purchaseOrders || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /purchase-orders/:id - Get single purchase order with line items
    if (req.method === 'GET' && poId && !subResource) {
      const { data: po, error } = await admin
        .from('purchase_orders')
        .select(
          `
          *,
          vendor:vendors(id, vendor_name, primary_contact_name, email, phone, address_line_1, address_line_2, city, state, zip_code)
        `,
        )
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching purchase order:', error);
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      // Get line items with inventory item details
      const { data: lineItems } = await admin
        .from('purchase_order_line_items')
        .select(
          `
          *,
          inventory_item:inventory_items(id, name, part_number, manufacturer, unit_cost)
        `,
        )
        .eq('purchase_order_id', poId)
        .eq('tenant_id', tenantId)
        .order('line_number', { ascending: true });

      return createCorsResponse({ ...po, lineItems: lineItems || [] }, 200, req);
    }

    // POST /purchase-orders - Create purchase order
    if (req.method === 'POST' && !poId) {
      const body = await req.json();

      // Generate PO number if not provided
      const poNumber = body.poNumber || body.po_number || `PO-${Date.now()}`;

      // Calculate totals from line items if provided
      const lineItems = body.lineItems || body.line_items || [];
      const subtotal = lineItems.reduce(
        (sum: number, item: any) =>
          sum +
          parseFloat(
            item.totalCost ||
              item.total_cost ||
              (item.quantity || item.quantityOrdered || item.quantity_ordered || 1) *
                (item.unitCost || item.unit_cost || 0),
          ),
        0,
      );
      const taxAmount = parseFloat(body.taxAmount || body.tax_amount || 0);
      const shippingAmount = parseFloat(body.shippingAmount || body.shipping_amount || 0);
      const totalAmount = subtotal + taxAmount + shippingAmount;

      const poData = {
        tenant_id: tenantId,
        vendor_id: body.vendorId || body.vendor_id,
        po_number: poNumber,
        reference_number: body.referenceNumber || body.reference_number || null,
        order_date: body.orderDate || body.order_date || new Date().toISOString().split('T')[0],
        expected_delivery_date: body.expectedDeliveryDate || body.expected_delivery_date || null,
        ship_to_address: body.shipToAddress || body.ship_to_address || null,
        ship_to_city: body.shipToCity || body.ship_to_city || null,
        ship_to_state: body.shipToState || body.ship_to_state || null,
        ship_to_zip: body.shipToZip || body.ship_to_zip || null,
        shipping_method: body.shippingMethod || body.shipping_method || null,
        payment_terms: body.paymentTerms || body.payment_terms || null,
        subtotal: subtotal,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        total_amount: totalAmount,
        currency: body.currency || 'USD',
        status: 'draft' as POStatus,
        notes: body.notes || null,
        internal_notes: body.internalNotes || body.internal_notes || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Validate required fields
      if (!poData.vendor_id) {
        return createCorsResponse({ error: 'Vendor ID is required' }, 400, req);
      }

      const { data: po, error } = await admin
        .from('purchase_orders')
        .insert(poData)
        .select()
        .single();

      if (error) {
        console.error('Error creating purchase order:', error);
        return createCorsResponse(
          { error: 'Failed to create purchase order', details: error },
          500,
          req,
        );
      }

      // Insert line items if provided
      if (lineItems.length > 0) {
        const lineItemsData = lineItems.map((item: any, index: number) => {
          const qty = parseFloat(
            item.quantity || item.quantityOrdered || item.quantity_ordered || 1,
          );
          const cost = parseFloat(item.unitCost || item.unit_cost || 0);
          return {
            tenant_id: tenantId,
            purchase_order_id: po.id,
            line_number: item.lineNumber || item.line_number || index + 1,
            inventory_item_id: item.inventoryItemId || item.inventory_item_id || null,
            item_description: item.itemDescription || item.item_description || item.description,
            part_number: item.partNumber || item.part_number || null,
            manufacturer_part_number:
              item.manufacturerPartNumber || item.manufacturer_part_number || null,
            quantity_ordered: qty,
            quantity_received: 0,
            unit_of_measure: item.unitOfMeasure || item.unit_of_measure || 'EA',
            unit_cost: cost,
            total_cost: qty * cost,
            notes: item.notes || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });

        await admin.from('purchase_order_line_items').insert(lineItemsData);
      }

      // Fetch complete PO with line items
      const { data: completePO } = await admin
        .from('purchase_orders')
        .select(
          `
          *,
          vendor:vendors(id, vendor_name),
          lineItems:purchase_order_line_items(*)
        `,
        )
        .eq('id', po.id)
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(completePO || po, 201, req);
    }

    // PUT/PATCH /purchase-orders/:id - Update purchase order
    if ((req.method === 'PUT' || req.method === 'PATCH') && poId && !subResource) {
      // Check if PO exists and is editable
      const { data: existingPO, error: checkError } = await admin
        .from('purchase_orders')
        .select('id, status')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (checkError || !existingPO) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      // Only allow updates to draft or pending_approval POs (except for certain fields)
      const editableStatuses = ['draft', 'pending_approval'];
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Fields that can be updated regardless of status
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.internalNotes !== undefined || body.internal_notes !== undefined) {
        updateData.internal_notes = body.internalNotes || body.internal_notes;
      }

      // Fields that can only be updated in editable statuses
      if (editableStatuses.includes(existingPO.status)) {
        if (body.vendorId || body.vendor_id) updateData.vendor_id = body.vendorId || body.vendor_id;
        if (body.referenceNumber !== undefined || body.reference_number !== undefined) {
          updateData.reference_number = body.referenceNumber || body.reference_number;
        }
        if (body.orderDate || body.order_date)
          updateData.order_date = body.orderDate || body.order_date;
        if (body.expectedDeliveryDate !== undefined || body.expected_delivery_date !== undefined) {
          updateData.expected_delivery_date =
            body.expectedDeliveryDate || body.expected_delivery_date;
        }
        if (body.shipToAddress !== undefined || body.ship_to_address !== undefined) {
          updateData.ship_to_address = body.shipToAddress || body.ship_to_address;
        }
        if (body.shipToCity !== undefined || body.ship_to_city !== undefined) {
          updateData.ship_to_city = body.shipToCity || body.ship_to_city;
        }
        if (body.shipToState !== undefined || body.ship_to_state !== undefined) {
          updateData.ship_to_state = body.shipToState || body.ship_to_state;
        }
        if (body.shipToZip !== undefined || body.ship_to_zip !== undefined) {
          updateData.ship_to_zip = body.shipToZip || body.ship_to_zip;
        }
        if (body.shippingMethod !== undefined || body.shipping_method !== undefined) {
          updateData.shipping_method = body.shippingMethod || body.shipping_method;
        }
        if (body.paymentTerms !== undefined || body.payment_terms !== undefined) {
          updateData.payment_terms = body.paymentTerms || body.payment_terms;
        }
        if (body.taxAmount !== undefined || body.tax_amount !== undefined) {
          updateData.tax_amount = parseFloat(body.taxAmount || body.tax_amount);
        }
        if (body.shippingAmount !== undefined || body.shipping_amount !== undefined) {
          updateData.shipping_amount = parseFloat(body.shippingAmount || body.shipping_amount);
        }
        if (body.currency) updateData.currency = body.currency;
      }

      // Status can be updated to 'ordered' or 'cancelled' from approved
      if (body.status) {
        const currentStatus = existingPO.status;
        const newStatus = body.status;

        // Validate status transitions
        const validTransitions: Record<string, string[]> = {
          draft: ['pending_approval', 'cancelled'],
          pending_approval: ['draft', 'approved', 'cancelled'],
          approved: ['ordered', 'cancelled'],
          ordered: ['partially_received', 'received', 'cancelled'],
          partially_received: ['received', 'cancelled'],
          received: [], // Terminal state
          cancelled: [], // Terminal state
        };

        if (validTransitions[currentStatus]?.includes(newStatus)) {
          updateData.status = newStatus;
          if (newStatus === 'ordered') {
            updateData.ordered_at = new Date().toISOString();
            updateData.ordered_by = user.id;
          } else if (newStatus === 'cancelled') {
            updateData.cancelled_at = new Date().toISOString();
            updateData.cancelled_by = user.id;
            updateData.cancellation_reason =
              body.cancellationReason || body.cancellation_reason || null;
          }
        } else if (currentStatus !== newStatus) {
          return createCorsResponse(
            { error: `Cannot transition from ${currentStatus} to ${newStatus}` },
            400,
            req,
          );
        }
      }

      const { data: po, error } = await admin
        .from('purchase_orders')
        .update(updateData)
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating purchase order:', error);
        return createCorsResponse({ error: 'Failed to update purchase order' }, 500, req);
      }

      // Update line items if provided and PO is editable
      if ((body.lineItems || body.line_items) && editableStatuses.includes(existingPO.status)) {
        const lineItems = body.lineItems || body.line_items;

        // Delete existing line items
        await admin
          .from('purchase_order_line_items')
          .delete()
          .eq('purchase_order_id', poId)
          .eq('tenant_id', tenantId);

        // Insert new line items
        if (lineItems.length > 0) {
          const lineItemsData = lineItems.map((item: any, index: number) => {
            const qty = parseFloat(
              item.quantity || item.quantityOrdered || item.quantity_ordered || 1,
            );
            const cost = parseFloat(item.unitCost || item.unit_cost || 0);
            return {
              tenant_id: tenantId,
              purchase_order_id: poId,
              line_number: item.lineNumber || item.line_number || index + 1,
              inventory_item_id: item.inventoryItemId || item.inventory_item_id || null,
              item_description: item.itemDescription || item.item_description || item.description,
              part_number: item.partNumber || item.part_number || null,
              manufacturer_part_number:
                item.manufacturerPartNumber || item.manufacturer_part_number || null,
              quantity_ordered: qty,
              quantity_received: item.quantityReceived || item.quantity_received || 0,
              unit_of_measure: item.unitOfMeasure || item.unit_of_measure || 'EA',
              unit_cost: cost,
              total_cost: qty * cost,
              notes: item.notes || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          });

          await admin.from('purchase_order_line_items').insert(lineItemsData);
        }

        // Recalculate totals
        await recalculatePOTotals(admin, poId, tenantId);
      }

      // Fetch complete PO
      const { data: completePO } = await admin
        .from('purchase_orders')
        .select(
          `
          *,
          vendor:vendors(id, vendor_name),
          lineItems:purchase_order_line_items(*)
        `,
        )
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(completePO || po, 200, req);
    }

    // DELETE /purchase-orders/:id - Delete purchase order (only if draft)
    if (req.method === 'DELETE' && poId && !subResource) {
      // Check if PO exists and is in draft status
      const { data: existingPO, error: checkError } = await admin
        .from('purchase_orders')
        .select('id, status')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (checkError || !existingPO) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      if (existingPO.status !== 'draft') {
        return createCorsResponse(
          { error: 'Only draft purchase orders can be deleted. Consider cancelling instead.' },
          400,
          req,
        );
      }

      // Delete line items first
      await admin
        .from('purchase_order_line_items')
        .delete()
        .eq('purchase_order_id', poId)
        .eq('tenant_id', tenantId);

      // Delete purchase order
      const { error } = await admin
        .from('purchase_orders')
        .delete()
        .eq('id', poId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting purchase order:', error);
        return createCorsResponse({ error: 'Failed to delete purchase order' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Purchase order deleted' }, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in purchase-orders function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

/**
 * Recalculates purchase order totals from line items
 */
async function recalculatePOTotals(admin: any, poId: string, tenantId: string): Promise<void> {
  // Get all line items for this PO
  const { data: lineItems } = await admin
    .from('purchase_order_line_items')
    .select('total_cost')
    .eq('purchase_order_id', poId)
    .eq('tenant_id', tenantId);

  const subtotal = (lineItems || []).reduce(
    (sum: number, item: any) => sum + parseFloat(item.total_cost || 0),
    0,
  );

  // Get current tax and shipping amounts
  const { data: currentPO } = await admin
    .from('purchase_orders')
    .select('tax_amount, shipping_amount')
    .eq('id', poId)
    .eq('tenant_id', tenantId)
    .single();

  const taxAmount = parseFloat(currentPO?.tax_amount || 0);
  const shippingAmount = parseFloat(currentPO?.shipping_amount || 0);
  const totalAmount = subtotal + taxAmount + shippingAmount;

  await admin
    .from('purchase_orders')
    .update({
      subtotal,
      total_amount: totalAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', poId)
    .eq('tenant_id', tenantId);
}
