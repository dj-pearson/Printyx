/**
 * Deleting a platform business record (round 212).
 *
 * Every table that references platform_business_records declares ON DELETE
 * CASCADE - deals, contacts, activities, BANT, health scores, churn
 * predictions, renewal opportunities, success interventions, lead scores and
 * the lead-assignment history. So the single-row Delete, confirmed with only
 * "Delete <name>?", silently took the account's whole deal pipeline and
 * activity trail with it, and answered success for an id that matched nothing.
 *
 * A record that still has deals, contacts or activities is REFUSED, naming the
 * counts, the way the territory delete in the same function refuses while
 * rules still reference it. Those three are what someone would be sorry to
 * lose; the derived rows (scores, predictions) are recomputed from them.
 * Emptying an account first is the deliberate path to deleting it.
 */

export const MAX_BULK_DELETE = 200;

export interface DependentCounts {
  deals: number;
  contacts: number;
  activities: number;
}

export interface BlockedRecord extends DependentCounts {
  id: string;
  name: string;
}

export interface DeletionPlan {
  /** Ids that exist and have nothing depending on them. */
  deletable: string[];
  /** Ids that exist but still have deals, contacts or activities. */
  blocked: BlockedRecord[];
  /** Ids that matched no record. */
  missing: string[];
  error?: string;
}

export function planRecordDeletion(input: {
  recordIds: unknown;
  found: { id: string; company_name?: string | null }[];
  /** business_record_id of every dependent row, per table. */
  dependents: { deals: string[]; contacts: string[]; activities: string[] };
}): DeletionPlan {
  const ids = Array.isArray(input.recordIds)
    ? [
        ...new Set(
          input.recordIds.filter((v): v is string => typeof v === 'string' && v.length > 0),
        ),
      ]
    : [];
  if (ids.length === 0) {
    return { deletable: [], blocked: [], missing: [], error: 'Select at least one record' };
  }
  if (ids.length > MAX_BULK_DELETE) {
    return {
      deletable: [],
      blocked: [],
      missing: [],
      error: `At most ${MAX_BULK_DELETE} records can be deleted at once; ${ids.length} were selected`,
    };
  }
  const tally = (list: string[]) => {
    const m = new Map<string, number>();
    for (const id of list) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  };
  const deals = tally(input.dependents.deals);
  const contacts = tally(input.dependents.contacts);
  const activities = tally(input.dependents.activities);
  const byId = new Map(input.found.map((r) => [r.id, r]));

  const plan: DeletionPlan = { deletable: [], blocked: [], missing: [] };
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) {
      plan.missing.push(id);
      continue;
    }
    const counts = {
      deals: deals.get(id) ?? 0,
      contacts: contacts.get(id) ?? 0,
      activities: activities.get(id) ?? 0,
    };
    if (counts.deals + counts.contacts + counts.activities > 0) {
      plan.blocked.push({ id, name: row.company_name?.trim() || id, ...counts });
    } else {
      plan.deletable.push(id);
    }
  }
  return plan;
}

/** "3 deals, 1 contact" - the reason a record was kept, for a person to read. */
export function describeDependents(c: DependentCounts): string {
  const part = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : '');
  return [
    part(c.deals, 'deal', 'deals'),
    part(c.contacts, 'contact', 'contacts'),
    part(c.activities, 'activity', 'activities'),
  ]
    .filter(Boolean)
    .join(', ');
}

/** The toast for a bulk delete: what went, what was kept and why, what was gone already. */
export function bulkDeleteMessage(r: {
  deleted: string[];
  blocked: BlockedRecord[];
  missing: string[];
}): { title: string; description: string; destructive: boolean } {
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? '' : 's'}`;
  const parts: string[] = [];
  if (r.deleted.length) parts.push(`Deleted ${n(r.deleted.length, 'record')}.`);
  if (r.blocked.length) {
    const first = r.blocked
      .slice(0, 3)
      .map((b) => `${b.name} (${describeDependents(b)})`)
      .join('; ');
    const more = r.blocked.length > 3 ? ` and ${r.blocked.length - 3} more` : '';
    parts.push(
      `Kept ${n(r.blocked.length, 'record')} that still ${r.blocked.length === 1 ? 'has' : 'have'} deals, contacts or activities: ${first}${more}.`,
    );
  }
  if (r.missing.length) parts.push(`${n(r.missing.length, 'record')} no longer existed.`);
  return {
    title:
      r.deleted.length === 0
        ? 'Nothing deleted'
        : r.blocked.length || r.missing.length
          ? 'Some records kept'
          : 'Deleted',
    description: parts.join(' ') || 'No records were selected.',
    destructive: r.deleted.length === 0 || r.blocked.length > 0,
  };
}
