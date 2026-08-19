/**
 * CrmDataTable - Generic CRM data table that works with any object type.
 * Uses the CRM object registry for field definitions and rendering.
 * Part of CRM-002/CRM-006: Table view with inline editing support.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  getCrmObjectConfig,
  type CrmObjectType,
  type CrmFieldDef,
} from '@/lib/crm-object-registry';
import { useCustomFields, type CustomFieldObjectType } from '@/hooks/useCustomFields';
import {
  buildColumnCatalog,
  resolveVisibleColumns,
  buildWorkingColumnConfig,
  type ColumnConfigEntry,
  type TableFieldDef,
} from '@/lib/crm-columns';
import { ColumnPicker } from '@/components/crm/ColumnPicker';
import { useListKeyboardNav } from '@/hooks/useListKeyboardNav';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Rocket,
  AlertTriangle,
  RefreshCw,
  FilterX,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * COP-M01: a per-object row action, rendered in the row overflow menu beneath
 * the built-in View/Edit entries. Pages supply these so the shell reaches parity
 * with the legacy index pages (convert, deactivate, assign owner, delete, ...).
 */
/** A CRM row as returned by the list endpoints: an id plus registry/custom fields. */
export type CrmRecord = { id: string } & Record<string, unknown>;

export interface CrmRowAction {
  id: string;
  label: string;
  icon?: React.ElementType;
  variant?: 'default' | 'destructive';
  /** Hide the action for rows it does not apply to (e.g. Reactivate on an active record). */
  isAvailable?: (record: CrmRecord) => boolean;
  onClick: (record: CrmRecord) => void | Promise<void>;
}

interface CrmDataTableProps {
  objectType: CrmObjectType;
  search: string;
  activeFilters: Record<string, any>;
  sortConfig: { field: string; direction: 'asc' | 'desc' } | null;
  onSortChange?: (config: { field: string; direction: 'asc' | 'desc' }) => void;
  /** Selected record IDs for bulk operations */
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  /** COP-M01: per-object row actions appended to the row overflow menu. */
  rowActions?: CrmRowAction[];
  /** COP-M01: report the server-side total up so the shell's bulk toolbar can show it. */
  onTotalCountChange?: (total: number) => void;
  /** COP-I04: empty-state wiring supplied by the shell. */
  isFiltered?: boolean;
  onClearFilters?: () => void;
  onCreateNew?: () => void;
  /** CRMX-012: persisted column config for the active saved view. */
  columnConfig?: ColumnConfigEntry[] | null;
  /** CRMX-012: called when the user changes columns (parent persists it). */
  onColumnConfigChange?: (config: ColumnConfigEntry[]) => void;
  /** CRMX-012: whether column changes persist to a saved view. */
  columnsPersist?: boolean;
}

const CUSTOM_FIELD_OBJECT_TYPES: CustomFieldObjectType[] = [
  'deals',
  'leads',
  'contacts',
  'companies',
];

