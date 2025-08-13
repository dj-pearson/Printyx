import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { 
  FileText, Wand2, Eye, Settings, Sparkles, Target, Brain,
  Download, Share2, Edit3, Copy, Template, Palette, BarChart3,
  Clock, CheckCircle, AlertTriangle, TrendingUp, Lightbulb,
  Users, Star, Zap, Send, MessageSquare, PieChart, Award,
  Calendar, DollarSign, ArrowRight, ChevronDown, ChevronUp
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, subDays, addDays, differenceInDays } from "date-fns";
import { MobileFAB } from "@/components/ui/mobile-fab";
import ContextualHelp from "@/components/contextual/ContextualHelp";
import PageAlerts from "@/components/contextual/PageAlerts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Types
interface ProposalGenerationAnalytics {
  totalProposals: number;
  generatedThisMonth: number;
  averageGenerationTime: number;
  templateUtilization: number;
  successRate: number;
  averageProposalValue: number;
  clientEngagement: number;
  conversionRate: number;
}

interface AIContentGeneration {
  id: string;
  type: 'executive_summary' | 'value_proposition' | 'technical_solution' | 'implementation_plan' | 'roi_analysis';
  title: string;
  description: string;
  aiConfidence: number;
  customizationLevel: 'low' | 'medium' | 'high';
  estimatedImpact: string;
  generationTime: number;
  qualityScore: number;
  suggestions: string[];
  templates: {
    templateId: string;
    templateName: string;
    successRate: number;
    avgResponseTime: number;
    lastUsed: string;
  }[];
}

interface IntelligentTemplateRecommendation {
  templateId: string;
  templateName: string;
  category: string;
  recommendationScore: number;
  matchingFactors: {
    industryMatch: number;
    dealSizeMatch: number;
    customerTypeMatch: number;
    solutionComplexity: number;
    timelineAlignment: number;
  };
  historicalPerformance: {
    successRate: number;
    avgCloseTime: number;
    avgDealValue: number;
    clientSatisfaction: number;
  };
  aiInsights: {
    whyRecommended: string[];
    potentialChallenges: string[];
    optimizationTips: string[];
  };
  contentSuggestions: {
    keyMessages: string[];
    valueProps: string[];
    differentiators: string[];
  };
}

interface ProposalPerformanceAnalytics {
  proposalId: string;
  customerName: string;
  proposalTitle: string;
  templateUsed: string;
  createdDate: string;
  performanceMetrics: {
    viewTime: number;
    downloadCount: number;
    shareCount: number;
    sectionEngagement: Record<string, number>;
    stakeholderViews: number;
  };
  outcomeTracking: {
    status: 'pending' | 'accepted' | 'rejected' | 'negotiating';
    responseTime: number;
    clientFeedback: string[];
    winLossFactors: string[];
  };
  aiAnalysis: {
    strengthAreas: string[];
    improvementAreas: string[];
    competitivePosition: string;
    successProbability: number;
  };
  elementPerformance: {
    section: string;
    effectiveness: number;
    engagement: number;
    conversionImpact: number;
  }[];
}

interface DynamicContentPersonalization {
  customerId: string;
  customerName: string;
  industry: string;
  companySize: string;
  personalizationElements: {
    executiveSummary: {
      originalContent: string;
      personalizedContent: string;
      personalizationFactors: string[];
    };
    valueProposition: {
      primaryBenefits: string[];
      industrySpecific: string[];
    };
    caseStudies: {
      relevantCases: {
        customerName: string;
        industry: string;
        similarChallenges: string[];
        achievedResults: string[];
        relevanceScore: number;
      }[];
    };
    pricingStrategy: {
      recommendedApproach: string;
      justificationPoints: string[];
      competitivePosition: string;
    };
  };
  aiRecommendations: {
    messagingTone: string;
    keyStakeholders: string[];
    decisionCriteria: string[];
    riskMitigation: string[];
  };
}

