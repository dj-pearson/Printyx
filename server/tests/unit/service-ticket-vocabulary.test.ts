/**
 * WF-V-05: one service-ticket vocabulary, so a filter can match.
 *
 * There were four, and nothing enforced any of them:
 *
 *   shared/schema.ts's comment said open, assigned, in-progress, completed,
 *   cancelled - with a HYPHEN.
 *   ServiceHub.tsx's filter offered `new` and `emergency`, which nothing
 *   writes, so selecting either always came back empty.
 *   MobileServiceDispatch.tsx types 'en-route' | 'on-site' | 'in-progress'.
 *   The demo seeder writes underscores, and WF-V-01 had to make the stats
 *   endpoint count BOTH spellings because picking one silently zeroed a card.
 *
 * Locked the way the sales-pipeline stage test locks its vocabulary: reverting
 * any of the three decisions below fails a named test rather than a diff.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
  CLOSED_TICKET_STATUSES,
  OPEN_TICKET_STATUSES,
  PRIORITY_ALIASES,
  PRIORITY_LABELS,
  SERVICE_TICKET_PRIORITIES,
  SERVICE_TICKET_STATUSES,
  STATUS_ALIASES,
  STATUS_LABELS,
  isOpenStatus,
  normalizeTicketPriority,
  normalizeTicketStatus,
  ticketVocabulary,
} from '../../../shared/service-ticket-vocabulary';

const strip = (src: string) =>
  src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

describe('the vocabulary itself', () => {
  it('is exactly these nine statuses and four priorities', () => {
    expect(SERVICE_TICKET_STATUSES).toEqual([
      'open',
      'assigned',
      'scheduled',
      'en_route',
      'on_site',
      'in_progress',
      'on_hold',
      'completed',
      'cancelled',
    ]);
    expect(SERVICE_TICKET_PRIORITIES).toEqual(['low', 'medium', 'high', 'urgent']);
  });

  it('every status is open or closed, and none is both', () => {
    for (const status of SERVICE_TICKET_STATUSES) {
      const open = OPEN_TICKET_STATUSES.includes(status);
      const closed = CLOSED_TICKET_STATUSES.includes(status);
      expect(`${status}: ${open !== closed}`).toBe(`${status}: true`);
    }
  });

  it('every value has a label, and no label is orphaned', () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...SERVICE_TICKET_STATUSES].sort());
    expect(Object.keys(PRIORITY_LABELS).sort()).toEqual([...SERVICE_TICKET_PRIORITIES].sort());
  });

  it('every alias resolves to a member of the vocabulary', () => {
    for (const [alias, target] of Object.entries(STATUS_ALIASES)) {
      expect(`${alias} -> ${SERVICE_TICKET_STATUSES.includes(target)}`).toBe(`${alias} -> true`);
      // An alias that is also a canonical value would be unreachable.
      expect(SERVICE_TICKET_STATUSES).not.toContain(alias);
    }
    for (const [alias, target] of Object.entries(PRIORITY_ALIASES)) {
      expect(`${alias} -> ${SERVICE_TICKET_PRIORITIES.includes(target)}`).toBe(`${alias} -> true`);
      expect(SERVICE_TICKET_PRIORITIES).not.toContain(alias);
    }
  });
});

describe('the three decisions', () => {
  it('UNDERSCORES ARE CANONICAL, so the hyphen spellings normalize into them', () => {
    // Not because they are prettier: the seeder, the mobile check-in and every
    // current writer use them, so the hyphen forms are the ones with (probably)
    // no rows behind them.
    expect(normalizeTicketStatus('in-progress')).toBe('in_progress');
    expect(normalizeTicketStatus('en-route')).toBe('en_route');
    expect(normalizeTicketStatus('on-site')).toBe('on_site');
    expect(normalizeTicketStatus('IN_PROGRESS')).toBe('in_progress');
    expect(normalizeTicketStatus('  in progress  ')).toBeNull();
  });

  it('`new` and `emergency` are ALIASES, not members', () => {
    // Both were offered by a filter and written by nothing, so selecting either
    // always came back empty. Adding them as members would keep that true.
    expect(SERVICE_TICKET_STATUSES).not.toContain('new');
    expect(normalizeTicketStatus('new')).toBe('open');
    expect(SERVICE_TICKET_PRIORITIES).not.toContain('emergency');
    expect(normalizeTicketPriority('emergency')).toBe('urgent');
    expect(normalizeTicketPriority('critical')).toBe('urgent');
  });

  it('an UNKNOWN value is rejected, which is what stops a fifth spelling', () => {
    expect(normalizeTicketStatus('frobnicated')).toBeNull();
    expect(normalizeTicketStatus('')).toBeNull();
    expect(normalizeTicketStatus(null)).toBeNull();
    expect(normalizeTicketPriority('showstopper')).toBeNull();
  });

  it('isOpenStatus reads an alias too, so a legacy row still counts as load', () => {
    expect(isOpenStatus('in-progress')).toBe(true);
    expect(isOpenStatus('new')).toBe(true);
    expect(isOpenStatus('resolved')).toBe(false);
    expect(isOpenStatus('frobnicated')).toBe(false);
  });

  it('the served payload carries the lists and the aliases', () => {
    const v = ticketVocabulary();
    expect(v.statuses).toHaveLength(SERVICE_TICKET_STATUSES.length);
    expect(v.statuses[0]).toEqual({ value: 'open', label: 'Open', isOpen: true });
    expect(v.openStatuses).toEqual(OPEN_TICKET_STATUSES);
    expect(v.statusAliases['in-progress']).toBe('in_progress');
  });
});

describe('the twins, the handler and the page', () => {
  it('the client copy and the Deno copy are the same logic', () => {
    const node = readFileSync('shared/service-ticket-vocabulary.ts', 'utf8');
    const deno = readFileSync('supabase/functions/_shared/service-ticket-vocabulary.ts', 'utf8');
    expect(strip(node)).toBe(strip(deno));
  });

  it('the handler serves it and validates writes against it', () => {
    const src = strip(readFileSync('supabase/functions/service-tickets/index.ts', 'utf8'));
    expect(src).toContain("ticketId === 'vocabulary'");
    expect(src).toContain('ticketVocabulary()');
    // Create and update both refuse an unknown value rather than storing it.
    expect((src.match(/INVALID_TICKET_VOCABULARY/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(src).toContain('normalizeTicketStatus(body.status) ?? ');
  });

  it('the field mapper normalizes and reports, in one place for both hosts', () => {
    const src = strip(readFileSync('supabase/functions/service-tickets/_dispatch.ts', 'utf8'));
    expect(src).toContain('normalizeTicketStatus(newValue)');
    expect(src).toContain('rejected.push');
    // The dispatch board's open-status list is the vocabulary's, not a copy -
    // its own used to carry `pending`, which is in no vocabulary at all.
    expect(src).toContain(
      "export { OPEN_TICKET_STATUSES } from '../_shared/service-ticket-vocabulary.ts'",
    );
    expect(src).not.toContain("'pending',");
  });

  it('ServiceHub renders the list rather than writing one out', () => {
    const page = readFileSync('client/src/pages/ServiceHub.tsx', 'utf8');
    expect(page).toContain('SERVICE_TICKET_STATUSES.map');
    expect(page).toContain('SERVICE_TICKET_PRIORITIES.map');
    expect(page).not.toContain('<SelectItem value="emergency">');
    expect(page).not.toContain('<SelectItem value="new">');
    // And compares NORMALIZED values, so a row written before the backfill is
    // still found by the filter meant to find it.
    expect(page).toContain('normalizeTicketStatus(ticket.status) === statusFilter');
  });

  it('the migration backfills first, then constrains', () => {
    const sql = readFileSync('drizzle/migrations/0078_wf_v05_ticket_vocabulary.sql', 'utf8');
    const backfill = sql.indexOf("SET status = 'in_progress'");
    const constraint = sql.indexOf('service_tickets_status_check');
    expect(backfill).toBeGreaterThan(-1);
    expect(backfill).toBeLessThan(constraint);
    // NOT VALID is the point: the AC asks for the constraint after a data audit,
    // and this leaves unrecognised legacy rows in place to BE audited while
    // still enforcing every new write.
    expect(sql).toContain('NOT VALID');
    expect(sql).toContain('VALIDATE CONSTRAINT service_tickets_status_check');
    expect(readFileSync('drizzle/migrations/meta/_journal.json', 'utf8')).toContain(
      '0078_wf_v05_ticket_vocabulary',
    );
  });

  it('every alias the module knows is backfilled by the migration', () => {
    // Otherwise a spelling normalizes on write but leaves old rows stranded
    // outside the constraint, which is the gap that made VALIDATE impossible.
    const sql = readFileSync('drizzle/migrations/0078_wf_v05_ticket_vocabulary.sql', 'utf8');
    const body = sql.slice(sql.indexOf('UPDATE service_tickets'));
    for (const alias of Object.keys(STATUS_ALIASES)) {
      expect(`${alias}: ${body.includes(`'${alias}'`)}`).toBe(`${alias}: true`);
    }
    for (const alias of Object.keys(PRIORITY_ALIASES)) {
      expect(`${alias}: ${body.includes(`'${alias}'`)}`).toBe(`${alias}: true`);
    }
  });
});
