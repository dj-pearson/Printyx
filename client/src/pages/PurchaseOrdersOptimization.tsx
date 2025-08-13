import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { 
  ShoppingCart, TrendingUp, AlertTriangle, DollarSign, Clock, Package,
  CheckCircle, Star, Trophy, Activity, BarChart3, Lightbulb, Settings,
  Filter, Eye, Calendar, Users, Brain, Zap, FileText, Target, Truck,
  ArrowUp, ArrowDown, Shield, Award, Globe, Building, Phone, Mail
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
interface ProcurementAnalytics {
  totalSpend: number;
  activeOrders: number;
  averageOrderValue: number;
  onTimeDeliveryRate: number;
  costSavings: number;
  vendorCompliance: number;
  inventoryTurnover: number;
  emergencyOrders: number;
}

interface VendorPerformance {
  vendorId: string;
  vendorName: string;
  totalSpend: number;
  orderCount: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
  complianceScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  costEfficiency: number;
  responseTime: number; // hours
  lastOrderDate: string;
  recommendedActions: string[];
  strengths: string[];
  improvementAreas: string[];
  contractStatus: 'active' | 'expiring' | 'expired' | 'negotiating';
  paymentTerms: string;
  relationship: 'strategic' | 'preferred' | 'standard' | 'probation';
}

interface ProcurementIntelligence {
  id: string;
  type: 'cost_optimization' | 'risk_alert' | 'supplier_recommendation' | 'market_insight' | 'compliance_issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  confidence: number;
  potentialSavings: number;
  riskImpact: string;
  actionRequired: boolean;
  timeframe: string;
  category: string;
  affectedVendors: string[];
  priority: number;
}

interface SmartProcurement {
  productCategory: string;
  recommendedVendor: string;
  alternativeVendors: string[];
  priceComparison: {
    vendor: string;
    price: number;
    deliveryTime: number;
    qualityScore: number;
    totalScore: number;
  }[];
  marketTrends: {
    trend: string;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }[];
  optimalOrderQuantity: number;
  bestOrderTiming: string;
  seasonalFactors: string[];
  riskFactors: string[];
  complianceRequirements: string[];
}

interface PredictiveInventory {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand: number;
  reorderPoint: number;
  optimalOrderQuantity: number;
  leadTime: number;
  stockoutRisk: number;
  carryingCost: number;
  recommendedAction: 'order_now' | 'order_soon' | 'monitor' | 'reduce_stock';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  daysUntilStockout: number;
  seasonalAdjustment: number;
  confidenceLevel: number;
}

interface ComplianceTracking {
  vendorId: string;
  vendorName: string;
  complianceAreas: {
    area: string;
    status: 'compliant' | 'warning' | 'non_compliant';
    lastAudit: string;
    nextDue: string;
    requirements: string[];
    gaps: string[];
  }[];
  overallScore: number;
  certifications: {
    name: string;
    status: 'valid' | 'expiring' | 'expired';
    expiryDate: string;
  }[];
  auditHistory: {
    date: string;
    score: number;
    findings: string[];
  }[];
}

export default function PurchaseOrdersOptimization() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("this_quarter");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("performance_score");
  const [viewMode, setViewMode] = useState<string>("smart_insights");
  const [aiOptimizationEnabled, setAiOptimizationEnabled] = useState(true);
  const [predictiveEnabled, setPredictiveEnabled] = useState(true);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // Mock data - in real implementation, these would come from APIs
  const mockAnalytics: ProcurementAnalytics = {
    totalSpend: 847500,
    activeOrders: 23,
    averageOrderValue: 12350,
    onTimeDeliveryRate: 94.2,
    costSavings: 68400,
    vendorCompliance: 87.5,
    inventoryTurnover: 8.4,
    emergencyOrders: 3
  };

  const mockVendorPerformance: VendorPerformance[] = [
    {
      vendorId: "vendor-001",
      vendorName: "TechSupply Solutions",
      totalSpend: 245800,
      orderCount: 47,
      onTimeDeliveryRate: 96.8,
      qualityScore: 94,
      complianceScore: 92,
      riskLevel: 'low',
      performanceGrade: 'A',
      costEfficiency: 88,
      responseTime: 2.4,
      lastOrderDate: "2024-08-10",
      recommendedActions: [
        "Negotiate volume discount for Q4 orders",
        "Extend contract term for better pricing",
        "Consider strategic partnership status"
      ],
      strengths: [
        "Excellent delivery performance",
        "High quality standards",
        "Responsive customer service",
        "Competitive pricing on bulk orders"
      ],
      improvementAreas: [
        "Minor packaging optimization needed",
        "Could improve order confirmation speed"
      ],
      contractStatus: 'active',
      paymentTerms: "Net 30",
      relationship: 'strategic'
    },
    {
      vendorId: "vendor-002",
      vendorName: "Global Parts Network",
      totalSpend: 156200,
      orderCount: 31,
      onTimeDeliveryRate: 78.4,
      qualityScore: 85,
      complianceScore: 71,
      riskLevel: 'high',
      performanceGrade: 'C',
      costEfficiency: 65,
      responseTime: 8.2,
      lastOrderDate: "2024-08-05",
      recommendedActions: [
        "Performance improvement plan required",
        "Alternative vendor evaluation needed",
        "Renegotiate delivery terms"
      ],
      strengths: [
        "Wide product selection",
        "Competitive base pricing",
        "Good product availability"
      ],
      improvementAreas: [
        "Poor delivery performance",
        "Compliance documentation gaps",
        "Slow response to issues",
        "Quality consistency problems"
      ],
      contractStatus: 'expiring',
      paymentTerms: "Net 45",
      relationship: 'probation'
    },
    {
      vendorId: "vendor-003",
      vendorName: "Precision Components Inc",
      totalSpend: 198600,
      orderCount: 28,
      onTimeDeliveryRate: 91.2,
      qualityScore: 96,
      complianceScore: 89,
      riskLevel: 'low',
      performanceGrade: 'A',
      costEfficiency: 82,
      responseTime: 3.1,
      lastOrderDate: "2024-08-12",
      recommendedActions: [
        "Increase order volume for better rates",
        "Explore new product categories",
        "Consider exclusive supplier arrangement"
      ],
      strengths: [
        "Exceptional quality standards",
        "Reliable delivery",
        "Technical expertise",
        "Innovation partnership potential"
      ],
      improvementAreas: [
        "Premium pricing on some items",
        "Limited geographic coverage"
      ],
      contractStatus: 'active',
      paymentTerms: "Net 30",
      relationship: 'preferred'
    }
  ];

  const mockIntelligence: ProcurementIntelligence[] = [
    {
      id: "intel-001",
      type: 'cost_optimization',
      severity: 'high',
      title: "Bulk Purchasing Opportunity Identified",
      description: "Analysis shows 23% cost savings potential on toner cartridges with Q4 bulk order",
      recommendation: "Place consolidated order for Q4 toner requirements with TechSupply Solutions",
      confidence: 91,
      potentialSavings: 18400,
      riskImpact: "Low risk - established vendor with excellent performance",
      actionRequired: true,
      timeframe: "This week",
      category: "Consumables",
      affectedVendors: ["TechSupply Solutions"],
      priority: 1
    },
    {
      id: "intel-002",
      type: 'risk_alert',
      severity: 'critical',
      title: "Vendor Performance Deterioration",
      description: "Global Parts Network showing 22% decline in on-time delivery over 3 months",
      recommendation: "Initiate vendor improvement plan or begin transition to alternative supplier",
      confidence: 87,
      potentialSavings: -12000,
      riskImpact: "High risk of service disruption and customer impact",
      actionRequired: true,
      timeframe: "Immediate",
      category: "Parts",
      affectedVendors: ["Global Parts Network"],
      priority: 1
    },
    {
      id: "intel-003",
      type: 'market_insight',
      severity: 'medium',
      title: "Market Price Fluctuation Alert",
      description: "Semiconductor prices trending up 8% - consider forward purchasing",
      recommendation: "Secure Q1 2025 pricing with current vendors before anticipated increase",
      confidence: 76,
      potentialSavings: 5600,
      riskImpact: "Moderate risk of increased costs if delayed",
      actionRequired: true,
      timeframe: "Next 2 weeks",
      category: "Electronics",
      affectedVendors: ["TechSupply Solutions", "Precision Components Inc"],
      priority: 3
    },
    {
      id: "intel-004",
      type: 'supplier_recommendation',
      severity: 'medium',
      title: "New Vendor Qualification Opportunity",
      description: "Regional supplier showing excellent performance metrics and 12% cost advantage",
      recommendation: "Initiate pilot program with Regional Tech Solutions for non-critical items",
      confidence: 82,
      potentialSavings: 9200,
      riskImpact: "Low risk with pilot approach",
      actionRequired: false,
      timeframe: "Next month",
      category: "Accessories",
      affectedVendors: ["Regional Tech Solutions"],
      priority: 4
    }
  ];

  const mockSmartProcurement: SmartProcurement[] = [
    {
      productCategory: "Toner Cartridges",
      recommendedVendor: "TechSupply Solutions",
      alternativeVendors: ["Global Parts Network", "Office Supply Co"],
      priceComparison: [
        { vendor: "TechSupply Solutions", price: 89.50, deliveryTime: 2, qualityScore: 94, totalScore: 92 },
        { vendor: "Global Parts Network", price: 84.20, deliveryTime: 5, qualityScore: 85, totalScore: 78 },
        { vendor: "Office Supply Co", price: 92.10, deliveryTime: 3, qualityScore: 88, totalScore: 84 }
      ],
      marketTrends: [
        { trend: "Raw material costs stable", impact: 'neutral', description: "Toner material costs unchanged for 6 months" },
        { trend: "Demand increasing", impact: 'negative', description: "15% increase in market demand may affect pricing" }
      ],
      optimalOrderQuantity: 240,
      bestOrderTiming: "Early November for Q4/Q1 coverage",
      seasonalFactors: ["Q4 typically higher demand", "Q1 budget refreshes drive volume"],
      riskFactors: ["Single-source dependency", "Price volatility in Q4"],
      complianceRequirements: ["Environmental disposal certification", "Quality assurance documentation"]
    }
  ];

  const mockPredictiveInventory: PredictiveInventory[] = [
    {
      productId: "prod-001",
      productName: "HP LaserJet Toner - Black",
      currentStock: 45,
      predictedDemand: 38,
      reorderPoint: 25,
      optimalOrderQuantity: 120,
      leadTime: 3,
      stockoutRisk: 15,
      carryingCost: 2.40,
      recommendedAction: 'monitor',
      urgency: 'low',
      daysUntilStockout: 42,
      seasonalAdjustment: 1.12,
      confidenceLevel: 87
    },
    {
      productId: "prod-002",
      productName: "Canon Drum Unit",
      currentStock: 8,
      predictedDemand: 12,
      reorderPoint: 15,
      optimalOrderQuantity: 50,
      leadTime: 5,
      stockoutRisk: 78,
      carryingCost: 8.50,
      recommendedAction: 'order_now',
      urgency: 'critical',
      daysUntilStockout: 18,
      seasonalAdjustment: 0.95,
      confidenceLevel: 92
    },
    {
      productId: "prod-003",
      productName: "Xerox Fuser Assembly",
      currentStock: 12,
      predictedDemand: 8,
      reorderPoint: 10,
      optimalOrderQuantity: 25,
      leadTime: 7,
      stockoutRisk: 32,
      carryingCost: 15.20,
      recommendedAction: 'order_soon',
      urgency: 'medium',
      daysUntilStockout: 28,
      seasonalAdjustment: 1.05,
      confidenceLevel: 84
    }
  ];

  const mockCompliance: ComplianceTracking[] = [
    {
      vendorId: "vendor-001",
      vendorName: "TechSupply Solutions",
      complianceAreas: [
        {
          area: "Quality Management",
          status: 'compliant',
          lastAudit: "2024-06-15",
          nextDue: "2024-12-15",
          requirements: ["ISO 9001 certification", "Quality control procedures", "Product testing protocols"],
          gaps: []
        },
        {
          area: "Environmental Standards",
          status: 'compliant',
          lastAudit: "2024-07-20",
          nextDue: "2025-01-20",
          requirements: ["ISO 14001 certification", "Waste management plan", "Carbon footprint reporting"],
          gaps: []
        }
      ],
      overallScore: 94,
      certifications: [
        { name: "ISO 9001", status: 'valid', expiryDate: "2025-03-15" },
        { name: "ISO 14001", status: 'valid', expiryDate: "2025-05-22" }
      ],
      auditHistory: [
        { date: "2024-06-15", score: 94, findings: ["Minor documentation update needed"] },
        { date: "2023-12-10", score: 92, findings: ["Excellent compliance", "Process improvements noted"] }
      ]
    }
  ];

  const filteredVendors = mockVendorPerformance.filter(vendor => {
    return selectedCategory === "all" || vendor.vendorName.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  const sortedVendors = [...filteredVendors].sort((a, b) => {
    switch (sortBy) {
      case 'performance_score':
        return b.qualityScore - a.qualityScore;
      case 'spend':
        return b.totalSpend - a.totalSpend;
      case 'delivery':
        return b.onTimeDeliveryRate - a.onTimeDeliveryRate;
      case 'compliance':
        return b.complianceScore - a.complianceScore;
      default:
        return 0;
    }
  });

  const getPerformanceColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600';
      case 'B': return 'text-blue-600';
      case 'C': return 'text-yellow-600';
      case 'D': return 'text-orange-600';
      case 'F': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
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

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRelationshipColor = (relationship: string) => {
    switch (relationship) {
      case 'strategic': return 'bg-purple-100 text-purple-800';
      case 'preferred': return 'bg-blue-100 text-blue-800';
      case 'standard': return 'bg-gray-100 text-gray-800';
      case 'probation': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Smart Procurement Intelligence</h1>
            <p className="text-gray-600 mt-1">AI-powered purchasing optimization and vendor management</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsSettingsDialogOpen(true)}
              data-testid="button-procurement-settings"
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
        <ContextualHelp page="purchase-orders-optimization" />

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
              <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="metric-total-spend">
                ${(mockAnalytics.totalSpend / 1000).toFixed(0)}K
              </div>
              <p className="text-xs text-muted-foreground">
                This quarter
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="metric-delivery-rate">
                {mockAnalytics.onTimeDeliveryRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                Above 90% target
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="metric-cost-savings">
                ${(mockAnalytics.costSavings / 1000).toFixed(0)}K
              </div>
              <p className="text-xs text-muted-foreground">
                Through optimization
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendor Compliance</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="metric-compliance">
                {mockAnalytics.vendorCompliance}%
              </div>
              <p className="text-xs text-muted-foreground">
                87% target met
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">AI Overview</TabsTrigger>
            <TabsTrigger value="vendors">Vendor Performance</TabsTrigger>
            <TabsTrigger value="intelligence">Smart Procurement</TabsTrigger>
            <TabsTrigger value="inventory">Predictive Inventory</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Intelligence Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    Procurement Intelligence
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
                                ${intel.potentialSavings.toLocaleString()} savings
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

              {/* Procurement Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Procurement Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Cost Efficiency</span>
                        <span className="text-sm font-medium text-green-600">92% Excellent</span>
                      </div>
                      <Progress value={92} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Vendor Compliance</span>
                        <span className="text-sm font-medium text-blue-600">{mockAnalytics.vendorCompliance}%</span>
                      </div>
                      <Progress value={mockAnalytics.vendorCompliance} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Inventory Turnover</span>
                        <span className="text-sm font-medium">{mockAnalytics.inventoryTurnover}x</span>
                      </div>
                      <Progress value={(mockAnalytics.inventoryTurnover / 12) * 100} className="h-2" />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Active Orders</span>
                        <span className="font-bold text-blue-600">{mockAnalytics.activeOrders}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Avg Order Value</span>
                        <span className="font-medium">${mockAnalytics.averageOrderValue.toLocaleString()}</span>
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
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span className="font-medium">Address Vendor Issues</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      1 vendor requires immediate attention
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Optimize Spending</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      $18K savings opportunity identified
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Package className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Review Inventory</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      3 items need immediate reordering
                    </p>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="tech">Technology</SelectItem>
                  <SelectItem value="parts">Parts</SelectItem>
                  <SelectItem value="supplies">Supplies</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="performance_score">Sort by Performance</SelectItem>
                  <SelectItem value="spend">Sort by Spend</SelectItem>
                  <SelectItem value="delivery">Sort by Delivery</SelectItem>
                  <SelectItem value="compliance">Sort by Compliance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Vendor Performance Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {sortedVendors.map((vendor) => (
                <Card key={vendor.vendorId} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{vendor.vendorName}</CardTitle>
                        <CardDescription>
                          ${(vendor.totalSpend / 1000).toFixed(0)}K spend • {vendor.orderCount} orders
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={getRiskLevelColor(vendor.riskLevel)}>
                          {vendor.riskLevel} risk
                        </Badge>
                        <Badge className={getRelationshipColor(vendor.relationship)}>
                          {vendor.relationship}
                        </Badge>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getPerformanceColor(vendor.performanceGrade)}`}>
                            {vendor.performanceGrade}
                          </div>
                          <div className="text-xs text-gray-500">Performance</div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <p className="text-sm font-medium text-blue-800">{vendor.onTimeDeliveryRate}%</p>
                          <p className="text-xs text-blue-600">On-Time</p>
                        </div>
                        <div className="text-center p-2 bg-green-50 rounded">
                          <p className="text-sm font-medium text-green-800">{vendor.qualityScore}</p>
                          <p className="text-xs text-green-600">Quality</p>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <p className="text-sm font-medium text-purple-800">{vendor.complianceScore}%</p>
                          <p className="text-xs text-purple-600">Compliance</p>
                        </div>
                      </div>

                      {/* AI Recommendations */}
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium text-yellow-800">AI Recommendation</span>
                        </div>
                        <p className="text-sm text-yellow-700">
                          {vendor.recommendedActions[0]}
                        </p>
                      </div>

                      {/* Strengths and Areas for Improvement */}
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <div className="text-sm font-medium mb-1 text-green-700">Key Strengths</div>
                          <div className="space-y-1">
                            {vendor.strengths.slice(0, 2).map((strength, index) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-green-700">{strength}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {vendor.improvementAreas.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-1 text-orange-700">Improvement Areas</div>
                            <div className="space-y-1">
                              {vendor.improvementAreas.slice(0, 2).map((area, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                                  <span className="text-orange-700">{area}</span>
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
                          Details
                        </Button>
                        <Button size="sm" className="flex-1">
                          <Phone className="h-4 w-4 mr-2" />
                          Contact
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                          <h4 className="font-medium mb-2">Financial Impact</h4>
                          <p className="text-lg font-bold text-green-600">
                            {intel.potentialSavings > 0 ? '+' : ''}${intel.potentialSavings.toLocaleString()} savings
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{intel.riskImpact}</p>
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
                            <Button size="sm">Execute</Button>
                            <Button size="sm" variant="outline">Schedule</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Smart Procurement Recommendations */}
            {mockSmartProcurement.map((procurement, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    Smart Procurement: {procurement.productCategory}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Vendor Comparison */}
                    <div>
                      <h4 className="font-medium mb-3">Vendor Comparison</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {procurement.priceComparison.map((vendor, vIndex) => (
                          <div key={vIndex} className={`p-3 border rounded-lg ${
                            vIndex === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                          }`}>
                            <div className="font-medium">{vendor.vendor}</div>
                            <div className="text-lg font-bold text-green-600">${vendor.price}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              {vendor.deliveryTime} days • Score: {vendor.totalScore}
                            </div>
                            {vIndex === 0 && (
                              <Badge className="mt-2 bg-blue-100 text-blue-800">Recommended</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Market Insights */}
                    <div>
                      <h4 className="font-medium mb-3">Market Insights</h4>
                      <div className="space-y-2">
                        {procurement.marketTrends.map((trend, tIndex) => (
                          <div key={tIndex} className="flex items-center gap-2 text-sm">
                            <div className={`w-2 h-2 rounded-full ${
                              trend.impact === 'positive' ? 'bg-green-500' :
                              trend.impact === 'negative' ? 'bg-red-500' : 'bg-gray-500'
                            }`} />
                            <span className="font-medium">{trend.trend}:</span>
                            <span className="text-gray-600">{trend.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Procurement Recommendation */}
                    <div className="p-3 bg-green-50 rounded-lg">
                      <h4 className="font-medium mb-2 text-green-800">AI Recommendation</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-green-700">Optimal Quantity:</span>
                          <span className="font-medium ml-2">{procurement.optimalOrderQuantity} units</span>
                        </div>
                        <div>
                          <span className="text-green-700">Best Timing:</span>
                          <span className="font-medium ml-2">{procurement.bestOrderTiming}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {mockPredictiveInventory.map((item) => (
                <Card key={item.productId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{item.productName}</CardTitle>
                        <CardDescription>
                          {item.currentStock} units in stock
                        </CardDescription>
                      </div>
                      <Badge className={getUrgencyColor(item.urgency)}>
                        {item.urgency}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Predicted Demand:</span>
                          <div className="font-medium">{item.predictedDemand} units</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Reorder Point:</span>
                          <div className="font-medium">{item.reorderPoint} units</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Lead Time:</span>
                          <div className="font-medium">{item.leadTime} days</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Stockout Risk:</span>
                          <div className="font-medium text-red-600">{item.stockoutRisk}%</div>
                        </div>
                      </div>

                      {/* Stock Level Indicator */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Stock Level</span>
                          <span>{item.daysUntilStockout} days until stockout</span>
                        </div>
                        <Progress 
                          value={(item.currentStock / (item.reorderPoint * 2)) * 100} 
                          className="h-2" 
                        />
                      </div>

                      {/* AI Recommendation */}
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Brain className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-800">AI Recommendation</span>
                        </div>
                        <p className="text-sm text-blue-700">
                          {item.recommendedAction === 'order_now' && 'Order immediately to avoid stockout'}
                          {item.recommendedAction === 'order_soon' && 'Schedule order within next week'}
                          {item.recommendedAction === 'monitor' && 'Continue monitoring - adequate stock'}
                          {item.recommendedAction === 'reduce_stock' && 'Consider reducing inventory levels'}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Suggested quantity: {item.optimalOrderQuantity} units
                        </p>
                      </div>

                      {/* Action Button */}
                      <Button 
                        size="sm" 
                        className="w-full"
                        variant={item.urgency === 'critical' ? 'default' : 'outline'}
                      >
                        {item.recommendedAction === 'order_now' && <ShoppingCart className="h-4 w-4 mr-2" />}
                        {item.recommendedAction === 'order_soon' && <Calendar className="h-4 w-4 mr-2" />}
                        {item.recommendedAction === 'monitor' && <Eye className="h-4 w-4 mr-2" />}
                        {item.recommendedAction === 'reduce_stock' && <ArrowDown className="h-4 w-4 mr-2" />}
                        
                        {item.recommendedAction === 'order_now' && 'Order Now'}
                        {item.recommendedAction === 'order_soon' && 'Schedule Order'}
                        {item.recommendedAction === 'monitor' && 'Monitor'}
                        {item.recommendedAction === 'reduce_stock' && 'Optimize Stock'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            {mockCompliance.map((compliance) => (
              <Card key={compliance.vendorId}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-green-600" />
                        {compliance.vendorName} - Compliance Status
                      </CardTitle>
                      <CardDescription>Overall compliance score: {compliance.overallScore}%</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      Compliant
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Compliance Areas */}
                    <div>
                      <h4 className="font-medium mb-3">Compliance Areas</h4>
                      <div className="space-y-3">
                        {compliance.complianceAreas.map((area, index) => (
                          <div key={index} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{area.area}</span>
                              <Badge className={
                                area.status === 'compliant' ? 'bg-green-100 text-green-800' :
                                area.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {area.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span>Last Audit:</span>
                                <span className="ml-2 font-medium">
                                  {format(new Date(area.lastAudit), 'MMM dd, yyyy')}
                                </span>
                              </div>
                              <div>
                                <span>Next Due:</span>
                                <span className="ml-2 font-medium">
                                  {format(new Date(area.nextDue), 'MMM dd, yyyy')}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Certifications */}
                    <div>
                      <h4 className="font-medium mb-3">Certifications</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {compliance.certifications.map((cert, index) => (
                          <div key={index} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{cert.name}</span>
                              <Badge className={
                                cert.status === 'valid' ? 'bg-green-100 text-green-800' :
                                cert.status === 'expiring' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {cert.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Expires: {format(new Date(cert.expiryDate), 'MMM dd, yyyy')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Audit History */}
                    <div>
                      <h4 className="font-medium mb-3">Recent Audit History</h4>
                      <div className="space-y-2">
                        {compliance.auditHistory.map((audit, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                            <div>
                              <div className="font-medium">
                                {format(new Date(audit.date), 'MMM dd, yyyy')}
                              </div>
                              <div className="text-sm text-gray-600">
                                {audit.findings.join(', ')}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-600">{audit.score}%</div>
                              <div className="text-xs text-gray-500">Score</div>
                            </div>
                          </div>
                        ))}
                      </div>
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
            label="Smart Procurement"
            className="bg-green-600 hover:bg-green-700 text-white shadow-2xl"
            onClick={() => setActiveTab('intelligence')}
            data-testid="mobile-fab-smart-procurement"
          />
        </div>

        {/* Settings Dialog */}
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Smart Procurement Settings</DialogTitle>
              <DialogDescription>
                Configure AI-powered procurement optimization and vendor management preferences
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ai-optimization">AI Procurement Optimization</Label>
                    <p className="text-sm text-gray-600">Enable AI-powered cost optimization and vendor recommendations</p>
                  </div>
                  <Switch 
                    id="ai-optimization"
                    checked={aiOptimizationEnabled}
                    onCheckedChange={setAiOptimizationEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="predictive-inventory">Predictive Inventory Management</Label>
                    <p className="text-sm text-gray-600">Enable machine learning-based inventory optimization and demand forecasting</p>
                  </div>
                  <Switch 
                    id="predictive-inventory"
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