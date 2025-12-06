import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Receipt, Calendar, DollarSign, Eye, Download, Send, Search, Filter, X } from "lucide-react";
import type { Invoice, Contract, Customer } from "@shared/schema";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";

export default function Invoices() {
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [billingPeriodStart, setBillingPeriodStart] = useState<string>("");
  const [billingPeriodEnd, setBillingPeriodEnd] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const queryClient = useQueryClient();

  const { data: invoices, isLoading: isLoadingInvoices } = useQuery<Invoice[]>({
    queryKey: ["/api/billing/invoices"],
  });

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: async (data: {
      contractId: string;
      billingPeriodStart: string;
      billingPeriodEnd: string;
    }) => apiRequest("/api/billing/invoices/generate-from-contract", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      setIsGenerateDialogOpen(false);
      setSelectedContractId("");
      setBillingPeriodStart("");
      setBillingPeriodEnd("");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/billing/invoices/${id}`, "PATCH", { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, amount, paymentDate, paymentMethod }: {
      id: string;
      amount: string;
      paymentDate: string;
      paymentMethod: string;
    }) =>
      apiRequest(`/api/billing/invoices/${id}/pay`, "POST", {
        amount: parseFloat(amount),
        paymentDate,
        paymentMethod,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      setIsPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentDate("");
      setPaymentMethod("");
      setSelectedInvoice(null);
    },
  });

  const handleGenerateInvoice = () => {
    if (selectedContractId && billingPeriodStart && billingPeriodEnd) {
      generateInvoiceMutation.mutate({
        contractId: selectedContractId,
        billingPeriodStart,
        billingPeriodEnd,
      });
    }
  };

  const handleRecordPayment = () => {
    if (selectedInvoice && paymentAmount && paymentDate && paymentMethod) {
      recordPaymentMutation.mutate({
        id: selectedInvoice.id,
        amount: paymentAmount,
        paymentDate,
        paymentMethod,
      });
    }
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers?.find((c) => c.id === customerId);
    return customer?.name || "Unknown Customer";
  };

  const getContractNumber = (contractId: string) => {
    const contract = contracts?.find((c) => c.id === contractId);
    return contract?.contractNumber || "Unknown Contract";
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800",
    } as const;

    return (
      <Badge
        className={`${colors[status as keyof typeof colors] || colors.draft} touch-manipulation min-h-[32px] px-3 text-sm font-medium`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const openPaymentDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.totalAmount);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setIsPaymentDialogOpen(true);
  };

  // Filter invoices
  const filteredInvoices = invoices?.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getCustomerName(invoice.customerId).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (isLoadingInvoices) {
    return (
      <MainLayout title="Invoices" description="Manage billing and invoice generation">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="grid gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 sm:p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
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
      title="Invoices"
      description="Manage billing and invoice generation"
    >
      <div className="space-y-4 p-4 sm:p-6">
        {/* Header Section - Mobile Optimized */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold">Invoices</h1>
              <p className="text-sm sm:text-base text-gray-600">
                Generate and manage customer invoices
              </p>
            </div>
            <Dialog
              open={isGenerateDialogOpen}
              onOpenChange={setIsGenerateDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  className="w-full sm:w-auto touch-manipulation min-h-[44px] active:scale-[0.98] transition-transform"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Generate Invoice</DialogTitle>
                  <DialogDescription>
                    Create an invoice from meter readings for a specific billing period
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="contract">Contract</Label>
                    <Select
                      value={selectedContractId}
                      onValueChange={setSelectedContractId}
                    >
                      <SelectTrigger className="min-h-[44px] touch-manipulation">
                        <SelectValue placeholder="Select contract" />
                      </SelectTrigger>
                      <SelectContent>
                        {contracts?.map((contract) => (
                          <SelectItem
                            key={contract.id}
                            value={contract.id}
                            className="min-h-[44px] touch-manipulation"
                          >
                            {contract.contractNumber} -{" "}
                            {getCustomerName(contract.customerId)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Billing Period Start</Label>
                      <Input
                        id="startDate"
                        type="date"
                        className="min-h-[44px] touch-manipulation"
                        value={billingPeriodStart}
                        onChange={(e) => setBillingPeriodStart(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endDate">Billing Period End</Label>
                      <Input
                        id="endDate"
                        type="date"
                        className="min-h-[44px] touch-manipulation"
                        value={billingPeriodEnd}
                        onChange={(e) => setBillingPeriodEnd(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                    onClick={() => setIsGenerateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="w-full sm:w-auto min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                    onClick={handleGenerateInvoice}
                    disabled={
                      !selectedContractId ||
                      !billingPeriodStart ||
                      !billingPeriodEnd ||
                      generateInvoiceMutation.isPending
                    }
                  >
                    {generateInvoiceMutation.isPending
                      ? "Generating..."
                      : "Generate Invoice"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search and Filter - Mobile Optimized */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search invoices..."
                className="pl-10 min-h-[44px] touch-manipulation"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] min-h-[44px] touch-manipulation">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="min-h-[44px] touch-manipulation">All Status</SelectItem>
                <SelectItem value="draft" className="min-h-[44px] touch-manipulation">Draft</SelectItem>
                <SelectItem value="sent" className="min-h-[44px] touch-manipulation">Sent</SelectItem>
                <SelectItem value="paid" className="min-h-[44px] touch-manipulation">Paid</SelectItem>
                <SelectItem value="overdue" className="min-h-[44px] touch-manipulation">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Invoice Cards - Mobile-First Design */}
        <div className="grid gap-3 sm:gap-4">
          {filteredInvoices?.map((invoice) => (
            <Card key={invoice.id} className="touch-manipulation">
              <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg sm:text-xl">
                      Invoice #{invoice.invoiceNumber}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {getCustomerName(invoice.customerId)}
                    </CardDescription>
                    <CardDescription className="text-xs">
                      Contract: {getContractNumber(invoice.contractId)}
                    </CardDescription>
                  </div>
                  {getStatusBadge(invoice.status)}
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {/* Key Information Grid - Mobile Stacked, Desktop Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {/* Total Amount - Prominent on Mobile */}
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg sm:col-span-2 lg:col-span-1">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">
                        ${parseFloat(invoice.totalAmount).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Billing Period */}
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">Billing Period</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {format(new Date(invoice.billingPeriodStart), "MMM dd")} -{" "}
                        {format(new Date(invoice.billingPeriodEnd), "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>

                  {/* B&W Copies */}
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="p-2 bg-gray-200 rounded-lg">
                      <Receipt className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">B&W Copies</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {invoice.blackCopiesTotal.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Color Copies */}
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Receipt className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">Color Copies</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {invoice.colorCopiesTotal.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Due Date Section */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-3 border-t border-b mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Due Date:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {format(new Date(invoice.dueDate), "MMM dd, yyyy")}
                    </span>
                  </div>
                  {invoice.paidDate && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Paid:</span>
                      <span className="text-sm font-semibold text-green-600">
                        {format(new Date(invoice.paidDate), "MMM dd, yyyy")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons - Mobile Stacked, Desktop Inline */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button
                    variant="outline"
                    className="w-full sm:flex-1 min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:flex-1 min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>

                  {invoice.status === "draft" && (
                    <Button
                      className="w-full sm:flex-1 min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                      onClick={() =>
                        updateStatusMutation.mutate({ id: invoice.id, status: "sent" })
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send Invoice
                    </Button>
                  )}

                  {(invoice.status === "sent" || invoice.status === "overdue") && (
                    <Button
                      className="w-full sm:flex-1 min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform bg-green-600 hover:bg-green-700"
                      onClick={() => openPaymentDialog(invoice)}
                      disabled={recordPaymentMutation.isPending}
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Record Payment
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Empty State */}
          {filteredInvoices?.length === 0 && (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <Receipt className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                  {searchQuery || statusFilter !== "all"
                    ? "No invoices found"
                    : "No invoices generated yet"}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-6 max-w-md mx-auto">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : "Generate your first invoice from meter readings to start billing customers."}
                </p>
                {!searchQuery && statusFilter === "all" && (
                  <Button
                    onClick={() => setIsGenerateDialogOpen(true)}
                    className="min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Generate First Invoice
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Payment Recording Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Record a payment for Invoice #{selectedInvoice?.invoiceNumber}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-900">Invoice Amount:</span>
                  <span className="text-lg font-bold text-blue-900">
                    ${selectedInvoice ? parseFloat(selectedInvoice.totalAmount).toFixed(2) : "0.00"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Payment Amount</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="min-h-[44px] touch-manipulation"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentDate">Payment Date</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    className="min-h-[44px] touch-manipulation"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="min-h-[44px] touch-manipulation">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check" className="min-h-[44px] touch-manipulation">Check</SelectItem>
                    <SelectItem value="credit_card" className="min-h-[44px] touch-manipulation">Credit Card</SelectItem>
                    <SelectItem value="ach" className="min-h-[44px] touch-manipulation">ACH Transfer</SelectItem>
                    <SelectItem value="wire" className="min-h-[44px] touch-manipulation">Wire Transfer</SelectItem>
                    <SelectItem value="cash" className="min-h-[44px] touch-manipulation">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform"
                onClick={() => {
                  setIsPaymentDialogOpen(false);
                  setPaymentAmount("");
                  setPaymentDate("");
                  setPaymentMethod("");
                  setSelectedInvoice(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto min-h-[44px] touch-manipulation active:scale-[0.98] transition-transform bg-green-600 hover:bg-green-700"
                onClick={handleRecordPayment}
                disabled={
                  !paymentAmount ||
                  !paymentDate ||
                  !paymentMethod ||
                  recordPaymentMutation.isPending
                }
              >
                {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
