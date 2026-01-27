import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscription-service';
import { UsageTrackingService } from '../services/usage-tracking-service';

/**
 * SUBSCRIPTION MIDDLEWARE
 *
 * Middleware for subscription validation, feature gating, and usage tracking.
 */

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      subscriptionStatus?: Awaited<ReturnType<typeof SubscriptionService.getSubscriptionStatus>>;
    }
  }
}

/**
 * Track API call middleware
 * Automatically tracks API calls for usage monitoring
 */
export async function trackApiCall(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenant_id;
    if (tenantId) {
      // Track asynchronously to not block the request
      UsageTrackingService.trackApiCall(tenantId, req.path).catch((error) => {
        console.error('Failed to track API call:', error);
      });
    }
    next();
  } catch (error) {
    // Don't block requests if tracking fails
    console.error('API tracking error:', error);
    next();
  }
}

/**
 * Require active subscription middleware
 * Blocks requests if subscription is not active
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({
        error: 'No tenant context',
        code: 'NO_TENANT',
      });
    }

    const status = await SubscriptionService.getSubscriptionStatus(tenantId);

    if (!status) {
      return res.status(403).json({
        error: 'No active subscription',
        code: 'NO_SUBSCRIPTION',
        message: 'Please subscribe to a plan to access this feature.',
        redirectTo: '/pricing',
      });
    }

    // Check if subscription is active
    if (!['active', 'trialing'].includes(status.subscription.status)) {
      let message = 'Your subscription is not active.';
      let redirectTo = '/settings/subscription';

      if (status.subscription.status === 'past_due') {
        message = 'Your payment is past due. Please update your payment method.';
        redirectTo = '/settings/billing';
      } else if (status.subscription.status === 'canceled') {
        message = 'Your subscription has been canceled. Please reactivate to continue.';
        redirectTo = '/pricing';
      } else if (status.subscription.status === 'incomplete_expired') {
        message = 'Your trial has expired. Please add a payment method to continue.';
        redirectTo = '/settings/billing';
      }

      return res.status(403).json({
        error: 'Subscription not active',
        code: 'SUBSCRIPTION_INACTIVE',
        message,
        redirectTo,
        status: status.subscription.status,
      });
    }

    // Attach subscription status to request for downstream use
    req.subscriptionStatus = status;
    next();
  } catch (error) {
    console.error('Subscription validation error:', error);
    return res.status(500).json({
      error: 'Failed to validate subscription',
      code: 'SUBSCRIPTION_CHECK_FAILED',
    });
  }
}

/**
 * Require feature middleware factory
 * Creates middleware that checks if tenant has access to specific feature
 */
export function requireFeature(featureSlug: string) {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenant_id;
      if (!tenantId) {
        return res.status(401).json({
          error: 'No tenant context',
          code: 'NO_TENANT',
        });
      }

      // Get or use cached subscription status
      let status = req.subscriptionStatus;
      if (!status) {
        status = await SubscriptionService.getSubscriptionStatus(tenantId);
        req.subscriptionStatus = status;
      }

      if (!status) {
        return res.status(403).json({
          error: 'No active subscription',
          code: 'NO_SUBSCRIPTION',
          message: 'Please subscribe to a plan to access this feature.',
          redirectTo: '/pricing',
        });
      }

      // Free subscriptions have all features
      if (status.subscription.isFree) {
        return next();
      }

      // Check if plan includes the feature
      if (!status.features.includes(featureSlug)) {
        return res.status(403).json({
          error: 'Feature not available',
          code: 'FEATURE_NOT_AVAILABLE',
          message: `This feature is not included in your ${status.plan.name} plan.`,
          feature: featureSlug,
          currentPlan: status.plan.slug,
          redirectTo: '/settings/subscription',
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      console.error('Feature validation error:', error);
      return res.status(500).json({
        error: 'Failed to validate feature access',
        code: 'FEATURE_CHECK_FAILED',
      });
    }
  };
}

/**
 * Check usage limits middleware
 * Warns or blocks if usage limits are exceeded
 */
export async function checkUsageLimits(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return next();
    }

    // Get or use cached subscription status
    let status = req.subscriptionStatus;
    if (!status) {
      status = await SubscriptionService.getSubscriptionStatus(tenantId);
      req.subscriptionStatus = status;
    }

    if (!status) {
      return next();
    }

    // Free subscriptions have no limits
    if (status.subscription.isFree) {
      return next();
    }

    // Check if over limit
    if (status.isOverLimit) {
      // Add warning header but allow request
      res.setHeader('X-Usage-Warning', 'true');
      res.setHeader('X-Usage-Exceeded', JSON.stringify(status.overageDetails));

      // For critical overages, might want to block
      // For now, just warn
      console.warn(`Tenant ${tenantId} is over usage limits:`, status.overageDetails);
    }

    next();
  } catch (error) {
    console.error('Usage limit check error:', error);
    // Don't block on errors
    next();
  }
}

/**
 * Soft check subscription middleware
 * Adds subscription status to request but doesn't block
 * Useful for endpoints that work with or without subscription
 */
