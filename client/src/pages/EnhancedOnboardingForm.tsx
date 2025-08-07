import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Save,
  Download,
  Search,
  Router,
  Monitor,
  HardDrive,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

// Enhanced onboarding schema with auto-population and machine replacement
const enhancedOnboardingSchema = z.object({
  // Basic Information - Auto-populated from business_records
  checklistTitle: z.string().min(1, "Checklist title is required"),
  businessRecordId: z.string().optional(), // Link to business_records table
  quoteId: z.string().optional(), // Link to quotes table
  orderId: z.string().optional(), // Link to orders table

  customerData: z.object({
    companyName: z.string().min(1, "Company name is required"),
    primaryContact: z.string().min(1, "Primary contact is required"),
    phone: z.string().min(1, "Phone number is required"),
    email: z.string().email("Valid email is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zipCode: z.string().min(1, "ZIP code is required"),
    accountManager: z.string().optional(),
    customerNumber: z.string().optional(),
    industry: z.string().optional(),
  }),

  // Site Information
  siteInformation: z.object({
    installationAddress: z.string().min(1, "Installation address is required"),
    contactPerson: z.string().min(1, "Contact person is required"),
    phoneNumber: z.string().min(1, "Phone number is required"),
    accessInstructions: z.string().optional(),
    buildingType: z.enum([
      "office",
      "warehouse",
      "retail",
      "medical",
      "educational",
      "other",
    ]),
    floorsPlan: z.string().optional(),
    specialRequirements: z.string().optional(),
  }),

  // Scheduling
  scheduledInstallDate: z.string().min(1, "Scheduled install date is required"),
  preferredTimeSlot: z.enum(["morning", "afternoon", "evening", "all_day"]),
  estimatedDuration: z.string().min(1, "Estimated duration is required"),

  // Equipment Details with Machine Replacement Tracking
  equipment: z
    .array(
      z.object({
        equipmentType: z.enum([
          "printer",
          "copier",
          "scanner",
          "fax",
          "mfp",
          "other",
        ]),
        manufacturer: z.string().min(1, "Manufacturer is required"),
        model: z.string().min(1, "Model is required"),
        serialNumber: z.string().min(1, "Serial number is required"),
        macAddress: z.string().optional(),
        location: z.string().min(1, "Location is required"),
        features: z.array(z.string()).default([]),
        accessories: z.array(z.string()).default([]),

        // Machine Replacement Information
        isReplacement: z.boolean().default(false),
        replacedEquipment: z
          .object({
            oldHostname: z.string().optional(),
            oldIPAddress: z.string().optional(),
            oldMake: z.string().optional(),
            oldModel: z.string().optional(),
            oldSerialNumber: z.string().optional(),
            oldMacAddress: z.string().optional(),
            oldAssetTag: z.string().optional(),
            oldLocationNotes: z.string().optional(),
            removalDate: z.string().optional(),
            migrationNotes: z.string().optional(),
          })
          .optional(),

        // New Equipment Network Configuration
        networkConfiguration: z
          .object({
            targetIPAddress: z.string().optional(),
            newHostname: z.string().optional(),
            customerNumber: z.string().optional(),
            buildingLocation: z.string().optional(),
            specificLocation: z.string().optional(),
            smtpName: z.string().optional(),
            vlanId: z.string().optional(),
            networkSegment: z.string().optional(),
          })
          .optional(),
      })
    )
    .min(1, "At least one equipment item is required"),

  // Enhanced Network Configuration for Complex Setups
  networkConfig: z.object({
    networkType: z.enum(["wired", "wireless", "both"]),
    ipAssignment: z.enum(["static", "dhcp", "reserved"]),
    staticIpAddress: z.string().optional(),
    subnetMask: z.string().optional(),
    gateway: z.string().optional(),
    dnsServers: z.string().optional(),
    alternateIPs: z.string().optional(),
    wirelessSSID: z.string().optional(),
    wirelessPassword: z.string().optional(),
    vlanConfig: z.string().optional(),
    portConfiguration: z.string().optional(),

    // Advanced Network Settings
    switchLocation: z.string().optional(),
    switchPort: z.string().optional(),
    trunkingRequired: z.boolean().default(false),
    firewallRules: z.string().optional(),
    qosSettings: z.string().optional(),
    namingConvention: z.string().optional(),
    dnsUpdate: z.boolean().default(false),
    hostsFileEntry: z.boolean().default(false),
  }),

  // Enhanced Print Management for Papercut Integration
  printManagement: z.object({
    system: z
      .enum(["papercut", "equitrac", "ysoft", "other", "none"])
      .default("none"),
    systemVersion: z.string().optional(),
    serverAddress: z.string().optional(),
    authenticationType: z.enum(["ldap", "local", "sso"]).optional(),

    driverInstallation: z.boolean().default(false),
    queueSetup: z.boolean().default(false),
    queueName: z.string().optional(),
    costCenter: z.string().optional(),
    deviceType: z.enum(["printer", "mfp", "copier"]).optional(),
    capabilities: z.array(z.string()).default([]),

    userPermissions: z.string().optional(),
    userGroups: z.array(z.string()).default([]),
    printQuotas: z
      .object({
        dailyLimit: z.number().optional(),
        monthlyLimit: z.number().optional(),
        costPerPage: z.number().optional(),
      })
      .optional(),

    restrictions: z
      .object({
        colorPrinting: z.boolean().default(true),
        duplexOnly: z.boolean().default(false),
        timeRestrictions: z.string().optional(),
      })
      .optional(),

    accountCodes: z
      .object({
        required: z.boolean().default(false),
        validCodes: z.array(z.string()).default([]),
        defaultCode: z.string().optional(),
      })
      .optional(),

    defaultSettings: z.string().optional(),
    colorManagement: z.string().optional(),
    paperSettings: z.string().optional(),
    finishingOptions: z.string().optional(),
  }),

  // Security
  security: z.object({
    userAuthentication: z.boolean().default(false),
    auditingEnabled: z.boolean().default(false),
    secureRelease: z.boolean().default(false),
    encryptionRequired: z.boolean().default(false),
    accessControls: z.string().optional(),
    complianceRequirements: z.string().optional(),
  }),

  // Dynamic Sections
  dynamicSections: z
    .array(
      z.object({
        sectionTitle: z.string().min(1, "Section title is required"),
        sectionType: z.enum([
          "installation",
          "training",
          "maintenance",
          "configuration",
          "other",
        ]),
        fields: z
          .array(
            z.object({
              fieldName: z.string(),
              fieldType: z.enum(["text", "textarea", "checkbox", "select"]),
              fieldValue: z.string(),
              required: z.boolean().default(false),
            })
          )
          .default([]),
        completed: z.boolean().default(false),
        notes: z.string().optional(),
      })
    )
    .default([]),

  // Additional Services
  additionalServices: z.object({
    training: z.boolean().default(false),
    maintenanceContract: z.boolean().default(false),
    followUpRequired: z.boolean().default(false),
    trainingNotes: z.string().optional(),
    maintenanceDetails: z.string().optional(),
    followUpDate: z.string().optional(),
  }),
});

type EnhancedOnboardingFormData = z.infer<typeof enhancedOnboardingSchema>;

export default function EnhancedOnboardingForm() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedBusinessRecord, setSelectedBusinessRecord] =
    useState<any>(null);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [businessRecordSearch, setBusinessRecordSearch] = useState("");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [equipmentItems, setEquipmentItems] = useState([
    {
      equipmentType: "printer" as const,
      manufacturer: "",
      model: "",
      serialNumber: "",
      macAddress: "",
      location: "",
      features: [],
      accessories: [],
      isReplacement: false,
      replacedEquipment: {},
      networkConfiguration: {},
    },
  ]);
  const [dynamicSections, setDynamicSections] = useState<any[]>([]);
  const queryClient = useQueryClient();

  // Fetch business records for auto-population
  const { data: businessRecords = [] } = useQuery({
    queryKey: ["/api/business-records", businessRecordSearch],
    queryFn: () =>
      apiRequest(
        `/api/business-records?search=${encodeURIComponent(
          businessRecordSearch
        )}&limit=10`
      ),
    enabled: businessRecordSearch.length > 2,
  });

  // Fetch quotes for equipment import
  const { data: quotes = [] } = useQuery({
    queryKey: ["/api/quotes", quoteSearch, selectedBusinessRecord?.id],
    queryFn: () => {
      const params = new URLSearchParams();
      if (quoteSearch) params.append("search", quoteSearch);
      if (selectedBusinessRecord?.id)
        params.append("businessRecordId", selectedBusinessRecord.id);
      params.append("limit", "10");
      return apiRequest(`/api/quotes?${params.toString()}`);
    },
    enabled: quoteSearch.length > 2 || !!selectedBusinessRecord?.id,
  });

  // Fetch quote line items when quote is selected
  const { data: quoteLineItems = [] } = useQuery({
    queryKey: ["/api/quote-line-items", selectedQuote?.id],
    queryFn: () => apiRequest(`/api/quotes/${selectedQuote.id}/line-items`),
    enabled: !!selectedQuote?.id,
  });

  // Fetch company contacts when business record is selected
  const { data: companyContacts = [] } = useQuery({
    queryKey: ["/api/company-contacts", selectedBusinessRecord?.id],
    queryFn: () =>
      apiRequest(`/api/companies/${selectedBusinessRecord.id}/contacts`),
    enabled: !!selectedBusinessRecord?.id,
  });

  const form = useForm<EnhancedOnboardingFormData>({
    resolver: zodResolver(enhancedOnboardingSchema),
    defaultValues: {
      checklistTitle: "",
      businessRecordId: "",
      quoteId: "",
      orderId: "",
      customerData: {
        companyName: "",
        primaryContact: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
        accountManager: "",
        customerNumber: "",
        industry: "",
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
        switchLocation: "",
        switchPort: "",
        trunkingRequired: false,
        namingConvention: "",
        dnsUpdate: false,
        hostsFileEntry: false,
      },
      printManagement: {
        system: "none",
        driverInstallation: false,
        queueSetup: false,
        userGroups: [],
        capabilities: [],
        printQuotas: {},
        restrictions: {
          colorPrinting: true,
          duplexOnly: false,
        },
        accountCodes: {
          required: false,
          validCodes: [],
        },
      },
      security: {
        userAuthentication: false,
        auditingEnabled: false,
        secureRelease: false,
        encryptionRequired: false,
      },
      dynamicSections: [],
      additionalServices: {
        training: false,
        maintenanceContract: false,
        followUpRequired: false,
      },
    },
  });

  // Auto-populate form when business record is selected
  useEffect(() => {
    if (selectedBusinessRecord) {
      const primaryContact =
        companyContacts.find((c: any) => c.is_primary) || companyContacts[0];

      form.setValue("businessRecordId", selectedBusinessRecord.id);
      form.setValue(
        "customerData.companyName",
        selectedBusinessRecord.company_name || ""
      );
      form.setValue("customerData.phone", selectedBusinessRecord.phone || "");
      form.setValue("customerData.email", selectedBusinessRecord.email || "");
      form.setValue(
        "customerData.address",
        selectedBusinessRecord.address || ""
      );
      form.setValue("customerData.city", selectedBusinessRecord.city || "");
      form.setValue("customerData.state", selectedBusinessRecord.state || "");
      form.setValue(
        "customerData.zipCode",
        selectedBusinessRecord.zip_code || ""
      );
      form.setValue(
        "customerData.industry",
        selectedBusinessRecord.industry || ""
      );

      if (primaryContact) {
        form.setValue(
          "customerData.primaryContact",
          `${primaryContact.first_name} ${primaryContact.last_name}`
        );
        if (!selectedBusinessRecord.phone && primaryContact.phone) {
          form.setValue("customerData.phone", primaryContact.phone);
        }
        if (!selectedBusinessRecord.email && primaryContact.email) {
          form.setValue("customerData.email", primaryContact.email);
        }
      }

      // Set default installation address to same as billing
      const fullAddress = [
        selectedBusinessRecord.address,
        selectedBusinessRecord.city,
        selectedBusinessRecord.state,
        selectedBusinessRecord.zip_code,
      ]
        .filter(Boolean)
        .join(", ");
      form.setValue("siteInformation.installationAddress", fullAddress);

      setCurrentStep(2); // Move to basic information step
    }
  }, [selectedBusinessRecord, companyContacts, form]);

  // Auto-populate equipment from quote line items
  useEffect(() => {
    if (selectedQuote && quoteLineItems.length > 0) {
      const equipmentFromQuote = quoteLineItems
        .filter(
          (item: any) =>
            item.product_category &&
            ["printer", "copier", "scanner", "fax", "mfp"].includes(
              item.product_category.toLowerCase()
            )
        )
        .map((item: any) => ({
          equipmentType: (item.product_category?.toLowerCase() || "printer") as
            | "printer"
            | "copier"
            | "scanner"
            | "fax"
            | "mfp",
          manufacturer: item.product_name?.split(" ")[0] || "",
          model: item.product_name || "",
          serialNumber: "", // To be filled during installation
          macAddress: "",
          location: "",
          features: [],
          accessories: [],
          isReplacement: false,
          replacedEquipment: {},
          networkConfiguration: {
            customerNumber: selectedBusinessRecord?.customer_number || "",
          },
        }));

      if (equipmentFromQuote.length > 0) {
        setEquipmentItems(equipmentFromQuote);
        form.setValue("equipment", equipmentFromQuote);
        form.setValue("quoteId", selectedQuote.id);
        setCurrentStep(5); // Move to equipment step
      }
    }
  }, [selectedQuote, quoteLineItems, selectedBusinessRecord, form]);

  const createChecklistMutation = useMutation({
    mutationFn: (data: EnhancedOnboardingFormData) =>
      apiRequest("/api/onboarding/checklists", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Enhanced onboarding checklist created successfully",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/onboarding/checklists"],
      });
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

  const onSubmit = (data: EnhancedOnboardingFormData) => {
    createChecklistMutation.mutate(data);
  };

  // Helper functions for equipment management
  const importEquipmentFromQuote = () => {
    if (!selectedQuote || !quoteLineItems.length) {
      toast({
        title: "No Quote Selected",
        description: "Please select a quote first to import equipment.",
        variant: "destructive",
      });
      return;
    }

    const equipmentFromQuote = quoteLineItems
      .filter(
        (item: any) =>
          item.product_category &&
          ["printer", "copier", "scanner", "fax", "mfp"].includes(
            item.product_category.toLowerCase()
          )
      )
      .map((item: any) => ({
        equipmentType: (item.product_category?.toLowerCase() || "printer") as
          | "printer"
          | "copier"
          | "scanner"
          | "fax"
          | "mfp",
        manufacturer: item.product_name?.split(" ")[0] || "",
        model: item.product_name || "",
        serialNumber: "",
        macAddress: "",
        location: "",
        features: [],
        accessories: [],
        isReplacement: false,
        replacedEquipment: {},
        networkConfiguration: {
          customerNumber: selectedBusinessRecord?.customer_number || "",
        },
      }));

    if (equipmentFromQuote.length > 0) {
      setEquipmentItems(equipmentFromQuote);
      form.setValue("equipment", equipmentFromQuote);
      toast({
        title: "Equipment Imported",
        description: `Successfully imported ${equipmentFromQuote.length} equipment items from quote.`,
      });
    }
  };

  const addEquipmentItem = () => {
    const newItem = {
      equipmentType: "printer" as const,
      manufacturer: "",
      model: "",
      serialNumber: "",
      macAddress: "",
      location: "",
      features: [],
      accessories: [],
      isReplacement: false,
      replacedEquipment: {},
      networkConfiguration: {
        customerNumber: selectedBusinessRecord?.customer_number || "",
      },
    };
    const updatedItems = [...equipmentItems, newItem];
    setEquipmentItems(updatedItems);
    form.setValue("equipment", updatedItems);
  };

  const removeEquipmentItem = (index: number) => {
    const updatedItems = equipmentItems.filter((_, i) => i !== index);
    setEquipmentItems(updatedItems);
    form.setValue("equipment", updatedItems);
  };

  const steps = [
    { number: 1, title: "Customer Selection", icon: Search },
    { number: 2, title: "Basic Information", icon: Building2 },
    { number: 3, title: "Site Details", icon: MapPin },
    { number: 4, title: "Scheduling", icon: Calendar },
    { number: 5, title: "Equipment & Replacement", icon: Printer },
    { number: 6, title: "Network Setup", icon: Network },
    { number: 7, title: "Print Management", icon: Settings },
    { number: 8, title: "Security", icon: Shield },
    { number: 9, title: "Custom Sections", icon: Plus },
    { number: 10, title: "Additional Services", icon: CheckCircle },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold mb-2">
                Customer & Quote Selection
              </h3>
              <p className="text-sm text-gray-600">
                Search and select a customer to auto-populate information, then
                optionally import equipment from a quote.
              </p>
            </div>

            {/* Business Record Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Customer Search
                </CardTitle>
                <CardDescription>
                  Search for an existing customer to auto-populate their
                  information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    Search Customers
                  </label>
                  <Input
                    placeholder="Type customer/company name..."
                    value={businessRecordSearch}
                    onChange={(e) => setBusinessRecordSearch(e.target.value)}
                  />
                </div>

                {businessRecords.length > 0 && (
                  <div className="border rounded-lg max-h-40 overflow-y-auto">
                    {businessRecords.map((record: any) => (
                      <div
                        key={record.id}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => {
                          setSelectedBusinessRecord(record);
                          setBusinessRecordSearch("");
                        }}
                      >
                        <div className="font-medium">{record.company_name}</div>
                        <div className="text-sm text-gray-600">
                          {record.first_name} {record.last_name} •{" "}
                          {record.phone}
                        </div>
                        <div className="text-xs text-gray-500">
                          {record.city}, {record.state}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedBusinessRecord && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">
                        Selected Customer
                      </span>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">
                        {selectedBusinessRecord.company_name}
                      </div>
                      <div>
                        {selectedBusinessRecord.first_name}{" "}
                        {selectedBusinessRecord.last_name}
                      </div>
                      <div>
                        {selectedBusinessRecord.phone} •{" "}
                        {selectedBusinessRecord.email}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quote Search - Only show if customer is selected */}
            {selectedBusinessRecord && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Quote Import (Optional)
                  </CardTitle>
                  <CardDescription>
                    Import equipment information from an existing quote
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Search Quotes</label>
                    <Input
                      placeholder="Type quote number or description..."
                      value={quoteSearch}
                      onChange={(e) => setQuoteSearch(e.target.value)}
                    />
                  </div>

                  {quotes.length > 0 && (
                    <div className="border rounded-lg max-h-40 overflow-y-auto">
                      {quotes.map((quote: any) => (
                        <div
                          key={quote.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                          onClick={() => {
                            setSelectedQuote(quote);
                            setQuoteSearch("");
                          }}
                        >
                          <div className="font-medium">
                            {quote.quote_number}
                          </div>
                          <div className="text-sm text-gray-600">
                            {quote.title} • ${quote.total_amount}
                          </div>
                          <div className="text-xs text-gray-500">
                            Status: {quote.status} •{" "}
                            {new Date(quote.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedQuote && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-blue-800">
                          Selected Quote
                        </span>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">
                          {selectedQuote.quote_number}
                        </div>
                        <div>{selectedQuote.title}</div>
                        <div>Total: ${selectedQuote.total_amount}</div>
                        {quoteLineItems.length > 0 && (
                          <div className="mt-2 text-xs">
                            {quoteLineItems.length} line items available for
                            import
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {selectedBusinessRecord && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
                <h3 className="font-medium text-green-800 mb-2">
                  Auto-Populated Customer Information
                </h3>
                <p className="text-sm text-green-700">
                  The following information has been automatically filled from
                  the customer record. Please review and update as needed.
                </p>
              </div>
            )}

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
                      <Input
                        placeholder="Enter primary contact name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerData.phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
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
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email address" {...field} />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerData.accountManager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Manager</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter account manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerData.industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter industry" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                Equipment Configuration & Machine Replacement
              </h3>
              <div className="flex gap-2">
                {selectedQuote && (
                  <Button
                    type="button"
                    onClick={importEquipmentFromQuote}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Import from Quote
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={addEquipmentItem}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Equipment
                </Button>
              </div>
            </div>

            {equipmentItems.map((item, index) => (
              <Card key={index} className="relative">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <Printer className="h-5 w-5" />
                      Equipment {index + 1}
                      {item.isReplacement && (
                        <Badge variant="secondary">Replacement</Badge>
                      )}
                    </CardTitle>
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
                <CardContent className="space-y-6">
                  {/* Basic Equipment Information */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-gray-700">
                      Basic Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`equipment.${index}.equipmentType`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Equipment Type</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="printer">Printer</SelectItem>
                                <SelectItem value="copier">Copier</SelectItem>
                                <SelectItem value="scanner">Scanner</SelectItem>
                                <SelectItem value="fax">Fax Machine</SelectItem>
                                <SelectItem value="mfp">
                                  Multi-Function Printer
                                </SelectItem>
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
                              <Input
                                placeholder="Enter manufacturer"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`equipment.${index}.model`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Model</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter model" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`equipment.${index}.location`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Installation Location</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter location" {...field} />
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
                              <Input
                                placeholder="Enter serial number"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`equipment.${index}.macAddress`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>MAC Address</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="XX:XX:XX:XX:XX:XX"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Machine Replacement Section */}
                  <div className="border-t pt-4">
                    <FormField
                      control={form.control}
                      name={`equipment.${index}.isReplacement`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              This is a replacement installation
                            </FormLabel>
                            <p className="text-sm text-gray-600">
                              Check this if you are replacing existing equipment
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    {item.isReplacement && (
                      <Card className="mt-4 bg-yellow-50">
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Monitor className="h-4 w-4" />
                            Equipment Being Replaced
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`equipment.${index}.replacedEquipment.oldHostname`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Old Hostname</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="e.g., CROFFICE-LASER"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`equipment.${index}.replacedEquipment.oldIPAddress`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Old IP Address</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="e.g., 10.36.20.51"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`equipment.${index}.replacedEquipment.oldMake`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Old Make</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g., HP" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`equipment.${index}.replacedEquipment.oldModel`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Old Model</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="e.g., LaserJet P401"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`equipment.${index}.replacedEquipment.oldSerialNumber`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Old Serial Number</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="e.g., CND249877"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`equipment.${index}.replacedEquipment.oldMacAddress`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Old MAC Address</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="e.g., 786C77196385"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name={`equipment.${index}.replacedEquipment.oldLocationNotes`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Old Location Notes</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., Crossroads crlab-laser"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`equipment.${index}.replacedEquipment.migrationNotes`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Migration Notes</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Notes about data migration, settings transfer, etc."
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Network Configuration Section */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-sm text-gray-700 mb-4 flex items-center gap-2">
                      <Router className="h-4 w-4" />
                      Network Configuration
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`equipment.${index}.networkConfiguration.targetIPAddress`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target IP Address</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., 10.36.20.52"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`equipment.${index}.networkConfiguration.newHostname`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Hostname</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., CR12POD-LASER"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`equipment.${index}.networkConfiguration.buildingLocation`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Building Location</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Crossroads"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`equipment.${index}.networkConfiguration.specificLocation`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Specific Location</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., croffice-laser"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`equipment.${index}.networkConfiguration.smtpName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., @wdmcs.org"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`equipment.${index}.networkConfiguration.vlanId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VLAN ID</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 100" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      default:
        return <div>Step content for step {currentStep}</div>;
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Enhanced Onboarding Checklist</h1>
          <p className="text-gray-600 mt-2">
            Create a comprehensive equipment installation and customer
            onboarding checklist with auto-population and machine replacement
            tracking.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    currentStep >= step.number
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-300 text-gray-400"
                  }`}
                >
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="ml-3">
                  <p
                    className={`text-sm font-medium ${
                      currentStep >= step.number
                        ? "text-blue-600"
                        : "text-gray-500"
                    }`}
                  >
                    Step {step.number}
                  </p>
                  <p
                    className={`text-xs ${
                      currentStep >= step.number
                        ? "text-blue-600"
                        : "text-gray-500"
                    }`}
                  >
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`ml-6 w-16 h-px ${
                      currentStep > step.number ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>
                  Step {currentStep}: {steps[currentStep - 1]?.title}
                </CardTitle>
              </CardHeader>
              <CardContent>{renderStepContent()}</CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              <div className="flex gap-2">
                {currentStep < steps.length ? (
                  <Button type="button" onClick={nextStep}>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={createChecklistMutation.isPending}
                  >
                    {createChecklistMutation.isPending ? (
                      "Creating..."
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Create Checklist
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
