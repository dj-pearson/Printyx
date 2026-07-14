/**
 * CRMX-011: admin hook for web forms CRUD + submissions.
 * Backed by /api/web-forms (server/routes-web-forms.ts).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export type WebFormFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'number'
  | 'url';

export interface WebFormField {
  key: string;
  label: string;
  type: WebFormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  mapTo?: string;
  order: number;
}

export interface WebFormSettings {
  submitButtonText?: string;
  successMessage?: string;
  redirectUrl?: string;
  notifyEmails?: string[];
  defaultOwnerId?: string;
  leadSource?: string;
  autoresponderWorkflowId?: string;
}

export interface WebForm {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  fields: WebFormField[];
  settings: WebFormSettings | null;
  publicToken: string;
  submissionCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebFormSubmission {
  id: string;
  formId: string;
  businessRecordId: string | null;
  payload: Record<string, unknown>;
  utm: Record<string, string> | null;
  status: 'new' | 'processing' | 'processed' | 'duplicate' | 'spam' | 'error';
  dedupedToExisting: boolean;
  processingError: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface WebFormInput {
  name: string;
  description?: string | null;
  status?: 'draft' | 'published' | 'archived';
  fields?: WebFormField[];
  settings?: WebFormSettings | null;
  isActive?: boolean;
}

export function useWebForms() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/web-forms'] });

  const {
    data: forms = [],
    isLoading,
    isError,
  } = useQuery<WebForm[]>({
    queryKey: ['/api/web-forms'],
    queryFn: async () => (await apiRequest('/api/web-forms')) as WebForm[],
    staleTime: 30_000,
  });

  const createForm = useMutation({
    mutationFn: async (data: WebFormInput) => apiRequest('/api/web-forms', 'POST', data),
    onSuccess: invalidate,
  });

  const updateForm = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<WebFormInput>) =>
      apiRequest(`/api/web-forms/${id}`, 'PUT', data),
    onSuccess: invalidate,
  });

  const deleteForm = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/web-forms/${id}`, 'DELETE'),
    onSuccess: invalidate,
  });

  return { forms, isLoading, isError, createForm, updateForm, deleteForm };
}

export function useWebForm(id: string | undefined) {
  return useQuery<WebForm>({
    queryKey: ['/api/web-forms', id],
    queryFn: async () => (await apiRequest(`/api/web-forms/${id}`)) as WebForm,
    enabled: !!id,
  });
}

export function useWebFormSubmissions(id: string | undefined) {
  return useQuery<WebFormSubmission[]>({
    queryKey: ['/api/web-forms', id, 'submissions'],
    queryFn: async () =>
      (await apiRequest(`/api/web-forms/${id}/submissions`)) as WebFormSubmission[],
    enabled: !!id,
  });
}
