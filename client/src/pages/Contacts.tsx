import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { 
  Search, 
  Filter, 
  Plus, 
  MoreHorizontal, 
  Mail, 
  Phone, 
  Calendar, 
  FileText, 
  Edit, 
  Trash2, 
  ChevronDown,
  User,
  Building2,
  Users,
  Target,
  Activity,
  Download,
  Upload,
  Settings,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";

// Contact form schema
const contactFormSchema = z.object({
  salutation: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"), 
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  reportsTo: z.string().optional(),
  companyName: z.string().min(1, "Company is required"),
  companyId: z.string().optional(),
  isPrimaryContact: z.boolean().default(false),
  leadStatus: z.string().optional(),
  leadSource: z.string().optional(),
  emailOptOut: z.boolean().default(false),
  doNotCall: z.boolean().default(false),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

interface Contact {
  // Fields returned by getContacts function
  id: string;
  firstName?: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  companyId: string;
  companyName?: string;
  leadStatus?: string;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  createdAt?: string;
  ownerId?: string;
  ownerName?: string;
  favoriteContentType?: string;
  preferredChannels?: string;
  tenantId: string;
  
  // Additional schema fields for create/edit forms
  salutation?: string;
  department?: string;
  mobile?: string;
  reportsTo?: string;
  contactRoles?: string;
  isPrimaryContact?: boolean;
  leadSource?: string;
  priority?: string;
  estimatedDealValue?: number;
  emailOptOut?: boolean;
  doNotCall?: boolean;
}

export default function Contacts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    contactOwner: "",
    createDate: "",
    lastActivityDate: "",
    leadStatus: "",
    view: "all"
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState("lastActivityDate");
  const [sortOrder, setSortOrder] = useState("desc");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog states
  const [dialogs, setDialogs] = useState({
    createContact: false,
    bulkActions: false,
    logActivity: false,
    contactDetails: false
  });

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Contact form state  
  const [showNewCompanyConfirm, setShowNewCompanyConfirm] = useState(false);
  const [pendingContactData, setPendingContactData] = useState<ContactFormData | null>(null);

  // Contact form
  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      salutation: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      mobile: "",
      title: "",
      department: "",
      reportsTo: "",
      companyName: "",
      companyId: "",
      isPrimaryContact: false,
      leadStatus: "new",
      leadSource: "",
      emailOptOut: false,
      doNotCall: false,
    },
  });

  // Fetch business records for dropdown (since they contain the actual company data)
  const { data: companies, isLoading: companiesLoading, error: companiesError } = useQuery({
    queryKey: ['/api/business-records'],
    queryFn: async () => {
      console.log('[COMPANIES DEBUG] Fetching business records...');
      const data = await apiRequest('/api/business-records');
      console.log('[COMPANIES DEBUG] Fetched business records:', data);
      return data;
    },
    enabled: true,
    retry: 2,
  });

  console.log('[COMPANIES DEBUG] Companies state:', { companies, companiesLoading, companiesError });

  // Fetch users for owner lookup
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      return await apiRequest('/api/users');
    }
  });

  // Helper function to get company name by ID
  const getCompanyName = (companyId: string) => {
    const company = companies?.find((c: any) => c.id === companyId);
    return company?.companyName || '--';
  };

  // Helper function to get user name by ID
  const getUserName = (userId: string) => {
    const user = users?.find((u: any) => u.id === userId);
    if (!user) return 'Unassigned';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unassigned';
  };

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (companyName: string) => {
      const result = await apiRequest('/api/business-records', {
        method: 'POST',
        body: JSON.stringify({
          companyName,
          recordType: 'lead',
          status: 'new'
        })
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
    }
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const result = await apiRequest('/api/company-contacts', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact created successfully",
      });
      contactForm.reset();
      setDialogs(prev => ({ ...prev, createContact: false }));
      queryClient.invalidateQueries({ queryKey: ['/api/company-contacts'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create contact",
        variant: "destructive",
      });
    },
  });

  // Enhanced submit handler with company creation logic
  const onSubmitContact = async (data: ContactFormData) => {
    // Check if the company exists (case-insensitive)
    const existingCompany = companies?.find(
      (company: any) => (company.companyName || company.name)?.toLowerCase() === data.companyName.toLowerCase()
    );

    if (existingCompany) {
      // Company exists, create contact directly
      createContactMutation.mutate({
        ...data,
        companyId: existingCompany.id
      });
    } else {
      // Company doesn't exist, show confirmation dialog
      setPendingContactData(data);
      setShowNewCompanyConfirm(true);
    }
  };

  // Handle creating new company and contact
  const handleCreateNewCompany = async () => {
    if (!pendingContactData) return;

    try {
      // Create company first
      const newCompany = await createCompanyMutation.mutateAsync(pendingContactData.companyName);
      
      // Then create contact with the new company ID
      createContactMutation.mutate({
        ...pendingContactData,
        companyId: newCompany.id
      });
      
      setShowNewCompanyConfirm(false);
      setPendingContactData(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create company",
        variant: "destructive",
      });
    }
  };

  // Handle canceling new company creation
  const handleCancelNewCompany = () => {
    setShowNewCompanyConfirm(false);
    setPendingContactData(null);
  };

  // Filter companies based on search term from form field
  const currentCompanyName = contactForm.watch('companyName') || '';
  const filteredCompanies = companies?.filter((company: any) =>
    company.companyName?.toLowerCase().includes(currentCompanyName.toLowerCase())
  ) || [];

  // Fetch all company contacts directly (since /api/contacts has auth issues)
  const { data: contactsData, isLoading, error } = useQuery({
    queryKey: ['/api/company-contacts', filters, searchQuery, sortBy, sortOrder, currentPage, pageSize],
    queryFn: async () => {
      const data = await apiRequest('/api/company-contacts');
      
      console.log("[CONTACTS UI DEBUG] Raw company-contacts data:", data);
      
      // Transform the flat array into the expected format with pagination
      const allContacts = Array.isArray(data) ? data : [];
      
      console.log("[CONTACTS DEBUG] All contacts before filtering:", allContacts.length);
      console.log("[CONTACTS DEBUG] Search query:", searchQuery);
      console.log("[CONTACTS DEBUG] Filters:", filters);
      
      const filteredContacts = allContacts.filter(contact => {
        // Only apply search filter if there's actually a search query
        if (searchQuery && searchQuery.trim() !== "") {
          const matchesSearch = contact.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                               contact.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                               contact.email?.toLowerCase().includes(searchQuery.toLowerCase());
          if (!matchesSearch) {
            return false;
          }
        }
        
        // Apply view filter first
        if (filters.view === "my" && !contact.ownerId) {
          console.log("[CONTACTS DEBUG] Filtering out contact without owner:", contact.firstName, contact.lastName);
          return false;
        }
        
        if (filters.view === "unassigned" && contact.ownerId) {
          console.log("[CONTACTS DEBUG] Filtering out assigned contact:", contact.firstName, contact.lastName);
          return false;
        }
        
        // Apply other filters
        if (filters.leadStatus && contact.leadStatus !== filters.leadStatus) {
          return false;
        }
        
        if (filters.contactOwner && contact.ownerId !== filters.contactOwner) {
          return false;
        }
        
        return true;
      });
      
      console.log("[CONTACTS DEBUG] Filtered contacts:", filteredContacts.length);
      
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedContacts = filteredContacts.slice(startIndex, endIndex);
      
      return {
        contacts: paginatedContacts,
        total: filteredContacts.length,
        page: currentPage,
        limit: pageSize
      };
    },
    retry: 2,
    enabled: true,
  });

  // Debug logging
  console.log("[CONTACTS UI DEBUG] contactsData:", contactsData);
  console.log("[CONTACTS UI DEBUG] contacts array:", contactsData?.contacts || []);
  console.log("[CONTACTS UI DEBUG] totalContacts:", contactsData?.total || 0);
  console.log("[CONTACTS UI DEBUG] API Response keys:", contactsData ? Object.keys(contactsData) : "null");

  const contacts = contactsData?.contacts || [];
  const totalContacts = contactsData?.total || 0;
  const totalPages = Math.ceil(totalContacts / pageSize);


  // Get unique values for filters
  const uniqueOwners = [...new Set(contacts.map((c: Contact) => c.ownerName).filter(Boolean))];
  const uniqueStatuses = [...new Set(contacts.map((c: Contact) => c.leadStatus).filter(Boolean))];

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-green-100 text-green-800';
      case 'unqualified': return 'bg-red-100 text-red-800';
      case 'customer': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map((c: Contact) => c.id));
    }
  };

  const handleLogActivity = (contact: Contact) => {
    setSelectedContact(contact);
    setDialogs(prev => ({ ...prev, logActivity: true }));
  };

  const handleViewContact = (contact: Contact) => {
    setSelectedContact(contact);
    setDialogs(prev => ({ ...prev, contactDetails: true }));
  };

  const clearFilters = () => {
    setFilters({
      contactOwner: "",
      createDate: "",
      lastActivityDate: "",
      leadStatus: "",
      view: "all"
    });
    setSearchQuery("");
  };

  if (isLoading) {
    return (
      <MainLayout title="Contacts" description="Manage your contacts and leads">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading contacts...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Contacts" description="Manage your contacts and leads">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Contacts</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">{totalContacts} records</p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <Button variant="outline" size="sm" className="flex-shrink-0">
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="outline" size="sm" className="flex-shrink-0">
              <Upload className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Dialog open={dialogs.createContact} onOpenChange={(open) => setDialogs(prev => ({ ...prev, createContact: open }))}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 flex-shrink-0">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create contact</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create new contact</DialogTitle>
                </DialogHeader>
                <Form {...contactForm}>
                  <form onSubmit={contactForm.handleSubmit(onSubmitContact)} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="salutation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Salutation</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select salutation" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Mr.">Mr.</SelectItem>
                                <SelectItem value="Mrs.">Mrs.</SelectItem>
                                <SelectItem value="Ms.">Ms.</SelectItem>
                                <SelectItem value="Dr.">Dr.</SelectItem>
                                <SelectItem value="Prof.">Prof.</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter first name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter last name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="email"
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
                      <FormField
                        control={contactForm.control}
                        name="phone"
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
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="mobile"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter mobile number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job title</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter job title" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="sales">Sales</SelectItem>
                                <SelectItem value="marketing">Marketing</SelectItem>
                                <SelectItem value="finance">Finance</SelectItem>
                                <SelectItem value="operations">Operations</SelectItem>
                                <SelectItem value="hr">Human Resources</SelectItem>
                                <SelectItem value="it">IT</SelectItem>
                                <SelectItem value="purchasing">Purchasing</SelectItem>
                                <SelectItem value="management">Management</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="reportsTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reports To</FormLabel>
                            <FormControl>
                              <Input placeholder="Manager or supervisor" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company *</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input
                                  placeholder="Type company name..."
                                  {...field}
                                  value={field.value || ""}
                                  list="companies-datalist"
                                  autoComplete="off"
                                />
                              </FormControl>
                              <datalist id="companies-datalist">
                                {companies?.map((company: any) => (
                                  <option key={company.id} value={company.companyName || company.name}>
                                    {company.companyName || company.name} ({company.recordType || 'company'})
                                  </option>
                                ))}
                              </datalist>
                            </div>
                            {currentCompanyName && !filteredCompanies.some((c: any) => 
                              (c.companyName || c.name)?.toLowerCase() === currentCompanyName.toLowerCase()
                            ) && (
                              <div className="text-xs text-blue-600 mt-1">
                                ✨ New company "{currentCompanyName}" will be created as a lead
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="isPrimaryContact"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Primary contact</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="leadStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lead status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="contacted">Contacted</SelectItem>
                                <SelectItem value="qualified">Qualified</SelectItem>
                                <SelectItem value="unqualified">Unqualified</SelectItem>
                                <SelectItem value="customer">Customer</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="leadSource"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lead Source</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select source" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="website">Website</SelectItem>
                                <SelectItem value="referral">Referral</SelectItem>
                                <SelectItem value="cold_call">Cold Call</SelectItem>
                                <SelectItem value="email_campaign">Email Campaign</SelectItem>
                                <SelectItem value="trade_show">Trade Show</SelectItem>
                                <SelectItem value="social_media">Social Media</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Communication Preferences */}
                    <div className="space-y-3">
                      <FormLabel className="text-base font-medium">Communication Preferences</FormLabel>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={contactForm.control}
                          name="emailOptOut"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Email Opt-Out</FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={contactForm.control}
                          name="doNotCall"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Do Not Call</FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => setDialogs(prev => ({ ...prev, createContact: false }))}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        className="bg-orange-500 hover:bg-orange-600"
                        disabled={createContactMutation.isPending}
                      >
                        {createContactMutation.isPending ? "Creating..." : "Create contact"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* New Company Confirmation Dialog */}
            <Dialog open={showNewCompanyConfirm} onOpenChange={setShowNewCompanyConfirm}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Company</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    The company "<span className="font-semibold">{pendingContactData?.companyName}</span>" 
                    doesn't exist in your database.
                  </p>
                  <p className="text-sm text-gray-600">
                    Would you like to create this company as a new lead? The contact will be added to this new company.
                  </p>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={handleCancelNewCompany}
                    >
                      No, let me select a different company
                    </Button>
                    <Button 
                      onClick={handleCreateNewCompany}
                      className="bg-orange-500 hover:bg-orange-600"
                      disabled={createCompanyMutation.isPending || createContactMutation.isPending}
                    >
                      {(createCompanyMutation.isPending || createContactMutation.isPending) ? "Creating..." : "Yes, create company"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters and Views */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                  <Button 
                    variant={filters.view === "all" ? "default" : "outline"} 
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => setFilters(prev => ({ ...prev, view: "all" }))}
                  >
                    All contacts
                  </Button>
                  <Button 
                    variant={filters.view === "my" ? "default" : "outline"} 
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => setFilters(prev => ({ ...prev, view: "my" }))}
                  >
                    My contacts
                  </Button>
                  <Button 
                    variant={filters.view === "unassigned" ? "default" : "outline"} 
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => setFilters(prev => ({ ...prev, view: "unassigned" }))}
                  >
                    Unassigned
                  </Button>
                </div>
                <div className="text-sm text-gray-500 hidden lg:block">
                  <Button variant="ghost" size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Add view (4/5)
                  </Button>
                </div>
              </div>
              <div className="text-sm text-gray-500 hidden sm:block">
                All Views
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search name, phone, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto">
                <Select value={filters.contactOwner} onValueChange={(value) => setFilters(prev => ({ ...prev, contactOwner: value }))}>
                  <SelectTrigger className="w-40 flex-shrink-0">
                    <SelectValue placeholder="Contact owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All owners</SelectItem>
                    {uniqueOwners.map(owner => (
                      <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.leadStatus} onValueChange={(value) => setFilters(prev => ({ ...prev, leadStatus: value }))}>
                  <SelectTrigger className="w-40 flex-shrink-0">
                    <SelectValue placeholder="Lead status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {uniqueStatuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-shrink-0"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  <Filter className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Advanced filters</span>
                  <span className="sm:hidden">Filters</span>
                </Button>

                <Button variant="ghost" size="sm" className="flex-shrink-0" onClick={clearFilters}>
                  <span className="hidden sm:inline">Clear filters</span>
                  <span className="sm:hidden">Clear</span>
                </Button>

                <Button variant="outline" size="sm" className="flex-shrink-0">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Create date</Label>
                    <Select value={filters.createDate} onValueChange={(value) => setFilters(prev => ({ ...prev, createDate: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anytime">Any time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="last7days">Last 7 days</SelectItem>
                        <SelectItem value="last30days">Last 30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Last activity date</Label>
                    <Select value={filters.lastActivityDate} onValueChange={(value) => setFilters(prev => ({ ...prev, lastActivityDate: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anytime">Any time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="last7days">Last 7 days</SelectItem>
                        <SelectItem value="last30days">Last 30 days</SelectItem>
                        <SelectItem value="never">Never contacted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Next follow-up</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anytime">Any time</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="tomorrow">Tomorrow</SelectItem>
                        <SelectItem value="thisweek">This week</SelectItem>
                        <SelectItem value="nextweek">Next week</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Quality Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Data Quality</p>
                <p className="text-sm text-blue-700">Your contact data quality is good. 95% of contacts have complete information.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100 flex-shrink-0">
              <span className="hidden sm:inline">Improve data quality</span>
              <span className="sm:hidden">Improve</span>
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedContacts.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <span className="font-medium text-blue-900">
                  {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto">
                <Button variant="outline" size="sm" className="flex-shrink-0">
                  <Mail className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Send email</span>
                </Button>
                <Button variant="outline" size="sm" className="flex-shrink-0">
                  <Edit className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Edit properties</span>
                </Button>
                <Button variant="outline" size="sm" className="flex-shrink-0">
                  <User className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Assign owner</span>
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 flex-shrink-0">
                  <Trash2 className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <h3 className="font-medium text-red-900">Error Loading Contacts</h3>
                  <p className="text-sm text-red-700 mt-1">
                    {error.message || 'Failed to load contacts. Please try again.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Contacts Table */}
        <Card>
          <CardContent className="p-0">
            {contacts.length === 0 && !isLoading && !error ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery || Object.values(filters).some(f => f && f !== 'all') 
                    ? "No contacts match your current search and filters." 
                    : "You haven't added any contacts yet. Create your first contact to get started."
                  }
                </p>
                <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setDialogs(prev => ({ ...prev, createContact: true }))}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first contact
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-4 w-12">
                          <Checkbox 
                            checked={selectedContacts.length === contacts.length && contacts.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </th>
                        <th className="text-left p-4 font-medium text-gray-700">NAME</th>
                        <th className="text-left p-4 font-medium text-gray-700">EMAIL</th>
                        <th className="text-left p-4 font-medium text-gray-700">PHONE</th>
                        <th className="text-left p-4 font-medium text-gray-700">DEPARTMENT</th>
                        <th className="text-left p-4 font-medium text-gray-700">STATUS</th>
                        <th className="text-left p-4 font-medium text-gray-700">COMPANY</th>
                        <th className="text-left p-4 font-medium text-gray-700">OWNER</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact: Contact) => (
                        <tr key={contact.id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                        <Checkbox 
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={() => handleSelectContact(contact.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-blue-100 text-blue-600 text-sm">
                              {contact.firstName?.charAt(0) || 'C'}{contact.lastName?.charAt(0) || 'C'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <button 
                              className="font-medium text-blue-600 hover:text-blue-800 text-left"
                              onClick={() => handleViewContact(contact)}
                            >
                              {contact.salutation ? `${contact.salutation} ` : ''}{contact.firstName || ''} {contact.lastName}
                            </button>
                            {contact.title && (
                              <p className="text-sm text-gray-500">{contact.title}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-900">{contact.email || '--'}</td>
                      <td className="p-4 text-gray-900">{contact.phone || '--'}</td>
                      <td className="p-4 text-gray-900">{contact.department || '--'}</td>
                      <td className="p-4">
                        <Badge className={`${getStatusColor(contact.leadStatus)} border-0`}>
                          {contact.leadStatus || 'New'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">
                            {getCompanyName(contact.companyId)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-900">
                        {getUserName(contact.ownerId)}
                      </td>

                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewContact(contact)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View contact
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLogActivity(contact)}>
                              <Activity className="w-4 h-4 mr-2" />
                              Log activity
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="w-4 h-4 mr-2" />
                              Send email
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Phone className="w-4 h-4 mr-2" />
                              Log call
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Calendar className="w-4 h-4 mr-2" />
                              Schedule meeting
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit contact
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete contact
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Layout */}
                <div className="lg:hidden space-y-4 p-4">
                  {contacts.map((contact: Contact) => (
                    <div key={contact.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <Checkbox 
                            checked={selectedContacts.includes(contact.id)}
                            onCheckedChange={() => handleSelectContact(contact.id)}
                          />
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {contact.firstName?.charAt(0) || 'C'}{contact.lastName?.charAt(0) || 'C'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <button 
                              className="font-semibold text-blue-600 hover:text-blue-800 text-left block"
                              onClick={() => handleViewContact(contact)}
                            >
                              {contact.firstName || ''} {contact.lastName}
                            </button>
                            <p className="text-sm text-gray-500 truncate">{contact.title || 'No title'}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewContact(contact)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLogActivity(contact)}>
                              <Activity className="w-4 h-4 mr-2" />
                              Log activity
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="w-4 h-4 mr-2" />
                              Email
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Phone className="w-4 h-4 mr-2" />
                              Call
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Status:</span>
                          <Badge className={`${getStatusColor(contact.leadStatus)} border-0 text-xs`}>
                            {contact.leadStatus || 'New'}
                          </Badge>
                        </div>
                        
                        {contact.email && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-600">Email:</span>
                            <span className="text-sm text-gray-900 truncate ml-2">{contact.email}</span>
                          </div>
                        )}
                        
                        {contact.phone && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-600">Phone:</span>
                            <span className="text-sm text-gray-900">{contact.phone}</span>
                          </div>
                        )}
                        
                        {contact.department && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-600">Department:</span>
                            <span className="text-sm text-gray-900">{contact.department}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Company:</span>
                          <span className="text-sm text-gray-900 truncate ml-2">{getCompanyName(contact.companyId) || 'No company'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Rows per page:</span>
                <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">
                  {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalContacts)} of {totalContacts}
                </span>
                <div className="flex space-x-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Log Activity Dialog */}
        <Dialog open={dialogs.logActivity} onOpenChange={(open) => setDialogs(prev => ({ ...prev, logActivity: open }))}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Log activity for {selectedContact?.firstName} {selectedContact?.lastName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Button size="sm" variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  Note
                </Button>
                <Button size="sm" variant="outline">
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
                <Button size="sm" variant="outline">
                  <Phone className="w-4 h-4 mr-2" />
                  Call
                </Button>
                <Button size="sm" variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  Meeting
                </Button>
              </div>
              
              <div>
                <Label>Activity notes</Label>
                <Textarea 
                  placeholder="What did you discuss? What are the next steps?"
                  className="mt-1 min-h-[120px]"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Activity date</Label>
                  <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <Label>Follow-up in</Label>
                  <Select defaultValue="7">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">1 week</SelectItem>
                      <SelectItem value="14">2 weeks</SelectItem>
                      <SelectItem value="30">1 month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setDialogs(prev => ({ ...prev, logActivity: false }))}>
                  Cancel
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Log activity
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Contact Details Dialog */}
        <Dialog open={dialogs.contactDetails} onOpenChange={(open) => setDialogs(prev => ({ ...prev, contactDetails: open }))}>
          <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>Contact Details</DialogTitle>
            </DialogHeader>
            {selectedContact && (
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xl">
                      {selectedContact.firstName?.charAt(0)}{selectedContact.lastName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">{selectedContact.firstName} {selectedContact.lastName}</h3>
                    <p className="text-gray-600">{selectedContact.title}</p>
                    <Badge className={`${getStatusColor(selectedContact.leadStatus)} border-0 mt-1`}>
                      {selectedContact.leadStatus || 'New'}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Email</Label>
                      <p className="text-gray-900">{selectedContact.email || 'Not provided'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Phone</Label>
                      <p className="text-gray-900">{selectedContact.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Company</Label>
                      <p className="text-gray-900">{selectedContact.companyName || 'Not provided'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Owner</Label>
                      <p className="text-gray-900">{selectedContact.ownerName || 'Unassigned'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Last Activity</Label>
                      <p className="text-gray-900">{formatDate(selectedContact.lastContactDate)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Next Follow-up</Label>
                      <p className="text-gray-900">{formatDate(selectedContact.nextFollowUpDate)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogs(prev => ({ ...prev, contactDetails: false }))}>
                    Close
                  </Button>
                  <Button>
                    Edit Contact
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}