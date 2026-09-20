/**
 * The two manager cards on My Day (COP-B01 AC6).
 *
 * `team-pipeline` and `team-activity` shipped in the card catalogue - declared,
 * role-gated at MANAGER, orderable in the customizer - and rendered NOTHING,
 * because no endpoint answered them. The card boundary showed an empty card
 * rather than an error, so the feature was missing in the politest way
 * possible: a manager could add the card, see a blank, and reasonably conclude
 * their team had a quiet week.
 *
 * Both cards read one request. `GET /crm/team-rollup` resolves whose rows the
 * caller may see through the same `resolveScope` the CRM lists use, so the team
 * is the org structure's answer rather than anything the client asks for.
 *
 * WHAT THE CARDS REFUSE TO DO: render a zero they did not measure. A roll-up
 * the server could not compute comes back null and the card renders nothing -
 * "0 activities this week" about a team that is working is worse than an empty
 * space, and the server already distinguishes the two.
 */
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyWhole } from '@/lib/utils';
import { Users, TrendingUp } from 'lucide-react';

interface PipelineMember {
  userId: string;
  name: string;
  openCount: number;
  openAmount: number;
  uncostedCount: number;
}

interface ActivityMember {
  userId: string;
  name: string;
  total: number;
  byType: Record<string, number>;
}

export interface TeamRollupResponse {
  windowDays: number;
  memberCount: number;
  pipeline: {
    members: PipelineMember[];
    unassigned: { count: number; amount: number; uncostedCount: number };
    totalCount: number;
    totalAmount: number;
    totalIsFloor: boolean;
  } | null;
  activity: {
    members: ActivityMember[];
    unassigned: number;
    total: number;
  } | null;
  scopeTier: string;
  coversWholeTenant: boolean;
  degradedFrom: string | null;
}

const ROLLUP_KEY = '/api/crm/team-rollup?days=7';

function useTeamRollup() {
  return useQuery<TeamRollupResponse>({
    queryKey: [ROLLUP_KEY],
    queryFn: () => apiRequest(ROLLUP_KEY),
    staleTime: 5 * 60_000,
    // A rep who opened this card before a demotion gets a 403; retrying it
    // every focus would be a wasted request per card per minute.
    retry: false,
  });
}

/** "your team" or "the company", so a number's subject is never left implied. */
function scopeLabel(data: TeamRollupResponse): string {
  return data.coversWholeTenant ? 'the company' : 'your team';
}

export function TeamPipelineCard() {
  const [, navigate] = useLocation();
  const query = useTeamRollup();

  if (query.isLoading) return <Skeleton className="h-40 w-full" />;
  // A 403 means this user is not a manager any more. The card belongs to a
  // role they no longer hold, so it renders nothing rather than an error.
  if (query.isError || !query.data?.pipeline) return null;

  const { pipeline } = query.data;
  const rows = pipeline.members.slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Team pipeline</CardTitle>
          <Badge variant="outline" className="font-normal">
            {formatCurrencyWhole(pipeline.totalAmount)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {pipeline.totalCount} open {pipeline.totalCount === 1 ? 'deal' : 'deals'} across{' '}
          {scopeLabel(query.data)}
          {pipeline.totalIsFloor && ' - at least, some carry no amount'}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nobody on {scopeLabel(query.data)} has an open deal.
          </p>
        )}
        {rows.map((member) => (
          <button
            key={member.userId}
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted"
            onClick={() => navigate(`/crm/deals?ownerId=${encodeURIComponent(member.userId)}`)}
          >
            <span className="truncate text-sm">{member.name}</span>
            <span className="flex items-center gap-2 shrink-0 text-sm">
              <span className="text-muted-foreground">{member.openCount}</span>
              <span className="font-medium">{formatCurrencyWhole(member.openAmount)}</span>
            </span>
          </button>
        ))}

        {/* COP-B10: the unassigned bucket is shown, never folded away. A
            per-rep list that silently omits ownerless deals stops adding up to
            the total printed above it. */}
        {pipeline.unassigned.count > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-2 py-1.5 text-sm">
            <span className="text-muted-foreground">Unassigned</span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">{pipeline.unassigned.count}</span>
              <span className="font-medium">{formatCurrencyWhole(pipeline.unassigned.amount)}</span>
            </span>
          </div>
        )}

        {pipeline.members.length > rows.length && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => navigate('/sales-pipeline-forecasting')}
          >
            See all {pipeline.members.length}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function TeamActivityCard() {
  const query = useTeamRollup();

  if (query.isLoading) return <Skeleton className="h-40 w-full" />;
  if (query.isError || !query.data?.activity) return null;

  const { activity, windowDays } = query.data;
  const rows = activity.members.slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Team activity</CardTitle>
          <Badge variant="outline" className="font-normal">
            {activity.total}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Logged across {scopeLabel(query.data)} in the last {windowDays} days
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {activity.total === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing logged in the last {windowDays} days.
          </p>
        )}
        {rows.map((member) => (
          <div key={member.userId} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{member.name}</span>
            <span className="shrink-0 font-medium">{member.total}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
