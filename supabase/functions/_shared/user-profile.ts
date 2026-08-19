/**
 * Reading and writing a user profile (COP-M01).
 *
 * Ten edge functions addressed the `users` table as if it had name, full_name,
 * status, phone, job_title, department, timezone, locale, avatar_url,
 * activated_at and deactivated_at. It has none of those. The real shape is:
 *
 *   first_name, last_name          (not name / full_name)
 *   profile_image_url              (not avatar_url)
 *   is_active                      (not status)
 *   metadata jsonb                 (the only place the rest can live)
 *
 * So /user/profile could not save, and every read fell back to whatever the JWT
 * carried.
 *
 * WHY metadata AND NOT NEW COLUMNS: phone, job title, department, timezone and
 * locale genuinely have nowhere to go, and adding columns means a migration —
 * which COP-M00 records as currently broken (the meta snapshots are 22 behind
 * the journal, so `db:generate` emits ~151 statements of drift and collides on
 * the filename). `users.metadata` is a real jsonb column that exists today, so
 * the profile works now and can be promoted to real columns later without the
 * API changing shape.
 */

/** Columns to select for anything that renders a person's name or profile. */
export const USER_PROFILE_COLUMNS =
  'id, email, first_name, last_name, profile_image_url, is_active, metadata, tenant_id, role_id, last_login_at, created_at, updated_at';

/** Just the identity columns, for a list that only needs a name. */
export const USER_NAME_COLUMNS = 'id, first_name, last_name';

/** The profile fields that live in users.metadata because no column exists. */
export const METADATA_PROFILE_FIELDS = [
  'phone',
  'jobTitle',
  'department',
  'timezone',
  'locale',
] as const;

export type MetadataProfileField = (typeof METADATA_PROFILE_FIELDS)[number];

export interface UserRow {
  id?: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile_image_url?: string | null;
  is_active?: boolean | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

/** first + last, whichever is present; '' when neither is. */
export function fullName(user: UserRow | null | undefined): string {
  return [user?.first_name, user?.last_name]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** first + last, or a stated fallback — for a label that must not be blank. */
export function displayName(user: UserRow | null | undefined, fallback = 'Unknown'): string {
  return fullName(user) || fallback;
}

function metadataValue(user: UserRow | null | undefined, key: string): string {
  const value = (user?.metadata ?? {})[key];
  return value === null || value === undefined ? '' : String(value);
}

/** The camelCase profile the settings page reads. */
export function toUserProfile(user: UserRow | null | undefined) {
  return {
    id: user?.id,
    email: user?.email ?? '',
    firstName: String(user?.first_name ?? ''),
    lastName: String(user?.last_name ?? ''),
    name: fullName(user),
    avatarUrl: user?.profile_image_url ?? '',
    isActive: user?.is_active !== false,
    phone: metadataValue(user, 'phone'),
    jobTitle: metadataValue(user, 'jobTitle'),
    department: metadataValue(user, 'department'),
    timezone: metadataValue(user, 'timezone'),
    locale: metadataValue(user, 'locale'),
  };
}

/** Split a submitted single-field name into first and last. */
export function splitName(name: string): { first_name: string; last_name: string } {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    first_name: parts[0] ?? '',
    last_name: parts.slice(1).join(' '),
  };
}

/**
 * Turn a profile PUT body into a users-table update.
 *
 * Accepts camelCase and snake_case for each field, since callers send both.
 * Returns only the keys the body actually set — an absent field must not be
 * blanked. `metadata` is MERGED over what the row already holds, so updating a
 * phone number cannot wipe someone's timezone.
 */
export function buildUserProfileUpdate(
  body: Record<string, unknown>,
  existingMetadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  const first = body.firstName ?? body.first_name;
  const last = body.lastName ?? body.last_name;
  if (first !== undefined) update.first_name = String(first ?? '');
  if (last !== undefined) update.last_name = String(last ?? '');

  // A single `name` only applies where the caller did not send the halves.
  if (body.name !== undefined && first === undefined && last === undefined) {
    Object.assign(update, splitName(String(body.name ?? '')));
  }

  const avatar =
    body.avatarUrl ?? body.avatar_url ?? body.profileImageUrl ?? body.profile_image_url;
  if (avatar !== undefined) update.profile_image_url = avatar === null ? null : String(avatar);

  const metadata: Record<string, unknown> = { ...(existingMetadata ?? {}) };
  let touchedMetadata = false;
  for (const field of METADATA_PROFILE_FIELDS) {
    const snake = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    const value = body[field] ?? body[snake];
    if (value === undefined) continue;
    touchedMetadata = true;
    if (value === null || value === '') delete metadata[field];
    else metadata[field] = String(value);
  }
  if (touchedMetadata) update.metadata = metadata;

  return update;
}
