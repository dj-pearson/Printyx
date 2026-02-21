import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Shield,
  Filter,
  Search,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string;
  tenantId: string;
  ipAddress: string | null;
  userAgent: string | null;
  severity: string | null;
  category: string | null;
  oldValues: any;
  newValues: any;
  additionalContext: any;
  timestamp: string;
}

interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ACTION_TYPES = [
  'create',
  'update',
  'delete',
  'read',
  'login',
  'logout',
  'export',
  'import',
  'permission_change',
  'settings_change',
];

const RESOURCE_TYPES = [
  'user',
  'customer',
  'lead',
  'deal',
  'quote',
  'invoice',
  'equipment',
  'contract',
  'report',
  'settings',
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

export default function AuditLogViewer() {
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    action: '',
    userId: '',
    category: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.action) params.set('action', filters.action);
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.category) params.set('category', filters.category);
    return params.toString();
  };

  const { data, isLoading, refetch } = useQuery<AuditLogResponse>({
    queryKey: ['/api/audit-logs', page, filters],
    queryFn: () => apiRequest(`/api/audit-logs?${buildQueryString()}`),
  });

  const logs = data?.logs || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  const handleExport = (format: 'csv' | 'json') => {
    if (!logs.length) return;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = [
        'Timestamp',
        'Action',
        'Resource',
        'Resource ID',
        'User ID',
        'Tenant ID',
        'IP Address',
        'Severity',
        'Category',
      ];
      const rows = logs.map((log) => [
        log.timestamp,
        log.action,
        log.resource,
        log.resourceId || '',
        log.userId,
        log.tenantId,
        log.ipAddress || '',
        log.severity || '',
        log.category || '',
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(','))
        .join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', action: '', userId: '', category: '' });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Log Viewer</h1>
            <p className="text-sm text-gray-500">
              {total} total events {hasActiveFilters && '(filtered)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {hasActiveFilters && (
              <Badge className="ml-1 h-5 w-5 rounded-full p-0 text-xs bg-blue-500">!</Badge>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
            <Download className="h-4 w-4 mr-1" />
            JSON
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Narrow down audit log events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => {
                    setFilters({ ...filters, startDate: e.target.value });
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => {
                    setFilters({ ...filters, endDate: e.target.value });
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">User ID</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Filter by user..."
                    className="pl-8"
                    value={filters.userId}
                    onChange={(e) => {
                      setFilters({ ...filters, userId: e.target.value });
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Action Type</Label>
                <Select
                  value={filters.action || 'all'}
                  onValueChange={(v) => {
                    setFilters({ ...filters, action: v === 'all' ? '' : v });
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {ACTION_TYPES.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select
                  value={filters.category || 'all'}
                  onValueChange={(v) => {
                    setFilters({ ...filters, category: v === 'all' ? '' : v });
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="authentication">Authentication</SelectItem>
                    <SelectItem value="data_modification">Data Modification</SelectItem>
                    <SelectItem value="data_access">Data Access</SelectItem>
                    <SelectItem value="admin_action">Admin Action</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden lg:table-cell">IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Loading audit logs...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{log.resource}</div>
                        {log.resourceId && (
                          <div className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                            {log.resourceId}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-mono truncate max-w-[120px]">{log.userId}</div>
                      </TableCell>
                      <TableCell>
                        {log.severity && (
                          <Badge
                            className={`text-xs ${SEVERITY_COLORS[log.severity] || 'bg-gray-100 text-gray-800'}`}
                          >
                            {log.severity}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {log.category?.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs font-mono text-muted-foreground">
                          {log.ipAddress}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
