/**
 * The dispatch board (WF-V-03).
 *
 * WHAT THIS REPLACED, twice over. AUDIT-015 gated ~1,070 lines of fixtures here -
 * invented technicians on NYC coordinates, mock routes, mock alerts - and left a
 * ComingSoon in their place. Meanwhile no page anywhere wrote
 * service_tickets.assigned_technician_id except the mobile check-in's side effect,
 * and ServiceHub's "Smart Routing" modal offered "John Smith, 95% match, ETA 30
 * min" beside an Assign button with no handler. There has never been a working
 * assign step.
 *
 * WHAT IS STILL NOT HERE, said plainly because the page's old title promised it:
 * route optimization, live technician GPS and drive-time estimates. Nothing backs
 * any of the three - there is no routing endpoint and no technician location feed -
 * so they are absent rather than approximated. This board does the one thing the
 * data supports: it shows the queue, shows how loaded each technician is, and
 * assigns.
 *
 * Every number on it comes from service_tickets. The load counts are computed
 * server-side by /api/service-tickets/dispatch-load rather than from this page's
 * own ticket list, because that list is scoped to the caller and counting from it
 * would under-report anyone whose other work the dispatcher cannot see.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { apiRequest, extractRecords } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Loader2, UserCheck } from 'lucide-react';

interface DispatchTicket {
  id: string;
  ticketNumber?: string | null;
  title?: string | null;
  status?: string | null;
  priority?: string | null;
  scheduledDate?: string | null;
  customerName?: string | null;
  assignedTechnicianId?: string | null;
  assignedTechnician?: string | null;
}

interface Technician {
  id: string;
  userId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isActive?: boolean | null;
  isAvailable?: boolean | null;
}

interface LoadRow {
  technicianId: string;
  openCount: number;
  todayCount: number;
}

const OPEN_STATUSES = ['open', 'assigned', 'in_progress', 'on_site', 'pending', 'scheduled'];
const UNASSIGNED = '__unassigned__';

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export default function ServiceDispatchBoard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open');

  const ticketsQuery = useQuery({
    queryKey: ['/api/service-tickets', 'dispatch'],
    queryFn: async () =>
      extractRecords<DispatchTicket>(await apiRequest('/api/service-tickets?limit=200', 'GET')),
  });

  const techniciansQuery = useQuery({
    queryKey: ['/api/technicians', 'dispatch'],
    queryFn: async () =>
      extractRecords<Technician>(await apiRequest('/api/technicians?limit=200', 'GET')),
  });

  const loadQuery = useQuery({
    queryKey: ['/api/service-tickets/dispatch-load'],
    queryFn: () => apiRequest('/api/service-tickets/dispatch-load', 'GET'),
  });

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const technicians = useMemo(
    () => (techniciansQuery.data ?? []).filter((t) => t.isActive !== false),
    [techniciansQuery.data],
  );
  const loadByTechnician = useMemo(() => {
    const rows: LoadRow[] = Array.isArray(loadQuery.data?.load) ? loadQuery.data.load : [];
    return new Map(rows.map((r) => [r.technicianId, r]));
  }, [loadQuery.data]);

  const assign = useMutation({
    mutationFn: ({ ticketId, technicianId }: { ticketId: string; technicianId: string | null }) =>
      apiRequest(`/api/service-tickets/${ticketId}`, 'PATCH', {
        assignedTechnicianId: technicianId,
        // Unassigning returns the ticket to the queue rather than leaving it
        // "assigned" to nobody.
        status: technicianId ? 'assigned' : 'open',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-tickets/dispatch-load'] });
      toast({ title: 'Ticket dispatched' });
    },
    onError: (error: Error) =>
      toast({ title: 'Could not assign', description: error.message, variant: 'destructive' }),
  });

  const queue = useMemo(() => {
    return tickets
      .filter((t) => {
        const status = (t.status ?? 'open').toLowerCase();
        if (statusFilter === 'open' && !OPEN_STATUSES.includes(status)) return false;
        if (statusFilter === 'unassigned' && t.assignedTechnicianId) return false;
        if (priorityFilter !== 'all' && (t.priority ?? 'medium') !== priorityFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const byPriority =
          (PRIORITY_RANK[a.priority ?? 'medium'] ?? 9) -
          (PRIORITY_RANK[b.priority ?? 'medium'] ?? 9);
        if (byPriority !== 0) return byPriority;
        return (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '');
      });
  }, [tickets, statusFilter, priorityFilter]);

  const nameOf = (t: Technician) => [t.firstName, t.lastName].filter(Boolean).join(' ') || t.id;

  const loading = ticketsQuery.isLoading || techniciansQuery.isLoading;

  return (
    <MainLayout
      title="Service dispatch"
      description="Assign the queue. Route optimization and technician GPS are not built."
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Technicians</CardTitle>
            <CardDescription>
              Open tickets per technician, counted across the whole tenant rather than from the
              queue below.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {technicians.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">
                No technicians are visible to you. Roster access follows your team and location.
              </p>
            )}
            {technicians.map((tech) => {
              const load = loadByTechnician.get(tech.userId ?? tech.id);
              return (
                <div
                  key={tech.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{nameOf(tech)}</p>
                    <p className="text-xs text-muted-foreground">
                      {load ? `${load.openCount} open · ${load.todayCount} today` : 'No open work'}
                    </p>
                  </div>
                  {tech.isAvailable === false && (
                    <Badge variant="outline" className="shrink-0">
                      Unavailable
                    </Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="min-h-[44px] w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open work</SelectItem>
              <SelectItem value="unassigned">Unassigned only</SelectItem>
              <SelectItem value="all">Everything</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="min-h-[44px] w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          {typeof loadQuery.data?.unassigned === 'number' && (
            <Badge variant="secondary" className="ml-auto">
              {loadQuery.data.unassigned} unassigned
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the queue…
          </div>
        ) : queue.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nothing matches this filter.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {queue.map((ticket) => (
              <Card key={ticket.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">
                        {ticket.title || ticket.ticketNumber || ticket.id}
                      </p>
                      <Badge
                        variant={
                          ticket.priority === 'urgent' || ticket.priority === 'high'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {ticket.priority ?? 'medium'}
                      </Badge>
                      <Badge variant="outline">{ticket.status ?? 'open'}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {ticket.customerName ?? 'No customer'}
                      {ticket.scheduledDate ? ` · ${ticket.scheduledDate.slice(0, 10)}` : ''}
                    </p>
                  </div>

                  <label className="flex items-center gap-2 sm:w-64">
                    <span className="sr-only">Assign {ticket.title || ticket.id}</span>
                    <Select
                      value={ticket.assignedTechnicianId ?? UNASSIGNED}
                      onValueChange={(value) =>
                        assign.mutate({
                          ticketId: ticket.id,
                          technicianId: value === UNASSIGNED ? null : value,
                        })
                      }
                      disabled={assign.isPending}
                    >
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {technicians.map((tech) => {
                          const id = tech.userId ?? tech.id;
                          const load = loadByTechnician.get(id);
                          return (
                            <SelectItem key={tech.id} value={id}>
                              {nameOf(tech)}
                              {load ? ` (${load.openCount})` : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </label>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Route optimization, live technician locations and drive-time estimates are not built.
            The previous version of this page displayed all three as if they were live; nothing
            backs them, so they are absent rather than estimated.
          </span>
        </p>

        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <UserCheck className="h-3.5 w-3.5" />
          Assigning notifies the technician and shows the call in their queue.
        </p>
      </div>
    </MainLayout>
  );
}
