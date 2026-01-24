import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import MainLayout from '@/components/layout/main-layout';
import { CreditCard, Download, Plus, Trash2, Edit, CheckCircle, Building2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';

const billingAddressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().default('US'),
});

type BillingAddressForm = z.infer<typeof billingAddressSchema>;

export default function Billing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);

  const form = useForm<BillingAddressForm>({
    resolver: zodResolver(billingAddressSchema),
    defaultValues: {
      name: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
    },
  });

  // Fetch payment methods
  const { data: paymentMethods, isLoading: loadingPaymentMethods } = useQuery({
    queryKey: ['/api/billing/payment-methods'],
    queryFn: async () => {
      const response = await apiRequest('/api/billing/payment-methods', 'GET');
      return (response || []).map((method: any) => ({
        ...method,
        id: method.id,
        createdAt: method.created_at || method.createdAt || '',
      }));
    },
  });

  // Fetch billing history
  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['/api/billing/invoices'],
    queryFn: async () => {
      const response = await apiRequest('/api/billing/invoices', 'GET');
      return (response || []).map((invoice: any) => ({
        ...invoice,
        id: invoice.id,
        invoiceNumber: invoice.invoice_number || invoice.invoiceNumber || '',
        dueDate: invoice.due_date || invoice.dueDate || '',
        createdAt: invoice.created_at || invoice.createdAt || '',
      }));
    },
  });

  // Fetch trial status
  const { data: trialStatus } = useQuery({
    queryKey: ['/api/trial/status'],
    queryFn: async () => {
      const response = await apiRequest('/api/trial/status', 'GET');
      return {
        ...response,
        trialEnd: response?.trial_end || response?.trialEnd || null,
        isTrialing: response?.is_trialing || response?.isTrialing || false,
      };
    },
    retry: false, // Don't retry if not in trial
  });

  // Fetch billing info
  const { data: billingInfo } = useQuery({
    queryKey: ['/api/billing/info'],
    queryFn: async () => {
      const response = await apiRequest('/api/billing/info', 'GET');
      return response || {};
    },
  });

  // Delete payment method mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      return await apiRequest(`/api/billing/payment-methods/${paymentMethodId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/payment-methods'] });
      toast({
        title: 'Payment method removed',
        description: 'Your payment method has been successfully removed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to remove payment method',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  // Update billing address mutation
  const updateBillingAddressMutation = useMutation({
    mutationFn: async (data: BillingAddressForm) => {
      return await apiRequest('/api/billing/address', 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/info'] });
      setIsEditAddressOpen(false);
      toast({
        title: 'Billing address updated',
        description: 'Your billing address has been successfully updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update address',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const onSubmitAddress = async (data: BillingAddressForm) => {
    await updateBillingAddressMutation.mutateAsync(data);
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/pdf`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: 'Failed to download invoice',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  return (
    <MainLayout title="Billing" description="Manage your payment methods and billing information">
      <div className="space-y-6">
        {/* Trial/Subscription Status */}
        {trialStatus && trialStatus.status === 'active' && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-blue-900">Free Trial Active</CardTitle>
                  <CardDescription className="text-blue-700">
                    {trialStatus.daysRemaining} days remaining
                  </CardDescription>
                </div>
                {trialStatus.daysRemaining <= 3 && (
                  <Badge variant="destructive">Ending Soon!</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Trial ends on:</p>
                    <p className="text-sm text-blue-700">
                      {new Date(trialStatus.trialEndDate).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-gray-700">
                    <strong>✅ Active Trial:</strong> Your subscription will start when your trial
                    ends. Cancel anytime before then if you change your mind.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Methods Section - Disabled */}
        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Payment method management coming soon</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Payment functionality is being configured
              </p>
              <p className="text-sm text-muted-foreground">
                This feature will be available shortly
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Billing Information Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Billing Information</CardTitle>
                <CardDescription>Your billing address and contact information</CardDescription>
              </div>
              <Dialog open={isEditAddressOpen} onOpenChange={setIsEditAddressOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Address
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Billing Address</DialogTitle>
                    <DialogDescription>Update your billing address information</DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmitAddress)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="addressLine1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Line 1</FormLabel>
                            <FormControl>
                              <Input placeholder="123 Main St" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="addressLine2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Line 2</FormLabel>
                            <FormControl>
                              <Input placeholder="Suite 100" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input placeholder="New York" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State</FormLabel>
                              <FormControl>
                                <Input placeholder="NY" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="postalCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Postal Code</FormLabel>
                              <FormControl>
                                <Input placeholder="10001" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country</FormLabel>
                              <FormControl>
                                <Input placeholder="US" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditAddressOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={updateBillingAddressMutation.isPending}>
                          {updateBillingAddressMutation.isPending ? 'Saving...' : 'Save Address'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {billingInfo ? (
              <div className="flex items-start space-x-4">
                <Building2 className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">{billingInfo.name || 'Not set'}</p>
                  <p className="text-sm text-muted-foreground">
                    {billingInfo.addressLine1 || 'No address on file'}
                  </p>
                  {billingInfo.addressLine2 && (
                    <p className="text-sm text-muted-foreground">{billingInfo.addressLine2}</p>
                  )}
                  {billingInfo.city && (
                    <p className="text-sm text-muted-foreground">
                      {billingInfo.city}, {billingInfo.state} {billingInfo.postalCode}
                    </p>
                  )}
                  {billingInfo.country && (
                    <p className="text-sm text-muted-foreground">{billingInfo.country}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No billing address on file</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing History Section */}
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>View and download your past invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingInvoices ? (
              <div className="text-center py-8 text-muted-foreground">Loading invoices...</div>
            ) : !invoices || invoices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No invoices yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Your billing history will appear here after your first payment
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice: any) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{format(new Date(invoice.invoiceDate), 'MMM d, yyyy')}</TableCell>
                      <TableCell>${parseFloat(invoice.total).toFixed(2)}</TableCell>
                      <TableCell>
                        {invoice.status === 'paid' ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Paid
                          </Badge>
                        ) : invoice.status === 'pending' ? (
                          <Badge variant="secondary">Pending</Badge>
                        ) : (
                          <Badge variant="destructive">{invoice.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadInvoice(invoice.id)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
