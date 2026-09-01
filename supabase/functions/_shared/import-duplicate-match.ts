// CSV import duplicate matching.
//
// PA-052: the import function's execute path already matched incoming rows
// against existing `companies` - name + city + state, falling back to
// name + phone - and merged into whatever it found, SILENTLY. The review step
// that is supposed to ask first was stubbed: validation set
// duplicates_detected: 0 unconditionally, GET /duplicates returned an empty
// list, POST /duplicates/resolve-all answered "Duplicates resolved" without
// doing anything, and POST /duplicates/:id/resolve had no branch at all.
//
// The rule lives here so detection and execute cannot drift. If they disagree,
// the user reviews one set of duplicates and the import merges a different one,
// which is worse than not asking.

export interface CandidateRow {
  businessName: string;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
}

export interface MatchingField {
  field: string;
  incomingValue: string;
  existingValue: string;
}

export interface DuplicateMatch {
  existing: Record<string, any>;
  matchScore: number;
  matchingFields: MatchingField[];
}

const norm = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .trim();
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/**
 * Pick the best match for an incoming row among candidates already fetched by
 * name. Returns null when nothing matches beyond the name alone - a shared
 * company name is not a duplicate, which is why name-only never scores.
 */
export function findDuplicate(
  row: CandidateRow,
  candidates: Record<string, any>[],
): DuplicateMatch | null {
  const name = norm(row.businessName);
  const city = norm(row.city);
  const state = norm(row.state);
  const phone = digits(row.phone);

  for (const existing of candidates) {
    if (norm(existing.business_name) !== name) continue;

    // Name + city + state, the execute path's primary rule.
    if (
      city &&
      state &&
      norm(existing.billing_city) === city &&
      norm(existing.billing_state) === state
    ) {
      return {
        existing,
        matchScore: 95,
        matchingFields: [
          {
            field: 'businessName',
            incomingValue: row.businessName,
            existingValue: existing.business_name,
          },
          {
            field: 'city',
            incomingValue: String(row.city),
            existingValue: String(existing.billing_city),
          },
          {
            field: 'state',
            incomingValue: String(row.state),
            existingValue: String(existing.billing_state),
          },
        ],
      };
    }
  }

  // Fallback: name + phone, same as execute.
  if (phone) {
    for (const existing of candidates) {
      if (norm(existing.business_name) !== name) continue;
      if (existing.phone && digits(existing.phone) === phone) {
        return {
          existing,
          matchScore: 85,
          matchingFields: [
            {
              field: 'businessName',
              incomingValue: row.businessName,
              existingValue: existing.business_name,
            },
            {
              field: 'phone',
              incomingValue: String(row.phone),
              existingValue: String(existing.phone),
            },
          ],
        };
      }
    }
  }

  return null;
}

export const DUPLICATE_RESOLUTIONS = ['skip', 'merge', 'create_new', 'pending'];
