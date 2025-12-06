import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  TrendingUp,
  Search,
  MessageSquare,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";

interface ContentGap {
  topic: string;
  confidence: number;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  evidence: {
    searchVolume?: number;
    zeroResultSearches?: number;
    negativeFeeback?: number;
    userRequests?: number;
  };
  suggestedArticles: Array<{
    title: string;
    contentType: string;
    difficultyLevel: string;
    rationale: string;
  }>;
  relatedFeatures: string[];
}

interface CategoryHealth {
  articleCount: number;
  targetArticles: number;
  coverageScore: number;
  status: "excellent" | "good" | "fair" | "poor";
  missingTopics: string[];
}

interface AnalysisReport {
  totalGaps: number;
  criticalGaps: number;
  highPriorityGaps: number;
  gaps: ContentGap[];
  categoryHealth: Record<string, CategoryHealth>;
  recommendations: string[];
}

export default function ContentGapDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: report, isLoading, refetch } = useQuery<{ report: AnalysisReport }>({
    queryKey: ["/api/content-gap-analysis"],
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "medium":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "low":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    };
    return colors[priority] || colors.low;
  };

  const getHealthStatus = (status: string) => {
    const statusConfig: Record<
      string,
      { color: string; icon: React.ReactNode; label: string }
    > = {
      excellent: {
        color: "text-green-600",
        icon: <CheckCircle2 className="h-5 w-5" />,
        label: "Excellent",
      },
      good: {
        color: "text-blue-600",
        icon: <TrendingUp className="h-5 w-5" />,
        label: "Good",
      },
      fair: {
        color: "text-yellow-600",
        icon: <AlertCircle className="h-5 w-5" />,
        label: "Fair",
      },
      poor: {
        color: "text-red-600",
        icon: <XCircle className="h-5 w-5" />,
        label: "Needs Attention",
      },
    };
    return statusConfig[status] || statusConfig.fair;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin">
            <Sparkles className="h-8 w-8 text-blue-600 mx-auto" />
          </div>
          <p className="text-muted-foreground">Analyzing content gaps...</p>
        </div>
      </div>
    );
  }

  if (!report?.report) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            No analysis data available. Click refresh to generate a new report.
          </div>
        </CardContent>
      </Card>
    );
  }

  const { report: analysisReport } = report;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Gap Analysis</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered insights to identify missing or weak content in your knowledge base
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh Analysis
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              Total Gaps Identified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analysisReport.totalGaps}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Topics needing documentation or improvement
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Critical Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {analysisReport.criticalGaps}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Immediate attention required
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              High Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {analysisReport.highPriorityGaps}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Important gaps to address soon
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="gaps" className="space-y-4">
        <TabsList>
          <TabsTrigger value="gaps">Content Gaps</TabsTrigger>
          <TabsTrigger value="categories">Category Health</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        {/* Content Gaps Tab */}
        <TabsContent value="gaps" className="space-y-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3 pr-4">
              {analysisReport.gaps.slice(0, 50).map((gap, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getPriorityIcon(gap.priority)}
                          <Badge className={getPriorityColor(gap.priority)}>
                            {gap.priority.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {gap.category.replace(/_/g, " ")}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {gap.confidence}% confidence
                          </Badge>
                        </div>
                        <CardTitle className="text-lg">{gap.topic}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Evidence */}
                    {Object.keys(gap.evidence).length > 0 && (
                      <div className="flex flex-wrap gap-3 text-sm">
                        {gap.evidence.searchVolume && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Search className="h-4 w-4" />
                            <span>{gap.evidence.searchVolume} searches</span>
                          </div>
                        )}
                        {gap.evidence.zeroResultSearches && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <AlertCircle className="h-4 w-4" />
                            <span>{gap.evidence.zeroResultSearches} zero results</span>
                          </div>
                        )}
                        {gap.evidence.negativeFeeback && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MessageSquare className="h-4 w-4" />
                            <span>{gap.evidence.negativeFeeback} complaints</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Suggested Articles */}
                    {gap.suggestedArticles.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">💡 Suggested Articles:</p>
                        <div className="space-y-2">
                          {gap.suggestedArticles.slice(0, 2).map((article, i) => (
                            <div
                              key={i}
                              className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                            >
                              <div className="font-medium mb-1">{article.title}</div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {article.contentType}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {article.difficultyLevel}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {article.rationale}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Related Features */}
                    {gap.relatedFeatures.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {gap.relatedFeatures.map((feature, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Category Health Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(analysisReport.categoryHealth).map(([slug, health]) => {
              const healthStatus = getHealthStatus(health.status);
              return (
                <Card key={slug}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg capitalize">
                        {slug.replace(/-/g, " ")}
                      </CardTitle>
                      <div className={`flex items-center gap-1 ${healthStatus.color}`}>
                        {healthStatus.icon}
                        <span className="text-sm font-medium">{healthStatus.label}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Coverage</span>
                        <span className="font-medium">
                          {health.articleCount} / {health.targetArticles} articles
                        </span>
                      </div>
                      <Progress value={health.coverageScore} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {health.coverageScore}% complete
                      </p>
                    </div>

                    {health.articleCount < health.targetArticles && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          {health.targetArticles - health.articleCount} more articles needed
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                AI-Powered Recommendations
              </CardTitle>
              <CardDescription>
                Actionable insights to improve your knowledge base coverage and quality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysisReport.recommendations.map((recommendation, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg bg-white dark:bg-gray-900 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg flex-shrink-0">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed">{recommendation}</p>
                      </div>
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
