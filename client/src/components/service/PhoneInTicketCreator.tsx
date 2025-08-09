import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  User, 
  MapPin, 
  Phone,
  Mail,
  Wrench,
  Calendar,
  Plus,
  Search,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface PhoneInTicketCreatorProps {
  isOpen: boolean;
  onClose: () => void;
}

const phoneTicketSchema = z.object({
  // Step 1: Company Selection
  companyName: z.string().min(1, "Company name is required"),
  companyId: z.string().optional(),
  
  // Step 2: Caller Selection  
  callerName: z.string().min(1, "Caller name is required"),
  callerPhone: z.string().min(10, "Valid phone number is required"),
  callerEmail: z.string().email().optional().or(z.literal("")),
  callerRole: z.string().optional(),
  contactId: z.string().optional(),
  
  // Step 3: Location & Equipment
  locationAddress: z.string().min(1, "Location address is required"),
  locationBuilding: z.string().optional(),
  locationFloor: z.string().optional(),
  locationRoom: z.string().optional(),
  equipmentId: z.string().optional(),
  equipmentBrand: z.string().optional(),
  equipmentModel: z.string().optional(),
  equipmentSerial: z.string().optional(),
  
  // Step 4: Issue Details
  issueCategory: z.enum(['paper_jam', 'print_quality', 'connectivity', 'hardware_failure', 'software_issue', 'toner_cartridge', 'maintenance', 'installation', 'training', 'other']),
  issueDescription: z.string().min(10, "Please provide a detailed description"),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'emergency']),
  preferredServiceDate: z.string().optional(),
  notes: z.string().optional(),
});

type PhoneTicketFormData = z.infer<typeof phoneTicketSchema>;

