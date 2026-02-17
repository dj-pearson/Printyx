/**
 * Hook for managing CRM saved views.
 * Provides CRUD operations and state management for saved view tabs.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { CrmObjectType } from '@/lib/crm-object-registry';

export interface SavedViewData {
  id: string;
  tenantId: string;
  userId: string;
  objectType: string;
  name: string;
  filterDefinition: Array<{ field: string; operator: string; value: any; conjunction?: 'AND' | 'OR' }> | null;
  sortConfig: { field: string; direction: 'asc' | 'desc' } | null;
  columnConfig: Array<{ field: string; label: string; visible: boolean; width?: number; order: number }> | null;
  boardConfig: {
    cardFields?: Array<{ field: string; label: string; position: number; format?: string }>;
    columnTotals?: 'sum' | 'count' | 'weighted' | 'average' | 'none';
    groupBy?: string;
  } | null;
  visibility: 'private' | 'team' | 'everyone';
  isDefault: boolean | null;
  isSystemView: boolean | null;
  isPinned: boolean;
  pinSortOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export function useSavedViews(objectType: CrmObjectType) {
  const queryClient = useQueryClient();
  const queryKey = ['/api/saved-views', objectType];

  const { data: views = [], isLoading } = useQuery<SavedViewData[]>({
    queryKey,
    queryFn: async () => {
      const result = await apiRequest(`/api/saved-views?objectType=${objectType}`);
      return result ?? [];
    },
    staleTime: 60_000,
  });

  const createView = useMutation({
    mutationFn: async (data: {
      name: string;
      objectType: CrmObjectType;
      filterDefinition?: any;
      sortConfig?: any;
      columnConfig?: any;
      boardConfig?: any;
      visibility?: 'private' | 'team' | 'everyone';
    }) => {
      return apiRequest('/api/saved-views', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateView = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      return apiRequest(`/api/saved-views/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/saved-views/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const cloneView = useMutation({
    mutationFn: async ({ id, name }: { id: string; name?: string }) => {
      return apiRequest(`/api/saved-views/${id}/clone`, 'POST', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const pinView = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/saved-views/${id}/pin`, 'PUT');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const unpinView = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/saved-views/${id}/unpin`, 'PUT');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Get pinned views sorted by pin order
  const pinnedViews = views
    .filter((v) => v.isPinned)
    .sort((a, b) => (a.pinSortOrder ?? 0) - (b.pinSortOrder ?? 0));

  // Get default view
  const defaultView = views.find((v) => v.isDefault);

  return {
    views,
    pinnedViews,
    defaultView,
    isLoading,
    createView,
    updateView,
    deleteView,
    cloneView,
    pinView,
    unpinView,
  };
}
