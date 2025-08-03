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
import { apiRequest } from "@/lib/queryClient";

// Types
type CommissionStructure = {
  id: string;
  structure_name: string;
  structure_type: string;
  applies_to: string;
  base_rate: number;
  calculation_basis: string;
  calculation_period: string;
  minimum_threshold: number;
  maximum_cap?: number;
  is_active: boolean;
  effective_date: string;
  expiration_date?: string;
  created_at: string;
};

type CommissionCalculation = {
  id: string;
  calculation_period_start: string;
  calculation_period_end: string;
  employee_name?: string;
  structure_name?: string;
  total_sales_amount: number;
  commission_base_amount: number;
  base_commission_rate: number;
  gross_commission_amount: number;
  net_commission_amount: number;
  payment_status: string;
  payment_due_date?: string;
  created_at: string;
};

type SalesQuota = {
  id: string;
  employee_name?: string;
  quota_period_start: string;
  quota_period_end: string;
  quota_type: string;
  quota_amount: number;
  current_achievement: number;
  achievement_percentage: number;
  status: string;
  created_at: string;
};

type CommissionPayment = {
  id: string;
  employee_name?: string;
  payment_date: string;
  payment_period_start: string;
  payment_period_end: string;
  gross_commission_amount: number;
  net_payment_amount: number;
  payment_method: string;
  payment_status: string;
  payment_reference?: string;
  created_at: string;
};

type CommissionDispute = {
  id: string;
  dispute_number: string;
  dispute_type: string;
  employee_name?: string;
  dispute_amount: number;
  description: string;
  status: string;
  priority: string;
  dispute_date: string;
  resolution_date?: string;
  created_at: string;
};

type CommissionMetrics = {
  totalCommissionsPaid: number;
  pendingCommissions: number;
  averageCommissionRate: number;
  topPerformerCommission: number;
  activeDisputes: number;
  quotaAttainment: number;
};

// Form Schemas
const structureSchema = z.object({
  structure_name: z.string().min(3, "Structure name required"),
  structure_type: z.enum(['flat_rate', 'tiered', 'progressive', 'team_based', 'hybrid']),
  applies_to: z.enum(['individual', 'team', 'department', 'region']),
  base_rate: z.number().min(0).max(1, "Rate must be between 0 and 1"),
  calculation_basis: z.enum(['revenue', 'gross_profit', 'net_profit', 'units_sold']),
  calculation_period: z.enum(['weekly', 'monthly', 'quarterly', 'annually']),
  minimum_threshold: z.number().min(0),
  maximum_cap: z.number().optional(),
  effective_date: z.string(),
  expiration_date: z.string().optional(),
});

const quotaSchema = z.object({
  employee_id: z.string(),
  quota_period_start: z.string(),
  quota_period_end: z.string(),
  quota_type: z.enum(['revenue', 'gross_profit', 'units', 'new_accounts']),
  quota_amount: z.number().min(0.01),
  stretch_goal_amount: z.number().optional(),
  minimum_threshold: z.number().optional(),
});

