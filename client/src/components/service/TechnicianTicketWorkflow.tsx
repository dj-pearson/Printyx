import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, 
  Clock, 
  User, 
  Wrench,
  CheckCircle,
  AlertTriangle,
  Camera,
  FileText,
  Package,
  ThumbsUp,
  ThumbsDown,
  Timer,
  Navigation,
  Phone,
  Settings,
  Clipboard,
  Upload,
  Send
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface TechnicianTicketWorkflowProps {
  ticket: any;
  onClose: () => void;
}

const workflowSteps = [
  { id: 'check_in', name: 'Check-In', description: 'Arrive and check-in at customer location' },
  { id: 'initial_assessment', name: 'Initial Assessment', description: 'Assess the situation and equipment' },
  { id: 'diagnosis', name: 'Diagnosis', description: 'Diagnose the issue and identify solution' },
  { id: 'customer_approval', name: 'Customer Approval', description: 'Get customer approval for work and costs' },
  { id: 'work_execution', name: 'Work Execution', description: 'Perform the actual repair/service work' },
  { id: 'testing', name: 'Testing', description: 'Test the solution and verify functionality' },
  { id: 'completion', name: 'Completion', description: 'Complete the work and get customer sign-off' },
];

const checkInSchema = z.object({
  arrivalTime: z.string(),
  gpsLocation: z.string().optional(),
  notes: z.string().optional(),
});

const assessmentSchema = z.object({
  issueConfirmed: z.boolean(),
  equipmentCondition: z.enum(['good', 'fair', 'poor', 'critical']),
  initialFindings: z.string(),
  estimatedDuration: z.number(),
  photosUploaded: z.boolean().default(false),
});

const diagnosisSchema = z.object({
  rootCause: z.string(),
  proposedSolution: z.string(),
  partsNeeded: z.array(z.object({
    partNumber: z.string(),
    description: z.string(),
    quantity: z.number(),
    estimatedCost: z.number().optional(),
  })).default([]),
  laborHours: z.number(),
  totalEstimatedCost: z.number(),
  customerCommunication: z.string(),
});

const approvalSchema = z.object({
  customerApproval: z.boolean(),
  approvedBy: z.string(),
  approvalNotes: z.string().optional(),
  modifications: z.string().optional(),
});

const workExecutionSchema = z.object({
  workStartTime: z.string(),
  workDescription: z.string(),
  partsUsed: z.array(z.object({
    partNumber: z.string(),
    quantity: z.number(),
    serialNumber: z.string().optional(),
  })).default([]),
  actualLaborHours: z.number(),
  complications: z.string().optional(),
  photosUploaded: z.boolean().default(false),
});

const testingSchema = z.object({
  functionalityVerified: z.boolean(),
  testResults: z.string(),
  customerDemo: z.boolean(),
  issuesFound: z.string().optional(),
  additionalWorkNeeded: z.boolean().default(false),
});

const completionSchema = z.object({
  workCompleted: z.boolean(),
  customerSatisfaction: z.enum(['very_satisfied', 'satisfied', 'neutral', 'dissatisfied', 'very_dissatisfied']),
  customerSignature: z.string(),
  followUpRequired: z.boolean().default(false),
  followUpReason: z.string().optional(),
  notes: z.string(),
  endTime: z.string(),
});

