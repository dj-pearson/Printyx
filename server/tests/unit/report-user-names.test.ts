// COP-M01: four report query modules selected `users.name`. There is no name
// column — the table has first_name and last_name — and each of those queries
// throws on error, so every report that needed a rep or technician name 500'd
// rather than degrading to "Unknown".
//
// The composition is shared so the four call sites cannot drift on what
// "Unknown" means or on how a half-filled name renders.
import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';

import { users } from '@shared/schema';
import {
  USER_NAME_COLUMNS,
  userDisplayName,
} from '../../../supabase/functions/reports/_queries/user-names';

describe('USER_NAME_COLUMNS', () => {
  it('asks only for columns the users table has', () => {
    const columns = new Set(Object.values(getTableColumns(users) as any).map((c: any) => c.name));
    for (const column of USER_NAME_COLUMNS.split(',').map((c) => c.trim())) {
      expect(columns.has(column)).toBe(true);
    }
  });

  it('confirms the column it replaced does not exist', () => {
    const columns = new Set(Object.values(getTableColumns(users) as any).map((c: any) => c.name));
    expect(columns.has('name')).toBe(false);
    expect(columns.has('full_name')).toBe(false);
  });
});

describe('userDisplayName', () => {
  it('joins first and last', () => {
    expect(userDisplayName({ first_name: 'Rosa', last_name: 'Alvarez' })).toBe('Rosa Alvarez');
  });

  it('uses whichever half is present', () => {
    expect(userDisplayName({ first_name: 'Rosa', last_name: null })).toBe('Rosa');
    expect(userDisplayName({ first_name: null, last_name: 'Alvarez' })).toBe('Alvarez');
  });

  it('trims, so a padded column does not render with stray spaces', () => {
    expect(userDisplayName({ first_name: '  Rosa  ', last_name: ' Alvarez ' })).toBe(
      'Rosa Alvarez',
    );
    expect(userDisplayName({ first_name: '   ', last_name: 'Alvarez' })).toBe('Alvarez');
  });

  it('falls back to Unknown rather than an empty label', () => {
    expect(userDisplayName({})).toBe('Unknown');
    expect(userDisplayName(null)).toBe('Unknown');
    expect(userDisplayName(undefined)).toBe('Unknown');
    expect(userDisplayName({ first_name: '', last_name: '' })).toBe('Unknown');
    expect(userDisplayName({ first_name: '  ', last_name: null })).toBe('Unknown');
  });

  it('never returns the literal "null" or "undefined"', () => {
    expect(userDisplayName({ first_name: null, last_name: undefined })).toBe('Unknown');
    expect(userDisplayName({ first_name: 'Rosa', last_name: undefined })).toBe('Rosa');
  });
});
