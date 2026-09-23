import { useState, useMemo } from 'react';
import { CRM_PAGE_SIZE } from '@shared/board-truncation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import {
  BulkOperationsToolbar,
  useBulkSelection,
  type BulkAction,
} from '@/components/ui/bulk-operations-toolbar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  FileText,
  Edit,
  Trash2,
  ChevronDown,
  User,
  Building2,
  Users,
  Target,
  Activity,
  Download,
  Upload,
  Settings,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  UserCheck,
  UserX,
} from 'lucide-react';
import { apiRequest, extractRecords } from '@/lib/queryClient';
import { describeApiError } from '@/lib/api-error';
import { exportToCSV, type ExportColumn } from '@/lib/export-utils';
import { Link } from 'wouter';
import { getApiUrl } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import { useAuthContext } from '@/providers/AuthProvider';
import MobileFAB from '@/components/layout/MobileFAB';
import { relativeDate, todayLocalDate } from '@/lib/date-utils';
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  buildContactActivity,
  type ContactActivityForm,
} from '@/lib/contact-activity';
import { useConfirm } from '@/components/ui/confirm-dialog';

// Contact form schema
const contactFormSchema = z.object({
  salutation: z.string().optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  reportsTo: z.string().optional(),
  companyName: z.string().min(1, 'Company is required'),
  companyId: z.string().optional(),
  isPrimaryContact: z.boolean().default(false),
  leadStatus: z.string().optional(),
  leadSource: z.string().optional(),
  emailOptOut: z.boolean().default(false),
  doNotCall: z.boolean().default(false),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

interface Contact {
  // Fields returned by getContacts function
  id: string;
  firstName?: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  companyId: string;
  companyName?: string;
  leadStatus?: string;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  createdAt?: string;
  ownerId?: string;
  ownerName?: string;
  favoriteContentType?: string;
  preferredChannels?: string;
  tenantId: string;

  // Additional schema fields for create/edit forms
  salutation?: string;
  department?: string;
  mobile?: string;
  reportsTo?: string;
  contactRoles?: string;
  isPrimaryContact?: boolean;
  leadSource?: string;
  priority?: string;
  estimatedDealValue?: number;
  emailOptOut?: boolean;
  doNotCall?: boolean;
}

const CONTACTS_PAGE_EXPORT_COLUMNS: ExportColumn<Contact>[] = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'title', label: 'Title' },
  { key: 'companyName', label: 'Company' },
  { key: 'leadStatus', label: 'Status' },
  { key: 'lastContactDate', label: 'Last Contacted' },
  { key: 'nextFollowUpDate', label: 'Next Follow-up' },
];

