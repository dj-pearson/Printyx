// COP-M01: the CRM record pages read rows that arrive in either casing —
// camelCase from Express/Drizzle, snake_case from PostgREST — and some edge
// handlers map on read but not on write. These readers are what keeps a detail
// page from rendering blank against one backend and fine against the other, so
// they are worth pinning.
import { describe, it, expect } from 'vitest';

import { formatRecordAddress, pick, pickBool, pickJsonArray, pickList } from './record-fields';

describe('pick', () => {
  it('takes the first candidate key that has a value', () => {
    expect(pick({ firstName: 'Rosa' }, 'firstName', 'first_name')).toBe('Rosa');
    expect(pick({ first_name: 'Rosa' }, 'firstName', 'first_name')).toBe('Rosa');
  });

  it('prefers the earlier key when both are present', () => {
    expect(pick({ firstName: 'camel', first_name: 'snake' }, 'firstName', 'first_name')).toBe(
      'camel',
    );
  });

  it('skips null, undefined and empty string rather than returning them', () => {
    expect(pick({ a: null, b: undefined, c: '', d: 'value' }, 'a', 'b', 'c', 'd')).toBe('value');
  });

  it('returns null when nothing matches, or when there is no row', () => {
    expect(pick({ other: 'x' }, 'firstName')).toBeNull();
    expect(pick(undefined, 'firstName')).toBeNull();
    expect(pick({}, 'firstName')).toBeNull();
  });

  it('stringifies non-strings so a numeric column still renders', () => {
    expect(pick({ employeeCount: 42 }, 'employeeCount')).toBe('42');
  });

  it('keeps a literal zero, which is a value and not an absence', () => {
    expect(pick({ count: 0 }, 'count')).toBe('0');
  });

  it('keeps false, for the same reason', () => {
    expect(pick({ flag: false }, 'flag')).toBe('false');
  });
});

describe('pickBool', () => {
  it('reads either casing', () => {
    expect(pickBool({ isPrimaryContact: true }, 'isPrimaryContact', 'is_primary_contact')).toBe(
      true,
    );
    expect(pickBool({ is_primary_contact: true }, 'isPrimaryContact', 'is_primary_contact')).toBe(
      true,
    );
  });

  it('accepts the string "true" from a form round trip', () => {
    expect(pickBool({ flag: 'true' }, 'flag')).toBe(true);
  });

  it('does not treat other truthy values as true', () => {
    expect(pickBool({ flag: 'yes' }, 'flag')).toBe(false);
    expect(pickBool({ flag: 1 }, 'flag')).toBe(false);
  });

  it('is false for absent, false, and no row', () => {
    expect(pickBool({ flag: false }, 'flag')).toBe(false);
    expect(pickBool({}, 'flag')).toBe(false);
    expect(pickBool(undefined, 'flag')).toBe(false);
  });

  it('keeps looking past a non-boolean key', () => {
    expect(pickBool({ a: 'no', b: true }, 'a', 'b')).toBe(true);
  });
});

describe('pickList', () => {
  it('returns an embedded join under either key', () => {
    const rows = [{ id: '1' }];
    expect(pickList({ companyContacts: rows }, 'companyContacts', 'company_contacts')).toEqual(
      rows,
    );
    expect(pickList({ company_contacts: rows }, 'companyContacts', 'company_contacts')).toEqual(
      rows,
    );
  });

  it('is an empty array when absent, not undefined', () => {
    expect(pickList({}, 'companyContacts')).toEqual([]);
    expect(pickList(undefined, 'companyContacts')).toEqual([]);
  });

  it('ignores a non-array value under a matching key', () => {
    expect(pickList({ companyContacts: 'nope' }, 'companyContacts')).toEqual([]);
  });
});

describe('pickJsonArray', () => {
  // contact_roles and preferred_channels are JSON arrays in text columns, so
  // the value is a string on one path and already parsed on another.
  it('parses a JSON array held in a text column', () => {
    expect(
      pickJsonArray({ contact_roles: '["Decision Maker","Billing"]' }, 'contact_roles'),
    ).toEqual(['Decision Maker', 'Billing']);
  });

  it('passes through an already-parsed array', () => {
    expect(pickJsonArray({ contactRoles: ['Billing'] }, 'contactRoles', 'contact_roles')).toEqual([
      'Billing',
    ]);
  });

  it('drops empty entries', () => {
    expect(pickJsonArray({ roles: '["Billing","",null]' }, 'roles')).toEqual(['Billing']);
  });

  it('returns an empty list for malformed JSON instead of throwing', () => {
    expect(pickJsonArray({ roles: '[not json' }, 'roles')).toEqual([]);
  });

  it('returns an empty list for a non-array JSON value', () => {
    expect(pickJsonArray({ roles: '["a"]x' }, 'roles')).toEqual([]);
    expect(pickJsonArray({ roles: '{"a":1}' }, 'roles')).toEqual([]);
  });

  it('ignores a plain string that is not a JSON array', () => {
    expect(pickJsonArray({ roles: 'Billing' }, 'roles')).toEqual([]);
  });

  it('is empty for absent keys and no row', () => {
    expect(pickJsonArray({}, 'roles')).toEqual([]);
    expect(pickJsonArray(undefined, 'roles')).toEqual([]);
  });

  it('stringifies non-string entries', () => {
    expect(pickJsonArray({ roles: [1, 2] }, 'roles')).toEqual(['1', '2']);
  });
});

describe('formatRecordAddress', () => {
  it('builds street then city, state zip', () => {
    expect(
      formatRecordAddress(
        {
          mailingAddress: '400 Locust St',
          mailingCity: 'Des Moines',
          mailingState: 'IA',
          mailingZip: '50309',
        },
        'mailing',
      ),
    ).toBe('400 Locust St\nDes Moines, IA 50309');
  });

  it('reads snake_case columns too', () => {
    expect(
      formatRecordAddress(
        { billing_address: '1 Main', billing_city: 'Ames', billing_state: 'IA' },
        'billing',
      ),
    ).toBe('1 Main\nAmes, IA');
  });

  it('omits the parts that are missing rather than leaving separators', () => {
    expect(formatRecordAddress({ mailingCity: 'Ames', mailingZip: '50010' }, 'mailing')).toBe(
      'Ames 50010',
    );
    expect(formatRecordAddress({ mailingAddress: '1 Main' }, 'mailing')).toBe('1 Main');
  });

  it('returns null when the whole group is empty, so the caller can drop the field', () => {
    expect(formatRecordAddress({}, 'mailing')).toBeNull();
    expect(formatRecordAddress(undefined, 'mailing')).toBeNull();
    expect(formatRecordAddress({ mailingAddress: '', mailingCity: null }, 'mailing')).toBeNull();
  });

  it('does not bleed one prefix into another', () => {
    const row = { mailingCity: 'Ames', otherCity: 'Boone' };
    expect(formatRecordAddress(row, 'mailing')).toBe('Ames');
    expect(formatRecordAddress(row, 'other')).toBe('Boone');
  });
});
