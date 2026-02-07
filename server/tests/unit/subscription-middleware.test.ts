/**
 * Unit Tests: Subscription Middleware
 * Tests for trackApiCall, requireActiveSubscription, requireFeature,
 * checkUsageLimits, softCheckSubscription, requireTrialOrPaid,
 * blockExpiredTrial, requirePremiumPlan, requireEnterprisePlan
 * from server/middleware/subscription.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the services before importing the middleware
vi.mock('../../services/subscription-service', () => ({
  SubscriptionService: {
    getSubscriptionStatus: vi.fn(),
  },
}));

vi.mock('../../services/usage-tracking-service', () => ({
  UsageTrackingService: {
    trackApiCall: vi.fn(),
  },
}));

import {
  trackApiCall,
  requireActiveSubscription,
  requireFeature,
  checkUsageLimits,
  softCheckSubscription,
  requireTrialOrPaid,
  blockExpiredTrial,
  requirePremiumPlan,
  requireEnterprisePlan,
} from '../../middleware/subscription';

import { SubscriptionService } from '../../services/subscription-service';
import { UsageTrackingService } from '../../services/usage-tracking-service';

// ─── Helpers ─────────────────────────────────────────────────────────

const TEST_TENANT_ID = 'tenant-test-123';

function createMockReq(
  overrides: Partial<Request> & { tenantId?: string; subscriptionStatus?: any } = {},
): any {
  return {
    tenantId: overrides.tenantId,
    path: '/api/test',
    subscriptionStatus: overrides.subscriptionStatus,
    ...overrides,
  };
}

function createMockRes(): any {
  const headers: Record<string, string> = {};
  const res: any = {
    _status: 200,
    _json: undefined,
    _headers: headers,
    status: vi.fn(function (this: any, code: number) {
      this._status = code;
      return this;
    }),
    json: vi.fn(function (this: any, data: unknown) {
      this._json = data;
      return this;
    }),
    setHeader: vi.fn(function (this: any, name: string, value: string) {
      this._headers[name] = value;
      return this;
    }),
  };
  return res;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

/** Create a realistic subscription status object */
function createSubStatus(
  overrides: {
    status?: string;
    isFree?: boolean;
    planName?: string;
    planSlug?: string;
    features?: string[];
    isTrialing?: boolean;
    trialDaysRemaining?: number;
    isOverLimit?: boolean;
    overageDetails?: any;
    trialEndDate?: string;
  } = {},
): any {
  return {
    subscription: {
      status: overrides.status ?? 'active',
      isFree: overrides.isFree ?? false,
      trialEndDate: overrides.trialEndDate ?? null,
    },
    plan: {
      name: overrides.planName ?? 'Professional',
      slug: overrides.planSlug ?? 'professional',
    },
    features: overrides.features ?? ['crm', 'billing', 'reports'],
    isTrialing: overrides.isTrialing ?? false,
    trialDaysRemaining: overrides.trialDaysRemaining,
    isOverLimit: overrides.isOverLimit ?? false,
    overageDetails: overrides.overageDetails ?? null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Subscription Middleware', () => {
  // ─── trackApiCall ──────────────────────────────────────────────────
  describe('trackApiCall', () => {
    it('should call next() and track asynchronously when tenantId present', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (UsageTrackingService.trackApiCall as any).mockResolvedValue(undefined);

      await trackApiCall(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(UsageTrackingService.trackApiCall).toHaveBeenCalledWith(TEST_TENANT_ID, '/api/test');
    });

    it('should call next() without tracking when no tenantId', async () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = createMockNext();

      await trackApiCall(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(UsageTrackingService.trackApiCall).not.toHaveBeenCalled();
    });

    it('should still call next() if tracking throws', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (UsageTrackingService.trackApiCall as any).mockRejectedValue(new Error('tracking down'));

      await trackApiCall(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ─── requireActiveSubscription ─────────────────────────────────────
  describe('requireActiveSubscription', () => {
    it('should call next() for active subscription', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ status: 'active' }),
      );

      await requireActiveSubscription(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.subscriptionStatus).toBeDefined();
    });

    it('should call next() for trialing subscription', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ status: 'trialing', isTrialing: true }),
      );

      await requireActiveSubscription(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 401 when no tenantId', async () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = createMockNext();

      await requireActiveSubscription(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json.code).toBe('NO_TENANT');
    });

    it('should return 403 when no subscription status', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(null);

      await requireActiveSubscription(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('NO_SUBSCRIPTION');
    });

    it('should return 403 with past_due message', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ status: 'past_due' }),
      );

      await requireActiveSubscription(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('SUBSCRIPTION_INACTIVE');
      expect(res._json.message).toContain('past due');
      expect(res._json.redirectTo).toBe('/settings/billing');
    });

    it('should return 403 with canceled message', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ status: 'canceled' }),
      );

      await requireActiveSubscription(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.message).toContain('canceled');
      expect(res._json.redirectTo).toBe('/pricing');
    });

    it('should return 403 with incomplete_expired message', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ status: 'incomplete_expired' }),
      );

      await requireActiveSubscription(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.message).toContain('trial has expired');
      expect(res._json.redirectTo).toBe('/settings/billing');
    });

    it('should return 500 when service throws', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockRejectedValue(new Error('db down'));

      await requireActiveSubscription(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res._json.code).toBe('SUBSCRIPTION_CHECK_FAILED');
    });
  });

  // ─── requireFeature ────────────────────────────────────────────────
  describe('requireFeature', () => {
    it('should call next() when feature is included in plan', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ features: ['crm', 'billing', 'analytics'] }),
      );

      const middleware = requireFeature('billing');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should bypass feature check for free subscriptions', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ isFree: true, features: [] }),
      );

      const middleware = requireFeature('premium-analytics');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when feature not in plan', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ planName: 'Starter', planSlug: 'starter', features: ['crm'] }),
      );

      const middleware = requireFeature('advanced-analytics');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('FEATURE_NOT_AVAILABLE');
      expect(res._json.feature).toBe('advanced-analytics');
      expect(res._json.upgradeRequired).toBe(true);
    });

    it('should use cached subscriptionStatus from req', async () => {
      const cachedStatus = createSubStatus({ features: ['billing'] });
      const req = createMockReq({ tenantId: TEST_TENANT_ID, subscriptionStatus: cachedStatus });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireFeature('billing');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      // Should NOT have called the service since status was cached
      expect(SubscriptionService.getSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('should return 401 when no tenant context', async () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireFeature('crm');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json.code).toBe('NO_TENANT');
    });
  });

  // ─── checkUsageLimits ──────────────────────────────────────────────
  describe('checkUsageLimits', () => {
    it('should call next() and set warning headers when over limit', async () => {
      const overage = { apiCalls: { limit: 1000, used: 1500 } };
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ isOverLimit: true, overageDetails: overage }),
      );

      await checkUsageLimits(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-Usage-Warning', 'true');
      expect(res.setHeader).toHaveBeenCalledWith('X-Usage-Exceeded', JSON.stringify(overage));
    });

    it('should call next() without headers when under limit', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ isOverLimit: false }),
      );

      await checkUsageLimits(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should skip for free subscriptions', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ isFree: true }),
      );

      await checkUsageLimits(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should call next() even when no tenantId', async () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = createMockNext();

      await checkUsageLimits(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ─── softCheckSubscription ─────────────────────────────────────────
  describe('softCheckSubscription', () => {
    it('should set subscription headers for active subscription', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ planSlug: 'professional', status: 'active' }),
      );

      await softCheckSubscription(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-Subscription-Plan', 'professional');
      expect(res.setHeader).toHaveBeenCalledWith('X-Subscription-Status', 'active');
      expect(res.setHeader).toHaveBeenCalledWith('X-Is-Trialing', 'false');
    });

    it('should set trial headers when trialing', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ status: 'trialing', isTrialing: true, trialDaysRemaining: 7 }),
      );

      await softCheckSubscription(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-Is-Trialing', 'true');
      expect(res.setHeader).toHaveBeenCalledWith('X-Trial-Days-Remaining', '7');
    });

    it('should set over-limit header when usage exceeded', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ isOverLimit: true }),
      );

      await softCheckSubscription(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-Usage-Over-Limit', 'true');
    });

    it('should call next() without headers when no tenant', async () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = createMockNext();

      await softCheckSubscription(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  // ─── requireTrialOrPaid ────────────────────────────────────────────
  describe('requireTrialOrPaid', () => {
    it('should allow active subscription', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ status: 'active' }),
      );

      await requireTrialOrPaid(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow trialing subscription', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ status: 'trialing', isTrialing: true }),
      );

      await requireTrialOrPaid(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow free subscription', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ status: 'canceled', isFree: true }),
      );

      await requireTrialOrPaid(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should block canceled non-free subscription', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ status: 'canceled', isFree: false }),
      );

      await requireTrialOrPaid(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('should return 403 when no subscription found', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(null);

      await requireTrialOrPaid(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('NO_SUBSCRIPTION');
    });
  });

  // ─── blockExpiredTrial ─────────────────────────────────────────────
  describe('blockExpiredTrial', () => {
    it('should block when trial has 0 days remaining', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({
          status: 'trialing',
          isTrialing: true,
          trialDaysRemaining: 0,
          trialEndDate: '2026-02-01',
        }),
      );

      await blockExpiredTrial(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('TRIAL_EXPIRED');
      expect(res._json.redirectTo).toBe('/settings/billing');
    });

    it('should allow trial with days remaining', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ isTrialing: true, trialDaysRemaining: 5 }),
      );

      await blockExpiredTrial(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow non-trial subscriptions', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ isTrialing: false }),
      );

      await blockExpiredTrial(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should call next() when no tenant', async () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = createMockNext();

      await blockExpiredTrial(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ─── requirePremiumPlan ────────────────────────────────────────────
  describe('requirePremiumPlan', () => {
    it('should allow professional plan', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ planSlug: 'professional' }),
      );

      await requirePremiumPlan(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow enterprise plan', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ planSlug: 'enterprise' }),
      );

      await requirePremiumPlan(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow free subscriptions (bypass)', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ isFree: true, planSlug: 'starter' }),
      );

      await requirePremiumPlan(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should block starter plan', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ planSlug: 'starter', isFree: false }),
      );

      await requirePremiumPlan(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('PREMIUM_REQUIRED');
      expect(res._json.upgradeRequired).toBe(true);
    });

    it('should return 401 when no tenant', async () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = createMockNext();

      await requirePremiumPlan(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ─── requireEnterprisePlan ─────────────────────────────────────────
  describe('requireEnterprisePlan', () => {
    it('should allow enterprise plan', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ planSlug: 'enterprise' }),
      );

      await requireEnterprisePlan(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow free subscriptions (bypass)', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ isFree: true, planSlug: 'starter' }),
      );

      await requireEnterprisePlan(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should block professional plan', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ planSlug: 'professional', isFree: false }),
      );

      await requireEnterprisePlan(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('ENTERPRISE_REQUIRED');
      expect(res._json.upgradeRequired).toBe(true);
    });

    it('should block starter plan', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(
        createSubStatus({ planSlug: 'starter', isFree: false }),
      );

      await requireEnterprisePlan(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('ENTERPRISE_REQUIRED');
    });

    it('should return 403 when no subscription found', async () => {
      const req = createMockReq({ tenantId: TEST_TENANT_ID });
      const res = createMockRes();
      const next = createMockNext();
      (SubscriptionService.getSubscriptionStatus as any).mockResolvedValue(null);

      await requireEnterprisePlan(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('NO_SUBSCRIPTION');
    });
  });
});
