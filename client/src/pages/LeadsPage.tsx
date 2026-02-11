/**
 * Leads Page - Dedicated lead management with lead-specific KPIs, columns, and actions.
 *
 * Designed for handling thousands of leads with server-side search,
 * filtering, sorting, and pagination.
 */

import { useState, useMemo } from 'react';
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
  UserPlus,
  Target,
  TrendingUp,
  DollarSign,
  Clock,
  ArrowRightCircle,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Flame,
  Thermometer,
  Snowflake,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ─── Lead Form Schema ───────────────────────────────────────────────────────

const leadFormSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  primaryContactName: z.string().min(1, 'Contact name is required'),
  primaryContactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  primaryContactPhone: z.string().optional(),
  industry: z.string().optional(),
  leadSource: z.string().default('website'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  interestLevel: z.string().optional(),
  estimatedAmount: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Status Configurations ──────────────────────────────────────────────────

const leadStatusConfigs: StatusConfig[] = [
  { value: 'new', label: 'New', variant: 'default', className: 'bg-blue-500 hover:bg-blue-600 text-white' },
  { value: 'contacted', label: 'Contacted', variant: 'secondary', className: 'bg-sky-100 text-sky-800 border-sky-200' },
  { value: 'qualified', label: 'Qualified', variant: 'default', className: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
  { value: 'proposal', label: 'Proposal', variant: 'default', className: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { value: 'proposal_sent', label: 'Proposal Sent', variant: 'default', className: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { value: 'negotiation', label: 'Negotiation', variant: 'default', className: 'bg-purple-500 hover:bg-purple-600 text-white' },
  { value: 'closed_won', label: 'Won', variant: 'default', className: 'bg-green-600 hover:bg-green-700 text-white' },
  { value: 'closed_lost', label: 'Lost', variant: 'destructive' },
];

// ─── Column Definitions ─────────────────────────────────────────────────────

const leadColumns: ColumnDef[] = [
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
    key: 'leadSource',
    label: 'Source',
    sortable: true,
    render: (value) => (
      <span className="capitalize text-sm">{value?.replace(/_/g, ' ') || '—'}</span>
    ),
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
    key: 'estimatedAmount',
    label: 'Est. Value',
    sortable: true,
    render: (value) =>
      value ? (
        <span className="font-medium">${Number(value).toLocaleString()}</span>
      ) : (
        '—'
      ),
  },
  {
    key: 'assignedSalesRep',
    label: 'Assigned To',
    render: (value) => value || '—',
  },
  {
    key: 'createdAt',
    label: 'Created',
    sortable: true,
    render: (value) =>
      value ? new Date(value).toLocaleDateString() : '—',
  },
];

// ─── Filter Definitions ─────────────────────────────────────────────────────

const leadFilters: FilterDef[] = [
  {
    key: 'status',
    label: 'Status',
    serverKey: 'status',
    options: [
      { value: 'new', label: 'New' },
      { value: 'contacted', label: 'Contacted' },
      { value: 'qualified', label: 'Qualified' },
      { value: 'proposal', label: 'Proposal' },
      { value: 'proposal_sent', label: 'Proposal Sent' },
      { value: 'negotiation', label: 'Negotiation' },
      { value: 'closed_won', label: 'Won' },
      { value: 'closed_lost', label: 'Lost' },
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
  {
    key: 'leadSource',
    label: 'Source',
    serverKey: 'leadSource',
    options: [
      { value: 'website', label: 'Website' },
      { value: 'referral', label: 'Referral' },
      { value: 'cold_call', label: 'Cold Call' },
      { value: 'trade_show', label: 'Trade Show' },
      { value: 'social_media', label: 'Social Media' },
      { value: 'email_campaign', label: 'Email Campaign' },
      { value: 'partner', label: 'Partner' },
      { value: 'other', label: 'Other' },
    ],
  },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export default function LeadsPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      companyName: '',
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: '',
      industry: '',
      leadSource: 'website',
      priority: 'medium' as const,
      interestLevel: '',
      estimatedAmount: '',
      notes: '',
    },
  });

  // ─── KPI Stats ──────────────────────────────────────────────────────────

  const { data: stats } = useQuery({
    queryKey: ['/api/business-records/stats', 'lead'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const resp = await apiRequest('/api/business-records/stats/overview', 'GET');
      const allStats = resp?.stats || [];
      const leadStats = allStats.filter((s: any) => s.recordType === 'lead');

      let total = 0;
      let newCount = 0;
      let contactedCount = 0;
      let qualifiedCount = 0;
      const pipeline = resp?.pipelineValue || 0;

      for (const s of leadStats) {
        const count = Number(s.count);
        total += count;
        if (s.status === 'new') newCount = count;
        if (s.status === 'contacted') contactedCount = count;
        if (s.status === 'qualified' || s.status === 'proposal_sent') qualifiedCount += count;
      }

      return { total, newCount, contactedCount, qualifiedCount, pipeline };
    },
    staleTime: 60_000,
  });

  // ─── Create Lead Mutation ─────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/business-records', 'POST', {
        ...data,
        recordType: 'lead',
        status: 'new',
        estimatedAmount: data.estimatedAmount ? parseFloat(data.estimatedAmount) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/business-records/stats'] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: 'Lead Created', description: 'New lead has been added successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create lead.', variant: 'destructive' });
    },
  });

  // ─── Convert to Prospect Mutation ─────────────────────────────────────────

  const convertToProspectMutation = useMutation({
    mutationFn: (record: any) =>
      apiRequest(`/api/business-records/${record.id}/status`, 'PATCH', {
        status: 'qualified',
        recordType: 'prospect',
        notes: 'Converted from lead to prospect',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/business-records/stats'] });
      toast({ title: 'Converted', description: 'Lead has been converted to prospect.' });
    },
  });

  // ─── Row Actions ──────────────────────────────────────────────────────────

  const rowActions: ActionDef[] = [
    {
      key: 'convert-prospect',
      label: 'Convert to Prospect',
      icon: ArrowRightCircle,
      onClick: (record) => convertToProspectMutation.mutate(record),
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
          toast({ title: 'Deleted', description: 'Lead has been removed.' });
        });
      },
      variant: 'destructive',
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <MainLayout title="Leads" description="Track and manage your sales leads pipeline">
      <div className="space-y-4 sm:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <UserPlus className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">All leads in pipeline</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New</CardTitle>
              <Clock className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.newCount?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">Awaiting contact</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contacted</CardTitle>
              <Phone className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.contactedCount?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">In conversation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Qualified</CardTitle>
              <Target className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.qualifiedCount?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">Ready to advance</p>
            </CardContent>
          </Card>

          <Card className="col-span-2 sm:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(stats?.pipeline || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Total estimated</p>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <BusinessRecordsDataTable
          recordType="lead"
          title="Leads"
          columns={leadColumns}
          filters={leadFilters}
          statusConfigs={leadStatusConfigs}
          rowActions={rowActions}
          onCreateNew={() => setIsCreateOpen(true)}
          createLabel="Add Lead"
          detailPath="/customers"
          emptyTitle="No leads yet"
          emptyDescription="Start building your pipeline by adding your first lead"
        />
      </div>

      {/* Create Lead Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
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
                  name="leadSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="cold_call">Cold Call</SelectItem>
                          <SelectItem value="trade_show">Trade Show</SelectItem>
                          <SelectItem value="social_media">Social Media</SelectItem>
                          <SelectItem value="email_campaign">Email Campaign</SelectItem>
                          <SelectItem value="partner">Partner</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
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
                  {createMutation.isPending ? 'Creating...' : 'Create Lead'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
