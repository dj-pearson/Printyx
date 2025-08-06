import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  FileText,
  Plus,
  Search,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MoreHorizontal,
  Eye,
  Edit,
  RefreshCcw,
  Calculator,
} from "lucide-react";
import { format, isAfter, isBefore, addMonths } from "date-fns";

interface Contract {
  id: string;
  contractNumber: string;
  contractType: string;
  customerId: string;
  startDate: string;
  endDate: string;
  autoRenewal: boolean;
  renewalTerms: number;
  blackRate?: number;
  colorRate?: number;
  monthlyBase?: number;
  hasTieredRates: boolean;
  status: string;
  totalContractValue?: number;
  currentMonthlyBilling?: number;
  lastBillingDate?: string;
  nextBillingDate?: string;
  equipmentCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface CustomerContractsProps {
  customerId: string;
  customerName: string;
}

const contractTypeLabels = {
  cost_per_click: "Cost Per Click",
  flat_rate: "Flat Rate",
  hybrid: "Hybrid",
  maintenance_only: "Maintenance Only",
  full_service: "Full Service",
};

const statusColors = {
  active: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  expired: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
  renewal_pending: "bg-blue-100 text-blue-800",
};

export function CustomerContracts({ customerId, customerName }: CustomerContractsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch contracts for this customer
  const { data: contracts = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/contracts", "customer", customerId],
    enabled: !!customerId,
  });

  // Filter contracts based on search and status
  const filteredContracts = contracts.filter((contract: Contract) => {
    const matchesSearch = 
      contract.contractNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.contractType?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getContractStatus = (contract: Contract) => {
    const now = new Date();
    const endDate = new Date(contract.endDate);
    const startDate = new Date(contract.startDate);
    
    if (isBefore(now, startDate)) return "pending";
    if (isAfter(now, endDate)) {
      if (contract.autoRenewal) return "renewal_pending";
      return "expired";
    }
    return "active";
  };

  const getRenewalAlert = (contract: Contract) => {
    if (!contract.autoRenewal) return null;
    
    const now = new Date();
    const endDate = new Date(contract.endDate);
    const threeMonthsOut = addMonths(now, 3);
    
    if (isAfter(threeMonthsOut, endDate)) {
      return "Renewal coming up";
    }
    return null;
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Contracts</h2>
          <p className="text-sm text-gray-600">
            Manage service contracts for {customerName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search contracts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="renewal_pending">Renewal Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Contracts ({filteredContracts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredContracts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No contracts found
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== "all"
                  ? "No contracts match your current filters."
                  : "This customer doesn't have any contracts yet."}
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create First Contract
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Monthly Base</TableHead>
                    <TableHead>Auto Renewal</TableHead>
                    <TableHead>Alerts</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract: Contract) => {
                    const status = getContractStatus(contract);
                    const renewalAlert = getRenewalAlert(contract);
                    
                    return (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">
                          {contract.contractNumber}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {contractTypeLabels[contract.contractType as keyof typeof contractTypeLabels] || contract.contractType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(contract.startDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          {format(new Date(contract.endDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[status as keyof typeof statusColors]}>
                            {status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatCurrency(contract.monthlyBase)}
                        </TableCell>
                        <TableCell>
                          {contract.autoRenewal ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {renewalAlert && (
                            <div className="flex items-center">
                              <AlertTriangle className="h-4 w-4 text-amber-500 mr-1" />
                              <span className="text-xs text-amber-700">
                                {renewalAlert}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedContract(contract);
                                  setShowDetails(true);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Contract
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Calculator className="h-4 w-4 mr-2" />
                                Generate Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Calendar className="h-4 w-4 mr-2" />
                                Schedule Service
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contract Details</DialogTitle>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">Contract Number</h4>
                  <p className="text-gray-600">{selectedContract.contractNumber}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Type</h4>
                  <p className="text-gray-600">
                    {contractTypeLabels[selectedContract.contractType as keyof typeof contractTypeLabels] || selectedContract.contractType}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Start Date</h4>
                  <p className="text-gray-600">
                    {format(new Date(selectedContract.startDate), "MMMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">End Date</h4>
                  <p className="text-gray-600">
                    {format(new Date(selectedContract.endDate), "MMMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Monthly Base</h4>
                  <p className="text-gray-600">{formatCurrency(selectedContract.monthlyBase)}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Auto Renewal</h4>
                  <p className="text-gray-600">
                    {selectedContract.autoRenewal 
                      ? `Yes (${selectedContract.renewalTerms} months)` 
                      : "No"}
                  </p>
                </div>
              </div>

              {selectedContract.contractType === "cost_per_click" && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Per-Click Rates</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Black & White</span>
                      <p className="font-medium">{formatCurrency(selectedContract.blackRate)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Color</span>
                      <p className="font-medium">{formatCurrency(selectedContract.colorRate)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDetails(false)}>
                  Close
                </Button>
                <Button>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Contract
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}