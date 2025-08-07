import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Settings, 
  Network, 
  Printer, 
  Shield, 
  CheckCircle,
  Plus,
  Trash2,
  Save
} from "lucide-react";

// Comprehensive onboarding schema
const onboardingSchema = z.object({
  // Basic Information
  checklistTitle: z.string().min(1, "Checklist title is required"),
  customerData: z.object({
    companyName: z.string().min(1, "Company name is required"),
    primaryContact: z.string().min(1, "Primary contact is required"),
    phone: z.string().min(1, "Phone number is required"),
    email: z.string().email("Valid email is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zipCode: z.string().min(1, "ZIP code is required"),
  }),
  
  // Site Information
  siteInformation: z.object({
    installationAddress: z.string().min(1, "Installation address is required"),
    contactPerson: z.string().min(1, "Contact person is required"),
    phoneNumber: z.string().min(1, "Phone number is required"),
    accessInstructions: z.string().optional(),
    buildingType: z.enum(["office", "warehouse", "retail", "medical", "educational", "other"]),
    floorsPlan: z.string().optional(),
    specialRequirements: z.string().optional(),
  }),

  // Scheduling
  scheduledInstallDate: z.string().min(1, "Scheduled install date is required"),
  preferredTimeSlot: z.enum(["morning", "afternoon", "evening", "all_day"]),
  estimatedDuration: z.string().min(1, "Estimated duration is required"),
  
  // Equipment Details
  equipment: z.array(z.object({
    equipmentType: z.enum(["printer", "copier", "scanner", "fax", "mfp", "other"]),
    manufacturer: z.string().min(1, "Manufacturer is required"),
    model: z.string().min(1, "Model is required"),
    serialNumber: z.string().min(1, "Serial number is required"),
    location: z.string().min(1, "Location is required"),
    features: z.array(z.string()).default([]),
    accessories: z.array(z.string()).default([]),
  })).min(1, "At least one equipment item is required"),

  // Network Configuration
  networkConfig: z.object({
    networkType: z.enum(["wired", "wireless", "both"]),
    ipAssignment: z.enum(["static", "dhcp"]),
    staticIpAddress: z.string().optional(),
    subnetMask: z.string().optional(),
    gateway: z.string().optional(),
    dnsServers: z.string().optional(),
    wirelessSSID: z.string().optional(),
    wirelessPassword: z.string().optional(),
    vlanConfig: z.string().optional(),
    portConfiguration: z.string().optional(),
  }),

  // Print Management
  printManagement: z.object({
    driverInstallation: z.boolean().default(false),
    queueSetup: z.boolean().default(false),
    userPermissions: z.string().optional(),
    defaultSettings: z.string().optional(),
    colorManagement: z.string().optional(),
    paperSettings: z.string().optional(),
    finishingOptions: z.string().optional(),
  }),

  // Security & Access
  security: z.object({
    userAuthentication: z.boolean().default(false),
    accessCodes: z.string().optional(),
    departmentCodes: z.string().optional(),
    encryptionSettings: z.string().optional(),
    auditingEnabled: z.boolean().default(false),
    secureRelease: z.boolean().default(false),
  }),

  // Dynamic Sections
  dynamicSections: z.array(z.object({
    sectionTitle: z.string().min(1, "Section title is required"),
    sectionType: z.enum(["installation", "training", "maintenance", "configuration", "other"]),
    fields: z.array(z.object({
      fieldName: z.string().min(1, "Field name is required"),
      fieldType: z.enum(["text", "textarea", "checkbox", "select", "date"]),
      fieldValue: z.string().optional(),
      isRequired: z.boolean().default(false),
      options: z.array(z.string()).default([]),
    })).default([]),
    completed: z.boolean().default(false),
    completedBy: z.string().optional(),
    completedAt: z.string().optional(),
    notes: z.string().optional(),
  })).default([]),

  // Additional Services
  additionalServices: z.object({
    training: z.boolean().default(false),
    maintenanceContract: z.boolean().default(false),
    supportPackage: z.string().optional(),
    followUpRequired: z.boolean().default(false),
    followUpDate: z.string().optional(),
  }),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

export default function ComprehensiveOnboardingForm() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [equipmentItems, setEquipmentItems] = useState([{
    equipmentType: "printer" as const,
    manufacturer: "",
    model: "",
    serialNumber: "",
    location: "",
    features: [],
    accessories: [],
  }]);
  const [dynamicSections, setDynamicSections] = useState([]);
  const queryClient = useQueryClient();

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      checklistTitle: "",
      customerData: {
        companyName: "",
        primaryContact: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
      },
      siteInformation: {
        installationAddress: "",
        contactPerson: "",
        phoneNumber: "",
        accessInstructions: "",
        buildingType: "office",
        floorsPlan: "",
        specialRequirements: "",
      },
      scheduledInstallDate: "",
      preferredTimeSlot: "morning",
      estimatedDuration: "",
      equipment: equipmentItems,
      networkConfig: {
        networkType: "wired",
        ipAssignment: "dhcp",
      },
      printManagement: {
        driverInstallation: false,
        queueSetup: false,
      },
      security: {
        userAuthentication: false,
        auditingEnabled: false,
        secureRelease: false,
      },
      dynamicSections: [],
      additionalServices: {
        training: false,
        maintenanceContract: false,
        followUpRequired: false,
      },
    },
  });

  const createChecklistMutation = useMutation({
    mutationFn: (data: OnboardingFormData) => 
      apiRequest("/api/onboarding/checklists", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Onboarding checklist created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/checklists"] });
      setLocation("/onboarding");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checklist",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: OnboardingFormData) => {
    createChecklistMutation.mutate(data);
  };

  const addEquipmentItem = () => {
    const newItem = {
      equipmentType: "printer" as const,
      manufacturer: "",
      model: "",
      serialNumber: "",
      location: "",
      features: [],
      accessories: [],
    };
    setEquipmentItems([...equipmentItems, newItem]);
    form.setValue("equipment", [...equipmentItems, newItem]);
  };

  const removeEquipmentItem = (index: number) => {
    const updatedItems = equipmentItems.filter((_, i) => i !== index);
    setEquipmentItems(updatedItems);
    form.setValue("equipment", updatedItems);
  };

  const addDynamicSection = () => {
    const newSection = {
      sectionTitle: "",
      sectionType: "installation" as const,
      fields: [],
      completed: false,
      notes: "",
    };
    const updatedSections = [...dynamicSections, newSection];
    setDynamicSections(updatedSections);
    form.setValue("dynamicSections", updatedSections);
  };

  const steps = [
    { number: 1, title: "Basic Information", icon: Building2 },
    { number: 2, title: "Site Details", icon: MapPin },
    { number: 3, title: "Scheduling", icon: Calendar },
    { number: 4, title: "Equipment", icon: Printer },
    { number: 5, title: "Network Setup", icon: Network },
    { number: 6, title: "Print Management", icon: Settings },
    { number: 7, title: "Security", icon: Shield },
    { number: 8, title: "Custom Sections", icon: Plus },
    { number: 9, title: "Additional Services", icon: CheckCircle },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="checklistTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Checklist Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter checklist title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerData.companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="customerData.primaryContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Contact</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter primary contact name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerData.phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="customerData.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="customerData.address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter street address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="customerData.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter city" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="customerData.state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter state" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="customerData.zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter ZIP code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="siteInformation.installationAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Installation Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter installation address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="siteInformation.contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>On-site Contact Person</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter contact person name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="siteInformation.phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="siteInformation.buildingType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Building Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select building type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="office">Office</SelectItem>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="medical">Medical</SelectItem>
                      <SelectItem value="educational">Educational</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="siteInformation.accessInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Instructions</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter any special access instructions (security codes, parking, etc.)" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="siteInformation.specialRequirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Requirements</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter any special installation requirements" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduledInstallDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Install Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="preferredTimeSlot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Time Slot</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select time slot" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="morning">Morning (8 AM - 12 PM)</SelectItem>
                        <SelectItem value="afternoon">Afternoon (12 PM - 5 PM)</SelectItem>
                        <SelectItem value="evening">Evening (5 PM - 8 PM)</SelectItem>
                        <SelectItem value="all_day">All Day</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="estimatedDuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Duration</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 2-4 hours" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Equipment Details</h3>
              <Button type="button" onClick={addEquipmentItem} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Equipment
              </Button>
            </div>

            {equipmentItems.map((item, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">Equipment #{index + 1}</CardTitle>
                    {equipmentItems.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeEquipmentItem(index)}
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`equipment.${index}.equipmentType`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="printer">Printer</SelectItem>
                              <SelectItem value="copier">Copier</SelectItem>
                              <SelectItem value="scanner">Scanner</SelectItem>
                              <SelectItem value="fax">Fax</SelectItem>
                              <SelectItem value="mfp">Multi-Function Printer</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`equipment.${index}.manufacturer`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manufacturer</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Canon, HP, Xerox" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`equipment.${index}.model`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter model number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`equipment.${index}.serialNumber`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serial Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter serial number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`equipment.${index}.location`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Installation Location</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Main Office, Floor 2 Copy Room" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Network Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="networkConfig.networkType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Network Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select network type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="wired">Wired</SelectItem>
                        <SelectItem value="wireless">Wireless</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="networkConfig.ipAssignment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP Assignment</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select IP assignment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="dhcp">DHCP (Automatic)</SelectItem>
                        <SelectItem value="static">Static IP</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {form.watch("networkConfig.ipAssignment") === "static" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="networkConfig.staticIpAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Static IP Address</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 192.168.1.100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="networkConfig.subnetMask"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subnet Mask</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 255.255.255.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="networkConfig.gateway"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gateway</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 192.168.1.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="networkConfig.dnsServers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DNS Servers</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 8.8.8.8, 8.8.4.4" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {(form.watch("networkConfig.networkType") === "wireless" || 
              form.watch("networkConfig.networkType") === "both") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="networkConfig.wirelessSSID"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wireless SSID</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter WiFi network name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="networkConfig.wirelessPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wireless Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter WiFi password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Print Management Setup</h3>
            
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="printManagement.driverInstallation"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Driver Installation Required</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="printManagement.queueSetup"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Print Queue Setup Required</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="printManagement.userPermissions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User Permissions</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Define user access levels and permissions" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="printManagement.defaultSettings"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Print Settings</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Specify default print settings (duplex, paper size, etc.)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Security Configuration</h3>
            
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="security.userAuthentication"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>User Authentication Required</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="security.auditingEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Enable Audit Logging</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="security.secureRelease"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Secure Print Release</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="security.accessCodes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Codes</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter access codes if required" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="security.departmentCodes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Codes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter department-specific codes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 8:
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Custom Sections</h3>
              <Button type="button" onClick={addDynamicSection} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Section
              </Button>
            </div>

            {dynamicSections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No custom sections added yet.</p>
                <p className="text-sm">Add sections for additional installation requirements.</p>
              </div>
            ) : (
              dynamicSections.map((section, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-base">Custom Section #{index + 1}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`dynamicSections.${index}.sectionTitle`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Section Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter section title" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`dynamicSections.${index}.sectionType`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Section Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="installation">Installation</SelectItem>
                                <SelectItem value="training">Training</SelectItem>
                                <SelectItem value="maintenance">Maintenance</SelectItem>
                                <SelectItem value="configuration">Configuration</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`dynamicSections.${index}.notes`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter section notes or instructions" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );

      case 9:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Additional Services</h3>
            
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="additionalServices.training"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>User Training Required</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="additionalServices.maintenanceContract"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Maintenance Contract</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="additionalServices.followUpRequired"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Follow-up Required</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="additionalServices.supportPackage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Support Package</FormLabel>
                  <FormControl>
                    <Input placeholder="Specify support package details" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("additionalServices.followUpRequired") && (
              <FormField
                control={form.control}
                name="additionalServices.followUpDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Follow-up Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Comprehensive Onboarding Checklist</h1>
        <p className="text-muted-foreground">
          Create a detailed installation and onboarding checklist for client equipment deployment
        </p>
      </div>

      {/* Step Progress Indicator */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 mb-4">
          {steps.map((step) => (
            <div
              key={step.number}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm ${
                currentStep === step.number
                  ? "bg-primary text-primary-foreground"
                  : currentStep > step.number
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <step.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{step.title}</span>
              <Badge variant="secondary" className="ml-1">
                {step.number}
              </Badge>
            </div>
          ))}
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {(() => {
                  const currentStepData = steps.find(s => s.number === currentStep);
                  if (currentStepData?.icon) {
                    const IconComponent = currentStepData.icon;
                    return <IconComponent className="h-5 w-5" />;
                  }
                  return null;
                })()}
                <span>{steps.find(s => s.number === currentStep)?.title}</span>
              </CardTitle>
              <CardDescription>
                Step {currentStep} of {steps.length}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderStepContent()}
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
            >
              Previous
            </Button>

            <div className="flex space-x-2">
              {currentStep < steps.length ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={createChecklistMutation.isPending}
                  className="min-w-32"
                >
                  {createChecklistMutation.isPending ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Save className="h-4 w-4" />
                      <span>Create Checklist</span>
                    </div>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}