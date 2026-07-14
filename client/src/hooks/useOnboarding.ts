/**
 * CRMX-014: durable "Getting Started" onboarding progress (per-tenant + per-user).
 * Backed by /api/onboarding/getting-started (server/routes-onboarding.ts →
 * onboarding_progress table). Resumable across sessions.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface GettingStartedState {
  completedSteps: string[];
  isComplete: boolean;
}

export function useOnboarding(totalSteps?: number) {
  const queryClient = useQueryClient();
  const queryKey = ['/api/onboarding/getting-started'];

  const query = useQuery<GettingStartedState>({
    queryKey,
    queryFn: async () =>
      (await apiRequest('/api/onboarding/getting-started')) as GettingStartedState,
    staleTime: 30_000,
  });

  const save = useMutation({
    mutationFn: async (next: GettingStartedState) =>
      apiRequest('/api/onboarding/getting-started', 'POST', next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<GettingStartedState>(queryKey);
      queryClient.setQueryData(queryKey, next);
      return { prev };
    },
    onError: (_e, _next, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const completed = query.data?.completedSteps ?? [];

  const toggleStep = (stepId: string) => {
    const set = new Set(completed);
    if (set.has(stepId)) set.delete(stepId);
    else set.add(stepId);
    const completedSteps = Array.from(set);
    const isComplete = totalSteps != null && completedSteps.length >= totalSteps;
    save.mutate({ completedSteps, isComplete });
  };

  return {
    completedSteps: completed,
    isComplete: query.data?.isComplete ?? false,
    isLoading: query.isLoading,
    toggleStep,
    isSaving: save.isPending,
  };
}
