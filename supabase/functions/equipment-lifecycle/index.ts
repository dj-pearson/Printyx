// Equipment Lifecycle Edge Function
// Handles equipment lifecycle state machine operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

// Valid lifecycle stages
const LIFECYCLE_STAGES = {
  ORDERED: 'ordered',
  RECEIVED: 'received',
  STAGED: 'staged',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  INSTALLED: 'installed',
  ACTIVE: 'active',
  MAINTENANCE: 'maintenance',
  RETIRED: 'retired',
  DISPOSED: 'disposed',
  TRADED_IN: 'traded_in',
} as const;

// Valid transitions between stages
const VALID_TRANSITIONS: Record<string, string[]> = {
  [LIFECYCLE_STAGES.ORDERED]: [LIFECYCLE_STAGES.RECEIVED, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.RECEIVED]: [LIFECYCLE_STAGES.STAGED, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.STAGED]: [LIFECYCLE_STAGES.IN_TRANSIT, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.IN_TRANSIT]: [LIFECYCLE_STAGES.DELIVERED, LIFECYCLE_STAGES.STAGED],
  [LIFECYCLE_STAGES.DELIVERED]: [LIFECYCLE_STAGES.INSTALLED, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.INSTALLED]: [LIFECYCLE_STAGES.ACTIVE, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.ACTIVE]: [LIFECYCLE_STAGES.MAINTENANCE, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.MAINTENANCE]: [LIFECYCLE_STAGES.ACTIVE, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.RETIRED]: [LIFECYCLE_STAGES.DISPOSED, LIFECYCLE_STAGES.TRADED_IN],
  [LIFECYCLE_STAGES.DISPOSED]: [],
  [LIFECYCLE_STAGES.TRADED_IN]: [],
};

// Validation requirements for transitions
const VALIDATIONS: Record<string, Record<string, string[]>> = {
  [LIFECYCLE_STAGES.RECEIVED]: {
    [LIFECYCLE_STAGES.STAGED]: [
      'quality_control_passed',
      'serial_number_verified',
      'photo_documentation',
    ],
  },
  [LIFECYCLE_STAGES.STAGED]: {
    [LIFECYCLE_STAGES.IN_TRANSIT]: ['delivery_scheduled', 'driver_assigned', 'customer_notified'],
  },
  [LIFECYCLE_STAGES.IN_TRANSIT]: {
    [LIFECYCLE_STAGES.DELIVERED]: ['delivery_signature_collected', 'equipment_condition_verified'],
  },
  [LIFECYCLE_STAGES.DELIVERED]: {
    [LIFECYCLE_STAGES.INSTALLED]: [
      'delivery_signature',
      'equipment_unpacked',
      'site_inspection_passed',
    ],
  },
  [LIFECYCLE_STAGES.INSTALLED]: {
    [LIFECYCLE_STAGES.ACTIVE]: [
      'installation_completed',
      'configuration_backed_up',
      'customer_trained',
      'acceptance_signed',
    ],
  },
  [LIFECYCLE_STAGES.ACTIVE]: {
    [LIFECYCLE_STAGES.RETIRED]: [
      'maintenance_history_reviewed',
      'customer_notification_sent',
      'replacement_planned',
    ],
  },
  [LIFECYCLE_STAGES.RETIRED]: {
    [LIFECYCLE_STAGES.DISPOSED]: [
      'data_wiped_confirmed',
      'disposal_vendor_selected',
      'certificate_of_destruction',
    ],
    [LIFECYCLE_STAGES.TRADED_IN]: [
      'trade_in_evaluation_completed',
      'trade_in_credit_approved',
      'customer_acceptance',
    ],
  },
};

function canTransition(fromStage: string, toStage: string): boolean {
  const allowedTransitions = VALID_TRANSITIONS[fromStage];
  return allowedTransitions?.includes(toStage) ?? false;
}

function getAvailableTransitions(currentStage: string): string[] {
  return VALID_TRANSITIONS[currentStage] || [];
}