export function CrmDataTable({
  objectType,
  search,
  activeFilters,
  sortConfig,
  onSortChange,
  selectedIds,
  onSelectionChange,
  rowActions,
  onTotalCountChange,
  isFiltered,
  onClearFilters,
  onCreateNew,
  columnConfig,
  onColumnConfigChange,
  columnsPersist = true,
}: CrmDataTableProps) {
  const config = getCrmObjectConfig(objectType);
  // CRMX-012: custom fields (CRMX-004) join the column catalog for supported objects.
  const customFieldObjectType = CUSTOM_FIELD_OBJECT_TYPES.includes(
    objectType as CustomFieldObjectType,
  )
    ? (objectType as CustomFieldObjectType)
    : undefined;
  const { fields: customFieldDefs } = useCustomFields(customFieldObjectType);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  // COP-I02: j/k + arrow navigation over the rows.
  const listNavRef = useListKeyboardNav<HTMLDivElement>();
  const [page, setPage] = useState(1);
  const [localSortField, setLocalSortField] = useState(sortConfig?.field ?? 'createdAt');
  const [localSortDir, setLocalSortDir] = useState<'asc' | 'desc'>(sortConfig?.direction ?? 'desc');
  const pageSize = 25;

  const sortField = sortConfig?.field ?? localSortField;
  const sortDir = sortConfig?.direction ?? localSortDir;

  // Build query parameters
  const queryKey = useMemo(
    () => [
      config.apiEndpoint,
      {
        page,
        pageSize,
        search,
        sortBy: sortField,
        sortOrder: sortDir,
        ...activeFilters,
        recordType: config.recordType,
      },
    ],
    [
      config.apiEndpoint,
      page,
      pageSize,
      search,
      sortField,
      sortDir,
      activeFilters,
      config.recordType,
    ],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
        sortBy: sortField,
        sortOrder: sortDir,
      });
      if (search) params.set('search', search);
      if (config.recordType) params.set('recordType', config.recordType);
      for (const [key, value] of Object.entries(activeFilters)) {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      }
      const result = await apiRequest(`${config.apiEndpoint}?${params}`);
      // Normalize response format
      const records = Array.isArray(result) ? result : (result?.records ?? result?.data ?? []);
      const total = result?.pagination?.total ?? result?.total ?? records.length;
      return { records, total };
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
  });

  const records = data?.records ?? [];
  // COP-I04: prefer the shell's flag, but fall back to local state so the table
  // still tells the two empty cases apart when used outside the shell.
  const narrowed = isFiltered ?? (Boolean(search) || Object.keys(activeFilters).length > 0);
  const totalRecords = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  // COP-M01: surface the server-side total to the shell (bulk toolbar count).
  useEffect(() => {
    onTotalCountChange?.(totalRecords);
  }, [totalRecords, onTotalCountChange]);

  // Column sort handler
  const handleSort = useCallback(
    (field: string) => {
      const newDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc';
      setLocalSortField(field);
      setLocalSortDir(newDir);
      onSortChange?.({ field, direction: newDir });
    },
    [sortField, sortDir, onSortChange],
  );

  // Selection handlers
  const allOnPageSelected = records.length > 0 && records.every((r: any) => selectedIds?.has(r.id));

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (allOnPageSelected) {
      const newIds = new Set(selectedIds);
      records.forEach((r: any) => newIds.delete(r.id));
      onSelectionChange(newIds);
    } else {
      const newIds = new Set(selectedIds);
      records.forEach((r: any) => newIds.add(r.id));
      onSelectionChange(newIds);
    }
  }, [records, selectedIds, allOnPageSelected, onSelectionChange]);

  const handleSelectRow = useCallback(
    (id: string) => {
      if (!onSelectionChange) return;
      const newIds = new Set(selectedIds);
      if (newIds.has(id)) newIds.delete(id);
      else newIds.add(id);
      onSelectionChange(newIds);
    },
    [selectedIds, onSelectionChange],
  );

  // Cell rendering
  const renderCell = useCallback((field: TableFieldDef, value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground text-xs">-</span>;
    }

    switch (field.type) {
      case 'currency':
        return (
          <span className="font-medium tabular-nums">
            $
            {typeof value === 'number'
              ? value.toLocaleString('en-US', { minimumFractionDigits: 0 })
              : value}
          </span>
        );
      case 'date':
        try {
          return <span className="text-xs">{new Date(value).toLocaleDateString()}</span>;
        } catch {
          return <span className="text-xs">{value}</span>;
        }
      case 'badge':
        // COP-M01: a boolean flag column (contacts.isPrimaryContact) used to
        // render the literal "true"/"false". Show the column's own label when
        // the flag is set and nothing when it is not, which is what a reader
        // scanning the column is looking for.
        if (typeof value === 'boolean') {
          return value ? (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {field.label}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          );
        }
        return (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {typeof value === 'string'
              ? value.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
              : String(value)}
          </Badge>
        );
      case 'email':
        return (
          <a href={`mailto:${value}`} className="text-xs text-blue-600 hover:underline">
            {value}
          </a>
        );
      case 'phone':
        return <span className="text-xs tabular-nums">{value}</span>;
      case 'number':
        return (
          <span className="text-xs tabular-nums">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
        );
      default:
        return <span className="text-xs truncate max-w-[200px] block">{String(value)}</span>;
    }
  }, []);

  // CRMX-012: resolve the rendered columns from the catalog (registry + custom
  // fields) and the active view's persisted columnConfig (or object defaults).
  const catalog = useMemo(
    () => buildColumnCatalog(config.fields, customFieldDefs),
    [config.fields, customFieldDefs],
  );
  const visibleFields = useMemo(
    () => resolveVisibleColumns(catalog, columnConfig, config.defaultColumns),
    [catalog, columnConfig, config.defaultColumns],
  );
  const workingColumnConfig = useMemo(
    () => buildWorkingColumnConfig(catalog, columnConfig, config.defaultColumns),
    [catalog, columnConfig, config.defaultColumns],
  );

  if (isLoading && records.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  // COP-I04: a failed fetch used to fall through and render as an EMPTY table —
  // indistinguishable from "you have no records", which is a very different
  // thing to tell a user. Fail loudly and offer the retry.
  if (isError && records.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={AlertTriangle}
          type="error"
          title={`Could not load ${config.labelPlural.toLowerCase()}`}
          description={
            error instanceof Error
              ? error.message
              : 'The request failed. This is a loading problem, not an empty list.'
          }
          action={{ label: 'Try again', onClick: () => refetch(), icon: RefreshCw }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {onColumnConfigChange && (
        <div className="flex items-center justify-end px-2 py-1.5 border-b bg-background">
          <ColumnPicker
            workingConfig={workingColumnConfig}
            onChange={onColumnConfigChange}
            persists={columnsPersist}
          />
        </div>
      )}
      <div className="flex-1 overflow-auto" ref={listNavRef}>
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              {onSelectionChange && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {visibleFields.map((field) => (
                <TableHead
                  key={field.field}
                  className={cn('text-xs', field.width)}
                  aria-sort={
                    field.sortable && sortField === field.field
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {field.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(field.field)}
                      className="flex items-center gap-1 select-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    >
                      {field.label}
                      {sortField === field.field ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3 w-3" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">{field.label}</div>
                  )}
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleFields.length + 2} className="p-0">
                  {/* CRMX-014 + COP-I04: "no matches" and "none yet" are different
                      problems and get different actions — clearing filters is what
                      brings rows back, and a create button would not. */}
                  {narrowed ? (
                    <EmptyState
                      type="search"
                      title={`No ${config.labelPlural.toLowerCase()} match your filters`}
                      description="Nothing here matches the current search and filters. Your records are still there."
                      action={
                        onClearFilters
                          ? { label: 'Clear filters', onClick: onClearFilters, icon: FilterX }
                          : undefined
                      }
                    />
                  ) : (
                    <EmptyState
                      title={`No ${config.labelPlural.toLowerCase()} yet`}
                      description={`${config.labelPlural} you create will appear here, with saved views, filters and bulk actions.`}
                      action={
                        onCreateNew
                          ? {
                              label: `Create ${config.label.toLowerCase()}`,
                              onClick: onCreateNew,
                              icon: Plus,
                            }
                          : undefined
                      }
                      secondaryAction={{
                        label: 'Getting started guide',
                        onClick: () => setLocation('/getting-started'),
                        variant: 'outline',
                        icon: Rocket,
                      }}
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              records.map((record: any) => (
                <TableRow
                  key={record.id}
                  data-list-row
                  tabIndex={0}
                  aria-label={`View ${config.labelPlural.replace(/s$/i, '').toLowerCase()} details`}
                  className={cn(
                    'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    selectedIds?.has(record.id) && 'bg-primary/5',
                  )}
                  onClick={() => setLocation(`${config.detailPath}/${record.id}`)}
                  onKeyDown={(e) => {
                    // Keyboard operability (WCAG 2.1.1) for the row-level navigation.
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setLocation(`${config.detailPath}/${record.id}`);
                    }
                  }}
                >
                  {onSelectionChange && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds?.has(record.id)}
                        onCheckedChange={() => handleSelectRow(record.id)}
                      />
                    </TableCell>
                  )}
                  {visibleFields.map((field) => (
                    <TableCell key={field.field} className={field.width}>
                      {renderCell(
                        field,
                        field.customKey
                          ? record.customFields?.[field.customKey]
                          : record[field.field],
                      )}
                    </TableCell>
                  ))}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setLocation(`${config.detailPath}/${record.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setLocation(`${config.detailPath}/${record.id}?edit=true`)}
                        >
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        {/* COP-M01: per-object actions supplied by the page. */}
                        {(rowActions ?? [])
                          .filter((action) => action.isAvailable?.(record) ?? true)
                          .map((action) => {
                            const ActionIcon = action.icon;
                            return (
                              <DropdownMenuItem
                                key={action.id}
                                onClick={() => action.onClick(record)}
                                className={cn(
                                  action.variant === 'destructive' &&
                                    'text-destructive focus:text-destructive',
                                )}
                              >
                                {ActionIcon && <ActionIcon className="h-4 w-4 mr-2" />}
                                {action.label}
                              </DropdownMenuItem>
                            );
                          })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-background">
          <span className="text-xs text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalRecords)} of{' '}
            {totalRecords}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
