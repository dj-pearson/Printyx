import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Network,
  Zap,
  CheckCircle,
  AlertTriangle,
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  Eye,
  Settings,
  RefreshCw,
  Plus,
  Search,
  Filter,
  Link,
  Unlink,
  Server,
  Shield,
  Key,
  BarChart3,
  PieChart,
  LineChart,
  Gauge,
  Globe,
  Cpu,
  HardDrive,
  Wifi,
  Monitor,
  Code,
  FileText,
  MapPin,
  Target,
  Layers,
  GitBranch,
  Workflow,
  Timer,
  Play,
  Pause,
  Square,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  Users,
  Lock,
  Calendar,
  DollarSign,
  Package,
  ShoppingCart,
  CreditCard,
  Building,
  Factory,
  Truck,
  Wrench,
  Star,
  StarHalf,
  ExternalLink,
  Database,
  CloudLightning,
  Webhook,
  Code as Api,
  Smartphone,
  Mail,
  MessageSquare,
  BarChart,
  ShoppingBag,
  Briefcase,
  FileBarChart,
  Headphones,
  Video,
  Camera,
  Palette,
  Megaphone,
  Archive,
  Repeat,
  FastForward
} from 'lucide-react';
import { format } from 'date-fns';

interface IntegrationHubData {
  integrationOverview: {
    totalIntegrations: number;
    activeIntegrations: number;
    pendingIntegrations: number;
    failedIntegrations: number;
    integrationSuccessRate: number;
    apiCallsToday: number;
    dataTransferred: number;
    webhooksDelivered: number;
    integrationUptime: number;
    averageLatency: number;
    errorRate: number;
    rateLimitHits: number;
  };
  apiMarketplace: {
    availableAPIs: Array<{
      id: string;
      name: string;
      category: string;
      provider: string;
      version: string;
      status: string;
      popularity: number;
      integrations: number;
      ratingAverage: number;
      ratingCount: number;
      description: string;
      endpoints: number;
      authentication: string;
      pricing: string;
      documentation: string;
      capabilities: string[];
      lastUpdated: Date;
      supportLevel: string;
      setupComplexity: string;
    }>;
    categories: Array<{
      name: string;
      count: number;
      description: string;
    }>;
    featuredIntegrations: Array<{
      id: string;
      reason: string;
    }>;
  };
  activeIntegrations: Array<{
    id: string;
    apiId: string;
    name: string;
    status: string;
    configuredAt: Date;
    lastSync: Date;
    syncFrequency: string;
    recordsSynced: number;
    apiCallsToday: number;
    successRate: number;
    averageLatency: number;
    dataVolume: number;
    errorCount: number;
    configuration: Record<string, any>;
    dataMapping: Record<string, any>;
    webhooks: Array<{
      event: string;
      url: string;
      status: string;
      deliveryRate: number;
    }>;
    recentActivity: Array<{
      timestamp: Date;
      action: string;
      records: number;
      status: string;
    }>;
  }>;
  webhookManagement: {
    totalWebhooks: number;
    activeWebhooks: number;
    pausedWebhooks: number;
    failedWebhooks: number;
    deliverySuccessRate: number;
    averageDeliveryTime: number;
    retryAttempts: number;
    successfulRetries: number;
    recentDeliveries: Array<{
      id: string;
      webhook: string;
      url: string;
      timestamp: Date;
      status: string;
      responseCode: number;
      responseTime: number;
      attempts: number;
      payload: Record<string, any>;
      error?: string;
    }>;
    deliveryMetrics: {
      last24Hours: { delivered: number; failed: number; successRate: number };
      last7Days: { delivered: number; failed: number; successRate: number };
      last30Days: { delivered: number; failed: number; successRate: number };
    };
  };
  integrationAnalytics: {
    usageStatistics: {
      totalApiCalls: number;
      totalDataTransferred: number;
      totalWebhooksDelivered: number;
      averageResponseTime: number;
      peakUsageHour: string;
      topIntegrationByVolume: string;
      topIntegrationByUsage: string;
    };
    performanceMetrics: {
      responseTimePercentiles: {
        p50: number;
        p95: number;
        p99: number;
      };
      errorRateByCategory: Record<string, number>;
      uptimeByIntegration: Record<string, number>;
    };
    costAnalysis: {
      totalMonthlyCost: number;
      costByProvider: Record<string, number>;
      costPerApiCall: number;
      estimatedMonthlySavings: number;
    };
  };
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-green-100 text-green-800';
    case 'delivered': return 'bg-green-100 text-green-800';
    case 'success': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'configuring': return 'bg-yellow-100 text-yellow-800';
    case 'warning': return 'bg-yellow-100 text-yellow-800';
    case 'failed': return 'bg-red-100 text-red-800';
    case 'error': return 'bg-red-100 text-red-800';
    case 'paused': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'crm': return <Users className="h-5 w-5 text-blue-600" />;
    case 'marketing': return <Megaphone className="h-5 w-5 text-purple-600" />;
    case 'payments': return <CreditCard className="h-5 w-5 text-green-600" />;
    case 'accounting': return <DollarSign className="h-5 w-5 text-yellow-600" />;
    case 'communication': return <MessageSquare className="h-5 w-5 text-indigo-600" />;
    case 'analytics': return <BarChart className="h-5 w-5 text-orange-600" />;
    case 'e-commerce': return <ShoppingBag className="h-5 w-5 text-pink-600" />;
    case 'project management': return <Briefcase className="h-5 w-5 text-teal-600" />;
    case 'email marketing': return <Mail className="h-5 w-5 text-red-600" />;
    default: return <Package className="h-5 w-5 text-gray-600" />;
  }
};

