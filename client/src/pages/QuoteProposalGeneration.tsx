import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  FileText, 
  Send, 
  Edit, 
  Trash2, 
  Eye, 
  Package, 
  DollarSign,
  Calendar,
  User,
  Building2,
  CheckCircle,
  Clock,
  AlertCircle,
  Calculator,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import ContextualHelp from "@/components/contextual/ContextualHelp";
import PageAlerts from "@/components/contextual/PageAlerts";

// Form schemas
const proposalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  businessRecordId: z.string().min(1, "Customer is required"),
  proposalType: z.string().min(1, "Proposal type is required"),
  description: z.string().optional(),
  validUntil: z.string().optional(),
  termsAndConditions: z.string().optional(),
  executiveSummary: z.string().optional(),
  companyIntroduction: z.string().optional(),
  solutionOverview: z.string().optional(),
  investmentSummary: z.string().optional(),
  nextSteps: z.string().optional(),
  internalNotes: z.string().optional()
});

const templateSchema = z.object({
  templateName: z.string().min(1, "Template name is required"),
  templateType: z.string().min(1, "Template type is required"),
  description: z.string().optional(),
  coverPageTemplate: z.string().optional(),
  executiveSummaryTemplate: z.string().optional(),
  proposalBodyTemplate: z.string().optional(),
  termsAndConditionsTemplate: z.string().optional(),
  footerTemplate: z.string().optional()
});

