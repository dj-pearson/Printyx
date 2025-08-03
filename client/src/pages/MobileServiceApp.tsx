import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, Smartphone, MapPin, Wrench, Package, Calendar, Clock, User,
  CheckCircle, AlertTriangle, Navigation, Camera, FileText, Phone,
  Star, Truck, Download, Upload, Wifi, WifiOff, Battery, Signal,
  PlayCircle, PauseCircle, StopCircle, Route, Settings, Search
} from "lucide-react";
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
type MobileWorkOrder = {
  id: string;
  work_order_number: string;
  work_order_type: string;
  priority: string;
  customer_name?: string;
  service_address: string;
  scheduled_date?: string;
  scheduled_time_start?: string;
  assigned_technician_name?: string;
  problem_description: string;
  status: string;
  equipment_model?: string;
  site_contact_name?: string;
  site_contact_phone?: string;
  estimated_duration_hours: number;
  created_at: string;
};

type MobilePartsInventory = {
  id: string;
  part_number: string;
  part_name: string;
  part_description?: string;
  category: string;
  warehouse_quantity: number;
  truck_quantity: number;
  available_quantity: number;
  unit_cost: number;
  list_price: number;
  commonly_used: boolean;
  is_active: boolean;
  compatibility?: any;
  created_at: string;
};

type MobileFieldOrder = {
  id: string;
  order_number: string;
  order_type: string;
  technician_name?: string;
  order_date: string;
  requested_delivery_date?: string;
  delivery_method: string;
  status: string;
  urgency: string;
  total_amount: number;
  line_items_count?: number;
  tracking_number?: string;
  created_at: string;
};

type TechnicianLocation = {
  id: string;
  technician_name?: string;
  recorded_at: string;
  latitude?: number;
  longitude?: number;
  location_type?: string;
  work_order_number?: string;
  customer_name?: string;
  street_address?: string;
  device_battery_level?: number;
  created_at: string;
};

type MobileAppSession = {
  id: string;
  technician_name?: string;
  session_start: string;
  session_end?: string;
  device_type?: string;
  device_model?: string;
  connection_type?: string;
  work_orders_accessed?: any;
  parts_orders_created: number;
  photos_uploaded: number;
  offline_time_minutes: number;
  end_reason?: string;
  created_at: string;
};

type MobileMetrics = {
  activeWorkOrders: number;
  techniciansInField: number;
  pendingPartsOrders: number;
  averageResponseTime: number;
  completionRate: number;
  customerSatisfaction: number;
};

// Form Schemas
const workOrderSchema = z.object({
  work_order_type: z.enum(['service_call', 'installation', 'maintenance', 'repair', 'inspection']),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'emergency']),
  customer_id: z.string(),
  service_address: z.string().min(10, "Service address required"),
  assigned_technician_id: z.string(),
  problem_description: z.string().min(10, "Problem description required"),
  scheduled_date: z.string().optional(),
  scheduled_time_start: z.string().optional(),
  estimated_duration_hours: z.number().min(0.5).max(12),
  site_contact_name: z.string().optional(),
  site_contact_phone: z.string().optional(),
  access_instructions: z.string().optional(),
});

const partsOrderSchema = z.object({
  order_type: z.enum(['parts_request', 'emergency_order', 'stock_replenishment']),
  technician_id: z.string(),
  work_order_id: z.string().optional(),
  delivery_method: z.enum(['truck_delivery', 'warehouse_pickup', 'courier', 'customer_pickup']),
  urgency: z.enum(['standard', 'urgent', 'emergency']),
  delivery_address: z.string().optional(),
  requested_delivery_date: z.string().optional(),
  parts: z.array(z.object({
    part_id: z.string(),
    quantity: z.number().min(1),
    usage_reason: z.string(),
  })).min(1, "At least one part required"),
});

type WorkOrderForm = z.infer<typeof workOrderSchema>;
type PartsOrderForm = z.infer<typeof partsOrderSchema>;

