import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { 
  Target, TrendingUp, Users, Calendar, Brain, Zap, AlertTriangle,
  CheckCircle, Star, Trophy, Activity, DollarSign, Clock, Eye,
  ArrowUp, ArrowDown, BarChart3, Lightbulb, Settings, Filter,
  MessageSquare, Phone, Mail, FileText, ThumbsUp, ThumbsDown,
  Sparkles, Rocket, Globe, LinkedinIcon
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
import { format, subDays, addDays } from "date-fns";
import { MobileFAB } from "@/components/ui/mobile-fab";
import ContextualHelp from "@/components/contextual/ContextualHelp";
import PageAlerts from "@/components/contextual/PageAlerts";

// Types
interface DealAnalytics {
  totalDeals: number;
  averageDealCycle: number; // days
  winRate: number; // percentage
  totalPipelineValue: number;
  averageDealSize: number;
  conversionRate: number;
  predictedRevenue: number;
  pipelineHealth: number;
}

interface DealHealthScore {
  dealId: string;
  dealName: string;
  companyName: string;
  currentStage: string;
  healthScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  nextBestAction: string;
  aiRecommendations: string[];
  predictedCloseDate: string;
  closureProbability: number;
  stagnationRisk: number;
  competitiveThreat: boolean;
  engagementScore: number;
  lastActivity: string;
  daysInStage: number;
  factors: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
}

interface DealIntelligence {
  id: string;
  dealId: string;
  insightType: 'opportunity' | 'risk' | 'action' | 'prediction' | 'competitive';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  confidence: number;
  potentialImpact: string;
  estimatedValue: number;
  actionRequired: boolean;
  timeframe: string;
  priority: number;
}

interface CompetitiveBattleCard {
  dealId: string;
  primaryCompetitor: string;
  competitorStrengths: string[];
  competitorWeaknesses: string[];
  ourAdvantages: string[];
  riskAreas: string[];
  winningStrategy: string[];
  competitiveThreat: 'low' | 'medium' | 'high';
  marketPosition: string;
  pricingComparison: string;
  differentiators: string[];
}

interface DealAccelerator {
  dealId: string;
  nextBestActions: {
    action: string;
    priority: number;
    timeframe: string;
    expectedImpact: string;
    confidence: number;
  }[];
  urgentTasks: string[];
  followUpSchedule: {
    date: string;
    type: 'call' | 'email' | 'meeting' | 'demo';
    description: string;
  }[];
  stakeholderMap: {
    name: string;
    role: string;
    influence: 'high' | 'medium' | 'low';
    engagement: 'positive' | 'neutral' | 'negative';
    lastContact: string;
  }[];
}

interface PipelineForecasting {
  currentQuarter: {
    predicted: number;
    committed: number;
    bestCase: number;
    worstCase: number;
    confidence: number;
  };
  nextQuarter: {
    predicted: number;
    trending: number;
    confidence: number;
  };
  seasonalTrends: {
    month: string;
    historicalAverage: number;
    currentProjection: number;
    variance: number;
  }[];
  riskFactors: string[];
  opportunityFactors: string[];
}

export default function DealsManagementOptimization() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("this_quarter");
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("health_score");
  const [viewMode, setViewMode] = useState<string>("smart_insights");
  const [aiCoachEnabled, setAiCoachEnabled] = useState(true);
  const [predictiveEnabled, setPredictiveEnabled] = useState(true);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // Mock data - in real implementation, these would come from APIs
  const mockAnalytics: DealAnalytics = {
    totalDeals: 127,
    averageDealCycle: 23, // days
    winRate: 68.5, // percentage
    totalPipelineValue: 2847500,
    averageDealSize: 22434,
    conversionRate: 24.8,
    predictedRevenue: 1947200,
    pipelineHealth: 82
  };

  const mockDealHealthScores: DealHealthScore[] = [
    {
      dealId: "deal-001",
      dealName: "Canon Enterprise Solution - TechCorp",
      companyName: "TechCorp Solutions",
      currentStage: "Proposal",
      healthScore: 87,
      riskLevel: 'low',
      nextBestAction: "Schedule decision maker meeting within 3 days",
      aiRecommendations: [
        "Present ROI calculator with 18-month payback analysis",
        "Address security concerns raised in last meeting",
        "Propose extended warranty as value-add"
      ],
      predictedCloseDate: "2024-08-25",
      closureProbability: 78,
      stagnationRisk: 15,
      competitiveThreat: false,
      engagementScore: 92,
      lastActivity: "2024-08-10",
      daysInStage: 12,
      factors: {
        positive: [
          "High engagement from key stakeholders",
          "Budget approved and allocated",
          "Strong technical fit for requirements",
          "Positive references from similar clients"
        ],
        negative: [
          "Competitive proposal from Xerox pending",
          "Decision timeline pushed back 2 weeks"
        ],
        neutral: [
          "Waiting for final security review",
          "Implementation timeline under discussion"
        ]
      }
    },
    {
      dealId: "deal-002",
      dealName: "HP Color Fleet - Marketing Agency",
      companyName: "Creative Marketing Inc",
      currentStage: "Negotiation",
      healthScore: 45,
      riskLevel: 'high',
      nextBestAction: "Urgent: Address pricing concerns with VP",
      aiRecommendations: [
        "Offer volume discount for multi-year commitment",
        "Include additional training and support",
        "Schedule C-level meeting to discuss strategic value"
      ],
      predictedCloseDate: "2024-08-30",
      closureProbability: 42,
      stagnationRisk: 68,
      competitiveThreat: true,
      engagementScore: 34,
      lastActivity: "2024-08-05",
      daysInStage: 18,
      factors: {
        positive: [
          "Technical requirements fully met",
          "Existing relationship with IT manager"
        ],
        negative: [
          "Price 15% above budget",
          "Competitor offering aggressive terms",
          "Decision maker showing cold feet",
          "Recent budget cuts announced"
        ],
        neutral: [
          "Financing options being evaluated",
          "Legal review in progress"
        ]
      }
    },
    {
      dealId: "deal-003",
      dealName: "Xerox Upgrade - Law Firm",
      companyName: "Justice & Associates",
      currentStage: "Discovery",
      healthScore: 72,
      riskLevel: 'medium',
      nextBestAction: "Schedule comprehensive needs assessment",
      aiRecommendations: [
        "Focus on document security features for legal industry",
        "Prepare compliance documentation (HIPAA, SOX)",
        "Arrange site visit to similar law firm installation"
      ],
      predictedCloseDate: "2024-09-15",
      closureProbability: 65,
      stagnationRisk: 28,
      competitiveThreat: false,
      engagementScore: 76,
      lastActivity: "2024-08-12",
      daysInStage: 8,
      factors: {
        positive: [
          "Growing firm with expansion plans",
          "Existing equipment aging out",
          "Strong champion in office manager",
          "Clear pain points identified"
        ],
        negative: [
          "Multiple decision makers",
          "Conservative purchasing approach"
        ],
        neutral: [
          "Evaluating lease vs purchase options",
          "Timing dependent on office move"
        ]
      }
    }
  ];

  const mockIntelligence: DealIntelligence[] = [
    {
      id: "intel-001",
      dealId: "deal-002",
      insightType: 'risk',
      severity: 'critical',
      title: "Deal at High Risk - Immediate Action Required",
      description: "Creative Marketing Inc deal showing 68% stagnation risk with competitor threat",
      recommendation: "Schedule emergency meeting with VP to address pricing and value proposition",
      confidence: 92,
      potentialImpact: "Risk of losing $45,000 deal to competitor",
      estimatedValue: -45000,
      actionRequired: true,
      timeframe: "24 hours",
      priority: 1
    },
    {
      id: "intel-002",
      dealId: "deal-001",
      insightType: 'opportunity',
      severity: 'medium',
      title: "Upsell Opportunity Identified",
      description: "TechCorp shows indicators for additional equipment needs based on growth patterns",
      recommendation: "Present expanded solution with additional devices and managed services",
      confidence: 76,
      potentialImpact: "Potential to increase deal value by $25,000",
      estimatedValue: 25000,
      actionRequired: true,
      timeframe: "This week",
      priority: 3
    },
    {
      id: "intel-003",
      dealId: "deal-003",
      insightType: 'action',
      severity: 'medium',
      title: "Optimal Contact Window Detected",
      description: "Justice & Associates decision maker most responsive on Tuesday afternoons",
      recommendation: "Schedule next meeting for Tuesday 2-4 PM for highest engagement",
      confidence: 84,
      potentialImpact: "15% higher meeting acceptance rate",
      estimatedValue: 5000,
      actionRequired: false,
      timeframe: "Next week",
      priority: 4
    },
    {
      id: "intel-004",
      dealId: "all",
      insightType: 'prediction',
      severity: 'high',
      title: "Q4 Pipeline Acceleration Opportunity",
      description: "Historical data shows 23% higher close rates for deals initiated in August",
      recommendation: "Accelerate prospecting efforts and prioritize warm leads",
      confidence: 88,
      potentialImpact: "Potential 18% increase in Q4 revenue",
      estimatedValue: 125000,
      actionRequired: true,
      timeframe: "This month",
      priority: 2
    }
  ];

  const mockBattleCards: CompetitiveBattleCard[] = [
    {
      dealId: "deal-002",
      primaryCompetitor: "Xerox",
      competitorStrengths: [
        "Aggressive pricing strategy",
        "Strong brand recognition",
        "Existing relationship with procurement"
      ],
      competitorWeaknesses: [
        "Limited cloud integration",
        "Higher maintenance costs",
        "Slower support response times"
      ],
      ourAdvantages: [
        "Superior mobile printing capabilities",
        "Advanced security features",
        "Comprehensive managed services",
        "24/7 premium support included"
      ],
      riskAreas: [
        "Price sensitivity - 15% above budget",
        "Competitor has existing IT relationship",
        "Decision maker previously purchased Xerox"
      ],
      winningStrategy: [
        "Emphasize total cost of ownership over initial price",
        "Demonstrate mobile and cloud capabilities",
        "Leverage security features for compliance requirements",
        "Offer extended trial period to prove value"
      ],
      competitiveThreat: 'high',
      marketPosition: "Premium solution provider",
      pricingComparison: "15% higher upfront, 8% lower TCO over 3 years",
      differentiators: [
        "Cloud-native architecture",
        "AI-powered document workflow",
        "Zero-touch deployment capability"
      ]
    }
  ];

  const mockAccelerators: DealAccelerator[] = [
    {
      dealId: "deal-001",
      nextBestActions: [
        {
          action: "Schedule C-level executive briefing",
          priority: 1,
          timeframe: "This week",
          expectedImpact: "25% increase in closure probability",
          confidence: 87
        },
        {
          action: "Deliver customized ROI analysis",
          priority: 2,
          timeframe: "3 days",
          expectedImpact: "Address budget justification concerns",
          confidence: 92
        },
        {
          action: "Arrange reference call with similar customer",
          priority: 3,
          timeframe: "Next week",
          expectedImpact: "Build confidence in solution",
          confidence: 78
        }
      ],
      urgentTasks: [
        "Prepare security compliance documentation",
        "Schedule technical deep-dive with IT team",
        "Draft implementation timeline"
      ],
      followUpSchedule: [
        {
          date: "2024-08-15",
          type: 'meeting',
          description: "Executive briefing with CEO and CFO"
        },
        {
          date: "2024-08-18",
          type: 'demo',
          description: "Technical demonstration of security features"
        },
        {
          date: "2024-08-22",
          type: 'call',
          description: "Reference call with TechFlow Industries"
        }
      ],
      stakeholderMap: [
        {
          name: "Sarah Johnson",
          role: "CEO",
          influence: 'high',
          engagement: 'positive',
          lastContact: "2024-08-10"
        },
        {
          name: "Mike Chen",
          role: "IT Director",
          influence: 'high',
          engagement: 'positive',
          lastContact: "2024-08-12"
        },
        {
          name: "Lisa Rodriguez",
          role: "CFO",
          influence: 'high',
          engagement: 'neutral',
          lastContact: "2024-08-05"
        },
        {
          name: "Tom Wilson",
          role: "Procurement Manager",
          influence: 'medium',
          engagement: 'neutral',
          lastContact: "2024-08-08"
        }
      ]
    }
  ];

  const mockForecasting: PipelineForecasting = {
    currentQuarter: {
      predicted: 1947200,
      committed: 1425000,
      bestCase: 2156800,
      worstCase: 1678400,
      confidence: 78
    },
    nextQuarter: {
      predicted: 2134500,
      trending: 2267800,
      confidence: 65
    },
    seasonalTrends: [
      { month: "August", historicalAverage: 582000, currentProjection: 634500, variance: 9.0 },
      { month: "September", historicalAverage: 645000, currentProjection: 698200, variance: 8.2 },
      { month: "October", historicalAverage: 720000, currentProjection: 772100, variance: 7.2 }
    ],
    riskFactors: [
      "Economic uncertainty affecting enterprise spending",
      "Two major competitors launching aggressive promotions",
      "Key salesperson vacation during peak period"
    ],
    opportunityFactors: [
      "New product launch generating high interest",
      "Government sector showing increased demand",
      "Strategic partnership expanding market reach"
    ]
  };

  const filteredHealthScores = mockDealHealthScores.filter(deal => {
    return selectedOwner === "all" || deal.dealName.includes(selectedOwner);
  });

  const sortedHealthScores = [...filteredHealthScores].sort((a, b) => {
    switch (sortBy) {
      case 'health_score':
        return b.healthScore - a.healthScore;
      case 'probability':
        return b.closureProbability - a.closureProbability;
      case 'risk':
        return b.stagnationRisk - a.stagnationRisk;
      case 'value':
        return b.engagementScore - a.engagementScore;
      default:
        return 0;
    }
  });

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-300 text-red-800';
      case 'high': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'medium': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'low': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getEngagementIcon = (engagement: string) => {
    switch (engagement) {
      case 'positive': return <ThumbsUp className="h-4 w-4 text-green-600" />;
      case 'negative': return <ThumbsDown className="h-4 w-4 text-red-600" />;
      default: return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Deals Intelligence</h1>
            <p className="text-gray-600 mt-1">Predictive deal scoring and AI-powered sales acceleration</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsSettingsDialogOpen(true)}
              data-testid="button-deals-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Badge variant="outline" className="px-3 py-2">
              <Brain className="h-4 w-4 mr-2" />
              AI Coach: {aiCoachEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        {/* Contextual Help */}
        <ContextualHelp page="deals-management-optimization" />

        {/* Page Alerts */}
        <PageAlerts 
          alerts={mockIntelligence.filter(intel => intel.actionRequired && intel.severity === 'critical').map(intel => ({
            id: intel.id,
            type: 'error',
            title: intel.title,
            message: intel.description,
            action: {
              label: "Take Action",
              onClick: () => console.log(`Taking action for ${intel.id}`)
            }
          }))}
        />

        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Health</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="metric-pipeline-health">
                {mockAnalytics.pipelineHealth}%
              </div>
              <p className="text-xs text-muted-foreground">
                {mockAnalytics.totalDeals} active deals
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="metric-win-rate">
                {mockAnalytics.winRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                12% above industry average
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Deal Cycle</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="metric-deal-cycle">
                {mockAnalytics.averageDealCycle} days
              </div>
              <p className="text-xs text-muted-foreground">
                12% faster than industry
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Predicted Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="metric-predicted-revenue">
                ${(mockAnalytics.predictedRevenue / 1000).toFixed(0)}K
              </div>
              <p className="text-xs text-muted-foreground">
                78% confidence level
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">AI Overview</TabsTrigger>
            <TabsTrigger value="health">Deal Health</TabsTrigger>
            <TabsTrigger value="accelerator">Deal Accelerator</TabsTrigger>
            <TabsTrigger value="intelligence">Market Intel</TabsTrigger>
            <TabsTrigger value="forecasting">Forecasting</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Intelligence Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    AI Deal Intelligence
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
                              <span className="text-xs font-medium">
                                {intel.potentialImpact}
                              </span>
                            </div>
                          </div>
                          {intel.actionRequired && (
                            <Button size="sm" variant="outline" className="ml-2">
                              <Rocket className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pipeline Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Pipeline Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Health Score</span>
                        <span className="text-sm font-medium text-green-600">
                          {mockAnalytics.pipelineHealth}% Excellent
                        </span>
                      </div>
                      <Progress value={mockAnalytics.pipelineHealth} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Win Rate</span>
                        <span className="text-sm font-medium text-blue-600">{mockAnalytics.winRate}%</span>
                      </div>
                      <Progress value={mockAnalytics.winRate} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Conversion Rate</span>
                        <span className="text-sm font-medium">{mockAnalytics.conversionRate}%</span>
                      </div>
                      <Progress value={mockAnalytics.conversionRate} className="h-2" />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Total Pipeline Value</span>
                        <span className="font-bold text-green-600">
                          ${(mockAnalytics.totalPipelineValue / 1000).toFixed(0)}K
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Average Deal Size</span>
                        <span className="font-medium">
                          ${mockAnalytics.averageDealSize.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  AI-Powered Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Target className="h-5 w-5 text-red-600" />
                      <span className="font-medium">Address Risk Deals</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      2 deals require immediate attention
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Sparkles className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Optimize Pipeline</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      Apply AI recommendations to 8 deals
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Schedule Follow-ups</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      12 automated follow-up suggestions
                    </p>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales Reps</SelectItem>
                  <SelectItem value="john">John Smith</SelectItem>
                  <SelectItem value="sarah">Sarah Johnson</SelectItem>
                  <SelectItem value="mike">Mike Chen</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="health_score">Sort by Health Score</SelectItem>
                  <SelectItem value="probability">Sort by Probability</SelectItem>
                  <SelectItem value="risk">Sort by Risk Level</SelectItem>
                  <SelectItem value="value">Sort by Engagement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Deal Health Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {sortedHealthScores.map((deal) => (
                <Card key={deal.dealId} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{deal.dealName}</CardTitle>
                        <CardDescription>{deal.companyName} • {deal.currentStage}</CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={getRiskLevelColor(deal.riskLevel)}>
                          {deal.riskLevel} risk
                        </Badge>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getHealthScoreColor(deal.healthScore)}`}>
                            {deal.healthScore}
                          </div>
                          <div className="text-xs text-gray-500">Health Score</div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <p className="text-sm font-medium text-blue-800">{deal.closureProbability}%</p>
                          <p className="text-xs text-blue-600">Close Probability</p>
                        </div>
                        <div className="text-center p-2 bg-green-50 rounded">
                          <p className="text-sm font-medium text-green-800">{deal.engagementScore}</p>
                          <p className="text-xs text-green-600">Engagement</p>
                        </div>
                        <div className="text-center p-2 bg-orange-50 rounded">
                          <p className="text-sm font-medium text-orange-800">{deal.daysInStage}</p>
                          <p className="text-xs text-orange-600">Days in Stage</p>
                        </div>
                      </div>

                      {/* Next Best Action */}
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="h-4 w-4 text-purple-600" />
                          <span className="font-medium text-purple-800">AI Recommendation</span>
                        </div>
                        <p className="text-sm text-purple-700">{deal.nextBestAction}</p>
                      </div>

                      {/* Key Factors */}
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Key Factors</div>
                        <div className="grid grid-cols-1 gap-2">
                          {deal.factors.positive.slice(0, 2).map((factor, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-green-700">{factor}</span>
                            </div>
                          ))}
                          {deal.factors.negative.slice(0, 2).map((factor, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <span className="text-red-700">{factor}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                        <Button size="sm" className="flex-1">
                          <Rocket className="h-4 w-4 mr-2" />
                          Take Action
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="accelerator" className="space-y-6">
            {mockAccelerators.map((accelerator) => {
              const deal = mockDealHealthScores.find(d => d.dealId === accelerator.dealId);
              if (!deal) return null;
              
              return (
                <Card key={accelerator.dealId}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Rocket className="h-5 w-5 text-blue-600" />
                      Deal Accelerator: {deal.dealName}
                    </CardTitle>
                    <CardDescription>{deal.companyName}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Next Best Actions */}
                      <div>
                        <h4 className="font-medium mb-3">AI-Recommended Next Actions</h4>
                        <div className="space-y-3">
                          {accelerator.nextBestActions.map((action, index) => (
                            <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                              <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold">
                                {action.priority}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-blue-900">{action.action}</p>
                                <p className="text-sm text-blue-700 mt-1">{action.expectedImpact}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-blue-600">
                                  <span>⏱ {action.timeframe}</span>
                                  <span>🎯 {action.confidence}% confidence</span>
                                </div>
                              </div>
                              <Button size="sm" variant="outline">
                                Execute
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Stakeholder Map */}
                      <div>
                        <h4 className="font-medium mb-3">Stakeholder Map</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {accelerator.stakeholderMap.map((stakeholder, index) => (
                            <div key={index} className="p-3 border rounded-lg">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium">{stakeholder.name}</p>
                                  <p className="text-sm text-gray-600">{stakeholder.role}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge 
                                      variant="outline" 
                                      className={
                                        stakeholder.influence === 'high' ? 'border-red-300 text-red-800' :
                                        stakeholder.influence === 'medium' ? 'border-yellow-300 text-yellow-800' :
                                        'border-gray-300 text-gray-800'
                                      }
                                    >
                                      {stakeholder.influence} influence
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {getEngagementIcon(stakeholder.engagement)}
                                  <span className="text-xs text-gray-500">
                                    {format(new Date(stakeholder.lastContact), 'MMM dd')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Follow-up Schedule */}
                      <div>
                        <h4 className="font-medium mb-3">Scheduled Follow-ups</h4>
                        <div className="space-y-2">
                          {accelerator.followUpSchedule.map((followUp, index) => (
                            <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                                {followUp.type === 'meeting' && <Users className="h-5 w-5 text-green-600" />}
                                {followUp.type === 'call' && <Phone className="h-5 w-5 text-green-600" />}
                                {followUp.type === 'email' && <Mail className="h-5 w-5 text-green-600" />}
                                {followUp.type === 'demo' && <Eye className="h-5 w-5 text-green-600" />}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{followUp.description}</p>
                                <p className="text-sm text-gray-600">
                                  {format(new Date(followUp.date), 'MMM dd, yyyy')}
                                </p>
                              </div>
                              <Button size="sm" variant="outline">
                                <Calendar className="h-4 w-4 mr-2" />
                                Schedule
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
                          <h4 className="font-medium mb-2">Potential Impact</h4>
                          <p className="text-sm text-gray-700">{intel.potentialImpact}</p>
                          <p className="text-lg font-bold text-green-600 mt-1">
                            {intel.estimatedValue > 0 ? '+' : ''}${intel.estimatedValue.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
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

            {/* Competitive Battle Cards */}
            {mockBattleCards.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-red-600" />
                    Competitive Battle Card
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mockBattleCards.map((battleCard) => (
                    <div key={battleCard.dealId} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">vs {battleCard.primaryCompetitor}</h4>
                        <Badge className={
                          battleCard.competitiveThreat === 'high' ? 'bg-red-100 text-red-800' :
                          battleCard.competitiveThreat === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }>
                          {battleCard.competitiveThreat} threat
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium mb-2 text-green-700">Our Advantages</h5>
                          <ul className="space-y-1 text-sm">
                            {battleCard.ourAdvantages.map((advantage, index) => (
                              <li key={index} className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                {advantage}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium mb-2 text-red-700">Risk Areas</h5>
                          <ul className="space-y-1 text-sm">
                            {battleCard.riskAreas.map((risk, index) => (
                              <li key={index} className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                {risk}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div>
                        <h5 className="font-medium mb-2">Winning Strategy</h5>
                        <ul className="space-y-1 text-sm">
                          {battleCard.winningStrategy.map((strategy, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <Star className="h-4 w-4 text-blue-600" />
                              {strategy}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="forecasting" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Quarter Forecast */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Q4 2024 Forecast
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-800">
                        ${(mockForecasting.currentQuarter.predicted / 1000).toFixed(0)}K
                      </div>
                      <div className="text-sm text-blue-600">Predicted Revenue</div>
                      <div className="text-xs text-blue-500 mt-1">
                        {mockForecasting.currentQuarter.confidence}% confidence
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 bg-green-50 rounded">
                        <div className="font-medium text-green-800">
                          ${(mockForecasting.currentQuarter.committed / 1000).toFixed(0)}K
                        </div>
                        <div className="text-green-600">Committed</div>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded">
                        <div className="font-medium text-yellow-800">
                          ${(mockForecasting.currentQuarter.bestCase / 1000).toFixed(0)}K
                        </div>
                        <div className="text-yellow-600">Best Case</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Forecast Accuracy</span>
                        <span className="font-medium">{mockForecasting.currentQuarter.confidence}%</span>
                      </div>
                      <Progress value={mockForecasting.currentQuarter.confidence} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Seasonal Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    Seasonal Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockForecasting.seasonalTrends.map((trend) => (
                      <div key={trend.month} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{trend.month}</div>
                          <div className="text-sm text-gray-600">
                            ${(trend.currentProjection / 1000).toFixed(0)}K projected
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-medium ${
                            trend.variance > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {trend.variance > 0 ? '+' : ''}{trend.variance.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500">vs historical</div>
                        </div>
                      </div>
                    ))}

                    <Separator />

                    <div className="space-y-2">
                      <h4 className="font-medium">Key Factors</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-green-700">
                          <TrendingUp className="h-4 w-4" />
                          <span>New product launch generating high interest</span>
                        </div>
                        <div className="flex items-center gap-2 text-red-700">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Economic uncertainty affecting enterprise spending</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Risk and Opportunity Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Risk & Opportunity Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3 text-red-700">Risk Factors</h4>
                    <div className="space-y-2">
                      {mockForecasting.riskFactors.map((risk, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span>{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3 text-green-700">Opportunity Factors</h4>
                    <div className="space-y-2">
                      {mockForecasting.opportunityFactors.map((opportunity, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span>{opportunity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Mobile Floating Action Button */}
        <div className="fixed bottom-6 right-6 z-50 md:hidden">
          <MobileFAB
            icon={Brain}
            label="AI Coach"
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-2xl"
            onClick={() => setActiveTab('accelerator')}
            data-testid="mobile-fab-ai-coach"
          />
        </div>

        {/* Settings Dialog */}
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>AI Deals Intelligence Settings</DialogTitle>
              <DialogDescription>
                Configure AI-powered deal scoring and predictive analytics preferences
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ai-coach">AI Deal Coach</Label>
                    <p className="text-sm text-gray-600">Enable AI-powered deal recommendations and coaching</p>
                  </div>
                  <Switch 
                    id="ai-coach"
                    checked={aiCoachEnabled}
                    onCheckedChange={setAiCoachEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="predictive-analytics">Predictive Analytics</Label>
                    <p className="text-sm text-gray-600">Enable machine learning-based deal scoring and forecasting</p>
                  </div>
                  <Switch 
                    id="predictive-analytics"
                    checked={predictiveEnabled}
                    onCheckedChange={setPredictiveEnabled}
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