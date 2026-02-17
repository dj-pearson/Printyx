/**
 * CrmDataTable - Generic CRM data table that works with any object type.
 * Uses the CRM object registry for field definitions and rendering.
 * Part of CRM-002/CRM-006: Table view with inline editing support.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getCrmObjectConfig, type CrmObjectType, type CrmFieldDef } from '@/lib/crm-object-registry';
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
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Eye, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CrmDataTableProps {
  objectType: CrmObjectType;
  search: string;
  activeFilters: Record<string, any>;
  sortConfig: { field: string; direction: 'asc' | 'desc' } | null;
  onSortChange?: (config: { field: string; direction: 'asc' | 'desc' }) => void;
  /** Selected record IDs for bulk operations */
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function CrmDataTable({
  objectType,
  search,
  activeFilters,
  sortConfig,
  onSortChange,
  selectedIds,
  onSelectionChange,
}: CrmDataTableProps) {
  const config = getCrmObjectConfig(objectType);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [localSortField, setLocalSortField] = useState(sortConfig?.field ?? 'createdAt');
  const [localSortDir, setLocalSortDir] = useState<'asc' | 'desc'>(sortConfig?.direction ?? 'desc');
  const pageSize = 25;

  const sortField = sortConfig?.field ?? localSortField;
  const sortDir = sortConfig?.direction ?? localSortDir;

  // Build query parameters
  const queryKey = useMemo(() => [
    config.apiEndpoint,
    { page, pageSize, search, sortBy: sortField, sortOrder: sortDir, ...activeFilters, recordType: config.recordType },
  ], [config.apiEndpoint, page, pageSize, search, sortField, sortDir, activeFilters, config.recordType]);

  const { data, isLoading } = useQuery({
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
      const records = Array.isArray(result) ? result : result?.records ?? result?.data ?? [];
      const total = result?.pagination?.total ?? result?.total ?? records.length;
      return { records, total };
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
  });

  const records = data?.records ?? [];
  const totalRecords = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  // Column sort handler
  const handleSort = useCallback((field: string) => {
    const newDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc';
    setLocalSortField(field);
    setLocalSortDir(newDir);
    onSortChange?.({ field, direction: newDir });
  }, [sortField, sortDir, onSortChange]);

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

  const handleSelectRow = useCallback((id: string) => {
    if (!onSelectionChange) return;
    const newIds = new Set(selectedIds);
    if (newIds.has(id)) newIds.delete(id);
    else newIds.add(id);
    onSelectionChange(newIds);
  }, [selectedIds, onSelectionChange]);

  // Cell rendering
  const renderCell = useCallback((field: CrmFieldDef, value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground text-xs">-</span>;
    }

    switch (field.type) {
      case 'currency':
        return (
          <span className="font-medium tabular-nums">
            ${typeof value === 'number' ? value.toLocaleString('en-US', { minimumFractionDigits: 0 }) : value}
          </span>
        );
      case 'date':
        try {
          return <span className="text-xs">{new Date(value).toLocaleDateString()}</span>;
        } catch {
          return <span className="text-xs">{value}</span>;
        }
      case 'badge':
        return (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {typeof value === 'string' ? value.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : String(value)}
          </Badge>
        );
      case 'email':
        return <a href={`mailto:${value}`} className="text-xs text-blue-600 hover:underline">{value}</a>;
      case 'phone':
        return <span className="text-xs tabular-nums">{value}</span>;
      case 'number':
        return <span className="text-xs tabular-nums">{typeof value === 'number' ? value.toLocaleString() : value}</span>;
      default:
        return <span className="text-xs truncate max-w-[200px] block">{String(value)}</span>;
    }
  }, []);

  const visibleFields = config.fields.filter((f) => config.defaultColumns.includes(f.field));

  if (isLoading && records.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
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
                  className={cn('text-xs', field.width, field.sortable && 'cursor-pointer select-none')}
                  onClick={() => field.sortable && handleSort(field.field)}
                >
                  <div className="flex items-center gap-1">
                    {field.label}
                    {field.sortable && (
                      sortField === field.field ? (
                        sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleFields.length + 2} className="h-32 text-center text-muted-foreground">
                  No {config.labelPlural.toLowerCase()} found
                </TableCell>
              </TableRow>
            ) : (
              records.map((record: any) => (
                <TableRow
                  key={record.id}
                  className={cn(
                    'cursor-pointer hover:bg-muted/50',
                    selectedIds?.has(record.id) && 'bg-primary/5',
                  )}
                  onClick={() => setLocation(`${config.detailPath}/${record.id}`)}
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
                      {renderCell(field, record[field.field])}
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
                        <DropdownMenuItem onClick={() => setLocation(`${config.detailPath}/${record.id}`)}>
                          <Eye className="h-4 w-4 mr-2" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLocation(`${config.detailPath}/${record.id}?edit=true`)}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
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
            Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalRecords)} of {totalRecords}
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
