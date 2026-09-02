/**
 * One service-ticket vocabulary (WF-V-05).
 *
 * There were at least four, and no CHECK constraint or enum enforced any of
 * them, so a filter could not match:
 *
 *   shared/schema.ts's comment says open, assigned, in-progress, completed,
 *   cancelled - with a HYPHEN.
 *   ServiceHub.tsx's filter offers new, assigned, en_route, on_site,
 *   in_progress, completed, cancelled - with UNDERSCORES, and `new`, which
 *   nothing writes.
 *   MobileServiceDispatch.tsx types 'assigned' | 'en-route' | 'on-site' |
 *   'in-progress' | 'completed'.
 *   The demo seeder writes in_progress; the stats endpoint had to count BOTH
 *   spellings (WF-V-01) because picking one silently zeroed a card.
 *
 * Priority ran the same way: the schema comment says low/medium/high/urgent,
 * the filter adds `emergency`, and the stats endpoint counts urgent OR critical.
 *
 * The Deno copy the handlers run. shared/service-ticket-vocabulary.ts is the
 * client twin, and server/tests/unit/service-ticket-vocabulary.test.ts locks the
 * two together.
 *
 * UNDERSCORES ARE CANONICAL. Not because they are prettier - because the demo
 * seeder, the mobile check-in and every current writer use them, so the hyphen
 * spellings are the ones with (probably) no rows behind them. Choosing the
 * other way would have required rewriting live data to match a comment.
 *
 * ALIASES ARE ACCEPTED ON WRITE AND NORMALIZED, NOT REJECTED. A caller sending
 * 'in-progress' means the same thing, and answering 400 would break the mobile
 * component while telling the technician nothing useful. Unknown values ARE
 * rejected, which is the part that stops the vocabulary growing a fifth member.
 */

export const SERVICE_TICKET_STATUSES = [
  'open',
  'assigned',
  'scheduled',
  'en_route',
  'on_site',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
] as const;
export type ServiceTicketStatus = (typeof SERVICE_TICKET_STATUSES)[number];

export const SERVICE_TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type ServiceTicketPriority = (typeof SERVICE_TICKET_PRIORITIES)[number];

/**
 * Statuses that mean the work is outstanding.
 *
 * WF-V-03's dispatch load counts these, and it used to carry its own copy -
 * including `pending`, which is not in the vocabulary at all, so a ticket in it
 * would have been counted as load and shown in no filter.
 */
export const OPEN_TICKET_STATUSES: ServiceTicketStatus[] = [
  'open',
  'assigned',
  'scheduled',
  'en_route',
  'on_site',
  'in_progress',
  'on_hold',
];

/** The work is finished, one way or the other. */
export const CLOSED_TICKET_STATUSES: ServiceTicketStatus[] = ['completed', 'cancelled'];

/**
 * Spellings seen in the tree, mapped onto the canonical form.
 *
 * `new` is deliberately mapped to `open` rather than added: the filter offered
 * it, nothing wrote it, and a status nothing produces is a filter that always
 * comes back empty. `pending` likewise - it appeared only in WF-V-03's own
 * open-status list. `resolved` and `closed` are counted as `completed` by the
 * stats endpoint and mean the same thing to a technician.
 */
export const STATUS_ALIASES: Record<string, ServiceTicketStatus> = {
  'in-progress': 'in_progress',
  inprogress: 'in_progress',
  'en-route': 'en_route',
  enroute: 'en_route',
  'on-site': 'on_site',
  onsite: 'on_site',
  'on-hold': 'on_hold',
  onhold: 'on_hold',
  new: 'open',
  pending: 'open',
  unassigned: 'open',
  resolved: 'completed',
  closed: 'completed',
  complete: 'completed',
  canceled: 'cancelled',
  voided: 'cancelled',
};

/**
 * `critical` and `emergency` both mean urgent. Keeping them as separate levels
 * is what made the stats endpoint count two and the filter offer a third that
 * matched neither.
 */
export const PRIORITY_ALIASES: Record<string, ServiceTicketPriority> = {
  critical: 'urgent',
  emergency: 'urgent',
  p1: 'urgent',
  normal: 'medium',
  standard: 'medium',
  routine: 'low',
};

const key = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

/** Canonical status, or null when the value belongs to no vocabulary. */
export function normalizeTicketStatus(value: unknown): ServiceTicketStatus | null {
  const k = key(value);
  if (!k) return null;
  if ((SERVICE_TICKET_STATUSES as readonly string[]).includes(k)) {
    return k as ServiceTicketStatus;
  }
  return STATUS_ALIASES[k] ?? null;
}

export function normalizeTicketPriority(value: unknown): ServiceTicketPriority | null {
  const k = key(value);
  if (!k) return null;
  if ((SERVICE_TICKET_PRIORITIES as readonly string[]).includes(k)) {
    return k as ServiceTicketPriority;
  }
  return PRIORITY_ALIASES[k] ?? null;
}

export function isOpenStatus(value: unknown): boolean {
  const status = normalizeTicketStatus(value);
  return status !== null && OPEN_TICKET_STATUSES.includes(status);
}

/** Human labels, so a select and a badge cannot disagree about wording. */
export const STATUS_LABELS: Record<ServiceTicketStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  scheduled: 'Scheduled',
  en_route: 'En route',
  on_site: 'On site',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const PRIORITY_LABELS: Record<ServiceTicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

/** The payload GET /service-tickets/vocabulary answers with. */
export function ticketVocabulary() {
  return {
    statuses: SERVICE_TICKET_STATUSES.map((value) => ({
      value,
      label: STATUS_LABELS[value],
      isOpen: OPEN_TICKET_STATUSES.includes(value),
    })),
    priorities: SERVICE_TICKET_PRIORITIES.map((value) => ({
      value,
      label: PRIORITY_LABELS[value],
    })),
    openStatuses: OPEN_TICKET_STATUSES,
    closedStatuses: CLOSED_TICKET_STATUSES,
    statusAliases: STATUS_ALIASES,
    priorityAliases: PRIORITY_ALIASES,
  };
}
