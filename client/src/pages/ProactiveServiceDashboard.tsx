import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  RefreshCw,
  AlertTriangle,
  Calendar,
  Wrench,
  TrendingDown,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface EquipmentMaintenanceItem {
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
  estimatedIssues?: string[];
}

interface MaintenanceSummary {
  totalEquipment: number;
  overdueCount: number;
  urgentCount: number;
  soonCount: number;
  scheduledCount: number;
  averageHealthScore: number;
  preventableEmergencies: number;
}

export default function ProactiveServiceDashboard() {
  const [selectedTab, setSelectedTab] = useState<'overdue' | 'urgent' | 'soon' | 'scheduled' | 'all'>('overdue');
  const [schedulingEquipment, setSchedulingEquipment] = useState<string | null>(null);

  // Fetch proactive maintenance data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/service/proactive-maintenance'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const summary: MaintenanceSummary | undefined = data?.summary;
  const equipment: EquipmentMaintenanceItem[] = data?.equipment || [];

  const handleScheduleService = async (equipmentId: string) => {
    setSchedulingEquipment(equipmentId);
    try {
      // In production, this would create a service ticket
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Service scheduled for equipment:', equipmentId);
      refetch();
    } catch (err) {
      console.error('Error scheduling service:', err);
      alert('Failed to schedule service. Please try again.');
    } finally {
      setSchedulingEquipment(null);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      case 'urgent':
        return <Badge variant="default" className="bg-orange-500">Urgent - Within 7 Days</Badge>;
      case 'soon':
        return <Badge variant="secondary">Due Soon - 8-30 Days</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="text-green-600">Scheduled</Badge>;
      default:
        return <Badge variant="outline">{urgency}</Badge>;
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthScoreProgress = (score: number) => {
    if (score >= 80) return 'bg-green-600';
    if (score >= 60) return 'bg-yellow-600';
    if (score >= 40) return 'bg-orange-600';
    return 'bg-red-600';
  };

  const getEquipmentByTab = () => {
    switch (selectedTab) {
      case 'overdue':
        return equipment.filter(e => e.urgency === 'overdue');
      case 'urgent':
        return equipment.filter(e => e.urgency === 'urgent');
      case 'soon':
        return equipment.filter(e => e.urgency === 'soon');
      case 'scheduled':
        return equipment.filter(e => e.urgency === 'scheduled');
      case 'all':
        return equipment;
      default:
        return [];
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Maintenance Data</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load proactive maintenance data'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const displayEquipment = getEquipmentByTab();

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proactive Service Scheduling</h1>
          <p className="text-muted-foreground">
            Prevent emergencies with predictive maintenance scheduling
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Service</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {summary?.overdueCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due This Week</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {summary?.urgentCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Schedule within 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Health Score</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthScoreColor(summary?.averageHealthScore || 0)}`}>
              {summary?.averageHealthScore?.toFixed(0) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Fleet-wide equipment health
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prevented Issues</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary?.preventableEmergencies || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              This month via proactive PM
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts Banner */}
      {summary && summary.overdueCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Urgent Maintenance Required</AlertTitle>
          <AlertDescription>
            {summary.overdueCount} equipment unit{summary.overdueCount !== 1 ? 's' : ''} overdue for
            service. Schedule immediately to prevent equipment failure and emergency calls.
          </AlertDescription>
        </Alert>
      )}

      {/* Equipment Tabs and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Equipment Maintenance Schedule</CardTitle>
          <CardDescription>
            Review and schedule proactive maintenance for your equipment fleet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overdue">
                Overdue ({summary?.overdueCount || 0})
              </TabsTrigger>
              <TabsTrigger value="urgent">
                Urgent ({summary?.urgentCount || 0})
              </TabsTrigger>
              <TabsTrigger value="soon">
                Soon ({summary?.soonCount || 0})
              </TabsTrigger>
              <TabsTrigger value="scheduled">
                Scheduled ({summary?.scheduledCount || 0})
              </TabsTrigger>
              <TabsTrigger value="all">
                All ({summary?.totalEquipment || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-6">
              {displayEquipment.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No equipment in this category</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead>Last Service</TableHead>
                        <TableHead>Next Due</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayEquipment.map((item) => (
                        <TableRow key={item.equipmentId}>
                          <TableCell>
                            <div className="font-medium">{item.make} {item.model}</div>
                            <div className="text-sm text-muted-foreground">
                              SN: {item.serialNumber}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>{item.customerName}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.location}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={item.healthScore}
                                className="w-16 h-2"
                                // @ts-ignore
                                indicatorClassName={getHealthScoreProgress(item.healthScore)}
                              />
                              <span className={`text-sm font-medium ${getHealthScoreColor(item.healthScore)}`}>
                                {item.healthScore}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.lastServiceDate ? (
                              <>
                                <div>{formatDate(new Date(item.lastServiceDate))}</div>
                                <div className="text-sm text-muted-foreground">
                                  {item.daysSinceService} days ago
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Never serviced</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className={
                              item.daysUntilDue <= 0
                                ? 'text-destructive font-semibold'
                                : item.daysUntilDue <= 7
                                ? 'text-orange-600 font-semibold'
                                : ''
                            }>
                              {item.daysUntilDue <= 0 ? 'OVERDUE' : `${item.daysUntilDue} days`}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(new Date(item.nextServiceDue))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getUrgencyBadge(item.urgency)}
                            {item.estimatedIssues && item.estimatedIssues.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {item.estimatedIssues[0]}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.urgency !== 'scheduled' && (
                              <Button
                                size="sm"
                                onClick={() => handleScheduleService(item.equipmentId)}
                                disabled={schedulingEquipment === item.equipmentId}
                              >
                                {schedulingEquipment === item.equipmentId ? (
                                  <>
                                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                    Scheduling...
                                  </>
                                ) : (
                                  <>
                                    <Calendar className="h-3 w-3 mr-1" />
                                    Schedule
                                  </>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