const disputeSchema = z.object({
  dispute_type: z.enum(['calculation_error', 'missing_sale', 'incorrect_rate', 'payment_delay', 'other']),
  employee_id: z.string(),
  commission_calculation_id: z.string().optional(),
  dispute_amount: z.number().min(0),
  claimed_amount: z.number().min(0),
  description: z.string().min(10, "Please provide detailed description"),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

type StructureForm = z.infer<typeof structureSchema>;
type QuotaForm = z.infer<typeof quotaSchema>;
type DisputeForm = z.infer<typeof disputeSchema>;

export default function CommissionManagement() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isStructureDialogOpen, setIsStructureDialogOpen] = useState(false);
  const [isQuotaDialogOpen, setIsQuotaDialogOpen] = useState(false);
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

  // Fetch commission calculations
  const { data: calculations = [], isLoading: calculationsLoading } = useQuery<CommissionCalculation[]>({
    queryKey: ["/api/commission/calculations", selectedPeriod, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPeriod !== "all") params.append("period", selectedPeriod);
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      return await apiRequest(`/api/commission/calculations?${params.toString()}`);
    },
  });

  // Fetch sales quotas
  const { data: quotas = [], isLoading: quotasLoading } = useQuery<SalesQuota[]>({
    queryKey: ["/api/commission/quotas"],
  });

  // Fetch commission payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<CommissionPayment[]>({
    queryKey: ["/api/commission/payments"],
  });

  // Fetch commission disputes
  const { data: disputes = [], isLoading: disputesLoading } = useQuery<CommissionDispute[]>({
    queryKey: ["/api/commission/disputes"],
  });

  // Fetch employees for dropdowns
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Create structure mutation
  const createStructureMutation = useMutation({
    mutationFn: async (data: StructureForm) =>
      await apiRequest("/api/commission/structures", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission/structures"] });
      setIsStructureDialogOpen(false);
    },
  });

  // Create quota mutation
  const createQuotaMutation = useMutation({
    mutationFn: async (data: QuotaForm) =>
      await apiRequest("/api/commission/quotas", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission/quotas"] });
      setIsQuotaDialogOpen(false);
    },
  });

  // Create dispute mutation
  const createDisputeMutation = useMutation({
    mutationFn: async (data: DisputeForm) =>
      await apiRequest("/api/commission/disputes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission/disputes"] });
      setIsDisputeDialogOpen(false);
    },
  });

  // Run commission calculation mutation
  const runCalculationMutation = useMutation({
    mutationFn: async () =>
      await apiRequest("/api/commission/calculations/run", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission/calculations"] });
    },
  });

  // Form setup
  const structureForm = useForm<StructureForm>({
    resolver: zodResolver(structureSchema),
    defaultValues: {
      structure_type: "flat_rate",
      applies_to: "individual",
      calculation_basis: "revenue",
      calculation_period: "monthly",
      base_rate: 0.05,
      minimum_threshold: 0,
    },
  });

  const quotaForm = useForm<QuotaForm>({
    resolver: zodResolver(quotaSchema),
    defaultValues: {
      quota_type: "revenue",
    },
  });

  const disputeForm = useForm<DisputeForm>({
    resolver: zodResolver(disputeSchema),
    defaultValues: {
      dispute_type: "calculation_error",
      priority: "medium",
    },
  });

  const onStructureSubmit = (data: StructureForm) => {
    createStructureMutation.mutate(data);
  };

  const onQuotaSubmit = (data: QuotaForm) => {
    createQuotaMutation.mutate(data);
  };

  const onDisputeSubmit = (data: DisputeForm) => {
    createDisputeMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': case 'completed': case 'resolved': return 'default';
      case 'pending': case 'open': case 'under_review': return 'secondary';
      case 'approved': case 'active': return 'default';
      case 'disputed': case 'failed': case 'rejected': return 'destructive';
      case 'cancelled': return 'outline';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': case 'paid': case 'resolved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending': case 'open': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'disputed': case 'failed': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Commission Management</h1>
          <p className="text-muted-foreground mt-2">
            Automated commission calculations, quota tracking, and payment processing
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isStructureDialogOpen} onOpenChange={setIsStructureDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                New Structure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Commission Structure</DialogTitle>
              </DialogHeader>
              <Form {...structureForm}>
                <form onSubmit={structureForm.handleSubmit(onStructureSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={structureForm.control}
                      name="structure_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Structure Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Sales Rep Standard Commission" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                              <SelectItem value="flat_rate">Flat Rate</SelectItem>
                              <SelectItem value="tiered">Tiered</SelectItem>
                              <SelectItem value="progressive">Progressive</SelectItem>
                              <SelectItem value="team_based">Team Based</SelectItem>
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
                      control={structureForm.control}
                      name="applies_to"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Applies To</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="individual">Individual</SelectItem>
                              <SelectItem value="team">Team</SelectItem>
                              <SelectItem value="department">Department</SelectItem>
                              <SelectItem value="region">Region</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={structureForm.control}
                      name="base_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Rate (decimal)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.001" 
                              placeholder="0.05 = 5%"
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
                      control={structureForm.control}
                      name="calculation_basis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Calculation Basis</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="revenue">Revenue</SelectItem>
                              <SelectItem value="gross_profit">Gross Profit</SelectItem>
                              <SelectItem value="net_profit">Net Profit</SelectItem>
                              <SelectItem value="units_sold">Units Sold</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={structureForm.control}
                      name="minimum_threshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Threshold ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={structureForm.control}
                      name="maximum_cap"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Cap ($) - Optional</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={structureForm.control}
                      name="effective_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={structureForm.control}
                      name="expiration_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiration Date (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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

          <Dialog open={isQuotaDialogOpen} onOpenChange={setIsQuotaDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Target className="mr-2 h-4 w-4" />
                Set Quota
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Set Sales Quota</DialogTitle>
              </DialogHeader>
              <Form {...quotaForm}>
                <form onSubmit={quotaForm.handleSubmit(onQuotaSubmit)} className="space-y-4">
                  <FormField
                    control={quotaForm.control}
                    name="employee_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employees.map((emp: any) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.name} - {emp.role}
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
                      control={quotaForm.control}
                      name="quota_period_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Period Start</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={quotaForm.control}
                      name="quota_period_end"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Period End</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={quotaForm.control}
                      name="quota_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quota Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="revenue">Revenue</SelectItem>
                              <SelectItem value="gross_profit">Gross Profit</SelectItem>
                              <SelectItem value="units">Units</SelectItem>
                              <SelectItem value="new_accounts">New Accounts</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={quotaForm.control}
                      name="quota_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quota Amount</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
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
                      control={quotaForm.control}
                      name="stretch_goal_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stretch Goal (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={quotaForm.control}
                      name="minimum_threshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Threshold (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsQuotaDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createQuotaMutation.isPending}>
                      {createQuotaMutation.isPending ? "Creating..." : "Set Quota"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDisputeDialogOpen} onOpenChange={setIsDisputeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <AlertTriangle className="mr-2 h-4 w-4" />
                File Dispute
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>File Commission Dispute</DialogTitle>
              </DialogHeader>
              <Form {...disputeForm}>
                <form onSubmit={disputeForm.handleSubmit(onDisputeSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={disputeForm.control}
                      name="dispute_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dispute Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="calculation_error">Calculation Error</SelectItem>
                              <SelectItem value="missing_sale">Missing Sale</SelectItem>
                              <SelectItem value="incorrect_rate">Incorrect Rate</SelectItem>
                              <SelectItem value="payment_delay">Payment Delay</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={disputeForm.control}
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
                    control={disputeForm.control}
                    name="employee_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employees.map((emp: any) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.name} - {emp.role}
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
                      control={disputeForm.control}
                      name="dispute_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dispute Amount ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={disputeForm.control}
                      name="claimed_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Claimed Amount ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={disputeForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Provide detailed description of the dispute..."
                            rows={4}
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
                      onClick={() => setIsDisputeDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createDisputeMutation.isPending}>
                      {createDisputeMutation.isPending ? "Filing..." : "File Dispute"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => runCalculationMutation.mutate()} disabled={runCalculationMutation.isPending}>
            <Calculator className="mr-2 h-4 w-4" />
            {runCalculationMutation.isPending ? "Calculating..." : "Run Calculations"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="structures">Structures</TabsTrigger>
          <TabsTrigger value="calculations">Calculations</TabsTrigger>
          <TabsTrigger value="quotas">Quotas</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Commission Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Commissions Paid</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${metrics?.totalCommissionsPaid?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  This month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Commissions</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${metrics?.pendingCommissions?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Awaiting payment
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Commission Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.averageCommissionRate ? `${(metrics.averageCommissionRate * 100).toFixed(1)}%` : "0%"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all structures
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance and Issues Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Top Commission This Month</span>
                    <span className="font-medium">
                      ${metrics?.topPerformerCommission?.toLocaleString() || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Quota Attainment</span>
                    <span className="font-medium">
                      {metrics?.quotaAttainment ? `${metrics.quotaAttainment}%` : "0%"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Active Disputes</span>
                    <span className="font-medium">
                      {metrics?.activeDisputes || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Calculations</CardTitle>
              </CardHeader>
              <CardContent>
                {calculationsLoading ? (
                  <p className="text-center py-4">Loading calculations...</p>
                ) : (calculations as CommissionCalculation[]).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No calculations yet</p>
                ) : (
                  <div className="space-y-3">
                    {(calculations as CommissionCalculation[]).slice(0, 5).map((calc) => (
                      <div key={calc.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{calc.employee_name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(calc.calculation_period_start), 'MMM dd')} - {format(new Date(calc.calculation_period_end), 'MMM dd')}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            ${calc.net_commission_amount.toLocaleString()}
                          </span>
                          <Badge variant={getStatusColor(calc.payment_status)} className="text-xs">
                            {calc.payment_status}
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
                <p className="text-center py-8">Loading structures...</p>
              ) : (structures as CommissionStructure[]).length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No commission structures yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(structures as CommissionStructure[]).map((structure) => (
                    <div key={structure.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{structure.structure_name}</h3>
                            <Badge variant={structure.is_active ? 'default' : 'outline'}>
                              {structure.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="outline">
                              {structure.structure_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Applies to: {structure.applies_to}</p>
                            <p>Base Rate: {(structure.base_rate * 100).toFixed(2)}%</p>
                            <p>Calculation: {structure.calculation_basis} • {structure.calculation_period}</p>
                            <p>Minimum: ${structure.minimum_threshold.toLocaleString()}</p>
                            {structure.maximum_cap && (
                              <p>Maximum: ${structure.maximum_cap.toLocaleString()}</p>
                            )}
                            <p>Effective: {format(new Date(structure.effective_date), 'MMM dd, yyyy')}</p>
                            {structure.expiration_date && (
                              <p>Expires: {format(new Date(structure.expiration_date), 'MMM dd, yyyy')}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
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

        <TabsContent value="calculations" className="space-y-6">
          {/* Filters */}
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
                <SelectItem value="all">All Periods</SelectItem>
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
              <CardTitle>Commission Calculations</CardTitle>
            </CardHeader>
            <CardContent>
              {calculationsLoading ? (
                <p className="text-center py-8">Loading calculations...</p>
              ) : (calculations as CommissionCalculation[]).length === 0 ? (
                <div className="text-center py-8">
                  <Calculator className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No calculations found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(calculations as CommissionCalculation[]).map((calc) => (
                    <div key={calc.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{calc.employee_name}</h3>
                            <Badge variant={getStatusColor(calc.payment_status)}>
                              {calc.payment_status}
                            </Badge>
                            {getStatusIcon(calc.payment_status)}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Period: {format(new Date(calc.calculation_period_start), 'MMM dd')} - {format(new Date(calc.calculation_period_end), 'MMM dd, yyyy')}</p>
                            <p>Structure: {calc.structure_name}</p>
                            <p>Sales: ${calc.total_sales_amount.toLocaleString()}</p>
                            <p>Commission Base: ${calc.commission_base_amount.toLocaleString()}</p>
                            <p>Rate: {(calc.base_commission_rate * 100).toFixed(2)}%</p>
                            {calc.payment_due_date && (
                              <p>Due: {format(new Date(calc.payment_due_date), 'MMM dd, yyyy')}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            ${calc.net_commission_amount.toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Gross: ${calc.gross_commission_amount.toLocaleString()}
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

        <TabsContent value="quotas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Quotas</CardTitle>
            </CardHeader>
            <CardContent>
              {quotasLoading ? (
                <p className="text-center py-8">Loading quotas...</p>
              ) : (quotas as SalesQuota[]).length === 0 ? (
                <div className="text-center py-8">
                  <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No quotas set</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(quotas as SalesQuota[]).map((quota) => (
                    <div key={quota.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{quota.employee_name}</h3>
                            <Badge variant={getStatusColor(quota.status)}>
                              {quota.status}
                            </Badge>
                            <Badge variant="outline">
                              {quota.quota_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Period: {format(new Date(quota.quota_period_start), 'MMM dd')} - {format(new Date(quota.quota_period_end), 'MMM dd, yyyy')}</p>
                            <p>Quota: ${quota.quota_amount.toLocaleString()}</p>
                            <p>Achievement: ${quota.current_achievement.toLocaleString()}</p>
                          </div>
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span>Progress</span>
                              <span>{quota.achievement_percentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  quota.achievement_percentage >= 100 ? 'bg-green-600' :
                                  quota.achievement_percentage >= 75 ? 'bg-blue-600' :
                                  quota.achievement_percentage >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                                }`}
                                style={{ width: `${Math.min(quota.achievement_percentage, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            quota.achievement_percentage >= 100 ? 'text-green-600' :
                            quota.achievement_percentage >= 75 ? 'text-blue-600' :
                            quota.achievement_percentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {quota.achievement_percentage.toFixed(1)}%
                          </p>
                          <p className="text-sm text-muted-foreground">
                            of quota
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
                  <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No payments processed</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(payments as CommissionPayment[]).map((payment) => (
                    <div key={payment.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{payment.employee_name}</h3>
                            <Badge variant={getStatusColor(payment.payment_status)}>
                              {payment.payment_status}
                            </Badge>
                            <Badge variant="outline">
                              {payment.payment_method}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Payment Date: {format(new Date(payment.payment_date), 'MMM dd, yyyy')}</p>
                            <p>Period: {format(new Date(payment.payment_period_start), 'MMM dd')} - {format(new Date(payment.payment_period_end), 'MMM dd, yyyy')}</p>
                            <p>Gross: ${payment.gross_commission_amount.toLocaleString()}</p>
                            {payment.payment_reference && (
                              <p>Reference: {payment.payment_reference}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            ${payment.net_payment_amount.toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Net Amount
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
                  <p className="text-muted-foreground">No disputes filed</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(disputes as CommissionDispute[]).map((dispute) => (
                    <div key={dispute.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{dispute.dispute_number}</h3>
                            <Badge variant={getStatusColor(dispute.status)}>
                              {dispute.status}
                            </Badge>
                            <Badge variant={getPriorityColor(dispute.priority)}>
                              {dispute.priority}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Employee: {dispute.employee_name}</p>
                            <p>Type: {dispute.dispute_type.replace('_', ' ')}</p>
                            <p>Filed: {format(new Date(dispute.dispute_date), 'MMM dd, yyyy')}</p>
                            {dispute.resolution_date && (
                              <p>Resolved: {format(new Date(dispute.resolution_date), 'MMM dd, yyyy')}</p>
                            )}
                            <p className="text-xs">{dispute.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            ${dispute.dispute_amount.toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Disputed Amount
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
    </div>
  );
}