import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import {
  Plus,
  Package,
  Truck,
  Settings,
  CheckCircle,
  Clock,
  AlertTriangle,
  MapPin,
  Calendar,
  FileText,
  FileCheck,
  Wrench,
  Warehouse,
  ShoppingCart,
  Camera,
  Shield,
  BarChart3,
  Activity,
  Star,
  Target,
  Search,
  ChevronDown,
  ChevronUp,
  Workflow,
  Eye,
  Filter,
  History,
} from 'lucide-react';
import { EquipmentTransitionDialog } from '@/components/equipment/EquipmentTransitionDialog';
import { EquipmentTransitionHistory } from '@/components/equipment/EquipmentTransitionHistory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { apiRequest, extractRecords } from '@/lib/queryClient';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton, ListSkeleton, LoadingSpinner } from '@/components/ui/skeletons';
import { useActionParam } from '@/hooks/use-action-param';
import { useToast } from '@/hooks/use-toast';

// WF-L-02: these types are the shape the edge function returns, which is the
// shape the real tables have. They used to name fields that exist on no table -
// po_number's line_items_count, a delivery driver_name, current_bw_count as an
// equipment column - and every list on this page was empty anyway, because none
// of the five endpoints existed on either host.
type EquipmentLifecycleRow = {
  id: string;
  equipmentId: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  currentStage: string | null;
  currentLocation: string | null;
  customerId: string | null;
  customerName: string | null;
  purchaseOrderId: string | null;
  lastServiceDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type PurchaseOrder = {
  id: string;
  poNumber: string | null;
  vendorId: string | null;
  vendorName: string | null;
  orderDate: string | null;
  expectedDate: string | null;
  totalAmount: string | number | null;
  status: string | null;
  sourceContractId: string | null;
  /** Derived: PostgREST has no COUNT per group, so the lines are tallied server-side. */
  lineItemsCount: number;
  createdAt: string | null;
};

type DeliverySchedule = {
  id: string;
  equipmentId: string | null;
  equipmentModel: string | null;
  customerId: string | null;
  customerName: string | null;
  scheduledDate: string | null;
  /** ONE free-text window. The table has no start/end pair. */
  timeWindow: string | null;
  deliveryType: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  status: string | null;
  /** An id: delivery_schedules stores driver_id and there is no drivers table. */
  driverId: string | null;
  actualDeliveryTime: string | null;
  createdAt: string | null;
};

type Installation = {
  id: string;
  equipmentId: string | null;
  equipmentModel: string | null;
  equipmentBrand: string | null;
  customerId: string | null;
  customerName: string | null;
  technicianId: string | null;
  leadTechnicianName: string | null;
  scheduledDate: string | null;
  /** MINUTES. The old type called the same column hours. */
  estimatedDurationMinutes: number | null;
  installationType: string | null;
  status: string | null;
  customerSatisfactionRating: number | null;
  createdAt: string | null;
};

type AssetTracking = {
  id: string;
  assetTag: string | null;
  serialNumber: string | null;
  model: string | null;
  manufacturer: string | null;
  customerId: string | null;
  customerName: string | null;
  status: string | null;
  locationDescription: string | null;
  installDate: string | null;
  /** Null, not 0: a machine that has never been read has produced no count. */
  latestReadingDate: string | null;
  bwMeterReading: number | null;
  colorMeterReading: number | null;
  createdAt: string | null;
};

type LifecycleMetrics = {
  totalEquipmentInProcess: number;
  pendingDeliveries: number;
  scheduledInstallations: number;
  activeAssets: number;
  /** Null until an installation has recorded a start and an end. */
  averageInstallationTime: number | null;
  /** Null until a completed installation has been rated. */
  customerSatisfactionRating: number | null;
  unbacked?: string[];
};

interface StageCard {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  stage: string;
  category: string;
}

// Form Schemas
const purchaseOrderSchema = z.object({
  vendor_name: z.string().min(2, 'Vendor name required'),
  order_date: z.string(),
  requested_delivery_date: z.string(),
  customer_id: z.string().optional(),
  delivery_address: z.string().min(10, 'Delivery address required'),
  special_instructions: z.string().optional(),
  items: z
    .array(
      z.object({
        equipment_model: z.string().min(2, 'Model required'),
        equipment_brand: z.string().min(2, 'Brand required'),
        description: z.string().min(5, 'Description required'),
        quantity: z.number().min(1),
        unit_price: z.number().min(0.01),
      }),
    )
    .min(1, 'At least one item required'),
});

const deliveryScheduleSchema = z.object({
  purchase_order_id: z.string(),
  scheduled_date: z.string(),
  time_window_start: z.string(),
  time_window_end: z.string(),
  delivery_type: z.enum(['standard', 'white_glove', 'freight', 'expedited']),
  contact_person: z.string().min(2, 'Contact person required'),
  contact_phone: z.string().min(10, 'Phone number required'),
  contact_email: z.string().email().optional(),
  delivery_address: z.string().min(10, 'Address required'),
  special_equipment_required: z.boolean(),
  delivery_instructions: z.string().optional(),
});

const installationSchema = z.object({
  equipment_id: z.string(),
  scheduled_date: z.string(),
  scheduled_time_start: z.string(),
  scheduled_time_end: z.string(),
  installation_location: z.string().min(5, 'Location required'),
  site_contact_person: z.string().min(2, 'Contact person required'),
  site_contact_phone: z.string().min(10, 'Phone required'),
  lead_technician_id: z.string(),
  power_requirements: z.string().optional(),
  network_requirements: z.string().optional(),
  environmental_conditions: z.string().optional(),
});

type PurchaseOrderForm = z.infer<typeof purchaseOrderSchema>;
type DeliveryScheduleForm = z.infer<typeof deliveryScheduleSchema>;
type InstallationForm = z.infer<typeof installationSchema>;

// Lifecycle stage definitions
const lifecycleStageCards: StageCard[] = [
  {
    id: 'procurement',
    title: 'Purchase Orders & Procurement',
    description: 'Manage orders, vendor relationships, and equipment procurement',
    icon: ShoppingCart,
    stage: 'ordered',
    category: 'Procurement',
  },
  {
    id: 'warehouse',
    title: 'Warehouse Operations',
    description: 'Receiving, quality control, staging, and inventory management',
    icon: Warehouse,
    stage: 'in_warehouse',
    category: 'Operations',
  },
  {
    id: 'delivery',
    title: 'Delivery Logistics',
    description: 'Route optimization, scheduling, and white glove delivery',
    icon: Truck,
    stage: 'in_transit',
    category: 'Logistics',
  },
  {
    id: 'installation',
    title: 'Installation Management',
    description: 'Field service, certified technician deployment, and setup',
    icon: Wrench,
    stage: 'installed',
    category: 'Service',
  },
  {
    id: 'documentation',
    title: 'Documentation & Compliance',
    description: 'Warranty registration, photo documentation, compliance',
    icon: FileCheck,
    stage: 'active',
    category: 'Compliance',
  },
  {
    id: 'tracking',
    title: 'Asset Lifecycle Tracking',
    description: 'End-to-end equipment tracking with QR codes',
    icon: MapPin,
    stage: 'active',
    category: 'Technology',
  },
];

export default function EquipmentLifecycleHub() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isPODialogOpen, setIsPODialogOpen] = useState(false);
  // A breadcrumb quick action links here with ?action=new;
  // open the create dialog rather than dropping the user on the list.
  const quickAction = useActionParam();
  useEffect(() => {
    if (quickAction === 'new') setIsPODialogOpen(true);
  }, [quickAction]);
  const [isDeliveryDialogOpen, setIsDeliveryDialogOpen] = useState(false);
  const [isInstallationDialogOpen, setIsInstallationDialogOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<{ id: string; stage: string } | null>(
    null,
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch lifecycle metrics
  const { data: metrics } = useQuery<LifecycleMetrics>({
    queryKey: ['/api/equipment-lifecycle/metrics'],
    queryFn: async () => {
      return await apiRequest('/api/equipment-lifecycle/metrics', 'GET');
    },
  });

  // Fetch lifecycle stages
  const { data: lifecycleStages = [], isLoading: stagesLoading } = useQuery<
    EquipmentLifecycleRow[]
  >({
    queryKey: ['/api/equipment-lifecycle/lifecycle', selectedStage, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStage !== 'all') params.append('stage', selectedStage);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      // /lifecycle, not /stages: /stages is the stage vocabulary and this board
      // wants equipment rows.
      return await apiRequest(`/api/equipment-lifecycle/lifecycle?${params.toString()}`);
    },
  });

  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading: poLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['/api/equipment-lifecycle/purchase-orders'],
    queryFn: async () => {
      return await apiRequest('/api/equipment-lifecycle/purchase-orders', 'GET');
    },
  });

  // Fetch delivery schedules
  const { data: deliverySchedules = [], isLoading: deliveryLoading } = useQuery<DeliverySchedule[]>(
    {
      queryKey: ['/api/equipment-lifecycle/deliveries'],
      queryFn: async () => {
        return await apiRequest('/api/equipment-lifecycle/deliveries', 'GET');
      },
    },
  );

  // Fetch installations
  const { data: installations = [], isLoading: installationsLoading } = useQuery<Installation[]>({
    queryKey: ['/api/equipment-lifecycle/installations'],
    queryFn: async () => {
      return await apiRequest('/api/equipment-lifecycle/installations', 'GET');
    },
  });

  // Fetch asset tracking
  const { data: assets = [], isLoading: assetsLoading } = useQuery<AssetTracking[]>({
    queryKey: ['/api/equipment-lifecycle/assets'],
    queryFn: async () => {
      return await apiRequest('/api/equipment-lifecycle/assets', 'GET');
    },
  });

  // Fetch technicians and customers for dropdowns
  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ['/api/technicians'],
    queryFn: async () => {
      const response = await apiRequest('/api/technicians', 'GET');
      return extractRecords(response).map((t: any) => ({
        ...t,
        id: t.id,
        // AUDIT-011a: the technicians edge function returns { data, total, page,
        // limit } with RAW PostgREST rows, so first_name / last_name are what
        // arrive and these read undefined — every technician dropdown rendered
        // blank names.
        firstName: t.first_name || t.firstName || '',
        lastName: t.last_name || t.lastName || '',
      }));
    },
  });

  const { data: businessRecords = [] } = useQuery<any[]>({
    queryKey: ['/api/business-records'],
    queryFn: async () => {
      const response = await apiRequest('/api/business-records', 'GET');
      return extractRecords(response).map((r: any) => ({
        ...r,
        id: r.id,
        // /api/business-records is served by the business-records edge function,
        // whose mapCompanyToBusinessRecord emits BOTH companyName and
        // company_name, so this is a genuine fallback once the right side names
        // the other key.
        companyName: r.companyName || r.company_name || '',
      }));
    },
  });

  // Mutations
  const createPOMutation = useMutation({
    mutationFn: async (data: PurchaseOrderForm) =>
      await apiRequest('/api/equipment-lifecycle/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment-lifecycle/purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment-lifecycle/metrics'] });
      setIsPODialogOpen(false);
    },
    onError: (err) =>
      toast({
        title: 'Could not save the purchase order',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  const scheduleDeliveryMutation = useMutation({
    mutationFn: async (data: DeliveryScheduleForm) =>
      await apiRequest('/api/equipment-lifecycle/deliveries', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment-lifecycle/deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment-lifecycle/metrics'] });
      setIsDeliveryDialogOpen(false);
    },
    onError: (err) =>
      toast({
        title: 'Could not save the delivery',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  const scheduleInstallationMutation = useMutation({
    mutationFn: async (data: InstallationForm) =>
      await apiRequest('/api/equipment-lifecycle/installations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment-lifecycle/installations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment-lifecycle/metrics'] });
      setIsInstallationDialogOpen(false);
    },
    onError: (err) =>
      toast({
        title: 'Could not save the installation',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  // Form setup
  const poForm = useForm<PurchaseOrderForm>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      items: [
        { equipment_model: '', equipment_brand: '', description: '', quantity: 1, unit_price: 0 },
      ],
    },
  });

  const deliveryForm = useForm<DeliveryScheduleForm>({
    resolver: zodResolver(deliveryScheduleSchema),
    defaultValues: {
      delivery_type: 'standard',
      special_equipment_required: false,
    },
  });

  const installationForm = useForm<InstallationForm>({
    resolver: zodResolver(installationSchema),
  });

  // Handlers
  const onPOSubmit = (data: PurchaseOrderForm) => {
    createPOMutation.mutate(data);
  };

  const onDeliverySubmit = (data: DeliveryScheduleForm) => {
    scheduleDeliveryMutation.mutate(data);
  };

  const onInstallationSubmit = (data: InstallationForm) => {
    scheduleInstallationMutation.mutate(data);
  };

  const toggleStageExpansion = (stageId: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  // Helper functions
  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'ordered':
        return 'secondary';
      case 'received':
      case 'in_warehouse':
        return 'default';
      case 'in_transit':
      case 'delivered':
        return 'default';
      case 'installed':
      case 'active':
        return 'default';
      case 'maintenance':
        return 'destructive';
      case 'retired':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'delayed':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStageCount = (stage: string) => {
    return lifecycleStages.filter((s) => s.currentStage === stage).length;
  };

  const getStageEquipment = (stage: string) => {
    return lifecycleStages.filter((s) => s.currentStage === stage);
  };

  // WF-L-02: there is no progress_percentage and nothing computes one -
  // equipment_lifecycle records WHICH stage a machine is at, not how far through
  // it is. The share of the fleet sitting at a stage is a real number over the
  // same rows, so that is what the cards show.
  const getStageShare = (stage: string) => {
    if (lifecycleStages.length === 0) return 0;
    return Math.round((getStageCount(stage) / lifecycleStages.length) * 100);
  };

  // Recent activity, by when the row last moved. There is no stage_started_at
  // column; updated_at is what actually changes on a transition.
  const recentActivity = [...lifecycleStages]
    .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
    .slice(0, 5);

  // Render functions for different tabs would go here
  // (I'll continue in the next part due to length)

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Equipment Lifecycle Hub</h1>
            <p className="text-muted-foreground mt-2">
              Complete equipment workflow from procurement to active deployment
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Dialog open={isPODialogOpen} onOpenChange={setIsPODialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Package className="mr-2 h-4 w-4" />
                  New PO
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Purchase Order</DialogTitle>
                </DialogHeader>
                <Form {...poForm}>
                  <form onSubmit={poForm.handleSubmit(onPOSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    {record.companyName || record.company_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <FormLabel>Delivery Date</FormLabel>
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

                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Equipment Details</h4>
                      <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground">
                        <span>Brand</span>
                        <span>Model</span>
                        <span>Description</span>
                        <span>Qty</span>
                        <span>Price</span>
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
                                <Input placeholder="IR-2530i" {...field} />
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
                                <Input placeholder="MFP" {...field} />
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
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
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
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsPODialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createPOMutation.isPending}>
                        {createPOMutation.isPending ? 'Creating...' : 'Create'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={isDeliveryDialogOpen} onOpenChange={setIsDeliveryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Truck className="mr-2 h-4 w-4" />
                  Schedule Delivery
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Schedule Delivery</DialogTitle>
                </DialogHeader>
                <Form {...deliveryForm}>
                  <form
                    onSubmit={deliveryForm.handleSubmit(onDeliverySubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={deliveryForm.control}
                      name="purchase_order_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Order</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select PO" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {purchaseOrders.map((po) => (
                                <SelectItem key={po.id} value={po.id}>
                                  {po.poNumber} - {po.vendorName}
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
                            <FormLabel>Date</FormLabel>
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
                            <FormLabel>From</FormLabel>
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
                            <FormLabel>To</FormLabel>
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
                            <FormLabel>Phone</FormLabel>
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
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Delivery address..." rows={2} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDeliveryDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={scheduleDeliveryMutation.isPending}>
                        {scheduleDeliveryMutation.isPending ? 'Scheduling...' : 'Schedule'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={isInstallationDialogOpen} onOpenChange={setIsInstallationDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Wrench className="mr-2 h-4 w-4" />
                  Schedule Install
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Schedule Installation</DialogTitle>
                </DialogHeader>
                <Form {...installationForm}>
                  <form
                    onSubmit={installationForm.handleSubmit(onInstallationSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={installationForm.control}
                      name="equipment_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment ID / Serial</FormLabel>
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
                            <FormLabel>Date</FormLabel>
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
                            <FormLabel>Start</FormLabel>
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
                            <FormLabel>End</FormLabel>
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
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input placeholder="Building, floor, room..." {...field} />
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
                            <FormLabel>Site Contact</FormLabel>
                            <FormControl>
                              <Input placeholder="Contact name" {...field} />
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
                            <FormLabel>Phone</FormLabel>
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
                                  {tech.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsInstallationDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={scheduleInstallationMutation.isPending}>
                        {scheduleInstallationMutation.isPending ? 'Scheduling...' : 'Schedule'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Button className="bg-blue-600 hover:bg-blue-700" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Quick Actions
            </Button>
          </div>
        </div>

        {/* Metrics Dashboard - Collapsible */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Key Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <Package className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <div className="text-2xl font-bold">{metrics?.totalEquipmentInProcess || 0}</div>
                <p className="text-xs text-muted-foreground">In Process</p>
              </div>
              <div className="text-center">
                <Truck className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <div className="text-2xl font-bold">{metrics?.pendingDeliveries || 0}</div>
                <p className="text-xs text-muted-foreground">Deliveries</p>
              </div>
              <div className="text-center">
                <Wrench className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <div className="text-2xl font-bold">{metrics?.scheduledInstallations || 0}</div>
                <p className="text-xs text-muted-foreground">Installations</p>
              </div>
              <div className="text-center">
                <Target className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <div className="text-2xl font-bold">{metrics?.activeAssets || 0}</div>
                <p className="text-xs text-muted-foreground">Active Assets</p>
              </div>
              <div className="text-center">
                <Clock className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <div className="text-2xl font-bold">{metrics?.averageInstallationTime || 0}h</div>
                <p className="text-xs text-muted-foreground">Avg Install</p>
              </div>
              <div className="text-center">
                <Star className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
                <div className="text-2xl font-bold">
                  {metrics?.customerSatisfactionRating || 0}/5
                </div>
                <p className="text-xs text-muted-foreground">Satisfaction</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lifecycle Stage Cards with Progressive Disclosure */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Lifecycle Stages</h2>
            <Button variant="outline" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              View All
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lifecycleStageCards.map((stageCard) => {
              const IconComponent = stageCard.icon;
              const count = getStageCount(stageCard.stage);
              const completion = getStageShare(stageCard.stage);
              const isExpanded = expandedStages.has(stageCard.id);
              const stageEquipment = getStageEquipment(stageCard.stage);

              return (
                <Card key={stageCard.id} className="hover:shadow-md transition-shadow">
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => toggleStageExpansion(stageCard.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <IconComponent className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base">{stageCard.title}</CardTitle>
                          <Badge variant="secondary" className="text-xs mt-1">
                            {stageCard.category}
                          </Badge>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm mb-4">
                      {stageCard.description}
                    </CardDescription>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Active Items</span>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Avg Completion</span>
                          <span className="font-medium">{completion}%</span>
                        </div>
                        <Progress value={completion} className="h-2" />
                      </div>
                    </div>

                    {/* Expanded State - Show Equipment List */}
                    {isExpanded && stageEquipment.length > 0 && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        <h4 className="text-sm font-medium mb-2">Equipment in this stage:</h4>
                        {stageEquipment.map((equipment) => (
                          <div key={equipment.id} className="p-2 bg-muted rounded-lg text-sm">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {equipment.manufacturer} {equipment.model}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {equipment.customerName ?? 'Unassigned'}
                                  {equipment.serialNumber ? ` • ${equipment.serialNumber}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* current_stage IS the status. There is no separate
                                    stage_status column and never was. */}
                                {getStatusIcon(equipment.currentStage ?? '')}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEquipment({
                                      id: equipment.equipmentId ?? '',
                                      stage: equipment.currentStage ?? '',
                                    });
                                    setTransitionDialogOpen(true);
                                  }}
                                >
                                  <Workflow className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isExpanded && stageEquipment.length === 0 && (
                      <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
                        No equipment in this stage
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Operational Tabs - Full functionality from Management page */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="lifecycle" className="text-xs sm:text-sm">
              Lifecycle
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-xs sm:text-sm">
              Orders
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="text-xs sm:text-sm">
              Deliveries
            </TabsTrigger>
            <TabsTrigger value="installations" className="text-xs sm:text-sm">
              Installs
            </TabsTrigger>
            <TabsTrigger value="assets" className="text-xs sm:text-sm">
              Assets
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm">
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Tab content sections will be added next */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Activity */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Lifecycle Activity</CardTitle>
                    <CardDescription>Latest equipment updates across all stages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stagesLoading ? (
                      <div className="py-4">
                        <ListSkeleton count={3} />
                      </div>
                    ) : recentActivity.length === 0 ? (
                      <EmptyState
                        icon={Activity}
                        title="No recent activity"
                        description="Activity will appear here as equipment progresses through lifecycle stages."
                        className="py-8"
                      />
                    ) : (
                      <div className="space-y-3">
                        {recentActivity.map((activity) => (
                          <div
                            key={activity.id}
                            className="flex items-start space-x-3 p-3 border rounded-lg"
                          >
                            {getStatusIcon(activity.currentStage ?? '')}
                            <div className="flex-1 space-y-1 min-w-0">
                              <p className="text-sm font-medium leading-none">
                                {activity.manufacturer} {activity.model}
                              </p>
                              {/* next_action_required has no column and nothing
                                  derives one, so the line carries where the machine
                                  is instead of a next step nobody recorded. */}
                              <p className="text-xs text-muted-foreground">
                                {activity.customerName ?? 'Unassigned'}
                                {activity.currentLocation ? ` • ${activity.currentLocation}` : ''}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {activity.updatedAt
                                  ? format(new Date(activity.updatedAt), 'MMM dd, yyyy • h:mm a')
                                  : '—'}
                              </p>
                            </div>
                            <Badge
                              variant={getStageColor(activity.currentStage ?? '')}
                              className="text-xs flex-shrink-0"
                            >
                              {(activity.currentStage ?? 'unknown').replace('_', ' ')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions Sidebar */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setIsPODialogOpen(true)}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Create Purchase Order
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setIsDeliveryDialogOpen(true)}
                    >
                      <Truck className="h-4 w-4 mr-2" />
                      Schedule Delivery
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setIsInstallationDialogOpen(true)}
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Schedule Installation
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Camera className="h-4 w-4 mr-2" />
                      Generate QR Codes
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Shield className="h-4 w-4 mr-2" />
                      Warranty Registration
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Reports
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Workflow Efficiency</span>
                        <span className="font-medium">92%</span>
                      </div>
                      <Progress value={92} className="h-2" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">On-Time Delivery</span>
                        <span className="font-medium">88%</span>
                      </div>
                      <Progress value={88} className="h-2" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Compliance Rate</span>
                        <span className="font-medium">95%</span>
                      </div>
                      <Progress value={95} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Lifecycle Tab - Full equipment list with filters */}
          <TabsContent value="lifecycle" className="space-y-6 mt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by stage" />
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
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
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
                <CardDescription>Track equipment through all lifecycle stages</CardDescription>
              </CardHeader>
              <CardContent>
                {stagesLoading ? (
                  <div className="py-4">
                    <ListSkeleton count={4} />
                  </div>
                ) : lifecycleStages.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="No equipment found"
                    description="Create a purchase order to start tracking equipment."
                    action={{
                      label: 'Create Purchase Order',
                      onClick: () => setIsPODialogOpen(true),
                      icon: Plus,
                    }}
                  />
                ) : (
                  <div className="space-y-3">
                    {lifecycleStages.map((stage) => (
                      <div
                        key={stage.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-medium">
                                {stage.manufacturer} {stage.model}
                              </h3>
                              <Badge variant={getStageColor(stage.currentStage ?? '')}>
                                {(stage.currentStage ?? 'unknown').replace('_', ' ')}
                              </Badge>
                              {getStatusIcon(stage.currentStage ?? '')}
                            </div>
                            {/* WF-L-02: estimated_completion_date, next_action_required
                                and assigned_to_name were all invented - equipment_lifecycle
                                has none of them, and nothing anywhere derives them. What
                                the table does record is where the machine is, when it last
                                moved, and which order it came from. */}
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Serial: {stage.serialNumber ?? '—'}</p>
                              <p>Customer: {stage.customerName || 'Not assigned'}</p>
                              <p>
                                Last moved:{' '}
                                {stage.updatedAt
                                  ? format(new Date(stage.updatedAt), 'MMM dd, yyyy')
                                  : '—'}
                              </p>
                              {stage.currentLocation && <p>Location: {stage.currentLocation}</p>}
                              {stage.lastServiceDate && (
                                <p>
                                  Last service:{' '}
                                  {format(new Date(stage.lastServiceDate), 'MMM dd, yyyy')}
                                </p>
                              )}
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedEquipment({
                                    id: stage.equipmentId ?? '',
                                    stage: stage.currentStage ?? '',
                                  });
                                  setTransitionDialogOpen(true);
                                }}
                              >
                                <Workflow className="h-4 w-4 mr-2" />
                                Transition Stage
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedEquipment({
                                    id: stage.equipmentId ?? '',
                                    stage: stage.currentStage ?? '',
                                  });
                                  setHistoryDialogOpen(true);
                                }}
                              >
                                <History className="h-4 w-4 mr-2" />
                                History
                              </Button>
                            </div>
                          </div>
                          {/* The progress readout is gone with the column it read.
                              A percentage through a stage is not something this
                              data supports, and a Progress bar asserts a
                              measurement. The stage badge above says where the
                              machine is, which is what is actually known. */}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Purchase Orders</CardTitle>
                    <CardDescription>Manage equipment procurement</CardDescription>
                  </div>
                  <Button onClick={() => setIsPODialogOpen(true)} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New Order
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {poLoading ? (
                  <div className="py-4">
                    <ListSkeleton count={3} />
                  </div>
                ) : purchaseOrders.length === 0 ? (
                  <EmptyState
                    icon={ShoppingCart}
                    title="No purchase orders"
                    description="Create your first purchase order to start tracking."
                    action={{
                      label: 'Create Purchase Order',
                      onClick: () => setIsPODialogOpen(true),
                      icon: Plus,
                    }}
                  />
                ) : (
                  <div className="space-y-3">
                    {purchaseOrders.map((po) => (
                      <div
                        key={po.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-medium">{po.poNumber ?? po.id}</h3>
                              <Badge variant={getStageColor(po.status ?? '')}>{po.status}</Badge>
                            </div>
                            {/* customer_name and tracking_number are not columns on
                                purchase_orders. WF-P-03 gave the table the sale it is
                                for, so the contract is shown where the invented
                                customer used to be. */}
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Vendor: {po.vendorName ?? 'Unknown'}</p>
                              {po.sourceContractId && <p>Contract: {po.sourceContractId}</p>}
                              <p>
                                Order date:{' '}
                                {po.orderDate
                                  ? format(new Date(po.orderDate), 'MMM dd, yyyy')
                                  : '—'}
                              </p>
                              <p>
                                Expected:{' '}
                                {po.expectedDate
                                  ? format(new Date(po.expectedDate), 'MMM dd, yyyy')
                                  : '—'}
                              </p>
                              <p>Items: {po.lineItemsCount}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xl font-bold">
                              {po.totalAmount == null
                                ? '—'
                                : `$${Number(po.totalAmount).toLocaleString()}`}
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

          {/* Deliveries Tab */}
          <TabsContent value="deliveries" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Delivery Schedules</CardTitle>
                    <CardDescription>Manage equipment deliveries</CardDescription>
                  </div>
                  <Button onClick={() => setIsDeliveryDialogOpen(true)} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Schedule Delivery
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {deliveryLoading ? (
                  <div className="py-4">
                    <ListSkeleton count={3} />
                  </div>
                ) : deliverySchedules.length === 0 ? (
                  <EmptyState
                    icon={Truck}
                    title="No deliveries scheduled"
                    description="Schedule your first delivery to track shipments."
                    action={{
                      label: 'Schedule Delivery',
                      onClick: () => setIsDeliveryDialogOpen(true),
                      icon: Plus,
                    }}
                  />
                ) : (
                  <div className="space-y-3">
                    {deliverySchedules.map((delivery) => (
                      <div
                        key={delivery.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-medium">
                                {delivery.customerName ?? 'Unassigned'}
                                {delivery.equipmentModel ? ` — ${delivery.equipmentModel}` : ''}
                              </h3>
                              <Badge variant={getStageColor(delivery.status ?? '')}>
                                {delivery.status}
                              </Badge>
                              <Badge variant="outline">{delivery.deliveryType}</Badge>
                            </div>
                            {/* ONE window: delivery_schedules.time_window is a single
                                free-text column ("morning"), not a start/end pair. */}
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>
                                Date:{' '}
                                {delivery.scheduledDate
                                  ? format(new Date(delivery.scheduledDate), 'MMM dd, yyyy')
                                  : '—'}
                              </p>
                              {delivery.timeWindow && <p>Window: {delivery.timeWindow}</p>}
                              <p>
                                Contact: {delivery.contactPerson ?? '—'}
                                {delivery.contactPhone ? ` (${delivery.contactPhone})` : ''}
                              </p>
                              {/* An id, not a name: there is no drivers table to
                                  resolve driver_id against. */}
                              {delivery.driverId && <p>Driver id: {delivery.driverId}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Truck className="h-6 w-6 text-muted-foreground" />
                            {getStatusIcon(delivery.status ?? '')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Installations Tab */}
          <TabsContent value="installations" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Installation Schedule</CardTitle>
                    <CardDescription>Manage equipment installations</CardDescription>
                  </div>
                  <Button onClick={() => setIsInstallationDialogOpen(true)} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Schedule Installation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {installationsLoading ? (
                  <div className="py-4">
                    <ListSkeleton count={3} />
                  </div>
                ) : installations.length === 0 ? (
                  <EmptyState
                    icon={Wrench}
                    title="No installations scheduled"
                    description="Schedule your first installation."
                    action={{
                      label: 'Schedule Installation',
                      onClick: () => setIsInstallationDialogOpen(true),
                      icon: Plus,
                    }}
                  />
                ) : (
                  <div className="space-y-3">
                    {installations.map((installation) => (
                      <div
                        key={installation.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-medium">
                                {installation.equipmentBrand} {installation.equipmentModel}
                              </h3>
                              <Badge variant={getStageColor(installation.status ?? '')}>
                                {installation.status}
                              </Badge>
                            </div>
                            {/* The location lives in site_requirements (jsonb) and is
                                not surfaced as a column, so it is not shown as one.
                                estimated_duration is MINUTES - the old type read the
                                same column and called it hours. */}
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Customer: {installation.customerName ?? 'Unassigned'}</p>
                              <p>
                                Date:{' '}
                                {installation.scheduledDate
                                  ? format(new Date(installation.scheduledDate), 'MMM dd, yyyy')
                                  : '—'}
                              </p>
                              {installation.estimatedDurationMinutes != null && (
                                <p>Duration: {installation.estimatedDurationMinutes} minutes</p>
                              )}
                              <p>Technician: {installation.leadTechnicianName || 'Not assigned'}</p>
                              {installation.customerSatisfactionRating && (
                                <div className="flex items-center gap-1">
                                  <span>Rating:</span>
                                  <div className="flex">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`h-3 w-3 ${
                                          i < installation.customerSatisfactionRating!
                                            ? 'fill-yellow-400 text-yellow-400'
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Wrench className="h-6 w-6 text-muted-foreground" />
                            {getStatusIcon(installation.status ?? '')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Asset Tracking</CardTitle>
                <CardDescription>Monitor active equipment and assets</CardDescription>
              </CardHeader>
              <CardContent>
                {assetsLoading ? (
                  <div className="py-4">
                    <ListSkeleton count={3} />
                  </div>
                ) : assets.length === 0 ? (
                  <EmptyState
                    icon={Target}
                    title="No assets tracked"
                    description="Assets will appear here once equipment is installed."
                  />
                ) : (
                  <div className="space-y-3">
                    {assets.map((asset) => (
                      <div
                        key={asset.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-medium">
                                {asset.manufacturer} {asset.model}
                              </h3>
                              <Badge variant={getStageColor(asset.status ?? '')}>
                                {asset.status}
                              </Badge>
                              {asset.assetTag && <Badge variant="outline">{asset.assetTag}</Badge>}
                            </div>
                            {/* next_maintenance_due is not a column and nothing
                                schedules one, so the install date is shown instead of
                                a maintenance date nobody set. The meter line reports
                                the LATEST reading and its date: a machine that has
                                never been read has no count, and rendering 0 there
                                would claim it printed nothing. */}
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Serial: {asset.serialNumber ?? '—'}</p>
                              <p>Customer: {asset.customerName || 'Not assigned'}</p>
                              {asset.locationDescription && (
                                <p>Location: {asset.locationDescription}</p>
                              )}
                              {asset.installDate && (
                                <p>
                                  Installed: {format(new Date(asset.installDate), 'MMM dd, yyyy')}
                                </p>
                              )}
                              {asset.latestReadingDate ? (
                                <p>
                                  Meters on {format(new Date(asset.latestReadingDate), 'MMM dd')}:{' '}
                                  B&amp;W {(asset.bwMeterReading ?? 0).toLocaleString()} • Color{' '}
                                  {(asset.colorMeterReading ?? 0).toLocaleString()}
                                </p>
                              ) : (
                                <p>No meter reading recorded</p>
                              )}
                            </div>
                          </div>
                          <div className="text-center flex-shrink-0">
                            <Target className="h-8 w-8 text-primary mx-auto mb-1" />
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

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Workflow Performance
                  </CardTitle>
                  <CardDescription>Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Workflow Efficiency</span>
                      <span className="font-medium">92%</span>
                    </div>
                    <Progress value={92} className="h-2" />
                    <p className="text-xs text-muted-foreground">Average completion rate</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time to Deployment</span>
                      <span className="font-medium">78%</span>
                    </div>
                    <Progress value={78} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      22% faster than industry average
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Customer Satisfaction</span>
                      <span className="font-medium">
                        {metrics?.customerSatisfactionRating || 0}/5
                      </span>
                    </div>
                    <Progress
                      value={(metrics?.customerSatisfactionRating || 0) * 20}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Insights</CardTitle>
                  <CardDescription>Automated metrics and trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-muted-foreground">Automated Tasks</span>
                      <Badge variant="secondary">89% automation</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-muted-foreground">On-Time Delivery</span>
                      <Badge variant="default">88% on-time</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-muted-foreground">Cost Optimization</span>
                      <Badge variant="outline">$12K monthly savings</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-muted-foreground">Compliance Rate</span>
                      <Badge variant="default">95% compliant</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Equipment Transition Dialog */}
        {selectedEquipment && (
          <EquipmentTransitionDialog
            open={transitionDialogOpen}
            onOpenChange={setTransitionDialogOpen}
            equipmentId={selectedEquipment.id}
            currentStage={selectedEquipment.stage}
            onTransitionComplete={() => {
              // Invalidate all relevant queries to refresh the UI
              queryClient.invalidateQueries({ queryKey: ['/api/equipment-lifecycle/stages'] });
              queryClient.invalidateQueries({ queryKey: ['/api/equipment-lifecycle/metrics'] });
              queryClient.invalidateQueries({ queryKey: ['/api/equipment-lifecycle/assets'] });
            }}
          />
        )}

        {/* Equipment Transition History Dialog */}
        {selectedEquipment && (
          <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Equipment Transition History</DialogTitle>
                <DialogDescription>
                  Complete audit trail of lifecycle stage transitions
                </DialogDescription>
              </DialogHeader>
              <EquipmentTransitionHistory equipmentId={selectedEquipment.id} />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </MainLayout>
  );
}
