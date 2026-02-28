/**
 * Leads Page - Lead capture & qualification management.
 *
 * Sales reps capture new leads, track initial outreach, score/qualify,
 * and convert to prospects. Managers see team-level lead flow and conversion metrics.
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
  QuickFilterTab,
} from '@/components/crm/BusinessRecordsDataTable';
import {
  UserPlus,
  Target,
  Phone,
  Mail,
  Clock,
  ArrowRightCircle,
  Trash2,
  Flame,
  Thermometer,
  Snowflake,
  Plus,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
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
  notes: z.string().optional(),
});

// ─── Status Configurations ──────────────────────────────────────────────────

const leadStatusConfigs: StatusConfig[] = [
  {
    value: 'new',
    label: 'New',
    variant: 'default',
    className: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
  {
    value: 'contacted',
    label: 'Contacted',
    variant: 'secondary',
    className: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  {
    value: 'qualified',
    label: 'Qualified',
    variant: 'default',
    className: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  },
  {
    value: 'proposal',
    label: 'Proposal',
    variant: 'default',
    className: 'bg-amber-500 hover:bg-amber-600 text-white',
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
    value: 'closed_won',
    label: 'Won',
    variant: 'default',
    className: 'bg-green-600 hover:bg-green-700 text-white',
  },
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
    label: 'Status',
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
  {
    key: 'createdAt',
    label: 'Follow-up',
    sortable: false,
    render: (value, _record) => {
      if (!value) {
        return <span className="text-xs text-muted-foreground italic">No follow-up</span>;
      }

      const createdDate = new Date(value);
      const followUpDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const followUpDay = new Date(
        followUpDate.getFullYear(),
        followUpDate.getMonth(),
        followUpDate.getDate(),
      );

      const diffMs = followUpDay.getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        // Overdue
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Overdue ({Math.abs(diffDays)}d)
          </span>
        );
      } else if (diffDays === 0) {
        // Due today
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            Due Today
          </span>
        );
      } else {
        // Upcoming
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {followUpDate.toLocaleDateString()}
          </span>
        );
      }
    },
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
      notes: '',
    },
  });

  // ─── KPI Stats ──────────────────────────────────────────────────────────

  const { data: stats } = useQuery({
    queryKey: ['/api/companies/stats', 'lead'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const [totalResp, newResp, contactedResp, qualifiedResp] = await Promise.all([
        apiRequest('/api/companies?recordType=Lead&limit=1&offset=0', 'GET'),
        apiRequest('/api/companies?recordType=Lead&status=new&limit=1&offset=0', 'GET'),
        apiRequest('/api/companies?recordType=Lead&status=contacted&limit=1&offset=0', 'GET'),
        apiRequest('/api/companies?recordType=Lead&status=qualified&limit=1&offset=0', 'GET'),
      ]);

      return {
        total: totalResp?.pagination?.total || 0,
        newCount: newResp?.pagination?.total || 0,
        contactedCount: contactedResp?.pagination?.total || 0,
        qualifiedCount: qualifiedResp?.pagination?.total || 0,
      };
    },
    staleTime: 60_000,
  });

  // ─── Quick Filter Tabs ──────────────────────────────────────────────────

  const quickFilterTabs: QuickFilterTab[] = useMemo(
    () => [
      { key: 'all', label: 'All', filter: {}, count: stats?.total },
      { key: 'new', label: 'New', filter: { status: 'new' }, count: stats?.newCount },
      {
        key: 'contacted',
        label: 'Contacted',
        filter: { status: 'contacted' },
        count: stats?.contactedCount,
      },
      {
        key: 'qualified',
        label: 'Qualified',
        filter: { status: 'qualified' },
        count: stats?.qualifiedCount,
      },
    ],
    [stats],
  );

  // ─── Create Lead Mutation ─────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      const nameParts = (data.primaryContactName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return apiRequest('/api/companies', 'POST', {
        business_name: data.companyName,
        business_record_type: 'Lead',
        activity: 'new',
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
      toast({ title: 'Lead Created', description: 'New lead has been added successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create lead.', variant: 'destructive' });
    },
  });

  // ─── Convert to Prospect Mutation ─────────────────────────────────────────

  const convertToProspectMutation = useMutation({
    mutationFn: (record: any) =>
      apiRequest(`/api/companies/${record.id}`, 'PATCH', {
        business_record_type: 'Prospect',
        activity: 'qualified',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ title: 'Converted', description: 'Lead has been converted to prospect.' });
    },
  });

  // ─── Row Actions ──────────────────────────────────────────────────────────

  const rowActions: ActionDef[] = [
    {
      key: 'call',
      label: 'Log Call',
      icon: Phone,
      onClick: (record) => {
        if (record.primaryContactPhone) {
          window.open(`tel:${record.primaryContactPhone}`, '_self');
        } else {
          toast({ title: 'No Phone', description: 'No phone number on file.' });
        }
      },
    },
    {
      key: 'email',
      label: 'Send Email',
      icon: Mail,
      onClick: (record) => {
        if (record.primaryContactEmail) {
          window.open(`mailto:${record.primaryContactEmail}`, '_self');
        } else {
          toast({ title: 'No Email', description: 'No email address on file.' });
        }
      },
    },
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
        apiRequest(`/api/companies/${record.id}`, 'DELETE').then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
              <div className="text-2xl font-bold">
                {stats?.contactedCount?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-muted-foreground">In conversation</p>
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
              <p className="text-xs text-muted-foreground">Ready to advance</p>
            </CardContent>
          </Card>
        </div>

        {/* Data Table with Quick Filter Tabs */}
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
          quickFilterTabs={quickFilterTabs}
        />
      </div>

      {/* Mobile FAB */}
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:hidden z-50"
        onClick={() => setIsCreateOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Create Lead Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
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
