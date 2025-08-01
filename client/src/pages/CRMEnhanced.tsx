import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  Clock, 
  User, 
  MapPin, 
  Calendar, 
  Phone, 
  Mail, 
  Building, 
  Target, 
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  UserPlus,
  PhoneCall,
  Send
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeadSchema, insertQuoteSchema, insertCustomerInteractionSchema } from "@shared/schema";
import type { Lead, Quote, CustomerInteraction, Customer } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";

const createLeadSchema = insertLeadSchema.extend({
  estimatedCloseDate: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
});

const createQuoteSchema = insertQuoteSchema.extend({
  validUntil: z.string(),
});

const createInteractionSchema = insertCustomerInteractionSchema.extend({
  scheduledDate: z.string().optional(),
  completedDate: z.string().optional(),
});

type CreateLeadInput = z.infer<typeof createLeadSchema>;
type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
type CreateInteractionInput = z.infer<typeof createInteractionSchema>;

export default function CRMEnhanced() {
  const [activeTab, setActiveTab] = useState("leads");
  const [isCreateLeadOpen, setIsCreateLeadOpen] = useState(false);
  const [isCreateQuoteOpen, setIsCreateQuoteOpen] = useState(false);
  const [isCreateInteractionOpen, setIsCreateInteractionOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: leads, isLoading: isLoadingLeads } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: quotes, isLoading: isLoadingQuotes } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  const { data: interactions, isLoading: isLoadingInteractions } = useQuery<CustomerInteraction[]>({
    queryKey: ["/api/customer-interactions"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const leadForm = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      source: "website",
      status: "new",
      estimatedValue: "0",
    },
  });

  const quoteForm = useForm<CreateQuoteInput>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: {
      title: "",
      description: "",
      subtotal: "0",
      taxAmount: "0",
      totalAmount: "0",
      status: "draft",
    },
  });

  const interactionForm = useForm<CreateInteractionInput>({
    resolver: zodResolver(createInteractionSchema),
    defaultValues: {
      interactionType: "call",
      subject: "",
      description: "",
      outcome: "neutral",
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: CreateLeadInput) => {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          estimatedCloseDate: data.estimatedCloseDate ? new Date(data.estimatedCloseDate) : null,
          nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null,
        }),
      });
      if (!response.ok) throw new Error('Failed to create lead');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setIsCreateLeadOpen(false);
      leadForm.reset();
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (data: CreateQuoteInput) => {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          validUntil: new Date(data.validUntil),
        }),
      });
      if (!response.ok) throw new Error('Failed to create quote');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setIsCreateQuoteOpen(false);
      quoteForm.reset();
    },
  });

  const createInteractionMutation = useMutation({
    mutationFn: async (data: CreateInteractionInput) => {
      const response = await fetch('/api/customer-interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
          completedDate: data.completedDate ? new Date(data.completedDate) : null,
        }),
      });
      if (!response.ok) throw new Error('Failed to create interaction');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-interactions"] });
      setIsCreateInteractionOpen(false);
      interactionForm.reset();
    },
  });

  const updateLeadStatusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update lead status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
  });

  const handleLeadSubmit = (data: CreateLeadInput) => {
    createLeadMutation.mutate(data);
  };

  const handleQuoteSubmit = (data: CreateQuoteInput) => {
    createQuoteMutation.mutate(data);
  };

  const handleInteractionSubmit = (data: CreateInteractionInput) => {
    createInteractionMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'text-blue-600 bg-blue-50';
      case 'qualified': return 'text-green-600 bg-green-50';
      case 'proposal': return 'text-yellow-600 bg-yellow-50';
      case 'negotiation': return 'text-orange-600 bg-orange-50';
      case 'closed_won': return 'text-green-600 bg-green-100';
      case 'closed_lost': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <UserPlus className="w-4 h-4" />;
      case 'qualified': return <CheckCircle className="w-4 h-4" />;
      case 'proposal': return <FileText className="w-4 h-4" />;
      case 'negotiation': return <MessageSquare className="w-4 h-4" />;
      case 'closed_won': return <Target className="w-4 h-4" />;
      case 'closed_lost': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'call': return <PhoneCall className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'meeting': return <Users className="w-4 h-4" />;
      case 'demo': return <Target className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const filteredLeads = leads?.filter(lead => {
    return filterStatus === "all" || lead.status === filterStatus;
  });

  const getSalesPipelineMetrics = () => {
    if (!leads) return { totalValue: 0, conversionRate: 0, activeLeads: 0 };
    
    const totalValue = leads.reduce((sum, lead) => sum + parseFloat(lead.estimatedValue || '0'), 0);
    const totalLeads = leads.length;
    const closedWon = leads.filter(lead => lead.status === 'closed_won').length;
    const conversionRate = totalLeads > 0 ? (closedWon / totalLeads) * 100 : 0;
    const activeLeads = leads.filter(lead => !['closed_won', 'closed_lost'].includes(lead.status)).length;

    return { totalValue, conversionRate, activeLeads };
  };

  const metrics = getSalesPipelineMetrics();

  if (isLoadingLeads || isLoadingQuotes || isLoadingInteractions) {
    return (
      <MainLayout 
        title="Enhanced CRM & Sales Pipeline" 
        description="Lead management, quote generation, and customer relationship tracking"
      >
        <div className="space-y-6">
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Enhanced CRM & Sales Pipeline" 
      description="Lead management, quote generation, and customer relationship tracking"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div />
          <div className="flex gap-2">
          <Dialog open={isCreateLeadOpen} onOpenChange={setIsCreateLeadOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <DialogDescription>
                  Create a new sales lead and start tracking the opportunity
                </DialogDescription>
              </DialogHeader>
              <Form {...leadForm}>
                <form onSubmit={leadForm.handleSubmit(handleLeadSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={leadForm.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Acme Corporation" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={leadForm.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="John Smith" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={leadForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="john@acme.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={leadForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(555) 123-4567" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={leadForm.control}
                      name="source"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lead Source</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="website">Website</SelectItem>
                              <SelectItem value="referral">Referral</SelectItem>
                              <SelectItem value="cold_call">Cold Call</SelectItem>
                              <SelectItem value="trade_show">Trade Show</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={leadForm.control}
                      name="estimatedValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Value</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="10000" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={leadForm.control}
                    name="estimatedCloseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Close Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={leadForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Initial conversation notes..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateLeadOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createLeadMutation.isPending}>
                      {createLeadMutation.isPending ? "Creating..." : "Create Lead"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateInteractionOpen} onOpenChange={setIsCreateInteractionOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <MessageSquare className="w-4 h-4 mr-2" />
                Log Interaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Customer Interaction</DialogTitle>
                <DialogDescription>
                  Record communication with leads or customers
                </DialogDescription>
              </DialogHeader>
              <Form {...interactionForm}>
                <form onSubmit={interactionForm.handleSubmit(handleInteractionSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={interactionForm.control}
                      name="interactionType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Interaction Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="call">Phone Call</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="meeting">Meeting</SelectItem>
                              <SelectItem value="demo">Demo</SelectItem>
                              <SelectItem value="note">Note</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={interactionForm.control}
                      name="outcome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Outcome</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="positive">Positive</SelectItem>
                              <SelectItem value="neutral">Neutral</SelectItem>
                              <SelectItem value="negative">Negative</SelectItem>
                              <SelectItem value="follow_up_required">Follow-up Required</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={interactionForm.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Initial discussion about copier needs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={interactionForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Detailed notes about the interaction..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateInteractionOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createInteractionMutation.isPending}>
                      {createInteractionMutation.isPending ? "Saving..." : "Save Interaction"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sales Pipeline Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Total estimated value
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Lead to customer conversion
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeLeads}</div>
            <p className="text-xs text-muted-foreground">
              Currently in pipeline
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leads">Sales Pipeline</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Search leads..." className="pl-10" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="closed_won">Closed Won</SelectItem>
                <SelectItem value="closed_lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Leads Grid */}
          <div className="grid gap-4">
            {filteredLeads?.map((lead) => (
              <Card key={lead.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-lg">{lead.companyName}</CardTitle>
                        <Badge className={`${getStatusColor(lead.status)} border-0`}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(lead.status)}
                            {lead.status.replace('_', ' ')}
                          </span>
                        </Badge>
                      </div>
                      <CardDescription>
                        {lead.contactName} • {lead.source}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">${parseFloat(lead.estimatedValue || '0').toLocaleString()}</div>
                      {lead.estimatedCloseDate && (
                        <div className="text-sm text-gray-500">
                          Close: {format(new Date(lead.estimatedCloseDate), 'MMM dd')}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {lead.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{lead.email}</span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                      {lead.lastContactDate && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>Last contact: {format(new Date(lead.lastContactDate), 'MMM dd')}</span>
                        </div>
                      )}
                      {lead.nextFollowUpDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>Follow up: {format(new Date(lead.nextFollowUpDate), 'MMM dd')}</span>
                        </div>
                      )}
                    </div>

                    {lead.notes && (
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{lead.notes}</p>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t">
                      <div className="flex gap-2">
                        {lead.status === 'new' && (
                          <Button 
                            size="sm" 
                            onClick={() => updateLeadStatusMutation.mutate({ leadId: lead.id, status: 'qualified' })}
                            disabled={updateLeadStatusMutation.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Qualify
                          </Button>
                        )}
                        {lead.status === 'qualified' && (
                          <Button 
                            size="sm" 
                            onClick={() => updateLeadStatusMutation.mutate({ leadId: lead.id, status: 'proposal' })}
                            disabled={updateLeadStatusMutation.isPending}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            Create Proposal
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <PhoneCall className="w-4 h-4 mr-1" />
                          Call
                        </Button>
                        <Button size="sm" variant="outline">
                          <Mail className="w-4 h-4 mr-1" />
                          Email
                        </Button>
                      </div>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredLeads?.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No leads found</h3>
                  <p className="text-gray-600 mb-4">Start building your sales pipeline by adding your first lead.</p>
                  <Button onClick={() => setIsCreateLeadOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add First Lead
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="quotes" className="space-y-4">
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Quote Management</h3>
            <p className="text-gray-600 mb-4">Generate and track quotes for leads and customers.</p>
            <Button onClick={() => setIsCreateQuoteOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Quote
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="interactions" className="space-y-4">
          <div className="grid gap-4">
            {interactions?.map((interaction) => (
              <Card key={interaction.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getInteractionIcon(interaction.interactionType)}
                      <CardTitle className="text-base">{interaction.subject}</CardTitle>
                      <Badge variant="outline">{interaction.interactionType}</Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(interaction.createdAt || new Date()), 'MMM dd, HH:mm')}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 mb-2">{interaction.description}</p>
                  {interaction.outcome && (
                    <Badge className={`${interaction.outcome === 'positive' ? 'bg-green-50 text-green-700' : 
                      interaction.outcome === 'negative' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
                      {interaction.outcome.replace('_', ' ')}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
            
            {interactions?.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No interactions logged</h3>
                  <p className="text-gray-600 mb-4">Start tracking customer communications and interactions.</p>
                  <Button onClick={() => setIsCreateInteractionOpen(true)}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Log First Interaction
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  );
}