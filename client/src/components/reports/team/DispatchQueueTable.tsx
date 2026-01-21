import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock } from 'lucide-react';

interface DispatchQueueItem {
  ticketId: string;
  ticketNumber: string;
  customerName: string;
  equipmentModel: string;
  location: string;
  priority: string;
  status: string;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  scheduledDate: Date | null;
  estimatedDuration: number;
  category: string;
  daysOpen: number;
  slaStatus: 'on_time' | 'at_risk' | 'overdue';
  slaDeadline: Date | null;
}

interface DispatchQueueTableProps {
  queue: DispatchQueueItem[];
  summary?: any;
  workloadMetrics?: any;
}

export default function DispatchQueueTable({
  queue,
  summary,
  workloadMetrics,
}: DispatchQueueTableProps) {
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterSLA, setFilterSLA] = useState<string>('all');

  const filteredQueue = useMemo(() => {
    let filtered = queue;
    if (filterPriority !== 'all') {
      filtered = filtered.filter((item) => item.priority === filterPriority);
    }
    if (filterSLA !== 'all') {
      filtered = filtered.filter((item) => item.slaStatus === filterSLA);
    }
    return filtered;
  }, [queue, filterPriority, filterSLA]);

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getSLAColor = (slaStatus: string) => {
    switch (slaStatus) {
      case 'overdue':
        return 'destructive';
      case 'at_risk':
        return 'yellow';
      case 'on_time':
        return 'success';
      default:
        return 'default';
    }
  };

  if (queue.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No tickets in queue</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Priority:</span>
          <Button
            variant={filterPriority === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterPriority('all')}
          >
            All
          </Button>
          <Button
            variant={filterPriority === 'critical' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterPriority('critical')}
          >
            Critical
          </Button>
          <Button
            variant={filterPriority === 'high' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterPriority('high')}
          >
            High
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">SLA:</span>
          <Button
            variant={filterSLA === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterSLA('all')}
          >
            All
          </Button>
          <Button
            variant={filterSLA === 'overdue' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterSLA('overdue')}
          >
            Overdue
          </Button>
          <Button
            variant={filterSLA === 'at_risk' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterSLA('at_risk')}
          >
            At Risk
          </Button>
        </div>
      </div>

      {/* Queue Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Days Open</TableHead>
              <TableHead>SLA Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQueue.map((item) => (
              <TableRow key={item.ticketId}>
                <TableCell className="font-medium">{item.ticketNumber}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{item.customerName}</div>
                    <div className="text-xs text-muted-foreground">{item.category}</div>
                  </div>
                </TableCell>
                <TableCell>{item.equipmentModel}</TableCell>
                <TableCell>
                  <Badge variant={getPriorityColor(item.priority) as any}>{item.priority}</Badge>
                </TableCell>
                <TableCell>
                  {item.assignedTechnicianName || (
                    <span className="text-muted-foreground text-xs">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.scheduledDate ? (
                    <div className="text-sm">
                      {format(new Date(item.scheduledDate), 'MMM dd, h:mm a')}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">Not scheduled</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{item.daysOpen}d</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getSLAColor(item.slaStatus) as any}>
                    {item.slaStatus.replace('_', ' ')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Total Tickets</div>
            <div className="text-2xl font-bold">{summary.totalTickets}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Unassigned</div>
            <div className="text-2xl font-bold text-orange-600">{summary.unassigned}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Overdue</div>
            <div className="text-2xl font-bold text-red-600">{summary.overdue}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Avg Days Open</div>
            <div className="text-2xl font-bold">{summary.averageDaysOpen?.toFixed(1)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
