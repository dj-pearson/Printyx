// Purchase Orders Edge Function
// Handles purchase order management with approval workflow and line items
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  LINE_ITEM_TABLE,
  PENDING_PO_ID,
  RECEIPT_COLUMNS,
  buildLineItemPatch,
  buildLineItemRow,
  lineItemDescription,
  lineItemsFromBody,
  lineItemsSubtotal,
} from './_line-items.ts';
import {
  buildPayableFromReceipt,
  inventoryMovements,
  planReceipt,
  serialCaptureRequired,
  statusAfterReceipt,
} from './_receiving.ts';
import {
  lifecycleRowForReceivedUnit,
  outstandingSerialUnits,
  planSerialCapture,
} from './_serialization.ts';
import {
  ORDERABLE_CONTRACT_STATUSES,
  buildNeedsOrderingRow,
  contractsNeedingOrders,
  orderableLines,
} from './_needs-ordering.ts';
import { isUniqueViolation } from '../_shared/postgrest-errors.ts';
import {
  applyUserScope,
  resolveScope,
  rowInScope,
  scopeRoleLevel,
  unscopedAtLevel,
} from '../_shared/scope.ts';
import { hasPermissionClaim } from '../_shared/permission-claim.ts';

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
    const { parts } = normalizePath(url.pathname, 'purchase-orders');
    // Path structure after function-name strip: /:id?/:subResource?/:subResourceId?
    const poId = parts[0];
    const subResource = parts[1]; // 'line-items', 'submit', 'approve', 'reject', 'receive'
    const subResourceId = parts[2]; // For line item operations

    // ============================================================
    // LINE ITEMS ENDPOINTS
    // ============================================================

    // GET /purchase-orders/:id/line-items - Get line items for a PO
    // WF-R-06. One scope for the whole function: the list narrows with it and the
    // write branches below check individual rows against it.
    //
    // UNSCOPED FROM LEVEL 4, not from 7 like every other list. An approver has to
    // see every order waiting on them, including ones raised outside their team,
    // and an approval queue that hides half its rows is worse than no queue.
    const poScope = unscopedAtLevel(
      await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
        requestedScope: url.searchParams.get('scope'),
      }),
      4,
    );

    /**
     * WF-P-05: one permission vocabulary, on both hosts.
     *
     * Three competed before this. The sidebar reads operations.po.* (which
     * navigation-permissions.ts derives from the module blob and the level, and
     * which a seeded OPERATIONS_MANAGER therefore holds); dev Express checked
     * inventory.po.*, held by NO seeded role, so dev denied every non-admin; and
     * this function checked nothing at all, so production allowed everyone. The
     * codes below are the sidebar's, which is the set the WF-R-03 claim now
     * carries - see _shared/permission-expansion.ts for why it did not before.
     */
    const denyWithoutPermission = (code: string) => {
      if (hasPermissionClaim(user.app_metadata, code)) return null;
      return createCorsResponse(
        {
          error: `This action requires ${code}`,
          code: 'MISSING_PERMISSION',
          details: { required: code },
        },
        403,
        req,
      );
    };

    /** 403 for a write aimed at a row outside the caller's scope. */
    const outOfScope = () =>
      createCorsResponse(
        {
          error: 'This purchase order is outside your scope',
          code: 'ROW_OUT_OF_SCOPE',
        },
        403,
        req,
      );

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
        .from(LINE_ITEM_TABLE)
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
        .from(LINE_ITEM_TABLE)
        .select('line_number')
        .eq('purchase_order_id', poId)
        .eq('tenant_id', tenantId)
        .order('line_number', { ascending: false })
        .limit(1)
        .single();

      const nextLineNumber = (maxLine?.line_number || 0) + 1;

      // item_description is NOT NULL, so an omitted description is a 400 here
      // rather than a 23502 the caller reads as "something went wrong".
      if (!lineItemDescription(body)) {
        return createCorsResponse({ error: 'Line item description is required' }, 400, req);
      }

      const lineItemData = buildLineItemRow(body, {
        tenantId,
        purchaseOrderId: poId,
        lineNumber: nextLineNumber,
      });

      const { data: lineItem, error } = await admin
        .from(LINE_ITEM_TABLE)
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

      Object.assign(updateData, buildLineItemPatch(body));

      // Recalculate total_price when quantity or unit price moved and the caller
      // did not send a total of its own.
      const totalSent = ['totalPrice', 'total_price', 'totalCost', 'total_cost'].some(
        (k) => body[k] !== undefined,
      );
      if (
        !totalSent &&
        (updateData.quantity !== undefined || updateData.unit_price !== undefined)
      ) {
        const { data: currentItem, error: currentError } = await admin
          .from(LINE_ITEM_TABLE)
          .select('quantity, unit_price')
          .eq('id', subResourceId)
          .eq('tenant_id', tenantId)
          .single();

        if (currentError || !currentItem) {
          return createCorsResponse({ error: 'Line item not found' }, 404, req);
        }

        const qty = updateData.quantity ?? Number(currentItem.quantity ?? 0);
        const price = updateData.unit_price ?? Number(currentItem.unit_price ?? 0);
        updateData.total_price = qty * price;
      }

      const { data: lineItem, error } = await admin
        .from(LINE_ITEM_TABLE)
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
        .from(LINE_ITEM_TABLE)
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

    // PATCH|PUT /purchase-orders/:id/status - set the status directly
    //
    // WF-P-05: PurchaseOrders.tsx has always called this and this function had no
    // branch for it, so the status control worked in dev (Express) and 404'd in
    // production. Porting it is what lets the Express router go.
    //
    // 'approved' through here carries the same permission as /approve, because the
    // two do the same thing - a status control that skips the approval gate is the
    // gate not existing.
    if ((req.method === 'PATCH' || req.method === 'PUT') && poId && subResource === 'status') {
      const body = await req.json().catch(() => ({}));
      const status = String(body.status ?? '');
      const ALLOWED = [
        'draft',
        'pending',
        'pending_approval',
        'approved',
        'ordered',
        'received',
        'partially_received',
        'cancelled',
        'rejected',
      ];
      if (!ALLOWED.includes(status)) {
        return createCorsResponse(
          { error: 'Invalid status value', details: { allowed: ALLOWED } },
          400,
          req,
        );
      }

      if (status === 'approved' || status === 'rejected') {
        const denied = denyWithoutPermission('operations.po.approve');
        if (denied) return denied;
      }

      const { data: existing } = await admin
        .from('purchase_orders')
        .select('id, created_by')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!existing) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }
      if (!rowInScope(existing, 'created_by', poScope)) return outOfScope();

      const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === 'approved') {
        // approved_date, not approved_at - AUDIT-037.
        patch.approved_by = user.id;
        patch.approved_date = new Date().toISOString();
      }

      const { data: updated, error } = await admin
        .from('purchase_orders')
        .update(patch)
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error updating purchase order status:', error);
        return createCorsResponse({ error: 'Failed to update purchase order status' }, 500, req);
      }
      if (!updated) return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      return createCorsResponse(updated, 200, req);
    }

    // POST /purchase-orders/:id/submit - Submit PO for approval
    if (req.method === 'POST' && poId && subResource === 'submit') {
      const { data: po, error: poError } = await admin
        .from('purchase_orders')
        .select('id, status, created_by')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (poError || !po) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      // WF-R-06: submitting somebody else's draft puts their name on an approval
      // request they did not make. WF-P-05: and submitting at all is
      // operations.po.create.
      {
        const denied = denyWithoutPermission('operations.po.create');
        if (denied) return denied;
      }
      if (!rowInScope(po, 'created_by', poScope)) return outOfScope();

      if (po.status !== 'draft') {
        return createCorsResponse(
          { error: 'Only draft purchase orders can be submitted for approval' },
          400,
          req,
        );
      }

      // Verify PO has line items
      const { count: lineItemCount } = await admin
        .from(LINE_ITEM_TABLE)
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
      // WF-R-06/WF-P-05: NOTHING gated this. Any authenticated member of the
      // tenant could approve any purchase order in it, whatever their role. The
      // permission is operations.po.approve, which the expansion grants at level 4
      // with the inventory or purchasing module - so an OPERATIONS_MANAGER holds
      // it and a WAREHOUSE_ASSOCIATE does not. That level is also why the scope
      // above stops applying at 4: an approver sees the whole queue precisely
      // because they are allowed to act on it.
      {
        const denied = denyWithoutPermission('operations.po.approve');
        if (denied) return denied;
      }

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
          // approved_date, not approved_at - AUDIT-037.
          approved_date: new Date().toISOString(),
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
      // WF-R-06/WF-P-05: NOTHING gated this. Any authenticated member of the
      // tenant could reject any purchase order in it, whatever their role. The
      // permission is operations.po.approve, which the expansion grants at level 4
      // with the inventory or purchasing module - so an OPERATIONS_MANAGER holds
      // it and a WAREHOUSE_ASSOCIATE does not. That level is also why the scope
      // above stops applying at 4: an approver sees the whole queue precisely
      // because they are allowed to act on it.
      {
        const denied = denyWithoutPermission('operations.po.approve');
        if (denied) return denied;
      }

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

    // GET /purchase-orders/needs-ordering - sold, and nobody has ordered it
    //
    // WF-P-04. No page answered "which deals closed and need equipment"; a buyer
    // hunted through Contracts. The decisions - which contracts count, which
    // lines a vendor can supply, which vendor - are in ./_needs-ordering.ts.
    if (req.method === 'GET' && poId === 'needs-ordering' && !subResource) {
      const [{ data: contractRows }, { data: orders }] = await Promise.all([
        admin
          .from('contracts')
          .select(
            'id, contract_number, customer_id, status, start_date, proposal_id, deal_id, acquisition_type',
          )
          .eq('tenant_id', tenantId)
          .in('status', ORDERABLE_CONTRACT_STATUSES)
          .order('start_date', { ascending: true })
          .limit(500),
        admin
          .from('purchase_orders')
          .select('id, po_number, status, source_contract_id')
          .eq('tenant_id', tenantId)
          .not('source_contract_id', 'is', null),
      ]);

      const { needing } = contractsNeedingOrders(contractRows ?? [], orders ?? []);
      if (needing.length === 0) {
        return createCorsResponse({ data: [], total: 0 }, 200, req);
      }

      const proposalIds = [...new Set(needing.map((c) => c.proposal_id).filter(Boolean))];
      const customerIds = [...new Set(needing.map((c) => c.customer_id))];

      const [{ data: lineRows }, { data: customers }, { data: vendors }] = await Promise.all([
        proposalIds.length > 0
          ? admin
              .from('proposal_line_items')
              .select(
                'id, proposal_id, line_number, item_type, product_id, product_code, product_name, description, quantity, unit_cost, unit_price, is_recurring',
              )
              .eq('tenant_id', tenantId)
              .in('proposal_id', proposalIds)
          : Promise.resolve({ data: [] }),
        admin
          .from('business_records')
          .select('id, company_name')
          .eq('tenant_id', tenantId)
          .in('id', customerIds),
        admin.from('vendors').select('id, vendor_name').eq('tenant_id', tenantId),
      ]);

      // Inventory is looked up by the codes the proposal actually carries, so a
      // tenant with thousands of items does not have its whole catalogue read.
      const codes = [
        ...new Set(
          (lineRows ?? [])
            .flatMap((l: Record<string, unknown>) => [l.product_code, l.product_id])
            .filter(Boolean),
        ),
      ] as string[];
      let inventory: Record<string, unknown>[] = [];
      if (codes.length > 0) {
        const { data } = await admin
          .from('inventory_items')
          .select('id, part_number, manufacturer_part_number, primary_vendor, unit_of_measure')
          .eq('tenant_id', tenantId)
          .or(
            [
              `part_number.in.(${codes.map((c) => JSON.stringify(c)).join(',')})`,
              `manufacturer_part_number.in.(${codes.map((c) => JSON.stringify(c)).join(',')})`,
              `id.in.(${codes.map((c) => JSON.stringify(c)).join(',')})`,
            ].join(','),
          );
        inventory = data ?? [];
      }

      const nameById = new Map<string, string>(
        (customers ?? []).map((c: Record<string, unknown>) => [
          String(c.id),
          String(c.company_name ?? ''),
        ]),
      );
      const linesByProposal = new Map<string, Record<string, unknown>[]>();
      for (const line of lineRows ?? []) {
        const key = String(line.proposal_id);
        linesByProposal.set(key, [...(linesByProposal.get(key) ?? []), line]);
      }

      const rows = needing.map((contract) => {
        const proposalLines = contract.proposal_id
          ? (linesByProposal.get(String(contract.proposal_id)) ?? [])
          : [];
        const { lines, notOrderable } = orderableLines(
          proposalLines as never,
          inventory as never,
          (vendors ?? []) as never,
        );
        return buildNeedsOrderingRow(
          contract,
          nameById.get(String(contract.customer_id)) ?? null,
          lines,
          notOrderable,
        );
      });

      return createCorsResponse({ data: rows, total: rows.length }, 200, req);
    }

    // POST /purchase-orders/:id/serials - record the serials for a receipt
    //
    // WF-L-04. WF-P-02 already established that a serialized line records its
    // quantity and does NOT move bulk inventory, because its units become
    // equipment rows - and then nothing created them. This is the endpoint the
    // receive dialog calls once it has one serial per unit.
    //
    // ONE CALL, NOT N. The AC's shape was "post each unit to POST /equipment",
    // and that endpoint does now accept the links and write the lifecycle row
    // (it is what the customer-page dialog uses). But N independent posts cannot
    // report which units were refused or how many a line is still short, and a
    // partial failure halfway through leaves the buyer guessing. Both are real
    // outcomes here, so they are answered together.
    if (req.method === 'POST' && poId && subResource === 'serials') {
      const body = await req.json();

      const { data: po, error: poError } = await admin
        .from('purchase_orders')
        .select('id, tenant_id, status, po_number, customer_id, created_by')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (poError || !po) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }
      // WF-R-06: recording units against somebody else's order creates real assets.
      if (!rowInScope(po, 'created_by', poScope)) return outOfScope();

      const units = Array.isArray(body.units) ? body.units : [];
      if (units.length === 0) {
        return createCorsResponse({ error: 'At least one unit must be supplied' }, 400, req);
      }

      // Which lines are actually awaiting serials, recomputed from the order
      // rather than trusted from the request - a caller could otherwise attach a
      // serial to a line that was never serialized.
      const { data: lines, error: linesError } = await admin
        .from(LINE_ITEM_TABLE)
        .select('id, quantity, received_quantity, inventory_item_id, item_description')
        .eq('purchase_order_id', poId)
        .eq('tenant_id', tenantId);

      if (linesError || !lines) {
        console.error('Error reading PO line items for serial capture:', linesError);
        return createCorsResponse({ error: 'Failed to read purchase order lines' }, 500, req);
      }

      const inventoryItemIds = [
        ...new Set(lines.map((l: Record<string, unknown>) => l.inventory_item_id).filter(Boolean)),
      ] as string[];
      const serializedIds = new Set<string>();
      if (inventoryItemIds.length > 0) {
        const { data: invItems } = await admin
          .from('inventory_items')
          .select('id, is_serialized')
          .eq('tenant_id', tenantId)
          .in('id', inventoryItemIds);
        for (const item of invItems || []) {
          if (item.is_serialized) serializedIds.add(String(item.id));
        }
      }

      // A line awaits serials for every unit already received against it, less
      // the equipment rows this order has already produced for that line.
      const { data: alreadyCaptured } = await admin
        .from('equipment')
        .select('purchase_order_item_id')
        .eq('tenant_id', tenantId)
        .eq('purchase_order_id', poId);
      const capturedByLine = new Map<string, number>();
      for (const row of alreadyCaptured || []) {
        const key = String(row.purchase_order_item_id ?? '');
        if (key) capturedByLine.set(key, (capturedByLine.get(key) ?? 0) + 1);
      }

      const pending = lines
        .filter(
          (l: Record<string, unknown>) =>
            l.inventory_item_id && serializedIds.has(String(l.inventory_item_id)),
        )
        .map((l: Record<string, unknown>) => ({
          lineItemId: String(l.id),
          quantity:
            Math.max(0, Number(l.received_quantity ?? 0)) - (capturedByLine.get(String(l.id)) ?? 0),
          description: (l.item_description as string) ?? null,
        }))
        .filter((l: { quantity: number }) => l.quantity > 0);

      const plan = planSerialCapture(pending, units, {
        tenantId,
        purchaseOrderId: poId,
        customerId: po.customer_id ?? null,
      });

      const created: Record<string, unknown>[] = [];
      const failed: Array<{ serialNumber: string; reason: string }> = [];
      for (const row of plan.equipment) {
        const { data: unit, error: insertError } = await admin
          .from('equipment')
          .insert(row)
          .select('id, serial_number, purchase_order_item_id')
          .single();

        if (insertError || !unit) {
          // The commonest one is a serial already in the table - it is UNIQUE
          // across the whole tenant set - and that is a real answer, not a fault.
          console.error('Error creating equipment from receipt:', insertError);
          failed.push({
            serialNumber: String(row.serial_number),
            reason: isUniqueViolation(insertError)
              ? 'that serial number is already registered'
              : 'the equipment row could not be created',
          });
          continue;
        }
        created.push(unit);

        const { error: lifecycleError } = await admin
          .from('equipment_lifecycle')
          .insert(lifecycleRowForReceivedUnit(row, String(unit.id)));
        if (lifecycleError) {
          console.error('Error creating equipment lifecycle row:', lifecycleError);
        }
      }

      // What is still outstanding is computed from what actually LANDED, not from
      // the plan: a serial refused as a duplicate leaves its unit still to
      // capture, and reporting the line as done would lose a machine.
      const landed = created.map((unit) => ({
        lineItemId: String(unit.purchase_order_item_id ?? ''),
        serialNumber: String(unit.serial_number ?? ''),
      }));

      return createCorsResponse(
        {
          purchaseOrderId: poId,
          created,
          problems: plan.problems,
          failed,
          outstanding: outstandingSerialUnits(pending, landed),
        },
        201,
        req,
      );
    }

    // POST /purchase-orders/:id/receive - Mark items as received
    if (req.method === 'POST' && poId && subResource === 'receive') {
      const body = await req.json();

      const { data: po, error: poError } = await admin
        .from('purchase_orders')
        .select(
          'id, tenant_id, status, vendor_id, po_number, subtotal, tax_amount, total_amount, created_by',
        )
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (poError || !po) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      // WF-R-06: a list filter narrows what a caller can BROWSE and does nothing
      // about a write aimed straight at an id. Receiving stock against somebody
      // else's order moves real inventory.
      if (!rowInScope(po, 'created_by', poScope)) return outOfScope();

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

      // WF-P-02: the arithmetic lives in ./_receiving.ts so it can be tested and
      // so the Express handler on the other host cannot drift from it.
      const { data: lines, error: linesError } = await admin
        .from(LINE_ITEM_TABLE)
        .select('id, quantity, received_quantity, inventory_item_id, item_description')
        .eq('purchase_order_id', poId)
        .eq('tenant_id', tenantId);

      if (linesError || !lines) {
        console.error('Error reading PO line items for receipt:', linesError);
        return createCorsResponse({ error: 'Failed to read purchase order lines' }, 500, req);
      }

      const plan = planReceipt(lines, receivedItems);

      if (plan.receipts.length === 0) {
        return createCorsResponse(
          {
            error: 'No line item on this purchase order matched the receipt',
            unknownLineItemIds: plan.unknownLineItemIds,
          },
          400,
          req,
        );
      }

      // Which of these are tracked one unit at a time. A serialized line records
      // its receipt but does NOT move bulk inventory - those units become
      // equipment rows with serial numbers (WF-L-04), and adding them to
      // quantity_on_hand as well would count them twice.
      const inventoryItemIds = [
        ...new Set(plan.receipts.map((r) => r.inventoryItemId).filter(Boolean)),
      ] as string[];
      const serialized = new Set<string>();
      if (inventoryItemIds.length > 0) {
        const { data: invItems } = await admin
          .from('inventory_items')
          .select('id, is_serialized')
          .eq('tenant_id', tenantId)
          .in('id', inventoryItemIds);
        for (const item of invItems || []) {
          if (item.is_serialized) serialized.add(String(item.id));
        }
      }

      for (const receipt of plan.receipts) {
        // `updated_at` is not written: migration 0001 dropped it from
        // purchase_order_items.
        const { error: lineError } = await admin
          .from(LINE_ITEM_TABLE)
          .update({
            received_quantity: receipt.newReceivedQuantity,
            last_received_date: receiptDate,
          })
          .eq('id', receipt.lineItemId)
          .eq('purchase_order_id', poId)
          .eq('tenant_id', tenantId);

        if (lineError) {
          console.error('Error recording receipt on line item:', lineError);
          return createCorsResponse(
            { error: 'Failed to record the receipt', details: lineError },
            500,
            req,
          );
        }
      }

      for (const movement of inventoryMovements(plan.receipts, serialized)) {
        const { data: invItem } = await admin
          .from('inventory_items')
          .select('quantity_on_hand, quantity_available, quantity_on_order')
          .eq('id', movement.inventoryItemId)
          .eq('tenant_id', tenantId)
          .single();

        if (!invItem) continue;

        await admin
          .from('inventory_items')
          .update({
            quantity_on_hand: (invItem.quantity_on_hand || 0) + movement.quantity,
            quantity_available: (invItem.quantity_available || 0) + movement.quantity,
            quantity_on_order: Math.max(0, (invItem.quantity_on_order || 0) - movement.quantity),
            updated_at: new Date().toISOString(),
          })
          .eq('id', movement.inventoryItemId)
          .eq('tenant_id', tenantId);
      }

      const derivedStatus = statusAfterReceipt(lines, plan.receipts);
      const newStatus: POStatus = (derivedStatus ?? po.status) as POStatus;
      const pendingSerials = serialCaptureRequired(lines, plan.receipts, serialized);

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
          lineItems:purchase_order_items(*)
        `,
        )
        .single();

      if (error) {
        console.error('Error updating PO receipt:', error);
        return createCorsResponse({ error: 'Failed to record receipt' }, 500, req);
      }

      // WF-P-02: goods in means a liability, so the expected bill is raised here
      // rather than waiting for someone to key it in. Once per order, not once
      // per partial receipt - hence the lookup first. A failure is reported
      // alongside the receipt rather than failing it: the stock has physically
      // arrived and the line quantities are already committed, so answering 500
      // would leave the caller believing none of it happened.
      let payableError: string | null = null;
      let payableId: string | null = null;
      const { data: existingPayable } = await admin
        .from('accounts_payable')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('purchase_order_id', poId)
        .limit(1);

      if (existingPayable && existingPayable.length > 0) {
        payableId = String(existingPayable[0].id);
      } else {
        const { data: payable, error: apError } = await admin
          .from('accounts_payable')
          .insert(buildPayableFromReceipt(po, { receiptDate, createdBy: user.id }))
          .select('id')
          .single();

        if (apError) {
          console.error('Error raising payable for PO receipt:', apError);
          payableError = 'The receipt was recorded but no payable was raised for it';
        } else {
          payableId = String(payable.id);
        }
      }

      return createCorsResponse(
        {
          ...updatedPO,
          // Named rather than swallowed, each for a reason a caller must see:
          // an over-receipt is stock the warehouse is holding beyond the order,
          // a serialized line is a receipt that is NOT finished until WF-L-04
          // captures its serial numbers, and an unmatched id means part of the
          // request did nothing.
          overReceipts: plan.overReceipts,
          requiresSerialCapture: pendingSerials,
          unknownLineItemIds: plan.unknownLineItemIds,
          payableId,
          payableError,
        },
        200,
        req,
      );
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

      // WF-R-04/WF-R-06. `purchase_orders` names one user, whoever raised it, so
      // that is the only ownership this table can express. Above level 4 poScope
      // carries no user filter and this is a no-op - see where it is built.
      query = applyUserScope(query, 'created_by', poScope);

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

      // WF-P-03: the contract detail and the Needs Ordering queue both ask
      // "which POs are for this contract".
      const contractId =
        url.searchParams.get('contractId') || url.searchParams.get('source_contract_id');
      const dealId = url.searchParams.get('dealId') || url.searchParams.get('source_deal_id');
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');

      if (contractId) query = query.eq('source_contract_id', contractId);
      if (dealId) query = query.eq('source_deal_id', dealId);
      if (customerId) query = query.eq('customer_id', customerId);

      if (search) {
        // AUDIT-037: reference_number and notes are not columns on this table -
        // the searchable free text is `description`, and the reference is the
        // PO number itself. Naming them made every search a 42703.
        query = query.or(`po_number.ilike.%${search}%,description.ilike.%${search}%`);
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
          vendor:vendors(id, vendor_name, primary_contact_name, email, phone, address_line_1, address_line_2, city, state, zip_code),
          sourceContract:contracts!purchase_orders_source_contract_id_fkey(id, contract_number, customer_id, status),
          customer:business_records!purchase_orders_customer_id_fkey(id, company_name)
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
        .from(LINE_ITEM_TABLE)
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

      // WF-P-01: the page posts `items`, this read `lineItems`, and it priced each
      // line off `unitCost` while the page sends `unitPrice` - so every line was
      // dropped at 201 and the subtotal computed from them was 0. The rows are
      // built once, up front, and both the subtotal and the insert use them.
      const lineItemRows = lineItemsFromBody(body).map((item, index) =>
        buildLineItemRow(item, {
          tenantId,
          purchaseOrderId: PENDING_PO_ID,
          lineNumber: index + 1,
        }),
      );
      const subtotal = lineItemsSubtotal(lineItemRows);
      const taxAmount = parseFloat(body.taxAmount || body.tax_amount || 0);
      const shippingAmount = parseFloat(body.shippingAmount || body.shipping_amount || 0);
      const totalAmount = subtotal + taxAmount + shippingAmount;

      // AUDIT-037: this payload and the page that posts to it did not share a
      // vocabulary. The page (client/src/pages/PurchaseOrders.tsx) sends
      // poNumber, vendorId, requestedBy, orderDate, expectedDate, description,
      // deliveryAddress and specialInstructions - the real column names. This
      // read referenceNumber, expectedDeliveryDate, four shipTo* parts, notes
      // and internalNotes, none of which is a column, and it never set
      // requested_by, which is NOT NULL. So creating a purchase order failed
      // twice over and had done since the function shipped.
      //
      // Four fields are dropped rather than given columns: reference_number,
      // currency, shipping_method and payment_terms. The page sends none of
      // them, the PO number is the reference, and a vendor already carries its
      // payment terms. Adding columns for input nothing supplies is how the
      // rest of this file got into that state.
      const poData = {
        tenant_id: tenantId,
        vendor_id: body.vendorId || body.vendor_id,
        po_number: poNumber,
        requested_by: body.requestedBy || body.requested_by || user.id,
        order_date: body.orderDate || body.order_date || new Date().toISOString().split('T')[0],
        expected_date: body.expectedDate || body.expected_date || body.expectedDeliveryDate || null,
        description: body.description || body.notes || null,
        subtotal: subtotal,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        total_amount: totalAmount,
        status: 'draft' as POStatus,
        delivery_address: body.deliveryAddress || body.delivery_address || null,
        special_instructions:
          body.specialInstructions || body.special_instructions || body.internalNotes || null,
        // WF-P-03: what this order is for. `contractId` is the name the Book
        // Order link uses; the others follow the column names. All optional - a
        // stock-replenishment PO has none of them.
        source_contract_id:
          body.sourceContractId || body.source_contract_id || body.contractId || null,
        source_deal_id: body.sourceDealId || body.source_deal_id || body.dealId || null,
        customer_id: body.customerId || body.customer_id || null,
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

      // Insert line items. A failure here is reported rather than swallowed: a PO
      // created without the lines the buyer entered is the defect this story is
      // about, and answering 201 would hide it again.
      if (lineItemRows.length > 0) {
        const { error: lineItemError } = await admin
          .from(LINE_ITEM_TABLE)
          .insert(lineItemRows.map((row) => ({ ...row, purchase_order_id: po.id })));

        if (lineItemError) {
          console.error('Error creating PO line items:', lineItemError);
          return createCorsResponse(
            {
              error: 'Purchase order was created but its line items were not saved',
              purchaseOrderId: po.id,
              details: lineItemError,
            },
            500,
            req,
          );
        }
      }

      // Fetch complete PO with line items
      const { data: completePO } = await admin
        .from('purchase_orders')
        .select(
          `
          *,
          vendor:vendors(id, vendor_name),
          lineItems:purchase_order_items(*)
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
        .select('id, status, created_by')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (checkError || !existingPO) {
        return createCorsResponse({ error: 'Purchase order not found' }, 404, req);
      }

      // WF-R-06: editing an order someone else raised, including its vendor and
      // its totals, was open to every authenticated member of the tenant.
      if (!rowInScope(existingPO, 'created_by', poScope)) return outOfScope();

      // Only allow updates to draft or pending_approval POs (except for certain fields)
      const editableStatuses = ['draft', 'pending_approval'];
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // AUDIT-037: same rebinding as the create above. notes, internal_notes,
      // reference_number, expected_delivery_date, the four shipTo* parts,
      // shipping_method and currency are not columns, so ANY edit that touched
      // one lost the whole update - including the vendor change in the same
      // request.
      //
      // Fields that can be updated regardless of status
      if (body.notes !== undefined || body.description !== undefined) {
        updateData.description = body.description ?? body.notes;
      }
      if (
        body.specialInstructions !== undefined ||
        body.special_instructions !== undefined ||
        body.internalNotes !== undefined
      ) {
        updateData.special_instructions =
          body.specialInstructions ?? body.special_instructions ?? body.internalNotes;
      }

      // Fields that can only be updated in editable statuses
      if (editableStatuses.includes(existingPO.status)) {
        if (body.vendorId || body.vendor_id) updateData.vendor_id = body.vendorId || body.vendor_id;
        if (body.orderDate || body.order_date)
          updateData.order_date = body.orderDate || body.order_date;
        if (
          body.expectedDate !== undefined ||
          body.expected_date !== undefined ||
          body.expectedDeliveryDate !== undefined
        ) {
          updateData.expected_date =
            body.expectedDate ?? body.expected_date ?? body.expectedDeliveryDate;
        }
        if (
          body.deliveryAddress !== undefined ||
          body.delivery_address !== undefined ||
          body.shipToAddress !== undefined
        ) {
          updateData.delivery_address =
            body.deliveryAddress ?? body.delivery_address ?? body.shipToAddress;
        }
        if (body.taxAmount !== undefined || body.tax_amount !== undefined) {
          updateData.tax_amount = parseFloat(body.taxAmount || body.tax_amount);
        }
        if (body.shippingAmount !== undefined || body.shipping_amount !== undefined) {
          updateData.shipping_amount = parseFloat(body.shippingAmount || body.shipping_amount);
        }
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
      const replacementLines =
        (body.items ?? body.lineItems ?? body.line_items) ? lineItemsFromBody(body) : null;

      if (replacementLines && editableStatuses.includes(existingPO.status)) {
        // Delete existing line items
        await admin
          .from(LINE_ITEM_TABLE)
          .delete()
          .eq('purchase_order_id', poId)
          .eq('tenant_id', tenantId);

        // Insert new line items
        if (replacementLines.length > 0) {
          const { error: lineItemError } = await admin.from(LINE_ITEM_TABLE).insert(
            replacementLines.map((item, index) =>
              buildLineItemRow(item, {
                tenantId,
                purchaseOrderId: poId,
                lineNumber: index + 1,
              }),
            ),
          );

          if (lineItemError) {
            console.error('Error replacing PO line items:', lineItemError);
            return createCorsResponse(
              { error: 'Failed to save line items', details: lineItemError },
              500,
              req,
            );
          }
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
          lineItems:purchase_order_items(*)
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
        .from(LINE_ITEM_TABLE)
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

    // GET /purchase-orders/stats/summary (EDGE-002h)
    //
    // PurchaseOrders.tsx reads total, draft, pending, approved, ordered,
    // received, cancelled, totalValue and pendingValue. Express fetches every
    // PO and filters in JS; the counts are done server-side here, and only the
    // rows needed for the two money totals come back.
    if (req.method === 'GET' && poId === 'stats' && subResource === 'summary') {
      const STATUSES = ['draft', 'pending', 'approved', 'ordered', 'received', 'cancelled'];

      const countOf = async (
        client: typeof admin,
        table: string,
        apply: (q: any) => any,
      ): Promise<number> => {
        const { count } = await apply(
          client.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        );
        return count ?? 0;
      };

      const [total, ...statusCounts] = await Promise.all([
        countOf(admin, 'purchase_orders', (q) => q),
        ...STATUSES.map((st) => countOf(admin, 'purchase_orders', (q) => q.eq('status', st))),
      ]);

      // SUM has no PostgREST equivalent, so the amounts come back to be added.
      const { data: amountRows } = await admin
        .from('purchase_orders')
        .select('status, total_amount')
        .eq('tenant_id', tenantId);

      const PENDING_STATUSES = new Set(['pending', 'approved', 'ordered']);
      let totalValue = 0;
      let pendingValue = 0;
      for (const row of amountRows ?? []) {
        const amount = parseFloat(String((row as any).total_amount ?? '0')) || 0;
        totalValue += amount;
        if (PENDING_STATUSES.has(String((row as any).status))) pendingValue += amount;
      }

      return createCorsResponse(
        {
          total,
          ...Object.fromEntries(STATUSES.map((st, i) => [st, statusCounts[i]])),
          totalValue,
          pendingValue,
        },
        200,
        req,
      );
    }

    // GET /purchase-orders/suggestions/low-stock (EDGE-002h)
    //
    // Express's version cannot run. It selects inventoryItems.currentStock and
    // inventoryItems.supplier - neither is a field on the only inventory_items
    // definition in shared/ - and its raw WHERE clause names current_stock and
    // supplier, so PostgREST's equivalent would be a 42703. The real columns
    // are quantity_on_hand and primary_vendor. Express also aliases
    // quantityOnOrder to currentStock and reorderQuantity to reorderPoint,
    // which the table has as their own columns, so those are read properly here
    // rather than duplicated.
    if (req.method === 'GET' && poId === 'suggestions' && subResource === 'low-stock') {
      const { data: items, error } = await admin
        .from('inventory_items')
        .select(
          'id, name, item_description, part_number, quantity_on_hand, quantity_on_order, reorder_point, reorder_quantity, unit_cost, primary_vendor',
        )
        .eq('tenant_id', tenantId)
        .not('reorder_point', 'is', null)
        .gt('reorder_point', 0)
        .not('primary_vendor', 'is', null)
        .order('primary_vendor', { ascending: true })
        .order('name', { ascending: true })
        .limit(500);

      if (error) {
        console.error('Error building low-stock suggestions:', error);
        return createCorsResponse({ message: 'Failed to build suggestions' }, 500, req);
      }

      // PostgREST cannot compare two columns, so the at-or-below-reorder test
      // happens here rather than in the filter.
      const low = (items ?? []).filter(
        (it: any) => Number(it.quantity_on_hand ?? 0) <= Number(it.reorder_point ?? 0),
      );

      if (low.length === 0) {
        return createCorsResponse({ groups: [] }, 200, req);
      }

      const { data: vendorRows } = await admin
        .from('vendors')
        .select('id, vendor_name')
        .eq('tenant_id', tenantId);
      const vendorIdByName = new Map(
        (vendorRows ?? []).map((v: any) => [String(v.vendor_name ?? '').toLowerCase(), v.id]),
      );

      const groupsMap = new Map<string, any>();
      for (const it of low as any[]) {
        const key = String(it.primary_vendor ?? '').toLowerCase();
        if (!key) continue;
        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            vendorName: it.primary_vendor,
            vendorId: vendorIdByName.get(key) ?? null,
            items: [],
          });
        }
        groupsMap.get(key).items.push({
          inventoryItemId: it.id,
          partNumber: it.part_number,
          itemDescription: it.item_description || it.name,
          recommendedQty: Number(it.reorder_quantity) || 0,
          unitCost: it.unit_cost || 0,
        });
      }

      return createCorsResponse({ groups: [...groupsMap.values()] }, 200, req);
    }

    // POST /purchase-orders/generate-from-suggestions
    //
    // One draft PO per vendor group, with its line items. Groups without a
    // resolved vendorId are skipped, as Express does - a PO with no vendor is
    // not useful, and inventory_items only records the vendor by NAME.
    if (req.method === 'POST' && poId === 'generate-from-suggestions') {
      const body = await req.json().catch(() => ({}) as Record<string, unknown>);
      const groups = body.groups;

      if (!Array.isArray(groups) || groups.length === 0) {
        return createCorsResponse({ message: 'No groups provided' }, 400, req);
      }

      const now = Date.now();
      const createdPoIds: string[] = [];
      const skipped: string[] = [];

      for (let i = 0; i < groups.length; i++) {
        const group: any = groups[i];
        if (!group?.vendorId || !Array.isArray(group.items) || group.items.length === 0) {
          skipped.push(group?.vendorName ?? `group ${i + 1}`);
          continue;
        }

        let subtotal = 0;
        const lineItems = group.items.map((it: any, idx: number) => {
          const quantity = Number(it.quantity ?? it.recommendedQty ?? 0);
          const unitPrice = Number(it.unitCost ?? 0);
          const totalPrice = quantity * unitPrice;
          subtotal += totalPrice;
          return {
            tenant_id: tenantId,
            line_number: idx + 1,
            item_description: it.itemDescription || it.partNumber || 'Item',
            item_code: it.partNumber ?? null,
            quantity,
            unit_price: unitPrice,
            total_price: totalPrice,
            created_at: new Date(now).toISOString(),
          };
        });

        const { data: po, error: poError } = await admin
          .from('purchase_orders')
          .insert({
            tenant_id: tenantId,
            po_number: `PO-${now}-${i + 1}`,
            vendor_id: group.vendorId,
            requested_by: user.id,
            order_date: body.orderDate
              ? new Date(body.orderDate as string).toISOString()
              : new Date(now).toISOString(),
            expected_date: body.expectedDate
              ? new Date(body.expectedDate as string).toISOString()
              : null,
            description:
              (body.description as string) ||
              `Auto-generated from low stock for ${group.vendorName || group.vendorId}`,
            subtotal,
            tax_amount: 0,
            shipping_amount: 0,
            total_amount: subtotal,
            status: 'draft',
            created_by: user.id,
            created_at: new Date(now).toISOString(),
            updated_at: new Date(now).toISOString(),
          })
          .select()
          .single();

        if (poError || !po) {
          console.error('Error creating purchase order from suggestions:', poError);
          skipped.push(group.vendorName ?? group.vendorId);
          continue;
        }

        const { error: itemsError } = await admin
          .from('purchase_order_items')
          .insert(lineItems.map((li: any) => ({ ...li, purchase_order_id: po.id })));

        if (itemsError) {
          console.error('Error creating purchase order items:', itemsError);
        }

        createdPoIds.push(po.id as string);
      }

      return createCorsResponse(
        {
          success: true,
          created: createdPoIds.length,
          purchaseOrderIds: createdPoIds,
          ...(skipped.length > 0
            ? { skipped, skippedReason: 'no resolved vendorId, or the insert failed' }
            : {}),
        },
        201,
        req,
      );
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
    .from(LINE_ITEM_TABLE)
    .select('total_price')
    .eq('purchase_order_id', poId)
    .eq('tenant_id', tenantId);

  const subtotal = lineItemsSubtotal(lineItems || []);

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
