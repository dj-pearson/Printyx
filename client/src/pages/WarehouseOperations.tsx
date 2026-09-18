import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MainLayout } from '@/components/layout/main-layout';
import { useLocation } from 'wouter';
import {
  type Equipment,
  type WarehouseOperation,
  type Technician,
  type BusinessRecord,
} from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  QrCode,
  Truck,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  MapPin,
  User,
  FileText,
  Camera,
  Settings,
  BarChart3,
  DollarSign,
  TrendingUp,
  Activity,
  Wrench,
  Shield,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import WarehouseTeamStatsWidget from '@/components/stats/WarehouseTeamStatsWidget';
import { useActionParam } from '@/hooks/use-action-param';

// Warehouse operation schema
const warehouseOperationSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment is required'),
  operationType: z.enum(['receiving', 'quality_control', 'staging', 'shipping', 'build']),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']).default('pending'),
  assignedTo: z.string().optional(),
  scheduledDate: z.date().optional(),
  notes: z.string().optional(),
  qualityControlChecks: z.record(z.boolean()).optional(),
  photos: z.array(z.string()).optional(),
});

// Serial number management schema
const serialNumberSchema = z.object({
  serialNumber: z.string().min(1, 'Serial number is required'),
  equipmentId: z.string().min(1, 'Equipment is required'),
  status: z
    .enum(['received', 'staged', 'built', 'tested', 'shipped', 'delivered'])
    .default('received'),
  location: z.string().optional(),
  accessories: z
    .array(
      z.object({
        accessoryId: z.string(),
        serialNumber: z.string().optional(),
        status: z.enum(['pending', 'matched', 'installed']).default('pending'),
      }),
    )
    .optional(),
});

// Build process schema
// WF-L-05: the kitting operation a technician opens for a build.
//
// This schema used to describe a shape warehouse_kitting_operations does not
// have - modelId, scheduledDate, an accessories[] of ids and quantities, a
// buildSteps[] with per-step estimates - behind a dialog that never opened,
// above a tab that said "will be implemented here". Rebound to the real
// columns: order_number, customer_id, kit_name and assigned_technician are all
// NOT NULL, the checklist is a jsonb array of items, and the serials are the
// units this build covers.
const buildProcessSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required'),
  customerId: z.string().min(1, 'Customer is required'),
  kitName: z.string().min(1, 'Kit name is required'),
  assignedTechnician: z.string().min(1, 'Technician is required'),
  equipmentModel: z.string().optional(),
  serialNumbers: z.string().optional(),
  checklist: z.string().optional(),
  notes: z.string().optional(),
});

// Delivery schedule schema
const deliveryScheduleSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  equipmentId: z.string().min(1, 'Equipment is required'),
  deliveryDate: z.date(),
  deliveryWindow: z.string(), // "morning", "afternoon", "all_day"
  deliveryAddress: z.string().min(1, 'Delivery address is required'),
  specialInstructions: z.string().optional(),
  requiredAccessories: z.array(z.string()).optional(),
  deliveryTeam: z.array(z.string()).optional(),
  installationRequired: z.boolean().default(false),
  installationDate: z.date().optional(),
});

// WF-L-05 shapes, matching what supabase/functions/warehouse-operations returns.
interface ChecklistItem {
  item: string;
  completed: boolean;
  completedBy?: string | null;
  completedAt?: string | null;
  notes?: string | null;
}

interface KittingOperation {
  id: string;
  orderNumber: string;
  kitName: string;
  customerId: string;
  equipmentModel?: string | null;
  assignedTechnician: string;
  checklistItems?: ChecklistItem[] | null;
  serialNumbers?: string[] | null;
  operationStatus?: string | null;
  qualityStatus?: string | null;
  firstPassYield?: boolean | null;
  reworkCount?: number | null;
  reworkNotes?: string | null;
  completedAt?: string | null;
  notes?: string | null;
}

