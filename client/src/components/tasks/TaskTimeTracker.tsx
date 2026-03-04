import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Play, Square, Plus, Trash2, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  description: string | null;
  hours: number;
  entryDate: string;
  startedAt: string | null;
  isRunning: boolean;
  createdAt: string;
  userName: string | null;
}

interface TaskTimeTrackerProps {
  taskId: string;
  compact?: boolean;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function TaskTimeTracker({ taskId, compact = false }: TaskTimeTrackerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [mode, setMode] = useState<'timer' | 'manual'>('timer');
  const [manualHours, setManualHours] = useState('0');
  const [manualMinutes, setManualMinutes] = useState('30');
  const [manualDescription, setManualDescription] = useState('');
  const [manualDate, setManualDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch time entries
  const { data: entries = [], isLoading: entriesLoading } = useQuery<TimeEntry[]>({
    queryKey: ['/api/tasks', taskId, 'time-entries'],
    queryFn: () => apiRequest(`/api/tasks/${taskId}/time-entries`),
    refetchInterval: 30000, // Refresh every 30s
  });

  // Find running entry
  const runningEntry = entries.find((e) => e.isRunning);

  // Timer tick effect
  useEffect(() => {
    if (runningEntry?.startedAt) {
      const updateElapsed = () => {
        const startTime = new Date(runningEntry.startedAt!).getTime();
        const now = Date.now();
        setElapsed(Math.floor((now - startTime) / 1000));
      };
      updateElapsed();
      intervalRef.current = setInterval(updateElapsed, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setElapsed(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [runningEntry?.id, runningEntry?.startedAt]);

  // Start timer mutation
  const startTimer = useMutation({
    mutationFn: () => apiRequest(`/api/tasks/${taskId}/timer/start`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId, 'time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: () => {
      toast({ title: 'Failed to start timer', variant: 'destructive' });
    },
  });

  // Stop timer mutation
  const stopTimer = useMutation({
    mutationFn: () => apiRequest(`/api/tasks/${taskId}/timer/stop`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId, 'time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: 'Timer stopped' });
    },
    onError: () => {
      toast({ title: 'Failed to stop timer', variant: 'destructive' });
    },
  });

  // Add manual entry mutation
  const addManualEntry = useMutation({
    mutationFn: (data: { minutes: number; description: string; date: string }) =>
      apiRequest(`/api/tasks/${taskId}/time`, 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId, 'time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setManualHours('0');
      setManualMinutes('30');
      setManualDescription('');
      setManualDate(format(new Date(), 'yyyy-MM-dd'));
      toast({ title: 'Time entry added' });
    },
    onError: () => {
      toast({ title: 'Failed to add time entry', variant: 'destructive' });
    },
  });

  // Delete entry mutation
  const deleteEntry = useMutation({
    mutationFn: (entryId: string) =>
      apiRequest(`/api/tasks/${taskId}/time-entries/${entryId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId, 'time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: 'Time entry deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete entry', variant: 'destructive' });
    },
  });

  const handleToggleTimer = useCallback(() => {
    if (runningEntry) {
      stopTimer.mutate();
    } else {
      startTimer.mutate();
    }
  }, [runningEntry, stopTimer, startTimer]);

  const handleAddManual = () => {
    const totalMinutes = parseInt(manualHours || '0') * 60 + parseInt(manualMinutes || '0');
    if (totalMinutes <= 0) {
      toast({ title: 'Enter a valid time', variant: 'destructive' });
      return;
    }
    addManualEntry.mutate({
      minutes: totalMinutes,
      description: manualDescription,
      date: manualDate,
    });
  };

  // Compact mode: just a play/stop button with elapsed time
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${runningEntry ? 'text-red-500 hover:text-red-600' : 'text-gray-500 hover:text-green-600'}`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleTimer();
          }}
          disabled={startTimer.isPending || stopTimer.isPending}
        >
          {startTimer.isPending || stopTimer.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : runningEntry ? (
            <Square className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" />
          )}
        </Button>
        {runningEntry && (
          <span className="text-xs font-mono text-green-600 animate-pulse">
            {formatElapsed(elapsed)}
          </span>
        )}
      </div>
    );
  }

  // Full mode
  const completedEntries = entries.filter((e) => !e.isRunning);

  return (
    <div className="space-y-4">
      {/* Mode Tabs */}
      <div className="flex gap-2">
        <Button
          variant={mode === 'timer' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('timer')}
          className="h-9 touch-manipulation"
        >
          <Clock className="h-4 w-4 mr-1.5" />
          Timer
        </Button>
        <Button
          variant={mode === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('manual')}
          className="h-9 touch-manipulation"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Manual Entry
        </Button>
      </div>

      {/* Timer Mode */}
      {mode === 'timer' && (
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50">
          <Button
            variant={runningEntry ? 'destructive' : 'default'}
            size="lg"
            className="h-14 w-14 rounded-full p-0 touch-manipulation active:scale-95 transition-transform"
            onClick={handleToggleTimer}
            disabled={startTimer.isPending || stopTimer.isPending}
          >
            {startTimer.isPending || stopTimer.isPending ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : runningEntry ? (
              <Square className="h-6 w-6 fill-current" />
            ) : (
              <Play className="h-6 w-6 fill-current ml-1" />
            )}
          </Button>
          <div className="flex-1">
            <div className="text-3xl font-mono font-semibold tabular-nums">
              {runningEntry ? (
                <span className="text-green-600">{formatElapsed(elapsed)}</span>
              ) : (
                <span className="text-gray-400">00:00:00</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {runningEntry ? 'Timer running...' : 'Click play to start tracking'}
            </p>
          </div>
        </div>
      )}

      {/* Manual Entry Mode */}
      {mode === 'manual' && (
        <div className="space-y-3 p-4 border rounded-lg">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Hours</Label>
              <Input
                type="number"
                min="0"
                max="24"
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value)}
                className="h-10 touch-manipulation"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Minutes</Label>
              <Input
                type="number"
                min="0"
                max="59"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value)}
                className="h-10 touch-manipulation"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Date</Label>
            <Input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="h-10 touch-manipulation"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Description (optional)</Label>
            <Textarea
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              placeholder="What did you work on?"
              rows={2}
              className="touch-manipulation resize-none"
            />
          </div>
          <Button
            onClick={handleAddManual}
            disabled={addManualEntry.isPending}
            className="w-full h-10 touch-manipulation active:scale-95 transition-transform"
          >
            {addManualEntry.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add Time Entry
          </Button>
        </div>
      )}

      {/* Time Entry History */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-9 text-sm touch-manipulation">
            <span>
              History ({completedEntries.length}{' '}
              {completedEntries.length === 1 ? 'entry' : 'entries'})
            </span>
            {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {entriesLoading ? (
            <div className="flex items-center justify-center py-4 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : completedEntries.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No time entries yet</p>
          ) : (
            <div className="space-y-2 mt-2 max-h-64 overflow-y-auto">
              {completedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-2.5 border rounded-md bg-white text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {formatMinutes(entry.hours)}
                      </Badge>
                      <span className="text-gray-500 text-xs truncate">
                        {entry.userName || 'Unknown'}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="text-xs text-gray-600 mt-1 truncate">{entry.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(entry.entryDate), 'MMM dd, yyyy')}
                      {entry.startedAt && ' (timer)'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 shrink-0 touch-manipulation"
                    onClick={() => deleteEntry.mutate(entry.id)}
                    disabled={deleteEntry.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Compact timer button for use in list/board views
export function TaskTimerButton({
  taskId,
  timeTracked = 0,
}: {
  taskId: string;
  timeTracked?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <TaskTimeTracker taskId={taskId} compact />
      <span className="text-xs text-gray-600">
        {Math.floor(timeTracked / 60)}h {timeTracked % 60}m
      </span>
    </div>
  );
}
