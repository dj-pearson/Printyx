/**
 * BusinessRecordsDataTable - Shared high-performance data table for CRM records.
 *
 * Fully server-side search, filtering, sorting, and pagination.
 * Configurable per record type (leads, prospects, customers).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  BulkOperationsToolbar,
  useBulkSelection,
  BulkAction,
} from '@/components/ui/bulk-operations-toolbar';
import { exportToCSV, exportToJSON, createExportColumn } from '@/lib/export-utils';
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  Eye,
  LayoutGrid,
  Rows,
  Download,
  FileText,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MoreHorizontal,
  ArrowUpDown,
  Filter,
  X,
} from 'lucide-react';

// ─── Snake-to-Camel Helpers ──────────────────────────────────────────────────

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function normalizeRecord(record: any): any {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  const result: any = {};
  for (const [key, value] of Object.entries(record)) {
    result[snakeToCamel(key)] = value;
  }
  return result;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type RecordType = 'lead' | 'prospect' | 'customer' | 'former_customer';

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, record: any) => React.ReactNode;
  exportKey?: string;
}

export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  serverKey: string; // The query parameter name sent to the API
}

export interface StatusConfig {
  value: string;
  label: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  className?: string;
}

export interface ActionDef {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (record: any) => void;
  variant?: 'default' | 'destructive';
  show?: (record: any) => boolean;
}

export interface QuickFilterTab {
  key: string;
  label: string;
  filter: Record<string, string>;
  count?: number;
}

export interface BusinessRecordsDataTableProps {
  recordType: RecordType;
  title: string;
  columns: ColumnDef[];
  filters?: FilterDef[];
  statusConfigs: StatusConfig[];
  rowActions?: ActionDef[];
  onCreateNew?: () => void;
  createLabel?: string;
  detailPath: string; // e.g., '/customers' or '/leads'
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  quickFilterTabs?: QuickFilterTab[];
  extraHeaderContent?: React.ReactNode;
}

// ─── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status, configs }: { status: string; configs: StatusConfig[] }) {
  const config = configs.find((c) => c.value === status);
  if (!config) {
    return (
      <Badge variant="outline" className="capitalize text-xs">
        {status?.replace(/_/g, ' ') || 'Unknown'}
      </Badge>
    );
  }
  return (
    <Badge variant={config.variant} className={`text-xs ${config.className || ''}`}>
      {config.label}
    </Badge>
  );
}

// ─── Sort Header ────────────────────────────────────────────────────────────

function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentOrder,
  onSort,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentOrder: 'asc' | 'desc';
  onSort: (key: string) => void;
}) {
  const isActive = currentSort === sortKey;
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors font-medium text-left"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {isActive ? (
        currentOrder === 'asc' ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function BusinessRecordsDataTable({
  recordType,
  title,
  columns,
  filters = [],
  statusConfigs,
  rowActions = [],
  onCreateNew,
  createLabel = 'Add Record',
  detailPath,
  emptyTitle,
  emptyDescription,
  pageSize = 50,
  quickFilterTabs,
  extraHeaderContent,
}: BusinessRecordsDataTableProps) {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // View state
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'cards' : 'table';
    }
    return 'table';
  });

  // Search state with debounce
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Pagination state
  const [page, setPage] = useState(1);

  // Sort state
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Quick filter tab state
  const [activeTab, setActiveTab] = useState<string>(quickFilterTabs?.[0]?.key || '');

  // Filter state
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const activeFilterCount = useMemo(
    () => Object.values(activeFilters).filter((v) => v && v !== 'all').length,
    [activeFilters],
  );

  // Responsive view mode
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth < 768 && viewMode === 'table') {
        setViewMode('cards');
      }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [viewMode]);

  // Handle sort toggle
  const handleSort = useCallback(
    (key: string) => {
      if (sortBy === key) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(key);
        setSortOrder('asc');
      }
      setPage(1);
    },
    [sortBy],
  );

  // Handle filter change
  const handleFilterChange = useCallback((key: string, value: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (value === 'all' || !value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
    setPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setActiveFilters({});
    setSearchInput('');
    setPage(1);
  }, []);

  // ─── Data Fetching ────────────────────────────────────────────────────────

  // Merge active tab filter into active filters for the query
  const tabFilter = useMemo(() => {
    if (!quickFilterTabs || !activeTab) return {};
    const tab = quickFilterTabs.find((t) => t.key === activeTab);
    return tab?.filter || {};
  }, [quickFilterTabs, activeTab]);

  const queryKey = useMemo(
    () => [
      '/api/companies',
      recordType,
      {
        page,
        pageSize,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        ...activeFilters,
        ...tabFilter,
      },
    ],
    [recordType, page, pageSize, debouncedSearch, sortBy, sortOrder, activeFilters, tabFilter],
  );

  const { data: response, isLoading } = useQuery({
    queryKey,
    enabled: isAuthenticated,
    queryFn: async () => {
      // Capitalize recordType for companies endpoint (lead → Lead, customer → Customer)
      const companiesType = recordType.charAt(0).toUpperCase() + recordType.slice(1);
      const params = new URLSearchParams({
        recordType: companiesType,
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
        sortBy,
        sortOrder,
      });

      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }

      // Apply server-side filters
      for (const filter of filters) {
        const value = activeFilters[filter.key];
        if (value && value !== 'all') {
          params.set(filter.serverKey, value);
        }
      }

      // Apply quick filter tab params
      for (const [key, value] of Object.entries(tabFilter)) {
        if (value) params.set(key, value);
      }

      const resp = await apiRequest(`/api/companies?${params}`, 'GET');
      const rawRecords = resp?.records || resp?.data || [];
      return {
        records: rawRecords.map(normalizeRecord),
        pagination: resp?.pagination || { total: rawRecords.length, hasMore: false },
      };
    },
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const records = response?.records || [];
  const pagination = response?.pagination || {
    total: 0,
    hasMore: false,
    limit: pageSize,
    offset: 0,
  };
  const totalPages = Math.ceil((pagination.total || 0) / pageSize);

  // ─── Bulk Selection ───────────────────────────────────────────────────────

  const bulkSelection = useBulkSelection(records);

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiRequest(`/api/companies/${id}`, 'DELETE')));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      bulkSelection.clearSelection();
      toast({
        title: 'Deleted',
        description: `${bulkSelection.selectedCount} record(s) deleted`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete some records',
        variant: 'destructive',
      });
    },
  });

  const handleBulkExport = useCallback(
    (format: 'csv' | 'json') => {
      const selectedRecords = records.filter((r: any) => bulkSelection.selectedIds.includes(r.id));
      const exportCols = columns.map((col) =>
        createExportColumn(col.exportKey || col.key, col.label),
      );

      if (format === 'csv') {
        exportToCSV(selectedRecords, exportCols, { filename: `${recordType}s-export` });
      } else {
        exportToJSON(selectedRecords, exportCols, { filename: `${recordType}s-export` });
      }

      toast({
        title: 'Export Complete',
        description: `${selectedRecords.length} record(s) exported`,
      });
    },
    [records, bulkSelection.selectedIds, columns, recordType, toast],
  );

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
      confirmationTitle: `Delete ${title}`,
      confirmationDescription: `Are you sure you want to delete ${bulkSelection.selectedCount} record(s)? This action cannot be undone.`,
    },
  ];

  // ─── Navigation ───────────────────────────────────────────────────────────

  const navigateToDetail = useCallback(
    (record: any) => {
      const slug = record.urlSlug || record.url_slug || record.id;
      navigate(`${detailPath}/${slug}`);
    },
    [navigate, detailPath],
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Quick Filter Tabs */}
      {quickFilterTabs && quickFilterTabs.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {quickFilterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                    activeTab === tab.key
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-background text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Extra Header Content (e.g. import buttons) */}
      {extraHeaderContent}

      {/* Search + Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {/* Search Row */}
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={`Search ${title.toLowerCase()} by name, email, phone, industry...`}
                  className="pl-10"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                {searchInput && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setSearchInput('')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-2 flex-wrap sm:flex-nowrap items-center">
                {filters.map((filter) => (
                  <Select
                    key={filter.key}
                    value={activeFilters[filter.key] || 'all'}
                    onValueChange={(value) => handleFilterChange(filter.key, value)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder={filter.label} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All {filter.label}</SelectItem>
                      {filter.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}

                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1.5">
                    <X className="h-3.5 w-3.5" />
                    Clear ({activeFilterCount})
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toolbar: record count + view toggle + create */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {pagination.total > 0 && (
            <>
              <Badge variant="secondary" className="text-xs">
                {Math.min((page - 1) * pageSize + 1, pagination.total)}-
                {Math.min(page * pageSize, pagination.total)} of {pagination.total}
              </Badge>
              {(debouncedSearch || activeFilterCount > 0) && (
                <Badge variant="outline" className="text-xs">
                  Filtered
                </Badge>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('cards')}
            title="Card view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('table')}
            title="Table view"
          >
            <Rows className="h-4 w-4" />
          </Button>

          {onCreateNew && (
            <Button size="default" className="flex items-center gap-2" onClick={onCreateNew}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{createLabel}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Operations */}
      <BulkOperationsToolbar
        selectedCount={bulkSelection.selectedCount}
        totalCount={records.length}
        onClearSelection={bulkSelection.clearSelection}
        onSelectAll={bulkSelection.selectAll}
        selectedIds={bulkSelection.selectedIds}
        actions={bulkActions}
      />

      {/* Loading State */}
      {isLoading && !response ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5">
                <div className="h-4 bg-muted rounded mb-3 w-3/4" />
                <div className="h-3 bg-muted rounded mb-2 w-1/2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : records.length > 0 ? (
        <>
          {/* Table View */}
          {viewMode === 'table' ? (
            <div className="bg-background rounded-md border overflow-x-auto">
              <UITable>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={bulkSelection.isAllSelected}
                        onCheckedChange={bulkSelection.toggleAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    {columns.map((col) => (
                      <TableHead key={col.key} style={col.width ? { width: col.width } : undefined}>
                        {col.sortable ? (
                          <SortableHeader
                            label={col.label}
                            sortKey={col.key}
                            currentSort={sortBy}
                            currentOrder={sortOrder}
                            onSort={handleSort}
                          />
                        ) : (
                          col.label
                        )}
                      </TableHead>
                    ))}
                    {rowActions.length > 0 && <TableHead className="w-16" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record: any) => (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigateToDetail(record)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={bulkSelection.isSelected(record.id)}
                          onCheckedChange={() => bulkSelection.toggleSelection(record.id)}
                          aria-label={`Select ${record.companyName}`}
                        />
                      </TableCell>
                      {columns.map((col) => (
                        <TableCell key={col.key}>
                          {col.render ? (
                            col.render(record[col.key], record)
                          ) : col.key === 'status' ? (
                            <StatusBadge status={record.status} configs={statusConfigs} />
                          ) : (
                            record[col.key] || '—'
                          )}
                        </TableCell>
                      ))}
                      {rowActions.length > 0 && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigateToDetail(record)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {rowActions
                                .filter((action) => !action.show || action.show(record))
                                .map((action) => (
                                  <DropdownMenuItem
                                    key={action.key}
                                    onClick={() => action.onClick(record)}
                                    className={
                                      action.variant === 'destructive' ? 'text-destructive' : ''
                                    }
                                  >
                                    {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                                    {action.label}
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </UITable>
            </div>
          ) : (
            /* Card View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {records.map((record: any) => (
                <Card
                  key={record.id}
                  className="hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => navigateToDetail(record)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
                          <span className="text-primary font-semibold text-sm">
                            {(record.companyName || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                            {record.companyName || 'Unnamed'}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <StatusBadge status={record.status} configs={statusConfigs} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card body - show key info based on columns */}
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      {record.primaryContactName && (
                        <p className="truncate">{record.primaryContactName}</p>
                      )}
                      {record.primaryContactEmail && (
                        <p className="truncate text-xs">{record.primaryContactEmail}</p>
                      )}
                      {(record.city || record.state) && (
                        <p className="truncate text-xs">
                          {[record.city, record.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {record.industry && <p className="truncate text-xs">{record.industry}</p>}
                    </div>

                    <div className="mt-3 pt-3 border-t flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToDetail(record);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>

                      {rowActions.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {rowActions
                              .filter((action) => !action.show || action.show(record))
                              .map((action) => (
                                <DropdownMenuItem
                                  key={action.key}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick(record);
                                  }}
                                  className={
                                    action.variant === 'destructive' ? 'text-destructive' : ''
                                  }
                                >
                                  {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                                  {action.label}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Card>
              <CardContent className="p-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {Math.min((page - 1) * pageSize + 1, pagination.total)}-
                    {Math.min(page * pageSize, pagination.total)} of{' '}
                    {pagination.total.toLocaleString()} records
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Prev
                    </Button>

                    {/* Page number buttons */}
                    {(() => {
                      const pages: number[] = [];
                      const start = Math.max(1, page - 2);
                      const end = Math.min(totalPages, page + 2);
                      for (let i = start; i <= end; i++) pages.push(i);
                      return pages.map((p) => (
                        <Button
                          key={p}
                          variant={p === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPage(p)}
                          className="min-w-[36px]"
                        >
                          {p}
                        </Button>
                      ));
                    })()}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(totalPages)}
                      disabled={page >= totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Search}
              title={
                debouncedSearch || activeFilterCount > 0
                  ? emptyTitle || `No ${title.toLowerCase()} match your search`
                  : emptyTitle || `No ${title.toLowerCase()} yet`
              }
              description={
                debouncedSearch || activeFilterCount > 0
                  ? emptyDescription || 'Try adjusting your search or filters'
                  : emptyDescription || `Get started by adding your first ${recordType}`
              }
              type={debouncedSearch || activeFilterCount > 0 ? 'filter' : 'default'}
              action={
                onCreateNew ? { label: createLabel, onClick: onCreateNew, icon: Plus } : undefined
              }
              secondaryAction={
                debouncedSearch || activeFilterCount > 0
                  ? { label: 'Clear Filters', onClick: clearAllFilters, variant: 'outline' }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
