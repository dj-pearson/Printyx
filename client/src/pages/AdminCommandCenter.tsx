import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import {
  Building2,
  Users,
  Shield,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  Play,
  Zap,
  UserPlus,
  Lock,
  Download,
  Upload,
  FileText,
  Search,
  Settings,
  Bell,
  ArrowRight,
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
} from 'lucide-react';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline';
}

interface PendingTask {
  id: string;
  type: string;
  count: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  action: string;
}

interface SystemMetric {
  name: string;
  value: number | string;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  threshold?: number;
}

export default function AdminCommandCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  // Fetch system data
  const { data: systemOverview, refetch: refetchOverview } = useQuery({
    queryKey: ['/api/root-admin/overview'],
    refetchInterval: 30000,
  });

  const { data: systemResources } = useQuery({
    queryKey: ['/api/root-admin/system-resources'],
    refetchInterval: 15000,
  });

  const { data: pendingTasks } = useQuery({
    queryKey: ['/api/root-admin/pending-tasks'],
    refetchInterval: 30000,
  });

  // Quick Actions Configuration
  const quickActions: QuickAction[] = [
    // Tenant Management
    {
      id: 'create-tenant',
      title: 'Create New Tenant',
      description: 'Guided setup for new organization',
      icon: Building2,
      category: 'tenant',
      onClick: () => handleWorkflow('tenant-provisioning'),
    },
    {
      id: 'suspend-tenant',
      title: 'Suspend Tenant',
      description: 'Temporarily disable tenant access',
      icon: Lock,
      category: 'tenant',
      onClick: () => handleWorkflow('tenant-suspension'),
      variant: 'destructive',
    },
    {
      id: 'upgrade-subscription',
      title: 'Upgrade Subscriptions',
      description: 'Bulk upgrade tenant plans',
      icon: TrendingUp,
      category: 'tenant',
      onClick: () => handleWorkflow('subscription-upgrade'),
    },
    // User Operations
    {
      id: 'bulk-import',
      title: 'Bulk User Import',
      description: 'Import users from CSV file',
      icon: Upload,
      category: 'users',
      onClick: () => handleWorkflow('user-import'),
    },
    {
      id: 'reset-passwords',
      title: 'Reset Passwords',
      description: 'Bulk password reset',
      icon: Lock,
      category: 'users',
      onClick: () => handleWorkflow('password-reset'),
    },
    {
      id: 'assign-roles',
      title: 'Assign Roles',
      description: 'Bulk role assignment',
      icon: Shield,
      category: 'users',
      onClick: () => handleWorkflow('role-assignment'),
    },
    // System Maintenance
    {
      id: 'health-check',
      title: 'Run Health Check',
      description: 'Comprehensive system diagnostics',
      icon: Activity,
      category: 'system',
      onClick: () => handleWorkflow('health-check'),
    },
    {
      id: 'clear-cache',
      title: 'Clear Cache',
      description: 'Clear application cache',
      icon: RefreshCw,
      category: 'system',
      onClick: () => handleWorkflow('cache-clear'),
    },
    {
      id: 'generate-backup',
      title: 'Generate Backup',
      description: 'Create database backup',
      icon: Database,
      category: 'system',
      onClick: () => handleWorkflow('backup-generation'),
    },
    // Security Audits
    {
      id: 'security-scan',
      title: 'Security Scan',
      description: 'Run vulnerability assessment',
      icon: Shield,
      category: 'security',
      onClick: () => handleWorkflow('security-scan'),
    },
    {
      id: 'audit-logs',
      title: 'Review Access Logs',
      description: 'Analyze authentication logs',
      icon: FileText,
      category: 'security',
      onClick: () => handleWorkflow('audit-review'),
    },
    {
      id: 'mfa-enforcement',
      title: 'MFA Enforcement',
      description: 'Enable MFA for all users',
      icon: Lock,
      category: 'security',
      onClick: () => handleWorkflow('mfa-rollout'),
    },
  ];

  const handleWorkflow = (workflowId: string) => {
    setSelectedWorkflow(workflowId);
    setIsDialogOpen(true);
  };

  const executeAction = useMutation({
    mutationFn: async (actionId: string) => {
      const response = await fetch(`/api/admin/execute-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ actionId }),
      });
      if (!response.ok) throw new Error('Failed to execute action');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Action Executed',
        description: 'The action has been completed successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/root-admin/overview'] });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to execute action. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const filteredActions =
    activeCategory === 'all'
      ? quickActions
      : quickActions.filter((action) => action.category === activeCategory);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getResourceIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('cpu')) return <Cpu className="w-5 h-5" />;
    if (lowerName.includes('memory')) return <MemoryStick className="w-5 h-5" />;
    if (lowerName.includes('disk') || lowerName.includes('database'))
      return <HardDrive className="w-5 h-5" />;
    if (lowerName.includes('connection')) return <Wifi className="w-5 h-5" />;
    return <Activity className="w-5 h-5" />;
  };

  return (
    <MainLayout
      title="Admin Command Center"
      description="Centralized workflow and operations management"
    >
      <div className="container mx-auto p-6 space-y-6">
        {/* Header with Refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Command Center</h1>
            <p className="text-gray-600 mt-1">
              Execute administrative workflows and monitor system health
            </p>
          </div>
          <Button
            onClick={() => {
              refetchOverview();
              toast({ title: 'Refreshed', description: 'Data has been refreshed' });
            }}
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="quick-actions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="quick-actions">Quick Actions</TabsTrigger>
            <TabsTrigger value="pending-tasks">Pending Tasks</TabsTrigger>
            <TabsTrigger value="monitoring">Real-Time Monitoring</TabsTrigger>
            <TabsTrigger value="workflows">Guided Workflows</TabsTrigger>
          </TabsList>

          {/* Quick Actions Tab */}
          <TabsContent value="quick-actions" className="space-y-6">
            {/* Category Filters */}
            <div className="flex items-center gap-2">
              <Button
                variant={activeCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory('all')}
              >
                All Actions
              </Button>
              <Button
                variant={activeCategory === 'tenant' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory('tenant')}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Tenant
              </Button>
              <Button
                variant={activeCategory === 'users' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory('users')}
              >
                <Users className="w-4 h-4 mr-2" />
                Users
              </Button>
              <Button
                variant={activeCategory === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory('system')}
              >
                <Settings className="w-4 h-4 mr-2" />
                System
              </Button>
              <Button
                variant={activeCategory === 'security' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory('security')}
              >
                <Shield className="w-4 h-4 mr-2" />
                Security
              </Button>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredActions.map((action) => (
                <Card key={action.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <action.icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{action.title}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {action.description}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={action.onClick}
                      variant={action.variant || 'default'}
                      className="w-full"
                      size="sm"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Execute
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Pending Tasks Tab */}
          <TabsContent value="pending-tasks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Pending Administrative Tasks
                </CardTitle>
                <CardDescription>Review and action items requiring admin attention</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingTasks && pendingTasks.length > 0 ? (
                  pendingTasks.map((task: PendingTask) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <Badge className={getUrgencyColor(task.urgency)}>{task.urgency}</Badge>
                        <div className="flex-1">
                          <p className="font-medium">{task.type}</p>
                          <p className="text-sm text-gray-600">{task.description}</p>
                        </div>
                        <Badge variant="outline">{task.count} items</Badge>
                      </div>
                      <Button size="sm" variant="outline">
                        {task.action}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-600" />
                    <p className="font-medium">All caught up!</p>
                    <p className="text-sm">No pending administrative tasks</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Real-Time Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemResources &&
                systemResources.map((resource: SystemMetric, idx: number) => (
                  <Card key={idx}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getResourceIcon(resource.name)}
                          <CardTitle className="text-base">{resource.name}</CardTitle>
                        </div>
                        {getStatusIcon(resource.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold">{resource.value}</span>
                          <span className="text-sm text-gray-500">{resource.unit}</span>
                        </div>
                        {resource.threshold && (
                          <>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  resource.status === 'normal'
                                    ? 'bg-green-600'
                                    : resource.status === 'warning'
                                      ? 'bg-yellow-600'
                                      : 'bg-red-600'
                                }`}
                                style={{
                                  width: `${Math.min(
                                    (Number(resource.value) / resource.threshold) * 100,
                                    100,
                                  )}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-gray-500">
                              Threshold: {resource.threshold}
                              {resource.unit}
                            </p>
                          </>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            resource.status === 'normal'
                              ? 'border-green-200 text-green-700'
                              : resource.status === 'warning'
                                ? 'border-yellow-200 text-yellow-700'
                                : 'border-red-200 text-red-700'
                          }
                        >
                          {resource.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>

            {/* System Health Summary */}
            <Card
              className={
                systemOverview?.systemHealth === 'healthy'
                  ? 'border-green-200 bg-green-50'
                  : 'border-orange-200 bg-orange-50'
              }
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {systemOverview?.systemHealth === 'healthy' ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-orange-600" />
                    )}
                    <div>
                      <p className="font-bold text-lg">
                        {systemOverview?.systemHealth === 'healthy'
                          ? 'All Systems Operational'
                          : 'Attention Required'}
                      </p>
                      <p className="text-sm text-gray-700">
                        {systemOverview?.systemUptime}% uptime • {systemOverview?.activeUsers}{' '}
                        active users
                      </p>
                    </div>
                  </div>
                  <Button variant="outline">View Details</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guided Workflows Tab */}
          <TabsContent value="workflows" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Tenant Provisioning
                  </CardTitle>
                  <CardDescription>Complete guided setup for new organizations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Step 1: Basic information & contact details</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Step 2: Subscription plan selection</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Step 3: Admin user creation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Step 4: Branding & integrations</span>
                    </div>
                    <Button
                      className="w-full mt-4"
                      onClick={() => handleWorkflow('tenant-provisioning')}
                    >
                      Start Workflow
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Bulk User Operations
                  </CardTitle>
                  <CardDescription>Import, update, or manage users in bulk</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Upload CSV file with user data</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Map fields and validate data</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Assign roles and permissions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Review and execute import</span>
                    </div>
                    <Button className="w-full mt-4" onClick={() => handleWorkflow('user-import')}>
                      Start Workflow
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    System Diagnostics
                  </CardTitle>
                  <CardDescription>Comprehensive health check and diagnostics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Database performance analysis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>API endpoint health checks</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Integration connectivity tests</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Generate diagnostic report</span>
                    </div>
                    <Button className="w-full mt-4" onClick={() => handleWorkflow('health-check')}>
                      Start Workflow
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Security Audit
                  </CardTitle>
                  <CardDescription>Platform-wide security assessment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Scan for vulnerabilities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Review access logs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Check permission configurations</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Generate security report</span>
                    </div>
                    <Button className="w-full mt-4" onClick={() => handleWorkflow('security-scan')}>
                      Start Workflow
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Workflow Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Execute Workflow</DialogTitle>
              <DialogDescription>
                {selectedWorkflow
                  ? `Starting workflow: ${selectedWorkflow}`
                  : 'Select a workflow to begin'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> This workflow is under development. In production, this
                  would guide you through a multi-step process with validation and confirmation at
                  each stage.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => selectedWorkflow && executeAction.mutate(selectedWorkflow)}>
                  Proceed
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
