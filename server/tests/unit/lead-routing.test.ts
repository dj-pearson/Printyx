/**
 * WF-S-02: lead routing rules that exist, and matching that matches.
 *
 * TWO DEFECTS, and the second was hidden by the first.
 *
 * supabase/functions/auto-lead-routing read and wrote `lead_routing_rules`, a
 * relation named there and NOWHERE else in the repository - no Drizzle schema,
 * no migration, no RLS file, no seeder. EDGE-002g had already caught the same
 * file answering that 42P01 with two hardcoded "sample rules" at 200, and
 * replaced them with a 503, so the page looked alive while no rule could exist.
 *
 * The table this story was filed to CREATE already existed under another name:
 * `lead_assignment_rules`, declared in shared/lead-assignment-schema.ts, created
 * by migration 0000, and served by server/routes-lead-assignment.ts with no
 * caller. So this is the WF-C-06 shape again - two models of one feature, one
 * unreachable and one broken - and the fix is the same: point the live surface
 * at the real table rather than create a fifth near-duplicate.
 *
 * AND NOTHING MATCHED. /route took rules[0] and said so in its own comment: the
 * loop that once stood there broke on its first iteration. A $400 toner lead and
 * a fifty-machine fleet lead went to the same rep, and no criterion was ever
 * read. That is what AC4 asks for, and it is what the first two blocks test.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getTableColumns } from 'drizzle-orm';
import { leadAssignmentRules } from '../../../shared/lead-assignment-schema';
import {
  evaluateCriteria,
  resolveAssignee,
  ruleMatches,
  selectRule,
  type LeadRoutingRule,
} from '../../../supabase/functions/_shared/lead-routing';

const strip = (src: string) =>
  src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

const rule = (over: Partial<LeadRoutingRule> = {}): LeadRoutingRule => ({
  id: 'r-1',
  rule_name: 'Enterprise legal',
  assignment_type: 'manual',
  criteria: {},
  assign_to_user_id: 'rep-1',
  priority: 100,
  is_active: true,
  ...over,
});

const lead = (over: Record<string, unknown> = {}) => ({
  leadSource: 'website',
  leadScore: 80,
  industry: 'Legal',
  employeeCount: 250,
  estimatedAmount: 42000,
  country: 'US',
  state: 'WA',
  city: 'Seattle',
  postalCode: '98101',
  ...over,
});

describe('a rule matches a lead, or says which criterion it failed', () => {
  it('an empty criteria object matches everything', () => {
    // A rule that names no industries is not a rule that matches no industries.
    // Getting this backwards makes every catch-all rule dead.
    expect(ruleMatches(rule({ criteria: {} }), lead())).toBe(true);
    expect(ruleMatches(rule({ criteria: null }), lead())).toBe(true);
  });

  it('a named list requires a member of it', () => {
    expect(ruleMatches(rule({ criteria: { industry: ['Legal', 'Healthcare'] } }), lead())).toBe(
      true,
    );
    expect(ruleMatches(rule({ criteria: { industry: ['Healthcare'] } }), lead())).toBe(false);
    // Case and padding do not decide a routing rule.
    expect(ruleMatches(rule({ criteria: { industry: ['  legal '] } }), lead())).toBe(true);
  });

  it('a range is a claim about a number, so a lead without one does not satisfy it', () => {
    expect(ruleMatches(rule({ criteria: { leadScore: { min: 70 } } }), lead())).toBe(true);
    expect(ruleMatches(rule({ criteria: { leadScore: { min: 90 } } }), lead())).toBe(false);
    expect(
      ruleMatches(rule({ criteria: { leadScore: { min: 70 } } }), lead({ leadScore: null })),
    ).toBe(false);
    expect(ruleMatches(rule({ criteria: { dealSize: { min: 1000, max: 50000 } } }), lead())).toBe(
      true,
    );
    expect(ruleMatches(rule({ criteria: { dealSize: { max: 1000 } } }), lead())).toBe(false);
  });

  it('geography narrows on any of the four levels', () => {
    expect(ruleMatches(rule({ criteria: { geography: { states: ['WA', 'OR'] } } }), lead())).toBe(
      true,
    );
    expect(ruleMatches(rule({ criteria: { geography: { states: ['CA'] } } }), lead())).toBe(false);
    expect(ruleMatches(rule({ criteria: { geography: { zipCodes: ['98101'] } } }), lead())).toBe(
      true,
    );
  });

  it('every criterion must hold, not just one', () => {
    const strict = rule({
      criteria: { industry: ['Legal'], leadScore: { min: 90 } },
    });
    expect(ruleMatches(strict, lead())).toBe(false);
    const failed = evaluateCriteria(strict.criteria, lead())
      .filter((c) => !c.matched)
      .map((c) => c.criterion);
    expect(failed).toEqual(['leadScore']);
  });

  it('an inactive rule never matches', () => {
    expect(ruleMatches(rule({ is_active: false }), lead())).toBe(false);
  });
});

describe('which rule wins', () => {
  it('the HIGHEST priority matching rule, which is the opposite of the old order', () => {
    // lead_assignment_rules.priority says "Higher priority = evaluated first" in
    // its own comment, and the handler ordered ascending. On the day the table
    // existed the lowest-priority rule would have won every lead.
    const selection = selectRule(
      [
        rule({ id: 'low', priority: 1 }),
        rule({ id: 'high', priority: 500 }),
        rule({ id: 'mid', priority: 100 }),
      ],
      lead(),
    );
    expect(selection.rule?.id).toBe('high');
  });

  it('skips a higher-priority rule whose criteria do not match', () => {
    const selection = selectRule(
      [
        rule({ id: 'specific', priority: 500, criteria: { industry: ['Healthcare'] } }),
        rule({ id: 'catch-all', priority: 10, criteria: {} }),
      ],
      lead(),
    );
    expect(selection.rule?.id).toBe('catch-all');
    // And says why the first was passed over, so an admin is not left guessing.
    expect(selection.considered).toEqual([
      { ruleId: 'specific', ruleName: 'Enterprise legal', failed: ['industry'] },
    ]);
  });

  it('breaks ties deterministically', () => {
    // Without this the winner depends on the order PostgREST happened to return,
    // and a rep would see leads move between rules for no reason.
    const rules = [rule({ id: 'b', priority: 100 }), rule({ id: 'a', priority: 100 })];
    expect(selectRule(rules, lead()).rule?.id).toBe('a');
    expect(selectRule([...rules].reverse(), lead()).rule?.id).toBe('a');
  });

  it('returns nothing rather than a default when no rule matches', () => {
    const selection = selectRule([rule({ criteria: { industry: ['Healthcare'] } })], lead());
    expect(selection.rule).toBeNull();
    expect(selection.considered).toHaveLength(1);
  });

  it('an empty rule set matches nothing', () => {
    expect(selectRule([], lead()).rule).toBeNull();
  });
});

describe('who the rule assigns to', () => {
  it('a named user', () => {
    expect(resolveAssignee(rule({ assign_to_user_id: 'rep-7' }))).toEqual({ userId: 'rep-7' });
  });

  it('round robin advances, and wraps', () => {
    const pool = {
      assign_to_user_id: null,
      round_robin_config: { userIds: ['a', 'b', 'c'], currentIndex: 2 },
    };
    expect(resolveAssignee(rule(pool))).toEqual({ userId: 'c', nextRoundRobinIndex: 0 });
    expect(
      resolveAssignee(
        rule({ ...pool, round_robin_config: { userIds: ['a', 'b'], currentIndex: 5 } }),
      ),
    ).toEqual({ userId: 'b', nextRoundRobinIndex: 0 });
  });

  it('a team rule assigns nobody, and says so', () => {
    // business_records holds an owner, not a team. Writing a team id into the rep
    // field would put a team where every other surface expects a person.
    const choice = resolveAssignee(rule({ assign_to_user_id: null, assign_to_team: 'team-1' }));
    expect(choice.userId).toBeNull();
    expect(choice.reason).toContain('team');
  });

  it('a territory rule likewise, and a rule naming nothing at all', () => {
    expect(
      resolveAssignee(rule({ assign_to_user_id: null, territory_id: 't-1' })).reason,
    ).toContain('territory');
    expect(resolveAssignee(rule({ assign_to_user_id: null })).reason).toContain('names no user');
  });
});

describe('the table is real, and it is the one that already existed', () => {
  const columns = new Set(Object.values(getTableColumns(leadAssignmentRules)).map((c) => c.name));

  it('lead_assignment_rules carries every column the handler reads', () => {
    for (const col of [
      'rule_name',
      'criteria',
      'assignment_type',
      'assign_to_user_id',
      'assign_to_team',
      'territory_id',
      'round_robin_config',
      'priority',
      'is_active',
      'assignments_count',
      'last_assigned_at',
    ]) {
      expect(columns.has(col)).toBe(true);
    }
  });

  it('and migration 0000 creates it', () => {
    const sql = readFileSync('drizzle/migrations/0000_fuzzy_blizzard.sql', 'utf8');
    expect(sql).toContain('CREATE TABLE "lead_assignment_rules"');
  });

  it('no phantom table is left behind, and none was created to replace it', () => {
    const handler = strip(readFileSync('supabase/functions/auto-lead-routing/index.ts', 'utf8'));
    expect(handler).not.toContain("from('lead_routing_rules')");
    expect(handler).toContain("const RULES_TABLE = 'lead_assignment_rules'");
    // A second rules table would have entrenched the duplicate model.
    const schema = readFileSync('shared/lead-assignment-schema.ts', 'utf8');
    expect(schema).not.toContain('lead_routing_rules');
    expect(readFileSync('docs/phantom-tables-baseline.json', 'utf8')).not.toContain(
      'lead_routing_rules',
    );
  });
});

describe('the handler and the editor', () => {
  const handler = strip(readFileSync('supabase/functions/auto-lead-routing/index.ts', 'utf8'));

  it('the 503 branch is gone', () => {
    expect(handler).not.toContain('ROUTING_RULES_UNAVAILABLE');
    expect(handler).not.toContain('routingRulesUnavailable');
  });

  it('/route evaluates the criteria instead of taking rules[0]', () => {
    expect(handler).toContain('selectRule((rules ?? []) as LeadRoutingRule[], lead)');
    expect(handler).toContain('conditionsEvaluated: true');
    expect(handler).not.toContain('(rules ?? [])[0]');
  });

  it('/rules/:id is routed BEFORE the list branch', () => {
    // It used to sit after a branch testing only endpoint === 'rules', so every
    // request for one rule answered with the whole list at 200.
    const single = handler.indexOf("endpoint === 'rules' && ruleId");
    const list = handler.indexOf("req.method === 'GET' && endpoint === 'rules') {");
    expect(single).toBeGreaterThan(-1);
    expect(single).toBeLessThan(list);
  });

  it('writes only columns the table has', () => {
    // `...body` used to be spread straight into the update, so a camelCase field
    // from any caller failed the whole write.
    expect(handler).toContain('fromRoutingRule(body)');
    expect(handler).not.toMatch(/update\(\{ \.\.\.body/);
  });

  it('the dashboard can create and delete a rule', () => {
    const page = readFileSync('client/src/pages/AutoLeadRoutingDashboard.tsx', 'utf8');
    expect(page).toContain("queryKey: ['/api/auto-lead-routing/rules']");
    expect(page).toContain("apiRequest('/api/auto-lead-routing/rules', 'POST'");
    expect(page).toContain('/api/auto-lead-routing/rules/${id}');
    // An empty input means "do not constrain", not zero.
    expect(page).toContain(
      'if (draft.minScore.trim()) criteria.leadScore = { min: Number(draft.minScore) };',
    );
  });
});
