/**
 * DealInsightsPanel (COP-B11).
 *
 * Renders the deal health score from shared/deal-score.ts, plus the AI
 * narrative over the deal's real interaction history. Three things it
 * deliberately does NOT do:
 *
 *  - It never shows a number when the deal is too sparse to justify one. A
 *    fabricated score gets quoted in a forecast; a blank does not.
 *  - It does not hide its reasoning. Every contributing factor is listed with
 *    the plain-language reason that earned it, so a rep can disagree with the
 *    score instead of ignoring it.
 *  - It does not generate a narrative on render. The summary is read from the
 *    cache and labelled out of date when the deal has moved since; writing a
 *    new one is a click, because an LLM call per page view is a bill nobody
 *    agreed to (AC6).
 */
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scoreDeal, PLANNED_FACTORS, type DealScoreBand } from '@shared/deal-score';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Info, RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DealLike {
  id?: string | null;
  status?: string | null;
  amount?: string | null;
  probability?: number | null;
  createdAt?: string | null;
  lastActivityDate?: string | null;
  nextFollowUpDate?: string | null;
  expectedCloseDate?: string | null;
  stageEnteredAt?: string | null;
  stageSlaDays?: number | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  contactCount?: number | null;
  // COP-M04 copier facts. The deals edge function returns all three.
  incumbentVendor?: string | null;
  leaseBuyoutExposure?: string | number | null;
  forecastCategory?: string | null;
  // COP-B02: the deal's most recent live quote, fed by /api/deals/:id.
  quoteMarginPct?: number | null;
  quoteDiscountPct?: number | null;
}

interface DealSummaryResponse {
  summary: string | null;
  generatedAt: string | null;
  model: string | null;
  sourceEntryCount: number | null;
  /** The stored summary describes an older version of this deal. */
  stale: boolean;
  /** False when there is no interaction history to write a summary from. */
  canGenerate: boolean;
  entryCount: number;
}

const BAND_STYLES: Record<DealScoreBand, { label: string; className: string }> = {
  strong: { label: 'Strong', className: 'bg-emerald-100 text-emerald-800' },
  steady: { label: 'Steady', className: 'bg-sky-100 text-sky-800' },
  at_risk: { label: 'At risk', className: 'bg-amber-100 text-amber-900' },
  critical: { label: 'Critical', className: 'bg-rose-100 text-rose-800' },
};