export default function PhoneInTicketCreator({ isOpen, onClose }: PhoneInTicketCreatorProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [equipmentSearchTerm, setEquipmentSearchTerm] = useState("");
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PhoneTicketFormData>({
    resolver: zodResolver(phoneTicketSchema),
    defaultValues: {
      companyName: "",
      callerName: "",
      callerPhone: "",
      callerEmail: "",
      callerRole: "",
      locationAddress: "",
      locationBuilding: "",
      locationFloor: "",
      locationRoom: "",
      equipmentBrand: "",
      equipmentModel: "",
      equipmentSerial: "",
      issueCategory: "other",
      issueDescription: "",
      priority: "medium",
      preferredServiceDate: "",
      notes: "",
    },
  });

  // Company search query
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["/api/phone-tickets/search-companies", companySearchTerm],
    enabled: companySearchTerm.length >= 2,
    queryFn: async () => {
      return await apiRequest(`/api/phone-tickets/search-companies?q=${encodeURIComponent(companySearchTerm)}`);
    },
  });

  // Contact search query (when company is selected)
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/phone-tickets/search-contacts", selectedCompany?.id, contactSearchTerm],
    enabled: !!selectedCompany && contactSearchTerm.length >= 2,
    queryFn: async () => {
      if (!selectedCompany) return [];
      return await apiRequest(`/api/phone-tickets/search-contacts/${selectedCompany.id}?q=${encodeURIComponent(contactSearchTerm)}`);
    },
  });

  // Equipment query (when company is selected)
  const { data: equipment = [], isLoading: equipmentLoading } = useQuery({
    queryKey: ["/api/phone-tickets/equipment", selectedCompany?.id, equipmentSearchTerm],
    enabled: !!selectedCompany,
    queryFn: async () => {
      if (!selectedCompany) return [];
      return await apiRequest(`/api/phone-tickets/equipment/${selectedCompany.id}`);
    },
  });

  // Create phone-in ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (data: PhoneTicketFormData) => {
      return await apiRequest("/api/phone-in-tickets", "POST", {
        ...data,
        customerId: selectedCompany?.id,
        contactId: selectedContact?.id,
        equipmentId: selectedEquipment?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Phone-in ticket created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-in-tickets"] });
      onClose();
      resetForm();
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to create ticket",
        variant: "destructive"
      });
    },
  });

  // Create new contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (contactData: any) => {
      return await apiRequest("/api/contacts", "POST", {
        ...contactData,
        companyId: selectedCompany?.id,
        customerId: selectedCompany?.id,
      });
    },
    onSuccess: (newContact) => {
      setSelectedContact(newContact);
      form.setValue("callerName", newContact.name);
      form.setValue("callerPhone", newContact.phone);
      form.setValue("callerEmail", newContact.email);
      form.setValue("callerRole", newContact.role);
      setShowNewContactForm(false);
      toast({ title: "Success", description: "New contact created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/search"] });
    },
  });

  const resetForm = () => {
    form.reset();
    setCurrentStep(1);
    setSelectedCompany(null);
    setSelectedContact(null);
    setSelectedEquipment(null);
    setCompanySearchTerm("");
    setContactSearchTerm("");
    setEquipmentSearchTerm("");
    setShowNewContactForm(false);
  };

  const handleCompanySelect = (company: any) => {
    setSelectedCompany(company);
    form.setValue("companyName", company.name);
    form.setValue("companyId", company.id);
    form.setValue("locationAddress", company.address || "");
    setCompanySearchTerm(company.name);
  };

  const handleContactSelect = (contact: any) => {
    setSelectedContact(contact);
    form.setValue("callerName", contact.name);
    form.setValue("callerPhone", contact.phone);
    form.setValue("callerEmail", contact.email || "");
    form.setValue("callerRole", contact.role || "");
    form.setValue("contactId", contact.id);
    setContactSearchTerm(contact.name);
  };

  const handleEquipmentSelect = (equipmentItem: any) => {
    setSelectedEquipment(equipmentItem);
    form.setValue("equipmentId", equipmentItem.id);
    form.setValue("equipmentBrand", equipmentItem.brand);
    form.setValue("equipmentModel", equipmentItem.model);
    form.setValue("equipmentSerial", equipmentItem.serialNumber);
  };

  const handleNextStep = () => {
    // Validate current step before proceeding
    switch (currentStep) {
      case 1:
        if (!selectedCompany) {
          toast({ title: "Required", description: "Please select a company first", variant: "destructive" });
          return;
        }
        break;
      case 2:
        if (!form.getValues("callerName") || !form.getValues("callerPhone")) {
          toast({ title: "Required", description: "Please fill in caller information", variant: "destructive" });
          return;
        }
        break;
      case 3:
        if (!form.getValues("locationAddress")) {
          toast({ title: "Required", description: "Please provide location information", variant: "destructive" });
          return;
        }
        break;
    }
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const onSubmit = (data: PhoneTicketFormData) => {
    createTicketMutation.mutate(data);
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
            ${step <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
          </div>
          {step < 4 && (
            <div className={`w-12 h-1 mx-2 ${step < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Step 1: Select Company
        </CardTitle>
        <CardDescription>
          Search and select the company this service call is for
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Company Name</Label>
          <div className="relative">
            <Input
              placeholder="Start typing company name..."
              value={companySearchTerm}
              onChange={(e) => setCompanySearchTerm(e.target.value)}
              className="pr-10"
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          
          {companySearchTerm.length >= 2 && (
            <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
              {companiesLoading ? (
                <div className="p-3 text-gray-500">Searching...</div>
              ) : companies.length > 0 ? (
                companies.map((company: any) => (
                  <div
                    key={company.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => handleCompanySelect(company)}
                  >
                    <div className="font-medium">{company.name}</div>
                    <div className="text-sm text-gray-600">{company.address}</div>
                    <div className="text-xs text-gray-500">{company.phone}</div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-gray-500">No companies found</div>
              )}
            </div>
          )}
        </div>

        {selectedCompany && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Selected Company</span>
            </div>
            <div className="mt-2">
              <div className="font-medium">{selectedCompany.name}</div>
              <div className="text-sm text-gray-600">{selectedCompany.address}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Step 2: Caller Information
        </CardTitle>
        <CardDescription>
          Select existing contact or create a new one
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Contact Name</Label>
          <div className="relative">
            <Input
              placeholder="Start typing contact name..."
              value={contactSearchTerm}
              onChange={(e) => setContactSearchTerm(e.target.value)}
              className="pr-10"
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          
          {contactSearchTerm.length >= 2 && (
            <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
              {contactsLoading ? (
                <div className="p-3 text-gray-500">Searching...</div>
              ) : (
                <>
                  {contacts.map((contact: any) => (
                    <div
                      key={contact.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b"
                      onClick={() => handleContactSelect(contact)}
                    >
                      <div className="font-medium">{contact.name}</div>
                      <div className="text-sm text-gray-600">{contact.phone}</div>
                      <div className="text-xs text-gray-500">{contact.role}</div>
                    </div>
                  ))}
                  <div
                    className="p-3 hover:bg-blue-50 cursor-pointer border-t bg-blue-25"
                    onClick={() => setShowNewContactForm(true)}
                  >
                    <div className="flex items-center gap-2 text-blue-600">
                      <Plus className="h-4 w-4" />
                      <span className="font-medium">Create new contact: "{contactSearchTerm}"</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {showNewContactForm && (
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg">Create New Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Name</Label>
                <Controller
                  name="callerName"
                  control={form.control}
                  render={({ field }) => (
                    <Input {...field} placeholder="Contact name" />
                  )}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Controller
                  name="callerPhone"
                  control={form.control}
                  render={({ field }) => (
                    <Input {...field} placeholder="Phone number" />
                  )}
                />
              </div>
              <div>
                <Label>Email (Optional)</Label>
                <Controller
                  name="callerEmail"
                  control={form.control}
                  render={({ field }) => (
                    <Input {...field} placeholder="Email address" />
                  )}
                />
              </div>
              <div>
                <Label>Role (Optional)</Label>
                <Controller
                  name="callerRole"
                  control={form.control}
                  render={({ field }) => (
                    <Input {...field} placeholder="Job title or role" />
                  )}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const formData = form.getValues();
                    createContactMutation.mutate({
                      name: formData.callerName,
                      phone: formData.callerPhone,
                      email: formData.callerEmail,
                      role: formData.callerRole,
                    });
                  }}
                  disabled={createContactMutation.isPending}
                >
                  Create Contact
                </Button>
                <Button variant="outline" onClick={() => setShowNewContactForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedContact && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Selected Contact</span>
            </div>
            <div className="mt-2">
              <div className="font-medium">{selectedContact.name}</div>
              <div className="text-sm text-gray-600">{selectedContact.phone}</div>
              <div className="text-xs text-gray-500">{selectedContact.role}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Step 3: Location & Equipment
        </CardTitle>
        <CardDescription>
          Specify service location and equipment details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Service Address</Label>
          <Controller
            name="locationAddress"
            control={form.control}
            render={({ field }) => (
              <Textarea {...field} placeholder="Full service address" rows={2} />
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Building (Optional)</Label>
            <Controller
              name="locationBuilding"
              control={form.control}
              render={({ field }) => (
                <Input {...field} placeholder="Building name/number" />
              )}
            />
          </div>
          <div>
            <Label>Floor (Optional)</Label>
            <Controller
              name="locationFloor"
              control={form.control}
              render={({ field }) => (
                <Input {...field} placeholder="Floor number" />
              )}
            />
          </div>
          <div>
            <Label>Room (Optional)</Label>
            <Controller
              name="locationRoom"
              control={form.control}
              render={({ field }) => (
                <Input {...field} placeholder="Room number" />
              )}
            />
          </div>
        </div>

        <div>
          <Label>Equipment Search</Label>
          <div className="relative">
            <Input
              placeholder="Search by asset number, model, or serial number..."
              value={equipmentSearchTerm}
              onChange={(e) => setEquipmentSearchTerm(e.target.value)}
              className="pr-10"
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          
          {equipment.length > 0 && (
            <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
              {equipment
                .filter((item: any) => 
                  equipmentSearchTerm === "" ||
                  item.assetNumber?.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
                  item.model?.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
                  item.serialNumber?.toLowerCase().includes(equipmentSearchTerm.toLowerCase())
                )
                .map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => handleEquipmentSelect(item)}
                  >
                    <div className="font-medium">{item.brand} {item.model}</div>
                    <div className="text-sm text-gray-600">Asset: {item.assetNumber}</div>
                    <div className="text-xs text-gray-500">Serial: {item.serialNumber}</div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {selectedEquipment && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Selected Equipment</span>
            </div>
            <div className="mt-2">
              <div className="font-medium">{selectedEquipment.brand} {selectedEquipment.model}</div>
              <div className="text-sm text-gray-600">Asset: {selectedEquipment.assetNumber}</div>
              <div className="text-xs text-gray-500">Serial: {selectedEquipment.serialNumber}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Step 4: Issue Details
        </CardTitle>
        <CardDescription>
          Describe the issue and set priority
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Issue Category</Label>
          <Controller
            name="issueCategory"
            control={form.control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select issue category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paper_jam">Paper Jam</SelectItem>
                  <SelectItem value="print_quality">Print Quality</SelectItem>
                  <SelectItem value="connectivity">Connectivity</SelectItem>
                  <SelectItem value="hardware_failure">Hardware Failure</SelectItem>
                  <SelectItem value="software_issue">Software Issue</SelectItem>
                  <SelectItem value="toner_cartridge">Toner/Cartridge</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="installation">Installation</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div>
          <Label>Issue Description</Label>
          <Controller
            name="issueDescription"
            control={form.control}
            render={({ field }) => (
              <Textarea 
                {...field} 
                placeholder="Provide detailed description of the issue..." 
                rows={4}
              />
            )}
          />
        </div>

        <div>
          <Label>Priority</Label>
          <Controller
            name="priority"
            control={form.control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div>
          <Label>Preferred Service Date (Optional)</Label>
          <Controller
            name="preferredServiceDate"
            control={form.control}
            render={({ field }) => (
              <Input {...field} type="date" />
            )}
          />
        </div>

        <div>
          <Label>Additional Notes (Optional)</Label>
          <Controller
            name="notes"
            control={form.control}
            render={({ field }) => (
              <Textarea 
                {...field} 
                placeholder="Any additional information..." 
                rows={3}
              />
            )}
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return renderStep1();
    }
  };

  return (
    <div className="space-y-6">
      {renderStepIndicator()}
      
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {renderCurrentStep()}
        
        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevStep}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          {currentStep < 4 ? (
            <Button
              type="button"
              onClick={handleNextStep}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={createTicketMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
              <CheckCircle className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}