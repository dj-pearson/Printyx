/**
 * Equipment Lifecycle Hub: the reads and writes the page has always made
 * (WF-L-02).
 *
 * EquipmentLifecycleHub.tsx has called /metrics, /purchase-orders, /deliveries,
 * /installations and /assets since it was written, and NEITHER HOST served any of
 * them - not this function and not
 * server/routes-equipment-lifecycle-state-machine.ts. Every list on the page was
 * an empty array behind a query that 404'd, and the three create dialogs posted
 * into nothing.
 *
 * Everything here reads REAL tables: equipment_lifecycle, purchase_orders,
 * delivery_schedules, installation_schedules, equipment and meter_readings. The
 * page's own types named fields that exist on none of them (po_number's
 * line_items_count, driver_name, current_bw_count as a column) and those are
 * derived or dropped rather than invented - see each function.
 *
 * NULL IS NOT ZERO. averageInstallationTime and customerSatisfactionRating are
 * null when nothing has completed or nobody has rated, because a 0-hour install
 * time and a 0-star rating are both claims, and neither is one this data
 * supports.
 *
 * PostgREST has no GROUP BY and no aggregate, so counts come back as
 * head:true/count:'exact' probes and averages are computed here over the rows.
 */

// deno-lint-ignore no-explicit-any
type Db = any;

async function countOf(db: Db, table: string, tenantId: string, apply?: (q: Db) => Db) {
  let q = db.from(table).select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId);
  if (apply) q = apply(q);
  const { count } = await q;
  return count || 0;
}

/** A map from id to row, for the batched lookups the joins below need. */
function indexById(rows: unknown): Map<string, Record<string, unknown>> {
  const list = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  return new Map(list.map((r) => [String(r.id), r]));
}

async function lookup(
  db: Db,
  table: string,
  tenantId: string,
  columns: string,
  ids: Array<string | null | undefined>,
): Promise<Map<string, Record<string, unknown>>> {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (unique.length === 0) return new Map();
  const { data } = await db.from(table).select(columns).eq('tenant_id', tenantId).in('id', unique);
  return indexById(data);
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function hubMetrics(db: Db, tenantId: string) {
  const [inProcess, pendingDeliveries, scheduledInstallations, activeAssets] = await Promise.all([
    // "In process" is everything not yet at rest: an active machine at a customer
    // and a retired one are both finished states.
    countOf(db, 'equipment_lifecycle', tenantId, (q) =>
      q.in('current_stage', [
        'ordered',
        'received',
        'staged',
        'in_transit',
        'delivered',
        'installed',
      ]),
    ),
    countOf(db, 'delivery_schedules', tenantId, (q) =>
      q.in('status', ['scheduled', 'dispatched', 'in_transit']),
    ),
    countOf(db, 'installation_schedules', tenantId, (q) => q.eq('status', 'scheduled')),
    countOf(db, 'equipment_lifecycle', tenantId, (q) => q.eq('current_stage', 'active')),
  ]);

  // Averages over completed installs only. A scheduled install has no duration
  // and an unrated one has no rating; counting either as zero would drag both
  // numbers toward a figure nobody measured.
  const { data: completed } = await db
    .from('installation_schedules')
    .select('actual_start_time, actual_end_time, customer_satisfaction_rating')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed');

  const durations: number[] = [];
  const ratings: number[] = [];
  for (const row of completed ?? []) {
    if (row.actual_start_time && row.actual_end_time) {
      const hours =
        (new Date(row.actual_end_time).getTime() - new Date(row.actual_start_time).getTime()) /
        3_600_000;
      if (Number.isFinite(hours) && hours > 0) durations.push(hours);
    }
    if (row.customer_satisfaction_rating != null) {
      ratings.push(Number(row.customer_satisfaction_rating));
    }
  }

  return {
    totalEquipmentInProcess: inProcess,
    pendingDeliveries,
    scheduledInstallations,
    activeAssets,
    averageInstallationTime: avg(durations),
    customerSatisfactionRating: avg(ratings),
    // Named rather than silently absent, so a null card is read as "not measured"
    // instead of "zero".
    unbacked:
      durations.length === 0 || ratings.length === 0
        ? [
            ...(durations.length === 0
              ? ['averageInstallationTime: no installation has recorded a start and end time']
              : []),
            ...(ratings.length === 0
              ? ['customerSatisfactionRating: no completed installation has been rated']
              : []),
          ]
        : [],
  };
}

/**
 * The lifecycle rows the page's board renders.
 *
 * Served at /lifecycle, NOT /stages: /stages is the stage VOCABULARY (which
 * stages exist and what may follow them) and the page was calling it expecting
 * rows, so its board mapped `{key, value, name}` objects into equipment records.
 */
export async function hubLifecycle(
  db: Db,
  tenantId: string,
  filters: { stage?: string | null; status?: string | null },
) {
  let q = db
    .from('equipment_lifecycle')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (filters.stage && filters.stage !== 'all') q = q.eq('current_stage', filters.stage);
  const { data: rows } = await q;
  const list = Array.isArray(rows) ? rows : [];

  const customers = await lookup(
    db,
    'business_records',
    tenantId,
    'id, company_name',
    list.map((r: Record<string, unknown>) => r.customer_id as string),
  );

  return list.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    equipmentId: r.equipment_id ?? null,
    serialNumber: r.serial_number ?? null,
    manufacturer: r.manufacturer ?? null,
    model: r.model ?? null,
    currentStage: r.current_stage ?? null,
    currentLocation: r.current_location ?? null,
    customerId: r.customer_id ?? null,
    customerName: customers.get(String(r.customer_id))?.company_name ?? null,
    purchaseOrderId: r.purchase_order_id ?? null,
    lastServiceDate: r.last_service_date ?? null,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  }));
}

