import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Building, 
  Phone, 
  Mail, 
  MapPin,
  Camera,
  Mic,
  Save,
  UserPlus,
  FileText,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useMobileDetection } from "@/hooks/useExternalIntegrations";
import { useToast } from "@/hooks/use-toast";

interface CustomerFormData {
  // Company Information
  companyName: string;
  industry: string;
  companySize: string;
  website: string;
  
  // Primary Contact
  contactName: string;
  contactTitle: string;
  contactPhone: string;
  contactEmail: string;
  
  // Address Information
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  
  // Business Details
  customerType: 'lead' | 'prospect' | 'customer';
  priority: 'low' | 'medium' | 'high';
  source: string;
  notes: string;
}

interface MobileCustomerEntryProps {
  editingCustomer?: CustomerFormData;
  onSave?: (customer: CustomerFormData) => void;
  className?: string;
}

export function MobileCustomerEntry({ editingCustomer, onSave, className }: MobileCustomerEntryProps) {
  const [formData, setFormData] = useState<CustomerFormData>(editingCustomer || {
    companyName: '',
    industry: '',
    companySize: '',
    website: '',
    contactName: '',
    contactTitle: '',
    contactPhone: '',
    contactEmail: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    customerType: 'lead',
    priority: 'medium',
    source: '',
    notes: ''
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const { isMobile, orientation } = useMobileDetection();
  const { toast } = useToast();

  const updateFormData = (field: keyof CustomerFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation errors for this field
    if (validationErrors.includes(field)) {
      setValidationErrors(prev => prev.filter(error => error !== field));
    }
  };

  const validateStep = (step: number): boolean => {
    const errors: string[] = [];
    
    switch (step) {
      case 1: // Company Information
        if (!formData.companyName.trim()) errors.push('companyName');
        if (!formData.industry.trim()) errors.push('industry');
        break;
      case 2: // Contact Information
        if (!formData.contactName.trim()) errors.push('contactName');
        if (!formData.contactPhone.trim()) errors.push('contactPhone');
        if (!formData.contactEmail.trim()) errors.push('contactEmail');
        break;
      case 3: // Address Information
        if (!formData.addressLine1.trim()) errors.push('addressLine1');
        if (!formData.city.trim()) errors.push('city');
        if (!formData.state.trim()) errors.push('state');
        break;
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    } else {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSave = () => {
    if (validateStep(currentStep)) {
      onSave?.(formData);
      toast({
        title: "Customer Saved",
        description: `${formData.companyName} has been saved successfully`
      });
    }
  };

  const handleVoiceInput = async (field: keyof CustomerFormData) => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast({
        title: "Voice Input Unavailable",
        description: "Speech recognition not supported in this browser",
        variant: "destructive"
      });
      return;
    }

    setIsRecording(true);
    
    // Mock voice input for demonstration
    setTimeout(() => {
      const voiceInput = `Voice input for ${field}`;
      updateFormData(field, voiceInput);
      setIsRecording(false);
      toast({
        title: "Voice Input Captured",
        description: `Added text to ${field}`
      });
    }, 2000);
  };

  const getStepTitle = (step: number): string => {
    switch (step) {
      case 1: return "Company Information";
      case 2: return "Contact Details";
      case 3: return "Address Information";
      case 4: return "Business Details";
      default: return "Customer Entry";
    }
  };

  const getStepIcon = (step: number) => {
    switch (step) {
      case 1: return <Building className="h-5 w-5" />;
      case 2: return <User className="h-5 w-5" />;
      case 3: return <MapPin className="h-5 w-5" />;
      case 4: return <FileText className="h-5 w-5" />;
      default: return <User className="h-5 w-5" />;
    }
  };

  const renderField = (
    field: keyof CustomerFormData,
    label: string,
    type: 'text' | 'email' | 'tel' | 'textarea' | 'select' = 'text',
    options?: { value: string; label: string }[],
    required = false
  ) => {
    const hasError = validationErrors.includes(field);
    const fieldId = `field-${field}`;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={fieldId} className={required ? "font-medium" : ""}>
            {label} {required && <span className="text-red-500">*</span>}
          </Label>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleVoiceInput(field)}
            disabled={isRecording}
          >
            <Mic className={`h-4 w-4 ${isRecording ? 'animate-pulse text-red-500' : ''}`} />
          </Button>
        </div>
        
        {type === 'textarea' ? (
          <Textarea
            id={fieldId}
            value={formData[field]}
            onChange={(e) => updateFormData(field, e.target.value)}
            className={hasError ? "border-red-500" : ""}
            rows={3}
            placeholder={`Enter ${label.toLowerCase()}...`}
          />
        ) : type === 'select' ? (
          <Select
            value={formData[field]}
            onValueChange={(value) => updateFormData(field, value)}
          >
            <SelectTrigger className={hasError ? "border-red-500" : ""}>
              <SelectValue placeholder={`Select ${label.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={fieldId}
            type={type}
            value={formData[field]}
            onChange={(e) => updateFormData(field, e.target.value)}
            className={hasError ? "border-red-500" : ""}
            placeholder={`Enter ${label.toLowerCase()}...`}
          />
        )}
        
        {hasError && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            This field is required
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              {getStepIcon(currentStep)}
              {getStepTitle(currentStep)}
            </CardTitle>
            <Badge variant="outline">
              Step {currentStep} of 4
            </Badge>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Form Content */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {currentStep === 1 && (
            <div className="space-y-4">
              {renderField('companyName', 'Company Name', 'text', undefined, true)}
              {renderField('industry', 'Industry', 'select', [
                { value: 'healthcare', label: 'Healthcare' },
                { value: 'education', label: 'Education' },
                { value: 'legal', label: 'Legal Services' },
                { value: 'finance', label: 'Financial Services' },
                { value: 'manufacturing', label: 'Manufacturing' },
                { value: 'retail', label: 'Retail' },
                { value: 'other', label: 'Other' }
              ], true)}
              {renderField('companySize', 'Company Size', 'select', [
                { value: '1-10', label: '1-10 employees' },
                { value: '11-50', label: '11-50 employees' },
                { value: '51-200', label: '51-200 employees' },
                { value: '201-1000', label: '201-1000 employees' },
                { value: '1000+', label: '1000+ employees' }
              ])}
              {renderField('website', 'Website', 'text')}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              {renderField('contactName', 'Contact Name', 'text', undefined, true)}
              {renderField('contactTitle', 'Job Title', 'text')}
              {renderField('contactPhone', 'Phone Number', 'tel', undefined, true)}
              {renderField('contactEmail', 'Email Address', 'email', undefined, true)}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              {renderField('addressLine1', 'Address Line 1', 'text', undefined, true)}
              {renderField('addressLine2', 'Address Line 2', 'text')}
              <div className="grid grid-cols-2 gap-4">
                {renderField('city', 'City', 'text', undefined, true)}
                {renderField('state', 'State', 'text', undefined, true)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {renderField('postalCode', 'Postal Code', 'text')}
                {renderField('country', 'Country', 'select', [
                  { value: 'US', label: 'United States' },
                  { value: 'CA', label: 'Canada' },
                  { value: 'MX', label: 'Mexico' }
                ])}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              {renderField('customerType', 'Customer Type', 'select', [
                { value: 'lead', label: 'Lead' },
                { value: 'prospect', label: 'Prospect' },
                { value: 'customer', label: 'Customer' }
              ])}
              {renderField('priority', 'Priority', 'select', [
                { value: 'low', label: 'Low Priority' },
                { value: 'medium', label: 'Medium Priority' },
                { value: 'high', label: 'High Priority' }
              ])}
              {renderField('source', 'Lead Source', 'select', [
                { value: 'website', label: 'Website' },
                { value: 'referral', label: 'Referral' },
                { value: 'cold-call', label: 'Cold Call' },
                { value: 'trade-show', label: 'Trade Show' },
                { value: 'social-media', label: 'Social Media' },
                { value: 'other', label: 'Other' }
              ])}
              {renderField('notes', 'Notes', 'textarea')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className="flex-1"
        >
          Previous
        </Button>
        
        {currentStep < 4 ? (
          <Button onClick={handleNext} className="flex-1">
            Next
          </Button>
        ) : (
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Save Customer
          </Button>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline">
              <Camera className="h-4 w-4 mr-2" />
              Scan Business Card
            </Button>
            <Button size="sm" variant="outline">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default MobileCustomerEntry;