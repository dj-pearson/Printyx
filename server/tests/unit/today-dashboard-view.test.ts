/**
 * PROD-008: the /dashboards/today response shape, locked.
 *
 * The edge function used to answer with {activitiesCount, newTickets, newDeals,
 * newDealValue} while TodayDashboard.tsx reads {overdue, today, upcoming,
 * hotLeads, pipelineAlerts, recentWins, stats}. Because the page destructures
 * with `= []` defaults, that mismatch rendered an empty dashboard with zero
 * stats and no error - the failure mode a wrong shape produces and a 404 does
 * not. These tests cover the mappers that shape it.
 */
import { describe, it, expect } from 'vitest';
import {
  conversionRate,
  daysSince,
  toActivityView,
  toLeadView,
  toStaleDealView,
  toWonDealView,
  todayWindows,
} from '../../../supabase/functions/_shared/today-dashboard-view';

const names = new Map<string, string | null>([['rec-1', 'Acme Copiers']]);

describe('toActivityView', () => {
  const row = {
    id: 'act-1',
    subject: 'Follow up on quote',
    activity_type: 'call',
    scheduled_date: '2026-08-20T15:00:00.000Z',
    due_date: '2026-08-21T15:00:00.000Z',
    completed_date: null,
    description: 'Left a voicemail',
    business_record_id: 'rec-1',
  };

  it('maps snake_case columns to the keys the page reads', () => {
    expect(toActivityView(row, names)).toEqual({
      id: 'act-1',
      title: 'Follow up on quote',
      type: 'call',
      scheduledDate: '2026-08-20T15:00:00.000Z',
      dueDate: '2026-08-21T15:00:00.000Z',
      status: 'pending',
      customerName: 'Acme Copiers',
      customerId: 'rec-1',
      notes: 'Left a voicemail',
    });
  });

  it('derives status from completed_date and emits no priority', () => {
    const done = toActivityView({ ...row, completed_date: '2026-08-21T16:00:00Z' }, names);
    expect(done.status).toBe('completed');
    expect('priority' in done).toBe(false);
  });

  it('leaves customerName undefined when the record is unknown or absent', () => {
    expect(toActivityView({ ...row, business_record_id: 'gone' }, names).customerName).toBe(
      undefined,
    );
    expect(toActivityView({ ...row, business_record_id: null }, names).customerId).toBe(null);
  });
});

describe('toLeadView', () => {
  const records = new Map([
    [
      'lead-1',
      {
        id: 'lead-1',
        company_name: 'Beta Print',
        primary_contact_name: 'Dana',
        // numeric comes back from PostgREST as a string
        estimated_deal_value: '12500.00',
        status: 'active',
        last_contact_date: '2026-08-10T00:00:00.000Z',
      },
    ],
  ]);

  it('coerces the numeric estimate rather than concatenating it', () => {
    const view = toLeadView(
      { id: 'calc-1', lead_id: 'lead-1', total_score: '88', lead_grade: 'A', lead_tier: 'hot' },
      records,
    );
    expect(view.estimatedValue).toBe(12500);
    expect(view.score).toBe(88);
    expect(view.companyName).toBe('Beta Print');
    expect(view.reason).toBe('A grade lead - hot');
  });

  it('falls back to the score row when the business record is missing', () => {
    const view = toLeadView({ id: 'calc-2', lead_id: 'gone', total_score: 70 }, records);
    expect(view.companyName).toBe('Unknown');
    expect(view.status).toBe('lead');
    expect(view.lastContact).toBe(null);
  });
});

describe('deal views', () => {
  const now = new Date('2026-08-22T00:00:00.000Z');
  const stages = new Map([['stage-1', 'Proposal Sent']]);
  const deal = {
    id: 'deal-1',
    title: 'Fleet refresh',
    company_name: 'Gamma Ltd',
    amount: '48000.00',
    probability: 40,
    stage_id: 'stage-1',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-12T00:00:00.000Z',
  };

  it('resolves the stage name from pipeline_stages, not from the deal', () => {
    const view = toStaleDealView(deal, stages, now);
    expect(view.stage).toBe('Proposal Sent');
    expect(view.value).toBe(48000);
    expect(view.daysSinceUpdate).toBe(10);
    expect(view.staleReason).toBe('Stalled in Proposal Sent stage for 10 days');
  });

  it('does not leak a stage uuid into the UI when the stage row is gone', () => {
    expect(toStaleDealView(deal, new Map(), now).stage).toBe('Unknown');
  });

  it('falls back to created_at when updated_at is null', () => {
    expect(daysSince({ ...deal, updated_at: null }, now)).toBe(21);
    expect(daysSince({ ...deal, updated_at: null, created_at: null }, now)).toBe(0);
  });

  it('reports a win at full probability', () => {
    expect(toWonDealView(deal)).toMatchObject({ stage: 'won', probability: 100, value: 48000 });
  });
});

describe('stats', () => {
  it('computes conversion over leads plus customers, and survives an empty tenant', () => {
    expect(conversionRate(75, 25)).toBe(25);
    expect(conversionRate(0, 0)).toBe(0);
  });
});

describe('todayWindows', () => {
  const w = todayWindows(new Date('2026-08-19T13:45:00.000Z')); // a Wednesday

  it('bounds today to the UTC day', () => {
    expect(w.startOfDay.toISOString()).toBe('2026-08-19T00:00:00.000Z');
    expect(w.endOfDay.toISOString()).toBe('2026-08-19T23:59:59.999Z');
  });

  it('starts upcoming after today and runs three further days', () => {
    expect(w.upcomingFrom.toISOString()).toBe('2026-08-20T00:00:00.000Z');
    expect(w.upcomingTo.toISOString()).toBe('2026-08-23T00:00:00.000Z');
  });

  it('starts the week on Sunday, matching the date-fns default on the Express side', () => {
    expect(w.weekStart.toISOString()).toBe('2026-08-16T00:00:00.000Z');
    expect(w.weekEnd.toISOString()).toBe('2026-08-22T23:59:59.999Z');
  });
});
