/**
 * PROD-008: the iOS manager reports screen was blank four different ways.
 *
 * /api/team-reports has NO caller in client/src - the only consumer of the
 * whole edge function is ManagerReportsModels.swift - and every one of its four
 * cards was empty, in two distinct failure modes:
 *
 *   404: `activities` (the branch was spelled `activity`, singular) and
 *        `no-touch` (never written).
 *   200 with unreadable keys: `pipeline` answered {totalDeals, totalValue,
 *        byStage} and `leaderboard` answered {count, value}, while the Swift
 *        models decode pipelineValue / weightedValue / openOpportunityCount /
 *        closedWonThisMonth / closedWonCount and closedWonAmount /
 *        closedWonCount / rank. Every property is optional, so decoding
 *        succeeded and the card showed nothing.
 *
 * The second mode is the harder one: the request works, nothing logs, and only
 * comparing the key names finds it (PA-040).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  findNoTouchAlerts,
  rankTeamLeaderboard,
  rollUpActivity,
  summariseTeamPipeline,
  teamActivityByRep,
  type DealSummaryRow,
  type TeamMember,
} from '@shared/team-rollup';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const NOW = new Date('2026-09-21T12:00:00.000Z');
const members: TeamMember[] = [
  { userId: 'u1', name: 'Dana Rivers' },
  { userId: 'u2', name: 'Sam Okafor' },
  { userId: 'u3', name: 'Quiet Rep' },
];

describe('summariseTeamPipeline', () => {
  const rows: DealSummaryRow[] = [
    { id: 'd1', ownerId: 'u1', amount: '10000.00', probability: 50, status: 'open' },
    { id: 'd2', ownerId: 'u2', amount: '4000', probability: 25, status: 'open' },
    { id: 'd3', ownerId: 'u1', amount: null, probability: 80, status: 'open' },
    {
      id: 'd4',
      ownerId: 'u1',
      amount: '30000',
      status: 'won',
      actualCloseDate: '2026-09-02T09:00:00.000Z',
    },
    {
      id: 'd5',
      ownerId: 'u2',
      amount: '12000',
      status: 'won',
      actualCloseDate: '2026-08-14T09:00:00.000Z',
    },
    { id: 'd6', ownerId: 'u2', amount: '9999', status: 'lost' },
  ];

  it('answers the five keys the Swift model decodes', () => {
    const out = summariseTeamPipeline(rows, NOW);
    expect(Object.keys(out)).toEqual(
      expect.arrayContaining([
        'pipelineValue',
        'weightedValue',
        'openOpportunityCount',
        'closedWonThisMonth',
        'closedWonCount',
      ]),
    );
  });

  it('counts only open deals in the pipeline', () => {
    const out = summariseTeamPipeline(rows, NOW);
    expect(out.openOpportunityCount).toBe(3);
    expect(out.pipelineValue).toBe(14000);
  });

  it('weights by probability', () => {
    // 10000 * 0.5 + 4000 * 0.25 = 6000. The uncosted deal contributes nothing.
    expect(summariseTeamPipeline(rows, NOW).weightedValue).toBe(6000);
  });

  it('treats a missing probability as zero, not as certainty', () => {
    // The column defaults to 0 and the stage-move path overwrites it, so null
    // means nobody has said - and weighting it at 100% would make the forecast
    // read higher than the pipeline it is derived from.
    const out = summariseTeamPipeline(
      [{ id: 'x', amount: '1000', probability: null, status: 'open' }],
      NOW,
    );
    expect(out.pipelineValue).toBe(1000);
    expect(out.weightedValue).toBe(0);
  });

  it('closedWonThisMonth is this calendar month, not the whole window', () => {
    const out = summariseTeamPipeline(rows, NOW);
    expect(out.closedWonThisMonth).toBe(30000); // d4 only; d5 closed in August
    expect(out.closedWonCount).toBe(2); // both won deals still count
  });

  it('says when the pipeline total is a floor', () => {
    // A deal with no amount contributes nothing, so the number under-reports
    // and the card has to be able to say so (COP-B05).
    const out = summariseTeamPipeline(rows, NOW);
    expect({ uncosted: out.uncostedOpenCount, floor: out.totalIsFloor }).toEqual({
      uncosted: 1,
      floor: true,
    });
  });

  it('a status nobody recognises stays in the pipeline rather than vanishing', () => {
    const out = summariseTeamPipeline(
      [{ id: 'x', amount: '500', probability: 10, status: 'negotiating' }],
      NOW,
    );
    expect(out.openOpportunityCount).toBe(1);
  });

  it('an unparseable amount is not a zero', () => {
    const out = summariseTeamPipeline(
      [{ id: 'x', amount: 'not a number', probability: 50, status: 'open' }],
      NOW,
    );
    expect(out.openOpportunityCount).toBe(1);
    expect(out.uncostedOpenCount).toBe(1);
    expect(out.pipelineValue).toBe(0);
  });
});

describe('rankTeamLeaderboard', () => {
  const won: DealSummaryRow[] = [
    { id: 'a', ownerId: 'u1', amount: '30000', status: 'won' },
    { id: 'b', ownerId: 'u1', amount: '5000', status: 'won' },
    { id: 'c', ownerId: 'u2', amount: '35000', status: 'won' },
  ];

  it('answers the keys the Swift model decodes', () => {
    const [first] = rankTeamLeaderboard(won, members);
    expect(Object.keys(first)).toEqual([
      'userId',
      'name',
      'closedWonAmount',
      'closedWonCount',
      'rank',
    ]);
  });

  it('ranks by amount, then by count when the money is level', () => {
    // u1 closed 30000 + 5000 and u2 closed 35000, so the amounts tie and the
    // count breaks it. Left as a tie on purpose: it is the case that shows the
    // secondary sort is doing something.
    const out = rankTeamLeaderboard(won, members);
    expect(out.map((e) => [e.userId, e.closedWonAmount, e.closedWonCount, e.rank])).toEqual([
      ['u1', 35000, 2, 1],
      ['u2', 35000, 1, 2],
      ['u3', 0, 0, 3],
    ]);
  });

  it('a bigger single deal outranks a smaller pair', () => {
    const out = rankTeamLeaderboard(
      [
        { id: 'a', ownerId: 'u1', amount: '1000', status: 'won' },
        { id: 'b', ownerId: 'u1', amount: '1000', status: 'won' },
        { id: 'c', ownerId: 'u2', amount: '5000', status: 'won' },
      ],
      members,
    );
    expect(out.map((e) => e.userId)).toEqual(['u2', 'u1', 'u3']);
  });

  it('a member with nothing appears at zero rather than being dropped', () => {
    // They are on the team, so zero is a measurement about them - the inverse
    // of NULL-IS-NOT-ZERO, and the difference is whether the row was looked for.
    const quiet = rankTeamLeaderboard(won, members).find((e) => e.userId === 'u3');
    expect(quiet).toEqual({
      userId: 'u3',
      name: 'Quiet Rep',
      closedWonAmount: 0,
      closedWonCount: 0,
      rank: 3,
    });
  });

  it('a tie shares a rank instead of inventing an order', () => {
    const tied: DealSummaryRow[] = [
      { id: 'a', ownerId: 'u1', amount: '1000', status: 'won' },
      { id: 'b', ownerId: 'u2', amount: '1000', status: 'won' },
    ];
    const out = rankTeamLeaderboard(tied, members);
    expect(out.map((e) => e.rank)).toEqual([1, 1, 3]);
  });

  it('a deal owned by somebody outside the team is not attributed to anyone', () => {
    const out = rankTeamLeaderboard(
      [{ id: 'x', ownerId: 'stranger', amount: '99999', status: 'won' }],
      members,
    );
    expect(out.every((e) => e.closedWonAmount === 0)).toBe(true);
  });
});

describe('teamActivityByRep', () => {
  it('buckets the free-text activity_type into the four cards', () => {
    const rollup = rollUpActivity(
      [
        { createdBy: 'u1', activityType: 'call' },
        { createdBy: 'u1', activityType: 'phone_call' },
        { createdBy: 'u1', activityType: 'email' },
        { createdBy: 'u2', activityType: 'meeting' },
        { createdBy: 'u2', activityType: 'demo' },
        { createdBy: 'u2', activityType: 'note' },
      ],
      members,
    );
    const byId = new Map(teamActivityByRep(rollup).map((r) => [r.userId, r]));
    expect({
      calls: byId.get('u1')!.callCount,
      emails: byId.get('u1')!.emailCount,
    }).toEqual({ calls: 2, emails: 1 });
    expect({
      meetings: byId.get('u2')!.meetingCount,
      notes: byId.get('u2')!.noteCount,
    }).toEqual({ meetings: 2, notes: 1 });
  });

  it('an unrecognised type is counted under other, never dropped', () => {
    // activity_type is a free varchar with at least eleven values in the wild.
    // A count that discards rows does not add up to the total shown elsewhere.
    const rollup = rollUpActivity(
      [
        { createdBy: 'u1', activityType: 'stage_change' },
        { createdBy: 'u1', activityType: null },
      ],
      members,
    );
    const u1 = teamActivityByRep(rollup).find((r) => r.userId === 'u1')!;
    expect(u1.otherCount).toBe(2);
    expect(u1.callCount + u1.emailCount + u1.meetingCount + u1.noteCount).toBe(0);
  });

  it('every team member appears, including one who logged nothing', () => {
    const out = teamActivityByRep(rollUpActivity([], members));
    expect(out.map((r) => r.userId).sort()).toEqual(['u1', 'u2', 'u3']);
    expect(out.every((r) => r.callCount === 0)).toBe(true);
  });
});

describe('findNoTouchAlerts', () => {
  const open: DealSummaryRow[] = [
    {
      id: 'd1',
      title: 'Xerox refresh',
      ownerId: 'u1',
      amount: '20000',
      status: 'open',
      companyName: 'Acme',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'd2',
      title: 'Canon upgrade',
      ownerId: 'u2',
      amount: null,
      status: 'open',
      companyName: 'Globex',
      createdAt: '2026-09-19T00:00:00.000Z',
    },
  ];

  it('flags a deal whose last activity is older than the window', () => {
    const touched = new Map([['d1', '2026-09-10T00:00:00.000Z']]);
    const out = findNoTouchAlerts(open, touched, members, 3, NOW);
    expect(out.map((a) => a.opportunityId)).toEqual(['d1']);
    expect(out[0].daysSinceLastActivity).toBe(11);
    expect(out[0].measuredFrom).toBe('activity');
  });

  it('a recently touched deal is not flagged', () => {
    const touched = new Map([['d1', '2026-09-20T00:00:00.000Z']]);
    expect(findNoTouchAlerts(open, touched, members, 3, NOW)).toEqual([]);
  });

  it('a deal with no activity at all is measured from when it was raised, and says so', () => {
    // deals.last_activity_date is written by nothing, so an alert built on it
    // would flag every open deal forever. The fallback has to be legible.
    const out = findNoTouchAlerts(open, new Map(), members, 3, NOW);
    const d1 = out.find((a) => a.opportunityId === 'd1')!;
    expect(d1.measuredFrom).toBe('deal_created');
    expect(d1.daysSinceLastActivity).toBe(20);
  });

  it('answers the keys the Swift model decodes', () => {
    const [alert] = findNoTouchAlerts(open, new Map(), members, 3, NOW);
    expect(Object.keys(alert)).toEqual(
      expect.arrayContaining([
        'userId',
        'repName',
        'opportunityId',
        'opportunityName',
        'customerName',
        'daysSinceLastActivity',
        'openAmount',
      ]),
    );
  });

  it('an uncosted deal keeps a null amount rather than reading as free', () => {
    const out = findNoTouchAlerts(open, new Map(), members, 1, NOW);
    const d2 = out.find((a) => a.opportunityId === 'd2')!;
    expect(d2.openAmount).toBeNull();
  });

  it('oldest first - the point of the list is what has been sitting longest', () => {
    const out = findNoTouchAlerts(open, new Map(), members, 1, NOW);
    expect(out.map((a) => a.opportunityId)).toEqual(['d1', 'd2']);
  });

  it('a deal owned by nobody on the team is still listed, labelled Unassigned', () => {
    // Dropping it is how a list stops adding up to the board beside it.
    const out = findNoTouchAlerts(
      [{ ...open[0], ownerId: 'stranger' }],
      new Map(),
      members,
      3,
      NOW,
    );
    expect(out[0].repName).toBe('Unassigned');
  });
});

describe('the handler serves what the app asks for', () => {
  const src = readFileSync(join(repo, 'supabase/functions/team-reports/index.ts'), 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

  const swift = read('ios/Printyx/Core/Network/APIEndpoint.swift');

  it('every /api/team-reports path the iOS client requests has a branch', () => {
    // Derived from the client rather than listed, so a fifth card added there
    // fails here instead of returning a 404 nobody notices.
    const requested = [...swift.matchAll(/["']\/api\/team-reports\/([a-z-]+)["']/g)].map(
      (m) => m[1],
    );
    expect(requested.length).toBeGreaterThan(3);
    const unserved = [...new Set(requested)].filter(
      (seg) => !new RegExp(`reportType === '${seg}'`).test(src),
    );
    expect(unserved).toEqual([]);
  });

  it('the plural spelling is served, which is the one the app uses', () => {
    expect(src).toMatch(/reportType === 'activities'/);
  });

  it('the activity report no longer reads the phantom `activities` table', () => {
    const at = src.indexOf("reportType === 'activities'");
    const branch = src.slice(at, src.indexOf("reportType === 'pipeline'", at));
    expect(branch).toMatch(/from\('business_record_activities'\)/);
    expect(branch).not.toMatch(/from\('activities'\)/);
  });

  /**
   * One branch, bounded by the next one.
   *
   * A fixed 900-character window let a mutant survive: it ran past the pipeline
   * branch into no-touch, which also reads `deals`, so pointing pipeline back
   * at `business_records` still satisfied the assertion. A window is not a
   * scope, however it is measured.
   */
  const branchOf = (report: string) => {
    const at = src.indexOf(`reportType === '${report}'`);
    expect(at).toBeGreaterThan(-1);
    const next = src.indexOf("if (req.method === 'GET' && reportType", at + 10);
    return src.slice(at, next > -1 ? next : src.length);
  };

  it('pipeline and leaderboard read the canonical deals table', () => {
    for (const report of ['pipeline', 'leaderboard'] as const) {
      const branch = branchOf(report);
      expect({ report, reads: /from\('deals'\)/.test(branch) }).toEqual({ report, reads: true });
      expect({ report, stale: /from\('business_records'\)/.test(branch) }).toEqual({
        report,
        stale: false,
      });
    }
  });

  it('every read is scoped to the tenant', () => {
    for (const report of ['pipeline', 'leaderboard', 'activities', 'no-touch'] as const) {
      const branch = branchOf(report);
      expect({ report, scoped: /\.eq\('tenant_id', tenantId\)/.test(branch) }).toEqual({
        report,
        scoped: true,
      });
    }
  });

  it('no-touch short-circuits rather than sending an .in() with no values', () => {
    // PostgREST rejects an empty .in(), so an empty pipeline would 400.
    const at = src.indexOf("reportType === 'no-touch'");
    const branch = src.slice(at, src.indexOf("reportType === 'performance'", at));
    expect(branch).toMatch(/dealIds\.length > 0/);
    expect(branch).toMatch(/recordIds\.length > 0/);
  });
});
