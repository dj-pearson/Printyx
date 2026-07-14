/**
 * Hook for first-class CRM notes on any record (CRMX-006).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export type CrmRecordType = 'deal' | 'lead' | 'contact' | 'company';

export interface CrmNote {
  id: string;
  tenantId: string;
  parentType: CrmRecordType;
  parentId: string;
  body: string;
  isPinned: boolean;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useCrmNotes(parentType: CrmRecordType, parentId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['/api/crm/notes', parentType, parentId];

  const {
    data: notes = [],
    isLoading,
    isError,
  } = useQuery<CrmNote[]>({
    queryKey,
    enabled: Boolean(parentId),
    queryFn: async () => {
      const result = await apiRequest(
        `/api/crm/notes?parentType=${parentType}&parentId=${parentId}`,
      );
      return result?.data ?? [];
    },
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/crm/notes'] });

  const addNote = useMutation({
    mutationFn: async (body: string) =>
      apiRequest('/api/crm/notes', 'POST', { parentType, parentId, body }),
    onSuccess: invalidate,
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; body?: string; isPinned?: boolean }) =>
      apiRequest(`/api/crm/notes/${id}`, 'PATCH', data),
    onSuccess: invalidate,
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/crm/notes/${id}`, 'DELETE'),
    onSuccess: invalidate,
  });

  return { notes, isLoading, isError, addNote, updateNote, deleteNote };
}
