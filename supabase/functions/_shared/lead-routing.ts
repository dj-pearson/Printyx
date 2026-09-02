/**
 * Which rule routes a lead, and to whom (WF-S-02).
 *
 * TWO THINGS WERE WRONG, and the second is the one that matters.
 *
 * `lead_routing_rules` was named by supabase/functions/auto-lead-routing and by
 * NOTHING ELSE in the repository - no Drizzle schema, no migration, no RLS file,
 * no seeder. Every read of it was a 42P01, which EDGE-002g had already caught
 * once when the same file answered with two hardcoded "sample rules". The table
 * this story was filed to create ALREADY EXISTS under another name:
 * `lead_assignment_rules`, declared in shared/lead-assignment-schema.ts, created
 * by migration 0000, and served by server/routes-lead-assignment.ts. Creating a
 * fifth near-duplicate would have entrenched the second model rather than
 * removing it, so the edge function is repointed at the real table instead - the
 * same call CRMX-002 and WF-C-06 made.
 *
 * AND NOTHING MATCHED. The /route handler took `rules[0]` and said so in a
 * comment: the loop that once stood there broke on its first iteration, so the
 * "matching engine" was first-wins with the conditions ignored. A lead about a
 * $400 toner order and a lead about a fifty-machine fleet went to the same rep.
 * This module evaluates the criteria the table actually declares.
 *
 * TWO RULES:
 *
 * PRIORITY IS HIGHEST-FIRST, which is what lead_assignment_rules.priority says
 * in its own comment. The edge function ordered ascending, so on the day the
 * table existed the LOWEST-priority rule would have won every lead.
 *
 * AN EMPTY CRITERION MATCHES EVERYTHING; AN UNMET ONE MATCHES NOTHING. A rule
 * that names no industries is not a rule that matches no industries - it is a
 * rule that does not care. Getting this backwards makes every catch-all rule
 * dead and every lead unrouted.
 */

export interface LeadRoutingRule {
  id: string;
  rule_name?: string | null;
  assignment_type?: string | null;
  criteria?: LeadCriteria | null;
  territory_id?: string | null;
  assign_to_user_id?: string | null;
  assign_to_team?: string | null;
  round_robin_config?: {
    userIds?: string[];
    currentIndex?: number;
  } | null;
  priority?: number | null;
  is_active?: boolean | null;
}

export interface LeadCriteria {
  leadSource?: string[];
  leadScore?: { min?: number; max?: number };
  industry?: string[];
  companySize?: { min?: number; max?: number };
  dealSize?: { min?: number; max?: number };
  geography?: {
    countries?: string[];
    states?: string[];
    cities?: string[];
    zipCodes?: string[];
  };
  productInterest?: string[];
}

/** The lead fields the criteria can be evaluated against. */
export interface RoutableLead {
  leadSource?: string | null;
  leadScore?: number | string | null;
  industry?: string | null;
  employeeCount?: number | string | null;
  estimatedAmount?: number | string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
  productInterest?: string | string[] | null;
}

const norm = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
};

/** An empty list does not constrain; a non-empty one requires a member. */
function listMatches(allowed: string[] | undefined, value: unknown): boolean {
  if (!allowed || allowed.length === 0) return true;
  const v = norm(value);
  if (!v) return false;
  return allowed.some((a) => norm(a) === v);
}

function rangeMatches(range: { min?: number; max?: number } | undefined, value: unknown): boolean {
  if (!range || (range.min === undefined && range.max === undefined)) return true;
  const n = num(value);
  // A range is a claim about a number. A lead with no number does not satisfy it.
  if (n === null) return false;
  if (range.min !== undefined && n < range.min) return false;
  if (range.max !== undefined && n > range.max) return false;
  return true;
}

export interface CriterionResult {
  criterion: string;
  matched: boolean;
}

