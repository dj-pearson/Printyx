/**
 * Service-ticket enrichment: the customer, the machine and the technician
 * (WF-V-01).
 *
 * A dispatcher's queue has to say WHAT machine and WHO. The list handler joined
 * neither, so equipmentModel and assignedTechnician were blank on every ticket in
 * production - while dev, served by server/routes-mobile-api.ts, joined all three
 * with Drizzle and looked correct. AUDIT-013 fixed the dev half and nobody
 * connected the two.
 *
 * THE KEYS ARE camelCase ON PURPOSE. ServiceHub.tsx reads `customerName`,
 * `equipmentModel` and `assignedTechnician`, and its normalizer maps ticket
 * columns but NOT these three, because the Express handler already emitted them in
 * that shape. So the edge function emitting `customer_name` meant even the
 * customer name was blank in production - a third field the story did not name.
 * The snake_case `customer_name` and the nested `customer` object are kept
 * alongside, because other callers read them.
 *
 * PostgREST has no join without a foreign key between these tables, so this is
 * three batched `in()` lookups rather than an embed: one per related table, over
 * the distinct ids on the page of tickets. That is 3 round trips for any page
 * size, not N.
 *
 * EVERY LOOKUP IS TENANT-SCOPED. The Drizzle version scopes both sides of each
 * join for exactly this reason: an id that leaked in from another tenant must
 * resolve to null rather than to that tenant's row.
 */

// deno-lint-ignore no-explicit-any
type Db = any;

export interface TicketLike {
  customer_id?: string | null;
  equipment_id?: string | null;
  assigned_technician_id?: string | null;
  [key: string]: unknown;
}

/** The name a person is shown by, or null when neither part is stored. */
export function technicianName(row: {
  first_name?: string | null;
  last_name?: string | null;
}): string | null {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : null;
}

function idsOf(tickets: TicketLike[], key: keyof TicketLike): string[] {
  return [...new Set(tickets.map((t) => t[key]).filter(Boolean))] as string[];
}

/**
 * Add customerName, equipmentModel, equipmentSerial and assignedTechnician to a
 * page of tickets.
 *
 * A failed lookup leaves the field null rather than failing the request: a queue
 * that will not load is worse than a queue with one blank column, and the ticket
 * rows themselves are already correct.
 */
export async function enrichTickets(
  admin: Db,
  tenantId: string,
  tickets: TicketLike[],
): Promise<TicketLike[]> {
  if (!tickets || tickets.length === 0) return tickets ?? [];

  const customerIds = idsOf(tickets, 'customer_id');
  const equipmentIds = idsOf(tickets, 'equipment_id');
  const technicianIds = idsOf(tickets, 'assigned_technician_id');

  const [customers, machines, techs] = await Promise.all([
    customerIds.length
      ? admin
          .from('business_records')
          .select('id, company_name, primary_contact_name')
          .eq('tenant_id', tenantId)
          .in('id', customerIds)
      : Promise.resolve({ data: [] }),
    equipmentIds.length
      ? admin
          .from('equipment')
          .select('id, model_number, serial_number')
          .eq('tenant_id', tenantId)
          .in('id', equipmentIds)
      : Promise.resolve({ data: [] }),
    technicianIds.length
      ? admin
          .from('technicians')
          .select('id, first_name, last_name')
          .eq('tenant_id', tenantId)
          .in('id', technicianIds)
      : Promise.resolve({ data: [] }),
  ]);

  // deno-lint-ignore no-explicit-any
  const byId = (res: any) => new Map((res?.data ?? []).map((r: any) => [String(r.id), r]));
  const customerMap = byId(customers);
  const equipmentMap = byId(machines);
  const technicianMap = byId(techs);

  return tickets.map((t) => {
    // deno-lint-ignore no-explicit-any
    const customer: any = t.customer_id ? customerMap.get(String(t.customer_id)) : null;
    // deno-lint-ignore no-explicit-any
    const machine: any = t.equipment_id ? equipmentMap.get(String(t.equipment_id)) : null;
    // deno-lint-ignore no-explicit-any
    const tech: any = t.assigned_technician_id
      ? technicianMap.get(String(t.assigned_technician_id))
      : null;

    return {
      ...t,
      // What ServiceHub.tsx reads.
      customerName: customer?.company_name ?? null,
      equipmentModel: machine?.model_number ?? null,
      equipmentSerial: machine?.serial_number ?? null,
      assignedTechnician: tech ? technicianName(tech) : null,
      // Kept for the callers that already read these.
      customer_name: customer?.company_name ?? null,
      customer: customer ?? null,
    };
  });
}
