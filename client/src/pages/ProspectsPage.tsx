/**
 * Prospects Page - Dedicated prospect management with prospect-specific KPIs,
 * columns, and actions.
 *
 * Prospects are qualified leads actively being worked through the sales pipeline.
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
} from '@/components/crm/BusinessRecordsDataTable';
import {
  Users,
  Target,
  TrendingUp,
  DollarSign,
  Percent,
  ArrowRightCircle,
  Trash2,
  Flame,
  Thermometer,
  Snowflake,
  CalendarClock,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ─── Form Schema ────────────────────────────────────────────────────────────

const prospectFormSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  primaryContactName: z.string().min(1, 'Contact name is required'),
  primaryContactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  primaryContactPhone: z.string().optional(),
  industry: z.string().optional(),
  salesStage: z.string().optional(),
  interestLevel: z.string().optional(),
  estimatedAmount: z.string().optional(),
  probability: z.string().optional(),
  assignedSalesRep: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  notes: z.string().optional(),
});

// ─── Status Configurations ──────────────────────────────────────────────────

const prospectStatusConfigs: StatusConfig[] = [
  { value: 'qualified', label: 'Qualified', variant: 'default', className: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
  { value: 'proposal_sent', label: 'Proposal Sent', variant: 'default', className: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { value: 'negotiation', label: 'Negotiation', variant: 'default', className: 'bg-purple-500 hover:bg-purple-600 text-white' },
  { value: 'demo_scheduled', label: 'Demo Scheduled', variant: 'default', className: 'bg-indigo-500 hover:bg-indigo-600 text-white' },
  { value: 'contract_review', label: 'Contract Review', variant: 'default', className: 'bg-orange-500 hover:bg-orange-600 text-white' },
  { value: 'closed_won', label: 'Won', variant: 'default', className: 'bg-green-600 hover:bg-green-700 text-white' },
  { value: 'closed_lost', label: 'Lost', variant: 'destructive' },
  { value: 'on_hold', label: 'On Hold', variant: 'secondary' },
];

// ─── Column Definitions ─────────────────────────────────────────────────────

const prospectColumns: ColumnDef[] = [
  {
    key: 'companyName',
    label: 'Company',
    sortable: true,
    render: (value, record) => (
      <div>
        <p className="font-medium truncate max-w-[200px]">{value || 'Unnamed'}</p>
        {record.primaryContactName && (
          <p className="text-xs text-muted-foreground truncate">{record.primaryContactName}</p>
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
    key: 'salesStage',
    label: 'Sales Stage',
    sortable: true,
    render: (value) => (
      <span className="capitalize text-sm">{value?.replace(/_/g, ' ') || '—'}</span>
    ),
  },
  {
    key: 'interestLevel',
    label: 'Interest',
    sortable: true,
    render: (value) => {
      if (!value) return '—';
      const config: Record<string, { icon: any; color: string }> = {
        hot: { icon: Flame, color: 'text-red-500' },
        warm: { icon: Thermometer, color: 'text-amber-500' },
        cold: { icon: Snowflake, color: 'text-blue-400' },
      };
      const c = config[value.toLowerCase()];
      if (!c) return <span className="capitalize">{value}</span>;
      const Icon = c.icon;
      return (
        <span className={`flex items-center gap-1 capitalize ${c.color}`}>
          <Icon className="h-3.5 w-3.5" />
          {value}
        </span>
      );
    },
  },
  {
    key: 'estimatedAmount',
    label: 'Deal Value',
    sortable: true,
    render: (value) =>
      value ? (
        <span className="font-medium">${Number(value).toLocaleString()}</span>
      ) : (
        '—'
      ),
  },
  {
    key: 'probability',
    label: 'Win %',
    sortable: true,
    render: (value) => {
      if (!value && value !== 0) return '—';
      const num = Number(value);
      const color =
        num >= 70 ? 'text-green-600' : num >= 40 ? 'text-amber-600' : 'text-red-500';
      return <span className={`font-medium ${color}`}>{num}%</span>;
    },
  },
  {
    key: 'priority',
    label: 'Priority',
    sortable: true,
    render: (value) => {
      const colors: Record<string, string> = {
        urgent: 'bg-red-100 text-red-800 border-red-200',
        high: 'bg-orange-100 text-orange-800 border-orange-200',
        medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        low: 'bg-gray-100 text-gray-600 border-gray-200',
      };
      return (
        <Badge variant="outline" className={`text-xs capitalize ${colors[value] || ''}`}>
          {value || '—'}
        </Badge>
      );
    },
  },
  {
    key: 'assignedSalesRep',
    label: 'Sales Rep',
    render: (value) => value || '—',
  },
];

// ─── Filter Definitions ─────────────────────────────────────────────────────

const prospectFilters: FilterDef[] = [
  {
    key: 'status',
    label: 'Status',
    serverKey: 'status',
    options: [
      { value: 'qualified', label: 'Qualified' },
      { value: 'proposal_sent', label: 'Proposal Sent' },
      { value: 'negotiation', label: 'Negotiation' },
      { value: 'demo_scheduled', label: 'Demo Scheduled' },
      { value: 'contract_review', label: 'Contract Review' },
      { value: 'closed_won', label: 'Won' },
      { value: 'closed_lost', label: 'Lost' },
      { value: 'on_hold', label: 'On Hold' },
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

export default function ProspectsPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(prospectFormSchema),
    defaultValues: {
      companyName: '',
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: '',
      industry: '',
      salesStage: '',
      interestLevel: '',
      estimatedAmount: '',
      probability: '50',
      assignedSalesRep: '',
      priority: 'medium' as const,
      notes: '',
    },
  });

  // ─── KPI Stats ──────────────────────────────────────────────────────────

  const { data: stats } = useQuery({
    queryKey: ['/api/business-records/stats', 'prospect'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const resp = await apiRequest('/api/business-records/stats/overview', 'GET');
      const allStats = resp?.stats || [];
      const prospectStats = allStats.filter((s: any) => s.recordType === 'prospect');

      let total = 0;
      let qualifiedCount = 0;
      let proposalCount = 0;
      let negotiationCount = 0;

      for (const s of prospectStats) {
        const count = Number(s.count);
        total += count;
        if (s.status === 'qualified') qualifiedCount = count;
        if (s.status === 'proposal_sent') proposalCount = count;
        if (s.status === 'negotiation') negotiationCount = count;
      }

      // Get average deal value from a separate query
      const avgResp = await apiRequest(
        '/api/business-records?recordType=prospect&limit=1&offset=0',
        'GET',
      );
      const pipelineTotal = resp?.pipelineValue || 0;
      const avgDealValue = total > 0 ? Math.round(pipelineTotal / total) : 0;

      return { total, qualifiedCount, proposalCount, negotiationCount, pipelineTotal, avgDealValue };
    },
    staleTime: 60_000,
  });

  // ─── Create Prospect Mutation ─────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/business-records', 'POST', {
        ...data,
        recordType: 'prospect',
        status: data.salesStage || 'qualified',
        estimatedAmount: data.estimatedAmount ? parseFloat(data.estimatedAmount) : undefined,
        probability: data.probability ? parseInt(data.probability) : 50,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/business-records/stats'] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: 'Prospect Created', description: 'New prospect has been added.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create prospect.', variant: 'destructive' });
    },
  });

  // ─── Convert to Customer Mutation ─────────────────────────────────────────

  const convertToCustomerMutation = useMutation({
    mutationFn: (record: any) =>
      apiRequest(`/api/business-records/${record.id}/status`, 'PATCH', {
        status: 'active',
        recordType: 'customer',
        notes: 'Converted from prospect to customer',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/business-records/stats'] });
      toast({ title: 'Converted', description: 'Prospect has been converted to customer.' });
    },
  });

  // ─── Row Actions ──────────────────────────────────────────────────────────

  const rowActions: ActionDef[] = [
    {
      key: 'convert-customer',
      label: 'Convert to Customer',
      icon: ArrowRightCircle,
      onClick: (record) => convertToCustomerMutation.mutate(record),
      show: (record) => !['closed_won', 'closed_lost'].includes(record.status),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: (record) => {
        apiRequest(`/api/business-records/${record.id}`, 'DELETE').then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
          queryClient.invalidateQueries({ queryKey: ['/api/business-records/stats'] });
          toast({ title: 'Deleted', description: 'Prospect has been removed.' });
        });
      },
      variant: 'destructive',
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <MainLayout title="Prospects" description="Manage qualified prospects in your sales pipeline">
      <div className="space-y-4 sm:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Prospects</CardTitle>
              <Users className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">Active in pipeline</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Qualified</CardTitle>
              <Target className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.qualifiedCount?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">Needs proposal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Proposals Out</CardTitle>
              <CalendarClock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.proposalCount?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">Awaiting response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Negotiation</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.negotiationCount?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">Closing soon</p>
            </CardContent>
          </Card>

          <Card className="col-span-2 sm:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(stats?.pipelineTotal || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Avg ${(stats?.avgDealValue || 0).toLocaleString()}/deal
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <BusinessRecordsDataTable
          recordType="prospect"
          title="Prospects"
          columns={prospectColumns}
          filters={prospectFilters}
          statusConfigs={prospectStatusConfigs}
          rowActions={rowActions}
          onCreateNew={() => setIsCreateOpen(true)}
          createLabel="Add Prospect"
          detailPath="/customers"
          emptyTitle="No prospects yet"
          emptyDescription="Prospects appear here when leads are qualified or you can create them directly"
        />
      </div>

      {/* Create Prospect Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Prospect</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-5">
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
                  name="salesStage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                          <SelectItem value="negotiation">Negotiation</SelectItem>
                          <SelectItem value="demo_scheduled">Demo Scheduled</SelectItem>
                          <SelectItem value="contract_review">Contract Review</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interestLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hot">Hot</SelectItem>
                          <SelectItem value="warm">Warm</SelectItem>
                          <SelectItem value="cold">Cold</SelectItem>
                        </SelectContent>
                      </Select>
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
                  name="estimatedAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Deal Value</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="50000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="probability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Win Probability (%)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="100" placeholder="50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assignedSalesRep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Sales Rep</FormLabel>
                      <FormControl>
                        <Input placeholder="Sales rep name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); form.reset(); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Prospect'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