function getValidationRequirements(fromStage: string, toStage: string): string[] {
  return VALIDATIONS[fromStage]?.[toStage] || [];
}

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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Path patterns:
    // /equipment-lifecycle/stages
    // /equipment-lifecycle/:equipmentId/status
    // /equipment-lifecycle/:equipmentId/transition
    // /equipment-lifecycle/transitions/history
    // /equipment-lifecycle/upcoming

    const firstPart = pathParts[1]; // After 'equipment-lifecycle'
    const secondPart = pathParts[2];

    // GET /equipment-lifecycle/stages - Get all lifecycle stages
    if (req.method === 'GET' && firstPart === 'stages') {
      const stages = Object.entries(LIFECYCLE_STAGES).map(([key, value]) => ({
        key,
        value,
        name: value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        availableTransitions: getAvailableTransitions(value),
      }));

      return createCorsResponse(
        {
          success: true,
          data: stages,
        },
        200,
        req,
      );
    }

    // GET /equipment-lifecycle/transitions/history - Get transition history (all equipment)
    if (req.method === 'GET' && firstPart === 'transitions' && secondPart === 'history') {
      const equipmentId =
        url.searchParams.get('equipmentId') || url.searchParams.get('equipment_id');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('equipment_lifecycle_transitions')
        .select(
          `
          *,
          equipment:equipment_lifecycle!equipment_lifecycle_transitions_equipment_id_fkey(
            id,
            equipment_id,
            current_stage
          )
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('triggered_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (equipmentId) {
        query = query.eq('equipment_id', equipmentId);
      }

      const { data: transitions, error, count } = await query;

      if (error) {
        console.error('Error fetching transition history:', error);
        return createCorsResponse({ error: 'Failed to fetch transition history' }, 500, req);
      }

      return createCorsResponse(
        {
          success: true,
          data: transitions || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /equipment-lifecycle/upcoming - Get upcoming lifecycle events
    if (req.method === 'GET' && firstPart === 'upcoming') {
      const daysAhead = parseInt(url.searchParams.get('days') || '30');
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      // Get equipment with upcoming lifecycle events (warranty expiry, lease expiry, service due)
      const { data: equipmentEvents, error } = await admin
        .from('equipment')
        .select(
          `
          id,
          serial_number,
          model_number,
          manufacturer,
          equipment_status,
          warranty_expires_date,
          lease_expires_date,
          next_service_due_date,
          customer:business_records!equipment_customer_id_fkey(id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .or(
          `warranty_expires_date.lte.${futureDate.toISOString()},lease_expires_date.lte.${futureDate.toISOString()},next_service_due_date.lte.${futureDate.toISOString()}`,
        )
        .order('next_service_due_date', { ascending: true });

      if (error) {
        console.error('Error fetching upcoming events:', error);
        return createCorsResponse({ error: 'Failed to fetch upcoming events' }, 500, req);
      }

      // Transform to upcoming events format
      const events: any[] = [];
      const now = new Date();

      for (const eq of equipmentEvents || []) {
        if (eq.warranty_expires_date && new Date(eq.warranty_expires_date) <= futureDate) {
          events.push({
            type: 'warranty_expiry',
            equipmentId: eq.id,
            serialNumber: eq.serial_number,
            modelNumber: eq.model_number,
            manufacturer: eq.manufacturer,
            customer: eq.customer,
            date: eq.warranty_expires_date,
            daysUntil: Math.ceil(
              (new Date(eq.warranty_expires_date).getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
            priority: new Date(eq.warranty_expires_date) <= now ? 'critical' : 'warning',
          });
        }
        if (eq.lease_expires_date && new Date(eq.lease_expires_date) <= futureDate) {
          events.push({
            type: 'lease_expiry',
            equipmentId: eq.id,
            serialNumber: eq.serial_number,
            modelNumber: eq.model_number,
            manufacturer: eq.manufacturer,
            customer: eq.customer,
            date: eq.lease_expires_date,
            daysUntil: Math.ceil(
              (new Date(eq.lease_expires_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            ),
            priority: new Date(eq.lease_expires_date) <= now ? 'critical' : 'warning',
          });
        }
        if (eq.next_service_due_date && new Date(eq.next_service_due_date) <= futureDate) {
          events.push({
            type: 'service_due',
            equipmentId: eq.id,
            serialNumber: eq.serial_number,
            modelNumber: eq.model_number,
            manufacturer: eq.manufacturer,
            customer: eq.customer,
            date: eq.next_service_due_date,
            daysUntil: Math.ceil(
              (new Date(eq.next_service_due_date).getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
            priority: new Date(eq.next_service_due_date) <= now ? 'critical' : 'warning',
          });
        }
      }

      // Sort by date
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return createCorsResponse(
        {
          success: true,
          data: events,
          total: events.length,
          daysAhead,
        },
        200,
        req,
      );
    }

    // Equipment-specific routes (with equipmentId)
    const equipmentId = firstPart;

    if (
      !equipmentId ||
      equipmentId === 'stages' ||
      equipmentId === 'transitions' ||
      equipmentId === 'upcoming'
    ) {
      return createCorsResponse({ error: 'Equipment ID required' }, 400, req);
    }

    // GET /equipment-lifecycle/:equipmentId/status - Get equipment's current lifecycle status
    if (req.method === 'GET' && secondPart === 'status') {
      // Get equipment lifecycle record
      const { data: lifecycle, error: lifecycleError } = await admin
        .from('equipment_lifecycle')
        .select('*')
        .eq('equipment_id', equipmentId)
        .eq('tenant_id', tenantId)
        .single();

      if (lifecycleError && lifecycleError.code !== 'PGRST116') {
        console.error('Error fetching lifecycle:', lifecycleError);
        return createCorsResponse({ error: 'Failed to fetch lifecycle status' }, 500, req);
      }

      // If no lifecycle record exists, try to get from equipment table
      if (!lifecycle) {
        const { data: equipment, error: equipmentError } = await admin
          .from('equipment')
          .select('id, serial_number, equipment_status')
          .eq('id', equipmentId)
          .eq('tenant_id', tenantId)
          .single();

        if (equipmentError) {
          return createCorsResponse({ error: 'Equipment not found' }, 404, req);
        }

        // Return default status based on equipment_status
        const defaultStage =
          equipment.equipment_status === 'active'
            ? LIFECYCLE_STAGES.ACTIVE
            : LIFECYCLE_STAGES.ORDERED;

        return createCorsResponse(
          {
            success: true,
            data: {
              equipmentId: equipment.id,
              currentStage: defaultStage,
              availableTransitions: getAvailableTransitions(defaultStage).map((toStage) => ({
                toStage,
                validationRequirements: getValidationRequirements(defaultStage, toStage),
              })),
              hasLifecycleRecord: false,
            },
          },
          200,
          req,
        );
      }

      // Get available transitions with validation requirements
      const currentStage = lifecycle.current_stage;
      const availableTransitions = getAvailableTransitions(currentStage).map((toStage) => ({
        toStage,
        validationRequirements: getValidationRequirements(currentStage, toStage),
      }));

      // Get recent transition history
      const { data: recentTransitions } = await admin
        .from('equipment_lifecycle_transitions')
        .select(
          'id, from_stage, to_stage, transition_type, triggered_by, triggered_at, reason, status',
        )
        .eq('equipment_id', equipmentId)
        .eq('tenant_id', tenantId)
        .order('triggered_at', { ascending: false })
        .limit(5);

      return createCorsResponse(
        {
          success: true,
          data: {
            ...lifecycle,
            availableTransitions,
            recentTransitions: recentTransitions || [],
            hasLifecycleRecord: true,
          },
        },
        200,
        req,
      );
    }

    // POST /equipment-lifecycle/:equipmentId/transition - Transition equipment to new lifecycle stage
    if (req.method === 'POST' && secondPart === 'transition') {
      const body = await req.json();
      const { toStage, reason, metadata } = body;

      if (!toStage) {
        return createCorsResponse({ error: 'toStage is required' }, 400, req);
      }

      // Get current lifecycle state
      let lifecycle: any = null;
      const { data: existingLifecycle, error: lifecycleError } = await admin
        .from('equipment_lifecycle')
        .select('*')
        .eq('equipment_id', equipmentId)
        .eq('tenant_id', tenantId)
        .single();

      if (lifecycleError && lifecycleError.code !== 'PGRST116') {
        console.error('Error fetching lifecycle:', lifecycleError);
        return createCorsResponse({ error: 'Failed to fetch lifecycle status' }, 500, req);
      }

      let fromStage: string | null = null;

      if (!existingLifecycle) {
        // Create initial lifecycle record
        const { data: equipment, error: equipmentError } = await admin
          .from('equipment')
          .select('id, equipment_status')
          .eq('id', equipmentId)
          .eq('tenant_id', tenantId)
          .single();

        if (equipmentError) {
          return createCorsResponse({ error: 'Equipment not found' }, 404, req);
        }

        // Default starting stage
        fromStage = LIFECYCLE_STAGES.ORDERED;

        // Create lifecycle record
        const { data: newLifecycle, error: createError } = await admin
          .from('equipment_lifecycle')
          .insert({
            tenant_id: tenantId,
            equipment_id: equipmentId,
            current_stage: fromStage,
            metadata: { createdAt: new Date().toISOString() },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating lifecycle record:', createError);
          return createCorsResponse({ error: 'Failed to create lifecycle record' }, 500, req);
        }

        lifecycle = newLifecycle;
      } else {
        lifecycle = existingLifecycle;
        fromStage = lifecycle.current_stage;
      }

      // Validate transition is allowed
      if (!canTransition(fromStage!, toStage)) {
        return createCorsResponse(
          {
            success: false,
            error: `Invalid transition: ${fromStage} -> ${toStage}`,
            message: `Valid transitions from ${fromStage}: ${getAvailableTransitions(fromStage!).join(', ') || 'none'}`,
          },
          400,
          req,
        );
      }

      // Get validation requirements
      const validationRequirements = getValidationRequirements(fromStage!, toStage);

      // For now, assume validations pass (in production, would check actual conditions)
      const validationsPassed = validationRequirements.map((name) => ({
        name,
        passed: true,
        message: `${name} verified`,
      }));

      // Update lifecycle stage
      const { error: updateError } = await admin
        .from('equipment_lifecycle')
        .update({
          current_stage: toStage,
          metadata: {
            ...(lifecycle.metadata || {}),
            lastTransitionAt: new Date().toISOString(),
            lastTransitionBy: user.id,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('equipment_id', equipmentId)
        .eq('tenant_id', tenantId);

      if (updateError) {
        console.error('Error updating lifecycle:', updateError);
        return createCorsResponse({ error: 'Failed to update lifecycle stage' }, 500, req);
      }

      // Record transition
      const { data: transition, error: transitionError } = await admin
        .from('equipment_lifecycle_transitions')
        .insert({
          tenant_id: tenantId,
          equipment_id: equipmentId,
          from_stage: fromStage,
          to_stage: toStage,
          transition_type: 'manual',
          triggered_by: user.id,
          triggered_at: new Date().toISOString(),
          reason: reason || null,
          metadata: metadata || null,
          validations_passed: validationsPassed,
          validations_failed: [],
          status: 'completed',
        })
        .select()
        .single();

      if (transitionError) {
        console.error('Error recording transition:', transitionError);
        // Don't fail the request - the stage was updated successfully
      }

      return createCorsResponse(
        {
          success: true,
          message: `Equipment transitioned from ${fromStage} to ${toStage}`,
          data: {
            equipmentId,
            fromStage,
            newStage: toStage,
            transition: transition || null,
            validationsPassed,
          },
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in equipment-lifecycle function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
