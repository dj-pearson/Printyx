import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, AlertCircle, Star } from 'lucide-react';

interface ServiceCall {
  ticketId: string;
  ticketNumber: string;
  customerName: string;
  equipmentModel: string;
  serialNumber: string;
  priority: string;
  status: string;
  scheduledDate: Date | null;
  completedDate: Date | null;
  duration: number;
  category: string;
  resolutionType: string | null;
  firstTimeFixRate: boolean;
  customerSatisfaction: number | null;
}

interface ServiceCallsListProps {
  calls: ServiceCall[];
}

export default function ServiceCallsList({ calls }: ServiceCallsListProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Filter calls by status
  const filteredCalls = useMemo(() => {
    if (filterStatus === 'all') return calls;
    return calls.filter((call) => call.status === filterStatus);
  }, [calls, filterStatus]);

  // Get priority badge color
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

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'blue';
      case 'scheduled':
        return 'purple';
      case 'open':
        return 'default';
      case 'cancelled':
        return 'destructive';
      default:
        return 'default';
    }
  };

  // Format duration
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
        <Clock className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No Service Calls</p>
        <p className="text-sm">Service calls will appear here once assigned</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant={filterStatus === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('all')}
        >
          All ({calls.length})
        </Button>
        <Button
          variant={filterStatus === 'scheduled' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('scheduled')}
        >
          Scheduled ({calls.filter((c) => c.status === 'scheduled').length})
        </Button>
        <Button
          variant={filterStatus === 'in_progress' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('in_progress')}
        >
          In Progress ({calls.filter((c) => c.status === 'in_progress').length})
        </Button>
        <Button
          variant={filterStatus === 'completed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('completed')}
        >
          Completed ({calls.filter((c) => c.status === 'completed').length})
        </Button>
      </div>

      {/* Calls table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="text-center">FTF</TableHead>
              <TableHead className="text-center">Rating</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCalls.map((call) => (
              <TableRow key={call.ticketId}>
                <TableCell className="font-medium">{call.ticketNumber}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{call.customerName}</div>
                    <div className="text-xs text-muted-foreground">{call.category}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{call.equipmentModel}</div>
                    <div className="text-xs text-muted-foreground">SN: {call.serialNumber}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getPriorityColor(call.priority) as any}>{call.priority}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusColor(call.status) as any}>
                    {call.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {call.scheduledDate ? (
                    <div>
                      <div className="text-sm">
                        {format(new Date(call.scheduledDate), 'MMM dd')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(call.scheduledDate), 'h:mm a')}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">Not scheduled</span>
                  )}
                </TableCell>
                <TableCell>
                  {call.status === 'completed' && call.duration > 0 ? (
                    <div className="text-sm">{formatDuration(call.duration)}</div>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {call.status === 'completed' ? (
                    call.firstTimeFixRate ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-orange-600 mx-auto" />
                    )
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {call.customerSatisfaction ? (
                    <div className="flex items-center justify-center gap-1">
                      <Star
                        className={`h-3 w-3 ${
                          call.customerSatisfaction >= 4
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300'
                        }`}
                      />
                      <span className="text-xs font-medium">
                        {call.customerSatisfaction.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredCalls.length} of {calls.length} calls
      </div>
    </div>
  );
}
