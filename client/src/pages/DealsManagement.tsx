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
import { Plus, DollarSign, Calendar, User, Building2, Phone, Mail, TrendingUp, Filter, Search, ChevronDown, LayoutGrid, List, SlidersHorizontal, GripVertical, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners
} from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

// Draggable Deal Card Component
function DraggableDealCard({ deal, stage }: { deal: Deal; stage: DealStage }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm text-gray-900 line-clamp-2">{deal.title}</h4>
        <div className="flex items-center gap-1">
          <div {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Edit Deal</DropdownMenuItem>
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {deal.amount && (
        <div className="text-lg font-semibold text-green-600 mb-2">
          ${parseFloat(deal.amount.toString()).toLocaleString()}
        </div>
      )}
      
      <div className="space-y-1 text-xs text-gray-600">
        {deal.companyName && (
          <div className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            <span>{deal.companyName}</span>
          </div>
        )}
        
        {deal.primaryContactName && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{deal.primaryContactName}</span>
          </div>
        )}
        
        {deal.expectedCloseDate && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(deal.expectedCloseDate), "MMM d, yyyy")}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between mt-3">
        <Badge 
          variant="secondary" 
          className={cn(
            "text-xs",
            deal.priority === "high" && "bg-red-100 text-red-800",
            deal.priority === "medium" && "bg-yellow-100 text-yellow-800",
            deal.priority === "low" && "bg-green-100 text-green-800"
          )}
        >
          {deal.priority}
        </Badge>
        
        {deal.probability && (
          <span className="text-xs text-gray-500">{deal.probability}%</span>
        )}
      </div>
    </div>
  );
}