const getProviderIcon = (provider: string) => {
  switch (provider.toLowerCase()) {
    case 'salesforce': return <Building className="h-6 w-6 text-blue-600" />;
    case 'stripe': return <CreditCard className="h-6 w-6 text-indigo-600" />;
    case 'hubspot': return <Megaphone className="h-6 w-6 text-orange-600" />;
    case 'intuit': return <DollarSign className="h-6 w-6 text-blue-600" />;
    case 'mailchimp': return <Mail className="h-6 w-6 text-yellow-600" />;
    case 'slack technologies': return <MessageSquare className="h-6 w-6 text-purple-600" />;
    default: return <Globe className="h-6 w-6 text-gray-600" />;
  }
};

const formatPercentage = (value: number | undefined) => {
  if (value === undefined || value === null) return '0.0%';
  return `${value.toFixed(1)}%`;
};

const formatNumber = (num: number | undefined) => {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const renderStarRating = (rating: number | undefined) => {
  if (rating === undefined || rating === null) rating = 0;
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  
  for (let i = 0; i < fullStars; i++) {
    stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />);
  }
  
  if (hasHalfStar) {
    stars.push(<StarHalf key="half" className="h-4 w-4 fill-yellow-400 text-yellow-400" />);
  }
  
  const remainingStars = 5 - Math.ceil(rating);
  for (let i = 0; i < remainingStars; i++) {
    stars.push(<Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />);
  }
  
  return <div className="flex items-center gap-1">{stars}</div>;
};

