import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  Search,
  Send,
  Eye,
  Edit,
  Copy,
  Download,
  MoreHorizontal,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Target,
  Package,
} from "lucide-react";
import { format } from "date-fns";

interface Proposal {
  id: string;
  proposalNumber: string;
  title: string;
  proposalType: string;
  status: string;
  totalAmount: number;
  validUntil?: string;
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  openCount: number;
  customerName?: string;
  assignedTo?: string;
}

interface CustomerProposalsProps {
  customerId: string;
  customerName: string;
}

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
};

const statusIcons = {
  draft: Edit,
  sent: Send,
  viewed: Eye,
  accepted: CheckCircle,
  rejected: AlertCircle,
  expired: Clock,
};

const proposalTypes = [
  { value: "equipment_lease", label: "Equipment Lease" },
  { value: "service_contract", label: "Service Contract" },
  { value: "maintenance_agreement", label: "Maintenance Agreement" },
  { value: "managed_print", label: "Managed Print Services" },
  { value: "custom_solution", label: "Custom Solution" },
];

export function CustomerProposals({
  customerId,
  customerName,
}: CustomerProposalsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isCreateProposalOpen, setIsCreateProposalOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch customer proposals
  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({
    queryKey: [`/api/proposals?businessRecordId=${customerId}`],
    queryFn: async () =>
      apiRequest(`/api/proposals?businessRecordId=${customerId}`),
  });

  // Fetch proposal templates
  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/proposals/proposal-templates"],
    queryFn: async () => apiRequest("/api/proposals/proposal-templates"),
  });

  // Create proposal mutation
  const createProposalMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/proposals", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/proposals?businessRecordId=${customerId}`],
      });
      setIsCreateProposalOpen(false);
      toast({
        title: "Success",
        description: "Proposal created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create proposal",
        variant: "destructive",
      });
    },
  });

  // Update proposal status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/proposals/${id}/status`, "PATCH", { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/proposals?businessRecordId=${customerId}`],
      });
      toast({
        title: "Success",
        description: "Proposal status updated",
      });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "MMM dd, yyyy");
  };

  // Filter proposals
  const filteredProposals = proposals.filter((proposal) => {
    const matchesSearch =
      proposal.proposalNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      proposal.title.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || proposal.status === statusFilter;
    const matchesType =
      typeFilter === "all" || proposal.proposalType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate statistics
  const stats = {
    total: proposals.length,
    totalValue: proposals.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
    pending: proposals.filter((p) =>
      ["draft", "sent", "viewed"].includes(p.status)
    ).length,
    accepted: proposals.filter((p) => p.status === "accepted").length,
    winRate:
      proposals.length > 0
        ? (proposals.filter((p) => p.status === "accepted").length /
            proposals.length) *
          100
        : 0,
  };

  const getStatusIcon = (status: string) => {
    const Icon = statusIcons[status as keyof typeof statusIcons] || Edit;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Proposal Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Proposals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.totalValue)}
                </p>
                <p className="text-sm text-gray-600">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">
                  {stats.winRate.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">Win Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search proposals by number or title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {proposalTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog
                open={isCreateProposalOpen}
                onOpenChange={setIsCreateProposalOpen}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Proposal
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      Create Proposal for {customerName}
                    </DialogTitle>
                  </DialogHeader>
                  <ProposalForm
                    customerId={customerId}
                    customerName={customerName}
                    templates={templates}
                    onSubmit={(data) => createProposalMutation.mutate(data)}
                    isLoading={createProposalMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposals Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="min-w-[120px]">Proposal #</TableHead>
                    <TableHead className="min-w-[200px]">Title</TableHead>
                    <TableHead className="min-w-[120px]">Type</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Total Value</TableHead>
                    <TableHead className="min-w-[100px]">Valid Until</TableHead>
                    <TableHead className="min-w-[100px]">Views</TableHead>
                    <TableHead className="min-w-[120px]">Created</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProposals.map((proposal) => (
                    <TableRow key={proposal.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium text-blue-600">
                          {proposal.proposalNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{proposal.title}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {proposal.proposalType?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            statusColors[
                              proposal.status as keyof typeof statusColors
                            ]
                          }
                        >
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(proposal.status)}
                            <span className="capitalize">
                              {proposal.status}
                            </span>
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(proposal.totalAmount)}
                      </TableCell>
                      <TableCell>
                        {proposal.validUntil
                          ? formatDate(proposal.validUntil)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Eye className="h-3 w-3 text-gray-400" />
                          <span className="text-sm">{proposal.openCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(proposal.createdAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Proposal
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Proposal
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
                            </DropdownMenuItem>
                            {proposal.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: proposal.id,
                                    status: "sent",
                                  })
                                }
                              >
                                <Send className="mr-2 h-4 w-4" />
                                Send Proposal
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No proposals state */}
      {filteredProposals.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No proposals found
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm
                ? "No proposals match your search criteria."
                : "No proposals have been created for this customer yet."}
            </p>
            <Button onClick={() => setIsCreateProposalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Proposal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Proposal Form Component
function ProposalForm({
  customerId,
  customerName,
  templates,
  onSubmit,
  isLoading,
}: {
  customerId: string;
  customerName: string;
  templates: any[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    title: "",
    proposalType: "equipment_lease",
    templateId: "",
    description: "",
    validUntil: "",
    businessRecordId: customerId,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Proposal Title *</label>
          <Input
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            placeholder="Equipment Lease Proposal"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Proposal Type *</label>
          <Select
            value={formData.proposalType}
            onValueChange={(value) =>
              setFormData({ ...formData, proposalType: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {proposalTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Template</label>
          <Select
            value={formData.templateId}
            onValueChange={(value) =>
              setFormData({ ...formData, templateId: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select template (optional)" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.templateName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Valid Until</label>
          <Input
            type="date"
            value={formData.validUntil}
            onChange={(e) =>
              setFormData({ ...formData, validUntil: e.target.value })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <textarea
          className="w-full min-h-[80px] px-3 py-2 border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Brief description of the proposal..."
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Proposal"}
        </Button>
      </div>
    </form>
  );
}
