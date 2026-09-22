/**
 * Installed-base plays on the My Day workspace (COP-B04 AC4).
 *
 * The radar has had its own page since COP-B04 shipped, and a page a rep has
 * to remember to open is a page a rep does not open. This is the same ranked
 * list where they already are, scoped to their own accounts.
 *
 * It shows the radar's OWN score and reason rather than recomputing either -
 * the same rule COP-B03's suggestion mapper follows, and for the same reason:
 * two places deriving "why this account matters" will eventually disagree, in
 * front of a customer.
 */
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyWhole } from '@/lib/utils';
import { Radar } from 'lucide-react';

interface RadarPlay {
  id: string;
  playType: string;
  companyName: string | null;
  reason: string;
  estimatedValue: number | null;
  score: number;
}

const LIST_KEY = '/api/opportunity-radar?mine=true&limit=5';

export function RadarPlaysCard() {
  const [, navigate] = useLocation();

  const query = useQuery<{ data: RadarPlay[]; total: number }>({
    queryKey: [LIST_KEY],
    queryFn: () => apiRequest(LIST_KEY),
    staleTime: 5 * 60_000,
  });

  if (query.isLoading) return <Skeleton className="h-40 w-full" />;

  const plays = (query.data?.data ?? []).slice(0, 5);
  // Nothing on the radar is a normal week, not a card worth the space.
  if (!query.isError && plays.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Installed-base plays</CardTitle>
          {plays.length > 0 && (
            <Badge variant="outline" className="font-normal">
              {query.data?.total ?? plays.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {query.isError ? (
          <p className="text-sm text-muted-foreground">
            The radar did not load. Nothing here is stale or partial — it simply did not load.
          </p>
        ) : (
          <>
            {plays.map((play) => (
              <button
                key={play.id}
                type="button"
                onClick={() => navigate('/opportunity-radar')}
                className="w-full text-left flex items-start justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {play.companyName ?? 'Unnamed account'}
                  </div>
                  <p className="text-sm text-muted-foreground">{play.reason}</p>
                </div>
                <span className="shrink-0 text-sm tabular-nums">
                  {/* A play with no estimable value shows nothing rather than
                      $0 - the radar reports that absence deliberately. */}
                  {play.estimatedValue == null ? '' : formatCurrencyWhole(play.estimatedValue)}
                </span>
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => navigate('/opportunity-radar')}
            >
              Open the radar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
