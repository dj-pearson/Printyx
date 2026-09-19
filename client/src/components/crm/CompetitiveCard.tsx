/**
 * The competitive card on the deal record (COP-B10, AC1 + AC2).
 *
 * Who this deal is against, what the account has said about competitors
 * before, and the battlecard when somebody has written one.
 *
 * Two things it will not do. It does not invent a competitor: a deal with no
 * incumbent recorded says so and offers nothing, because "no competitor" and
 * "nobody filled this in" are different facts and only one of them is knowable
 * here. And it does not dress an unwritten battlecard up as an empty one - a
 * competitor nobody has written about gets a line saying so, addressed to the
 * manager who can fix it.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Info, Swords } from 'lucide-react';

interface Objection {
  objection: string;
  response: string;
}

interface Battlecard {
  id: string;
  name: string;
  positioning: string | null;
  commonObjections: Objection[];
  whereWeWin: string | null;
  whereWeLose: string | null;
}

interface CompetitiveResponse {
  dealId: string;
  incumbent: { name: string; raw: string; battlecard: Battlecard | null } | null;
  accountHistory: Array<{ name: string; raw: string; battlecardId: string | null }>;
  lostToCompetitorBefore: boolean;
  churnedDate: string | null;
  canAuthor: boolean;
}

export function CompetitiveCard({ dealId }: { dealId?: string }) {
  const { data, isLoading } = useQuery<CompetitiveResponse>({
    queryKey: [`/api/competitors/for-deal/${dealId}`],
    queryFn: () => apiRequest(`/api/competitors/for-deal/${dealId}`),
    enabled: Boolean(dealId),
    staleTime: 300_000,
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!data) return null;

  const card = data.incumbent?.battlecard ?? null;

  return (
    <div className="space-y-3">
      {data.incumbent ? (
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium">{data.incumbent.name}</span>
          <Badge variant="outline" className="text-xs">
            Incumbent
          </Badge>
        </div>
      ) : (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>No incumbent vendor recorded on this deal.</p>
        </div>
      )}

      {/* The single most useful thing to know in the room. */}
      {data.lostToCompetitorBefore && (
        <div className="flex items-start gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <span>
            This account has left for a competitor before
            {data.churnedDate ? ` (${new Date(data.churnedDate).toLocaleDateString()})` : ''}.
          </span>
        </div>
      )}

      {data.accountHistory.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Also named on this account: {data.accountHistory.map((c) => c.name).join(', ')}.
        </div>
      )}

      {card ? (
        <div className="space-y-2 border-t pt-3">
          {card.positioning && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">How we position</p>
              <p className="text-sm whitespace-pre-line">{card.positioning}</p>
            </div>
          )}

          {card.commonObjections?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">What they will say</p>
              <ul className="space-y-1.5 mt-1">
                {card.commonObjections.map((o, i) => (
                  <li key={i} className="text-sm">
                    <span className="block italic text-muted-foreground">
                      &ldquo;{o.objection}&rdquo;
                    </span>
                    <span className="block">{o.response}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {card.whereWeWin && (
              <div>
                <p className="text-xs font-medium text-emerald-700">Where we win</p>
                <p className="text-sm whitespace-pre-line">{card.whereWeWin}</p>
              </div>
            )}
            {/* Shown as prominently as the wins. A battlecard that only lists
                strengths is marketing, and reps stop reading it. */}
            {card.whereWeLose && (
              <div>
                <p className="text-xs font-medium text-rose-700">Where we lose</p>
                <p className="text-sm whitespace-pre-line">{card.whereWeLose}</p>
              </div>
            )}
          </div>
        </div>
      ) : data.incumbent ? (
        <p className="text-xs text-muted-foreground border-t pt-3">
          No battlecard has been written for {data.incumbent.name}.
          {data.canAuthor ? (
            <>
              {' '}
              <Link href="/competitors" className="underline">
                Write one
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
