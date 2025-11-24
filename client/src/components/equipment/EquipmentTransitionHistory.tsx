import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  User,
  FileText,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EquipmentTransitionHistoryProps {
  equipmentId: string;
}

interface TransitionHistoryItem {
  id: string;
  fromStage: string | null;
  toStage: string;
  transitionType: string;
  triggeredBy: string | null;
  triggeredAt: Date;
  reason?: string | null;
  status: string;
  validationsPassed?: any;
  validationsFailed?: any;
  isRollback?: boolean;
  rollbackReason?: string | null;
}

export function EquipmentTransitionHistory({ equipmentId }: EquipmentTransitionHistoryProps) {
  const { data: transitions = [], isLoading, error } = useQuery<TransitionHistoryItem[]>({
    queryKey: [`/api/equipment-lifecycle/${equipmentId}/transitions`],
    enabled: !!equipmentId,
  });

  const formatStageName = (stage: string) => {
    return stage
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      ordered: 'bg-slate-100 text-slate-800',
      received: 'bg-blue-100 text-blue-800',
      staged: 'bg-cyan-100 text-cyan-800',
      in_transit: 'bg-purple-100 text-purple-800',
      delivered: 'bg-indigo-100 text-indigo-800',
      installed: 'bg-green-100 text-green-800',
      active: 'bg-emerald-100 text-emerald-800',
      maintenance: 'bg-orange-100 text-orange-800',
      retired: 'bg-gray-100 text-gray-800',
      disposed: 'bg-red-100 text-red-800',
      traded_in: 'bg-yellow-100 text-yellow-800',
    };
    return colors[stage] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string, isRollback: boolean = false) => {
    if (isRollback) {
      return <RotateCcw className="h-4 w-4 text-orange-600" />;
    }

    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'rolled_back':
        return <RotateCcw className="h-4 w-4 text-orange-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transition History</CardTitle>
          <CardDescription>Loading transition history...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load transition history. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (transitions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transition History</CardTitle>
          <CardDescription>Equipment lifecycle transitions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No transition history available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Transitions will appear here as the equipment moves through lifecycle stages
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transition History</CardTitle>
        <CardDescription>
          Complete audit trail of {transitions.length} lifecycle transition{transitions.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-6">
          {/* Vertical timeline line */}
          <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-border" />

          {transitions.map((transition, index) => (
            <div key={transition.id} className="relative flex items-start gap-4">
              {/* Timeline node */}
              <div className="relative z-10 flex-shrink-0">
                <div className={`
                  flex items-center justify-center h-10 w-10 rounded-full border-4 border-background
                  ${transition.status === 'completed' ? 'bg-green-100' :
                    transition.status === 'rolled_back' ? 'bg-orange-100' :
                    transition.status === 'failed' ? 'bg-red-100' : 'bg-blue-100'}
                `}>
                  {getStatusIcon(transition.status, transition.isRollback || false)}
                </div>
              </div>

              {/* Timeline content */}
              <div className="flex-1 pb-6">
                <div className={`
                  rounded-lg border p-4 shadow-sm
                  ${transition.status === 'rolled_back' ? 'bg-orange-50 border-orange-200' : 'bg-card'}
                `}>
                  {/* Transition header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {transition.fromStage ? (
                        <>
                          <Badge className={getStageColor(transition.fromStage)}>
                            {formatStageName(transition.fromStage)}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Initial State →</span>
                      )}
                      <Badge className={getStageColor(transition.toStage)}>
                        {formatStageName(transition.toStage)}
                      </Badge>

                      {transition.isRollback && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                          Rollback
                        </Badge>
                      )}
                    </div>

                    <Badge variant="secondary" className="flex-shrink-0">
                      {transition.transitionType}
                    </Badge>
                  </div>

                  {/* Transition details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {format(new Date(transition.triggeredAt), 'MMM dd, yyyy • h:mm a')}
                      </span>
                    </div>

                    {transition.triggeredBy && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span>Triggered by User ID: {transition.triggeredBy.substring(0, 8)}...</span>
                      </div>
                    )}

                    {transition.reason && (
                      <div className="flex items-start gap-2 text-muted-foreground mt-2">
                        <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span className="flex-1">{transition.reason}</span>
                      </div>
                    )}

                    {transition.rollbackReason && (
                      <div className="flex items-start gap-2 text-orange-700 mt-2 bg-orange-50 p-2 rounded">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-xs">Rollback Reason:</p>
                          <p className="text-sm">{transition.rollbackReason}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Validation information */}
                  {(transition.validationsPassed || transition.validationsFailed) && (
                    <div className="mt-3 pt-3 border-t space-y-1">
                      {transition.validationsPassed && Array.isArray(transition.validationsPassed) &&
                       transition.validationsPassed.length > 0 && (
                        <div className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Validations Passed ({transition.validationsPassed.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {transition.validationsPassed.map((validation: any, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {validation.name?.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {transition.validationsFailed && Array.isArray(transition.validationsFailed) &&
                       transition.validationsFailed.length > 0 && (
                        <div className="flex items-start gap-2 text-sm mt-2">
                          <AlertCircle className="h-3.5 w-3.5 text-red-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Validations Failed ({transition.validationsFailed.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {transition.validationsFailed.map((validation: any, i: number) => (
                                <Badge key={i} variant="destructive" className="text-xs">
                                  {validation.name?.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Status</span>
                      <Badge
                        variant={
                          transition.status === 'completed' ? 'default' :
                          transition.status === 'rolled_back' ? 'secondary' :
                          transition.status === 'failed' ? 'destructive' : 'outline'
                        }
                        className="text-xs"
                      >
                        {transition.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
