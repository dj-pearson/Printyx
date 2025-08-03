import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Clock, AlertTriangle, CheckCircle, Settings, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// Types
type MaintenanceSchedule = {
  id: string;
  schedule_name: string;
  schedule_type: 'time_based' | 'meter_based' | 'event_based';
  frequency: string;
  frequency_value: number;
  next_service_date: string;
  last_service_date?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_active: boolean;
  equipment_id?: string;
  customer_id?: string;
  business_record_id?: string;
  estimated_cost?: number;
  service_duration_minutes: number;
  equipment_name?: string;
  customer_name?: string;
  business_record_name?: string;
  created_at: string;
};

type DueSchedule = {
  id: string;
  schedule_name: string;
  next_service_date: string;
  priority: string;
  equipment_name?: string;
  customer_name?: string;
  business_record_name?: string;
  estimated_cost?: number;
  is_overdue: boolean;
};

type MaintenanceAnalytics = {
  totalSchedules: number;
  activeSchedules: number;
  overdueSchedules: number;
  dueThisWeek: number;
};

// Form Schema
const maintenanceScheduleSchema = z.object({
  scheduleName: z.string().min(1, "Schedule name is required"),
  scheduleType: z.enum(['time_based', 'meter_based', 'event_based']),
  frequency: z.string().min(1, "Frequency is required"),
  frequencyValue: z.number().min(1, "Frequency value must be at least 1"),
  nextServiceDate: z.string().min(1, "Next service date is required"),
  equipmentId: z.string().optional(),
  customerId: z.string().optional(),
  businessRecordId: z.string().optional(),
  estimatedCost: z.number().optional(),
  serviceDuration: z.number().min(15, "Service duration must be at least 15 minutes"),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  advanceNotificationDays: z.number().min(0, "Advance notification days must be 0 or more"),
  customerNotification: z.boolean(),
  technicianNotification: z.boolean(),
});

type MaintenanceScheduleForm = z.infer<typeof maintenanceScheduleSchema>;

