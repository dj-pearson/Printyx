/**
 * Reading a user's display name (COP-M01).
 *
 * Four report query modules selected `users.name`. There is no name column: the
 * table has first_name and last_name (shared/schema.ts). Each of those queries
 * throws on error, so every report that needed a rep or technician name 500'd
 * rather than degrading.
 *
 * The composition lives here so the four call sites cannot drift on what
 * "Unknown" means or on how a half-filled name is rendered.
 */

export const USER_NAME_COLUMNS = 'id, first_name, last_name';

export interface UserNameColumns {
  first_name?: string | null;
  last_name?: string | null;
}

/** first + last, whichever is present. 'Unknown' when neither is. */
export function userDisplayName(user: UserNameColumns | null | undefined): string {
  const name = [user?.first_name, user?.last_name]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return name || 'Unknown';
}
