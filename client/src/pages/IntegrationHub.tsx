import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Network, 
  Zap, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  Settings,
  Eye,
  PlayCircle,
  RefreshCw,
  Plus,
  Download,
  Upload,
  Share2,
  Database,
  Code,
  Globe,
  Webhook,
  Activity,
  BarChart3,
  Shield,
  Star,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Edit,
  Trash2,
  PauseCircle,
  Link
} from 'lucide-react';
import { format } from 'date-fns';

interface IntegrationHubData {
  integrationOverview: {
    totalIntegrations: number;
    activeIntegrations: number;
    pendingIntegrations: number;
    failedIntegrations: number;
    successRate: number;
    apiCallsToday: number;
    dataVolumeProcessed: number;
    uptimePercentage: number;
    averageResponseTime: number;
    errorRate: number;
    lastSyncTime: Date;
  };
  activeIntegrations: Array<{
    id: string;
    name: string;
    category: string;
    provider: string;
    status: string;
    health: string;
    version: string;
    lastSync: Date;
    syncFrequency: string;
    recordsSynced: number;
    errorCount: number;
    uptimePercentage: number;
    dataFlow: string;
    authStatus: string;
    authExpiresAt: Date;
    endpoints: Array<{
      name: string;
      status: string;
      lastCall: Date;
    }>;
    metrics: {
      apiCallsToday: number;
      successRate: number;
      avgResponseTime: number;
      bandwidth: number;
    };
  }>;
  apiMarketplace: {
    availableIntegrations: number;
    popularIntegrations: Array<{
      id: string;
      name: string;
      category: string;
      provider: string;
      description: string;
      rating: number;
      reviews: number;
      installations: number;
      pricing: string;
      features: string[];
      lastUpdated: Date;
      compatibility: string[];
      dataTypes: string[];
      estimatedSetupTime: number;
    }>;
    categories: Array<{
      name: string;
      count: number;
      popular: boolean;
    }>;
  };
  dataFlowManagement: {
    activeFlows: number;
    totalDataProcessed: number;
    transformationRules: number;
    mappingConfigurations: number;
    dataFlows: Array<{
      id: string;
      name: string;
      source: string;
      destination: string;
      status: string;
      frequency: string;
      recordsProcessed: number;
      lastRun: Date;
      successRate: number;
      avgProcessingTime: number;
      dataTypes: string[];
      transformations: string[];
      errorHandling: string;
      retentionPeriod: number;
    }>;
  };
  webhookManagement: {
    activeWebhooks: number;
    webhooksTriggered: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    deliverySuccessRate: number;
    averageDeliveryTime: number;
    webhooks: Array<{
      id: string;
      name: string;
      event: string;
      url: string;
      method: string;
      status: string;
      secret: string;
      retryPolicy: string;
      maxRetries: number;
      timeout: number;
      lastTriggered: Date;
      deliveryAttempts: number;
      successfulDeliveries: number;
      failedDeliveries: number;
      successRate: number;
      headers: Record<string, string>;
    }>;
  };
  healthMonitoring: {
    overallHealth: string;
    monitoringRules: number;
    alertsTriggered: number;
    issuesResolved: number;
    alerts: Array<{
      id: string;
      integration: string;
      severity: string;
      type: string;
      message: string;
      triggeredAt: Date;
      acknowledged: boolean;
      assignedTo: string;
      suggestedAction: string;
    }>;
    healthChecks: Array<{
      name: string;
      status: string;
      lastCheck: Date;
    }>;
  };
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-green-100 text-green-800';
    case 'healthy': return 'bg-green-100 text-green-800';
    case 'warning': return 'bg-yellow-100 text-yellow-800';
    case 'error': return 'bg-red-100 text-red-800';
    case 'pending': return 'bg-blue-100 text-blue-800';
    case 'failed': return 'bg-red-100 text-red-800';
    case 'passing': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getHealthIcon = (health: string) => {
  switch (health.toLowerCase()) {
    case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
    case 'passing': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    default: return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity.toLowerCase()) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

export default function IntegrationHub() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);

