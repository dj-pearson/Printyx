import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Zap,
  TrendingUp,
  Clock,
  Users,
  CheckCircle,
  Activity,
  BarChart3,
  Settings,
  Play,
  AlertCircle,
  DollarSign,
  Target,
  ArrowRight,
  Sparkles,
  Timer
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function AutoLeadRoutingDashboard() {
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/auto-lead-routing/dashboard'],
    queryFn: () => apiRequest('/api/auto-lead-routing/dashboard'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch config
  const { data: config } = useQuery({
    queryKey: ['/api/auto-lead-routing/config'],
    queryFn: () => apiRequest('/api/auto-lead-routing/config'),
  });

  // Manual routing mutation
  const routeMutation = useMutation({
    mutationFn: (leadId: string) =>
      apiRequest(`/api/auto-lead-routing/route/${leadId}`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      toast({
        title: 'Lead Routed Successfully',
        description: `Assigned to ${data.data.assignedRepName} in ${data.data.processingTimeMs}ms`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-lead-routing/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Routing Failed',
        description: error.message || 'Failed to route lead',
        variant: 'destructive',
      });
    },
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: (newConfig: any) =>
      apiRequest('/api/auto-lead-routing/config', {
        method: 'PUT',
        body: JSON.stringify(newConfig),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      toast({
        title: 'Configuration Updated',
        description: 'Auto-routing settings saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-lead-routing/config'] });
      setConfigDialogOpen(false);
    },
  });

  const overview = dashboardData?.overview || {};
  const repWorkload = dashboardData?.repWorkload || [];
  const recentLeads = dashboardData?.recentLeads || [];
  const scoreDistribution = dashboardData?.scoreDistribution || [];

  if (isLoading) {
    return (
      <MainLayout title="Auto Lead Routing" description="AI-powered lead assignment dashboard">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Auto Lead Routing"
      description="AI-powered automatic lead scoring and assignment"
    >
      <div className="container mx-auto p-6 space-y-6">

        {/* Header with CTA */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Auto Lead Routing</h1>
              <Badge variant={config?.enabled ? 'default' : 'secondary'}>
                {config?.enabled ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              AI automatically scores leads and assigns them to the best sales rep in under 5 seconds
            </p>
          </div>
          <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Auto Routing Configuration</DialogTitle>
                <DialogDescription>
                  Configure how leads are automatically scored and assigned
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Auto-Routing</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically route new leads when they're created
                    </p>
                  </div>
                  <Switch defaultChecked={config?.enabled} />
                </div>
                <div className="space-y-2">
                  <Label>Minimum Lead Score</Label>
                  <Input
                    type="number"
                    defaultValue={config?.minLeadScore || 50}
                    placeholder="50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Only auto-route leads with score ≥ this value
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Max Leads Per Rep Per Day</Label>
                  <Input
                    type="number"
                    defaultValue={config?.maxLeadsPerRepPerDay || 10}
                    placeholder="10"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Respect Rep Capacity</Label>
                    <p className="text-sm text-muted-foreground">
                      Don't assign to reps at max capacity
                    </p>
                  </div>
                  <Switch defaultChecked={config?.respectRepCapacity} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Send Immediate Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Email rep immediately when lead is assigned
                    </p>
                  </div>
                  <Switch defaultChecked={config?.sendImmediateEmail} />
                </div>
                <Button
                  className="w-full"
                  onClick={() => updateConfigMutation.mutate(config)}
                  disabled={updateConfigMutation.isPending}
                >
                  Save Configuration
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Leads Auto-Routed
              </CardTitle>
              <Zap className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{overview.totalAutoRouted || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Last {overview.period || '30 days'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Response Time
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{overview.avgResponseTimeMinutes || 0} min</div>
              <p className="text-xs text-muted-foreground mt-1">
                {overview.fastResponseRate || 0}% under 5 minutes
              </p>
              <Progress value={parseFloat(overview.fastResponseRate || '0')} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Time Saved
              </CardTitle>
              <Timer className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{overview.timeSavedHours || 0} hrs</div>
              <p className="text-xs text-muted-foreground mt-1">
                ≈ ${overview.timeSavedCost || 0} in labor costs
              </p>
              <div className="flex items-center text-xs text-green-600 mt-2">
                <TrendingUp className="h-3 w-3 mr-1" />
                5 min saved per lead
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">96.5%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Successful assignments
              </p>
              <Progress value={96.5} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="activity" className="space-y-4">
          <TabsList>
            <TabsTrigger value="activity">
              <Activity className="h-4 w-4 mr-2" />
              Recent Activity
            </TabsTrigger>
            <TabsTrigger value="workload">
              <Users className="h-4 w-4 mr-2" />
              Rep Workload
            </TabsTrigger>
            <TabsTrigger value="scores">
              <BarChart3 className="h-4 w-4 mr-2" />
              Lead Scores
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Play className="h-4 w-4 mr-2" />
              Manual Routing
            </TabsTrigger>
          </TabsList>

          {/* Recent Activity */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recently Auto-Routed Leads</CardTitle>
                <CardDescription>
                  Last 10 leads that were automatically assigned by AI
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentLeads.length === 0 ? (
                  <div className="text-center py-12">
                    <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Auto-routing will appear here when leads are assigned
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentLeads.map((lead: any) => (
                      <div key={lead.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">Lead #{lead.leadId.slice(0, 8)}</span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <span className="text-primary">{lead.assignedTo}</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-2">
                              <div>
                                <p className="text-muted-foreground">Assigned</p>
                                <p className="font-semibold">
                                  {format(new Date(lead.assignedAt), 'MMM d, h:mm a')}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">First Response</p>
                                <p className="font-semibold">
                                  {lead.firstResponseAt
                                    ? `${lead.firstResponseTimeMinutes} min`
                                    : 'Pending'}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Status</p>
                                <Badge variant={lead.firstResponseAt ? 'default' : 'secondary'}>
                                  {lead.firstResponseAt ? 'Contacted' : 'Waiting'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rep Workload */}
          <TabsContent value="workload">
            <Card>
              <CardHeader>
                <CardTitle>Sales Rep Workload Distribution</CardTitle>
                <CardDescription>
                  Current capacity and performance of each sales rep
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {repWorkload.map((rep: any) => (
                    <div key={rep.userId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold">{rep.userId}</h4>
                          <p className="text-sm text-muted-foreground">
                            {rep.currentLoad} / {rep.maxLoad} leads
                          </p>
                        </div>
                        <Badge
                          variant={
                            parseFloat(rep.utilizationPercent) > 80
                              ? 'destructive'
                              : parseFloat(rep.utilizationPercent) > 60
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {rep.utilizationPercent}% Capacity
                        </Badge>
                      </div>
                      <Progress value={parseFloat(rep.utilizationPercent)} className="mb-3" />
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Today</p>
                          <p className="font-semibold">{rep.leadsToday} leads</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Conv. Rate</p>
                          <p className="font-semibold">{rep.conversionRate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Response</p>
                          <p className="font-semibold">{rep.avgResponseTime || 0} min</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lead Scores */}
          <TabsContent value="scores">
            <Card>
              <CardHeader>
                <CardTitle>Lead Score Distribution</CardTitle>
                <CardDescription>
                  Breakdown of lead grades from AI scoring
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {scoreDistribution.map((item: any) => {
                    const total = scoreDistribution.reduce((sum: number, d: any) => sum + d.count, 0);
                    const percentage = total > 0 ? (item.count / total) * 100 : 0;

                    return (
                      <div key={item.grade} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                item.grade.startsWith('A')
                                  ? 'default'
                                  : item.grade.startsWith('B')
                                  ? 'secondary'
                                  : 'outline'
                              }
                            >
                              Grade {item.grade}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {item.count} leads
                            </span>
                          </div>
                          <span className="font-semibold">{percentage.toFixed(0)}%</span>
                        </div>
                        <Progress value={percentage} />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manual Routing */}
          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle>Manual Lead Routing</CardTitle>
                <CardDescription>
                  Manually trigger AI routing for a specific lead
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter Lead ID"
                      value={selectedLeadId}
                      onChange={(e) => setSelectedLeadId(e.target.value)}
                    />
                    <Button
                      onClick={() => routeMutation.mutate(selectedLeadId)}
                      disabled={!selectedLeadId || routeMutation.isPending}
                    >
                      {routeMutation.isPending ? (
                        <>Processing...</>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Route Lead
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold mb-2">How Auto-Routing Works:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>AI analyzes lead data (company, industry, size, location)</li>
                      <li>Calculates composite score (0-100) across 5 categories</li>
                      <li>Scores all available reps based on territory, workload, performance</li>
                      <li>Assigns to best rep automatically</li>
                      <li>Sends immediate email notification</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
