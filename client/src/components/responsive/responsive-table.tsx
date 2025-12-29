import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileTable from './mobile-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface ResponsiveColumn<T = any> {
  key: string;
  label: string;
  /** Custom render function for the cell */
  render?: (value: any, item: T) => ReactNode;
  /** Whether to show on mobile (default: true for high/medium priority) */
  mobile?: boolean;
  /** Priority for responsive display */
  priority?: 'high' | 'medium' | 'low';
  /** Render as badge on mobile */
  badge?: boolean;
  /** Icon to show with column on mobile */
  icon?: ReactNode;
  /** Desktop table header alignment */
  headerAlign?: 'left' | 'center' | 'right';
  /** Desktop table cell alignment */
  cellAlign?: 'left' | 'center' | 'right';
  /** Desktop column width class */
  width?: string;
  /** Whether the column is sortable */
  sortable?: boolean;
}

interface ResponsiveTableProps<T = any> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  /** Called when a row is clicked */
  onRowClick?: (item: T) => void;
  /** Additional className for the container */
  className?: string;
  /** Loading state */
  loading?: boolean;
  /** Message to show when data is empty */
  emptyMessage?: string;
  /** Key extractor for items (defaults to item.id) */
  getItemKey?: (item: T) => string | number;
  /** Currently sorted column key */
  sortKey?: string;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Called when sort changes */
  onSort?: (key: string) => void;
  /** Force mobile view (for testing) */
  forceMobile?: boolean;
  /** Force desktop view (for testing) */
  forceDesktop?: boolean;
}

/**
 * ResponsiveTable - Automatically switches between desktop table and mobile card view
 *
 * On mobile (< 768px): Renders as stacked cards using MobileTable
 * On desktop (>= 768px): Renders as traditional table
 *
 * @example
 * ```tsx
 * <ResponsiveTable
 *   data={customers}
 *   columns={[
 *     { key: 'name', label: 'Name', priority: 'high' },
 *     { key: 'email', label: 'Email', priority: 'medium' },
 *     { key: 'status', label: 'Status', priority: 'medium', badge: true },
 *     { key: 'createdAt', label: 'Created', priority: 'low' },
 *   ]}
 *   onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
 * />
 * ```
 */
export function ResponsiveTable<T extends { id?: string | number }>({
  data,
  columns,
  onRowClick,
  className,
  loading = false,
  emptyMessage = 'No data available',
  getItemKey,
  sortKey,
  sortDirection,
  onSort,
  forceMobile,
  forceDesktop,
}: ResponsiveTableProps<T>) {
  const isMobileDevice = useIsMobile();
  const showMobile = forceMobile ?? (!forceDesktop && isMobileDevice);

  // Convert columns to mobile format
  const mobileColumns = columns.map((col) => ({
    key: col.key,
    label: col.label,
    render: col.render,
    mobile: col.mobile ?? (col.priority === 'high' || col.priority === 'medium'),
    priority: col.priority,
    badge: col.badge,
    icon: col.icon,
  }));

  if (showMobile) {
    return (
      <MobileTable
        data={data}
        columns={mobileColumns}
        onRowClick={onRowClick}
        className={className}
        loading={loading}
        emptyMessage={emptyMessage}
      />
    );
  }

  // Desktop table view
  if (loading) {
    return (
      <div className={cn('rounded-md border', className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.width}>
                  <div className="h-4 bg-muted rounded w-20 animate-pulse" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, idx) => (
              <TableRow key={idx}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn('rounded-md border', className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(col.width, {
                    'text-left': col.headerAlign === 'left',
                    'text-center': col.headerAlign === 'center',
                    'text-right': col.headerAlign === 'right',
                  })}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className={cn('rounded-md border overflow-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(col.width, {
                  'text-left': col.headerAlign === 'left',
                  'text-center': col.headerAlign === 'center',
                  'text-right': col.headerAlign === 'right',
                  'cursor-pointer hover:bg-muted/50 select-none': col.sortable && onSort,
                })}
                onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => {
            const key = getItemKey ? getItemKey(item) : (item.id ?? index);
            return (
              <TableRow
                key={key}
                className={cn(onRowClick && 'cursor-pointer hover:bg-muted/50 transition-colors')}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn({
                      'text-left': col.cellAlign === 'left',
                      'text-center': col.cellAlign === 'center',
                      'text-right': col.cellAlign === 'right',
                    })}
                  >
                    {col.render
                      ? col.render(item[col.key as keyof T], item)
                      : String(item[col.key as keyof T] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default ResponsiveTable;
