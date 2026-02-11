/**
 * Dashboard Widget Components
 *
 * Comprehensive widget implementations that render real data
 * from the backend APIs. Each widget fetches its own data and
 * renders appropriately based on widget type.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  DollarSign,
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  Wrench,
  Clock,
  CheckCircle,
  BarChart3,
  AlertCircle,
  AlertTriangle,
  FileText,
  Calendar,
  UserPlus,
  Phone,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Heart,
  Activity,
  CheckSquare,
  Trophy,
  ExternalLink,
} from 'lucide-react';
import type { WidgetDefinition } from '@/lib/dashboard-widget-registry';

// ============================================================================
// ICON MAP
// ============================================================================

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  DollarSign,
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  Wrench,
  Clock,
  CheckCircle,
  BarChart3,
  AlertCircle,
  AlertTriangle,
  FileText,
  Calendar,
  UserPlus,
  Phone,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Heart,
  Activity,
  CheckSquare,
  Trophy,
  ExternalLink,
};

function getIcon(name: string) {
  return ICON_MAP[name] || BarChart3;
}

// ============================================================================
// WIDGET DATA HOOK
// ============================================================================

function useWidgetData(endpoint: string, enabled = true) {
  return useQuery({
    queryKey: [endpoint],
    enabled: enabled && !!endpoint,
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 1,
  });
}

// ============================================================================
// STAT WIDGET
// ============================================================================

interface StatWidgetProps {
  definition: WidgetDefinition;
  compact?: boolean;
}

export function StatWidget({ definition, compact }: StatWidgetProps) {
  const { data, isLoading } = useWidgetData(definition.dataEndpoint);
  const Icon = getIcon(definition.icon);
  const widgetData = data as any;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {definition.name}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-7 bg-muted animate-pulse rounded w-20" />
            <div className="h-3 bg-muted animate-pulse rounded w-32" />
          </div>
        ) : (
          <>
            <div className={cn('font-bold', compact ? 'text-xl' : 'text-2xl')}>
              {widgetData?.value ?? '—'}
            </div>
            {widgetData?.change !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                <span
                  className={cn(
                    'text-xs font-medium flex items-center',
                    widgetData.change > 0 && 'text-green-600',
                    widgetData.change < 0 && 'text-red-600',
                    widgetData.change === 0 && 'text-muted-foreground',
                  )}
                >
                  {widgetData.change > 0 && <ArrowUpRight className="h-3 w-3" />}
                  {widgetData.change < 0 && <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(widgetData.change)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {widgetData.changeLabel || 'vs last period'}
                </span>
              </div>
            )}
            {widgetData?.subtitle && !widgetData?.change && (
              <p className="text-xs text-muted-foreground mt-1">{widgetData.subtitle}</p>
            )}
            {widgetData?.progress !== undefined && (
              <div className="mt-2">
                <Progress value={widgetData.progress} className="h-1.5" />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// BUSINESS OVERVIEW WIDGET (full-width stat bar)
// ============================================================================

export function BusinessOverviewWidget({ definition }: { definition: WidgetDefinition }) {
  const { data, isLoading } = useWidgetData(definition.dataEndpoint);
  const widgetData = data as any;

  const metrics = [
    { label: 'Customers', value: widgetData?.customers ?? 0, icon: Users },
    { label: 'Active Contracts', value: widgetData?.activeContracts ?? 0, icon: FileText },
    {
      label: 'Monthly Revenue',
      value: `$${(widgetData?.monthlyRevenue ?? 0).toLocaleString()}`,
      icon: DollarSign,
    },
    { label: 'Open Tickets', value: widgetData?.openTickets ?? 0, icon: Wrench },
  ];

  return (
    <Card className="h-full">
      <CardContent className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-muted animate-pulse rounded w-20" />
                <div className="h-6 bg-muted animate-pulse rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <m.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold">{m.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// LIST WIDGET (for tasks, follow-ups, schedules, contracts)
// ============================================================================

export function ListWidget({ definition }: { definition: WidgetDefinition }) {
  const { data, isLoading } = useWidgetData(definition.dataEndpoint);
  const items = (data as any)?.items ?? [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">{definition.name}</CardTitle>
        {items.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">All clear</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 8).map((item: any) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                onClick={() => item.href && (window.location.href = item.href)}
              >
                <div
                  className={cn(
                    'h-2 w-2 rounded-full mt-1.5 flex-shrink-0',
                    getPriorityColor(item.priority || 'medium'),
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.title}</div>
                  {item.subtitle && (
                    <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                  )}
                </div>
                {item.badge && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {item.badge}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// PIPELINE WIDGET
// ============================================================================

export function PipelineWidget({ definition }: { definition: WidgetDefinition }) {
  const { data, isLoading } = useWidgetData(definition.dataEndpoint);
  const stages = (data as any)?.stages ?? [];
  const total = stages.reduce((sum: number, s: any) => sum + (s.value || 0), 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{definition.name}</CardTitle>
          <span className="text-lg font-bold">${total.toLocaleString()}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-2 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {stages.map((stage: any, idx: number) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.name}</span>
                  <span className="text-muted-foreground text-xs">
                    ${(stage.value || 0).toLocaleString()} ({stage.count || 0})
                  </span>
                </div>
                <Progress value={total ? (stage.value / total) * 100 : 0} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ACTIVITY FEED WIDGET
// ============================================================================

export function ActivityFeedWidget({ definition }: { definition: WidgetDefinition }) {
  const { data, isLoading } = useWidgetData(definition.dataEndpoint);
  const activities = (data as any)?.activities ?? [];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'service':
        return Wrench;
      case 'invoice':
      case 'billing':
        return DollarSign;
      case 'customer':
        return Users;
      case 'deal':
        return Target;
      case 'call':
        return Phone;
      case 'task':
        return CheckSquare;
      default:
        return Activity;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{definition.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 8).map((activity: any) => {
              const Icon = getActivityIcon(activity.type);
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-1.5 rounded-md hover:bg-accent transition-colors"
                >
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{activity.title}</div>
                    {activity.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {activity.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {activity.timestamp
                        ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })
                        : ''}
                      {activity.user && (
                        <>
                          <span className="mx-0.5">·</span>
                          <span>{activity.user}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// LEADERBOARD WIDGET
// ============================================================================

export function LeaderboardWidget({ definition }: { definition: WidgetDefinition }) {
  const { data, isLoading } = useWidgetData(definition.dataEndpoint);
  const members = (data as any)?.members ?? [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          {definition.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Users className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">No data available</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.slice(0, 8).map((member: any, idx: number) => (
              <div
                key={member.id || idx}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold bg-muted">
                  {idx + 1}
                </div>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {(member.name || '')
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{member.name}</div>
                  <div className="text-xs text-muted-foreground">{member.subtitle || ''}</div>
                </div>
                <div className="text-sm font-bold text-right">{member.value}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TABLE WIDGET (for technician status etc.)
// ============================================================================

export function TableWidget({ definition }: { definition: WidgetDefinition }) {
  const { data, isLoading } = useWidgetData(definition.dataEndpoint);
  const rows = (data as any)?.rows ?? [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-site':
      case 'active':
        return 'bg-green-500';
      case 'en-route':
      case 'dispatched':
        return 'bg-blue-500';
      case 'available':
      case 'idle':
        return 'bg-yellow-500';
      case 'off-duty':
      case 'offline':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{definition.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Users className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">No data</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row: any) => (
              <div
                key={row.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors"
              >
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">
                      {(row.name || '')
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
                      getStatusColor(row.status || 'offline'),
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {row.statusLabel || row.status || ''}
                    {row.detail && ` — ${row.detail}`}
                  </div>
                </div>
                {row.badge && (
                  <Badge variant="outline" className="text-xs">
                    {row.badge}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// GAUGE WIDGET
// ============================================================================

export function GaugeWidget({ definition }: { definition: WidgetDefinition }) {
  const { data, isLoading } = useWidgetData(definition.dataEndpoint);
  const Icon = getIcon(definition.icon);
  const widgetData = data as any;
  const value = widgetData?.value ?? 0;
  const maxVal = widgetData?.max ?? 100;
  const pct = maxVal ? Math.round((parseFloat(String(value)) / maxVal) * 100) : 0;

  const getColor = () => {
    if (pct >= 90) return 'text-green-600';
    if (pct >= 70) return 'text-blue-600';
    if (pct >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {definition.name}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-7 bg-muted animate-pulse rounded w-16" />
            <div className="h-2 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <>
            <div className={cn('text-2xl font-bold', getColor())}>
              {widgetData?.displayValue ?? `${value}${widgetData?.suffix || '%'}`}
            </div>
            <Progress value={pct} className="h-2 mt-2" />
            {widgetData?.subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{widgetData.subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CHART WIDGET (simplified bar/line chart using divs)
// ============================================================================

export function ChartWidget({ definition }: { definition: WidgetDefinition }) {
  const { data, isLoading } = useWidgetData(definition.dataEndpoint);
  const points = (data as any)?.points ?? [];
  const maxValue = Math.max(...points.map((p: any) => p.value || 0), 1);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{definition.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-end">
        {isLoading ? (
          <div className="flex items-end gap-1 w-full h-32">
            {[60, 80, 45, 90, 70, 85].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-muted animate-pulse rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        ) : points.length === 0 ? (
          <div className="flex flex-col items-center justify-center w-full py-6 text-muted-foreground">
            <BarChart3 className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">No data available</p>
          </div>
        ) : (
          <div className="w-full">
            <div className="flex items-end gap-1 h-32">
              {points.map((point: any, idx: number) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors"
                    style={{ height: `${(point.value / maxValue) * 100}%`, minHeight: 2 }}
                    title={`${point.label}: ${point.displayValue || point.value}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1 mt-1">
              {points.map((point: any, idx: number) => (
                <div
                  key={idx}
                  className="flex-1 text-center text-[10px] text-muted-foreground truncate"
                >
                  {point.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// QUICK ACTIONS WIDGET (role-based shortcuts)
// ============================================================================

interface QuickActionsWidgetProps {
  definition: WidgetDefinition;
  roleCode: string;
}

const ROLE_ACTIONS: Record<
  string,
  Array<{ label: string; icon: string; path: string; color: string }>
> = {
  SALES_REP: [
    {
      label: 'New Lead',
      icon: 'UserPlus',
      path: '/customers?action=new-lead',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Create Quote',
      icon: 'FileText',
      path: '/quotes?action=new',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'New Deal',
      icon: 'Target',
      path: '/deals?action=create',
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Log Call',
      icon: 'Phone',
      path: '/activities?action=call',
      color: 'bg-orange-100 text-orange-600',
    },
  ],
  SENIOR_SALES_REP: [
    {
      label: 'New Lead',
      icon: 'UserPlus',
      path: '/customers?action=new-lead',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Create Quote',
      icon: 'FileText',
      path: '/quotes?action=new',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'New Deal',
      icon: 'Target',
      path: '/deals?action=create',
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Log Call',
      icon: 'Phone',
      path: '/activities?action=call',
      color: 'bg-orange-100 text-orange-600',
    },
  ],
  SALES_SUPERVISOR: [
    {
      label: 'New Deal',
      icon: 'Target',
      path: '/deals?action=create',
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Team Report',
      icon: 'BarChart3',
      path: '/reports/sales',
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'Create Quote',
      icon: 'FileText',
      path: '/quotes?action=new',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'View Pipeline',
      icon: 'TrendingUp',
      path: '/deals',
      color: 'bg-blue-100 text-blue-600',
    },
  ],
  SALES_MANAGER: [
    {
      label: 'Team Report',
      icon: 'BarChart3',
      path: '/reports/sales',
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'New Deal',
      icon: 'Target',
      path: '/deals?action=create',
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'View Pipeline',
      icon: 'TrendingUp',
      path: '/deals',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Approve Quotes',
      icon: 'CheckCircle',
      path: '/deal-desk',
      color: 'bg-emerald-100 text-emerald-600',
    },
  ],
  TECHNICIAN: [
    {
      label: 'My Route',
      icon: 'Calendar',
      path: '/service-dispatch/my-route',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Parts Lookup',
      icon: 'Package',
      path: '/warehouse-operations/lookup',
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      label: 'New Ticket',
      icon: 'Wrench',
      path: '/service-dispatch?action=create',
      color: 'bg-orange-100 text-orange-600',
    },
    {
      label: 'Report Issue',
      icon: 'AlertCircle',
      path: '/service-hub?action=report',
      color: 'bg-red-100 text-red-600',
    },
  ],
  SERVICE_SUPERVISOR: [
    {
      label: 'Dispatch',
      icon: 'Calendar',
      path: '/service-dispatch',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'New Ticket',
      icon: 'Wrench',
      path: '/service-dispatch?action=create',
      color: 'bg-orange-100 text-orange-600',
    },
    {
      label: 'Inventory',
      icon: 'Package',
      path: '/warehouse-operations',
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      label: 'Approvals',
      icon: 'CheckCircle',
      path: '/service-hub?status=pending-approval',
      color: 'bg-emerald-100 text-emerald-600',
    },
  ],
  SERVICE_MANAGER: [
    {
      label: 'Emergency',
      icon: 'AlertCircle',
      path: '/service-dispatch?emergency=true',
      color: 'bg-red-100 text-red-600',
    },
    {
      label: 'Dispatch',
      icon: 'Calendar',
      path: '/service-dispatch',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Inventory',
      icon: 'Package',
      path: '/warehouse-operations',
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      label: 'Reports',
      icon: 'BarChart3',
      path: '/reports/service',
      color: 'bg-indigo-100 text-indigo-600',
    },
  ],
  FINANCE_MANAGER: [
    {
      label: 'Invoices',
      icon: 'FileText',
      path: '/advanced-billing',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'Aging Report',
      icon: 'BarChart3',
      path: '/reports/finance',
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'Collections',
      icon: 'DollarSign',
      path: '/advanced-billing?filter=overdue',
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Contracts',
      icon: 'FileText',
      path: '/contracts',
      color: 'bg-blue-100 text-blue-600',
    },
  ],
  DEFAULT: [
    {
      label: 'New Ticket',
      icon: 'Wrench',
      path: '/service-dispatch?action=create',
      color: 'bg-orange-100 text-orange-600',
    },
    { label: 'Customers', icon: 'Users', path: '/customers', color: 'bg-blue-100 text-blue-600' },
    {
      label: 'Reports',
      icon: 'BarChart3',
      path: '/reports',
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'Calendar',
      icon: 'Calendar',
      path: '/calendar',
      color: 'bg-green-100 text-green-600',
    },
  ],
};

export function QuickActionsWidget({ definition, roleCode }: QuickActionsWidgetProps) {
  const actions = ROLE_ACTIONS[roleCode] || ROLE_ACTIONS['DEFAULT'];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => {
            const Icon = getIcon(action.icon);
            return (
              <Link key={action.label} href={action.path}>
                <div className="flex items-center gap-2 p-2.5 rounded-lg border hover:shadow-sm transition-all cursor-pointer group">
                  <div
                    className={cn(
                      'p-1.5 rounded-md group-hover:scale-110 transition-transform',
                      action.color,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-medium">{action.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// WIDGET RENDERER (maps definition to component)
// ============================================================================

interface WidgetRendererProps {
  definition: WidgetDefinition;
  roleCode: string;
}

export function WidgetRenderer({ definition, roleCode }: WidgetRendererProps) {
  switch (definition.type) {
    case 'stat':
      if (definition.key === 'business-overview') {
        return <BusinessOverviewWidget definition={definition} />;
      }
      return <StatWidget definition={definition} />;
    case 'list':
      return <ListWidget definition={definition} />;
    case 'pipeline':
      return <PipelineWidget definition={definition} />;
    case 'feed':
      return <ActivityFeedWidget definition={definition} />;
    case 'leaderboard':
      return <LeaderboardWidget definition={definition} />;
    case 'table':
      return <TableWidget definition={definition} />;
    case 'gauge':
      return <GaugeWidget definition={definition} />;
    case 'chart':
      return <ChartWidget definition={definition} />;
    case 'actions':
      return <QuickActionsWidget definition={definition} roleCode={roleCode} />;
    default:
      return <StatWidget definition={definition} />;
  }
}