interface SerialUnit {
  id: string;
  equipmentId?: string | null;
  serialNumber?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  currentStage?: string | null;
  currentLocation?: string | null;
  kittingStatus: string;
  kitting?: Pick<
    KittingOperation,
    'id' | 'orderNumber' | 'kitName' | 'operationStatus' | 'qualityStatus' | 'firstPassYield'
  > | null;
}

interface FpyMetrics {
  totalOperations: number;
  firstPassOperations: number;
  /** null when nothing completed in the window - a yield over zero units is not 0%. */
  fpyPercentage: number | null;
  reworkRate: number | null;
  topDefectTypes?: Array<{ defectType: string; count: number; percentage: number }>;
  unbacked?: string[];
  reason?: string;
}

/** Comma or newline separated free text to a trimmed list. */
function splitList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** A percentage the backend may legitimately not have. */
function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value}%`;
}

type WarehouseOperationFormData = z.infer<typeof warehouseOperationSchema>;
type SerialNumberFormData = z.infer<typeof serialNumberSchema>;
type BuildProcessFormData = z.infer<typeof buildProcessSchema>;
type DeliveryScheduleFormData = z.infer<typeof deliveryScheduleSchema>;

// Status colors and icons
const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  received: 'bg-blue-100 text-blue-800',
  staged: 'bg-purple-100 text-purple-800',
  built: 'bg-indigo-100 text-indigo-800',
  tested: 'bg-green-100 text-green-800',
  shipped: 'bg-orange-100 text-orange-800',
  delivered: 'bg-emerald-100 text-emerald-800',
};

const statusIcons = {
  pending: Clock,
  in_progress: Activity,
  completed: CheckCircle,
  failed: AlertTriangle,
  receiving: Package,
  quality_control: Shield,
  staging: Settings,
  shipping: Truck,
  build: Wrench,
};

export default function WarehouseOperations() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOperation, setSelectedOperation] = useState<WarehouseOperation | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  // A breadcrumb quick action links here with ?action=new-part;
  // open the create dialog rather than dropping the user on the list.
  const quickAction = useActionParam();
  useEffect(() => {
    if (quickAction === 'new-part') setShowCreateDialog(true);
  }, [quickAction]);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showSerialDialog, setShowSerialDialog] = useState(false);
  const [showBuildDialog, setShowBuildDialog] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);

  // Fetch warehouse operations
  const { data: operations = [], isLoading } = useQuery<WarehouseOperation[]>({
    queryKey: ['/api/warehouse-operations'],
  });

  // Fetch equipment for dropdowns
  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ['/api/equipment'],
  });

  // Fetch technicians
  const { data: technicians = [] } = useQuery<Technician[]>({
    queryKey: ['/api/technicians'],
  });

  // Fetch customers
  const { data: customers = [] } = useQuery<BusinessRecord[]>({
    queryKey: ['/api/customers'],
  });

  // WF-L-05: kitting operations, the serials still in the warehouse, and the
  // first-pass yield over them. All three are served by the same edge function
  // as the board above, so dev and production agree.
  const { data: kittingOps = [], isLoading: kittingLoading } = useQuery<KittingOperation[]>({
    queryKey: ['/api/warehouse-operations/kitting'],
  });

  const { data: serialUnits = [], isLoading: serialsLoading } = useQuery<SerialUnit[]>({
    queryKey: ['/api/warehouse-operations/serials'],
  });

  const { data: fpy } = useQuery<FpyMetrics>({
    queryKey: ['/api/warehouse-operations/fpy-metrics'],
  });

  // Fetch statistics
  const { data: stats = {} } = useQuery<{
    totalOperations?: number;
    pendingOperations?: number;
    inProgressOperations?: number;
    completedOperations?: number;
  }>({
    queryKey: ['/api/warehouse-operations/stats'],
  });

  // If navigated with orderId in query, jump to Delivery tab and show cues
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const orderIdFromUrl = params.get('orderId');
    if (orderIdFromUrl) {
      setActiveTab('delivery');
    }
  }, []);

  // Create operation mutation
  const createOperationMutation = useMutation({
    mutationFn: async (data: WarehouseOperationFormData) =>
      apiRequest('/api/warehouse-operations', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/warehouse-operations'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/warehouse-operations/stats'],
      });
      setShowCreateDialog(false);
      toast({ title: 'Operation created successfully' });
    },
  });

  // Update operation status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      operationType,
    }: {
      id: string;
      status: string;
      operationType?: string;
    }) => apiRequest(`/api/warehouse-operations/${id}/status`, 'PATCH', { status }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/warehouse-operations'],
      });

      // If build operation is completed, guide to installation scheduling
      if (variables.status === 'completed' && variables.operationType === 'build') {
        toast({
          title: 'Build completed successfully!',
          description: 'Ready to schedule delivery and installation',
        });
        // Automatically switch to delivery tab for next step
        setActiveTab('delivery');
      } else {
        toast({ title: 'Status updated successfully' });
      }
    },
  });

  const refreshKitting = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/warehouse-operations/kitting'] });
    queryClient.invalidateQueries({ queryKey: ['/api/warehouse-operations/serials'] });
    queryClient.invalidateQueries({ queryKey: ['/api/warehouse-operations/fpy-metrics'] });
  };

  const createKittingMutation = useMutation({
    mutationFn: async (data: BuildProcessFormData) =>
      apiRequest('/api/warehouse-operations/kitting', 'POST', {
        orderNumber: data.orderNumber,
        customerId: data.customerId,
        kitName: data.kitName,
        assignedTechnician: data.assignedTechnician,
        equipmentModel: data.equipmentModel || null,
        serialNumbers: splitList(data.serialNumbers),
        checklistItems: splitList(data.checklist).map((item) => ({ item, completed: false })),
        notes: data.notes || null,
      }),
    onSuccess: () => {
      refreshKitting();
      setShowBuildDialog(false);
      buildForm.reset();
      toast({ title: 'Build opened', description: 'The kitting operation is in progress.' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not open the build',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: async ({ id, items }: { id: string; items: ChecklistItem[] }) =>
      apiRequest(`/api/warehouse-operations/kitting/${id}`, 'PATCH', { checklistItems: items }),
    onSuccess: refreshKitting,
  });

  const completeKittingMutation = useMutation({
    mutationFn: async ({ id, passed, notes }: { id: string; passed: boolean; notes?: string }) =>
      apiRequest(`/api/warehouse-operations/kitting/${id}/complete`, 'POST', { passed, notes }),
    onSuccess: (_data, variables) => {
      refreshKitting();
      toast({
        title: variables.passed ? 'QA passed' : 'QA failed',
        description: variables.passed
          ? 'The unit is cleared to stage.'
          : 'Rework recorded. First pass is not restored by a later pass.',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Could not record QA', description: error.message, variant: 'destructive' });
    },
  });

  // Form setup
  const form = useForm<WarehouseOperationFormData>({
    resolver: zodResolver(warehouseOperationSchema),
    defaultValues: {
      operationType: 'receiving',
      status: 'pending',
    },
  });

  const serialForm = useForm<SerialNumberFormData>({
    resolver: zodResolver(serialNumberSchema),
    defaultValues: {
      status: 'received',
    },
  });

  const buildForm = useForm<BuildProcessFormData>({
    resolver: zodResolver(buildProcessSchema),
    defaultValues: {
      orderNumber: '',
      customerId: '',
      kitName: '',
      assignedTechnician: '',
      equipmentModel: '',
      serialNumbers: '',
      checklist: '',
      notes: '',
    },
  });

  const deliveryForm = useForm<DeliveryScheduleFormData>({
    resolver: zodResolver(deliveryScheduleSchema),
    defaultValues: {
      deliveryWindow: 'all_day',
      installationRequired: false,
    },
  });

  // Filter operations
  const filteredOperations = operations.filter((op: WarehouseOperation) => {
    if (statusFilter !== 'all' && op.status !== statusFilter) return false;
    if (searchTerm && !op.equipmentId?.toLowerCase().includes(searchTerm.toLowerCase()))
      return false;
    return true;
  });

  const onSubmit = (data: WarehouseOperationFormData) => {
    createOperationMutation.mutate(data);
  };

  return (
    <MainLayout
      title="Warehouse Operations"
      description="Manage receiving, inventory, build processes, and delivery scheduling"
    >
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Mobile scrollable tabs */}
          <div className="md:hidden overflow-x-auto">
            <TabsList className="inline-flex h-9 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground">
              <div className="flex space-x-1 min-w-max">
                <TabsTrigger value="overview" className="whitespace-nowrap text-xs px-3">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="receiving" className="whitespace-nowrap text-xs px-3">
                  Receiving
                </TabsTrigger>
                <TabsTrigger value="inventory" className="whitespace-nowrap text-xs px-3">
                  Inventory
                </TabsTrigger>
                <TabsTrigger value="build" className="whitespace-nowrap text-xs px-3">
                  Build
                </TabsTrigger>
                <TabsTrigger value="delivery" className="whitespace-nowrap text-xs px-3">
                  Delivery
                </TabsTrigger>
                <TabsTrigger value="analytics" className="whitespace-nowrap text-xs px-3">
                  Analytics
                </TabsTrigger>
              </div>
            </TabsList>
          </div>

          {/* Desktop grid tabs */}
          <TabsList className="hidden md:grid w-full grid-cols-3 lg:grid-cols-6 gap-1">
            <TabsTrigger value="overview" className="text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="receiving" className="text-sm">
              Receiving
            </TabsTrigger>
            <TabsTrigger value="inventory" className="text-sm">
              Inventory
            </TabsTrigger>
            <TabsTrigger value="build" className="text-sm">
              Build
            </TabsTrigger>
            <TabsTrigger value="delivery" className="text-sm">
              Delivery
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-sm">
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Warehouse Team Performance Stats */}
            <WarehouseTeamStatsWidget variant="full" showAutoRefresh={true} />

            {/* Statistics Dashboard */}
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center space-x-2">
                      <Package className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
                      <div>
                        <p className="text-lg md:text-2xl font-bold">
                          {stats.totalOperations || 0}
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground">Total Operations</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-6 w-6 md:h-8 md:w-8 text-yellow-600" />
                      <div>
                        <p className="text-lg md:text-2xl font-bold">
                          {stats.pendingOperations || 0}
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground">Pending</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center space-x-2">
                      <Activity className="h-6 w-6 md:h-8 md:w-8 text-orange-600" />
                      <div>
                        <p className="text-lg md:text-2xl font-bold">
                          {stats.inProgressOperations || 0}
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground">In Progress</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
                      <div>
                        <p className="text-lg md:text-2xl font-bold">
                          {stats.completedOperations || 0}
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground">Completed</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* WF-L-05: first-pass yield, from the kitting operations that
                actually completed. `—` rather than 0% when nothing did: a yield
                over an empty window is not a collapse in build quality, and 0%
                on a quality card reads as exactly that. */}
            {fpy && (
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base md:text-lg">First-pass yield</CardTitle>
                  <CardDescription>
                    {fpy.totalOperations} build{fpy.totalOperations === 1 ? '' : 's'} completed in
                    the last week
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-lg font-bold md:text-2xl">{pct(fpy.fpyPercentage)}</p>
                      <p className="text-xs text-muted-foreground md:text-sm">FPY</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold md:text-2xl">{pct(fpy.reworkRate)}</p>
                      <p className="text-xs text-muted-foreground md:text-sm">Rework rate</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold md:text-2xl">{fpy.firstPassOperations}</p>
                      <p className="text-xs text-muted-foreground md:text-sm">First pass</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold md:text-2xl">
                        {fpy.topDefectTypes?.[0]?.defectType ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground md:text-sm">Top defect</p>
                    </div>
                  </div>
                  {fpy.reason && <p className="mt-3 text-sm text-muted-foreground">{fpy.reason}</p>}
                </CardContent>
              </Card>
            )}

            {/* Recent Operations */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle>Recent Operations</CardTitle>
                <CardDescription>Latest warehouse activities and their status</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-3 sm:space-y-4">
                  {filteredOperations.slice(0, 5).map((operation: WarehouseOperation) => {
                    const StatusIcon =
                      statusIcons[operation.operationType as keyof typeof statusIcons] || Package;
                    return (
                      <div
                        key={operation.id}
                        className="flex items-center justify-between p-3 sm:p-4 border rounded-lg min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <StatusIcon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {operation.operationType.replace('_', ' ').toUpperCase()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Equipment ID: {operation.equipmentId}
                            </p>
                          </div>
                        </div>
                        <Badge
                          className={statusColors[operation.status as keyof typeof statusColors]}
                        >
                          {operation.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receiving" className="space-y-6">
            <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Receiving Operations</h2>
                <p className="text-sm md:text-base text-muted-foreground">
                  Process incoming shipments and manage inventory
                </p>
              </div>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="w-full md:w-auto min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Operation
              </Button>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        aria-label="Search operations"
                        placeholder="Search operations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 w-full md:w-auto">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Operations List - Mobile-Responsive */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Operation Type</TableHead>
                            <TableHead>Equipment ID</TableHead>
                            <TableHead>Assigned To</TableHead>
                            <TableHead>Scheduled Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredOperations.map((operation: WarehouseOperation) => {
                            const StatusIcon =
                              statusIcons[operation.status as keyof typeof statusIcons] || Clock;

                            return (
                              <TableRow key={operation.id}>
                                <TableCell className="font-medium">
                                  {operation.operationType.replace('_', ' ').toUpperCase()}
                                </TableCell>
                                <TableCell>{operation.equipmentId}</TableCell>
                                <TableCell>{operation.assignedTo || 'Unassigned'}</TableCell>
                                <TableCell>
                                  {operation.scheduledDate
                                    ? format(new Date(operation.scheduledDate), 'MMM dd, yyyy')
                                    : 'Not scheduled'}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      statusColors[operation.status as keyof typeof statusColors]
                                    }
                                  >
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {operation.status.replace('_', ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedOperation(operation);
                                        setShowDetailsDialog(true);
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>

                                    {operation.status === 'pending' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          updateStatusMutation.mutate({
                                            id: operation.id,
                                            status: 'in_progress',
                                            operationType: operation.operationType,
                                          })
                                        }
                                      >
                                        Start
                                      </Button>
                                    )}

                                    {operation.status === 'in_progress' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          updateStatusMutation.mutate({
                                            id: operation.id,
                                            status: 'completed',
                                            operationType: operation.operationType,
                                          })
                                        }
                                      >
                                        Complete
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3 sm:space-y-4">
                      {filteredOperations.map((operation: WarehouseOperation) => {
                        const StatusIcon =
                          statusIcons[operation.status as keyof typeof statusIcons] || Clock;
                        const OperationTypeIcon =
                          statusIcons[operation.operationType as keyof typeof statusIcons] ||
                          Package;

                        return (
                          <Card key={operation.id} className="border">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <OperationTypeIcon className="h-5 w-5 text-blue-600" />
                                  <div>
                                    <p className="font-semibold text-sm">
                                      {operation.operationType.replace('_', ' ').toUpperCase()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      ID: {operation.equipmentId}
                                    </p>
                                  </div>
                                </div>
                                <Badge
                                  className={
                                    statusColors[operation.status as keyof typeof statusColors]
                                  }
                                >
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {operation.status.replace('_', ' ')}
                                </Badge>
                              </div>

                              <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Assigned To:</span>
                                  <span>{operation.assignedTo || 'Unassigned'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Scheduled:</span>
                                  <span>
                                    {operation.scheduledDate
                                      ? format(new Date(operation.scheduledDate), 'MMM dd, yyyy')
                                      : 'Not scheduled'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOperation(operation);
                                    setShowDetailsDialog(true);
                                  }}
                                  className="w-full min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Button>

                                {operation.status === 'pending' && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        id: operation.id,
                                        status: 'in_progress',
                                        operationType: operation.operationType,
                                      })
                                    }
                                    className="w-full min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                                  >
                                    <Activity className="h-4 w-4 mr-2" />
                                    Start Operation
                                  </Button>
                                )}

                                {operation.status === 'in_progress' && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        id: operation.id,
                                        status: 'completed',
                                        operationType: operation.operationType,
                                      })
                                    }
                                    className="w-full min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Complete Operation
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4 md:space-y-6">
            <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Serial Number Management</h2>
                <p className="text-sm md:text-base text-muted-foreground">
                  Track equipment serial numbers and accessories
                </p>
              </div>
              <Button
                onClick={() => setShowSerialDialog(true)}
                className="w-full md:w-auto min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Add Serial Number
              </Button>
            </div>

            {/* Serial Number tracking would go here */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle>Equipment Serial Numbers</CardTitle>
                <CardDescription>
                  Track and manage equipment serial numbers through their lifecycle
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {serialsLoading ? (
                  <div className="py-8 text-center text-muted-foreground">Loading serials…</div>
                ) : serialUnits.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No units are at received or staged right now.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {serialUnits.map((unit) => (
                      <div
                        key={unit.id}
                        className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{unit.serialNumber || 'No serial recorded'}</p>
                          <p className="text-sm text-muted-foreground">
                            {[unit.manufacturer, unit.model].filter(Boolean).join(' ') ||
                              'Model not recorded'}
                            {unit.currentLocation ? ` · ${unit.currentLocation}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{unit.currentStage}</Badge>
                          <Badge
                            variant={unit.kittingStatus === 'passed' ? 'default' : 'secondary'}
                          >
                            {unit.kittingStatus === 'not_started'
                              ? 'no build'
                              : `QA ${unit.kittingStatus}`}
                          </Badge>
                          {unit.kitting?.firstPassYield ? (
                            <Badge variant="outline">first pass</Badge>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="build" className="space-y-4 md:space-y-6">
            <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Build Process Management</h2>
                <p className="text-sm md:text-base text-muted-foreground">
                  Manage equipment assembly and accessory matching
                </p>
              </div>
              <Button
                onClick={() => setShowBuildDialog(true)}
                className="w-full md:w-auto min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
              >
                <Wrench className="h-4 w-4 mr-2" />
                New Build Process
              </Button>
            </div>

            {/* Build process management would go here */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle>Active Build Processes</CardTitle>
                <CardDescription>
                  Monitor equipment builds and accessory installations
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {kittingLoading ? (
                  <div className="py-8 text-center text-muted-foreground">Loading builds…</div>
                ) : kittingOps.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No builds yet. Open one with New Build Process.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {kittingOps.map((op) => {
                      const items = op.checklistItems ?? [];
                      const done = items.filter((i) => i.completed).length;
                      const open = op.operationStatus !== 'completed';
                      return (
                        <div key={op.id} className="rounded-lg border p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-medium">{op.kitName}</p>
                              <p className="text-sm text-muted-foreground">
                                Order {op.orderNumber}
                                {op.equipmentModel ? ` · ${op.equipmentModel}` : ''} ·{' '}
                                {(op.serialNumbers ?? []).length} serial
                                {(op.serialNumbers ?? []).length === 1 ? '' : 's'}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{op.operationStatus}</Badge>
                              {op.qualityStatus && op.qualityStatus !== 'pending' && (
                                <Badge
                                  variant={
                                    op.qualityStatus === 'passed' ? 'default' : 'destructive'
                                  }
                                >
                                  QA {op.qualityStatus}
                                </Badge>
                              )}
                              {op.firstPassYield ? (
                                <Badge variant="outline">first pass</Badge>
                              ) : null}
                              {(op.reworkCount ?? 0) > 0 ? (
                                <Badge variant="secondary">rework ×{op.reworkCount}</Badge>
                              ) : null}
                            </div>
                          </div>

                          {items.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Checklist {done}/{items.length}
                              </p>
                              {items.map((item, index) => (
                                <label
                                  key={`${op.id}-${index}`}
                                  className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted/50"
                                >
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={item.completed}
                                    disabled={!open || toggleChecklistMutation.isPending}
                                    onChange={(event) =>
                                      toggleChecklistMutation.mutate({
                                        id: op.id,
                                        items: items.map((existing, i) =>
                                          i === index
                                            ? {
                                                ...existing,
                                                completed: event.target.checked,
                                                completedAt: event.target.checked
                                                  ? new Date().toISOString()
                                                  : null,
                                              }
                                            : existing,
                                        ),
                                      })
                                    }
                                  />
                                  <span className={item.completed ? 'text-muted-foreground' : ''}>
                                    {item.item}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}

                          {open && (
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                              <Button
                                size="sm"
                                className="min-h-[44px] flex-1 touch-manipulation"
                                disabled={completeKittingMutation.isPending}
                                onClick={() =>
                                  completeKittingMutation.mutate({ id: op.id, passed: true })
                                }
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                QA pass
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="min-h-[44px] flex-1 touch-manipulation"
                                disabled={completeKittingMutation.isPending}
                                onClick={() =>
                                  completeKittingMutation.mutate({
                                    id: op.id,
                                    passed: false,
                                    notes: 'Failed QA on the floor',
                                  })
                                }
                              >
                                QA fail
                              </Button>
                            </div>
                          )}

                          {op.reworkNotes && (
                            <p className="mt-2 text-sm text-muted-foreground">{op.reworkNotes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delivery" className="space-y-4 md:space-y-6">
            <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Delivery Scheduling</h2>
                <p className="text-sm md:text-base text-muted-foreground">
                  Schedule and track equipment deliveries to customers
                </p>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <Button
                  onClick={() => setShowDeliveryDialog(true)}
                  className="flex-1 min-w-[200px] md:flex-initial md:w-auto min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Schedule Delivery
                </Button>
                {typeof window !== 'undefined' &&
                  new URLSearchParams(window.location.search).get('orderId') && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const orderIdFromUrl = new URLSearchParams(window.location.search).get(
                            'orderId',
                          );
                          setLocation(`/onboarding/enhanced?orderId=${orderIdFromUrl}`);
                        }}
                        className="flex-1 min-w-[200px] md:flex-initial md:w-auto min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule Installation
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const orderIdFromUrl = new URLSearchParams(window.location.search).get(
                            'orderId',
                          );
                          setLocation(`/onboarding?orderId=${orderIdFromUrl}`);
                        }}
                        className="flex-1 min-w-[200px] md:flex-initial md:w-auto min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Installation Checklist
                      </Button>
                    </>
                  )}
              </div>
            </div>

            {typeof window !== 'undefined' &&
              new URLSearchParams(window.location.search).get('orderId') && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  Preparing delivery for Order ID:{' '}
                  {new URLSearchParams(window.location.search).get('orderId')}
                </div>
              )}

            {/* Delivery scheduling would go here */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle>Scheduled Deliveries</CardTitle>
                <CardDescription>
                  Manage delivery schedules and installation appointments
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="text-center py-8 text-muted-foreground">
                  Delivery scheduling interface will be implemented here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 md:space-y-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">Warehouse Analytics</h2>
              <p className="text-sm md:text-base text-muted-foreground">
                Performance metrics and operational insights
              </p>
            </div>

            {/* Analytics dashboard would go here */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle>Operations Efficiency</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="text-center py-8 text-muted-foreground">
                    Analytics charts will be implemented here
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle>Inventory Turnover</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="text-center py-8 text-muted-foreground">
                    Inventory metrics will be implemented here
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Operation Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Create Warehouse Operation</DialogTitle>
              <DialogDescription>
                Create a new warehouse operation for equipment processing
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="equipmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select equipment" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {equipment.map((item: Equipment) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.serialNumber} - {item.modelNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="operationType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Operation Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="receiving">Receiving</SelectItem>
                            <SelectItem value="quality_control">Quality Control</SelectItem>
                            <SelectItem value="staging">Staging</SelectItem>
                            <SelectItem value="build">Build Process</SelectItem>
                            <SelectItem value="shipping">Shipping</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select technician" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {technicians.map((tech: Technician) => (
                            <SelectItem key={tech.id} value={tech.id}>
                              {tech.firstName} {tech.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Additional notes or instructions" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex flex-col gap-2 md:flex-row md:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                    className="w-full md:w-auto min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createOperationMutation.isPending}
                    className="w-full md:w-auto min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                  >
                    {createOperationMutation.isPending ? 'Creating...' : 'Create Operation'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* WF-L-05: open a kitting operation. Every field here is a column on
            warehouse_kitting_operations; the four at the top are NOT NULL. */}
        <Dialog open={showBuildDialog} onOpenChange={setShowBuildDialog}>
          <DialogContent className="max-h-[90vh] max-w-[600px] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>New build</DialogTitle>
              <DialogDescription>
                Open a kitting operation for the unit being built. QA is recorded on the build.
              </DialogDescription>
            </DialogHeader>
            <Form {...buildForm}>
              <form
                onSubmit={buildForm.handleSubmit((data) => createKittingMutation.mutate(data))}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={buildForm.control}
                    name="orderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order number</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ''} className="min-h-[44px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={buildForm.control}
                    name="kitName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kit name</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ''} className="min-h-[44px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={buildForm.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="Select a customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.companyName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={buildForm.control}
                  name="assignedTechnician"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Technician</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="Assign a technician" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {technicians.map((technician) => (
                            <SelectItem key={technician.id} value={technician.id}>
                              {[technician.firstName, technician.lastName]
                                .filter(Boolean)
                                .join(' ') || technician.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={buildForm.control}
                  name="equipmentModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} className="min-h-[44px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={buildForm.control}
                  name="serialNumbers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial numbers</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ''}
                          rows={2}
                          placeholder="One per line, or comma separated"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={buildForm.control}
                  name="checklist"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Checklist</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ''}
                          rows={4}
                          placeholder="One item per line"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={buildForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ''} rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => setShowBuildDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="min-h-[44px]"
                    disabled={createKittingMutation.isPending}
                  >
                    Open build
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Operation Details</DialogTitle>
            </DialogHeader>
            {selectedOperation && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium">Operation Type</span>
                    <p className="text-sm text-muted-foreground">
                      {(selectedOperation as WarehouseOperation).operationType
                        ?.replace('_', ' ')
                        .toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Status</span>
                    <Badge
                      className={
                        statusColors[
                          (selectedOperation as WarehouseOperation)
                            .status as keyof typeof statusColors
                        ]
                      }
                    >
                      {(selectedOperation as WarehouseOperation).status?.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                {(selectedOperation as WarehouseOperation).notes && (
                  <div>
                    <span className="text-sm font-medium">Notes</span>
                    <p className="text-sm text-muted-foreground">
                      {(selectedOperation as WarehouseOperation).notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
