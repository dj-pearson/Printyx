import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { 
  Plus, DollarSign, Calculator, FileText, CreditCard, AlertTriangle,
  TrendingUp, Users, Calendar, Settings, Edit, Trash2, Eye,
  CheckCircle, XCircle, Clock, Send, Download, Filter, Smartphone
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
import { useLocation } from "wouter";
import { 
  type Invoice,
  type BillingEntry,
  type BusinessRecord
} from '@shared/schema';
import ContextualHelp from "@/components/contextual/ContextualHelp";
import PageAlerts from "@/components/contextual/PageAlerts";
import KpiSummaryBar from "@/components/dashboard/KpiSummaryBar";
import { MobileFAB } from "@/components/ui/mobile-fab";

// Using Invoice from schema - BillingInvoice extends Invoice with additional billing-specific fields
interface BillingInvoice extends Invoice {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  billing_period_start: string;
  billing_period_end: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  currency: string;
  payment_terms: string;
  customer_name?: string;
  business_record_name?: string;
}

// Using BillingEntry from schema - BillingConfiguration extends BillingEntry with configuration-specific fields
interface BillingConfiguration extends Omit<BillingEntry, 'id'> {
  id: string;
  configuration_name: string;
  billing_type: string;
  is_active: boolean;
  is_default: boolean;
  billing_frequency: string;
  base_rate: number;
  minimum_charge: number;
  maximum_charge?: number;
  currency: string;
  tax_rate: number;
  created_at: string;
}

type BillingCycle = {
  id: string;
  cycle_name: string;
  cycle_date: string;
  status: string;
  total_customers: number;
  processed_customers: number;
  failed_customers: number;
  total_invoices_generated: number;
  total_amount: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
};

type BillingAdjustment = {
  id: string;
  adjustment_type: string;
  adjustment_reason: string;
  amount: number;
  status: string;
  requested_by_name?: string;
  approved_by_name?: string;
  created_at: string;
};

type BillingAnalytics = {
  totalInvoices: number;
  totalRevenue: number;
  outstandingAmount: number;
  overdueInvoices: number;
  averageInvoiceAmount: number;
  collectionRate: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
};

// Form Schemas
const billingConfigurationSchema = z.object({
  configuration_name: z.string().min(3, "Configuration name must be at least 3 characters"),
  billing_type: z.enum(['meter_based', 'flat_rate', 'tiered', 'usage_based', 'hybrid']),
  billing_frequency: z.enum(['monthly', 'quarterly', 'annually', 'custom']),
  billing_day: z.number().min(1).max(31),
  base_rate: z.number().min(0),
  minimum_charge: z.number().min(0),
  maximum_charge: z.number().optional(),
  overage_rate: z.number().min(0),
  setup_fee: z.number().min(0),
  maintenance_fee: z.number().min(0),
  tax_rate: z.number().min(0).max(1),
  tax_inclusive: z.boolean(),
  contract_length_months: z.number().optional(),
  early_termination_fee: z.number().optional(),
  is_default: z.boolean(),
});

const billingAdjustmentSchema = z.object({
  adjustment_type: z.enum(['credit', 'debit', 'write_off', 'discount', 'penalty']),
  adjustment_reason: z.string().min(5, "Reason must be at least 5 characters"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  description: z.string().optional(),
  invoice_id: z.string().optional(),
  business_record_id: z.string().optional(),
});

type BillingConfigurationForm = z.infer<typeof billingConfigurationSchema>;
type BillingAdjustmentForm = z.infer<typeof billingAdjustmentSchema>;

export default function AdvancedBillingEngine() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState("all");
  const [selectedConfigType, setSelectedConfigType] = useState("all");
  const [swipeAction, setSwipeAction] = useState<{ invoiceId: string; action: string } | null>(null);
  
  const queryClient = useQueryClient();

  // Fetch billing analytics
  const { data: analytics } = useQuery<BillingAnalytics>({
    queryKey: ["/api/billing/analytics"],
  });

  // Fetch invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<BillingInvoice[]>({
    queryKey: [
      "/api/billing/invoices",
      selectedInvoiceStatus,
      typeof window !== 'undefined' ? window.location.search : ''
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const ticketId = urlParams.get('ticketId');
        const contractId = urlParams.get('contractId');
        if (ticketId) params.append('ticketId', ticketId);
        if (contractId) params.append('contractId', contractId);
      }
      if (selectedInvoiceStatus !== "all") params.append("status", selectedInvoiceStatus);
      return await apiRequest(`/api/billing/invoices?${params.toString()}`);
    },
  });

  // Fetch billing configurations
  const { data: configurations = [], isLoading: configurationsLoading } = useQuery<BillingConfiguration[]>({
    queryKey: ["/api/billing/configurations", selectedConfigType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedConfigType !== "all") params.append("type", selectedConfigType);
      return await apiRequest(`/api/billing/configurations?${params.toString()}`);
    },
  });

  // Fetch billing cycles
  const { data: billingCycles = [], isLoading: cyclesLoading } = useQuery<BillingCycle[]>({
    queryKey: ["/api/billing/cycles"],
  });

  // Fetch adjustments
  const { data: adjustments = [], isLoading: adjustmentsLoading } = useQuery<BillingAdjustment[]>({
    queryKey: ["/api/billing/adjustments"],
  });

  // Fetch business records for dropdowns
  const { data: businessRecords = [] } = useQuery<BusinessRecord[]>({
    queryKey: ["/api/business-records"],
  });

  // Create configuration mutation
  const createConfigurationMutation = useMutation({
    mutationFn: async (data: BillingConfigurationForm) =>
      await apiRequest("/api/billing/configurations", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/configurations"] });
      setIsConfigDialogOpen(false);
    },
  });

  // Create adjustment mutation
  const createAdjustmentMutation = useMutation({
    mutationFn: async (data: BillingAdjustmentForm) =>
      await apiRequest("/api/billing/adjustments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/adjustments"] });
      setIsAdjustmentDialogOpen(false);
    },
  });

  // Run billing cycle mutation
  const runBillingCycleMutation = useMutation({
    mutationFn: async () =>
      await apiRequest("/api/billing/cycles/run", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/analytics"] });
    },
  });

  // Form setup
  const configurationForm = useForm<BillingConfigurationForm>({
    resolver: zodResolver(billingConfigurationSchema),
    defaultValues: {
      billing_type: "flat_rate",
      billing_frequency: "monthly",
      billing_day: 1,
      base_rate: 0,
      minimum_charge: 0,
      overage_rate: 0,
      setup_fee: 0,
      maintenance_fee: 0,
      tax_rate: 0,
      tax_inclusive: false,
      is_default: false,
    },
  });

  const adjustmentForm = useForm<BillingAdjustmentForm>({
    resolver: zodResolver(billingAdjustmentSchema),
    defaultValues: {
      adjustment_type: "credit",
      amount: 0,
    },
  });

  const onConfigurationSubmit = (data: BillingConfigurationForm) => {
    createConfigurationMutation.mutate(data);
  };

  const onAdjustmentSubmit = (data: BillingAdjustmentForm) => {
    createAdjustmentMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'sent': return 'default';
      case 'viewed': return 'default';
      case 'paid': return 'default';
      case 'overdue': return 'destructive';
      case 'cancelled': case 'disputed': return 'destructive';
      case 'active': case 'completed': return 'default';
      case 'processing': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': case 'failed': case 'disputed': return <XCircle className="h-4 w-4" />;
      case 'processing': return <Clock className="h-4 w-4" />;
      case 'sent': return <Send className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  // Handle swipe actions for mobile billing approvals
  const handleSwipeAction = (invoiceId: string, action: string) => {
    setSwipeAction({ invoiceId, action });
    // Simulate processing
    setTimeout(() => {
      setSwipeAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
    }, 1500);
  };

  return (
    <MainLayout title="Advanced Billing Engine" description="Comprehensive billing management with automated cycles and complex pricing scenarios">
      <div className="container mx-auto p-6 space-y-6">
        <ContextualHelp page="advanced-billing" />
        <PageAlerts categories={["business"]} severities={["medium","high","critical"]} className="-mt-2" />
        <KpiSummaryBar className="mb-4" />
      {typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('ticketId') || new URLSearchParams(window.location.search).get('contractId')) && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 flex items-center justify-between">
          {new URLSearchParams(window.location.search).get('ticketId') && (
            <span>Filtering for Service Ticket ID: {new URLSearchParams(window.location.search).get('ticketId')}</span>
          )}
          {new URLSearchParams(window.location.search).get('contractId') && (
            <span className="ml-2">Filtering for Contract ID: {new URLSearchParams(window.location.search).get('contractId')}</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation('/advanced-billing')}
          >
            Clear Filter
          </Button>
        </div>
      )}
      <div className="flex justify-end">
        <div className="flex space-x-2">
          <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                New Configuration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Create Billing Configuration</DialogTitle>
              </DialogHeader>
              <Form {...configurationForm}>
                <form onSubmit={configurationForm.handleSubmit(onConfigurationSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={configurationForm.control}
                      name="configuration_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Configuration Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Standard Monthly Service" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={configurationForm.control}
                      name="billing_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="flat_rate">Flat Rate</SelectItem>
                              <SelectItem value="meter_based">Meter Based</SelectItem>
                              <SelectItem value="tiered">Tiered Pricing</SelectItem>
                              <SelectItem value="usage_based">Usage Based</SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={configurationForm.control}
                      name="billing_frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Frequency</FormLabel>
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
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={configurationForm.control}
                      name="billing_day"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Day of Month</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              max="31" 
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={configurationForm.control}
                      name="base_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Rate ($)</FormLabel>
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
                    <FormField
                      control={configurationForm.control}
                      name="minimum_charge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Charge ($)</FormLabel>
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
                    <FormField
                      control={configurationForm.control}
                      name="maximum_charge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Charge ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="No limit" 
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={configurationForm.control}
                      name="overage_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Overage Rate ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.0001" 
                              placeholder="0.0000" 
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={configurationForm.control}
                      name="setup_fee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Setup Fee ($)</FormLabel>
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
                    <FormField
                      control={configurationForm.control}
                      name="maintenance_fee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maintenance Fee ($)</FormLabel>
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

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={configurationForm.control}
                      name="tax_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Rate (decimal)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.001" 
                              placeholder="0.085" 
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2">
                      <FormField
                        control={configurationForm.control}
                        name="tax_inclusive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel>Tax Inclusive Pricing</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={configurationForm.control}
                        name="is_default"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel>Set as Default Configuration</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsConfigDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createConfigurationMutation.isPending}>
                      {createConfigurationMutation.isPending ? "Creating..." : "Create Configuration"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Calculator className="mr-2 h-4 w-4" />
                New Adjustment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Billing Adjustment</DialogTitle>
              </DialogHeader>
              <Form {...adjustmentForm}>
                <form onSubmit={adjustmentForm.handleSubmit(onAdjustmentSubmit)} className="space-y-4">
                  <FormField
                    control={adjustmentForm.control}
                    name="adjustment_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adjustment Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="credit">Credit</SelectItem>
                            <SelectItem value="debit">Debit</SelectItem>
                            <SelectItem value="write_off">Write Off</SelectItem>
                            <SelectItem value="discount">Discount</SelectItem>
                            <SelectItem value="penalty">Penalty</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={adjustmentForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount ($)</FormLabel>
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

                  <FormField
                    control={adjustmentForm.control}
                    name="adjustment_reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason</FormLabel>
                        <FormControl>
                          <Input placeholder="Service credit for downtime" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={adjustmentForm.control}
                    name="business_record_id"
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
                            {businessRecords.map((record: BusinessRecord) => (
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

                  <FormField
                    control={adjustmentForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional details..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAdjustmentDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createAdjustmentMutation.isPending}>
                      {createAdjustmentMutation.isPending ? "Creating..." : "Create Adjustment"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => runBillingCycleMutation.mutate()} disabled={runBillingCycleMutation.isPending}>
            <Calendar className="mr-2 h-4 w-4" />
            {runBillingCycleMutation.isPending ? "Running..." : "Run Billing Cycle"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="ai-insights" className="hidden sm:inline-flex">AI Insights</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="configurations">Config</TabsTrigger>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${analytics?.totalRevenue?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {analytics?.totalInvoices || 0} invoices
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  ${analytics?.outstandingAmount?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.overdueInvoices || 0} overdue invoices
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Recurring</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${analytics?.monthlyRecurringRevenue?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  ${analytics?.annualRecurringRevenue?.toLocaleString() || "0"} annually
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics?.collectionRate ? `${(analytics.collectionRate * 100).toFixed(1)}%` : "0%"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg: ${analytics?.averageInvoiceAmount?.toLocaleString() || "0"} per invoice
                </p>
              </CardContent>
            </Card>
          </div>

          {/* AI-Powered Billing Intelligence */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Billing Anomaly Detection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border-l-4 border-orange-500 bg-orange-50 rounded-r">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-orange-800">
                          Unusual Volume Spike Detected
                        </p>
                        <p className="text-xs text-orange-600">
                          Customer ABC Corp - 340% above normal billing
                        </p>
                      </div>
                      <Badge variant="outline" className="text-orange-600">
                        Medium Risk
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3 border-l-4 border-red-500 bg-red-50 rounded-r">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-red-800">
                          Payment Pattern Anomaly
                        </p>
                        <p className="text-xs text-red-600">
                          XYZ Manufacturing - Late payment risk detected
                        </p>
                      </div>
                      <Badge variant="destructive" className="text-xs">
                        High Risk
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3 border-l-4 border-blue-500 bg-blue-50 rounded-r">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-blue-800">
                          Revenue Opportunity
                        </p>
                        <p className="text-xs text-blue-600">
                          Tech Solutions Inc - Upgrade potential identified
                        </p>
                      </div>
                      <Badge variant="outline" className="text-blue-600">
                        Opportunity
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Revenue Forecasting
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Next Month Projection</span>
                      <span className="text-lg font-bold text-green-600">
                        ${((analytics?.monthlyRecurringRevenue || 0) * 1.08).toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full w-[85%]"></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">85% confidence level</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Q4 Revenue Target</span>
                      <span className="text-lg font-bold text-blue-600">
                        ${((analytics?.monthlyRecurringRevenue || 0) * 3.2).toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full w-[72%]"></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">On track to exceed by 8%</p>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm text-green-800 font-medium">
                      Revenue Growth Trend: +12% MoM
                    </p>
                    <p className="text-xs text-green-600">
                      AI predicts continued growth based on current pipeline
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Contract Renewal Automation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-blue-800">
                        Auto-Renewal Ready
                      </span>
                      <Badge variant="outline" className="text-blue-600">
                        3 contracts
                      </Badge>
                    </div>
                    <p className="text-xs text-blue-600 mb-2">
                      Contracts expiring in 90 days with renewal proposals generated
                    </p>
                    <Button size="sm" variant="outline" className="w-full">
                      Review Proposals
                    </Button>
                  </div>
                  <div className="p-3 border rounded-lg bg-yellow-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-yellow-800">
                        Renewal Alerts
                      </span>
                      <Badge variant="outline" className="text-yellow-600">
                        7 contracts
                      </Badge>
                    </div>
                    <p className="text-xs text-yellow-600 mb-2">
                      Expiring within 60 days - Action required
                    </p>
                    <Button size="sm" variant="outline" className="w-full">
                      Generate Proposals
                    </Button>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Success Rate</p>
                        <p className="text-xs text-gray-600">Auto-renewal conversion</p>
                      </div>
                      <span className="text-lg font-bold text-green-600">87%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Billing Health Score Dashboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Billing Health Score Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center w-20 h-20 mb-2">
                    <svg className="w-20 h-20 transform -rotate-90">
                      <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200"/>
                      <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" 
                        strokeDasharray={`${89 * 2.26} ${100 * 2.26}`} className="text-green-600"/>
                    </svg>
                    <span className="absolute text-xl font-bold text-green-600">89%</span>
                  </div>
                  <p className="text-sm font-medium">Overall Health</p>
                  <p className="text-xs text-gray-500">Excellent</p>
                </div>
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center w-20 h-20 mb-2">
                    <svg className="w-20 h-20 transform -rotate-90">
                      <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200"/>
                      <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" 
                        strokeDasharray={`${94 * 2.26} ${100 * 2.26}`} className="text-green-600"/>
                    </svg>
                    <span className="absolute text-xl font-bold text-green-600">94%</span>
                  </div>
                  <p className="text-sm font-medium">Accuracy Rate</p>
                  <p className="text-xs text-gray-500">No errors detected</p>
                </div>
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center w-20 h-20 mb-2">
                    <svg className="w-20 h-20 transform -rotate-90">
                      <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200"/>
                      <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" 
                        strokeDasharray={`${76 * 2.26} ${100 * 2.26}`} className="text-yellow-600"/>
                    </svg>
                    <span className="absolute text-xl font-bold text-yellow-600">76%</span>
                  </div>
                  <p className="text-sm font-medium">Automation Rate</p>
                  <p className="text-xs text-gray-500">Room for improvement</p>
                </div>
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center w-20 h-20 mb-2">
                    <svg className="w-20 h-20 transform -rotate-90">
                      <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200"/>
                      <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" 
                        strokeDasharray={`${82 * 2.26} ${100 * 2.26}`} className="text-blue-600"/>
                    </svg>
                    <span className="absolute text-xl font-bold text-blue-600">82%</span>
                  </div>
                  <p className="text-sm font-medium">Collection Efficiency</p>
                  <p className="text-xs text-gray-500">Above industry avg</p>
                </div>
              </div>
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-800">Billing Autopilot Status: Active</span>
                </div>
                <p className="text-sm text-green-700">
                  Your billing system is operating at optimal efficiency. AI monitoring has identified 3 optimization opportunities that could increase revenue by an estimated 12%.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <p className="text-center py-4">Loading invoices...</p>
                ) : (invoices as BillingInvoice[]).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No invoices yet</p>
                ) : (
                  <div className="space-y-3">
                    {(invoices as BillingInvoice[]).slice(0, 5).map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{invoice.invoice_number}</h4>
                          <p className="text-xs text-muted-foreground">
                            {invoice.customer_name || invoice.business_record_name}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            ${invoice.total_amount.toFixed(2)}
                          </span>
                          <Badge variant={getStatusColor(invoice.status)} className="text-xs">
                            {getStatusIcon(invoice.status)}
                            {invoice.status}
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
                <CardTitle>Recent Billing Cycles</CardTitle>
              </CardHeader>
              <CardContent>
                {cyclesLoading ? (
                  <p className="text-center py-4">Loading cycles...</p>
                ) : billingCycles.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No billing cycles run yet</p>
                ) : (
                  <div className="space-y-3">
                    {billingCycles.slice(0, 5).map((cycle) => (
                      <div key={cycle.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{cycle.cycle_name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {cycle.processed_customers}/{cycle.total_customers} customers
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            ${cycle.total_amount.toFixed(2)}
                          </span>
                          <Badge variant={getStatusColor(cycle.status)} className="text-xs">
                            {getStatusIcon(cycle.status)}
                            {cycle.status}
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

        <TabsContent value="ai-insights" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Revenue Optimization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Revenue Optimization AI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Intelligent Pricing Recommendations</h4>
                    <p className="text-sm text-blue-700 mb-3">
                      Based on market analysis and customer behavior, we've identified opportunities to optimize your pricing strategy.
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-sm">Color Print Tier 2</span>
                        <Badge variant="outline" className="text-green-600">+8% Revenue</Badge>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-sm">Maintenance Plans</span>
                        <Badge variant="outline" className="text-green-600">+15% Revenue</Badge>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-sm">Volume Discounts</span>
                        <Badge variant="outline" className="text-green-600">+12% Revenue</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">Contract Optimization</h4>
                    <p className="text-sm text-green-700 mb-3">
                      AI analysis suggests contract term adjustments that could increase customer lifetime value.
                    </p>
                    <Button size="sm" className="w-full">
                      View Detailed Analysis
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Predictive Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-purple-600" />
                  Predictive Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h4 className="font-medium text-purple-800 mb-2">Cash Flow Prediction</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-purple-700">Next 30 days</span>
                        <span className="font-bold text-purple-800">
                          ${((analytics?.monthlyRecurringRevenue || 0) * 0.85).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-purple-700">Next 60 days</span>
                        <span className="font-bold text-purple-800">
                          ${((analytics?.monthlyRecurringRevenue || 0) * 1.7).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-purple-700">Next 90 days</span>
                        <span className="font-bold text-purple-800">
                          ${((analytics?.monthlyRecurringRevenue || 0) * 2.6).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h4 className="font-medium text-orange-800 mb-2">Risk Assessment</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-orange-700">Late Payment Risk</span>
                        <Badge variant="outline" className="text-orange-600">Low (12%)</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-orange-700">Contract Churn Risk</span>
                        <Badge variant="outline" className="text-yellow-600">Medium (8%)</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-orange-700">Bad Debt Risk</span>
                        <Badge variant="outline" className="text-green-600">Very Low (2%)</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Automation Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-gray-600" />
                  Automation Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">Process Automation Opportunities</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">Auto-Invoice Generation</p>
                          <p className="text-xs text-gray-600">Based on meter readings</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-green-600">87% Ready</Badge>
                          <p className="text-xs text-gray-500 mt-1">Save 4h/week</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">Payment Reminders</p>
                          <p className="text-xs text-gray-600">Automated follow-up sequences</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-blue-600">Ready</Badge>
                          <p className="text-xs text-gray-500 mt-1">Save 6h/week</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">Contract Renewals</p>
                          <p className="text-xs text-gray-600">90-day advance notifications</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-yellow-600">In Progress</Badge>
                          <p className="text-xs text-gray-500 mt-1">Save 8h/week</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Benchmarks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Industry Benchmarks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">How You Compare</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm">Billing Accuracy</span>
                          <span className="text-sm font-medium text-green-600">+18% above avg</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full w-[94%]"></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm">Collection Rate</span>
                          <span className="text-sm font-medium text-blue-600">+12% above avg</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full w-[82%]"></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm">DSO (Days Sales Outstanding)</span>
                          <span className="text-sm font-medium text-orange-600">-8 days vs avg</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-orange-600 h-2 rounded-full w-[75%]"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded">
                    <p className="text-sm text-indigo-800 font-medium">Industry Recognition</p>
                    <p className="text-xs text-indigo-600 mt-1">
                      Your billing efficiency ranks in the top 15% of copier dealers nationwide.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          {/* Filters */}
          <div className="flex space-x-4">
            <Select value={selectedInvoiceStatus} onValueChange={setSelectedInvoiceStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="viewed">Viewed</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <p className="text-center py-8">Loading invoices...</p>
              ) : (invoices as BillingInvoice[]).length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No invoices found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(invoices as BillingInvoice[]).map((invoice) => (
                    <div 
                      key={invoice.id} 
                      className={`border rounded-lg p-4 transition-all duration-300 ${
                        swipeAction?.invoiceId === invoice.id 
                          ? swipeAction.action === 'approve' 
                            ? 'bg-green-50 border-green-300' 
                            : 'bg-red-50 border-red-300'
                          : 'hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium text-base" data-testid={`invoice-number-${invoice.id}`}>
                              {invoice.invoice_number}
                            </h3>
                            <Badge variant={getStatusColor(invoice.status)}>
                              {getStatusIcon(invoice.status)}
                              {invoice.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p><span className="font-medium">Customer:</span> {invoice.customer_name || invoice.business_record_name}</p>
                            <p><span className="font-medium">Period:</span> {format(new Date(invoice.billing_period_start), 'MMM dd')} - {format(new Date(invoice.billing_period_end), 'MMM dd, yyyy')}</p>
                            <p><span className="font-medium">Due:</span> {format(new Date(invoice.due_date), 'MMM dd, yyyy')}</p>
                            <p><span className="font-medium">Terms:</span> {invoice.payment_terms}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-600" data-testid={`invoice-amount-${invoice.id}`}>
                            ${invoice.total_amount.toFixed(2)}
                          </p>
                          {invoice.balance_due > 0 && (
                            <p className="text-sm text-red-600 font-medium">
                              Balance: ${invoice.balance_due.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Mobile-Optimized Action Buttons */}
                      <div className="flex gap-2 mt-4 md:hidden">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 min-h-[44px]"
                          onClick={() => handleSwipeAction(invoice.id, 'view')}
                          data-testid={`button-view-${invoice.id}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        {invoice.status === 'draft' && (
                          <Button 
                            size="sm" 
                            className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700"
                            onClick={() => handleSwipeAction(invoice.id, 'approve')}
                            data-testid={`button-approve-${invoice.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                        )}
                        {invoice.status === 'sent' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1 min-h-[44px]"
                            onClick={() => handleSwipeAction(invoice.id, 'remind')}
                            data-testid={`button-remind-${invoice.id}`}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Remind
                          </Button>
                        )}
                      </div>

                      {/* Desktop Action Buttons */}
                      <div className="hidden md:flex gap-2 mt-4">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                        {invoice.status === 'draft' && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            <Send className="h-4 w-4 mr-2" />
                            Send Invoice
                          </Button>
                        )}
                      </div>
                      
                      {/* Mobile Swipe Feedback */}
                      {swipeAction?.invoiceId === invoice.id && (
                        <div className="mt-3 p-2 text-center text-sm font-medium">
                          {swipeAction.action === 'approve' ? (
                            <span className="text-green-700">✓ Invoice approved and sent to customer</span>
                          ) : swipeAction.action === 'remind' ? (
                            <span className="text-blue-700">📧 Payment reminder sent</span>
                          ) : (
                            <span className="text-gray-700">👁️ Opening invoice details...</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configurations" className="space-y-6">
          {/* Filters */}
          <div className="flex space-x-4">
            <Select value={selectedConfigType} onValueChange={setSelectedConfigType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="flat_rate">Flat Rate</SelectItem>
                <SelectItem value="meter_based">Meter Based</SelectItem>
                <SelectItem value="tiered">Tiered</SelectItem>
                <SelectItem value="usage_based">Usage Based</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Billing Configurations</CardTitle>
            </CardHeader>
            <CardContent>
              {configurationsLoading ? (
                <p className="text-center py-8">Loading configurations...</p>
              ) : (configurations as BillingConfiguration[]).length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No billing configurations yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Create your first configuration to start automated billing
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(configurations as BillingConfiguration[]).map((config) => (
                    <Card key={config.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{config.configuration_name}</CardTitle>
                          <div className="flex space-x-1">
                            {config.is_default && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                            <Badge variant={config.is_active ? 'default' : 'secondary'} className="text-xs">
                              {config.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-sm">
                          <p><strong>Type:</strong> {config.billing_type.replace('_', ' ')}</p>
                          <p><strong>Frequency:</strong> {config.billing_frequency}</p>
                          <p><strong>Base Rate:</strong> ${(config.base_rate || 0).toFixed(2)}</p>
                          <p><strong>Min Charge:</strong> ${(config.minimum_charge || 0).toFixed(2)}</p>
                          {config.maximum_charge && (
                            <p><strong>Max Charge:</strong> ${config.maximum_charge.toFixed(2)}</p>
                          )}
                          <p><strong>Tax Rate:</strong> {((config.tax_rate || 0) * 100).toFixed(2)}%</p>
                          <p><strong>Currency:</strong> {config.currency}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing Cycles</CardTitle>
            </CardHeader>
            <CardContent>
              {cyclesLoading ? (
                <p className="text-center py-8">Loading billing cycles...</p>
              ) : billingCycles.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No billing cycles run yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click "Run Billing Cycle" to start automated billing
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {billingCycles.map((cycle) => (
                    <div key={cycle.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{cycle.cycle_name}</h3>
                            <Badge variant={getStatusColor(cycle.status)}>
                              {getStatusIcon(cycle.status)}
                              {cycle.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Cycle Date: {format(new Date(cycle.cycle_date), 'MMM dd, yyyy')}</p>
                            <p>Customers: {cycle.processed_customers}/{cycle.total_customers}</p>
                            <p>Invoices Generated: {cycle.total_invoices_generated}</p>
                            {cycle.failed_customers > 0 && (
                              <p className="text-red-600">Failed: {cycle.failed_customers}</p>
                            )}
                            {cycle.started_at && (
                              <p>Started: {format(new Date(cycle.started_at), 'MMM dd, yyyy HH:mm')}</p>
                            )}
                            {cycle.completed_at && (
                              <p>Completed: {format(new Date(cycle.completed_at), 'MMM dd, yyyy HH:mm')}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            ${cycle.total_amount.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Total Generated
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

        <TabsContent value="adjustments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing Adjustments</CardTitle>
            </CardHeader>
            <CardContent>
              {adjustmentsLoading ? (
                <p className="text-center py-8">Loading adjustments...</p>
              ) : adjustments.length === 0 ? (
                <div className="text-center py-8">
                  <Calculator className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No billing adjustments yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Create adjustments for credits, debits, or write-offs
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {adjustments.map((adjustment) => (
                    <div key={adjustment.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium capitalize">{adjustment.adjustment_type}</h3>
                            <Badge variant={getStatusColor(adjustment.status)}>
                              {adjustment.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Reason: {adjustment.adjustment_reason}</p>
                            <p>Requested by: {adjustment.requested_by_name}</p>
                            {adjustment.approved_by_name && (
                              <p>Approved by: {adjustment.approved_by_name}</p>
                            )}
                            <p>Created: {format(new Date(adjustment.created_at), 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            adjustment.adjustment_type === 'credit' ? 'text-green-600' : 
                            adjustment.adjustment_type === 'debit' ? 'text-red-600' : 
                            'text-foreground'
                          }`}>
                            {adjustment.adjustment_type === 'credit' ? '+' : 
                             adjustment.adjustment_type === 'debit' ? '-' : ''}
                            ${adjustment.amount.toFixed(2)}
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
      </Tabs>
      
      {/* Mobile Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 md:hidden">
        <MobileFAB
          icon={DollarSign}
          label="Quick Billing"
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-2xl"
          onClick={() => setActiveTab('dashboard')}
          data-testid="mobile-fab-billing"
        />
      </div>
      
      {/* Mobile Quick Actions Panel */}
      {activeTab === 'dashboard' && (
        <div className="fixed bottom-20 right-6 z-40 md:hidden">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-48">
            <div className="space-y-3">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full justify-start min-h-[44px]"
                onClick={() => runBillingCycleMutation.mutate()}
                disabled={runBillingCycleMutation.isPending}
                data-testid="mobile-quick-run-billing"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Run Billing Cycle
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full justify-start min-h-[44px]"
                onClick={() => setIsConfigDialogOpen(true)}
                data-testid="mobile-quick-new-config"
              >
                <Settings className="h-4 w-4 mr-2" />
                New Configuration
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full justify-start min-h-[44px]"
                onClick={() => setIsAdjustmentDialogOpen(true)}
                data-testid="mobile-quick-adjustment"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Add Adjustment
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </MainLayout>
  );
}