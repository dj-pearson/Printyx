import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Activity, KeyRound, ScrollText, Users } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { QueryState } from '@/components/ui/query-state';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * AUDIT-019. Every value on this page used to be a literal. It asserted
 * "System Health: Healthy, 95% optimal", "Database Security: Secured /
 * Encrypted", "Firewall: Protected - 847 blocked today", and an "SSL/TLS
 * Status: Active - Valid until 2025-12-31" whose date had already passed while
 * still rendering green. Nothing on the page had ever queried anything.
 *
 * What replaces it is the subset the platform can actually measure, from
 * GET /api/admin/system-health: users, sessions, failed logins, audit events
 * and open tickets, all scoped to the caller's tenant by the edge function.
 * Everything else - host patching, container posture, firewall counters, TLS
 * expiry, resource utilisation, connection-pool numbers - is deleted rather
 * than faked, per the rule AUDIT-016 and LEGAL-010 already applied here.
 *
 * The endpoint's top-level `status` field is deliberately NOT rendered: it is
 * initialised to the string 'healthy' server-side and only ever moves on two
 * audit thresholds, so displaying it would reintroduce the same unearned
 * all-clear this story removed. `alerts[]` below is the part of that logic
 * that is genuinely derived, so that is what the page shows.
 */

interface SystemHealth {
  timestamp: string;
  metrics: {
    users: { total: number; activeLastDay: number };
    sessions: { active: number; failedLoginsLastDay: number };
    audit: { eventsLastDay: number; criticalEventsLastWeek: number };
    service: { openTickets: number };
    storage: number | null;
  };
  alerts: string[];
}

function Metric({
  label,
  value,
  caption,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  caption: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );
}

export default function SystemSecurity() {
  const healthQuery = useQuery<SystemHealth>({
    queryKey: ['/api/admin/system-health'],
    refetchInterval: 60_000,
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Security</h1>
          <p className="mt-2 text-gray-600">
            Access, session and audit signals for this tenant, read from the platform database.
          </p>
        </div>

        <QueryState
          query={healthQuery}
          loading={
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          }
          errorTitle="Could not load system security signals"
          className="py-6"
        >
          {(health) => (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                <Metric
                  label="Active sessions"
                  value={health.metrics.sessions.active}
                  caption="Sessions currently marked active"
                  icon={Activity}
                />
                <Metric
                  label="Failed logins (24h)"
                  value={health.metrics.sessions.failedLoginsLastDay}
                  caption="Summed across sessions opened in the last 24 hours"
                  icon={KeyRound}
                />
                <Metric
                  label="Audit events (24h)"
                  value={health.metrics.audit.eventsLastDay}
                  caption="Rows written to the audit log in the last 24 hours"
                  icon={ScrollText}
                />
                <Metric
                  label="Critical events (7d)"
                  value={health.metrics.audit.criticalEventsLastWeek}
                  caption="Audit events at critical or high severity"
                  icon={AlertTriangle}
                />
              </div>

              {health.alerts.length > 0 && (
                <div className="space-y-3">
                  {health.alerts.map((alert) => (
                    <Alert key={alert} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{alert}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Accounts and workload</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-sm text-muted-foreground">Active user accounts</dt>
                      <dd className="font-semibold tabular-nums">{health.metrics.users.total}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-sm text-muted-foreground">Signed in (last 24h)</dt>
                      <dd className="font-semibold tabular-nums">
                        {health.metrics.users.activeLastDay}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-sm text-muted-foreground">Open service tickets</dt>
                      <dd className="font-semibold tabular-nums">
                        {health.metrics.service.openTickets}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-sm text-muted-foreground">Storage used</dt>
                      <dd className="font-semibold tabular-nums">
                        {health.metrics.storage === null
                          ? 'Not recorded'
                          : `${health.metrics.storage}`}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Read {new Date(health.timestamp).toLocaleString()}. Refreshes every minute.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>What this page does not tell you</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Host patching, container posture, firewall counters, TLS certificate expiry,
                    intrusion detection, CPU and disk utilisation, and database connection-pool
                    numbers are not collected by Printyx. This page used to show all of them as
                    fixed strings, including a certificate expiry date that had already passed. They
                    have been removed rather than left to be read as a measurement.
                  </p>
                  <p>
                    Infrastructure posture lives with the hosting provider and the Coolify
                    deployment; check it there. An absence here is not an all-clear.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Certification status is not tracked here</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {/* LEGAL-010: this panel hardcoded compliance badges for SOC 2 Type II,
                      ISO 27001, GDPR and CCPA, plus invented audit scores. None of it came
                      from data. An admin reading it would reasonably answer a customer
                      security questionnaire with it, which is how a fabricated dashboard
                      turns into a written misrepresentation. */}
                  <p>
                    Printyx does not currently hold a SOC 2 or ISO 27001 report. The controls that
                    are in place and verifiable in the platform are row-level security enforcing
                    tenant isolation, encryption in transit and at rest, multi-factor
                    authentication, role-based access control, and audit logging. For a customer
                    security questionnaire, answer from those, not from a badge.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </QueryState>
      </div>
    </MainLayout>
  );
}
