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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  Search,
  Download,
  Mail,
  Eye,
  MoreHorizontal,
  DollarSign,
  Calendar,
  Filter,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  invoiceType: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  invoiceStatus: string;
  paymentTerms: string;
  poNumber?: string;
  salesRep?: string;
  customerId: string;
  contractId?: string;
  createdAt: string;
}

interface CustomerInvoicesProps {
  customerId: string;
  customerName: string;
}

const statusColors = {
  open: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  partial: "bg-yellow-100 text-yellow-800",
  overdue: "bg-red-100 text-red-800",
  void: "bg-gray-100 text-gray-800",
};

const statusIcons = {
  open: Clock,
  paid: CheckCircle2,
  partial: AlertCircle,
  overdue: XCircle,
  void: XCircle,
};

export function CustomerInvoices({
  customerId,
  customerName,
}: CustomerInvoicesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch invoices for this customer
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: [`/api/customers/${customerId}/invoices`],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/invoices`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
  });

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.salesRep?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || invoice.invoiceStatus === statusFilter;

    return matchesSearch && matchesStatus;
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

  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map((invoice) => invoice.id));
    }
  };

  // Calculate totals
  const totals = filteredInvoices.reduce(
    (acc, invoice) => ({
      totalAmount: acc.totalAmount + (invoice.totalAmount || 0),
      amountPaid: acc.amountPaid + (invoice.amountPaid || 0),
      balanceDue: acc.balanceDue + (invoice.balanceDue || 0),
    }),
    { totalAmount: 0, amountPaid: 0, balanceDue: 0 }
  );

  const getStatusIcon = (status: string) => {
    const Icon = statusIcons[status as keyof typeof statusIcons] || Clock;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header with Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{filteredInvoices.length}</p>
                <p className="text-sm text-gray-600">Total Invoices</p>
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
                  {formatCurrency(totals.totalAmount)}
                </p>
                <p className="text-sm text-gray-600">Total Billed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">
                  {formatCurrency(totals.amountPaid)}
                </p>
                <p className="text-sm text-gray-600">Amount Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">
                  {formatCurrency(totals.balanceDue)}
                </p>
                <p className="text-sm text-gray-600">Balance Due</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search invoices by number, PO, or sales rep..."
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
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Invoice
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Create New Invoice</DialogTitle>
                  </DialogHeader>
                  <div className="p-4">
                    <p className="text-gray-600">
                      Invoice creation form would go here...
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedInvoices.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
              <span className="text-sm text-blue-800">
                {selectedInvoices.length} invoice
                {selectedInvoices.length === 1 ? "" : "s"} selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Statements
                </Button>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices Table */}
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
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedInvoices.length === filteredInvoices.length &&
                          filteredInvoices.length > 0
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="min-w-[120px]">Invoice #</TableHead>
                    <TableHead className="min-w-[100px]">Date</TableHead>
                    <TableHead className="min-w-[100px]">Due Date</TableHead>
                    <TableHead className="min-w-[80px]">Type</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">
                      Total Amount
                    </TableHead>
                    <TableHead className="min-w-[120px]">Amount Paid</TableHead>
                    <TableHead className="min-w-[120px]">Balance Due</TableHead>
                    <TableHead className="min-w-[100px]">PO Number</TableHead>
                    <TableHead className="min-w-[100px]">Sales Rep</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={selectedInvoices.includes(invoice.id)}
                          onCheckedChange={() =>
                            toggleInvoiceSelection(invoice.id)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-blue-600">
                          {invoice.invoiceNumber}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <span className="capitalize">
                          {invoice.invoiceType}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            statusColors[
                              invoice.invoiceStatus as keyof typeof statusColors
                            ] || "bg-gray-100"
                          }
                        >
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(invoice.invoiceStatus)}
                            <span className="capitalize">
                              {invoice.invoiceStatus}
                            </span>
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(invoice.totalAmount)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(invoice.amountPaid)}
                      </TableCell>
                      <TableCell
                        className={
                          invoice.balanceDue > 0
                            ? "font-medium text-red-600"
                            : "text-green-600"
                        }
                      >
                        {formatCurrency(invoice.balanceDue)}
                      </TableCell>
                      <TableCell>{invoice.poNumber || "-"}</TableCell>
                      <TableCell>{invoice.salesRep || "-"}</TableCell>
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
                              View Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Mail className="mr-2 h-4 w-4" />
                              Email Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <DollarSign className="mr-2 h-4 w-4" />
                              Record Payment
                            </DropdownMenuItem>
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

      {/* No invoices state */}
      {filteredInvoices.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No invoices found
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm
                ? "No invoices match your search criteria."
                : "No invoices have been created for this customer yet."}
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create First Invoice
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