/** Every criterion, evaluated and named - so a rule that did not fire says why. */
export function evaluateCriteria(
  criteria: LeadCriteria | null | undefined,
  lead: RoutableLead,
): CriterionResult[] {
  const c = criteria ?? {};
  const productInterest = Array.isArray(lead.productInterest)
    ? lead.productInterest
    : lead.productInterest
      ? [lead.productInterest]
      : [];

  return [
    { criterion: 'leadSource', matched: listMatches(c.leadSource, lead.leadSource) },
    { criterion: 'industry', matched: listMatches(c.industry, lead.industry) },
    { criterion: 'leadScore', matched: rangeMatches(c.leadScore, lead.leadScore) },
    { criterion: 'companySize', matched: rangeMatches(c.companySize, lead.employeeCount) },
    { criterion: 'dealSize', matched: rangeMatches(c.dealSize, lead.estimatedAmount) },
    {
      criterion: 'geography.countries',
      matched: listMatches(c.geography?.countries, lead.country),
    },
    { criterion: 'geography.states', matched: listMatches(c.geography?.states, lead.state) },
    { criterion: 'geography.cities', matched: listMatches(c.geography?.cities, lead.city) },
    {
      criterion: 'geography.zipCodes',
      matched: listMatches(c.geography?.zipCodes, lead.postalCode),
    },
    {
      criterion: 'productInterest',
      matched:
        !c.productInterest || c.productInterest.length === 0
          ? true
          : productInterest.some((p) => listMatches(c.productInterest, p)),
    },
  ];
}

export function ruleMatches(rule: LeadRoutingRule, lead: RoutableLead): boolean {
  if (rule.is_active === false) return false;
  return evaluateCriteria(rule.criteria, lead).every((r) => r.matched);
}

export interface RuleSelection {
  rule: LeadRoutingRule | null;
  /** Why each rule that did not win was passed over. */
  considered: Array<{ ruleId: string; ruleName: string | null; failed: string[] }>;
}

/**
 * The highest-priority ACTIVE rule whose criteria all match.
 *
 * Ties break on rule id so the same lead routes the same way twice; without it
 * two equal-priority rules would depend on the order PostgREST happened to
 * return, and a rep would see leads move between them for no reason.
 */
export function selectRule(rules: LeadRoutingRule[], lead: RoutableLead): RuleSelection {
  const considered: RuleSelection['considered'] = [];
  const active = (rules ?? [])
    .filter((r) => r.is_active !== false)
    .sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || String(a.id).localeCompare(String(b.id)),
    );

  for (const rule of active) {
    const failed = evaluateCriteria(rule.criteria, lead)
      .filter((r) => !r.matched)
      .map((r) => r.criterion);
    if (failed.length === 0) return { rule, considered };
    considered.push({ ruleId: rule.id, ruleName: rule.rule_name ?? null, failed });
  }
  return { rule: null, considered };
}

export interface AssigneeChoice {
  userId: string | null;
  /** Present when no user could be chosen; safe to show a human. */
  reason?: string;
  /** The index to store back on a round-robin rule, when one advanced. */
  nextRoundRobinIndex?: number;
}

/**
 * Who the matched rule assigns to.
 *
 * A TEAM ASSIGNMENT IS NOT A USER ASSIGNMENT. business_records has owner_id and
 * assigned_sales_rep and no team column, so writing a team id into the rep field
 * would put a team where every other surface expects a person. That case is
 * reported, which is the behaviour the pre-existing handler already chose.
 */
export function resolveAssignee(rule: LeadRoutingRule): AssigneeChoice {
  if (rule.assign_to_user_id) return { userId: rule.assign_to_user_id };

  const pool = rule.round_robin_config?.userIds ?? [];
  if (pool.length > 0) {
    const index = Math.max(0, Math.floor(rule.round_robin_config?.currentIndex ?? 0)) % pool.length;
    return { userId: pool[index], nextRoundRobinIndex: (index + 1) % pool.length };
  }

  if (rule.assign_to_team) {
    return {
      userId: null,
      reason: `rule ${rule.rule_name ?? rule.id} assigns to a team, and a lead record holds an owner, not a team`,
    };
  }
  if (rule.territory_id) {
    return {
      userId: null,
      reason: `rule ${rule.rule_name ?? rule.id} assigns by territory, which resolves to a rep only once territories carry members`,
    };
  }
  return {
    userId: null,
    reason: `rule ${rule.rule_name ?? rule.id} names no user, round-robin pool, team or territory`,
  };
}
