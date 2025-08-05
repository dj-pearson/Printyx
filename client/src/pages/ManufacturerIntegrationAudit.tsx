import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  ClipboardList,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  Database,
  Printer,
  Settings,
  RefreshCw
} from 'lucide-react';

interface AuditLog {
  log: {
    id: string;
    action: string;
    status: string;
    message: string;
    details: any;
    responseTime: number;
    errorCode?: string;
    timestamp: string;
  };
  integration?: {
    id: string;
    manufacturer: string;
    integrationName: string;
    status: string;
  };
  device?: {
    id: string;
    deviceName: string;
    model: string;
    serialNumber: string;
  };
}

export default function ManufacturerIntegrationAudit() {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState('7');

  const { data: auditLogs = [], isLoading, refetch } = useQuery<AuditLog[]>({
    queryKey: ['/api/manufacturer-integrations/audit-logs', { action: actionFilter, status: statusFilter, days: daysFilter }],
    refetchInterval: 30000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'metrics_collected': case 'sync': return <Activity className="h-4 w-4" />;
      case 'device_registered': return <Printer className="h-4 w-4" />;
      case 'integration_created': case 'config_change': return <Settings className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = log.log.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.integration?.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.device?.deviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.log.action?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.log.action === actionFilter;
    const matchesStatus = statusFilter === 'all' || log.log.status === statusFilter;
    
    return matchesSearch && matchesAction && matchesStatus;
  });

  const statusCounts = auditLogs.reduce((acc, log) => {
    acc[log.log.status] = (acc[log.log.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const actionCounts = auditLogs.reduce((acc, log) => {
    acc[log.log.action] = (acc[log.log.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ClipboardList className="h-8 w-8" />
            Integration Audit Logs
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor all manufacturer integration activities and troubleshoot issues
          </p>
        </div>
        <Button onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditLogs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statusCounts.success || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statusCounts.error || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{statusCounts.warning || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Logs
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="sync">Sync</SelectItem>
              <SelectItem value="metrics_collected">Metrics Collected</SelectItem>
              <SelectItem value="device_registered">Device Registered</SelectItem>
              <SelectItem value="integration_created">Integration Created</SelectItem>
              <SelectItem value="config_change">Config Change</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
            </SelectContent>
          </Select>
          <Select value={daysFilter} onValueChange={setDaysFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Events</CardTitle>
          <CardDescription>
            {filteredLogs.length} of {auditLogs.length} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Integration</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Response Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((auditLog) => (
                <TableRow key={auditLog.log.id}>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(auditLog.log.timestamp).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getActionIcon(auditLog.log.action)}
                      <span className="capitalize">{auditLog.log.action.replace(/_/g, ' ')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(auditLog.log.status)}>
                      {getStatusIcon(auditLog.log.status)}
                      <span className="ml-1 capitalize">{auditLog.log.status}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {auditLog.integration ? (
                      <div>
                        <div className="font-medium capitalize">{auditLog.integration.manufacturer}</div>
                        <div className="text-sm text-muted-foreground">{auditLog.integration.integrationName}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {auditLog.device ? (
                      <div>
                        <div className="font-medium">{auditLog.device.deviceName}</div>
                        <div className="text-sm text-muted-foreground">{auditLog.device.model}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate">
                      {auditLog.log.message}
                    </div>
                    {auditLog.log.errorCode && (
                      <div className="text-xs text-red-600 mt-1">
                        Error: {auditLog.log.errorCode}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {auditLog.log.responseTime ? (
                      <span className="text-sm">{auditLog.log.responseTime}ms</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No audit logs found</h3>
              <p className="text-muted-foreground">
                {auditLogs.length === 0 
                  ? "No integration activities have been logged yet"
                  : "No logs match your current filters"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}