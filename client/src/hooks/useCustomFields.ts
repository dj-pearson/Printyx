/**
 * Hook for CRM custom field definitions (CRMX-004).
 * Fetches + manages custom_field_definitions via /api/custom-fields.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export type CustomFieldObjectType = 'deals' | 'leads' | 'contacts' | 'companies';

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'url'
  | 'email';

export interface CustomFieldOption {
  value: string;
  label: string;
}

export interface CustomFieldDefinition {
  id: string;
  tenantId: string;
  objectType: CustomFieldObjectType;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options: CustomFieldOption[] | null;
  required: boolean;
  defaultValue: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldInput {
  objectType: CustomFieldObjectType;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options?: CustomFieldOption[] | null;
  required?: boolean;
  defaultValue?: string | null;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * @param objectType filter to one object type; omit for all.
 * @param includeInactive include deactivated defs (admin management view).
 */
export function useCustomFields(objectType?: CustomFieldObjectType, includeInactive = false) {
  const queryClient = useQueryClient();
  const queryKey = ['/api/custom-fields', objectType ?? 'all', includeInactive];

  const {
    data: fields = [],
    isLoading,
    isError,
  } = useQuery<CustomFieldDefinition[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (objectType) params.set('objectType', objectType);
      if (includeInactive) params.set('includeInactive', 'true');
      const qs = params.toString();
      const result = await apiRequest(`/api/custom-fields${qs ? `?${qs}` : ''}`);
      // Endpoint returns { data, total }
      return result?.data ?? [];
    },
    staleTime: 60_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/custom-fields'] });

  const createField = useMutation({
    mutationFn: async (data: CustomFieldInput) => apiRequest('/api/custom-fields', 'POST', data),
    onSuccess: invalidate,
  });

  const updateField = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CustomFieldInput>) =>
      apiRequest(`/api/custom-fields/${id}`, 'PATCH', data),
    onSuccess: invalidate,
  });

  const deleteField = useMutation({
    mutationFn: async ({ id, hard = false }: { id: string; hard?: boolean }) =>
      apiRequest(`/api/custom-fields/${id}${hard ? '?hard=true' : ''}`, 'DELETE'),
    onSuccess: invalidate,
  });

  return { fields, isLoading, isError, createField, updateField, deleteField };
}
