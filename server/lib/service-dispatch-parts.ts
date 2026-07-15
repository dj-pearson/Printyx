/**
 * Pure helpers for batch parts-availability checks in service dispatch.
 *
 * These exist so the N+1-free batching logic (CR-025) is unit-testable without
 * a live database: the route collects the distinct part numbers, runs ONE
 * `WHERE part_number IN (...) AND tenant_id = ...` query, then feeds the rows
 * through `buildAvailablePartSet` + `computeTicketPartsResults`.
 */

export interface DispatchTicketLike {
  id: string;
  ticketNumber: string | null;
  title: string | null;
  requiredParts: string[] | null;
}

export interface InventoryAvailabilityRow {
  partNumber: string | null;
  quantityAvailable: number | string | null;
}

export interface TicketPartsResult {
  ticketId: string;
  ticketNumber: string | null;
  title: string | null;
  partsAvailable: boolean;
  missingPartsCount: number;
  totalPartsRequired?: number;
  message: string;
}

/**
 * Distinct, non-empty part numbers required across every ticket. Used to build
 * the single batched inventory query.
 */
export function collectRequiredPartNumbers(tickets: DispatchTicketLike[]): string[] {
  const set = new Set<string>();
  for (const ticket of tickets) {
    for (const part of ticket.requiredParts ?? []) {
      if (part) set.add(part);
    }
  }
  return Array.from(set);
}

/**
 * Set of part numbers that are in stock (any inventory row with
 * quantityAvailable > 0). Mirrors the original per-part `> 0` check.
 */
export function buildAvailablePartSet(rows: InventoryAvailabilityRow[]): Set<string> {
  const available = new Set<string>();
  for (const row of rows) {
    if (!row.partNumber) continue;
    const qty =
      typeof row.quantityAvailable === 'string'
        ? Number(row.quantityAvailable)
        : (row.quantityAvailable ?? 0);
    if ((qty || 0) > 0) available.add(row.partNumber);
  }
  return available;
}

/**
 * Per-ticket availability result derived from the in-stock part set. Produces
 * output identical to the old ticket×part nested-loop implementation.
 */
export function computeTicketPartsResults(
  tickets: DispatchTicketLike[],
  availableParts: Set<string>,
): TicketPartsResult[] {
  return tickets.map((ticket) => {
    if (!ticket.requiredParts || ticket.requiredParts.length === 0) {
      return {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        partsAvailable: true,
        missingPartsCount: 0,
        message: 'No parts required',
      };
    }

    const missingCount = ticket.requiredParts.filter((part) => !availableParts.has(part)).length;
    const allAvailable = missingCount === 0;

    return {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      partsAvailable: allAvailable,
      missingPartsCount: missingCount,
      totalPartsRequired: ticket.requiredParts.length,
      message: allAvailable ? 'All parts available' : `${missingCount} part(s) missing`,
    };
  });
}
