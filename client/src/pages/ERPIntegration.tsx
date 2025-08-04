import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Network,
  Database,
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
  RefreshCw as Sync,
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
  Wrench
} from 'lucide-react';
import { format } from 'date-fns';

interface ERPIntegrationData {
  integrationOverview: {
    totalIntegrations: number;
    activeIntegrations: number;
    failedIntegrations: number;
    syncSuccessRate: number;
    dataPointsSynced: number;
    syncFrequency: string;
    lastSyncCompleted: Date;
    nextScheduledSync: Date;
    averageLatency: number;
    systemUptime: number;
    errorRate: number;
  };
  erpSystems: Array<{
    id: string;
    name: string;
    type: string;
    category: string;
    status: string;
    version: string;
    lastSync: Date;
    syncFrequency: string;
    successRate: number;
    recordsProcessed: number;
    apiCalls: number;
    dataVolume: number;
    latency: number;
    capabilities: string[];
    endpoints: Array<{
      name: string;
      url: string;
      status: string;
      lastCall: Date;
    }>;
    authentication: {
      type: string;
      status: string;
      tokenExpiry: Date;
      lastRefresh: Date;
    };
    recentSync: {
      recordsCreated: number;
      recordsUpdated: number;
      recordsDeleted: number;
      errors: number;
      warnings: number;
      duration: number;
    };
  }>;
  dataSynchronization: {
    syncSchedules: Array<{
      id: string;
      name: string;
      description: string;
      systems: string[];
      frequency: string;
      lastRun: Date;
      nextRun: Date;
      status: string;
      successRate: number;
      recordsProcessed: number;
      averageDuration: number;
      conflicts: number;
      resolvedConflicts: number;
    }>;
    conflictResolution: {
      totalConflicts: number;
      resolvedConflicts: number;
      pendingResolution: number;
      autoResolutionRate: number;
      resolutionRules: Array<{
        rule: string;
        usage: number;
        success: number;
      }>;
    };
    dataQuality: {
      overallScore: number;
      completeness: number;
      accuracy: number;
      consistency: number;
      timeliness: number;
      duplicates: number;
      missingFields: number;
      validationErrors: number;
    };
  };
  businessProcessAutomation: {
    automatedProcesses: Array<{
      id: string;
      name: string;
      description: string;
      systems: string[];
      status: string;
      executionsToday: number;
      successRate: number;
      averageProcessingTime: number;
      steps: Array<{
        step: string;
        system: string;
        avgTime: number;
        successRate: number;
      }>;
      kpis: {
        cycleTimeReduction: number;
        errorReduction: number;
        costSavings: number;
        customerSatisfaction?: number;
        complianceScore?: number;
      };
    }>;
    workflowOrchestration: {
      totalWorkflows: number;
      activeWorkflows: number;
      pausedWorkflows: number;
      erroredWorkflows: number;
      executionsToday: number;
      successRate: number;
      averageExecutionTime: number;
      parallelExecutions: number;
      queuedExecutions: number;
    };
  };
  monitoring: {
    systemHealth: Array<{
      system: string;
      status: string;
      uptime: number;
      lastCheck: Date;
      responseTime: number;
    }>;
    alerts: Array<{
      id: string;
      type: string;
      severity: string;
      system: string;
      message: string;
      triggeredAt: Date;
      status: string;
      resolvedAt?: Date;
      assignee: string;
    }>;
    performanceMetrics: {
      dataLatency: number;
      syncThroughput: number;
      errorRate: number;
      availabilityScore: number;
      integrationComplexity: number;
      maintenanceOverhead: number;
    };
  };
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-green-100 text-green-800';
    case 'healthy': return 'bg-green-100 text-green-800';
    case 'connected': return 'bg-green-100 text-green-800';
    case 'authenticated': return 'bg-green-100 text-green-800';
    case 'warning': return 'bg-yellow-100 text-yellow-800';
    case 'investigating': return 'bg-yellow-100 text-yellow-800';
    case 'error': return 'bg-red-100 text-red-800';
    case 'failed': return 'bg-red-100 text-red-800';
    case 'disconnected': return 'bg-red-100 text-red-800';
    case 'paused': return 'bg-gray-100 text-gray-800';
    case 'resolved': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity.toLowerCase()) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getSystemIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'financial_management': return <DollarSign className="h-5 w-5 text-green-600" />;
    case 'cloud_erp': return <Globe className="h-5 w-5 text-blue-600" />;
    case 'microsoft_ecosystem': return <Building className="h-5 w-5 text-blue-600" />;
    case 'manufacturing': return <Factory className="h-5 w-5 text-orange-600" />;
    case 'logistics': return <Truck className="h-5 w-5 text-purple-600" />;
    default: return <Server className="h-5 w-5 text-gray-600" />;
  }
};