interface CollaborationWorkflow {
  workflowId: string;
  workflowName: string;
  proposalId: string;
  collaborators: {
    userId: string;
    userName: string;
    role: string;
    permissions: string[];
    lastActivity: string;
    contributionScore: number;
  }[];
  workflowStages: {
    stageName: string;
    assignedTo: string[];
    status: 'pending' | 'in_progress' | 'completed' | 'review';
    dueDate: string;
    dependencies: string[];
    estimatedTime: number;
  }[];
  realTimeTracking: {
    activeEditors: number;
    recentChanges: {
      timestamp: string;
      editor: string;
      section: string;
      changeType: 'content' | 'format' | 'review' | 'approval';
    }[];
  };
  approvalProcess: {
    approvalStages: {
      stage: string;
      approver: string;
      status: 'pending' | 'approved' | 'rejected';
      feedback: string;
      timestamp?: string;
    }[];
    overallStatus: string;
  };
}

export default function QuoteProposalGenerationOptimization() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("this_month");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("performance_score");
  const [viewMode, setViewMode] = useState<string>("ai_insights");
  const [aiContentEnabled, setAiContentEnabled] = useState(true);
  const [dynamicPersonalizationEnabled, setDynamicPersonalizationEnabled] = useState(true);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // Mock data - in real implementation, these would come from APIs
  const mockAnalytics: ProposalGenerationAnalytics = {
    totalProposals: 156,
    generatedThisMonth: 23,
    averageGenerationTime: 1.8,
    templateUtilization: 87.4,
    successRate: 68.2,
    averageProposalValue: 84500,
    clientEngagement: 76.3,
    conversionRate: 42.1
  };

  const mockAIContent: AIContentGeneration[] = [
    {
      id: "ai-001",
      type: 'executive_summary',
      title: "Executive Summary Generation",
      description: "AI-powered executive summary creation based on customer profile and solution scope",
      aiConfidence: 92,
      customizationLevel: 'high',
      estimatedImpact: "40% faster proposal creation, 25% higher engagement",
      generationTime: 0.3,
      qualityScore: 88,
      suggestions: [
        "Include industry-specific ROI metrics",
        "Emphasize competitive advantages",
        "Add customer success timeline"
      ],
      templates: [
        {
          templateId: "exec-001",
          templateName: "Enterprise Technology Summary",
          successRate: 72,
          avgResponseTime: 4.2,
          lastUsed: "2024-08-10"
        }
      ]
    },
    {
      id: "ai-002",
      type: 'value_proposition',
      title: "Value Proposition Optimization",
      description: "Dynamic value proposition generation tailored to customer pain points",
      aiConfidence: 89,
      customizationLevel: 'medium',
      estimatedImpact: "35% improvement in proposal relevance",
      generationTime: 0.5,
      qualityScore: 91,
      suggestions: [
        "Quantify cost savings with specific metrics",
        "Include risk mitigation benefits",
        "Add implementation ease factors"
      ],
      templates: [
        {
          templateId: "val-001",
          templateName: "ROI-Focused Value Template",
          successRate: 78,
          avgResponseTime: 3.8,
          lastUsed: "2024-08-12"
        }
      ]
    }
  ];

  const mockTemplateRecommendations: IntelligentTemplateRecommendation[] = [
    {
      templateId: "temp-001",
      templateName: "Enterprise Digital Transformation",
      category: "Technology Solutions",
      recommendationScore: 94,
      matchingFactors: {
        industryMatch: 95,
        dealSizeMatch: 87,
        customerTypeMatch: 92,
        solutionComplexity: 88,
        timelineAlignment: 91
      },
      historicalPerformance: {
        successRate: 74,
        avgCloseTime: 28,
        avgDealValue: 125000,
        clientSatisfaction: 4.3
      },
      aiInsights: {
        whyRecommended: [
          "Perfect match for enterprise-level technology transformation",
          "Strong track record with similar company size and industry",
          "Optimal template for complex multi-phase implementations"
        ],
        potentialChallenges: [
          "May require customization for specific compliance requirements",
          "Timeline sections need adjustment for accelerated delivery"
        ],
        optimizationTips: [
          "Emphasize security and compliance features",
          "Include dedicated project management approach",
          "Add change management and training components"
        ]
      },
      contentSuggestions: {
        keyMessages: [
          "Accelerated digital transformation with proven methodology",
          "Enterprise-grade security and compliance built-in",
          "Dedicated support team throughout implementation"
        ],
        valueProps: [
          "40% faster time-to-value compared to traditional approaches",
          "99.9% uptime guarantee with redundant infrastructure",
          "25% reduction in operational costs within first year"
        ],
        differentiators: [
          "Only solution certified for enterprise compliance standards",
          "Proprietary AI-driven optimization engine",
          "24/7 dedicated enterprise support team"
        ]
      }
    }
  ];

  const mockPerformanceAnalytics: ProposalPerformanceAnalytics[] = [
    {
      proposalId: "prop-001",
      customerName: "Global Manufacturing Corp",
      proposalTitle: "Enterprise ERP Implementation",
      templateUsed: "Enterprise Digital Transformation",
      createdDate: "2024-08-05",
      performanceMetrics: {
        viewTime: 23.5,
        downloadCount: 8,
        shareCount: 3,
        sectionEngagement: {
          "executive_summary": 95,
          "solution_overview": 87,
          "implementation": 76,
          "pricing": 92,
          "case_studies": 68
        },
        stakeholderViews: 12
      },
      outcomeTracking: {
        status: 'negotiating',
        responseTime: 6,
        clientFeedback: [
          "Comprehensive solution addressing our key requirements",
          "Implementation timeline seems aggressive",
          "Pricing is competitive but needs justification"
        ],
        winLossFactors: [
          "Strong technical fit",
          "Competitive pricing",
          "Timeline concerns"
        ]
      },
      aiAnalysis: {
        strengthAreas: [
          "Technical solution comprehensiveness",
          "Competitive pricing position",
          "Strong case study relevance"
        ],
        improvementAreas: [
          "Implementation timeline clarity",
          "Risk mitigation details",
          "Change management approach"
        ],
        competitivePosition: "Strong - leading in 2 of 3 key evaluation criteria",
        successProbability: 78
      },
      elementPerformance: [
        { section: "Executive Summary", effectiveness: 88, engagement: 95, conversionImpact: 85 },
        { section: "Solution Overview", effectiveness: 82, engagement: 87, conversionImpact: 79 },
        { section: "Implementation Plan", effectiveness: 71, engagement: 76, conversionImpact: 68 },
        { section: "Pricing", effectiveness: 85, engagement: 92, conversionImpact: 88 }
      ]
    }
  ];

  const mockPersonalization: DynamicContentPersonalization[] = [
    {
      customerId: "cust-001",
      customerName: "Global Manufacturing Corp",
      industry: "Manufacturing",
      companySize: "Enterprise (5000+ employees)",
      personalizationElements: {
        executiveSummary: {
          originalContent: "Our solution provides comprehensive business transformation...",
          personalizedContent: "Global Manufacturing Corp can achieve operational excellence through our proven manufacturing-specific digital transformation platform, designed for enterprises managing complex global operations...",
          personalizationFactors: [
            "Industry-specific language and terminology",
            "Company size and complexity considerations",
            "Manufacturing-specific challenges and solutions"
          ]
        },
        valueProposition: {
          primaryBenefits: [
            "30% reduction in production downtime",
            "25% improvement in supply chain efficiency",
            "Real-time visibility across global operations"
          ],
          industrySpecific: [
            "Manufacturing execution system integration",
            "Quality management automation",
            "Regulatory compliance tracking"
          ]
        },
        caseStudies: {
          relevantCases: [
            {
              customerName: "International Automotive Systems",
              industry: "Automotive Manufacturing",
              similarChallenges: [
                "Global operation coordination",
                "Quality compliance management",
                "Supply chain optimization"
              ],
              achievedResults: [
                "35% reduction in production cycle time",
                "40% improvement in quality metrics",
                "99.2% regulatory compliance achievement"
              ],
              relevanceScore: 92
            }
          ]
        },
        pricingStrategy: {
          recommendedApproach: "Value-based pricing emphasizing ROI and cost savings",
          justificationPoints: [
            "Projected $2.3M annual cost savings",
            "18-month ROI achievement",
            "Risk mitigation value of $800K annually"
          ],
          competitivePosition: "Premium pricing justified by enterprise-grade features"
        }
      },
      aiRecommendations: {
        messagingTone: "Professional, data-driven, emphasizing proven results",
        keyStakeholders: ["CTO", "Operations Director", "CFO", "Plant Managers"],
        decisionCriteria: [
          "Technical capability and scalability",
          "Implementation risk and timeline",
          "Total cost of ownership",
          "Vendor support and reliability"
        ],
        riskMitigation: [
          "Phased implementation approach",
          "Comprehensive training program",
          "24/7 support during transition",
          "Performance guarantees and SLAs"
        ]
      }
    }
  ];

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 70) return 'bg-green-100 text-green-800';
    if (rate >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'negotiating': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Proposal Intelligence</h1>
            <p className="text-gray-600 mt-1">AI-powered quote & proposal generation with intelligent automation</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsSettingsDialogOpen(true)}
              data-testid="button-proposal-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Badge variant="outline" className="px-3 py-2">
              <Brain className="h-4 w-4 mr-2" />
              AI Generation: {aiContentEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        {/* Contextual Help */}
        <ContextualHelp page="quote-proposal-generation-optimization" />

        {/* Page Alerts */}
        <PageAlerts 
          alerts={[
            {
              id: "alert-001",
              type: 'info',
              title: "AI Content Generation Active",
              message: "5 proposals are being auto-generated with AI assistance",
              action: {
                label: "View Progress",
                onClick: () => setActiveTab('ai-content')
              }
            }
          ]}
        />

        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="metric-success-rate">
                {mockAnalytics.successRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                +12% from last quarter
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Generation Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="metric-generation-time">
                {mockAnalytics.averageGenerationTime}h
              </div>
              <p className="text-xs text-muted-foreground">
                -45% with AI assistance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Template Utilization</CardTitle>
              <Template className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="metric-template-utilization">
                {mockAnalytics.templateUtilization}%
              </div>
              <p className="text-xs text-muted-foreground">
                Optimal efficiency range
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Proposal Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="metric-avg-proposal-value">
                ${(mockAnalytics.averageProposalValue / 1000).toFixed(0)}K
              </div>
              <p className="text-xs text-muted-foreground">
                +18% YoY growth
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">AI Overview</TabsTrigger>
            <TabsTrigger value="ai-content">AI Content</TabsTrigger>
            <TabsTrigger value="templates">Smart Templates</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="personalization">Personalization</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Content Generation Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-purple-600" />
                    AI Content Generation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockAIContent.slice(0, 2).map((content) => (
                      <div key={content.id} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-purple-800">{content.title}</p>
                            <p className="text-xs mt-1 text-purple-700">{content.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {content.aiConfidence}% confidence
                              </Badge>
                              <span className="text-xs font-medium text-green-600">
                                Quality: {content.qualityScore}%
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-purple-600">
                              {content.generationTime}h
                            </div>
                            <div className="text-xs text-purple-500">Generation Time</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Template Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Template Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Success Rate</span>
                        <span className="text-sm font-medium text-green-600">{mockAnalytics.successRate}%</span>
                      </div>
                      <Progress value={mockAnalytics.successRate} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Client Engagement</span>
                        <span className="text-sm font-medium text-blue-600">{mockAnalytics.clientEngagement}%</span>
                      </div>
                      <Progress value={mockAnalytics.clientEngagement} className="h-2" />
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
                        <span className="text-sm">Generated This Month</span>
                        <span className="font-bold text-blue-600">{mockAnalytics.generatedThisMonth}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Template Efficiency</span>
                        <span className="font-medium">{mockAnalytics.templateUtilization}%</span>
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
                  AI-Powered Proposal Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Wand2 className="h-5 w-5 text-purple-600" />
                      <span className="font-medium">Generate Content</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      AI-powered content creation for 3 pending proposals
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Target className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Optimize Templates</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      AI recommendations for 5 underperforming templates
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Users className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Personalize Content</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      Dynamic personalization for 8 active proposals
                    </p>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-content" className="space-y-6">
            <div className="space-y-4">
              {mockAIContent.map((content) => (
                <Card key={content.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="h-5 w-5 text-purple-600" />
                          {content.title}
                        </CardTitle>
                        <CardDescription>{content.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-100 text-purple-800">
                          {content.aiConfidence}% confidence
                        </Badge>
                        <Badge variant="outline">
                          {content.customizationLevel} customization
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-800">{content.generationTime}h</div>
                          <div className="text-sm text-blue-600">Generation Time</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-800">{content.qualityScore}%</div>
                          <div className="text-sm text-green-600">Quality Score</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-xl font-bold text-purple-800">{content.estimatedImpact.split(',')[0]}</div>
                          <div className="text-sm text-purple-600">Time Savings</div>
                        </div>
                      </div>

                      {/* AI Suggestions */}
                      <div>
                        <h4 className="font-medium mb-2">AI Optimization Suggestions</h4>
                        <div className="space-y-2">
                          {content.suggestions.map((suggestion, index) => (
                            <div key={index} className="flex items-start gap-2 p-2 bg-yellow-50 rounded">
                              <Lightbulb className="h-4 w-4 text-yellow-600 mt-0.5" />
                              <span className="text-sm text-yellow-800">{suggestion}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Template Performance */}
                      <div>
                        <h4 className="font-medium mb-3">Related Template Performance</h4>
                        <div className="space-y-2">
                          {content.templates.map((template, index) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <div className="font-medium text-sm">{template.templateName}</div>
                                <div className="text-xs text-gray-600">
                                  Last used: {format(new Date(template.lastUsed), 'MMM dd, yyyy')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-green-600">{template.successRate}%</div>
                                <div className="text-xs text-gray-500">Success Rate</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-4 border-t">
                        <Button size="sm">
                          <Wand2 className="h-4 w-4 mr-2" />
                          Generate Content
                        </Button>
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <Button size="sm" variant="outline">
                          <Settings className="h-4 w-4 mr-2" />
                          Customize
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            {mockTemplateRecommendations.map((template) => (
              <Card key={template.templateId} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{template.templateName}</CardTitle>
                      <CardDescription>{template.category}</CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {template.recommendationScore}%
                      </div>
                      <div className="text-xs text-gray-500">Match Score</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Matching Factors */}
                    <div>
                      <h4 className="font-medium mb-3">AI Matching Analysis</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {Object.entries(template.matchingFactors).map(([factor, score]) => (
                          <div key={factor} className="text-center">
                            <div className={`text-lg font-bold ${getPerformanceColor(score)}`}>
                              {score}%
                            </div>
                            <div className="text-xs text-gray-600 capitalize">
                              {factor.replace(/([A-Z])/g, ' $1').trim()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Historical Performance */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-xl font-bold text-green-800">{template.historicalPerformance.successRate}%</div>
                        <div className="text-sm text-green-600">Success Rate</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-xl font-bold text-blue-800">{template.historicalPerformance.avgCloseTime}d</div>
                        <div className="text-sm text-blue-600">Avg Close Time</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-xl font-bold text-purple-800">${(template.historicalPerformance.avgDealValue / 1000).toFixed(0)}K</div>
                        <div className="text-sm text-purple-600">Avg Deal Value</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <div className="text-xl font-bold text-orange-800">{template.historicalPerformance.clientSatisfaction}</div>
                        <div className="text-sm text-orange-600">Client Rating</div>
                      </div>
                    </div>

                    {/* Expandable AI Insights */}
                    <Collapsible open={expandedSections.has(template.templateId)} onOpenChange={() => toggleSection(template.templateId)}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between p-0">
                          <span className="font-medium">AI Insights & Recommendations</span>
                          {expandedSections.has(template.templateId) ? 
                            <ChevronUp className="h-4 w-4" /> : 
                            <ChevronDown className="h-4 w-4" />
                          }
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h5 className="font-medium mb-2 text-green-700">Why Recommended</h5>
                            <div className="space-y-1">
                              {template.aiInsights.whyRecommended.map((reason, index) => (
                                <div key={index} className="flex items-start gap-2 text-sm">
                                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                                  <span className="text-green-700">{reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <h5 className="font-medium mb-2 text-orange-700">Optimization Tips</h5>
                            <div className="space-y-1">
                              {template.aiInsights.optimizationTips.map((tip, index) => (
                                <div key={index} className="flex items-start gap-2 text-sm">
                                  <Lightbulb className="h-4 w-4 text-orange-600 mt-0.5" />
                                  <span className="text-orange-700">{tip}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Content Suggestions */}
                        <div>
                          <h5 className="font-medium mb-2">AI Content Suggestions</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <div className="text-sm font-medium text-blue-700 mb-1">Key Messages</div>
                              {template.contentSuggestions.keyMessages.slice(0, 2).map((message, index) => (
                                <div key={index} className="text-xs text-blue-600 mb-1">• {message}</div>
                              ))}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-green-700 mb-1">Value Props</div>
                              {template.contentSuggestions.valueProps.slice(0, 2).map((prop, index) => (
                                <div key={index} className="text-xs text-green-600 mb-1">• {prop}</div>
                              ))}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-purple-700 mb-1">Differentiators</div>
                              {template.contentSuggestions.differentiators.slice(0, 2).map((diff, index) => (
                                <div key={index} className="text-xs text-purple-600 mb-1">• {diff}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button size="sm">
                        <Template className="h-4 w-4 mr-2" />
                        Use Template
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit3 className="h-4 w-4 mr-2" />
                        Customize
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {mockPerformanceAnalytics.map((proposal) => (
              <Card key={proposal.proposalId}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        {proposal.proposalTitle}
                      </CardTitle>
                      <CardDescription>
                        {proposal.customerName} • {format(new Date(proposal.createdDate), 'MMM dd, yyyy')}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(proposal.outcomeTracking.status)}>
                        {proposal.outcomeTracking.status}
                      </Badge>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getPerformanceColor(proposal.aiAnalysis.successProbability)}`}>
                          {proposal.aiAnalysis.successProbability}%
                        </div>
                        <div className="text-xs text-gray-500">Success Probability</div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Performance Metrics */}
                    <div>
                      <h4 className="font-medium mb-3">Engagement Metrics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-xl font-bold text-blue-800">{proposal.performanceMetrics.viewTime}min</div>
                          <div className="text-sm text-blue-600">Total View Time</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-xl font-bold text-green-800">{proposal.performanceMetrics.downloadCount}</div>
                          <div className="text-sm text-green-600">Downloads</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-xl font-bold text-purple-800">{proposal.performanceMetrics.shareCount}</div>
                          <div className="text-sm text-purple-600">Shares</div>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-xl font-bold text-orange-800">{proposal.performanceMetrics.stakeholderViews}</div>
                          <div className="text-sm text-orange-600">Stakeholder Views</div>
                        </div>
                      </div>
                    </div>

                    {/* Section Performance */}
                    <div>
                      <h4 className="font-medium mb-3">Section Performance Analysis</h4>
                      <div className="space-y-3">
                        {proposal.elementPerformance.map((element, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="font-medium">{element.section}</div>
                            <div className="flex items-center gap-6">
                              <div className="text-center">
                                <div className={`font-bold ${getPerformanceColor(element.effectiveness)}`}>
                                  {element.effectiveness}%
                                </div>
                                <div className="text-xs text-gray-600">Effectiveness</div>
                              </div>
                              <div className="text-center">
                                <div className={`font-bold ${getPerformanceColor(element.engagement)}`}>
                                  {element.engagement}%
                                </div>
                                <div className="text-xs text-gray-600">Engagement</div>
                              </div>
                              <div className="text-center">
                                <div className={`font-bold ${getPerformanceColor(element.conversionImpact)}`}>
                                  {element.conversionImpact}%
                                </div>
                                <div className="text-xs text-gray-600">Impact</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI Analysis */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2 text-green-700">Strength Areas</h4>
                        <div className="space-y-1">
                          {proposal.aiAnalysis.strengthAreas.map((strength, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-green-700">{strength}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2 text-orange-700">Improvement Areas</h4>
                        <div className="space-y-1">
                          {proposal.aiAnalysis.improvementAreas.map((area, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <AlertTriangle className="h-4 w-4 text-orange-600" />
                              <span className="text-orange-700">{area}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Client Feedback */}
                    <div>
                      <h4 className="font-medium mb-2">Client Feedback</h4>
                      <div className="space-y-2">
                        {proposal.outcomeTracking.clientFeedback.map((feedback, index) => (
                          <div key={index} className="p-2 bg-blue-50 rounded text-sm text-blue-800">
                            "{feedback}"
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button size="sm">
                        <Zap className="h-4 w-4 mr-2" />
                        Optimize
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        View Full Report
                      </Button>
                      <Button size="sm" variant="outline">
                        <Copy className="h-4 w-4 mr-2" />
                        Create Similar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="personalization" className="space-y-6">
            {mockPersonalization.map((person) => (
              <Card key={person.customerId}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600" />
                    {person.customerName} - Personalization Profile
                  </CardTitle>
                  <CardDescription>
                    {person.industry} • {person.companySize}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Personalization Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">AI Personalization Elements</h4>
                        <div className="space-y-2">
                          {person.personalizationElements.executiveSummary.personalizationFactors.map((factor, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <Star className="h-4 w-4 text-yellow-600" />
                              <span>{factor}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">AI Recommendations</h4>
                        <div className="space-y-2 text-sm">
                          <div><strong>Tone:</strong> {person.aiRecommendations.messagingTone}</div>
                          <div><strong>Key Stakeholders:</strong> {person.aiRecommendations.keyStakeholders.join(', ')}</div>
                        </div>
                      </div>
                    </div>

                    {/* Value Proposition */}
                    <div>
                      <h4 className="font-medium mb-3">Industry-Specific Value Proposition</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-blue-700 mb-2">Primary Benefits</div>
                          <div className="space-y-1">
                            {person.personalizationElements.valueProposition.primaryBenefits.map((benefit, index) => (
                              <div key={index} className="text-sm p-2 bg-blue-50 rounded">
                                {benefit}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-green-700 mb-2">Industry-Specific</div>
                          <div className="space-y-1">
                            {person.personalizationElements.valueProposition.industrySpecific.map((specific, index) => (
                              <div key={index} className="text-sm p-2 bg-green-50 rounded">
                                {specific}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Relevant Case Studies */}
                    <div>
                      <h4 className="font-medium mb-3">AI-Selected Relevant Case Studies</h4>
                      {person.personalizationElements.caseStudies.relevantCases.map((caseStudy, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-medium">{caseStudy.customerName}</div>
                              <div className="text-sm text-gray-600">{caseStudy.industry}</div>
                            </div>
                            <Badge variant="outline">
                              {caseStudy.relevanceScore}% match
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm font-medium text-orange-700 mb-1">Similar Challenges</div>
                              {caseStudy.similarChallenges.map((challenge, cIndex) => (
                                <div key={cIndex} className="text-xs text-orange-600 mb-1">• {challenge}</div>
                              ))}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-green-700 mb-1">Achieved Results</div>
                              {caseStudy.achievedResults.map((result, rIndex) => (
                                <div key={rIndex} className="text-xs text-green-600 mb-1">• {result}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pricing Strategy */}
                    <div>
                      <h4 className="font-medium mb-3">AI-Recommended Pricing Strategy</h4>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="mb-2">
                          <strong>Approach:</strong> {person.personalizationElements.pricingStrategy.recommendedApproach}
                        </div>
                        <div className="mb-2">
                          <strong>Position:</strong> {person.personalizationElements.pricingStrategy.competitivePosition}
                        </div>
                        <div>
                          <strong>Justification Points:</strong>
                          <div className="mt-1 space-y-1">
                            {person.personalizationElements.pricingStrategy.justificationPoints.map((point, index) => (
                              <div key={index} className="text-sm">• {point}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button size="sm">
                        <Wand2 className="h-4 w-4 mr-2" />
                        Apply Personalization
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit3 className="h-4 w-4 mr-2" />
                        Customize Further
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        Preview Proposal
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
            icon={Wand2}
            label="Proposal Intelligence"
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-2xl"
            onClick={() => setActiveTab('ai-content')}
            data-testid="mobile-fab-proposal-intelligence"
          />
        </div>

        {/* Settings Dialog */}
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Proposal Intelligence Settings</DialogTitle>
              <DialogDescription>
                Configure AI-powered proposal generation and optimization preferences
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ai-content">AI Content Generation</Label>
                    <p className="text-sm text-gray-600">Enable AI-powered content creation and optimization</p>
                  </div>
                  <Switch 
                    id="ai-content"
                    checked={aiContentEnabled}
                    onCheckedChange={setAiContentEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dynamic-personalization">Dynamic Personalization</Label>
                    <p className="text-sm text-gray-600">Enable AI-driven content personalization based on customer profiles</p>
                  </div>
                  <Switch 
                    id="dynamic-personalization"
                    checked={dynamicPersonalizationEnabled}
                    onCheckedChange={setDynamicPersonalizationEnabled}
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