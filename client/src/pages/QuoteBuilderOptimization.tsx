import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { 
  FileText, TrendingUp, AlertTriangle, DollarSign, Clock, Package,
  CheckCircle, Star, Trophy, Activity, BarChart3, Lightbulb, Settings,
  Filter, Eye, Calendar, Users, Brain, Zap, Target, Calculator,
  ArrowUp, ArrowDown, Shield, Award, Globe, Building, Phone, Mail,
  PieChart, Percent, LineChart, Smartphone, MonitorSpeaker, Printer,
  Sparkles, MessageSquare, ThumbsUp, Edit, Send, Download, Copy
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
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { format, subDays, addDays } from "date-fns";
import { MobileFAB } from "@/components/ui/mobile-fab";
import ContextualHelp from "@/components/contextual/ContextualHelp";
import PageAlerts from "@/components/contextual/PageAlerts";

// Types
interface QuoteAnalytics {
  totalQuotes: number;
  activeQuotes: number;
  averageQuoteValue: number;
  winRate: number;
  averageResponseTime: number;
  conversionRate: number;
  totalQuoteValue: number;
  pendingFollowUps: number;
}

interface QuoteIntelligence {
  id: string;
  type: 'pricing_optimization' | 'product_recommendation' | 'timing_insight' | 'competitive_intel' | 'customer_behavior';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  confidence: number;
  potentialImpact: string;
  winRateIncrease: number;
  actionRequired: boolean;
  timeframe: string;
  category: string;
  priority: number;
}

interface DynamicPricing {
  productId: string;
  productName: string;
  basePrice: number;
  recommendedPrice: number;
  priceAdjustment: number;
  adjustmentReason: string;
  marketPosition: 'premium' | 'competitive' | 'value';
  demandFactor: number;
  competitorPricing: {
    competitor: string;
    price: number;
    marketShare: number;
  }[];
  seasonalFactor: number;
  inventoryFactor: number;
  customerSegmentFactor: number;
  confidence: number;
  expectedWinRate: number;
}

interface SmartRecommendations {
  customerId: string;
  customerName: string;
  customerSegment: 'enterprise' | 'mid_market' | 'small_business';
  recommendedProducts: {
    productId: string;
    productName: string;
    category: string;
    reason: string;
    priority: number;
    expectedRevenue: number;
    crossSellProbability: number;
  }[];
  bundleOpportunities: {
    bundleName: string;
    products: string[];
    bundleDiscount: number;
    valueProposition: string;
    winRateBoost: number;
  }[];
  financingOptions: {
    optionName: string;
    monthlyPayment: number;
    term: number;
    interestRate: number;
    acceptanceProbability: number;
  }[];
  customizationSuggestions: string[];
  competitiveAdvantages: string[];
}

interface QuotePerformance {
  quoteId: string;
  customerName: string;
  quoteValue: number;
  createdDate: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  viewCount: number;
  timeSpentViewing: number; // minutes
  lastActivityDate: string;
  winProbability: number;
  competitiveThreat: 'low' | 'medium' | 'high';
  nextBestAction: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  customerEngagement: number;
  followUpRecommendation: string;
  riskFactors: string[];
  opportunityFactors: string[];
}

interface QuoteOptimizer {
  originalQuote: {
    totalValue: number;
    products: string[];
    customerSegment: string;
    winRate: number;
  };
  optimizedQuote: {
    totalValue: number;
    products: string[];
    bundleDiscounts: number;
    financingOptions: string[];
    winRate: number;
  };
  improvements: {
    category: string;
    description: string;
    impact: string;
    winRateIncrease: number;
  }[];
  marketIntelligence: {
    competitorComparison: string;
    marketTrends: string;
    seasonalFactors: string;
  };
  riskAssessment: {
    priceRisk: string;
    competitionRisk: string;
    customerRisk: string;
  };
}

export default function QuoteBuilderOptimization() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("this_quarter");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("win_probability");
  const [viewMode, setViewMode] = useState<string>("ai_insights");
  const [aiOptimizationEnabled, setAiOptimizationEnabled] = useState(true);
  const [dynamicPricingEnabled, setDynamicPricingEnabled] = useState(true);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuotePerformance | null>(null);

  const queryClient = useQueryClient();

  // Mock data - in real implementation, these would come from APIs
  const mockAnalytics: QuoteAnalytics = {
    totalQuotes: 156,
    activeQuotes: 34,
    averageQuoteValue: 18750,
    winRate: 32.8,
    averageResponseTime: 2.4,
    conversionRate: 28.5,
    totalQuoteValue: 2925000,
    pendingFollowUps: 8
  };

  const mockIntelligence: QuoteIntelligence[] = [
    {
      id: "intel-001",
      type: 'pricing_optimization',
      severity: 'high',
      title: "Pricing Opportunity Identified",
      description: "Analysis shows 15% pricing adjustment could increase win rate by 22% for enterprise quotes",
      recommendation: "Apply dynamic pricing algorithm to enterprise quotes over $25K",
      confidence: 89,
      potentialImpact: "Additional $180K revenue potential",
      winRateIncrease: 22,
      actionRequired: true,
      timeframe: "This week",
      category: "Pricing",
      priority: 1
    },
    {
      id: "intel-002",
      type: 'timing_insight',
      severity: 'medium',
      title: "Optimal Quote Timing Analysis",
      description: "Quotes sent Tuesday-Thursday show 18% better response rates than Monday/Friday",
      recommendation: "Schedule quote delivery for Tuesday-Thursday between 10 AM - 2 PM",
      confidence: 84,
      potentialImpact: "18% improvement in response rates",
      winRateIncrease: 12,
      actionRequired: true,
      timeframe: "Immediate",
      category: "Timing",
      priority: 2
    },
    {
      id: "intel-003",
      type: 'product_recommendation',
      severity: 'high',
      title: "Bundle Opportunity Detection",
      description: "Customers purchasing color printers show 67% likelihood of needing service contracts",
      recommendation: "Auto-include service contract options in color printer quotes",
      confidence: 91,
      potentialImpact: "28% increase in average deal value",
      winRateIncrease: 15,
      actionRequired: true,
      timeframe: "Next week",
      category: "Products",
      priority: 1
    },
    {
      id: "intel-004",
      type: 'competitive_intel',
      severity: 'critical',
      title: "Competitive Pricing Alert",
      description: "Competitor reduced pricing 12% on Canon models - adjust strategy needed",
      recommendation: "Emphasize service quality and total cost of ownership advantages",
      confidence: 87,
      potentialImpact: "Maintain competitive positioning",
      winRateIncrease: 8,
      actionRequired: true,
      timeframe: "Immediate",
      category: "Competition",
      priority: 1
    }
  ];

  const mockDynamicPricing: DynamicPricing[] = [
    {
      productId: "prod-001",
      productName: "Canon imageRUNNER ADVANCE C5560i",
      basePrice: 18500,
      recommendedPrice: 17950,
      priceAdjustment: -550,
      adjustmentReason: "High competition + strong demand",
      marketPosition: 'competitive',
      demandFactor: 1.15,
      competitorPricing: [
        { competitor: "Xerox WorkCentre 7970", price: 17800, marketShare: 0.25 },
        { competitor: "HP LaserJet E82560", price: 18200, marketShare: 0.30 },
        { competitor: "Ricoh IM C6000", price: 17650, marketShare: 0.20 }
      ],
      seasonalFactor: 1.08,
      inventoryFactor: 0.95,
      customerSegmentFactor: 1.12,
      confidence: 88,
      expectedWinRate: 42
    },
    {
      productId: "prod-002",
      productName: "HP LaserJet Enterprise MFP M635h",
      basePrice: 12800,
      recommendedPrice: 13450,
      priceAdjustment: 650,
      adjustmentReason: "Low competition + premium features",
      marketPosition: 'premium',
      demandFactor: 1.32,
      competitorPricing: [
        { competitor: "Canon imageRUNNER 2630i", price: 12200, marketShare: 0.28 },
        { competitor: "Xerox VersaLink C7020", price: 13100, marketShare: 0.22 }
      ],
      seasonalFactor: 1.05,
      inventoryFactor: 1.10,
      customerSegmentFactor: 1.18,
      confidence: 92,
      expectedWinRate: 58
    }
  ];

  const mockQuotePerformance: QuotePerformance[] = [
    {
      quoteId: "quote-001",
      customerName: "Acme Corporation",
      quoteValue: 45600,
      createdDate: "2024-08-08",
      status: 'viewed',
      viewCount: 3,
      timeSpentViewing: 12,
      lastActivityDate: "2024-08-12",
      winProbability: 78,
      competitiveThreat: 'medium',
      nextBestAction: "Schedule product demonstration",
      urgency: 'high',
      customerEngagement: 85,
      followUpRecommendation: "Call within 24 hours - high engagement detected",
      riskFactors: ["Budget approval pending", "Competitor evaluation ongoing"],
      opportunityFactors: ["Strong technical fit", "Existing relationship", "Urgent replacement need"]
    },
    {
      quoteId: "quote-002",
      customerName: "TechStart Solutions",
      quoteValue: 28900,
      createdDate: "2024-08-10",
      status: 'sent',
      viewCount: 0,
      timeSpentViewing: 0,
      lastActivityDate: "2024-08-10",
      winProbability: 35,
      competitiveThreat: 'low',
      nextBestAction: "Follow up on quote delivery",
      urgency: 'medium',
      customerEngagement: 45,
      followUpRecommendation: "Email follow-up in 3 days if no response",
      riskFactors: ["No response to quote", "Limited budget information"],
      opportunityFactors: ["Growing company", "Technology forward", "Quick decision making"]
    },
    {
      quoteId: "quote-003",
      customerName: "Regional Medical Center",
      quoteValue: 67800,
      createdDate: "2024-08-05",
      status: 'viewed',
      viewCount: 7,
      timeSpentViewing: 25,
      lastActivityDate: "2024-08-13",
      winProbability: 92,
      competitiveThreat: 'low',
      nextBestAction: "Send contract for signature",
      urgency: 'critical',
      customerEngagement: 95,
      followUpRecommendation: "Immediate follow-up - ready to close",
      riskFactors: ["Large organization approval process"],
      opportunityFactors: ["High engagement", "Budget approved", "Technical requirements match perfectly"]
    }
  ];

  const mockSmartRecommendations: SmartRecommendations[] = [
    {
      customerId: "cust-001",
      customerName: "Acme Corporation",
      customerSegment: 'enterprise',
      recommendedProducts: [
        {
          productId: "prod-003",
          productName: "Canon Service Contract - Premium",
          category: "Service",
          reason: "87% of similar customers purchase service contracts",
          priority: 1,
          expectedRevenue: 8400,
          crossSellProbability: 0.87
        },
        {
          productId: "prod-004",
          productName: "HP Security Bundle",
          category: "Security",
          reason: "Enterprise customers prioritize document security",
          priority: 2,
          expectedRevenue: 3200,
          crossSellProbability: 0.64
        }
      ],
      bundleOpportunities: [
        {
          bundleName: "Complete Office Solution",
          products: ["Canon imageRUNNER", "Service Contract", "Security Package"],
          bundleDiscount: 8,
          valueProposition: "Complete managed solution with 24/7 support",
          winRateBoost: 25
        }
      ],
      financingOptions: [
        {
          optionName: "60-Month Lease",
          monthlyPayment: 825,
          term: 60,
          interestRate: 4.2,
          acceptanceProbability: 0.78
        },
        {
          optionName: "36-Month Purchase Plan",
          monthlyPayment: 1350,
          term: 36,
          interestRate: 3.8,
          acceptanceProbability: 0.65
        }
      ],
      customizationSuggestions: [
        "Add department-specific scan workflows",
        "Include mobile printing capabilities",
        "Configure advanced security settings"
      ],
      competitiveAdvantages: [
        "Best-in-class service response time",
        "Advanced security features",
        "Energy efficiency savings"
      ]
    }
  ];

  const filteredQuotes = mockQuotePerformance.filter(quote => {
    return selectedCategory === "all" || quote.status === selectedCategory;
  });

  const sortedQuotes = [...filteredQuotes].sort((a, b) => {
    switch (sortBy) {
      case 'win_probability':
        return b.winProbability - a.winProbability;
      case 'quote_value':
        return b.quoteValue - a.quoteValue;
      case 'engagement':
        return b.customerEngagement - a.customerEngagement;
      case 'created_date':
        return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
      default:
        return 0;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'viewed': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getThreatColor = (threat: string) => {
    switch (threat) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
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

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Quote Intelligence</h1>
            <p className="text-gray-600 mt-1">Dynamic pricing optimization and intelligent quote building</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsSettingsDialogOpen(true)}
              data-testid="button-quote-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Badge variant="outline" className="px-3 py-2">
              <Brain className="h-4 w-4 mr-2" />
              AI Optimization: {aiOptimizationEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        {/* Contextual Help */}
        <ContextualHelp page="quote-builder-optimization" />

        {/* Page Alerts */}
        <PageAlerts 
          alerts={mockIntelligence.filter(intel => intel.actionRequired && intel.severity === 'critical').map(intel => ({
            id: intel.id,
            type: 'error',
            title: intel.title,
            message: intel.description,
            action: {
              label: "Optimize Now",
              onClick: () => console.log(`Optimizing ${intel.id}`)
            }
          }))}
        />

        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="metric-win-rate">
                {mockAnalytics.winRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                +5.2% from last quarter
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Quote Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="metric-avg-value">
                ${(mockAnalytics.averageQuoteValue / 1000).toFixed(0)}K
              </div>
              <p className="text-xs text-muted-foreground">
                +12% with AI optimization
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
                {mockAnalytics.averageResponseTime}h
              </div>
              <p className="text-xs text-muted-foreground">
                Target: &lt;4 hours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Quotes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="metric-active-quotes">
                {mockAnalytics.activeQuotes}
              </div>
              <p className="text-xs text-muted-foreground">
                {mockAnalytics.pendingFollowUps} need follow-up
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">AI Overview</TabsTrigger>
            <TabsTrigger value="intelligence">Quote Intelligence</TabsTrigger>
            <TabsTrigger value="pricing">Dynamic Pricing</TabsTrigger>
            <TabsTrigger value="performance">Quote Performance</TabsTrigger>
            <TabsTrigger value="recommendations">Smart Recommendations</TabsTrigger>
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
                                +{intel.winRateIncrease}% win rate
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
                        <span className="text-sm">Win Rate Optimization</span>
                        <span className="text-sm font-medium text-green-600">{mockAnalytics.winRate}% (+5.2%)</span>
                      </div>
                      <Progress value={mockAnalytics.winRate} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Response Rate</span>
                        <span className="text-sm font-medium text-blue-600">85.4%</span>
                      </div>
                      <Progress value={85.4} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Customer Engagement</span>
                        <span className="text-sm font-medium">78.2%</span>
                      </div>
                      <Progress value={78.2} className="h-2" />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Total Quote Value</span>
                        <span className="font-bold text-blue-600">${(mockAnalytics.totalQuoteValue / 1000000).toFixed(1)}M</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Conversion Rate</span>
                        <span className="font-medium">{mockAnalytics.conversionRate}%</span>
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
                      <Calculator className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Optimize Pricing</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      Apply dynamic pricing to 12 quotes
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Follow Up Alerts</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      8 quotes need immediate follow-up
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Package className="h-5 w-5 text-purple-600" />
                      <span className="font-medium">Bundle Opportunities</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      15 cross-sell opportunities identified
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
                            +{intel.winRateIncrease}% win rate
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{intel.potentialImpact}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>⏱ {intel.timeframe}</span>
                          <span>📦 {intel.category}</span>
                          <span>🎯 Priority {intel.priority}</span>
                        </div>
                        {intel.actionRequired && (
                          <div className="flex gap-2">
                            <Button size="sm">Apply</Button>
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

          <TabsContent value="pricing" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {mockDynamicPricing.map((pricing, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-green-600" />
                      {pricing.productName}
                    </CardTitle>
                    <CardDescription>
                      Market Position: {pricing.marketPosition} • Confidence: {pricing.confidence}%
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Pricing Summary */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-gray-50 rounded">
                          <p className="text-sm text-gray-600">Base Price</p>
                          <p className="text-lg font-bold">${pricing.basePrice.toLocaleString()}</p>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded">
                          <p className="text-sm text-blue-600">AI Recommended</p>
                          <p className="text-lg font-bold text-blue-800">${pricing.recommendedPrice.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Price Adjustment */}
                      <div className={`p-3 rounded-lg ${
                        pricing.priceAdjustment > 0 ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        <div className="flex items-center gap-2">
                          {pricing.priceAdjustment > 0 ? (
                            <ArrowUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={`font-medium ${
                            pricing.priceAdjustment > 0 ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {pricing.priceAdjustment > 0 ? '+' : ''}${pricing.priceAdjustment}
                          </span>
                        </div>
                        <p className="text-sm mt-1 opacity-90">{pricing.adjustmentReason}</p>
                      </div>

                      {/* Competitor Analysis */}
                      <div>
                        <h4 className="font-medium mb-3">Competitor Pricing</h4>
                        <div className="space-y-2">
                          {pricing.competitorPricing.map((comp, cIndex) => (
                            <div key={cIndex} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{comp.competitor}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">${comp.price.toLocaleString()}</span>
                                <Badge variant="outline" className="text-xs">
                                  {(comp.marketShare * 100).toFixed(0)}% share
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Factors */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Demand Factor:</span>
                          <span className="ml-2 font-medium">{pricing.demandFactor}x</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Expected Win Rate:</span>
                          <span className="ml-2 font-medium text-green-600">{pricing.expectedWinRate}%</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1">
                          Apply Pricing
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="win_probability">Sort by Win Probability</SelectItem>
                  <SelectItem value="quote_value">Sort by Value</SelectItem>
                  <SelectItem value="engagement">Sort by Engagement</SelectItem>
                  <SelectItem value="created_date">Sort by Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quote Performance Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {sortedQuotes.map((quote) => (
                <Card key={quote.quoteId} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{quote.customerName}</CardTitle>
                        <CardDescription>
                          ${quote.quoteValue.toLocaleString()} • {format(new Date(quote.createdDate), 'MMM dd, yyyy')}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={getStatusColor(quote.status)}>
                          {quote.status}
                        </Badge>
                        <Badge className={getUrgencyColor(quote.urgency)}>
                          {quote.urgency}
                        </Badge>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            {quote.winProbability}%
                          </div>
                          <div className="text-xs text-gray-500">Win Probability</div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Engagement Metrics */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <p className="text-sm font-medium text-blue-800">{quote.viewCount}</p>
                          <p className="text-xs text-blue-600">Views</p>
                        </div>
                        <div className="text-center p-2 bg-green-50 rounded">
                          <p className="text-sm font-medium text-green-800">{quote.timeSpentViewing}m</p>
                          <p className="text-xs text-green-600">Time Spent</p>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <p className="text-sm font-medium text-purple-800">{quote.customerEngagement}%</p>
                          <p className="text-xs text-purple-600">Engagement</p>
                        </div>
                      </div>

                      {/* AI Recommendation */}
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium text-yellow-800">Next Best Action</span>
                        </div>
                        <p className="text-sm text-yellow-700">{quote.nextBestAction}</p>
                      </div>

                      {/* Opportunity & Risk Factors */}
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <div className="text-sm font-medium mb-1 text-green-700">Opportunity Factors</div>
                          <div className="space-y-1">
                            {quote.opportunityFactors.slice(0, 2).map((factor, index) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-green-700">{factor}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {quote.riskFactors.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-1 text-orange-700">Risk Factors</div>
                            <div className="space-y-1">
                              {quote.riskFactors.slice(0, 2).map((risk, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                                  <span className="text-orange-700">{risk}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Eye className="h-4 w-4 mr-2" />
                          View Quote
                        </Button>
                        <Button size="sm" className="flex-1">
                          <Send className="h-4 w-4 mr-2" />
                          Follow Up
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            {mockSmartRecommendations.map((rec, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    Smart Recommendations: {rec.customerName}
                  </CardTitle>
                  <CardDescription>
                    Customer Segment: {rec.customerSegment} • AI-powered cross-sell and upsell opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Product Recommendations */}
                    <div>
                      <h4 className="font-medium mb-3">Recommended Products</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {rec.recommendedProducts.map((product, pIndex) => (
                          <div key={pIndex} className="p-3 border rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium">{product.productName}</div>
                                <div className="text-sm text-gray-600 mt-1">{product.reason}</div>
                                <div className="text-sm font-medium text-green-600 mt-2">
                                  ${product.expectedRevenue.toLocaleString()} potential
                                </div>
                              </div>
                              <Badge variant="outline">
                                {(product.crossSellProbability * 100).toFixed(0)}% likely
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bundle Opportunities */}
                    <div>
                      <h4 className="font-medium mb-3">Bundle Opportunities</h4>
                      <div className="space-y-3">
                        {rec.bundleOpportunities.map((bundle, bIndex) => (
                          <div key={bIndex} className="p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-blue-800">{bundle.bundleName}</div>
                                <div className="text-sm text-blue-700 mt-1">{bundle.valueProposition}</div>
                                <div className="flex items-center gap-4 mt-2 text-sm">
                                  <span className="text-blue-600">
                                    {bundle.bundleDiscount}% bundle discount
                                  </span>
                                  <span className="text-green-600">
                                    +{bundle.winRateBoost}% win rate boost
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financing Options */}
                    <div>
                      <h4 className="font-medium mb-3">Financing Options</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {rec.financingOptions.map((option, fIndex) => (
                          <div key={fIndex} className="p-3 border rounded-lg">
                            <div className="font-medium">{option.optionName}</div>
                            <div className="text-lg font-bold text-green-600 mt-1">
                              ${option.monthlyPayment}/month
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {option.term} months • {option.interestRate}% APR
                            </div>
                            <Badge className="mt-2 bg-green-100 text-green-800">
                              {(option.acceptanceProbability * 100).toFixed(0)}% acceptance rate
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Competitive Advantages */}
                    <div>
                      <h4 className="font-medium mb-3">Competitive Advantages to Highlight</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {rec.competitiveAdvantages.map((advantage, aIndex) => (
                          <div key={aIndex} className="flex items-center gap-2 p-2 bg-green-50 rounded text-sm">
                            <Star className="h-4 w-4 text-green-600" />
                            <span className="text-green-700">{advantage}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Quote
                      </Button>
                      <Button size="sm" variant="outline">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Recommendations
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
              <DialogTitle>AI Quote Intelligence Settings</DialogTitle>
              <DialogDescription>
                Configure AI-powered quote optimization and dynamic pricing preferences
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ai-optimization">AI Quote Optimization</Label>
                    <p className="text-sm text-gray-600">Enable AI-powered quote recommendations and win rate optimization</p>
                  </div>
                  <Switch 
                    id="ai-optimization"
                    checked={aiOptimizationEnabled}
                    onCheckedChange={setAiOptimizationEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dynamic-pricing">Dynamic Pricing Engine</Label>
                    <p className="text-sm text-gray-600">Enable machine learning-based pricing optimization and market intelligence</p>
                  </div>
                  <Switch 
                    id="dynamic-pricing"
                    checked={dynamicPricingEnabled}
                    onCheckedChange={setDynamicPricingEnabled}
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