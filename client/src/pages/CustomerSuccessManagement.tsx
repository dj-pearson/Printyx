import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  HeartHandshake,
  TrendingUp,
  AlertTriangle,
  Users,
  Target,
  Activity,
  BarChart3,
  RefreshCw,
  Star,
  ThumbsUp,
  MessageCircle,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { apiRequest, extractRecords } from '@/lib/queryClient';
import {
  averageScore,
  toHealthViews,
  type CustomerHealthRow,
  type CustomerHealthView,
} from '@shared/customer-health-view';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import MainLayout from '@/components/layout/main-layout';

const getHealthStatusColor = (status: string) => {
  switch (status) {
    case 'excellent':
      return 'bg-green-100 text-green-800';
    case 'healthy':
      return 'bg-blue-100 text-blue-800';
    case 'at_risk':
      return 'bg-yellow-100 text-yellow-800';
    case 'critical':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'improving':
    case 'growing':
    case 'excellent':
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'declining':
    case 'worsening':
      return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

/**
 * AUDIT-028. Both endpoints are degraded stubs and both used to answer with
 * ZEROES, which this page rendered as measurements: 0.0 out of 5 satisfaction
 * drawn as five empty stars, an NPS of 0 in green, 0% response rate, 0%
 * utilisation behind a progress bar and a "+0%" trend also in green. On a scale
 * that runs -100 to 100, an NPS of 0 is a specific and quite bad claim. The
 * figures are null now and render as an em dash, with the endpoint's own
 * `degraded.reason` shown beside them rather than swallowed.
 */
interface DegradedNote {
  reason?: string;
}

interface UsageAnalyticsData {
  summary: {
    averageUtilization: number | null;
    totalMonthlyVolume: number | null;
    utilizationTrend: number | null;
  };
  optimizationOpportunities: any[];
  customerBreakdown: any[];
  degraded?: DegradedNote;
}

interface SatisfactionData {
  summary: {
    npsScore: number | null;
    overallSatisfaction: number | null;
    responseRate: number | null;
  };
  categoryTrends: any;
  recentSurveys: any[];
  degraded?: DegradedNote;
}

/** An em dash for a figure nothing measures. A missing score is not a zero. */
const measured = (value: number | null | undefined, suffix = '', digits?: number) =>
  value === null || value === undefined
    ? '—'
    : `${digits === undefined ? value.toLocaleString() : value.toFixed(digits)}${suffix}`;

export default function CustomerSuccessManagement() {
  const [, setLocation] = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [isCalculatingHealth, setIsCalculatingHealth] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  // Fetch customer health scores
  // Round 192: rebound onto the real customer_health_scores columns through
  // shared/customer-health-view.ts. The mock shape this page was written
  // against crashed on the first real row (see that module's header).
  const { data: healthScores = [], isLoading: healthLoading } = useQuery<CustomerHealthView[]>({
    queryKey: ['/api/customer-success/health-scores'],
    select: (data: unknown) => toHealthViews(extractRecords(data) as CustomerHealthRow[]),
  });

  // Fetch usage analytics
  const { data: usageAnalytics } = useQuery<UsageAnalyticsData>({
    queryKey: [`/api/customer-success/usage-analytics?period=${selectedPeriod}`],
  });

  // Fetch satisfaction data
  const { data: satisfactionData } = useQuery<SatisfactionData>({
    queryKey: ['/api/customer-success/satisfaction'],
  });

  // AUDIT-028. This toasted "Customer health scores have been recalculated
  // successfully" over an endpoint that recalculated nothing - it moved
  // next_review_date forward and returned 202, so the one visible effect of
  // pressing the button was to make a stale score look freshly reviewed on the
  // card below. The endpoint answers 501 now and writes nothing, and the error
  // it sends is what the user sees.
  const calculateHealthMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/customer-success/calculate-health', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-success/health-scores'] });
      setIsCalculatingHealth(false);
      toast({
        title: 'Health Scores Updated',
        description: 'Customer health scores have been recalculated successfully.',
      });
    },
    onError: (err: unknown) => {
      setIsCalculatingHealth(false);
      toast({
        variant: 'destructive',
        title: 'Recalculation is not available',
        description:
          err instanceof Error
            ? err.message
            : 'Nothing computes a health score yet, so there is nothing to recalculate.',
      });
    },
  });

  const handleCalculateHealth = () => {
    setIsCalculatingHealth(true);
    calculateHealthMutation.mutate({ recalculateAll: true });
  };

  if (healthLoading) {
    return (
      <MainLayout
        title="Customer Success Management"
        description="Monitor customer health, usage patterns, and satisfaction"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading customer success data...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const averageHealthScore = averageScore(healthScores);
  const atRiskCustomers = healthScores.filter((score) => score.atRisk).length;
  const openTickets = healthScores.reduce(
    (sum, score) => sum + (score.signals.openTickets ?? 0),
    0,
  );

  return (
    <MainLayout
      title="Customer Success Management"
      description="Monitor customer health, usage patterns, and satisfaction"
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">Customer Success Management</h1>
            <p className="text-muted-foreground text-sm">
              Monitor customer health, usage patterns, and satisfaction
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCalculateHealth}
              disabled={isCalculatingHealth}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isCalculatingHealth ? 'animate-spin' : ''}`} />
              {isCalculatingHealth ? 'Calculating...' : 'Refresh'}
            </Button>
            <Button variant="default" size="sm" onClick={() => setLocation('/meter-readings')}>
              Monitoring
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation('/service-hub')}>
              Service Hub
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Health Score</CardTitle>
              <HeartHandshake className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {averageHealthScore === null ? '—' : averageHealthScore.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">
                {averageHealthScore === null
                  ? 'No customer scored yet'
                  : 'Out of 100 possible points'}
              </p>
              {averageHealthScore !== null && (
                <Progress value={averageHealthScore} className="mt-2" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">At-Risk Customers</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{atRiskCustomers}</div>
              <p className="text-xs text-muted-foreground">At risk, poor or critical</p>
              {healthScores.length > 0 && (
                <div className="text-xs text-gray-600 mt-1">
                  {((atRiskCustomers / healthScores.length) * 100).toFixed(1)}% of scored customers
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Service Tickets</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {/* Was "Active Alerts" over an `alerts` array no column holds. */}
              <div className="text-2xl font-bold text-red-600">{openTickets}</div>
              <p className="text-xs text-muted-foreground">Across scored customers</p>
              {satisfactionData && (
                <div className="text-xs text-gray-600 mt-1">
                  NPS Score: {measured(satisfactionData.summary.npsScore)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customer Satisfaction</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {satisfactionData && (
                <>
                  <div className="text-2xl font-bold">
                    {measured(satisfactionData.summary.overallSatisfaction, '', 1)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {satisfactionData.summary.overallSatisfaction === null
                      ? 'Not measured'
                      : 'Average satisfaction rating'}
                  </p>
                  <div className="text-xs text-gray-600 mt-1">
                    {measured(satisfactionData.summary.responseRate, '%')} response rate
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="health-scores" className="space-y-4 sm:space-y-6">
          <TabsList>
            <TabsTrigger value="health-scores">Health Scores</TabsTrigger>
            <TabsTrigger value="usage-analytics">Usage Analytics</TabsTrigger>
            <TabsTrigger value="satisfaction">Satisfaction</TabsTrigger>
            <TabsTrigger value="interventions">Interventions</TabsTrigger>
          </TabsList>

          <TabsContent value="health-scores" className="space-y-6">
            {healthScores.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <HeartHandshake className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Health Scores Available
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Calculate customer health scores to get started.
                  </p>
                  <Button onClick={handleCalculateHealth}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Calculate Health Scores
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {healthScores.map((score) => (
                  <HealthScoreCard
                    key={score.customerId}
                    score={score}
                    onOpen={() => setLocation(`/customers/${score.customerId}`)}
                    onTask={() => setLocation('/tasks?action=new')}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="usage-analytics" className="space-y-6">
            {usageAnalytics && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Usage Overview</CardTitle>
                      <CardDescription>Equipment utilization across all customers</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span>Average Utilization</span>
                          <span className="font-bold">
                            {measured(usageAnalytics.summary.averageUtilization, '%')}
                          </span>
                        </div>
                        {/* No bar for a figure nothing measures - an empty bar
                            reads as zero utilisation, which is a claim. */}
                        {usageAnalytics.summary.averageUtilization !== null && (
                          <Progress value={usageAnalytics.summary.averageUtilization} />
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-gray-600">Monthly Volume</div>
                            <div className="font-bold">
                              {measured(usageAnalytics.summary.totalMonthlyVolume)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600">Trend</div>
                            {/* Not green by default: the colour used to assert
                                growth over a hardcoded zero. */}
                            <div
                              className={`font-bold ${
                                (usageAnalytics.summary.utilizationTrend ?? 0) > 0
                                  ? 'text-green-600'
                                  : ''
                              }`}
                            >
                              {usageAnalytics.summary.utilizationTrend === null
                                ? '—'
                                : `${usageAnalytics.summary.utilizationTrend > 0 ? '+' : ''}${usageAnalytics.summary.utilizationTrend}%`}
                            </div>
                          </div>
                        </div>
                        {usageAnalytics.degraded?.reason && (
                          <p className="text-xs text-muted-foreground">
                            {usageAnalytics.degraded.reason}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Optimization Opportunities</CardTitle>
                      <CardDescription>
                        Potential cost savings and revenue increases
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {usageAnalytics.optimizationOpportunities
                          .slice(0, 3)
                          .map((opp: any, idx: number) => (
                            <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                              <div className="font-medium capitalize">
                                {opp.type.replace('_', ' ')}
                              </div>
                              <div className="text-sm text-gray-600 mb-2">{opp.description}</div>
                              <div className="flex justify-between text-xs">
                                <span>
                                  Potential: ${opp.potentialSavings || opp.potentialRevenue}
                                </span>
                                <span>ROI: {opp.roi}%</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Customer Usage Breakdown</CardTitle>
                    <CardDescription>Equipment performance by customer</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {usageAnalytics.customerBreakdown.map((customer: any) => (
                        <div key={customer.customerId} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-medium">{customer.customerName}</h4>
                            <div className="text-right">
                              <div className="font-bold">
                                {customer.usageTrends.currentMonth.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-600">Monthly volume</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {customer.equipment.map((eq: any, idx: number) => (
                              <div key={idx} className="bg-gray-50 rounded p-3">
                                <div className="font-medium text-sm">{eq.model}</div>
                                <div className="text-xs text-gray-600 mb-2">{eq.serialNumber}</div>

                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span>Utilization</span>
                                    <span className="font-medium">{eq.utilization}%</span>
                                  </div>
                                  <Progress value={eq.utilization} className="h-1" />
                                  <div className="flex justify-between">
                                    <span>Monthly Volume</span>
                                    <span>{eq.monthlyVolume.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Peak Day</span>
                                    <span>{eq.peakUsageDay}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {customer.alerts.length > 0 && (
                            <div className="mt-3 p-2 bg-yellow-50 rounded text-sm">
                              <div className="font-medium text-yellow-800">Alerts:</div>
                              {customer.alerts.map((alert: any, idx: number) => (
                                <div key={idx} className="text-yellow-700">
                                  • {alert.message}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="satisfaction" className="space-y-6">
            {satisfactionData && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Satisfaction Overview</CardTitle>
                      <CardDescription>Customer feedback and NPS trends</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600">
                            {measured(satisfactionData.summary.overallSatisfaction, '', 1)}
                          </div>
                          <div className="text-sm text-gray-600">Overall Satisfaction</div>
                          {/* No star row when there is no rating. Five empty
                              stars is a one-star-or-worse verdict on a business
                              that has simply never been surveyed. */}
                          {satisfactionData.summary.overallSatisfaction !== null && (
                            <div className="flex justify-center mt-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-5 w-5 ${
                                    star <= satisfactionData.summary.overallSatisfaction!
                                      ? 'text-yellow-400 fill-current'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-center">
                            {/* Green only for a real score: NPS runs -100 to
                                100, so a zero printed in green read as healthy
                                when it meant "nobody has been asked". */}
                            <div
                              className={`text-lg font-bold ${
                                (satisfactionData.summary.npsScore ?? -1) > 0
                                  ? 'text-green-600'
                                  : ''
                              }`}
                            >
                              {measured(satisfactionData.summary.npsScore)}
                            </div>
                            <div className="text-gray-600">NPS Score</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold">
                              {measured(satisfactionData.summary.responseRate, '%')}
                            </div>
                            <div className="text-gray-600">Response Rate</div>
                          </div>
                        </div>
                        {satisfactionData.degraded?.reason && (
                          <p className="text-xs text-muted-foreground">
                            {satisfactionData.degraded.reason}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Category Performance</CardTitle>
                      <CardDescription>Scores by service category</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(satisfactionData.categoryTrends).map(
                          ([key, trend]: [string, any]) => (
                            <div key={key} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">{trend.current.toFixed(1)}</span>
                                  {getTrendIcon(trend.trend)}
                                </div>
                              </div>
                              <Progress value={(trend.current / 5) * 100} className="h-2" />
                              <div className="flex justify-between text-xs text-gray-600">
                                <span>Target: {trend.target}</span>
                                <span
                                  className={
                                    trend.trend === 'improving' ? 'text-green-600' : 'text-gray-600'
                                  }
                                >
                                  {trend.trend}
                                </span>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Feedback</CardTitle>
                    <CardDescription>Latest customer survey responses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {satisfactionData.recentSurveys.map((survey: any) => (
                        <div key={survey.surveyId} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-medium">{survey.customerName}</h4>
                              <div className="text-sm text-gray-600">
                                {format(new Date(survey.submittedDate), 'MMM dd, yyyy')}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">
                                {survey.scores.overall.toFixed(1)}
                              </div>
                              <div className="text-sm text-gray-600">Overall Score</div>
                              <Badge
                                className={
                                  survey.category === 'promoter'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }
                              >
                                {survey.category}
                              </Badge>
                            </div>
                          </div>

                          <div className="text-sm text-gray-700 mb-3 italic">
                            "{survey.feedback}"
                          </div>

                          {survey.actionItems.length > 0 && (
                            <div className="bg-blue-50 rounded p-3">
                              <div className="font-medium text-blue-800 mb-2">Action Items:</div>
                              {survey.actionItems.map((item: any, idx: number) => (
                                <div key={idx} className="text-sm text-blue-700">
                                  • {item.action} (Assigned to: {item.assignedTo})
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="interventions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Intervention Recommendations</CardTitle>
                <CardDescription>
                  Risk factors and recommendations recorded on each customer's latest health score
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* The recommendations are the score's own `recommendations`
                    column, not generated here. */}
                <div className="space-y-4">
                  {healthScores.filter((s) => s.riskFactors.length || s.recommendations.length)
                    .length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No scored customer carries a risk factor or a recommendation.
                    </p>
                  ) : (
                    healthScores
                      .filter((s) => s.riskFactors.length || s.recommendations.length)
                      .map((score) => (
                        <HealthScoreCard
                          key={score.customerId}
                          score={score}
                          compact
                          onOpen={() => setLocation(`/customers/${score.customerId}`)}
                          onTask={() => setLocation('/tasks?action=new')}
                        />
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function HealthScoreCard({
  score,
  compact,
  onOpen,
  onTask,
}: {
  score: CustomerHealthView;
  compact?: boolean;
  onOpen: () => void;
  onTask: () => void;
}) {
  const s = score.signals;
  return (
    <Card>
      <CardContent className="py-4 space-y-4">
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-lg">{score.customerName}</h3>
              <Badge className={getHealthStatusColor(score.healthStatus)}>
                {score.healthStatus.replace('_', ' ')}
              </Badge>
              {score.trend && (
                <span className="flex items-center gap-1 text-sm text-gray-600 capitalize">
                  {getTrendIcon(score.trend)}
                  {score.trend}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Scored {format(new Date(score.calculatedAt), 'MMM dd, yyyy')}
              {score.nextCalculationDue &&
                ` · next due ${format(new Date(score.nextCalculationDue), 'MMM dd')}`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{score.overallScore ?? '—'}</div>
            <div className="text-xs text-gray-500">Health Score</div>
          </div>
        </div>

        {!compact && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-blue-50 rounded-lg p-4">
              {score.factors.map((f) => (
                <div key={f.label} className="text-center">
                  <div className="text-lg font-bold text-blue-700">{f.score ?? '—'}</div>
                  <div className="text-xs text-blue-600">{f.label}</div>
                  {f.score !== null && <Progress value={f.score} className="mt-1 h-2" />}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Days since service</span>
                <br />
                {s.daysSinceLastService ?? '—'}
              </div>
              <div>
                <span className="font-medium">Open tickets</span>
                <br />
                {s.openTickets ?? '—'}
              </div>
              <div>
                <span className="font-medium">Overdue invoices</span>
                <br />
                {s.overdueInvoices ?? '—'}
              </div>
              <div>
                <span className="font-medium">NPS</span>
                <br />
                {s.nps ?? '—'}
              </div>
              <div>
                <span className="font-medium">CSAT</span>
                <br />
                {s.csat ?? '—'}
              </div>
            </div>
          </>
        )}

        {score.riskFactors.length > 0 && (
          <div className="bg-red-50 rounded-lg p-3">
            <h5 className="font-medium text-red-800 mb-1">Risk factors</h5>
            <ul className="list-disc pl-5 text-sm text-red-700">
              {score.riskFactors.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {score.recommendations.length > 0 && (
          <div className="bg-green-50 rounded-lg p-3">
            <h5 className="font-medium text-green-800 mb-1">Recommendations</h5>
            <ul className="list-disc pl-5 text-sm text-green-700">
              {score.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {!compact && score.strengths.length > 0 && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Strengths:</span> {score.strengths.join(', ')}
          </div>
        )}

        {/* View Details opens the customer record, whose Activity tab is where
            a call or meeting is logged; Create Task opens the task dialog. The
            old Schedule Call / Schedule Meeting / Take Action buttons had no
            handler and nothing to call. */}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onOpen}>
            View Customer
          </Button>
          <Button size="sm" variant="outline" onClick={onTask}>
            Create Task
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