export function DealInsightsPanel({
  deal,
  activityCount,
}: {
  deal: DealLike;
  /** Timeline length, used only to note when there is nothing to read from. */
  activityCount?: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dealId = deal.id ?? undefined;

  // Read-only. The endpoint never generates on GET, so opening a deal costs
  // one cheap row read and no model call.
  const summaryQuery = useQuery<DealSummaryResponse>({
    queryKey: [`/api/deals/${dealId}/summary`],
    queryFn: () => apiRequest(`/api/deals/${dealId}/summary`),
    enabled: Boolean(dealId),
    staleTime: 60_000,
  });

  const generateSummary = useMutation({
    mutationFn: () => apiRequest(`/api/deals/${dealId}/summary`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/summary`] });
    },
    onError: (err: unknown) => {
      // The endpoint's refusals are meaningful - no history to summarise, no
      // model configured - so the message is shown rather than swallowed into
      // a generic failure toast.
      toast({
        title: 'Could not write a summary',
        description: err instanceof Error ? err.message : 'The summary model did not answer.',
        variant: 'destructive',
      });
    },
  });

  const summary = summaryQuery.data;

  const result = useMemo(
    () =>
      scoreDeal({
        status: deal.status,
        amount: deal.amount,
        probability: deal.probability,
        createdAt: deal.createdAt,
        lastActivityDate: deal.lastActivityDate,
        nextFollowUpDate: deal.nextFollowUpDate,
        expectedCloseDate: deal.expectedCloseDate,
        stageEnteredAt: deal.stageEnteredAt,
        stageSlaDays: deal.stageSlaDays,
        contactCount: deal.contactCount,
        primaryContactEmail: deal.primaryContactEmail,
        primaryContactPhone: deal.primaryContactPhone,
        incumbentVendor: deal.incumbentVendor,
        leaseBuyoutExposure: deal.leaseBuyoutExposure,
        forecastCategory: deal.forecastCategory,
        quoteMarginPct: deal.quoteMarginPct,
        quoteDiscountPct: deal.quoteDiscountPct,
      }),
    [deal],
  );

  const band = BAND_STYLES[result.band];

  return (
    <div className="space-y-4">
      {/* ── Score, or an honest refusal to give one ───────────────── */}
      {result.scored ? (
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-semibold tabular-nums">{result.score}</span>
          <Badge className={cn('font-medium', band.className)}>{band.label}</Badge>
        </div>
      ) : (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Not enough signal to score this deal yet. Scoring needs at least three of: recent
            activity, a next step, an expected close date, a stage SLA, or contact coverage.
          </p>
        </div>
      )}

      {/* ── Risks, in plain language ──────────────────────────────── */}
      {result.risks.length > 0 && (
        <ul className="space-y-2">
          {result.risks.map((risk) => (
            <li key={risk.key} className="flex items-start gap-2 text-sm">
              <AlertTriangle
                className={cn(
                  'h-4 w-4 mt-0.5 shrink-0',
                  risk.severity === 'critical' ? 'text-rose-600' : 'text-amber-600',
                )}
              />
              <span>{risk.message}</span>
            </li>
          ))}
        </ul>
      )}

      {/* ── Why the score is what it is ───────────────────────────── */}
      {result.factors.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t">
          <p className="text-xs font-medium text-muted-foreground pt-2">What moved this</p>
          {result.factors.map((factor) => (
            <div key={factor.key} className="flex items-start gap-2 text-xs">
              {factor.points >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-rose-600" />
              )}
              <span className="min-w-0">
                <span className="font-medium">{factor.label}</span>{' '}
                <span className="tabular-nums text-muted-foreground">
                  ({factor.points > 0 ? '+' : ''}
                  {factor.points})
                </span>
                <span className="block text-muted-foreground">{factor.reason}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── What would sharpen the read ───────────────────────────── */}
      {result.missingSignals.length > 0 && (
        <p className="text-xs text-muted-foreground border-t pt-2">
          Not counted, because it is not recorded: {result.missingSignals.join(', ')}.
        </p>
      )}

      {activityCount === 0 && (
        <p className="text-xs text-muted-foreground">
          There is no logged activity on this deal, so recency cannot be read from the timeline.
        </p>
      )}

      {/* ── The narrative, over what actually happened ────────────── */}
      <div className="border-t pt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Summary
          </p>
          {summary?.canGenerate && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={generateSummary.isPending}
              onClick={() => generateSummary.mutate()}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5 mr-1', generateSummary.isPending && 'animate-spin')}
              />
              {summary.summary ? 'Rewrite' : 'Write one'}
            </Button>
          )}
        </div>

        {summaryQuery.isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : summary && !summary.canGenerate ? (
          <p className="text-xs text-muted-foreground">
            Nothing to summarise yet. A summary is written from the deal&apos;s logged calls,
            emails, meetings and notes, and this deal has none.
          </p>
        ) : summary?.summary ? (
          <>
            <p className="text-sm leading-relaxed">{summary.summary}</p>
            <p className="text-xs text-muted-foreground">
              {summary.stale
                ? 'This deal has changed since the summary was written.'
                : `Written from ${summary.sourceEntryCount ?? 0} timeline ${
                    summary.sourceEntryCount === 1 ? 'entry' : 'entries'
                  }.`}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No summary has been written for this deal yet.
          </p>
        )}
      </div>

      {/* Only when there IS an unbacked signal. Every one has a producer as
          of COP-B02's deal-to-quote link, so this normally renders nothing. */}
      {PLANNED_FACTORS.length > 0 && (
        <p className="text-xs text-muted-foreground border-t pt-2">
          Not yet scored, because nothing produces it: {PLANNED_FACTORS.join(', ')}.
        </p>
      )}
    </div>
  );
}
