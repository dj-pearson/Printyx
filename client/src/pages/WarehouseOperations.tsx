import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MainLayout } from "@/components/layout/main-layout";
import { useLocation } from "wouter";
import { 
  type Equipment, 
  type CustomerEquipment, 
  type WarehouseOperation,
  type Technician,
  type BusinessRecord
} from '@shared/schema';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";
import { format } from "date-fns";

// Warehouse operation schema
const warehouseOperationSchema = z.object({
  equipmentId: z.string().min(1, "Equipment is required"),
  operationType: z.enum([
    "receiving",
    "quality_control",
    "staging",
    "shipping",
    "build",
  ]),
  status: z
    .enum(["pending", "in_progress", "completed", "failed"])
    .default("pending"),
  assignedTo: z.string().optional(),
  scheduledDate: z.date().optional(),
  notes: z.string().optional(),
  qualityControlChecks: z.record(z.boolean()).optional(),
  photos: z.array(z.string()).optional(),
});

// Serial number management schema
const serialNumberSchema = z.object({
  serialNumber: z.string().min(1, "Serial number is required"),
  equipmentId: z.string().min(1, "Equipment is required"),
  status: z
    .enum(["received", "staged", "built", "tested", "shipped", "delivered"])
    .default("received"),
  location: z.string().optional(),
  accessories: z
    .array(
      z.object({
        accessoryId: z.string(),
        serialNumber: z.string().optional(),
        status: z.enum(["pending", "matched", "installed"]).default("pending"),
      })
    )
    .optional(),
});

// Build process schema
const buildProcessSchema = z.object({
  equipmentId: z.string().min(1, "Equipment is required"),
  modelId: z.string().min(1, "Model is required"),
  assignedTechnician: z.string().min(1, "Technician is required"),
  scheduledDate: z.date(),
  accessories: z.array(
    z.object({
      accessoryId: z.string(),
      quantity: z.number().min(1),
      isRequired: z.boolean().default(false),
    })
  ),
  buildSteps: z.array(
    z.object({
      stepName: z.string(),
      description: z.string(),
      estimatedTime: z.number(), // minutes
      isCompleted: z.boolean().default(false),
      completedBy: z.string().optional(),
      completedAt: z.date().optional(),
      notes: z.string().optional(),
    })
  ),
});

// Delivery schedule schema
const deliveryScheduleSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  equipmentId: z.string().min(1, "Equipment is required"),
  deliveryDate: z.date(),
  deliveryWindow: z.string(), // "morning", "afternoon", "all_day"
  deliveryAddress: z.string().min(1, "Delivery address is required"),
  specialInstructions: z.string().optional(),
  requiredAccessories: z.array(z.string()).optional(),
  deliveryTeam: z.array(z.string()).optional(),
  installationRequired: z.boolean().default(false),
  installationDate: z.date().optional(),
});

type WarehouseOperationFormData = z.infer<typeof warehouseOperationSchema>;
type SerialNumberFormData = z.infer<typeof serialNumberSchema>;
type BuildProcessFormData = z.infer<typeof buildProcessSchema>;
type DeliveryScheduleFormData = z.infer<typeof deliveryScheduleSchema>;

