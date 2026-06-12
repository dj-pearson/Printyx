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

  const generatedInvoices: any[] = [];
  const failedReadings: string[] = [];
  let grandTotal = 0;

  // Process each reading
  for (const reading of pendingReadings) {
    try {
      if (!reading.contract_id) continue;

      const contract = contractMap.get(String(reading.contract_id));
      if (!contract) continue;

      const tieredRates = tieredRatesMap.get(String(reading.contract_id)) || [];

      // Calculate billing amounts
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

      // Create invoice
      const invoiceData = {
        tenant_id: tenantId,
        customer_id: String(contract.customer_id),
        contract_id: contract.id,
        invoice_number: `INV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        invoice_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        total_amount: String(totalAmount),
        amount_paid: '0',
        balance_due: String(totalAmount),
        invoice_status: 'open',
        payment_terms: 'Net 30',
        invoice_notes: `Meter billing for ${new Date(reading.reading_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: invoice, error: invoiceError } = await admin
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        failedReadings.push(reading.id);
        continue;
      }

      // Update meter reading billing status
      await admin
        .from('meter_readings')
        .update({
          billing_status: 'processed',
          billing_amount: totalAmount.toString(),
          invoice_id: invoice.id,
        })
        .eq('id', reading.id)
        .eq('tenant_id', tenantId);

      generatedInvoices.push(invoice);
      grandTotal += totalAmount;
    } catch (readingError) {
      console.error(`Error processing reading ${reading.id}:`, readingError);
      failedReadings.push(reading.id);
    }
  }

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
