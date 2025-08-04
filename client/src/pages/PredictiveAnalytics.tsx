import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Cpu,
  Database,
  LineChart,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  Settings,
  Eye,
  PlayCircle,
  Download,
  Upload,
  Star,
  Lightbulb,
  Zap,
  Shield,
  Globe,
  Users,
  DollarSign,
  Calendar,
  Package,
  Wrench,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Timer,
  Gauge,
  Sparkles,
  Rocket,
  Award
} from 'lucide-react';
import { format } from 'date-fns';

interface PredictiveAnalyticsData {
  analyticsOverview: {
    totalModels: number;
    activeModels: number;
    trainingModels: number;
    failedModels: number;
    averageAccuracy: number;
    predictionsToday: number;
    dataPointsProcessed: number;
    computeTimeUsed: number;
    modelRefreshFrequency: string;
    lastModelUpdate: Date;
    predictionSuccessRate: number;
  };
  predictiveModels: Array<{
    id: string;
    name: string;
    category: string;
    type: string;
    status: string;
    accuracy: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    version: string;
    lastTrained: Date;
    trainingDataSize: number;
    features: number;
    predictionsToday: number;
    confidenceThreshold?: number;
    featureImportance?: Array<{
      feature: string;
      importance: number;
      description: string;
    }>;
    recentPredictions?: any[];
    forecasts?: any[];
    equipmentPredictions?: any[];
    leadScoring?: any[];
  }>;
  businessIntelligence: {
    keyInsights: Array<{
      id: string;
      category: string;
      title: string;
      description: string;
      impact: string;
      confidence: number;
      dataPoints: number;
      timeframe: string;
      recommendedActions: string[];
      potentialValue: number;
      implementation: string;
    }>;
    marketTrends: Array<{
      trend: string;
      description: string;
      strength: string;
      confidence: number;
      businessImpact: string;
      opportunity: string;
    }>;
    competitiveIntelligence: Array<{
      competitor: string;
      activity: string;
      impact: string;
      affectedSegments: string[];
      responseStrategy: string;
      confidence: number;
    }>;
  };
  performanceMetrics: {
    predictionAccuracy: Record<string, number>;
    businessImpact: {
      revenueProtected: number;
      costsAvoided: number;
      efficiencyGains: number;
      newOpportunities: number;
    };
    modelPerformance: Array<{
      model: string;
      accuracy: number;
      improvement: string;
      trend: string;
    }>;
  };
  realTimeAnalytics: {
    liveMetrics: {
      predictionsPerMinute: number;
      dataIngestionRate: number;
      modelResponseTime: number;
      alertsTriggered: number;
      confidenceThreshold: number;
      activeMonitoringDevices: number;
    };
    alertsAndNotifications: Array<{
      id: string;
      type: string;
      severity: string;
      customer?: string;
      equipment?: string;
      probability: number;
      triggeredAt: Date;
      status: string;
      assignedTo: string;
      estimatedImpact: number;
    }>;
  };
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-green-100 text-green-800';
    case 'training': return 'bg-blue-100 text-blue-800';
    case 'failed': return 'bg-red-100 text-red-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getImpactColor = (impact: string) => {
  switch (impact.toLowerCase()) {
    case 'high': return 'bg-red-100 text-red-800 border-red-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity.toLowerCase()) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getTrendIcon = (trend: string) => {
  switch (trend.toLowerCase()) {
    case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
    case 'stable': return <Activity className="h-4 w-4 text-blue-600" />;
    default: return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

const getModelTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'classification': return <Target className="h-5 w-5 text-blue-600" />;
    case 'regression': return <LineChart className="h-5 w-5 text-green-600" />;
    case 'clustering': return <PieChart className="h-5 w-5 text-purple-600" />;
    case 'forecasting': return <TrendingUp className="h-5 w-5 text-orange-600" />;
    default: return <Brain className="h-5 w-5 text-gray-600" />;
  }
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export default function PredictiveAnalytics() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [showModelDialog, setShowModelDialog] = useState(false);

  // Fetch predictive analytics data
  const { data: analyticsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/predictive-analytics/dashboard', selectedCategory],
    select: (data: any) => ({
      ...data,
      analyticsOverview: {
        ...data.analyticsOverview,
        lastModelUpdate: new Date(data.analyticsOverview.lastModelUpdate)
      },
      predictiveModels: data.predictiveModels?.map((model: any) => ({
        ...model,
        lastTrained: new Date(model.lastTrained)
      })) || [],
      realTimeAnalytics: {
        ...data.realTimeAnalytics,
        alertsAndNotifications: data.realTimeAnalytics?.alertsAndNotifications?.map((alert: any) => ({
          ...alert,
          triggeredAt: new Date(alert.triggeredAt)
        })) || []
      }
    }),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading predictive analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-600" />
            Predictive Analytics Engine
          </h1>
          <p className="text-gray-600 mt-1">Advanced AI-powered insights and forecasting for business intelligence</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="customer">Customer Analytics</SelectItem>
              <SelectItem value="financial">Financial Analytics</SelectItem>
              <SelectItem value="maintenance">Maintenance Analytics</SelectItem>
              <SelectItem value="sales">Sales Analytics</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Sparkles className="h-4 w-4 mr-2" />
            Train New Model
          </Button>
        </div>
      </div>

      {analyticsData && (
        <>
          {/* Analytics Overview KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="border-indigo-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Models</p>
                    <p className="text-2xl font-bold text-indigo-900">
                      {analyticsData.analyticsOverview.activeModels}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Brain className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    {formatPercentage(analyticsData.analyticsOverview.averageAccuracy)} avg accuracy
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
                      {formatNumber(analyticsData.analyticsOverview.predictionsToday)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Target className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Activity className="h-4 w-4 text-blue-600 mr-1" />
                  <span className="text-blue-600">
                    {formatPercentage(analyticsData.analyticsOverview.predictionSuccessRate)} success rate
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Data Processed</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analyticsData.analyticsOverview.dataPointsProcessed}M
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Database className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Upload className="h-4 w-4 text-purple-600 mr-1" />
                  <span className="text-purple-600">
                    Points today
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Compute Hours</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Math.round(analyticsData.analyticsOverview.computeTimeUsed)}h
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Cpu className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Timer className="h-4 w-4 text-orange-600 mr-1" />
                  <span className="text-orange-600">
                    This month
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="models" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="models">Predictive Models</TabsTrigger>
              <TabsTrigger value="insights">Business Intelligence</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="realtime">Real-time Analytics</TabsTrigger>
              <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            <TabsContent value="models" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {analyticsData.predictiveModels.map((model: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {getModelTypeIcon(model.type)}
                            {model.name}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {model.category} • {model.type} • v{model.version}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge className={getStatusColor(model.status)}>
                            {model.status}
                          </Badge>
                          <div className="text-right">
                            <div className="text-lg font-bold text-indigo-600">
                              {formatPercentage(model.accuracy)}
                            </div>
                            <div className="text-xs text-gray-500">accuracy</div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Model Metrics */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Training Data:</span>
                            <div className="font-medium">{formatNumber(model.trainingDataSize)} records</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Features:</span>
                            <div className="font-medium">{model.features}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Predictions Today:</span>
                            <div className="font-medium">{formatNumber(model.predictionsToday)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Trained:</span>
                            <div className="font-medium">{format(model.lastTrained, 'MMM dd, yyyy')}</div>
                          </div>
                        </div>

                        {/* Performance Metrics for Classification Models */}
                        {model.type === 'classification' && model.precision && (
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center p-2 bg-blue-50 rounded">
                              <div className="font-bold text-blue-900">{formatPercentage(model.precision)}</div>
                              <div className="text-blue-600 text-xs">Precision</div>
                            </div>
                            <div className="text-center p-2 bg-green-50 rounded">
                              <div className="font-bold text-green-900">{formatPercentage(model.recall)}</div>
                              <div className="text-green-600 text-xs">Recall</div>
                            </div>
                            <div className="text-center p-2 bg-purple-50 rounded">
                              <div className="font-bold text-purple-900">{formatPercentage(model.f1Score)}</div>
                              <div className="text-purple-600 text-xs">F1 Score</div>
                            </div>
                          </div>
                        )}

                        {/* Feature Importance (for supported models) */}
                        {model.featureImportance && (
                          <div>
                            <div className="text-sm text-gray-600 mb-2">Top Features</div>
                            <div className="space-y-1">
                              {model.featureImportance.slice(0, 3).map((feature: any, featureIdx: number) => (
                                <div key={featureIdx} className="flex items-center justify-between text-sm">
                                  <span className="font-medium">{feature.feature.replace('_', ' ')}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="bg-indigo-600 h-2 rounded-full" 
                                        style={{ width: `${feature.importance * 100}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {formatPercentage(feature.importance * 100)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t">
                          <div className="text-xs text-gray-500">
                            Confidence threshold: {model.confidenceThreshold || 'N/A'}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button size="sm">
                              <PlayCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              {/* Key Business Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    Key Business Insights
                  </CardTitle>
                  <CardDescription>AI-generated insights from your business data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analyticsData.businessIntelligence.keyInsights.map((insight: any, idx: number) => (
                      <div key={idx} className={`p-4 border rounded-lg ${getImpactColor(insight.impact)}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold">{insight.title}</h3>
                            <p className="text-sm mt-1">{insight.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getImpactColor(insight.impact)}>
                              {insight.impact} impact
                            </Badge>
                            <div className="text-right">
                              <div className="text-sm font-bold">{formatCurrency(insight.potentialValue)}</div>
                              <div className="text-xs text-gray-500">potential value</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Confidence:</span>
                            <span className="ml-2 font-medium">{formatPercentage(insight.confidence * 100)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Implementation:</span>
                            <span className="ml-2 font-medium capitalize">{insight.implementation.replace('_', ' ')}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Data Points:</span>
                            <span className="ml-2 font-medium">{formatNumber(insight.dataPoints)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Timeframe:</span>
                            <span className="ml-2 font-medium capitalize">{insight.timeframe.replace('_', ' ')}</span>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <div className="text-sm text-gray-600 mb-2">Recommended Actions:</div>
                          <div className="flex flex-wrap gap-1">
                            {insight.recommendedActions.slice(0, 3).map((action: string, actionIdx: number) => (
                              <Badge key={actionIdx} variant="secondary" className="text-xs">
                                {action.replace('_', ' ')}
                              </Badge>
                            ))}
                            {insight.recommendedActions.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{insight.recommendedActions.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Market Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-600" />
                    Market Trends Analysis
                  </CardTitle>
                  <CardDescription>Current market trends and their business impact</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analyticsData.businessIntelligence.marketTrends.map((trend: any, idx: number) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium">{trend.trend}</h3>
                          <Badge variant="outline" className="capitalize">
                            {trend.strength} trend
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{trend.description}</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Confidence:</span>
                            <span className="font-medium">{formatPercentage(trend.confidence * 100)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Business Impact:</span>
                            <span className="font-medium capitalize">{trend.businessImpact.replace('_', ' ')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Opportunity:</span>
                            <span className="font-medium capitalize">{trend.opportunity.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Competitive Intelligence */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-600" />
                    Competitive Intelligence
                  </CardTitle>
                  <CardDescription>Competitor activity analysis and response strategies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analyticsData.businessIntelligence.competitiveIntelligence.map((intel: any, idx: number) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-medium">{intel.competitor}</h3>
                            <p className="text-sm text-gray-600 capitalize">{intel.activity.replace('_', ' ')}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={getImpactColor(intel.impact)}>
                              {intel.impact} impact
                            </Badge>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatPercentage(intel.confidence * 100)} confidence
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Affected Segments:</span>
                            <div className="mt-1">
                              {intel.affectedSegments.map((segment: string, segIdx: number) => (
                                <Badge key={segIdx} variant="secondary" className="text-xs mr-1">
                                  {segment.replace('_', ' ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Response Strategy:</span>
                            <div className="mt-1 font-medium capitalize">
                              {intel.responseStrategy.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              {/* Business Impact Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-gold-600" />
                    Business Impact Metrics
                  </CardTitle>
                  <CardDescription>Quantified business value from predictive analytics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-900">
                        {formatCurrency(analyticsData.performanceMetrics.businessImpact.revenueProtected)}
                      </div>
                      <div className="text-sm text-gray-600">Revenue Protected</div>
                      <div className="text-xs text-green-600 mt-1">from churn prevention</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-900">
                        {formatCurrency(analyticsData.performanceMetrics.businessImpact.costsAvoided)}
                      </div>
                      <div className="text-sm text-gray-600">Costs Avoided</div>
                      <div className="text-xs text-blue-600 mt-1">predictive maintenance</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-900">
                        {formatCurrency(analyticsData.performanceMetrics.businessImpact.efficiencyGains)}
                      </div>
                      <div className="text-sm text-gray-600">Efficiency Gains</div>
                      <div className="text-xs text-purple-600 mt-1">process optimization</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-900">
                        {formatCurrency(analyticsData.performanceMetrics.businessImpact.newOpportunities)}
                      </div>
                      <div className="text-sm text-gray-600">New Opportunities</div>
                      <div className="text-xs text-orange-600 mt-1">from insights</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Model Performance Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle>Model Performance Comparison</CardTitle>
                  <CardDescription>Accuracy trends and improvements across all models</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analyticsData.performanceMetrics.modelPerformance.map((model: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{model.model}</div>
                          <div className="text-sm text-gray-600">Accuracy: {formatPercentage(model.accuracy)}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium">{model.improvement}</div>
                            <div className="text-xs text-gray-500">improvement</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {getTrendIcon(model.trend)}
                            <span className="text-sm capitalize">{model.trend}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Prediction Accuracy by Category */}
              <Card>
                <CardHeader>
                  <CardTitle>Prediction Accuracy by Category</CardTitle>
                  <CardDescription>Performance breakdown by analytics category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(analyticsData.performanceMetrics.predictionAccuracy).map(([category, accuracy]) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="font-medium capitalize">{category.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-indigo-600 h-2 rounded-full" 
                              style={{ width: `${accuracy}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{formatPercentage(accuracy)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="realtime" className="space-y-6">
              {/* Live Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    Real-time Analytics Metrics
                  </CardTitle>
                  <CardDescription>Live system performance and activity monitoring</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-bold text-blue-900">
                        {analyticsData.realTimeAnalytics.liveMetrics.predictionsPerMinute}
                      </div>
                      <div className="text-sm text-gray-600">Predictions/min</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-bold text-green-900">
                        {analyticsData.realTimeAnalytics.liveMetrics.dataIngestionRate.toFixed(1)}MB
                      </div>
                      <div className="text-sm text-gray-600">Data/min</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-bold text-purple-900">
                        {analyticsData.realTimeAnalytics.liveMetrics.modelResponseTime}ms
                      </div>
                      <div className="text-sm text-gray-600">Response Time</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-bold text-orange-900">
                        {analyticsData.realTimeAnalytics.liveMetrics.alertsTriggered}
                      </div>
                      <div className="text-sm text-gray-600">Alerts Today</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-bold text-red-900">
                        {analyticsData.realTimeAnalytics.liveMetrics.confidenceThreshold}
                      </div>
                      <div className="text-sm text-gray-600">Confidence Threshold</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-bold text-indigo-900">
                        {formatNumber(analyticsData.realTimeAnalytics.liveMetrics.activeMonitoringDevices)}
                      </div>
                      <div className="text-sm text-gray-600">Monitoring Devices</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="forecasts" className="space-y-6">
              <div className="text-center py-12">
                <LineChart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Forecasting Dashboard</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Advanced forecasting models for revenue, demand, and business planning
                </p>
                <Button>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Forecasts
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="alerts" className="space-y-6">
              {/* Active Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Active Alerts & Notifications
                  </CardTitle>
                  <CardDescription>Real-time alerts from predictive models</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analyticsData.realTimeAnalytics.alertsAndNotifications.map((alert: any, idx: number) => (
                      <div key={idx} className={`p-4 border rounded-lg ${getSeverityColor(alert.severity)}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium capitalize">{alert.type.replace('_', ' ')}</div>
                            <div className="text-sm mt-1">
                              {alert.customer && <span>Customer: {alert.customer}</span>}
                              {alert.equipment && <span>Equipment: {alert.equipment}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <div className="text-right">
                              <div className="text-sm font-bold">{formatPercentage(alert.probability * 100)}</div>
                              <div className="text-xs text-gray-500">probability</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Triggered:</span>
                            <span className="ml-2">{format(alert.triggeredAt, 'MMM dd, HH:mm')}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Assigned To:</span>
                            <span className="ml-2 capitalize">{alert.assignedTo.replace('_', ' ')}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Impact:</span>
                            <span className="ml-2 font-medium">{formatCurrency(alert.estimatedImpact)}</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-end gap-2 mt-3">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          <Button size="sm">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Acknowledge
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}