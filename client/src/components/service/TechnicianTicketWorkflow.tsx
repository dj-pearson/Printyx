import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, 
  CheckCircle, 
  Clock,
  AlertTriangle,
  Wrench,
  Camera,
  Package,
  User,
  Navigation,
  Star,
  FileText,
  Send,
  ThumbsUp,
  Settings
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import type { ServiceTicket } from "@shared/schema";

interface TechnicianTicketWorkflowProps {
  ticket: ServiceTicket;
  isOpen: boolean;
  onClose: () => void;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
}

const workflowSteps = [
  { 
    key: 'initial_assessment', 
    label: 'Initial Assessment', 
    icon: Wrench,
    description: 'Evaluate the situation and understand the issue'
  },
  { 
    key: 'diagnosis', 
    label: 'Diagnosis', 
    icon: Settings,
    description: 'Identify the root cause of the problem'
  },
  { 
    key: 'customer_approval', 
    label: 'Customer Approval', 
    icon: User,
    description: 'Get customer approval for proposed solution'
  },
  { 
    key: 'work_execution', 
    label: 'Work Execution', 
    icon: Wrench,
    description: 'Perform the actual repair or maintenance'
  },
  { 
    key: 'testing', 
    label: 'Testing', 
    icon: CheckCircle,
    description: 'Test the solution and verify it works'
  },
  { 
    key: 'completion', 
    label: 'Completion', 
    icon: Star,
    description: 'Finalize the service and get customer sign-off'
  }
];

