/**
 * Calendar (round 219).
 *
 * Every figure on this page was typed in: "3.5h saved" by AI optimisation,
 * 18 of 24 events AI-generated, 12 tasks completed, 4 focus blocks. Sync
 * Calendars waited 1.5 seconds and reported "Calendar sync completed
 * successfully!" without a request. Google Calendar and Outlook were badged
 * Connected for every user, a recommendation told them "ABC Corp lead needs
 * follow-up by Friday", and three quick actions (Schedule Focus Time, AI
 * Schedule Optimization, Smart Meeting Finder) had no handler.
 *
 * It now lists the caller's real calendar_connections, syncs each one through
 * POST /meetings/calendar/sync/:id and reports what that sync counted, and
 * connects a provider through the calendar-oauth consent flow. Nothing
 * optimises a schedule or finds meeting times, so nothing claims to.
 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CalendarView from '@/components/calendar/CalendarView';
import { CalendarProvider, useCalendar } from '@/components/calendar/CalendarProvider';
import { MainLayout } from '@/components/layout/main-layout';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, invalidateApiPath } from '@/lib/queryClient';
import { describeApiError } from '@/lib/api-error';
import { syncSummary, type SyncResult } from '@/lib/calendar-events';
import { Link2, RefreshCw, Unlink } from 'lucide-react';

interface ConnectionRow {
  id: string;
  provider: string;
  calendar_name?: string | null;
  sync_enabled?: boolean | null;
  last_sync_at?: string | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google Calendar',
  outlook: 'Microsoft Outlook',
  microsoft: 'Microsoft Outlook',
  icloud: 'iCloud',
};

export function lastSyncLabel(at: string | null | undefined): string {
  if (!at) return 'Never synced';
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? 'Never synced' : `Last synced ${d.toLocaleString()}`;
}

function Connections() {
  const { toast } = useToast();
  const { connectProvider, disconnectProvider } = useCalendar();
  const [syncing, setSyncing] = useState<string | null>(null);

  const connectionsQuery = useQuery<ConnectionRow[]>({
    queryKey: ['/api/meetings/calendar/connections'],
  });
  const connections = connectionsQuery.data ?? [];

  const sync = useMutation({
    mutationFn: (id: string) =>
      apiRequest<SyncResult>(`/api/meetings/calendar/sync/${id}`, 'POST', {}),
    onMutate: (id) => setSyncing(id),
    onSuccess: (result) => {
      toast({ title: 'Calendar synced', description: syncSummary(result) });
      invalidateApiPath('/api/meetings/calendar/connections');
      invalidateApiPath('/api/meetings/calendar/events');
    },
    onError: (err) =>
      toast({
        title: 'Sync failed',
        description: describeApiError(err).message,
        variant: 'destructive',
      }),
    onSettled: () => setSyncing(null),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Calendar connections</CardTitle>
        <CardDescription>Calendars you have connected to your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {connectionsQuery.isError ? (
          <InlineQueryError
            label="your calendar connections"
            onRetry={() => connectionsQuery.refetch()}
          />
        ) : connectionsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking connections...</p>
        ) : connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No calendar connected yet.</p>
        ) : (
          connections.map((c) => (
            <div key={c.id} className="space-y-2 border-b pb-3 last:border-b-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {c.calendar_name || PROVIDER_LABEL[c.provider] || c.provider}
                </span>
                <Badge variant="outline" className="text-xs">
                  {c.sync_enabled === false ? 'Sync off' : 'Connected'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{lastSyncLabel(c.last_sync_at)}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncing !== null}
                  onClick={() => sync.mutate(c.id)}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${syncing === c.id ? 'animate-spin' : ''}`} />
                  {syncing === c.id ? 'Syncing...' : 'Sync'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => disconnectProvider(c.id)}>
                  <Unlink className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              </div>
            </div>
          ))
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => connectProvider('google')}>
            <Link2 className="h-4 w-4 mr-2" />
            Connect Google Calendar
          </Button>
          <Button variant="outline" size="sm" onClick={() => connectProvider('outlook')}>
            <Link2 className="h-4 w-4 mr-2" />
            Connect Outlook
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CalendarPage() {
  return (
    <CalendarProvider>
      <MainLayout
        title="Calendar"
        description="Your events and the external calendars they sync from"
      >
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3">
            <CalendarView />
          </div>
          <div className="space-y-4">
            <Connections />
          </div>
        </div>
      </MainLayout>
    </CalendarProvider>
  );
}
