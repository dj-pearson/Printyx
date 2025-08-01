import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, DollarSign, Calendar, User, Building2, Phone, Mail, TrendingUp, Filter, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Zod schemas for form validation
const dealFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  amount: z.string().optional(),
  companyId: z.string().min(1, "Company is required"),
  companyName: z.string().min(1, "Company name is required"),
  contactId: z.string().optional(),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  primaryContactPhone: z.string().optional(),
  source: z.string().optional(),
  dealType: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  expectedCloseDate: z.string().optional(),
  productsInterested: z.string().optional(),
  estimatedMonthlyValue: z.string().optional(),
  notes: z.string().optional(),
});

type DealFormData = z.infer<typeof dealFormSchema>;

interface Company {
  id: string;
  businessName: string;
  customerNumber?: string;
  phone?: string;
  billingCity?: string;
  billingState?: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
}

interface Deal {
  id: string;
  title: string;
  description?: string;
  amount?: number;
  companyName?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  source?: string;
  dealType?: string;
  priority: string;
  expectedCloseDate?: string;
  productsInterested?: string;
  estimatedMonthlyValue?: number;
  notes?: string;
  status: string;
  probability: number;
  stageId: string;
  stageName?: string;
  stageColor?: string;
  ownerId: string;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
}

interface DealStage {
  id: string;
  name: string;
  description?: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  isClosingStage: boolean;
  isWonStage: boolean;
}

