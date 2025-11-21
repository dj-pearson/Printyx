import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MainLayout from "@/components/layout/main-layout";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  DollarSign,
  BarChart3,
  Activity,
  Zap,
  Eye,
  PlayCircle,
  RefreshCw,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  Star,
  Award,
  Lightbulb,
  Cpu,
  Database,
  Network,
  Sparkles,
  Bot,
  MessageSquare,
  FileText,
  Shield,
  Gauge,
  LineChart,
  PieChart,
} from "lucide-react";
import { format } from "date-fns";

interface AIAnalyticsData {
  aiOverview: {
    modelsDeployed: number;
    predictionsGenerated: number;
    accuracyScore: number;
    automatedDecisions: number;
    mlModelStatus: string;
    dataQualityScore: number;
    lastModelUpdate: Date;
    computeUtilization: number;
    apiCallsToday: number;
    costOptimization: number;
  };
  customerPredictions: {
    churnPrediction: {
      totalCustomersAnalyzed: number;
      highRiskCustomers: number;
      mediumRiskCustomers: number;
      lowRiskCustomers: number;
      predictionAccuracy: number;
      interventioneSuccessRate: number;
      estimatedRevenueSaved: number;

      highRiskCustomers: Array<{
        customerId: string;
        customerName: string;
        churnProbability: number;
        riskFactors: string[];
        estimatedValue: number;
        recommendedActions: string[];
        timeToIntervene: number;
        lastInteraction: Date;
        trend: string;
      }>;
    };
    lifetimeValuePrediction: {
      averagePredictedCLV: number;
      clivAccuracyRate: number;
      customerSegments: Array<{
        segment: string;
        count: number;
        avgPredictedCLV: number;
        conversionProbability: number;
        recommendedInvestment: number;
        expectedROI: number;
      }>;
    };
    upsellPredictions: Array<{
      customerId: string;
      customerName: string;
      currentMRR: number;
      predictedUpsellValue: number;
      upsellProbability: number;
      recommendedProducts: string[];
      bestApproachTime: Date;
      confidence: number;
    }>;
  };
  salesForecasting: {
    revenueForecast: {
      currentMonth: {
        predicted: number;
        actual: number;
        confidence: number;
        variance: number;
      };
      nextMonth: {
        predicted: number;
        confidence: number;
        factors: string[];
      };
      quarterlyForecast: {
        [key: string]: {
          predicted: number;
          confidence: number;
        };
      };
    };
    dealProbabilityScoring: Array<{
      dealId: string;
      prospectName: string;
      dealValue: number;
      originalProbability: number;
      aiProbability: number;
      probabilityFactors: Array<{
        factor: string;
        impact: number;
        confidence: number;
      }>;
      recommendedActions: string[];
      nextBestAction: string;
      optimalCloseDate: Date;
    }>;
  };
  serviceOptimization: {
    predictiveMaintenance: {
      equipmentMonitored: number;
      predictedFailures: number;
      preventedDowntime: number;
      costSavings: number;
      accuracyRate: number;
      criticalAlerts: Array<{
        equipmentId: string;
        location: string;
        model: string;
        predictedFailure: string;
        probability: number;
        estimatedFailureDate: Date;
        recommendedAction: string;
        costOfFailure: number;
        costOfPrevention: number;
        savingsPotential: number;
      }>;
    };
  };
  nlpInsights: {
    customerSentiment: {
      overallSentiment: number;
      sentimentTrend: string;
      analysisVolume: number;
      sentimentByChannel: Array<{
        channel: string;
        sentiment: number;
        volume: number;
      }>;
      keyTopics: Array<{
        topic: string;
        sentiment: number;
        volume: number;
        trend: string;
        keywords: string[];
      }>;
    };
  };
  modelPerformance: {
    models: Array<{
      modelName: string;
      version: string;
      accuracy: number;
      precision: number;
      recall: number;
      f1Score: number;
      lastTrained: Date;
      dataPoints: number;
      status: string;
      performanceTrend: string;
    }>;
  };
  recommendationsEngine: {
    personalizedRecommendations: {
      customersTargeted: number;
      recommendationAccuracy: number;
      uptakeRate: number;
      revenueGenerated: number;
      activeRecommendations: Array<{
        customerId: string;
        customerName: string;
        recommendation: string;
        reasoning: string;
        confidence: number;
        estimatedValue: number;
        deliveryChannel: string;
        optimalTiming: Date;
      }>;
    };
  };
}

const getModelStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "production":
      return "bg-green-100 text-green-800";
    case "training":
      return "bg-blue-100 text-blue-800";
    case "testing":
      return "bg-yellow-100 text-yellow-800";
    case "deprecated":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getTrendIcon = (trend: string) => {
  switch (trend.toLowerCase()) {
    case "improving":
    case "increasing":
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case "declining":
    case "decreasing":
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    case "stable":
      return <Activity className="h-4 w-4 text-blue-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

const getRiskColor = (probability: number) => {
  if (probability >= 0.8) return "bg-red-100 text-red-800 border-red-200";
  if (probability >= 0.6)
    return "bg-orange-100 text-orange-800 border-orange-200";
  if (probability >= 0.4)
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-green-100 text-green-800 border-green-200";
};

const getSentimentColor = (sentiment: number) => {
  if (sentiment >= 0.6) return "text-green-600";
  if (sentiment >= 0.2) return "text-yellow-600";
  return "text-red-600";
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const formatProbability = (value: number) => {
  return `${(value * 100).toFixed(1)}%`;
};

export default function AIAnalyticsDashboard() {
  const [selectedModel, setSelectedModel] = useState("all");
  const [selectedTimeframe, setSelectedTimeframe] = useState("30d");
  const [showModelDetails, setShowModelDetails] = useState(false);

  // Fetch AI analytics data
  const {
    data: aiData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/ai-analytics/dashboard", selectedModel, selectedTimeframe],
    select: (data: any) => ({
      ...data,
      aiOverview: {
        ...data.aiOverview,
        lastModelUpdate: new Date(data.aiOverview.lastModelUpdate),
      },
      customerPredictions: {
        ...data.customerPredictions,
        churnPrediction: {
          ...data.customerPredictions.churnPrediction,
          highRiskCustomers:
            data.customerPredictions?.churnPrediction?.highRiskCustomers?.map(
              (customer: any) => ({
                ...customer,
                lastInteraction: new Date(customer.lastInteraction),
              })
            ) || [],
        },
        upsellPredictions:
          data.customerPredictions?.upsellPredictions?.map(
            (prediction: any) => ({
              ...prediction,
              bestApproachTime: new Date(prediction.bestApproachTime),
            })
          ) || [],
      },
      salesForecasting: {
        ...data.salesForecasting,
        dealProbabilityScoring:
          data.salesForecasting?.dealProbabilityScoring?.map((deal: any) => ({
            ...deal,
            optimalCloseDate: new Date(deal.optimalCloseDate),
          })) || [],
      },
      serviceOptimization: {
        ...data.serviceOptimization,
        predictiveMaintenance: {
          ...data.serviceOptimization.predictiveMaintenance,
          criticalAlerts:
            data.serviceOptimization?.predictiveMaintenance?.criticalAlerts?.map(
              (alert: any) => ({
                ...alert,
                estimatedFailureDate: new Date(alert.estimatedFailureDate),
              })
            ) || [],
        },
      },
      modelPerformance: {
        ...data.modelPerformance,
        models:
          data.modelPerformance?.models?.map((model: any) => ({
            ...model,
            lastTrained: new Date(model.lastTrained),
          })) || [],
      },
      recommendationsEngine: {
        ...data.recommendationsEngine,
        personalizedRecommendations: {
          ...data.recommendationsEngine.personalizedRecommendations,
          activeRecommendations:
            data.recommendationsEngine?.personalizedRecommendations?.activeRecommendations?.map(
              (rec: any) => ({
                ...rec,
                optimalTiming: new Date(rec.optimalTiming),
              })
            ) || [],
        },
      },
    }),
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <MainLayout
        title="AI-Powered Analytics & Intelligence"
        description="Machine learning insights, predictive analytics, and intelligent automation"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">
              Loading AI analytics dashboard...
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="AI-Powered Analytics & Intelligence"
      description="Machine learning insights, predictive analytics, and intelligent automation"
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Select
            value={selectedTimeframe}
            onValueChange={setSelectedTimeframe}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          <Dialog open={showModelDetails} onOpenChange={setShowModelDetails}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Cpu className="h-4 w-4 mr-2" />
                Model Performance
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Machine Learning Model Performance</DialogTitle>
                <DialogDescription>
                  Detailed performance metrics and status for all deployed AI
                  models
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {aiData?.modelPerformance.models.map(
                  (model: any, idx: number) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{model.modelName}</h3>
                          <div className="text-sm text-gray-600">
                            Version {model.version}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getModelStatusColor(model.status)}>
                            {model.status}
                          </Badge>
                          {getTrendIcon(model.performanceTrend)}
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Accuracy</div>
                          <div className="font-bold">
                            {formatPercentage(model.accuracy)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Precision</div>
                          <div className="font-bold">
                            {model.precision.toFixed(3)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Recall</div>
                          <div className="font-bold">
                            {model.recall.toFixed(3)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">F1 Score</div>
                          <div className="font-bold">
                            {model.f1Score.toFixed(3)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-gray-500">
                        Last trained:{" "}
                        {format(model.lastTrained, "MMM dd, yyyy")} • Data
                        points: {model.dataPoints.toLocaleString()}
                      </div>
                    </div>
                  )
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {aiData && (
        <>
          {/* AI Overview KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <Card className="border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      AI Models Active
                    </p>
                    <p className="text-2xl font-bold text-purple-900">
                      {aiData.aiOverview.modelsDeployed}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Bot className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    {aiData.aiOverview.mlModelStatus} performance
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Predictions Generated
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {aiData.aiOverview.predictionsGenerated.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Gauge className="h-4 w-4 text-blue-600 mr-1" />
                  <span className="text-blue-600">
                    {formatPercentage(aiData.aiOverview.accuracyScore)} accuracy
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Automated Decisions
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {aiData.aiOverview.automatedDecisions.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Zap className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    {formatPercentage(aiData.aiOverview.costOptimization)} cost
                    saved
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Data Quality Score
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(aiData.aiOverview.dataQualityScore)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Database className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div className="mt-2">
                  <Progress
                    value={aiData.aiOverview.dataQualityScore}
                    className="h-2"
                  />
                  <p className="text-sm text-orange-600 mt-1">
                    Compute:{" "}
                    {formatPercentage(aiData.aiOverview.computeUtilization)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="predictions" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 sm:gap-0">
              <TabsTrigger value="predictions" className="text-xs sm:text-sm px-2 py-2">
                Predictions
              </TabsTrigger>
              <TabsTrigger value="sales" className="text-xs sm:text-sm px-2 py-2">Sales</TabsTrigger>
              <TabsTrigger value="service" className="text-xs sm:text-sm px-2 py-2">Service</TabsTrigger>
              <TabsTrigger value="sentiment" className="text-xs sm:text-sm px-2 py-2">NLP</TabsTrigger>
              <TabsTrigger value="recommendations" className="text-xs sm:text-sm px-2 py-2">Recs</TabsTrigger>
              <TabsTrigger value="models" className="text-xs sm:text-sm px-2 py-2">Models</TabsTrigger>
            </TabsList>

            <TabsContent value="predictions" className="space-y-6">
              {/* Churn Prediction */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Customer Churn Prediction
                  </CardTitle>
                  <CardDescription>
                    AI-powered churn risk analysis with intervention
                    recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="text-center p-3 bg-red-50 border border-red-200 rounded">
                          <div className="text-xl font-bold text-red-900">
                            {
                              aiData.customerPredictions.churnPrediction
                                .highRiskCustomers
                            }
                          </div>
                          <div className="text-sm text-red-600">High Risk</div>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <div className="text-xl font-bold text-yellow-900">
                            {
                              aiData.customerPredictions.churnPrediction
                                .mediumRiskCustomers
                            }
                          </div>
                          <div className="text-sm text-yellow-600">
                            Medium Risk
                          </div>
                        </div>
                        <div className="text-center p-3 bg-green-50 border border-green-200 rounded">
                          <div className="text-xl font-bold text-green-900">
                            {
                              aiData.customerPredictions.churnPrediction
                                .lowRiskCustomers
                            }
                          </div>
                          <div className="text-sm text-green-600">Low Risk</div>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Prediction Accuracy
                          </span>
                          <span className="font-medium">
                            {formatPercentage(
                              aiData.customerPredictions.churnPrediction
                                .predictionAccuracy
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Intervention Success
                          </span>
                          <span className="font-medium">
                            {formatPercentage(
                              aiData.customerPredictions.churnPrediction
                                .interventioneSuccessRate
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Revenue Saved</span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(
                              aiData.customerPredictions.churnPrediction
                                .estimatedRevenueSaved
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">
                        High-Risk Customers Requiring Immediate Action
                      </h4>
                      {aiData.customerPredictions.churnPrediction.highRiskCustomers
                        .slice(0, 2)
                        .map((customer: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-4 border border-red-200 bg-red-50 rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-medium text-red-900">
                                  {customer.customerName}
                                </div>
                                <div className="text-sm text-red-700">
                                  Value:{" "}
                                  {formatCurrency(customer.estimatedValue)}
                                </div>
                              </div>
                              <Badge
                                className={getRiskColor(
                                  customer.churnProbability
                                )}
                              >
                                {formatProbability(customer.churnProbability)}{" "}
                                risk
                              </Badge>
                            </div>

                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="text-red-700 font-medium">
                                  Risk Factors:
                                </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {customer.riskFactors.map(
                                    (factor: string, factorIdx: number) => (
                                      <Badge
                                        key={factorIdx}
                                        variant="destructive"
                                        className="text-xs"
                                      >
                                        {factor}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>

                              <div>
                                <span className="text-red-700 font-medium">
                                  Recommended Actions:
                                </span>
                                <div className="mt-1 space-y-1">
                                  {customer.recommendedActions
                                    .slice(0, 2)
                                    .map(
                                      (action: string, actionIdx: number) => (
                                        <div
                                          key={actionIdx}
                                          className="text-red-600 text-xs flex items-center"
                                        >
                                          <div className="w-1 h-1 bg-red-600 rounded-full mr-2"></div>
                                          {action}
                                        </div>
                                      )
                                    )}
                                </div>
                              </div>

                              <div className="flex justify-between items-center pt-2">
                                <div className="text-red-600 text-xs">
                                  Action needed within{" "}
                                  {customer.timeToIntervene} days
                                </div>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-6 text-xs"
                                >
                                  Execute Plan
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Upsell Predictions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Upsell Opportunity Predictions
                  </CardTitle>
                  <CardDescription>
                    AI-identified cross-sell and upsell opportunities with
                    optimal timing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {aiData.customerPredictions.upsellPredictions.map(
                      (prediction: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-4 border border-green-200 bg-green-50 rounded-lg"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-medium text-green-900">
                                {prediction.customerName}
                              </div>
                              <div className="text-sm text-green-700">
                                Current MRR:{" "}
                                {formatCurrency(prediction.currentMRR)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-900">
                                {formatCurrency(
                                  prediction.predictedUpsellValue
                                )}
                              </div>
                              <Badge className="bg-green-100 text-green-800">
                                {formatProbability(
                                  prediction.upsellProbability
                                )}{" "}
                                likely
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm font-medium text-green-800 mb-1">
                                Recommended Products
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {prediction.recommendedProducts.map(
                                  (product: string, productIdx: number) => (
                                    <Badge
                                      key={productIdx}
                                      variant="outline"
                                      className="text-xs text-green-700"
                                    >
                                      {product}
                                    </Badge>
                                  )
                                )}
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <div>
                                <div className="text-sm text-green-700">
                                  Optimal approach:{" "}
                                  {format(
                                    prediction.bestApproachTime,
                                    "MMM dd"
                                  )}
                                </div>
                                <div className="text-xs text-green-600">
                                  Confidence:{" "}
                                  {formatProbability(prediction.confidence)}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 h-6 text-xs"
                              >
                                Create Campaign
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sales" className="space-y-6">
              {/* Revenue Forecasting */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5" />
                    AI-Powered Revenue Forecasting
                  </CardTitle>
                  <CardDescription>
                    Machine learning revenue predictions with confidence
                    intervals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <h4 className="font-medium mb-4">
                        Current vs Predicted Performance
                      </h4>
                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">
                              This Month
                            </span>
                            <Badge
                              className={
                                aiData.salesForecasting.revenueForecast
                                  .currentMonth.variance >= 0
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }
                            >
                              {aiData.salesForecasting.revenueForecast
                                .currentMonth.variance > 0
                                ? "+"
                                : ""}
                              {formatPercentage(
                                aiData.salesForecasting.revenueForecast
                                  .currentMonth.variance
                              )}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-gray-500">
                                Predicted
                              </div>
                              <div className="font-bold">
                                {formatCurrency(
                                  aiData.salesForecasting.revenueForecast
                                    .currentMonth.predicted
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">
                                Actual
                              </div>
                              <div className="font-bold">
                                {formatCurrency(
                                  aiData.salesForecasting.revenueForecast
                                    .currentMonth.actual
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Confidence:{" "}
                            {formatProbability(
                              aiData.salesForecasting.revenueForecast
                                .currentMonth.confidence
                            )}
                          </div>
                        </div>

                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="font-medium text-blue-900 mb-2">
                            Next Month Prediction
                          </div>
                          <div className="text-xl font-bold text-blue-900 mb-2">
                            {formatCurrency(
                              aiData.salesForecasting.revenueForecast.nextMonth
                                .predicted
                            )}
                          </div>
                          <div className="text-sm text-blue-700">
                            Confidence:{" "}
                            {formatProbability(
                              aiData.salesForecasting.revenueForecast.nextMonth
                                .confidence
                            )}
                          </div>
                          <div className="mt-2">
                            <div className="text-xs text-blue-600 mb-1">
                              Key Factors:
                            </div>
                            {aiData.salesForecasting.revenueForecast.nextMonth.factors.map(
                              (factor: string, idx: number) => (
                                <div
                                  key={idx}
                                  className="text-xs text-blue-600 flex items-center"
                                >
                                  <div className="w-1 h-1 bg-blue-600 rounded-full mr-2"></div>
                                  {factor}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-4">Quarterly Forecast</h4>
                      <div className="space-y-3">
                        {Object.entries(
                          aiData.salesForecasting.revenueForecast
                            .quarterlyForecast
                        ).map(([quarter, data]: [string, any]) => (
                          <div
                            key={quarter}
                            className="flex items-center justify-between p-3 border rounded"
                          >
                            <div>
                              <div className="font-medium">
                                {quarter.toUpperCase()}
                              </div>
                              <div className="text-sm text-gray-600">
                                {formatCurrency(data.predicted)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-500">
                                Confidence
                              </div>
                              <div className="font-medium">
                                {formatProbability(data.confidence)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Deal Probability Scoring */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    AI Deal Probability Scoring
                  </CardTitle>
                  <CardDescription>
                    Enhanced deal scoring with AI-powered probability analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {aiData.salesForecasting.dealProbabilityScoring.map(
                      (deal: any, idx: number) => (
                        <div key={idx} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="font-medium text-lg">
                                {deal.prospectName}
                              </div>
                              <div className="text-sm text-gray-600">
                                Deal Value: {formatCurrency(deal.dealValue)} •
                                ID: {deal.dealId}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">
                                  Original:{" "}
                                  {formatProbability(deal.originalProbability)}
                                </Badge>
                                <Badge className="bg-purple-100 text-purple-800">
                                  AI: {formatProbability(deal.aiProbability)}
                                </Badge>
                              </div>
                              <div className="text-xs text-gray-500">
                                Target close:{" "}
                                {format(deal.optimalCloseDate, "MMM dd")}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm font-medium text-gray-800 mb-2">
                                Probability Factors
                              </div>
                              <div className="space-y-1">
                                {deal.probabilityFactors.map(
                                  (factor: any, factorIdx: number) => (
                                    <div
                                      key={factorIdx}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <span>{factor.factor}</span>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={
                                            factor.impact > 0
                                              ? "text-green-600"
                                              : "text-red-600"
                                          }
                                        >
                                          {factor.impact > 0 ? "+" : ""}
                                          {formatProbability(
                                            Math.abs(factor.impact)
                                          )}
                                        </span>
                                        <div className="text-xs text-gray-500">
                                          (
                                          {formatProbability(factor.confidence)}
                                          )
                                        </div>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-sm font-medium text-gray-800 mb-2">
                                Recommended Actions
                              </div>
                              <div className="space-y-1">
                                {deal.recommendedActions.map(
                                  (action: string, actionIdx: number) => (
                                    <div
                                      key={actionIdx}
                                      className="text-sm text-gray-600 flex items-center"
                                    >
                                      <div className="w-1 h-1 bg-blue-600 rounded-full mr-2"></div>
                                      {action}
                                    </div>
                                  )
                                )}
                              </div>
                              <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                                <span className="font-medium text-blue-800">
                                  Next Best Action:
                                </span>
                                <div className="text-blue-700">
                                  {deal.nextBestAction}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="service" className="space-y-6">
              {/* Predictive Maintenance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Predictive Maintenance Intelligence
                  </CardTitle>
                  <CardDescription>
                    AI-powered equipment failure prediction and prevention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-900">
                        {
                          aiData.serviceOptimization.predictiveMaintenance
                            .equipmentMonitored
                        }
                      </div>
                      <div className="text-sm text-blue-600">
                        Equipment Monitored
                      </div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-900">
                        {
                          aiData.serviceOptimization.predictiveMaintenance
                            .predictedFailures
                        }
                      </div>
                      <div className="text-sm text-orange-600">
                        Predicted Failures
                      </div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-900">
                        {formatCurrency(
                          aiData.serviceOptimization.predictiveMaintenance
                            .costSavings
                        )}
                      </div>
                      <div className="text-sm text-green-600">Cost Savings</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-4">
                      Critical Maintenance Alerts
                    </h4>
                    <div className="space-y-4">
                      {aiData.serviceOptimization.predictiveMaintenance.criticalAlerts.map(
                        (alert: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-4 border border-red-200 bg-red-50 rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="font-medium text-red-900">
                                  {alert.model}
                                </div>
                                <div className="text-sm text-red-700">
                                  {alert.location}
                                </div>
                                <div className="text-xs text-red-600 mt-1">
                                  ID: {alert.equipmentId}
                                </div>
                              </div>
                              <Badge
                                className={getRiskColor(alert.probability)}
                              >
                                {formatProbability(alert.probability)} risk
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm font-medium text-red-800 mb-1">
                                  Predicted Issue
                                </div>
                                <div className="text-sm text-red-700">
                                  {alert.predictedFailure}
                                </div>
                                <div className="text-xs text-red-600 mt-1">
                                  Estimated failure:{" "}
                                  {format(
                                    alert.estimatedFailureDate,
                                    "MMM dd, yyyy"
                                  )}
                                </div>
                              </div>

                              <div>
                                <div className="text-sm font-medium text-red-800 mb-1">
                                  Cost Analysis
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <div className="text-red-600">
                                      Failure Cost
                                    </div>
                                    <div className="font-medium">
                                      {formatCurrency(alert.costOfFailure)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-red-600">
                                      Prevention Cost
                                    </div>
                                    <div className="font-medium">
                                      {formatCurrency(alert.costOfPrevention)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-green-600">
                                      Savings
                                    </div>
                                    <div className="font-medium text-green-700">
                                      {formatCurrency(alert.savingsPotential)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-red-200">
                              <div className="text-sm text-red-700">
                                <span className="font-medium">
                                  Recommended:
                                </span>{" "}
                                {alert.recommendedAction}
                              </div>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-6 text-xs"
                              >
                                Schedule Maintenance
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sentiment" className="space-y-6">
              {/* Customer Sentiment Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Customer Sentiment Intelligence
                  </CardTitle>
                  <CardDescription>
                    NLP-powered sentiment analysis across all customer
                    interactions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <div className="text-center p-6 bg-gray-50 rounded-lg mb-6">
                        <div
                          className="text-3xl font-bold mb-2"
                          style={{
                            color:
                              aiData.nlpInsights.customerSentiment
                                .overallSentiment >= 0.6
                                ? "#059669"
                                : aiData.nlpInsights.customerSentiment
                                    .overallSentiment >= 0.2
                                ? "#d97706"
                                : "#dc2626",
                          }}
                        >
                          {(
                            aiData.nlpInsights.customerSentiment
                              .overallSentiment * 100
                          ).toFixed(1)}
                        </div>
                        <div className="text-gray-600">
                          Overall Sentiment Score
                        </div>
                        <div className="flex items-center justify-center mt-2">
                          {getTrendIcon(
                            aiData.nlpInsights.customerSentiment.sentimentTrend
                          )}
                          <span className="ml-2 text-sm text-gray-600 capitalize">
                            {
                              aiData.nlpInsights.customerSentiment
                                .sentimentTrend
                            }
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {aiData.nlpInsights.customerSentiment.analysisVolume.toLocaleString()}{" "}
                          interactions analyzed
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3">
                          Sentiment by Channel
                        </h4>
                        <div className="space-y-3">
                          {aiData.nlpInsights.customerSentiment.sentimentByChannel.map(
                            (channel: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-3 border rounded"
                              >
                                <div>
                                  <div className="font-medium">
                                    {channel.channel}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {channel.volume} interactions
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div
                                    className={`font-bold ${getSentimentColor(
                                      channel.sentiment
                                    )}`}
                                  >
                                    {(channel.sentiment * 100).toFixed(1)}
                                  </div>
                                  <Progress
                                    value={channel.sentiment * 100}
                                    className="w-16 h-2 mt-1"
                                  />
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Key Topics & Trends</h4>
                      <div className="space-y-4">
                        {aiData.nlpInsights.customerSentiment.keyTopics.map(
                          (topic: any, idx: number) => (
                            <div key={idx} className="p-4 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium">{topic.topic}</div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    className={`${getSentimentColor(
                                      topic.sentiment
                                    )} bg-transparent border`}
                                  >
                                    {(topic.sentiment * 100).toFixed(1)}
                                  </Badge>
                                  {getTrendIcon(topic.trend)}
                                </div>
                              </div>

                              <div className="text-sm text-gray-600 mb-2">
                                {topic.volume} mentions • {topic.trend} trend
                              </div>

                              <div className="flex flex-wrap gap-1">
                                {topic.keywords.map(
                                  (keyword: string, keywordIdx: number) => (
                                    <Badge
                                      key={keywordIdx}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {keyword}
                                    </Badge>
                                  )
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-6">
              {/* Personalized Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    AI Recommendation Engine
                  </CardTitle>
                  <CardDescription>
                    Personalized recommendations powered by machine learning
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-blue-50 rounded">
                      <div className="text-xl font-bold text-blue-900">
                        {
                          aiData.recommendationsEngine
                            .personalizedRecommendations.customersTargeted
                        }
                      </div>
                      <div className="text-sm text-blue-600">
                        Customers Targeted
                      </div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded">
                      <div className="text-xl font-bold text-green-900">
                        {formatPercentage(
                          aiData.recommendationsEngine
                            .personalizedRecommendations.recommendationAccuracy
                        )}
                      </div>
                      <div className="text-sm text-green-600">
                        Accuracy Rate
                      </div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded">
                      <div className="text-xl font-bold text-purple-900">
                        {formatPercentage(
                          aiData.recommendationsEngine
                            .personalizedRecommendations.uptakeRate
                        )}
                      </div>
                      <div className="text-sm text-purple-600">Uptake Rate</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded">
                      <div className="text-xl font-bold text-orange-900">
                        {formatCurrency(
                          aiData.recommendationsEngine
                            .personalizedRecommendations.revenueGenerated
                        )}
                      </div>
                      <div className="text-sm text-orange-600">
                        Revenue Generated
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-4">
                      Active Personalized Recommendations
                    </h4>
                    <div className="space-y-4">
                      {aiData.recommendationsEngine.personalizedRecommendations.activeRecommendations.map(
                        (rec: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-4 border border-purple-200 bg-purple-50 rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="font-medium text-purple-900">
                                  {rec.customerName}
                                </div>
                                <div className="text-sm text-purple-700">
                                  ID: {rec.customerId}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-purple-900">
                                  {formatCurrency(rec.estimatedValue)}
                                </div>
                                <Badge className="bg-purple-100 text-purple-800">
                                  {formatProbability(rec.confidence)} confidence
                                </Badge>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm font-medium text-purple-800 mb-1">
                                  Recommendation
                                </div>
                                <div className="text-sm text-purple-700 font-medium mb-2">
                                  {rec.recommendation}
                                </div>
                                <div className="text-xs text-purple-600">
                                  {rec.reasoning}
                                </div>
                              </div>

                              <div>
                                <div className="text-sm font-medium text-purple-800 mb-1">
                                  Delivery Details
                                </div>
                                <div className="text-sm text-purple-700 mb-1">
                                  Channel:{" "}
                                  <span className="capitalize">
                                    {rec.deliveryChannel.replace("_", " ")}
                                  </span>
                                </div>
                                <div className="text-sm text-purple-700">
                                  Optimal timing:{" "}
                                  {format(rec.optimalTiming, "MMM dd, HH:mm")}
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-end mt-3 pt-3 border-t border-purple-200">
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 h-6 text-xs"
                              >
                                Execute Recommendation
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="models" className="space-y-6">
              {/* Model Performance Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {aiData.modelPerformance.models.map(
                  (model: any, idx: number) => (
                    <Card
                      key={idx}
                      className="hover:shadow-lg transition-shadow"
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            {model.modelName}
                          </CardTitle>
                          <Badge className={getModelStatusColor(model.status)}>
                            {model.status}
                          </Badge>
                        </div>
                        <CardDescription>
                          Version {model.version}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm text-gray-600">
                                Accuracy
                              </div>
                              <div className="text-lg font-bold">
                                {formatPercentage(model.accuracy)}
                              </div>
                              <Progress
                                value={model.accuracy}
                                className="h-2 mt-1"
                              />
                            </div>
                            <div>
                              <div className="text-sm text-gray-600">
                                F1 Score
                              </div>
                              <div className="text-lg font-bold">
                                {model.f1Score.toFixed(3)}
                              </div>
                              <Progress
                                value={model.f1Score * 100}
                                className="h-2 mt-1"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Precision:</span>
                              <span className="ml-2 font-medium">
                                {model.precision.toFixed(3)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Recall:</span>
                              <span className="ml-2 font-medium">
                                {model.recall.toFixed(3)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">
                                Data Points:
                              </span>
                              <span className="ml-2 font-medium">
                                {model.dataPoints.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Trend:</span>
                              <div className="flex items-center ml-2">
                                {getTrendIcon(model.performanceTrend)}
                                <span className="ml-1 text-xs capitalize">
                                  {model.performanceTrend}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-gray-500">
                            Last trained:{" "}
                            {format(model.lastTrained, "MMM dd, yyyy")}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                            <Button size="sm" variant="outline">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </MainLayout>
  );
}
