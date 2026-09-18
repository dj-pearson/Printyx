import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, Clock, Loader2 } from 'lucide-react';
import { apiRequest, invalidateApiPath } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface EquipmentTransitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: string;
  currentStage: string;
  onTransitionComplete?: () => void;
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  message?: string;
}

/** WF-L-13: one verdict per requirement. `satisfied` is three-valued. */
interface RequirementVerdict {
  name: string;
  /** true = evidence found, false = checkable and absent, null = unverifiable. */
  satisfied: boolean | null;
  evidence: string;
  /** Does an absent verdict stop the transition? False while awaiting a writer. */
  blocking?: boolean;
}

interface TransitionValidation {
  /** Allowed by the graph AND satisfied by the evidence. */
  canTransition: boolean;
  /** Allowed by the graph alone, whatever the evidence says. */
  graphAllows?: boolean;
  currentStage: string;
  targetStage: string;
  validationRequirements: string[];
  // PA-052 set this false whenever the backend listed requirements without
  // checking them. WF-L-13 made it true: eight of the twenty-five are queries
  // now, and the rest are reported as unverifiable rather than as met.
  requirementsChecked?: boolean;
  requirements?: RequirementVerdict[];
  satisfied?: string[];
  missing?: string[];
  unverifiable?: string[];
  /** Checkable and absent, but nothing writes the table yet. Not blocking. */
  awaitingWriter?: string[];
  blocked?: boolean;
  validation?: {
    isValid: boolean;
    requirementsChecked?: boolean;
    passed: ValidationCheck[];
    failed: ValidationCheck[];
  };
  message: string;
}

interface AvailableTransition {
  toStage: string;
  validationRequirements: string[];
  requirements?: RequirementVerdict[];
  missing?: string[];
  blocked?: boolean;
}

export function EquipmentTransitionDialog({
  open,
  onOpenChange,
  equipmentId,
  currentStage,
  onTransitionComplete,
}: EquipmentTransitionDialogProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [validationDetails, setValidationDetails] = useState<TransitionValidation | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch available transitions
  const { data: availableData, isLoading: loadingAvailable } = useQuery<{ data?: any }>({
    queryKey: [`/api/equipment-lifecycle/${equipmentId}/available-transitions`],
    enabled: open && !!equipmentId,
  });

  const availableTransitions = availableData?.data?.availableTransitions || [];

  // Fetch validation details when a stage is selected
  const { data: validationData, isLoading: loadingValidation } = useQuery<{ data?: any }>({
    queryKey: [`/api/equipment-lifecycle/${equipmentId}/can-transition/${selectedStage}`],
    enabled: !!selectedStage && open,
  });

  useEffect(() => {
    if (validationData?.data) {
      setValidationDetails(validationData.data);
    }
  }, [validationData]);

  // Mutation to execute transition
  const transitionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/equipment-lifecycle/${equipmentId}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          toStage: selectedStage,
          reason: reason || undefined,
        }),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Transition Successful',
          description: `Equipment transitioned to ${formatStageName(selectedStage!)}`,
        });

        // Invalidate relevant queries
        // This equipment's own queries are keyed on longer URLs
        // (/available-transitions, /can-transition/:stage), so the bare id key
        // matched neither - the dialog closed and the transition list behind it
        // stayed stale. A path prefix covers both.
        invalidateApiPath(`/api/equipment-lifecycle/${equipmentId}`);
        // /stages was invalidated here and in EquipmentLifecycleHub and nothing
        // queries it in any tree; dropped rather than left as decoration.
        queryClient.invalidateQueries({
          queryKey: ['/api/equipment-lifecycle/metrics'],
        });

        onTransitionComplete?.();
        onOpenChange(false);
        setSelectedStage(null);
        setReason('');
      } else {
        toast({
          title: 'Transition Failed',
          description: data.message || 'Unable to transition equipment',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Transition Error',
        description: error.message || 'An error occurred during transition',
        variant: 'destructive',
      });
    },
  });

  const handleTransition = () => {
    if (!selectedStage) return;
    if (validationDetails && !validationDetails.canTransition) {
      toast({
        title: 'Transition not allowed',
        description: `${formatStageName(validationDetails.currentStage)} cannot move directly to ${formatStageName(validationDetails.targetStage)}.`,
        variant: 'destructive',
      });
      return;
    }
    transitionMutation.mutate();
  };

  const formatStageName = (stage: string) => {
    return stage
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transition Equipment Lifecycle Stage</DialogTitle>
          <DialogDescription>
            Current stage: <span className="font-medium">{formatStageName(currentStage)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Available Transitions */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Select Target Stage</Label>

            {loadingAvailable ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableTransitions.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No available transitions from the current stage.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableTransitions.map((transition: AvailableTransition) => (
                  <button
                    key={transition.toStage}
                    onClick={() => setSelectedStage(transition.toStage)}
                    className={`
                      p-4 rounded-lg border-2 text-left transition-all
                      ${
                        selectedStage === transition.toStage
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{formatStageName(transition.toStage)}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {transition.validationRequirements.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {transition.validationRequirements.length} validation(s) required
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Validation Details */}
          {selectedStage && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Validation Status</Label>
                {loadingValidation && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {validationDetails && (
                <>
                  {/* Overall Status */}
                  <Alert variant={validationDetails.canTransition ? 'default' : 'destructive'}>
                    {validationDetails.canTransition ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>{validationDetails.message}</AlertDescription>
                  </Alert>

                  {/* WF-L-13: three states per requirement, from the server.
                      A green tick now means a record was found and says which
                      one; grey means nothing in this schema can answer it, and
                      that is said out loud rather than dressed as a pass. */}
                  {(validationDetails.requirements?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Requirements</Label>
                      {(validationDetails.unverifiable?.length ?? 0) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {validationDetails.unverifiable!.length} of these have no record in the
                          system that could satisfy them. They are not checked and they do not
                          block.
                        </p>
                      )}
                      <div className="space-y-2">
                        {validationDetails.requirements!.map((req) => (
                          <div
                            key={req.name}
                            className={
                              req.satisfied === true
                                ? 'flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-2'
                                : req.satisfied === false && req.blocking !== false
                                  ? 'flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2'
                                  : 'flex items-start gap-2 rounded-lg border p-2'
                            }
                          >
                            {req.satisfied === true ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                            ) : req.satisfied === false && req.blocking !== false ? (
                              <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                            ) : (
                              <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {formatStageName(req.name.replace(/_/g, ' '))}
                              </p>
                              <p className="text-xs text-muted-foreground">{req.evidence}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* A "Validation Progress" bar stood here, filled from
                      validation.passed.length. Every requirement was marked
                      passed by a mock, so it always read 100%. */}
                </>
              )}

              {/* Reason (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason for this transition..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedStage(null);
              setReason('');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransition}
            disabled={
              !selectedStage ||
              loadingValidation ||
              (validationDetails && !validationDetails.canTransition) ||
              transitionMutation.isPending
            }
          >
            {transitionMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transitioning...
              </>
            ) : (
              <>Execute Transition</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
