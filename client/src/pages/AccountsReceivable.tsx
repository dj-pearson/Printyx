import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Receipt, 
  Plus, 
  Search, 
  Calendar, 
  DollarSign,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  Building2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AccountsReceivable } from "@shared/schema";
import { format } from "date-fns";

// Form schema for accounts receivable creation/editing
const accountsReceivableSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  contractId: z.string().optional(),
  referenceNumber: z.string().optional(),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  description: z.string().optional(),
  subtotal: z.string().min(1, "Subtotal is required"),
  taxAmount: z.string().default("0"),
  totalAmount: z.string().min(1, "Total amount is required"),
  status: z.string().default("pending"),
  priority: z.string().default("normal"),
  category: z.string().optional(),
  paymentTerms: z.string().default("Net 30"),
});

type AccountsReceivableFormData = z.infer<typeof accountsReceivableSchema>;

export default function AccountsReceivable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAR, setEditingAR] = useState<AccountsReceivable | null>(null);
  const [viewingAR, setViewingAR] = useState<AccountsReceivable | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accountsReceivable = [], isLoading } = useQuery({
    queryKey: ["/api/accounts-receivable"],
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["/api/customers"],
  });

  const form = useForm<AccountsReceivableFormData>({
    resolver: zodResolver(accountsReceivableSchema),
    defaultValues: {
      customerId: "",
      invoiceNumber: "",
      contractId: "",
      referenceNumber: "",
      invoiceDate: "",
      dueDate: "",
      description: "",
      subtotal: "",
      taxAmount: "0",
      totalAmount: "",
      status: "pending",
      priority: "normal",
      category: "",
      paymentTerms: "Net 30",
    },
  });

  const createARMutation = useMutation({
    mutationFn: (data: AccountsReceivableFormData) => apiRequest("/api/accounts-receivable", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        invoiceDate: new Date(data.invoiceDate).toISOString(),
        dueDate: new Date(data.dueDate).toISOString(),
        subtotal: parseFloat(data.subtotal),
        taxAmount: parseFloat(data.taxAmount),
        totalAmount: parseFloat(data.totalAmount),
        balanceAmount: parseFloat(data.totalAmount), // Initially, balance equals total
        paidAmount: 0,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-receivable"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Invoice created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  const updateARMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AccountsReceivableFormData> }) =>
      apiRequest(`/api/accounts-receivable/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-receivable"] });
      setIsDialogOpen(false);
      setEditingAR(null);
      form.reset();
      toast({
        title: "Success",
        description: "Invoice updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update invoice",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (ar?: AccountsReceivable) => {
    if (ar) {
      setEditingAR(ar);
      form.reset({
        customerId: ar.customerId,
        invoiceNumber: ar.invoiceNumber,
        contractId: ar.contractId || "",
        referenceNumber: ar.referenceNumber || "",
        invoiceDate: format(new Date(ar.invoiceDate), "yyyy-MM-dd"),
        dueDate: format(new Date(ar.dueDate), "yyyy-MM-dd"),
        description: ar.description || "",
        subtotal: ar.subtotal.toString(),
        taxAmount: ar.taxAmount?.toString() || "0",
        totalAmount: ar.totalAmount.toString(),
        status: ar.status,
        priority: ar.priority || "normal",
        category: ar.category || "",
        paymentTerms: ar.paymentTerms || "Net 30",
      });
    } else {
      setEditingAR(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: AccountsReceivableFormData) => {
    if (editingAR) {
      updateARMutation.mutate({ id: editingAR.id, data });
    } else {
      createARMutation.mutate(data);
    }
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c: any) => c.id === customerId);
    return customer?.companyName || "Unknown Customer";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "overdue":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "partial":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredAR = accountsReceivable.filter((ar: AccountsReceivable) => {
    const matchesSearch = 
      ar.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCustomerName(ar.customerId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ar.referenceNumber && ar.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || ar.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Accounts Receivable</h1>
          <p className="text-sm text-gray-600">
            Manage customer invoices and payments
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAR ? "Edit Invoice" : "Create New Invoice"}
              </DialogTitle>
              <DialogDescription>
                {editingAR
                  ? "Update invoice information and payment details."
                  : "Create a new customer invoice for accounts receivable."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers.map((customer: any) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.companyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="INV-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contractId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract ID</FormLabel>
                        <FormControl>
                          <Input placeholder="CON-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="referenceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference Number</FormLabel>
                        <FormControl>
                          <Input placeholder="REF-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="invoiceDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Terms</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Net 15">Net 15</SelectItem>
                            <SelectItem value="Net 30">Net 30</SelectItem>
                            <SelectItem value="Net 60">Net 60</SelectItem>
                            <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                            <SelectItem value="COD">Cash on Delivery</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input placeholder="Service, Equipment, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subtotal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtotal *</FormLabel>
                        <FormControl>
                          <Input placeholder="1000.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="taxAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax Amount</FormLabel>
                        <FormControl>
                          <Input placeholder="80.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Amount *</FormLabel>
                        <FormControl>
                          <Input placeholder="1080.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="partial">Partial Payment</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional details about this invoice..."
                          className="resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createARMutation.isPending || updateARMutation.isPending}
                  >
                    {editingAR ? "Update" : "Create"} Invoice
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partial">Partial Payment</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAR.map((ar: AccountsReceivable) => (
          <Card key={ar.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Receipt className="h-5 w-5 text-gray-400" />
                  <div>
                    <CardTitle className="text-lg">{ar.invoiceNumber}</CardTitle>
                    <p className="text-sm text-gray-500">{getCustomerName(ar.customerId)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {getStatusIcon(ar.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Badge className={getStatusColor(ar.status)}>
                    {ar.status}
                  </Badge>
                  <Badge className={getPriorityColor(ar.priority || "normal")}>
                    {ar.priority || "normal"}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium">${parseFloat(ar.totalAmount.toString()).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Balance:</span>
                    <span className="font-medium">${parseFloat(ar.balanceAmount.toString()).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Due Date:</span>
                    <span className="font-medium">
                      {format(new Date(ar.dueDate), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Terms:</span>
                    <span className="font-medium">{ar.paymentTerms}</span>
                  </div>
                  {ar.category && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Category:</span>
                      <span className="font-medium">{ar.category}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewingAR(ar)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenDialog(ar)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAR.length === 0 && (
        <div className="text-center py-12">
          <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter !== "all" 
              ? "No invoices match your search criteria." 
              : "Get started by creating your first customer invoice."}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          )}
        </div>
      )}

      {/* View Invoice Dialog */}
      <Dialog open={!!viewingAR} onOpenChange={() => setViewingAR(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              View complete invoice information and payment history.
            </DialogDescription>
          </DialogHeader>
          {viewingAR && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-900">Invoice Information</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <div><span className="text-gray-600">Invoice Number:</span> {viewingAR.invoiceNumber}</div>
                    <div><span className="text-gray-600">Customer:</span> {getCustomerName(viewingAR.customerId)}</div>
                    <div><span className="text-gray-600">Invoice Date:</span> {format(new Date(viewingAR.invoiceDate), "MMM d, yyyy")}</div>
                    <div><span className="text-gray-600">Due Date:</span> {format(new Date(viewingAR.dueDate), "MMM d, yyyy")}</div>
                    <div><span className="text-gray-600">Payment Terms:</span> {viewingAR.paymentTerms}</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Amount Details</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <div><span className="text-gray-600">Subtotal:</span> ${parseFloat(viewingAR.subtotal.toString()).toFixed(2)}</div>
                    <div><span className="text-gray-600">Tax:</span> ${parseFloat(viewingAR.taxAmount?.toString() || "0").toFixed(2)}</div>
                    <div><span className="text-gray-600">Total:</span> ${parseFloat(viewingAR.totalAmount.toString()).toFixed(2)}</div>
                    <div><span className="text-gray-600">Paid:</span> ${parseFloat(viewingAR.paidAmount?.toString() || "0").toFixed(2)}</div>
                    <div><span className="text-gray-600">Balance:</span> ${parseFloat(viewingAR.balanceAmount.toString()).toFixed(2)}</div>
                  </div>
                </div>
              </div>
              
              {viewingAR.description && (
                <div>
                  <h3 className="font-medium text-gray-900">Description</h3>
                  <p className="mt-1 text-sm text-gray-600">{viewingAR.description}</p>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewingAR(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}