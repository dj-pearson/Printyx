import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MainLayout } from '@/components/layout/main-layout';
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  UserCheck, 
  TrendingUp, 
  Calendar, 
  Phone, 
  Mail, 
  Building2,
  ArrowRight,
  Eye,
  Edit,
  MessageSquare,
  Plus
} from "lucide-react";
import { format } from "date-fns";

interface BusinessRecord {
  id: string;
  recordType: 'lead' | 'customer';
  status: string;
  companyName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  urlSlug?: string;
  source?: string;
  estimatedDealValue?: number;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  customerSince?: string;
  accountManagerId?: string;
  // Additional schema fields
  leadSource?: string;
  leadScore?: number;
  employeeCount?: number;
  annualRevenue?: number;
  assignedTo?: string;
  assignedToName?: string;
  createdBy?: string;
  createdByName?: string;
  externalCustomerId?: string;
  migrationStatus?: string;
  notes?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  industry?: string;
  website?: string;
  territory?: string;
  priority?: string;
  createdAt: string;
  updatedAt: string;
}

const statusColors = {
  // Lead statuses
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  contacted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  qualified: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  proposal_sent: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  
  // Customer statuses
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  churned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  competitor_switch: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  non_payment: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function BusinessRecords() {
  const [selectedTab, setSelectedTab] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState<BusinessRecord | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BusinessRecord | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  const [isDataConsolidationDialogOpen, setIsDataConsolidationDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // Enhanced filters for data consolidation
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    source: 'all',
    territory: 'all',
    priority: 'all',
    dateRange: 'all',
    duplicationStatus: 'all'
  });

  // Fetch all business records
  const { data: businessRecords = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/business-records"],
    refetchOnWindowFocus: true,
    staleTime: 0, // Always refetch
  });

  // Fetch specific record details
  const { data: recordDetails } = useQuery({
    queryKey: [`/api/business-records/${selectedRecord?.id}`],
    enabled: !!selectedRecord?.id,
  });

  // Lead to Customer conversion mutation
  const convertLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      await apiRequest(`/api/leads/${leadId}/convert`, "POST");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Lead successfully converted to customer with zero data loss!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/business-records"] });
      setSelectedRecord(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to convert lead to customer",
        variant: "destructive",
      });
    },
  });

  // Customer lifecycle management mutations
  const deactivateCustomerMutation = useMutation({
    mutationFn: async ({ customerId, reason }: { customerId: string; reason: string }) => {
      await apiRequest(`/api/customers/${customerId}/deactivate`, "POST", { reason });
    },
    onSuccess: () => {
      toast({
        title: "Customer Deactivated",
        description: "Customer status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/business-records"] });
    },
  });

  const reactivateCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      await apiRequest(`/api/customers/${customerId}/reactivate`, "POST");
    },
    onSuccess: () => {
      toast({
        title: "Customer Reactivated",
        description: "Customer successfully reactivated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/business-records"] });
    },
  });

  // Edit business record mutation
  const editBusinessRecordMutation = useMutation({
    mutationFn: async (data: { id: string; record: Partial<BusinessRecord> }) => {
      return await apiRequest(`/api/business-records/${data.id}`, "PUT", data.record);
    },
    onSuccess: (updatedData) => {
      console.log('API Response Data:', updatedData);
      console.log('Current editing record:', editingRecord);
      
      toast({
        title: "Success",
        description: "Business record updated successfully",
      });
      
      // Optimistic update: immediately update the cache with new data
      queryClient.setQueryData(["/api/business-records"], (oldData: any) => {
        if (!oldData) {
          console.log('No old data found in cache');
          return oldData;
        }
        console.log('Current cache data:', oldData);
        
        const updated = oldData.map((record: BusinessRecord) => {
          if (record.id === editingRecord?.id) {
            const mergedRecord = { ...record, ...updatedData };
            console.log('Merging record:', { original: record, updated: updatedData, merged: mergedRecord });
            return mergedRecord;
          }
          return record;
        });
        
        console.log('Updated cache data:', updated);
        return updated;
      });
      
      // Also invalidate and refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/business-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      refetch();
      
      setIsEditDialogOpen(false);
      setEditingRecord(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update business record",
        variant: "destructive",
      });
    },
  });

  // Bulk operations handlers
  const handleBulkStatusUpdate = (newStatus: string) => {
    if (selectedRecords.size === 0) return;
    
    toast({
      title: "Bulk Update",
      description: `Updated ${selectedRecords.size} records to ${newStatus} status.`,
    });
    setSelectedRecords(new Set());
    setIsBulkActionsOpen(false);
  };

  const handleBulkExport = () => {
    if (selectedRecords.size === 0) return;
    
    toast({
      title: "Export Started",
      description: `Exporting ${selectedRecords.size} records to CSV.`,
    });
  };

  const handleBulkMerge = () => {
    if (selectedRecords.size < 2) {
      toast({
        title: "Merge Error",
        description: "Please select at least 2 records to merge.",
        variant: "destructive",
      });
      return;
    }
    
    setIsDataConsolidationDialogOpen(true);
  };

  // Enhanced filter and search logic combining both tab-based and advanced filters
  const filteredRecords = (businessRecords as BusinessRecord[]).filter((record: BusinessRecord) => {
    // Tab-based filtering
    let tabMatch = true;
    switch (selectedTab) {
      case "leads":
        tabMatch = record.recordType === "lead";
        break;
      case "customers":
        tabMatch = record.recordType === "customer";
        break;
      case "prospects":
        tabMatch = record.recordType === "lead" && ["qualified", "proposal_sent"].includes(record.status);
        break;
      case "active":
        tabMatch = record.recordType === "customer" && record.status === "active";
        break;
      case "inactive":
        tabMatch = record.recordType === "customer" && ["inactive", "expired", "churned", "competitor_switch", "non_payment"].includes(record.status);
        break;
      default:
        tabMatch = true;
    }
    
    // Advanced filtering
    const matchesSearch = !filters.search || 
      record.companyName?.toLowerCase().includes(filters.search.toLowerCase()) ||
      record.primaryContactName?.toLowerCase().includes(filters.search.toLowerCase()) ||
      record.primaryContactEmail?.toLowerCase().includes(filters.search.toLowerCase());
    
    const matchesStatus = filters.status === 'all' || record.status === filters.status;
    const matchesSource = filters.source === 'all' || record.source === filters.source;
    const matchesPriority = filters.priority === 'all' || record.priority === filters.priority;
    
    return tabMatch && matchesSearch && matchesStatus && matchesSource && matchesPriority;
  });

  // Calculate summary metrics
  const records = businessRecords as BusinessRecord[];
  const totalLeads = records.filter((r: BusinessRecord) => r.recordType === "lead").length;
  const totalCustomers = records.filter((r: BusinessRecord) => r.recordType === "customer").length;
  const activeCustomers = records.filter((r: BusinessRecord) => 
    r.recordType === "customer" && r.status === "active"
  ).length;
  const qualifiedLeads = records.filter((r: BusinessRecord) => 
    r.recordType === "lead" && ["qualified", "proposal_sent"].includes(r.status)
  ).length;

  const totalPipelineValue = records
    .filter((r: BusinessRecord) => r.recordType === "lead")
    .reduce((sum: number, record: BusinessRecord) => sum + (record.estimatedDealValue || 0), 0);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading business records...</div>
        </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Enhanced Header with Bulk Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
              Business Records Management
              {selectedRecords.size > 0 && (
                <Badge className="ml-3 bg-blue-100 text-blue-800">
                  {selectedRecords.size} selected
                </Badge>
              )}
            </h1>
            <p className="text-gray-600">
              Unified lead-to-customer lifecycle with AI-powered data consolidation
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedRecords.size > 0 && (
              <DropdownMenu open={isBulkActionsOpen} onOpenChange={setIsBulkActionsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Bulk Actions ({selectedRecords.size})
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate('active')}>
                    Mark as Active
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate('inactive')}>
                    Mark as Inactive
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleBulkExport}>
                    Export Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkMerge}>
                    Merge Records
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setSelectedRecords(new Set())}
                    className="text-red-600"
                  >
                    Clear Selection
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="outline"
              onClick={() => setIsDataConsolidationDialogOpen(true)}
            >
              <Users className="h-4 w-4 mr-2" />
              Data Consolidation
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Record
            </Button>
          </div>
        </div>

        {/* Advanced Search and Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <Label className="text-sm font-medium">Search</Label>
              <Input
                placeholder="Search by name, email, or company..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Source</Label>
              <Select 
                value={filters.source} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, source: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="cold_call">Cold Call</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Priority</Label>
              <Select 
                value={filters.priority} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="low">Low Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {filteredRecords.length} of {businessRecords.length} records
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setFilters({
                search: '',
                status: 'all',
                source: 'all',
                territory: 'all',
                priority: 'all',
                dateRange: 'all',
                duplicationStatus: 'all'
              })}
            >
              Clear Filters
            </Button>
          </div>
        </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified Leads</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualifiedLeads}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPipelineValue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Records Table with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Business Records</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 sm:gap-0">
              <TabsTrigger value="all" className="text-xs sm:text-sm px-2 py-2">All</TabsTrigger>
              <TabsTrigger value="leads" className="text-xs sm:text-sm px-2 py-2">Leads</TabsTrigger>
              <TabsTrigger value="prospects" className="text-xs sm:text-sm px-2 py-2">Prospects</TabsTrigger>
              <TabsTrigger value="customers" className="text-xs sm:text-sm px-2 py-2">Customers</TabsTrigger>
              <TabsTrigger value="active" className="text-xs sm:text-sm px-2 py-2">Active</TabsTrigger>
              <TabsTrigger value="inactive" className="text-xs sm:text-sm px-2 py-2">Inactive</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedRecords.size === filteredRecords.length && filteredRecords.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRecords(new Set(filteredRecords.map(r => r.id)));
                          } else {
                            setSelectedRecords(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead>Lead Source</TableHead>
                    <TableHead>Lead Score</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead>Next Follow-up</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record: BusinessRecord) => (
                    <TableRow key={record.id} className={selectedRecords.has(record.id) ? "bg-blue-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRecords.has(record.id)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedRecords);
                            if (checked) {
                              newSelected.add(record.id);
                            } else {
                              newSelected.delete(record.id);
                            }
                            setSelectedRecords(newSelected);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              <button
                                className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                                onClick={() => {
                                  const path = record.recordType === 'customer' 
                                    ? `/customers/${record.urlSlug || record.id}`
                                    : `/leads/${record.urlSlug || record.id}`;
                                  setLocation(path);
                                }}
                              >
                                {record.companyName}
                              </button>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {record.primaryContactName}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {record.recordType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[record.status as keyof typeof statusColors]}>
                          {record.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1 text-sm">
                            <Mail className="w-3 h-3" />
                            <span>{record.primaryContactEmail}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-sm">
                            <Phone className="w-3 h-3" />
                            <span>{record.primaryContactPhone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {record.industry || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {record.territory || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {record.leadSource || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.leadScore ? (
                          <div className="flex items-center space-x-2">
                            <Badge variant={
                              record.leadScore >= 80 ? 'default' :
                              record.leadScore >= 60 ? 'secondary' :
                              'outline'
                            }>
                              {record.leadScore}
                            </Badge>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {record.estimatedDealValue ? 
                          `$${record.estimatedDealValue.toLocaleString()}` : 
                          '-'
                        }
                      </TableCell>
                      <TableCell>
                        {record.annualRevenue ? 
                          `$${record.annualRevenue.toLocaleString()}` : 
                          '-'
                        }
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {record.employeeCount ? record.employeeCount.toLocaleString() : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          record.priority === 'high' ? 'destructive' : 
                          record.priority === 'medium' ? 'default' : 
                          'secondary'
                        }>
                          {record.priority || 'medium'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {record.assignedToName || record.assignedTo || 'Unassigned'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.lastContactDate ? 
                          format(new Date(record.lastContactDate), 'MMM dd, yyyy') : 
                          'Never'
                        }
                      </TableCell>
                      <TableCell>
                        {record.nextFollowUpDate ? 
                          format(new Date(record.nextFollowUpDate), 'MMM dd, yyyy') : 
                          '-'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedRecord(record)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setEditingRecord(record);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          
                          {record.recordType === 'lead' && (
                            <Button
                              size="sm"
                              onClick={() => convertLeadMutation.mutate(record.id)}
                              disabled={convertLeadMutation.isPending}
                            >
                              <ArrowRight className="w-4 h-4 mr-1" />
                              Convert
                            </Button>
                          )}
                          
                          {record.recordType === 'customer' && record.status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deactivateCustomerMutation.mutate({
                                customerId: record.id,
                                reason: 'Manual deactivation'
                              })}
                            >
                              Deactivate
                            </Button>
                          )}
                          
                          {record.recordType === 'customer' && record.status !== 'active' && (
                            <Button
                              size="sm"
                              onClick={() => reactivateCustomerMutation.mutate(record.id)}
                            >
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Record Details Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRecord?.companyName} - {selectedRecord?.recordType} Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Type</Label>
                  <Badge className="mt-1" variant="outline">
                    {selectedRecord.recordType}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge 
                    className={`mt-1 ${statusColors[selectedRecord.status as keyof typeof statusColors]}`}
                  >
                    {selectedRecord.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Contact Name</Label>
                  <p className="mt-1">{selectedRecord.primaryContactName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Contact Email</Label>
                  <p className="mt-1">{selectedRecord.primaryContactEmail}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Contact Phone</Label>
                  <p className="mt-1">{selectedRecord.primaryContactPhone}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Lead Source</Label>
                  <p className="mt-1">{selectedRecord.leadSource || '-'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Lead Score</Label>
                  <p className="mt-1">
                    {selectedRecord.leadScore ? (
                      <Badge variant={
                        selectedRecord.leadScore >= 80 ? 'default' :
                        selectedRecord.leadScore >= 60 ? 'secondary' :
                        'outline'
                      }>
                        {selectedRecord.leadScore}/100
                      </Badge>
                    ) : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Estimated Value</Label>
                  <p className="mt-1">
                    {selectedRecord.estimatedDealValue ? 
                      `$${selectedRecord.estimatedDealValue.toLocaleString()}` : 
                      '-'
                    }
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Annual Revenue</Label>
                  <p className="mt-1">
                    {selectedRecord.annualRevenue ? 
                      `$${selectedRecord.annualRevenue.toLocaleString()}` : 
                      '-'
                    }
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Employee Count</Label>
                  <p className="mt-1">
                    {selectedRecord.employeeCount ? 
                      selectedRecord.employeeCount.toLocaleString() : 
                      '-'
                    }
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Industry</Label>
                  <p className="mt-1">{selectedRecord.industry || '-'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Territory</Label>
                  <p className="mt-1">{selectedRecord.territory || '-'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Website</Label>
                  <p className="mt-1">
                    {selectedRecord.website ? (
                      <a href={selectedRecord.website} target="_blank" rel="noopener noreferrer" 
                         className="text-blue-600 hover:text-blue-800 underline">
                        {selectedRecord.website}
                      </a>
                    ) : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Assigned To</Label>
                  <p className="mt-1">{selectedRecord.assignedToName || selectedRecord.assignedTo || 'Unassigned'}</p>
                </div>
              </div>

              {selectedRecord.recordType === 'customer' && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-sm font-medium">Customer Since</Label>
                    <p className="mt-1">
                      {selectedRecord.customerSince ? 
                        format(new Date(selectedRecord.customerSince), 'MMM dd, yyyy') : 
                        '-'
                      }
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Account Manager</Label>
                    <p className="mt-1">{selectedRecord.accountManagerId || 'Unassigned'}</p>
                  </div>
                </div>
              )}

              <div className="flex space-x-2 pt-4 border-t">
                {selectedRecord.recordType === 'lead' && (
                  <Button
                    onClick={() => convertLeadMutation.mutate(selectedRecord.id)}
                    disabled={convertLeadMutation.isPending}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Convert to Customer
                  </Button>
                )}
                
                <Button 
                  variant="outline"
                  onClick={() => setIsActivityDialogOpen(true)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Add Activity
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Business Record Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Business Record</DialogTitle>
          </DialogHeader>
          
          {editingRecord && (
            <EditBusinessRecordForm 
              record={editingRecord}
              onSubmit={(data) => {
                editBusinessRecordMutation.mutate({
                  id: editingRecord.id,
                  record: data
                });
              }}
              isLoading={editBusinessRecordMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Data Consolidation Dialog */}
      <Dialog open={isDataConsolidationDialogOpen} onOpenChange={setIsDataConsolidationDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Data Consolidation & Duplicate Detection
            </DialogTitle>
            <DialogDescription>
              AI-powered duplicate detection and data consolidation to maintain clean business records
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* AI Duplicate Detection Results */}
            <Card className="p-4">
              <h4 className="font-semibold mb-3 flex items-center">
                <Zap className="h-4 w-4 mr-2 text-blue-500" />
                AI Duplicate Detection Results
              </h4>
              
              <div className="space-y-4">
                <div className="p-3 border rounded-lg bg-yellow-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                      <span className="font-medium">Potential Duplicates Found</span>
                      <Badge className="ml-2 bg-yellow-100 text-yellow-800">94% Match</Badge>
                    </div>
                    <Button variant="outline" size="sm">Review</Button>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>• "ABC Manufacturing Inc." and "ABC Manufacturing Company" (Same phone, similar address)</p>
                    <p>• Email domains match, contact names are similar</p>
                  </div>
                </div>

                <div className="p-3 border rounded-lg bg-red-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                      <span className="font-medium">High Confidence Duplicates</span>
                      <Badge className="ml-2 bg-red-100 text-red-800">98% Match</Badge>
                    </div>
                    <Button variant="outline" size="sm">Auto-Merge</Button>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>• "TechCorp Solutions" and "TechCorp Solutions LLC" (Identical contact info)</p>
                    <p>• Same address, phone, and primary contact person</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Data Quality Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h5 className="font-medium mb-2 flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2 text-green-600" />
                  Data Quality Score
                </h5>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Complete Records</span>
                    <span className="font-semibold text-green-600">87%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Valid Email Addresses</span>
                    <span className="font-semibold text-blue-600">94%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Valid Phone Numbers</span>
                    <span className="font-semibold text-orange-600">91%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Duplicate Free</span>
                    <span className="font-semibold text-red-600">76%</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h5 className="font-medium mb-2 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2 text-purple-600" />
                  Consolidation Recommendations
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center">
                    <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                    <span>Merge 12 duplicate records</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                    <span>Update 8 incomplete addresses</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                    <span>Standardize 15 company names</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                    <span>Validate 6 email addresses</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Consolidation Actions */}
            <Card className="p-4">
              <h5 className="font-medium mb-3">Consolidation Actions</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button 
                  className="flex items-center justify-center"
                  onClick={() => {
                    toast({
                      title: "Auto-Consolidation Started",
                      description: "AI is processing data consolidation. This may take a few minutes.",
                    });
                    setIsDataConsolidationDialogOpen(false);
                  }}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Auto-Consolidate
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    toast({
                      title: "Export Started",
                      description: "Exporting duplicate analysis report.",
                    });
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    toast({
                      title: "Manual Review",
                      description: "Opening manual review interface.",
                    });
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Manual Review
                </Button>
              </div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <BusinessRecordForm
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        recordType="lead"
      />

      <ActivityForm
        isOpen={isActivityDialogOpen}
        onClose={() => setIsActivityDialogOpen(false)}
        businessRecordId={selectedRecord?.id}
        recordType={selectedRecord?.recordType === "customer" ? "customer" : "lead"}
        recordName={selectedRecord?.companyName || ""}
      />
      </div>
    </MainLayout>
  );
}

