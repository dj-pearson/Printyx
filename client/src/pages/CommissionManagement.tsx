import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, DollarSign, TrendingUp, Users, Target, Calculator, CheckCircle,
  Clock, AlertTriangle, FileText, Settings, Award, BarChart3, Calendar,
  Filter, Download, Edit, Trash2, Eye, UserCheck
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

// Types
type CommissionStructure = {
  id: string;
  structure_name: string;
  structure_type: string;
  applies_to?: string;
  base_rate: number;
  tier_thresholds?: any;
  tier_rates?: any;
  effective_date: string;
  expiration_date?: string;
  calculation_period: string;
  payment_schedule: string;
  is_active: boolean;
  created_at: string;
};

type SalesRepresentative = {
  id: string;
  employee_id: string;
  rep_name: string;
  rep_email?: string;
  rep_phone?: string;
  manager_id?: string;
  territory_assignment?: any;
  primary_commission_structure_id?: string;
  current_month_sales: number;
  current_quarter_sales: number;
  current_year_sales: number;
  quota_achievement_percentage: number;
  employment_status: string;
  created_at: string;
};

type CommissionTransaction = {
  id: string;
  transaction_type: string;
  sales_rep_id: string;
  sales_rep_name: string;
  customer_name?: string;
  sale_amount: number;
  commission_rate: number;
  commission_amount: number;
  sale_date: string;
  commission_period: string;
  commission_status: string;
  payment_status: string;
  approved_at?: string;
  payment_date?: string;
  created_at: string;
};

type CommissionPayment = {
  id: string;
  payment_batch_id: string;
  payment_period: string;
  sales_rep_id: string;
  sales_rep_name: string;
  gross_commission_amount: number;
  net_commission_amount: number;
  final_payment_amount: number;
  payment_date: string;
  payment_method: string;
  payment_status: string;
  transaction_count: number;
  created_at: string;
};

type CommissionDispute = {
  id: string;
  dispute_number: string;
  dispute_type: string;
  sales_rep_name: string;
  dispute_amount: number;
  dispute_description: string;
  dispute_status: string;
  priority: string;
  submitted_date: string;
  resolved_date?: string;
  created_at: string;
};

type CommissionMetrics = {
  totalCommissionPaid: number;
  totalCommissionPending: number;
  averageCommissionRate: number;
  totalSalesRepresentatives: number;
  totalTransactionsThisMonth: number;
  totalDisputesActive: number;
};

// Form Schemas
const commissionStructureSchema = z.object({
  structure_name: z.string().min(3, "Structure name must be at least 3 characters"),
  structure_type: z.enum(['tiered', 'flat_rate', 'percentage', 'hybrid', 'custom']),
  product_category: z.enum(['all', 'hardware', 'software', 'services', 'supplies', 'maintenance']).optional(),
  base_rate: z.number().min(0.0001).max(1),
  calculation_period: z.enum(['monthly', 'quarterly', 'annually']),
  payment_schedule: z.enum(['weekly', 'bi-weekly', 'monthly', 'quarterly']),
  effective_start_date: z.string(),
  effective_end_date: z.string().optional(),
  is_active: z.boolean(),
});

const salesRepSchema = z.object({
  employee_id: z.string().min(2, "Employee ID required"),
  rep_name: z.string().min(3, "Representative name required"),
  rep_email: z.string().email().optional(),
  rep_phone: z.string().optional(),
  manager_id: z.string().optional(),
  primary_commission_structure_id: z.string().optional(),
  employment_status: z.enum(['active', 'inactive', 'terminated', 'on_leave']),
});

const commissionTransactionSchema = z.object({
  transaction_type: z.enum(['sale', 'return', 'cancellation', 'adjustment', 'bonus', 'clawback']),
  sales_rep_id: z.string(),
  customer_name: z.string().min(2, "Customer name required"),
  sale_amount: z.number().min(0.01),
  commission_rate: z.number().min(0.0001).max(1),
  sale_date: z.string(),
  product_category: z.string().optional(),
});

