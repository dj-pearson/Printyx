/**
 * CRMX-014: canonical guided onboarding flow. One progress-tracked checklist of
 * first-value actions, replacing the fragmented setup/onboarding forms. State is
 * durable + per-tenant/per-user (resumable) via useOnboarding.
 */
import { useLocation } from 'wouter';
import MainLayout from '@/components/layout/main-layout';
import { useOnboarding } from '@/hooks/useOnboarding';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Upload,
  Handshake,
  UserPlus,
  Mail,
  FileText,
  Check,
  ArrowRight,
  PartyPopper,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  path: string;
  icon: LucideIcon;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'import_data',
    title: 'Import your data',
    description: 'Bring in your existing customers, leads, and equipment.',
    ctaLabel: 'Import data',
    path: '/data-import',
    icon: Upload,
  },
  {
    id: 'create_deal',
    title: 'Create your first deal',
    description: 'Start tracking an opportunity through your pipeline.',
    ctaLabel: 'Go to deals',
    path: '/deals',
    icon: Handshake,
  },
  {
    id: 'invite_teammate',
    title: 'Invite a teammate',
    description: 'Add your team so everyone works from the same CRM.',
    ctaLabel: 'Manage users',
    path: '/admin/user-management',
    icon: UserPlus,
  },
  {
    id: 'connect_email',
    title: 'Connect email & calendar',
    description: 'Sync your inbox and calendar to log activity automatically.',
    ctaLabel: 'Open settings',
    path: '/settings',
    icon: Mail,
  },
  {
    id: 'build_form',
    title: 'Publish a web form',
    description: 'Capture leads straight from your website into the CRM.',
    ctaLabel: 'Build a form',
    path: '/marketing/forms',
    icon: FileText,
  },
];

export default function GettingStarted() {
  const [, navigate] = useLocation();
  const { completedSteps, isComplete, isLoading, toggleStep } = useOnboarding(STEPS.length);

  const doneCount = completedSteps.length;
  const pct = Math.round((doneCount / STEPS.length) * 100);

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Getting started</h1>
          <p className="text-muted-foreground text-sm">
            A few steps to get the most out of Printyx. Your progress is saved automatically.
          </p>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {doneCount} of {STEPS.length} complete
              </span>
              <span className="text-sm text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {isComplete && (
              <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
                <PartyPopper className="h-4 w-4" />
                You&apos;re all set — nice work!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Checklist */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: STEPS.length }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {STEPS.map((step) => {
              const done = completedSteps.includes(step.id);
              const Icon = step.icon;
              return (
                <Card key={step.id} className={done ? 'border-green-200 bg-green-50/40' : ''}>
                  <CardContent className="py-4 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => toggleStep(step.id)}
                      aria-label={done ? `Mark ${step.title} not done` : `Mark ${step.title} done`}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        done
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-muted-foreground/30 text-transparent hover:border-primary'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p
                          className={`font-medium ${done ? 'line-through text-muted-foreground' : ''}`}
                        >
                          {step.title}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                    <Button
                      variant={done ? 'outline' : 'default'}
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={() => navigate(step.path)}
                    >
                      {step.ctaLabel}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
