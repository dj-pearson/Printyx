import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Shield, ShieldAlert, Lock, AlertTriangle, Activity, Eye } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

/**
 * SEC-011: Security Event Monitoring Dashboard
 * Platform admin only - provides real-time security visibility
 */

interface SecurityOverview {
  overview: {
    failedLogins24h: number;
    lockedAccounts: number;
    auditEventsLastHour: number;
    securityEventBreakdown: Array<{ action: string; count: number }>;
  };
  generatedAt: string;
}

interface FailedLogin {
  id: string;
  email: string;
  attemptCount: number;
  lastAttemptAt: string;
  lastIpAddress: string | null;
  isLocked: boolean;
  lockType: 'permanent' | 'temporary' | 'expired' | 'none';
}

interface SecurityEvent {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  userId: string | null;
  tenantId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function SecurityDashboard() {
  const { data: overview } = useQuery<SecurityOverview>({
    queryKey: ['/api/security/overview'],
    queryFn: () => apiRequest('/api/security/overview'),
    refetchInterval: 30000, // Refresh every 30s
  });

  const { data: failedLogins } = useQuery<{ data: FailedLogin[] }>({
    queryKey: ['/api/security/failed-logins'],
    queryFn: () => apiRequest('/api/security/failed-logins?limit=20'),
    refetchInterval: 30000,
  });

  const { data: events } = useQuery<{ data: SecurityEvent[] }>({
    queryKey: ['/api/security/events'],
    queryFn: () => apiRequest('/api/security/events?limit=20'),
    refetchInterval: 30000,
  });

  const stats = overview?.overview;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Security Monitoring</h1>
          <p className="text-muted-foreground text-sm">
            Real-time security event monitoring and threat detection
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins (24h)</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failedLogins24h ?? '-'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Locked Accounts</CardTitle>
            <Lock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.lockedAccounts ?? '-'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Audit Events (1h)</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.auditEventsLastHour ?? '-'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <Eye className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.securityEventBreakdown?.reduce((sum, e) => sum + e.count, 0) ?? '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Breakdown */}
      {stats?.securityEventBreakdown && stats.securityEventBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security Event Breakdown (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.securityEventBreakdown.map((event) => (
                <Badge key={event.action} variant="outline" className="text-xs">
                  {event.action}: {event.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Failed Logins Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Recent Failed Login Attempts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedLogins?.data?.map((login) => (
                  <TableRow key={login.id}>
                    <TableCell className="font-mono text-xs">{login.email}</TableCell>
                    <TableCell>{login.attemptCount}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {login.lastIpAddress ?? '-'}
                    </TableCell>
                    <TableCell>
                      {login.isLocked ? (
                        <Badge variant="destructive" className="text-xs">
                          {login.lockType === 'permanent' ? 'Locked (Admin)' : 'Locked'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )) ?? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No failed login attempts
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Security Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Security Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events?.data?.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {event.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {event.userId ? `${event.userId.slice(0, 8)}...` : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {event.ipAddress ?? '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {event.createdAt
                        ? new Date(event.createdAt).toLocaleTimeString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                )) ?? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No recent events
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
