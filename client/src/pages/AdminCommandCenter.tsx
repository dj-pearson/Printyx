import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { QueryState, QueryStates } from '@/components/ui/query-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import {
  Building2,
  Users,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileText,
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
  /** The screen that performs it. Every card here has one; see NOT_AVAILABLE. */
  href: string;
  cta: string;
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

interface AdminOverview {
  systemHealth?: string;
  systemUptime?: number;
  activeUsers?: number;
}

export default function AdminCommandCenter() {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState('all');

  // Fetch system data
  const overviewQuery = useQuery<AdminOverview>({
    queryKey: ['/api/root-admin/overview'],
    refetchInterval: 30000,
  });
  const refetchOverview = overviewQuery.refetch;

  const resourcesQuery = useQuery<SystemMetric[]>({
    queryKey: ['/api/root-admin/system-resources'],
    refetchInterval: 15000,
  });

  const tasksQuery = useQuery<PendingTask[]>({
    queryKey: ['/api/root-admin/pending-tasks'],
    refetchInterval: 30000,
  });

  // CR-033: these three kept only `.data`. Only two of the four tabs consume
  // them, so the wrappers below sit INSIDE those tabs rather than around the
  // whole page — Quick Actions are static admin links
  // and must stay usable when a poll fails.
  const systemOverview = overviewQuery.data;
  const systemResources = resourcesQuery.data;
  // No `pendingTasks` const: the Pending Tasks tab now reads its rows from the
  // QueryState render prop, which is the only place they are defined.

  // Quick Actions Configuration
  // AUDIT-022: this array held twelve cards, every one of which opened a dialog
  // that did nothing. Before that it POSTed /api/admin/execute-action, whose
  // every branch returned a canned success - "Database backup initiated",
  // "Application cache cleared successfully", a security scan with invented
  // findings - while performing none of it.
  //
  // Each of the twelve was resolved individually. Three had a screen that
  // really does the work and are links to it now. The other nine are listed
  // under NOT_AVAILABLE below with what is actually true of each, because a
  // control that cannot act should not be clickable, and quietly deleting nine
  // cards would erase the fact that somebody expected the platform to do these
  // things.
  const quickActions: QuickAction[] = [
    {
      id: 'create-tenant',
      title: 'Create New Tenant',
      description: 'Name, plan and admin contact for a new organization',
      icon: Building2,
      category: 'tenant',
      href: '/admin/tenant-management',
      cta: 'Open tenant management',
    },
    {
      id: 'health-check',
      title: 'System Health',
      description: 'Live database, storage and service checks',
      icon: Activity,
      category: 'system',
      href: '/admin/system-security',
      cta: 'Open system security',
    },
    {
      id: 'audit-logs',
      title: 'Review Access Logs',
      description: 'Who did what, across tenants',
      icon: FileText,
      category: 'security',
      href: '/admin/audit-logs',
      cta: 'Open audit log',
    },
  ];

  /**
   * The nine that were removed, and what is true of each instead. Rendered as
   * text, not as buttons.
   */
  const NOT_AVAILABLE: Array<{ title: string; reason: string }> = [
    {
      title: 'Suspend tenant',
      reason:
        'No screen or endpoint suspends a tenant. Tenant management can filter by a suspended status but cannot set one.',
    },
    {
      title: 'Upgrade subscriptions',
      reason: 'There is no platform-admin subscription screen; plans are changed in Stripe.',
    },
    {
      title: 'Bulk user import',
      reason:
        'The CSV import wizard at /import handles business records, contacts, products, service products, inventory, equipment and opportunities. Users are not among them.',
    },
    {
      title: 'Reset passwords',
      reason:
        'Nothing performs an administrative password reset. A user changes their own from Settings, through Supabase Auth.',
    },
    {
      title: 'Assign roles',
      reason:
        'Role definitions are edited at /role-management, but no screen assigns a role to a user, though the admin API can (PATCH /api/admin/users/:id).',
    },
    {
      title: 'Clear cache',
      reason: 'There is no application cache to clear from here.',
    },
    {
      title: 'Generate backup',
      reason:
        'Backups are real and are not launched from the web: the k8s CronJob in k8s/base/cronjob-backup.yaml runs daily at 02:00 UTC, and npm run db:backup runs one by hand. Restores require interactive confirmation on purpose.',
    },
    {
      title: 'Security scan',
      reason: 'Nothing on the platform performs a security scan.',
    },
    {
      title: 'MFA enforcement',
      reason:
        'Users can enrol in two-factor from Settings, but no route requires it - enforceMfaForAdmins is written and never mounted (SEC-MFA-001).',
    },
  ];

  // QUALITY-002: an executeAction mutation used to POST /api/admin/execute-action
  // here and, on any 2xx, toast "The action has been completed successfully."
  // That endpoint executed NOTHING - every branch of its switch returned a
  // canned success ("Tenant provisioning workflow initiated", "Application
  // cache cleared successfully", "Database backup initiated", a security scan
  // with invented findings) - and the action ids it switched on did not even
  // match the ids sent from here, so every click fell through to its default
  // "executed successfully". Its Express router has been deleted; the dialog
  // below now says what it already admitted in its own note instead of
  // reporting a success that never happened.

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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quick-actions">Quick Actions</TabsTrigger>
            <TabsTrigger value="pending-tasks">Pending Tasks</TabsTrigger>
            <TabsTrigger value="monitoring">Real-Time Monitoring</TabsTrigger>
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
                    <Button asChild className="w-full" size="sm">
                      <Link href={action.href}>{action.cta}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Not available from here</CardTitle>
                <CardDescription>
                  Nine controls used to sit above this line and report success without doing
                  anything. What is actually true of each:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {NOT_AVAILABLE.map((item) => (
                  <div key={item.title}>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
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
              {/* CR-033: the only guard here was `pendingTasks && length > 0`,
                  so a FAILED poll rendered a green check and "All caught up! No
                  pending administrative tasks" — an active all-clear, on the
                  page an admin opens to find out what needs attention. Same
                  words now only when the request actually succeeded and the
                  queue is genuinely empty. */}
              <CardContent className="space-y-3">
                <QueryState
                  query={tasksQuery}
                  errorTitle="Could not load pending tasks"
                  empty={
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-600" />
                      <p className="font-medium">All caught up!</p>
                      <p className="text-sm">No pending administrative tasks</p>
                    </div>
                  }
                >
                  {(tasks) => (
                    <>
                      {tasks && tasks.length > 0
                        ? tasks.map((task: PendingTask) => (
                            <div
                              key={task.id}
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <Badge className={getUrgencyColor(task.urgency)}>
                                  {task.urgency}
                                </Badge>
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
                        : null}
                    </>
                  )}
                </QueryState>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Real-Time Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-4">
            <QueryStates
              queries={[overviewQuery, resourcesQuery]}
              errorTitle="Could not load system monitoring"
              className="py-6"
            >
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
            </QueryStates>
          </TabsContent>

          {/* Guided Workflows Tab */}
          {/* AUDIT-022: a "Guided Workflows" tab stood here with four cards -
              tenant provisioning, bulk user operations, system diagnostics and a
              security audit - each listing four green-ticked steps as though the
              platform performed them, above a Start Workflow button that opened
              a dialog and did nothing. None of the four exists. The ticks were
              the worst of it: they asserted, item by item, that steps like
              "scan for vulnerabilities" and "map fields and validate data" were
              available. Removed rather than rewritten; what IS available is on
              the Quick Actions tab, and what is not is named there. */}
        </Tabs>
      </div>
    </MainLayout>
  );
}
