import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, CheckCircle, Clock, Plus, FileText, Download, Eye, Settings, AlertCircle, ArrowRight, Wrench } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface OnboardingChecklist {
  id: string;
  tenantId: string;
  checklistTitle: string;
  installationType: string;
  customerData: any;
  siteInformation: any;
  scheduledInstallDate?: string;
  actualInstallDate?: string;
  accessRequirements?: string;
  specialInstructions?: string;
  status: string;
  progressPercentage: number;
  totalSections: number;
  completedSections: number;
  pdfUrl?: string;
  pdfGeneratedAt?: string;
  createdBy: string;
  lastModifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateChecklistData {
  checklistTitle: string;
  installationType: string;
  customerData: {
    companyName: string;
    primaryContact: string;
    phone: string;
    email: string;
  };
  siteInformation: {
    address: string;
  };
  scheduledInstallDate?: string;
  accessRequirements?: string;
  specialInstructions?: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

const getInstallationTypeLabel = (type: string) => {
  switch (type) {
    case 'new_site':
      return 'New Site';
    case 'equipment_upgrade':
      return 'Equipment Upgrade';
    case 'relocation':
      return 'Relocation';
    case 'expansion':
      return 'Expansion';
    default:
      return type;
  }
};

export default function OnboardingDashboard() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch onboarding checklists
  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ['/api/onboarding/checklists'],
  });

  // Create checklist mutation
  const createChecklistMutation = useMutation({
    mutationFn: (data: CreateChecklistData) => apiRequest(`/api/onboarding/checklists`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/checklists'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Onboarding checklist created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checklist",
        variant: "destructive",
      });
    },
  });

  // Generate PDF mutation
  const generatePdfMutation = useMutation({
    mutationFn: (checklistId: string) => apiRequest(`/api/onboarding/checklists/${checklistId}/generate-pdf`, {
      method: 'POST',
    }),
    onSuccess: (data: { pdfUrl: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/checklists'] });
      toast({
        title: "Success",
        description: "PDF generated successfully",
      });
      // Open PDF in new tab
      window.open(data.pdfUrl, '_blank');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate PDF",
        variant: "destructive",
      });
    },
  });

  // Create service record mutation
  const createServiceRecordMutation = useMutation({
    mutationFn: async (checklistData: OnboardingChecklist) => {
      const serviceRecord = {
        customerId: checklistData.customerData?.companyName,
        equipmentId: checklistData.id, // Using checklist ID as equipment reference
        installationDate: checklistData.actualInstallDate || new Date().toISOString(),
        serviceType: 'initial_setup',
        description: `Service record created from completed installation: ${checklistData.checklistTitle}`,
        status: 'completed',
        priority: 'normal',
        siteAddress: checklistData.siteInformation?.address,
        contactName: checklistData.customerData?.primaryContact,
        contactPhone: checklistData.customerData?.phone,
        contactEmail: checklistData.customerData?.email,
      };
      
      return apiRequest('/api/service-tickets', {
        method: 'POST',
        body: serviceRecord,
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Service Record Created",
        description: `Installation handoff complete. Service monitoring initiated for ${variables.customerData?.companyName}.`,
      });
      // Navigate to service hub with the new service record
      setLocation(`/service-hub?newServiceId=${data.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create service record. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredChecklists = checklists.filter((checklist: OnboardingChecklist) => {
    const matchesStatus = selectedStatus === 'all' || checklist.status === selectedStatus;
    const matchesSearch = checklist.checklistTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         checklist.customerData?.companyName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleCreateChecklist = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const checklistData: CreateChecklistData = {
      checklistTitle: formData.get('checklistTitle') as string,
      installationType: formData.get('installationType') as string,
      customerData: {
        companyName: formData.get('companyName') as string,
        primaryContact: formData.get('primaryContact') as string,
        phone: formData.get('phone') as string,
        email: formData.get('email') as string,
      },
      siteInformation: {
        address: formData.get('address') as string,
      },
      scheduledInstallDate: formData.get('scheduledInstallDate') as string || undefined,
      accessRequirements: formData.get('accessRequirements') as string || undefined,
      specialInstructions: formData.get('specialInstructions') as string || undefined,
    };

    createChecklistMutation.mutate(checklistData);
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">Onboarding Checklists</h1>
        </div>
        <div className="grid gap-4 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Onboarding Checklists</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage equipment installation and customer onboarding processes
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={() => window.location.href = '/onboarding/new'} 
            size="default" 
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Comprehensive Checklist
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="default" variant="outline" className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Quick Checklist
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Onboarding Checklist</DialogTitle>
              <DialogDescription>
                Set up a new installation and onboarding checklist for a customer
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateChecklist} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="checklistTitle">Checklist Title</Label>
                  <Input
                    id="checklistTitle"
                    name="checklistTitle"
                    placeholder="e.g., ABC Company Installation"
                    required
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installationType">Installation Type</Label>
                  <Select name="installationType" required>
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_site">New Site</SelectItem>
                      <SelectItem value="equipment_upgrade">Equipment Upgrade</SelectItem>
                      <SelectItem value="relocation">Relocation</SelectItem>
                      <SelectItem value="expansion">Expansion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Customer Information</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      name="companyName"
                      placeholder="ABC Company"
                      required
                      className="min-h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primaryContact">Primary Contact</Label>
                    <Input
                      id="primaryContact"
                      name="primaryContact"
                      placeholder="John Doe"
                      required
                      className="min-h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      className="min-h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="john@company.com"
                      className="min-h-11"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Site Information</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="address">Installation Address</Label>
                    <Input
                      id="address"
                      name="address"
                      placeholder="123 Main St, City, State 12345"
                      required
                      className="min-h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduledInstallDate">Scheduled Install Date</Label>
                    <Input
                      id="scheduledInstallDate"
                      name="scheduledInstallDate"
                      type="date"
                      className="min-h-11"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accessRequirements">Access Requirements</Label>
                  <Textarea
                    id="accessRequirements"
                    name="accessRequirements"
                    placeholder="Building access codes, contact person, parking instructions..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialInstructions">Special Instructions</Label>
                  <Textarea
                    id="specialInstructions"
                    name="specialInstructions"
                    placeholder="Any special requirements or notes for the installation..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="min-h-11"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createChecklistMutation.isPending}
                  className="min-h-11"
                >
                  {createChecklistMutation.isPending ? "Creating..." : "Create Checklist"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search checklists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-h-11"
          />
        </div>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-full sm:w-48 min-h-11">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Checklists</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{checklists.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {checklists.filter((c: OnboardingChecklist) => c.status === 'in_progress').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {checklists.filter((c: OnboardingChecklist) => c.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {checklists.length > 0 
                ? Math.round(checklists.reduce((sum: number, c: OnboardingChecklist) => sum + (c.progressPercentage || 0), 0) / checklists.length)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checklists Grid */}
      <div className="grid gap-4 sm:gap-6">
        {filteredChecklists.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No checklists found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || selectedStatus !== 'all' 
                  ? "Try adjusting your filters or search terms"
                  : "Create your first onboarding checklist to get started"
                }
              </p>
              {!searchQuery && selectedStatus === 'all' && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Checklist
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredChecklists.map((checklist: OnboardingChecklist) => (
            <Card key={checklist.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{checklist.checklistTitle}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2">
                      <span>{checklist.customerData?.companyName}</span>
                      <Badge variant="secondary" className={getStatusColor(checklist.status)}>
                        {checklist.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        {getInstallationTypeLabel(checklist.installationType)}
                      </Badge>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.location.href = `/onboarding/${checklist.id}`}
                      className="min-h-8"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generatePdfMutation.mutate(checklist.id)}
                      disabled={generatePdfMutation.isPending}
                      className="min-h-8"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      PDF
                    </Button>
                    {checklist.status === 'completed' && checklist.progressPercentage === 100 && (
                      <Button
                        size="sm"
                        onClick={() => createServiceRecordMutation.mutate(checklist)}
                        disabled={createServiceRecordMutation.isPending}
                        className="min-h-8 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Wrench className="w-4 h-4 mr-1" />
                        Create Service Record
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{checklist.progressPercentage || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getProgressColor(checklist.progressPercentage || 0)}`}
                      style={{ width: `${checklist.progressPercentage || 0}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{checklist.completedSections || 0} of {checklist.totalSections || 0} sections</span>
                    <span>
                      {checklist.scheduledInstallDate && (
                        <>
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {format(new Date(checklist.scheduledInstallDate), 'MMM dd, yyyy')}
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="grid gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Contact:</span>
                    <span>{checklist.customerData?.primaryContact || 'Not specified'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="text-right max-w-xs truncate">
                      {checklist.siteInformation?.address || 'Not specified'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{format(new Date(checklist.createdAt), 'MMM dd, yyyy')}</span>
                  </div>
                  {checklist.pdfUrl && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">PDF:</span>
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0 text-xs"
                        onClick={() => window.open(checklist.pdfUrl, '_blank')}
                      >
                        Generated {checklist.pdfGeneratedAt && format(new Date(checklist.pdfGeneratedAt), 'MMM dd')}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}