export default function TechnicianTicketWorkflow({ ticket, isOpen, onClose }: TechnicianTicketWorkflowProps) {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('initial_assessment');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current location
  useEffect(() => {
    if (isOpen && !currentLocation) {
      getCurrentLocation();
    }
  }, [isOpen]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationError(null);
      },
      (error) => {
        setLocationError(error.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Fetch existing session for this ticket
  const { data: existingSession } = useQuery({
    queryKey: ["/api/service-tickets", ticket.id, "session"],
    enabled: isOpen && !!ticket.id,
  });

  useEffect(() => {
    if (existingSession) {
      setIsCheckedIn(true);
      setCurrentStep(existingSession.workflowStep || 'initial_assessment');
      setSessionId(existingSession.id);
    }
  }, [existingSession]);

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (locationData: LocationData) => {
      const response = await fetch(`/api/service-tickets/${ticket.id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualLatitude: locationData.latitude,
          actualLongitude: locationData.longitude,
          checkInAddress: locationData.address,
          checkInNotes: checkInForm.getValues('checkInNotes'),
        }),
      });
      
      if (!response.ok) throw new Error('Failed to check in');
      return response.json();
    },
    onSuccess: (session) => {
      setIsCheckedIn(true);
      setSessionId(session.id);
      toast({ 
        title: "Successfully checked in",
        description: "You're now ready to begin the service workflow",
      });
    },
  });

  // Update workflow step
  const updateStepMutation = useMutation({
    mutationFn: async ({ step, data }: { step: string; data: any }) => {
      const response = await fetch(`/api/technician-sessions/${sessionId}/update-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepName: step,
          stepData: data,
          notes: workflowForms[step]?.getValues('notes'),
        }),
      });
      
      if (!response.ok) throw new Error('Failed to update step');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-tickets", ticket.id] });
      toast({ title: "Step updated successfully" });
    },
  });

  // Request parts mutation
  const requestPartsMutation = useMutation({
    mutationFn: async (partsData: any) => {
      const response = await fetch(`/api/service-tickets/${ticket.id}/request-parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...partsData,
          sessionId,
          technicianId: 'current-technician-id', // Replace with actual ID
        }),
      });
      
      if (!response.ok) throw new Error('Failed to request parts');
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Parts request submitted",
        description: "Your parts request has been sent for approval",
      });
    },
  });

  // Complete ticket mutation
  const completeTicketMutation = useMutation({
    mutationFn: async (completionData: any) => {
      const response = await fetch(`/api/service-tickets/${ticket.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          ...completionData,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to complete ticket');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-tickets"] });
      toast({ 
        title: "Service ticket completed",
        description: "The ticket has been marked as complete",
      });
      onClose();
    },
  });

  // Forms for different steps
  const checkInForm = useForm({
    defaultValues: {
      checkInNotes: '',
    },
  });

  const workflowForms = {
    initial_assessment: useForm({
      defaultValues: {
        initialAssessment: '',
        notes: '',
      },
    }),
    diagnosis: useForm({
      defaultValues: {
        diagnosisNotes: '',
        rootCause: '',
        notes: '',
      },
    }),
    customer_approval: useForm({
      defaultValues: {
        customerApprovalNeeded: false,
        proposedSolution: '',
        estimatedCost: '',
        notes: '',
      },
    }),
    work_execution: useForm({
      defaultValues: {
        workPerformed: '',
        partsUsed: '',
        notes: '',
      },
    }),
    testing: useForm({
      defaultValues: {
        testResults: '',
        issueResolved: false,
        notes: '',
      },
    }),
    completion: useForm({
      defaultValues: {
        customerSatisfaction: 5,
        customerFeedback: '',
        followUpRequired: false,
        followUpReason: '',
        notes: '',
      },
    }),
  };

  const handleCheckIn = () => {
    if (!currentLocation) {
      toast({ 
        title: "Location required",
        description: "Please enable location services to check in",
        variant: "destructive",
      });
      return;
    }
    checkInMutation.mutate(currentLocation);
  };

  const handleStepUpdate = (step: string) => {
    const formData = workflowForms[step as keyof typeof workflowForms]?.getValues() || {};
    updateStepMutation.mutate({ step, data: formData });
  };

  const handleCompleteStep = () => {
    const currentStepIndex = workflowSteps.findIndex(step => step.key === currentStep);
    if (currentStepIndex < workflowSteps.length - 1) {
      const nextStep = workflowSteps[currentStepIndex + 1].key;
      handleStepUpdate(currentStep);
      setCurrentStep(nextStep);
    } else {
      // Final completion
      const completionData = workflowForms.completion.getValues();
      completeTicketMutation.mutate(completionData);
    }
  };

  const currentStepIndex = workflowSteps.findIndex(step => step.key === currentStep);
  const progressPercentage = ((currentStepIndex + 1) / workflowSteps.length) * 100;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Wrench className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{ticket.title}</h2>
                <p className="text-sm text-gray-600">
                  Ticket #{ticket.ticketNumber} • {ticket.customerAddress}
                </p>
              </div>
            </div>
            <Button variant="ghost" onClick={onClose}>✕</Button>
          </div>

          {!isCheckedIn ? (
            // Check-in flow
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location Check-in
                </CardTitle>
                <CardDescription>
                  Verify your location before starting the service
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    {currentLocation ? (
                      <div>
                        <div className="flex items-center gap-2 text-green-600 mb-2">
                          <Navigation className="h-4 w-4" />
                          <span className="font-medium">Location acquired</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Coordinates: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Accuracy: ±{Math.round(currentLocation.accuracy)}m
                        </p>
                      </div>
                    ) : locationError ? (
                      <div>
                        <div className="flex items-center gap-2 text-red-600 mb-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">Location error</span>
                        </div>
                        <p className="text-sm text-red-600">{locationError}</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={getCurrentLocation}
                          className="mt-2"
                        >
                          Retry
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 text-blue-600 mb-2">
                          <Clock className="h-4 w-4 animate-spin" />
                          <span className="font-medium">Getting location...</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Please allow location access when prompted
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="checkInNotes">Check-in Notes (Optional)</Label>
                  <Controller
                    name="checkInNotes"
                    control={checkInForm.control}
                    render={({ field }) => (
                      <Textarea
                        {...field}
                        placeholder="Any observations about the location, access, or initial setup..."
                        rows={3}
                      />
                    )}
                  />
                </div>

                <Button 
                  onClick={handleCheckIn}
                  disabled={!currentLocation || checkInMutation.isPending}
                  className="w-full"
                >
                  {checkInMutation.isPending ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Checking in...
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4 mr-2" />
                      Check In at Location
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            // Workflow steps
            <div className="space-y-6">
              {/* Progress bar */}
              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Service Progress</span>
                      <span>{Math.round(progressPercentage)}%</span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    {workflowSteps.map((step, index) => {
                      const Icon = step.icon;
                      const isActive = step.key === currentStep;
                      const isCompleted = index < currentStepIndex;
                      
                      return (
                        <div key={step.key} className="flex flex-col items-center space-y-2">
                          <div 
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isCompleted ? 'bg-green-600 text-white' :
                              isActive ? 'bg-blue-600 text-white' :
                              'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              <Icon className="h-5 w-5" />
                            )}
                          </div>
                          <div className="text-center">
                            <p className={`text-xs font-medium ${
                              isActive ? 'text-blue-600' : 'text-gray-600'
                            }`}>
                              {step.label}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Current step form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {React.createElement(workflowSteps[currentStepIndex].icon, { className: "h-5 w-5" })}
                    {workflowSteps[currentStepIndex].label}
                  </CardTitle>
                  <CardDescription>
                    {workflowSteps[currentStepIndex].description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Step-specific forms */}
                  {currentStep === 'initial_assessment' && (
                    <>
                      <div>
                        <Label htmlFor="initialAssessment">Initial Assessment</Label>
                        <Controller
                          name="initialAssessment"
                          control={workflowForms.initial_assessment.control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              placeholder="What do you observe? What is the customer's main concern?"
                              rows={4}
                            />
                          )}
                        />
                      </div>
                    </>
                  )}

                  {currentStep === 'diagnosis' && (
                    <>
                      <div>
                        <Label htmlFor="diagnosisNotes">Diagnosis Notes</Label>
                        <Controller
                          name="diagnosisNotes"
                          control={workflowForms.diagnosis.control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              placeholder="What tests did you perform? What did you find?"
                              rows={4}
                            />
                          )}
                        />
                      </div>
                      <div>
                        <Label htmlFor="rootCause">Root Cause</Label>
                        <Controller
                          name="rootCause"
                          control={workflowForms.diagnosis.control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              placeholder="What is the root cause of the issue?"
                              rows={3}
                            />
                          )}
                        />
                      </div>
                    </>
                  )}

                  {currentStep === 'customer_approval' && (
                    <>
                      <div>
                        <Label htmlFor="proposedSolution">Proposed Solution</Label>
                        <Controller
                          name="proposedSolution"
                          control={workflowForms.customer_approval.control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              placeholder="Describe the solution you're proposing to the customer..."
                              rows={4}
                            />
                          )}
                        />
                      </div>
                      <div>
                        <Label htmlFor="estimatedCost">Estimated Cost (if applicable)</Label>
                        <Controller
                          name="estimatedCost"
                          control={workflowForms.customer_approval.control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                            />
                          )}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Controller
                          name="customerApprovalNeeded"
                          control={workflowForms.customer_approval.control}
                          render={({ field }) => (
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              id="customerApprovalNeeded"
                            />
                          )}
                        />
                        <Label htmlFor="customerApprovalNeeded">
                          Customer approval required before proceeding
                        </Label>
                      </div>
                    </>
                  )}

                  {currentStep === 'work_execution' && (
                    <>
                      <div>
                        <Label htmlFor="workPerformed">Work Performed</Label>
                        <Controller
                          name="workPerformed"
                          control={workflowForms.work_execution.control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              placeholder="Describe the work you performed..."
                              rows={4}
                            />
                          )}
                        />
                      </div>
                      <div>
                        <Label htmlFor="partsUsed">Parts Used</Label>
                        <Controller
                          name="partsUsed"
                          control={workflowForms.work_execution.control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              placeholder="List any parts or materials used..."
                              rows={3}
                            />
                          )}
                        />
                      </div>
                      
                      {/* Quick parts request */}
                      <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span className="font-medium">Need Additional Parts?</span>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              // Open parts request dialog
                              const partNumber = prompt('Part Number:');
                              const partDescription = prompt('Part Description:');
                              const quantity = prompt('Quantity needed:');
                              
                              if (partNumber && partDescription && quantity) {
                                requestPartsMutation.mutate({
                                  partNumber,
                                  partDescription,
                                  quantityNeeded: parseInt(quantity),
                                  urgency: 'medium',
                                  justification: `Needed for ticket ${ticket.ticketNumber}`,
                                });
                              }
                            }}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Quick Request
                          </Button>
                        </div>
                        <p className="text-sm text-gray-600">
                          Request additional parts needed to complete this job
                        </p>
                      </div>
                    </>
                  )}

                  {currentStep === 'testing' && (
                    <>
                      <div>
                        <Label htmlFor="testResults">Test Results</Label>
                        <Controller
                          name="testResults"
                          control={workflowForms.testing.control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              placeholder="What tests did you perform? What were the results?"
                              rows={4}
                            />
                          )}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Controller
                          name="issueResolved"
                          control={workflowForms.testing.control}
                          render={({ field }) => (
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              id="issueResolved"
                            />
                          )}
                        />
                        <Label htmlFor="issueResolved" className="font-medium">
                          Issue has been resolved
                        </Label>
                      </div>
                    </>
                  )}

                  {currentStep === 'completion' && (
                    <>
                      <div>
                        <Label htmlFor="customerSatisfaction">Customer Satisfaction Rating</Label>
                        <div className="flex items-center gap-2 mt-2">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              type="button"
                              onClick={() => workflowForms.completion.setValue('customerSatisfaction', rating)}
                              className={`p-2 rounded ${
                                workflowForms.completion.watch('customerSatisfaction') >= rating
                                  ? 'text-yellow-500'
                                  : 'text-gray-300'
                              }`}
                            >
                              <Star className="h-6 w-6 fill-current" />
                            </button>
                          ))}
                          <span className="ml-2 text-sm text-gray-600">
                            ({workflowForms.completion.watch('customerSatisfaction')}/5)
                          </span>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="customerFeedback">Customer Feedback</Label>
                        <Controller
                          name="customerFeedback"
                          control={workflowForms.completion.control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              placeholder="Any feedback from the customer..."
                              rows={3}
                            />
                          )}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Controller
                          name="followUpRequired"
                          control={workflowForms.completion.control}
                          render={({ field }) => (
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              id="followUpRequired"
                            />
                          )}
                        />
                        <Label htmlFor="followUpRequired">
                          Follow-up service required
                        </Label>
                      </div>

                      {workflowForms.completion.watch('followUpRequired') && (
                        <div>
                          <Label htmlFor="followUpReason">Follow-up Reason</Label>
                          <Controller
                            name="followUpReason"
                            control={workflowForms.completion.control}
                            render={({ field }) => (
                              <Textarea
                                {...field}
                                placeholder="Why is follow-up needed?"
                                rows={3}
                              />
                            )}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Common notes field for all steps */}
                  <div>
                    <Label htmlFor="notes">Additional Notes</Label>
                    <Controller
                      name="notes"
                      control={workflowForms[currentStep as keyof typeof workflowForms]?.control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          placeholder="Any additional notes for this step..."
                          rows={2}
                        />
                      )}
                    />
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button 
                      variant="outline"
                      disabled={currentStepIndex === 0}
                      onClick={() => {
                        if (currentStepIndex > 0) {
                          setCurrentStep(workflowSteps[currentStepIndex - 1].key);
                        }
                      }}
                    >
                      Previous Step
                    </Button>
                    
                    <Button 
                      onClick={handleCompleteStep}
                      disabled={updateStepMutation.isPending || completeTicketMutation.isPending}
                    >
                      {currentStep === 'completion' ? (
                        completeTicketMutation.isPending ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Completing...
                          </>
                        ) : (
                          <>
                            <ThumbsUp className="h-4 w-4 mr-2" />
                            Complete Service
                          </>
                        )
                      ) : updateStepMutation.isPending ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          Next Step
                          <CheckCircle className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}