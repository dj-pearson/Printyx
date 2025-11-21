import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Wrench,
  Clock,
  AlertTriangle,
  CheckCircle,
  LayoutGrid,
  Rows,
  Download,
  FileText,
  Trash2,
  UserCheck,
} from "lucide-react";

export default function ServiceDispatch() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // Filter state management
  const filterState = useFilterState({
    searchTerm: '',
    statusFilter: 'all',
    priorityFilter: 'all',
    technicianFilter: 'all',
  });

  const { searchTerm, statusFilter, priorityFilter, technicianFilter } = filterState.filters;

  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "cards" : "table";
    }
    return "cards";
  });

  useEffect(() => {
    const handler = () => {
      if (window.innerWidth < 768 && viewMode === "table") {
        setViewMode("cards");
      }
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [viewMode]);

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["/api/service-tickets"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Filter tickets
  const filteredTickets = useMemo(() => {
    return (tickets as any[]).filter((ticket) => {
      // Search filter
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term || [
        ticket.title,
        ticket.description,
        ticket.ticketNumber,
        ticket.customerId,
        ticket.assignedTechnicianId,
      ]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(term));

      // Status filter
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;

      // Priority filter
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

      // Technician filter
      const matchesTechnician = technicianFilter === 'all' ||
        (technicianFilter === 'unassigned' && !ticket.assignedTechnicianId) ||
        ticket.assignedTechnicianId === technicianFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesTechnician;
    });
  }, [tickets, searchTerm, statusFilter, priorityFilter, technicianFilter]);

  // Get unique values for filter dropdowns
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(
      (tickets as any[]).map((t) => t.status).filter(Boolean)
    );
    return Array.from(statuses).sort();
  }, [tickets]);

  const uniquePriorities = useMemo(() => {
    const priorities = new Set(
      (tickets as any[]).map((t) => t.priority).filter(Boolean)
    );
    return Array.from(priorities).sort();
  }, [tickets]);

  const uniqueTechnicians = useMemo(() => {
    const technicians = new Set(
      (tickets as any[]).map((t) => t.assignedTechnicianId).filter(Boolean)
    );
    return Array.from(technicians).sort();
  }, [tickets]);

  // Bulk selection
  const bulkSelection = useBulkSelection(filteredTickets);

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ticketIds: string[]) => {
      await Promise.all(
        ticketIds.map(id => apiRequest(`/api/service-tickets/${id}`, 'DELETE'))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-tickets"] });
      bulkSelection.clearSelection();
      toast({
        title: 'Success',
        description: `${bulkSelection.selectedCount} ticket(s) deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete some tickets',
        variant: 'destructive',
      });
    },
  });

  // Bulk export function
  const handleBulkExport = (format: 'csv' | 'json') => {
    const selectedTickets = filteredTickets.filter((t: any) =>
      bulkSelection.selectedIds.includes(t.id)
    );

    const columns = [
      createExportColumn('ticketNumber', 'Ticket #'),
      createExportColumn('title', 'Title'),
      createExportColumn('status', 'Status'),
      createExportColumn('priority', 'Priority'),
      createExportColumn('customerId', 'Customer'),
      createExportColumn('assignedTechnicianId', 'Technician'),
      createExportColumn('createdAt', 'Created At', (date) =>
        new Date(date).toLocaleDateString()
      ),
      createExportColumn('description', 'Description'),
    ];

    if (format === 'csv') {
      exportToCSV(selectedTickets, columns, { filename: 'service-tickets-export' });
    } else {
      exportToJSON(selectedTickets, columns, { filename: 'service-tickets-export' });
    }

    toast({
      title: 'Export Complete',
      description: `${selectedTickets.length} ticket(s) exported successfully`,
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
      confirmationTitle: 'Delete Service Tickets',
      confirmationDescription: `Are you sure you want to delete ${bulkSelection.selectedCount} ticket(s)? This action cannot be undone.`,
    },
  ];

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case "medium":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "low":
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "in-progress":
        return <Wrench className="h-4 w-4 text-blue-600" />;
      case "open":
        return <Clock className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "in-progress":
        return "secondary";
      case "open":
        return "outline";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading service dispatch...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout
      title="Service Dispatch"
      description="Manage service tickets and technician assignments"
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search tickets by number, title, customer, description..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => filterState.updateFilter('searchTerm', e.target.value)}
                />
              </div>

              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                {/* Status Filter */}
                <Select
                  value={statusFilter}
                  onValueChange={(value) => filterState.updateFilter('statusFilter', value)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {uniqueStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

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
                    {uniquePriorities.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Technician Filter */}
                <Select
                  value={technicianFilter}
                  onValueChange={(value) => filterState.updateFilter('technicianFilter', value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Technician" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Technicians</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {uniqueTechnicians.map((tech) => (
                      <SelectItem key={tech} value={tech}>
                        {tech}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Saved Filters */}
                <SavedFilters
                  storageKey="service-dispatch.savedFilters"
                  currentFilters={filterState.filters}
                  onApplyFilter={filterState.applyFilters}
                  onClearFilters={filterState.clearFilters}
                  activeFilterCount={filterState.activeFilterCount}
                  getFilterDescription={(filters) => {
                    const parts: string[] = [];
                    if (filters.searchTerm) parts.push(`Search: "${filters.searchTerm}"`);
                    if (filters.statusFilter !== 'all') parts.push(`Status: ${filters.statusFilter}`);
                    if (filters.priorityFilter !== 'all') parts.push(`Priority: ${filters.priorityFilter}`);
                    if (filters.technicianFilter !== 'all') {
                      parts.push(`Technician: ${filters.technicianFilter === 'unassigned' ? 'Unassigned' : filters.technicianFilter}`);
                    }
                    return parts.length > 0 ? parts.join(' • ') : 'No filters applied';
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* View Controls */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {filteredTickets.length > 0 && (
              <Badge variant="secondary">
                {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
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
              size="default"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Ticket</span>
            </Button>
          </div>
        </div>

        {/* Bulk Operations Toolbar */}
        <BulkOperationsToolbar
          selectedCount={bulkSelection.selectedCount}
          totalCount={filteredTickets.length}
          onClearSelection={bulkSelection.clearSelection}
          onSelectAll={bulkSelection.selectAll}
          selectedIds={bulkSelection.selectedIds}
          actions={bulkActions}
        />

        {ticketsLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTickets && filteredTickets.length > 0 ? (
          viewMode === "cards" ? (
            <div className="space-y-4">
              {filteredTickets.map((ticket: any) => (
                <Card
                  key={ticket.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-start space-x-4 flex-1">
                        <Checkbox
                          checked={bulkSelection.isSelected(ticket.id)}
                          onCheckedChange={() => bulkSelection.toggleSelection(ticket.id)}
                          aria-label={`Select ticket ${ticket.ticketNumber}`}
                          className="mt-1"
                        />
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          {getStatusIcon(ticket.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {ticket.title}
                            </h3>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              #{ticket.ticketNumber}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {ticket.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                            <span className="truncate">Customer: {ticket.customerId}</span>
                            <span className="flex-shrink-0">
                              Created:{" "}
                              {new Date(ticket.createdAt).toLocaleDateString()}
                            </span>
                            {ticket.assignedTechnicianId && (
                              <span className="truncate flex items-center gap-1">
                                <UserCheck className="h-3 w-3" />
                                {ticket.assignedTechnicianId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-shrink-0 ml-2">
                        <Badge
                          variant={getPriorityVariant(ticket.priority)}
                          className="flex items-center gap-1 capitalize"
                        >
                          {getPriorityIcon(ticket.priority)}
                          {ticket.priority}
                        </Badge>
                        <Badge
                          variant={getStatusVariant(ticket.status)}
                          className="flex items-center gap-1 capitalize"
                        >
                          {getStatusIcon(ticket.status)}
                          {ticket.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      <Button variant="outline" size="sm">
                        Assign Technician
                      </Button>
                      {ticket.status === "open" && (
                        <Button size="sm">Start Work</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                        aria-label="Select all tickets"
                      />
                    </TableHead>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket: any) => (
                    <TableRow key={ticket.id} className="cursor-pointer">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={bulkSelection.isSelected(ticket.id)}
                          onCheckedChange={() => bulkSelection.toggleSelection(ticket.id)}
                          aria-label={`Select ticket ${ticket.ticketNumber}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        #{ticket.ticketNumber}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {ticket.title}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusVariant(ticket.status)}
                          className="capitalize"
                        >
                          {ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getPriorityVariant(ticket.priority)}
                          className="capitalize"
                        >
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="truncate max-w-[150px]">
                        {ticket.customerId || "—"}
                      </TableCell>
                      <TableCell className="truncate max-w-[150px]">
                        {ticket.assignedTechnicianId || "Unassigned"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="h-8">
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
                icon={Wrench}
                title={
                  searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || technicianFilter !== 'all'
                    ? 'No tickets match your filters'
                    : 'No service tickets found'
                }
                description={
                  searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || technicianFilter !== 'all'
                    ? 'Try adjusting your search criteria or filters to find what you\'re looking for'
                    : 'Create your first service ticket to get started with dispatch management'
                }
                type={searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || technicianFilter !== 'all' ? 'filter' : 'default'}
                action={{
                  label: 'New Ticket',
                  onClick: () => {},
                  icon: Plus,
                }}
                secondaryAction={
                  searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || technicianFilter !== 'all'
                    ? {
                        label: 'Clear Filters',
                        onClick: filterState.clearFilters,
                        variant: 'outline',
                      }
                    : undefined
                }
                suggestions={
                  tickets.length === 0 && !searchTerm
                    ? [
                        'Track and manage all service calls in one place',
                        'Assign technicians and monitor progress in real-time',
                        'Export ticket data for reporting and analysis',
                      ]
                    : undefined
                }
              />
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