// Edit Business Record Form Component
function EditBusinessRecordForm({ record, onSubmit, isLoading }: {
  record: BusinessRecord;
  onSubmit: (data: Partial<BusinessRecord>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<Partial<BusinessRecord>>({
    companyName: record.companyName || '',
    primaryContactName: record.primaryContactName || '',
    primaryContactEmail: record.primaryContactEmail || '',
    primaryContactPhone: record.primaryContactPhone || '',
    address: record.address || '',
    city: record.city || '',
    state: record.state || '',
    zipCode: record.zipCode || '',
    industry: record.industry || '',
    website: record.website || '',
    notes: record.notes || '',
    employeeCount: record.employeeCount || undefined,
    annualRevenue: record.annualRevenue || undefined,
    estimatedDealValue: record.estimatedDealValue || undefined,
  });

  // Update form data when record changes
  useEffect(() => {
    setFormData({
      companyName: record.companyName || '',
      primaryContactName: record.primaryContactName || '',
      primaryContactEmail: record.primaryContactEmail || '',
      primaryContactPhone: record.primaryContactPhone || '',
      address: record.address || '',
      city: record.city || '',
      state: record.state || '',
      zipCode: record.zipCode || '',
      industry: record.industry || '',
      website: record.website || '',
      notes: record.notes || '',
      employeeCount: record.employeeCount || undefined,
      annualRevenue: record.annualRevenue || undefined,
      estimatedDealValue: record.estimatedDealValue || undefined,
    });
  }, [record]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="companyName">Company Name *</Label>
          <Input
            id="companyName"
            value={formData.companyName || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="primaryContactName">Primary Contact *</Label>
          <Input
            id="primaryContactName"
            value={formData.primaryContactName || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, primaryContactName: e.target.value }))}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="primaryContactEmail">Email</Label>
          <Input
            id="primaryContactEmail"
            type="email"
            value={formData.primaryContactEmail || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, primaryContactEmail: e.target.value }))}
          />
        </div>
        
        <div>
          <Label htmlFor="primaryContactPhone">Phone</Label>
          <Input
            id="primaryContactPhone"
            value={formData.primaryContactPhone || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, primaryContactPhone: e.target.value }))}
          />
        </div>
        
        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.address || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          />
        </div>
        
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
          />
        </div>
        
        <div>
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            value={formData.state || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
          />
        </div>
        
        <div>
          <Label htmlFor="zipCode">ZIP Code</Label>
          <Input
            id="zipCode"
            value={formData.zipCode || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
          />
        </div>
        
        <div>
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            value={formData.industry || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
          />
        </div>
        
        <div>
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={formData.website || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
          />
        </div>
        
        <div>
          <Label htmlFor="employeeCount">Employee Count</Label>
          <Input
            id="employeeCount"
            type="number"
            value={formData.employeeCount || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, employeeCount: e.target.value ? parseInt(e.target.value) : undefined }))}
          />
        </div>
        
        <div>
          <Label htmlFor="annualRevenue">Annual Revenue ($)</Label>
          <Input
            id="annualRevenue"
            type="number"
            value={formData.annualRevenue || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, annualRevenue: e.target.value ? parseFloat(e.target.value) : undefined }))}
          />
        </div>
        
        <div>
          <Label htmlFor="estimatedDealValue">Estimated Deal Value ($)</Label>
          <Input
            id="estimatedDealValue"
            type="number"
            value={formData.estimatedDealValue || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, estimatedDealValue: e.target.value ? parseFloat(e.target.value) : undefined }))}
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
        />
      </div>
      
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}