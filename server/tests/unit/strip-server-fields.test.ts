import { describe, it, expect } from 'vitest';
import { stripServerFields } from '../../utils/strip-server-fields';

describe('stripServerFields (CR-008 over-posting guard)', () => {
  it('removes server-controlled columns from a request body', () => {
    const body = {
      name: 'Widget',
      id: 'attacker-chosen-id',
      tenantId: 'other-tenant',
      createdBy: 'someone-else',
      createdAt: '2000-01-01',
      updatedAt: '2000-01-01',
    };
    const out = stripServerFields(body);
    expect(out).toEqual({ name: 'Widget' });
    expect(out).not.toHaveProperty('id');
    expect(out).not.toHaveProperty('tenantId');
    expect(out).not.toHaveProperty('createdBy');
  });

  it('leaves a clean body untouched', () => {
    expect(stripServerFields({ title: 'x', amount: 5 })).toEqual({ title: 'x', amount: 5 });
  });

  it('handles an empty object', () => {
    expect(stripServerFields({})).toEqual({});
  });
});
