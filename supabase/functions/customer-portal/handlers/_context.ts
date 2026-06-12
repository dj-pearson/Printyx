// Shared context + helpers for the customer-portal edge function handlers.
//
// SCHEMA AUDIT (EDGE-002b, 2026-06-11):
//   - Real Drizzle tables (shared/customer-portal-schema.ts):
//     `customer_maintenance_appointments`, `customer_satisfaction_surveys`,
//     `customer_satisfaction_survey_templates`, `customer_satisfaction_survey_questions`,
//     `customer_satisfaction_survey_responses`, `customer_meter_submissions`,
//     `customer_supply_orders` (+ `_items`), `customer_service_requests`.
//     The migration journal stops early, so any of these may be missing from a
//     live DB — handlers tolerate a missing relation (GET → [], write → 503)
//     via isMissingTableError, same pattern as the billing edge function.
//   - The Express equipment-health endpoint returned three HARDCODED mock
//     machines to every customer (server/services/customer-portal-service.ts
//     getEquipmentHealthData). The port builds health rows from the customer's
//     REAL `equipment` rows instead, with heuristic health scores derived from
//     service-due dates and meter submissions; IoT-grade metrics (toner levels,
//     temperature, jam rate) are zeroed until a real telemetry source exists.
//   - Customer context: customerId comes from JWT app_metadata/user_metadata,
//     with a `?customerId=` query-param fallback for dealer-staff views — the
//     same convention as the existing dashboard/service-requests handlers in
//     this function. Every query still filters tenant_id AND customer_id.

export interface PortalCtx {
  req: Request;
  // Service-role supabase client (bypasses RLS) — every query MUST filter tenant_id.
  // deno-lint-ignore no-explicit-any
  admin: any;
  user: { id: string };
  tenantId: string;
  // Customer ID resolved from JWT metadata or ?customerId= (may be null for staff).
  customerId: string | null;
  url: URL;
  // Path segments after the function-name strip: /satisfaction/surveys/:id → ['satisfaction','surveys',':id']
  parts: string[];
}

// True when a PostgREST/Postgres error means the relation does not exist —
// expected when the live DB predates the customer-portal migrations.
export function isMissingTableError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  const msg = (e.message || '').toLowerCase();
  return msg.includes('could not find the table') || msg.includes('does not exist');
}

// Resolve the acting customer ID: query param (dealer-staff view) → JWT metadata.
export function resolveCustomerId(ctx: Pick<PortalCtx, 'url' | 'customerId'>): string | null {
  return (
    ctx.url.searchParams.get('customerId') ||
    ctx.url.searchParams.get('customer_id') ||
    ctx.customerId
  );
}

export function generateConfirmationCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

// deno-lint-ignore no-explicit-any
export function mapAppointmentRow(row: any): Record<string, unknown> {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    portalUserId: row.portal_user_id,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment_name,
    equipmentMake: row.equipment_make,
    equipmentModel: row.equipment_model,
    equipmentSerial: row.equipment_serial,
    equipmentLocation: row.equipment_location,
    maintenanceType: row.maintenance_type,
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    duration: row.duration,
    timeZone: row.time_zone,
    assignedTechnicianId: row.assigned_technician_id,
    technicianName: row.technician_name,
    status: row.status,
    confirmationCode: row.confirmation_code,
    confirmedAt: row.confirmed_at,
    description: row.description,
    serviceNotes: row.service_notes,
    specialInstructions: row.special_instructions,
    estimatedCost: row.estimated_cost,
    contactMethod: row.contact_method,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    originalDate: row.original_date,
    rescheduleCount: row.reschedule_count,
    rescheduleReason: row.reschedule_reason,
    serviceRequestId: row.service_request_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// deno-lint-ignore no-explicit-any
export function mapSurveyRow(row: any): Record<string, unknown> {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    customerPortalUserId: row.customer_portal_user_id,
    templateId: row.template_id,
    surveyType: row.survey_type,
    status: row.status,
    relatedServiceRequestId: row.related_service_request_id,
    relatedMaintenanceAppointmentId: row.related_maintenance_appointment_id,
    relatedSupplyOrderId: row.related_supply_order_id,
    relatedPaymentId: row.related_payment_id,
    invitationSentAt: row.invitation_sent_at,
    firstViewedAt: row.first_viewed_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
    reminderSentAt: row.reminder_sent_at,
    reminderCount: row.reminder_count,
    overallScore: row.overall_score,
    npsScore: row.nps_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// deno-lint-ignore no-explicit-any
export function mapQuestionRow(row: any): Record<string, unknown> {
  return {
    id: row.id,
    templateId: row.template_id,
    questionText: row.question_text,
    questionType: row.question_type,
    isRequired: row.is_required,
    orderIndex: row.order_index,
    ratingScale: row.rating_scale,
    multipleChoiceOptions: row.multiple_choice_options,
    dependsOnQuestion: row.depends_on_question,
    showCondition: row.show_condition,
    category: row.category,
    weight: row.weight,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// deno-lint-ignore no-explicit-any
export function mapResponseRow(row: any): Record<string, unknown> {
  return {
    id: row.id,
    surveyId: row.survey_id,
    questionId: row.question_id,
    ratingValue: row.rating_value,
    textValue: row.text_value,
    selectedOptions: row.selected_options,
    booleanValue: row.boolean_value,
    timeSpentSeconds: row.time_spent_seconds,
    responseOrder: row.response_order,
    answeredAt: row.answered_at,
  };
}
