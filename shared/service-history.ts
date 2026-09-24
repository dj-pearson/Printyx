/**
 * One machine's service history, in the one shape both readers of it expect
 * (PROD-008).
 *
 * `supabase/functions/equipment/` already embedded a service history on
 * `GET /equipment/:id`, selecting `id, ticket_number, status, created_at,
 * resolved_at`. The React Native equipment screen asks for it at
 * `/equipment/:id/service-history` and reads `date`, `type` and `description` -
 * none of which that select emits, and the sub-resource had no branch at all,
 * so the screen got a 404 and rendered "No service history" about machines with
 * tickets against them.
 *
 * Two shapes for one concept inside one file is how they drift, so this mapper
 * serves both: the embedded list and the sub-resource are the same rows through
 * the same function.
 *
 * WHICH DATE. A service history entry is dated by when the work HAPPENED, so a
 * resolved ticket is dated by its resolution and an open one by when it was
 * raised, with `isOpen` saying which - a still-open ticket dated by a
 * resolution it does not have would sort as the oldest thing on the machine.
 *
 * WHAT `type` MEANS. `service_tickets` has no service-type column. The field the
 * screen calls `type` is the ticket's PRIORITY, which is the only categorical
 * the table carries, and a ticket with none is left null rather than labelled -
 * the screen already falls back to the word "Service".
 */

/** Dates arrive as text from PostgREST and as Date objects from Drizzle. */
export interface ServiceTicketHistoryRow {
  id?: string | null;
  ticket_number?: string | null;
  ticketNumber?: string | null;
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  status?: string | null;
  resolution_notes?: string | null;
  resolutionNotes?: string | null;
  created_at?: string | Date | null;
  createdAt?: string | Date | null;
  resolved_at?: string | Date | null;
  resolvedAt?: string | Date | null;
}

export interface ServiceHistoryEntry {
  id: string;
  ticketNumber: string | null;
  /** When the work happened: the resolution, or the raising if still open. */
  date: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
  isOpen: boolean;
  status: string | null;
  /** The ticket's priority - see the note above on what this field is. */
  type: string | null;
  title: string | null;
  description: string | null;
  resolutionNotes: string | null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s === '' ? null : s;
}

/**
 * Map stored tickets into history entries, newest work first.
 *
 * Accepts snake_case (PostgREST) or camelCase (Drizzle) keys, because the two
 * hosts hand back different spellings of the same row and a presenter that
 * knows one of them is a presenter that works on one host.
 */
export function toServiceHistory(rows: readonly ServiceTicketHistoryRow[]): ServiceHistoryEntry[] {
  const entries = rows
    .filter((r): r is ServiceTicketHistoryRow & { id: string } => Boolean(r.id))
    .map((r) => {
      const createdAt = str(r.created_at ?? r.createdAt);
      const resolvedAt = str(r.resolved_at ?? r.resolvedAt);
      return {
        id: String(r.id),
        ticketNumber: str(r.ticket_number ?? r.ticketNumber),
        date: resolvedAt ?? createdAt,
        createdAt,
        resolvedAt,
        isOpen: resolvedAt === null,
        status: str(r.status),
        type: str(r.priority),
        title: str(r.title),
        description: str(r.description),
        resolutionNotes: str(r.resolution_notes ?? r.resolutionNotes),
      };
    });

  // An entry with no date at all sorts LAST rather than first: an empty string
  // compares below every timestamp, which would put a row nobody dated at the
  // top of a history read as chronological.
  return entries.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.id.localeCompare(b.id);
  });
}
