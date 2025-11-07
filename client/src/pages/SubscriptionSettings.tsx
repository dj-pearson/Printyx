import { TrendingUp, Users, HardDrive, Activity, MapPin, FileText, Calendar, CreditCard, AlertCircle } from 'lucide-react';
import { useSubscription, useUpgradeSubscription, useCancelSubscription, useUsagePercentage } from '@/hooks/useSubscription';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Link } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useState } from 'react';

/**
 * Subscription Settings Page
 *
 * Allows users to:
 * - View current plan and billing details
 * - Monitor usage against limits
 * - Upgrade or downgrade plans
 * - Manage billing and payment
 * - Cancel subscription
 */

export default function SubscriptionSettings() {
  const { data: subscription, isLoading } = useSubscription();
  const upgradeSubscription = useUpgradeSubscription();
  const cancelSubscription = useCancelSubscription();

  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const handleUpgrade = async (planSlug: string) => {
    try {
      await upgradeSubscription.mutateAsync({
        newPlanSlug: planSlug,
        immediate: true,
      });
    } catch (error) {
      console.error('Failed to upgrade:', error);
    }
  };

  const handleCancel = async (immediate: boolean) => {
    try {
      await cancelSubscription.mutateAsync(immediate);
      setShowCancelDialog(false);
    } catch (error) {
      console.error('Failed to cancel:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!subscription?.hasSubscription) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle>No Active Subscription</CardTitle>
            <CardDescription>Choose a plan to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You don't have an active subscription yet. Browse our plans and start your free trial today.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/pricing">
              <Button>View Plans</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const isFree = subscription.subscription?.isFree;
  const isTrialing = subscription.isTrialing;
  const trialDaysRemaining = subscription.trialDaysRemaining || 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Subscription & Usage</h1>
        {!isFree && (
          <Link href="/pricing">
            <Button>
              <TrendingUp className="h-4 w-4 mr-2" />
              View All Plans
            </Button>
          </Link>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>Your subscription details</CardDescription>
              </div>
              {isTrialing && (
                <Badge variant="secondary">Trial</Badge>
              )}
              {isFree && (
                <Badge className="bg-green-500">Free</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold">{subscription.plan?.name}</h3>
              {!isFree && (
                <p className="text-muted-foreground">
                  ${subscription.subscription?.amount}/{subscription.subscription?.billingCycle === 'annual' ? 'year' : 'month'}
                </p>
              )}
            </div>

            {isTrialing && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your trial {trialDaysRemaining === 0 ? 'expires today' : `ends in ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''}`}.
                  {trialDaysRemaining <= 3 && ' Add a payment method to continue.'}
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{subscription.subscription?.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Billing Cycle</span>
                <span className="font-medium capitalize">{subscription.subscription?.billingCycle}</span>
              </div>
              {subscription.daysUntilRenewal && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Next Billing</span>
                  <span className="font-medium">
                    {subscription.daysUntilRenewal} day{subscription.daysUntilRenewal !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
          {!isFree && (
            <CardFooter className="flex gap-2">
              <Link href="/settings/billing" className="flex-1">
                <Button variant="outline" className="w-full">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Billing
                </Button>
              </Link>
              <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="flex-1">
                    Cancel Plan
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Subscription</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to cancel your subscription? You can choose to cancel immediately or at the end of your billing period.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                      Keep Subscription
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleCancel(false)}
                      disabled={cancelSubscription.isPending}
                    >
                      Cancel at Period End
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleCancel(true)}
                      disabled={cancelSubscription.isPending}
                    >
                      Cancel Immediately
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardFooter>
          )}
        </Card>

        {/* Plan Limits Card */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Limits</CardTitle>
            <CardDescription>What's included in your plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>Users</span>
              </div>
              <span className="font-medium">
                {subscription.limits?.users === -1 ? 'Unlimited' : subscription.limits?.users}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span>Storage</span>
              </div>
              <span className="font-medium">
                {subscription.limits?.storage === -1 ? 'Unlimited' : `${subscription.limits?.storage}GB`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span>API Calls</span>
              </div>
              <span className="font-medium">
                {subscription.limits?.apiCalls === -1 ? 'Unlimited' : `${subscription.limits?.apiCalls.toLocaleString()}/mo`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>Locations</span>
              </div>
              <span className="font-medium">
                {subscription.limits?.locations === -1 ? 'Unlimited' : subscription.limits?.locations}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>Business Records</span>
              </div>
              <span className="font-medium">
                {subscription.limits?.businessRecords === -1 ? 'Unlimited' : subscription.limits?.businessRecords.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Section */}
      {!isFree && subscription.usage && subscription.limits && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Usage</CardTitle>
            <CardDescription>
              Your usage for the current billing period
              {subscription.daysUntilRenewal && (
                <> • Resets in {subscription.daysUntilRenewal} day{subscription.daysUntilRenewal !== 1 ? 's' : ''}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <UsageMetric
                icon={Users}
                label="Users"
                current={subscription.usage.users}
                limit={subscription.limits.users}
                unit=""
              />
              <UsageMetric
                icon={HardDrive}
                label="Storage"
                current={Math.round(subscription.usage.storage / 1024)}
                limit={subscription.limits.storage}
                unit="GB"
              />
              <UsageMetric
                icon={Activity}
                label="API Calls"
                current={subscription.usage.apiCalls}
                limit={subscription.limits.apiCalls}
                unit=""
              />
              <UsageMetric
                icon={MapPin}
                label="Locations"
                current={subscription.usage.locations}
                limit={subscription.limits.locations}
                unit=""
              />
              <UsageMetric
                icon={FileText}
                label="Business Records"
                current={subscription.usage.businessRecords}
                limit={subscription.limits.businessRecords}
                unit=""
              />
            </div>
          </CardContent>
          {subscription.isOverLimit && (
            <CardFooter>
              <Alert className="w-full">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You've exceeded your plan limits. Consider upgrading to avoid service interruptions.
                </AlertDescription>
              </Alert>
            </CardFooter>
          )}
        </Card>
      )}

      {/* Upgrade Options */}
      {!isFree && subscription.plan && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade Your Plan</CardTitle>
            <CardDescription>Get more features and higher limits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              {subscription.plan.slug === 'starter' && (
                <>
                  <Card className="flex-1 border-primary">
                    <CardHeader>
                      <CardTitle className="text-xl">Professional</CardTitle>
                      <CardDescription>$149/month</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <ul className="space-y-1">
                        <li>• 25 users</li>
                        <li>• 50GB storage</li>
                        <li>• Advanced analytics</li>
                        <li>• Priority support</li>
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        onClick={() => handleUpgrade('professional')}
                        disabled={upgradeSubscription.isPending}
                      >
                        Upgrade Now
                      </Button>
                    </CardFooter>
                  </Card>
                  <Card className="flex-1">
                    <CardHeader>
                      <CardTitle className="text-xl">Enterprise</CardTitle>
                      <CardDescription>$499/month</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <ul className="space-y-1">
                        <li>• Unlimited everything</li>
                        <li>• Dedicated support</li>
                        <li>• Custom features</li>
                        <li>• SLA guarantee</li>
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        onClick={() => handleUpgrade('enterprise')}
                        disabled={upgradeSubscription.isPending}
                      >
                        Upgrade Now
                      </Button>
                    </CardFooter>
                  </Card>
                </>
              )}
              {subscription.plan.slug === 'professional' && (
                <Card className="flex-1 border-primary">
                  <CardHeader>
                    <CardTitle className="text-xl">Enterprise</CardTitle>
                    <CardDescription>$499/month</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <ul className="space-y-1">
                      <li>• Unlimited everything</li>
                      <li>• Dedicated account manager</li>
                      <li>• Custom integrations</li>
                      <li>• 99.9% SLA guarantee</li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade('enterprise')}
                      disabled={upgradeSubscription.isPending}
                    >
                      Upgrade Now
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Usage Metric Component
 */
function UsageMetric({
  icon: Icon,
  label,
  current,
  limit,
  unit,
}: {
  icon: any;
  label: string;
  current: number;
  limit: number;
  unit: string;
}) {
  const percentage = limit === -1 ? 0 : Math.min(100, (current / limit) * 100);
  const isUnlimited = limit === -1;
  const isWarning = percentage >= 80 && percentage < 100;
  const isDanger = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{label}</span>
        </div>
        <span className={`text-sm font-medium ${isDanger ? 'text-red-600' : isWarning ? 'text-orange-600' : ''}`}>
          {current.toLocaleString()} {unit}
          {!isUnlimited && (
            <span className="text-muted-foreground"> / {limit.toLocaleString()} {unit}</span>
          )}
        </span>
      </div>
      {!isUnlimited && (
        <div className="space-y-1">
          <Progress
            value={percentage}
            className={`h-2 ${isDanger ? '[&>div]:bg-red-500' : isWarning ? '[&>div]:bg-orange-500' : ''}`}
          />
          <p className="text-xs text-muted-foreground text-right">
            {percentage.toFixed(1)}% used
          </p>
        </div>
      )}
      {isUnlimited && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Unlimited</p>
      )}
    </div>
  );
}