export async function hubPurchaseOrders(db: Db, tenantId: string) {
  const { data: rows } = await db
    .from('purchase_orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  const list = Array.isArray(rows) ? rows : [];

  const vendors = await lookup(
    db,
    'vendors',
    tenantId,
    'id, vendor_name',
    list.map((r: Record<string, unknown>) => r.vendor_id as string),
  );

  // lineItemsCount is DERIVED. The page's type declared it as if the table
  // carried it; PostgREST has no COUNT per group, so the lines are fetched once
  // for the page of orders and tallied here.
  const orderIds = list.map((r: Record<string, unknown>) => String(r.id));
  const counts = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: lines } = await db
      .from('purchase_order_items')
      .select('purchase_order_id')
      .eq('tenant_id', tenantId)
      .in('purchase_order_id', orderIds);
    for (const line of lines ?? []) {
      const key = String(line.purchase_order_id);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return list.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    poNumber: r.po_number ?? null,
    vendorId: r.vendor_id ?? null,
    vendorName: vendors.get(String(r.vendor_id))?.vendor_name ?? null,
    orderDate: r.order_date ?? null,
    expectedDate: r.expected_date ?? null,
    totalAmount: r.total_amount ?? null,
    status: r.status ?? null,
    sourceContractId: r.source_contract_id ?? null,
    lineItemsCount: counts.get(String(r.id)) ?? 0,
    createdAt: r.created_at ?? null,
  }));
}

export async function hubDeliveries(db: Db, tenantId: string) {
  const { data: rows } = await db
    .from('delivery_schedules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('scheduled_date', { ascending: true })
    .limit(200);
  const list = Array.isArray(rows) ? rows : [];

  const [customers, machines] = await Promise.all([
    lookup(
      db,
      'business_records',
      tenantId,
      'id, company_name',
      list.map((r: Record<string, unknown>) => r.customer_id as string),
    ),
    lookup(
      db,
      'equipment',
      tenantId,
      'id, model_number, serial_number',
      list.map((r: Record<string, unknown>) => r.equipment_id as string),
    ),
  ]);

  return list.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    equipmentId: r.equipment_id ?? null,
    equipmentModel: machines.get(String(r.equipment_id))?.model_number ?? null,
    customerId: r.customer_id ?? null,
    customerName: customers.get(String(r.customer_id))?.company_name ?? null,
    scheduledDate: r.scheduled_date ?? null,
    // The table stores ONE free-text window, not a start/end pair. The page's
    // time_window_start / time_window_end were invented, and splitting a string
    // like "morning" into two timestamps is not something this data supports.
    timeWindow: r.time_window ?? null,
    deliveryType: r.delivery_type ?? null,
    contactPerson: r.contact_person ?? null,
    contactPhone: r.contact_phone ?? null,
    status: r.status ?? null,
    // driverId, not driver_name: delivery_schedules stores an id and there is no
    // drivers table to resolve it against, so the id is returned as it is.
    driverId: r.driver_id ?? null,
    actualDeliveryTime: r.actual_delivery_time ?? null,
    createdAt: r.created_at ?? null,
  }));
}

