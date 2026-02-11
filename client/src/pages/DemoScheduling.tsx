import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  AlertCircle,
  Plus,
  CalendarCheck,
  Play,
  TrendingUp,
  MoreHorizontal,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/ui/empty-state';
import MobileFAB from '@/components/layout/MobileFAB';
import { relativeFuture, relativeDate } from '@/lib/date-utils';
import { CalendarProvider } from '@/components/calendar/CalendarProvider';

interface DemoSchedule {
  id: string;
  businessRecordId: string;
  customerName: string;
  contactPerson: string;
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  demoType: string;
  equipmentModels: string[];
  demoLocation: string;
  assignedSalesRep: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  confirmationStatus: 'pending' | 'confirmed' | 'declined';
  preparationCompleted: boolean;
  demoObjectives?: string;
  proposalAmount?: number;
  contactEmail?: string;
  createdAt: Date;
}

interface Customer {
  id: string;
  companyName: string;
  primaryContactName: string;
  phone: string;
  email: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
}

type QuickFilter = 'all' | 'today' | 'this_week' | 'upcoming' | 'completed';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'confirmed':
      return 'bg-green-100 text-green-800';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800';
    case 'completed':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

function DemoSchedulingContent() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const queryClient = useQueryClient();
  const { register, handleSubmit, setValue, reset } = useForm({
    defaultValues: {
      businessRecordId: '',
      demoType: '',
      scheduledDate: '',
      scheduledTime: '',
      duration: 60,
      equipmentModels: '',
      demoLocation: '',
      assignedSalesRep: '',
      demoObjectives: '',
      proposalAmount: 0,
      demoAddress: '',
      customerRequirements: '',
    },
  });

  const { data: demos = [], isLoading } = useQuery({
    queryKey: ['/api/demos'],
    select: (data: any[]) =>
      data.map((demo) => ({
        ...demo,
        scheduledDate: new Date(demo.scheduledDate),
        createdAt: new Date(demo.createdAt),
      })),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/demos/customers'],
  });

  const createDemoMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/demos', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demos'] });
      setIsCreateDialogOpen(false);
      reset();
      toast({
        title: 'Demo Scheduled',
        description: 'The equipment demonstration has been scheduled successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to schedule demo. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, confirmationStatus }: any) =>
      apiRequest(`/api/demos/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, confirmationStatus }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demos'] });
      toast({ title: 'Status Updated', description: 'Demo status has been updated successfully.' });
    },
  });

  const onSubmit = (data: any) => {
    createDemoMutation.mutate({
      ...data,
      equipmentModels: data.equipmentModels
        ? data.equipmentModels.split(',').map((m: string) => m.trim())
        : [],
      proposalAmount: data.proposalAmount ? parseFloat(data.proposalAmount) : null,
      duration: parseInt(data.duration) || 60,
    });
  };

  const handleStatusChange = (id: string, status: string) => {
    updateStatusMutation.mutate({
      id,
      status,
      confirmationStatus: status === 'confirmed' ? 'confirmed' : 'pending',
    });
  };

  // KPI stats
  const kpiStats = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const scheduledThisWeek = demos.filter((d) => {
      const date = new Date(d.scheduledDate);
      return date >= weekStart && date < weekEnd && d.status !== 'cancelled';
    }).length;

    const upcoming = demos.filter(
      (d) =>
        new Date(d.scheduledDate) >= now && d.status !== 'cancelled' && d.status !== 'completed',
    ).length;

    const completedThisMonth = demos.filter((d) => {
      const date = new Date(d.scheduledDate);
      return date >= monthStart && d.status === 'completed';
    }).length;

    const totalCompleted = demos.filter((d) => d.status === 'completed').length;
    const totalDemos = demos.filter((d) => d.status !== 'cancelled').length;
    const conversionRate = totalDemos > 0 ? Math.round((totalCompleted / totalDemos) * 100) : 0;

    return { scheduledThisWeek, upcoming, completedThisMonth, conversionRate };
  }, [demos]);

  // Filter demos
  const filteredDemos = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);

    switch (quickFilter) {
      case 'today':
        return demos.filter((d) => {
          const date = new Date(d.scheduledDate);
          return date >= today && date < tomorrow;
        });
      case 'this_week':
        return demos.filter((d) => {
          const date = new Date(d.scheduledDate);
          return date >= today && date < weekEnd && d.status !== 'cancelled';
        });
      case 'upcoming':
        return demos.filter(
          (d) =>
            new Date(d.scheduledDate) >= now &&
            d.status !== 'cancelled' &&
            d.status !== 'completed',
        );
      case 'completed':
        return demos.filter((d) => d.status === 'completed');
      default:
        return demos;
    }
  }, [demos, quickFilter]);

  const quickFilterTabs: { key: QuickFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'this_week', label: 'This Week' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
  ];

  // Get the next action button for a demo based on status
  const getNextAction = (demo: DemoSchedule) => {
    switch (demo.status) {
      case 'scheduled':
        return (
          <Button
            size="sm"
            onClick={() => handleStatusChange(demo.id, 'confirmed')}
            disabled={updateStatusMutation.isPending}
          >
            <CheckCircle className="h-3 w-3 mr-1" /> Confirm
          </Button>
        );
      case 'confirmed':
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusChange(demo.id, 'in_progress')}
            disabled={updateStatusMutation.isPending}
          >
            <Play className="h-3 w-3 mr-1" /> Start
          </Button>
        );
      case 'in_progress':
        return (
          <Button
            size="sm"
            onClick={() => handleStatusChange(demo.id, 'completed')}
            disabled={updateStatusMutation.isPending}
          >
            <CheckCircle className="h-3 w-3 mr-1" /> Complete
          </Button>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-12 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.scheduledThisWeek}</div>
              <p className="text-xs text-muted-foreground">Scheduled demos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
              <CalendarCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.upcoming}</div>
              <p className="text-xs text-muted-foreground">Pending demos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.completedThisMonth}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.conversionRate}%</div>
              <p className="text-xs text-muted-foreground">Of all demos</p>
            </CardContent>
          </Card>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Demo Scheduling</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Manage equipment demonstrations and customer meetings
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="hidden sm:flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Schedule Demo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule Equipment Demo</DialogTitle>
                <DialogDescription>
                  Create a new equipment demonstration appointment.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <Select onValueChange={(value) => setValue('businessRecordId', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Demo Type</Label>
                    <Select onValueChange={(value) => setValue('demoType', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equipment">Equipment Demo</SelectItem>
                        <SelectItem value="presentation">Presentation</SelectItem>
                        <SelectItem value="trial">Trial Period</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" {...register('scheduledDate', { required: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input type="time" {...register('scheduledTime', { required: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min)</Label>
                    <Input type="number" placeholder="60" {...register('duration')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Equipment Models</Label>
                  <Input
                    placeholder="Canon imageRUNNER, Xerox VersaLink..."
                    {...register('equipmentModels')}
                  />
                  <p className="text-xs text-gray-500">Separate multiple models with commas</p>
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select onValueChange={(value) => setValue('demoLocation', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer_site">Customer Site</SelectItem>
                      <SelectItem value="dealer_showroom">Dealer Showroom</SelectItem>
                      <SelectItem value="virtual">Virtual Demo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Expected Deal Value</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="15000.00"
                      {...register('proposalAmount')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address (if on-site)</Label>
                    <Input placeholder="123 Main St, City, State" {...register('demoAddress')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Demo Objectives</Label>
                  <Textarea
                    placeholder="What do you want to achieve?"
                    {...register('demoObjectives')}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createDemoMutation.isPending}>
                    {createDemoMutation.isPending ? 'Scheduling...' : 'Schedule Demo'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {quickFilterTabs.map((tab) => (
            <Button
              key={tab.key}
              variant={quickFilter === tab.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickFilter(tab.key)}
              className="touch-manipulation"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Demo Cards */}
        {filteredDemos.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={quickFilter !== 'all' ? 'No demos match this filter' : 'No Demos Scheduled'}
            description={
              quickFilter !== 'all'
                ? 'Try a different filter or schedule a new demo.'
                : 'Schedule your first equipment demonstration to get started.'
            }
            type={quickFilter !== 'all' ? 'search' : 'default'}
            action={{
              label: quickFilter !== 'all' ? 'Show All' : 'Schedule Demo',
              onClick: () =>
                quickFilter !== 'all' ? setQuickFilter('all') : setIsCreateDialogOpen(true),
              icon: quickFilter !== 'all' ? undefined : Plus,
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDemos.map((demo) => (
              <Card key={demo.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{demo.customerName}</CardTitle>
                      <CardDescription className="truncate">{demo.contactPerson}</CardDescription>
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      <Badge className={getStatusColor(demo.status)}>
                        {demo.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium">
                      {relativeFuture(demo.scheduledDate, demo.scheduledTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    {demo.scheduledTime} ({demo.duration} min)
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    {demo.demoLocation.replace('_', ' ')}
                  </div>

                  {demo.equipmentModels?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {demo.equipmentModels.map((model, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {model}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {demo.proposalAmount != null && demo.proposalAmount > 0 && (
                    <div className="text-sm">
                      <span className="font-medium">Expected Value: </span>$
                      {Number(demo.proposalAmount).toLocaleString()}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {demo.preparationCompleted ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="text-sm text-gray-600">
                      Prep {demo.preparationCompleted ? 'Complete' : 'Pending'}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    {getNextAction(demo)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reschedule
                        </DropdownMenuItem>
                        {demo.status !== 'cancelled' && demo.status !== 'completed' && (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleStatusChange(demo.id, 'cancelled')}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Mobile FAB */}
        <MobileFAB onClick={() => setIsCreateDialogOpen(true)} label="Schedule Demo" />
      </div>
    </MainLayout>
  );
}

export default function DemoScheduling() {
  return (
    <CalendarProvider>
      <DemoSchedulingContent />
    </CalendarProvider>
  );
}
