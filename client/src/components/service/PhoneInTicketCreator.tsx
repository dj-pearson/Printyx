import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, 
  MapPin, 
  User, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Wrench,
  Building,
  Search,
  Plus,
  PhoneCall
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPhoneInTicketSchema } from "@shared/enhanced-service-schema";
import type { InsertPhoneInTicket } from "@shared/enhanced-service-schema";
import { z } from "zod";

const phoneTicketFormSchema = insertPhoneInTicketSchema.extend({
  createServiceTicket: z.boolean().default(true),
});

type PhoneTicketFormInput = z.infer<typeof phoneTicketFormSchema>;

interface PhoneInTicketCreatorProps {
  isOpen: boolean;
  onClose: () => void;
}

const issueCategoryOptions = [
  { value: 'paper_jam', label: 'Paper Jam', icon: '📄', color: 'bg-yellow-100' },
  { value: 'print_quality', label: 'Print Quality Issues', icon: '🖨️', color: 'bg-blue-100' },
  { value: 'connectivity', label: 'Connectivity Problems', icon: '📶', color: 'bg-green-100' },
  { value: 'hardware_failure', label: 'Hardware Failure', icon: '⚠️', color: 'bg-red-100' },
  { value: 'software_issue', label: 'Software Issues', icon: '💻', color: 'bg-purple-100' },
  { value: 'toner_cartridge', label: 'Toner/Cartridge', icon: '🛢️', color: 'bg-orange-100' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧', color: 'bg-gray-100' },
  { value: 'installation', label: 'Installation', icon: '📦', color: 'bg-teal-100' },
  { value: 'training', label: 'Training Request', icon: '📚', color: 'bg-indigo-100' },
  { value: 'other', label: 'Other', icon: '❓', color: 'bg-gray-100' },
];

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'text-green-600', bgColor: 'bg-green-100' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  { value: 'high', label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-100' },
  { value: 'emergency', label: 'Emergency', color: 'text-red-800', bgColor: 'bg-red-200' },
];

export default function PhoneInTicketCreator({ isOpen, onClose }: PhoneInTicketCreatorProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [callStartTime] = useState(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Search customers
  const { data: customers = [] } = useQuery({
    queryKey: ["/api/customers/search", customerSearchTerm],
    enabled: customerSearchTerm.length > 2,
  });

  const form = useForm<PhoneTicketFormInput>({
    resolver: zodResolver(phoneTicketFormSchema),
    defaultValues: {
      contactMethod: "phone",
      urgencyLevel: "medium",
      issueCategory: "other",
      createServiceTicket: true,
      affectedUsers: 1,
    },
  });

  // Create phone-in ticket
  const createTicketMutation = useMutation({
    mutationFn: async (data: PhoneTicketFormInput) => {
      const callDuration = Math.round((new Date().getTime() - callStartTime.getTime()) / (1000 * 60));
      
      const response = await fetch('/api/phone-in-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          callDuration,
          handledBy: 'current-user-id', // Replace with actual user ID
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create phone-in ticket');
      return response.json();
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-in-tickets"] });
      toast({ 
        title: "Phone-in ticket created successfully",
        description: `Ticket #${ticket.id} has been created and ${form.watch('createServiceTicket') ? 'converted to service ticket' : 'logged for follow-up'}`,
      });
      form.reset();
      setCurrentStep(1);
      onClose();
    },
  });

  const handleSubmit = (data: PhoneTicketFormInput) => {
    createTicketMutation.mutate(data);
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const selectCustomer = (customer: any) => {
    form.setValue('customerId', customer.id);
    form.setValue('customerName', customer.name);
    form.setValue('locationAddress', customer.address || '');
    setCustomerSearchTerm(customer.name);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <PhoneCall className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Phone-in Service Request</h2>
                <p className="text-sm text-gray-600">
                  Call started at {callStartTime.toLocaleTimeString()} • Duration: {Math.round((new Date().getTime() - callStartTime.getTime()) / (1000 * 60))} min
                </p>
              </div>
            </div>
            <Button variant="ghost" onClick={onClose}>✕</Button>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center mb-6">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step}
                </div>
                {step < 4 && (
                  <div 
                    className={`w-16 h-1 mx-2 ${
                      step < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)}>
            {/* Step 1: Caller & Customer Information */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Caller & Customer Information
                  </CardTitle>
                  <CardDescription>
                    Collect caller details and identify the customer
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="callerName">Caller Name *</Label>
                      <Controller
                        name="callerName"
                        control={form.control}
                        rules={{ required: "Caller name is required" }}
                        render={({ field, fieldState }) => (
                          <div>
                            <Input
                              {...field}
                              placeholder="John Smith"
                              className={fieldState.error ? "border-red-500" : ""}
                            />
                            {fieldState.error && (
                              <p className="text-red-500 text-sm mt-1">{fieldState.error.message}</p>
                            )}
                          </div>
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="callerPhone">Caller Phone *</Label>
                      <Controller
                        name="callerPhone"
                        control={form.control}
                        rules={{ required: "Phone number is required" }}
                        render={({ field, fieldState }) => (
                          <div>
                            <Input
                              {...field}
                              type="tel"
                              placeholder="(555) 123-4567"
                              className={fieldState.error ? "border-red-500" : ""}
                            />
                            {fieldState.error && (
                              <p className="text-red-500 text-sm mt-1">{fieldState.error.message}</p>
                            )}
                          </div>
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="callerEmail">Caller Email</Label>
                      <Controller
                        name="callerEmail"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            type="email"
                            placeholder="john@company.com"
                          />
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="callerRole">Caller Role</Label>
                      <Controller
                        name="callerRole"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="primary_contact">Primary Contact</SelectItem>
                              <SelectItem value="admin">Administrator</SelectItem>
                              <SelectItem value="user">End User</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

                  {/* Customer Search */}
                  <div>
                    <Label>Customer Search</Label>
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                      <Input
                        placeholder="Search by company name, phone, or email..."
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    {customers.length > 0 && (
                      <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                        {customers.map((customer: any) => (
                          <button
                            key={customer.id}
                            type="button"
                            className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0"
                            onClick={() => selectCustomer(customer)}
                          >
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-sm text-gray-600">{customer.phone} • {customer.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="customerName">Customer/Company Name *</Label>
                    <Controller
                      name="customerName"
                      control={form.control}
                      rules={{ required: "Customer name is required" }}
                      render={({ field, fieldState }) => (
                        <div>
                          <Input
                            {...field}
                            placeholder="ABC Corporation"
                            className={fieldState.error ? "border-red-500" : ""}
                          />
                          {fieldState.error && (
                            <p className="text-red-500 text-sm mt-1">{fieldState.error.message}</p>
                          )}
                        </div>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Location & Equipment */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Location & Equipment Details
                  </CardTitle>
                  <CardDescription>
                    Identify the service location and equipment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="locationAddress">Service Address *</Label>
                    <Controller
                      name="locationAddress"
                      control={form.control}
                      rules={{ required: "Service address is required" }}
                      render={({ field, fieldState }) => (
                        <div>
                          <Textarea
                            {...field}
                            placeholder="123 Main St, Suite 100, City, State 12345"
                            className={fieldState.error ? "border-red-500" : ""}
                            rows={2}
                          />
                          {fieldState.error && (
                            <p className="text-red-500 text-sm mt-1">{fieldState.error.message}</p>
                          )}
                        </div>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="locationBuilding">Building</Label>
                      <Controller
                        name="locationBuilding"
                        control={form.control}
                        render={({ field }) => (
                          <Input {...field} placeholder="Building A" />
                        )}
                      />
                    </div>
                    <div>
                      <Label htmlFor="locationFloor">Floor</Label>
                      <Controller
                        name="locationFloor"
                        control={form.control}
                        render={({ field }) => (
                          <Input {...field} placeholder="2nd Floor" />
                        )}
                      />
                    </div>
                    <div>
                      <Label htmlFor="locationRoom">Room</Label>
                      <Controller
                        name="locationRoom"
                        control={form.control}
                        render={({ field }) => (
                          <Input {...field} placeholder="Room 205" />
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="equipmentBrand">Equipment Brand</Label>
                      <Controller
                        name="equipmentBrand"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select brand" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="canon">Canon</SelectItem>
                              <SelectItem value="xerox">Xerox</SelectItem>
                              <SelectItem value="hp">HP</SelectItem>
                              <SelectItem value="ricoh">Ricoh</SelectItem>
                              <SelectItem value="konica_minolta">Konica Minolta</SelectItem>
                              <SelectItem value="sharp">Sharp</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div>
                      <Label htmlFor="equipmentModel">Model</Label>
                      <Controller
                        name="equipmentModel"
                        control={form.control}
                        render={({ field }) => (
                          <Input {...field} placeholder="IR-ADV C5535i" />
                        )}
                      />
                    </div>
                    <div>
                      <Label htmlFor="equipmentSerial">Serial Number</Label>
                      <Controller
                        name="equipmentSerial"
                        control={form.control}
                        render={({ field }) => (
                          <Input {...field} placeholder="ABC123456" />
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Issue Details */}
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Issue Details & Assessment
                  </CardTitle>
                  <CardDescription>
                    Document the problem and its business impact
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="issueCategory">Issue Category *</Label>
                      <Controller
                        name="issueCategory"
                        control={form.control}
                        rules={{ required: "Please select an issue category" }}
                        render={({ field, fieldState }) => (
                          <div>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className={fieldState.error ? "border-red-500" : ""}>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {issueCategoryOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                      <span className={`p-1 rounded text-xs ${option.color}`}>
                                        {option.icon}
                                      </span>
                                      {option.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {fieldState.error && (
                              <p className="text-red-500 text-sm mt-1">{fieldState.error.message}</p>
                            )}
                          </div>
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="urgencyLevel">Priority Level *</Label>
                      <Controller
                        name="urgencyLevel"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent>
                              {priorityOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  <div className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${option.bgColor}`}></span>
                                    <span className={option.color}>{option.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="issueDescription">Issue Description *</Label>
                    <Controller
                      name="issueDescription"
                      control={form.control}
                      rules={{ required: "Please describe the issue" }}
                      render={({ field, fieldState }) => (
                        <div>
                          <Textarea
                            {...field}
                            placeholder="Describe the problem the customer is experiencing..."
                            className={fieldState.error ? "border-red-500" : ""}
                            rows={4}
                          />
                          {fieldState.error && (
                            <p className="text-red-500 text-sm mt-1">{fieldState.error.message}</p>
                          )}
                        </div>
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="troubleshootingAttempted">Troubleshooting Already Attempted</Label>
                    <Controller
                      name="troubleshootingAttempted"
                      control={form.control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          placeholder="What has the customer already tried to fix the issue?"
                          rows={3}
                        />
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="affectedUsers">Number of Affected Users</Label>
                      <Controller
                        name="affectedUsers"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            type="number"
                            min="1"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            placeholder="5"
                          />
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="preferredServiceTime">Preferred Service Time</Label>
                      <Controller
                        name="preferredServiceTime"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select time preference" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asap">ASAP</SelectItem>
                              <SelectItem value="morning">Morning (8am-12pm)</SelectItem>
                              <SelectItem value="afternoon">Afternoon (12pm-5pm)</SelectItem>
                              <SelectItem value="flexible">Flexible</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="businessImpact">Business Impact</Label>
                    <Controller
                      name="businessImpact"
                      control={form.control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          placeholder="How is this issue affecting the business operations?"
                          rows={2}
                        />
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Final Details & Submission */}
            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Final Details & Submission
                  </CardTitle>
                  <CardDescription>
                    Review information and complete the ticket creation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="specialInstructions">Special Instructions</Label>
                    <Controller
                      name="specialInstructions"
                      control={form.control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          placeholder="Any special access requirements, contact preferences, etc."
                          rows={3}
                        />
                      )}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Controller
                      name="createServiceTicket"
                      control={form.control}
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="createServiceTicket"
                        />
                      )}
                    />
                    <Label htmlFor="createServiceTicket" className="font-medium">
                      Immediately create service ticket and schedule technician
                    </Label>
                  </div>

                  {!form.watch('createServiceTicket') && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-yellow-800 text-sm">
                        <strong>Note:</strong> If unchecked, this will be logged as a phone inquiry that requires manual follow-up to convert to a service ticket.
                      </p>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Ticket Summary:</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>Customer:</strong> {form.watch('customerName') || 'Not specified'}</p>
                      <p><strong>Caller:</strong> {form.watch('callerName') || 'Not specified'}</p>
                      <p><strong>Issue:</strong> {form.watch('issueCategory')?.replace('_', ' ') || 'Not specified'}</p>
                      <p><strong>Priority:</strong> {form.watch('urgencyLevel') || 'Medium'}</p>
                      <p><strong>Equipment:</strong> {form.watch('equipmentBrand') || 'Not specified'} {form.watch('equipmentModel') || ''}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                Previous
              </Button>
              
              {currentStep < 4 ? (
                <Button type="button" onClick={nextStep}>
                  Next
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={createTicketMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createTicketMutation.isPending ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Creating Ticket...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Create Ticket
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}