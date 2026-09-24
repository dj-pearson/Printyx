/**
 * Tenant onboarding (round 221).
 *
 * This page offered a "Create Tenant Instance" form (company name, slug, plan)
 * whose button had no handler, and nothing in either backend creates a tenant
 * from an admin screen: root-admin lists, suspends and activates tenants and
 * has no create route. It also priced the plans at $49/$99/$199 against the
 * $79/$99/$149 shared/pricing-plans.ts publishes and Stripe charges; promised
 * a `<slug>.printyx.net` subdomain, which only the Express tenancy middleware
 * resolves and production never runs for a page load; and showed a "Current
 * Demo Tenant Status" card with a hardcoded tenant id, slug, plan and status.
 *
 * A new organisation is created one way: self-service signup, which calls
 * supabase/functions/signup, creates the tenant and makes the person who
 * signed up its Company Admin (LAUNCH-008). This page says so and hands over
 * the link.
 */
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, ExternalLink, Rocket } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { PRICING_PLANS } from '@shared/pricing-plans';
import { formatCurrencyWhole } from '@/lib/utils';

export const SIGNUP_PATH = '/signup';

export default function TenantSetup() {
  const { toast } = useToast();
  const signupUrl = `${window.location.origin}${SIGNUP_PATH}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(signupUrl);
      toast({ title: 'Signup link copied' });
    } catch {
      toast({
        title: 'Could not copy',
        description: 'Select the link and copy it by hand.',
        variant: 'destructive',
      });
    }
  };

  return (
    <MainLayout
      title="Tenant Onboarding"
      description="How a new dealer organisation gets its own Printyx instance"
    >
      <div className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              New organisations sign up themselves
            </CardTitle>
            <CardDescription>
              Signing up creates the tenant, and the person who signs up becomes its Company Admin.
              Tenants are not created from this screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={signupUrl} readOnly aria-label="Signup link" className="text-sm" />
              <Button variant="outline" size="sm" onClick={copy} aria-label="Copy signup link">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button asChild variant="outline">
              <Link href={SIGNUP_PATH}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open signup
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
            <CardDescription>What a new organisation is offered at signup</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {PRICING_PLANS.map((p) => (
                <li key={p.name} className="flex justify-between border-b pb-2 last:border-b-0">
                  <span>{p.name}</span>
                  <span className="text-muted-foreground">
                    {formatCurrencyWhole(p.monthlyPrice / 100)}/month for the tenant,{' '}
                    {p.maxUsers === 'unlimited' ? 'unlimited users' : `up to ${p.maxUsers} users`}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
