import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/layout/main-layout';
import { useLocation } from 'wouter';
import { useAuthContext } from '@/providers/AuthProvider';
import {
  Search,
  Filter,
  Plus,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  Eye,
  Edit,
  MoreHorizontal,
  Download,
  Upload,
  Settings,
  X,
  Building2,
  User,
  Target,
  Clock,
  ChevronRight,
  CheckSquare,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LeadsImport } from '@/components/leads/LeadsImport';
import { apiRequest, extractRecords } from '@/lib/queryClient';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  jobTitle: string;
  leadSource: string;
  status: string;
  priority: string;
  estimatedValue: number;
  lastActivity: string;
  assignedTo: string;
  createdAt: string;
  notes: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  recordType: string;
  // Additional fields from business_records schema
  industry?: string;
  territory?: string;
  leadScore?: number;
  nextFollowUpDate?: string;
  website?: string;
  employeeCount?: number;
  annualRevenue?: number;
  lastContactDate?: string;
}

interface TableColumn {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  width: string;
  sortable: boolean;
}

const statusColors = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  proposal: 'bg-purple-100 text-purple-800',
  negotiation: 'bg-orange-100 text-orange-800',
  closed_won: 'bg-green-100 text-green-800',
  closed_lost: 'bg-red-100 text-red-800',
};

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

// Available table columns with HubSpot-style configuration
const AVAILABLE_COLUMNS: TableColumn[] = [
  {
    id: 'lead',
    label: 'Lead name',
    icon: User,
    width: 'min-w-[250px]',
    sortable: true,
  },
  {
    id: 'company',
    label: 'Company name',
    icon: Building2,
    width: 'min-w-[200px]',
    sortable: true,
  },
  {
    id: 'status',
    label: 'Lead status',
    icon: Target,
    width: 'min-w-[120px]',
    sortable: true,
  },
  {
    id: 'priority',
    label: 'Priority',
    icon: TrendingUp,
    width: 'min-w-[100px]',
    sortable: true,
  },
  {
    id: 'source',
    label: 'Lead source',
    icon: MapPin,
    width: 'min-w-[120px]',
    sortable: true,
  },
  {
    id: 'industry',
    label: 'Industry',
    icon: Building2,
    width: 'min-w-[120px]',
    sortable: true,
  },
  {
    id: 'territory',
    label: 'Territory',
    icon: MapPin,
    width: 'min-w-[120px]',
    sortable: true,
  },
  {
    id: 'value',
    label: 'Deal amount',
    icon: DollarSign,
    width: 'min-w-[120px]',
    sortable: true,
  },
  {
    id: 'score',
    label: 'Lead score',
    icon: Target,
    width: 'min-w-[100px]',
    sortable: true,
  },
  {
    id: 'lastActivity',
    label: 'Last activity date',
    icon: Clock,
    width: 'min-w-[150px]',
    sortable: true,
  },
  {
    id: 'nextFollowUp',
    label: 'Next activity date',
    icon: Calendar,
    width: 'min-w-[150px]',
    sortable: true,
  },
  {
    id: 'assignedTo',
    label: 'Lead owner',
    icon: User,
    width: 'min-w-[150px]',
    sortable: true,
  },
  {
    id: 'phone',
    label: 'Phone number',
    icon: Phone,
    width: 'min-w-[140px]',
    sortable: false,
  },
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    width: 'min-w-[200px]',
    sortable: false,
  },
  {
    id: 'website',
    label: 'Website',
    icon: Building2,
    width: 'min-w-[180px]',
    sortable: false,
  },
  {
    id: 'employeeCount',
    label: 'Number of employees',
    icon: Users,
    width: 'min-w-[150px]',
    sortable: true,
  },
  {
    id: 'annualRevenue',
    label: 'Annual revenue',
    icon: DollarSign,
    width: 'min-w-[140px]',
    sortable: true,
  },
  {
    id: 'createdDate',
    label: 'Create date',
    icon: Calendar,
    width: 'min-w-[120px]',
    sortable: true,
  },
];

// Default visible columns (HubSpot-style defaults)
const DEFAULT_VISIBLE_COLUMNS = [
  'lead',
  'company',
  'status',
  'source',
  'value',
  'lastActivity',
  'assignedTo',
];

