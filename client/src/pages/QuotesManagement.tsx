import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VirtualizedDataTable } from '@/components/ui/virtualized-data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import {
  BulkOperationsToolbar,
  useBulkSelection,
  BulkAction,
} from '@/components/ui/bulk-operations-toolbar';
import { exportToCSV, exportToJSON, createExportColumn } from '@/lib/export-utils';
import { SavedFilters, useFilterState } from '@/components/ui/saved-filters';
import { QuoteTemplates } from '@/components/quotes/quote-templates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Calculator,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Building2,
  DollarSign,
  Calendar,
  User,
  TrendingUp,
  Wand2,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest, extractRecords } from '@/lib/queryClient';
import { downloadQuotePdf, emailQuote } from '@/lib/quote-pdf';
import { usePricingVisibility } from '@/hooks/usePricingVisibility';
import { useToast } from '@/hooks/use-toast';
import DoDEnforcementButton from '@/components/dod/DoDEnforcementButton';
import ContextualHelp from '@/components/contextual/ContextualHelp';
import PageAlerts from '@/components/contextual/PageAlerts';
import KpiSummaryBar from '@/components/dashboard/KpiSummaryBar';
import MobileFAB from '@/components/layout/MobileFAB';
import ProcessHelpBanner from '@/components/training/ProcessHelpBanner';
import { relativeDate, expiryDisplay } from '@/lib/date-utils';

interface Quote {
  id: string;
  proposalNumber: string;
  title: string;
  businessRecordId: string;
  customerName?: string;
  contactId?: string;
  contactName?: string;
  status: 'draft' | 'sent' | 'accepted' | 'closed_lost';
  subtotal?: number;
  totalAmount?: number;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName?: string;
  assignedTo?: string;
  assignedToName?: string;
  lineItemsCount?: number;
}

const statusConfig = {
  draft: {
    label: 'Draft',
    variant: 'secondary' as const,
    icon: Edit,
    color: 'text-gray-600',
  },
  sent: {
    label: 'Sent',
    variant: 'default' as const,
    icon: Send,
    color: 'text-blue-600',
  },
  accepted: {
    label: 'Accepted',
    variant: 'default' as const,
    icon: CheckCircle,
    color: 'text-green-600',
  },
  closed_lost: {
    label: 'Closed Lost',
    variant: 'destructive' as const,
    icon: XCircle,
    color: 'text-red-600',
  },
};

