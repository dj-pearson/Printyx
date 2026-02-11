import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Target,
  TrendingUp,
  BarChart3,
  DollarSign,
  Users,
  FileText,
  Layers,
  LineChart,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';

// ---------- Types ----------
interface Forecast {
  id: string;
  title?: string;
  forecastName?: string;
}

interface PipelineBreakdownItem {
  count: number;
  value: number;
  weightedValue: number;
}

interface PipelineItem {
  id: string;
  title: string;
  type: string;
  value: number;
  probability?: number;
  expectedCloseDate?: string;
}

interface ForecastData {
  pipeline?: {
    totalValue?: number;
    items?: PipelineItem[];
    breakdown?: Record<string, PipelineBreakdownItem>;
  };
  remaining?: { toGoalValue?: number };
  goals?: { totalValue?: number };
}

interface GoalProgressRow {
  id: string;
  goalType: string;
  ownerName?: string;
  assignedToName?: string;
  currentCount?: number;
  currentValue?: number;
  targetCount?: number;
  targetValue?: number;
}

interface KpiDef {
  title: string;
  value: string;
  icon: LucideIcon;
  color: string;
}

// ---------- Component ----------
export default function SalesCommandCenter() {
  const [period, setPeriod] = useState('monthly');
  const [selectedForecast, setSelectedForecast] = useState<string>('all');
  const [ownerScope, setOwnerScope] = useState<string>('all');

  // detect ?me
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('me')) setOwnerScope('me');
  }, []);

  // Goals
  const { data: goalProgress = [] } = useQuery<GoalProgressRow[]>({
    queryKey: ['/api/crm/goal-progress', ownerScope],
  });

  // Forecasts list
  const { data: forecasts = [] } = useQuery<Forecast[]>({
    queryKey: ['/api/sales-forecasts'],
    queryFn: () => fetch('/api/sales-forecasts').then((r) => r.json()),
  });

  // Pipeline forecast summary (deals + quotes + proposals)
  const { data: forecastData } = useQuery<ForecastData>({
    queryKey: ['/api/pipeline-forecast', selectedForecast, period, ownerScope],
    queryFn: () => {
      let url = `/api/pipeline-forecast`;
      if (selectedForecast && selectedForecast !== 'all') url += `/${selectedForecast}`;
      const params = new URLSearchParams();
      params.append('period', period);
      if (ownerScope === 'me') params.append('owner', 'me');
      return fetch(`${url}?${params.toString()}`).then((r) => r.json());
    },
  });

  const goalAttainmentPct = useMemo(() => {
    if (!forecastData?.goals?.totalValue) return 0;
    return Math.min(
      100,
      Math.round(((forecastData.pipeline?.totalValue || 0) / forecastData.goals.totalValue) * 100),
    );
  }, [forecastData]);

  const kpis = useMemo<KpiDef[]>(() => {
    const total = forecastData?.pipeline?.totalValue || 0;
    const weighted = ['deals', 'quotes', 'proposals'].reduce((sum, key) => {
      return sum + (forecastData?.pipeline?.breakdown?.[key]?.weightedValue || 0);
    }, 0);
    const toGoal = forecastData?.remaining?.toGoalValue ?? null;

    return [
      {
        title: 'Pipeline (Total)',
        value: `$${total.toLocaleString()}`,
        icon: Layers,
        color: 'text-blue-500',
      },
      {
        title: 'Weighted Pipeline',
        value: `$${weighted.toLocaleString()}`,
        icon: LineChart,
        color: 'text-indigo-500',
      },
      {
        title: 'Remaining To Goal',
        value: toGoal !== null ? `$${Number(toGoal).toLocaleString()}` : '\u2014',
        icon: Target,
        color: 'text-orange-500',
      },
      {
        title: 'Goal Attainment',
        value: `${goalAttainmentPct}%`,
        icon: TrendingUp,
        color: 'text-green-500',
      },
    ];
  }, [forecastData, goalAttainmentPct]);

  // Pipeline breakdown typed helpers
  const breakdownKeys = ['deals', 'quotes', 'proposals'] as const;
  const breakdownLabels: Record<string, string> = {
    deals: 'Deals',
    quotes: 'Quotes',
    proposals: 'Proposals',
  };
  const breakdownIcons: Record<string, LucideIcon> = {
    deals: DollarSign,
    quotes: FileText,
    proposals: Users,
  };

  return (
    <MainLayout
      title="Sales Command Center"
      description="Unified KPIs, goals, pipeline, and forecasting for managers and reps"
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales Command Center</h1>
            <p className="text-muted-foreground text-sm">
              A single view for goals, pipeline, and forecasting
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={selectedForecast} onValueChange={setSelectedForecast}>
              <SelectTrigger className="w-44 sm:w-56">
                <SelectValue placeholder="Select forecast" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pipeline</SelectItem>
                {forecasts.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.title || f.forecastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32 sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ownerScope} onValueChange={setOwnerScope}>
              <SelectTrigger className="w-28 sm:w-40">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Team</SelectItem>
                <SelectItem value="me">Me</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Goal Attainment Progress Bar */}
        {forecastData?.goals?.totalValue ? (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Goal Attainment</span>
                </div>
                <span className="text-sm font-semibold">
                  {goalAttainmentPct}% of ${Number(forecastData.goals.totalValue).toLocaleString()}
                </span>
              </div>
              <Progress
                value={goalAttainmentPct}
                className={`h-3 ${
                  goalAttainmentPct >= 75
                    ? '[&>div]:bg-green-500'
                    : goalAttainmentPct >= 50
                      ? '[&>div]:bg-amber-500'
                      : '[&>div]:bg-red-500'
                }`}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {goalAttainmentPct >= 100
                  ? 'Goal exceeded!'
                  : goalAttainmentPct >= 75
                    ? 'On track to hit goal'
                    : goalAttainmentPct >= 50
                      ? 'Needs attention to stay on pace'
                      : 'Behind target \u2014 action needed'}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Two-column: goals + breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Goals & Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" /> Sales Goals & Progress
              </CardTitle>
              <CardDescription>Track progress against team and individual goals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-72">
                <div className="space-y-3">
                  {goalProgress.length > 0 ? (
                    goalProgress.map((g) => {
                      const current = g.currentCount ?? g.currentValue ?? 0;
                      const target = g.targetCount ?? g.targetValue ?? 1;
                      const pct = Math.min(100, Math.round((current / (target || 1)) * 100));
                      return (
                        <div key={g.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{g.goalType}</Badge>
                              <span className="font-medium">
                                {g.ownerName || g.assignedToName || 'Goal'}
                              </span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {current} / {target}
                            </span>
                          </div>
                          <Progress
                            value={pct}
                            className={`h-2 ${
                              pct >= 75
                                ? '[&>div]:bg-green-500'
                                : pct >= 50
                                  ? '[&>div]:bg-amber-500'
                                  : '[&>div]:bg-red-500'
                            }`}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <Target className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No goals configured yet.</p>
                      <Button asChild variant="link" size="sm" className="mt-1">
                        <a href="/crm-goals-dashboard">Create Goals</a>
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href="/crm-goals-dashboard">Manage Goals</a>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href="/sales-pipeline-forecasting">Open Forecasting</a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" /> Pipeline Breakdown
              </CardTitle>
              <CardDescription>Deals, quotes, and proposals snapshot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {breakdownKeys.map((key) => {
                  const data = forecastData?.pipeline?.breakdown?.[key] || {
                    count: 0,
                    value: 0,
                    weightedValue: 0,
                  };
                  const Icon = breakdownIcons[key];
                  return (
                    <Card key={key} className="border-dashed">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{breakdownLabels[key]}</span>
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-sm text-muted-foreground">Count: {data.count}</div>
                        <div className="text-sm text-muted-foreground">
                          Value: ${Number(data.value).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Weighted: ${Number(data.weightedValue).toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href="/deals">Manage Deals</a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="/quotes-management">Manage Quotes</a>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href="/contracts">Contracts</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent pipeline list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Recent Pipeline Items
            </CardTitle>
            <CardDescription>Top opportunities in the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {forecastData?.pipeline?.items && forecastData.pipeline.items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {forecastData.pipeline.items.slice(0, 9).map((item) => (
                  <div key={item.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate mr-2">{item.title}</span>
                      <Badge variant="secondary">{item.type}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Value: ${Number(item.value).toLocaleString()}
                    </div>
                    {item.probability !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        Win Prob: {item.probability}%
                      </div>
                    )}
                    {item.expectedCloseDate && (
                      <div className="text-xs text-muted-foreground">
                        Close: {new Date(item.expectedCloseDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No pipeline items found.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create deals, quotes, or proposals to populate your pipeline.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Sales Goals', sub: 'Configure', icon: Target, href: '/crm-goals-dashboard' },
            {
              label: 'Forecasting',
              sub: 'Plan & Predict',
              icon: LineChart,
              href: '/sales-pipeline-forecasting',
            },
            { label: 'Pipeline', sub: 'Work Opportunities', icon: Layers, href: '/deals' },
            { label: 'Contracts', sub: 'Status & Terms', icon: FileText, href: '/contracts' },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <Card key={link.href} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{link.label}</p>
                      <p className="text-lg font-semibold">{link.sub}</p>
                    </div>
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <Button asChild className="w-full" variant="outline" size="sm">
                    <a href={link.href}>Open {link.label}</a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
