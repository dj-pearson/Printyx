/**
 * Root Admin Security (round 218).
 *
 * This page read three endpoints none of which production served -
 * /api/admin/security/metrics, /api/admin/audit-logs and
 * /api/admin/security/threats all resolve to the `admin` edge function,
 * which has none of them - so it rendered its error state on every deployed
 * host. Behind that, what it would have shown was invented: a "Security
 * Score" from hand-picked weights, a threat level derived from it, and a
 * Threat Detection tab asserting a brute-force attack from 192.168.1.100 and
 * unusual API activity from tenant 1234 under an "AI-powered" caption, above
 * three buttons (Block Suspicious IP Addresses, Generate Security Report,
 * Configure Threat Rules) with no handler. Nothing blocks IPs (AUDIT-034).
 *
 * It now reads the root-admin function, which is platform-wide and root
 * gated: /overview for tenant and user counts, /security-alerts for the
 * security, authentication and authorization events audit_logs holds, and
 * /audit-logs for the trail. What nothing measures is said, not scored.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QueryStates } from '@/components/ui/query-state';
import { DashboardSkeleton } from '@/components/ui/skeletons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { exportToCSV, type ExportColumn } from '@/lib/export-utils';

interface Overview {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  activeUsers: number;
  criticalAlerts: number | null;
}

export interface SecurityEvent {
  id: string;
  type: string;
  severity: string | null;
  tenant: string;
  message: string;
  timestamp: string;
}

interface AuditRow {
  id: string;
  action: string;
  tableName: string | null;
  recordId: string | null;
  timestamp: string;
  userName: string | null;
}

/** How many of the events returned carry each severity; unknown kept, not dropped. */
export function severityCounts(events: readonly SecurityEvent[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    const k = (e.severity ?? 'unspecified').toLowerCase();
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export const SECURITY_EVENT_COLUMNS: ExportColumn<SecurityEvent>[] = [
  { key: 'timestamp', label: 'When' },
  { key: 'tenant', label: 'Tenant' },
  { key: 'type', label: 'Type' },
  { key: 'severity', label: 'Severity' },
  { key: 'message', label: 'Event' },
];

export const NOT_MEASURED = [
  'Security score and threat level: nothing computes a platform risk score.',
  'Active threats: no threat detection runs; the events below are what audit_logs recorded.',
  'IP blocking: the product has no IP block list to add to.',
  'API key and API request counts: not aggregated across tenants.',
];

const stamp = (t: string) => {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
};

export default function RootAdminSecurity() {
  const [activeTab, setActiveTab] = useState('overview');

  const overviewQuery = useQuery<Overview>({ queryKey: ['/api/root-admin/overview'] });
  const eventsQuery = useQuery<SecurityEvent[]>({ queryKey: ['/api/root-admin/security-alerts'] });
  const auditQuery = useQuery<AuditRow[]>({ queryKey: ['/api/root-admin/audit-logs'] });

  const overview = overviewQuery.data;
  const events = eventsQuery.data ?? [];
  const audit = auditQuery.data ?? [];
  const bySeverity = severityCounts(events);
  const high = (bySeverity.critical ?? 0) + (bySeverity.high ?? 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Root Admin Security</h1>
          <p className="text-gray-600 mt-2">
            Security events and the audit trail across every tenant on the platform
          </p>
        </div>

        <QueryStates
          queries={[overviewQuery, eventsQuery, auditQuery]}
          loading={<DashboardSkeleton />}
          errorTitle="Could not load security status"
          className="py-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                label: 'Tenants',
                value: overview?.totalTenants,
                note: `${overview?.activeTenants ?? '-'} active`,
              },
              {
                label: 'Users',
                value: overview?.totalUsers,
                note: `${overview?.activeUsers ?? '-'} active`,
              },
              { label: 'Security events', value: events.length, note: 'Most recent, up to 50' },
              { label: 'High or critical', value: high, note: 'Among those events' },
            ].map((c) => (
              <Card key={c.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{c.value ?? '-'}</div>
                  <p className="text-xs text-muted-foreground mt-2">{c.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Security Events</TabsTrigger>
              <TabsTrigger value="authentication">Authentication</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Security events</CardTitle>
                    <CardDescription>
                      Security, authentication and authorization entries in the audit log
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={events.length === 0}
                    onClick={() =>
                      exportToCSV(events, SECURITY_EVENT_COLUMNS, {
                        filename: 'platform-security-events',
                      })
                    }
                  >
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No security events recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {events.map((e) => (
                        <div key={e.id} className="flex items-center justify-between py-2 border-b">
                          <div>
                            <p className="font-medium">{e.message}</p>
                            <p className="text-sm text-muted-foreground">
                              {e.tenant} · {stamp(e.timestamp)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              e.severity === 'critical' || e.severity === 'high'
                                ? 'destructive'
                                : 'outline'
                            }
                          >
                            {e.severity ?? 'unspecified'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Not measured here</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {NOT_MEASURED.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="authentication" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Authentication Security</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* AUDIT-019 removed invented login figures and dead controls here. */}
                  <p className="text-sm text-muted-foreground">
                    Platform-wide authentication counters are not collected. Per-tenant session and
                    failed-login figures are on the tenant System Security page, which reads them
                    from the audit and session tables.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Permission Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      You have root-level access to modify permissions for all tenants and users.
                    </AlertDescription>
                  </Alert>
                  {/* AUDIT-019 removed an invented role census here. */}
                  <p className="text-sm text-muted-foreground">
                    Role assignment counts are not aggregated across tenants. Use the tenant user
                    administration screens for the accounts held under each role.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Audit Logs</CardTitle>
                  <CardDescription>The most recent 100 entries across all tenants</CardDescription>
                </CardHeader>
                <CardContent>
                  {audit.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No audit entries recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {audit.map((a) => (
                        <div key={a.id} className="flex items-center justify-between py-2 border-b">
                          <div>
                            <p className="font-medium">
                              {a.action}
                              {a.tableName ? ` on ${a.tableName}` : ''}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {a.userName ?? 'Unknown user'} · {stamp(a.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </QueryStates>
      </div>
    </MainLayout>
  );
}
