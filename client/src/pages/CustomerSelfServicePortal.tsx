import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, Search, Filter, Bell, Clock, CheckCircle, AlertCircle,
  Package, Wrench, HelpCircle, FileText, User, Settings,
  Monitor, Printer, Calendar, Star, Phone, Mail, MessageSquare
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
type ServiceRequest = {
  id: string;
  request_type: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  equipment_make?: string;
  equipment_model?: string;
  equipment_serial?: string;
  assigned_technician_id?: string;
  scheduled_date?: string;
  created_at: string;
  updated_at: string;
};

type SupplyOrder = {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  priority: string;
  total_amount: number;
  requested_delivery_date?: string;
  estimated_delivery_date?: string;
  created_at: string;
};

type CustomerEquipment = {
  id: string;
  equipment_name: string;
  make?: string;
  model?: string;
  serial_number?: string;
  location?: string;
  service_contract_type?: string;
  current_meter_reading?: number;
  last_service_date?: string;
  next_service_due?: string;
  status: string;
};

type KnowledgeBaseArticle = {
  id: string;
  title: string;
  summary?: string;
  category: string;
  subcategory?: string;
  view_count: number;
  helpful_votes: number;
  is_featured: boolean;
  created_at: string;
};

// Form Schemas
const serviceRequestSchema = z.object({
  request_type: z.enum(['service_call', 'supply_order', 'technical_support', 'general_inquiry']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  equipment_id: z.string().optional(),
  equipment_make: z.string().optional(),
  equipment_model: z.string().optional(),
  equipment_serial: z.string().optional(),
  meter_reading: z.number().optional(),
  preferred_contact_method: z.enum(['email', 'phone', 'text']),
  preferred_service_time: z.enum(['morning', 'afternoon', 'evening', 'any']),
  urgency_reason: z.string().optional(),
});

const supplyOrderSchema = z.object({
  order_type: z.enum(['supplies', 'parts', 'accessories']),
  priority: z.enum(['standard', 'expedited', 'rush']),
  delivery_method: z.enum(['standard', 'expedited', 'pickup']),
  requested_delivery_date: z.string().optional(),
  special_instructions: z.string().optional(),
  purchase_order_number: z.string().optional(),
  items: z.array(z.object({
    product_type: z.string(),
    product_name: z.string(),
    quantity_requested: z.number().min(1),
    specifications: z.record(z.string()).optional(),
  })).min(1, "At least one item is required"),
});

type ServiceRequestForm = z.infer<typeof serviceRequestSchema>;
type SupplyOrderForm = z.infer<typeof supplyOrderSchema>;

export default function CustomerSelfServicePortal() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isServiceRequestDialogOpen, setIsServiceRequestDialogOpen] = useState(false);
  const [isSupplyOrderDialogOpen, setIsSupplyOrderDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  const queryClient = useQueryClient();

  // Fetch service requests
  const { data: serviceRequests = [], isLoading: serviceRequestsLoading } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/customer-portal/service-requests"],
  });

  // Fetch supply orders
  const { data: supplyOrders = [], isLoading: supplyOrdersLoading } = useQuery<SupplyOrder[]>({
    queryKey: ["/api/customer-portal/supply-orders"],
  });

  // Fetch customer equipment
  const { data: equipment = [], isLoading: equipmentLoading } = useQuery<CustomerEquipment[]>({
    queryKey: ["/api/customer-portal/equipment"],
  });

  // Fetch knowledge base articles
  const { data: knowledgeBase = [], isLoading: knowledgeBaseLoading } = useQuery<KnowledgeBaseArticle[]>({
    queryKey: ["/api/customer-portal/knowledge-base", searchQuery, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      return apiRequest(`/api/customer-portal/knowledge-base?${params.toString()}`);
    },
  });

  // Create service request mutation
  const createServiceRequestMutation = useMutation({
    mutationFn: (data: ServiceRequestForm) =>
      apiRequest("/api/customer-portal/service-requests", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-portal/service-requests"] });
      setIsServiceRequestDialogOpen(false);
    },
  });

  // Create supply order mutation
  const createSupplyOrderMutation = useMutation({
    mutationFn: (data: SupplyOrderForm) =>
      apiRequest("/api/customer-portal/supply-orders", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-portal/supply-orders"] });
      setIsSupplyOrderDialogOpen(false);
    },
  });

  // Form setup
  const serviceRequestForm = useForm<ServiceRequestForm>({
    resolver: zodResolver(serviceRequestSchema),
    defaultValues: {
      request_type: "service_call",
      priority: "medium",
      preferred_contact_method: "email",
      preferred_service_time: "any",
    },
  });

  const supplyOrderForm = useForm<SupplyOrderForm>({
    resolver: zodResolver(supplyOrderSchema),
    defaultValues: {
      order_type: "supplies",
      priority: "standard",
      delivery_method: "standard",
      items: [{ product_type: "toner", product_name: "", quantity_requested: 1 }],
    },
  });

  const onServiceRequestSubmit = (data: ServiceRequestForm) => {
    createServiceRequestMutation.mutate(data);
  };

  const onSupplyOrderSubmit = (data: SupplyOrderForm) => {
    createSupplyOrderMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': case 'pending': return 'default';
      case 'acknowledged': case 'approved': return 'secondary';
      case 'in_progress': case 'processing': case 'shipped': return 'default';
      case 'scheduled': return 'secondary';
      case 'completed': case 'delivered': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': case 'rush': return 'destructive';
      case 'high': case 'expedited': return 'secondary';
      case 'medium': case 'standard': return 'default';
      case 'low': return 'outline';
      default: return 'default';
    }
  };

  // Dashboard statistics
  const dashboardStats = {
    activeServiceRequests: serviceRequests.filter(r => !['completed', 'cancelled'].includes(r.status)).length,
    pendingSupplyOrders: supplyOrders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length,
    equipmentCount: equipment.length,
    nextServiceDue: equipment.filter(e => e.next_service_due).length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Customer Self-Service Portal</h1>
          <p className="text-muted-foreground mt-2">
            Manage your service requests, supply orders, and equipment information
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isServiceRequestDialogOpen} onOpenChange={setIsServiceRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Wrench className="mr-2 h-4 w-4" />
                Request Service
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Submit Service Request</DialogTitle>
              </DialogHeader>
              <Form {...serviceRequestForm}>
                <form onSubmit={serviceRequestForm.handleSubmit(onServiceRequestSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={serviceRequestForm.control}
                      name="request_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Request Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="service_call">Service Call</SelectItem>
                              <SelectItem value="supply_order">Supply Order</SelectItem>
                              <SelectItem value="technical_support">Technical Support</SelectItem>
                              <SelectItem value="general_inquiry">General Inquiry</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={serviceRequestForm.control}
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
                  </div>

                  <FormField
                    control={serviceRequestForm.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief description of the issue" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={serviceRequestForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Detailed description of the issue or request"
                            rows={4}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={serviceRequestForm.control}
                      name="equipment_make"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment Make</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Canon, HP, Xerox" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={serviceRequestForm.control}
                      name="equipment_model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input placeholder="Model number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={serviceRequestForm.control}
                      name="equipment_serial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serial Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Serial number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={serviceRequestForm.control}
                      name="preferred_contact_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Contact Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="phone">Phone</SelectItem>
                              <SelectItem value="text">Text Message</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={serviceRequestForm.control}
                      name="preferred_service_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Service Time</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="morning">Morning (8AM-12PM)</SelectItem>
                              <SelectItem value="afternoon">Afternoon (12PM-5PM)</SelectItem>
                              <SelectItem value="evening">Evening (5PM-8PM)</SelectItem>
                              <SelectItem value="any">Any Time</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsServiceRequestDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createServiceRequestMutation.isPending}>
                      {createServiceRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isSupplyOrderDialogOpen} onOpenChange={setIsSupplyOrderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Package className="mr-2 h-4 w-4" />
                Order Supplies
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Order Supplies</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground mb-4">
                Order toner, paper, and other supplies for your equipment
              </p>
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Supply ordering system coming soon</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please contact your service representative for supply orders
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="service-requests">Service Requests</TabsTrigger>
          <TabsTrigger value="equipment">My Equipment</TabsTrigger>
          <TabsTrigger value="knowledge-base">Help Center</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Dashboard Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Requests</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats.activeServiceRequests}</div>
                <p className="text-xs text-muted-foreground">Service requests in progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats.pendingSupplyOrders}</div>
                <p className="text-xs text-muted-foreground">Supply orders pending</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Equipment</CardTitle>
                <Monitor className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats.equipmentCount}</div>
                <p className="text-xs text-muted-foreground">Devices under service</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Service Due</CardTitle>
                <Calendar className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{dashboardStats.nextServiceDue}</div>
                <p className="text-xs text-muted-foreground">Equipment needing service</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Service Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {serviceRequestsLoading ? (
                  <p className="text-center py-4">Loading requests...</p>
                ) : serviceRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No service requests yet</p>
                ) : (
                  <div className="space-y-3">
                    {serviceRequests.slice(0, 5).map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{request.subject}</h4>
                          <p className="text-xs text-muted-foreground">
                            {request.equipment_make} {request.equipment_model}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={getPriorityColor(request.priority)} className="text-xs">
                            {request.priority}
                          </Badge>
                          <Badge variant={getStatusColor(request.status)} className="text-xs">
                            {request.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Equipment Status</CardTitle>
              </CardHeader>
              <CardContent>
                {equipmentLoading ? (
                  <p className="text-center py-4">Loading equipment...</p>
                ) : equipment.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No equipment registered</p>
                ) : (
                  <div className="space-y-3">
                    {equipment.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Printer className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <h4 className="font-medium text-sm">{item.equipment_name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {item.make} {item.model} • {item.location}
                            </p>
                          </div>
                        </div>
                        <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="service-requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>My Service Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {serviceRequestsLoading ? (
                <p className="text-center py-8">Loading service requests...</p>
              ) : serviceRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Wrench className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No service requests yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click "Request Service" to submit your first request
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {serviceRequests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{request.subject}</h3>
                            <Badge variant={getPriorityColor(request.priority)}>
                              {request.priority}
                            </Badge>
                            <Badge variant={getStatusColor(request.status)}>
                              {request.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {request.description}
                          </p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>Type: {request.request_type.replace('_', ' ')}</p>
                            {request.equipment_make && (
                              <p>Equipment: {request.equipment_make} {request.equipment_model}</p>
                            )}
                            {request.scheduled_date && (
                              <p>Scheduled: {format(new Date(request.scheduled_date), 'MMM dd, yyyy HH:mm')}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            #{request.id.slice(0, 8)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(request.created_at), 'MMM dd, yyyy')}
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

        <TabsContent value="equipment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>My Equipment</CardTitle>
            </CardHeader>
            <CardContent>
              {equipmentLoading ? (
                <p className="text-center py-8">Loading equipment...</p>
              ) : equipment.length === 0 ? (
                <div className="text-center py-8">
                  <Monitor className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No equipment registered</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Contact your service representative to add equipment
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {equipment.map((item) => (
                    <Card key={item.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{item.equipment_name}</CardTitle>
                          <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                            {item.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-sm">
                          <p><strong>Make/Model:</strong> {item.make} {item.model}</p>
                          <p><strong>Serial:</strong> {item.serial_number}</p>
                          <p><strong>Location:</strong> {item.location}</p>
                          {item.service_contract_type && (
                            <p><strong>Service Plan:</strong> {item.service_contract_type.replace('_', ' ')}</p>
                          )}
                          {item.current_meter_reading && (
                            <p><strong>Meter Reading:</strong> {item.current_meter_reading.toLocaleString()}</p>
                          )}
                          {item.last_service_date && (
                            <p><strong>Last Service:</strong> {format(new Date(item.last_service_date), 'MMM dd, yyyy')}</p>
                          )}
                          {item.next_service_due && (
                            <p><strong>Next Service:</strong> {format(new Date(item.next_service_due), 'MMM dd, yyyy')}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge-base" className="space-y-6">
          {/* Search and Filter */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search help articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                <SelectItem value="how_to">How To</SelectItem>
                <SelectItem value="faq">FAQ</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="supplies">Supplies</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Help Center</CardTitle>
            </CardHeader>
            <CardContent>
              {knowledgeBaseLoading ? (
                <p className="text-center py-8">Loading articles...</p>
              ) : knowledgeBase.length === 0 ? (
                <div className="text-center py-8">
                  <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? "No articles found matching your search" : "No help articles available"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {knowledgeBase.map((article) => (
                    <div key={article.id} className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{article.title}</h3>
                            {article.is_featured && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="w-3 h-3 mr-1" />
                                Featured
                              </Badge>
                            )}
                          </div>
                          {article.summary && (
                            <p className="text-sm text-muted-foreground mb-2">{article.summary}</p>
                          )}
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>{article.category}</span>
                            <span>{article.view_count} views</span>
                            <span>{article.helpful_votes} helpful</span>
                          </div>
                        </div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Profile management coming soon</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Contact your service representative to update your profile
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}