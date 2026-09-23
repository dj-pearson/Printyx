/**
 * How the service reports bucket a ticket (round 206).
 *
 * Five readers in this tree compared `status` to the hyphenated 'in-progress',
 * which WF-V-05 retired and migration 0078 forbids, so a ticket being worked
 * was never counted as in progress and a technician's load read low. Every
 * bucket is derived from the one vocabulary; aliases a legacy row may still
 * carry ('in-progress', 'closed') are normalised first.
 *
 *  - inProgress: someone is on the way or working it (en_route, on_site,
 *    in_progress).
 *  - open: outstanding but nobody is working it this minute (open, assigned,
 *    scheduled, on_hold).
 *  - completed / cancelled: finished.
 *  - unknown: a value in no vocabulary. Counted and reported rather than
 *    dropped, so the buckets always add up to the tickets read.
 */
import {
  normalizeTicketStatus,
  OPEN_TICKET_STATUSES,
  type ServiceTicketStatus,
} from '../_shared/service-ticket-vocabulary.ts';

export type TicketBucket = 'open' | 'inProgress' | 'completed' | 'cancelled' | 'unknown';

export const IN_PROGRESS_STATUSES: ServiceTicketStatus[] = ['en_route', 'on_site', 'in_progress'];

export function ticketBucket(status: unknown): TicketBucket {
  const s = normalizeTicketStatus(status);
  if (s === null) return 'unknown';
  if (s === 'completed') return 'completed';
  if (s === 'cancelled') return 'cancelled';
  if (IN_PROGRESS_STATUSES.includes(s)) return 'inProgress';
  return OPEN_TICKET_STATUSES.includes(s) ? 'open' : 'unknown';
}

export { OPEN_TICKET_STATUSES };
