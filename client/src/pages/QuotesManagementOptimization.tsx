import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { 
  FileText, TrendingUp, AlertTriangle, DollarSign, Clock, Eye,
  Target, Activity, BarChart3, Lightbulb, Settings, Calendar,
  Filter, Brain, MessageSquare, Sparkles, Timer, Trophy,
  PieChart, LineChart, Gauge, ArrowUp, ArrowDown, ThumbsUp,
  ThumbsDown, Send, Phone, Mail, Users, Star, Zap, CheckCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, subDays, addDays, differenceInDays } from "date-fns";
import { MobileFAB } from "@/components/ui/mobile-fab";
import ContextualHelp from "@/components/contextual/ContextualHelp";
import PageAlerts from "@/components/contextual/PageAlerts";

// Types
interface QuoteManagementAnalytics {
  totalQuotes: number;
  activeQuotes: number;
  convertedQuotes: number;
  averageQuoteValue: number;
  conversionRate: number;
  averageResponseTime: number;
  totalPipelineValue: number;
  quotesToCloseRatio: number;
}

interface QuoteIntelligenceInsight {
  id: string;
  type: 'conversion_prediction' | 'engagement_analysis' | 'pricing_optimization' | 'timing_insight' | 'competitive_threat';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  confidence: number;
  potentialImpact: string;
  conversionIncrease: number;
  actionRequired: boolean;
  timeframe: string;
  affectedQuotes: string[];
  priority: number;
}

interface QuoteSuccessPredictor {
  quoteId: string;
  customerName: string;
  quoteValue: number;
  submittedDate: string;
  successProbability: number;
  riskLevel: 'low' | 'medium' | 'high';
  keyFactors: {
    customerEngagement: number;
    priceCompetitiveness: number;
    relationshipStrength: number;
    productFit: number;
    timingFactors: number;
  };
  predictions: {
    likelyOutcome: 'accept' | 'reject' | 'negotiate' | 'delay';
    expectedResponseDate: string;
    negotiationProbability: number;
    competitorThreat: number;
  };
  recommendations: {
    nextBestAction: string;
    optimalFollowUpTime: string;
    messagingStrategy: string;
    concessionStrategy: string;
  };
  winLossFactors: {
    strongPoints: string[];
    weaknesses: string[];
    competitiveAdvantages: string[];
    riskAreas: string[];
  };
}

interface CustomerEngagementTracking {
  quoteId: string;
  customerName: string;
  engagementScore: number;
  interactionHistory: {
    timestamp: string;
    action: 'viewed' | 'downloaded' | 'shared' | 'commented' | 'requested_changes';
    duration?: number;
    details: string;
  }[];
  viewingPatterns: {
    totalViews: number;
    uniqueViewers: number;
    avgViewDuration: number;
    sectionsViewed: string[];
    timeSpentPerSection: Record<string, number>;
  };
  engagementTrends: {
    metric: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercentage: number;
  }[];
  stakeholderEngagement: {
    name: string;
    role: string;
    engagementLevel: 'high' | 'medium' | 'low';
    lastActivity: string;
    influence: number;
  }[];
}

interface AutomatedNurturingCampaign {
  campaignId: string;
  campaignName: string;
  triggerConditions: string[];
  targetAudience: string;
  sequenceSteps: {
    stepNumber: number;
    delay: string;
    channel: 'email' | 'sms' | 'call' | 'linkedin';
    content: string;
    ctaAction: string;
  }[];
  performance: {
    quotesEnrolled: number;
    responseRate: number;
    conversionRate: number;
    avgTimeToResponse: number;
  };
  optimization: {
    bestPerformingStep: number;
    dropOffPoints: number[];
    recommendations: string[];
  };
}

interface CompetitiveAnalysis {
  quoteId: string;
  customerName: string;
  competitorData: {
    competitorName: string;
    marketShare: number;
    pricingPosition: 'higher' | 'lower' | 'comparable';
    strengthAreas: string[];
    weaknessAreas: string[];
    winProbability: number;
  }[];
  battleCard: {
    ourAdvantages: string[];
    competitorWeaknesses: string[];
    differentiators: string[];
    pricingStrategy: string;
    messagingTalking: string[];
  };
  winLossHistory: {
    vsCompetitor: string;
    wins: number;
    losses: number;
    winRate: number;
    commonWinFactors: string[];
    commonLossFactors: string[];
  }[];
}

