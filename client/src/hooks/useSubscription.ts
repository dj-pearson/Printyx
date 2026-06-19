import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

/**
 * Subscription Hook
 *
 * Manages subscription state and operations throughout the app.
 *
 * EDGE-002c: all calls go through `apiRequest` (getApiUrl + Bearer JWT + tenant
 * header) rather than raw `fetch(..., { credentials: 'include' })`. This is what
 * edge-routes them in production (functions.printyx.net/subscriptions/*) and lets
 * the dev `/api/subscriptions` proxy forward an Authorization header to the edge
 * function — raw cookie-only fetches would 401 against the JWT-gated edge fn.
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
    queryFn: () => apiRequest('/api/subscriptions/current'),
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
    queryFn: () => apiRequest('/api/subscriptions/plans'),
    staleTime: 30 * 60 * 1000, // 30 minutes (plans change rarely)
  });
}

/**
 * Fetch usage statistics
 */
export function useUsageStats() {
  return useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: () => apiRequest('/api/subscriptions/usage'),
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
    queryFn: () => apiRequest('/api/subscriptions/notifications'),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Create a new subscription
 */
export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      planSlug: string;
      billingCycle: 'monthly' | 'annual';
      startTrial?: boolean;
      discountCode?: string;
    }) => apiRequest('/api/subscriptions/create', 'POST', data),
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
    mutationFn: (data: {
      newPlanSlug: string;
      billingCycle?: 'monthly' | 'annual';
      immediate?: boolean;
    }) => apiRequest('/api/subscriptions/upgrade', 'POST', data),
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
    mutationFn: (immediate: boolean = false) =>
      apiRequest('/api/subscriptions/cancel', 'POST', { immediate }),
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
    mutationFn: (paymentMethodId?: string) =>
      apiRequest('/api/subscriptions/convert-trial', 'POST', { paymentMethodId }),
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
    mutationFn: (notificationId: string) =>
      apiRequest(`/api/subscriptions/notifications/${notificationId}/dismiss`, 'POST'),
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
    hasFeature:
      subscription?.features?.includes(featureSlug) || subscription?.subscription?.isFree || false,
    isLoading: !subscription,
  };
}

/**
 * Get usage percentage for a specific metric
 */
export function useUsagePercentage(
  metric: 'users' | 'storage' | 'apiCalls' | 'locations' | 'businessRecords',
) {
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

// ============================================================================
// STRIPE CHECKOUT & PORTAL HOOKS
// ============================================================================

/**
 * Get Stripe configuration (publishable key)
 */
export function useStripeConfig() {
  return useQuery<{ publishableKey: string }>({
    queryKey: ['stripe', 'config'],
    queryFn: () => apiRequest('/api/subscriptions/stripe/config'),
    staleTime: Infinity, // Config doesn't change
    retry: false, // Don't retry if Stripe is not configured
  });
}

/**
 * Create a Stripe Checkout Session
 * Redirects user to Stripe's hosted checkout page
 */
export function useCheckout() {
  return useMutation<
    { sessionId: string; sessionUrl: string },
    Error,
    { planSlug: string; billingCycle: 'monthly' | 'annual'; discountCode?: string }
  >({
    mutationFn: (data) => apiRequest('/api/subscriptions/checkout', 'POST', data),
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    },
  });
}

/**
 * Create a Stripe Checkout Session for add-on purchase
 */
export function useAddonCheckout() {
  return useMutation<
    { sessionId: string; sessionUrl: string },
    Error,
    { addonSlug: string; quantity?: number }
  >({
    mutationFn: (data) => apiRequest('/api/subscriptions/checkout/addon', 'POST', data),
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    },
  });
}

/**
 * Open Stripe Customer Portal for self-service billing management
 */
export function useCustomerPortal() {
  return useMutation<{ url: string }, Error, void>({
    mutationFn: () => apiRequest('/api/subscriptions/portal', 'POST'),
    onSuccess: (data) => {
      // Redirect to Stripe Customer Portal
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

/**
 * Preview upgrade/downgrade cost
 */
export function usePreviewUpgrade(newPlanSlug: string, billingCycle?: 'monthly' | 'annual') {
  return useQuery<{
    currentPlan: string;
    newPlan: string;
    subtotal: number;
    total: number;
    amountDue: number;
    prorationAmount: number;
    currency: string;
    billingCycle: string;
  }>({
    queryKey: ['subscription', 'preview-upgrade', newPlanSlug, billingCycle],
    queryFn: () => {
      const params = new URLSearchParams({ newPlanSlug });
      if (billingCycle) {
        params.append('billingCycle', billingCycle);
      }
      return apiRequest(`/api/subscriptions/preview-upgrade?${params}`);
    },
    enabled: !!newPlanSlug,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Verify checkout session success
 */
export function useVerifyCheckoutSession(sessionId: string | null) {
  return useQuery<{
    id: string;
    status: string;
    paymentStatus: string;
    customerEmail: string;
    subscriptionId?: string;
  }>({
    queryKey: ['stripe', 'checkout-session', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('No session ID provided');
      return apiRequest(`/api/subscriptions/checkout/session/${sessionId}`);
    },
    enabled: !!sessionId,
  });
}

/**
 * Create a Setup Intent for adding a payment method
 */
export function useSetupIntent() {
  return useMutation<{ clientSecret: string }, Error, void>({
    mutationFn: () => apiRequest('/api/subscriptions/setup-intent', 'POST'),
  });
}