const commissionDisputeSchema = z.object({
  dispute_type: z.enum(['calculation_error', 'missing_commission', 'incorrect_rate', 'timing_issue', 'clawback_dispute']),
  sales_rep_id: z.string(),
  commission_transaction_id: z.string().optional(),
  dispute_amount: z.number(),
  dispute_description: z.string().min(10, "Description must be at least 10 characters"),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

type StructureForm = z.infer<typeof commissionStructureSchema>;
type SalesRepForm = z.infer<typeof salesRepSchema>;
type TransactionForm = z.infer<typeof commissionTransactionSchema>;
type DisputeForm = z.infer<typeof commissionDisputeSchema>;

export default function CommissionManagement() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isStructureDialogOpen, setIsStructureDialogOpen] = useState(false);
  const [isSalesRepDialogOpen, setIsSalesRepDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isDisputeDialogOpen, setIsDisputeDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("current_month");
  const [selectedStatus, setSelectedStatus] = useState("all");
  
  const queryClient = useQueryClient();

  // Fetch commission metrics
  const { data: metrics } = useQuery<CommissionMetrics>({
    queryKey: ["/api/commission/metrics"],
  });

  // Fetch commission structures
  const { data: structures = [], isLoading: structuresLoading } = useQuery<CommissionStructure[]>({
    queryKey: ["/api/commission/structures"],
  });

  // Fetch sales representatives
  const { data: salesReps = [], isLoading: salesRepsLoading } = useQuery<SalesRepresentative[]>({
    queryKey: ["/api/commission/sales-reps"],
  });

  // Fetch commission transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<CommissionTransaction[]>({
    queryKey: ["/api/commission/transactions", selectedPeriod, selectedStatus],
  });

  // Fetch commission payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<CommissionPayment[]>({
    queryKey: ["/api/commission/payments", selectedPeriod],
  });

  // Fetch commission disputes
  const { data: disputes = [], isLoading: disputesLoading } = useQuery<CommissionDispute[]>({
    queryKey: ["/api/commission/disputes"],
  });

  // Create structure mutation
  const createStructureMutation = useMutation({
    mutationFn: async (data: StructureForm) => {
      const response = await fetch("/api/commission/structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create structure");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission/structures"] });
      setIsStructureDialogOpen(false);
    },
  });

  // Create sales rep mutation
  const createSalesRepMutation = useMutation({
    mutationFn: async (data: SalesRepForm) => {
      const response = await fetch("/api/commission/sales-reps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create sales representative");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission/sales-reps"] });
      setIsSalesRepDialogOpen(false);
    },
  });

  // Create transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (data: TransactionForm) => {
      const response = await fetch("/api/commission/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create transaction");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission/transactions"] });
      setIsTransactionDialogOpen(false);
    },
  });

  // Create dispute mutation
  const createDisputeMutation = useMutation({
    mutationFn: async (data: DisputeForm) => {
      const response = await fetch("/api/commission/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create dispute");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission/disputes"] });
      setIsDisputeDialogOpen(false);
    },
  });

  // Form setup
  const structureForm = useForm<StructureForm>({
    resolver: zodResolver(commissionStructureSchema),
    defaultValues: {
      structure_type: "percentage",
      product_category: "all",
      base_rate: 0.05,
      calculation_period: "monthly",
      payment_schedule: "monthly",
      is_active: true,
    },
  });

  const salesRepForm = useForm<SalesRepForm>({
    resolver: zodResolver(salesRepSchema),
    defaultValues: {
      employment_status: "active",
    },
  });

  const transactionForm = useForm<TransactionForm>({
    resolver: zodResolver(commissionTransactionSchema),
    defaultValues: {
      transaction_type: "sale",
      commission_rate: 0.05,
    },
  });

  const disputeForm = useForm<DisputeForm>({
    resolver: zodResolver(commissionDisputeSchema),
    defaultValues: {
      dispute_type: "calculation_error",
      priority: "medium",
    },
  });

  const onStructureSubmit = (data: StructureForm) => {
    createStructureMutation.mutate(data);
  };

  const onSalesRepSubmit = (data: SalesRepForm) => {
    createSalesRepMutation.mutate(data);
  };

  const onTransactionSubmit = (data: TransactionForm) => {
    createTransactionMutation.mutate(data);
  };

  const onDisputeSubmit = (data: DisputeForm) => {
    createDisputeMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': case 'paid': case 'resolved': return 'default';
      case 'pending': case 'under_review': return 'secondary';
      case 'disputed': case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Commission Management</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive sales commission tracking, calculations, and payment management
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isStructureDialogOpen} onOpenChange={setIsStructureDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Structure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Commission Structure</DialogTitle>
              </DialogHeader>
              <Form {...structureForm}>
                <form onSubmit={structureForm.handleSubmit(onStructureSubmit)} className="space-y-4">
                  <FormField
                    control={structureForm.control}
                    name="structure_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Structure Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Hardware Sales Commission" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={structureForm.control}
                      name="structure_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Structure Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="tiered">Tiered</SelectItem>
                              <SelectItem value="flat_rate">Flat Rate</SelectItem>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={structureForm.control}
                      name="product_category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All Products</SelectItem>
                              <SelectItem value="hardware">Hardware</SelectItem>
                              <SelectItem value="software">Software</SelectItem>
                              <SelectItem value="services">Services</SelectItem>
                              <SelectItem value="supplies">Supplies</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={structureForm.control}
                    name="base_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Commission Rate (decimal)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.0001" 
                            min="0.0001" 
                            max="1"
                            placeholder="0.05 (5%)"
                            {...field}
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0.05)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={structureForm.control}
                      name="calculation_period"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Calculation Period</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
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
                      control={structureForm.control}
                      name="payment_schedule"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Schedule</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={structureForm.control}
                      name="effective_start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={structureForm.control}
                      name="effective_end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective End Date (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={structureForm.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Active Structure</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsStructureDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createStructureMutation.isPending}>
                      {createStructureMutation.isPending ? "Creating..." : "Create Structure"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isSalesRepDialogOpen} onOpenChange={setIsSalesRepDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Sales Rep
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Sales Representative</DialogTitle>
              </DialogHeader>
              <Form {...salesRepForm}>
                <form onSubmit={salesRepForm.handleSubmit(onSalesRepSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={salesRepForm.control}
                      name="employee_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employee ID</FormLabel>
                          <FormControl>
                            <Input placeholder="EMP001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={salesRepForm.control}
                      name="rep_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Representative Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={salesRepForm.control}
                      name="rep_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@company.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={salesRepForm.control}
                      name="rep_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+1 (555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={salesRepForm.control}
                      name="primary_commission_structure_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission Structure</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select structure" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(structures as CommissionStructure[]).map((structure) => (
                                <SelectItem key={structure.id} value={structure.id}>
                                  {structure.structure_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={salesRepForm.control}
                      name="employment_status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employment Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="terminated">Terminated</SelectItem>
                              <SelectItem value="on_leave">On Leave</SelectItem>
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
                      onClick={() => setIsSalesRepDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createSalesRepMutation.isPending}>
                      {createSalesRepMutation.isPending ? "Adding..." : "Add Sales Rep"}
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
          <TabsTrigger value="structures">Structures</TabsTrigger>
          <TabsTrigger value="representatives">Sales Reps</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Commission Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Commission Paid</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(metrics?.totalCommissionPaid || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  This month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Commission</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(metrics?.totalCommissionPending || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Awaiting payment
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Sales Reps</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.totalSalesRepresentatives || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently active
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Commission Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Average Commission Rate</span>
                    <span className="font-medium">
                      {formatPercentage(metrics?.averageCommissionRate || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Transactions This Month</span>
                    <span className="font-medium">
                      {metrics?.totalTransactionsThisMonth || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Active Disputes</span>
                    <span className="font-medium">
                      {metrics?.totalDisputesActive || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <p className="text-center py-4">Loading transactions...</p>
                ) : (transactions as CommissionTransaction[]).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No recent transactions</p>
                ) : (
                  <div className="space-y-3">
                    {(transactions as CommissionTransaction[]).slice(0, 5).map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <h4 className="font-medium text-sm">{transaction.sales_rep_name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {transaction.customer_name} • {formatCurrency(transaction.sale_amount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">
                            {formatCurrency(transaction.commission_amount)}
                          </p>
                          <Badge variant={getStatusColor(transaction.commission_status)} className="text-xs">
                            {transaction.commission_status}
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

        <TabsContent value="structures" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Commission Structures</CardTitle>
            </CardHeader>
            <CardContent>
              {structuresLoading ? (
                <p className="text-center py-8">Loading commission structures...</p>
              ) : (structures as CommissionStructure[]).length === 0 ? (
                <div className="text-center py-8">
                  <Calculator className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No commission structures found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(structures as CommissionStructure[]).map((structure) => (
                    <div key={structure.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{structure.structure_name}</h3>
                            <Badge variant={structure.is_active ? 'default' : 'secondary'}>
                              {structure.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="outline">
                              {structure.structure_type}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Base Rate:</strong> {formatPercentage(structure.base_rate)}</p>
                            <p><strong>Product Category:</strong> {structure.applies_to || 'All'}</p>
                            <p><strong>Calculation Period:</strong> {structure.calculation_period}</p>
                            <p><strong>Payment Schedule:</strong> {structure.payment_schedule}</p>
                            <p><strong>Effective Date:</strong> {format(new Date(structure.effective_date), 'MMM dd, yyyy')}</p>
                            {structure.expiration_date && (
                              <p><strong>End Date:</strong> {format(new Date(structure.expiration_date), 'MMM dd, yyyy')}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
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

        <TabsContent value="representatives" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Representatives</CardTitle>
            </CardHeader>
            <CardContent>
              {salesRepsLoading ? (
                <p className="text-center py-8">Loading sales representatives...</p>
              ) : (salesReps as SalesRepresentative[]).length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No sales representatives found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(salesReps as SalesRepresentative[]).map((rep) => (
                    <Card key={rep.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{rep.rep_name}</CardTitle>
                          <Badge variant={rep.employment_status === 'active' ? 'default' : 'secondary'}>
                            {rep.employment_status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {rep.employee_id} • {rep.rep_email}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Month Sales:</span>
                            <span>{formatCurrency(rep.current_month_sales)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Quarter Sales:</span>
                            <span>{formatCurrency(rep.current_quarter_sales)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Year Sales:</span>
                            <span>{formatCurrency(rep.current_year_sales)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Quota Achievement:</span>
                            <span>{rep.quota_achievement_percentage.toFixed(1)}%</span>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1">
                            <BarChart3 className="h-3 w-3 mr-1" />
                            Stats
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

        <TabsContent value="transactions" className="space-y-6">
          {/* Transaction Filters */}
          <div className="flex space-x-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">Current Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="current_quarter">Current Quarter</SelectItem>
                <SelectItem value="last_quarter">Last Quarter</SelectItem>
                <SelectItem value="current_year">Current Year</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Commission Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <p className="text-center py-8">Loading transactions...</p>
              ) : (transactions as CommissionTransaction[]).length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No transactions found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(transactions as CommissionTransaction[]).map((transaction) => (
                    <div key={transaction.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <DollarSign className="h-4 w-4" />
                            <h3 className="font-medium">{transaction.sales_rep_name}</h3>
                            <Badge variant="outline">
                              {transaction.transaction_type}
                            </Badge>
                            <Badge variant={getStatusColor(transaction.commission_status)}>
                              {transaction.commission_status}
                            </Badge>
                            <Badge variant={getStatusColor(transaction.payment_status)}>
                              {transaction.payment_status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Customer:</strong> {transaction.customer_name}</p>
                            <p><strong>Sale Amount:</strong> {formatCurrency(transaction.sale_amount)}</p>
                            <p><strong>Commission Rate:</strong> {formatPercentage(transaction.commission_rate)}</p>
                            <p><strong>Commission Amount:</strong> {formatCurrency(transaction.commission_amount)}</p>
                            <p><strong>Sale Date:</strong> {format(new Date(transaction.sale_date), 'MMM dd, yyyy')}</p>
                            <p><strong>Commission Period:</strong> {transaction.commission_period}</p>
                            {transaction.approved_at && (
                              <p><strong>Approved:</strong> {format(new Date(transaction.approved_at), 'MMM dd, yyyy')}</p>
                            )}
                            {transaction.payment_date && (
                              <p><strong>Paid:</strong> {format(new Date(transaction.payment_date), 'MMM dd, yyyy')}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
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

        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Commission Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <p className="text-center py-8">Loading payments...</p>
              ) : (payments as CommissionPayment[]).length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No payments found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(payments as CommissionPayment[]).map((payment) => (
                    <div key={payment.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="h-4 w-4" />
                            <h3 className="font-medium">{payment.sales_rep_name}</h3>
                            <Badge variant={getStatusColor(payment.payment_status)}>
                              {payment.payment_status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Payment Period:</strong> {payment.payment_period}</p>
                            <p><strong>Gross Commission:</strong> {formatCurrency(payment.gross_commission_amount)}</p>
                            <p><strong>Net Commission:</strong> {formatCurrency(payment.net_commission_amount)}</p>
                            <p><strong>Final Payment:</strong> {formatCurrency(payment.final_payment_amount)}</p>
                            <p><strong>Payment Method:</strong> {payment.payment_method}</p>
                            <p><strong>Payment Date:</strong> {format(new Date(payment.payment_date), 'MMM dd, yyyy')}</p>
                            <p><strong>Transactions:</strong> {payment.transaction_count}</p>
                            <p><strong>Batch ID:</strong> {payment.payment_batch_id}</p>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="h-3 w-3" />
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

        <TabsContent value="disputes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Commission Disputes</CardTitle>
            </CardHeader>
            <CardContent>
              {disputesLoading ? (
                <p className="text-center py-8">Loading disputes...</p>
              ) : (disputes as CommissionDispute[]).length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No disputes found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(disputes as CommissionDispute[]).map((dispute) => (
                    <div key={dispute.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            <h3 className="font-medium">{dispute.dispute_number}</h3>
                            <Badge variant="outline">
                              {dispute.dispute_type.replace('_', ' ')}
                            </Badge>
                            <Badge variant={getStatusColor(dispute.dispute_status)}>
                              {dispute.dispute_status.replace('_', ' ')}
                            </Badge>
                            <Badge variant={getPriorityColor(dispute.priority)}>
                              {dispute.priority}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Sales Rep:</strong> {dispute.sales_rep_name}</p>
                            <p><strong>Dispute Amount:</strong> {formatCurrency(dispute.dispute_amount)}</p>
                            <p><strong>Description:</strong> {dispute.dispute_description}</p>
                            <p><strong>Submitted:</strong> {format(new Date(dispute.submitted_date), 'MMM dd, yyyy')}</p>
                            {dispute.resolved_date && (
                              <p><strong>Resolved:</strong> {format(new Date(dispute.resolved_date), 'MMM dd, yyyy')}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
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
      </Tabs>
    </div>
  );
}