export async function hubInstallations(db: Db, tenantId: string) {
  const { data: rows } = await db
    .from('installation_schedules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('scheduled_date', { ascending: true })
    .limit(200);
  const list = Array.isArray(rows) ? rows : [];

  const [customers, machines, techs] = await Promise.all([
    lookup(
      db,
      'business_records',
      tenantId,
      'id, company_name',
      list.map((r: Record<string, unknown>) => r.customer_id as string),
    ),
    lookup(
      db,
      'equipment',
      tenantId,
      'id, model_number, manufacturer',
      list.map((r: Record<string, unknown>) => r.equipment_id as string),
    ),
    lookup(
      db,
      'technicians',
      tenantId,
      'id, first_name, last_name',
      list.map((r: Record<string, unknown>) => r.technician_id as string),
    ),
  ]);

  return list.map((r: Record<string, unknown>) => {
    const tech = techs.get(String(r.technician_id));
    const name = tech
      ? [tech.first_name, tech.last_name].filter(Boolean).join(' ').trim() || null
      : null;
    const machine = machines.get(String(r.equipment_id));
    return {
      id: String(r.id),
      equipmentId: r.equipment_id ?? null,
      equipmentModel: machine?.model_number ?? null,
      equipmentBrand: machine?.manufacturer ?? null,
      customerId: r.customer_id ?? null,
      customerName: customers.get(String(r.customer_id))?.company_name ?? null,
      technicianId: r.technician_id ?? null,
      leadTechnicianName: name,
      scheduledDate: r.scheduled_date ?? null,
      // The column is MINUTES; the page's type called it hours. Returned as
      // stored and named for what it is.
      estimatedDurationMinutes: r.estimated_duration ?? null,
      installationType: r.installation_type ?? null,
      status: r.status ?? null,
      customerSatisfactionRating: r.customer_satisfaction_rating ?? null,
      createdAt: r.created_at ?? null,
    };
  });
}

export async function hubAssets(db: Db, tenantId: string) {
  const { data: rows } = await db
    .from('equipment')
    .select(
      'id, asset_tag, serial_number, model_number, manufacturer, customer_id, equipment_status, location_description, install_date, created_at',
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  const list = Array.isArray(rows) ? rows : [];

  const customers = await lookup(
    db,
    'business_records',
    tenantId,
    'id, company_name',
    list.map((r: Record<string, unknown>) => r.customer_id as string),
  );

  // The latest meter reading per machine. Fetched newest-first for the whole page
  // of equipment and reduced here, because PostgREST cannot express DISTINCT ON.
  const equipmentIds = list.map((r: Record<string, unknown>) => String(r.id));
  const latest = new Map<string, Record<string, unknown>>();
  if (equipmentIds.length > 0) {
    const { data: readings } = await db
      .from('meter_readings')
      .select('equipment_id, reading_date, bw_meter_reading, color_meter_reading')
      .eq('tenant_id', tenantId)
      .in('equipment_id', equipmentIds)
      .order('reading_date', { ascending: false })
      .limit(2000);
    for (const reading of readings ?? []) {
      const key = String(reading.equipment_id);
      if (!latest.has(key)) latest.set(key, reading);
    }
  }

  return list.map((r: Record<string, unknown>) => {
    const reading = latest.get(String(r.id));
    return {
      id: String(r.id),
      assetTag: r.asset_tag ?? null,
      serialNumber: r.serial_number ?? null,
      model: r.model_number ?? null,
      manufacturer: r.manufacturer ?? null,
      customerId: r.customer_id ?? null,
      customerName: customers.get(String(r.customer_id))?.company_name ?? null,
      status: r.equipment_status ?? null,
      locationDescription: r.location_description ?? null,
      installDate: r.install_date ?? null,
      // Null, not 0, when a machine has never been read: a zero page count is a
      // measurement and an unread machine has not produced one.
      latestReadingDate: reading?.reading_date ?? null,
      bwMeterReading: reading?.bw_meter_reading ?? null,
      colorMeterReading: reading?.color_meter_reading ?? null,
      createdAt: r.created_at ?? null,
    };
  });
}

/** A delivery_schedules row from the hub's dialog. */
export function buildDeliveryRow(
  body: Record<string, unknown>,
  tenantId: string,
): Record<string, unknown> | { error: string } {
  const equipmentId = body.equipment_id ?? body.equipmentId;
  const customerId = body.customer_id ?? body.customerId;
  if (!equipmentId) return { error: 'equipment_id is required' };
  if (!customerId) return { error: 'customer_id is required' };
  if (!body.scheduled_date && !body.scheduledDate) return { error: 'scheduled_date is required' };

  // delivery_address is jsonb NOT NULL. The dialog collects one free-text line,
  // so it is stored as { line1 } rather than parsed into fields the form never
  // asked for.
  const address = body.delivery_address ?? body.deliveryAddress;
  if (!address) return { error: 'delivery_address is required' };

  return {
    tenant_id: tenantId,
    equipment_id: equipmentId,
    customer_id: customerId,
    scheduled_date: body.scheduled_date ?? body.scheduledDate,
    // ONE window, because the column is one column. The dialog's start and end
    // are joined rather than one of them being dropped in silence.
    time_window:
      body.time_window ??
      body.timeWindow ??
      [body.time_window_start, body.time_window_end].filter(Boolean).join('-') ??
      null,
    delivery_type: body.delivery_type ?? body.deliveryType ?? 'standard',
    delivery_address: typeof address === 'string' ? { line1: address } : address,
    contact_person: body.contact_person ?? body.contactPerson ?? null,
    contact_phone: body.contact_phone ?? body.contactPhone ?? null,
    special_instructions: body.delivery_instructions ?? body.special_instructions ?? null,
    status: 'scheduled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** An installation_schedules row from the hub's dialog. */
export function buildInstallationRow(
  body: Record<string, unknown>,
  tenantId: string,
): Record<string, unknown> | { error: string } {
  const equipmentId = body.equipment_id ?? body.equipmentId;
  const customerId = body.customer_id ?? body.customerId;
  const technicianId = body.lead_technician_id ?? body.technician_id ?? body.technicianId;
  if (!equipmentId) return { error: 'equipment_id is required' };
  if (!customerId) return { error: 'customer_id is required' };
  // technician_id is NOT NULL, so an unassigned install cannot be stored. Saying
  // so beats a 23502 the caller reads as "something went wrong".
  if (!technicianId) return { error: 'lead_technician_id is required' };
  if (!body.scheduled_date && !body.scheduledDate) return { error: 'scheduled_date is required' };

  return {
    tenant_id: tenantId,
    equipment_id: equipmentId,
    customer_id: customerId,
    technician_id: technicianId,
    scheduled_date: body.scheduled_date ?? body.scheduledDate,
    installation_type: body.installation_type ?? body.installationType ?? 'standard',
    // The dialog's power / network / environmental notes have no columns of their
    // own; site_requirements is jsonb and is what they are for.
    site_requirements: {
      location: body.installation_location ?? null,
      contactPerson: body.site_contact_person ?? null,
      contactPhone: body.site_contact_phone ?? null,
      power: body.power_requirements ?? null,
      network: body.network_requirements ?? null,
      environmental: body.environmental_conditions ?? null,
    },
    status: 'scheduled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
