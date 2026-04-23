// Installations — CRUD.
import type { HandlerCtx } from '../_context.ts';
import { crud } from '../_crud.ts';

export async function handleInstallations(req: Request, ctx: HandlerCtx) {
  return crud(req, ctx, {
    table: 'installations',
    defaultOrder: { column: 'scheduled_date', ascending: false },
    queryFilters: [
      { param: 'status', column: 'status' },
      { param: 'customerId', column: 'customer_id' },
      { param: 'assignedTechnicianId', column: 'assigned_technician_id' },
    ],
    requiredOnCreate: [
      'installation_number',
      'installation_type',
      'customer_id',
      'installation_address',
    ],
    stamps: { tenantId: true },
    updateStamps: { updatedAt: true },
    mapRow: (b) =>
      pick(b, [
        ['installation_number', 'installationNumber'],
        ['installation_type', 'installationType'],
        ['customer_id', 'customerId'],
        ['equipment_id', 'equipmentId'],
        ['service_ticket_id', 'serviceTicketId'],
        ['quote_id', 'quoteId'],
        ['scheduled_date', 'scheduledDate'],
        ['completed_date', 'completedDate'],
        ['estimated_duration', 'estimatedDuration'],
        ['assigned_technician_id', 'assignedTechnicianId'],
        ['assisting_technician_ids', 'assistingTechnicianIds'],
        ['installation_address', 'installationAddress'],
        ['gps_latitude', 'gpsLatitude'],
        ['gps_longitude', 'gpsLongitude'],
        ['status'],
        ['serial_number', 'serialNumber'],
        ['model_number', 'modelNumber'],
        ['network_configured', 'networkConfigured'],
        ['drivers_installed', 'driversInstalled'],
      ]),
  });
}

// Small helper: pick fields from body supporting camel+snake.
function pick(
  body: Record<string, unknown>,
  spec: Array<[string] | [string, string]>,
): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const entry of spec) {
    const snake = entry[0];
    const camel = entry[1];
    const v = camel ? (body[camel] ?? body[snake]) : body[snake];
    if (v !== undefined) r[snake] = v;
  }
  return r;
}