export default function TechnicianTicketWorkflow({ ticket, onClose }: TechnicianTicketWorkflowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current session data
  const { data: session } = useQuery({
    queryKey: ["/api/technician-sessions", ticket.id],
    enabled: !!ticket.id,
  });

  // Get workflow steps for this session
  const { data: workflowStepsData } = useQuery({
    queryKey: ["/api/technician-sessions", sessionId, "workflow-steps"],
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (session) {
      setSessionId(session.id);
      if (workflowStepsData) {
        const completed = workflowStepsData
          .filter((step: any) => step.stepCompleted)
          .map((step: any) => step.stepName);
        setCompletedSteps(completed);
        
        // Set current step to first incomplete step
        const nextStepIndex = workflowSteps.findIndex(step => !completed.includes(step.id));
        if (nextStepIndex !== -1) {
          setCurrentStep(nextStepIndex);
        }
      }
    }
  }, [session, workflowStepsData]);

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!sessionId) {
        // Create new session first
        const sessionResponse = await fetch(`/api/service-tickets/${ticket.id}/check-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!sessionResponse.ok) throw new Error("Failed to check in");
        const sessionData = await sessionResponse.json();
        setSessionId(sessionData.sessionId);
        return sessionData;
      }
      return { sessionId };
    },
    onSuccess: () => {
      setCompletedSteps(prev => [...prev, 'check_in']);
      setCurrentStep(1);
      toast({ title: "Success", description: "Checked in successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/technician-sessions"] });
    },
  });

  // Step completion mutation
  const completeStepMutation = useMutation({
    mutationFn: async ({ stepName, stepData }: { stepName: string; stepData: any }) => {
      const response = await fetch(`/api/technician-sessions/${sessionId}/complete-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepName, stepData }),
      });
      if (!response.ok) throw new Error("Failed to complete step");
      return response.json();
    },
    onSuccess: (_, { stepName }) => {
      setCompletedSteps(prev => [...prev, stepName]);
      const nextStepIndex = currentStep + 1;
      if (nextStepIndex < workflowSteps.length) {
        setCurrentStep(nextStepIndex);
      }
      toast({ title: "Success", description: "Step completed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/technician-sessions"] });
    },
  });

  // Check-in form
  const checkInForm = useForm({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      arrivalTime: new Date().toISOString().slice(0, 16),
      gpsLocation: '',
      notes: '',
    },
  });

  // Assessment form
  const assessmentForm = useForm({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      issueConfirmed: true,
      equipmentCondition: 'fair' as const,
      initialFindings: '',
      estimatedDuration: 1,
      photosUploaded: false,
    },
  });

  // Diagnosis form
  const diagnosisForm = useForm({
    resolver: zodResolver(diagnosisSchema),
    defaultValues: {
      rootCause: '',
      proposedSolution: '',
      partsNeeded: [],
      laborHours: 1,
      totalEstimatedCost: 0,
      customerCommunication: '',
    },
  });

  const handleCheckIn = (data: any) => {
    checkInMutation.mutate(data);
  };

  const handleStepCompletion = (stepName: string, stepData: any) => {
    completeStepMutation.mutate({ stepName, stepData });
  };

  const renderStepContent = () => {
    const step = workflowSteps[currentStep];
    if (!step) return null;

    switch (step.id) {
      case 'check_in':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Check-In at Customer Location
              </CardTitle>
              <CardDescription>
                Confirm your arrival and begin the service call
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={checkInForm.handleSubmit(handleCheckIn)} className="space-y-4">
                <div>
                  <Label>Arrival Time</Label>
                  <Input
                    type="datetime-local"
                    {...checkInForm.register('arrivalTime')}
                  />
                </div>
                <div>
                  <Label>GPS Location (Optional)</Label>
                  <Input
                    placeholder="Current location coordinates"
                    {...checkInForm.register('gpsLocation')}
                  />
                </div>
                <div>
                  <Label>Initial Notes</Label>
                  <Textarea
                    placeholder="Any initial observations or notes"
                    {...checkInForm.register('notes')}
                  />
                </div>
                <Button type="submit" disabled={checkInMutation.isPending}>
                  <Navigation className="h-4 w-4 mr-2" />
                  Check In
                </Button>
              </form>
            </CardContent>
          </Card>
        );

      case 'initial_assessment':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clipboard className="h-5 w-5" />
                Initial Assessment
              </CardTitle>
              <CardDescription>
                Assess the equipment and confirm the reported issue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={assessmentForm.handleSubmit((data) => handleStepCompletion('initial_assessment', data))} className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Controller
                    name="issueConfirmed"
                    control={assessmentForm.control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Label>Issue confirmed as reported</Label>
                </div>
                
                <div>
                  <Label>Equipment Condition</Label>
                  <Controller
                    name="equipmentCondition"
                    control={assessmentForm.control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="fair">Fair</SelectItem>
                          <SelectItem value="poor">Poor</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div>
                  <Label>Initial Findings</Label>
                  <Textarea
                    placeholder="Describe what you've found during initial assessment"
                    {...assessmentForm.register('initialFindings')}
                  />
                </div>

                <div>
                  <Label>Estimated Duration (hours)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    {...assessmentForm.register('estimatedDuration', { valueAsNumber: true })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Controller
                    name="photosUploaded"
                    control={assessmentForm.control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Label>Photos uploaded</Label>
                </div>

                <Button type="submit" disabled={completeStepMutation.isPending}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Assessment
                </Button>
              </form>
            </CardContent>
          </Card>
        );

      default:
        return (
          <Card>
            <CardHeader>
              <CardTitle>{step.name}</CardTitle>
              <CardDescription>{step.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Step implementation in progress. This step will include:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Detailed forms for data collection</li>
                <li>Photo and document upload capabilities</li>
                <li>Customer interaction tracking</li>
                <li>Real-time progress updates</li>
              </ul>
              <Button 
                onClick={() => handleStepCompletion(step.id, { completed: true })}
                className="mt-4"
                disabled={completeStepMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Complete
              </Button>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Service Ticket #{ticket.id?.slice(0, 8)}
          </CardTitle>
          <CardDescription>
            {ticket.description} - {ticket.customerName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-gray-600">
                  {completedSteps.length} of {workflowSteps.length} completed
                </span>
              </div>
              <Progress 
                value={(completedSteps.length / workflowSteps.length) * 100} 
                className="h-2"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Priority:</span>
                <Badge variant="secondary" className="ml-2">
                  {ticket.priority || 'Medium'}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Status:</span>
                <Badge variant="outline" className="ml-2">
                  {ticket.status?.replace('_', ' ') || 'New'}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Customer:</span>
                <span className="ml-2">{ticket.customerName}</span>
              </div>
              <div>
                <span className="font-medium">Address:</span>
                <span className="ml-2">{ticket.customerAddress || 'Not specified'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps Navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workflow Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {workflowSteps.map((step, index) => (
              <Button
                key={step.id}
                variant={
                  completedSteps.includes(step.id) 
                    ? "default"
                    : index === currentStep 
                    ? "outline" 
                    : "ghost"
                }
                size="sm"
                onClick={() => setCurrentStep(index)}
                className={`flex items-center gap-2 ${
                  completedSteps.includes(step.id) ? 'bg-green-600 hover:bg-green-700' : ''
                }`}
              >
                {completedSteps.includes(step.id) ? (
                  <CheckCircle className="h-4 w-4" />
                ) : index === currentStep ? (
                  <Timer className="h-4 w-4" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                )}
                {step.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      {renderStepContent()}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <Phone className="h-4 w-4 mr-2" />
              Call Customer
            </Button>
            <Button variant="outline" size="sm">
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </Button>
            <Button variant="outline" size="sm">
              <Package className="h-4 w-4 mr-2" />
              Request Parts
            </Button>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Add Notes
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Equipment Info
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}