export async function softCheckSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenant_id;
    if (tenantId) {
      const status = await SubscriptionService.getSubscriptionStatus(tenantId);
      req.subscriptionStatus = status;

      // Add subscription info to response headers for client use
      if (status) {
        res.setHeader('X-Subscription-Plan', status.plan.slug);
        res.setHeader('X-Subscription-Status', status.subscription.status);
        res.setHeader('X-Is-Trialing', status.isTrialing ? 'true' : 'false');

        if (status.isTrialing && status.trialDaysRemaining !== undefined) {
          res.setHeader('X-Trial-Days-Remaining', status.trialDaysRemaining.toString());
        }

        if (status.isOverLimit) {
          res.setHeader('X-Usage-Over-Limit', 'true');
        }
      }
    }
    next();
  } catch (error) {
    console.error('Soft subscription check error:', error);
    // Don't block on errors
    next();
  }
}

/**
 * Require trial or paid middleware
 * Allows both trial and paid subscriptions
 */
export async function requireTrialOrPaid(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({
        error: 'No tenant context',
        code: 'NO_TENANT',
      });
    }

    const status = await SubscriptionService.getSubscriptionStatus(tenantId);

    if (!status) {
      return res.status(403).json({
        error: 'No subscription found',
        code: 'NO_SUBSCRIPTION',
        message: 'Please start a free trial or subscribe to access this feature.',
        redirectTo: '/pricing',
      });
    }

    // Allow trial, active, and free subscriptions
    if (
      !['active', 'trialing'].includes(status.subscription.status) &&
      !status.subscription.isFree
    ) {
      return res.status(403).json({
        error: 'Subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Please activate your subscription to continue.',
        redirectTo: '/settings/billing',
      });
    }

    req.subscriptionStatus = status;
    next();
  } catch (error) {
    console.error('Trial/paid validation error:', error);
    return res.status(500).json({
      error: 'Failed to validate subscription',
      code: 'SUBSCRIPTION_CHECK_FAILED',
    });
  }
}

/**
 * Block if trial expired middleware
 * Specifically blocks expired trials
 */
export async function blockExpiredTrial(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return next();
    }

    const status = await SubscriptionService.getSubscriptionStatus(tenantId);

    if (status && status.isTrialing && status.trialDaysRemaining === 0) {
      return res.status(403).json({
        error: 'Trial expired',
        code: 'TRIAL_EXPIRED',
        message: 'Your free trial has expired. Please add a payment method to continue.',
        redirectTo: '/settings/billing',
        trialEndDate: status.subscription.trialEndDate,
      });
    }

    next();
  } catch (error) {
    console.error('Trial expiration check error:', error);
    next();
  }
}

/**
 * Premium features middleware
 * Requires Professional or Enterprise plan
 */
export async function requirePremiumPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({
        error: 'No tenant context',
        code: 'NO_TENANT',
      });
    }

    let status = req.subscriptionStatus;
    if (!status) {
      status = await SubscriptionService.getSubscriptionStatus(tenantId);
      req.subscriptionStatus = status;
    }

    if (!status) {
      return res.status(403).json({
        error: 'No subscription found',
        code: 'NO_SUBSCRIPTION',
        message: 'Premium features require a Professional or Enterprise plan.',
        redirectTo: '/pricing',
      });
    }

    // Free subscriptions can access premium features
    if (status.subscription.isFree) {
      return next();
    }

    // Check if plan is premium (not starter)
    if (status.plan.slug === 'starter') {
      return res.status(403).json({
        error: 'Premium plan required',
        code: 'PREMIUM_REQUIRED',
        message: 'This feature requires a Professional or Enterprise plan.',
        currentPlan: status.plan.slug,
        redirectTo: '/settings/subscription',
        upgradeRequired: true,
      });
    }

    next();
  } catch (error) {
    console.error('Premium plan validation error:', error);
    return res.status(500).json({
      error: 'Failed to validate plan',
      code: 'PLAN_CHECK_FAILED',
    });
  }
}

/**
 * Enterprise features middleware
 * Requires Enterprise plan only
 */
export async function requireEnterprisePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenant_id;
    if (!tenantId) {
      return res.status(401).json({
        error: 'No tenant context',
        code: 'NO_TENANT',
      });
    }

    let status = req.subscriptionStatus;
    if (!status) {
      status = await SubscriptionService.getSubscriptionStatus(tenantId);
      req.subscriptionStatus = status;
    }

    if (!status) {
      return res.status(403).json({
        error: 'No subscription found',
        code: 'NO_SUBSCRIPTION',
        message: 'This feature requires an Enterprise plan.',
        redirectTo: '/pricing',
      });
    }

    // Free subscriptions can access enterprise features
    if (status.subscription.isFree) {
      return next();
    }

    // Check if plan is enterprise
    if (status.plan.slug !== 'enterprise') {
      return res.status(403).json({
        error: 'Enterprise plan required',
        code: 'ENTERPRISE_REQUIRED',
        message: 'This feature is only available on the Enterprise plan.',
        currentPlan: status.plan.slug,
        redirectTo: '/settings/subscription',
        upgradeRequired: true,
      });
    }

    next();
  } catch (error) {
    console.error('Enterprise plan validation error:', error);
    return res.status(500).json({
      error: 'Failed to validate plan',
      code: 'PLAN_CHECK_FAILED',
    });
  }
}