  // Fetch integration hub data
  const { data: hubData, isLoading, refetch } = useQuery({
    queryKey: ['/api/integration-hub/dashboard', selectedCategory, selectedProvider],
    select: (data: any) => ({
      ...data,
      integrationOverview: {
        ...data.integrationOverview,
        lastSyncTime: new Date(data.integrationOverview.lastSyncTime)
      },
      activeIntegrations: data.activeIntegrations?.map((integration: any) => ({
        ...integration,
        lastSync: new Date(integration.lastSync),
        authExpiresAt: new Date(integration.authExpiresAt),
        endpoints: integration.endpoints?.map((endpoint: any) => ({
          ...endpoint,
          lastCall: new Date(endpoint.lastCall)
        })) || []
      })) || [],
      apiMarketplace: {
        ...data.apiMarketplace,
        popularIntegrations: data.apiMarketplace?.popularIntegrations?.map((integration: any) => ({
          ...integration,
          lastUpdated: new Date(integration.lastUpdated)
        })) || []
      },
      dataFlowManagement: {
        ...data.dataFlowManagement,
        dataFlows: data.dataFlowManagement?.dataFlows?.map((flow: any) => ({
          ...flow,
          lastRun: new Date(flow.lastRun)
        })) || []
      },
      webhookManagement: {
        ...data.webhookManagement,
        webhooks: data.webhookManagement?.webhooks?.map((webhook: any) => ({
          ...webhook,
          lastTriggered: new Date(webhook.lastTriggered)
        })) || []
      },
      healthMonitoring: {
        ...data.healthMonitoring,
        alerts: data.healthMonitoring?.alerts?.map((alert: any) => ({
          ...alert,
          triggeredAt: new Date(alert.triggeredAt)
        })) || [],
        healthChecks: data.healthMonitoring?.healthChecks?.map((check: any) => ({
          ...check,
          lastCheck: new Date(check.lastCheck)
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading integration hub...</p>
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
          <p className="text-gray-600 mt-1">Manage APIs, integrations, and data flows across your business ecosystem</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="crm">CRM</SelectItem>
              <SelectItem value="accounting">Accounting</SelectItem>
              <SelectItem value="communication">Communication</SelectItem>
              <SelectItem value="document">Document</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Dialog open={showMarketplace} onOpenChange={setShowMarketplace}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Browse Marketplace
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl">
              <DialogHeader>
                <DialogTitle>Integration Marketplace</DialogTitle>
                <DialogDescription>
                  Discover and install integrations from our marketplace
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 max-h-96 overflow-y-auto">
                {hubData?.apiMarketplace.popularIntegrations.map((integration: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          <CardDescription className="text-sm mt-1">{integration.provider}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">{integration.rating}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{integration.description}</p>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Category:</span>
                          <Badge variant="outline" className="text-xs">{integration.category}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Installations:</span>
                          <span className="font-medium">{integration.installations.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Setup Time:</span>
                          <span className="font-medium">{integration.estimatedSetupTime}min</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mt-3">
                        {integration.features.slice(0, 2).map((feature: string, featureIdx: number) => (
                          <Badge key={featureIdx} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {integration.features.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{integration.features.length - 2} more
                          </Badge>
                        )}
                      </div>
                      
                      <Button className="w-full mt-4" size="sm">
                        Install Integration
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {hubData && (
        <>
          {/* Integration Overview KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Integrations</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {hubData.integrationOverview.activeIntegrations}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Network className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    {formatPercentage(hubData.integrationOverview.successRate)} success rate
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
                      {hubData.integrationOverview.apiCallsToday.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Activity className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    {formatDuration(hubData.integrationOverview.averageResponseTime)} avg response
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
                      {hubData.integrationOverview.dataVolumeProcessed.toFixed(1)}GB
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Database className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Upload className="h-4 w-4 text-blue-600 mr-1" />
                  <span className="text-blue-600">
                    Today's volume
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
                      {formatPercentage(hubData.integrationOverview.uptimePercentage)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Shield className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div className="mt-2">
                  <Progress value={hubData.integrationOverview.uptimePercentage} className="h-2" />
                  <p className="text-sm text-orange-600 mt-1">
                    Last sync: {format(hubData.integrationOverview.lastSyncTime, 'HH:mm')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="integrations" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="dataflows">Data Flows</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
              <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
              <TabsTrigger value="builder">Custom Builder</TabsTrigger>
            </TabsList>

            <TabsContent value="integrations" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {hubData.activeIntegrations.map((integration: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {integration.name}
                            {getHealthIcon(integration.health)}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {integration.provider} • v{integration.version}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge className={getStatusColor(integration.status)}>
                            {integration.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {integration.category}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Records Synced:</span>
                            <div className="font-medium">{integration.recordsSynced.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Sync Frequency:</span>
                            <div className="font-medium capitalize">{integration.syncFrequency.replace('_', ' ')}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Success Rate:</span>
                            <div className="font-medium">{formatPercentage(integration.metrics.successRate)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Response Time:</span>
                            <div className="font-medium">{integration.metrics.avgResponseTime}ms</div>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-gray-600 mb-2">Endpoints Status</div>
                          <div className="grid grid-cols-2 gap-1">
                            {integration.endpoints.map((endpoint: any, endpointIdx: number) => (
                              <div key={endpointIdx} className="flex items-center justify-between text-xs">
                                <span>{endpoint.name}</span>
                                <div className="flex items-center">
                                  {getHealthIcon(endpoint.status)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <span className="text-gray-500">Last sync:</span>
                              <div className="font-medium">{format(integration.lastSync, 'MMM dd, HH:mm')}</div>
                            </div>
                            <div className="flex items-center gap-2">
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

                        {integration.errorCount > 0 && (
                          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                            <div className="text-red-800 font-medium">
                              {integration.errorCount} errors in last sync
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          Auth expires: {format(integration.authExpiresAt, 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="dataflows" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-900">
                      {hubData.dataFlowManagement.activeFlows}
                    </div>
                    <div className="text-sm text-gray-600">Active Flows</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-900">
                      {hubData.dataFlowManagement.totalDataProcessed.toFixed(1)}GB
                    </div>
                    <div className="text-sm text-gray-600">Data Processed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-900">
                      {hubData.dataFlowManagement.transformationRules}
                    </div>
                    <div className="text-sm text-gray-600">Transform Rules</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-900">
                      {hubData.dataFlowManagement.mappingConfigurations}
                    </div>
                    <div className="text-sm text-gray-600">Field Mappings</div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                {hubData.dataFlowManagement.dataFlows.map((flow: any, idx: number) => (
                  <Card key={idx}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{flow.name}</h3>
                          <div className="text-sm text-gray-600">{flow.source} → {flow.destination}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(flow.status)}>
                            {flow.status}
                          </Badge>
                          <Badge variant="outline">
                            {flow.frequency}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Performance Metrics</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>Records Processed:</span>
                              <span className="font-medium">{flow.recordsProcessed.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Success Rate:</span>
                              <span className="font-medium">{formatPercentage(flow.successRate)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Avg Processing:</span>
                              <span className="font-medium">{flow.avgProcessingTime}ms</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Last Run:</span>
                              <span className="font-medium">{format(flow.lastRun, 'MMM dd, HH:mm')}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-gray-600 mb-2">Data Types</div>
                          <div className="flex flex-wrap gap-1">
                            {flow.dataTypes.map((type: string, typeIdx: number) => (
                              <Badge key={typeIdx} variant="secondary" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                          
                          <div className="text-sm text-gray-600 mb-2 mt-3">Error Handling</div>
                          <Badge variant="outline" className="text-xs">
                            {flow.errorHandling.replace('_', ' ')}
                          </Badge>
                        </div>

                        <div>
                          <div className="text-sm text-gray-600 mb-2">Transformations</div>
                          <div className="space-y-1">
                            {flow.transformations.slice(0, 3).map((transform: string, transformIdx: number) => (
                              <div key={transformIdx} className="text-xs text-gray-700 flex items-center">
                                <div className="w-1 h-1 bg-blue-500 rounded-full mr-2"></div>
                                {transform}
                              </div>
                            ))}
                            {flow.transformations.length > 3 && (
                              <div className="text-xs text-gray-500">
                                +{flow.transformations.length - 3} more transformations
                              </div>
                            )}
                          </div>
                          
                          <div className="text-xs text-gray-500 mt-3">
                            Retention: {flow.retentionPeriod} days
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          View Logs
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                        <Button size="sm">
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Run Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="webhooks" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Webhook Management</h3>
                  <p className="text-gray-600">Configure real-time event notifications</p>
                </div>
                <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Webhook
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Webhook</DialogTitle>
                      <DialogDescription>
                        Configure a webhook to receive real-time event notifications
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="webhook-name">Webhook Name</Label>
                        <Input id="webhook-name" placeholder="Enter webhook name" />
                      </div>
                      <div>
                        <Label htmlFor="webhook-url">Endpoint URL</Label>
                        <Input id="webhook-url" placeholder="https://your-app.com/webhooks" />
                      </div>
                      <div>
                        <Label htmlFor="webhook-events">Events</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select events to subscribe to" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer.created">Customer Created</SelectItem>
                            <SelectItem value="service.completed">Service Completed</SelectItem>
                            <SelectItem value="invoice.paid">Invoice Paid</SelectItem>
                            <SelectItem value="equipment.alert">Equipment Alert</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowWebhookDialog(false)}>
                          Cancel
                        </Button>
                        <Button>
                          Create Webhook
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-900">
                      {hubData.webhookManagement.activeWebhooks}
                    </div>
                    <div className="text-sm text-gray-600">Active Webhooks</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-900">
                      {hubData.webhookManagement.webhooksTriggered.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Triggered Today</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-900">
                      {formatPercentage(hubData.webhookManagement.deliverySuccessRate)}
                    </div>
                    <div className="text-sm text-gray-600">Success Rate</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-900">
                      {hubData.webhookManagement.averageDeliveryTime}ms
                    </div>
                    <div className="text-sm text-gray-600">Avg Delivery</div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                {hubData.webhookManagement.webhooks.map((webhook: any, idx: number) => (
                  <Card key={idx}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold">{webhook.name}</h3>
                          <div className="text-sm text-gray-600">{webhook.event}</div>
                          <div className="text-xs text-gray-500 mt-1">{webhook.url}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(webhook.status)}>
                            {webhook.status}
                          </Badge>
                          <Badge variant="outline">
                            {webhook.method}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Delivery Statistics</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>Total Attempts:</span>
                              <span className="font-medium">{webhook.deliveryAttempts.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Successful:</span>
                              <span className="font-medium text-green-600">{webhook.successfulDeliveries.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Failed:</span>
                              <span className="font-medium text-red-600">{webhook.failedDeliveries.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Success Rate:</span>
                              <span className="font-medium">{formatPercentage(webhook.successRate)}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-gray-600 mb-2">Configuration</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>Max Retries:</span>
                              <span className="font-medium">{webhook.maxRetries}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Timeout:</span>
                              <span className="font-medium">{webhook.timeout}s</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Retry Policy:</span>
                              <span className="font-medium">{webhook.retryPolicy.replace('_', ' ')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Last Triggered:</span>
                              <span className="font-medium">{format(webhook.lastTriggered, 'MMM dd, HH:mm')}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-gray-600 mb-2">Security</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>Secret:</span>
                              <span className="font-mono text-xs">{webhook.secret}</span>
                            </div>
                          </div>
                          
                          <div className="text-sm text-gray-600 mb-2 mt-3">Headers</div>
                          <div className="space-y-1">
                            {Object.entries(webhook.headers).slice(0, 2).map(([key, value]) => (
                              <div key={key} className="text-xs">
                                <span className="font-mono text-gray-500">{key}:</span>
                                <span className="ml-1">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          View Logs
                        </Button>
                        <Button size="sm" variant="outline">
                          <Copy className="h-4 w-4 mr-2" />
                          Test
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline">
                          <PauseCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-6">
              {/* Health Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-900">
                      {hubData.healthMonitoring.overallHealth.toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-600">Overall Health</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-900">
                      {hubData.healthMonitoring.monitoringRules}
                    </div>
                    <div className="text-sm text-gray-600">Monitoring Rules</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-900">
                      {hubData.healthMonitoring.alertsTriggered}
                    </div>
                    <div className="text-sm text-gray-600">Alerts Today</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-900">
                      {hubData.healthMonitoring.issuesResolved}
                    </div>
                    <div className="text-sm text-gray-600">Issues Resolved</div>
                  </CardContent>
                </Card>
              </div>

              {/* Health Checks */}
              <Card>
                <CardHeader>
                  <CardTitle>System Health Checks</CardTitle>
                  <CardDescription>Automated health monitoring across all integrations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hubData.healthMonitoring.healthChecks.map((check: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          {getHealthIcon(check.status)}
                          <span className="font-medium">{check.name}</span>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(check.status)}>
                            {check.status}
                          </Badge>
                          <div className="text-xs text-gray-500 mt-1">
                            {format(check.lastCheck, 'HH:mm:ss')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Active Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle>Active Alerts</CardTitle>
                  <CardDescription>Current integration issues requiring attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {hubData.healthMonitoring.alerts.map((alert: any, idx: number) => (
                      <div key={idx} className={`p-4 border rounded-lg ${getSeverityColor(alert.severity)}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium">{alert.integration}</div>
                            <div className="text-sm mt-1">{alert.message}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            {alert.acknowledged && (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Triggered:</span>
                            <span className="ml-2">{format(alert.triggeredAt, 'MMM dd, HH:mm')}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Assigned to:</span>
                            <span className="ml-2">{alert.assignedTo}</span>
                          </div>
                        </div>
                        
                        <div className="mt-3 p-2 bg-white bg-opacity-50 rounded text-sm">
                          <strong>Suggested Action:</strong> {alert.suggestedAction}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="marketplace" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {hubData.apiMarketplace.popularIntegrations.map((integration: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          <CardDescription className="text-sm mt-1">{integration.provider}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">{integration.rating}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-600 mb-3 line-clamp-3">{integration.description}</p>
                      
                      <div className="space-y-2 text-xs mb-3">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Category:</span>
                          <Badge variant="outline" className="text-xs">{integration.category}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Installations:</span>
                          <span className="font-medium">{integration.installations.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Setup Time:</span>
                          <span className="font-medium">{integration.estimatedSetupTime}min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Pricing:</span>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {integration.pricing.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mb-3">
                        {integration.features.slice(0, 3).map((feature: string, featureIdx: number) => (
                          <Badge key={featureIdx} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {integration.features.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{integration.features.length - 3}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button className="flex-1" size="sm">
                          Install
                        </Button>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-2">
                        Updated: {format(integration.lastUpdated, 'MMM dd, yyyy')}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="builder" className="space-y-6">
              <div className="text-center py-12">
                <Code className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Custom Integration Builder</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Build custom integrations using our visual workflow builder and pre-built templates
                </p>
                <div className="flex gap-4 justify-center">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Integration
                  </Button>
                  <Button variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    View Templates
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}