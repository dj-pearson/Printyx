/**
 * Bulk invoice generation for /api/automated-billing/bulk-generate (round 239).
 * The route used to call billingEngine.generateBulkInvoices, which the engine
 * has never had, so every request was a TypeError answered as a generic 500.
 */

export const BULK_GENERATE_MAX = 100;

export interface BulkGenerateResult {
  requested: number;
  generated: Array<{ contractId: string; invoiceId: string }>;
  failed: Array<{ contractId: string; error: string }>;
}

/**
 * One invoice per contract, SEQUENTIALLY: each generation reads and numbers
 * invoices for the tenant, so running them concurrently races the invoice
 * number. A contract that fails is NAMED with its reason and the run carries
 * on - "17 of 20" is not actionable and "which three" is (round 132's rule).
 * A duplicate id is generated once.
 */
export async function generateBulkInvoices(
  contractIds: readonly string[],
  generate: (contractId: string) => Promise<{ id: string }>,
): Promise<BulkGenerateResult> {
  const unique = [...new Set(contractIds)];
  const result: BulkGenerateResult = { requested: unique.length, generated: [], failed: [] };
  for (const contractId of unique) {
    try {
      const invoice = await generate(contractId);
      result.generated.push({ contractId, invoiceId: invoice.id });
    } catch (err) {
      result.failed.push({
        contractId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return result;
}