interface QuoteOptimizationSuggestion {
  quoteId: string;
  customerName: string;
  currentQuoteScore: number;
  optimizationOpportunities: {
    area: string;
    currentScore: number;
    potentialScore: number;
    improvement: number;
    suggestions: string[];
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
  }[];
  prioritizedActions: {
    action: string;
    expectedImpact: number;
    effortRequired: string;
    timeline: string;
  }[];
  aiRecommendations: {
    priceAdjustment: number;
    productModifications: string[];
    presentationImprovements: string[];
    followUpStrategy: string;
  };
}

export default function QuotesManagementOptimization() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("this_quarter");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("success_probability");
  const [viewMode, setViewMode] = useState<string>("ai_insights");
  const [aiOptimizationEnabled, setAiOptimizationEnabled] = useState(true);
  const [automatedNurturingEnabled, setAutomatedNurturingEnabled] = useState(true);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // Mock data - in real implementation, these would come from APIs
  const mockAnalytics: QuoteManagementAnalytics = {
    totalQuotes: 324,
    activeQuotes: 89,
    convertedQuotes: 78,
    averageQuoteValue: 28500,
    conversionRate: 34.2,
    averageResponseTime: 4.8,
    totalPipelineValue: 2538000,
    quotesToCloseRatio: 28.6
  };

  const mockIntelligence: QuoteIntelligenceInsight[] = [
    {
      id: "insight-001",
      type: 'conversion_prediction',
      severity: 'high',
      title: "High-Value Quote at Risk",
      description: "Phoenix Corp quote ($67K) showing declining engagement - 72% risk of loss without intervention",
      recommendation: "Schedule urgent stakeholder call and provide additional technical documentation",
      confidence: 87,
      potentialImpact: "Potential $67K revenue loss prevention",
      conversionIncrease: 45,
      actionRequired: true,
      timeframe: "Next 48 hours",
      affectedQuotes: ["PHX-2024-089"],
      priority: 1
    },
    {
      id: "insight-002",
      type: 'pricing_optimization',
      severity: 'medium',
      title: "Pricing Adjustment Opportunity",
      description: "TechStart Solutions quote could support 8% price increase based on engagement patterns",
      recommendation: "Present value-added services bundle to justify higher pricing",
      confidence: 82,
      potentialImpact: "Additional $4.2K revenue potential",
      conversionIncrease: 12,
      actionRequired: true,
      timeframe: "This week",
      affectedQuotes: ["TSS-2024-156"],
      priority: 2
    },
    {
      id: "insight-003",
      type: 'timing_insight',
      severity: 'medium',
      title: "Optimal Follow-up Window",
      description: "5 quotes approaching optimal follow-up timing - engagement likely to increase 28%",
      recommendation: "Execute personalized follow-up sequence with technical demos",
      confidence: 79,
      potentialImpact: "28% increase in engagement likelihood",
      conversionIncrease: 18,
      actionRequired: true,
      timeframe: "Next 3 days",
      affectedQuotes: ["ACM-2024-234", "MFG-2024-167", "HLT-2024-289"],
      priority: 2
    },
    {
      id: "insight-004",
      type: 'competitive_threat',
      severity: 'critical',
      title: "Competitive Threat Detected",
      description: "Regional Hospital quote facing strong Xerox competition - immediate response needed",
      recommendation: "Deploy battle card strategy emphasizing service quality and total cost advantages",
      confidence: 91,
      potentialImpact: "Defend $89K opportunity",
      conversionIncrease: 35,
      actionRequired: true,
      timeframe: "Immediate",
      affectedQuotes: ["RGH-2024-178"],
      priority: 1
    }
  ];

  const mockSuccessPredictors: QuoteSuccessPredictor[] = [
    {
      quoteId: "PHX-2024-089",
      customerName: "Phoenix Corporation",
      quoteValue: 67800,
      submittedDate: "2024-08-05",
      successProbability: 28,
      riskLevel: 'high',
      keyFactors: {
        customerEngagement: 35,
        priceCompetitiveness: 78,
        relationshipStrength: 65,
        productFit: 88,
        timingFactors: 42
      },
      predictions: {
        likelyOutcome: 'delay',
        expectedResponseDate: "2024-08-20",
        negotiationProbability: 65,
        competitorThreat: 82
      },
      recommendations: {
        nextBestAction: "Schedule stakeholder meeting with technical team",
        optimalFollowUpTime: "Within 24 hours",
        messagingStrategy: "Focus on ROI and implementation timeline",
        concessionStrategy: "Consider service contract bundling"
      },
      winLossFactors: {
        strongPoints: ["Technical fit", "Competitive pricing", "Established relationship"],
        weaknesses: ["Declining engagement", "Decision timeline uncertainty"],
        competitiveAdvantages: ["Superior service coverage", "Local support team"],
        riskAreas: ["Budget approval delays", "Competitor aggressive pricing"]
      }
    },
    {
      quoteId: "TSS-2024-156",
      customerName: "TechStart Solutions",
      quoteValue: 42300,
      submittedDate: "2024-08-08",
      successProbability: 76,
      riskLevel: 'low',
      keyFactors: {
        customerEngagement: 89,
        priceCompetitiveness: 72,
        relationshipStrength: 85,
        productFit: 92,
        timingFactors: 78
      },
      predictions: {
        likelyOutcome: 'accept',
        expectedResponseDate: "2024-08-18",
        negotiationProbability: 25,
        competitorThreat: 15
      },
      recommendations: {
        nextBestAction: "Send contract for signature",
        optimalFollowUpTime: "In 2-3 days",
        messagingStrategy: "Reinforce value proposition and timeline benefits",
        concessionStrategy: "Minimal concessions needed"
      },
      winLossFactors: {
        strongPoints: ["High engagement", "Perfect product fit", "Budget approved"],
        weaknesses: ["Limited competitive differentiation"],
        competitiveAdvantages: ["Implementation speed", "Training programs"],
        riskAreas: ["Last-minute competitor intervention"]
      }
    }
  ];

  const mockEngagementTracking: CustomerEngagementTracking[] = [
    {
      quoteId: "PHX-2024-089",
      customerName: "Phoenix Corporation",
      engagementScore: 35,
      interactionHistory: [
        {
          timestamp: "2024-08-12T14:30:00Z",
          action: 'viewed',
          duration: 8,
          details: "Viewed pricing section for 8 minutes"
        },
        {
          timestamp: "2024-08-10T09:15:00Z",
          action: 'downloaded',
          details: "Downloaded technical specifications PDF"
        },
        {
          timestamp: "2024-08-08T16:45:00Z",
          action: 'viewed',
          duration: 15,
          details: "Initial quote review - 15 minutes"
        }
      ],
      viewingPatterns: {
        totalViews: 3,
        uniqueViewers: 2,
        avgViewDuration: 11,
        sectionsViewed: ["pricing", "technical_specs", "implementation"],
        timeSpentPerSection: {
          "pricing": 8,
          "technical_specs": 12,
          "implementation": 5
        }
      },
      engagementTrends: [
        { metric: "View Frequency", trend: 'decreasing', changePercentage: -35 },
        { metric: "Time per View", trend: 'stable', changePercentage: 2 },
        { metric: "Section Coverage", trend: 'increasing', changePercentage: 15 }
      ],
      stakeholderEngagement: [
        {
          name: "Sarah Martinez",
          role: "IT Director",
          engagementLevel: 'medium',
          lastActivity: "2024-08-12",
          influence: 85
        },
        {
          name: "Mike Johnson",
          role: "Procurement Manager",
          engagementLevel: 'low',
          lastActivity: "2024-08-08",
          influence: 60
        }
      ]
    }
  ];

  const mockNurturingCampaigns: AutomatedNurturingCampaign[] = [
    {
      campaignId: "camp-001",
      campaignName: "High-Value Quote Follow-up",
      triggerConditions: ["Quote value > $50K", "No response in 5 days", "Initial engagement > 70%"],
      targetAudience: "Enterprise decision makers",
      sequenceSteps: [
        {
          stepNumber: 1,
          delay: "5 days after quote submission",
          channel: 'email',
          content: "Personalized follow-up with implementation timeline",
          ctaAction: "Schedule technical demo"
        },
        {
          stepNumber: 2,
          delay: "3 days after step 1",
          channel: 'call',
          content: "Phone follow-up to address concerns",
          ctaAction: "Book stakeholder meeting"
        },
        {
          stepNumber: 3,
          delay: "5 days after step 2",
          channel: 'email',
          content: "ROI calculator and case studies",
          ctaAction: "Download ROI analysis"
        }
      ],
      performance: {
        quotesEnrolled: 45,
        responseRate: 42,
        conversionRate: 28,
        avgTimeToResponse: 7.2
      },
      optimization: {
        bestPerformingStep: 2,
        dropOffPoints: [1, 3],
        recommendations: [
          "Personalize step 1 emails with industry-specific content",
          "Add SMS option for step 3 follow-up"
        ]
      }
    }
  ];

  const filteredPredictors = mockSuccessPredictors.filter(predictor => {
    return selectedStatus === "all" || predictor.riskLevel === selectedStatus;
  });

  const sortedPredictors = [...filteredPredictors].sort((a, b) => {
    switch (sortBy) {
      case 'success_probability':
        return b.successProbability - a.successProbability;
      case 'quote_value':
        return b.quoteValue - a.quoteValue;
      case 'risk_level':
        const riskOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
      case 'submission_date':
        return new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime();
      default:
        return 0;
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-300 text-red-800';
      case 'high': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'medium': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'low': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSuccessProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'text-green-600';
    if (probability >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'decreasing': return <ArrowDown className="h-4 w-4 text-red-600" />;
      default: return <span className="h-4 w-4 text-gray-400">→</span>;
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quote Success Intelligence</h1>
            <p className="text-gray-600 mt-1">AI-powered quote management and conversion optimization</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsSettingsDialogOpen(true)}
              data-testid="button-quotes-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Badge variant="outline" className="px-3 py-2">
              <Brain className="h-4 w-4 mr-2" />
              AI Intelligence: {aiOptimizationEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        {/* Contextual Help */}
        <ContextualHelp page="quotes-management-optimization" />

        {/* Page Alerts */}
        <PageAlerts 
          alerts={mockIntelligence.filter(intel => intel.actionRequired && intel.severity === 'critical').map(intel => ({
            id: intel.id,
            type: 'error',
            title: intel.title,
            message: intel.description,
            action: {
              label: "Take Action",
              onClick: () => console.log(`Acting on ${intel.id}`)
            }
          }))}
        />

        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="metric-conversion-rate">
                {mockAnalytics.conversionRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                Industry avg: 28%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="metric-pipeline-value">
                ${(mockAnalytics.totalPipelineValue / 1000000).toFixed(1)}M
              </div>
              <p className="text-xs text-muted-foreground">
                {mockAnalytics.activeQuotes} active quotes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="metric-response-time">
                {mockAnalytics.averageResponseTime}d
              </div>
              <p className="text-xs text-muted-foreground">
                Target: &lt;5 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Quote Value</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="metric-avg-quote-value">
                ${(mockAnalytics.averageQuoteValue / 1000).toFixed(0)}K
              </div>
              <p className="text-xs text-muted-foreground">
                +8% from last quarter
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">AI Overview</TabsTrigger>
            <TabsTrigger value="intelligence">Quote Intelligence</TabsTrigger>
            <TabsTrigger value="predictors">Success Predictors</TabsTrigger>
            <TabsTrigger value="engagement">Engagement Tracking</TabsTrigger>
            <TabsTrigger value="campaigns">Nurturing Campaigns</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quote Intelligence Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    Quote Intelligence Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockIntelligence.slice(0, 4).map((intel) => (
                      <div 
                        key={intel.id} 
                        className={`p-3 rounded-lg border ${getSeverityColor(intel.severity)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{intel.title}</p>
                            <p className="text-xs mt-1 opacity-90">{intel.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {intel.confidence}% confidence
                              </Badge>
                              <span className="text-xs font-medium text-green-600">
                                +{intel.conversionIncrease}% conversion
                              </span>
                            </div>
                          </div>
                          {intel.actionRequired && (
                            <Button size="sm" variant="outline" className="ml-2">
                              <Zap className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quote Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Quote Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Conversion Rate</span>
                        <span className="text-sm font-medium text-green-600">{mockAnalytics.conversionRate}%</span>
                      </div>
                      <Progress value={mockAnalytics.conversionRate} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Response Rate</span>
                        <span className="text-sm font-medium text-blue-600">78.4%</span>
                      </div>
                      <Progress value={78.4} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Average Engagement</span>
                        <span className="text-sm font-medium">65.2%</span>
                      </div>
                      <Progress value={65.2} className="h-2" />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Quotes to Close Ratio</span>
                        <span className="font-bold text-blue-600">{mockAnalytics.quotesToCloseRatio}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Win Rate vs Competition</span>
                        <span className="font-medium">42.8%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI-Powered Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  AI-Powered Quote Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Target className="h-5 w-5 text-red-600" />
                      <span className="font-medium">High-Risk Quotes</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      4 quotes need immediate attention
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Follow-up Queue</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      12 quotes ready for optimal follow-up
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Zap className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Optimization Opportunities</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      7 quotes can be optimized for higher conversion
                    </p>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="intelligence" className="space-y-6">
            <div className="space-y-4">
              {mockIntelligence.map((intel) => (
                <Card key={intel.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="h-5 w-5 text-purple-600" />
                          {intel.title}
                        </CardTitle>
                        <CardDescription>{intel.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(intel.severity)}>
                          {intel.severity}
                        </Badge>
                        <Badge variant="outline">
                          {intel.confidence}% confidence
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">AI Recommendation</h4>
                          <p className="text-sm text-gray-700">{intel.recommendation}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Expected Impact</h4>
                          <p className="text-lg font-bold text-green-600">
                            +{intel.conversionIncrease}% conversion
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{intel.potentialImpact}</p>
                        </div>
                      </div>
                      
                      {intel.affectedQuotes.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Affected Quotes</h4>
                          <div className="flex flex-wrap gap-2">
                            {intel.affectedQuotes.map((quoteId, index) => (
                              <Badge key={index} variant="outline">{quoteId}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>⏱ {intel.timeframe}</span>
                          <span>🎯 Priority {intel.priority}</span>
                        </div>
                        {intel.actionRequired && (
                          <div className="flex gap-2">
                            <Button size="sm">Take Action</Button>
                            <Button size="sm" variant="outline">Schedule</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="predictors" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="success_probability">Sort by Success Probability</SelectItem>
                  <SelectItem value="quote_value">Sort by Value</SelectItem>
                  <SelectItem value="risk_level">Sort by Risk Level</SelectItem>
                  <SelectItem value="submission_date">Sort by Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Success Predictor Cards */}
            <div className="space-y-6">
              {sortedPredictors.map((predictor) => (
                <Card key={predictor.quoteId} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{predictor.customerName}</CardTitle>
                        <CardDescription>
                          ${predictor.quoteValue.toLocaleString()} • {format(new Date(predictor.submittedDate), 'MMM dd, yyyy')}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={getRiskColor(predictor.riskLevel)}>
                          {predictor.riskLevel} risk
                        </Badge>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getSuccessProbabilityColor(predictor.successProbability)}`}>
                            {predictor.successProbability}%
                          </div>
                          <div className="text-xs text-gray-500">Success Probability</div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Key Factors */}
                      <div>
                        <h4 className="font-medium mb-3">Key Success Factors</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {Object.entries(predictor.keyFactors).map(([factor, score]) => (
                            <div key={factor} className="text-center">
                              <div className={`text-lg font-bold ${
                                score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {score}%
                              </div>
                              <div className="text-xs text-gray-600 capitalize">
                                {factor.replace(/([A-Z])/g, ' $1').trim()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Predictions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">AI Predictions</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Likely Outcome:</span>
                              <Badge variant="outline" className="capitalize">{predictor.predictions.likelyOutcome}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Expected Response:</span>
                              <span className="font-medium">{format(new Date(predictor.predictions.expectedResponseDate), 'MMM dd')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Negotiation Likelihood:</span>
                              <span className="font-medium">{predictor.predictions.negotiationProbability}%</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">Next Best Action</h4>
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-800 font-medium">{predictor.recommendations.nextBestAction}</p>
                            <p className="text-xs text-blue-600 mt-1">
                              Optimal timing: {predictor.recommendations.optimalFollowUpTime}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Win/Loss Factors */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2 text-green-700">Competitive Advantages</h4>
                          <div className="space-y-1">
                            {predictor.winLossFactors.competitiveAdvantages.slice(0, 2).map((advantage, index) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-green-700">{advantage}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2 text-orange-700">Risk Areas</h4>
                          <div className="space-y-1">
                            {predictor.winLossFactors.riskAreas.slice(0, 2).map((risk, index) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <AlertTriangle className="h-4 w-4 text-orange-600" />
                                <span className="text-orange-700">{risk}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-4 border-t">
                        <Button size="sm" className="flex-1">
                          <Phone className="h-4 w-4 mr-2" />
                          Follow Up
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Eye className="h-4 w-4 mr-2" />
                          View Quote
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Zap className="h-4 w-4 mr-2" />
                          Optimize
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            {mockEngagementTracking.map((engagement) => (
              <Card key={engagement.quoteId}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    {engagement.customerName} - Engagement Analysis
                  </CardTitle>
                  <CardDescription>
                    Quote ID: {engagement.quoteId} • Engagement Score: {engagement.engagementScore}%
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Engagement Score and Trends */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-3">Engagement Metrics</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Total Views:</span>
                            <span className="font-medium">{engagement.viewingPatterns.totalViews}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Avg View Duration:</span>
                            <span className="font-medium">{engagement.viewingPatterns.avgViewDuration} min</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Unique Viewers:</span>
                            <span className="font-medium">{engagement.viewingPatterns.uniqueViewers}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-3">Engagement Trends</h4>
                        <div className="space-y-2">
                          {engagement.engagementTrends.map((trend, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{trend.metric}</span>
                              <div className="flex items-center gap-2">
                                {getTrendIcon(trend.trend)}
                                <span className={`font-medium ${
                                  trend.trend === 'increasing' ? 'text-green-600' : 
                                  trend.trend === 'decreasing' ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {Math.abs(trend.changePercentage)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Stakeholder Engagement */}
                    <div>
                      <h4 className="font-medium mb-3">Stakeholder Engagement</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {engagement.stakeholderEngagement.map((stakeholder, index) => (
                          <div key={index} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{stakeholder.name}</div>
                                <div className="text-sm text-gray-600">{stakeholder.role}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Last active: {format(new Date(stakeholder.lastActivity), 'MMM dd')}
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge className={
                                  stakeholder.engagementLevel === 'high' ? 'bg-green-100 text-green-800' :
                                  stakeholder.engagementLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }>
                                  {stakeholder.engagementLevel}
                                </Badge>
                                <div className="text-sm font-medium mt-1">
                                  {stakeholder.influence}% influence
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div>
                      <h4 className="font-medium mb-3">Recent Activity Timeline</h4>
                      <div className="space-y-3">
                        {engagement.interactionHistory.map((interaction, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-shrink-0 mt-1">
                              {interaction.action === 'viewed' && <Eye className="h-4 w-4 text-blue-600" />}
                              {interaction.action === 'downloaded' && <FileText className="h-4 w-4 text-green-600" />}
                              {interaction.action === 'shared' && <Users className="h-4 w-4 text-purple-600" />}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium capitalize">{interaction.action}</div>
                              <div className="text-sm text-gray-600">{interaction.details}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {format(new Date(interaction.timestamp), 'MMM dd, HH:mm')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button size="sm">
                        <Mail className="h-4 w-4 mr-2" />
                        Send Follow-up
                      </Button>
                      <Button size="sm" variant="outline">
                        <Phone className="h-4 w-4 mr-2" />
                        Schedule Call
                      </Button>
                      <Button size="sm" variant="outline">
                        <Send className="h-4 w-4 mr-2" />
                        Share Update
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            {mockNurturingCampaigns.map((campaign) => (
              <Card key={campaign.campaignId}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                    {campaign.campaignName}
                  </CardTitle>
                  <CardDescription>
                    Target: {campaign.targetAudience} • {campaign.sequenceSteps.length} steps
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Campaign Performance */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-800">{campaign.performance.quotesEnrolled}</div>
                        <div className="text-sm text-blue-600">Quotes Enrolled</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-800">{campaign.performance.responseRate}%</div>
                        <div className="text-sm text-green-600">Response Rate</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-800">{campaign.performance.conversionRate}%</div>
                        <div className="text-sm text-purple-600">Conversion Rate</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-800">{campaign.performance.avgTimeToResponse}d</div>
                        <div className="text-sm text-orange-600">Avg Response Time</div>
                      </div>
                    </div>

                    {/* Campaign Sequence */}
                    <div>
                      <h4 className="font-medium mb-3">Campaign Sequence</h4>
                      <div className="space-y-3">
                        {campaign.sequenceSteps.map((step) => (
                          <div key={step.stepNumber} className={`p-4 border rounded-lg ${
                            step.stepNumber === campaign.optimization.bestPerformingStep ? 'border-green-300 bg-green-50' : ''
                          }`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">Step {step.stepNumber}</Badge>
                                  <Badge variant="outline" className="capitalize">{step.channel}</Badge>
                                  <span className="text-sm text-gray-600">{step.delay}</span>
                                  {step.stepNumber === campaign.optimization.bestPerformingStep && (
                                    <Badge className="bg-green-100 text-green-800">Best Performing</Badge>
                                  )}
                                </div>
                                <div className="text-sm text-gray-700 mb-2">{step.content}</div>
                                <div className="text-sm font-medium text-blue-600">CTA: {step.ctaAction}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Optimization Recommendations */}
                    <div>
                      <h4 className="font-medium mb-3">AI Optimization Recommendations</h4>
                      <div className="space-y-2">
                        {campaign.optimization.recommendations.map((recommendation, index) => (
                          <div key={index} className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                            <Lightbulb className="h-4 w-4 text-yellow-600 mt-0.5" />
                            <span className="text-sm text-yellow-800">{recommendation}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button size="sm">
                        <Zap className="h-4 w-4 mr-2" />
                        Optimize Campaign
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        View Analytics
                      </Button>
                      <Button size="sm" variant="outline">
                        <Settings className="h-4 w-4 mr-2" />
                        Edit Sequence
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* Mobile Floating Action Button */}
        <div className="fixed bottom-6 right-6 z-50 md:hidden">
          <MobileFAB
            icon={Brain}
            label="Quote Intelligence"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-2xl"
            onClick={() => setActiveTab('intelligence')}
            data-testid="mobile-fab-quote-intelligence"
          />
        </div>

        {/* Settings Dialog */}
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Quote Intelligence Settings</DialogTitle>
              <DialogDescription>
                Configure AI-powered quote management and conversion optimization preferences
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ai-optimization">AI Quote Intelligence</Label>
                    <p className="text-sm text-gray-600">Enable AI-powered quote analysis and success prediction</p>
                  </div>
                  <Switch 
                    id="ai-optimization"
                    checked={aiOptimizationEnabled}
                    onCheckedChange={setAiOptimizationEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="automated-nurturing">Automated Nurturing</Label>
                    <p className="text-sm text-gray-600">Enable automated follow-up campaigns and engagement tracking</p>
                  </div>
                  <Switch 
                    id="automated-nurturing"
                    checked={automatedNurturingEnabled}
                    onCheckedChange={setAutomatedNurturingEnabled}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsSettingsDialogOpen(false)}>
                  Save Settings
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}