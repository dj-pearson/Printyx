import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wrench,
  Clock,
  Zap,
  Package,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface EquipmentHealth {
  equipmentId: string;
  serialNumber: string;
  make: string;
  model: string;
  customerName: string;
  customerId: string;
  location: string;
  lastServiceDate: string | null;
  daysSinceService: number;
  nextServiceDue: string;
  daysUntilDue: number;
  healthScore: number;
  meterReading: number;
  recommendedPages: number;
  urgency: 'overdue' | 'urgent' | 'soon' | 'scheduled';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  estimatedIssues?: string[];
  aiPrediction?: {
    failureRisk: number;
    daysUntilFailure: number | null;
    recommendations: string[];
  };
}

interface DashboardOverview {
  totalEquipment: number;
  devicesMonitored: number;
  devicesAtRisk: number;
  overdueCount: number;
  urgentCount: number;
  soonCount: number;
  scheduledCount: number;
  averageHealthScore: number;
  preventableEmergencies: number;
  downtimePreventedHours: number;
  costSavings: number;
  uptimeImprovement: string;
  period: string;
}

interface PartsForecast {
  partName: string;
  category: string;
  quantity: number;
  priority: string;
  estimatedCost: number;
  devices: string[];
}

export default function PredictiveMaintenanceHub() {
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentHealth | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  // Fetch dashboard data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/predictive-maintenance/dashboard'],
    refetchInterval: 300000, // 5 minutes
  });

  // Fetch parts forecast
  const { data: partsForecast } = useQuery({
    queryKey: ['/api/predictive-maintenance/parts-forecast'],
    enabled: selectedTab === 'parts',
  });

  const overview: DashboardOverview | undefined = data?.overview;
  const equipment: EquipmentHealth[] = data?.equipment || [];

  // Filter equipment based on urgency
  const filteredEquipment =
    filterUrgency === 'all' ? equipment : equipment.filter((e) => e.urgency === filterUrgency);

  // Schedule maintenance mutation
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEquipment) return;

      return apiRequest(`/api/predictive-maintenance/${selectedEquipment.equipmentId}/schedule`, {
        method: 'POST',
        body: JSON.stringify({
          scheduledDate,
          priority,
          notes,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Maintenance Scheduled',
        description: 'Predictive maintenance ticket has been created successfully.',
      });
      setScheduleDialogOpen(false);
      setSelectedEquipment(null);
      setScheduledDate('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['/api/predictive-maintenance/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Scheduling Failed',
        description: error.message || 'Failed to schedule maintenance',
        variant: 'destructive',
      });
    },
  });

  // Analyze fleet mutation
  const analyzeFleetMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/predictive-maintenance/analyze-fleet', {
        method: 'POST',
      }),
    onSuccess: (data: any) => {
      toast({
        title: 'Fleet Analysis Complete',
        description: `Analyzed ${data.analyzed} devices. ${data.dispatchesCreated} maintenance tasks auto-scheduled.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/predictive-maintenance/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Failed to analyze fleet',
        variant: 'destructive',
      });
    },
  });

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      case 'urgent':
        return (
          <Badge variant="default" className="bg-orange-500">
            Urgent
          </Badge>
        );
      case 'soon':
        return <Badge variant="secondary">Due Soon</Badge>;
      case 'scheduled':
        return (
          <Badge variant="outline" className="text-green-600">
            Scheduled
          </Badge>
        );
      default:
        return <Badge variant="outline">{urgency}</Badge>;
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    if (score >= 25) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">High Risk</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium Risk</Badge>;
      case 'low':
        return (
          <Badge variant="outline" className="text-green-600">
            Low Risk
          </Badge>
        );
      default:
        return <Badge variant="outline">{riskLevel}</Badge>;
    }
  };

  const handleScheduleClick = (equip: EquipmentHealth) => {
    setSelectedEquipment(equip);
    setScheduleDialogOpen(true);
  };

  // Prepare chart data
  const urgencyChartData = [
    { name: 'Overdue', value: overview?.overdueCount || 0, color: '#ef4444' },
    { name: 'Urgent', value: overview?.urgentCount || 0, color: '#f97316' },
    { name: 'Due Soon', value: overview?.soonCount || 0, color: '#eab308' },
    { name: 'Scheduled', value: overview?.scheduledCount || 0, color: '#22c55e' },
  ];

  const healthDistribution = [
    {
      range: '85-100',
      count: equipment.filter((e) => e.healthScore >= 85).length,
      color: '#22c55e',
    },
    {
      range: '70-84',
      count: equipment.filter((e) => e.healthScore >= 70 && e.healthScore < 85).length,
      color: '#3b82f6',
    },
    {
      range: '50-69',
      count: equipment.filter((e) => e.healthScore >= 50 && e.healthScore < 70).length,
      color: '#eab308',
    },
    {
      range: '25-49',
      count: equipment.filter((e) => e.healthScore >= 25 && e.healthScore < 50).length,
      color: '#f97316',
    },
    {
      range: '0-24',
      count: equipment.filter((e) => e.healthScore < 25).length,
      color: '#ef4444',
    },
  ];

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading Predictive Maintenance Hub...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Predictive Maintenance Hub</h1>
            <p className="text-muted-foreground">
              AI-powered equipment health monitoring and proactive service scheduling
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => analyzeFleetMutation.mutate()}
              disabled={analyzeFleetMutation.isPending}
            >
              <Zap className="h-4 w-4 mr-2" />
              {analyzeFleetMutation.isPending ? 'Analyzing Fleet...' : 'AI Fleet Analysis'}
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Devices Monitored
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{overview?.devicesMonitored || 0}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {overview?.devicesAtRisk || 0} at risk
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Fleet Health Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-3xl font-bold ${getHealthScoreColor(overview?.averageHealthScore || 0)}`}
              >
                {overview?.averageHealthScore || 0}%
              </div>
              <Progress value={overview?.averageHealthScore || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Downtime Prevented
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {overview?.downtimePreventedHours || 0}h
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {overview?.preventableEmergencies || 0} emergencies avoided
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cost Savings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">${overview?.costSavings || 0}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {overview?.uptimeImprovement || '0.00%'} uptime improvement
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">
              <Activity className="h-4 w-4 mr-2" />
              Fleet Health
            </TabsTrigger>
            <TabsTrigger value="schedule">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule ({overview?.overdueCount || 0} + {overview?.urgentCount || 0} urgent)
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <TrendingUp className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="parts">
              <Package className="h-4 w-4 mr-2" />
              Parts Forecast
            </TabsTrigger>
          </TabsList>

          {/* Fleet Health Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Equipment Health Overview</CardTitle>
                  <Select value={filterUrgency} onValueChange={setFilterUrgency}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by urgency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Equipment</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="soon">Due Soon</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Health Score</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Next Service</TableHead>
                      <TableHead>AI Prediction</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEquipment.map((equip) => (
                      <TableRow key={equip.equipmentId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {equip.make} {equip.model}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {equip.serialNumber}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{equip.customerName}</div>
                            <div className="text-sm text-muted-foreground">{equip.location}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-lg font-bold ${getHealthScoreColor(equip.healthScore)}`}
                            >
                              {equip.healthScore}%
                            </span>
                            <Progress value={equip.healthScore} className="w-20" />
                          </div>
                        </TableCell>
                        <TableCell>{getRiskBadge(equip.riskLevel)}</TableCell>
                        <TableCell>
                          <div>
                            {getUrgencyBadge(equip.urgency)}
                            <div className="text-sm text-muted-foreground mt-1">
                              {equip.daysUntilDue > 0
                                ? `in ${equip.daysUntilDue} days`
                                : `${Math.abs(equip.daysUntilDue)} days overdue`}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {equip.aiPrediction ? (
                            <div className="text-sm">
                              <div className="font-medium text-red-600">
                                {equip.aiPrediction.failureRisk}% failure risk
                              </div>
                              {equip.aiPrediction.daysUntilFailure && (
                                <div className="text-muted-foreground">
                                  ~{equip.aiPrediction.daysUntilFailure} days until failure
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No data</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => handleScheduleClick(equip)}>
                            <Calendar className="h-4 w-4 mr-1" />
                            Schedule
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Requires Immediate Attention</CardTitle>
                  <CardDescription>
                    {(overview?.overdueCount || 0) + (overview?.urgentCount || 0)} devices
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {equipment
                      .filter((e) => e.urgency === 'overdue' || e.urgency === 'urgent')
                      .slice(0, 5)
                      .map((equip) => (
                        <div
                          key={equip.equipmentId}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div className="flex-1">
                            <div className="font-medium">
                              {equip.make} {equip.model}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {equip.customerName}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getUrgencyBadge(equip.urgency)}
                            <Button size="sm" onClick={() => handleScheduleClick(equip)}>
                              Schedule Now
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Maintenance</CardTitle>
                  <CardDescription>
                    {overview?.soonCount || 0} devices due within 30 days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {equipment
                      .filter((e) => e.urgency === 'soon')
                      .slice(0, 5)
                      .map((equip) => (
                        <div
                          key={equip.equipmentId}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div className="flex-1">
                            <div className="font-medium">
                              {equip.make} {equip.model}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Due in {equip.daysUntilDue} days
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleScheduleClick(equip)}
                          >
                            Schedule
                          </Button>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Urgency Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={urgencyChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {urgencyChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Health Score Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={healthDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6">
                        {healthDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Parts Forecast Tab */}
          <TabsContent value="parts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Parts Forecast - Next 30 Days</CardTitle>
                <CardDescription>
                  Predicted parts needed based on equipment health analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {partsForecast?.forecast && partsForecast.forecast.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="border rounded p-3">
                        <div className="text-sm text-muted-foreground">Total Parts</div>
                        <div className="text-2xl font-bold">{partsForecast.summary.totalParts}</div>
                      </div>
                      <div className="border rounded p-3">
                        <div className="text-sm text-muted-foreground">Unique Parts</div>
                        <div className="text-2xl font-bold">
                          {partsForecast.summary.uniqueParts}
                        </div>
                      </div>
                      <div className="border rounded p-3">
                        <div className="text-sm text-muted-foreground">Estimated Cost</div>
                        <div className="text-2xl font-bold text-green-600">
                          ${partsForecast.summary.totalEstimatedCost}
                        </div>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Quantity Needed</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Estimated Cost</TableHead>
                          <TableHead>Devices</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partsForecast.forecast.map((part: PartsForecast, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{part.partName}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{part.category}</Badge>
                            </TableCell>
                            <TableCell className="font-bold">{part.quantity}</TableCell>
                            <TableCell>
                              {part.priority === 'critical' && (
                                <Badge variant="destructive">Critical</Badge>
                              )}
                              {part.priority === 'urgent' && (
                                <Badge className="bg-orange-500">Urgent</Badge>
                              )}
                              {part.priority === 'high' && (
                                <Badge className="bg-yellow-500">High</Badge>
                              )}
                              {part.priority === 'medium' && (
                                <Badge variant="secondary">Medium</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-green-600">
                              ${part.estimatedCost}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {part.devices.length} devices
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No parts forecast available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Schedule Maintenance Dialog */}
        <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Predictive Maintenance</DialogTitle>
              <DialogDescription>
                {selectedEquipment && (
                  <>
                    {selectedEquipment.make} {selectedEquipment.model} -{' '}
                    {selectedEquipment.serialNumber}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="scheduledDate">Scheduled Date</Label>
                <Input
                  id="scheduledDate"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any additional notes or instructions..."
                  rows={3}
                />
              </div>
              {selectedEquipment?.aiPrediction && (
                <div className="border rounded p-3 bg-muted/50">
                  <div className="text-sm font-medium mb-2">AI Recommendations:</div>
                  <ul className="text-sm space-y-1">
                    {selectedEquipment.aiPrediction.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => scheduleMutation.mutate()}
                  disabled={!scheduledDate || scheduleMutation.isPending}
                >
                  {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule Maintenance'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
