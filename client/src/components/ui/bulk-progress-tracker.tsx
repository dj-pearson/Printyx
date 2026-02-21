import * as React from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BulkOperationProgress {
  operationId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  message?: string;
}

interface BulkProgressTrackerProps {
  progress: BulkOperationProgress | null;
  onDismiss: () => void;
  className?: string;
}

export function BulkProgressTracker({ progress, onDismiss, className }: BulkProgressTrackerProps) {
  if (!progress) return null;

  const percentage =
    progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  const isComplete =
    progress.status === 'completed' ||
    progress.status === 'failed' ||
    progress.status === 'cancelled';

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background shadow-lg p-4 transition-all',
        className,
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {progress.status === 'running' && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
          {progress.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {progress.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
          <span className="text-sm font-medium">
            {progress.status === 'running' && 'Processing...'}
            {progress.status === 'completed' && 'Completed'}
            {progress.status === 'failed' && 'Failed'}
            {progress.status === 'cancelled' && 'Cancelled'}
            {progress.status === 'pending' && 'Preparing...'}
          </span>
        </div>
        {isComplete && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onDismiss}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <Progress value={percentage} className="h-2 mb-2" />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {progress.processed} / {progress.total} items
        </span>
        <span>{percentage}%</span>
      </div>

      {progress.failed > 0 && (
        <p className="text-xs text-red-500 mt-1">{progress.failed} item(s) failed</p>
      )}

      {progress.message && <p className="text-xs text-muted-foreground mt-1">{progress.message}</p>}
    </div>
  );
}

/**
 * Hook to manage bulk operation progress state.
 * Simulates progress for client-side batch operations.
 */
export function useBulkProgress() {
  const [progress, setProgress] = React.useState<BulkOperationProgress | null>(null);

  const startOperation = React.useCallback((operationId: string, total: number) => {
    setProgress({
      operationId,
      status: 'running',
      total,
      processed: 0,
      succeeded: 0,
      failed: 0,
    });
  }, []);

  const updateProgress = React.useCallback(
    (processed: number, succeeded: number, failed: number, message?: string) => {
      setProgress((prev) => {
        if (!prev) return null;
        const newProcessed = processed;
        const isComplete = newProcessed >= prev.total;
        return {
          ...prev,
          status: isComplete ? (failed > 0 && succeeded === 0 ? 'failed' : 'completed') : 'running',
          processed: newProcessed,
          succeeded,
          failed,
          message,
        };
      });
    },
    [],
  );

  const dismiss = React.useCallback(() => {
    setProgress(null);
  }, []);

  /**
   * Execute a bulk operation with progress tracking.
   * Processes items in batches and reports progress.
   */
  const executeBulk = React.useCallback(
    async <T,>(
      operationId: string,
      items: T[],
      processFn: (batch: T[]) => Promise<{ succeeded: number; failed: number }>,
      batchSize = 50,
    ) => {
      const total = items.length;
      startOperation(operationId, total);

      let totalSucceeded = 0;
      let totalFailed = 0;

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        try {
          const result = await processFn(batch);
          totalSucceeded += result.succeeded;
          totalFailed += result.failed;
        } catch {
          totalFailed += batch.length;
        }
        updateProgress(Math.min(i + batchSize, total), totalSucceeded, totalFailed);
      }

      return { succeeded: totalSucceeded, failed: totalFailed };
    },
    [startOperation, updateProgress],
  );

  return {
    progress,
    startOperation,
    updateProgress,
    dismiss,
    executeBulk,
  };
}
