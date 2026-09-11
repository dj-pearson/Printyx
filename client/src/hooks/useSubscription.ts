import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

/**
 * Subscription Hook
 *
 * Manages subscription state and operations throughout the app.
 *
 * PROD-013. Every call here used to be a bare `fetch('/api/subscriptions/...')`
 * with `credentials: 'include'`, which is broken in production twice over: it
 * skips getApiUrl, so the request goes to whatever origin serves the static
 * bundle rather than to the API, and it sends cookies where an edge function
 * wants a Bearer JWT. Nine call sites, and between them they are the entire
 * billing surface - the plan list, checkout, the Stripe customer portal, adding
 * a payment method, previewing an upgrade and verifying a completed checkout.
 *
 * They go through apiRequest now, which attaches both. That fixes the
 * ADDRESSING. It does not make them all work: only `plans` and `usage` have a
 * branch in supabase/functions/subscriptions/, so the seven Stripe paths -
 * checkout, checkout/addon, checkout/session/:id, portal, setup-intent,
 * preview-upgrade and stripe/config - exist on the Express side alone and 404
 * in production. That is PROD-STRIPE-001, and it means a customer cannot
 * subscribe or manage payment there at all. A visible 404 beats a request that
 * quietly dissolves into the static origin, which is why this is still worth
 * doing on its own.
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
 * PROD-014 / PROD-013 — READ BEFORE "FIXING" THE FETCHES BELOW.
 *
 * Every call in this file is a bare relative fetch, so in production it resolves
 * against the origin serving the static bundle rather than the API. SubscriptionBanner
 * is mounted in App.tsx itself, so this runs on every page and none of it answers
 * in production.
 *
 * CORRECTED 2026-09-11 (PROD-013). This note used to say the obvious repair -
 * swap fetch for apiRequest - would make things WORSE, taking the Stripe paths
 * from "works in dev, 404 in prod" to "404 in both". That is not what happens.
 * getApiUrl returns a RELATIVE path whenever config.apiBaseUrl is empty, and it
 * is empty in development (client/src/lib/config.ts: no VITE_API_BASE_URL, and
 * import.meta.env.PROD false), so apiRequest in dev addresses Express exactly
 * as the bare fetch did. Dev is unchanged; the only difference is that a Bearer
 * token and the tenant header now go with the request.
 *
 * So all nine were converted. In production they now address the functions
 * host, which means `plans` and `usage` WORK where they previously dissolved
 * into the static origin, and the seven Stripe paths - checkout,
 * checkout/addon, checkout/session/:id, portal, setup-intent, preview-upgrade
 * and stripe/config - fail with a visible 404 instead of silently. A request
 * that fails loudly is the better of the two: the previous state was
 * indistinguishable from a backend that simply had nothing to say.
 *
 * The subscriptions edge function serves plans, usage, invoices, features,
 * change-plan, the root list/create, :id / :id/cancel / :id/resume, and - ported
 * under PROD-014 - current, notifications, notifications/:id/dismiss, the bare
 * cancel path, convert-trial, create and upgrade.
 *
 * It still has NO Stripe paths, which need Stripe credentials in the edge
 * environment - a deployment decision rather than code. Until they are ported,
 * a customer cannot subscribe or manage payment in production at all. That is
 * PROD-STRIPE-001.
 *
 * Express (server/routes-subscriptions.ts) is the complete implementation, and
 * /api/subscriptions is not proxied, so dev works and only production is blind.
 * Closing this needs those endpoints ported — SubscriptionService.getSubscriptionStatus
 * carries the limit/usage/overage logic and Stripe is involved — which is its
 * own story, not a call-site edit.
 */
/**
 * Fetch current subscription status
 */
export function useSubscription() {
  return useQuery<SubscriptionStatus>({
    queryKey: ['subscription', 'current'],
    queryFn: async () => {
      // PROD-014: `current` is now implemented on the subscriptions edge
      // function too, so this call goes through apiRequest and reaches the API
      // in production. The other calls in this file are still bare fetches on
      // purpose — the block above lists which paths the edge function does not
      // implement, and converting those would break them in dev as well.
      return apiRequest<SubscriptionStatus>('/api/subscriptions/current');
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
      return await apiRequest('/api/subscriptions/plans');
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
      return await apiRequest('/api/subscriptions/usage');
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
      // PROD-014: ported to the edge function alongside /current.
      return apiRequest('/api/subscriptions/notifications');
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
      // PROD-014: ported to the edge function. It resolves the plan by SLUG,
      // which is what this sends — the older change-plan path takes an id.
      return apiRequest('/api/subscriptions/create', { method: 'POST', body: data });
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
      // PROD-014: ported to the edge function, so changing plans works in
      // production instead of 404ing against the static origin.
      return apiRequest('/api/subscriptions/upgrade', { method: 'POST', body: data });
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
      // PROD-014: the bare /cancel path is now served by the subscriptions edge
      // function as well, including the acknowledgement email LEGAL-011 added,
      // so this reaches the API in production instead of 404ing against the
      // static origin.
      return apiRequest('/api/subscriptions/cancel', {
        method: 'POST',
        body: { immediate },
      });
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
      // PROD-014: ported to the edge function; the renewal date it writes comes
      // from the same nextPeriodEnd() the Node service uses.
      return apiRequest('/api/subscriptions/convert-trial', {
        method: 'POST',
        body: { paymentMethodId },
      });
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
      // PROD-014: ported to the edge function alongside /current.
      return apiRequest(`/api/subscriptions/notifications/${notificationId}/dismiss`, 'POST');
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
    queryFn: async () => {
      return await apiRequest('/api/subscriptions/stripe/config');
    },
    staleTime: Infinity, // Config doesn't change
    retry: false, // Don't retry if Stripe is not configured
  });
}

/**
 * Create a Stripe Checkout Session
 * Redirects user to Stripe's hosted checkout page
 */
export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation<
    { sessionId: string; sessionUrl: string },
    Error,
    { planSlug: string; billingCycle: 'monthly' | 'annual'; discountCode?: string }
  >({
    mutationFn: async (data) => {
      return await apiRequest('/api/subscriptions/checkout', 'POST', data);
    },
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
    mutationFn: async (data) => {
      return await apiRequest('/api/subscriptions/checkout/addon', 'POST', data);
    },
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
    mutationFn: async () => {
      return await apiRequest('/api/subscriptions/portal', 'POST');
    },
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
    queryFn: async () => {
      const params = new URLSearchParams({ newPlanSlug });
      if (billingCycle) {
        params.append('billingCycle', billingCycle);
      }

      return await apiRequest(`/api/subscriptions/preview-upgrade?${params}`);
    },
    enabled: !!newPlanSlug,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Verify checkout session success
 */
export function useVerifyCheckoutSession(sessionId: string | null) {
  const queryClient = useQueryClient();

  return useQuery<{
    id: string;
    status: string;
    paymentStatus: string;
    customerEmail: string;
    subscriptionId?: string;
  }>({
    queryKey: ['stripe', 'checkout-session', sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error('No session ID provided');

      return await apiRequest(`/api/subscriptions/checkout/session/${sessionId}`);
    },
    enabled: !!sessionId,
    onSuccess: () => {
      // Invalidate subscription data to fetch updated status
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

/**
 * Create a Setup Intent for adding a payment method
 */
export function useSetupIntent() {
  return useMutation<{ clientSecret: string }, Error, void>({
    mutationFn: async () => {
      return await apiRequest('/api/subscriptions/setup-intent', 'POST');
    },
  });
}
