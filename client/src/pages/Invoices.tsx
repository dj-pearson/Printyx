import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Receipt, Calendar, DollarSign, Eye } from "lucide-react";
import type { Invoice, Contract, Customer } from "@shared/schema";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/layout/layout";

export default function Invoices() {
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [billingPeriodStart, setBillingPeriodStart] = useState<string>("");
  const [billingPeriodEnd, setBillingPeriodEnd] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: invoices, isLoading: isLoadingInvoices } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: async (data: { contractId: string; billingPeriodStart: string; billingPeriodEnd: string }) => {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to generate invoice');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsGenerateDialogOpen(false);
      setSelectedContractId("");
      setBillingPeriodStart("");
      setBillingPeriodEnd("");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update invoice');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
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

  const getCustomerName = (customerId: string) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  const getContractNumber = (contractId: string) => {
    const contract = contracts?.find(c => c.id === contractId);
    return contract?.contractNumber || 'Unknown Contract';
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: 'secondary',
      sent: 'default',
      paid: 'success',
      overdue: 'destructive',
    } as const;

    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
    } as const;
    
    return (
      <Badge className={colors[status as keyof typeof colors] || colors.draft}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getStatusActions = (invoice: Invoice) => {
    switch (invoice.status) {
      case 'draft':
        return (
          <Button 
            size="sm" 
            onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: 'sent' })}
            disabled={updateStatusMutation.isPending}
          >
            Send Invoice
          </Button>
        );
      case 'sent':
        return (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: 'paid' })}
            disabled={updateStatusMutation.isPending}
          >
            Mark as Paid
          </Button>
        );
      case 'overdue':
        return (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: 'paid' })}
            disabled={updateStatusMutation.isPending}
          >
            Mark as Paid
          </Button>
        );
      default:
        return null;
    }
  };

  if (isLoadingInvoices) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Invoices</h1>
        </div>
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
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-gray-600">Generate and manage customer invoices from meter readings</p>
        </div>
        <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Generate Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Generate Invoice</DialogTitle>
              <DialogDescription>
                Create an invoice from meter readings for a specific billing period
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="contract">Contract</Label>
                <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contract" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts?.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.contractNumber} - {getCustomerName(contract.customerId)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="startDate">Billing Period Start</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={billingPeriodStart}
                  onChange={(e) => setBillingPeriodStart(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="endDate">Billing Period End</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={billingPeriodEnd}
                  onChange={(e) => setBillingPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleGenerateInvoice}
                disabled={!selectedContractId || !billingPeriodStart || !billingPeriodEnd || generateInvoiceMutation.isPending}
              >
                {generateInvoiceMutation.isPending ? "Generating..." : "Generate Invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {invoices?.map((invoice) => (
          <Card key={invoice.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    Invoice #{invoice.invoiceNumber}
                  </CardTitle>
                  <CardDescription>
                    {getCustomerName(invoice.customerId)} • 
                    Contract: {getContractNumber(invoice.contractId)}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(invoice.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Billing Period</p>
                    <p className="font-semibold text-sm">
                      {format(new Date(invoice.billingPeriodStart), 'MMM dd')} - 
                      {format(new Date(invoice.billingPeriodEnd), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">B&W Copies</p>
                    <p className="font-semibold">{invoice.blackCopiesTotal.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Color Copies</p>
                    <p className="font-semibold">{invoice.colorCopiesTotal.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="font-semibold text-lg">${parseFloat(invoice.totalAmount).toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                  {getStatusActions(invoice)}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span>Due Date: {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}</span>
                  {invoice.paidDate && (
                    <span className="text-green-600">Paid: {format(new Date(invoice.paidDate), 'MMM dd, yyyy')}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {invoices?.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No invoices generated yet</h3>
              <p className="text-gray-600 mb-4">Generate your first invoice from meter readings to start billing customers.</p>
              <Button onClick={() => setIsGenerateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Generate First Invoice
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </Layout>
  );
}