export default function ERPIntegration() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);

  // Fetch ERP integration data
  const { data: erpData, isLoading, refetch } = useQuery({
    queryKey: ['/api/erp-integration/dashboard'],
    select: (data: any) => ({
      ...data,
      integrationOverview: {
        ...data.integrationOverview,
        lastSyncCompleted: new Date(data.integrationOverview.lastSyncCompleted),
        nextScheduledSync: new Date(data.integrationOverview.nextScheduledSync)
      },
      erpSystems: data.erpSystems?.map((system: any) => ({
        ...system,
        lastSync: new Date(system.lastSync),
        endpoints: system.endpoints?.map((endpoint: any) => ({
          ...endpoint,
          lastCall: new Date(endpoint.lastCall)
        })) || [],
        authentication: {
          ...system.authentication,
          tokenExpiry: new Date(system.authentication.tokenExpiry),
          lastRefresh: new Date(system.authentication.lastRefresh)
        }
      })) || [],
      dataSynchronization: {
        ...data.dataSynchronization,
        syncSchedules: data.dataSynchronization?.syncSchedules?.map((schedule: any) => ({
          ...schedule,
          lastRun: new Date(schedule.lastRun),
          nextRun: new Date(schedule.nextRun)
        })) || []
      },
      monitoring: {
        ...data.monitoring,
        systemHealth: data.monitoring?.systemHealth?.map((health: any) => ({
          ...health,
          lastCheck: new Date(health.lastCheck)
        })) || [],
        alerts: data.monitoring?.alerts?.map((alert: any) => ({
          ...alert,
          triggeredAt: new Date(alert.triggeredAt),
          resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : undefined
        })) || []
      }
    }),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading ERP integration data...</p>
          </div>
        </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Network className="h-6 w-6 text-blue-600" />
            Enterprise Resource Planning (ERP) Integration Hub
          </h1>
          <p className="text-gray-600 mt-1">Advanced multi-system integration with real-time data synchronization and business process automation</p>
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

      {erpData && (
        <>
          {/* Integration Overview KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Integrations</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {erpData.integrationOverview.activeIntegrations}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Network className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    {formatPercentage(erpData.integrationOverview.syncSuccessRate)} success rate
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Data Synced</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {erpData.integrationOverview.dataPointsSynced}M
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Database className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Sync className="h-4 w-4 text-blue-600 mr-1" />
                  <span className="text-blue-600 capitalize">
                    {erpData.integrationOverview.syncFrequency}
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
                      {formatPercentage(erpData.integrationOverview.systemUptime)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Activity className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Timer className="h-4 w-4 text-purple-600 mr-1" />
                  <span className="text-purple-600">
                    {erpData.integrationOverview.averageLatency}ms latency
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Error Rate</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(erpData.integrationOverview.errorRate)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Clock className="h-4 w-4 text-gray-600 mr-1" />
                  <span className="text-gray-600">
                    Last sync: {format(erpData.integrationOverview.lastSyncCompleted, 'HH:mm')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="systems" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="systems">ERP Systems</TabsTrigger>
              <TabsTrigger value="synchronization">Data Sync</TabsTrigger>
              <TabsTrigger value="automation">Process Automation</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
              <TabsTrigger value="mapping">Data Mapping</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="systems" className="space-y-6">
              {/* ERP Systems Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {erpData.erpSystems.map((system: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {getSystemIcon(system.category)}
                            {system.name}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {system.type} • {system.category.replace('_', ' ')} • v{system.version}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge className={getStatusColor(system.status)}>
                            {system.status}
                          </Badge>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {formatPercentage(system.successRate)}
                            </div>
                            <div className="text-xs text-gray-500">success rate</div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* System Metrics */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Records Processed:</span>
                            <div className="font-medium">{formatNumber(system.recordsProcessed)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">API Calls:</span>
                            <div className="font-medium">{formatNumber(system.apiCalls)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Data Volume:</span>
                            <div className="font-medium">{system.dataVolume} GB</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Latency:</span>
                            <div className="font-medium">{system.latency}ms</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Sync:</span>
                            <div className="font-medium">{format(system.lastSync, 'MMM dd, HH:mm')}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Frequency:</span>
                            <div className="font-medium capitalize">{system.syncFrequency}</div>
                          </div>
                        </div>

                        {/* Recent Sync Stats */}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="text-center p-2 bg-green-50 rounded">
                            <div className="font-bold text-green-900">{system.recentSync.recordsCreated}</div>
                            <div className="text-green-600 text-xs">Created</div>
                          </div>
                          <div className="text-center p-2 bg-blue-50 rounded">
                            <div className="font-bold text-blue-900">{system.recentSync.recordsUpdated}</div>
                            <div className="text-blue-600 text-xs">Updated</div>
                          </div>
                          <div className="text-center p-2 bg-orange-50 rounded">
                            <div className="font-bold text-orange-900">{system.recentSync.errors}</div>
                            <div className="text-orange-600 text-xs">Errors</div>
                          </div>
                        </div>

                        {/* Capabilities */}
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Capabilities</div>
                          <div className="flex flex-wrap gap-1">
                            {system.capabilities.slice(0, 4).map((capability: string, capIdx: number) => (
                              <Badge key={capIdx} variant="secondary" className="text-xs">
                                {capability.replace('_', ' ')}
                              </Badge>
                            ))}
                            {system.capabilities.length > 4 && (
                              <Badge variant="secondary" className="text-xs">
                                +{system.capabilities.length - 4} more
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Authentication Status */}
                        <div className="p-3 bg-gray-50 rounded">
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <span className="text-gray-600">Authentication:</span>
                              <span className="ml-2 font-medium capitalize">{system.authentication.type.replace('_', ' ')}</span>
                            </div>
                            <Badge className={getStatusColor(system.authentication.status)}>
                              {system.authentication.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Token expires: {format(system.authentication.tokenExpiry, 'MMM dd, yyyy')}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t">
                          <div className="text-xs text-gray-500">
                            Duration: {system.recentSync.duration} min
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button size="sm">
                              <Sync className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="synchronization" className="space-y-6">
              {/* Data Quality Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Data Quality Overview
                  </CardTitle>
                  <CardDescription>Data quality metrics across all integrated systems</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-900">
                        {formatPercentage(erpData.dataSynchronization.dataQuality.overallScore)}
                      </div>
                      <div className="text-sm text-gray-600">Overall Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-900">
                        {formatPercentage(erpData.dataSynchronization.dataQuality.completeness)}
                      </div>
                      <div className="text-sm text-gray-600">Completeness</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-900">
                        {formatPercentage(erpData.dataSynchronization.dataQuality.accuracy)}
                      </div>
                      <div className="text-sm text-gray-600">Accuracy</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-900">
                        {formatPercentage(erpData.dataSynchronization.dataQuality.consistency)}
                      </div>
                      <div className="text-sm text-gray-600">Consistency</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium text-red-900">Data Issues</div>
                      <div className="text-red-600">
                        {erpData.dataSynchronization.dataQuality.duplicates} duplicates, {erpData.dataSynchronization.dataQuality.missingFields} missing fields
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium text-yellow-900">Validation Errors</div>
                      <div className="text-yellow-600">
                        {erpData.dataSynchronization.dataQuality.validationErrors} validation errors detected
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium text-green-900">Timeliness</div>
                      <div className="text-green-600">
                        {formatPercentage(erpData.dataSynchronization.dataQuality.timeliness)} data freshness
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sync Schedules */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Synchronization Schedules
                  </CardTitle>
                  <CardDescription>Automated data synchronization across ERP systems</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {erpData.dataSynchronization.syncSchedules.map((schedule: any, idx: number) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold">{schedule.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{schedule.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(schedule.status)}>
                              {schedule.status}
                            </Badge>
                            <div className="text-right">
                              <div className="text-sm font-bold">{formatPercentage(schedule.successRate)}</div>
                              <div className="text-xs text-gray-500">success</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <span className="text-gray-600">Frequency:</span>
                            <span className="ml-2 font-medium capitalize">{schedule.frequency}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Records:</span>
                            <span className="ml-2 font-medium">{formatNumber(schedule.recordsProcessed)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Duration:</span>
                            <span className="ml-2 font-medium">{schedule.averageDuration} min</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Conflicts:</span>
                            <span className="ml-2 font-medium">{schedule.resolvedConflicts}/{schedule.conflicts}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Last Run:</span>
                            <span className="ml-2 font-medium">{format(schedule.lastRun, 'MMM dd, HH:mm')}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Next Run:</span>
                            <span className="ml-2 font-medium">{format(schedule.nextRun, 'MMM dd, HH:mm')}</span>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <div className="text-sm text-gray-600 mb-2">Connected Systems:</div>
                          <div className="flex flex-wrap gap-1">
                            {schedule.systems.map((system: string, sysIdx: number) => (
                              <Badge key={sysIdx} variant="outline" className="text-xs">
                                {system}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-gray-500">
                            {schedule.conflicts > 0 && `${schedule.conflicts - schedule.resolvedConflicts} unresolved conflicts`}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                            <Button size="sm">
                              <Play className="h-4 w-4 mr-2" />
                              Run Now
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Conflict Resolution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-orange-600" />
                    Conflict Resolution
                  </CardTitle>
                  <CardDescription>Data conflict management and resolution strategies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-900">
                        {erpData.dataSynchronization.conflictResolution.totalConflicts}
                      </div>
                      <div className="text-sm text-gray-600">Total Conflicts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-900">
                        {erpData.dataSynchronization.conflictResolution.resolvedConflicts}
                      </div>
                      <div className="text-sm text-gray-600">Resolved</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-900">
                        {erpData.dataSynchronization.conflictResolution.pendingResolution}
                      </div>
                      <div className="text-sm text-gray-600">Pending</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-900">
                        {formatPercentage(erpData.dataSynchronization.conflictResolution.autoResolutionRate)}
                      </div>
                      <div className="text-sm text-gray-600">Auto-Resolved</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm text-gray-600 mb-3">Resolution Rules Performance:</div>
                    {erpData.dataSynchronization.conflictResolution.resolutionRules.map((rule: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <div className="font-medium">{rule.rule}</div>
                          <div className="text-sm text-gray-600">Used {rule.usage} times</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">{formatPercentage(rule.success)}</div>
                          <div className="text-xs text-gray-500">success rate</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="automation" className="space-y-6">
              {/* Workflow Orchestration Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="h-5 w-5 text-purple-600" />
                    Workflow Orchestration Overview
                  </CardTitle>
                  <CardDescription>Business process automation and workflow execution metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-purple-900">
                        {erpData.businessProcessAutomation.workflowOrchestration.totalWorkflows}
                      </div>
                      <div className="text-sm text-gray-600">Total Workflows</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-green-900">
                        {erpData.businessProcessAutomation.workflowOrchestration.activeWorkflows}
                      </div>
                      <div className="text-sm text-gray-600">Active</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-yellow-900">
                        {erpData.businessProcessAutomation.workflowOrchestration.pausedWorkflows}
                      </div>
                      <div className="text-sm text-gray-600">Paused</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-red-900">
                        {erpData.businessProcessAutomation.workflowOrchestration.erroredWorkflows}
                      </div>
                      <div className="text-sm text-gray-600">Errored</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-blue-900">
                        {erpData.businessProcessAutomation.workflowOrchestration.executionsToday}
                      </div>
                      <div className="text-sm text-gray-600">Executions Today</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-indigo-900">
                        {formatPercentage(erpData.businessProcessAutomation.workflowOrchestration.successRate)}
                      </div>
                      <div className="text-sm text-gray-600">Success Rate</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-teal-900">
                        {erpData.businessProcessAutomation.workflowOrchestration.parallelExecutions}
                      </div>
                      <div className="text-sm text-gray-600">Parallel</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-orange-900">
                        {erpData.businessProcessAutomation.workflowOrchestration.queuedExecutions}
                      </div>
                      <div className="text-sm text-gray-600">Queued</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Automated Business Processes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-600" />
                    Automated Business Processes
                  </CardTitle>
                  <CardDescription>End-to-end business process automation across ERP systems</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {erpData.businessProcessAutomation.automatedProcesses.map((process: any, idx: number) => (
                      <div key={idx} className="p-6 border rounded-lg">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold">{process.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{process.description}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={getStatusColor(process.status)}>
                              {process.status}
                            </Badge>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600">
                                {formatPercentage(process.successRate)}
                              </div>
                              <div className="text-xs text-gray-500">success rate</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                          <div>
                            <span className="text-gray-600">Executions Today:</span>
                            <span className="ml-2 font-medium">{process.executionsToday}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Avg Processing Time:</span>
                            <span className="ml-2 font-medium">{process.averageProcessingTime} min</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Systems Involved:</span>
                            <span className="ml-2 font-medium">{process.systems.length}</span>
                          </div>
                        </div>
                        
                        {/* Process Steps */}
                        <div className="mb-4">
                          <div className="text-sm text-gray-600 mb-3">Process Steps:</div>
                          <div className="space-y-2">
                            {process.steps.map((step: any, stepIdx: number) => (
                              <div key={stepIdx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{step.step}</div>
                                  <div className="text-xs text-gray-600">{step.system}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-gray-600">{step.avgTime} min</div>
                                  <div className="text-xs font-medium text-green-600">{formatPercentage(step.successRate)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* KPIs */}
                        <div className="mb-4">
                          <div className="text-sm text-gray-600 mb-3">Key Performance Indicators:</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="text-center p-3 bg-green-50 rounded">
                              <div className="font-bold text-green-900">{formatPercentage(process.kpis.cycleTimeReduction)}</div>
                              <div className="text-green-600 text-xs">Cycle Time Reduction</div>
                            </div>
                            <div className="text-center p-3 bg-blue-50 rounded">
                              <div className="font-bold text-blue-900">{formatPercentage(process.kpis.errorReduction)}</div>
                              <div className="text-blue-600 text-xs">Error Reduction</div>
                            </div>
                            <div className="text-center p-3 bg-purple-50 rounded">
                              <div className="font-bold text-purple-900">{formatCurrency(process.kpis.costSavings)}</div>
                              <div className="text-purple-600 text-xs">Monthly Savings</div>
                            </div>
                            <div className="text-center p-3 bg-orange-50 rounded">
                              <div className="font-bold text-orange-900">
                                {process.kpis.customerSatisfaction ? formatPercentage(process.kpis.customerSatisfaction) : 
                                 process.kpis.complianceScore ? formatPercentage(process.kpis.complianceScore) : 'N/A'}
                              </div>
                              <div className="text-orange-600 text-xs">
                                {process.kpis.customerSatisfaction ? 'Customer Satisfaction' : 
                                 process.kpis.complianceScore ? 'Compliance Score' : 'Additional KPI'}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center pt-3 border-t">
                          <div className="text-sm text-gray-600">
                            Connected Systems: {process.systems.join(', ')}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              View Flow
                            </Button>
                            <Button size="sm">
                              <Settings className="h-4 w-4 mr-2" />
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

            <TabsContent value="monitoring" className="space-y-6">
              {/* System Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-green-600" />
                    System Health Monitoring
                  </CardTitle>
                  <CardDescription>Real-time health status of all integrated ERP systems</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {erpData.monitoring.systemHealth.map((health: any, idx: number) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{health.system}</div>
                          <Badge className={getStatusColor(health.status)}>
                            {health.status}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Uptime:</span>
                            <span className="font-medium">{formatPercentage(health.uptime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Response Time:</span>
                            <span className="font-medium">{health.responseTime}ms</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Last Check:</span>
                            <span className="font-medium">{format(health.lastCheck, 'HH:mm')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-blue-600" />
                    Performance Metrics
                  </CardTitle>
                  <CardDescription>Overall integration performance indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-900">
                        {erpData.monitoring.performanceMetrics.dataLatency}ms
                      </div>
                      <div className="text-sm text-gray-600">Data Latency</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-900">
                        {formatNumber(erpData.monitoring.performanceMetrics.syncThroughput)}
                      </div>
                      <div className="text-sm text-gray-600">Records/Hour</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-red-900">
                        {formatPercentage(erpData.monitoring.performanceMetrics.errorRate)}
                      </div>
                      <div className="text-sm text-gray-600">Error Rate</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-purple-900">
                        {formatPercentage(erpData.monitoring.performanceMetrics.availabilityScore)}
                      </div>
                      <div className="text-sm text-gray-600">Availability</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-orange-900">
                        {erpData.monitoring.performanceMetrics.integrationComplexity.toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-600">Complexity Score</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-yellow-900">
                        {erpData.monitoring.performanceMetrics.maintenanceOverhead.toFixed(1)}h
                      </div>
                      <div className="text-sm text-gray-600">Weekly Maintenance</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Active Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    Active Alerts & Notifications
                  </CardTitle>
                  <CardDescription>System alerts and performance notifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {erpData.monitoring.alerts.map((alert: any, idx: number) => (
                      <div key={idx} className={`p-4 border rounded-lg ${getSeverityColor(alert.severity)}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium capitalize">{alert.type.replace('_', ' ')}</div>
                            <div className="text-sm mt-1">{alert.message}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <Badge className={getStatusColor(alert.status)}>
                              {alert.status}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">System:</span>
                            <span className="ml-2 font-medium">{alert.system}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Triggered:</span>
                            <span className="ml-2">{format(alert.triggeredAt, 'MMM dd, HH:mm')}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Assignee:</span>
                            <span className="ml-2 capitalize">{alert.assignee.replace('_', ' ')}</span>
                          </div>
                        </div>
                        
                        {alert.resolvedAt && (
                          <div className="mt-2 text-sm text-green-600">
                            Resolved: {format(alert.resolvedAt, 'MMM dd, HH:mm')}
                          </div>
                        )}
                        
                        <div className="flex justify-end gap-2 mt-3">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          {alert.status !== 'resolved' && (
                            <Button size="sm">
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mapping" className="space-y-6">
              <div className="text-center py-12">
                <Code className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Mapping & Transformation</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Advanced data mapping schemas, field transformations, and validation rules
                </p>
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Mappings
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <div className="text-center py-12">
                <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Security & Compliance</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Integration security, encryption, access controls, and compliance monitoring
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
    </MainLayout>
  );
}