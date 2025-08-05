import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import { useLocation } from "wouter";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-green-100 text-green-800",
  proposal: "bg-purple-100 text-purple-800",
  negotiation: "bg-orange-100 text-orange-800",
  closed_won: "bg-green-100 text-green-800",
  closed_lost: "bg-red-100 text-red-800",
};

const priorityColors = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

// Available table columns with HubSpot-style configuration
const AVAILABLE_COLUMNS: TableColumn[] = [
  {
    id: "lead",
    label: "Lead name",
    icon: User,
    width: "min-w-[250px]",
    sortable: true,
  },
  {
    id: "company",
    label: "Company name",
    icon: Building2,
    width: "min-w-[200px]",
    sortable: true,
  },
  {
    id: "status",
    label: "Lead status",
    icon: Target,
    width: "min-w-[120px]",
    sortable: true,
  },
  {
    id: "priority",
    label: "Priority",
    icon: TrendingUp,
    width: "min-w-[100px]",
    sortable: true,
  },
  {
    id: "source",
    label: "Lead source",
    icon: MapPin,
    width: "min-w-[120px]",
    sortable: true,
  },
  {
    id: "industry",
    label: "Industry",
    icon: Building2,
    width: "min-w-[120px]",
    sortable: true,
  },
  {
    id: "territory",
    label: "Territory",
    icon: MapPin,
    width: "min-w-[120px]",
    sortable: true,
  },
  {
    id: "value",
    label: "Deal amount",
    icon: DollarSign,
    width: "min-w-[120px]",
    sortable: true,
  },
  {
    id: "score",
    label: "Lead score",
    icon: Target,
    width: "min-w-[100px]",
    sortable: true,
  },
  {
    id: "lastActivity",
    label: "Last activity date",
    icon: Clock,
    width: "min-w-[150px]",
    sortable: true,
  },
  {
    id: "nextFollowUp",
    label: "Next activity date",
    icon: Calendar,
    width: "min-w-[150px]",
    sortable: true,
  },
  {
    id: "assignedTo",
    label: "Lead owner",
    icon: User,
    width: "min-w-[150px]",
    sortable: true,
  },
  {
    id: "phone",
    label: "Phone number",
    icon: Phone,
    width: "min-w-[140px]",
    sortable: false,
  },
  {
    id: "email",
    label: "Email",
    icon: Mail,
    width: "min-w-[200px]",
    sortable: false,
  },
  {
    id: "website",
    label: "Website",
    icon: Building2,
    width: "min-w-[180px]",
    sortable: false,
  },
  {
    id: "employeeCount",
    label: "Number of employees",
    icon: Users,
    width: "min-w-[150px]",
    sortable: true,
  },
  {
    id: "annualRevenue",
    label: "Annual revenue",
    icon: DollarSign,
    width: "min-w-[140px]",
    sortable: true,
  },
  {
    id: "createdDate",
    label: "Create date",
    icon: Calendar,
    width: "min-w-[120px]",
    sortable: true,
  },
];

// Default visible columns (HubSpot-style defaults)
const DEFAULT_VISIBLE_COLUMNS = [
  "lead",
  "company",
  "status",
  "source",
  "value",
  "lastActivity",
  "assignedTo",
];

