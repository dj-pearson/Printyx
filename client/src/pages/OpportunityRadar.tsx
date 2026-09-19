/**
 * Installed-Base Opportunity Radar (COP-B04).
 *
 * Today's best opportunities out of the dealer's own installed base, ranked.
 * Every row is a dated fact - a lease end, a contract end, a metered overage,
 * a silent device - never an inference about intent.
 *
 * Two things it is careful about. A play worth an UNKNOWN amount shows a dash
 * rather than $0, because a zero sorts a real opportunity to the bottom of a
 * list ranked by value. And the gaps come from the server's `unbacked` array
 * and are rendered: the service play counts calls rather than cost because no
 * cost column exists, and scoping is by account ownership because the territory
 * model does not exist yet.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrencyWhole } from '@/lib/utils';
import { Info, Radar, RefreshCw } from 'lucide-react';

interface Play {
  id: string;
  playType: string;
  customerId: string | null;
  companyName: string | null;
  equipmentIds: string[];
  reason: string;
  triggerDate: string | null;
  estimatedValue: number | null;
  score: number;
  scoreFactors: Record<string, unknown>;
  status: string;
  dealId: string | null;
}

interface PlaysResponse {
  data: Play[];
  total: number;
  unbacked: string[];
}

const PLAY_LABELS: Record<string, string> = {
  lease_expiring: 'Lease expiring',
  contract_ending: 'Contract ending',
  volume_over_tier: 'Over contracted tier',
  service_burden: 'Service burden',
  color_underused: 'Colour underused',
  meters_not_reporting: 'Not reporting meters',
};

export default function OpportunityRadar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [playType, setPlayType] = useState('all');
  const [mine, setMine] = useState('all');

  const params = new URLSearchParams();
  if (playType !== 'all') params.set('playType', playType);
  if (mine === 'mine') params.set('mine', 'true');
  const key = `/api/opportunity-radar${params.toString() ? `?${params}` : ''}`;

  const playsQuery = useQuery<PlaysResponse>({
    queryKey: [key],
    queryFn: () => apiRequest(key),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [key.split('?')[0]], exact: false });

  const scan = useMutation({
    mutationFn: () => apiRequest('/api/opportunity-radar/scan', 'POST'),
    onSuccess: (r: {
      detected?: number;
      created?: number;
      alreadyKnown?: number;
      skipped?: boolean;
      reason?: string;
    }) => {
      if (r.skipped) {
        toast({ title: 'Scan is disabled for this tenant', description: r.reason });
        return;
      }
      toast({
        title: `${r.created ?? 0} new play(s)`,
        // alreadyKnown is the idempotency working, not a failure, so it is
        // phrased as a fact rather than buried.
        description: `${r.detected ?? 0} triggers found; ${r.alreadyKnown ?? 0} were already on the board.`,
      });
      invalidate();
    },
    onError: (err: unknown) =>
      toast({
        title: 'Scan failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/opportunity-radar/${id}/dismiss`, 'POST'),
    onSuccess: () => {
      toast({ title: 'Play dismissed' });
      invalidate();
    },
    onError: () => toast({ title: 'Could not dismiss the play', variant: 'destructive' }),
  });

  const convert = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/opportunity-radar/${id}/convert`, 'POST'),
    onSuccess: (r: { dealId?: string; equipmentAttached?: number; alreadyConverted?: boolean }) => {
      toast({
        title: r.alreadyConverted ? 'Already converted' : 'Deal created',
        description: r.equipmentAttached
          ? `${r.equipmentAttached} machine(s) attached to the deal.`
          : undefined,
      });
      invalidate();
      if (r.dealId) navigate(`/crm/deals/${r.dealId}`);
    },
    onError: (err: unknown) =>
      toast({
        title: 'Could not create the deal',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  const plays = playsQuery.data?.data ?? [];

  return (
    <MainLayout
      title="Opportunity radar"
      description="Today's plays out of your own installed base — every one a dated fact, ranked by value and urgency."
    >
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Radar className="h-4 w-4" /> Plays
            {plays.length > 0 && (
              <Badge variant="outline" className="font-normal">
                {plays.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={mine} onValueChange={setMine}>
              <SelectTrigger className="w-[150px]" aria-label="Ownership filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                <SelectItem value="mine">My accounts</SelectItem>
              </SelectContent>
            </Select>
            <Select value={playType} onValueChange={setPlayType}>
              <SelectTrigger className="w-[190px]" aria-label="Play type filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Every play type</SelectItem>
                {Object.entries(PLAY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => scan.mutate()}
              disabled={scan.isPending}
            >
              <RefreshCw
                className={scan.isPending ? 'h-4 w-4 mr-1.5 animate-spin' : 'h-4 w-4 mr-1.5'}
              />
              Scan now
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {playsQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : plays.length === 0 ? (
            <EmptyState
              title="No open plays"
              description="Run a scan to look for expiring leases, ending contracts, metered overages and devices that have gone quiet."
            />
          ) : (
            plays.map((play) => (
              <div key={play.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{play.companyName ?? 'Unnamed account'}</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {PLAY_LABELS[play.playType] ?? play.playType}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-normal tabular-nums">
                        score {play.score}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{play.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="tabular-nums font-medium">
                      {/* A dash, not $0: an unknown value is not a zero value. */}
                      {play.estimatedValue == null ? '—' : formatCurrencyWhole(play.estimatedValue)}
                    </div>
                    {play.triggerDate && (
                      <div className="text-xs text-muted-foreground">
                        {new Date(play.triggerDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={convert.isPending}
                    onClick={() => convert.mutate(play.id)}
                  >
                    Create deal
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={dismiss.isPending}
                    onClick={() => dismiss.mutate(play.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))
          )}

          {(playsQuery.data?.unbacked ?? []).map((note, i) => (
            <p
              key={i}
              className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-2"
            >
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{note}</span>
            </p>
          ))}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
