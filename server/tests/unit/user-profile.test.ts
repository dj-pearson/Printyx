// COP-M01: ten edge functions addressed `users` as if it had name, full_name,
// status, phone, job_title, department, timezone, locale, avatar_url,
// activated_at and deactivated_at. It has none of them. /user/profile therefore
// could not save, and every read fell back to whatever the JWT carried.
//
// The mapping is shared and pinned here because the fields with no column live
// in users.metadata — a partial update that clobbered the rest of that jsonb
// would be a silent data loss, not a visible error.
import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';

import { users } from '@shared/schema';
import {
  buildUserProfileUpdate,
  displayName,
  fullName,
  METADATA_PROFILE_FIELDS,
  splitName,
  toUserProfile,
  USER_NAME_COLUMNS,
  USER_PROFILE_COLUMNS,
} from '../../../supabase/functions/_shared/user-profile';

const columns = new Set(Object.values(getTableColumns(users) as any).map((c: any) => c.name));

describe('the column lists address real columns', () => {
  it.each([
    ['USER_PROFILE_COLUMNS', USER_PROFILE_COLUMNS],
    ['USER_NAME_COLUMNS', USER_NAME_COLUMNS],
  ])('%s', (_name, list) => {
    for (const column of list.split(',').map((c) => c.trim())) {
      expect(columns.has(column)).toBe(true);
    }
  });

  it('confirms the names these replaced are not columns', () => {
    for (const phantom of [
      'name',
      'full_name',
      'status',
      'phone',
      'job_title',
      'department',
      'timezone',
      'locale',
      'avatar_url',
      'activated_at',
      'deactivated_at',
    ]) {
      expect(columns.has(phantom)).toBe(false);
    }
  });

  it('confirms metadata exists, since the fields with no column live there', () => {
    expect(columns.has('metadata')).toBe(true);
    expect(METADATA_PROFILE_FIELDS.length).toBeGreaterThan(0);
  });
});

describe('fullName / displayName', () => {
  it('joins the halves', () => {
    expect(fullName({ first_name: 'Rosa', last_name: 'Alvarez' })).toBe('Rosa Alvarez');
  });

  it('uses whichever half exists', () => {
    expect(fullName({ first_name: 'Rosa' })).toBe('Rosa');
    expect(fullName({ last_name: 'Alvarez' })).toBe('Alvarez');
  });

  it('is empty when neither does, and displayName supplies the label', () => {
    expect(fullName({})).toBe('');
    expect(fullName(null)).toBe('');
    expect(displayName({})).toBe('Unknown');
    expect(displayName(null, 'Unassigned')).toBe('Unassigned');
  });

  it('never renders the literal "null"', () => {
    expect(fullName({ first_name: null, last_name: undefined })).toBe('');
  });
});

describe('splitName', () => {
  it.each([
    ['Rosa Alvarez', { first_name: 'Rosa', last_name: 'Alvarez' }],
    ['Rosa', { first_name: 'Rosa', last_name: '' }],
    ['Rosa de la Cruz', { first_name: 'Rosa', last_name: 'de la Cruz' }],
    ['  Rosa   Alvarez  ', { first_name: 'Rosa', last_name: 'Alvarez' }],
    ['', { first_name: '', last_name: '' }],
    ['   ', { first_name: '', last_name: '' }],
  ])('splitName(%j)', (input, expected) => {
    expect(splitName(input)).toEqual(expected);
  });
});

