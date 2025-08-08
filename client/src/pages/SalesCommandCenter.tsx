import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import {
  Target,
  TrendingUp,
  BarChart3,
  DollarSign,
  Users,
  FileText,
  Layers,
  LineChart,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useLocation } from "wouter";

export default function SalesCommandCenter() {
  const [period, setPeriod] = useState("monthly");
  const [selectedForecast, setSelectedForecast] = useState<string>("all");
  const [, setLocation] = useLocation();
  const [ownerScope, setOwnerScope] = useState<string>("all");

  // detect ?me
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("me")) setOwnerScope("me");
  }, []);

  // Users (for potential future filtering)
  const { data: users = [] } = useQuery({ queryKey: ["/api/users"] });

  // Goals
  const { data: goals = [] } = useQuery({ queryKey: ["/api/crm/goals", ownerScope] });
  const { data: goalProgress = [] } = useQuery({ queryKey: ["/api/crm/goal-progress", ownerScope] });

  // Forecasts list
  const { data: forecasts = [] } = useQuery({
    queryKey: ["/api/sales-forecasts"],
    queryFn: () => fetch("/api/sales-forecasts").then((r) => r.json()),
  });

  // Pipeline forecast summary (deals + quotes + proposals)
  const { data: forecastData } = useQuery({
    queryKey: ["/api/pipeline-forecast", selectedForecast, period, ownerScope],
    queryFn: () => {
      let url = `/api/pipeline-forecast`;
      if (selectedForecast && selectedForecast !== "all") url += `/${selectedForecast}`;
      const params = new URLSearchParams();
      params.append("period", period);
      if (ownerScope === "me") params.append("owner", "me");
      return fetch(`${url}?${params.toString()}`).then((r) => r.json());
    },
  }) as { data: any };

  const kpis = useMemo(() => {
    const total = forecastData?.pipeline?.totalValue || 0;
    const weighted = [
      forecastData?.pipeline?.breakdown?.deals?.weightedValue || 0,
      forecastData?.pipeline?.breakdown?.quotes?.weightedValue || 0,
      forecastData?.pipeline?.breakdown?.proposals?.weightedValue || 0,
    ].reduce((a: number, b: number) => a + b, 0);
    const toGoal = forecastData?.remaining?.toGoalValue ?? null;
    const goalAttainmentPct = forecastData?.goals?.totalValue
      ? Math.min(100, Math.round(((forecastData.pipeline?.totalValue || 0) / forecastData.goals.totalValue) * 100))
      : 0;

    return [
      { title: "Pipeline (Total)", value: `$${total.toLocaleString()}`, icon: Layers },
      { title: "Weighted Pipeline", value: `$${weighted.toLocaleString()}`, icon: LineChart },
      { title: "Remaining To Goal", value: toGoal !== null ? `$${Number(toGoal).toLocaleString()}` : "—", icon: Target },
      { title: "Goal Attainment", value: `${goalAttainmentPct}%`, icon: TrendingUp },
    ];
  }, [forecastData]);

  return (
    <MainLayout title="Sales Command Center" description="Unified KPIs, goals, pipeline, and forecasting for managers and reps">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales Command Center</h1>
            <p className="text-gray-600">A single view for goals, pipeline, and forecasting</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={selectedForecast} onValueChange={setSelectedForecast}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select forecast" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pipeline</SelectItem>
                {forecasts?.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>{f.title || f.forecastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ownerScope} onValueChange={setOwnerScope}>
              <SelectTrigger className="w-40">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon as any;
            return (
              <Card key={idx} className="hover:shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{kpi.title}</p>
                    <p className="text-2xl font-semibold">{kpi.value}</p>
                  </div>
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Two-column: goals + breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Goals & Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Sales Goals & Progress</CardTitle>
              <CardDescription>Track progress against team and individual goals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-72">
                <div className="space-y-3">
                  {goalProgress && goalProgress.length > 0 ? (
                    goalProgress.map((g: any) => (
                      <div key={g.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{g.goalType}</Badge>
                            <span className="font-medium">{g.ownerName || g.assignedToName || "Goal"}</span>
                          </div>
                          <span className="text-sm text-gray-600">Target: {g.targetCount ?? g.targetValue}</span>
                        </div>
                        <Progress value={Math.min(100, Math.round((g.currentCount ?? g.currentValue) / (g.targetCount ?? g.targetValue || 1) * 100))} />
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No goals configured yet.</div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Button asChild variant="outline"><a href="/crm-goals-dashboard">Manage Goals</a></Button>
                <Button asChild variant="ghost"><a href="/sales-pipeline-forecasting">Open Forecasting</a></Button>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Pipeline Breakdown</CardTitle>
              <CardDescription>Deals, quotes, and proposals snapshot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["deals", "quotes", "proposals"] as const).map((key) => {
                  const data = forecastData?.pipeline?.breakdown?.[key] || { count: 0, value: 0, weightedValue: 0 };
                  const labels: any = { deals: "Deals", quotes: "Quotes", proposals: "Proposals" };
                  const icons: any = { deals: DollarSign, quotes: FileText, proposals: Users };
                  const Icon = icons[key];
                  return (
                    <Card key={key} className="border-dashed">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{labels[key]}</span>
                          <Icon className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="text-sm text-gray-600">Count: {data.count}</div>
                        <div className="text-sm text-gray-600">Value: ${Number(data.value).toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Weighted: ${Number(data.weightedValue).toLocaleString()}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline"><a href="/deals">Manage Deals</a></Button>
                <Button asChild variant="outline"><a href="/quotes-management">Manage Quotes</a></Button>
                <Button asChild variant="ghost"><a href="/contracts">Contracts</a></Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent pipeline list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Recent Pipeline Items</CardTitle>
            <CardDescription>Top opportunities in the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {forecastData?.pipeline?.items?.slice(0, 9).map((item: any) => (
                <div key={item.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate mr-2">{item.title}</span>
                    <Badge variant="secondary">{item.type}</Badge>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Value: ${Number(item.value).toLocaleString()}</div>
                  {item.probability !== undefined && (
                    <div className="text-xs text-gray-500">Win Prob: {item.probability}%</div>
                  )}
                  {item.expectedCloseDate && (
                    <div className="text-xs text-gray-500">Close: {new Date(item.expectedCloseDate).toLocaleDateString()}</div>
                  )}
                </div>
              )) || (
                <div className="text-sm text-gray-500">No pipeline items found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Helpful links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Sales Goals</p>
                  <p className="text-lg font-semibold">Configure</p>
                </div>
                <Target className="h-5 w-5 text-primary" />
              </div>
              <Button asChild className="mt-3 w-full" variant="outline"><a href="/crm-goals-dashboard">Open Goals Dashboard</a></Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Forecasting</p>
                  <p className="text-lg font-semibold">Plan & Predict</p>
                </div>
                <LineChart className="h-5 w-5 text-primary" />
              </div>
              <Button asChild className="mt-3 w-full" variant="outline"><a href="/sales-pipeline-forecasting">Open Forecasting</a></Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Pipeline</p>
                  <p className="text-lg font-semibold">Work Opportunities</p>
                </div>
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <Button asChild className="mt-3 w-full" variant="outline"><a href="/deals">Open Pipeline</a></Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Contracts</p>
                  <p className="text-lg font-semibold">Status & Terms</p>
                </div>
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <Button asChild className="mt-3 w-full" variant="outline"><a href="/contracts">Open Contracts</a></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
} 