export default function LeadsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuthContext();

  // Responsive view mode: cards on mobile, table on desktop
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [isColumnCustomizerOpen, setIsColumnCustomizerOpen] = useState(false);

  // Auto-switch to cards on mobile
  useEffect(() => {
    if (isMobile) {
      setViewMode('cards');
    }
  }, [isMobile]);

  // Fetch leads data from Supabase business_records
  const {
    data: leads = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['supabase-business-records', user?.tenantId, 'lead'],
    enabled: !!user?.id && !!user?.tenantId,
    retry: false,
    queryFn: async () => {
      const tenantId = user?.tenantId;
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('business_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('record_type', 'lead')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map snake_case DB rows into the Lead interface used by this page (camelCase)
      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.primary_contact_name || row.primaryContactName || '',
        email: row.primary_contact_email || row.primaryContactEmail || '',
        phone: row.primary_contact_phone || row.primaryContactPhone || row.phone || '',
        companyName: row.companyName || row.companyName || '',
        jobTitle: row.primary_contact_title || row.primaryContactTitle || '',
        leadSource: row.source || row.leadSource || '',
        status: row.status || 'new',
        priority: row.priority || 'medium',
        estimatedValue: Number(row.estimated_deal_value ?? row.estimatedAmount ?? 0) || 0,
        lastActivity:
          row.last_contact_date || row.lastContactDate || row.updatedAt || row.updatedAt || '',
        assignedTo:
          row.assigned_sales_rep || row.assignedSalesRep || row.ownerId || row.ownerId || '',
        createdAt: row.createdAt || row.createdAt || '',
        notes: row.notes || '',
        address: row.address_line1 || row.addressLine1 || '',
        city: row.city || '',
        state: row.state || '',
        zipCode: row.postalCode || row.postalCode || '',
        recordType: row.record_type || row.recordType || 'lead',
        industry: row.industry || undefined,
        territory: row.territory || undefined,
        leadScore: row.lead_score ?? row.leadScore ?? undefined,
        nextFollowUpDate: row.next_follow_up_date || row.nextFollowUpDate || undefined,
        website: row.website || undefined,
        employeeCount: row.employee_count ?? row.employeeCount ?? undefined,
        annualRevenue: row.annual_revenue ?? row.annualRevenue ?? undefined,
        lastContactDate: row.last_contact_date || row.lastContactDate || undefined,
      }));
    },
  });

  // Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: async (leadData: Partial<Lead>) => {
      if (!user?.id || !user?.tenantId) {
        throw new Error('Missing user/tenant context');
      }

      const payload: any = {
        tenant_id: user.tenantId,
        record_type: 'lead',
        status: leadData.status || 'new',
        priority: leadData.priority || 'medium',
        company_name: leadData.companyName || '',
        source: leadData.leadSource || 'website',
        primary_contact_name: leadData.name || null,
        primary_contact_email: leadData.email || null,
        primary_contact_phone: leadData.phone || null,
        primary_contact_title: leadData.jobTitle || null,
        address_line1: leadData.address || null,
        city: leadData.city || null,
        state: leadData.state || null,
        postal_code: leadData.zipCode || null,
        notes: leadData.notes || null,
        website: leadData.website || null,
        industry: leadData.industry || null,
        territory: leadData.territory || null,
        employee_count: leadData.employeeCount ?? null,
        annual_revenue: leadData.annualRevenue ?? null,
        estimated_deal_value: leadData.estimatedValue ?? null,
        next_follow_up_date: leadData.nextFollowUpDate || null,
        lead_score: leadData.leadScore ?? null,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('business_records')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['supabase-business-records', user?.tenantId, 'lead'],
      });
      setIsNewLeadOpen(false);
      toast({
        title: 'Success',
        description: 'Lead created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create lead',
        variant: 'destructive',
      });
    },
  });

  // Update lead mutation
  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Lead> & { id: string }) => {
      if (!user?.tenantId) throw new Error('Missing tenant context');

      const patch: any = {
        status: data.status,
        priority: data.priority,
        company_name: data.companyName,
        source: data.leadSource,
        primary_contact_name: data.name,
        primary_contact_email: data.email,
        primary_contact_phone: data.phone,
        primary_contact_title: data.jobTitle,
        address_line1: data.address,
        city: data.city,
        state: data.state,
        postal_code: data.zipCode,
        notes: data.notes,
        website: data.website,
        industry: data.industry,
        territory: data.territory,
        employee_count: data.employeeCount,
        annual_revenue: data.annualRevenue,
        estimated_deal_value: data.estimatedValue,
        next_follow_up_date: data.nextFollowUpDate,
        lead_score: data.leadScore,
        updated_at: new Date().toISOString(),
      };

      // Remove undefined keys so we don't overwrite with null accidentally
      Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

      const { data: updated, error } = await supabase
        .from('business_records')
        .update(patch)
        .eq('id', id)
        .eq('tenant_id', user.tenantId)
        .select('*')
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['supabase-business-records', user?.tenantId, 'lead'],
      });
      setEditingLead(null);
      toast({
        title: 'Success',
        description: 'Lead updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update lead',
        variant: 'destructive',
      });
    },
  });

  // Filter leads based on search and filters
  const filteredLeads = useMemo(() => {
    if (!leads || leads.length === 0) return [];

    return leads.filter((lead: Lead) => {
      const matchesSearch =
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone?.includes(searchTerm);

      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || lead.priority === priorityFilter;
      const matchesSource = sourceFilter === 'all' || lead.leadSource === sourceFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesSource;
    });
  }, [leads, searchTerm, statusFilter, priorityFilter, sourceFilter]);

  // Get unique sources for filter dropdown
  const leadSources = useMemo(() => {
    if (!leads || leads.length === 0) return [];
    const sources = [...new Set(leads.map((lead: Lead) => lead.leadSource).filter(Boolean))];
    return sources;
  }, [leads]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date: string) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  // Get visible columns configuration
  const visibleColumnsConfig = useMemo(() => {
    return AVAILABLE_COLUMNS.filter((col) => visibleColumns.includes(col.id));
  }, [visibleColumns]);

  // Handle column toggle
  const toggleColumn = (columnId: string) => {
    setVisibleColumns((prev) => {
      if (prev.includes(columnId)) {
        // Don't allow removing the last column
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== columnId);
      } else {
        return [...prev, columnId];
      }
    });
  };

  // Handle lead row click to navigate to detail page with URL slug
  const handleLeadClick = (lead: any) => {
    const urlSlug = lead.urlSlug || lead.url_slug || lead.id;
    setLocation(`/leads/${urlSlug}`);
  };

  // Render table cell content based on column type
  const renderTableCell = (lead: Lead, column: TableColumn) => {
    switch (column.id) {
      case 'lead':
        return (
          <div className="cursor-pointer" onClick={() => handleLeadClick(lead)}>
            <div className="font-medium text-blue-600 hover:text-blue-800">{lead.name}</div>
            <div className="text-sm text-gray-500">{lead.jobTitle}</div>
          </div>
        );
      case 'company':
        return (
          <div className="cursor-pointer" onClick={() => handleLeadClick(lead)}>
            <div className="font-medium text-blue-600 hover:text-blue-800">{lead.companyName}</div>
            <div className="text-sm text-gray-500">{lead.industry || '-'}</div>
          </div>
        );
      case 'status':
        return (
          <Badge
            className={statusColors[lead.status as keyof typeof statusColors] || 'bg-gray-100'}
          >
            {lead.status}
          </Badge>
        );
      case 'priority':
        return (
          <Badge
            className={
              priorityColors[lead.priority as keyof typeof priorityColors] || 'bg-gray-100'
            }
          >
            {lead.priority}
          </Badge>
        );
      case 'source':
        return <span className="text-sm">{lead.leadSource}</span>;
      case 'industry':
        return <span className="text-sm">{lead.industry || '-'}</span>;
      case 'territory':
        return <span className="text-sm">{lead.territory || '-'}</span>;
      case 'value':
        return <span className="font-medium">{formatCurrency(lead.estimatedValue)}</span>;
      case 'score':
        return <Badge variant="outline">{lead.leadScore || 0}</Badge>;
      case 'lastActivity':
        return <span className="text-sm">{formatDate(lead.lastActivity)}</span>;
      case 'nextFollowUp':
        return (
          <span className="text-sm">
            {lead.nextFollowUpDate ? formatDate(lead.nextFollowUpDate) : '-'}
          </span>
        );
      case 'assignedTo':
        return <span className="text-sm">{lead.assignedTo || 'Unassigned'}</span>;
      case 'phone':
        return (
          <div className="flex items-center space-x-2">
            <Phone className="h-4 w-4 text-gray-400" />
            <span className="text-sm">{lead.phone}</span>
          </div>
        );
      case 'email':
        return (
          <div className="flex items-center space-x-2">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="text-sm">{lead.email}</span>
          </div>
        );
      case 'website':
        return (
          <span className="text-sm text-blue-600 hover:text-blue-800">{lead.website || '-'}</span>
        );
      case 'employeeCount':
        return <span className="text-sm">{lead.employeeCount || '-'}</span>;
      case 'annualRevenue':
        return (
          <span className="text-sm">
            {lead.annualRevenue ? formatCurrency(lead.annualRevenue) : '-'}
          </span>
        );
      case 'createdDate':
        return <span className="text-sm">{formatDate(lead.createdAt)}</span>;
      default:
        return <span>-</span>;
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedLeads.length === 0) {
      toast({
        title: 'No leads selected',
        description: 'Please select leads to perform bulk actions',
        variant: 'destructive',
      });
      return;
    }

    // Implement bulk actions here
    toast({
      title: 'Bulk Action',
      description: `${action} applied to ${selectedLeads.length} leads`,
    });
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map((lead: Lead) => lead.id));
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-red-600">Failed to load leads data</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <MainLayout title="Leads Management" description="Manage and track your sales leads">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm sm:text-base text-gray-600">Manage and track your sales leads</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleBulkAction('export')}
              className="min-h-[44px] touch-manipulation active:scale-[0.98]"
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <LeadsImport
              onImportComplete={() => queryClient.invalidateQueries({ queryKey: ['/api/leads'] })}
            />
            <Dialog open={isNewLeadOpen} onOpenChange={setIsNewLeadOpen}>
              <DialogTrigger asChild>
                <Button className="min-h-[44px] touch-manipulation active:scale-[0.98]">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create Lead</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle>Create New Lead</DialogTitle>
                  <DialogDescription>Add a new lead to your sales pipeline</DialogDescription>
                </DialogHeader>
                <LeadForm
                  onSubmit={(data) => createLeadMutation.mutate(data)}
                  isLoading={createLeadMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xl sm:text-2xl font-bold">{filteredLeads.length}</p>
                  <p className="text-sm sm:text-base text-gray-600">Total Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xl sm:text-2xl font-bold">
                    {filteredLeads.filter((lead: Lead) => lead.status === 'qualified').length}
                  </p>
                  <p className="text-sm sm:text-base text-gray-600">Qualified</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xl sm:text-2xl font-bold">
                    {formatCurrency(
                      filteredLeads.reduce(
                        (sum: number, lead: Lead) => sum + (lead.estimatedValue || 0),
                        0,
                      ),
                    )}
                  </p>
                  <p className="text-sm sm:text-base text-gray-600">Pipeline Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xl sm:text-2xl font-bold">
                    {
                      filteredLeads.filter((lead: Lead) => {
                        const lastActivity = new Date(lead.lastActivity);
                        const threeDaysAgo = new Date();
                        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                        return lastActivity < threeDaysAgo;
                      }).length
                    }
                  </p>
                  <p className="text-sm sm:text-base text-gray-600">Need Follow-up</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search leads by name, email, company, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 min-h-[44px]"
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] min-h-[44px] touch-manipulation">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="negotiation">Negotiation</SelectItem>
                      <SelectItem value="closed_won">Closed Won</SelectItem>
                      <SelectItem value="closed_lost">Closed Lost</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-[140px] min-h-[44px] touch-manipulation">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-[140px] min-h-[44px] touch-manipulation">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {leadSources.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!isMobile && (
                    <div className="flex border rounded">
                      <Button
                        variant={viewMode === 'table' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('table')}
                        className="rounded-r-none min-h-[40px] touch-manipulation active:scale-[0.98]"
                      >
                        Table
                      </Button>
                      <Button
                        variant={viewMode === 'cards' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('cards')}
                        className="rounded-l-none min-h-[40px] touch-manipulation active:scale-[0.98]"
                      >
                        Cards
                      </Button>
                    </div>
                  )}

                  {/* Column Customizer */}
                  {viewMode === 'table' && !isMobile && (
                    <Popover open={isColumnCustomizerOpen} onOpenChange={setIsColumnCustomizerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Edit columns
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="end">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Edit columns</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}
                              className="touch-manipulation active:scale-[0.98]"
                            >
                              Reset
                            </Button>
                          </div>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {AVAILABLE_COLUMNS.map((column) => {
                              const Icon = column.icon;
                              return (
                                <div key={column.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={column.id}
                                    checked={visibleColumns.includes(column.id)}
                                    onCheckedChange={() => toggleColumn(column.id)}
                                  />
                                  <Icon className="h-4 w-4 text-gray-500" />
                                  <Label
                                    htmlFor={column.id}
                                    className="text-sm flex-1 cursor-pointer"
                                  >
                                    {column.label}
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {visibleColumns.length} of {AVAILABLE_COLUMNS.length} columns selected
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedLeads.length > 0 && (
              <div className="mt-4 p-3 sm:p-4 bg-blue-50 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-sm font-medium text-blue-800">
                    {selectedLeads.length} lead
                    {selectedLeads.length === 1 ? '' : 's'} selected
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkAction('update_status')}
                      className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                    >
                      <span className="hidden sm:inline">Update Status</span>
                      <span className="sm:hidden">Status</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkAction('assign')}
                      className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                    >
                      Assign
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkAction('delete')}
                      className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads Data */}
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          </div>
        ) : viewMode === 'table' ? (
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b-2">
                      <TableHead className="w-12 pl-6">
                        <Checkbox
                          checked={
                            selectedLeads.length === filteredLeads.length &&
                            filteredLeads.length > 0
                          }
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      {visibleColumnsConfig.map((column) => {
                        const Icon = column.icon;
                        return (
                          <TableHead
                            key={column.id}
                            className={`${column.width} font-medium text-gray-700`}
                          >
                            <div className="flex items-center space-x-2">
                              <Icon className="h-4 w-4" />
                              <span>{column.label}</span>
                            </div>
                          </TableHead>
                        );
                      })}
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead: Lead) => (
                      <TableRow key={lead.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="pl-6">
                          <Checkbox
                            checked={selectedLeads.includes(lead.id)}
                            onCheckedChange={() => toggleLeadSelection(lead.id)}
                          />
                        </TableCell>
                        {visibleColumnsConfig.map((column) => (
                          <TableCell key={column.id} className="py-4">
                            {renderTableCell(lead, column)}
                          </TableCell>
                        ))}
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-200">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleLeadClick(lead)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingLead(lead)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setLocation(`/quotes/new?leadId=${lead.id}`)}
                              >
                                <DollarSign className="mr-2 h-4 w-4" />
                                Create Quote
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Phone className="mr-2 h-4 w-4" />
                                Call
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Mail className="mr-2 h-4 w-4" />
                                Send Email
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredLeads.map((lead: Lead) => (
              <Card
                key={lead.id}
                className="hover:shadow-lg transition-shadow touch-manipulation active:scale-[0.98]"
              >
                <CardHeader className="p-4 sm:p-6 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-2 flex-wrap">
                        <CardTitle
                          className="text-base sm:text-lg cursor-pointer text-blue-600 hover:text-blue-800 min-h-[44px] flex items-center touch-manipulation active:scale-[0.98] flex-1"
                          onClick={() => handleLeadClick(lead)}
                        >
                          {lead.companyName || 'Unknown Company'}
                        </CardTitle>
                        <Badge
                          className={`flex-shrink-0 ${
                            statusColors[lead.status as keyof typeof statusColors] ||
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {lead.status}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm">
                        {lead.name} • {lead.jobTitle || 'Contact'}
                      </CardDescription>
                      {lead.leadSource && (
                        <CardDescription className="text-xs text-gray-500 mt-1">
                          Source: {lead.leadSource}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="text-base sm:text-lg font-semibold text-right whitespace-nowrap">
                        {formatCurrency(lead.estimatedValue)}
                      </div>
                      <Checkbox
                        checked={selectedLeads.includes(lead.id)}
                        onCheckedChange={() => toggleLeadSelection(lead.id)}
                        className="mt-1 min-w-[24px] min-h-[24px] touch-manipulation"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="space-y-3">
                    {/* Contact Information Grid */}
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      {lead.email && (
                        <div className="flex items-center gap-2 min-h-[32px]">
                          <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-2 min-h-[32px]">
                          <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                      {lead.address && (
                        <div className="flex items-center gap-2 min-h-[32px]">
                          <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate text-xs">
                            {lead.city && lead.state ? `${lead.city}, ${lead.state}` : lead.address}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Additional Information */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      {lead.lastActivity && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span>Last: {new Date(lead.lastActivity).toLocaleDateString()}</span>
                        </div>
                      )}
                      {lead.priority && (
                        <div className="flex items-center gap-1 justify-end">
                          <Target className="h-3 w-3 text-gray-400" />
                          <Badge
                            variant="outline"
                            className={`text-xs px-1 py-0 ${
                              priorityColors[lead.priority as keyof typeof priorityColors] ||
                              'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {lead.priority}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Notes Preview */}
                    {lead.notes && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded line-clamp-2">
                        {lead.notes}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 pt-2 border-t">
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          size="sm"
                          onClick={() => setLocation(`/quotes/new?leadId=${lead.id}`)}
                          className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                          data-testid={`button-quote-${lead.id}`}
                        >
                          <DollarSign className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline text-xs">Quote</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                          data-testid={`button-call-${lead.id}`}
                        >
                          <Phone className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline text-xs">Call</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                          data-testid={`button-email-${lead.id}`}
                        >
                          <Mail className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline text-xs">Email</span>
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingLead(lead)}
                          className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                          data-testid={`button-edit-${lead.id}`}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          <span className="text-xs">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLeadClick(lead)}
                          className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                          data-testid={`button-details-${lead.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          <span className="text-xs">Details</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Lead Dialog */}
        {editingLead && (
          <Dialog open={!!editingLead} onOpenChange={() => setEditingLead(null)}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>Edit Lead</DialogTitle>
                <DialogDescription>Update lead information</DialogDescription>
              </DialogHeader>
              <LeadForm
                initialData={editingLead}
                onSubmit={(data) => updateLeadMutation.mutate({ ...data, id: editingLead.id })}
                isLoading={updateLeadMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </MainLayout>
  );
}

// Lead form validation schema
const leadSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  name: z.string().min(2, 'Contact name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  leadSource: z.string().optional(),
  status: z
    .enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'])
    .default('new'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  estimatedValue: z.coerce.number().min(0, 'Value must be positive').optional(),
  notes: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, 'Use 2-letter state code').optional(),
  zipCode: z.string().optional(),
  website: z.string().url('Invalid URL format').optional().or(z.literal('')),
  industry: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

// Lead Form Component with react-hook-form
function LeadForm({
  initialData,
  onSubmit,
  isLoading,
}: {
  initialData?: Lead;
  onSubmit: (data: Partial<Lead>) => void;
  isLoading: boolean;
}) {
  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      companyName: initialData?.companyName || '',
      name: initialData?.name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      jobTitle: initialData?.jobTitle || '',
      leadSource: initialData?.leadSource || '',
      status: (initialData?.status as any) || 'new',
      priority: (initialData?.priority as any) || 'medium',
      estimatedValue: initialData?.estimatedValue || 0,
      notes: initialData?.notes || '',
      address: initialData?.address || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      zipCode: initialData?.zipCode || '',
      industry: initialData?.industry || '',
      website: initialData?.website || '',
    },
  });

  const [companySearchTerm, setCompanySearchTerm] = useState(initialData?.companyName || '');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [selectedExistingCompany, setSelectedExistingCompany] = useState<any>(null);

  // Fetch existing companies for autocomplete
  const { data: existingCompanies = [] } = useQuery({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const response = await apiRequest('/api/companies', 'GET');
      const companies = extractRecords(response);

      // Transform snake_case to camelCase and filter
      return companies
        .map((c: any) => ({
          id: c.id,
          companyName: c.businessName || c.companyName || '',
          businessRecordType: c.business_record_type || c.businessRecordType || '',
          billingCity: c.billing_city || c.billingCity || '',
          billingState: c.billing_state || c.billingState || '',
        }))
        .filter((company: any) => company.companyName && company.companyName.trim());
    },
  });

  // Filter companies based on search term
  const filteredCompanies = useMemo(() => {
    if (!companySearchTerm || companySearchTerm.length < 2) return [];
    return existingCompanies
      .filter((company: any) =>
        company.companyName.toLowerCase().includes(companySearchTerm.toLowerCase()),
      )
      .slice(0, 10);
  }, [existingCompanies, companySearchTerm]);

  const handleCompanySelect = (company: any) => {
    setSelectedExistingCompany(company);
    setCompanySearchTerm(company.companyName);
    setIsCompanyDropdownOpen(false);

    // Pre-fill form with existing company data using setValue
    form.setValue('companyName', company.companyName);
    form.setValue('name', company.primaryContactName || '');
    form.setValue('email', company.primaryContactEmail || '');
    form.setValue('phone', company.primaryContactPhone || company.phone || '');
    form.setValue('address', company.addressLine1 || '');
    form.setValue('city', company.city || '');
    form.setValue('state', company.state || '');
    form.setValue('zipCode', company.postalCode || '');
    form.setValue('industry', company.industry || '');
    form.setValue('website', company.website || '');
  };

  const handleCompanyInputChange = (value: string) => {
    setCompanySearchTerm(value);
    form.setValue('companyName', value);
    setSelectedExistingCompany(null);
    setIsCompanyDropdownOpen(value.length >= 2);
  };

  const handleFormSubmit = form.handleSubmit((data) => {
    onSubmit(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleFormSubmit} className="space-y-4 sm:space-y-6">
        {/* Company Information - Primary Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-base sm:text-lg font-semibold text-gray-900 border-b pb-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Company Information
          </div>

          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-medium">Company Name *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      value={companySearchTerm}
                      onChange={(e) => {
                        field.onChange(e);
                        handleCompanyInputChange(e.target.value);
                      }}
                      placeholder="Start typing company name..."
                      className="text-base"
                      onFocus={() => setIsCompanyDropdownOpen(companySearchTerm.length >= 2)}
                      onBlur={() => setTimeout(() => setIsCompanyDropdownOpen(false), 200)}
                    />

                    {/* Company Autocomplete Dropdown */}
                    {isCompanyDropdownOpen && filteredCompanies.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredCompanies.map((company: any) => (
                          <button
                            key={company.id}
                            type="button"
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                            onClick={() => handleCompanySelect(company)}
                          >
                            <div>
                              <div className="font-medium text-gray-900">{company.companyName}</div>
                              <div className="text-sm text-gray-500">
                                {company.recordType === 'customer' ? (
                                  <span className="text-green-600">Existing Customer</span>
                                ) : (
                                  <span className="text-blue-600">Lead</span>
                                )}
                                {company.city && company.state && (
                                  <span>
                                    {' '}
                                    • {company.city}, {company.state}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
                {selectedExistingCompany && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded mt-2">
                    <CheckSquare className="h-4 w-4" />
                    Information loaded from existing {selectedExistingCompany.recordType}. You can
                    modify before saving.
                  </div>
                )}
              </FormItem>
            )}
          />
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 border-b pb-2">
            <User className="h-5 w-5 text-blue-600" />
            Contact Details
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Primary contact person" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jobTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Office Manager, CEO" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="contact@company.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="(555) 123-4567" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Lead Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 border-b pb-2">
            <Target className="h-5 w-5 text-blue-600" />
            Lead Details
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="leadSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Source</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="How did they find you?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="cold_call">Cold Call</SelectItem>
                      <SelectItem value="email_campaign">Email Campaign</SelectItem>
                      <SelectItem value="trade_show">Trade Show</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="google_ads">Google Ads</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estimatedValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Value</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      placeholder="0"
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="negotiation">Negotiation</SelectItem>
                      <SelectItem value="closed_won">Closed Won</SelectItem>
                      <SelectItem value="closed_lost">Closed Lost</SelectItem>
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
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Address Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 border-b pb-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Address Information
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="123 Main Street" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="City" />
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
                    <Input {...field} placeholder="CA" maxLength={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP Code</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="12345" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} placeholder="Additional notes about this lead..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
          <Button
            type="submit"
            disabled={isLoading}
            className="min-h-[44px] touch-manipulation active:scale-[0.98] order-1 sm:order-2"
          >
            {isLoading ? 'Saving...' : initialData ? 'Update Lead' : 'Create Lead'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
