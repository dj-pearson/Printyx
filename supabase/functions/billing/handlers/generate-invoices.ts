// Meter-reading → invoice generation core.
//
// Extracted from billing/index.ts (POST /billing/generate-invoices) so the
// billing-cycle runner (POST /billing/cycles/run, EDGE-002a) can run the same
// real pipeline instead of the demo-data inserts the legacy Express handler
// used (server/routes-billing-core.ts hard-coded a sample business_record_id —
// intentionally NOT ported).

// deno-lint-ignore-file no-explicit-any

export interface GenerateInvoicesResult {
  message: string;
  invoices: any[];
  failedReadingIds: string[];
  totalAmount: number;
}

/** One reading's computed invoice row, before it is written. */
export interface PreparedInvoice {
  readingId: string;
  invoice: Record<string, any>;
  totalAmount: number;
}

/**
 * AUDIT-008: the pure half of the pipeline — turn readings + contracts + tiered
 * rates into invoice rows. No I/O, so the billing MATH can be tested directly and
 * proven unchanged by the batching (the AC asks exactly this).
 *
 * `now` and `invoiceNumber` are injectable purely so tests are deterministic.
 *
 * Readings with no contract_id, or whose contract is missing, are skipped silently
 * — matching the original loop, which `continue`d without marking them failed.
 */
