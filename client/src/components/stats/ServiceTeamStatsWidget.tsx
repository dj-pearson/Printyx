/**
 * SERVICE TEAM STATS WIDGET
 * In-module stat widget that displays service team performance metrics
 * Shows technician productivity, FTF rate, SLA compliance, and CSAT
 * RBAC-aware: Shows only data user has permission to see
 */

import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Wrench,
  Clock,
  Star,
  CheckCircle,
  Users,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  Target,
  Download,
  FileText,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { exportToCSV, exportToJSON, createExportColumn } from '@/lib/export-utils';
import { useToast } from '@/hooks/use-toast';

interface ServiceTeamQuickStats {
  performance: {
    firstTimeFixRate: number; // Percentage
    slaCompliance: number; // Percentage
    customerSatisfaction: number; // 1-5 scale
    utilizationRate: number; // Percentage
  };
  activity: {
    totalCalls: number;
    completedCalls: number;
    scheduledCalls: number;
    overdueTickets: number;
  };
  team: {
    totalTechnicians: number;
    activeTechnicians: number;
    topTechnician: string;
    techsNeedingSupport: number;
  };
  trends: {
    ftfTrend: 'up' | 'down' | 'stable';
    slaTrend: 'up' | 'down' | 'stable';
    csatTrend: 'up' | 'down' | 'stable';
  };
}

interface ServiceTeamStatsWidgetProps {
  variant?: 'compact' | 'full';
  showAutoRefresh?: boolean;
  className?: string;
}