// Status colors and icons
const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  received: "bg-blue-100 text-blue-800",
  staged: "bg-purple-100 text-purple-800",
  built: "bg-indigo-100 text-indigo-800",
  tested: "bg-green-100 text-green-800",
  shipped: "bg-orange-100 text-orange-800",
  delivered: "bg-emerald-100 text-emerald-800",
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
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showSerialDialog, setShowSerialDialog] = useState(false);
  const [showBuildDialog, setShowBuildDialog] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);

  // Fetch warehouse operations
  const { data: operations = [], isLoading } = useQuery<WarehouseOperation[]>({
    queryKey: ["/api/warehouse-operations"],
  });

  // Fetch equipment for dropdowns
  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  // Fetch technicians
  const { data: technicians = [] } = useQuery<Technician[]>({
    queryKey: ["/api/technicians"],
  });

  // Fetch customers
  const { data: customers = [] } = useQuery<BusinessRecord[]>({
    queryKey: ["/api/customers"],
  });

  // Fetch statistics
  const { data: stats = {} } = useQuery<{
    totalOperations?: number;
    pendingOperations?: number;
    inProgressOperations?: number;
    completedOperations?: number;
  }>({
    queryKey: ["/api/warehouse-operations/stats"],
  });

  // If navigated with orderId in query, jump to Delivery tab and show cues
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const orderIdFromUrl = params.get("orderId");
    if (orderIdFromUrl) {
      setActiveTab("delivery");
    }
  }, []);

  // Create operation mutation
  const createOperationMutation = useMutation({
    mutationFn: async (data: WarehouseOperationFormData) =>
      apiRequest("/api/warehouse-operations", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/warehouse-operations"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/warehouse-operations/stats"],
      });
      setShowCreateDialog(false);
      toast({ title: "Operation created successfully" });
    },
  });

  // Update operation status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, operationType }: { id: string; status: string; operationType?: string }) =>
      apiRequest(`/api/warehouse-operations/${id}/status`, "PATCH", { status }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/warehouse-operations"],
      });
      
      // If build operation is completed, guide to installation scheduling
      if (variables.status === "completed" && variables.operationType === "build") {
        toast({ 
          title: "Build completed successfully!",
          description: "Ready to schedule delivery and installation",
        });
        // Automatically switch to delivery tab for next step
        setActiveTab("delivery");
      } else {
        toast({ title: "Status updated successfully" });
      }
    },
  });

  // Form setup
  const form = useForm<WarehouseOperationFormData>({
    resolver: zodResolver(warehouseOperationSchema),
    defaultValues: {
      operationType: "receiving",
      status: "pending",
    },
  });

  const serialForm = useForm<SerialNumberFormData>({
    resolver: zodResolver(serialNumberSchema),
    defaultValues: {
      status: "received",
    },
  });

  const buildForm = useForm<BuildProcessFormData>({
    resolver: zodResolver(buildProcessSchema),
    defaultValues: {
      accessories: [],
      buildSteps: [],
    },
  });

  const deliveryForm = useForm<DeliveryScheduleFormData>({
    resolver: zodResolver(deliveryScheduleSchema),
    defaultValues: {
      deliveryWindow: "all_day",
      installationRequired: false,
    },
  });

  // Filter operations
  const filteredOperations = operations.filter((op: WarehouseOperation) => {
    if (statusFilter !== "all" && op.status !== statusFilter) return false;
    if (
      searchTerm &&
      !op.equipmentId?.toLowerCase().includes(searchTerm.toLowerCase())
    )
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
                <TabsTrigger
                  value="overview"
                  className="whitespace-nowrap text-xs px-3"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="receiving"
                  className="whitespace-nowrap text-xs px-3"
                >
                  Receiving
                </TabsTrigger>
                <TabsTrigger
                  value="inventory"
                  className="whitespace-nowrap text-xs px-3"
                >
                  Inventory
                </TabsTrigger>
                <TabsTrigger
                  value="build"
                  className="whitespace-nowrap text-xs px-3"
                >
                  Build
                </TabsTrigger>
                <TabsTrigger
                  value="delivery"
                  className="whitespace-nowrap text-xs px-3"
                >
                  Delivery
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="whitespace-nowrap text-xs px-3"
                >
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
            {/* Statistics Dashboard */}
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <Card>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center space-x-2">
                      <Package className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
                      <div>
                        <p className="text-lg md:text-2xl font-bold">
                          {stats.totalOperations || 0}
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground">
                          Total Operations
                        </p>
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
                        <p className="text-xs md:text-sm text-muted-foreground">
                          Pending
                        </p>
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
                        <p className="text-xs md:text-sm text-muted-foreground">
                          In Progress
                        </p>
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
                        <p className="text-xs md:text-sm text-muted-foreground">
                          Completed
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recent Operations */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Operations</CardTitle>
                <CardDescription>
                  Latest warehouse activities and their status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredOperations.slice(0, 5).map((operation: WarehouseOperation) => {
                    const StatusIcon =
                      statusIcons[
                        operation.operationType as keyof typeof statusIcons
                      ] || Package;
                    return (
                      <div
                        key={operation.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <StatusIcon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {operation.operationType
                                .replace("_", " ")
                                .toUpperCase()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Equipment ID: {operation.equipmentId}
                            </p>
                          </div>
                        </div>
                        <Badge
                          className={
                            statusColors[
                              operation.status as keyof typeof statusColors
                            ]
                          }
                        >
                          {operation.status.replace("_", " ")}
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
                <h2 className="text-xl md:text-2xl font-bold">
                  Receiving Operations
                </h2>
                <p className="text-sm md:text-base text-muted-foreground">
                  Process incoming shipments and manage inventory
                </p>
              </div>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="w-full md:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Operation
              </Button>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search operations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 w-full md:w-auto">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
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
              <CardContent className="p-4 md:p-6">
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
                              statusIcons[
                                operation.status as keyof typeof statusIcons
                              ] || Clock;

                            return (
                              <TableRow key={operation.id}>
                                <TableCell className="font-medium">
                                  {operation.operationType
                                    .replace("_", " ")
                                    .toUpperCase()}
                                </TableCell>
                                <TableCell>{operation.equipmentId}</TableCell>
                                <TableCell>
                                  {operation.assignedTo || "Unassigned"}
                                </TableCell>
                                <TableCell>
                                  {operation.scheduledDate
                                    ? format(
                                        new Date(operation.scheduledDate),
                                        "MMM dd, yyyy"
                                      )
                                    : "Not scheduled"}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      statusColors[
                                        operation.status as keyof typeof statusColors
                                      ]
                                    }
                                  >
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {operation.status.replace("_", " ")}
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

                                    {operation.status === "pending" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          updateStatusMutation.mutate({
                                            id: operation.id,
                                            status: "in_progress",
                                            operationType: operation.operationType,
                                          })
                                        }
                                      >
                                        Start
                                      </Button>
                                    )}

                                    {operation.status === "in_progress" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          updateStatusMutation.mutate({
                                            id: operation.id,
                                            status: "completed",
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
                    <div className="md:hidden space-y-4">
                      {filteredOperations.map((operation: WarehouseOperation) => {
                        const StatusIcon =
                          statusIcons[
                            operation.status as keyof typeof statusIcons
                          ] || Clock;
                        const OperationTypeIcon =
                          statusIcons[
                            operation.operationType as keyof typeof statusIcons
                          ] || Package;

                        return (
                          <Card key={operation.id} className="border">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <OperationTypeIcon className="h-5 w-5 text-blue-600" />
                                  <div>
                                    <p className="font-semibold text-sm">
                                      {operation.operationType
                                        .replace("_", " ")
                                        .toUpperCase()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      ID: {operation.equipmentId}
                                    </p>
                                  </div>
                                </div>
                                <Badge
                                  className={
                                    statusColors[
                                      operation.status as keyof typeof statusColors
                                    ]
                                  }
                                >
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {operation.status.replace("_", " ")}
                                </Badge>
                              </div>

                              <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    Assigned To:
                                  </span>
                                  <span>
                                    {operation.assignedTo || "Unassigned"}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    Scheduled:
                                  </span>
                                  <span>
                                    {operation.scheduledDate
                                      ? format(
                                          new Date(operation.scheduledDate),
                                          "MMM dd, yyyy"
                                        )
                                      : "Not scheduled"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col space-y-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOperation(operation);
                                    setShowDetailsDialog(true);
                                  }}
                                  className="w-full"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Button>

                                {operation.status === "pending" && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        id: operation.id,
                                        status: "in_progress",
                                        operationType: operation.operationType,
                                      })
                                    }
                                    className="w-full"
                                  >
                                    <Activity className="h-4 w-4 mr-2" />
                                    Start Operation
                                  </Button>
                                )}

                                {operation.status === "in_progress" && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        id: operation.id,
                                        status: "completed",
                                        operationType: operation.operationType,
                                      })
                                    }
                                    className="w-full"
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
                <h2 className="text-xl md:text-2xl font-bold">
                  Serial Number Management
                </h2>
                <p className="text-sm md:text-base text-muted-foreground">
                  Track equipment serial numbers and accessories
                </p>
              </div>
              <Button
                onClick={() => setShowSerialDialog(true)}
                className="w-full md:w-auto"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Add Serial Number
              </Button>
            </div>

            {/* Serial Number tracking would go here */}
            <Card>
              <CardHeader>
                <CardTitle>Equipment Serial Numbers</CardTitle>
                <CardDescription>
                  Track and manage equipment serial numbers through their
                  lifecycle
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Serial number management interface will be implemented here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="build" className="space-y-4 md:space-y-6">
            <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">
                  Build Process Management
                </h2>
                <p className="text-sm md:text-base text-muted-foreground">
                  Manage equipment assembly and accessory matching
                </p>
              </div>
              <Button
                onClick={() => setShowBuildDialog(true)}
                className="w-full md:w-auto"
              >
                <Wrench className="h-4 w-4 mr-2" />
                New Build Process
              </Button>
            </div>

            {/* Build process management would go here */}
            <Card>
              <CardHeader>
                <CardTitle>Active Build Processes</CardTitle>
                <CardDescription>
                  Monitor equipment builds and accessory installations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Build process management interface will be implemented here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delivery" className="space-y-4 md:space-y-6">
            <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">
                  Delivery Scheduling
                </h2>
                <p className="text-sm md:text-base text-muted-foreground">
                  Schedule and track equipment deliveries to customers
                </p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Button
                  onClick={() => setShowDeliveryDialog(true)}
                  className="w-full md:w-auto"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Schedule Delivery
                </Button>
                {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('orderId') && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const orderIdFromUrl = new URLSearchParams(window.location.search).get('orderId');
                        setLocation(`/enhanced-onboarding-form?orderId=${orderIdFromUrl}`);
                      }}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule Installation
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const orderIdFromUrl = new URLSearchParams(window.location.search).get('orderId');
                        setLocation(`/onboarding-dashboard?orderId=${orderIdFromUrl}`);
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Installation Checklist
                    </Button>
                  </>
                )}
              </div>
            </div>

            {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('orderId') && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                Preparing delivery for Order ID: {new URLSearchParams(window.location.search).get('orderId')}
              </div>
            )}

            {/* Delivery scheduling would go here */}
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Deliveries</CardTitle>
                <CardDescription>
                  Manage delivery schedules and installation appointments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Delivery scheduling interface will be implemented here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 md:space-y-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">
                Warehouse Analytics
              </h2>
              <p className="text-sm md:text-base text-muted-foreground">
                Performance metrics and operational insights
              </p>
            </div>

            {/* Analytics dashboard would go here */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Operations Efficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    Analytics charts will be implemented here
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Inventory Turnover</CardTitle>
                </CardHeader>
                <CardContent>
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Warehouse Operation</DialogTitle>
              <DialogDescription>
                Create a new warehouse operation for equipment processing
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="equipmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select equipment" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {equipment.map((item: Equipment) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.serialNumber} - {item.model}
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
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="receiving">Receiving</SelectItem>
                            <SelectItem value="quality_control">
                              Quality Control
                            </SelectItem>
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
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
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
                        <Textarea
                          {...field}
                          placeholder="Additional notes or instructions"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex flex-col space-y-2 md:flex-row md:justify-end md:space-y-0 md:space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                    className="w-full md:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createOperationMutation.isPending}
                    className="w-full md:w-auto"
                  >
                    {createOperationMutation.isPending
                      ? "Creating..."
                      : "Create Operation"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Operation Details</DialogTitle>
            </DialogHeader>
            {selectedOperation && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">
                      Operation Type
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {(selectedOperation as WarehouseOperation).operationType
                        ?.replace("_", " ")
                        .toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Badge
                      className={
                        statusColors[
                          (selectedOperation as WarehouseOperation)
                            .status as keyof typeof statusColors
                        ]
                      }
                    >
                      {(selectedOperation as WarehouseOperation).status?.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                {(selectedOperation as WarehouseOperation).notes && (
                  <div>
                    <label className="text-sm font-medium">Notes</label>
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