export default function QuoteProposalGeneration() {
  const [isNewProposalOpen, setIsNewProposalOpen] = useState(false);
  const [isNewTemplateOpen, setIsNewTemplateOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch proposals
  const { data: proposals = [], isLoading: proposalsLoading } = useQuery<any[]>({
    queryKey: ['/api/proposals'],
  });

  // Fetch proposal templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<any[]>({
    queryKey: ['/api/proposals/proposal-templates'],
  });

  // Fetch equipment packages
  const { data: packages = [], isLoading: packagesLoading } = useQuery<any[]>({
    queryKey: ['/api/proposals/equipment-packages'],
  });

  // Fetch business records for customer selection
  const { data: businessRecords = [] } = useQuery<any[]>({
    queryKey: ['/api/business-records'],
  });

  // Create proposal mutation
  const createProposalMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/proposals', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      setIsNewProposalOpen(false);
      toast({
        title: "Success",
        description: "Proposal created successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create proposal",
        variant: "destructive"
      });
    }
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/proposals/proposal-templates', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals/proposal-templates'] });
      setIsNewTemplateOpen(false);
      toast({
        title: "Success",
        description: "Template created successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create template",
        variant: "destructive"
      });
    }
  });

  // Update proposal status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, previousStatus }: { id: string, status: string, previousStatus: string }) => 
      apiRequest(`/api/proposals/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, previousStatus }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      toast({
        title: "Success",
        description: "Proposal status updated"
      });
    }
  });

  // Forms
  const proposalForm = useForm({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      title: "",
      businessRecordId: "",
      proposalType: "equipment_lease",
      description: "",
      validUntil: "",
      termsAndConditions: "",
      executiveSummary: "",
      companyIntroduction: "",
      solutionOverview: "",
      investmentSummary: "",
      nextSteps: "",
      internalNotes: ""
    }
  });

  const templateForm = useForm({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      templateName: "",
      templateType: "equipment_lease",
      description: "",
      coverPageTemplate: "",
      executiveSummaryTemplate: "",
      proposalBodyTemplate: "",
      termsAndConditionsTemplate: "",
      footerTemplate: ""
    }
  });

  const onCreateProposal = async (data: any) => {
    // DoD Validation: Check if quote is ready for proposal creation
    if (data.quoteId) {
      try {
        const validation = await fetch(`/api/validate/quote-to-proposal/${data.quoteId}`, {
          headers: {
            'x-tenant-id': localStorage.getItem('currentTenantId') || '',
          },
        });
        const validationResult = await validation.json();
        
        if (!validationResult.valid) {
          toast({
            title: "Quote Validation Failed",
            description: (
              <div>
                <p>Cannot create proposal. Please fix the following issues:</p>
                <ul className="list-disc list-inside mt-2">
                  {validationResult.errors.map((error: string, index: number) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            ),
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Validation Passed",
          description: "Quote meets all requirements. Creating proposal...",
        });
      } catch (error) {
        console.error("DoD validation error:", error);
        toast({
          title: "Validation Error",
          description: "Unable to validate quote. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }
    
    createProposalMutation.mutate(data);
  };

  const onCreateTemplate = (data: any) => {
    createTemplateMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: "secondary" as const, label: "Draft", icon: Edit },
      sent: { variant: "default" as const, label: "Sent", icon: Send },
      viewed: { variant: "outline" as const, label: "Viewed", icon: Eye },
      accepted: { variant: "default" as const, label: "Accepted", icon: CheckCircle },
      rejected: { variant: "destructive" as const, label: "Rejected", icon: AlertCircle },
      expired: { variant: "secondary" as const, label: "Expired", icon: Clock }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const proposalTypes = [
    { value: "equipment_lease", label: "Equipment Lease" },
    { value: "service_contract", label: "Service Contract" },
    { value: "maintenance_agreement", label: "Maintenance Agreement" },
    { value: "managed_print", label: "Managed Print Services" },
    { value: "custom_solution", label: "Custom Solution" }
  ];

  return (
    <MainLayout title="Quote & Proposal Generation" description="Create professional proposals and manage the sales pipeline">
      <div className="container mx-auto p-6 space-y-6">
        <ContextualHelp page="quote-proposal-generation" />
        <PageAlerts categories={["business"]} severities={["medium","high","critical"]} className="-mt-2" />
        <div className="flex justify-end items-center">
          <div className="flex gap-2">
            <Button 
            onClick={() => setLocation('/quotes/new')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Quote Builder
          </Button>
          <Dialog open={isNewTemplateOpen} onOpenChange={setIsNewTemplateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] h-[95vh] max-w-none max-h-none p-0 gap-0 overflow-hidden">
              <div className="flex flex-col h-full">
                <div className="p-4 sm:p-6 border-b flex-shrink-0">
                  <DialogHeader>
                    <DialogTitle>Create Proposal Template</DialogTitle>
                    <DialogDescription>
                      Create a reusable template for consistent proposal formatting
                    </DialogDescription>
                  </DialogHeader>
                </div>
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                  <Form {...templateForm}>
                    <form onSubmit={templateForm.handleSubmit(onCreateTemplate)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={templateForm.control}
                      name="templateName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Equipment Lease Template" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={templateForm.control}
                      name="templateType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select template type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {proposalTypes.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={templateForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Template description..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => setIsNewTemplateOpen(false)} className="w-full sm:w-auto">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createTemplateMutation.isPending} className="w-full sm:w-auto">
                        {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
                      </Button>
                    </div>
                    </form>
                  </Form>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isNewProposalOpen} onOpenChange={setIsNewProposalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Proposal
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] h-[95vh] max-w-none max-h-none p-0 gap-0 overflow-hidden">
              <div className="flex flex-col h-full">
                <div className="p-4 sm:p-6 border-b flex-shrink-0">
                  <DialogHeader>
                    <DialogTitle>Create New Proposal</DialogTitle>
                    <DialogDescription>
                      Create a professional proposal for your customer
                    </DialogDescription>
                  </DialogHeader>
                </div>
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                  <Form {...proposalForm}>
                    <form onSubmit={proposalForm.handleSubmit(onCreateProposal)} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={proposalForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Proposal Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Equipment Lease Proposal" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={proposalForm.control}
                      name="businessRecordId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select customer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {businessRecords.map((record: any) => (
                                <SelectItem key={record.id} value={record.id}>
                                  {record.companyName || record.firstName + ' ' + record.lastName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={proposalForm.control}
                      name="proposalType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Proposal Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select proposal type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {proposalTypes.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={proposalForm.control}
                      name="validUntil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valid Until</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={proposalForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Proposal description..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                      <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsNewProposalOpen(false)} className="w-full sm:w-auto">
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createProposalMutation.isPending} className="w-full sm:w-auto">
                          {createProposalMutation.isPending ? "Creating..." : "Create Proposal"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Tabs defaultValue="quotes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="packages">Equipment Packages</TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Quote Builder System
              </CardTitle>
              <CardDescription>
                Create detailed quotes with line-by-line product selection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quote Builder Feature Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Calculator className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Line-by-Line Quote Builder</h3>
                        <p className="text-sm text-muted-foreground">Build comprehensive quotes with detailed product selection</p>
                      </div>
                    </div>
                    <ul className="space-y-2 text-sm mb-4">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Select from Product Models, Accessories, Services
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        MSRP, New, and Upgrade pricing options
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Automatic margin calculations
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Add accessories as sub-lines
                      </li>
                    </ul>
                    <Button 
                      onClick={() => setLocation('/quotes/new')}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      <Calculator className="h-4 w-4 mr-2" />
                      Start Quote Builder
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-teal-50 border-green-200">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <FileText className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Quotes Management</h3>
                        <p className="text-sm text-muted-foreground">Manage all your quotes and track their progress</p>
                      </div>
                    </div>
                    <ul className="space-y-2 text-sm mb-4">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        View all quotes with status tracking
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Edit and update existing quotes
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Track win rates and total values
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Convert to proposals when accepted
                      </li>
                    </ul>
                    <Button 
                      onClick={() => setLocation('/quotes')}
                      className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Manage Quotes
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="justify-start h-auto p-4"
                    onClick={() => setLocation('/quotes/new')}
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2 font-medium">
                        <Calculator className="h-4 w-4" />
                        New Quote
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Start building a new quote
                      </div>
                    </div>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="justify-start h-auto p-4"
                    onClick={() => setLocation('/quotes')}
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2 font-medium">
                        <FileText className="h-4 w-4" />
                        View All Quotes
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Manage existing quotes
                      </div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto p-4"
                    onClick={() => setIsNewTemplateOpen(true)}
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2 font-medium">
                        <Package className="h-4 w-4" />
                        Create Template
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Build reusable templates
                      </div>
                    </div>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proposals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Active Proposals
              </CardTitle>
              <CardDescription>
                Manage and track all your customer proposals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {proposalsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-muted-foreground">Loading proposals...</div>
                </div>
              ) : proposals.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No proposals found. Create your first proposal to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proposal #</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proposals.map((proposal: any) => (
                        <TableRow key={proposal.id}>
                          <TableCell className="font-medium">
                            {proposal.proposalNumber}
                          </TableCell>
                          <TableCell>{proposal.title}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {proposal.customerName || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {proposal.proposalType?.replace('_', ' ') || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(proposal.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              {proposal.totalAmount ? parseFloat(proposal.totalAmount).toLocaleString() : '0'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(proposal.createdAt), 'MMM dd, yyyy')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              {proposal.status === 'draft' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => updateStatusMutation.mutate({
                                    id: proposal.id,
                                    status: 'sent',
                                    previousStatus: proposal.status
                                  })}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Proposal Templates
              </CardTitle>
              <CardDescription>
                Manage reusable templates for consistent proposal formatting
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-muted-foreground">Loading templates...</div>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No templates found. Create your first template to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template: any) => (
                    <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{template.templateName}</CardTitle>
                          {template.isDefault && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                        </div>
                        <CardDescription>{template.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{template.templateType?.replace('_', ' ')}</span>
                          <span>{format(new Date(template.createdAt), 'MMM dd, yyyy')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Equipment Packages
              </CardTitle>
              <CardDescription>
                Pre-configured equipment bundles for quick proposal generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {packagesLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-muted-foreground">Loading packages...</div>
                </div>
              ) : packages.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No equipment packages found. Create your first package to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.map((pkg: any) => (
                    <Card key={pkg.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg">{pkg.packageName}</CardTitle>
                        <CardDescription>{pkg.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Category:</span>
                            <Badge variant="outline">{pkg.category}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total Value:</span>
                            <span className="font-medium">
                              ${pkg.totalValue ? parseFloat(pkg.totalValue).toLocaleString() : '0'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}