export default function DealsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStageId, setSelectedStageId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [isCompanySearchOpen, setIsCompanySearchOpen] = useState(false);

  // Fetch deal stages
  const { data: stages = [], isLoading: stagesLoading } = useQuery<DealStage[]>({
    queryKey: ["/api/deal-stages"],
  });

  // Fetch companies for dropdown search
  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies", companySearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companySearchTerm) params.append("search", companySearchTerm);
      
      const response = await apiRequest('GET', `/api/companies?${params}`);
      const data = await response.json();
      return data;
    },
  });

  // Fetch contacts for selected company
  const { data: companyContacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/companies", selectedCompanyId, "contacts"],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const response = await apiRequest('GET', `/api/companies/${selectedCompanyId}/contacts`);
      const data = await response.json();
      return data;
    },
    enabled: !!selectedCompanyId,
  });

  // Fetch deals with optional stage filtering
  const { data: deals = [], isLoading: dealsLoading, refetch: refetchDeals } = useQuery<Deal[]>({
    queryKey: ["/api/deals", selectedStageId, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStageId && selectedStageId !== "all") params.append("stageId", selectedStageId);
      if (searchTerm) params.append("search", searchTerm);
      
      const response = await fetch(`/api/deals?${params}`);
      if (!response.ok) throw new Error("Failed to fetch deals");
      return response.json();
    },
  });

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      priority: "medium",
      title: "",
      description: "",
      amount: "",
      companyId: "",
      companyName: "",
      contactId: "",
      primaryContactName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      source: "",
      dealType: "",
      expectedCloseDate: "",
      productsInterested: "",
      estimatedMonthlyValue: "",
      notes: "",
    },
  });

  // Create deal mutation
  const createDealMutation = useMutation({
    mutationFn: async (data: DealFormData) => {
      const dealData = {
        ...data,
        amount: data.amount ? parseFloat(data.amount) : undefined,
        estimatedMonthlyValue: data.estimatedMonthlyValue ? parseFloat(data.estimatedMonthlyValue) : undefined,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate).toISOString() : undefined,
      };
      return apiRequest("POST", "/api/deals", dealData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Deal created successfully",
      });
      setIsCreateDialogOpen(false);
      form.reset();
      refetchDeals();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update deal stage mutation
  const updateDealStageMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      return apiRequest("PUT", `/api/deals/${dealId}/stage`, { stageId });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Deal stage updated successfully",
      });
      refetchDeals();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DealFormData) => {
    createDealMutation.mutate(data);
  };

  const handleStageChange = (dealId: string, newStageId: string) => {
    updateDealStageMutation.mutate({ dealId, stageId: newStageId });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (stagesLoading || dealsLoading) {
    return (
      <MainLayout title="Deals Management" description="Manage your sales pipeline and opportunities">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading deals...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Group deals by stage for kanban view
  const dealsByStage = (stages as DealStage[]).reduce((acc: Record<string, Deal[]>, stage: DealStage) => {
    acc[stage.id] = (deals as Deal[]).filter((deal: Deal) => deal.stageId === stage.id);
    return acc;
  }, {});

  return (
    <MainLayout title="Deals Management" description="Manage your sales pipeline and opportunities">
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger className="w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {stages.map((stage: DealStage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Deal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Deal</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deal Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter deal title" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="companyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company <span className="text-red-500">*</span></FormLabel>
                          <Popover open={isCompanySearchOpen} onOpenChange={setIsCompanySearchOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value
                                    ? companies.find((company) => company.id === field.value)?.businessName || "Company not found"
                                    : "Select company..."}
                                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                              <Command>
                                <CommandInput
                                  placeholder="Search companies..."
                                  value={companySearchTerm}
                                  onValueChange={setCompanySearchTerm}
                                />
                                <CommandEmpty>
                                  <div className="text-center p-4">
                                    <p className="text-sm text-muted-foreground mb-2">No company found.</p>
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        setIsCompanySearchOpen(false);
                                        toast({
                                          title: "Create Company First",
                                          description: "You need to create a company before creating deals. Please go to the Companies section to add a new company.",
                                        });
                                      }}
                                    >
                                      Create Company First
                                    </Button>
                                  </div>
                                </CommandEmpty>
                                <CommandGroup>
                                  {companies.map((company) => (
                                    <CommandItem
                                      key={company.id}
                                      value={company.id}
                                      onSelect={(currentValue) => {
                                        const selectedCompany = companies.find(c => c.id === currentValue);
                                        if (selectedCompany) {
                                          field.onChange(currentValue);
                                          form.setValue("companyName", selectedCompany.businessName);
                                          setSelectedCompanyId(currentValue);
                                          setIsCompanySearchOpen(false);
                                        }
                                      }}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">{company.businessName}</span>
                                        <span className="text-sm text-muted-foreground">
                                          {company.customerNumber && `#${company.customerNumber} • `}
                                          {company.phone && `${company.phone} • `}
                                          {company.billingCity && company.billingState && `${company.billingCity}, ${company.billingState}`}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Deal description..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deal Amount</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estimatedMonthlyValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Monthly Value</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Contact Selection - only show if company is selected */}
                  {selectedCompanyId && (
                    <FormField
                      control={form.control}
                      name="contactId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Contact</FormLabel>
                          <Select onValueChange={(value) => {
                            field.onChange(value);
                            const selectedContact = companyContacts.find(c => c.id === value);
                            if (selectedContact) {
                              form.setValue("primaryContactName", `${selectedContact.firstName} ${selectedContact.lastName}`);
                              form.setValue("primaryContactEmail", selectedContact.email || "");
                              form.setValue("primaryContactPhone", selectedContact.phone || "");
                            }
                          }} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder={contactsLoading ? "Loading contacts..." : "Select contact..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {companyContacts.length === 0 && !contactsLoading ? (
                                <div className="p-2 text-center text-muted-foreground text-sm">
                                  No contacts found for this company
                                </div>
                              ) : (
                                companyContacts.map((contact) => (
                                  <SelectItem key={contact.id} value={contact.id}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{contact.firstName} {contact.lastName}</span>
                                      <span className="text-sm text-muted-foreground">
                                        {contact.title && `${contact.title} • `}
                                        {contact.email && contact.email}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="source"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select source" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="website">Website</SelectItem>
                                <SelectItem value="referral">Referral</SelectItem>
                                <SelectItem value="cold_call">Cold Call</SelectItem>
                                <SelectItem value="trade_show">Trade Show</SelectItem>
                                <SelectItem value="email_campaign">Email Campaign</SelectItem>
                                <SelectItem value="social_media">Social Media</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dealType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deal Type</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new_business">New Business</SelectItem>
                                <SelectItem value="upsell">Upsell</SelectItem>
                                <SelectItem value="renewal">Renewal</SelectItem>
                                <SelectItem value="upgrade">Upgrade</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="expectedCloseDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expected Close Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="productsInterested"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Products of Interest</FormLabel>
                          <FormControl>
                            <Input placeholder="Products they're interested in" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional notes..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createDealMutation.isPending}>
                      {createDealMutation.isPending ? "Creating..." : "Create Deal"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-6">
          {stages.map((stage: DealStage) => {
            const stageDeals = dealsByStage[stage.id] || [];
            const stageTotal = stageDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
            
            return (
              <Card key={stage.id} className="h-fit">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {stageDeals.length}
                    </Badge>
                  </div>
                  {stageTotal > 0 && (
                    <p className="text-sm text-gray-600">
                      Total: {formatCurrency(stageTotal)}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {stageDeals.map((deal) => (
                      <Card key={deal.id} className="p-3 border hover:shadow-md transition-shadow cursor-pointer">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-sm line-clamp-2">{deal.title}</h4>
                            <Badge className={cn("text-xs", getPriorityColor(deal.priority))}>
                              {deal.priority}
                            </Badge>
                          </div>
                          
                          {deal.amount && (
                            <div className="flex items-center text-sm text-gray-600">
                              <DollarSign className="w-3 h-3 mr-1" />
                              {formatCurrency(deal.amount)}
                            </div>
                          )}
                          
                          {deal.companyName && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Building2 className="w-3 h-3 mr-1" />
                              {deal.companyName}
                            </div>
                          )}
                          
                          {deal.primaryContactName && (
                            <div className="flex items-center text-sm text-gray-600">
                              <User className="w-3 h-3 mr-1" />
                              {deal.primaryContactName}
                            </div>
                          )}
                          
                          {deal.expectedCloseDate && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Calendar className="w-3 h-3 mr-1" />
                              {format(new Date(deal.expectedCloseDate), "MMM d, yyyy")}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center text-xs text-gray-500">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              {deal.probability}%
                            </div>
                            <Select 
                              value={deal.stageId} 
                              onValueChange={(newStageId) => handleStageChange(deal.id, newStageId)}
                            >
                              <SelectTrigger className="h-6 text-xs border-none p-0 font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {stages.map((s: DealStage) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: s.color }}
                                      />
                                      {s.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </Card>
                    ))}
                    
                    {stageDeals.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-sm">No deals in this stage</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}