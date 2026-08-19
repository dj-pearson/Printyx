/**
 * Field readers shared by the CRM record pages (COP-M01).
 *
 * Every CRM detail page reads a row that may arrive in either casing: Express
 * returns camelCase Drizzle rows, the edge functions return raw PostgREST
 * snake_case ones, and some edge handlers map on read but not on write. Rather
 * than each page guessing which it got, reads go through pick(), which takes the
 * candidate keys in order.
 *
 * Extracted from CompanyDetail.tsx, which had grown its own copy; ContactDetail
 * needed the same four helpers, and a second copy is how the two drift.
 */

export type RawRecord = Record<string, unknown>;

/** First key that holds a non-empty value, as a string. */
export function pick(row: RawRecord | undefined, ...keys: string[]): string | null {
  if (!row) return null;
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return null;
}

/** First key that holds a boolean. Accepts the string 'true', which is what a
 *  form-encoded round trip produces. */
export function pickBool(row: RawRecord | undefined, ...keys: string[]): boolean {
  if (!row) return false;
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'boolean') return v;
    if (v === 'true') return true;
  }
  return false;
}

/** First key that holds an array of rows (a PostgREST embedded join). */
export function pickList(row: RawRecord | undefined, ...keys: string[]): RawRecord[] {
  if (!row) return [];
  for (const k of keys) {
    const v = row[k];
    if (Array.isArray(v)) return v as RawRecord[];
  }
  return [];
}

/**
 * First key that holds a list of strings.
 *
 * company_contacts.contact_roles and .preferred_channels are JSON arrays stored
 * in text columns, so the value is a string on one path and already parsed on
 * another. A malformed value returns an empty list rather than throwing: a bad
 * row should not take the page down. Null entries are dropped rather than
 * stringified — String(null) is 'null', which survives a filter(Boolean) and
 * renders as the literal word in the UI.
 */
function toStringList(items: unknown[]): string[] {
  return items
    .map((item) => (item === null || item === undefined ? '' : String(item)))
    .filter(Boolean);
}

export function pickJsonArray(row: RawRecord | undefined, ...keys: string[]): string[] {
  if (!row) return [];
  for (const k of keys) {
    const v = row[k];
    if (Array.isArray(v)) return toStringList(v);
    if (typeof v === 'string' && v.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return toStringList(parsed);
      } catch {
        // fall through to the next candidate key
      }
    }
  }
  return [];
}

/**
 * Join a `<prefix>Address / City / State / Zip` group into a printable block.
 *
 * Returns null when nothing in the group is set, so the caller can drop the
 * field rather than render an empty label.
 */
export function formatRecordAddress(row: RawRecord | undefined, prefix: string): string | null {
  const street = pick(row, `${prefix}Address`, `${prefix}_address`);
  const city = pick(row, `${prefix}City`, `${prefix}_city`);
  const state = pick(row, `${prefix}State`, `${prefix}_state`);
  const zip = pick(row, `${prefix}Zip`, `${prefix}_zip`);
  const cityLine = [[city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(' ').trim();
  const parts = [street, cityLine].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length ? parts.join('\n') : null;
}
