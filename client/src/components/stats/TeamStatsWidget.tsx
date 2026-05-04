/**
 * TEAM STATS WIDGET
 * In-module stat widget that displays team performance metrics
 * Can be embedded in any page (opportunities, deals, leads, etc.)
 * RBAC-aware: Shows only data user has permission to see
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Activity,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useState } from 'react';

interface TeamQuickStats {
  pipeline: {
    totalValue: number;
    totalDeals: number;
    coverage: number;
    topRep: string;
  };
  performance: {
    quotaAttainment: number;
    revenue: number;
    winRate: number;
    repsOnTrack: number;
    totalReps: number;
  };
  activity: {
    totalActivities: number;
    averagePerRep: number;
    topRep: string;
    lowPerformers: number;
  };
  teamSize: number;
}

interface TeamStatsWidgetProps {
  variant?: 'compact' | 'full';
  showDetails?: boolean;
  className?: string;
}

export function TeamStatsWidget({
  variant = 'full',
  showDetails = true,
  className,
}: TeamStatsWidgetProps) {
  const [autoRefresh, setAutoRefresh] = useState(false);

  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery<TeamQuickStats>({
    queryKey: ['reports', 'team', 'quick-stats'],
    queryFn: () => apiRequest('/api/reports/team/quick-stats'),
    refetchInterval: autoRefresh ? 60000 : false, // Refresh every minute if enabled
    retry: (failureCount, error: any) => {
      // Don't retry on permission errors
      if (error?.message?.includes('permission')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Team Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Unable to load team stats'}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Team Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-20 bg-muted animate-pulse rounded" />
          <div className="h-20 bg-muted animate-pulse rounded" />
          <div className="h-20 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getQuotaAttainmentColor = (attainment: number) => {
    if (attainment >= 100) return 'text-green-600';
    if (attainment >= 90) return 'text-blue-600';
    if (attainment >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCoverageStatus = (coverage: number) => {
    if (coverage >= 300) return { label: 'Excellent', color: 'bg-green-500' };
    if (coverage >= 200) return { label: 'Good', color: 'bg-blue-500' };
    if (coverage >= 100) return { label: 'Fair', color: 'bg-yellow-500' };
    return { label: 'Low', color: 'bg-red-500' };
  };

  if (variant === 'compact') {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Team Stats</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 w-7 p-0">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Quota</span>
            <span
              className={cn(
                'font-bold',
                getQuotaAttainmentColor(stats?.performance.quotaAttainment || 0),
              )}
            >
              {(stats?.performance.quotaAttainment ?? 0).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Pipeline</span>
            <span className="font-medium">{formatCurrency(stats?.pipeline.totalValue || 0)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Team Size</span>
            <span className="font-medium">{stats?.teamSize || 0}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const coverageStatus = getCoverageStatus(stats?.pipeline.coverage || 0);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Performance</CardTitle>
            <CardDescription>
              {stats?.teamSize} team member{stats?.teamSize !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(autoRefresh && 'bg-accent')}
            >
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quota Attainment */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Quota Attainment</span>
            </div>
            <span
              className={cn(
                'text-2xl font-bold',
                getQuotaAttainmentColor(stats?.performance.quotaAttainment || 0),
              )}
            >
              {stats?.performance.quotaAttainment.toFixed(1)}%
            </span>
          </div>
          <Progress value={stats?.performance.quotaAttainment || 0} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {stats?.performance.repsOnTrack} of {stats?.performance.totalReps} on track
            </span>
            <span>{formatCurrency(stats?.performance.revenue || 0)} MTD</span>
          </div>
        </div>

        {/* Pipeline Coverage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Pipeline</span>
            </div>
            <Badge variant="secondary" className={cn('text-white', coverageStatus.color)}>
              {coverageStatus.label}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">
              {formatCurrency(stats?.pipeline.totalValue || 0)}
            </span>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
                {stats?.pipeline.totalDeals} deals
              </div>
              <div className="text-xs text-muted-foreground">
                {stats?.pipeline.coverage.toFixed(0)}% coverage
              </div>
            </div>
          </div>
          {showDetails && (
            <div className="text-xs text-muted-foreground">Top: {stats?.pipeline.topRep}</div>
          )}
        </div>

        {/* Activity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Activity</span>
            </div>
            {stats && stats.activity.lowPerformers > 0 && (
              <Badge variant="destructive">{stats.activity.lowPerformers} low</Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{stats?.activity.totalActivities}</span>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
                {stats?.activity.averagePerRep.toFixed(0)} avg/rep
              </div>
              <div className="text-xs text-muted-foreground">
                Win Rate: {stats?.performance.winRate.toFixed(1)}%
              </div>
            </div>
          </div>
          {showDetails && (
            <div className="text-xs text-muted-foreground">Top: {stats?.activity.topRep}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default TeamStatsWidget;
