import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Loader2,
  Upload,
  HardDrive,
  Recycle,
  Shield,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface EquipmentDisposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: string;
  equipmentDetails?: {
    brand: string;
    model: string;
    serialNumber: string;
  };
  onDisposalComplete?: () => void;
}

// Form validation schema
const disposalFormSchema = z.object({
  disposalType: z.enum(['recycling', 'e_waste', 'donation', 'resale', 'destruction'], {
    required_error: 'Please select a disposal type',
  }),
  disposalVendor: z.string().min(2, 'Vendor name required'),
  disposalDate: z.string().min(1, 'Disposal date required'),
  estimatedCost: z.number().min(0, 'Cost must be positive').optional(),
  dataWipedConfirmation: z.boolean().refine((val) => val === true, {
    message: 'Data wipe confirmation is required',
  }),
  certificateOfDestruction: z.string().optional(),
  environmentalCompliance: z.boolean(),
  notes: z.string().optional(),

  // Data Wipe Details
  dataWipeMethod: z.string().min(1, 'Data wipe method required'),
  dataWipeVerifiedBy: z.string().optional(),
  dataWipeStandard: z.string().optional(),

  // Vendor Details
  vendorContactName: z.string().optional(),
  vendorContactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  vendorContactPhone: z.string().optional(),
});

type DisposalFormValues = z.infer<typeof disposalFormSchema>;