export function prepareInvoiceRows(
  pendingReadings: any[],
  contractMap: Map<string, any>,
  tieredRatesMap: Map<string, any[]>,
  tenantId: string,
  userId: string,
  opts?: { now?: () => number; invoiceNumber?: (index: number) => string },
): PreparedInvoice[] {
  const now = opts?.now ?? Date.now;
  const nowMs = now();
  const defaultNumber = (index: number) =>
    // AUDIT-008: the index is part of the number ON PURPOSE. The original built
    // `INV-${Date.now()}-${random}` per row; a bulk INSERT writes the whole batch in
    // the same millisecond, so Date.now() is IDENTICAL for every row and uniqueness
    // rested entirely on a 5-char random suffix. invoice_number is UNIQUE, and under
    // a bulk insert ONE collision would fail the ENTIRE batch instead of a single
    // row. The index makes intra-batch uniqueness structural.
    `INV-${nowMs}-${index}-${Math.random().toString(36).substring(2, 7)}`;
  const invoiceNumber = opts?.invoiceNumber ?? defaultNumber;

  const prepared: PreparedInvoice[] = [];
  const issuedAt = new Date(nowMs).toISOString();
  const dueAt = new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString();

  for (const reading of pendingReadings) {
    if (!reading.contract_id) continue;
    const contract = contractMap.get(String(reading.contract_id));
    if (!contract) continue;

    const tieredRates = tieredRatesMap.get(String(reading.contract_id)) || [];

    let blackAmount = 0;
    let colorAmount = 0;

    if (reading.black_copies && Number(reading.black_copies) > 0) {
      const blackRates = tieredRates
        .filter((rate) => rate.color_type === 'black')
        .sort((a, b) => a.minimum_volume - b.minimum_volume);
      blackAmount = calculateTieredAmount(
        Number(reading.black_copies),
        blackRates,
        parseFloat(contract.black_rate?.toString() || '0'),
      );
    }

    if (reading.color_copies && Number(reading.color_copies) > 0) {
      const colorRates = tieredRates
        .filter((rate) => rate.color_type === 'color')
        .sort((a, b) => a.minimum_volume - b.minimum_volume);
      colorAmount = calculateTieredAmount(
        Number(reading.color_copies),
        colorRates,
        parseFloat(contract.color_rate?.toString() || '0'),
      );
    }

    const totalAmount =
      blackAmount + colorAmount + parseFloat(contract.monthly_base?.toString() || '0');

    prepared.push({
      readingId: reading.id,
      totalAmount,
      invoice: {
        tenant_id: tenantId,
        customer_id: String(contract.customer_id),
        contract_id: contract.id,
        invoice_number: invoiceNumber(prepared.length),
        invoice_date: issuedAt,
        due_date: dueAt,
        total_amount: String(totalAmount),
        amount_paid: '0',
        balance_due: String(totalAmount),
        invoice_status: 'open',
        payment_terms: 'Net 30',
        invoice_notes: `Meter billing for ${new Date(reading.reading_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        created_by: userId,
        created_at: issuedAt,
        updated_at: issuedAt,
      },
    });
  }

  return prepared;
}

/** Run `task` over `items` with bounded concurrency (not one-at-a-time, not all-at-once). */
async function inChunks<T>(
  items: T[],
  size: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(task));
  }
}

export async function generateInvoicesFromPendingReadings(
  admin: any,
  tenantId: string,
  userId: string,
): Promise<GenerateInvoicesResult> {
  // Get all pending meter readings
  const { data: pendingReadings, error: readingsError } = await admin
    .from('meter_readings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('billing_status', 'pending');

  if (readingsError) {
    throw new Error(`Failed to fetch meter readings: ${readingsError.message}`);
  }

  if (!pendingReadings || pendingReadings.length === 0) {
    return {
      message: 'No pending meter readings to process',
      invoices: [],
      failedReadingIds: [],
      totalAmount: 0,
    };
  }

  // Extract unique contract IDs
  const contractIds = [
    ...new Set(
      pendingReadings.filter((r: any) => r.contract_id).map((r: any) => String(r.contract_id)),
    ),
  ];

  if (contractIds.length === 0) {
    return {
      message: 'No meter readings with valid contracts',
      invoices: [],
      failedReadingIds: [],
      totalAmount: 0,
    };
  }

  // Batch fetch all contracts
  const { data: allContracts, error: contractsError } = await admin
    .from('contracts')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('id', contractIds);

  if (contractsError) {
    throw new Error(`Failed to fetch contracts: ${contractsError.message}`);
  }

  // Batch fetch tiered rates
  const { data: allTieredRates, error: ratesError } = await admin
    .from('contract_tiered_rates')
    .select('*')
    .in('contract_id', contractIds)
    .order('sort_order', { ascending: true });

  if (ratesError) {
    console.error('Error fetching tiered rates:', ratesError);
  }

  // Create lookup maps
  const contractMap = new Map<string, any>((allContracts || []).map((c: any) => [String(c.id), c]));
  const tieredRatesMap = new Map<string, any[]>();
  for (const rate of allTieredRates || []) {
    const rates = tieredRatesMap.get(rate.contract_id) || [];
    rates.push(rate);
    tieredRatesMap.set(rate.contract_id, rates);
  }

  // AUDIT-008: reads above are already batched; the WRITES were the N+1. The old
  // loop did an insert(...).single() PLUS a meter_readings update per reading —
  // 2N serialized round-trips, so a few hundred readings took minutes.
  const prepared = prepareInvoiceRows(
    pendingReadings,
    contractMap,
    tieredRatesMap,
    tenantId,
    userId,
  );

  if (prepared.length === 0) {
    return {
      message: 'Generated 0 invoices',
      invoices: [],
      failedReadingIds: [],
      totalAmount: 0,
    };
  }

  const generatedInvoices: any[] = [];
  const failedReadings: string[] = [];
  let grandTotal = 0;

  // ONE insert for the whole batch instead of N.
  const { data: insertedRows, error: bulkError } = await admin
    .from('invoices')
    .insert(prepared.map((p) => p.invoice))
    .select();

  let inserted: any[] = insertedRows ?? [];

  if (bulkError) {
    // A bulk insert is all-or-nothing, so one bad row would fail the entire run —
    // strictly worse than the old per-row behaviour, which failed only that reading.
    // Fall back to per-row inserts to preserve that per-reading fault isolation.
    // This is the slow path and should be rare.
    console.error('Bulk invoice insert failed, falling back to per-row:', bulkError);
    inserted = [];
    for (const p of prepared) {
      const { data: one, error: oneError } = await admin
        .from('invoices')
        .insert(p.invoice)
        .select()
        .single();
      if (oneError || !one) {
        console.error('Error creating invoice:', oneError);
        failedReadings.push(p.readingId);
        continue;
      }
      inserted.push(one);
    }
  }

  // Map each inserted invoice back to its reading by invoice_number rather than by
  // array position: the numbers are unique within the batch by construction, so this
  // does not depend on the driver preserving input order.
  const byNumber = new Map<string, any>(
    inserted.map((inv: any) => [String(inv.invoice_number), inv]),
  );

  const readingUpdates: Array<{ readingId: string; invoiceId: string; amount: number }> = [];
  for (const p of prepared) {
    const invoice = byNumber.get(String(p.invoice.invoice_number));
    if (!invoice) {
      if (!failedReadings.includes(p.readingId)) failedReadings.push(p.readingId);
      continue;
    }
    generatedInvoices.push(invoice);
    grandTotal += p.totalAmount;
    readingUpdates.push({ readingId: p.readingId, invoiceId: invoice.id, amount: p.totalAmount });
  }

  // Each reading needs a DIFFERENT invoice_id/billing_amount, so this cannot collapse
  // into a single UPDATE. An upsert of the full rows WOULD be one statement, but it
  // would rewrite every column from the values read earlier and clobber any concurrent
  // change — not worth it here. Instead the updates run with bounded concurrency
  // rather than strictly one-at-a-time: N round-trips become ceil(N/25) waves.
  await inChunks(readingUpdates, 25, async (u) => {
    const { error } = await admin
      .from('meter_readings')
      .update({
        billing_status: 'processed',
        billing_amount: u.amount.toString(),
        invoice_id: u.invoiceId,
      })
      .eq('id', u.readingId)
      .eq('tenant_id', tenantId);
    if (error) console.error(`Failed to mark reading ${u.readingId} processed:`, error);
  });

  return {
    message: `Generated ${generatedInvoices.length} invoices`,
    invoices: generatedInvoices,
    failedReadingIds: failedReadings,
    totalAmount: grandTotal,
  };
}

// Helper function to calculate tiered billing amounts
export function calculateTieredAmount(
  volume: number,
  tieredRates: Array<{ minimum_volume: number; rate_per_unit: number }>,
  defaultRate: number,
): number {
  if (!tieredRates || tieredRates.length === 0) {
    return volume * defaultRate;
  }

  let totalAmount = 0;
  let remainingVolume = volume;

  for (let i = 0; i < tieredRates.length; i++) {
    const currentTier = tieredRates[i];
    const nextTier = tieredRates[i + 1];

    const tierStart = currentTier.minimum_volume;
    const tierEnd = nextTier ? nextTier.minimum_volume : Infinity;
    const tierRate = parseFloat(currentTier.rate_per_unit?.toString() || '0') || defaultRate;

    if (remainingVolume <= 0) break;

    const tierVolume = Math.min(remainingVolume, tierEnd - tierStart);
    if (tierVolume > 0) {
      totalAmount += tierVolume * tierRate;
      remainingVolume -= tierVolume;
    }
  }

  return totalAmount;
}
