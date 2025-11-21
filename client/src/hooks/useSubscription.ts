import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Subscription Hook
 *
 * Manages subscription state and operations throughout the app.
 */

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: string;
  annualPrice: string;
  annualDiscount: number;
  maxUsers: number;
  maxStorage: number;
  maxApiCalls: number;
  maxLocations: number;
  maxBusinessRecords: number;
  trialEnabled: boolean;
  trialDays: number;
  features: string[];
  isPopular: boolean;
  displayOrder: number;
}

export interface SubscriptionFeature {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  isCore: boolean;
}

export interface SubscriptionStatus {
  hasSubscription: boolean;
  subscription?: {
    id: string;
    status: string;
    billingCycle: string;
    amount: string;
    isTrialing: boolean;
    trialEndDate?: string;
    currentPeriodEnd: string;
    isFree: boolean;
  };
  plan?: SubscriptionPlan;
  usage?: {
    users: number;
    storage: number;
    apiCalls: number;
    locations: number;
    businessRecords: number;
  };
  limits?: {
    users: number;
    storage: number;
    apiCalls: number;
    locations: number;
    businessRecords: number;
  };
  isOverLimit?: boolean;
  overageDetails?: Record<string, number>;
  daysUntilRenewal?: number;
  isTrialing?: boolean;
  trialDaysRemaining?: number;
  features?: string[];
}

/**
 * Fetch current subscription status
 */
export function useSubscription() {
  return useQuery<SubscriptionStatus>({
    queryKey: ['subscription', 'current'],
    queryFn: async () => {
      const response = await fetch('/api/subscriptions/current', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch available subscription plans
 */
export function useSubscriptionPlans() {
  return useQuery<{ plans: SubscriptionPlan[]; features: SubscriptionFeature[] }>({
    queryKey: ['subscription', 'plans'],
    queryFn: async () => {
      const response = await fetch('/api/subscriptions/plans');

      if (!response.ok) {
        throw new Error('Failed to fetch plans');
      }

      return response.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes (plans change rarely)
  });
}

/**
 * Fetch usage statistics
 */
export function useUsageStats() {
  return useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: async () => {
      const response = await fetch('/api/subscriptions/usage', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch usage');
      }

      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

/**
 * Fetch subscription notifications
 */
export function useSubscriptionNotifications() {
  return useQuery({
    queryKey: ['subscription', 'notifications'],
    queryFn: async () => {
      const response = await fetch('/api/subscriptions/notifications', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      return response.json();
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Create a new subscription
 */
export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      planSlug: string;
      billingCycle: 'monthly' | 'annual';
      startTrial?: boolean;
      discountCode?: string;
    }) => {
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create subscription');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

/**
 * Upgrade/downgrade subscription
 */
export function useUpgradeSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      newPlanSlug: string;
      billingCycle?: 'monthly' | 'annual';
      immediate?: boolean;
    }) => {
      const response = await fetch('/api/subscriptions/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upgrade subscription');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

/**
 * Cancel subscription
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (immediate: boolean = false) => {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediate }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel subscription');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

/**
 * Convert trial to paid
 */
export function useConvertTrial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentMethodId?: string) => {
      const response = await fetch('/api/subscriptions/convert-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to convert trial');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

/**
 * Dismiss notification
 */
export function useDismissNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/subscriptions/notifications/${notificationId}/dismiss`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss notification');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', 'notifications'] });
    },
  });
}

/**
 * Check if tenant has a specific feature
 */
export function useHasFeature(featureSlug: string) {
  const { data: subscription } = useSubscription();

  return {
    hasFeature: subscription?.features?.includes(featureSlug) || subscription?.subscription?.isFree || false,
    isLoading: !subscription,
  };
}

/**
 * Get usage percentage for a specific metric
 */
export function useUsagePercentage(metric: 'users' | 'storage' | 'apiCalls' | 'locations' | 'businessRecords') {
  const { data: subscription } = useSubscription();

  if (!subscription?.usage || !subscription?.limits) {
    return 0;
  }

  const usage = subscription.usage[metric];
  const limit = subscription.limits[metric];

  // -1 means unlimited
  if (limit === -1) {
    return 0;
  }

  // For storage, convert MB to GB for display
  if (metric === 'storage') {
    return Math.min(100, (usage / (limit * 1024)) * 100);
  }

  return Math.min(100, (usage / limit) * 100);
}