export function EquipmentDisposalDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentDetails,
  onDisposalComplete,
}: EquipmentDisposalDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<DisposalFormValues>({
    resolver: zodResolver(disposalFormSchema),
    defaultValues: {
      disposalType: 'recycling',
      environmentalCompliance: true,
      dataWipedConfirmation: false,
      dataWipeMethod: '',
      dataWipeStandard: 'DoD 5220.22-M',
    },
  });

  // Mutation to create disposal record
  const disposalMutation = useMutation({
    mutationFn: async (data: DisposalFormValues) => {
      // First, initiate disposal workflow
      const disposalResponse = await apiRequest('/api/equipment-disposal', {
        method: 'POST',
        body: JSON.stringify({
          equipmentId,
          ...data,
        }),
      });

      // If disposal is successful and status is retired, transition to disposed
      if (disposalResponse.success) {
        await apiRequest(`/api/equipment-lifecycle/${equipmentId}/transition`, {
          method: 'POST',
          body: JSON.stringify({
            toStage: 'disposed',
            reason: `Equipment disposed via ${data.disposalType}. Vendor: ${data.disposalVendor}`,
            metadata: {
              disposalId: disposalResponse.data.id,
              disposalType: data.disposalType,
              vendor: data.disposalVendor,
            },
          }),
        });
      }

      return disposalResponse;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Disposal Initiated',
          description: 'Equipment disposal workflow has been started successfully',
        });

        // Invalidate relevant queries
        queryClient.invalidateQueries({
          queryKey: [`/api/equipment-lifecycle/${equipmentId}`]
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/equipment-lifecycle/stages']
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/equipment-disposal']
        });

        onDisposalComplete?.();
        onOpenChange(false);
        setCurrentStep(1);
        form.reset();
      } else {
        toast({
          title: 'Disposal Failed',
          description: data.message || 'Unable to initiate disposal',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Disposal Error',
        description: error.message || 'An error occurred during disposal',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: DisposalFormValues) => {
    disposalMutation.mutate(data);
  };

  const nextStep = async () => {
    // Validate current step before proceeding
    let fieldsToValidate: (keyof DisposalFormValues)[] = [];

    switch (currentStep) {
      case 1:
        fieldsToValidate = ['disposalType', 'disposalDate'];
        break;
      case 2:
        fieldsToValidate = ['dataWipedConfirmation', 'dataWipeMethod'];
        break;
      case 3:
        fieldsToValidate = ['disposalVendor'];
        break;
    }

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep(currentStep + 1);
    }
  };

  const previousStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const getProgressPercentage = () => {
    return (currentStep / 4) * 100;
  };

  const disposalTypeDescriptions: Record<string, string> = {
    recycling: 'Environmentally responsible recycling of equipment components',
    e_waste: 'Certified e-waste disposal through authorized facilities',
    donation: 'Donation to charitable organizations or educational institutions',
    resale: 'Resale through authorized resellers or secondary markets',
    destruction: 'Physical destruction and certified destruction certificate',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Equipment Disposal Workflow
          </DialogTitle>
          <DialogDescription>
            {equipmentDetails && (
              <span className="font-medium">
                {equipmentDetails.brand} {equipmentDetails.model} (S/N: {equipmentDetails.serialNumber})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Step {currentStep} of 4</span>
            <span className="font-medium">{getProgressPercentage()}% Complete</span>
          </div>
          <Progress value={getProgressPercentage()} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className={currentStep === 1 ? 'font-medium text-primary' : ''}>Disposal Type</span>
            <span className={currentStep === 2 ? 'font-medium text-primary' : ''}>Data Wipe</span>
            <span className={currentStep === 3 ? 'font-medium text-primary' : ''}>Vendor</span>
            <span className={currentStep === 4 ? 'font-medium text-primary' : ''}>Confirm</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Disposal Type Selection */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Disposal is irreversible. Ensure all data has been backed up and customer approval obtained.
                  </AlertDescription>
                </Alert>

                <FormField
                  control={form.control}
                  name="disposalType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Disposal Method *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select disposal method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="recycling">
                            <div className="flex items-center gap-2">
                              <Recycle className="h-4 w-4 text-green-600" />
                              <span>Recycling</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="e_waste">
                            <div className="flex items-center gap-2">
                              <Trash2 className="h-4 w-4 text-orange-600" />
                              <span>E-Waste Facility</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="donation">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-blue-600" />
                              <span>Donation</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="resale">
                            <div className="flex items-center gap-2">
                              <FileCheck className="h-4 w-4 text-purple-600" />
                              <span>Resale</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="destruction">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-red-600" />
                              <span>Physical Destruction</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {field.value && disposalTypeDescriptions[field.value]}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="disposalDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Disposal Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estimatedCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Cost (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>Total estimated cost for disposal service</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 2: Data Wipe Verification */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <Alert>
                  <HardDrive className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Data Security Requirement:</strong> All data must be securely wiped before disposal to comply with data protection regulations.
                  </AlertDescription>
                </Alert>

                <FormField
                  control={form.control}
                  name="dataWipeMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Wipe Method *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select data wipe method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="software">Software-based Secure Erase</SelectItem>
                          <SelectItem value="degausser">Degausser (Magnetic)</SelectItem>
                          <SelectItem value="physical">Physical Destruction (Shredding)</SelectItem>
                          <SelectItem value="certified_service">Certified Service Provider</SelectItem>
                          <SelectItem value="none">No Hard Drive Present</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataWipeStandard"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Sanitization Standard</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select standard" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="DoD 5220.22-M">DoD 5220.22-M (3-pass)</SelectItem>
                          <SelectItem value="NIST 800-88">NIST 800-88</SelectItem>
                          <SelectItem value="CESG CPA">CESG CPA (UK)</SelectItem>
                          <SelectItem value="Gutmann">Gutmann Method (35-pass)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Industry standard for data sanitization</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataWipeVerifiedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verified By</FormLabel>
                      <FormControl>
                        <Input placeholder="Technician name or ID" {...field} />
                      </FormControl>
                      <FormDescription>Person who verified data wipe completion</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataWipedConfirmation"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-medium">
                          I confirm that all data has been securely wiped *
                        </FormLabel>
                        <FormDescription>
                          This confirmation is required to proceed with disposal
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 3: Vendor Information */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="disposalVendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Disposal Vendor *</FormLabel>
                      <FormControl>
                        <Input placeholder="Company name" {...field} />
                      </FormControl>
                      <FormDescription>Authorized disposal or recycling company</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vendorContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vendorContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="vendorContactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contact@vendor.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="certificateOfDestruction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certificate of Destruction URL</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input placeholder="https://..." {...field} />
                          <Button type="button" variant="outline" size="sm">
                            <Upload className="h-4 w-4" />
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>Link to certificate document (if available)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="environmentalCompliance"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Environmental compliance verified
                        </FormLabel>
                        <FormDescription>
                          Vendor meets environmental disposal standards (EPA, ISO 14001, etc.)
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 4: Confirmation */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Review and Confirm:</strong> Please review all disposal details before submission
                  </AlertDescription>
                </Alert>

                {/* Summary */}
                <div className="rounded-lg border p-4 space-y-3 bg-muted/50">
                  <h4 className="font-medium text-sm">Disposal Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Disposal Method:</span>
                    <span className="font-medium">{form.getValues('disposalType')}</span>

                    <span className="text-muted-foreground">Scheduled Date:</span>
                    <span className="font-medium">{form.getValues('disposalDate')}</span>

                    <span className="text-muted-foreground">Data Wipe Method:</span>
                    <span className="font-medium">{form.getValues('dataWipeMethod')}</span>

                    <span className="text-muted-foreground">Disposal Vendor:</span>
                    <span className="font-medium">{form.getValues('disposalVendor')}</span>

                    {form.getValues('estimatedCost') && form.getValues('estimatedCost')! > 0 && (
                      <>
                        <span className="text-muted-foreground">Estimated Cost:</span>
                        <span className="font-medium">${form.getValues('estimatedCost')?.toFixed(2)}</span>
                      </>
                    )}
                  </div>

                  <div className="pt-2 border-t space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Data securely wiped</span>
                    </div>
                    {form.getValues('environmentalCompliance') && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>Environmental compliance verified</span>
                      </div>
                    )}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional information about this disposal..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter>
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={previousStep}>
                  Previous
                </Button>
              )}

              {currentStep < 4 ? (
                <Button type="button" onClick={nextStep}>
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={disposalMutation.isPending}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {disposalMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initiating Disposal...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Confirm Disposal
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