export default function DealsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [isCompanySelectOpen, setIsCompanySelectOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    owner: "",
    source: "all",
    dealType: "all",
    priority: "all",
    amountMin: "",
    amountMax: "",
    closeDateFrom: "",
    closeDateTo: ""
  });
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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
      };
      
      const response = await apiRequest('POST', '/api/deals', dealData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setIsCreateDialogOpen(false);
      form.reset();
      setSelectedCompanyId("");
      setSelectedContact(null);
      toast({
        title: "Success",
        description: "Deal created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create deal",
        variant: "destructive",
      });
    },
  });

  // Update deal stage mutation (for drag and drop)
  const updateDealStageMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      const response = await apiRequest('PUT', `/api/deals/${dealId}/stage`, { stageId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Success", 
        description: "Deal moved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to move deal",
        variant: "destructive",
      });
    },
  });

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const dealId = active.id as string;
    const newStageId = over.id as string;

    // Check if we're dropping over a stage column (not another deal)
    const isStageColumn = stages.some(stage => stage.id === newStageId);
    if (!isStageColumn) return;

    // Find the deal and check if it's actually moving to a different stage
    const deal = deals.find(d => d.id === dealId);
    if (deal && deal.stageId !== newStageId) {
      updateDealStageMutation.mutate({ dealId, stageId: newStageId });
    }
  };

  const onSubmit = (data: DealFormData) => {
    createDealMutation.mutate(data);
  };

  // Filter deals based on current filters
  const filteredDeals = deals.filter(deal => {
    if (filters.owner && deal.ownerName && !deal.ownerName.toLowerCase().includes(filters.owner.toLowerCase())) return false;
    if (filters.source && filters.source !== "all" && deal.source && !deal.source.toLowerCase().includes(filters.source.toLowerCase())) return false;
    if (filters.dealType && filters.dealType !== "all" && deal.dealType && !deal.dealType.toLowerCase().includes(filters.dealType.toLowerCase())) return false;
    if (filters.priority && filters.priority !== "all" && deal.priority !== filters.priority) return false;
    if (filters.amountMin && deal.amount && deal.amount < parseFloat(filters.amountMin)) return false;
    if (filters.amountMax && deal.amount && deal.amount > parseFloat(filters.amountMax)) return false;
    if (filters.closeDateFrom && deal.expectedCloseDate && new Date(deal.expectedCloseDate) < new Date(filters.closeDateFrom)) return false;
    if (filters.closeDateTo && deal.expectedCloseDate && new Date(deal.expectedCloseDate) > new Date(filters.closeDateTo)) return false;
    return true;
  });

  // Group deals by stage for kanban view
  const dealsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = filteredDeals.filter(deal => deal.stageId === stage.id);
    return acc;
  }, {} as Record<string, Deal[]>);

  const activeDeal = activeId ? deals.find(deal => deal.id === activeId) : null;

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Deals</h1>
            <p className="text-sm text-gray-600">{filteredDeals.length} deals</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-lg p-1">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="h-8"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Board
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-8"
              >
                <List className="h-4 w-4 mr-1" />
                Table
              </Button>
            </div>

            {/* Filters Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn("gap-2", showFilters && "bg-gray-100")}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
            
            {/* Create Deal Button */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Deal
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Deal</DialogTitle>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Deal Title *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter deal title" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Company Selection */}
                      <FormField
                        control={form.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Company *</FormLabel>
                            <Popover open={isCompanySelectOpen} onOpenChange={setIsCompanySelectOpen}>
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
                                    {field.value || "Select company"}
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput
                                    placeholder="Search companies..."
                                    value={companySearchTerm}
                                    onValueChange={setCompanySearchTerm}
                                  />
                                  <CommandEmpty>No companies found.</CommandEmpty>
                                  <CommandGroup>
                                    {companies.map((company) => (
                                      <CommandItem
                                        key={company.id}
                                        value={company.businessName}
                                        onSelect={() => {
                                          form.setValue("companyName", company.businessName);
                                          form.setValue("companyId", company.id);
                                          setSelectedCompanyId(company.id);
                                          setIsCompanySelectOpen(false);
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-medium">{company.businessName}</span>
                                          {company.billingCity && company.billingState && (
                                            <span className="text-sm text-gray-500">
                                              {company.billingCity}, {company.billingState}
                                            </span>
                                          )}
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

                      {/* Contact Information */}
                      {companyContacts.length > 0 && (
                        <FormField
                          control={form.control}
                          name="primaryContactName"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Primary Contact</FormLabel>
                              <Select 
                                onValueChange={(value) => {
                                  const contact = companyContacts.find(c => c.id === value);
                                  if (contact) {
                                    field.onChange(`${contact.firstName} ${contact.lastName}`);
                                    form.setValue("primaryContactEmail", contact.email || "");
                                    form.setValue("primaryContactPhone", contact.phone || "");
                                    form.setValue("contactId", contact.id);
                                    setSelectedContact(contact);
                                  }
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select contact" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {companyContacts.map((contact) => (
                                    <SelectItem key={contact.id} value={contact.id}>
                                      <div className="flex flex-col">
                                        <span>{contact.firstName} {contact.lastName}</span>
                                        {contact.title && (
                                          <span className="text-sm text-gray-500">{contact.title}</span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="source"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lead Source</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select source" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="website">Website</SelectItem>
                                <SelectItem value="referral">Referral</SelectItem>
                                <SelectItem value="cold_call">Cold Call</SelectItem>
                                <SelectItem value="email">Email Campaign</SelectItem>
                                <SelectItem value="social_media">Social Media</SelectItem>
                                <SelectItem value="trade_show">Trade Show</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
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
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="new_business">New Business</SelectItem>
                                <SelectItem value="upsell">Upsell</SelectItem>
                                <SelectItem value="renewal">Renewal</SelectItem>
                                <SelectItem value="upgrade">Upgrade</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                        name="estimatedMonthlyValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Est. Monthly Value</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="0.00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Deal description..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Additional notes..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
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
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Filters</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Owner</label>
                  <Input
                    placeholder="Filter by owner"
                    value={filters.owner}
                    onChange={(e) => setFilters(prev => ({ ...prev, owner: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Source</label>
                  <Select value={filters.source} onValueChange={(value) => setFilters(prev => ({ ...prev, source: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sources</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="cold_call">Cold Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Priority</label>
                  <Select value={filters.priority} onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All priorities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Deal Type</label>
                  <Select value={filters.dealType} onValueChange={(value) => setFilters(prev => ({ ...prev, dealType: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="new_business">New Business</SelectItem>
                      <SelectItem value="upsell">Upsell</SelectItem>
                      <SelectItem value="renewal">Renewal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Min Amount</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.amountMin}
                    onChange={(e) => setFilters(prev => ({ ...prev, amountMin: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Max Amount</label>
                  <Input
                    type="number"
                    placeholder="1000000"
                    value={filters.amountMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, amountMax: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Close From</label>
                  <Input
                    type="date"
                    value={filters.closeDateFrom}
                    onChange={(e) => setFilters(prev => ({ ...prev, closeDateFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Close To</label>
                  <Input
                    type="date"
                    value={filters.closeDateTo}
                    onChange={(e) => setFilters(prev => ({ ...prev, closeDateTo: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  variant="outline"
                  onClick={() => setFilters({
                    owner: "",
                    source: "all",
                    dealType: "all",
                    priority: "all",
                    amountMin: "",
                    amountMax: "",
                    closeDateFrom: "",
                    closeDateTo: ""
                  })}
                >
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "kanban" ? (
            /* Kanban View */
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-6 h-full overflow-x-auto pb-6">
                {stages.map((stage) => (
                  <div 
                    key={stage.id} 
                    id={stage.id}
                    className="flex-shrink-0 w-80"
                  >
                    <div className="bg-gray-50 rounded-lg h-full flex flex-col min-h-96">
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            <h3 className="font-medium text-gray-900">{stage.name}</h3>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {dealsByStage[stage.id]?.length || 0}
                          </Badge>
                        </div>
                      </div>
                      
                      <SortableContext
                        items={dealsByStage[stage.id]?.map(deal => deal.id) || []}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="flex-1 p-4 space-y-3 overflow-y-auto min-h-0">
                          {dealsByStage[stage.id]?.map((deal) => (
                            <DraggableDealCard key={deal.id} deal={deal} stage={stage} />
                          ))}
                          {(!dealsByStage[stage.id] || dealsByStage[stage.id].length === 0) && (
                            <div className="text-center py-8 text-gray-500 text-sm">
                              No deals in this stage
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    </div>
                  </div>
                ))}
              </div>
              
              <DragOverlay>
                {activeDeal && (
                  <div className="bg-white border rounded-lg p-4 shadow-lg rotate-3">
                    <h4 className="font-medium text-sm text-gray-900">{activeDeal.title}</h4>
                    {activeDeal.amount && (
                      <div className="text-lg font-semibold text-green-600 mt-1">
                        ${parseFloat(activeDeal.amount.toString()).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          ) : (
            /* Table View */
            <Card className="h-full">
              <CardContent className="p-0">
                <div className="overflow-auto h-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedDeals.length === filteredDeals.length && filteredDeals.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDeals(filteredDeals.map(deal => deal.id));
                              } else {
                                setSelectedDeals([]);
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Deal Name</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Close Date</TableHead>
                        <TableHead>Deal Owner</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Probability</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDeals.map((deal) => (
                        <TableRow key={deal.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedDeals.includes(deal.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedDeals(prev => [...prev, deal.id]);
                                } else {
                                  setSelectedDeals(prev => prev.filter(id => id !== deal.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{deal.title}</TableCell>
                          <TableCell>
                            <Select
                              value={deal.stageId}
                              onValueChange={(stageId) => {
                                updateDealStageMutation.mutate({ dealId: deal.id, stageId });
                              }}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {stages.map((stage) => (
                                  <SelectItem key={stage.id} value={stage.id}>
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: stage.color }}
                                      />
                                      {stage.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {deal.expectedCloseDate ? format(new Date(deal.expectedCloseDate), "MMM d, yyyy") : "-"}
                          </TableCell>
                          <TableCell>{deal.ownerName || "-"}</TableCell>
                          <TableCell>
                            {deal.amount ? `$${parseFloat(deal.amount.toString()).toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell>{deal.companyName || "-"}</TableCell>
                          <TableCell>{deal.source || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                deal.priority === "high" && "bg-red-100 text-red-800",
                                deal.priority === "medium" && "bg-yellow-100 text-yellow-800",
                                deal.priority === "low" && "bg-green-100 text-green-800"
                              )}
                            >
                              {deal.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>{deal.probability}%</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Edit Deal</DropdownMenuItem>
                                <DropdownMenuItem>View Details</DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {filteredDeals.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No deals found matching your criteria.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}