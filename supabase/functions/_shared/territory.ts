/**
 * Territory resolution and roll-up (COP-B09).
 *
 * Pure. Copier sales is territory-run, `sales_territories` has existed all
 * along with full CRUD on both hosts, and nothing called it: no UI, no proxy
 * entry, no client reference anywhere. Meanwhile accounts carry
 * `business_records.territory` - a free-text varchar holding whatever the
 * E-Automate import or a rep typed.
 *
 * RESOLUTION, NOT MIGRATION - the same call COP-B10 made for competitors, for
 * the same reason. Rewriting that column to a foreign key means a migration
 * deciding, unreviewed, that 'North', 'northern' and 'N. Region' are one
 * territory, and destroying the original text if it decides wrong. Instead the
 * territory's CODE and NAME are matched against the stored string at read time
 * through one normalizer, so defining a territory immediately claims every
 * account that names it and nothing is overwritten. An account whose text
 * matches nothing shows up in a coverage report an admin can act on, which is
 * a smaller and more visible failure than a silently mis-assigned account.
 *
 * WHY COVERAGE IS REPORTED RATHER THAN ASSUMED. A territory model that silently
 * drops unmatched accounts gives a manager a roll-up that looks complete and is
 * not. `territoryCoverage` counts what resolved, what did not, and what carries
 * no territory at all, and every roll-up carries an explicit UNASSIGNED bucket
 * rather than omitting those rows.
 */

export interface TerritoryLike {
  id: string;
  territory_name?: string | null;
  territory_code?: string | null;
  is_active?: boolean | null;
  [key: string]: unknown;
}

/**
 * 'N. Region' -> 'nregion'. Lowercase, drop punctuation, collapse whitespace
 * away, so the spellings an import and a rep produce land on one key.
 *
 * Deliberately NOT stripping words like 'region' or 'territory': 'North' and
 * 'North Region' may genuinely be two territories in a dealer that has both,
 * and merging them is the mistake this whole file exists to avoid. An alias is
 * the escape hatch, and it is explicit.
 */
export function normalizeTerritoryKey(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** key -> territory, from both the code and the name, so either spelling hits. */
export function buildTerritoryIndex(territories: TerritoryLike[]): Map<string, TerritoryLike> {
  const index = new Map<string, TerritoryLike>();
  // Names first, codes second: a CODE is the deliberate identifier, so when a
  // code collides with another territory's name the code wins.
  for (const t of territories ?? []) {
    const key = normalizeTerritoryKey(t.territory_name);
    if (key && !index.has(key)) index.set(key, t);
  }
  for (const t of territories ?? []) {
    const key = normalizeTerritoryKey(t.territory_code);
    if (key) index.set(key, t);
  }
  return index;
}

export interface ResolvedTerritory {
  /** What the account actually says, preserved. */
  raw: string;
  key: string;
  territory: TerritoryLike | null;
  /** The territory's name when it resolved, else the account's own text. */
  displayName: string;
}

export function resolveTerritory(
  raw: string | null | undefined,
  index: Map<string, TerritoryLike>,
): ResolvedTerritory | null {
  const text = String(raw ?? '').trim();
  const key = normalizeTerritoryKey(text);
  if (!key) return null;
  const territory = index.get(key) ?? null;
  return { raw: text, key, territory, displayName: territory?.territory_name ?? text };
}

export interface TerritoryCoverage {
  /** Accounts whose territory text resolved to a defined territory. */
  resolved: number;
  /** Accounts naming a territory that matches no definition. The worklist. */
  unmatched: Array<{ key: string; name: string; count: number }>;
  /** Accounts carrying no territory at all. Different from unmatched. */
  unassigned: number;
  total: number;
}

/**
 * How much of the book a territory model actually covers.
 *
 * "Names a territory nobody defined" and "names no territory" are counted
 * SEPARATELY because they need different fixes: the first is a definition or
 * an alias, the second is data entry.
 */
export function territoryCoverage(
  accounts: Array<{ territory?: string | null }>,
  index: Map<string, TerritoryLike>,
): TerritoryCoverage {
  let resolved = 0;
  let unassigned = 0;
  const unmatched = new Map<string, { key: string; name: string; count: number }>();

  for (const account of accounts ?? []) {
    const r = resolveTerritory(account.territory, index);
    if (!r) {
      unassigned += 1;
      continue;
    }
    if (r.territory) {
      resolved += 1;
      continue;
    }
    const entry = unmatched.get(r.key);
    if (entry) entry.count += 1;
    else unmatched.set(r.key, { key: r.key, name: r.raw, count: 1 });
  }

  return {
    resolved,
    unassigned,
    total: (accounts ?? []).length,
    unmatched: [...unmatched.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    ),
  };
}

/** The bucket rows with no resolvable territory fall into. Never omitted. */
export const UNASSIGNED_TERRITORY = '__unassigned__';

export interface TerritoryRollupRow<T> {
  territoryId: string;
  territoryName: string;
  items: T[];
}

/**
 * Group anything that carries an account territory, keeping an explicit
 * UNASSIGNED row.
 *
 * Omitting unassigned rows is how a territory roll-up quietly stops adding up
 * to the total a manager sees everywhere else - the numbers disagree and
 * nothing says why.
 */
export function rollupByTerritory<T>(
  items: T[],
  territoryOf: (item: T) => string | null | undefined,
  index: Map<string, TerritoryLike>,
): Array<TerritoryRollupRow<T>> {
  const groups = new Map<string, TerritoryRollupRow<T>>();

  for (const item of items ?? []) {
    const r = resolveTerritory(territoryOf(item), index);
    const id = r?.territory ? String(r.territory.id) : UNASSIGNED_TERRITORY;
    const name = r?.territory
      ? String(r.territory.territory_name ?? 'Unnamed territory')
      : r
        ? // Names a territory nobody defined - shown under its own text rather
          // than swept into Unassigned, because those are different problems.
          r.raw
        : 'Unassigned';
    const key = r?.territory ? id : r ? `raw:${r.key}` : UNASSIGNED_TERRITORY;

    let group = groups.get(key);
    if (!group) {
      group = { territoryId: id, territoryName: name, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  return [...groups.values()].sort((a, b) => {
    // Unassigned sorts last: it is a data-quality row, not a territory.
    if (a.territoryId === UNASSIGNED_TERRITORY) return 1;
    if (b.territoryId === UNASSIGNED_TERRITORY) return -1;
    return b.items.length - a.items.length || a.territoryName.localeCompare(b.territoryName);
  });
}
