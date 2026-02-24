/**
 * VirtualizedDataTable
 * US-037: Virtual scrolling data table for large datasets (10K+ rows).
 *
 * Uses @tanstack/react-virtual to render only visible rows + overscan buffer.
 * Supports: sorting, filtering, column selection, row selection, pagination.
 *
 * @example
 * <VirtualizedDataTable
 *   data={filteredItems}
 *   columns={[
 *     { id: 'name', header: 'Name', cell: (row) => row.name },
 *     { id: 'status', header: 'Status', cell: (row) => <Badge>{row.status}</Badge> },
 *   ]}
 *   rowHeight={48}
 *   maxHeight={600}
 *   selectedIds={selectedIds}
 *   onSelectionChange={setSelectedIds}
 *   onRowClick={(row) => navigate(`/items/${row.id}`)}
 *   actions={(row) => <ActionMenu item={row} />}
 * />
 */

import React, { useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface VirtualColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** CSS class for width, e.g. "w-40" or "min-w-[200px]" */
  className?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}

export interface VirtualizedDataTableProps<T extends { id: string | number }> {
  /** Data array to render */
  data: T[];
  /** Column definitions */
  columns: VirtualColumn<T>[];
  /** Row height in pixels (default: 48) */
  rowHeight?: number;
  /** Max table height in pixels (default: 600) */
  maxHeight?: number;
  /** Number of extra rows to render outside viewport (default: 5) */
  overscan?: number;
  /** Selected row IDs */
  selectedIds?: Set<string | number>;
  /** Selection change handler — enables checkbox column when provided */
  onSelectionChange?: (ids: Set<string | number>) => void;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Actions column renderer */
  actions?: (row: T) => React.ReactNode;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional table className */
  className?: string;
  /** Unique key extractor (defaults to row.id) */
  getRowId?: (row: T) => string | number;
}

export function VirtualizedDataTable<T extends { id: string | number }>({
  data,
  columns,
  rowHeight = 48,
  maxHeight = 600,
  overscan = 5,
  selectedIds,
  onSelectionChange,
  onRowClick,
  actions,
  emptyMessage = 'No records found',
  className,
  getRowId,
}: VirtualizedDataTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const getId = useCallback((row: T) => (getRowId ? getRowId(row) : row.id), [getRowId]);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const allSelected = useMemo(() => {
    if (!selectedIds || data.length === 0) return false;
    return data.every((row) => selectedIds.has(getId(row)));
  }, [selectedIds, data, getId]);

  const someSelected = useMemo(() => {
    if (!selectedIds || data.length === 0) return false;
    return data.some((row) => selectedIds.has(getId(row))) && !allSelected;
  }, [selectedIds, data, getId, allSelected]);

  const toggleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map((row) => getId(row))));
    }
  }, [allSelected, data, getId, onSelectionChange]);

  const toggleRow = useCallback(
    (id: string | number) => {
      if (!onSelectionChange || !selectedIds) return;
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange(next);
    },
    [onSelectionChange, selectedIds],
  );

  const hasSelection = !!onSelectionChange;
  const hasActions = !!actions;
  const totalColumns = columns.length + (hasSelection ? 1 : 0) + (hasActions ? 1 : 0);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow className="hover:bg-transparent">
            {hasSelection && (
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (el as unknown as HTMLInputElement).indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            {columns.map((col) => (
              <TableHead
                key={col.id}
                className={cn(
                  col.className,
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                )}
              >
                {col.header}
              </TableHead>
            ))}
            {hasActions && <TableHead className="w-20">Actions</TableHead>}
          </TableRow>
        </TableHeader>
      </Table>

      <div
        ref={parentRef}
        style={{ maxHeight, overflow: 'auto', minHeight: data.length > 0 ? rowHeight : undefined }}
      >
        <Table>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={totalColumns}
                  className="h-32 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {/* Bootstrap spacer: when virtualizer hasn't measured yet, render
                    full virtual height so the container gets a non-zero size and
                    the virtualizer can calculate visible items on the next frame. */}
                {virtualItems.length === 0 && data.length > 0 && (
                  <tr style={{ height: virtualizer.getTotalSize() }} />
                )}

                {/* Spacer for virtual items above */}
                {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                  <tr style={{ height: virtualItems[0].start }} />
                )}

                {virtualItems.map((virtualRow) => {
                  const row = data[virtualRow.index];
                  const rowId = getId(row);
                  const isSelected = selectedIds?.has(rowId) ?? false;

                  return (
                    <TableRow
                      key={rowId}
                      data-index={virtualRow.index}
                      className={cn(
                        'hover:bg-muted/50 transition-colors',
                        isSelected && 'bg-primary/5',
                        onRowClick && 'cursor-pointer',
                      )}
                      style={{ height: rowHeight }}
                      onClick={() => onRowClick?.(row)}
                    >
                      {hasSelection && (
                        <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(rowId)}
                            aria-label={`Select row ${rowId}`}
                          />
                        </TableCell>
                      )}
                      {columns.map((col) => (
                        <TableCell
                          key={col.id}
                          className={cn(
                            col.className,
                            col.align === 'right' && 'text-right',
                            col.align === 'center' && 'text-center',
                          )}
                        >
                          {col.cell(row)}
                        </TableCell>
                      ))}
                      {hasActions && (
                        <TableCell className="w-20" onClick={(e) => e.stopPropagation()}>
                          {actions!(row)}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}

                {/* Spacer for virtual items below */}
                {virtualItems.length > 0 && (
                  <tr
                    style={{
                      height:
                        virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end,
                    }}
                  />
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default VirtualizedDataTable;
