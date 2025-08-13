import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { 
  Search, Package, TrendingUp, DollarSign, Eye, BarChart3,
  Zap, AlertTriangle, CheckCircle, Settings, Filter, Star,
  Target, Activity, ShoppingCart, Lightbulb, Calendar,
  ArrowUpDown, ArrowUp, ArrowDown, Brain, Clock
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
interface ProductMarketData {
  id: string;
  productName: string;
  manufacturer: string;
  modelCode: string;
  category: string;
  currentPrice: number;
  competitorPrices: {
    companyName: string;
    price: number;
    lastUpdated: string;
    availability: 'in_stock' | 'low_stock' | 'out_of_stock';
  }[];
  marketTrend: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
  };
  demandScore: number;
  profitMargin: number;
  salesVelocity: number;
  inventoryLevel: number;
  recommendedPrice: number;
  priceOptimizationOpportunity: number;
  competitiveRanking: number; // 1-5 where 1 is most competitive
  lifecycle: 'new' | 'growth' | 'mature' | 'decline' | 'end_of_life';
}

interface ProductAnalytics {
  totalProducts: number;
  averageMargin: number;
  competitiveProducts: number;
  pricingOpportunities: number;
  inventoryTurnover: number;
  revenueOptimization: number;
  marketTrendScore: number;
  demandForecast: number;
}

interface MarketIntelligence {
  id: string;
  productId: string;
  insightType: 'pricing' | 'competition' | 'demand' | 'lifecycle' | 'opportunity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  potentialImpact: string;
  implementationPriority: number; // 1-5
  estimatedValue: number;
  actionRequired: boolean;
}

interface PricingRecommendation {
  productId: string;
  currentPrice: number;
  recommendedPrice: number;
  confidence: number;
  reasoning: string[];
  expectedImpact: {
    revenueChange: number;
    marginChange: number;
    salesVolumeChange: number;
  };
  competitiveAnalysis: {
    marketPosition: string;
    priceAdvantage: number;
    recommendations: string[];
  };
}