export default function LeadsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  // Responsive view mode: cards on mobile, table on desktop
  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "cards" : "table";
    }
    return "cards";
  });
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    DEFAULT_VISIBLE_COLUMNS
  );
  const [isColumnCustomizerOpen, setIsColumnCustomizerOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Handle responsive view mode changes
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      // Only auto-switch to cards on mobile if user hasn't manually selected a view
      if (isMobile && viewMode === "table") {
        setViewMode("cards");
      }
    };

    window.addEventListener("resize", handleResize);
    // Set initial view based on screen size
    handleResize();
    
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch leads data from business records
  const {
    data: allBusinessRecords = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/business-records"],
    retry: false,
  });

  // Filter for leads only
  const leads = useMemo(() => {
    return (allBusinessRecords as any[]).filter(
      (record: any) => record.recordType === "lead"
    );
  }, [allBusinessRecords]);

  // Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: (leadData: Partial<Lead>) =>
      apiRequest("/api/business-records", "POST", {
        ...leadData,
        recordType: "lead",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-records"] });
      setIsNewLeadOpen(false);
      toast({
        title: "Success",
        description: "Lead created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create lead",
        variant: "destructive",
      });
    },
  });

  // Update lead mutation
  const updateLeadMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Lead> & { id: string }) =>
      apiRequest(`/api/business-records/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-records"] });
      setEditingLead(null);
      toast({
        title: "Success",
        description: "Lead updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
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

      const matchesStatus =
        statusFilter === "all" || lead.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || lead.priority === priorityFilter;
      const matchesSource =
        sourceFilter === "all" || lead.leadSource === sourceFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesSource;
    });
  }, [leads, searchTerm, statusFilter, priorityFilter, sourceFilter]);

  // Get unique sources for filter dropdown
  const leadSources = useMemo(() => {
    if (!leads || leads.length === 0) return [];
    const sources = [
      ...new Set(leads.map((lead: Lead) => lead.leadSource).filter(Boolean)),
    ];
    return sources;
  }, [leads]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date: string) => {
    if (!date) return "Never";
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

  // Handle lead row click to navigate to detail page
  const handleLeadClick = (leadId: string) => {
    setLocation(`/leads/${leadId}`);
  };

  // Render table cell content based on column type
  const renderTableCell = (lead: Lead, column: TableColumn) => {
    switch (column.id) {
      case "lead":
        return (
          <div
            className="cursor-pointer"
            onClick={() => handleLeadClick(lead.id)}
          >
            <div className="font-medium text-blue-600 hover:text-blue-800">
              {lead.name}
            </div>
            <div className="text-sm text-gray-500">{lead.jobTitle}</div>
          </div>
        );
      case "company":
        return (
          <div
            className="cursor-pointer"
            onClick={() => handleLeadClick(lead.id)}
          >
            <div className="font-medium text-blue-600 hover:text-blue-800">
              {lead.companyName}
            </div>
            <div className="text-sm text-gray-500">{lead.industry || "-"}</div>
          </div>
        );
      case "status":
        return (
          <Badge
            className={
              statusColors[lead.status as keyof typeof statusColors] ||
              "bg-gray-100"
            }
          >
            {lead.status}
          </Badge>
        );
      case "priority":
        return (
          <Badge
            className={
              priorityColors[lead.priority as keyof typeof priorityColors] ||
              "bg-gray-100"
            }
          >
            {lead.priority}
          </Badge>
        );
      case "source":
        return <span className="text-sm">{lead.leadSource}</span>;
      case "industry":
        return <span className="text-sm">{lead.industry || "-"}</span>;
      case "territory":
        return <span className="text-sm">{lead.territory || "-"}</span>;
      case "value":
        return (
          <span className="font-medium">
            {formatCurrency(lead.estimatedValue)}
          </span>
        );
      case "score":
        return <Badge variant="outline">{lead.leadScore || 0}</Badge>;
      case "lastActivity":
        return <span className="text-sm">{formatDate(lead.lastActivity)}</span>;
      case "nextFollowUp":
        return (
          <span className="text-sm">
            {lead.nextFollowUpDate ? formatDate(lead.nextFollowUpDate) : "-"}
          </span>
        );
      case "assignedTo":
        return (
          <span className="text-sm">{lead.assignedTo || "Unassigned"}</span>
        );
      case "phone":
        return (
          <div className="flex items-center space-x-2">
            <Phone className="h-4 w-4 text-gray-400" />
            <span className="text-sm">{lead.phone}</span>
          </div>
        );
      case "email":
        return (
          <div className="flex items-center space-x-2">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="text-sm">{lead.email}</span>
          </div>
        );
      case "website":
        return (
          <span className="text-sm text-blue-600 hover:text-blue-800">
            {lead.website || "-"}
          </span>
        );
      case "employeeCount":
        return <span className="text-sm">{lead.employeeCount || "-"}</span>;
      case "annualRevenue":
        return (
          <span className="text-sm">
            {lead.annualRevenue ? formatCurrency(lead.annualRevenue) : "-"}
          </span>
        );
      case "createdDate":
        return <span className="text-sm">{formatDate(lead.createdAt)}</span>;
      default:
        return <span>-</span>;
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedLeads.length === 0) {
      toast({
        title: "No leads selected",
        description: "Please select leads to perform bulk actions",
        variant: "destructive",
      });
      return;
    }

    // Implement bulk actions here
    toast({
      title: "Bulk Action",
      description: `${action} applied to ${selectedLeads.length} leads`,
    });
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId)
        ? prev.filter((id) => id !== leadId)
        : [...prev, leadId]
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
    <MainLayout
      title="Leads Management"
      description="Manage and track your sales leads"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Leads
            </h1>
            <p className="text-gray-600">Manage and track your sales leads</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => handleBulkAction("export")}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" className="w-full sm:w-auto">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Dialog open={isNewLeadOpen} onOpenChange={setIsNewLeadOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Lead</DialogTitle>
                  <DialogDescription>
                    Add a new lead to your sales pipeline
                  </DialogDescription>
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
                  <p className="text-xl sm:text-2xl font-bold">
                    {filteredLeads.length}
                  </p>
                  <p className="text-sm sm:text-base text-gray-600">
                    Total Leads
                  </p>
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
                    {
                      filteredLeads.filter(
                        (lead: Lead) => lead.status === "qualified"
                      ).length
                    }
                  </p>
                  <p className="text-sm sm:text-base text-gray-600">
                    Qualified
                  </p>
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
                        (sum: number, lead: Lead) =>
                          sum + (lead.estimatedValue || 0),
                        0
                      )
                    )}
                  </p>
                  <p className="text-sm sm:text-base text-gray-600">
                    Pipeline Value
                  </p>
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
                  <p className="text-sm sm:text-base text-gray-600">
                    Need Follow-up
                  </p>
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
                  className="pl-10"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="grid grid-cols-2 sm:flex gap-3 flex-1">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
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

                  <Select
                    value={priorityFilter}
                    onValueChange={setPriorityFilter}
                  >
                    <SelectTrigger className="w-full sm:w-40">
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
                    <SelectTrigger className="w-full sm:w-40 col-span-2 sm:col-span-1">
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
                </div>

                <div className="flex gap-2">
                  <div className="flex border rounded justify-center sm:justify-start">
                    <Button
                      variant={viewMode === "table" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("table")}
                      className="rounded-r-none hidden sm:flex"
                    >
                      Table
                    </Button>
                    <Button
                      variant={viewMode === "cards" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("cards")}
                      className="sm:rounded-l-none rounded-md"
                    >
                      Cards
                    </Button>
                  </div>

                  {/* Column Customizer */}
                  {viewMode === "table" && (
                    <Popover
                      open={isColumnCustomizerOpen}
                      onOpenChange={setIsColumnCustomizerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="hidden sm:flex"
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
                              onClick={() =>
                                setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
                              }
                            >
                              Reset
                            </Button>
                          </div>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {AVAILABLE_COLUMNS.map((column) => {
                              const Icon = column.icon;
                              return (
                                <div
                                  key={column.id}
                                  className="flex items-center space-x-2"
                                >
                                  <Checkbox
                                    id={column.id}
                                    checked={visibleColumns.includes(column.id)}
                                    onCheckedChange={() =>
                                      toggleColumn(column.id)
                                    }
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
                            {visibleColumns.length} of{" "}
                            {AVAILABLE_COLUMNS.length} columns selected
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
              <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                <span className="text-sm text-blue-800">
                  {selectedLeads.length} lead
                  {selectedLeads.length === 1 ? "" : "s"} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("update_status")}
                  >
                    Update Status
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("assign")}
                  >
                    Assign
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("delete")}
                  >
                    Delete
                  </Button>
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
        ) : viewMode === "table" ? (
          <Card className="hidden sm:block">
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
                      <TableRow
                        key={lead.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
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
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-gray-200"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => handleLeadClick(lead.id)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setEditingLead(lead)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredLeads.map((lead: Lead) => (
              <Card key={lead.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div
                      className="cursor-pointer"
                      onClick={() => handleLeadClick(lead.id)}
                    >
                      <CardTitle className="text-lg text-blue-600 hover:text-blue-800">
                        {lead.name}
                      </CardTitle>
                      <CardDescription>{lead.companyName}</CardDescription>
                    </div>
                    <Checkbox
                      checked={selectedLeads.includes(lead.id)}
                      onCheckedChange={() => toggleLeadSelection(lead.id)}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{lead.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{lead.phone}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">
                        {formatCurrency(lead.estimatedValue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex space-x-2">
                        <Badge
                          className={
                            statusColors[
                              lead.status as keyof typeof statusColors
                            ] || "bg-gray-100"
                          }
                        >
                          {lead.status}
                        </Badge>
                        <Badge
                          className={
                            priorityColors[
                              lead.priority as keyof typeof priorityColors
                            ] || "bg-gray-100"
                          }
                        >
                          {lead.priority}
                        </Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleLeadClick(lead.id)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setEditingLead(lead)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Lead Dialog */}
        {editingLead && (
          <Dialog
            open={!!editingLead}
            onOpenChange={() => setEditingLead(null)}
          >
            <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Lead</DialogTitle>
                <DialogDescription>Update lead information</DialogDescription>
              </DialogHeader>
              <LeadForm
                initialData={editingLead}
                onSubmit={(data) =>
                  updateLeadMutation.mutate({ ...data, id: editingLead.id })
                }
                isLoading={updateLeadMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </MainLayout>
  );
}

// Lead Form Component
function LeadForm({
  initialData,
  onSubmit,
  isLoading,
}: {
  initialData?: Lead;
  onSubmit: (data: Partial<Lead>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    companyName: initialData?.companyName || "",
    name: initialData?.name || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    jobTitle: initialData?.jobTitle || "",
    leadSource: initialData?.leadSource || "",
    status: initialData?.status || "new",
    priority: initialData?.priority || "medium",
    estimatedValue: initialData?.estimatedValue || 0,
    notes: initialData?.notes || "",
    address: initialData?.address || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    zipCode: initialData?.zipCode || "",
    industry: "",
    website: "",
  });

  const [companySearchTerm, setCompanySearchTerm] = useState(initialData?.companyName || "");
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [selectedExistingCompany, setSelectedExistingCompany] = useState<any>(null);

  // Fetch existing companies for autocomplete
  const { data: existingCompanies = [] } = useQuery({
    queryKey: ["/api/business-records"],
    select: (data: any[]) => {
      // Get unique companies and deduplicate
      const companies = data
        .filter((record: any) => record.companyName && record.companyName.trim())
        .reduce((acc, record) => {
          const companyName = record.companyName.toLowerCase();
          if (!acc[companyName] || record.recordType === 'customer') {
            acc[companyName] = record;
          }
          return acc;
        }, {} as Record<string, any>);
      
      return Object.values(companies);
    },
  });

  // Filter companies based on search term
  const filteredCompanies = useMemo(() => {
    if (!companySearchTerm || companySearchTerm.length < 2) return [];
    
    return existingCompanies
      .filter((company: any) => 
        company.companyName.toLowerCase().includes(companySearchTerm.toLowerCase())
      )
      .slice(0, 10); // Limit to 10 results
  }, [existingCompanies, companySearchTerm]);

  const handleCompanySelect = (company: any) => {
    setSelectedExistingCompany(company);
    setCompanySearchTerm(company.companyName);
    setIsCompanyDropdownOpen(false);
    
    // Pre-fill form with existing company data
    setFormData({
      ...formData,
      companyName: company.companyName,
      name: company.primaryContactName || "",
      email: company.primaryContactEmail || "",
      phone: company.primaryContactPhone || company.phone || "",
      address: company.addressLine1 || "",
      city: company.city || "",
      state: company.state || "",
      zipCode: company.postalCode || "",
      industry: company.industry || "",
      website: company.website || "",
    });
  };

  const handleCompanyInputChange = (value: string) => {
    setCompanySearchTerm(value);
    setFormData({ ...formData, companyName: value });
    setSelectedExistingCompany(null);
    setIsCompanyDropdownOpen(value.length >= 2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      // Map form data to Lead interface fields
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      companyName: formData.companyName,
      jobTitle: formData.jobTitle,
      leadSource: formData.leadSource,
      status: formData.status,
      priority: formData.priority,
      estimatedValue: formData.estimatedValue,
      notes: formData.notes,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      zipCode: formData.zipCode,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-h-[70vh] overflow-y-auto"
    >
      {/* Company Information - Primary Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 border-b pb-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          Company Information
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="companyName" className="text-base font-medium">
            Company Name *
          </Label>
          <div className="relative">
            <Input
              id="companyName"
              value={companySearchTerm}
              onChange={(e) => handleCompanyInputChange(e.target.value)}
              placeholder="Start typing company name..."
              className="text-base"
              required
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
                          <span> • {company.city}, {company.state}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedExistingCompany && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
              <CheckSquare className="h-4 w-4" />
              Information loaded from existing {selectedExistingCompany.recordType}. You can modify before saving.
            </div>
          )}
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 border-b pb-2">
          <User className="h-5 w-5 text-blue-600" />
          Contact Details
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Contact Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Primary contact person"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job Title</Label>
            <Input
              id="jobTitle"
              value={formData.jobTitle}
              onChange={(e) =>
                setFormData({ ...formData, jobTitle: e.target.value })
              }
              placeholder="e.g., Office Manager, CEO"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="contact@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
      </div>

      {/* Lead Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 border-b pb-2">
          <Target className="h-5 w-5 text-blue-600" />
          Lead Details
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="leadSource">Lead Source</Label>
            <Select
              value={formData.leadSource}
              onValueChange={(value) =>
                setFormData({ ...formData, leadSource: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="How did they find you?" />
              </SelectTrigger>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimatedValue">Estimated Value</Label>
            <Input
              id="estimatedValue"
              type="number"
              value={formData.estimatedValue}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  estimatedValue: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) =>
                setFormData({ ...formData, priority: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Address Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 border-b pb-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          Address Information
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="123 Main Street"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="City"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) =>
                setFormData({ ...formData, state: e.target.value })
              }
              placeholder="State"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zipCode">ZIP Code</Label>
            <Input
              id="zipCode"
              value={formData.zipCode}
              onChange={(e) =>
                setFormData({ ...formData, zipCode: e.target.value })
              }
              placeholder="12345"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          placeholder="Additional notes about this lead..."
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="submit" disabled={isLoading} className="px-6">
          {isLoading
            ? "Saving..."
            : initialData
            ? "Update Lead"
            : "Create Lead"}
        </Button>
      </div>
    </form>
  );
}
