import { useState, useMemo, memo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Star,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Target,
  Award,
  Calendar,
  BarChart3,
  Smile,
  Frown,
  ThumbsUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { LineChart, BarChart, PieChart } from '@/components/charts/ChartComponents';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';

// Types for satisfaction analytics data
type SatisfactionAnalytics = {
  summary: {
    totalSurveys: number;
    averageScore: number;
    npsScore: number;
    responseRate: number;
    improvementTrend: string;
  };
  trends: Array<{
    date: string;
    averageScore: number;
    npsScore: number;
    responseCount: number;
  }>;
  scoreDistribution: Array<{
    score: number;
    count: number;
    percentage: number;
  }>;
  npsBreakdown: {
    promoters: number;
    passives: number;
    detractors: number;
  };
  surveyTypeBreakdown: Array<{
    type: string;
    count: number;
    averageScore: number;
  }>;
  recentSurveys: Array<{
    id: string;
    completedAt: string;
    overallScore: number;
    npsScore: number;
    surveyType: string;
    templateName: string;
  }>;
};

interface CustomerSatisfactionAnalyticsDashboardProps {
  customerId?: string;
  tenantId?: string;
}

export const CustomerSatisfactionAnalyticsDashboard = memo(
  function CustomerSatisfactionAnalyticsDashboard({
    customerId,
    tenantId,
  }: CustomerSatisfactionAnalyticsDashboardProps) {
    const [timeRange, setTimeRange] = useState<string>('90d');
    const [selectedSurveyType, setSelectedSurveyType] = useState<string>('all');

    // Fetch satisfaction analytics - Optimized with better caching
    const {
      data: analyticsData,
      isLoading,
      isError,
      error,
      refetch,
    } = useQuery({
      queryKey: [
        '/api/customer-portal/satisfaction/analytics',
        { timeRange, customerId, tenantId },
      ],
      queryFn: async () => {
        const params = new URLSearchParams({ timeRange });
        return await apiRequest(`/api/customer-portal/satisfaction/analytics?${params}`);
      },
      staleTime: 3 * 60 * 1000, // 3 minutes - analytics don't change frequently
      refetchInterval: 5 * 60 * 1000, // Keep 5 minutes, reasonable for analytics
      refetchIntervalInBackground: false, // Don't refetch when tab is not visible
    });

    const analytics: SatisfactionAnalytics | null = analyticsData?.data || analyticsData || null;

    if (isLoading) {
      return <AnalyticsLoadingSkeleton />;
    }

    if (isError) {
      return (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <h3 className="font-medium">Failed to load satisfaction analytics</h3>
                <p className="text-sm mt-1">{error?.message || 'Please try again'}</p>
              </div>
            </div>
            <Button onClick={() => refetch()} className="mt-4" variant="outline" size="sm">
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!analytics || analytics.summary.totalSurveys === 0) {
      return (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-medium mb-2">No satisfaction data available</h3>
              <p className="text-sm">Complete some surveys to see your satisfaction analytics.</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Memoized helper functions to prevent unnecessary re-creation
    const getTrendIcon = useCallback((trend: string) => {
      switch (trend) {
        case 'improving':
          return <TrendingUp className="h-4 w-4 text-green-500" />;
        case 'declining':
          return <TrendingDown className="h-4 w-4 text-red-500" />;
        default:
          return <Target className="h-4 w-4 text-blue-500" />;
      }
    }, []);

    // Memoized getNPSCategory function - was causing performance issues
    const getNPSCategory = useCallback((score: number) => {
      if (score >= 50) return { label: 'Excellent', color: 'text-green-600 bg-green-50' };
      if (score >= 0) return { label: 'Good', color: 'text-blue-600 bg-blue-50' };
      return { label: 'Needs Improvement', color: 'text-red-600 bg-red-50' };
    }, []);

    // Memoized NPS category calculation
    const npsCategory = useMemo(
      () => getNPSCategory(analytics?.summary.npsScore || 0),
      [analytics?.summary.npsScore, getNPSCategory],
    );

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Header with Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Customer Satisfaction Analytics</h2>
            <p className="text-muted-foreground">Track your feedback and satisfaction trends</p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32" data-testid="select-timerange">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="6m">Last 6 months</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Key Metrics Cards - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Surveys</p>
                  <p className="text-2xl font-bold" data-testid="metric-total-surveys">
                    {analytics.summary.totalSurveys}
                  </p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Average Score</p>
                  <p className="text-2xl font-bold" data-testid="metric-average-score">
                    {analytics.summary.averageScore?.toFixed(1) || 'N/A'}
                    <span className="text-sm text-muted-foreground">/5</span>
                  </p>
                </div>
                <Star className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="flex items-center mt-2">
                {getTrendIcon(analytics.summary.improvementTrend)}
                <span className="text-xs text-muted-foreground ml-1 capitalize">
                  {analytics.summary.improvementTrend || 'stable'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">NPS Score</p>
                  <p className="text-2xl font-bold" data-testid="metric-nps-score">
                    {analytics.summary.npsScore?.toFixed(0) || 'N/A'}
                  </p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
              <Badge className={`mt-2 text-xs ${npsCategory.color}`}>{npsCategory.label}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Response Rate</p>
                  <p className="text-2xl font-bold" data-testid="metric-response-rate">
                    {analytics.summary.responseRate?.toFixed(0) || '0'}%
                  </p>
                </div>
                <Users className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="trends" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="nps">NPS Analysis</TabsTrigger>
            <TabsTrigger value="recent">Recent Feedback</TabsTrigger>
          </TabsList>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Satisfaction Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.trends && analytics.trends.length > 0 ? (
                  <div className="h-64 sm:h-80">
                    <LineChart
                      data={analytics.trends}
                      xKey="date"
                      yKey="averageScore"
                      title="Average Satisfaction Score Over Time"
                      color="#3b82f6"
                    />
                  </div>
                ) : (
                  <div className="h-32 sm:h-40 flex items-center justify-center text-muted-foreground">
                    <p className="text-sm sm:text-base">
                      No trend data available for selected period
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Survey Type Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.surveyTypeBreakdown?.map((type, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm capitalize">
                            {type.type.replace('_', ' ')}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress
                              value={(type.averageScore / 5) * 100}
                              className="h-2 flex-1"
                            />
                            <span className="text-xs text-muted-foreground">
                              {type.averageScore.toFixed(1)}/5
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="ml-3">
                          {type.count} surveys
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Response Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.trends && analytics.trends.length > 0 ? (
                    <div className="h-32 sm:h-40">
                      <BarChart
                        data={analytics.trends.slice(-7)} // Last 7 data points
                        xKey="date"
                        yKey="responseCount"
                        title="Survey Responses"
                        color="#10b981"
                      />
                    </div>
                  ) : (
                    <div className="h-32 sm:h-40 flex items-center justify-center text-muted-foreground">
                      <p className="text-sm sm:text-base">No response data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Distribution Tab */}
          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Score Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.scoreDistribution && analytics.scoreDistribution.length > 0 ? (
                    <div className="h-64">
                      <BarChart
                        data={analytics.scoreDistribution}
                        xKey="score"
                        yKey="count"
                        title="Satisfaction Score Distribution"
                        color="#8b5cf6"
                      />
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      <p>No distribution data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Score Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.scoreDistribution?.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {Array.from({ length: item.score }, (_, i) => (
                              <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            ))}
                            {Array.from({ length: 5 - item.score }, (_, i) => (
                              <Star key={i} className="h-4 w-4 text-gray-300" />
                            ))}
                          </div>
                          <span className="text-sm font-medium">{item.score} Star</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">{item.count}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({item.percentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* NPS Analysis Tab */}
          <TabsContent value="nps" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    NPS Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.npsBreakdown ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <ThumbsUp className="h-5 w-5 text-green-600" />
                          <span className="font-medium">Promoters (9-10)</span>
                        </div>
                        <span className="text-lg font-bold text-green-600">
                          {analytics.npsBreakdown.promoters}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Smile className="h-5 w-5 text-yellow-600" />
                          <span className="font-medium">Passives (7-8)</span>
                        </div>
                        <span className="text-lg font-bold text-yellow-600">
                          {analytics.npsBreakdown.passives}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Frown className="h-5 w-5 text-red-600" />
                          <span className="font-medium">Detractors (0-6)</span>
                        </div>
                        <span className="text-lg font-bold text-red-600">
                          {analytics.npsBreakdown.detractors}
                        </span>
                      </div>

                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Your NPS Score</p>
                          <p className="text-3xl font-bold text-blue-600">
                            {analytics.summary.npsScore?.toFixed(0) || '0'}
                          </p>
                          <Badge className={`mt-2 ${npsCategory.color}`}>{npsCategory.label}</Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No NPS data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>NPS Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.trends && analytics.trends.length > 0 ? (
                    <div className="h-64">
                      <LineChart
                        data={analytics.trends}
                        xKey="date"
                        yKey="npsScore"
                        title="NPS Score Over Time"
                        color="#10b981"
                      />
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      <p>No NPS trend data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Recent Feedback Tab */}
          <TabsContent value="recent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Recent Survey Completions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.recentSurveys && analytics.recentSurveys.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.recentSurveys.map((survey, index) => (
                      <div
                        key={survey.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`recent-survey-${index}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">
                              {survey.templateName || survey.surveyType.replace('_', ' ')}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {survey.surveyType.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Completed: {new Date(survey.completedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {survey.overallScore && (
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">{survey.overallScore}/5</span>
                            </div>
                          )}
                          {survey.npsScore !== undefined && (
                            <Badge variant="outline">NPS: {survey.npsScore}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No recent surveys completed</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  },
);

// Loading skeleton component
function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