export default function Contacts() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { user, getAccessToken } = useAuthContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    contactOwner: '',
    createDate: '',
    lastActivityDate: '',
    leadStatus: '',
    view: 'all',
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState('last_contact_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog states
  const [dialogs, setDialogs] = useState({
    createContact: false,
    bulkActions: false,
    logActivity: false,
    contactDetails: false,
  });

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [activityForm, setActivityForm] = useState<ContactActivityForm>({
    type: 'note',
    notes: '',
    date: todayLocalDate(),
    followUpDays: 7,
  });

  // Contact form state
  const [showNewCompanyConfirm, setShowNewCompanyConfirm] = useState(false);
  const [pendingContactData, setPendingContactData] = useState<ContactFormData | null>(null);

  // Contact form
  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      salutation: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      mobile: '',
      title: '',
      department: '',
      reportsTo: '',
      companyName: '',
      companyId: '',
      isPrimaryContact: false,
      leadStatus: 'new',
      leadSource: '',
      emailOptOut: false,
      doNotCall: false,
    },
  });

  // Tenant context is required for Supabase/RLS
  const tenantId = user?.tenantId;

  // Fetch companies for dropdown
  const {
    data: companies,
    isLoading: companiesLoading,
    error: companiesError,
  } = useQuery({
    // WF-S-07: through the server, not through the browser's Supabase client.
    // `companies` has no RLS policy, so a direct PostgREST read was isolated by
    // the .eq('tenant_id') in this file and nothing else - a filter the caller
    // controls is not a boundary. The edge function resolves the tenant from the
    // JWT and, since WF-R-05, scopes the rows to the caller as well.
    queryKey: ['/api/companies', 'contacts-picker', tenantId],
    enabled: !!tenantId,
    retry: 2,
    queryFn: async () => {
      // COP-I01: this asked for 500 against an endpoint that clamps to
      // CRM_PAGE_SIZE (200), so the picker held the first 200 companies and the
      // filter below searched only those - a company created after the 200th
      // could not be selected at all.
      const response = await apiRequest(`/api/companies?limit=${CRM_PAGE_SIZE}`, 'GET');
      return extractRecords<Record<string, any>>(response).map((row) => ({
        id: row.id,
        companyName: row.business_name ?? row.businessName,
        status: row.activity ?? 'active',
      }));
    },
  });

  // Fetch users for owner lookup
  const { data: users } = useQuery({
    // WF-S-07. It also fixes a live blank: the select asked for first_name and
    // last_name and the mapper read u.firstName / u.lastName, which are undefined
    // on a raw PostgREST row - so every owner rendered as their email or as
    // "Unassigned". /api/users already returns camelCase.
    queryKey: ['/api/users', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const response = await apiRequest('/api/users', 'GET');
      return extractRecords<Record<string, any>>(response).map((u) => ({
        id: u.id,
        firstName: u.firstName ?? u.first_name,
        lastName: u.lastName ?? u.last_name,
        email: u.email,
      }));
    },
    retry: 1,
  });

  // Helper function to get company name by ID
  const getCompanyName = (companyId: string) => {
    const company = companies?.find((c: any) => c.id === companyId);
    return company?.companyName || '--';
  };

  // Helper function to get user name by ID
  const getUserName = (userId: string) => {
    const user = users?.find((u: any) => u.id === userId);
    if (!user) return 'Unassigned';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unassigned';
  };

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (companyName: string) => {
      if (!tenantId || !user?.id) {
        throw new Error('Missing tenant/user context');
      }

      // WF-S-07. tenant_id and created_by are no longer sent: the edge function
      // takes both from the JWT, and a client-supplied tenant_id on an insert is
      // the write half of the same hole the read had.
      const created = await apiRequest('/api/companies', 'POST', {
        business_name: companyName,
        activity: 'active',
      });

      return {
        id: created.id,
        companyName: created.business_name ?? created.businessName ?? companyName,
        status: created.activity ?? 'active',
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/companies', 'contacts-picker', tenantId],
      });
    },
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (!tenantId) throw new Error('Missing tenant context');
      if (!data.companyId) throw new Error('Missing companyId');

      // WF-S-07: POST /api/contacts, which takes tenant_id from the JWT and
      // defaults owner_id to the caller. Two keys are gone with the direct insert
      // and neither is a loss: preferred_channels and favorite_content_type were
      // always written as null, and `owner_id: filters.contactOwner` took the
      // OWNER FROM THE LIST FILTER - so a contact created while filtering by a
      // colleague was assigned to that colleague, and one created with the filter
      // on 'all' was assigned to the literal string 'all'.
      const created = await apiRequest('/api/contacts', 'POST', {
        companyId: data.companyId,
        salutation: data.salutation || null,
        firstName: data.firstName || null,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
        title: data.title || null,
        department: data.department || null,
        reportsTo: data.reportsTo || null,
        isPrimaryContact: data.isPrimaryContact || false,
        leadStatus: data.leadStatus || 'new',
      });

      return created;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Contact created successfully',
      });
      contactForm.reset();
      setDialogs((prev) => ({ ...prev, createContact: false }));
      queryClient.invalidateQueries({ queryKey: ['api-contacts', tenantId] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create contact',
        variant: 'destructive',
      });
    },
  });

  // Enhanced submit handler with company creation logic
  const onSubmitContact = async (data: ContactFormData) => {
    // Check if the company exists (case-insensitive)
    const existingCompany = companies?.find(
      (company: any) =>
        (company.companyName || company.name)?.toLowerCase() === data.companyName.toLowerCase(),
    );

    if (existingCompany) {
      // Company exists, create contact directly
      createContactMutation.mutate({
        ...data,
        companyId: existingCompany.id,
      });
    } else {
      // Company doesn't exist, show confirmation dialog
      setPendingContactData(data);
      setShowNewCompanyConfirm(true);
    }
  };

  // Handle creating new company and contact
  const handleCreateNewCompany = async () => {
    if (!pendingContactData) return;

    try {
      // Create company first
      const newCompany = await createCompanyMutation.mutateAsync(pendingContactData.companyName);

      // Then create contact with the new company ID
      createContactMutation.mutate({
        ...pendingContactData,
        companyId: newCompany.id,
      });

      setShowNewCompanyConfirm(false);
      setPendingContactData(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create company',
        variant: 'destructive',
      });
    }
  };

  // Handle canceling new company creation
  const handleCancelNewCompany = () => {
    setShowNewCompanyConfirm(false);
    setPendingContactData(null);
  };

  // Filter companies based on search term from form field.
  //
  // Still client-side, and that is now a STATED limit rather than an invisible
  // one: the query above holds the first CRM_PAGE_SIZE companies, so this
  // searches those. The dialog says so when the list is capped rather than
  // letting a missing company read as a company that does not exist.
  const currentCompanyName = contactForm.watch('companyName') || '';
  const filteredCompanies =
    companies?.filter((company: any) =>
      company.companyName?.toLowerCase().includes(currentCompanyName.toLowerCase()),
    ) || [];
  const companyPickerCapped = (companies?.length ?? 0) >= CRM_PAGE_SIZE;

  // Fetch all company contacts via API endpoint
  const {
    data: contactsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      'api-contacts',
      tenantId,
      filters,
      searchQuery,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', pageSize.toString());
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      if (searchQuery && searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      if (filters.leadStatus && filters.leadStatus !== 'all') {
        params.append('status', filters.leadStatus);
      }
      if (filters.contactOwner && filters.contactOwner !== 'all') {
        params.append('ownerId', filters.contactOwner);
      }

      // Get auth token for Edge Function
      const token = await getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(getApiUrl(`/api/contacts?${params.toString()}`), {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.statusText}`);
      }

      const data = await response.json();

      // Transform snake_case to camelCase
      return {
        contacts: (data.contacts || []).map((c: any) => ({
          id: c.id,
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          email: c.email || '',
          phone: c.phone || '',
          title: c.title || '',
          companyId: c.companyId,
          companyName: c.companies?.business_name || getCompanyName(c.companyId) || '',
          leadStatus: c.leadStatus || 'new',
          lastContactDate: c.lastContactDate,
          nextFollowUpDate: c.nextFollowUpDate,
          createdAt: c.createdAt,
          ownerId: c.ownerId,
          ownerName: getUserName(c.ownerId),
          favoriteContentType: c.favoriteContentType,
          preferredChannels: c.preferredChannels,
          tenantId: c.tenantId,
          salutation: c.salutation,
          department: c.department,
          mobile: c.mobile,
          reportsTo: c.reportsTo,
          contactRoles: c.contactRoles,
          isPrimaryContact: c.isPrimaryContact,
          // leadSource / emailOptOut / doNotCall have NO column on
          // company_contacts — they read undefined on either backend. The
          // create form still collects them (PROD-008b note); the columns are
          // the missing half.
          leadSource: c.leadSource,
          emailOptOut: c.emailOptOut,
          doNotCall: c.doNotCall,
        })),
        total: data.total || 0,
        page: data.page || currentPage,
        limit: data.limit || pageSize,
      };
    },
    retry: 2,
    enabled: !!tenantId,
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      // Get auth token for Edge Function
      const token = await getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(getApiUrl(`/api/company-contacts/${contactId}`), {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to delete contact');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-contacts', tenantId] });
      toast({ title: 'Success', description: 'Contact deleted successfully' });
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to delete contact',
        variant: 'destructive',
      });
    },
  });

  const contacts: Contact[] = contactsData?.contacts || [];
  const totalContacts = contactsData?.total || 0;
  const totalPages = Math.ceil(totalContacts / pageSize);

  /**
   * The KPI cards, counted by the server over the whole book.
   *
   * These used to be computed HERE, over `contacts` - which is one PAGE, and
   * pageSize defaults to 25. So a tenant with 1,000 contacts read "Total 1,000"
   * beside "Active 18", "New This Month 3" and "Unassigned 7": three counts of
   * twenty-five rows under labels claiming the same scope as the total next to
   * them. Only the total was ever right.
   *
   * GET /contacts/stats answers all four as exact counts under the same
   * ownership scope the list uses. While it is loading, or if it fails, the
   * cards render an em dash rather than a number - a wrong KPI is worse than a
   * missing one.
   */
  const { data: kpiStats, isLoading: kpiLoading } = useQuery<{
    total: number;
    active: number;
    newThisMonth: number;
    unassigned: number;
    scope: 'own' | 'team';
  }>({
    queryKey: ['/api/contacts/stats', tenantId],
    enabled: !!tenantId,
    queryFn: async () => apiRequest('/api/contacts/stats', 'GET'),
    staleTime: 60_000,
  });

  const kpi = (value: number | undefined) =>
    kpiLoading || value === undefined ? '—' : value.toLocaleString('en-US');

  // Use the bulk selection hook
  const {
    selectedIds: selectedContacts,
    selectedCount,
    toggleSelection,
    toggleAll,
    selectAll,
    clearSelection,
    isSelected,
    isAllSelected,
  } = useBulkSelection(contacts);

  // Define bulk actions for the toolbar
  const bulkActions: BulkAction[] = [
    {
      id: 'email',
      label: 'Send Email',
      icon: Mail,
      onClick: (ids) => {
        toast({
          title: 'Email',
          description: `Preparing email for ${ids.length} contact(s)`,
        });
      },
    },
    {
      id: 'edit',
      label: 'Edit Properties',
      icon: Edit,
      onClick: (ids) => {
        toast({
          title: 'Edit',
          description: `Editing ${ids.length} contact(s)`,
        });
      },
    },
    {
      id: 'assign',
      label: 'Assign Owner',
      icon: User,
      onClick: (ids) => {
        toast({
          title: 'Assign',
          description: `Assigning owner to ${ids.length} contact(s)`,
        });
      },
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: async (ids) => {
        await Promise.all(ids.map((id) => deleteContactMutation.mutateAsync(id).catch(() => null)));
        queryClient.invalidateQueries({ queryKey: ['api-contacts', tenantId] });
      },
      variant: 'destructive',
      requiresConfirmation: true,
      confirmationTitle: 'Delete Contacts',
      confirmationDescription: `Are you sure you want to delete ${selectedCount} contact(s)? This action cannot be undone.`,
    },
  ];

  // Get unique values for filters
  const uniqueOwners = [
    ...new Set(contacts.map((c: Contact) => c.ownerName).filter((v): v is string => Boolean(v))),
  ];
  const uniqueStatuses = [
    ...new Set(contacts.map((c: Contact) => c.leadStatus).filter((v): v is string => Boolean(v))),
  ];

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const getStatusColor = (status: string | null | undefined) => {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'qualified':
        return 'bg-green-100 text-green-800';
      case 'unqualified':
        return 'bg-red-100 text-red-800';
      case 'customer':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleLogActivity = (contact: Contact) => {
    setSelectedContact(contact);
    setActivityForm({ type: 'note', notes: '', date: todayLocalDate(), followUpDays: 7 });
    setDialogs((prev) => ({ ...prev, logActivity: true }));
  };

  const logActivityMutation = useMutation({
    mutationFn: async ({ contact, form }: { contact: Contact; form: ContactActivityForm }) => {
      const { activity, contactPatch } = buildContactActivity(contact, form);
      await apiRequest(`/api/companies/${contact.companyId}/activities`, 'POST', activity);
      await apiRequest(`/api/company-contacts/${contact.id}`, 'PUT', contactPatch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-contacts', tenantId] });
      toast({ title: 'Activity logged' });
      setDialogs((prev) => ({ ...prev, logActivity: false }));
    },
    onError: (err) => {
      toast({
        title: 'Could not log activity',
        description: describeApiError(err).message,
        variant: 'destructive',
      });
    },
  });

  const handleViewContact = (contact: Contact) => {
    setSelectedContact(contact);
    setDialogs((prev) => ({ ...prev, contactDetails: true }));
  };

  const clearFilters = () => {
    setFilters({
      contactOwner: '',
      createDate: '',
      lastActivityDate: '',
      leadStatus: '',
      view: 'all',
    });
    setSearchQuery('');
  };

  if (isLoading) {
    return (
      <MainLayout title="Contacts" description="Manage your contacts and leads">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="mb-6">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <TableSkeleton rows={10} columns={5} />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Contacts" description="Manage your contacts and leads">
      <div className="space-y-4 sm:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi(kpiStats?.total)}</div>
              <p className="text-xs text-muted-foreground">All contacts in system</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi(kpiStats?.active)}</div>
              <p className="text-xs text-muted-foreground">Engaged contacts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New This Month</CardTitle>
              <UserPlus className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi(kpiStats?.newThisMonth)}</div>
              <p className="text-xs text-muted-foreground">Added this month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
              <UserX className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi(kpiStats?.unassigned)}</div>
              <p className="text-xs text-muted-foreground">Need an owner</p>
            </CardContent>
          </Card>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Contacts</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">{totalContacts} records</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* The list is paginated, so this exports the rows on screen and
                says so rather than implying all {totalContacts}. */}
            <Button
              variant="outline"
              size="sm"
              className="touch-manipulation active:scale-[0.98]"
              aria-label="Export this page of contacts"
              disabled={contacts.length === 0}
              onClick={() =>
                exportToCSV(contacts, CONTACTS_PAGE_EXPORT_COLUMNS, {
                  filename: 'contacts-page',
                })
              }
            >
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Export this page</span>
            </Button>
            {/* The CSV import wizard handles contacts (supabase/functions/import). */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="touch-manipulation active:scale-[0.98]"
            >
              <Link href="/import" aria-label="Import contacts">
                <Upload className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Import</span>
              </Link>
            </Button>
            <Dialog
              open={dialogs.createContact}
              onOpenChange={(open) => setDialogs((prev) => ({ ...prev, createContact: open }))}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 touch-manipulation active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create contact</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle>Create new contact</DialogTitle>
                </DialogHeader>
                <Form {...contactForm}>
                  <form
                    onSubmit={contactForm.handleSubmit(onSubmitContact)}
                    className="space-y-4 sm:space-y-6"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="salutation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Salutation</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select salutation" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Mr.">Mr.</SelectItem>
                                <SelectItem value="Mrs.">Mrs.</SelectItem>
                                <SelectItem value="Ms.">Ms.</SelectItem>
                                <SelectItem value="Dr.">Dr.</SelectItem>
                                <SelectItem value="Prof.">Prof.</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter first name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter last name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="Enter email address" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter phone number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="mobile"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter mobile number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job title</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter job title" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="sales">Sales</SelectItem>
                                <SelectItem value="marketing">Marketing</SelectItem>
                                <SelectItem value="finance">Finance</SelectItem>
                                <SelectItem value="operations">Operations</SelectItem>
                                <SelectItem value="hr">Human Resources</SelectItem>
                                <SelectItem value="it">IT</SelectItem>
                                <SelectItem value="purchasing">Purchasing</SelectItem>
                                <SelectItem value="management">Management</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="reportsTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reports To</FormLabel>
                            <FormControl>
                              <Input placeholder="Manager or supervisor" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company *</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input
                                  placeholder="Type company name..."
                                  {...field}
                                  value={field.value || ''}
                                  list="companies-datalist"
                                  autoComplete="off"
                                />
                              </FormControl>
                              <datalist id="companies-datalist">
                                {companies?.map((company: any) => (
                                  <option
                                    key={company.id}
                                    value={company.companyName || company.name}
                                  >
                                    {company.companyName || company.name} (
                                    {company.recordType || 'company'})
                                  </option>
                                ))}
                              </datalist>
                            </div>
                            {currentCompanyName &&
                              !filteredCompanies.some(
                                (c: any) =>
                                  (c.companyName || c.name)?.toLowerCase() ===
                                  currentCompanyName.toLowerCase(),
                              ) && (
                                <div className="text-xs text-blue-600 mt-1">
                                  New company &quot;{currentCompanyName}&quot; will be created as a
                                  lead
                                  {companyPickerCapped && (
                                    // The picker holds the first CRM_PAGE_SIZE
                                    // companies. Saying "will be created"
                                    // without this caveat is how an existing
                                    // company past that cap becomes a duplicate
                                    // record - the user is told it is new.
                                    <span className="mt-1 block text-amber-700">
                                      This list shows the first{' '}
                                      {CRM_PAGE_SIZE.toLocaleString('en-US')} companies, so check
                                      the company list before creating a duplicate.
                                    </span>
                                  )}
                                </div>
                              )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="isPrimaryContact"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-4">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Primary contact</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="leadStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lead status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="contacted">Contacted</SelectItem>
                                <SelectItem value="qualified">Qualified</SelectItem>
                                <SelectItem value="unqualified">Unqualified</SelectItem>
                                <SelectItem value="customer">Customer</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="leadSource"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lead Source</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select source" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="website">Website</SelectItem>
                                <SelectItem value="referral">Referral</SelectItem>
                                <SelectItem value="cold_call">Cold Call</SelectItem>
                                <SelectItem value="email_campaign">Email Campaign</SelectItem>
                                <SelectItem value="trade_show">Trade Show</SelectItem>
                                <SelectItem value="social_media">Social Media</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Communication Preferences */}
                    <div className="space-y-3">
                      <FormLabel className="text-base font-medium">
                        Communication Preferences
                      </FormLabel>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={contactForm.control}
                          name="emailOptOut"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Email Opt-Out</FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={contactForm.control}
                          name="doNotCall"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Do Not Call</FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 flex-col sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setDialogs((prev) => ({
                            ...prev,
                            createContact: false,
                          }))
                        }
                        className="min-h-[44px] touch-manipulation active:scale-[0.98] order-2 sm:order-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="bg-orange-500 hover:bg-orange-600 min-h-[44px] touch-manipulation active:scale-[0.98] order-1 sm:order-2"
                        disabled={createContactMutation.isPending}
                      >
                        {createContactMutation.isPending ? 'Creating...' : 'Create contact'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* New Company Confirmation Dialog */}
            <Dialog open={showNewCompanyConfirm} onOpenChange={setShowNewCompanyConfirm}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Company</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    The company "
                    <span className="font-semibold">{pendingContactData?.companyName}</span>"
                    doesn't exist in your database.
                  </p>
                  <p className="text-sm text-gray-600">
                    Would you like to create this company as a new lead? The contact will be added
                    to this new company.
                  </p>
                  <div className="flex justify-end gap-3 pt-4 flex-col sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelNewCompany}
                      className="min-h-[44px] touch-manipulation active:scale-[0.98] order-2 sm:order-1"
                    >
                      No, let me select a different company
                    </Button>
                    <Button
                      onClick={handleCreateNewCompany}
                      className="bg-orange-500 hover:bg-orange-600 min-h-[44px] touch-manipulation active:scale-[0.98] order-1 sm:order-2"
                      disabled={createCompanyMutation.isPending || createContactMutation.isPending}
                    >
                      {createCompanyMutation.isPending || createContactMutation.isPending
                        ? 'Creating...'
                        : 'Yes, create company'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters and Views */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={filters.view === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="touch-manipulation active:scale-[0.98]"
                    onClick={() => setFilters((prev) => ({ ...prev, view: 'all' }))}
                  >
                    All contacts
                  </Button>
                  <Button
                    variant={filters.view === 'my' ? 'default' : 'outline'}
                    size="sm"
                    className="touch-manipulation active:scale-[0.98]"
                    onClick={() => setFilters((prev) => ({ ...prev, view: 'my' }))}
                  >
                    My contacts
                  </Button>
                  <Button
                    variant={filters.view === 'unassigned' ? 'default' : 'outline'}
                    size="sm"
                    className="touch-manipulation active:scale-[0.98]"
                    onClick={() => setFilters((prev) => ({ ...prev, view: 'unassigned' }))}
                  >
                    Unassigned
                  </Button>
                </div>
              </div>
              <div className="text-sm text-gray-500 hidden sm:block">All Views</div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    aria-label="Search name, phone, email"
                    placeholder="Search name, phone, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Select
                  value={filters.contactOwner}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, contactOwner: value }))
                  }
                >
                  <SelectTrigger className="w-40 min-h-[44px] touch-manipulation">
                    <SelectValue placeholder="Contact owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All owners</SelectItem>
                    {uniqueOwners.map((owner) => (
                      <SelectItem key={owner} value={owner}>
                        {owner}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.leadStatus}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, leadStatus: value }))}
                >
                  <SelectTrigger className="w-40 min-h-[44px] touch-manipulation">
                    <SelectValue placeholder="Lead status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {uniqueStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  <Filter className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Advanced filters</span>
                  <span className="sm:hidden">Filters</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                  onClick={clearFilters}
                >
                  <span className="hidden sm:inline">Clear filters</span>
                  <span className="sm:hidden">Clear</span>
                </Button>

                <Button
                  aria-label="Settings"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Create date</Label>
                    <Select
                      value={filters.createDate}
                      onValueChange={(value) =>
                        setFilters((prev) => ({ ...prev, createDate: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anytime">Any time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="last7days">Last 7 days</SelectItem>
                        <SelectItem value="last30days">Last 30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Last activity date</Label>
                    <Select
                      value={filters.lastActivityDate}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          lastActivityDate: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anytime">Any time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="last7days">Last 7 days</SelectItem>
                        <SelectItem value="last30days">Last 30 days</SelectItem>
                        <SelectItem value="never">Never contacted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Next follow-up</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anytime">Any time</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="tomorrow">Tomorrow</SelectItem>
                        <SelectItem value="thisweek">This week</SelectItem>
                        <SelectItem value="nextweek">Next week</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Quality Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Data Quality</p>
                <p className="text-sm text-blue-700">
                  Your contact data quality is good. 95% of contacts have complete information.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-100 flex-shrink-0"
            >
              <span className="hidden sm:inline">Improve data quality</span>
              <span className="sm:hidden">Improve</span>
            </Button>
          </div>
        </div>

        {/* Bulk Operations Toolbar */}
        <BulkOperationsToolbar
          selectedCount={selectedCount}
          totalCount={totalContacts}
          onClearSelection={clearSelection}
          onSelectAll={selectAll}
          actions={bulkActions}
          selectedIds={selectedContacts}
        />

        {/* Error Display */}
        {error && (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <h3 className="font-medium text-red-900">Error Loading Contacts</h3>
                  <p className="text-sm text-red-700 mt-1">
                    {error.message || 'Failed to load contacts. Please try again.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contacts Table */}
        <Card>
          <CardContent className="p-0">
            {contacts.length === 0 && !isLoading && !error ? (
              <EmptyState
                icon={Users}
                title="No contacts found"
                description={
                  searchQuery || Object.values(filters).some((f) => f && f !== 'all')
                    ? 'No contacts match your current search and filters.'
                    : "You haven't added any contacts yet. Create your first contact to get started."
                }
                type={
                  searchQuery || Object.values(filters).some((f) => f && f !== 'all')
                    ? 'search'
                    : 'default'
                }
                action={{
                  label:
                    searchQuery || Object.values(filters).some((f) => f && f !== 'all')
                      ? 'Clear filters'
                      : 'Create your first contact',
                  onClick: () => {
                    if (searchQuery || Object.values(filters).some((f) => f && f !== 'all')) {
                      clearFilters();
                    } else {
                      setDialogs((prev) => ({ ...prev, createContact: true }));
                    }
                  },
                  icon:
                    searchQuery || Object.values(filters).some((f) => f && f !== 'all')
                      ? Filter
                      : Plus,
                }}
                secondaryAction={
                  searchQuery || Object.values(filters).some((f) => f && f !== 'all')
                    ? {
                        label: 'Create contact',
                        onClick: () => setDialogs((prev) => ({ ...prev, createContact: true })),
                        variant: 'outline',
                        icon: Plus,
                      }
                    : undefined
                }
                suggestions={
                  searchQuery || Object.values(filters).some((f) => f && f !== 'all')
                    ? [
                        'Check for typos in your search',
                        'Try broader search terms',
                        'Remove some filters',
                      ]
                    : undefined
                }
              />
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-4 w-12">
                          <Checkbox checked={isAllSelected} onCheckedChange={toggleAll} />
                        </th>
                        <th className="text-left p-4 font-medium text-gray-700">NAME</th>
                        <th className="text-left p-4 font-medium text-gray-700">EMAIL</th>
                        <th className="text-left p-4 font-medium text-gray-700">PHONE</th>
                        <th className="text-left p-4 font-medium text-gray-700">STATUS</th>
                        <th className="text-left p-4 font-medium text-gray-700">COMPANY</th>
                        <th className="text-left p-4 font-medium text-gray-700">CREATED</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact: Contact) => (
                        <tr key={contact.id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            <Checkbox
                              checked={isSelected(contact.id)}
                              onCheckedChange={() => toggleSelection(contact.id)}
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-blue-100 text-blue-600 text-sm">
                                  {contact.firstName?.charAt(0) || 'C'}
                                  {contact.lastName?.charAt(0) || 'C'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <button
                                  className="font-semibold text-blue-600 hover:text-blue-800 text-left"
                                  onClick={() => handleViewContact(contact)}
                                >
                                  {contact.firstName || ''} {contact.lastName}
                                </button>
                                <p className="text-xs text-gray-500">
                                  {contact.companyName || getCompanyName(contact.companyId)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            {contact.email ? (
                              <a
                                href={`mailto:${contact.email}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                              >
                                {contact.email}
                              </a>
                            ) : (
                              <span className="text-gray-400">--</span>
                            )}
                          </td>
                          <td className="p-4">
                            {contact.phone ? (
                              <a
                                href={`tel:${contact.phone}`}
                                className="text-gray-900 hover:text-blue-600 text-sm"
                              >
                                {contact.phone}
                              </a>
                            ) : (
                              <span className="text-gray-400">--</span>
                            )}
                          </td>
                          <td className="p-4">
                            <Badge className={`${getStatusColor(contact.leadStatus)} border-0`}>
                              {contact.leadStatus || 'New'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-900 text-sm">
                                {contact.companyName || getCompanyName(contact.companyId)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-gray-500">
                            {relativeDate(contact.createdAt)}
                          </td>

                          <td className="p-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button aria-label="More options" variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewContact(contact)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View contact
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleLogActivity(contact)}>
                                  <Activity className="w-4 h-4 mr-2" />
                                  Log activity
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Mail className="w-4 h-4 mr-2" />
                                  Send email
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Phone className="w-4 h-4 mr-2" />
                                  Log call
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Calendar className="w-4 h-4 mr-2" />
                                  Schedule meeting
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit contact
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: `Delete ${contact.firstName || ''} ${contact.lastName}?`,
                                      description: 'This cannot be undone.',
                                    });
                                    if (!ok) return;
                                    deleteContactMutation.mutate(contact.id);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete contact
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Layout */}
                <div className="lg:hidden space-y-3 p-4">
                  {contacts.map((contact: Contact) => (
                    <div
                      key={contact.id}
                      className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4 gap-3">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <Checkbox
                            checked={isSelected(contact.id)}
                            onCheckedChange={() => toggleSelection(contact.id)}
                            className="min-w-[24px] min-h-[24px] touch-manipulation"
                          />
                          <Avatar className="h-12 w-12 flex-shrink-0">
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {contact.firstName?.charAt(0) || 'C'}
                              {contact.lastName?.charAt(0) || 'C'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <button
                              className="font-semibold text-blue-600 hover:text-blue-800 text-left truncate w-full min-h-[44px] flex items-center touch-manipulation active:scale-[0.98]"
                              onClick={() => handleViewContact(contact)}
                            >
                              {contact.firstName || ''} {contact.lastName}
                            </button>
                            <p className="text-sm text-gray-500 truncate -mt-2">
                              {contact.title || 'No title'}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label="More options"
                              variant="ghost"
                              size="sm"
                              className="min-w-[44px] min-h-[44px] touch-manipulation active:scale-[0.98]"
                            >
                              <MoreHorizontal className="w-5 h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => handleViewContact(contact)}
                              className="min-h-[44px] touch-manipulation"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleLogActivity(contact)}
                              className="min-h-[44px] touch-manipulation"
                            >
                              <Activity className="w-4 h-4 mr-2" />
                              Log activity
                            </DropdownMenuItem>
                            <DropdownMenuItem className="min-h-[44px] touch-manipulation">
                              <Mail className="w-4 h-4 mr-2" />
                              Email
                            </DropdownMenuItem>
                            <DropdownMenuItem className="min-h-[44px] touch-manipulation">
                              <Phone className="w-4 h-4 mr-2" />
                              Call
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between min-h-[32px]">
                          <span className="text-sm font-medium text-gray-600">Status</span>
                          <Badge className={`${getStatusColor(contact.leadStatus)} border-0`}>
                            {contact.leadStatus || 'New'}
                          </Badge>
                        </div>

                        {contact.email && (
                          <div className="flex items-center justify-between min-h-[32px] gap-2">
                            <span className="text-sm font-medium text-gray-600 flex-shrink-0">
                              Email
                            </span>
                            <a
                              href={`mailto:${contact.email}`}
                              className="text-sm text-blue-600 truncate"
                            >
                              {contact.email}
                            </a>
                          </div>
                        )}

                        {contact.phone && (
                          <div className="flex items-center justify-between min-h-[32px]">
                            <span className="text-sm font-medium text-gray-600">Phone</span>
                            <a href={`tel:${contact.phone}`} className="text-sm text-blue-600">
                              {contact.phone}
                            </a>
                          </div>
                        )}

                        <div className="flex items-center justify-between min-h-[32px] gap-2">
                          <span className="text-sm font-medium text-gray-600 flex-shrink-0">
                            Company
                          </span>
                          <span className="text-sm text-gray-900 truncate">
                            {getCompanyName(contact.companyId) || 'No company'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Rows per page:</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => setPageSize(Number(value))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">
                  {(currentPage - 1) * pageSize + 1}-
                  {Math.min(currentPage * pageSize, totalContacts)} of {totalContacts}
                </span>
                <div className="flex space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Log Activity Dialog */}
        <Dialog
          open={dialogs.logActivity}
          onOpenChange={(open) => setDialogs((prev) => ({ ...prev, logActivity: open }))}
        >
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>
                Log activity for {selectedContact?.firstName} {selectedContact?.lastName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 sm:space-y-6">
              <div className="flex gap-2 flex-wrap" role="group" aria-label="Activity type">
                {ACTIVITY_TYPES.map((type) => {
                  const Icon = { note: FileText, email: Mail, call: Phone, meeting: Calendar }[
                    type
                  ];
                  return (
                    <Button
                      key={type}
                      type="button"
                      size="sm"
                      variant={activityForm.type === type ? 'default' : 'outline'}
                      aria-pressed={activityForm.type === type}
                      onClick={() => setActivityForm((f) => ({ ...f, type }))}
                      className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {ACTIVITY_LABELS[type]}
                    </Button>
                  );
                })}
              </div>

              <div>
                <Label htmlFor="activity-notes">Activity notes</Label>
                <Textarea
                  id="activity-notes"
                  placeholder="What did you discuss? What are the next steps?"
                  className="mt-1 min-h-[120px]"
                  value={activityForm.notes}
                  onChange={(e) => setActivityForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="activity-date">Activity date</Label>
                  <Input
                    id="activity-date"
                    type="date"
                    value={activityForm.date}
                    onChange={(e) => setActivityForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Follow-up in</Label>
                  <Select
                    value={String(activityForm.followUpDays)}
                    onValueChange={(v) =>
                      setActivityForm((f) => ({ ...f, followUpDays: Number(v) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No follow-up</SelectItem>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">1 week</SelectItem>
                      <SelectItem value="14">2 weeks</SelectItem>
                      <SelectItem value="30">1 month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 flex-col sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => setDialogs((prev) => ({ ...prev, logActivity: false }))}
                  className="min-h-[44px] touch-manipulation active:scale-[0.98] order-2 sm:order-1"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 min-h-[44px] touch-manipulation active:scale-[0.98] order-1 sm:order-2"
                  disabled={
                    !selectedContact?.companyId ||
                    !activityForm.date ||
                    logActivityMutation.isPending
                  }
                  onClick={() =>
                    selectedContact &&
                    logActivityMutation.mutate({ contact: selectedContact, form: activityForm })
                  }
                >
                  {logActivityMutation.isPending ? 'Saving...' : 'Log activity'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Contact Details Dialog */}
        <Dialog
          open={dialogs.contactDetails}
          onOpenChange={(open) => setDialogs((prev) => ({ ...prev, contactDetails: open }))}
        >
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Contact Details</DialogTitle>
            </DialogHeader>
            {selectedContact && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xl">
                      {selectedContact.firstName?.charAt(0)}
                      {selectedContact.lastName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">
                      {selectedContact.firstName} {selectedContact.lastName}
                    </h3>
                    <p className="text-gray-600">{selectedContact.title}</p>
                    <Badge
                      className={`${getStatusColor(selectedContact.leadStatus)} border-0 mt-1`}
                    >
                      {selectedContact.leadStatus || 'New'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Email</Label>
                      {selectedContact.email ? (
                        <a
                          href={`mailto:${selectedContact.email}`}
                          className="text-blue-600 hover:underline block"
                        >
                          {selectedContact.email}
                        </a>
                      ) : (
                        <p className="text-gray-400">Not provided</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Phone</Label>
                      {selectedContact.phone ? (
                        <a
                          href={`tel:${selectedContact.phone}`}
                          className="text-gray-900 hover:text-blue-600 block"
                        >
                          {selectedContact.phone}
                        </a>
                      ) : (
                        <p className="text-gray-400">Not provided</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Company</Label>
                      <p className="text-gray-900">
                        {selectedContact.companyName || 'Not provided'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Owner</Label>
                      <p className="text-gray-900">{selectedContact.ownerName || 'Unassigned'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Last Activity</Label>
                      <p className="text-gray-900">
                        {relativeDate(selectedContact.lastContactDate)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Next Follow-up</Label>
                      <p className="text-gray-900">
                        {relativeDate(selectedContact.nextFollowUpDate)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 flex-col sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={() => setDialogs((prev) => ({ ...prev, contactDetails: false }))}
                    className="min-h-[44px] touch-manipulation active:scale-[0.98] order-2 sm:order-1"
                  >
                    Close
                  </Button>
                  <Button className="min-h-[44px] touch-manipulation active:scale-[0.98] order-1 sm:order-2">
                    Edit Contact
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Mobile FAB */}
        <MobileFAB
          onClick={() => setDialogs((prev) => ({ ...prev, createContact: true }))}
          label="Add Contact"
        />
      </div>
    </MainLayout>
  );
}
