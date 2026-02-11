import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MainLayout } from '@/components/layout/main-layout';
import {
  TrendingUp,
  Target,
  DollarSign,
  Calendar,
  FileText,
  Users,
  PieChart,
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Settings,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SalesPipelineForecasting() {
  const [selectedForecast, setSelectedForecast] = useState<string>('all');
  const [period, setPeriod] = useState('monthly');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: {
      forecastName: '',
      forecastType: 'quarterly',
      startDate: '',
      endDate: '',
      revenueTarget: '',
      dealCountTarget: '',
      confidenceLevel: 'medium',
    },
  });

  // Fetch available forecasts
  const { data: forecasts } = useQuery({
    queryKey: ['/api/sales-forecasts'],
    queryFn: () => fetch('/api/sales-forecasts').then((res) => res.json()),
  });

  // Get selected forecast data safely
  const selectedForecastData = forecasts?.find((f: any) => f.id === selectedForecast) || null;

  // Fetch pipeline forecast data
  const { data: forecastData, isLoading } = useQuery({
    queryKey: ['/api/pipeline-forecast', selectedForecast, period],
    queryFn: () => {
      let url = `/api/pipeline-forecast`;
      if (selectedForecast && selectedForecast !== 'all') {
        url += `/${selectedForecast}`;
      }
      const params = new URLSearchParams();
      params.append('period', period);
      return fetch(`${url}?${params.toString()}`).then((res) => res.json());
    },
  }) as { data: any | undefined; isLoading: boolean };

  return (
    <MainLayout
      title="Pipeline Forecasting"
      description="Plan revenue and track pipeline against goals"
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Unified Filter Bar */}
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            <Select value={selectedForecast} onValueChange={setSelectedForecast}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select forecast" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pipeline Data</SelectItem>
                {forecasts?.map((forecast: any) => (
                  <SelectItem key={forecast.id} value={forecast.id}>
                    {forecast.title || forecast.forecastName}
                  </SelectItem>
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

            <Button variant="outline" onClick={() => setShowAdvanced((v) => !v)}>
              <Settings className="h-4 w-4 mr-2" /> {showAdvanced ? 'Hide Advanced' : 'Advanced'}
            </Button>
          </CardContent>
        </Card>

        {showAdvanced && (
          <Card>
            <CardHeader>
              <CardTitle>Advanced Options</CardTitle>
              <CardDescription>Optional filters and configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Placeholder for future advanced controls */}
              <div className="text-sm text-gray-600">
                Add custom segments, owner filters, confidence weighting, etc.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs: Overview, Breakdown, Time Series */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
            <TabsTrigger value="time">Time Series</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {(() => {
                const total = forecastData?.pipeline?.totalValue || 0;
                const weighted = [
                  forecastData?.pipeline?.breakdown?.deals?.weightedValue || 0,
                  forecastData?.pipeline?.breakdown?.quotes?.weightedValue || 0,
                  forecastData?.pipeline?.breakdown?.proposals?.weightedValue || 0,
                ].reduce((a: number, b: number) => a + b, 0);
                const toGoal = forecastData?.remaining?.toGoalValue ?? null;
                const goalAttainmentPct = forecastData?.goals?.totalValue
                  ? Math.min(
                      100,
                      Math.round(
                        ((forecastData.pipeline?.totalValue || 0) / forecastData.goals.totalValue) *
                          100,
                      ),
                    )
                  : 0;
                const icons = [DollarSign, TrendingUp, Target, PieChart];
                const colors = [
                  'text-blue-500',
                  'text-green-500',
                  'text-amber-500',
                  'text-purple-500',
                ];
                const cards = [
                  {
                    label: 'Pipeline Total',
                    value: `$${total.toLocaleString()}`,
                    sub: 'Total value',
                  },
                  {
                    label: 'Weighted',
                    value: `$${weighted.toLocaleString()}`,
                    sub: 'Probability-weighted',
                  },
                  {
                    label: 'To Goal',
                    value: toGoal !== null ? `$${Number(toGoal).toLocaleString()}` : '—',
                    sub: 'Remaining',
                  },
                  { label: 'Attainment', value: `${goalAttainmentPct}%`, sub: 'Goal progress' },
                ];
                return cards.map((c, i) => {
                  const Icon = icons[i];
                  return (
                    <Card key={i}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
                        <Icon className={`h-4 w-4 ${colors[i]}`} />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{c.value}</div>
                        <p className="text-xs text-muted-foreground">{c.sub}</p>
                      </CardContent>
                    </Card>
                  );
                });
              })()}
            </div>
          </TabsContent>

          <TabsContent value="breakdown">
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Breakdown</CardTitle>
                <CardDescription>Deals, quotes, and proposals at a glance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(['deals', 'quotes', 'proposals'] as const).map((key) => {
                    const data = forecastData?.pipeline?.breakdown?.[key] || {
                      count: 0,
                      value: 0,
                      weightedValue: 0,
                    };
                    const labels: any = {
                      deals: 'Deals',
                      quotes: 'Quotes',
                      proposals: 'Proposals',
                    };
                    return (
                      <Card key={key} className="border-dashed">
                        <CardContent className="p-5">
                          <div className="text-sm font-medium">{labels[key]}</div>
                          <div className="text-xs text-gray-600 mt-1">Count: {data.count}</div>
                          <div className="text-xs text-gray-600">
                            Value: ${Number(data.value).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-600">
                            Weighted: ${Number(data.weightedValue).toLocaleString()}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="time">
            <Card>
              <CardHeader>
                <CardTitle>Time Series</CardTitle>
                <CardDescription>Trend over selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">
                  (Coming soon) Line/area chart of pipeline and weighted pipeline over time.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
