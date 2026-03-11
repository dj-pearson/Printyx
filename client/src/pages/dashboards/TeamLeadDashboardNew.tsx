/**
 * TEAM LEAD DASHBOARD (Enhanced)
 * Comprehensive dashboard for Team Leads and Sales Supervisors (Level 2-3)
 * Shows team performance, coaching opportunities, and activity metrics
 * RBAC: Requires sales.performance.view_team permission
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  RefreshCw,
  Users,
  Target,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { TeamStatsWidget } from '@/components/stats/TeamStatsWidget';
import { TeamLeaderboard } from '@/components/stats/TeamLeaderboard';
import TeamPerformanceTable from '@/components/reports/team/TeamPerformanceTable';
import { cn } from '@/lib/utils';

interface DateRange {
  from: Date;
  to: Date;
}

export default function TeamLeadDashboardNew() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch coaching report
  const {
    data: coachingData,
    isLoading: coachingLoading,
    refetch: refetchCoaching,
  } = useQuery({
    queryKey: ['team-coaching-report', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/team-reports/coaching?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch coaching report');
      return res.json();
    },
  });

  // Fetch lead management report
  const {
    data: leadData,
    isLoading: leadLoading,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ['team-lead-management', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/team-reports/lead-management?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch lead management');
      return res.json();
    },
  });

  // Fetch pipeline comparison
  const {
    data: pipelineData,
    isLoading: pipelineLoading,
    refetch: refetchPipeline,
  } = useQuery({
    queryKey: ['team-pipeline-comparison', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/team-reports/pipeline-comparison?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch pipeline comparison');
      return res.json();
    },
  });

  const handleRefreshAll = () => {
    refetchCoaching();
    refetchLeads();
    refetchPipeline();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor team performance, activities, and coaching opportunities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={coachingLoading || leadLoading || pipelineLoading}
          >
            <RefreshCw
              className={cn(
                'h-4 w-4 mr-2',
                (coachingLoading || leadLoading || pipelineLoading) && 'animate-spin',
              )}
            />
            Refresh All
          </Button>
        </div>
      </div>

      {/* Coaching Alerts */}
      {coachingData?.insights?.criticalReps > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Coaching Attention Needed</AlertTitle>
          <AlertDescription>
            {coachingData.insights.criticalReps} team member(s) need immediate coaching attention.{' '}
            {coachingData.insights.highPriorityReps > 0 &&
              `${coachingData.insights.highPriorityReps} additional member(s) showing warning signs.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Lead Management Alerts */}
      {leadData?.insights?.urgentActions?.total > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Lead Management Actions Required</AlertTitle>
          <AlertDescription>
            {leadData.insights.urgentActions.unassignedLeads > 0 &&
              `${leadData.insights.urgentActions.unassignedLeads} unassigned leads. `}
            {leadData.insights.urgentActions.overdueFollowups > 0 &&
              `${leadData.insights.urgentActions.overdueFollowups} overdue follow-ups.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelineData?.teamInfo?.teamSize || 0}</div>
            <p className="text-xs text-muted-foreground">Active team members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coaching Needed</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {coachingData?.summary?.needsAttention || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {coachingData?.summary?.criticalFlags || 0} critical flags
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Created</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadData?.leadsCreated || 0}</div>
            <p className="text-xs text-muted-foreground">
              {leadData?.conversionMetrics?.overallConversionRate?.toFixed(1) || 0}% conversion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead Health</CardTitle>
            {leadData?.insights?.conversionHealth === 'healthy' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {leadData?.insights?.conversionHealth || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {leadData?.conversionMetrics?.averageLeadAge?.toFixed(0) || 0} days avg age
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Stats & Leaderboard */}
        <div className="lg:col-span-2 space-y-6">
          {/* Team Stats Widget */}
          <TeamStatsWidget variant="full" showDetails={true} />

          {/* Team Leaderboard */}
          <TeamLeaderboard defaultMetric="activity" showCoachingFlags={true} />
        </div>

        {/* Right Column: Coaching & Leads */}
        <div className="space-y-6">
          {/* Coaching Priorities */}
          <Card>
            <CardHeader>
              <CardTitle>Coaching Priorities</CardTitle>
              <CardDescription>Team members needing attention</CardDescription>
            </CardHeader>
            <CardContent>
              {coachingLoading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : coachingData?.insights?.coachingPriority?.length > 0 ? (
                <div className="space-y-3">
                  {coachingData.insights.coachingPriority.map((rep: any) => (
                    <div key={rep.userId} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{rep.userName}</span>
                        <Badge variant={rep.priority === 'critical' ? 'destructive' : 'default'}>
                          {rep.priority}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {rep.flags.lowActivity && (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            <span>Low activity</span>
                          </div>
                        )}
                        {rep.flags.lowConversion && (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            <span>Low conversion</span>
                          </div>
                        )}
                        {rep.flags.dealsStuck && (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            <span>{rep.metrics.dealsStuck} deals stuck</span>
                          </div>
                        )}
                      </div>
                      {rep.recommendations?.length > 0 && (
                        <div className="text-xs bg-muted p-2 rounded">
                          <div className="font-medium mb-1">Recommendation:</div>
                          {rep.recommendations[0]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p>All team members performing well!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lead Source Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Sources</CardTitle>
              <CardDescription>Top performing sources</CardDescription>
            </CardHeader>
            <CardContent>
              {leadLoading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {leadData?.leadsBySource?.slice(0, 5).map((source: any) => (
                    <div
                      key={source.source}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span className="text-sm font-medium">{source.source}</span>
                      <div className="text-right">
                        <div className="text-sm font-bold">{source.count}</div>
                        <div className="text-xs text-muted-foreground">
                          {source.conversionRate.toFixed(0)}% conv
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Team Performance</TabsTrigger>
          <TabsTrigger value="coaching">Coaching Details</TabsTrigger>
          <TabsTrigger value="leads">Lead Management</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Member Performance</CardTitle>
              <CardDescription>Detailed metrics for each team member</CardDescription>
            </CardHeader>
            <CardContent>
              {pipelineLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : pipelineData?.teamMembers ? (
                <TeamPerformanceTable
                  comparison={pipelineData.teamMembers.map((m: any) => ({
                    userId: m.userId,
                    userName: m.userName,
                    pipelineValue: m.pipelineValue,
                    dealsInProgress: m.dealCount,
                    winRate: m.winRate ?? m.quoteWinRate ?? 0,
                    averageDealSize: m.averageDealSize,
                    activitiesThisWeek: m.activitiesThisWeek ?? m.activityCount ?? 0,
                    quotaAttainment: m.pipelineCoverage,
                  }))}
                  summary={pipelineData.summary}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">No team data available</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coaching" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Coaching Report</CardTitle>
              <CardDescription>Detailed coaching opportunities and recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              {coachingLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <div className="space-y-4">
                  {coachingData?.opportunities?.map((opp: any) => (
                    <div key={opp.userId} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{opp.userName}</h3>
                        <div className="flex gap-1">
                          {opp.flags.lowActivity && (
                            <Badge variant="destructive">Low Activity</Badge>
                          )}
                          {opp.flags.lowConversion && (
                            <Badge variant="destructive">Low Conversion</Badge>
                          )}
                          {opp.flags.dealsStuck && <Badge variant="destructive">Stuck Deals</Badge>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Calls:</span>{' '}
                          {opp.metrics.callVolume}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Quotes:</span>{' '}
                          {opp.metrics.quoteVolume}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Meetings:</span>{' '}
                          {opp.metrics.meetingsHeld}/{opp.metrics.meetingsPlanned}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Win Rate:</span>{' '}
                          {opp.metrics.quoteWinRate.toFixed(0)}%
                        </div>
                      </div>

                      {opp.recommendations?.length > 0 && (
                        <div className="bg-muted p-3 rounded space-y-1">
                          <div className="font-medium text-sm">Recommendations:</div>
                          {opp.recommendations.map((rec: string, i: number) => (
                            <div key={i} className="text-sm flex items-start gap-2">
                              <span className="text-muted-foreground">•</span>
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead Management Overview</CardTitle>
              <CardDescription>Lead funnel and conversion metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Lead Status Distribution */}
              <div>
                <h4 className="font-medium mb-3">Leads by Status</h4>
                <div className="space-y-2">
                  {leadData?.leadsByStatus?.map((status: any) => (
                    <div
                      key={status.status}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span className="text-sm font-medium capitalize">{status.status}</span>
                      <span className="text-sm font-bold">{status.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conversion Metrics */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Conversion Rate</div>
                  <div className="text-2xl font-bold">
                    {leadData?.conversionMetrics?.overallConversionRate?.toFixed(1) || 0}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Avg Lead Age</div>
                  <div className="text-2xl font-bold">
                    {leadData?.conversionMetrics?.averageLeadAge?.toFixed(0) || 0} days
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
