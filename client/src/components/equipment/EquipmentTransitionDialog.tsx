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
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Clock,
  Loader2,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
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

interface TransitionValidation {
  canTransition: boolean;
  currentStage: string;
  targetStage: string;
  validationRequirements: string[];
  validation: {
    isValid: boolean;
    passed: ValidationCheck[];
    failed: ValidationCheck[];
  };
  message: string;
}

interface AvailableTransition {
  toStage: string;
  validationRequirements: string[];
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
  const { data: availableData, isLoading: loadingAvailable } = useQuery({
    queryKey: [`/api/equipment-lifecycle/${equipmentId}/available-transitions`],
    enabled: open && !!equipmentId,
  });

  const availableTransitions = availableData?.data?.availableTransitions || [];

  // Fetch validation details when a stage is selected
  const { data: validationData, isLoading: loadingValidation } = useQuery({
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
        queryClient.invalidateQueries({
          queryKey: [`/api/equipment-lifecycle/${equipmentId}`]
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/equipment-lifecycle/stages']
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/equipment-lifecycle/metrics']
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
    if (validationDetails && !validationDetails.validation.isValid) {
      toast({
        title: 'Validation Failed',
        description: 'Please complete all required validations before transitioning',
        variant: 'destructive',
      });
      return;
    }
    transitionMutation.mutate();
  };

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
            <Label className="text-base font-semibold mb-3 block">
              Select Target Stage
            </Label>

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
                      <span className="font-medium">
                        {formatStageName(transition.toStage)}
                      </span>
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
                  <Alert
                    variant={validationDetails.validation.isValid ? 'default' : 'destructive'}
                  >
                    {validationDetails.validation.isValid ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {validationDetails.message}
                    </AlertDescription>
                  </Alert>

                  {/* Validation Requirements */}
                  {validationDetails.validationRequirements.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Required Validations:
                      </Label>
                      <div className="space-y-2">
                        {validationDetails.validationRequirements.map((req, index) => {
                          const check = [
                            ...validationDetails.validation.passed,
                            ...validationDetails.validation.failed,
                          ].find(c => c.name === req);

                          const isPassed = check?.passed ?? false;

                          return (
                            <div
                              key={index}
                              className={`
                                flex items-start gap-2 p-2 rounded-lg border
                                ${
                                  isPassed
                                    ? 'border-green-200 bg-green-50'
                                    : 'border-orange-200 bg-orange-50'
                                }
                              `}
                            >
                              {isPassed ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              ) : (
                                <Clock className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">
                                  {formatStageName(req.replace(/_/g, ' '))}
                                </p>
                                {check?.message && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {check.message}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {validationDetails.validationRequirements.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Validation Progress</span>
                        <span className="font-medium">
                          {validationDetails.validation.passed.length} /{' '}
                          {validationDetails.validationRequirements.length}
                        </span>
                      </div>
                      <Progress
                        value={
                          (validationDetails.validation.passed.length /
                            validationDetails.validationRequirements.length) *
                          100
                        }
                        className="h-2"
                      />
                    </div>
                  )}
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
              (validationDetails && !validationDetails.validation.isValid) ||
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
