import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { 
  Plus, Package, Truck, Settings, CheckCircle, Clock, AlertTriangle,
  MapPin, User, Calendar, FileText, Download, Filter, ArrowRight,
  Wrench, Building, Phone, Mail, Camera, Star, Target
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
type EquipmentLifecycleStage = {
  id: string;
  equipment_id: string;
  equipment_serial_number: string;
  equipment_model: string;
  equipment_brand: string;
  current_stage: string;
  stage_status: string;
  stage_started_at: string;
  estimated_completion_date: string;
  customer_name?: string;
  progress_percentage: number;
  next_action_required: string;
  assigned_to_name?: string;
  created_at: string;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  vendor_name: string;
  order_date: string;
  requested_delivery_date: string;
  total_amount: number;
  status: string;
  customer_name?: string;
  tracking_number?: string;
  line_items_count: number;
  created_at: string;
};

type DeliverySchedule = {
  id: string;
  delivery_id: string;
  scheduled_date: string;
  time_window_start: string;
  time_window_end: string;
  delivery_type: string;
  contact_person: string;
  contact_phone: string;
  status: string;
  driver_name?: string;
  created_at: string;
};

type Installation = {
  id: string;
  equipment_model: string;
  equipment_brand: string;
  scheduled_date: string;
  installation_location: string;
  lead_technician_name?: string;
  status: string;
  estimated_duration_hours: number;
  customer_satisfaction_rating?: number;
  created_at: string;
};

type AssetTracking = {
  id: string;
  asset_tag: string;
  serial_number: string;
  brand: string;
  model: string;
  equipment_type: string;
  current_status: string;
  current_location_details: string;
  customer_name?: string;
  next_maintenance_due: string;
  current_bw_count: number;
  current_color_count: number;
  created_at: string;
};

type LifecycleMetrics = {
  totalEquipmentInProcess: number;
  pendingDeliveries: number;
  scheduledInstallations: number;
  activeAssets: number;
  averageInstallationTime: number;
  customerSatisfactionRating: number;
};

// Form Schemas
const purchaseOrderSchema = z.object({
  vendor_name: z.string().min(2, "Vendor name required"),
  order_date: z.string(),
  requested_delivery_date: z.string(),
  customer_id: z.string().optional(),
  delivery_address: z.string().min(10, "Delivery address required"),
  special_instructions: z.string().optional(),
  items: z.array(z.object({
    equipment_model: z.string().min(2, "Model required"),
    equipment_brand: z.string().min(2, "Brand required"),
    description: z.string().min(5, "Description required"),
    quantity: z.number().min(1),
    unit_price: z.number().min(0.01),
  })).min(1, "At least one item required"),
});

const deliveryScheduleSchema = z.object({
  purchase_order_id: z.string(),
  scheduled_date: z.string(),
  time_window_start: z.string(),
  time_window_end: z.string(),
  delivery_type: z.enum(['standard', 'white_glove', 'freight', 'expedited']),
  contact_person: z.string().min(2, "Contact person required"),
  contact_phone: z.string().min(10, "Phone number required"),
  contact_email: z.string().email().optional(),
  delivery_address: z.string().min(10, "Address required"),
  special_equipment_required: z.boolean(),
  delivery_instructions: z.string().optional(),
});

const installationSchema = z.object({
  equipment_id: z.string(),
  scheduled_date: z.string(),
  scheduled_time_start: z.string(),
  scheduled_time_end: z.string(),
  installation_location: z.string().min(5, "Location required"),
  site_contact_person: z.string().min(2, "Contact person required"),
  site_contact_phone: z.string().min(10, "Phone required"),
  lead_technician_id: z.string(),
  power_requirements: z.string().optional(),
  network_requirements: z.string().optional(),
  environmental_conditions: z.string().optional(),
});

type PurchaseOrderForm = z.infer<typeof purchaseOrderSchema>;
type DeliveryScheduleForm = z.infer<typeof deliveryScheduleSchema>;
type InstallationForm = z.infer<typeof installationSchema>;

export default function EquipmentLifecycleManagement() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isPODialogOpen, setIsPODialogOpen] = useState(false);
  const [isDeliveryDialogOpen, setIsDeliveryDialogOpen] = useState(false);
  const [isInstallationDialogOpen, setIsInstallationDialogOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  
  const queryClient = useQueryClient();

  // Fetch lifecycle metrics
  const { data: metrics } = useQuery<LifecycleMetrics>({
    queryKey: ["/api/equipment-lifecycle/metrics"],
  });

  // Fetch lifecycle stages
  const { data: lifecycleStages = [], isLoading: stagesLoading } = useQuery<EquipmentLifecycleStage[]>({
    queryKey: ["/api/equipment-lifecycle/stages", selectedStage, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStage !== "all") params.append("stage", selectedStage);
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      return await apiRequest(`/api/equipment-lifecycle/stages?${params.toString()}`);
    },
  });

  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading: poLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/equipment-lifecycle/purchase-orders"],
  });

  // Fetch delivery schedules
  const { data: deliverySchedules = [], isLoading: deliveryLoading } = useQuery<DeliverySchedule[]>({
    queryKey: ["/api/equipment-lifecycle/deliveries"],
  });

  // Fetch installations
  const { data: installations = [], isLoading: installationsLoading } = useQuery<Installation[]>({
    queryKey: ["/api/equipment-lifecycle/installations"],
  });

  // Fetch asset tracking
  const { data: assets = [], isLoading: assetsLoading } = useQuery<AssetTracking[]>({
    queryKey: ["/api/equipment-lifecycle/assets"],
  });

  // Fetch technicians and customers for dropdowns
  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ["/api/technicians"],
  });

  const { data: businessRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/business-records"],
  });

  // Create purchase order mutation
  const createPOMutation = useMutation({
    mutationFn: async (data: PurchaseOrderForm) =>
      await apiRequest("/api/equipment-lifecycle/purchase-orders", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-lifecycle/purchase-orders"] });
      setIsPODialogOpen(false);
    },
  });

  // Schedule delivery mutation
  const scheduleDeliveryMutation = useMutation({
    mutationFn: async (data: DeliveryScheduleForm) =>
      await apiRequest("/api/equipment-lifecycle/deliveries", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-lifecycle/deliveries"] });
      setIsDeliveryDialogOpen(false);
    },
  });

  // Schedule installation mutation
  const scheduleInstallationMutation = useMutation({
    mutationFn: async (data: InstallationForm) =>
      await apiRequest("/api/equipment-lifecycle/installations", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-lifecycle/installations"] });
      setIsInstallationDialogOpen(false);
    },
  });

  // Form setup
  const poForm = useForm<PurchaseOrderForm>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      items: [{ equipment_model: "", equipment_brand: "", description: "", quantity: 1, unit_price: 0 }],
    },
  });

  const deliveryForm = useForm<DeliveryScheduleForm>({
    resolver: zodResolver(deliveryScheduleSchema),
    defaultValues: {
      delivery_type: "standard",
      special_equipment_required: false,
    },
  });

  const installationForm = useForm<InstallationForm>({
    resolver: zodResolver(installationSchema),
  });

  const onPOSubmit = (data: PurchaseOrderForm) => {
    createPOMutation.mutate(data);
  };

  const onDeliverySubmit = (data: DeliveryScheduleForm) => {
    scheduleDeliveryMutation.mutate(data);
  };

  const onInstallationSubmit = (data: InstallationForm) => {
    scheduleInstallationMutation.mutate(data);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'ordered': return 'secondary';
      case 'received': case 'in_warehouse': return 'default';
      case 'in_transit': case 'delivered': return 'default';
      case 'installed': case 'active': return 'default';
      case 'maintenance': return 'destructive';
      case 'retired': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'delayed': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'cancelled': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Equipment Lifecycle Management</h1>
          <p className="text-muted-foreground mt-2">
            Complete equipment workflow from purchase order to installation and asset tracking
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isPODialogOpen} onOpenChange={setIsPODialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Package className="mr-2 h-4 w-4" />
                New Purchase Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
              </DialogHeader>
              <Form {...poForm}>
                <form onSubmit={poForm.handleSubmit(onPOSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={poForm.control}
                      name="vendor_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor Name</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC Equipment Corp" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={poForm.control}
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={poForm.control}
                      name="order_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Order Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={poForm.control}
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
                    control={poForm.control}
                    name="delivery_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Address</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Complete delivery address..."
                            rows={2}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={poForm.control}
                    name="special_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Special Instructions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Special handling, access requirements, etc..."
                            rows={2}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <h4 className="font-medium">Line Items</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-5 gap-2 text-sm font-medium">
                        <span>Brand</span>
                        <span>Model</span>
                        <span>Description</span>
                        <span>Qty</span>
                        <span>Unit Price</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        <FormField
                          control={poForm.control}
                          name="items.0.equipment_brand"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="Canon" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={poForm.control}
                          name="items.0.equipment_model"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="imageRUNNER 2530i" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={poForm.control}
                          name="items.0.description"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="Multifunction printer" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={poForm.control}
                          name="items.0.quantity"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="1"
                                  {...field}
                                  onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={poForm.control}
                          name="items.0.unit_price"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsPODialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createPOMutation.isPending}>
                      {createPOMutation.isPending ? "Creating..." : "Create Purchase Order"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDeliveryDialogOpen} onOpenChange={setIsDeliveryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Truck className="mr-2 h-4 w-4" />
                Schedule Delivery
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Schedule Equipment Delivery</DialogTitle>
              </DialogHeader>
              <Form {...deliveryForm}>
                <form onSubmit={deliveryForm.handleSubmit(onDeliverySubmit)} className="space-y-4">
                  <FormField
                    control={deliveryForm.control}
                    name="purchase_order_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Order</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select purchase order" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {purchaseOrders.map((po) => (
                              <SelectItem key={po.id} value={po.id}>
                                {po.po_number} - {po.vendor_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={deliveryForm.control}
                      name="scheduled_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deliveryForm.control}
                      name="time_window_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time Window Start</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deliveryForm.control}
                      name="time_window_end"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time Window End</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={deliveryForm.control}
                    name="delivery_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="white_glove">White Glove</SelectItem>
                            <SelectItem value="freight">Freight</SelectItem>
                            <SelectItem value="expedited">Expedited</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={deliveryForm.control}
                      name="contact_person"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person</FormLabel>
                          <FormControl>
                            <Input placeholder="John Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deliveryForm.control}
                      name="contact_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={deliveryForm.control}
                    name="delivery_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Address</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Complete delivery address with access instructions..."
                            rows={2}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={deliveryForm.control}
                    name="special_equipment_required"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Special equipment required (crane, forklift, etc.)</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={deliveryForm.control}
                    name="delivery_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Instructions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Special instructions, access codes, parking, etc..."
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
                      onClick={() => setIsDeliveryDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={scheduleDeliveryMutation.isPending}>
                      {scheduleDeliveryMutation.isPending ? "Scheduling..." : "Schedule Delivery"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isInstallationDialogOpen} onOpenChange={setIsInstallationDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Schedule Installation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Schedule Equipment Installation</DialogTitle>
              </DialogHeader>
              <Form {...installationForm}>
                <form onSubmit={installationForm.handleSubmit(onInstallationSubmit)} className="space-y-4">
                  <FormField
                    control={installationForm.control}
                    name="equipment_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment</FormLabel>
                        <FormControl>
                          <Input placeholder="Equipment ID or Serial Number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={installationForm.control}
                      name="scheduled_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Installation Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={installationForm.control}
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
                      control={installationForm.control}
                      name="scheduled_time_end"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={installationForm.control}
                    name="installation_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Installation Location</FormLabel>
                        <FormControl>
                          <Input placeholder="Building, floor, room details" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={installationForm.control}
                      name="site_contact_person"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Contact Person</FormLabel>
                          <FormControl>
                            <Input placeholder="On-site contact" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={installationForm.control}
                      name="site_contact_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={installationForm.control}
                    name="lead_technician_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead Technician</FormLabel>
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
                      control={installationForm.control}
                      name="power_requirements"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Power Requirements</FormLabel>
                          <FormControl>
                            <Input placeholder="110V, 220V, dedicated circuit" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={installationForm.control}
                      name="network_requirements"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Network Requirements</FormLabel>
                          <FormControl>
                            <Input placeholder="Ethernet, WiFi, IP address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={installationForm.control}
                    name="environmental_conditions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Environmental Conditions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Temperature, humidity, space requirements..."
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
                      onClick={() => setIsInstallationDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={scheduleInstallationMutation.isPending}>
                      {scheduleInstallationMutation.isPending ? "Scheduling..." : "Schedule Installation"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          <TabsTrigger value="installations">Installations</TabsTrigger>
          <TabsTrigger value="assets">Asset Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Equipment in Process</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.totalEquipmentInProcess || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently in lifecycle workflow
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.pendingDeliveries || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Scheduled for delivery
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Assets</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.activeAssets || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  In customer locations
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Installation Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Average Installation Time</span>
                    <span className="font-medium">
                      {metrics?.averageInstallationTime || 0} hours
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Customer Satisfaction</span>
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">
                        {metrics?.customerSatisfactionRating || 0}/5
                      </span>
                      <div className="flex space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`h-3 w-3 ${
                              i < (metrics?.customerSatisfactionRating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                            }`} 
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Scheduled Installations</span>
                    <span className="font-medium">
                      {metrics?.scheduledInstallations || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Lifecycle Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {stagesLoading ? (
                  <p className="text-center py-4">Loading activity...</p>
                ) : (lifecycleStages as EquipmentLifecycleStage[]).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No recent activity</p>
                ) : (
                  <div className="space-y-3">
                    {(lifecycleStages as EquipmentLifecycleStage[]).slice(0, 5).map((stage) => (
                      <div key={stage.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">
                            {stage.equipment_brand} {stage.equipment_model}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {stage.customer_name} • {stage.next_action_required}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={getStageColor(stage.current_stage)} className="text-xs">
                            {stage.current_stage.replace('_', ' ')}
                          </Badge>
                          {getStatusIcon(stage.stage_status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="lifecycle" className="space-y-6">
          {/* Filters */}
          <div className="flex space-x-4">
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="in_warehouse">In Warehouse</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Equipment Lifecycle Stages</CardTitle>
            </CardHeader>
            <CardContent>
              {stagesLoading ? (
                <p className="text-center py-8">Loading lifecycle stages...</p>
              ) : (lifecycleStages as EquipmentLifecycleStage[]).length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No equipment in lifecycle workflow</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(lifecycleStages as EquipmentLifecycleStage[]).map((stage) => (
                    <div key={stage.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">
                              {stage.equipment_brand} {stage.equipment_model}
                            </h3>
                            <Badge variant={getStageColor(stage.current_stage)}>
                              {stage.current_stage.replace('_', ' ')}
                            </Badge>
                            {getStatusIcon(stage.stage_status)}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Serial: {stage.equipment_serial_number}</p>
                            <p>Customer: {stage.customer_name}</p>
                            <p>Started: {format(new Date(stage.stage_started_at), 'MMM dd, yyyy')}</p>
                            {stage.estimated_completion_date && (
                              <p>Est. Completion: {format(new Date(stage.estimated_completion_date), 'MMM dd, yyyy')}</p>
                            )}
                            <p>Next Action: {stage.next_action_required}</p>
                            {stage.assigned_to_name && (
                              <p>Assigned to: {stage.assigned_to_name}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            {stage.progress_percentage}%
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Progress
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {poLoading ? (
                <p className="text-center py-8">Loading purchase orders...</p>
              ) : (purchaseOrders as PurchaseOrder[]).length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No purchase orders yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(purchaseOrders as PurchaseOrder[]).map((po) => (
                    <div key={po.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{po.po_number}</h3>
                            <Badge variant={getStageColor(po.status)}>
                              {po.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Vendor: {po.vendor_name}</p>
                            <p>Customer: {po.customer_name}</p>
                            <p>Order Date: {format(new Date(po.order_date), 'MMM dd, yyyy')}</p>
                            <p>Requested Delivery: {format(new Date(po.requested_delivery_date), 'MMM dd, yyyy')}</p>
                            <p>Items: {po.line_items_count}</p>
                            {po.tracking_number && (
                              <p>Tracking: {po.tracking_number}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            ${po.total_amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Schedules</CardTitle>
            </CardHeader>
            <CardContent>
              {deliveryLoading ? (
                <p className="text-center py-8">Loading deliveries...</p>
              ) : (deliverySchedules as DeliverySchedule[]).length === 0 ? (
                <div className="text-center py-8">
                  <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No deliveries scheduled</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(deliverySchedules as DeliverySchedule[]).map((delivery) => (
                    <div key={delivery.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{delivery.delivery_id}</h3>
                            <Badge variant={getStageColor(delivery.status)}>
                              {delivery.status}
                            </Badge>
                            <Badge variant="outline">
                              {delivery.delivery_type}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Date: {format(new Date(delivery.scheduled_date), 'MMM dd, yyyy')}</p>
                            <p>Time: {delivery.time_window_start} - {delivery.time_window_end}</p>
                            <p>Contact: {delivery.contact_person} ({delivery.contact_phone})</p>
                            {delivery.driver_name && (
                              <p>Driver: {delivery.driver_name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          {getStatusIcon(delivery.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="installations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Installation Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {installationsLoading ? (
                <p className="text-center py-8">Loading installations...</p>
              ) : (installations as Installation[]).length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No installations scheduled</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(installations as Installation[]).map((installation) => (
                    <div key={installation.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">
                              {installation.equipment_brand} {installation.equipment_model}
                            </h3>
                            <Badge variant={getStageColor(installation.status)}>
                              {installation.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Date: {format(new Date(installation.scheduled_date), 'MMM dd, yyyy')}</p>
                            <p>Location: {installation.installation_location}</p>
                            <p>Duration: {installation.estimated_duration_hours} hours</p>
                            <p>Technician: {installation.lead_technician_name}</p>
                            {installation.customer_satisfaction_rating && (
                              <div className="flex items-center space-x-1">
                                <span>Rating:</span>
                                <div className="flex space-x-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star 
                                      key={i} 
                                      className={`h-3 w-3 ${
                                        i < installation.customer_satisfaction_rating! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                      }`} 
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Settings className="h-4 w-4 text-muted-foreground" />
                          {getStatusIcon(installation.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              {assetsLoading ? (
                <p className="text-center py-8">Loading assets...</p>
              ) : (assets as AssetTracking[]).length === 0 ? (
                <div className="text-center py-8">
                  <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No assets being tracked</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(assets as AssetTracking[]).map((asset) => (
                    <div key={asset.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">
                              {asset.brand} {asset.model}
                            </h3>
                            <Badge variant={getStageColor(asset.current_status)}>
                              {asset.current_status}
                            </Badge>
                            <Badge variant="outline">
                              {asset.equipment_type}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Asset Tag: {asset.asset_tag}</p>
                            <p>Serial: {asset.serial_number}</p>
                            <p>Customer: {asset.customer_name}</p>
                            <p>Location: {asset.current_location_details}</p>
                            <p>Next Maintenance: {format(new Date(asset.next_maintenance_due), 'MMM dd, yyyy')}</p>
                            <p>B&W Count: {asset.current_bw_count.toLocaleString()}</p>
                            <p>Color Count: {asset.current_color_count.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-center">
                          <Target className="h-8 w-8 text-muted-foreground mx-auto mb-1" />
                          <p className="text-xs text-muted-foreground">Tracked</p>
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
    </MainLayout>
  );
}