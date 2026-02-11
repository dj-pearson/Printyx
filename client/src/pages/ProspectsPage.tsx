/**
 * Prospects Page - Visual pipeline management.
 *
 * Sales reps drag prospects through stages. Managers see total pipeline value,
 * stage distribution, and forecast. Dual view: Pipeline Board (Kanban) + List View.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { PipelineBoard, PIPELINE_STAGES } from '@/components/crm/PipelineBoard';
import {
  Users,
  Target,
  TrendingUp,
  CalendarClock,
  Kanban,
  List,
  ArrowRightCircle,
  Trash2,
  Plus,
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
  notes: z.string().optional(),
});

// ─── Status Configurations ──────────────────────────────────────────────────

const prospectStatusConfigs: StatusConfig[] = [
  {
    value: 'qualified',
    label: 'Qualified',
    variant: 'default',
    className: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  },
  {
    value: 'demo_scheduled',
    label: 'Demo Scheduled',
    variant: 'default',
    className: 'bg-indigo-500 hover:bg-indigo-600 text-white',
  },
  {
    value: 'proposal_sent',
    label: 'Proposal Sent',
    variant: 'default',
    className: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  {
    value: 'negotiation',
    label: 'Negotiation',
    variant: 'default',
    className: 'bg-purple-500 hover:bg-purple-600 text-white',
  },
  {
    value: 'contract_review',
    label: 'Contract Review',
    variant: 'default',
    className: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
  {
    value: 'closed_won',
    label: 'Won',
    variant: 'default',
    className: 'bg-green-600 hover:bg-green-700 text-white',
  },
  { value: 'closed_lost', label: 'Lost', variant: 'destructive' },
  { value: 'on_hold', label: 'On Hold', variant: 'secondary' },
];

// ─── Column Definitions (List View) ─────────────────────────────────────────

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
    key: 'primaryContactName',
    label: 'Contact',
    sortable: true,
    render: (value, record) => {
      if (!value) return '—';
      return (
        <div>
          <p className="truncate max-w-[160px]">{value}</p>
          {record.primaryContactEmail && (
            <a
              href={`mailto:${record.primaryContactEmail}`}
              className="text-xs text-blue-600 hover:underline truncate block"
              onClick={(e) => e.stopPropagation()}
            >
              {record.primaryContactEmail}
            </a>
          )}
        </div>
      );
    },
  },
  {
    key: 'status',
    label: 'Stage',
    sortable: true,
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
    key: 'createdAt',
    label: 'Created',
    sortable: true,
    render: (value) => {
      if (!value) return '—';
      const date = new Date(value);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
      return date.toLocaleDateString();
    },
  },
];

// ─── Filter Definitions (List View) ─────────────────────────────────────────

const prospectFilters: FilterDef[] = [
  {
    key: 'status',
    label: 'Stage',
    serverKey: 'status',
    options: [
      { value: 'qualified', label: 'Qualified' },
      { value: 'demo_scheduled', label: 'Demo Scheduled' },
      { value: 'proposal_sent', label: 'Proposal Sent' },
      { value: 'negotiation', label: 'Negotiation' },
      { value: 'contract_review', label: 'Contract Review' },
      { value: 'closed_won', label: 'Won' },
      { value: 'closed_lost', label: 'Lost' },
      { value: 'on_hold', label: 'On Hold' },
    ],
  },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ProspectsPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  const form = useForm({
    resolver: zodResolver(prospectFormSchema),
    defaultValues: {
      companyName: '',
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: '',
      industry: '',
      salesStage: '',
      notes: '',
    },
  });

  // ─── KPI Stats ──────────────────────────────────────────────────────────

  const { data: stats } = useQuery({
    queryKey: ['/api/companies/stats', 'prospect'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const [totalResp, qualifiedResp, proposalResp, negotiationResp] = await Promise.all([
        apiRequest('/api/companies?recordType=Prospect&limit=1&offset=0', 'GET'),
        apiRequest('/api/companies?recordType=Prospect&status=qualified&limit=1&offset=0', 'GET'),
        apiRequest(
          '/api/companies?recordType=Prospect&status=proposal_sent&limit=1&offset=0',
          'GET',
        ),
        apiRequest('/api/companies?recordType=Prospect&status=negotiation&limit=1&offset=0', 'GET'),
      ]);

      return {
        total: totalResp?.pagination?.total || 0,
        qualifiedCount: qualifiedResp?.pagination?.total || 0,
        proposalCount: proposalResp?.pagination?.total || 0,
        negotiationCount: negotiationResp?.pagination?.total || 0,
      };
    },
    staleTime: 60_000,
  });

  // ─── Pipeline Data (all prospects for Kanban) ───────────────────────────

  const { data: pipelineData } = useQuery({
    queryKey: ['/api/companies', 'prospect', 'pipeline'],
    enabled: isAuthenticated && viewMode === 'board',
    queryFn: async () => {
      const resp = await apiRequest('/api/companies?recordType=Prospect&limit=500&offset=0', 'GET');
      const rawRecords = resp?.records || resp?.data || [];
      return rawRecords.map(normalizeRecord);
    },
    staleTime: 30_000,
  });

  const pipelineRecords = pipelineData || [];

  // ─── Stage Change Mutation (drag-and-drop) ──────────────────────────────

  const stageChangeMutation = useMutation({
    mutationFn: ({ recordId, newStage }: { recordId: string; newStage: string }) =>
      apiRequest(`/api/companies/${recordId}`, 'PATCH', {
        activity: newStage,
      }),
    onMutate: async ({ recordId, newStage }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/companies', 'prospect', 'pipeline'] });
      const previousData = queryClient.getQueryData(['/api/companies', 'prospect', 'pipeline']);

      queryClient.setQueryData(
        ['/api/companies', 'prospect', 'pipeline'],
        (old: any[] | undefined) =>
          old?.map((record) =>
            record.id === recordId ? { ...record, status: newStage, activity: newStage } : record,
          ),
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['/api/companies', 'prospect', 'pipeline'], context.previousData);
      }
      toast({ title: 'Error', description: 'Failed to update stage.', variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
    },
  });

  const handleStageChange = useCallback(
    (recordId: string, newStage: string) => {
      stageChangeMutation.mutate({ recordId, newStage });
    },
    [stageChangeMutation],
  );

  // ─── Create Prospect Mutation ─────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      const nameParts = (data.primaryContactName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return apiRequest('/api/companies', 'POST', {
        business_name: data.companyName,
        business_record_type: 'Prospect',
        activity: data.salesStage || 'qualified',
        industry: data.industry || undefined,
        contacts: firstName
          ? [
              {
                first_name: firstName,
                last_name: lastName,
                email: data.primaryContactEmail || undefined,
                phone: data.primaryContactPhone || undefined,
                is_primary: true,
              },
            ]
          : [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
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
      apiRequest(`/api/companies/${record.id}`, 'PATCH', {
        business_record_type: 'Customer',
        activity: 'active',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ title: 'Converted', description: 'Prospect has been converted to customer.' });
    },
  });

  // ─── Row Actions (List View) ──────────────────────────────────────────────

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
        apiRequest(`/api/companies/${record.id}`, 'DELETE').then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
          toast({ title: 'Deleted', description: 'Prospect has been removed.' });
        });
      },
      variant: 'destructive',
    },
  ];

  // ─── Navigation helpers for Pipeline Board ────────────────────────────────

  const handleViewDetail = useCallback(
    (record: any) => {
      const slug = record.urlSlug || record.url_slug || record.id;
      navigate(`/customers/${slug}`);
    },
    [navigate],
  );

  const handleDelete = useCallback(
    (record: any) => {
      apiRequest(`/api/companies/${record.id}`, 'DELETE').then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
        toast({ title: 'Deleted', description: 'Prospect has been removed.' });
      });
    },
    [queryClient, toast],
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <MainLayout title="Prospects" description="Manage qualified prospects in your sales pipeline">
      <div className="space-y-4 sm:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
              <div className="text-2xl font-bold">
                {stats?.qualifiedCount?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-muted-foreground">Needs proposal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Proposals Out</CardTitle>
              <CalendarClock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.proposalCount?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-muted-foreground">Awaiting response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Negotiation</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.negotiationCount?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-muted-foreground">Closing soon</p>
            </CardContent>
          </Card>
        </div>

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'board' ? 'default' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setViewMode('board')}
            >
              <Kanban className="h-4 w-4" />
              <span className="hidden sm:inline">Pipeline</span>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
          </div>

          <Button size="default" className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Prospect</span>
          </Button>
        </div>

        {/* Pipeline Board View */}
        {viewMode === 'board' && (
          <PipelineBoard
            records={pipelineRecords}
            onStageChange={handleStageChange}
            onViewDetail={handleViewDetail}
            onConvertToCustomer={(record) => convertToCustomerMutation.mutate(record)}
            onDelete={handleDelete}
          />
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <BusinessRecordsDataTable
            recordType="prospect"
            title="Prospects"
            columns={prospectColumns}
            filters={prospectFilters}
            statusConfigs={prospectStatusConfigs}
            rowActions={rowActions}
            createLabel="Add Prospect"
            detailPath="/customers"
            emptyTitle="No prospects yet"
            emptyDescription="Prospects appear here when leads are qualified or you can create them directly"
          />
        )}
      </div>

      {/* Mobile FAB */}
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:hidden z-50"
        onClick={() => setIsCreateOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Create Prospect Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Prospect</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
              className="space-y-5"
            >
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
                      <FormLabel>Pipeline Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="demo_scheduled">Demo Scheduled</SelectItem>
                          <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                          <SelectItem value="negotiation">Negotiation</SelectItem>
                          <SelectItem value="contract_review">Contract Review</SelectItem>
                        </SelectContent>
                      </Select>
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