describe('toUserProfile', () => {
  const row = {
    id: 'u-1',
    email: 'rosa@example.com',
    first_name: 'Rosa',
    last_name: 'Alvarez',
    profile_image_url: 'https://example.com/a.png',
    is_active: true,
    metadata: { phone: '515-555-0134', jobTitle: 'Service Manager', timezone: 'America/Chicago' },
  };

  it('reads the real columns and the metadata fields together', () => {
    expect(toUserProfile(row)).toEqual({
      id: 'u-1',
      email: 'rosa@example.com',
      firstName: 'Rosa',
      lastName: 'Alvarez',
      name: 'Rosa Alvarez',
      avatarUrl: 'https://example.com/a.png',
      isActive: true,
      phone: '515-555-0134',
      jobTitle: 'Service Manager',
      department: '',
      timezone: 'America/Chicago',
      locale: '',
    });
  });

  it('returns empty strings rather than undefined for absent fields', () => {
    const profile = toUserProfile({ id: 'u-2' });
    expect(profile.phone).toBe('');
    expect(profile.jobTitle).toBe('');
    expect(profile.avatarUrl).toBe('');
    expect(profile.name).toBe('');
  });

  it('treats a missing is_active as active, matching the column default', () => {
    expect(toUserProfile({ id: 'u-3' }).isActive).toBe(true);
    expect(toUserProfile({ id: 'u-3', is_active: false }).isActive).toBe(false);
  });

  it('tolerates a null metadata', () => {
    expect(toUserProfile({ id: 'u-4', metadata: null }).phone).toBe('');
  });
});

describe('buildUserProfileUpdate', () => {
  it('writes nothing for an empty body, so a no-op PUT cannot blank a profile', () => {
    expect(buildUserProfileUpdate({}, { phone: '515-555-0134' })).toEqual({});
  });

  it('maps the name halves to the real columns', () => {
    expect(buildUserProfileUpdate({ firstName: 'Rosa', lastName: 'Alvarez' }, null)).toEqual({
      first_name: 'Rosa',
      last_name: 'Alvarez',
    });
  });

  it('splits a single name field when the halves are absent', () => {
    expect(buildUserProfileUpdate({ name: 'Rosa Alvarez' }, null)).toEqual({
      first_name: 'Rosa',
      last_name: 'Alvarez',
    });
  });

  it('lets the explicit halves win over a single name field', () => {
    expect(buildUserProfileUpdate({ name: 'Ignored Entirely', firstName: 'Rosa' }, null)).toEqual({
      first_name: 'Rosa',
    });
  });

  it('accepts either casing for the avatar', () => {
    expect(buildUserProfileUpdate({ avatarUrl: 'a.png' }, null)).toEqual({
      profile_image_url: 'a.png',
    });
    expect(buildUserProfileUpdate({ avatar_url: 'a.png' }, null)).toEqual({
      profile_image_url: 'a.png',
    });
  });

  // The one that matters: metadata is a single jsonb column, so a partial write
  // has to merge or it silently deletes the fields it did not mention.
  it('merges metadata rather than replacing it', () => {
    expect(
      buildUserProfileUpdate({ phone: '515-555-9999' }, { timezone: 'America/Chicago' }),
    ).toEqual({
      metadata: { timezone: 'America/Chicago', phone: '515-555-9999' },
    });
  });

  it('leaves metadata alone entirely when no metadata field was sent', () => {
    const update = buildUserProfileUpdate({ firstName: 'Rosa' }, { phone: '515-555-0134' });
    expect(update).not.toHaveProperty('metadata');
  });

  it('clears a metadata field when it is explicitly emptied', () => {
    expect(buildUserProfileUpdate({ phone: '' }, { phone: '515', timezone: 'UTC' })).toEqual({
      metadata: { timezone: 'UTC' },
    });
    expect(buildUserProfileUpdate({ phone: null }, { phone: '515' })).toEqual({ metadata: {} });
  });

  it('accepts snake_case for the metadata fields too', () => {
    expect(buildUserProfileUpdate({ job_title: 'Tech' }, null)).toEqual({
      metadata: { jobTitle: 'Tech' },
    });
  });

  it('never emits a column the users table does not have', () => {
    const update = buildUserProfileUpdate(
      {
        name: 'Rosa Alvarez',
        avatarUrl: 'a.png',
        phone: '515',
        jobTitle: 'Tech',
        department: 'Service',
        timezone: 'UTC',
        locale: 'en',
      },
      null,
    );
    for (const key of Object.keys(update)) {
      expect(columns.has(key)).toBe(true);
    }
  });
});
