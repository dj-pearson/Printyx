import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Smartphone,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  Play,
  Pause,
} from 'lucide-react';

interface MobileLog {
  id: string;
  deviceId: string | null;
  sessionId: string | null;
  platform: string | null;
  appVersion: string | null;
  level: string;
  message: string;
  screen: string | null;
  data: any;
  logTimestamp: string | null;
  createdAt: string;
}

interface LogsResponse {
  logs: MobileLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const LEVEL_COLORS: Record<string, string> = {
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  warn: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  debug: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

function formatTimestamp(ts: string | null): string {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function JsonViewer({ data }: { data: any }) {
  if (!data) return null;
  return (
    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48 whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function MobileLogsViewer() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState<string>('');
  const [screen, setScreen] = useState('');
  const [search, setSearch] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const limit = 50;

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (level) params.set('level', level);
    if (screen) params.set('screen', screen);
    if (search) params.set('search', search);
    if (deviceId) params.set('deviceId', deviceId);
    if (sessionId) params.set('sessionId', sessionId);
    return params.toString();
  }, [page, level, screen, search, deviceId, sessionId]);

  const { data, isLoading, refetch } = useQuery<LogsResponse>({
    queryKey: ['admin-mobile-logs', page, level, screen, search, deviceId, sessionId],
    queryFn: async () => {
      const res = await apiRequest(`/api/admin/mobile-logs?${buildQueryString()}`);
      return res as LogsResponse;
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const purgeMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest(`/api/admin/mobile-logs?olderThanDays=${days}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mobile-logs'] });
    },
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [level, screen, search, deviceId, sessionId]);

  const logs = data?.logs || [];
  const pagination = data?.pagination || { page: 1, limit, total: 0, totalPages: 0 };

  return (
    <MainLayout>
      <div className="space-y-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Mobile App Logs</h1>
            <Badge variant="outline" className="ml-2">
              {pagination.total} total
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              {autoRefresh ? 'Pause' : 'Auto-refresh'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm('Purge logs older than 30 days?')) {
                  purgeMutation.mutate(30);
                }
              }}
              disabled={purgeMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Purge 30d+
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <Select value={level} onValueChange={(val) => setLevel(val === 'all' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search message..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Input
                placeholder="Screen..."
                value={screen}
                onChange={(e) => setScreen(e.target.value)}
              />
              <Input
                placeholder="Device ID..."
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              />
              <Input
                placeholder="Session ID..."
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Log Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="w-40">Timestamp</TableHead>
                    <TableHead className="w-20">Level</TableHead>
                    <TableHead className="w-28">Screen</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-24">Platform</TableHead>
                    <TableHead className="w-28">Device</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((logEntry) => {
                      const isExpanded = expandedRows.has(logEntry.id);
                      const hasData = logEntry.data && Object.keys(logEntry.data).length > 0;
                      return (
                        <>
                          <TableRow
                            key={logEntry.id}
                            className={`cursor-pointer hover:bg-muted/50 ${
                              logEntry.level === 'error' ? 'bg-red-50/50 dark:bg-red-950/20' : ''
                            }`}
                            onClick={() => hasData && toggleRow(logEntry.id)}
                          >
                            <TableCell className="px-2">
                              {hasData ? (
                                isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )
                              ) : null}
                            </TableCell>
                            <TableCell className="text-xs font-mono whitespace-nowrap">
                              {formatTimestamp(logEntry.logTimestamp || logEntry.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={LEVEL_COLORS[logEntry.level] || LEVEL_COLORS.debug}
                                variant="secondary"
                              >
                                {logEntry.level}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {logEntry.screen || '-'}
                            </TableCell>
                            <TableCell className="max-w-md truncate text-sm">
                              {logEntry.message}
                            </TableCell>
                            <TableCell className="text-xs">
                              {logEntry.platform || '-'}
                              {logEntry.appVersion ? ` v${logEntry.appVersion}` : ''}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {logEntry.deviceId?.slice(0, 12) || '-'}
                            </TableCell>
                          </TableRow>
                          {isExpanded && hasData && (
                            <TableRow key={`${logEntry.id}-data`}>
                              <TableCell colSpan={7} className="bg-muted/30 p-2">
                                <JsonViewer data={logEntry.data} />
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} logs)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
