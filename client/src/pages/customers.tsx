import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BulkOperationsToolbar,
  useBulkSelection,
  BulkAction,
} from "@/components/ui/bulk-operations-toolbar";
import {
  exportToCSV,
  exportToJSON,
  createExportColumn,
} from "@/lib/export-utils";
import { SavedFilters, useFilterState } from "@/components/ui/saved-filters";
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  Users,
  Eye,
  Phone,
  Mail,
  MapPin,
  LayoutGrid,
  Rows,
  Download,
  FileText,
  Trash2,
  UserCheck,
  TrendingUp,
  DollarSign,
  Upload,
} from "lucide-react";
import { CsvImportWizard } from "@/components/import";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Customer form validation schema
const customerSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  website: z.string().url('Invalid URL format').optional().or(z.literal('')),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  primaryContactName: z.string().min(2, 'Contact name must be at least 2 characters'),
  primaryContactTitle: z.string().optional(),
  primaryContactEmail: z.string().email('Invalid email format'),
  primaryContactPhone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, 'Use 2-letter state code').optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  customerTier: z.string().optional(),
  assignedSalesRep: z.string().optional(),
  leadSource: z.string().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
  estimatedDealValue: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  probability: z.string().optional(),
});

export default function Customers() {
  const { isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  // Tab state for record type filtering - read from URL query param if present
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const tabFromUrl = urlParams.get('tab') || 'all';
  const [selectedTab, setSelectedTab] = useState<string>(tabFromUrl);

  // Filter state management
  const filterState = useFilterState({
    searchTerm: '',
    industryFilter: 'all',
    stateFilter: 'all',
    statusFilter: 'all',
    sourceFilter: 'all',
    priorityFilter: 'all',
  });

  const { searchTerm, industryFilter, stateFilter, statusFilter, sourceFilter, priorityFilter } = filterState.filters;

  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "cards" : "table";
    }
    return "cards";
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const form = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      companyName: "",
      website: "",
      industry: "",
      companySize: "",
      primaryContactName: "",
      primaryContactTitle: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      priority: "medium",
      customerTier: "",
      assignedSalesRep: "",
      leadSource: "",
      tags: "",
      notes: "",
      estimatedDealValue: "",
      expectedCloseDate: "",
      probability: "",
    }
  });
  const queryClient = useQueryClient();

  const updateCustomerMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/customers/${data.id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsEditDialogOpen(false);
      setEditingCustomer(null);
      form.reset();
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/customers', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsEditDialogOpen(false);
      setIsCreating(false);
      form.reset();
    },
  });

  const onSubmit = (data: any) => {
    if (isCreating) {
      createCustomerMutation.mutate(data);
    } else {
      updateCustomerMutation.mutate({ ...data, id: editingCustomer?.id });
    }
  };

  const handleAddCustomer = () => {
    setIsCreating(true);
    setEditingCustomer(null);
    form.reset();
    setIsEditDialogOpen(true);
  };

  // Sync tab with URL parameter
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1]);
    const tab = params.get('tab') || 'all';
    if (tab !== selectedTab) {
      setSelectedTab(tab);
    }
  }, [location]);

  useEffect(() => {
    const handler = () => {
      if (window.innerWidth < 768 && viewMode === "table") {
        setViewMode("cards");
      }
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [viewMode]);

  // Fetch customers from unified business_records view
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["/api/customers"],
    enabled: isAuthenticated,
  });

  // Optional companies for enrichment
  const { data: companies = [] } = useQuery({
    queryKey: ["/api/companies"],
    enabled: isAuthenticated,
  });

  const enriched = useMemo(() => {
    return (customers as any[]).map((c) => {
      const company = (companies as any[]).find(
        (co) => co.id === (c.companyId || c.company_id)
      );
      // Prefer snake_case from business_records: company_name
      const companyName =
        c.company_name ||
        c.companyName ||
        company?.businessName ||
        company?.name ||
        `Customer ${String(c.id).slice(0, 8)}`;
      const city = c.city || company?.city || "";
      const state = c.state || company?.state || "";
      return {
        ...c,
        companyName,
        city,
        state,
        phone: c.phone || company?.phone || "",
        website: c.website || company?.website || "",
        industry: c.industry || company?.industry || "",
      };
    });
  }, [customers, companies]);

  const filtered = useMemo(() => {
    return enriched.filter((r: any) => {
      // Tab filter (record type)
      const recordType = r.recordType || (r.status === 'active' || r.status === 'inactive' ? 'customer' : 'lead');
      const status = r.status || 'new';

      let matchesTab = true;
      if (selectedTab === 'leads') {
        matchesTab = recordType === 'lead' || ['new', 'contacted', 'qualified', 'proposal_sent'].includes(status);
      } else if (selectedTab === 'prospects') {
        matchesTab = status === 'qualified' || status === 'proposal_sent';
      } else if (selectedTab === 'customers') {
        matchesTab = recordType === 'customer' || status === 'active' || status === 'inactive';
      } else if (selectedTab === 'active') {
        matchesTab = status === 'active';
      } else if (selectedTab === 'inactive') {
        matchesTab = status === 'inactive';
      }

      // Search filter
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term || [
        r.companyName,
        r.primaryContactName,
        r.primaryContactEmail,
        r.industry,
        r.city,
        r.state,
      ]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(term));

      // Industry filter
      const matchesIndustry = industryFilter === 'all' || r.industry === industryFilter;

      // State filter
      const matchesState = stateFilter === 'all' || r.state === stateFilter;

      // Status filter
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

      // Source filter
      const matchesSource = sourceFilter === 'all' || r.leadSource === sourceFilter || r.source === sourceFilter;

      // Priority filter
      const matchesPriority = priorityFilter === 'all' || r.priority === priorityFilter;

      return matchesTab && matchesSearch && matchesIndustry && matchesState && matchesStatus && matchesSource && matchesPriority;
    });
  }, [enriched, selectedTab, searchTerm, industryFilter, stateFilter, statusFilter, sourceFilter, priorityFilter]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalLeads = enriched.filter((r: any) => {
      const recordType = r.recordType || (r.status === 'active' || r.status === 'inactive' ? 'customer' : 'lead');
      const status = r.status || 'new';
      return recordType === 'lead' || ['new', 'contacted', 'qualified', 'proposal_sent'].includes(status);
    }).length;

    const totalCustomers = enriched.filter((r: any) => {
      const recordType = r.recordType || (r.status === 'active' || r.status === 'inactive' ? 'customer' : 'lead');
      const status = r.status || 'new';
      return recordType === 'customer' || status === 'active' || status === 'inactive';
    }).length;

    const activeCustomers = enriched.filter((r: any) => r.status === 'active').length;

    const qualifiedLeads = enriched.filter((r: any) => r.status === 'qualified' || r.status === 'proposal_sent').length;

    const pipelineValue = enriched.reduce((sum: number, r: any) => {
      const value = parseFloat(r.estimatedDealValue || r.estimatedAmount || '0');
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

    return { totalLeads, totalCustomers, activeCustomers, qualifiedLeads, pipelineValue };
  }, [enriched]);

  // Get unique values for filter dropdowns
  const uniqueIndustries = useMemo(() => {
    const industries = new Set(
      enriched.map((c: any) => c.industry).filter(Boolean)
    );
    return Array.from(industries).sort();
  }, [enriched]);

  const uniqueStates = useMemo(() => {
    const states = new Set(
      enriched.map((c: any) => c.state).filter(Boolean)
    );
    return Array.from(states).sort();
  }, [enriched]);

  const uniqueSources = useMemo(() => {
    const sources = new Set(
      enriched.map((c: any) => c.leadSource || c.source).filter(Boolean)
    );
    return Array.from(sources).sort();
  }, [enriched]);

  // Bulk selection
  const bulkSelection = useBulkSelection(filtered);

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (customerIds: string[]) => {
      await Promise.all(
        customerIds.map(id => apiRequest(`/api/customers/${id}`, 'DELETE'))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      bulkSelection.clearSelection();
      toast({
        title: 'Success',
        description: `${bulkSelection.selectedCount} customer(s) deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete some customers',
        variant: 'destructive',
      });
    },
  });

  // Bulk export function
  const handleBulkExport = (format: 'csv' | 'json') => {
    const selectedCustomers = filtered.filter((c: any) =>
      bulkSelection.selectedIds.includes(c.id)
    );

    const columns = [
      createExportColumn('companyName', 'Company Name'),
      createExportColumn('industry', 'Industry'),
      createExportColumn('city', 'City'),
      createExportColumn('state', 'State'),
      createExportColumn('phone', 'Phone'),
      createExportColumn('website', 'Website'),
      createExportColumn('primaryContactName', 'Primary Contact'),
      createExportColumn('primaryContactEmail', 'Contact Email'),
      createExportColumn('primaryContactPhone', 'Contact Phone'),
    ];

    if (format === 'csv') {
      exportToCSV(selectedCustomers, columns, { filename: 'customers-export' });
    } else {
      exportToJSON(selectedCustomers, columns, { filename: 'customers-export' });
    }

    toast({
      title: 'Export Complete',
      description: `${selectedCustomers.length} customer(s) exported successfully`,
    });
  };

  // Bulk actions configuration
  const bulkActions: BulkAction[] = [
    {
      id: 'export-csv',
      label: 'Export CSV',
      icon: Download,
      onClick: () => handleBulkExport('csv'),
    },
    {
      id: 'export-json',
      label: 'Export JSON',
      icon: FileText,
      onClick: () => handleBulkExport('json'),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: (ids) => bulkDeleteMutation.mutate(ids),
      variant: 'destructive',
      requiresConfirmation: true,
      confirmationTitle: 'Delete Customers',
      confirmationDescription: `Are you sure you want to delete ${bulkSelection.selectedCount} customer(s)? This action cannot be undone.`,
    },
  ];

  return (
    <MainLayout
      title="Customers & CRM"
      description="Manage your customer relationships, leads, and business records"
    >
      <div className="space-y-4 sm:space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalLeads}</div>
              <p className="text-xs text-muted-foreground">
                In pipeline
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.activeCustomers}</div>
              <p className="text-xs text-muted-foreground">
                Currently active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Qualified Leads</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.qualifiedLeads}</div>
              <p className="text-xs text-muted-foreground">
                Ready to close
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${kpis.pipelineValue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Total estimated
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search customers by name, email, industry, location..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => filterState.updateFilter('searchTerm', e.target.value)}
                />
              </div>

              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                {/* Industry Filter */}
                {uniqueIndustries.length > 0 && (
                  <Select
                    value={industryFilter}
                    onValueChange={(value) => filterState.updateFilter('industryFilter', value)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Industries</SelectItem>
                      {uniqueIndustries.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* State Filter */}
                {uniqueStates.length > 0 && (
                  <Select
                    value={stateFilter}
                    onValueChange={(value) => filterState.updateFilter('stateFilter', value)}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All States</SelectItem>
                      {uniqueStates.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Source Filter */}
                {uniqueSources.length > 0 && (
                  <Select
                    value={sourceFilter}
                    onValueChange={(value) => filterState.updateFilter('sourceFilter', value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {uniqueSources.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Priority Filter */}
                <Select
                  value={priorityFilter}
                  onValueChange={(value) => filterState.updateFilter('priorityFilter', value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                {/* Saved Filters */}
                <SavedFilters
                  storageKey="customers.savedFilters"
                  currentFilters={filterState.filters}
                  onApplyFilter={filterState.applyFilters}
                  onClearFilters={filterState.clearFilters}
                  activeFilterCount={filterState.activeFilterCount}
                  getFilterDescription={(filters) => {
                    const parts: string[] = [];
                    if (filters.searchTerm) parts.push(`Search: "${filters.searchTerm}"`);
                    if (filters.industryFilter !== 'all') parts.push(`Industry: ${filters.industryFilter}`);
                    if (filters.stateFilter !== 'all') parts.push(`State: ${filters.stateFilter}`);
                    if (filters.sourceFilter !== 'all') parts.push(`Source: ${filters.sourceFilter}`);
                    if (filters.priorityFilter !== 'all') parts.push(`Priority: ${filters.priorityFilter}`);
                    return parts.length > 0 ? parts.join(' • ') : 'No filters applied';
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Record Type */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="all">All Records</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="prospects">Prospects</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="space-y-4 sm:space-y-6">
            {/* View Controls */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {filtered.length > 0 && (
                  <Badge variant="secondary">
                    {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "cards" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("cards")}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("table")}
                  title="Table view"
                >
                  <Rows className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="default"
                  className="flex items-center gap-2"
                  onClick={() => setIsImportDialogOpen(true)}
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
                <Button
                  size="default"
                  className="flex items-center gap-2"
                  onClick={handleAddCustomer}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Customer</span>
                </Button>
              </div>
            </div>

        {/* Bulk Operations Toolbar */}
        <BulkOperationsToolbar
          selectedCount={bulkSelection.selectedCount}
          totalCount={filtered.length}
          onClearSelection={bulkSelection.clearSelection}
          onSelectAll={bulkSelection.selectAll}
          selectedIds={bulkSelection.selectedIds}
          actions={bulkActions}
        />

        {customersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 sm:p-6">
                  <div className="h-4 bg-muted rounded mb-2" />
                  <div className="h-3 bg-muted rounded mb-4 w-2/3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          viewMode === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filtered.map((customer: any) => {
                const displayName = customer.companyName as string;
                const subtitle = [
                  customer.industry,
                  [customer.city, customer.state].filter(Boolean).join(", "),
                ]
                  .filter(Boolean)
                  .join(" • ");

                return (
                  <Card
                    key={customer.id}
                    className="hover:shadow-md transition-shadow touch-manipulation"
                  >
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-semibold text-sm sm:text-base">
                              {displayName?.charAt(0)?.toUpperCase() || "C"}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                              {displayName}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                              {subtitle || "Customer"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {customer.phone && (
                          <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                            <Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                            <span className="truncate">{customer.phone}</span>
                          </p>
                        )}
                        {customer.website && (
                          <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                            <Mail className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                            <span className="truncate">{customer.website}</span>
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full flex items-center gap-2 min-h-11 sm:h-9"
                          onClick={() => navigate(`/customers/${customer.urlSlug || customer.url_slug || customer.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="bg-background rounded-md border">
              <UITable>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={bulkSelection.isAllSelected}
                        onCheckedChange={bulkSelection.toggleAll}
                        aria-label="Select all customers"
                      />
                    </TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row: any) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/customers/${row.urlSlug || row.url_slug || row.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={bulkSelection.isSelected(row.id)}
                          onCheckedChange={() => bulkSelection.toggleSelection(row.id)}
                          aria-label={`Select ${row.companyName}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.companyName}
                      </TableCell>
                      <TableCell>{row.industry || "—"}</TableCell>
                      <TableCell>
                        {[row.city, row.state].filter(Boolean).join(", ") ||
                          "—"}
                      </TableCell>
                      <TableCell>{row.phone || "—"}</TableCell>
                      <TableCell className="truncate max-w-[260px]">
                        {row.website || "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/customers/${row.urlSlug || row.url_slug || row.id}`);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </UITable>
            </div>
          )
        ) : (
          <Card>
            <CardContent className="py-8 sm:py-12">
              <EmptyState
                icon={Users}
                title={
                  searchTerm || industryFilter !== 'all' || stateFilter !== 'all'
                    ? 'No customers match your filters'
                    : 'No customers yet'
                }
                description={
                  searchTerm || industryFilter !== 'all' || stateFilter !== 'all'
                    ? 'Try adjusting your search criteria or filters to find what you\'re looking for'
                    : 'Start building your customer base by adding your first customer'
                }
                type={searchTerm || industryFilter !== 'all' || stateFilter !== 'all' ? 'filter' : 'default'}
                action={{
                  label: 'Add Customer',
                  onClick: handleAddCustomer,
                  icon: Plus,
                }}
                secondaryAction={
                  searchTerm || industryFilter !== 'all' || stateFilter !== 'all'
                    ? {
                        label: 'Clear Filters',
                        onClick: filterState.clearFilters,
                        variant: 'outline',
                      }
                    : undefined
                }
                suggestions={
                  customers.length === 0 && !searchTerm
                    ? [
                        'Customers are the foundation of your business relationships',
                        'Track contacts, deals, and service history in one place',
                        'Export customer data anytime for reporting',
                      ]
                    : undefined
                }
              />
            </CardContent>
          </Card>
        )}
          </TabsContent>
        </Tabs>

        {/* Edit Customer Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isCreating ? "Create New Customer" : "Edit Customer"}</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Company Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Company Information</h3>
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
                            <Input placeholder="Technology, Healthcare, etc." {...field} />
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
                          <Select onValueChange={field.onChange} value={field.value}>
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

                {/* Primary Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Primary Contact</h3>
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
                      name="primaryContactTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title</FormLabel>
                          <FormControl>
                            <Input placeholder="CEO, Manager, etc." {...field} />
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
                          <FormLabel>Email *</FormLabel>
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
                          <FormLabel>Phone *</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="addressLine1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main Street" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="addressLine2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 2</FormLabel>
                          <FormControl>
                            <Input placeholder="Suite 100" {...field} />
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
                    
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="US" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Customer Management */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Customer Management</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      name="customerTier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Tier</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
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
                      name="assignedSalesRep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned Sales Rep</FormLabel>
                          <FormControl>
                            <Input placeholder="Sales rep name or ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Notes and Tags */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <FormControl>
                          <Input placeholder="enterprise, vip, tech-forward (comma-separated)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional notes about this customer..."
                            className="min-h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingCustomer(null);
                      setIsCreating(false);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateCustomerMutation.isPending || createCustomerMutation.isPending}
                  >
                    {updateCustomerMutation.isPending || createCustomerMutation.isPending
                      ? (isCreating ? "Creating..." : "Updating...")
                      : (isCreating ? "Create Customer" : "Update Customer")}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* CSV Import Wizard */}
        <CsvImportWizard
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          defaultEntityType="business_records"
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/business-records"] });
            toast({
              title: "Import Complete",
              description: "Customers have been imported successfully.",
            });
          }}
        />
      </div>
    </MainLayout>
  );
}