export default function IntegrationHub() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Fetch integration hub data
  const { data: integrationData, isLoading, refetch } = useQuery({
    queryKey: ['/api/integration-hub/dashboard'],
    select: (data: any) => {
      if (!data) return null;
      return {
        ...data,
        apiMarketplace: {
          ...data.apiMarketplace,
          availableAPIs: data.apiMarketplace?.availableAPIs?.map((api: any) => ({
            ...api,
            lastUpdated: api.lastUpdated ? new Date(api.lastUpdated) : new Date()
          })) || []
        },
        activeIntegrations: data.activeIntegrations?.map((integration: any) => ({
          ...integration,
          configuredAt: integration.configuredAt ? new Date(integration.configuredAt) : new Date(),
          lastSync: integration.lastSync ? new Date(integration.lastSync) : new Date(),
          recentActivity: integration.recentActivity?.map((activity: any) => ({
            ...activity,
            timestamp: activity.timestamp ? new Date(activity.timestamp) : new Date()
          })) || []
        })) || [],
        webhookManagement: {
          ...data.webhookManagement,
          recentDeliveries: data.webhookManagement?.recentDeliveries?.map((delivery: any) => ({
            ...delivery,
            timestamp: delivery.timestamp ? new Date(delivery.timestamp) : new Date()
          })) || []
        }
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading integration hub data...</p>
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
            <Network className="h-6 w-6 text-blue-600" />
            Advanced Integration Hub
          </h1>
          <p className="text-gray-600 mt-1">Comprehensive API marketplace, webhook management, and third-party service orchestration</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Monitor
          </Button>
          
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
        </div>
      </div>

      {integrationData && (
        <>
          {/* Integration Overview KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Integrations</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {integrationData.integrationOverview?.activeIntegrations || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Network className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    {formatPercentage(integrationData.integrationOverview?.integrationSuccessRate)} success rate
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">API Calls Today</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(integrationData.integrationOverview?.apiCallsToday)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Api className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Activity className="h-4 w-4 text-blue-600 mr-1" />
                  <span className="text-blue-600">
                    {integrationData.integrationOverview?.averageLatency || 0}ms avg latency
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Data Transferred</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {integrationData.integrationOverview?.dataTransferred || 0}GB
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Database className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Webhook className="h-4 w-4 text-purple-600 mr-1" />
                  <span className="text-purple-600">
                    {formatNumber(integrationData.integrationOverview?.webhooksDelivered)} webhooks
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">System Uptime</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(integrationData.integrationOverview?.integrationUptime)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Server className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-orange-600 mr-1" />
                  <span className="text-orange-600">
                    {formatPercentage(integrationData.integrationOverview?.errorRate)} error rate
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="marketplace" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="marketplace">API Marketplace</TabsTrigger>
              <TabsTrigger value="active">Active Integrations</TabsTrigger>
              <TabsTrigger value="webhooks">Webhook Management</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="transformations">Data Transformation</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="marketplace" className="space-y-6">
              {/* Search and Filter */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search APIs and integrations..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {integrationData.apiMarketplace.categories.map((category: any) => (
                          <SelectItem key={category.name} value={category.name.toLowerCase()}>
                            {category.name} ({category.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Categories Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Integration Categories</CardTitle>
                  <CardDescription>Browse integrations by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    {(integrationData.apiMarketplace?.categories || []).map((category: any, idx: number) => (
                      <div key={idx} className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        {getCategoryIcon(category.name)}
                        <div className="font-medium text-sm mt-2">{category.name}</div>
                        <div className="text-xs text-gray-500">{category.count} APIs</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Available APIs */}
              <Card>
                <CardHeader>
                  <CardTitle>Available APIs</CardTitle>
                  <CardDescription>Browse and configure third-party integrations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {(integrationData.apiMarketplace?.availableAPIs || []).map((api: any, idx: number) => (
                      <div key={idx} className="p-6 border rounded-lg hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {getProviderIcon(api.provider)}
                            <div>
                              <h3 className="font-semibold text-lg">{api.name}</h3>
                              <div className="text-sm text-gray-600">{api.provider} • v{api.version}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className={getStatusColor(api.status)}>
                              {api.status}
                            </Badge>
                            <div className="text-xs text-gray-500">{formatNumber(api.integrations)} users</div>
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-4">{api.description}</p>
                        
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            {renderStarRating(api.ratingAverage)}
                            <span className="text-sm text-gray-600">
                              {api.ratingAverage} ({api.ratingCount} reviews)
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Popularity:</span>
                            <span className="ml-1 font-medium">{formatPercentage(api.popularity)}</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <span className="text-gray-600">Endpoints:</span>
                            <span className="ml-2 font-medium">{api.endpoints}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Auth:</span>
                            <span className="ml-2 font-medium">{api.authentication}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Pricing:</span>
                            <span className="ml-2 font-medium capitalize">{api.pricing}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Complexity:</span>
                            <span className="ml-2 font-medium capitalize">{api.setupComplexity}</span>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <div className="text-sm text-gray-600 mb-2">Capabilities:</div>
                          <div className="flex flex-wrap gap-1">
                            {(api.capabilities || []).slice(0, 3).map((capability: string, capIdx: number) => (
                              <Badge key={capIdx} variant="secondary" className="text-xs">
                                {capability.replace('_', ' ')}
                              </Badge>
                            ))}
                            {(api.capabilities || []).length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{(api.capabilities || []).length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center pt-4 border-t">
                          <div className="text-xs text-gray-500">
                            Updated: {format(api.lastUpdated, 'MMM dd, yyyy')}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Docs
                            </Button>
                            <Button size="sm">
                              <Plus className="h-4 w-4 mr-2" />
                              Configure
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="active" className="space-y-6">
              {/* Active Integrations */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(integrationData.activeIntegrations || []).map((integration: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{integration.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {integration.apiId} • Configured {format(integration.configuredAt, 'MMM dd, yyyy')}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge className={getStatusColor(integration.status)}>
                            {integration.status}
                          </Badge>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {formatPercentage(integration.successRate)}
                            </div>
                            <div className="text-xs text-gray-500">success rate</div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Integration Metrics */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Records Synced:</span>
                            <div className="font-medium">{formatNumber(integration.recordsSynced)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">API Calls Today:</span>
                            <div className="font-medium">{formatNumber(integration.apiCallsToday)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Data Volume:</span>
                            <div className="font-medium">{integration.dataVolume} GB</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Avg Latency:</span>
                            <div className="font-medium">{integration.averageLatency}ms</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Sync:</span>
                            <div className="font-medium">{format(integration.lastSync, 'MMM dd, HH:mm')}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Frequency:</span>
                            <div className="font-medium capitalize">{integration.syncFrequency}</div>
                          </div>
                        </div>

                        {/* Recent Activity */}
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Recent Activity:</div>
                          <div className="space-y-1">
                            {(integration.recentActivity || []).slice(0, 3).map((activity: any, actIdx: number) => (
                              <div key={actIdx} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${activity.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                  <span className="capitalize">{activity.action.replace('_', ' ')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span>{activity.records} records</span>
                                  <span className="text-gray-500">{format(activity.timestamp, 'HH:mm')}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Webhooks */}
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Active Webhooks:</div>
                          <div className="space-y-1">
                            {(integration.webhooks || []).slice(0, 2).map((webhook: any, webhookIdx: number) => (
                              <div key={webhookIdx} className="flex items-center justify-between text-xs p-2 border rounded">
                                <span className="capitalize">{webhook.event.replace('.', ' ')}</span>
                                <div className="flex items-center gap-2">
                                  <Badge className={`${getStatusColor(webhook.status)} text-xs`}>
                                    {webhook.status}
                                  </Badge>
                                  <span>{formatPercentage(webhook.deliveryRate)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t">
                          <div className="text-xs text-gray-500">
                            {integration.errorCount} errors today
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button size="sm">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="webhooks" className="space-y-6">
              {/* Webhook Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5 text-purple-600" />
                    Webhook Management Overview
                  </CardTitle>
                  <CardDescription>Monitor webhook delivery performance and manage configurations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-blue-900">
                        {integrationData.webhookManagement?.totalWebhooks || 0}
                      </div>
                      <div className="text-sm text-gray-600">Total Webhooks</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-green-900">
                        {integrationData.webhookManagement?.activeWebhooks || 0}
                      </div>
                      <div className="text-sm text-gray-600">Active</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-yellow-900">
                        {integrationData.webhookManagement?.pausedWebhooks || 0}
                      </div>
                      <div className="text-sm text-gray-600">Paused</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-red-900">
                        {integrationData.webhookManagement?.failedWebhooks || 0}
                      </div>
                      <div className="text-sm text-gray-600">Failed</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-purple-900">
                        {formatPercentage(integrationData.webhookManagement?.deliverySuccessRate)}
                      </div>
                      <div className="text-sm text-gray-600">Success Rate</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-indigo-900">
                        {integrationData.webhookManagement?.averageDeliveryTime || 0}ms
                      </div>
                      <div className="text-sm text-gray-600">Avg Delivery</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-orange-900">
                        {integrationData.webhookManagement?.retryAttempts || 0}
                      </div>
                      <div className="text-sm text-gray-600">Retry Attempts</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-teal-900">
                        {integrationData.webhookManagement?.successfulRetries || 0}
                      </div>
                      <div className="text-sm text-gray-600">Successful Retries</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Performance</CardTitle>
                  <CardDescription>Webhook delivery statistics over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-900">
                        {formatNumber(integrationData.webhookManagement?.deliveryMetrics?.last24Hours?.delivered)}
                      </div>
                      <div className="text-sm text-gray-600">Last 24 Hours</div>
                      <div className="text-xs text-green-600 mt-1">
                        {formatPercentage(integrationData.webhookManagement?.deliveryMetrics?.last24Hours?.successRate)} success
                      </div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-900">
                        {formatNumber(integrationData.webhookManagement?.deliveryMetrics?.last7Days?.delivered)}
                      </div>
                      <div className="text-sm text-gray-600">Last 7 Days</div>
                      <div className="text-xs text-blue-600 mt-1">
                        {formatPercentage(integrationData.webhookManagement?.deliveryMetrics?.last7Days?.successRate)} success
                      </div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-purple-900">
                        {formatNumber(integrationData.webhookManagement?.deliveryMetrics?.last30Days?.delivered)}
                      </div>
                      <div className="text-sm text-gray-600">Last 30 Days</div>
                      <div className="text-xs text-purple-600 mt-1">
                        {formatPercentage(integrationData.webhookManagement?.deliveryMetrics?.last30Days?.successRate)} success
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Deliveries */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Webhook Deliveries</CardTitle>
                  <CardDescription>Latest webhook delivery attempts and their status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(integrationData.webhookManagement?.recentDeliveries || []).map((delivery: any, idx: number) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium">{delivery.webhook}</div>
                            <div className="text-sm text-gray-600">{delivery.url}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(delivery.status)}>
                              {delivery.status}
                            </Badge>
                            <div className="text-right">
                              <div className="text-sm font-bold">{delivery.responseCode}</div>
                              <div className="text-xs text-gray-500">{delivery.responseTime}ms</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Timestamp:</span>
                            <span className="ml-2">{format(delivery.timestamp, 'MMM dd, HH:mm:ss')}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Attempts:</span>
                            <span className="ml-2 font-medium">{delivery.attempts}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Payload Size:</span>
                            <span className="ml-2">
                              {JSON.stringify(delivery.payload).length} bytes
                            </span>
                          </div>
                        </div>
                        
                        {delivery.error && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            Error: {delivery.error}
                          </div>
                        )}
                        
                        <div className="flex justify-end gap-2 mt-3">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            View Payload
                          </Button>
                          {delivery.status === 'failed' && (
                            <Button size="sm">
                              <Repeat className="h-4 w-4 mr-2" />
                              Retry
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {/* Usage Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Integration Analytics
                  </CardTitle>
                  <CardDescription>Performance metrics and usage statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-900">
                        {formatNumber(integrationData.integrationAnalytics?.usageStatistics?.totalApiCalls)}
                      </div>
                      <div className="text-sm text-gray-600">Total API Calls</div>
                      <div className="text-xs text-blue-600 mt-1">All time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-900">
                        {integrationData.integrationAnalytics?.usageStatistics?.totalDataTransferred || 0}GB
                      </div>
                      <div className="text-sm text-gray-600">Data Transferred</div>
                      <div className="text-xs text-green-600 mt-1">This month</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-900">
                        {formatNumber(integrationData.integrationAnalytics?.usageStatistics?.totalWebhooksDelivered)}
                      </div>
                      <div className="text-sm text-gray-600">Webhooks Delivered</div>
                      <div className="text-xs text-purple-600 mt-1">This month</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-900">
                        {integrationData.integrationAnalytics?.usageStatistics?.averageResponseTime || 0}ms
                      </div>
                      <div className="text-sm text-gray-600">Avg Response Time</div>
                      <div className="text-xs text-orange-600 mt-1">Last 7 days</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-medium mb-3">Top Integration by Volume</h3>
                      <div className="p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="font-medium text-blue-900">
                          {integrationData.integrationAnalytics?.usageStatistics?.topIntegrationByVolume || 'None'}
                        </div>
                        <div className="text-sm text-blue-600">Highest data throughput</div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium mb-3">Most Used Integration</h3>
                      <div className="p-3 bg-green-50 rounded border border-green-200">
                        <div className="font-medium text-green-900">
                          {integrationData.integrationAnalytics?.usageStatistics?.topIntegrationByUsage || 'None'}
                        </div>
                        <div className="text-sm text-green-600">Most API calls</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Cost Analysis
                  </CardTitle>
                  <CardDescription>Integration costs and savings analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-center mb-4">
                        <div className="text-3xl font-bold text-red-900">
                          {formatCurrency(integrationData.integrationAnalytics?.costAnalysis?.totalMonthlyCost)}
                        </div>
                        <div className="text-sm text-gray-600">Total Monthly Cost</div>
                      </div>
                      
                      <div className="space-y-2">
                        {Object.entries(integrationData.integrationAnalytics?.costAnalysis?.costByProvider || {}).map(([provider, cost]: any) => (
                          <div key={provider} className="flex justify-between items-center p-2 border rounded">
                            <span className="font-medium">{provider}</span>
                            <span>{formatCurrency(cost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-center mb-4">
                        <div className="text-3xl font-bold text-green-900">
                          {formatCurrency(integrationData.integrationAnalytics?.costAnalysis?.estimatedMonthlySavings)}
                        </div>
                        <div className="text-sm text-gray-600">Monthly Savings</div>
                        <div className="text-xs text-green-600">From automation</div>
                      </div>
                      
                      <div className="p-4 bg-green-50 border border-green-200 rounded">
                        <div className="text-sm text-green-700">
                          <div className="font-medium">Cost per API call: {formatCurrency(integrationData.integrationAnalytics?.costAnalysis?.costPerApiCall)}</div>
                          <div className="mt-2 text-xs">
                            Based on current usage patterns and provider pricing
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transformations" className="space-y-6">
              <div className="text-center py-12">
                <Code className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Transformation Engine</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Advanced field mapping, data validation, and business rule configuration
                </p>
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Transformations
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <div className="text-center py-12">
                <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Security & Compliance</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Authentication management, encryption settings, and compliance monitoring
                </p>
                <Button>
                  <Lock className="h-4 w-4 mr-2" />
                  Security Settings
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}