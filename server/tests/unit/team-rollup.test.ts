/**
 * COP-B01 AC6: the two manager cards on My Day.
 *
 * `team-pipeline` and `team-activity` were in the card catalogue from the day
 * the workspace shipped - declared, role-gated at MANAGER, orderable in the
 * customizer - and rendered NOTHING, because no endpoint answered them. The
 * card boundary showed an empty card rather than an error, so a manager could
 * add the card, see a blank, and reasonably read it as a quiet week.
 *
 * The arithmetic is tested directly. The wiring is asserted by reading source,
 * because nothing typechecks the edge tree and a declared-but-unanswered card
 * is exactly the defect this closes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  memberName,
  rollUpActivity,
  rollUpPipeline,
  type TeamMember,
} from '../../../shared/team-rollup';
import { MY_DAY_CARDS } from '../../../shared/my-day-layout';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');
const stripComments = (src: string) =>
  src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const team: TeamMember[] = [
  { userId: 'u-dana', name: 'Dana Reid' },
  { userId: 'u-sam', name: 'Sam Okoye' },
  { userId: 'u-lee', name: 'Lee Park' },
];

describe('rollUpPipeline', () => {
  it('groups deals by owner and sorts by money carried', () => {
    const out = rollUpPipeline(
      [
        { ownerId: 'u-dana', amount: '1000' },
        { ownerId: 'u-sam', amount: '5000' },
        { ownerId: 'u-sam', amount: '500' },
      ],
      team,
    );
    expect(out.members.map((m) => m.userId)).toEqual(['u-sam', 'u-dana', 'u-lee']);
    expect(out.members[0].openCount).toBe(2);
    expect(out.members[0].openAmount).toBe(5500);
  });

  it('keeps a member with nothing, at zero', () => {
    // They are on the team, so zero is a measurement about them.
    const out = rollUpPipeline([{ ownerId: 'u-dana', amount: '10' }], team);
    const lee = out.members.find((m) => m.userId === 'u-lee');
    expect(lee).toBeDefined();
    expect(lee!.openCount).toBe(0);
    expect(lee!.openAmount).toBe(0);
  });

  it('puts an ownerless deal in the unassigned bucket rather than dropping it', () => {
    const out = rollUpPipeline(
      [
        { ownerId: null, amount: '900' },
        { ownerId: 'u-dana', amount: '100' },
      ],
      team,
    );
    expect(out.unassigned.count).toBe(1);
    expect(out.unassigned.amount).toBe(900);
    // The total the card prints must include it, or the rows stop adding up.
    expect(out.totalCount).toBe(2);
    expect(out.totalAmount).toBe(1000);
  });

  it('treats an owner outside the team as unassigned, not as a silent drop', () => {
    const out = rollUpPipeline([{ ownerId: 'u-stranger', amount: '400' }], team);
    expect(out.unassigned.count).toBe(1);
    expect(out.totalCount).toBe(1);
  });

  it('counts an uncosted deal and flags the total as a floor', () => {
    const out = rollUpPipeline(
      [
        { ownerId: 'u-dana', amount: null },
        { ownerId: 'u-dana', amount: '250' },
      ],
      team,
    );
    const dana = out.members.find((m) => m.userId === 'u-dana')!;
    expect(dana.openCount).toBe(2);
    expect(dana.openAmount).toBe(250);
    expect(dana.uncostedCount).toBe(1);
    expect(out.totalIsFloor).toBe(true);
  });

  it('is not a floor when every deal carries an amount', () => {
    const out = rollUpPipeline([{ ownerId: 'u-dana', amount: '250' }], team);
    expect(out.totalIsFloor).toBe(false);
  });

  it('refuses to read an unparseable amount as zero money on a counted deal', () => {
    const out = rollUpPipeline([{ ownerId: 'u-dana', amount: 'tbd' }], team);
    expect(out.totalAmount).toBe(0);
    expect(out.totalIsFloor).toBe(true); // ...and says the number is short
  });

  it('an empty team with deals still reports them', () => {
    const out = rollUpPipeline([{ ownerId: 'u-dana', amount: '5' }], []);
    expect(out.unassigned.count).toBe(1);
    expect(out.totalAmount).toBe(5);
  });
});

describe('rollUpActivity', () => {
  it('counts per member and by type, newest ordering by volume', () => {
    const out = rollUpActivity(
      [
        { createdBy: 'u-sam', activityType: 'call' },
        { createdBy: 'u-sam', activityType: 'email' },
        { createdBy: 'u-dana', activityType: 'call' },
      ],
      team,
    );
    expect(out.members[0].userId).toBe('u-sam');
    expect(out.members[0].total).toBe(2);
    expect(out.members[0].byType).toEqual({ call: 1, email: 1 });
    expect(out.total).toBe(3);
  });

  it('counts an activity with no type instead of discarding it', () => {
    const out = rollUpActivity([{ createdBy: 'u-dana', activityType: null }], team);
    const dana = out.members.find((m) => m.userId === 'u-dana')!;
    expect(dana.total).toBe(1);
    expect(dana.byType).toEqual({ unspecified: 1 });
  });

  it('counts an activity by someone outside the team in unassigned', () => {
    const out = rollUpActivity([{ createdBy: 'u-stranger', activityType: 'call' }], team);
    expect(out.unassigned).toBe(1);
    expect(out.total).toBe(1);
  });
});

describe('memberName', () => {
  it('prefers the real name, then the email, and is never blank', () => {
    expect(memberName({ first_name: 'Dana', last_name: 'Reid' })).toBe('Dana Reid');
    expect(memberName({ first_name: 'Dana', last_name: null })).toBe('Dana');
    expect(memberName({ email: 'dana@example.com' })).toBe('dana@example.com');
    expect(memberName({})).toBe('Unnamed user');
  });
});

describe('the cards are answered, not merely declared', () => {
  const crmFn = read('supabase/functions/crm/index.ts');
  const page = read('client/src/pages/TodayDashboard.tsx');
  const cards = read('client/src/components/crm/TeamRollupCards.tsx');

  it('both catalogue cards have a render slot on the page', () => {
    const teamCards = MY_DAY_CARDS.filter((c) => c.teamScope).map((c) => String(c.id));
    expect(teamCards).toEqual(['team-pipeline', 'team-activity']);
    for (const id of teamCards) {
      expect(page).toContain(`'${id}': <Team`);
    }
  });

  it('the endpoint exists and refuses a caller with no team', () => {
    expect(crmFn).toContain("subRoute === 'team-rollup'");
    // A one-row team card is a rep reading a manager surface, not a smaller
    // version of the feature.
    expect(crmFn).toContain("scope.tier === 'own'");
    expect(crmFn).toContain('INSUFFICIENT_SCOPE');
  });

  it('the team comes from resolveScope, never from a query parameter', () => {
    const branch = crmFn.slice(
      crmFn.indexOf("subRoute === 'team-rollup'"),
      crmFn.indexOf("subRoute === 'dashboard-stats'"),
    );
    expect(branch).toContain('resolveScope(admin');
    expect(branch).toContain('scope.userIds === null');
    expect(branch).not.toContain("searchParams.get('userIds')");
    expect(branch).not.toContain("searchParams.get('teamId')");
  });

  it('pages both reads instead of capping them', () => {
    const branch = crmFn.slice(
      crmFn.indexOf("subRoute === 'team-rollup'"),
      crmFn.indexOf("subRoute === 'dashboard-stats'"),
    );
    // A capped sweep re-reads the same first page and the tail is never seen.
    expect(branch).not.toContain('.limit(');
    const calls = branch.match(/fetchAllRows</g) ?? [];
    expect(calls.length).toBe(2);
  });

  it('a roll-up that failed is null, so the card renders nothing rather than zero', () => {
    const branch = crmFn.slice(
      crmFn.indexOf("subRoute === 'team-rollup'"),
      crmFn.indexOf("subRoute === 'dashboard-stats'"),
    );
    expect(branch).toContain('pipeline: ReturnType<typeof rollUpPipeline> | null = null');
    expect(branch).toContain('activity: ReturnType<typeof rollUpActivity> | null = null');
    expect(cards).toContain('!query.data?.pipeline');
    expect(cards).toContain('!query.data?.activity');
  });

  it('the pipeline card shows the unassigned bucket', () => {
    expect(stripComments(cards)).toContain('pipeline.unassigned.count > 0');
  });

  it('and says whose numbers these are', () => {
    expect(cards).toContain('coversWholeTenant');
    expect(cards).toContain('scopeLabel');
  });
});