export default function ProductCatalogOptimization() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("demand");
  const [searchTerm, setSearchTerm] = useState("");
  const [dynamicPricingEnabled, setDynamicPricingEnabled] = useState(true);
  const [competitorTrackingEnabled, setCompetitorTrackingEnabled] = useState(true);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // Mock data - in real implementation, these would come from APIs
  const mockAnalytics: ProductAnalytics = {
    totalProducts: 1247,
    averageMargin: 32.4, // percentage
    competitiveProducts: 89, // percentage
    pricingOpportunities: 23,
    inventoryTurnover: 4.7,
    revenueOptimization: 18.6, // percentage potential increase
    marketTrendScore: 7.8, // out of 10
    demandForecast: 12.3 // percentage growth predicted
  };

  const mockProductData: ProductMarketData[] = [
    {
      id: "prod-001",
      productName: "Canon imageRUNNER ADVANCE DX C3826i",
      manufacturer: "Canon",
      modelCode: "C3826i",
      category: "Color Copiers",
      currentPrice: 4299.00,
      competitorPrices: [
        { companyName: "Office Depot", price: 4499.00, lastUpdated: "2024-08-12", availability: 'in_stock' },
        { companyName: "Staples", price: 4399.00, lastUpdated: "2024-08-11", availability: 'low_stock' },
        { companyName: "Best Buy Business", price: 4599.00, lastUpdated: "2024-08-10", availability: 'in_stock' }
      ],
      marketTrend: { direction: 'up', percentage: 8.5, period: 'last_30_days' },
      demandScore: 87,
      profitMargin: 28.5,
      salesVelocity: 15, // units per month
      inventoryLevel: 12,
      recommendedPrice: 4399.00,
      priceOptimizationOpportunity: 6.2, // percentage increase potential
      competitiveRanking: 2,
      lifecycle: 'growth'
    },
    {
      id: "prod-002",
      productName: "HP LaserJet Enterprise M507dn",
      manufacturer: "HP",
      modelCode: "M507dn",
      category: "Laser Printers",
      currentPrice: 399.00,
      competitorPrices: [
        { companyName: "Amazon Business", price: 419.00, lastUpdated: "2024-08-12", availability: 'in_stock' },
        { companyName: "CDW", price: 429.00, lastUpdated: "2024-08-12", availability: 'in_stock' },
        { companyName: "Insight", price: 409.00, lastUpdated: "2024-08-11", availability: 'in_stock' }
      ],
      marketTrend: { direction: 'stable', percentage: 1.2, period: 'last_30_days' },
      demandScore: 92,
      profitMargin: 35.2,
      salesVelocity: 28,
      inventoryLevel: 45,
      recommendedPrice: 409.00,
      priceOptimizationOpportunity: 2.5,
      competitiveRanking: 1,
      lifecycle: 'mature'
    },
    {
      id: "prod-003",
      productName: "Xerox VersaLink C405/DN",
      manufacturer: "Xerox",
      modelCode: "C405DN",
      category: "Color Printers",
      currentPrice: 599.00,
      competitorPrices: [
        { companyName: "Office Max", price: 649.00, lastUpdated: "2024-08-11", availability: 'low_stock' },
        { companyName: "B&H Photo", price: 619.00, lastUpdated: "2024-08-10", availability: 'in_stock' },
        { companyName: "Newegg Business", price: 629.00, lastUpdated: "2024-08-12", availability: 'in_stock' }
      ],
      marketTrend: { direction: 'down', percentage: -4.3, period: 'last_30_days' },
      demandScore: 76,
      profitMargin: 25.8,
      salesVelocity: 8,
      inventoryLevel: 23,
      recommendedPrice: 579.00,
      priceOptimizationOpportunity: -3.3,
      competitiveRanking: 3,
      lifecycle: 'decline'
    }
  ];

  const mockIntelligence: MarketIntelligence[] = [
    {
      id: "intel-001",
      productId: "prod-001",
      insightType: 'pricing',
      severity: 'high',
      title: "Price Optimization Opportunity",
      description: "Canon C3826i is priced 2.3% below market average despite strong demand",
      recommendation: "Increase price to $4,399 to align with competitive positioning",
      potentialImpact: "Additional $24,000 monthly revenue with minimal volume impact",
      implementationPriority: 2,
      estimatedValue: 24000,
      actionRequired: true
    },
    {
      id: "intel-002",
      productId: "prod-002",
      insightType: 'competition',
      severity: 'medium',
      title: "Competitive Price Advantage",
      description: "HP M507dn maintains strong price leadership vs competitors",
      recommendation: "Maintain current pricing strategy, consider volume discounts",
      potentialImpact: "Sustained market leadership and customer retention",
      implementationPriority: 4,
      estimatedValue: 15000,
      actionRequired: false
    },
    {
      id: "intel-003",
      productId: "prod-003",
      insightType: 'lifecycle',
      severity: 'critical',
      title: "Product End-of-Life Alert",
      description: "Xerox C405DN showing declining demand and market price pressure",
      recommendation: "Implement clearance pricing strategy and promote replacement models",
      potentialImpact: "Reduce inventory carrying costs by $18,000",
      implementationPriority: 1,
      estimatedValue: 18000,
      actionRequired: true
    },
    {
      id: "intel-004",
      productId: "all",
      insightType: 'opportunity',
      severity: 'medium',
      title: "Market Trend Analysis",
      description: "Color copier demand increasing 15% quarter-over-quarter",
      recommendation: "Expand color copier inventory and promotional campaigns",
      potentialImpact: "Capture additional $45,000 in quarterly revenue",
      implementationPriority: 3,
      estimatedValue: 45000,
      actionRequired: true
    }
  ];

  const mockPricingRecommendations: PricingRecommendation[] = [
    {
      productId: "prod-001",
      currentPrice: 4299.00,
      recommendedPrice: 4399.00,
      confidence: 87,
      reasoning: [
        "Competitor prices average 4.7% higher",
        "Strong demand score of 87/100",
        "Low inventory suggests high velocity",
        "Growing market trend (+8.5%)"
      ],
      expectedImpact: {
        revenueChange: 6.2,
        marginChange: 2.3,
        salesVolumeChange: -1.8
      },
      competitiveAnalysis: {
        marketPosition: "Price Leader",
        priceAdvantage: -2.3,
        recommendations: [
          "Increase price to optimize revenue",
          "Monitor competitor response",
          "Consider value-add bundling"
        ]
      }
    }
  ];

  const filteredProducts = mockProductData.filter(product => {
    const matchesSearch = searchTerm === "" || 
      product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.modelCode.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const matchesManufacturer = selectedManufacturer === "all" || product.manufacturer === selectedManufacturer;
    
    return matchesSearch && matchesCategory && matchesManufacturer;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'demand':
        return b.demandScore - a.demandScore;
      case 'margin':
        return b.profitMargin - a.profitMargin;
      case 'opportunity':
        return b.priceOptimizationOpportunity - a.priceOptimizationOpportunity;
      case 'competition':
        return a.competitiveRanking - b.competitiveRanking;
      default:
        return 0;
    }
  });

  const getLifecycleColor = (lifecycle: string) => {
    switch (lifecycle) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'growth': return 'bg-green-100 text-green-800';
      case 'mature': return 'bg-yellow-100 text-yellow-800';
      case 'decline': return 'bg-orange-100 text-orange-800';
      case 'end_of_life': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <ArrowDown className="h-4 w-4 text-red-600" />;
      case 'stable': return <ArrowUpDown className="h-4 w-4 text-gray-600" />;
      default: return <ArrowUpDown className="h-4 w-4 text-gray-600" />;
    }
  };

  const getCompetitiveRankingColor = (ranking: number) => {
    if (ranking <= 2) return 'text-green-600';
    if (ranking <= 3) return 'text-yellow-600';
    return 'text-red-600';
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
            <h1 className="text-3xl font-bold text-gray-900">Product Catalog Intelligence</h1>
            <p className="text-gray-600 mt-1">AI-powered competitive analysis and dynamic pricing optimization</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsSettingsDialogOpen(true)}
              data-testid="button-catalog-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Badge variant="outline" className="px-3 py-2">
              <Brain className="h-4 w-4 mr-2" />
              AI Pricing: {dynamicPricingEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        {/* Contextual Help */}
        <ContextualHelp page="product-catalog-optimization" />

        {/* Page Alerts */}
        <PageAlerts 
          alerts={mockIntelligence.filter(intel => intel.actionRequired).map(intel => ({
            id: intel.id,
            type: intel.severity === 'critical' || intel.severity === 'high' ? 'error' : 'warning',
            title: intel.title,
            message: intel.description,
            action: {
              label: "View Recommendation",
              onClick: () => console.log(`Viewing recommendation for ${intel.id}`)
            }
          }))}
        />

        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-total-products">
                {mockAnalytics.totalProducts.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {mockAnalytics.competitiveProducts}% competitively priced
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Profit Margin</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="metric-avg-margin">
                {mockAnalytics.averageMargin}%
              </div>
              <p className="text-xs text-muted-foreground">
                8% above industry benchmark
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue Optimization</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="metric-revenue-optimization">
                {mockAnalytics.revenueOptimization}%
              </div>
              <p className="text-xs text-muted-foreground">
                Potential revenue increase available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Market Trend Score</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="metric-market-trend">
                {mockAnalytics.marketTrendScore}/10
              </div>
              <p className="text-xs text-muted-foreground">
                {mockAnalytics.demandForecast}% demand growth forecast
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Smart Catalog</TabsTrigger>
            <TabsTrigger value="pricing">AI Pricing</TabsTrigger>
            <TabsTrigger value="intelligence">Market Intel</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Market Intelligence Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    Market Intelligence Alerts
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
                            <p className="text-xs mt-2 font-medium">
                              Impact: {intel.potentialImpact}
                            </p>
                          </div>
                          {intel.actionRequired && (
                            <Button size="sm" variant="outline" className="ml-2">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Performance Dashboard */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-600" />
                    Performance Dashboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Pricing Optimization</span>
                        <span className="text-sm font-medium text-blue-600">
                          {mockAnalytics.pricingOpportunities} opportunities
                        </span>
                      </div>
                      <Progress value={78} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Competitive Position</span>
                        <span className="text-sm font-medium text-green-600">Strong</span>
                      </div>
                      <Progress value={89} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Inventory Turnover</span>
                        <span className="text-sm font-medium">{mockAnalytics.inventoryTurnover}x</span>
                      </div>
                      <Progress value={85} className="h-2" />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Revenue Opportunities</span>
                        <span className="font-bold text-green-600">
                          ${(mockAnalytics.revenueOptimization * 10000).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Market Trend Score</span>
                        <Badge variant="outline" className="text-blue-600">
                          {mockAnalytics.marketTrendScore}/10 Excellent
                        </Badge>
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
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Optimize Pricing</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      Apply AI recommendations to {mockAnalytics.pricingOpportunities} products
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Market Analysis</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      Generate competitive intelligence report
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Package className="h-5 w-5 text-purple-600" />
                      <span className="font-medium">Inventory Insights</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      Review demand forecasting and stock levels
                    </p>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Color Copiers">Color Copiers</SelectItem>
                  <SelectItem value="Laser Printers">Laser Printers</SelectItem>
                  <SelectItem value="Color Printers">Color Printers</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demand">Sort by Demand</SelectItem>
                  <SelectItem value="margin">Sort by Margin</SelectItem>
                  <SelectItem value="opportunity">Sort by Opportunity</SelectItem>
                  <SelectItem value="competition">Sort by Competition</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Smart Product Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedProducts.map((product) => (
                <Card key={product.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-2">{product.productName}</CardTitle>
                        <CardDescription>{product.manufacturer} • {product.modelCode}</CardDescription>
                      </div>
                      <Badge className={getLifecycleColor(product.lifecycle)}>
                        {product.lifecycle}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Price and Competition */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Current Price</span>
                          <span className="text-lg font-bold">${product.currentPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Recommended</span>
                          <span className={`text-sm font-medium ${
                            product.recommendedPrice > product.currentPrice ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${product.recommendedPrice.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Competitive Rank:</span>
                          <Badge 
                            variant="outline" 
                            className={getCompetitiveRankingColor(product.competitiveRanking)}
                          >
                            #{product.competitiveRanking}
                          </Badge>
                        </div>
                      </div>

                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <p className="text-sm font-medium text-blue-800">{product.demandScore}</p>
                          <p className="text-xs text-blue-600">Demand Score</p>
                        </div>
                        <div className="text-center p-2 bg-green-50 rounded">
                          <p className="text-sm font-medium text-green-800">{product.profitMargin}%</p>
                          <p className="text-xs text-green-600">Profit Margin</p>
                        </div>
                      </div>

                      {/* Market Trend */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(product.marketTrend.direction)}
                          <span className="text-sm">Market Trend</span>
                        </div>
                        <span className={`text-sm font-medium ${
                          product.marketTrend.direction === 'up' ? 'text-green-600' : 
                          product.marketTrend.direction === 'down' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {product.marketTrend.direction === 'up' ? '+' : product.marketTrend.direction === 'down' ? '' : ''}
                          {product.marketTrend.percentage}%
                        </span>
                      </div>

                      {/* Opportunity Indicator */}
                      {Math.abs(product.priceOptimizationOpportunity) > 2 && (
                        <div className={`p-2 rounded text-center ${
                          product.priceOptimizationOpportunity > 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                        }`}>
                          <p className="text-xs font-medium">
                            {product.priceOptimizationOpportunity > 0 ? 'Revenue Opportunity' : 'Price Adjustment'}
                          </p>
                          <p className="text-sm font-bold">
                            {product.priceOptimizationOpportunity > 0 ? '+' : ''}{product.priceOptimizationOpportunity.toFixed(1)}%
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                        <Button size="sm" className="flex-1">
                          <DollarSign className="h-4 w-4 mr-2" />
                          Optimize
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  AI Pricing Recommendations
                </CardTitle>
                <CardDescription>
                  Machine learning-powered pricing optimization based on market conditions and competitor analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockPricingRecommendations.map((rec) => {
                    const product = mockProductData.find(p => p.id === rec.productId);
                    if (!product) return null;
                    
                    return (
                      <div key={rec.productId} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-medium">{product.productName}</h3>
                            <p className="text-sm text-gray-600">{product.manufacturer} {product.modelCode}</p>
                          </div>
                          <Badge variant="outline" className="text-blue-600">
                            {rec.confidence}% Confidence
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="text-center p-3 bg-gray-50 rounded">
                            <p className="text-sm text-gray-600">Current Price</p>
                            <p className="text-lg font-bold">${rec.currentPrice.toLocaleString()}</p>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded">
                            <p className="text-sm text-blue-600">Recommended Price</p>
                            <p className="text-lg font-bold text-blue-800">${rec.recommendedPrice.toLocaleString()}</p>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded">
                            <p className="text-sm text-green-600">Revenue Impact</p>
                            <p className="text-lg font-bold text-green-800">+{rec.expectedImpact.revenueChange.toFixed(1)}%</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <h4 className="font-medium mb-2">AI Reasoning</h4>
                            <ul className="text-sm space-y-1">
                              {rec.reasoning.map((reason, index) => (
                                <li key={index} className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                            <div className="text-center">
                              <p className="text-sm text-gray-600">Revenue Change</p>
                              <p className="font-medium text-green-600">+{rec.expectedImpact.revenueChange.toFixed(1)}%</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-gray-600">Margin Change</p>
                              <p className="font-medium text-blue-600">+{rec.expectedImpact.marginChange.toFixed(1)}%</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-gray-600">Volume Impact</p>
                              <p className="font-medium text-orange-600">{rec.expectedImpact.salesVolumeChange.toFixed(1)}%</p>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button className="flex-1">Apply Recommendation</Button>
                            <Button variant="outline" className="flex-1">Schedule Review</Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                          <Activity className="h-5 w-5 text-blue-600" />
                          {intel.title}
                        </CardTitle>
                        <CardDescription>{intel.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(intel.severity)}>
                          {intel.severity}
                        </Badge>
                        <Badge variant="outline">
                          Priority {intel.implementationPriority}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Recommendation</h4>
                          <p className="text-sm text-gray-700">{intel.recommendation}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Potential Impact</h4>
                          <p className="text-sm text-gray-700">{intel.potentialImpact}</p>
                          <p className="text-lg font-bold text-green-600 mt-1">
                            ${intel.estimatedValue.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      {intel.actionRequired && (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button>Implement Now</Button>
                          <Button variant="outline">Schedule for Later</Button>
                          <Button variant="outline">Dismiss</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Market Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Market Performance Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">Demand Forecasting</h4>
                      <p className="text-sm text-blue-700 mb-3">
                        AI predicts {mockAnalytics.demandForecast}% demand growth across color copier category in next quarter.
                      </p>
                      <Progress value={78} className="h-2" />
                      <p className="text-xs text-blue-600 mt-2">Confidence: 78%</p>
                    </div>
                    
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-800 mb-2">Competitive Positioning</h4>
                      <p className="text-sm text-green-700 mb-3">
                        Your pricing strategy outperforms {mockAnalytics.competitiveProducts}% of tracked competitors.
                      </p>
                      <Progress value={89} className="h-2" />
                      <p className="text-xs text-green-600 mt-2">Market Leadership Score: 89%</p>
                    </div>

                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium text-purple-800 mb-2">Revenue Optimization</h4>
                      <p className="text-sm text-purple-700">
                        AI identified ${(mockAnalytics.revenueOptimization * 10000).toLocaleString()} in potential revenue opportunities through strategic pricing adjustments.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Category Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-600" />
                    Category Performance Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Color Copiers</span>
                        <span className="text-sm font-medium text-green-600">↑ 15% growth</span>
                      </div>
                      <Progress value={85} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Laser Printers</span>
                        <span className="text-sm font-medium text-blue-600">↑ 8% growth</span>
                      </div>
                      <Progress value={72} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Color Printers</span>
                        <span className="text-sm font-medium text-yellow-600">↓ 3% decline</span>
                      </div>
                      <Progress value={45} className="h-2" />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="font-medium">Key Insights</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span>Color copiers show strongest demand signal</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-blue-600" />
                          <span>Enterprise laser segment remains stable</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <span>Small office printers facing pressure</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Mobile Floating Action Button */}
        <div className="fixed bottom-6 right-6 z-50 md:hidden">
          <MobileFAB
            icon={Brain}
            label="AI Insights"
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-2xl"
            onClick={() => setActiveTab('intelligence')}
            data-testid="mobile-fab-ai-insights"
          />
        </div>

        {/* Settings Dialog */}
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Product Catalog Intelligence Settings</DialogTitle>
              <DialogDescription>
                Configure AI-powered pricing and competitive analysis preferences
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dynamic-pricing">Dynamic Pricing Engine</Label>
                    <p className="text-sm text-gray-600">Enable AI-powered automatic pricing adjustments</p>
                  </div>
                  <Switch 
                    id="dynamic-pricing"
                    checked={dynamicPricingEnabled}
                    onCheckedChange={setDynamicPricingEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="competitor-tracking">Competitor Tracking</Label>
                    <p className="text-sm text-gray-600">Monitor competitor prices and market conditions</p>
                  </div>
                  <Switch 
                    id="competitor-tracking"
                    checked={competitorTrackingEnabled}
                    onCheckedChange={setCompetitorTrackingEnabled}
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