import { Check, Sparkles, TrendingUp, Star } from 'lucide-react';
import { useSubscriptionPlans, useSubscription, useCreateSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Pricing Page
 *
 * Displays subscription plans with feature comparison and allows users to:
 * - Start a free trial
 * - Subscribe to a plan
 * - Upgrade from current plan
 */

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [, navigate] = useLocation();

  const { data, isLoading } = useSubscriptionPlans();
  const { data: subscription } = useSubscription();
  const createSubscription = useCreateSubscription();

  const handleSelectPlan = async (planSlug: string) => {
    try {
      await createSubscription.mutateAsync({
        planSlug,
        billingCycle,
        startTrial: true,
      });

      // Navigate to success or dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to create subscription:', error);
      // Show error message
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <Skeleton className="h-10 w-64 mx-auto mb-4" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[600px]" />
          ))}
        </div>
      </div>
    );
  }

  const plans = data?.plans || [];
  const features = data?.features || [];

  // Group features by category
  const featuresByCategory = features.reduce((acc, feature) => {
    const category = feature.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(feature);
    return acc;
  }, {} as Record<string, typeof features>);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose the Right Plan for Your Business</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Start with a free trial. No credit card required. Cancel anytime.
        </p>

        {/* Billing Toggle */}
        <Tabs value={billingCycle} onValueChange={(v) => setBillingCycle(v as 'monthly' | 'annual')} className="inline-block">
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual">
              Annual
              <Badge variant="secondary" className="ml-2">
                Save 20%
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {plans.map((plan) => {
          const price = billingCycle === 'annual' ? parseFloat(plan.annualPrice) / 12 : parseFloat(plan.monthlyPrice);
          const totalPrice = billingCycle === 'annual' ? parseFloat(plan.annualPrice) : parseFloat(plan.monthlyPrice);

          const isCurrentPlan = subscription?.plan?.slug === plan.slug;
          const canUpgrade = subscription?.plan &&
            plans.findIndex(p => p.slug === subscription.plan?.slug) <
            plans.findIndex(p => p.slug === plan.slug);

          return (
            <Card
              key={plan.id}
              className={`relative ${
                plan.isPopular ? 'border-primary shadow-lg scale-105' : ''
              } ${isCurrentPlan ? 'border-emerald-500' : ''}`}
            >
              {plan.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge variant="outline" className="bg-emerald-500 text-white border-emerald-600">
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Pricing */}
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${price.toFixed(0)}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  {billingCycle === 'annual' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ${totalPrice.toFixed(0)} billed annually
                    </p>
                  )}
                  {plan.trialEnabled && !subscription?.hasSubscription && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                      <Sparkles className="h-4 w-4 inline mr-1" />
                      {plan.trialDays}-day free trial
                    </p>
                  )}
                </div>

                {/* Limits */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Users:</span>
                    <span className="font-medium">{plan.maxUsers === -1 ? 'Unlimited' : plan.maxUsers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Storage:</span>
                    <span className="font-medium">{plan.maxStorage === -1 ? 'Unlimited' : `${plan.maxStorage}GB`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API Calls:</span>
                    <span className="font-medium">{plan.maxApiCalls === -1 ? 'Unlimited' : plan.maxApiCalls.toLocaleString()}/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Locations:</span>
                    <span className="font-medium">{plan.maxLocations === -1 ? 'Unlimited' : plan.maxLocations}</span>
                  </div>
                </div>

                {/* Top Features */}
                <div className="space-y-2">
                  {plan.features.slice(0, 8).map((featureSlug) => {
                    const feature = features.find(f => f.slug === featureSlug);
                    return feature ? (
                      <div key={feature.id} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feature.name}</span>
                      </div>
                    ) : null;
                  })}
                  {plan.features.length > 8 && (
                    <p className="text-sm text-muted-foreground">
                      + {plan.features.length - 8} more features
                    </p>
                  )}
                </div>
              </CardContent>

              <CardFooter>
                {isCurrentPlan ? (
                  <Button className="w-full" variant="outline" disabled>
                    Current Plan
                  </Button>
                ) : canUpgrade ? (
                  <Button
                    className="w-full"
                    onClick={() => navigate('/settings/subscription')}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Upgrade to {plan.name}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.isPopular ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(plan.slug)}
                    disabled={createSubscription.isPending}
                  >
                    {subscription?.hasSubscription ? `Switch to ${plan.name}` : `Start ${plan.trialDays}-Day Trial`}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <div className="mt-16">
        <h2 className="text-3xl font-bold text-center mb-8">Complete Feature Comparison</h2>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-semibold">Feature</th>
                {plans.map((plan) => (
                  <th key={plan.id} className="text-center p-4 font-semibold">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(featuresByCategory).map(([category, categoryFeatures]) => (
                <>
                  <tr key={category} className="bg-muted/30">
                    <td colSpan={plans.length + 1} className="p-3 font-semibold text-sm">
                      {category}
                    </td>
                  </tr>
                  {categoryFeatures.map((feature) => (
                    <tr key={feature.id} className="border-t hover:bg-muted/20">
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{feature.name}</div>
                          {feature.description && (
                            <div className="text-sm text-muted-foreground">{feature.description}</div>
                          )}
                        </div>
                      </td>
                      {plans.map((plan) => (
                        <td key={plan.id} className="p-4 text-center">
                          {plan.features.includes(feature.slug) ? (
                            <Check className="h-5 w-5 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ or CTA Section */}
      <div className="mt-16 text-center">
        <h3 className="text-2xl font-bold mb-4">Need a custom plan?</h3>
        <p className="text-muted-foreground mb-6">
          Contact us for enterprise pricing and custom features tailored to your needs.
        </p>
        <Button size="lg" variant="outline">
          Contact Sales
        </Button>
      </div>
    </div>
  );
}
