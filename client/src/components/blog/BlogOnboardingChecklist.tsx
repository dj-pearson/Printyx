import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Circle, Clock, Loader2, Sparkles } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  complete: boolean;
  count: number;
  healthy_count?: number;
  action_label: string;
  action_path: string;
  available: boolean;
  story_id?: string;
}

interface OnboardingResponse {
  steps: OnboardingStep[];
  summary: {
    total: number;
    completed: number;
    percent_complete: number;
    all_done: boolean;
  };
}

/**
 * Onboarding checklist (US-BLOG-082).
 *
 * Surfaces configuration completeness across the 6 settings pages plus
 * milestones for the not-yet-shipped features (post editor, GA4, social).
 * Renders as a card on the Blog Dashboard. Auto-hides when all available
 * steps are complete (admin can re-show via a future toggle).
 */
export function BlogOnboardingChecklist() {
  const { data, isLoading } = useQuery<OnboardingResponse>({
    queryKey: ['/api/blog-onboarding'],
    queryFn: () => apiRequest('/api/blog-onboarding'),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading onboarding…
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { steps, summary } = data;
  const availableSteps = steps.filter((s) => s.available);
  const upcomingSteps = steps.filter((s) => !s.available);

  return (
    <Card className={summary.all_done ? 'border-emerald-200 bg-emerald-50/40' : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              {summary.all_done ? (
                <Sparkles className="h-4 w-4 text-emerald-600" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
              {summary.all_done ? "You're set up" : 'Get started'}
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                US-BLOG-082
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              {summary.all_done
                ? 'Every available configuration step is done. Future milestones unlock as their stories ship.'
                : `${summary.completed} of ${summary.total} steps complete (${summary.percent_complete}%)`}
            </CardDescription>
          </div>
        </div>
        {!summary.all_done ? (
          <div
            className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={summary.percent_complete}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${summary.percent_complete}%` }}
            />
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-1">
          {availableSteps.map((step) => (
            <StepRow key={step.key} step={step} />
          ))}
        </ul>
        {upcomingSteps.length > 0 ? (
          <details className="pt-2 group">
            <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground">
              {upcomingSteps.length} upcoming milestone{upcomingSteps.length === 1 ? '' : 's'} (not
              yet shipped) →
            </summary>
            <ul className="mt-2 space-y-1">
              {upcomingSteps.map((step) => (
                <StepRow key={step.key} step={step} />
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StepRow({ step }: { step: OnboardingStep }) {
  const isUnavailable = !step.available;

  return (
    <li
      className={`flex items-center gap-3 rounded-md p-2 ${
        isUnavailable ? 'opacity-60' : 'hover:bg-muted/30 transition-colors'
      }`}
    >
      <div className="shrink-0">
        {step.complete ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : isUnavailable ? (
          <Clock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm ${step.complete ? 'line-through text-muted-foreground' : 'font-medium'}`}
          >
            {step.label}
          </span>
          {isUnavailable && step.story_id ? (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
              {step.story_id}
            </Badge>
          ) : null}
          {step.count > 0 ? (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              {step.count} configured
              {step.healthy_count !== undefined && step.healthy_count > 0
                ? ` · ${step.healthy_count} healthy`
                : ''}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{step.description}</p>
      </div>
      <div className="shrink-0">
        {isUnavailable ? null : (
          <Button asChild size="sm" variant={step.complete ? 'ghost' : 'outline'}>
            <Link to={step.action_path}>
              {step.action_label}
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

export default BlogOnboardingChecklist;