export default function ServiceTeamStatsWidget({
  variant = 'full',
  showAutoRefresh = false,
  className,
}: ServiceTeamStatsWidgetProps) {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const { toast } = useToast();

  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery<ServiceTeamQuickStats>({
    queryKey: ['service-team-quick-stats'],
    queryFn: async () => {
      const res = await fetch('/api/service-reports/team/quick-stats', {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('You do not have permission to view service team stats');
        }
        throw new Error('Failed to fetch service team stats');
      }
      return res.json();
    },
    refetchInterval: autoRefresh ? 60000 : false, // Refresh every minute if enabled
    retry: (failureCount, error: any) => {
      // Don't retry on permission errors
      if (error?.message?.includes('permission')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Export handler
  const handleExport = (format: 'csv' | 'json') => {
    if (!stats) {
      toast({
        title: 'No data to export',
        description: 'Please wait for data to load before exporting.',
        variant: 'destructive',
      });
      return;
    }

    // Prepare export data
    const exportData = [
      {
        metric: 'First-Time Fix Rate',
        value: `${stats.performance.firstTimeFixRate.toFixed(1)}%`,
        trend: stats.trends.ftfTrend,
        category: 'Performance',
      },
      {
        metric: 'SLA Compliance',
        value: `${stats.performance.slaCompliance.toFixed(1)}%`,
        trend: stats.trends.slaTrend,
        category: 'Performance',
      },
      {
        metric: 'Customer Satisfaction',
        value: `${stats.performance.customerSatisfaction.toFixed(2)} / 5.0`,
        trend: stats.trends.csatTrend,
        category: 'Performance',
      },
      {
        metric: 'Utilization Rate',
        value: `${stats.performance.utilizationRate.toFixed(0)}%`,
        trend: '-',
        category: 'Performance',
      },
      {
        metric: 'Total Calls',
        value: stats.activity.totalCalls.toString(),
        trend: '-',
        category: 'Activity',
      },
      {
        metric: 'Completed Calls',
        value: stats.activity.completedCalls.toString(),
        trend: '-',
        category: 'Activity',
      },
      {
        metric: 'Scheduled Calls',
        value: stats.activity.scheduledCalls.toString(),
        trend: '-',
        category: 'Activity',
      },
      {
        metric: 'Overdue Tickets',
        value: stats.activity.overdueTickets.toString(),
        trend: '-',
        category: 'Activity',
      },
      {
        metric: 'Total Technicians',
        value: stats.team.totalTechnicians.toString(),
        trend: '-',
        category: 'Team',
      },
      {
        metric: 'Active Technicians',
        value: stats.team.activeTechnicians.toString(),
        trend: '-',
        category: 'Team',
      },
      {
        metric: 'Top Technician',
        value: stats.team.topTechnician,
        trend: '-',
        category: 'Team',
      },
      {
        metric: 'Technicians Needing Support',
        value: stats.team.techsNeedingSupport.toString(),
        trend: '-',
        category: 'Team',
      },
    ];

    const columns = [
      createExportColumn<typeof exportData[0]>('category', 'Category'),
      createExportColumn<typeof exportData[0]>('metric', 'Metric'),
      createExportColumn<typeof exportData[0]>('value', 'Value'),
      createExportColumn<typeof exportData[0]>('trend', 'Trend'),
    ];

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `service-team-stats-${timestamp}`;

    if (format === 'csv') {
      exportToCSV(exportData, columns, { filename });
      toast({
        title: 'Export successful',
        description: 'Service team stats exported to CSV.',
      });
    } else {
      exportToJSON(exportData, columns, { filename });
      toast({
        title: 'Export successful',
        description: 'Service team stats exported to JSON.',
      });
    }
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Service Team Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Unable to load service team stats'}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Service Team Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-20 bg-muted animate-pulse rounded" />
          <div className="h-20 bg-muted animate-pulse rounded" />
          <div className="h-20 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const getPerformanceColor = (value: number, thresholds: { excellent: number; good: number; fair: number }) => {
    if (value >= thresholds.excellent) return 'text-green-600';
    if (value >= thresholds.good) return 'text-blue-600';
    if (value >= thresholds.fair) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getFTFColor = (ftf: number) => getPerformanceColor(ftf, { excellent: 85, good: 75, fair: 65 });
  const getSLAColor = (sla: number) => getPerformanceColor(sla, { excellent: 95, good: 90, fair: 85 });
  const getCSATColor = (csat: number) => getPerformanceColor(csat * 20, { excellent: 90, good: 80, fair: 70 });
  const getUtilizationColor = (util: number) => getPerformanceColor(util, { excellent: 85, good: 75, fair: 65 });

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-600" />;
    return <div className="h-3 w-3" />;
  };

  // Compact variant for sidebars and inline use
  if (variant === 'compact') {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Service Team
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">FTF Rate</span>
            <span className={cn('font-bold', getFTFColor(stats?.performance.firstTimeFixRate || 0))}>
              {stats?.performance.firstTimeFixRate.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">SLA</span>
            <span className={cn('font-bold', getSLAColor(stats?.performance.slaCompliance || 0))}>
              {stats?.performance.slaCompliance.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">CSAT</span>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{stats?.performance.customerSatisfaction.toFixed(1)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Technicians</span>
            <span className="font-medium">{stats?.team.activeTechnicians}/{stats?.team.totalTechnicians}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full variant for dashboard and main content areas
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Service Team Performance</h3>
        </div>
        <div className="flex items-center gap-3">
          {showAutoRefresh && (
            <div className="flex items-center gap-2">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
                Auto-refresh
              </Label>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* First-Time Fix Rate */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                First-Time Fix
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={cn('text-2xl font-bold', getFTFColor(stats?.performance.firstTimeFixRate || 0))}>
                {stats?.performance.firstTimeFixRate.toFixed(1)}%
              </div>
              <TrendIcon trend={stats?.trends.ftfTrend || 'stable'} />
            </div>
            <Progress
              value={stats?.performance.firstTimeFixRate || 0}
              className="mt-2 h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.performance.firstTimeFixRate >= 85 ? 'Excellent' :
               stats?.performance.firstTimeFixRate >= 75 ? 'Good' :
               stats?.performance.firstTimeFixRate >= 65 ? 'Fair' : 'Needs Improvement'}
            </p>
          </CardContent>
        </Card>

        {/* SLA Compliance */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                SLA Compliance
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={cn('text-2xl font-bold', getSLAColor(stats?.performance.slaCompliance || 0))}>
                {stats?.performance.slaCompliance.toFixed(1)}%
              </div>
              <TrendIcon trend={stats?.trends.slaTrend || 'stable'} />
            </div>
            <Progress
              value={stats?.performance.slaCompliance || 0}
              className="mt-2 h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.activity.overdueTickets || 0} tickets overdue
            </p>
          </CardContent>
        </Card>

        {/* Customer Satisfaction */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Customer Satisfaction
              </CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={cn('text-2xl font-bold', getCSATColor(stats?.performance.customerSatisfaction || 0))}>
                {stats?.performance.customerSatisfaction.toFixed(2)}
              </div>
              <span className="text-sm text-muted-foreground">/ 5.0</span>
              <TrendIcon trend={stats?.trends.csatTrend || 'stable'} />
            </div>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'h-4 w-4',
                    star <= Math.round(stats?.performance.customerSatisfaction || 0)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Based on {stats?.activity.completedCalls || 0} completed calls
            </p>
          </CardContent>
        </Card>

        {/* Utilization Rate */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Utilization Rate
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={cn('text-2xl font-bold', getUtilizationColor(stats?.performance.utilizationRate || 0))}>
                {stats?.performance.utilizationRate.toFixed(0)}%
              </div>
            </div>
            <Progress
              value={stats?.performance.utilizationRate || 0}
              className="mt-2 h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.team.activeTechnicians || 0} / {stats?.team.totalTechnicians || 0} technicians active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Calls</p>
              <p className="text-2xl font-bold">{stats?.activity.totalCalls || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats?.activity.completedCalls || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Scheduled</p>
              <p className="text-2xl font-bold text-blue-600">{stats?.activity.scheduledCalls || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Top Technician</p>
              <p className="text-sm font-medium truncate">{stats?.team.topTechnician || 'N/A'}</p>
            </div>
          </div>

          {/* Alerts */}
          {(stats?.team.techsNeedingSupport || 0) > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900">
                  {stats?.team.techsNeedingSupport} technician{stats?.team.techsNeedingSupport !== 1 ? 's' : ''} need support
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Low performance or high workload detected. Consider coaching or workload redistribution.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
