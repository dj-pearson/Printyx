import { X, AlertTriangle, Info, TrendingUp, Clock } from 'lucide-react';
import { useSubscription, useDismissNotification } from '@/hooks/useSubscription';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { useState } from 'react';

/**
 * Subscription Status Banner
 *
 * Displays important subscription-related messages:
 * - Trial expiration warnings
 * - Usage limit alerts
 * - Payment issues
 * - Subscription status changes
 */

export function SubscriptionBanner() {
  const { data: subscription, isLoading } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || !subscription || dismissed) {
    return null;
  }

  // Don't show banners for free subscriptions
  if (subscription.subscription?.isFree) {
    return null;
  }

  // Priority 1: Trial expiring soon (7 days or less)
  if (
    subscription.isTrialing &&
    subscription.trialDaysRemaining !== undefined &&
    subscription.trialDaysRemaining <= 7
  ) {
    const urgency = subscription.trialDaysRemaining <= 1 ? 'urgent' : subscription.trialDaysRemaining <= 3 ? 'high' : 'normal';

    return (
      <Alert
        className={`mb-4 ${
          urgency === 'urgent'
            ? 'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800'
            : urgency === 'high'
            ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/50 dark:border-orange-800'
            : 'bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800'
        }`}
      >
        <div className="flex items-start gap-3">
          <Clock
            className={`h-5 w-5 mt-0.5 ${
              urgency === 'urgent'
                ? 'text-red-600 dark:text-red-400'
                : urgency === 'high'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}
          />
          <div className="flex-1">
            <AlertDescription className="font-medium">
              {subscription.trialDaysRemaining === 0 ? (
                <>
                  <strong>Your trial expires today!</strong> Add a payment method to continue using all features.
                </>
              ) : subscription.trialDaysRemaining === 1 ? (
                <>
                  <strong>Trial ending tomorrow!</strong> Your {subscription.plan?.name} trial ends in 1 day.
                </>
              ) : (
                <>
                  <strong>Trial ending soon:</strong> Your {subscription.plan?.name} trial ends in {subscription.trialDaysRemaining} days.
                </>
              )}
            </AlertDescription>
            <div className="mt-2 flex gap-2">
              <Link href="/settings/billing">
                <Button size="sm" variant={urgency === 'urgent' ? 'default' : 'outline'}>
                  Add Payment Method
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="sm" variant="ghost">
                  View Plans
                </Button>
              </Link>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
    );
  }

  // Priority 2: Usage limits exceeded
  if (subscription.isOverLimit && subscription.overageDetails) {
    const overages = Object.entries(subscription.overageDetails);

    return (
      <Alert className="mb-4 bg-orange-50 border-orange-200 dark:bg-orange-950/50 dark:border-orange-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 text-orange-600 dark:text-orange-400" />
          <div className="flex-1">
            <AlertDescription className="font-medium">
              <strong>Usage limits exceeded:</strong>
              <ul className="mt-1 ml-4 list-disc">
                {overages.map(([key, value]) => (
                  <li key={key}>
                    {key === 'users' && `${value} users over limit`}
                    {key === 'storage' && `${Math.round(value / 1024)}GB over storage limit`}
                    {key === 'apiCalls' && `${value} API calls over limit`}
                    {key === 'locations' && `${value} locations over limit`}
                    {key === 'businessRecords' && `${value} records over limit`}
                  </li>
                ))}
              </ul>
            </AlertDescription>
            <div className="mt-2 flex gap-2">
              <Link href="/settings/subscription">
                <Button size="sm" variant="default">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Upgrade Plan
                </Button>
              </Link>
              <Link href="/settings/subscription">
                <Button size="sm" variant="ghost">
                  View Usage
                </Button>
              </Link>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
    );
  }

  // Priority 3: Usage warning (80%+ of limit)
  if (subscription.usage && subscription.limits) {
    const warnings: string[] = [];

    if (subscription.limits.users !== -1 && subscription.usage.users >= subscription.limits.users * 0.8) {
      const pct = Math.round((subscription.usage.users / subscription.limits.users) * 100);
      warnings.push(`Users: ${subscription.usage.users}/${subscription.limits.users} (${pct}%)`);
    }

    if (subscription.limits.storage !== -1 && subscription.usage.storage >= subscription.limits.storage * 1024 * 0.8) {
      const usedGB = Math.round(subscription.usage.storage / 1024);
      const pct = Math.round((subscription.usage.storage / (subscription.limits.storage * 1024)) * 100);
      warnings.push(`Storage: ${usedGB}/${subscription.limits.storage}GB (${pct}%)`);
    }

    if (subscription.limits.apiCalls !== -1 && subscription.usage.apiCalls >= subscription.limits.apiCalls * 0.8) {
      const pct = Math.round((subscription.usage.apiCalls / subscription.limits.apiCalls) * 100);
      warnings.push(`API Calls: ${subscription.usage.apiCalls.toLocaleString()}/${subscription.limits.apiCalls.toLocaleString()} (${pct}%)`);
    }

    if (warnings.length > 0) {
      return (
        <Alert className="mb-4 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 mt-0.5 text-yellow-600 dark:text-yellow-400" />
            <div className="flex-1">
              <AlertDescription className="font-medium">
                <strong>Approaching plan limits:</strong>
                <ul className="mt-1 ml-4 list-disc">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
              <div className="mt-2">
                <Link href="/settings/subscription">
                  <Button size="sm" variant="outline">
                    View Usage Details
                  </Button>
                </Link>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      );
    }
  }

  // Priority 4: Subscription status issues
  if (subscription.subscription?.status === 'past_due') {
    return (
      <Alert className="mb-4 bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <AlertDescription className="font-medium">
              <strong>Payment past due:</strong> Please update your payment method to continue service.
            </AlertDescription>
            <div className="mt-2">
              <Link href="/settings/billing">
                <Button size="sm" variant="default">
                  Update Payment Method
                </Button>
              </Link>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
    );
  }

  if (subscription.subscription?.status === 'canceled') {
    const daysRemaining = subscription.daysUntilRenewal || 0;

    return (
      <Alert className="mb-4 bg-orange-50 border-orange-200 dark:bg-orange-950/50 dark:border-orange-800">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 mt-0.5 text-orange-600 dark:text-orange-400" />
          <div className="flex-1">
            <AlertDescription className="font-medium">
              <strong>Subscription canceled:</strong> Your access will end in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}.
            </AlertDescription>
            <div className="mt-2">
              <Link href="/pricing">
                <Button size="sm" variant="default">
                  Reactivate Subscription
                </Button>
              </Link>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
    );
  }

  return null;
}

/**
 * Compact subscription status indicator for header/nav
 */
export function SubscriptionBadge() {
  const { data: subscription } = useSubscription();

  if (!subscription?.hasSubscription) {
    return null;
  }

  // Free subscription
  if (subscription.subscription?.isFree) {
    return (
      <div className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        Free Plan
      </div>
    );
  }

  // Trial
  if (subscription.isTrialing) {
    const days = subscription.trialDaysRemaining || 0;
    const isUrgent = days <= 3;

    return (
      <div
        className={`text-xs font-medium px-2 py-1 rounded-full ${
          isUrgent
            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        }`}
      >
        Trial: {days}d left
      </div>
    );
  }

  // Active subscription
  return (
    <div className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      {subscription.plan?.name}
    </div>
  );
}
