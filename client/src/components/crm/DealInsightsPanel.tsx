/**
 * DealInsightsPanel (COP-B11).
 *
 * Renders the deal health score from shared/deal-score.ts. Two things it
 * deliberately does NOT do:
 *
 *  - It never shows a number when the deal is too sparse to justify one. A
 *    fabricated score gets quoted in a forecast; a blank does not.
 *  - It does not hide its reasoning. Every contributing factor is listed with
 *    the plain-language reason that earned it, so a rep can disagree with the
 *    score instead of ignoring it.
 *
 * The AI narrative half of COP-B11 is not here: it needs an LLM endpoint over
 * the deal's real interaction history, which is not wired up. That absence is
 * stated rather than filled with generated-sounding filler.
 */
import { useMemo } from 'react';
import { scoreDeal, PLANNED_FACTORS, type DealScoreBand } from '@shared/deal-score';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DealLike {
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

      <p className="text-xs text-muted-foreground border-t pt-2">
        Coming with the copier deal fields: {PLANNED_FACTORS.join(', ')}. An AI narrative summary
        needs an LLM over this deal&apos;s interaction history, which is not connected yet.
      </p>
    </div>
  );
}
