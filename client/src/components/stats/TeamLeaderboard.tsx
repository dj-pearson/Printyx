/**
 * TEAM LEADERBOARD
 * Displays team member rankings based on various metrics
 * RBAC-aware: Only shows team members user has permission to view
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, Medal, TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface TeamMemberActivity {
  userId: string;
  userName: string;
  calls: number;
  emails: number;
  meetings: number;
  demos: number;
  proposals: number;
  totalActivities: number;
  completionRate: number;
  rank: number;
  isLowActivity: boolean;
}

interface TeamMemberPipeline {
  userId: string;
  userName: string;
  userEmail: string;
  pipelineValue: number;
  weightedPipelineValue: number;
  dealCount: number;
  averageDealSize: number;
  pipelineCoverage: number;
}

interface TeamLeaderboardProps {
  defaultMetric?: 'activity' | 'pipeline' | 'quota';
  showCoachingFlags?: boolean;
  className?: string;
}

export function TeamLeaderboard({
  defaultMetric = 'activity',
  showCoachingFlags = true,
  className,
}: TeamLeaderboardProps) {
  const [selectedMetric, setSelectedMetric] = useState(defaultMetric);

  // Fetch activity leaderboard
  const {
    data: activityData,
    isLoading: activityLoading,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ['team-activity-leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/team-reports/activity-leaderboard', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch activity leaderboard');
      return res.json();
    },
    enabled: selectedMetric === 'activity',
  });

  // Fetch pipeline comparison
  const {
    data: pipelineData,
    isLoading: pipelineLoading,
    refetch: refetchPipeline,
  } = useQuery({
    queryKey: ['team-pipeline-comparison'],
    queryFn: async () => {
      const res = await fetch('/api/team-reports/pipeline-comparison', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch pipeline comparison');
      return res.json();
    },
    enabled: selectedMetric === 'pipeline',
  });

  // Fetch performance dashboard for quota
  const {
    data: performanceData,
    isLoading: performanceLoading,
    refetch: refetchPerformance,
  } = useQuery({
    queryKey: ['team-performance-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/team-reports/performance-dashboard', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch performance dashboard');
      return res.json();
    },
    enabled: selectedMetric === 'quota',
  });

  const handleRefresh = () => {
    if (selectedMetric === 'activity') refetchActivity();
    else if (selectedMetric === 'pipeline') refetchPipeline();
    else if (selectedMetric === 'quota') refetchPerformance();
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />;
    return <span className="text-sm text-muted-foreground">#{rank}</span>;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Leaderboard</CardTitle>
            <CardDescription>Real-time team performance rankings</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={activityLoading || pipelineLoading || performanceLoading}
          >
            <RefreshCw
              className={cn(
                'h-4 w-4 mr-2',
                (activityLoading || pipelineLoading || performanceLoading) && 'animate-spin',
              )}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="quota">Quota</TabsTrigger>
          </TabsList>

          {/* Activity Leaderboard */}
          <TabsContent value="activity" className="space-y-4">
            {activityLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead>Rep</TableHead>
                      <TableHead className="text-right">Activities</TableHead>
                      <TableHead className="text-right">Completion</TableHead>
                      {showCoachingFlags && <TableHead className="text-center">Status</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityData?.activities?.map((member: TeamMemberActivity) => (
                      <TableRow key={member.userId}>
                        <TableCell>{getRankIcon(member.rank)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(member.userName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{member.userName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold">{member.totalActivities}</div>
                          <div className="text-xs text-muted-foreground">
                            {member.calls}c · {member.emails}e · {member.meetings}m
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span>{member.completionRate.toFixed(0)}%</span>
                            {member.completionRate >= 80 ? (
                              <TrendingUp className="h-3 w-3 text-green-600" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-600" />
                            )}
                          </div>
                        </TableCell>
                        {showCoachingFlags && (
                          <TableCell className="text-center">
                            {member.isLowActivity ? (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Low
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Good
                              </Badge>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {activityData?.summary && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-2xl font-bold">{activityData.summary.totalActivities}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Avg/Rep</div>
                  <div className="text-2xl font-bold">
                    {activityData.summary.averagePerRep.toFixed(0)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Low Performers</div>
                  <div className="text-2xl font-bold text-red-600">
                    {activityData.summary.lowPerformers?.length || 0}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Pipeline Leaderboard */}
          <TabsContent value="pipeline" className="space-y-4">
            {pipelineLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rep</TableHead>
                      <TableHead className="text-right">Pipeline</TableHead>
                      <TableHead className="text-right">Deals</TableHead>
                      <TableHead className="text-right">Coverage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pipelineData?.teamMembers
                      ?.sort(
                        (a: TeamMemberPipeline, b: TeamMemberPipeline) =>
                          b.pipelineValue - a.pipelineValue,
                      )
                      .map((member: TeamMemberPipeline, index: number) => (
                        <TableRow key={member.userId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getRankIcon(index + 1)}
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {getInitials(member.userName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{member.userName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-bold">{formatCurrency(member.pipelineValue)}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(member.averageDealSize)} avg
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {member.dealCount}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                member.pipelineCoverage >= 200
                                  ? 'default'
                                  : member.pipelineCoverage >= 100
                                    ? 'secondary'
                                    : 'destructive'
                              }
                            >
                              {member.pipelineCoverage.toFixed(0)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {pipelineData?.summary && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Total Pipeline</div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(pipelineData.summary.totalPipeline)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Total Deals</div>
                  <div className="text-2xl font-bold">{pipelineData.summary.totalDeals}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Avg Coverage</div>
                  <div className="text-2xl font-bold">
                    {pipelineData.summary.teamPipelineCoverage.toFixed(0)}%
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Quota Leaderboard */}
          <TabsContent value="quota" className="space-y-4">
            {performanceLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rep</TableHead>
                      <TableHead className="text-right">Quota</TableHead>
                      <TableHead className="text-right">Achieved</TableHead>
                      <TableHead className="text-right">Attainment</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceData?.individualQuotas
                      ?.sort((a: any, b: any) => b.attainment - a.attainment)
                      .map((member: any, index: number) => (
                        <TableRow key={member.userId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getRankIcon(index + 1)}
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {getInitials(member.userName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{member.userName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(member.quota)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(member.achieved)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div
                              className={cn(
                                'font-bold',
                                member.attainment >= 100
                                  ? 'text-green-600'
                                  : member.attainment >= 90
                                    ? 'text-blue-600'
                                    : member.attainment >= 75
                                      ? 'text-yellow-600'
                                      : 'text-red-600',
                              )}
                            >
                              {member.attainment.toFixed(1)}%
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {member.onTrack ? (
                              <Badge variant="default" className="text-xs bg-green-600">
                                On Track
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                At Risk
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {performanceData?.teamQuota && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Team Quota</div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(performanceData.teamQuota.amount)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Achieved</div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(performanceData.teamQuota.achieved)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Attainment</div>
                  <div
                    className={cn(
                      'text-2xl font-bold',
                      performanceData.teamQuota.attainment >= 100
                        ? 'text-green-600'
                        : performanceData.teamQuota.attainment >= 90
                          ? 'text-blue-600'
                          : performanceData.teamQuota.attainment >= 75
                            ? 'text-yellow-600'
                            : 'text-red-600',
                    )}
                  >
                    {performanceData.teamQuota.attainment.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default TeamLeaderboard;