export default function QuotesManagement() {
  // Filter state management
  const filterState = useFilterState({
    searchTerm: '',
    statusFilter: 'all',
    dateFilter: 'all',
  });

  const { searchTerm, statusFilter, dateFilter } = filterState.filters;

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pricingVisibility } = usePricingVisibility();
  const canViewManagerQuote = pricingVisibility?.showDealerCost === true;

  const handleManagerQuotePdf = async (quote: { id: string; proposalNumber?: string }) => {
    try {
      await downloadQuotePdf(quote.id, quote.proposalNumber, { manager: true });
    } catch (err: any) {
      toast({
        title: 'Export failed',
        description: err?.message || 'Could not export the manager PDF.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPdf = async (quote: { id: string; proposalNumber?: string }) => {
    try {
      await downloadQuotePdf(quote.id, quote.proposalNumber);
    } catch (err: any) {
      toast({
        title: 'Download failed',
        description: err?.message || 'Could not download the PDF.',
        variant: 'destructive',
      });
    }
  };

  const handleEmailQuote = async (quote: { id: string }) => {
    try {
      const r = await emailQuote(quote.id);
      toast({
        title: r.simulated ? 'Email simulated' : 'Email sent',
        description: `Quote sent to ${r.to}${r.simulated ? ' (no email provider configured)' : ''}`,
      });
    } catch (err: any) {
      toast({
        title: 'Email failed',
        description: err?.message || 'Could not email the quote.',
        variant: 'destructive',
      });
    }
  };

  // Fetch quotes (using the existing proposals endpoint)
  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ['/api/proposals'],
    queryFn: async () => {
      const response = await apiRequest('/api/proposals', 'GET');
      return extractRecords(response).map((proposal: any) => ({
        id: proposal.id,
        proposalNumber: proposal.proposal_number || proposal.proposalNumber || '',
        title: proposal.title || '',
        businessRecordId: proposal.business_record_id || proposal.businessRecordId || '',
        customerName: proposal.customer_name || proposal.customerName || '',
        contactId: proposal.contact_id || proposal.contactId || '',
        contactName: proposal.contact_name || proposal.contactName || '',
        subtotal: parseFloat(proposal.subtotal || '0') || 0,
        totalAmount: parseFloat(proposal.total_amount || proposal.totalAmount || '0') || 0,
        validUntil: proposal.valid_until || proposal.validUntil || null,
        createdAt: proposal.created_at || proposal.createdAt || '',
        updatedAt: proposal.updated_at || proposal.updatedAt || '',
        createdBy: proposal.created_by || proposal.createdBy || '',
        createdByName: proposal.created_by_name || proposal.createdByName || '',
        assignedTo: proposal.assigned_to || proposal.assignedTo || '',
        assignedToName: proposal.assigned_to_name || proposal.assignedToName || '',
        lineItemsCount: proposal.line_items_count || proposal.lineItemsCount || 0,
        status:
          proposal.status === 'draft'
            ? 'draft'
            : proposal.status === 'sent'
              ? 'sent'
              : proposal.status === 'accepted'
                ? 'accepted'
                : 'closed_lost',
      }));
    },
  });

  // Delete quote mutation
  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return await apiRequest(`/api/proposals/${quoteId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      toast({
        title: 'Success',
        description: 'Quote deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete quote',
        variant: 'destructive',
      });
    },
  });

  // Update quote status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest(`/api/proposals/${id}/status`, 'PATCH', { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      toast({
        title: 'Success',
        description: 'Quote status updated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update quote status',
        variant: 'destructive',
      });
    },
  });

  // Filter quotes
  const filteredQuotes = quotes.filter((quote) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      (quote.title && quote.title.toLowerCase().includes(search)) ||
      (quote.proposalNumber && quote.proposalNumber.toLowerCase().includes(search)) ||
      (quote.customerName && quote.customerName.toLowerCase().includes(search));

    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const quoteDate = new Date(quote.createdAt);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - quoteDate.getTime()) / (1000 * 60 * 60 * 24));

      switch (dateFilter) {
        case 'today':
          matchesDate = daysDiff === 0;
          break;
        case 'week':
          matchesDate = daysDiff <= 7;
          break;
        case 'month':
          matchesDate = daysDiff <= 30;
          break;
        case 'quarter':
          matchesDate = daysDiff <= 90;
          break;
      }
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Calculate statistics
  const stats = {
    total: quotes.length,
    draft: quotes.filter((q) => q.status === 'draft').length,
    sent: quotes.filter((q) => q.status === 'sent').length,
    accepted: quotes.filter((q) => q.status === 'accepted').length,
    closedLost: quotes.filter((q) => q.status === 'closed_lost').length,
    totalValue: quotes.reduce(
      (sum, q) => sum + (parseFloat(q.totalAmount?.toString() || '0') || 0),
      0,
    ),
    winRate:
      quotes.length > 0
        ? (quotes.filter((q) => q.status === 'accepted').length / quotes.length) * 100
        : 0,
  };

  // Bulk selection hook
  const bulkSelection = useBulkSelection(filteredQuotes);

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (quoteIds: string[]) => {
      // Delete all quotes in parallel
      await Promise.all(quoteIds.map((id) => apiRequest(`/api/proposals/${id}`, 'DELETE')));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      bulkSelection.clearSelection();
      toast({
        title: 'Success',
        description: `${bulkSelection.selectedCount} quote(s) deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete some quotes',
        variant: 'destructive',
      });
    },
  });

  // Bulk export function
  const handleBulkExport = (format: 'csv' | 'json') => {
    const selectedQuotes = quotes.filter((q) => bulkSelection.selectedIds.includes(q.id));

    const columns = [
      createExportColumn('proposalNumber', 'Quote Number'),
      createExportColumn('title', 'Title'),
      createExportColumn('customerName', 'Customer'),
      createExportColumn('contactName', 'Contact'),
      createExportColumn('status', 'Status'),
      createExportColumn('totalAmount', 'Total Amount', 'currency'),
      createExportColumn('validUntil', 'Valid Until', 'date'),
      createExportColumn('createdAt', 'Created Date', 'date'),
      createExportColumn('assignedToName', 'Assigned To'),
    ];

    if (format === 'csv') {
      exportToCSV(selectedQuotes, columns, { filename: 'quotes-export' });
    } else {
      exportToJSON(selectedQuotes, columns, { filename: 'quotes-export' });
    }

    toast({
      title: 'Export Complete',
      description: `${selectedQuotes.length} quote(s) exported successfully`,
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
      confirmationTitle: 'Delete Quotes',
      confirmationDescription: `Are you sure you want to delete ${bulkSelection.selectedCount} quote(s)? This action cannot be undone.`,
    },
  ];

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const getStatusBadge = (status: Quote['status']) => {
    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleCreateQuote = () => {
    setLocation('/quotes/new');
  };

  const handleEditQuote = (quoteId: string) => {
    setLocation(`/quotes/${quoteId}`);
  };

  const handleViewQuote = (quoteId: string) => {
    setLocation(`/quotes/${quoteId}/view`);
  };

  const handleCreateProposal = (quoteId: string) => {
    setLocation(`/proposal-builder?quoteId=${quoteId}`);
  };

  const handleDeleteQuote = (quoteId: string) => {
    deleteQuoteMutation.mutate(quoteId);
  };

  const handleStatusChange = (quoteId: string, newStatus: string) => {
    updateStatusMutation.mutate({ id: quoteId, status: newStatus });
  };

  return (
    <MainLayout
      title="Quotes Management"
      description="Create, manage, and track your sales quotes and proposals"
    >
      <div className="container mx-auto p-6 space-y-6">
        <ContextualHelp page="quotes-management" />
        <KpiSummaryBar className="mb-4" />
        <PageAlerts
          categories={['business']}
          severities={['medium', 'high', 'critical']}
          className="-mt-2"
        />
        {/* Process Help Banner */}
        <ProcessHelpBanner
          processType="lead-to-quote"
          currentStage="quote-generation"
          nextStage="proposal-conversion"
          estimatedTime="2-4 hours"
        />
        {/* Header */}
        <div className="flex justify-end items-center gap-2">
          <QuoteTemplates
            onApplyTemplate={(template) => {
              // In a real implementation, this would navigate to quote builder with template
              toast({
                title: 'Template Applied',
                description: `${template.name} template will be loaded in the quote builder`,
              });
              handleCreateQuote();
            }}
          />
          <Button onClick={handleCreateQuote}>
            <Plus className="h-4 w-4 mr-2" />
            New Quote
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Quotes</CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.totalValue)} total value
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft</CardTitle>
              <Edit className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.draft}</div>
              <p className="text-xs text-muted-foreground">Not yet sent</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
              <Send className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sent}</div>
              <p className="text-xs text-muted-foreground">Awaiting response</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accepted</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.accepted}</div>
              <p className="text-xs text-muted-foreground">{stats.winRate.toFixed(0)}% win rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'all', label: 'All' },
            { key: 'draft', label: 'Draft' },
            { key: 'sent', label: 'Sent' },
            { key: 'accepted', label: 'Accepted' },
            { key: 'closed_lost', label: 'Closed Lost' },
          ].map((tab) => (
            <Button
              key={tab.key}
              variant={statusFilter === tab.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => filterState.updateFilter('statusFilter', tab.key)}
              className="touch-manipulation"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search quotes by title, number, or customer..."
                    value={searchTerm}
                    onChange={(e) => filterState.updateFilter('searchTerm', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Select
                  value={statusFilter}
                  onValueChange={(value) => filterState.updateFilter('statusFilter', value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="closed_lost">Closed Lost</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={dateFilter}
                  onValueChange={(value) => filterState.updateFilter('dateFilter', value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                  </SelectContent>
                </Select>

                {/* Saved Filters */}
                <SavedFilters
                  storageKey="quotes.savedFilters"
                  currentFilters={filterState.filters}
                  onApplyFilter={filterState.applyFilters}
                  onClearFilters={filterState.clearFilters}
                  activeFilterCount={filterState.activeFilterCount}
                  getFilterDescription={(filters) => {
                    const parts: string[] = [];
                    if (filters.searchTerm) parts.push(`Search: "${filters.searchTerm}"`);
                    if (filters.statusFilter !== 'all')
                      parts.push(`Status: ${filters.statusFilter}`);
                    if (filters.dateFilter !== 'all') parts.push(`Date: ${filters.dateFilter}`);
                    return parts.length > 0 ? parts.join(' • ') : 'No filters applied';
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quotes Table */}
        <Card>
          <CardHeader>
            <CardTitle>Quotes</CardTitle>
            <CardDescription>
              {filteredQuotes.length} of {quotes.length} quotes
            </CardDescription>
          </CardHeader>

          {/* Bulk Operations Toolbar */}
          <BulkOperationsToolbar
            selectedCount={bulkSelection.selectedCount}
            totalCount={filteredQuotes.length}
            onClearSelection={bulkSelection.clearSelection}
            onSelectAll={bulkSelection.selectAll}
            selectedIds={bulkSelection.selectedIds}
            actions={bulkActions}
          />

          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredQuotes.length === 0 ? (
              <EmptyState
                icon={Calculator}
                title={
                  searchTerm || statusFilter !== 'all' || dateFilter !== 'all'
                    ? 'No quotes match your filters'
                    : 'No quotes created yet'
                }
                description={
                  searchTerm || statusFilter !== 'all' || dateFilter !== 'all'
                    ? "Try adjusting your search criteria to find what you're looking for"
                    : 'Create your first quote to start managing sales opportunities'
                }
                type={
                  searchTerm || statusFilter !== 'all' || dateFilter !== 'all'
                    ? 'filter'
                    : 'default'
                }
                action={{
                  label: 'Create Quote',
                  onClick: handleCreateQuote,
                  icon: Plus,
                }}
                secondaryAction={
                  searchTerm || statusFilter !== 'all' || dateFilter !== 'all'
                    ? {
                        label: 'Clear Filters',
                        onClick: filterState.clearFilters,
                        variant: 'outline',
                      }
                    : undefined
                }
                suggestions={
                  quotes.length === 0 && !searchTerm
                    ? [
                        'Quotes help you provide pricing to potential customers',
                        'Convert quotes to proposals for professional presentations',
                        'Track quote status from draft to accepted',
                      ]
                    : undefined
                }
              />
            ) : (
              <VirtualizedDataTable
                data={filteredQuotes}
                onRowClick={(quote: any) => handleEditQuote(quote.id)}
                columns={[
                  {
                    id: 'quoteNum',
                    header: 'Quote #',
                    cell: (quote: any) => (
                      <div className="font-medium text-primary">{quote.proposalNumber}</div>
                    ),
                  },
                  {
                    id: 'title',
                    header: 'Title',
                    cell: (quote: any) => <div className="font-medium">{quote.title}</div>,
                  },
                  {
                    id: 'customer',
                    header: 'Customer',
                    cell: (quote: any) => (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {quote.customerName || 'Unknown Customer'}
                          </div>
                          {quote.contactName && (
                            <div className="text-xs text-muted-foreground">{quote.contactName}</div>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'status',
                    header: 'Status',
                    cell: (quote: any) => getStatusBadge(quote.status),
                  },
                  {
                    id: 'total',
                    header: 'Total',
                    cell: (quote: any) => (
                      <div className="font-medium">{formatCurrency(quote.totalAmount)}</div>
                    ),
                  },
                  {
                    id: 'validUntil',
                    header: 'Valid Until',
                    cell: (quote: any) =>
                      quote.validUntil ? (
                        <div>
                          <div className="text-sm">{formatDate(quote.validUntil)}</div>
                          {(() => {
                            const exp = expiryDisplay(quote.validUntil);
                            return exp.urgent ? (
                              <span className="text-xs text-red-600 font-medium">{exp.text}</span>
                            ) : null;
                          })()}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not set</span>
                      ),
                  },
                  {
                    id: 'created',
                    header: 'Created',
                    cell: (quote: any) => (
                      <div className="text-sm text-muted-foreground">
                        {relativeDate(quote.createdAt)}
                      </div>
                    ),
                  },
                  {
                    id: 'assignedTo',
                    header: 'Assigned To',
                    cell: (quote: any) => (
                      <div className="flex items-center gap-1 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {quote.assignedToName || quote.createdByName || 'Unassigned'}
                      </div>
                    ),
                  },
                ]}
                selectedIds={bulkSelection.selectedIdsSet}
                onSelectionChange={(ids) => {
                  const current = bulkSelection.selectedIdsSet;
                  ids.forEach((id) => {
                    if (!current.has(id)) bulkSelection.toggleSelection(id as string);
                  });
                  current.forEach((id) => {
                    if (!ids.has(id)) bulkSelection.toggleSelection(id as string);
                  });
                }}
                actions={(quote: any) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleViewQuote(quote.id)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Quote
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadPdf(quote)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEmailQuote(quote)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Email Quote
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditQuote(quote.id)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Quote
                      </DropdownMenuItem>
                      {canViewManagerQuote && (
                        <DropdownMenuItem onClick={() => handleManagerQuotePdf(quote)}>
                          <DollarSign className="h-4 w-4 mr-2" />
                          Manager Quote (PDF)
                        </DropdownMenuItem>
                      )}
                      <div className="px-2 py-1">
                        <DoDEnforcementButton
                          recordId={quote.id}
                          validationType="quote-to-proposal"
                          onValidClick={() => handleCreateProposal(quote.id)}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-8 px-2"
                        >
                          <Wand2 className="h-4 w-4 mr-2" />
                          Create Proposal
                        </DoDEnforcementButton>
                      </div>
                      <DropdownMenuSeparator />
                      {quote.status === 'draft' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(quote.id, 'sent')}>
                          <Send className="h-4 w-4 mr-2" />
                          Send Quote
                        </DropdownMenuItem>
                      )}
                      {quote.status === 'sent' && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(quote.id, 'accepted')}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Accepted
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(quote.id, 'closed_lost')}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Mark Closed Lost
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Quote
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this quote? This action cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteQuote(quote.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                maxHeight={700}
              />
            )}
          </CardContent>
        </Card>
      </div>
      <MobileFAB onClick={handleCreateQuote} label="New Quote" />
    </MainLayout>
  );
}
