import { describe, it, expect } from 'vitest';
import {
  createSavedViewBodySchema,
  updateSavedViewBodySchema,
  filterConditionSchema,
  SAVED_VIEW_OBJECT_TYPES,
  SAVED_VIEW_VISIBILITIES,
  type SavedView,
} from '../../../shared/saved-views-schema';

// Mirror of the access rules in server/routes-saved-views.ts (kept pure for testing)
function canAccessView(view: SavedView, userId: string): boolean {
  return view.isSystem || view.userId === userId || view.visibility !== 'private';
}

function canManageView(view: SavedView, userId: string, admin: boolean): boolean {
  return admin || view.userId === userId;
}

function buildView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: 'view-1',
    tenantId: 'tenant-a',
    userId: 'user-1',
    objectType: 'deals',
    name: 'Test View',
    description: null,
    filterDefinition: [],
    sortConfig: null,
    columnConfig: null,
    boardConfig: null,
    visibility: 'private',
    isDefault: false,
    isPinned: false,
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SavedView;
}

describe('saved views - create body schema', () => {
  it('accepts a minimal valid view', () => {
    const result = createSavedViewBodySchema.safeParse({
      objectType: 'deals',
      name: 'High Value Deals',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visibility).toBe('private');
      expect(result.data.filterDefinition).toEqual([]);
      expect(result.data.isDefault).toBe(false);
    }
  });

  it('accepts a full view with filters and sort', () => {
    const result = createSavedViewBodySchema.safeParse({
      objectType: 'leads',
      name: 'Hot Leads',
      description: 'Leads over 10k',
      filterDefinition: [
        { field: 'status', operator: 'eq', value: 'active' },
        { field: 'amount', operator: 'gte', value: 10000, conjunction: 'AND' },
      ],
      sortConfig: { field: 'createdAt', direction: 'desc' },
      visibility: 'team',
      isDefault: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown objectType', () => {
    const result = createSavedViewBodySchema.safeParse({
      objectType: 'invoices',
      name: 'Bad Type',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = createSavedViewBodySchema.safeParse({ objectType: 'deals', name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid visibility', () => {
    const result = createSavedViewBodySchema.safeParse({
      objectType: 'deals',
      name: 'View',
      visibility: 'public',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid filter operator', () => {
    const result = createSavedViewBodySchema.safeParse({
      objectType: 'deals',
      name: 'View',
      filterDefinition: [{ field: 'status', operator: 'like', value: 'x' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid sort direction', () => {
    const result = createSavedViewBodySchema.safeParse({
      objectType: 'deals',
      name: 'View',
      sortConfig: { field: 'amount', direction: 'down' },
    });
    expect(result.success).toBe(false);
  });

  it('covers all four CRM object types', () => {
    expect([...SAVED_VIEW_OBJECT_TYPES]).toEqual(['deals', 'leads', 'contacts', 'companies']);
    for (const objectType of SAVED_VIEW_OBJECT_TYPES) {
      expect(createSavedViewBodySchema.safeParse({ objectType, name: 'V' }).success).toBe(true);
    }
  });

  it('covers all three visibility levels', () => {
    expect([...SAVED_VIEW_VISIBILITIES]).toEqual(['private', 'team', 'everyone']);
  });
});

describe('saved views - update body schema', () => {
  it('accepts a partial update', () => {
    const result = updateSavedViewBodySchema.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty update', () => {
    const result = updateSavedViewBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('does not allow changing objectType', () => {
    const result = updateSavedViewBodySchema.safeParse({ objectType: 'leads' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('objectType' in result.data).toBe(false);
    }
  });

  it('rejects invalid filter conditions on update', () => {
    const result = updateSavedViewBodySchema.safeParse({
      filterDefinition: [{ operator: 'eq' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('saved views - filter condition schema', () => {
  it('accepts conditions without a value (isEmpty)', () => {
    const result = filterConditionSchema.safeParse({ field: 'email', operator: 'isEmpty' });
    expect(result.success).toBe(true);
  });

  it('accepts OR conjunction', () => {
    const result = filterConditionSchema.safeParse({
      field: 'stage',
      operator: 'isAny',
      value: ['a', 'b'],
      conjunction: 'OR',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing field', () => {
    const result = filterConditionSchema.safeParse({ operator: 'eq', value: 1 });
    expect(result.success).toBe(false);
  });
});

describe('saved views - access rules', () => {
  it('owner can access their private view', () => {
    expect(canAccessView(buildView({ userId: 'user-1' }), 'user-1')).toBe(true);
  });

  it('other users cannot access a private view', () => {
    expect(canAccessView(buildView({ userId: 'user-1' }), 'user-2')).toBe(false);
  });

  it('team and everyone visibility are accessible to other users', () => {
    expect(canAccessView(buildView({ visibility: 'team' }), 'user-2')).toBe(true);
    expect(canAccessView(buildView({ visibility: 'everyone' }), 'user-2')).toBe(true);
  });

  it('system views are accessible to everyone', () => {
    expect(canAccessView(buildView({ userId: null, isSystem: true }), 'user-2')).toBe(true);
  });

  it('only the owner or an admin can manage a view', () => {
    const view = buildView({ userId: 'user-1' });
    expect(canManageView(view, 'user-1', false)).toBe(true);
    expect(canManageView(view, 'user-2', false)).toBe(false);
    expect(canManageView(view, 'user-2', true)).toBe(true);
  });

  it('system views (no owner) can only be managed by admins', () => {
    const view = buildView({ userId: null, isSystem: true });
    expect(canManageView(view, 'user-1', false)).toBe(false);
    expect(canManageView(view, 'user-1', true)).toBe(true);
  });
});
