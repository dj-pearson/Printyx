/**
 * Customers Page - Dedicated customer management with customer-specific KPIs,
 * columns, and actions.
 *
 * Designed for handling thousands of active customers with server-side
 * search, filtering, sorting, and pagination.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BusinessRecordsDataTable,
  ColumnDef,
  FilterDef,
  StatusConfig,
  ActionDef,
  normalizeRecord,
} from '@/components/crm/BusinessRecordsDataTable';
import {
  Building2,
  UserCheck,
  DollarSign,
  Crown,
  TrendingUp,
  Trash2,
  Pause,
  Star,
  Upload,
} from 'lucide-react';
import { CsvImportWizard } from '@/components/import';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ─── Form Schema ────────────────────────────────────────────────────────────

const customerFormSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  primaryContactName: z.string().min(1, 'Contact name is required'),
  primaryContactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  primaryContactPhone: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, 'Use 2-letter code').optional(),
  postalCode: z.string().optional(),
  customerTier: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditLimit: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assignedSalesRep: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Status Configurations ──────────────────────────────────────────────────

const customerStatusConfigs: StatusConfig[] = [
  {
    value: 'active',
    label: 'Active',
    variant: 'default',
    className: 'bg-green-500 hover:bg-green-600 text-white',
  },
  { value: 'inactive', label: 'Inactive', variant: 'secondary' },
  {
    value: 'on_hold',
    label: 'On Hold',
    variant: 'outline',
    className: 'border-amber-400 text-amber-700 bg-amber-50',
  },
  { value: 'churned', label: 'Churned', variant: 'destructive' },
  {
    value: 'pending',
    label: 'Pending',
    variant: 'outline',
    className: 'border-blue-400 text-blue-700 bg-blue-50',
  },
];

// ─── Column Definitions ─────────────────────────────────────────────────────

const customerColumns: ColumnDef[] = [
  {
    key: 'companyName',
    label: 'Company',
    sortable: true,
    render: (value, record) => (
      <div>
        <p className="font-medium truncate max-w-[200px]">{value || 'Unnamed'}</p>
        {record.customerNumber && (
          <p className="text-xs text-muted-foreground font-mono">{record.customerNumber}</p>
        )}
      </div>
    ),
  },
  {
    key: 'primaryContactName',
    label: 'Contact',
    sortable: true,
    render: (value, record) => (
      <div>
        <p className="truncate max-w-[160px]">{value || '—'}</p>
        {record.primaryContactEmail && (
          <p className="text-xs text-muted-foreground truncate">{record.primaryContactEmail}</p>
        )}
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
  },
  {
    key: 'customerTier',
    label: 'Tier',
    sortable: true,
    render: (value) => {
      if (!value) return '—';
      const colors: Record<string, string> = {
        platinum: 'bg-slate-100 text-slate-800 border-slate-300',
        gold: 'bg-amber-50 text-amber-800 border-amber-300',
        silver: 'bg-gray-100 text-gray-700 border-gray-300',
        bronze: 'bg-orange-50 text-orange-700 border-orange-300',
      };
      return (
        <Badge
          variant="outline"
          className={`text-xs capitalize ${colors[value.toLowerCase()] || ''}`}
        >
          {value}
        </Badge>
      );
    },
  },
  {
    key: 'industry',
    label: 'Industry',
    sortable: true,
    render: (value) => <span className="truncate max-w-[120px] block text-sm">{value || '—'}</span>,
  },
  {
    key: 'city',
    label: 'Location',
    render: (value, record) => {
      const location = [record.city, record.state].filter(Boolean).join(', ');
      return <span className="text-sm">{location || '—'}</span>;
    },
  },
  {
    key: 'customerSince',
    label: 'Customer Since',
    sortable: true,
    render: (value) => (value ? new Date(value).toLocaleDateString() : '—'),
  },
  {
    key: 'currentBalance',
    label: 'Balance',
    sortable: true,
    render: (value) => {
      if (!value && value !== 0) return '—';
      const num = Number(value);
      return (
        <span className={num > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
          ${Math.abs(num).toLocaleString()}
        </span>
      );
    },
  },
];

// ─── Filter Definitions ─────────────────────────────────────────────────────

const customerFilters: FilterDef[] = [
  {
    key: 'status',
    label: 'Status',
    serverKey: 'status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'on_hold', label: 'On Hold' },
      { value: 'churned', label: 'Churned' },
    ],
  },
  {
    key: 'customerTier',
    label: 'Tier',
    serverKey: 'customerTier',
    options: [
      { value: 'platinum', label: 'Platinum' },
      { value: 'gold', label: 'Gold' },
      { value: 'silver', label: 'Silver' },
      { value: 'bronze', label: 'Bronze' },
    ],
  },
  {
    key: 'priority',
    label: 'Priority',
    serverKey: 'priority',
    options: [
      { value: 'urgent', label: 'Urgent' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
  },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CustomersPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      companyName: '',
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: '',
      website: '',
      industry: '',
      companySize: '',
      addressLine1: '',
      city: '',
      state: '',
      postalCode: '',
      customerTier: '',
      paymentTerms: '',
      creditLimit: '',
      priority: 'medium' as const,
      assignedSalesRep: '',
      notes: '',
    },
  });

  // ─── KPI Stats ──────────────────────────────────────────────────────────

  const { data: stats } = useQuery({
    queryKey: ['/api/business-records/stats', 'customer'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const resp = await apiRequest(
        '/api/business-records?recordType=customer&limit=1&offset=0',
        'GET',
      );
      const total = resp?.pagination?.total || 0;

      // Fetch status counts in parallel
      const [activeResp, inactiveResp, onHoldResp] = await Promise.all([
        apiRequest(
          '/api/business-records?recordType=customer&status=active&limit=1&offset=0',
          'GET',
        ),
        apiRequest(
          '/api/business-records?recordType=customer&status=inactive&limit=1&offset=0',
          'GET',
        ),
        apiRequest(
          '/api/business-records?recordType=customer&status=on_hold&limit=1&offset=0',
          'GET',
        ),
      ]);

      return {
        total,
        activeCount: activeResp?.pagination?.total || 0,
        inactiveCount: inactiveResp?.pagination?.total || 0,
        onHoldCount: onHoldResp?.pagination?.total || 0,
      };
    },
    staleTime: 60_000,
  });

  // ─── Create Customer Mutation ─────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/business-records', 'POST', {
        ...data,
        recordType: 'customer',
        status: 'active',
        creditLimit: data.creditLimit ? parseFloat(data.creditLimit) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/business-records/stats'] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: 'Customer Created', description: 'New customer has been added.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create customer.', variant: 'destructive' });
    },
  });

  // ─── Deactivate Mutation ──────────────────────────────────────────────────

  const deactivateMutation = useMutation({
    mutationFn: (record: any) =>
      apiRequest(`/api/business-records/${record.id}/status`, 'PATCH', {
        status: 'inactive',
        notes: 'Deactivated by user',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/business-records/stats'] });
      toast({ title: 'Deactivated', description: 'Customer has been deactivated.' });
    },
  });

  // ─── Row Actions ──────────────────────────────────────────────────────────

  const rowActions: ActionDef[] = [
    {
      key: 'deactivate',
      label: 'Deactivate',
      icon: Pause,
      onClick: (record) => deactivateMutation.mutate(record),
      show: (record) => record.status === 'active',
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: (record) => {
        apiRequest(`/api/business-records/${record.id}`, 'DELETE').then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
          queryClient.invalidateQueries({ queryKey: ['/api/business-records/stats'] });
          toast({ title: 'Deleted', description: 'Customer has been removed.' });
        });
      },
      variant: 'destructive',
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <MainLayout title="Customers" description="Manage your active customer relationships">
      <div className="space-y-4 sm:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Building2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">All customers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats?.activeCount?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On Hold</CardTitle>
              <Pause className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {stats?.onHoldCount?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-muted-foreground">Needs attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {stats?.inactiveCount?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.total
                  ? `${Math.round(((stats.activeCount || 0) / stats.total) * 100)}% retention`
                  : 'No data'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Import button row */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
        </div>

        {/* Data Table */}
        <BusinessRecordsDataTable
          recordType="customer"
          title="Customers"
          columns={customerColumns}
          filters={customerFilters}
          statusConfigs={customerStatusConfigs}
          rowActions={rowActions}
          onCreateNew={() => setIsCreateOpen(true)}
          createLabel="Add Customer"
          detailPath="/customers"
          emptyTitle="No customers yet"
          emptyDescription="Add your first customer or convert prospects to build your customer base"
        />
      </div>

      {/* Create Customer Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Customer</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
              className="space-y-5"
            >
              {/* Company Info */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Company Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Corporation" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <FormControl>
                          <Input placeholder="Technology, Healthcare..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companySize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="startup">Startup (1-10)</SelectItem>
                            <SelectItem value="small">Small (11-50)</SelectItem>
                            <SelectItem value="medium">Medium (51-250)</SelectItem>
                            <SelectItem value="large">Large (251-1000)</SelectItem>
                            <SelectItem value="enterprise">Enterprise (1000+)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Contact */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Primary Contact
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="primaryContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="John Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primaryContactEmail"
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
                    control={form.control}
                    name="primaryContactPhone"
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
              </div>

              {/* Address */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Address
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="addressLine1"
                    render={({ field }) => (
                      <FormItem className="md:col-span-3">
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main Street" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="New York" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="NY" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input placeholder="10001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Account Management */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Account Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="customerTier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Tier</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select tier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bronze">Bronze</SelectItem>
                            <SelectItem value="silver">Silver</SelectItem>
                            <SelectItem value="gold">Gold</SelectItem>
                            <SelectItem value="platinum">Platinum</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Terms</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select terms" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="net_15">Net 15</SelectItem>
                            <SelectItem value="net_30">Net 30</SelectItem>
                            <SelectItem value="net_45">Net 45</SelectItem>
                            <SelectItem value="net_60">Net 60</SelectItem>
                            <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Limit</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="10000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                    name="assignedSalesRep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Manager</FormLabel>
                        <FormControl>
                          <Input placeholder="Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes..." className="min-h-20" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Customer'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* CSV Import */}
      <CsvImportWizard
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        defaultEntityType="business_records"
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
          queryClient.invalidateQueries({ queryKey: ['/api/business-records/stats'] });
          toast({ title: 'Import Complete', description: 'Records imported successfully.' });
        }}
      />
    </MainLayout>
  );
}