export default function MobileServiceApp() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isWorkOrderDialogOpen, setIsWorkOrderDialogOpen] = useState(false);
  const [isPartsOrderDialogOpen, setIsPartsOrderDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedTechnician, setSelectedTechnician] = useState("all");
  
  const queryClient = useQueryClient();

  // Fetch mobile metrics
  const { data: metrics } = useQuery<MobileMetrics>({
    queryKey: ["/api/mobile/metrics"],
  });

  // Fetch mobile work orders
  const { data: workOrders = [], isLoading: workOrdersLoading } = useQuery<MobileWorkOrder[]>({
    queryKey: ["/api/mobile/work-orders", selectedStatus, selectedPriority, selectedTechnician],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      if (selectedPriority !== "all") params.append("priority", selectedPriority);
      if (selectedTechnician !== "all") params.append("technician", selectedTechnician);
      return await apiRequest(`/api/mobile/work-orders?${params.toString()}`);
    },
  });

  // Fetch parts inventory
  const { data: partsInventory = [], isLoading: partsLoading } = useQuery<MobilePartsInventory[]>({
    queryKey: ["/api/mobile/parts-inventory"],
  });

  // Fetch field orders
  const { data: fieldOrders = [], isLoading: ordersLoading } = useQuery<MobileFieldOrder[]>({
    queryKey: ["/api/mobile/field-orders"],
  });

  // Fetch technician locations
  const { data: locations = [], isLoading: locationsLoading } = useQuery<TechnicianLocation[]>({
    queryKey: ["/api/mobile/technician-locations"],
  });

  // Fetch app sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<MobileAppSession[]>({
    queryKey: ["/api/mobile/app-sessions"],
  });

  // Fetch technicians and customers for dropdowns
  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ["/api/technicians"],
  });

  const { data: businessRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/business-records"],
  });

  // Create work order mutation
  const createWorkOrderMutation = useMutation({
    mutationFn: async (data: WorkOrderForm) =>
      await apiRequest("/api/mobile/work-orders", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/work-orders"] });
      setIsWorkOrderDialogOpen(false);
    },
  });

  // Create parts order mutation
  const createPartsOrderMutation = useMutation({
    mutationFn: async (data: PartsOrderForm) =>
      await apiRequest("/api/mobile/field-orders", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/field-orders"] });
      setIsPartsOrderDialogOpen(false);
    },
  });

  // Sync mobile data mutation
  const syncDataMutation = useMutation({
    mutationFn: async () =>
      await apiRequest("/api/mobile/sync", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/technician-locations"] });
    },
  });

  // Form setup
  const workOrderForm = useForm<WorkOrderForm>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      work_order_type: "service_call",
      priority: "medium",
      estimated_duration_hours: 2.0,
    },
  });

  const partsOrderForm = useForm<PartsOrderForm>({
    resolver: zodResolver(partsOrderSchema),
    defaultValues: {
      order_type: "parts_request",
      delivery_method: "truck_delivery",
      urgency: "standard",
      parts: [{ part_id: "", quantity: 1, usage_reason: "work_order" }],
    },
  });

  const onWorkOrderSubmit = (data: WorkOrderForm) => {
    createWorkOrderMutation.mutate(data);
  };

  const onPartsOrderSubmit = (data: PartsOrderForm) => {
    createPartsOrderMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': case 'on_site': return 'default';
      case 'assigned': case 'en_route': return 'secondary';
      case 'cancelled': case 'rescheduled': return 'destructive';
      case 'urgent': case 'emergency': return 'destructive';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress': case 'on_site': return <PlayCircle className="h-4 w-4 text-blue-600" />;
      case 'assigned': return <Clock className="h-4 w-4 text-orange-600" />;
      case 'en_route': return <Navigation className="h-4 w-4 text-blue-600" />;
      case 'cancelled': return <StopCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getWorkOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'service_call': return <Wrench className="h-4 w-4" />;
      case 'installation': return <Settings className="h-4 w-4" />;
      case 'maintenance': return <Calendar className="h-4 w-4" />;
      case 'repair': return <AlertTriangle className="h-4 w-4" />;
      case 'inspection': return <Search className="h-4 w-4" />;
      default: return <Wrench className="h-4 w-4" />;
    }
  };

  const getConnectionIcon = (type: string) => {
    switch (type) {
      case 'wifi': return <Wifi className="h-3 w-3" />;
      case 'cellular': return <Signal className="h-3 w-3" />;
      case 'offline': return <WifiOff className="h-3 w-3" />;
      default: return <Signal className="h-3 w-3" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Mobile Service App</h1>
          <p className="text-muted-foreground mt-2">
            Field technician mobile application for work order management and parts ordering
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isWorkOrderDialogOpen} onOpenChange={setIsWorkOrderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Work Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Mobile Work Order</DialogTitle>
              </DialogHeader>
              <Form {...workOrderForm}>
                <form onSubmit={workOrderForm.handleSubmit(onWorkOrderSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={workOrderForm.control}
                      name="work_order_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Order Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="service_call">Service Call</SelectItem>
                              <SelectItem value="installation">Installation</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                              <SelectItem value="repair">Repair</SelectItem>
                              <SelectItem value="inspection">Inspection</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={workOrderForm.control}
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
                              <SelectItem value="emergency">Emergency</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={workOrderForm.control}
                    name="customer_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {businessRecords.map((record: any) => (
                              <SelectItem key={record.id} value={record.id}>
                                {record.company_name || record.companyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={workOrderForm.control}
                    name="service_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Address</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Complete service address with access instructions..."
                            rows={2}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={workOrderForm.control}
                    name="assigned_technician_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned Technician</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select technician" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {technicians.map((tech: any) => (
                              <SelectItem key={tech.id} value={tech.id}>
                                {tech.name} - {tech.specialty}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={workOrderForm.control}
                    name="problem_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Problem Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Detailed description of the problem or work to be performed..."
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={workOrderForm.control}
                      name="scheduled_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scheduled Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={workOrderForm.control}
                      name="scheduled_time_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={workOrderForm.control}
                      name="estimated_duration_hours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (hours)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.5" 
                              min="0.5" 
                              max="12"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 2.0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={workOrderForm.control}
                      name="site_contact_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Contact Name</FormLabel>
                          <FormControl>
                            <Input placeholder="On-site contact person" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={workOrderForm.control}
                      name="site_contact_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Contact Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={workOrderForm.control}
                    name="access_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access Instructions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Special access instructions, codes, parking, etc..."
                            rows={2}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsWorkOrderDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createWorkOrderMutation.isPending}>
                      {createWorkOrderMutation.isPending ? "Creating..." : "Create Work Order"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isPartsOrderDialogOpen} onOpenChange={setIsPartsOrderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Package className="mr-2 h-4 w-4" />
                Order Parts
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Parts Order</DialogTitle>
              </DialogHeader>
              <Form {...partsOrderForm}>
                <form onSubmit={partsOrderForm.handleSubmit(onPartsOrderSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={partsOrderForm.control}
                      name="order_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Order Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="parts_request">Parts Request</SelectItem>
                              <SelectItem value="emergency_order">Emergency Order</SelectItem>
                              <SelectItem value="stock_replenishment">Stock Replenishment</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={partsOrderForm.control}
                      name="urgency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Urgency</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                              <SelectItem value="emergency">Emergency</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={partsOrderForm.control}
                    name="technician_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Technician</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select technician" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {technicians.map((tech: any) => (
                              <SelectItem key={tech.id} value={tech.id}>
                                {tech.name} - {tech.specialty}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={partsOrderForm.control}
                      name="delivery_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="truck_delivery">Truck Delivery</SelectItem>
                              <SelectItem value="warehouse_pickup">Warehouse Pickup</SelectItem>
                              <SelectItem value="courier">Courier</SelectItem>
                              <SelectItem value="customer_pickup">Customer Pickup</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={partsOrderForm.control}
                      name="requested_delivery_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Requested Delivery Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={partsOrderForm.control}
                    name="delivery_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Address (if different)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Delivery address if different from default..."
                            rows={2}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <h4 className="font-medium">Parts Requested</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-2 text-sm font-medium">
                        <span>Part</span>
                        <span>Quantity</span>
                        <span>Usage Reason</span>
                        <span></span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select part" />
                          </SelectTrigger>
                          <SelectContent>
                            {partsInventory.slice(0, 10).map((part) => (
                              <SelectItem key={part.id} value={part.id}>
                                {part.part_number} - {part.part_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input type="number" min="1" defaultValue="1" />
                        <Select defaultValue="work_order">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="work_order">Work Order</SelectItem>
                            <SelectItem value="stock_replenishment">Stock Replenishment</SelectItem>
                            <SelectItem value="emergency_repair">Emergency Repair</SelectItem>
                            <SelectItem value="preventive_maintenance">Preventive Maintenance</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsPartsOrderDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createPartsOrderMutation.isPending}>
                      {createPartsOrderMutation.isPending ? "Creating..." : "Create Parts Order"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => syncDataMutation.mutate()} disabled={syncDataMutation.isPending}>
            <Download className="mr-2 h-4 w-4" />
            {syncDataMutation.isPending ? "Syncing..." : "Sync Data"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="work-orders">Work Orders</TabsTrigger>
          <TabsTrigger value="parts">Parts</TabsTrigger>
          <TabsTrigger value="field-orders">Field Orders</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Mobile Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Work Orders</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.activeWorkOrders || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  In progress or assigned
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Technicians in Field</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.techniciansInField || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Parts Orders</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.pendingPartsOrders || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Awaiting fulfillment
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Service Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Average Response Time</span>
                    <span className="font-medium">
                      {metrics?.averageResponseTime || 0} minutes
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Completion Rate</span>
                    <span className="font-medium">
                      {metrics?.completionRate ? `${metrics.completionRate.toFixed(1)}%` : "0%"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Customer Satisfaction</span>
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">
                        {metrics?.customerSatisfaction || 0}/5
                      </span>
                      <div className="flex space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`h-3 w-3 ${
                              i < (metrics?.customerSatisfaction || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                            }`} 
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Work Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {workOrdersLoading ? (
                  <p className="text-center py-4">Loading work orders...</p>
                ) : (workOrders as MobileWorkOrder[]).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No work orders</p>
                ) : (
                  <div className="space-y-3">
                    {(workOrders as MobileWorkOrder[]).slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(order.status)}
                          <div>
                            <h4 className="font-medium text-sm">{order.work_order_number}</h4>
                            <p className="text-xs text-muted-foreground">
                              {order.customer_name} • {order.assigned_technician_name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={getStatusColor(order.status)} className="text-xs">
                            {order.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant={getPriorityColor(order.priority)} className="text-xs ml-1">
                            {order.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="work-orders" className="space-y-6">
          {/* Work Order Filters */}
          <div className="flex space-x-4">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="en_route">En Route</SelectItem>
                <SelectItem value="on_site">On Site</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Technicians</SelectItem>
                {technicians.map((tech: any) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Mobile Work Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {workOrdersLoading ? (
                <p className="text-center py-8">Loading work orders...</p>
              ) : (workOrders as MobileWorkOrder[]).length === 0 ? (
                <div className="text-center py-8">
                  <Smartphone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No work orders found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(workOrders as MobileWorkOrder[]).map((order) => (
                    <div key={order.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="flex items-center space-x-2">
                            {getWorkOrderTypeIcon(order.work_order_type)}
                            {getStatusIcon(order.status)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-medium">{order.work_order_number}</h3>
                              <Badge variant={getStatusColor(order.status)}>
                                {order.status.replace('_', ' ')}
                              </Badge>
                              <Badge variant={getPriorityColor(order.priority)}>
                                {order.priority}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Customer: {order.customer_name}</p>
                              <p>Type: {order.work_order_type.replace('_', ' ')}</p>
                              <p>Technician: {order.assigned_technician_name}</p>
                              <p>Address: {order.service_address}</p>
                              {order.scheduled_date && (
                                <p>
                                  Scheduled: {format(new Date(order.scheduled_date), 'MMM dd, yyyy')}
                                  {order.scheduled_time_start && ` at ${order.scheduled_time_start}`}
                                </p>
                              )}
                              {order.site_contact_name && (
                                <p>Contact: {order.site_contact_name} ({order.site_contact_phone})</p>
                              )}
                              <p>Duration: {order.estimated_duration_hours} hours</p>
                              <p className="text-xs">{order.problem_description}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="outline" size="sm">
                            <MapPin className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Phone className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Camera className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mobile Parts Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              {partsLoading ? (
                <p className="text-center py-8">Loading parts inventory...</p>
              ) : (partsInventory as MobilePartsInventory[]).length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No parts inventory</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(partsInventory as MobilePartsInventory[]).map((part) => (
                    <Card key={part.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{part.part_number}</CardTitle>
                          {part.commonly_used && (
                            <Badge variant="secondary" className="text-xs">Common</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{part.part_name}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm">
                          <p className="text-muted-foreground">Category: {part.category}</p>
                          {part.part_description && (
                            <p className="text-xs text-muted-foreground mt-1">{part.part_description}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Warehouse</p>
                            <p className="font-medium">{part.warehouse_quantity}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Truck</p>
                            <p className="font-medium">{part.truck_quantity}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Available</p>
                            <p className="font-medium">{part.available_quantity}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Price</p>
                            <p className="font-medium">${part.list_price.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            Request
                          </Button>
                          <Button variant="outline" size="sm">
                            <FileText className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="field-orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Field Parts Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <p className="text-center py-8">Loading field orders...</p>
              ) : (fieldOrders as MobileFieldOrder[]).length === 0 ? (
                <div className="text-center py-8">
                  <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No field orders</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(fieldOrders as MobileFieldOrder[]).map((order) => (
                    <div key={order.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{order.order_number}</h3>
                            <Badge variant={getStatusColor(order.status)}>
                              {order.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant={getPriorityColor(order.urgency)}>
                              {order.urgency}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Technician: {order.technician_name}</p>
                            <p>Type: {order.order_type.replace('_', ' ')}</p>
                            <p>Order Date: {format(new Date(order.order_date), 'MMM dd, yyyy')}</p>
                            {order.requested_delivery_date && (
                              <p>Requested Delivery: {format(new Date(order.requested_delivery_date), 'MMM dd, yyyy')}</p>
                            )}
                            <p>Delivery Method: {order.delivery_method.replace('_', ' ')}</p>
                            {order.tracking_number && (
                              <p>Tracking: {order.tracking_number}</p>
                            )}
                            <p>Items: {order.line_items_count || 0}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            ${order.total_amount.toLocaleString()}
                          </p>
                          <div className="flex space-x-1 mt-2">
                            <Button variant="outline" size="sm">
                              <FileText className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <MapPin className="h-3 w-3" />
                            </Button>
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

        <TabsContent value="tracking" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Technician Location Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              {locationsLoading ? (
                <p className="text-center py-8">Loading location data...</p>
              ) : (locations as TechnicianLocation[]).length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No location tracking data</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(locations as TechnicianLocation[]).map((location) => (
                    <div key={location.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{location.technician_name}</h3>
                            <Badge variant="outline">
                              {location.location_type?.replace('_', ' ') || 'unknown'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Last Update: {format(new Date(location.recorded_at), 'MMM dd, HH:mm')}</p>
                            {location.street_address && (
                              <p>Address: {location.street_address}</p>
                            )}
                            {location.work_order_number && (
                              <p>Work Order: {location.work_order_number}</p>
                            )}
                            {location.customer_name && (
                              <p>Customer: {location.customer_name}</p>
                            )}
                            {location.latitude && location.longitude && (
                              <p>Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          {location.device_battery_level && (
                            <div className="flex items-center space-x-1">
                              <Battery className="h-3 w-3" />
                              <span className="text-xs">{location.device_battery_level}%</span>
                            </div>
                          )}
                          <div className="flex space-x-1">
                            <Button variant="outline" size="sm">
                              <MapPin className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Route className="h-3 w-3" />
                            </Button>
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

        <TabsContent value="sessions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mobile App Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <p className="text-center py-8">Loading app sessions...</p>
              ) : (sessions as MobileAppSession[]).length === 0 ? (
                <div className="text-center py-8">
                  <Smartphone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No app sessions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(sessions as MobileAppSession[]).map((session) => (
                    <div key={session.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{session.technician_name}</h3>
                            <div className="flex items-center space-x-1">
                              {getConnectionIcon(session.connection_type || 'cellular')}
                              <span className="text-xs">{session.connection_type}</span>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Started: {format(new Date(session.session_start), 'MMM dd, HH:mm')}</p>
                            {session.session_end && (
                              <p>Ended: {format(new Date(session.session_end), 'MMM dd, HH:mm')}</p>
                            )}
                            <p>Device: {session.device_type} {session.device_model}</p>
                            <p>Work Orders Accessed: {session.work_orders_accessed?.length || 0}</p>
                            <p>Parts Orders Created: {session.parts_orders_created}</p>
                            <p>Photos Uploaded: {session.photos_uploaded}</p>
                            <p>Offline Time: {session.offline_time_minutes} minutes</p>
                            {session.end_reason && (
                              <p>End Reason: {session.end_reason.replace('_', ' ')}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={session.session_end ? 'outline' : 'default'}>
                            {session.session_end ? 'Ended' : 'Active'}
                          </Badge>
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