export default function PreventiveMaintenanceScheduling() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  
  const queryClient = useQueryClient();

  // Fetch maintenance analytics
  const { data: analytics } = useQuery<MaintenanceAnalytics>({
    queryKey: ["/api/maintenance/analytics/overview"],
  });

  // Fetch maintenance schedules
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<MaintenanceSchedule[]>({
    queryKey: ["/api/maintenance/schedules", filterStatus, filterPriority],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterPriority !== "all") params.append("priority", filterPriority);
      return apiRequest(`/api/maintenance/schedules?${params.toString()}`);
    },
  });

  // Fetch due schedules
  const { data: dueSchedules = [] } = useQuery<DueSchedule[]>({
    queryKey: ["/api/maintenance/schedules/due"],
  });

  // Fetch business records for dropdown
  const { data: businessRecords = [] } = useQuery({
    queryKey: ["/api/business-records"],
  });

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: (data: MaintenanceScheduleForm) =>
      apiRequest("/api/maintenance/schedules", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/analytics/overview"] });
      setIsCreateDialogOpen(false);
    },
  });

  // Form setup
  const form = useForm<MaintenanceScheduleForm>({
    resolver: zodResolver(maintenanceScheduleSchema),
    defaultValues: {
      scheduleType: "time_based",
      frequency: "monthly",
      frequencyValue: 1,
      serviceDuration: 60,
      priority: "medium",
      advanceNotificationDays: 7,
      customerNotification: true,
      technicianNotification: true,
    },
  });

  const onSubmit = (data: MaintenanceScheduleForm) => {
    createScheduleMutation.mutate(data);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'default';
      case 'low': return 'outline';
      default: return 'default';
    }
  };

  const getStatusColor = (isOverdue: boolean, nextServiceDate: string) => {
    if (isOverdue) return 'destructive';
    const daysUntilService = Math.ceil((new Date(nextServiceDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilService <= 3) return 'secondary';
    if (daysUntilService <= 7) return 'default';
    return 'outline';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Preventive Maintenance Scheduling</h1>
          <p className="text-muted-foreground mt-2">
            Manage equipment maintenance schedules and ensure optimal performance
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Maintenance Schedule</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduleName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schedule Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Monthly printer maintenance" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="scheduleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schedule Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="time_based">Time-based</SelectItem>
                            <SelectItem value="meter_based">Meter-based</SelectItem>
                            <SelectItem value="event_based">Event-based</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annually">Annually</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="frequencyValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Every X Periods</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            placeholder="1" 
                            {...field}
                            onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nextServiceDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Next Service Date</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="businessRecordId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer/Company</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {businessRecords.map((record: any) => (
                              <SelectItem key={record.id} value={record.id}>
                                {record.companyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="serviceDuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="15" 
                            placeholder="60" 
                            {...field}
                            onChange={e => field.onChange(parseInt(e.target.value) || 60)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estimatedCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Cost</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            {...field}
                            onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex space-x-4">
                  <FormField
                    control={form.control}
                    name="customerNotification"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Notify Customer</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="technicianNotification"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Notify Technician</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createScheduleMutation.isPending}>
                    {createScheduleMutation.isPending ? "Creating..." : "Create Schedule"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="schedules">All Schedules</TabsTrigger>
          <TabsTrigger value="due">Due & Overdue</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalSchedules || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.activeSchedules || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Due This Week</CardTitle>
                <Clock className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.dueThisWeek || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{analytics?.overdueSchedules || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Due Schedules */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming & Overdue Maintenance</CardTitle>
            </CardHeader>
            <CardContent>
              {dueSchedules.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No maintenance scheduled for the next 7 days
                </p>
              ) : (
                <div className="space-y-3">
                  {dueSchedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{schedule.schedule_name}</h3>
                          <Badge variant={getPriorityColor(schedule.priority)}>
                            {schedule.priority}
                          </Badge>
                          <Badge variant={getStatusColor(schedule.is_overdue, schedule.next_service_date)}>
                            {schedule.is_overdue ? 'Overdue' : 'Due Soon'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {schedule.equipment_name || schedule.customer_name || schedule.business_record_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {format(new Date(schedule.next_service_date), 'MMM dd, yyyy')}
                        </p>
                        {schedule.estimated_cost && (
                          <p className="text-sm text-muted-foreground">
                            ${schedule.estimated_cost.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-6">
          {/* Filters */}
          <div className="flex space-x-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Schedules Table */}
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Schedules</CardTitle>
            </CardHeader>
            <CardContent>
              {schedulesLoading ? (
                <p className="text-center py-8">Loading schedules...</p>
              ) : schedules.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No maintenance schedules found
                </p>
              ) : (
                <div className="space-y-4">
                  {schedules.map((schedule) => (
                    <div key={schedule.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{schedule.schedule_name}</h3>
                            <Badge variant={getPriorityColor(schedule.priority)}>
                              {schedule.priority}
                            </Badge>
                            <Badge variant={schedule.is_active ? "default" : "secondary"}>
                              {schedule.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Frequency: Every {schedule.frequency_value} {schedule.frequency}</p>
                            <p>Duration: {schedule.service_duration_minutes} minutes</p>
                            {schedule.equipment_name && <p>Equipment: {schedule.equipment_name}</p>}
                            {schedule.customer_name && <p>Customer: {schedule.customer_name}</p>}
                            {schedule.business_record_name && <p>Company: {schedule.business_record_name}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          {schedule.next_service_date && (
                            <p className="font-medium">
                              Next: {format(new Date(schedule.next_service_date), 'MMM dd, yyyy HH:mm')}
                            </p>
                          )}
                          {schedule.estimated_cost && (
                            <p className="text-sm text-muted-foreground">
                              Cost: ${schedule.estimated_cost.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="due" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Due & Overdue Maintenance</CardTitle>
            </CardHeader>
            <CardContent>
              {dueSchedules.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No maintenance due in the next 7 days
                </p>
              ) : (
                <div className="space-y-4">
                  {dueSchedules.map((schedule) => (
                    <div key={schedule.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{schedule.schedule_name}</h3>
                            <Badge variant={getPriorityColor(schedule.priority)}>
                              {schedule.priority}
                            </Badge>
                            <Badge variant={getStatusColor(schedule.is_overdue, schedule.next_service_date)}>
                              {schedule.is_overdue ? 'Overdue' : 'Due Soon'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {schedule.equipment_name || schedule.customer_name || schedule.business_record_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${schedule.is_overdue ? 'text-red-600' : ''}`}>
                            {format(new Date(schedule.next_service_date), 'MMM dd, yyyy HH:mm')}
                          </p>
                          {schedule.estimated_cost && (
                            <p className="text-sm text-muted-foreground">
                              ${schedule.estimated_cost.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}