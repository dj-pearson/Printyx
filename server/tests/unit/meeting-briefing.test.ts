/**
 * COP-B12 AC4: the pre-meeting briefing.
 *
 * The story was filed BLOCKED on three compounding prerequisites, and re-reading
 * the tree found AC4 needs none of them: it reads four tables a dealer already
 * fills and never touches a transcript. The other criteria stay blocked and
 * that is recorded on the story.
 *
 * The rules under test are the ones a briefing gets wrong in a way nobody
 * notices, because it is read for thirty seconds before a conversation and
 * then acted on.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { buildMeetingBriefing } from '../../../shared/meeting-briefing';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');

const full = {
  deals: [
    { id: 'd1', title: 'Fleet refresh', amount: '12000', expectedCloseDate: '2026-11-01' },
    { id: 'd2', title: 'Colour upgrade', amount: '3000', expectedCloseDate: '2026-10-01' },
  ],
  equipment: [
    { id: 'e1', modelNumber: 'bizhub C360' },
    { id: 'e2', modelNumber: 'bizhub C360' },
    { id: 'e3', modelNumber: 'AltaLink C8055' },
  ],
  tickets: [
    { id: 't1', status: 'open', priority: 'high', createdAt: '2026-09-01T10:00:00Z' },
    { id: 't2', status: 'completed', priority: 'low', createdAt: '2026-09-15T10:00:00Z' },
  ],
  activities: [
    { activityType: 'call', createdAt: '2026-09-10T09:00:00Z' },
    { activityType: 'email', createdAt: '2026-09-18T09:00:00Z' },
    { activityType: 'call', createdAt: '2026-09-12T09:00:00Z' },
  ],
};

describe('buildMeetingBriefing', () => {
  it('summarises open deals, soonest close first', () => {
    const b = buildMeetingBriefing(full);
    expect(b.openDeals).toMatchObject({ count: 2, totalAmount: 15000, totalIsFloor: false });
    // Soonest, not largest: the rep needs to know what is about to land.
    expect(b.openDeals!.soonest).toEqual({
      title: 'Colour upgrade',
      expectedCloseDate: '2026-10-01',
    });
  });

  it('calls the pipeline total a floor when a deal carries no amount', () => {
    const b = buildMeetingBriefing({ ...full, deals: [{ id: 'd3', amount: null }] });
    expect(b.openDeals).toMatchObject({ count: 1, totalAmount: 0, uncostedCount: 1 });
    expect(b.openDeals!.totalIsFloor).toBe(true);
  });

  it('a deal with no close date is not the soonest', () => {
    // "No date" is not "far away", and it is certainly not "next week".
    const b = buildMeetingBriefing({
      ...full,
      deals: [{ id: 'd4', title: 'Undated', expectedCloseDate: null }],
    });
    expect(b.openDeals!.soonest).toBeNull();
  });

  it('counts the fleet by model, largest group first', () => {
    const b = buildMeetingBriefing(full);
    expect(b.installedBase).toEqual({
      machineCount: 3,
      models: [
        { model: 'bizhub C360', count: 2 },
        { model: 'AltaLink C8055', count: 1 },
      ],
    });
  });

  it('keeps a machine whose model nobody recorded', () => {
    // It is still on the customer floor.
    const b = buildMeetingBriefing({ ...full, equipment: [{ id: 'e9', modelNumber: '  ' }] });
    expect(b.installedBase!.machineCount).toBe(1);
    expect(b.installedBase!.models[0].model).toBe('Model not recorded');
  });

  it('counts only open tickets as open, and urgency within them', () => {
    const b = buildMeetingBriefing(full);
    expect(b.serviceState).toEqual({
      openTickets: 1,
      urgentTickets: 1,
      lastTicketAt: '2026-09-15T10:00:00Z',
    });
  });

  it('reports the latest activity and a breakdown by type', () => {
    const b = buildMeetingBriefing(full);
    expect(b.recentActivity).toEqual({
      count: 3,
      lastAt: '2026-09-18T09:00:00Z',
      byType: { call: 2, email: 1 },
    });
  });

  it('an account with nothing reports zeros, because the rows were looked for', () => {
    const b = buildMeetingBriefing({ deals: [], equipment: [], tickets: [], activities: [] });
    expect(b.openDeals!.count).toBe(0);
    expect(b.installedBase!.machineCount).toBe(0);
    expect(b.serviceState!.openTickets).toBe(0);
    expect(b.recentActivity!.count).toBe(0);
    expect(b.unbacked).toEqual([]);
  });

  it('a section that could not be read is NULL and says so', () => {
    // "No open deals" and "we could not look" are different facts, and a
    // briefing is acted on minutes later.
    const b = buildMeetingBriefing({ ...full, deals: null, tickets: null });
    expect(b.openDeals).toBeNull();
    expect(b.serviceState).toBeNull();
    expect(b.installedBase).not.toBeNull();
    expect(b.unbacked).toHaveLength(2);
    expect(b.unbacked.join(' ')).toContain('Open deals');
    expect(b.unbacked.join(' ')).toContain('Service history');
  });

  it('ignores an unparseable timestamp rather than reporting it as the latest', () => {
    const b = buildMeetingBriefing({
      ...full,
      activities: [{ activityType: 'call', createdAt: 'whenever' }],
    });
    expect(b.recentActivity!.lastAt).toBeNull();
    expect(b.recentActivity!.count).toBe(1);
  });
});

describe('the endpoint', () => {
  const handler = read('supabase/functions/meetings/handlers/briefing.ts');
  const index = read('supabase/functions/meetings/index.ts');

  it('is routed', () => {
    expect(index).toContain("case 'briefing':");
    expect(index).toContain('handleBriefing(req, ctx)');
  });

  it('gates on the event being the caller own, which is the authorization', () => {
    const eventRead = handler.slice(
      handler.indexOf(".from('calendar_events')"),
      handler.indexOf('.maybeSingle()'),
    );
    expect(eventRead).toContain(".eq('tenant_id', auth.tenantId)");
    expect(eventRead).toContain(".eq('user_id', auth.userId)");
  });

  it('every account read is tenant-scoped', () => {
    const reads = [...handler.matchAll(/\.from\('([a-z_]+)'\)([\s\S]*?)(?=\n\s+if \(error\))/g)];
    expect(reads.length).toBeGreaterThan(4);
    for (const [, table, chain] of reads) {
      expect(chain, `${table} read is not tenant-scoped`).toContain("'tenant_id', auth.tenantId");
    }
  });

  it('answers a meeting linked to no account rather than guessing one', () => {
    // Guessing from the attendee list would brief the rep on the wrong company.
    expect(handler).toContain('if (!accountId)');
    expect(handler).toContain('not linked to an account');
  });

  it('names the transcript gap instead of leaving it silently absent', () => {
    expect(handler).toContain('TRANSCRIPTION_PROVIDER');
  });
});
