import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all business records
  const { data: businessRecords = [], isLoading } = useQuery({
    queryKey: ["/api/business-records"],
  });

  // Fetch specific record details
  const { data: recordDetails } = useQuery({
    queryKey: ["/api/business-records", selectedRecord?.id],
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

  // Filter records based on selected tab
  const filteredRecords = (businessRecords as BusinessRecord[]).filter((record: BusinessRecord) => {
    switch (selectedTab) {
      case "leads":
        return record.recordType === "lead";
      case "customers":
        return record.recordType === "customer";
      case "prospects":
        return record.recordType === "lead" && ["qualified", "proposal_sent"].includes(record.status);
      case "active":
        return record.recordType === "customer" && record.status === "active";
      case "inactive":
        return record.recordType === "customer" && ["inactive", "expired", "churned", "competitor_switch", "non_payment"].includes(record.status);
      default:
        return true;
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Business Records Management</h1>
          <p className="text-muted-foreground mt-2">
            Unified lead-to-customer lifecycle with zero data loss conversion
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add New Record
        </Button>
      </div>

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
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">All Records</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="prospects">Prospects</TabsTrigger>
              <TabsTrigger value="customers">All Customers</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
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
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{record.companyName}</div>
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
      </div>
    </MainLayout>
  );
}