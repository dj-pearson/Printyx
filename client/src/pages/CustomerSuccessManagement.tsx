import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { HeartHandshake, TrendingUp, AlertTriangle, Users, Target, Activity, BarChart3, RefreshCw, Star, ThumbsUp, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts';

interface CustomerHealthScore {
  customerId: string;
  customerName: string;
  accountManager: string;
  overallHealthScore: number;
  healthStatus: string;
  riskLevel: string;
  churnProbability: number;
  scoreBreakdown: {
    usageHealth: number;
    paymentHealth: number;
    serviceHealth: number;
    contractHealth: number;
    engagementHealth: number;
  };
  metrics: {
    contractValue: number;
    monthsRemaining: number;
    lastPaymentDate: Date;
    daysSinceLastService: number;
    averageResponseTime: number;
    satisfactionScore: number;
    usageUtilization: number;
    renewalProbability: number;
  };
  trends: {
    usageTrend: string;
    paymentTrend: string;
    serviceTrend: string;
    engagementTrend: string;
  };
  riskFactors: Array<{
    factor: string;
    severity: string;
    description: string;
    impact: number;
    recommendation: string;
  }>;
  opportunities: Array<{
    type: string;
    description: string;
    value: number;
    probability: number;
    action: string;
  }>;
  alerts: Array<{
    type: string;
    priority: string;
    message: string;
    dueDate: Date;
  }>;
  lastUpdated: Date;
  nextReviewDate: Date;
}

const getHealthStatusColor = (status: string) => {
  switch (status) {
    case 'excellent': return 'bg-green-100 text-green-800';
    case 'healthy': return 'bg-blue-100 text-blue-800';
    case 'at_risk': return 'bg-yellow-100 text-yellow-800';
    case 'critical': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getRiskLevelColor = (level: string) => {
  switch (level) {
    case 'very_low': return 'bg-green-100 text-green-800';
    case 'low': return 'bg-blue-100 text-blue-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'critical': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'improving': case 'growing': case 'excellent':
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'declining': case 'worsening':
      return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

export default function CustomerSuccessManagement() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [isCalculatingHealth, setIsCalculatingHealth] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  // Fetch customer health scores
  const { data: healthScores = [], isLoading: healthLoading } = useQuery<CustomerHealthScore[]>({
    queryKey: ['/api/customer-success/health-scores'],
    select: (data: any[]) => data.map(score => ({
      ...score,
      metrics: {
        ...score.metrics,
        lastPaymentDate: new Date(score.metrics.lastPaymentDate)
      },
      alerts: score.alerts.map((alert: any) => ({
        ...alert,
        dueDate: new Date(alert.dueDate)
      })),
      lastUpdated: new Date(score.lastUpdated),
      nextReviewDate: new Date(score.nextReviewDate)
    }))
  });

  // Fetch usage analytics
  const { data: usageAnalytics } = useQuery({
    queryKey: ['/api/customer-success/usage-analytics', selectedPeriod]
  });

  // Fetch satisfaction data
  const { data: satisfactionData } = useQuery({
    queryKey: ['/api/customer-success/satisfaction']
  });

  // Calculate health scores mutation
  const calculateHealthMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/customer-success/calculate-health', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-success/health-scores'] });
      setIsCalculatingHealth(false);
      toast({
        title: "Health Scores Updated",
        description: "Customer health scores have been recalculated successfully.",
      });
    }
  });

  const handleCalculateHealth = () => {
    setIsCalculatingHealth(true);
    calculateHealthMutation.mutate({ recalculateAll: true });
  };

  if (healthLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading customer success data...</p>
          </div>
        </div>
      </div>
    );
  }

  const averageHealthScore = healthScores.length > 0 
    ? healthScores.reduce((sum, score) => sum + score.overallHealthScore, 0) / healthScores.length 
    : 0;
  
  const atRiskCustomers = healthScores.filter(score => score.riskLevel === 'medium' || score.riskLevel === 'high').length;
  const totalAlerts = healthScores.reduce((sum, score) => sum + score.alerts.length, 0);

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Success Management</h1>
          <p className="text-gray-600 mt-2">Monitor customer health, usage patterns, and satisfaction</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleCalculateHealth}
            disabled={isCalculatingHealth}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isCalculatingHealth ? 'animate-spin' : ''}`} />
            {isCalculatingHealth ? 'Calculating...' : 'Refresh Health Scores'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Health Score</CardTitle>
            <HeartHandshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageHealthScore.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Out of 100 possible points
            </p>
            <Progress value={averageHealthScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At-Risk Customers</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{atRiskCustomers}</div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
            <div className="text-xs text-gray-600 mt-1">
              {((atRiskCustomers / healthScores.length) * 100).toFixed(1)}% of total customers
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalAlerts}</div>
            <p className="text-xs text-muted-foreground">
              Pending action items
            </p>
            {satisfactionData && (
              <div className="text-xs text-gray-600 mt-1">
                NPS Score: {satisfactionData.summary.npsScore}
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
                <div className="text-2xl font-bold">{satisfactionData.summary.overallSatisfaction.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">
                  Average satisfaction rating
                </p>
                <div className="text-xs text-gray-600 mt-1">
                  {satisfactionData.summary.responseRate}% response rate
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="health-scores" className="space-y-6">
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Health Scores Available</h3>
                <p className="text-gray-600 mb-4">Calculate customer health scores to get started.</p>
                <Button onClick={handleCalculateHealth}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Calculate Health Scores
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {healthScores.map((score) => (
                <Card key={score.customerId} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-lg">{score.customerName}</h3>
                          <Badge className={getHealthStatusColor(score.healthStatus)}>
                            {score.healthStatus.replace('_', ' ')}
                          </Badge>
                          <Badge className={getRiskLevelColor(score.riskLevel)}>
                            {score.riskLevel.replace('_', ' ')} risk
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                          <div>
                            <span className="font-medium">Account Manager:</span>
                            <br />
                            {score.accountManager}
                          </div>
                          <div>
                            <span className="font-medium">Contract Value:</span>
                            <br />
                            ${score.metrics.contractValue.toLocaleString()}
                          </div>
                          <div>
                            <span className="font-medium">Months Remaining:</span>
                            <br />
                            {score.metrics.monthsRemaining}
                          </div>
                          <div>
                            <span className="font-medium">Churn Risk:</span>
                            <br />
                            {score.churnProbability}%
                          </div>
                        </div>

                        {/* Score breakdown */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-4">
                          <h5 className="font-medium text-blue-800 mb-3">Health Score Breakdown</h5>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {Object.entries(score.scoreBreakdown).map(([key, value]) => (
                              <div key={key} className="text-center">
                                <div className="text-lg font-bold text-blue-700">{value}</div>
                                <div className="text-xs text-blue-600 capitalize">
                                  {key.replace('Health', '').replace(/([A-Z])/g, ' $1').trim()}
                                </div>
                                <Progress value={value} className="mt-1 h-2" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Trends */}
                        <div className="bg-gray-50 rounded-lg p-3 mb-4">
                          <h5 className="font-medium text-gray-800 mb-2">Trends</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            {Object.entries(score.trends).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2">
                                {getTrendIcon(value)}
                                <span className="capitalize">{key.replace('Trend', '')}:</span>
                                <span className="font-medium capitalize">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Risk factors */}
                        {score.riskFactors.length > 0 && (
                          <div className="bg-yellow-50 rounded-lg p-3 mb-4">
                            <h5 className="font-medium text-yellow-800 mb-2">Risk Factors</h5>
                            <div className="space-y-2">
                              {score.riskFactors.map((risk, idx) => (
                                <div key={idx} className="text-sm">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-yellow-700">{risk.factor}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {risk.severity} impact
                                    </Badge>
                                  </div>
                                  <div className="text-yellow-600 mb-1">{risk.description}</div>
                                  <div className="text-xs text-yellow-700 font-medium">
                                    Recommendation: {risk.recommendation}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Opportunities */}
                        {score.opportunities.length > 0 && (
                          <div className="bg-green-50 rounded-lg p-3 mb-4">
                            <h5 className="font-medium text-green-800 mb-2">Growth Opportunities</h5>
                            <div className="space-y-2">
                              {score.opportunities.map((opp, idx) => (
                                <div key={idx} className="text-sm">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-green-700 capitalize">
                                      {opp.type.replace('_', ' ')}
                                    </span>
                                    <div className="text-right">
                                      <div className="font-bold text-green-600">
                                        ${opp.value.toLocaleString()}
                                      </div>
                                      <div className="text-xs text-green-600">
                                        {opp.probability}% probability
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-green-600 mb-1">{opp.description}</div>
                                  <div className="text-xs text-green-700 font-medium">
                                    Action: {opp.action}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Active alerts */}
                        {score.alerts.length > 0 && (
                          <div className="bg-red-50 rounded-lg p-3">
                            <h5 className="font-medium text-red-800 mb-2">Active Alerts</h5>
                            <div className="space-y-2">
                              {score.alerts.map((alert, idx) => (
                                <div key={idx} className="text-sm">
                                  <div className="flex justify-between items-start">
                                    <span className="font-medium text-red-700 capitalize">
                                      {alert.type.replace('_', ' ')}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {alert.priority}
                                    </Badge>
                                  </div>
                                  <div className="text-red-600">{alert.message}</div>
                                  <div className="text-xs text-red-700">
                                    Due: {format(alert.dueDate, 'MMM dd, yyyy')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right ml-6">
                        <div className="text-3xl font-bold text-blue-600">
                          {score.overallHealthScore}
                        </div>
                        <div className="text-xs text-gray-500">Health Score</div>
                        
                        <div className="mt-4 space-y-1 text-xs">
                          <div>Renewal: {score.metrics.renewalProbability}%</div>
                          <div>Satisfaction: {score.metrics.satisfactionScore.toFixed(1)}/5</div>
                          <div>Utilization: {score.metrics.usageUtilization}%</div>
                        </div>
                        
                        <div className="mt-4 text-xs text-gray-600">
                          <div>Last updated: {format(score.lastUpdated, 'MMM dd')}</div>
                          <div>Next review: {format(score.nextReviewDate, 'MMM dd')}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                      <Button size="sm" variant="outline">
                        Schedule Meeting
                      </Button>
                      {score.alerts.length > 0 && (
                        <Button size="sm">
                          Take Action
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
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
                        <span className="font-bold">{usageAnalytics.summary.averageUtilization}%</span>
                      </div>
                      <Progress value={usageAnalytics.summary.averageUtilization} />
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Monthly Volume</div>
                          <div className="font-bold">
                            {usageAnalytics.summary.totalMonthlyVolume.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Trend</div>
                          <div className="font-bold text-green-600">
                            +{usageAnalytics.summary.utilizationTrend}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Optimization Opportunities</CardTitle>
                    <CardDescription>Potential cost savings and revenue increases</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {usageAnalytics.optimizationOpportunities.slice(0, 3).map((opp: any, idx: number) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                          <div className="font-medium capitalize">
                            {opp.type.replace('_', ' ')}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            {opp.description}
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>Potential: ${opp.potentialSavings || opp.potentialRevenue}</span>
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
                            <div className="font-bold">{customer.usageTrends.currentMonth.toLocaleString()}</div>
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
                          {satisfactionData.summary.overallSatisfaction.toFixed(1)}
                        </div>
                        <div className="text-sm text-gray-600">Overall Satisfaction</div>
                        <div className="flex justify-center mt-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star}
                              className={`h-5 w-5 ${
                                star <= satisfactionData.summary.overallSatisfaction 
                                  ? 'text-yellow-400 fill-current' 
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">
                            {satisfactionData.summary.npsScore}
                          </div>
                          <div className="text-gray-600">NPS Score</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold">
                            {satisfactionData.summary.responseRate}%
                          </div>
                          <div className="text-gray-600">Response Rate</div>
                        </div>
                      </div>
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
                      {Object.entries(satisfactionData.categoryTrends).map(([key, trend]: [string, any]) => (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{trend.current.toFixed(1)}</span>
                              {getTrendIcon(trend.trend)}
                            </div>
                          </div>
                          <Progress value={(trend.current / 5) * 100} className="h-2" />
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>Target: {trend.target}</span>
                            <span className={trend.trend === 'improving' ? 'text-green-600' : 'text-gray-600'}>
                              {trend.trend}
                            </span>
                          </div>
                        </div>
                      ))}
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
                            <div className="text-lg font-bold">{survey.scores.overall.toFixed(1)}</div>
                            <div className="text-sm text-gray-600">Overall Score</div>
                            <Badge className={survey.category === 'promoter' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
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
              <CardDescription>Automated suggestions for customer success actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {healthScores
                  .filter(score => score.riskFactors.length > 0 || score.opportunities.length > 0)
                  .map((score) => (
                    <div key={score.customerId} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium">{score.customerName}</h4>
                          <Badge className={getRiskLevelColor(score.riskLevel)}>
                            {score.riskLevel.replace('_', ' ')} risk
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{score.overallHealthScore}</div>
                          <div className="text-sm text-gray-600">Health Score</div>
                        </div>
                      </div>
                      
                      {score.riskFactors.length > 0 && (
                        <div className="mb-3">
                          <div className="font-medium text-red-700 mb-2">Risk Mitigation:</div>
                          {score.riskFactors.map((risk, idx) => (
                            <div key={idx} className="bg-red-50 rounded p-3 mb-2">
                              <div className="font-medium text-red-800">{risk.factor}</div>
                              <div className="text-sm text-red-700 mb-2">{risk.description}</div>
                              <div className="text-sm font-medium text-red-800">
                                Recommended Action: {risk.recommendation}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {score.opportunities.length > 0 && (
                        <div className="mb-3">
                          <div className="font-medium text-green-700 mb-2">Growth Opportunities:</div>
                          {score.opportunities.map((opp, idx) => (
                            <div key={idx} className="bg-green-50 rounded p-3 mb-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-green-800 capitalize">
                                    {opp.type.replace('_', ' ')}
                                  </div>
                                  <div className="text-sm text-green-700 mb-2">{opp.description}</div>
                                  <div className="text-sm font-medium text-green-800">
                                    Recommended Action: {opp.action}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-green-600">
                                    ${opp.value.toLocaleString()}
                                  </div>
                                  <div className="text-sm text-green-600">
                                    {opp.probability}% chance
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline">
                          Schedule Call
                        </Button>
                        <Button size="sm" variant="outline">
                          Create Task
                        </Button>
                        <Button size="sm">
                          Take Action
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}