import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import MainLayout from '@/components/layout/main-layout';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Target,
  Users,
  DollarSign,
  Activity,
  Zap,
  BarChart3,
  RefreshCw,
  Settings,
  Eye,
  CheckCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Plus,
  Database,
  Cpu,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';

// Helper functions for formatting
const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const formatPercentage = (value: number | undefined): string => {
  if (value === undefined || value === null) return '0%';
  return `${(value * 100).toFixed(1)}%`;
};

const getPriorityColor = (priority: string): string => {
  switch (priority?.toLowerCase()) {
    case 'urgent':
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'production':
    case 'active':
    case 'healthy':
      return 'bg-green-100 text-green-800';
    case 'training':
    case 'running':
      return 'bg-blue-100 text-blue-800';
    case 'pending':
    case 'warning':
      return 'bg-yellow-100 text-yellow-800';
    case 'failed':
    case 'error':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getImpactIcon = (impact: string) => {
  switch (impact?.toLowerCase()) {
    case 'critical':
    case 'high':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case 'medium':
      return <Activity className="h-4 w-4 text-yellow-600" />;
    case 'low':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

export default function PredictiveAnalytics() {
  const [selectedTab, setSelectedTab] = useState('dashboard');

  // Fetch predictive analytics data
  const { data: analyticsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/predictive-analytics/dashboard'],
    select: (data: any) => {
      if (!data) return null;
      return {
        ...data,
        predictiveInsights: data.predictiveInsights?.map((insight: any) => ({
          ...insight,
          lastUpdated: insight.lastUpdated ? new Date(insight.lastUpdated) : new Date()
        })) || [],
        modelPerformance: data.modelPerformance?.map((model: any) => ({
          ...model,
          lastTrained: model.lastTrained ? new Date(model.lastTrained) : new Date()
        })) || []
      };
    },
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch ML models data
  const { data: modelsData } = useQuery({
    queryKey: ['/api/predictive-analytics/models'],
    refetchInterval: 30000
  });

  // Fetch data sources
  const { data: dataSourcesData } = useQuery({
    queryKey: ['/api/predictive-analytics/data-sources'],
    refetchInterval: 30000
  });

  if (isLoading) {
    return (
      <MainLayout 
        title="Predictive Analytics" 
        description="AI-powered forecasting and predictive insights for your business"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading predictive analytics...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!analyticsData) {
    return (
      <MainLayout 
        title="Predictive Analytics" 
        description="AI-powered forecasting and predictive insights for your business"
      >
        <div className="text-center">
          <p className="text-gray-600">No analytics data available</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Predictive Analytics" 
      description="AI-powered forecasting and predictive insights for your business"
    >
      <div className="flex justify-between items-center mb-6">
            <Brain className="h-6 w-6 text-blue-600" />
            Predictive Analytics & AI Platform
          </h1>
          <p className="text-gray-600 mt-1">Advanced machine learning insights and business intelligence powered by AI</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
          
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            New Model
          </Button>
        </div>
      </div>

      {/* AI/ML Overview KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active ML Models</p>
                <p className="text-2xl font-bold text-blue-900">
                  {analyticsData.mlModelsOverview?.activeModels || 0}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Brain className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-green-600">
                {formatPercentage(analyticsData.mlModelsOverview?.modelAccuracy)} avg accuracy
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Predictions Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(analyticsData.mlModelsOverview?.predictionsMadeToday)}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Target className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-green-600">
                {formatPercentage(analyticsData.mlModelsOverview?.successfulPredictions)} success rate
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Data Points Processed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(analyticsData.mlModelsOverview?.dataPointsProcessed)}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Database className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm">
              <Clock className="h-4 w-4 text-blue-600 mr-1" />
              <span className="text-blue-600">
                {analyticsData.mlModelsOverview?.averageProcessingTime || 0}ms avg time
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Training Jobs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData.mlModelsOverview?.modelTrainingJobs || 0}
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Cpu className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm">
              <Activity className="h-4 w-4 text-orange-600 mr-1" />
              <span className="text-orange-600">Running</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">AI Insights</TabsTrigger>
          <TabsTrigger value="models">ML Models</TabsTrigger>
          <TabsTrigger value="customer">Customer Analytics</TabsTrigger>
          <TabsTrigger value="business">Business Intelligence</TabsTrigger>
          <TabsTrigger value="data">Data Sources</TabsTrigger>
          <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Predictive Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Real-time Predictive Insights
              </CardTitle>
              <CardDescription>AI-powered predictions requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(analyticsData.predictiveInsights || []).map((insight: any, idx: number) => (
                  <div key={idx} className="p-4 border rounded-lg hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getImpactIcon(insight.impact)}
                          <h3 className="font-semibold text-lg">{insight.type}</h3>
                          <Badge className={getPriorityColor(insight.priority)}>
                            {insight.priority}
                          </Badge>
                        </div>
                        <p className="text-gray-700 mb-2">{insight.description}</p>
                        <p className="text-sm text-blue-600 font-medium">{insight.actionRequired}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {formatPercentage(insight.confidence)}
                        </div>
                        <div className="text-xs text-gray-500">confidence</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                      <div>
                        <span className="text-sm text-gray-600">Timeframe:</span>
                        <span className="ml-2 font-medium">{insight.timeframe}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Est. Impact:</span>
                        <span className="ml-2 font-medium">{insight.estimatedImpact}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Model:</span>
                        <span className="ml-2 font-medium text-xs">{insight.modelUsed}</span>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div className="text-sm text-gray-600 mb-1">Key Factors:</div>
                      <div className="flex flex-wrap gap-1">
                        {(insight.dataFactors || []).map((factor: string, factorIdx: number) => (
                          <Badge key={factorIdx} variant="secondary" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-3 border-t">
                      <div className="text-xs text-gray-500">
                        Updated: {format(insight.lastUpdated, 'MMM dd, yyyy HH:mm')}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                        <Button size="sm">
                          Take Action
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          {/* ML Model Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                Machine Learning Model Performance
              </CardTitle>
              <CardDescription>Real-time performance metrics for active AI models</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(analyticsData.modelPerformance || []).map((model: any, idx: number) => (
                  <div key={idx} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{model.name}</h3>
                          <Badge className={getStatusColor(model.status)}>
                            {model.status}
                          </Badge>
                          <span className="text-sm text-gray-500">{model.version}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Accuracy:</span>
                            <span className="ml-2 font-bold text-green-600">{formatPercentage(model.accuracy)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Precision:</span>
                            <span className="ml-2 font-medium">{formatPercentage(model.precision)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Recall:</span>
                            <span className="ml-2 font-medium">{formatPercentage(model.recall)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">F1 Score:</span>
                            <span className="ml-2 font-medium">{formatPercentage(model.f1Score)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">
                          {formatNumber(model.predictionsToday)}
                        </div>
                        <div className="text-xs text-gray-500">predictions today</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <span className="text-sm text-gray-600">Data Points:</span>
                        <span className="ml-2 font-medium">{formatNumber(model.dataPoints)}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Features:</span>
                        <span className="ml-2 font-medium">{model.features}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Success Rate:</span>
                        <span className="ml-2 font-medium">{formatPercentage(model.successRate)}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-3 border-t">
                      <div className="text-xs text-gray-500">
                        Last trained: {format(model.lastTrained, 'MMM dd, yyyy')}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Metrics
                        </Button>
                        <Button size="sm" variant="outline">
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                        <Button size="sm">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Retrain
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Training Jobs */}
          {modelsData?.trainingJobs && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-orange-600" />
                  Active Training Jobs
                </CardTitle>
                <CardDescription>Currently running model training processes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {modelsData.trainingJobs.map((job: any, idx: number) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{job.modelName}</h3>
                          <Badge className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {Math.round(job.progress * 100)}% complete
                          </div>
                        </div>
                      </div>
                      
                      <Progress value={job.progress * 100} className="mb-3" />
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Data Points:</span>
                          <span className="ml-2 font-medium">{formatNumber(job.dataPoints)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Current Accuracy:</span>
                          <span className="ml-2 font-medium">
                            {job.currentAccuracy ? formatPercentage(job.currentAccuracy) : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Target:</span>
                          <span className="ml-2 font-medium">{formatPercentage(job.targetAccuracy)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="customer" className="space-y-6">
          {/* Customer Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Customer Segmentation
                </CardTitle>
                <CardDescription>AI-powered customer classification and insights</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(analyticsData.customerAnalytics?.customerSegments || []).map((segment: any, idx: number) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold" style={{ color: segment.color }}>
                          {segment.name}
                        </h3>
                        <div className="text-right">
                          <div className="font-bold">{formatNumber(segment.count)}</div>
                          <div className="text-xs text-gray-500">{formatPercentage(segment.percentage)}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-600">Avg Revenue:</span>
                          <span className="ml-2 font-medium">{formatCurrency(segment.avgRevenue)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Churn Risk:</span>
                          <span className="ml-2 font-medium">{formatPercentage(segment.churnRisk)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Satisfaction:</span>
                          <span className="ml-2 font-medium">{segment.satisfactionScore}/5</span>
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Characteristics:</div>
                        <div className="flex flex-wrap gap-1">
                          {(segment.characteristics || []).map((char: string, charIdx: number) => (
                            <Badge key={charIdx} variant="secondary" className="text-xs">
                              {char}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Churn Risk Analysis
                </CardTitle>
                <CardDescription>Predictive customer retention insights</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium mb-3">Next 30 Days Risk Assessment</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-red-50 border border-red-200 rounded">
                        <div className="text-2xl font-bold text-red-900">
                          {analyticsData.customerAnalytics?.churnPrediction?.next30Days?.highRisk || 0}
                        </div>
                        <div className="text-sm text-red-600">High Risk</div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <div className="text-2xl font-bold text-yellow-900">
                          {analyticsData.customerAnalytics?.churnPrediction?.next30Days?.mediumRisk || 0}
                        </div>
                        <div className="text-sm text-yellow-600">Medium Risk</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-3">Revenue at Risk</h3>
                    <div className="text-center p-4 bg-gray-50 border rounded">
                      <div className="text-3xl font-bold text-gray-900">
                        {formatCurrency(analyticsData.customerAnalytics?.churnPrediction?.next30Days?.totalRevenuAtRisk)}
                      </div>
                      <div className="text-sm text-gray-600">Next 30 days</div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-3">Retention Performance</h3>
                    <div className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded">
                      <span className="text-sm text-green-700">Success Rate:</span>
                      <span className="font-bold text-green-900">
                        {formatPercentage(analyticsData.customerAnalytics?.churnPrediction?.retentionSuccessRate)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer Lifetime Value */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Customer Lifetime Value Analysis
              </CardTitle>
              <CardDescription>Predictive CLV and top-performing accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-900">
                        {formatCurrency(analyticsData.customerAnalytics?.customerLifetimeValue?.averageCLV)}
                      </div>
                      <div className="text-sm text-gray-600">Average CLV</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-900">
                        {formatCurrency(analyticsData.customerAnalytics?.customerLifetimeValue?.predictedCLV)}
                      </div>
                      <div className="text-sm text-gray-600">Predicted CLV</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-3">Top Performers by CLV</h3>
                  <div className="space-y-2">
                    {(analyticsData.customerAnalytics?.customerLifetimeValue?.topPerformers || []).map((customer: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-xs text-gray-500">
                            {formatPercentage(customer.confidence)} confidence
                          </div>
                        </div>
                        <div className="font-bold text-green-600">
                          {formatCurrency(customer.clv)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business" className="space-y-6">
          {/* Business Intelligence Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Revenue Forecasting
                </CardTitle>
                <CardDescription>AI-powered revenue predictions and trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-4 bg-green-50 border border-green-200 rounded">
                    <div className="text-3xl font-bold text-green-900">
                      {formatCurrency(analyticsData.businessIntelligence?.revenueForecasting?.currentMonthForecast)}
                    </div>
                    <div className="text-sm text-green-600">Current Month Forecast</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatPercentage(analyticsData.businessIntelligence?.revenueForecasting?.forecastAccuracy)} accuracy
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 border rounded">
                      <div className="font-bold text-gray-900">
                        {formatCurrency(analyticsData.businessIntelligence?.revenueForecasting?.confidenceInterval?.lower)}
                      </div>
                      <div className="text-xs text-gray-600">Lower bound</div>
                    </div>
                    <div className="text-center p-3 border rounded">
                      <div className="font-bold text-gray-900">
                        {formatCurrency(analyticsData.businessIntelligence?.revenueForecasting?.confidenceInterval?.upper)}
                      </div>
                      <div className="text-xs text-gray-600">Upper bound</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Key Growth Drivers</h4>
                    <div className="space-y-2">
                      {(analyticsData.businessIntelligence?.revenueForecasting?.keyDrivers || []).map((driver: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span>{driver.factor}</span>
                          <span className="font-medium">{formatPercentage(driver.impact)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-600" />
                  Market Analysis
                </CardTitle>
                <CardDescription>Competitive intelligence and market positioning</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded">
                    <div className="text-2xl font-bold text-blue-900">
                      {formatPercentage(analyticsData.businessIntelligence?.marketAnalysis?.marketShare)}
                    </div>
                    <div className="text-sm text-blue-600">Market Share</div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Competitor Analysis</h4>
                    <div className="space-y-2">
                      {(analyticsData.businessIntelligence?.marketAnalysis?.competitorAnalysis || []).map((comp: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 border rounded text-sm">
                          <span className="font-medium">{comp.name}</span>
                          <div className="flex items-center gap-2">
                            <span>{formatPercentage(comp.marketShare)}</span>
                            {comp.trend === 'growing' ? (
                              <ArrowUp className="h-3 w-3 text-green-600" />
                            ) : comp.trend === 'declining' ? (
                              <ArrowDown className="h-3 w-3 text-red-600" />
                            ) : (
                              <div className="h-3 w-3 bg-gray-400 rounded-full" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="font-medium text-yellow-800">Opportunity Score</div>
                    <div className="text-2xl font-bold text-yellow-900">
                      {analyticsData.businessIntelligence?.marketAnalysis?.opportunityScore}/10
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Operational Efficiency */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                Operational Efficiency Metrics
              </CardTitle>
              <CardDescription>Performance indicators and efficiency trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-900">
                    {formatPercentage(analyticsData.businessIntelligence?.operationalEfficiency?.technicianUtilization)}
                  </div>
                  <div className="text-sm text-gray-600">Technician Utilization</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-900">
                    {analyticsData.businessIntelligence?.operationalEfficiency?.averageResponseTime || 0}h
                  </div>
                  <div className="text-sm text-gray-600">Avg Response Time</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-purple-900">
                    {formatPercentage(analyticsData.businessIntelligence?.operationalEfficiency?.firstCallResolution)}
                  </div>
                  <div className="text-sm text-gray-600">First Call Resolution</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-orange-900">
                    {formatCurrency(analyticsData.businessIntelligence?.operationalEfficiency?.costPerServiceCall)}
                  </div>
                  <div className="text-sm text-gray-600">Cost per Service Call</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          {/* Data Sources */}
          {dataSourcesData && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    Connected Data Sources
                  </CardTitle>
                  <CardDescription>Real-time data integration and quality monitoring</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {(dataSourcesData.connectedSources || []).map((source: any, idx: number) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{source.name}</h3>
                            <Badge className={getStatusColor(source.status)}>
                              {source.status}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-blue-600">
                              {formatNumber(source.recordCount)}
                            </div>
                            <div className="text-xs text-gray-500">records</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                          <div>
                            <span className="text-gray-600">Type:</span>
                            <span className="ml-2 font-medium">{source.type}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Uptime:</span>
                            <span className="ml-2 font-medium">{formatPercentage(source.uptime)}</span>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <div className="text-xs text-gray-600 mb-1">Data Types:</div>
                          <div className="flex flex-wrap gap-1">
                            {(source.dataTypes || []).map((type: string, typeIdx: number) => (
                              <Badge key={typeIdx} variant="secondary" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center pt-2 border-t">
                          <div className="text-xs text-gray-500">
                            Last sync: {format(new Date(source.lastSync), 'MMM dd, HH:mm')}
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Health:</span>
                            <span className="ml-1 font-medium text-green-600">
                              {formatPercentage(source.healthScore)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Data Quality */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Data Quality Dashboard
                  </CardTitle>
                  <CardDescription>Data quality metrics and issue tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-medium mb-4">Quality Metrics</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Overall Score</span>
                          <span className="font-bold text-green-600">
                            {formatPercentage(dataSourcesData.dataQuality?.overallScore)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Completeness</span>
                          <span className="font-medium">
                            {formatPercentage(dataSourcesData.dataQuality?.completeness)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Accuracy</span>
                          <span className="font-medium">
                            {formatPercentage(dataSourcesData.dataQuality?.accuracy)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Consistency</span>
                          <span className="font-medium">
                            {formatPercentage(dataSourcesData.dataQuality?.consistency)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Timeliness</span>
                          <span className="font-medium">
                            {formatPercentage(dataSourcesData.dataQuality?.timeliness)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-4">Quality Issues</h3>
                      <div className="space-y-2">
                        {(dataSourcesData.dataQuality?.issues || []).map((issue: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-2 border rounded">
                            <div>
                              <div className="font-medium text-sm">{issue.type}</div>
                              <Badge className={getPriorityColor(issue.severity)} variant="outline">
                                {issue.severity}
                              </Badge>
                            </div>
                            <div className="font-bold">{issue.count}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          {/* AI Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                AI-Powered Business Recommendations
              </CardTitle>
              <CardDescription>Intelligent suggestions for business optimization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(analyticsData.aiRecommendations || []).map((rec: any, idx: number) => (
                  <div key={idx} className="p-4 border rounded-lg hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{rec.title}</h3>
                          <Badge className={getPriorityColor(rec.impact)}>
                            {rec.impact} Impact
                          </Badge>
                          <Badge variant="outline">
                            Priority {rec.priority}
                          </Badge>
                        </div>
                        <p className="text-gray-700 mb-2">{rec.description}</p>
                        <p className="text-sm text-blue-600 font-medium">Action: {rec.action}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {rec.estimatedRevenue ? formatCurrency(rec.estimatedRevenue) : formatCurrency(rec.estimatedSavings)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {rec.estimatedRevenue ? 'revenue' : 'savings'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                      <div>
                        <span className="text-sm text-gray-600">Category:</span>
                        <span className="ml-2 font-medium">{rec.category}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Timeframe:</span>
                        <span className="ml-2 font-medium">{rec.timeframe}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Confidence:</span>
                        <span className="ml-2 font-medium">{formatPercentage(rec.confidence)}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-3 border-t">
                      <div className="text-xs text-gray-500">
                        AI-generated recommendation
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                        <Button size="sm">
                          Implement
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}