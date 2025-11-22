import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import {
  CreditCard,
  Download,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  Building2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

const billingAddressSchema = z.object({
  name: z.string().min(1, "Name is required"),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().default("US"),
});

type BillingAddressForm = z.infer<typeof billingAddressSchema>;

// Initialize Stripe
let stripePromise: any = null;

const getStripePromise = async () => {
  if (!stripePromise) {
    try {
      const response = await fetch('/api/billing/stripe/config');
      const { publishableKey, configured } = await response.json();

      if (configured && publishableKey) {
        stripePromise = loadStripe(publishableKey);
      }
    } catch (error) {
      console.error('Failed to load Stripe config:', error);
    }
  }
  return stripePromise;
};

// Payment Method Form Component (uses Stripe Elements)
function AddPaymentMethodForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // Get setup intent client secret
      const response = await fetch('/api/billing/stripe/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const { clientSecret } = await response.json();

      if (!clientSecret) {
        throw new Error('Failed to create setup intent');
      }

      // Confirm card setup
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!setupIntent?.payment_method) {
        throw new Error('No payment method returned');
      }

      // Save payment method to backend
      await fetch('/api/billing/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodId: setupIntent.payment_method,
        }),
      });

      // Refresh payment methods
      queryClient.invalidateQueries({ queryKey: ['/api/billing/payment-methods'] });

      toast({
        title: 'Payment method added',
        description: 'Your payment method has been successfully added.',
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Failed to add payment method',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border rounded-lg p-4">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || isProcessing}>
          {isProcessing ? 'Processing...' : 'Add Payment Method'}
        </Button>
      </div>
    </form>
  );
}

export default function Billing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [stripePromiseState, setStripePromiseState] = useState<any>(null);

  // Load Stripe on mount
  useEffect(() => {
    getStripePromise().then(setStripePromiseState);
  }, []);

  const form = useForm<BillingAddressForm>({
    resolver: zodResolver(billingAddressSchema),
    defaultValues: {
      name: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "US",
    },
  });

  // Fetch payment methods
  const { data: paymentMethods, isLoading: loadingPaymentMethods } = useQuery({
    queryKey: ["/api/billing/payment-methods"],
  });

  // Fetch billing history
  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["/api/billing/invoices"],
  });

  // Fetch trial status
  const { data: trialStatus } = useQuery({
    queryKey: ["/api/trial/status"],
    retry: false, // Don't retry if not in trial
  });

  // Fetch billing info
  const { data: billingInfo } = useQuery({
    queryKey: ["/api/billing/info"],
  });

  // Delete payment method mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      return await apiRequest(
        `/api/billing/payment-methods/${paymentMethodId}`,
        "DELETE"
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/payment-methods"] });
      toast({
        title: "Payment method removed",
        description: "Your payment method has been successfully removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove payment method",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Update billing address mutation
  const updateBillingAddressMutation = useMutation({
    mutationFn: async (data: BillingAddressForm) => {
      return await apiRequest("/api/billing/address", "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/info"] });
      setIsEditAddressOpen(false);
      toast({
        title: "Billing address updated",
        description: "Your billing address has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update address",
        description: error.message || "Please try again",
        variant: "destructive",
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
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Failed to download invoice",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout
      title="Billing"
      description="Manage your payment methods and billing information"
    >
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
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  {!paymentMethods || paymentMethods.length === 0 ? (
                    <Button onClick={() => setIsAddPaymentOpen(true)} variant="default">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Add Payment Method
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Payment method on file</span>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-gray-700">
                    {!paymentMethods || paymentMethods.length === 0 ? (
                      <>
                        <strong>⚠️ Action Required:</strong> Add a payment method to avoid service interruption
                        when your trial ends. Your card won't be charged until after the trial period.
                      </>
                    ) : (
                      <>
                        <strong>✅ You're all set!</strong> Your subscription will automatically start when your
                        trial ends. Cancel anytime before then if you change your mind.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Methods Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>
                  Manage your payment methods for subscription billing
                </CardDescription>
              </div>
              <Dialog open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Payment Method
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Payment Method</DialogTitle>
                    <DialogDescription>
                      Add a new credit or debit card for billing
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {stripePromiseState ? (
                      <Elements stripe={stripePromiseState}>
                        <AddPaymentMethodForm
                          onSuccess={() => setIsAddPaymentOpen(false)}
                          onCancel={() => setIsAddPaymentOpen(false)}
                        />
                      </Elements>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-blue-800 font-medium">
                            Loading Stripe...
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            {!process.env.STRIPE_PUBLISHABLE_KEY
                              ? 'Stripe is not configured. Please set STRIPE_PUBLISHABLE_KEY in environment.'
                              : 'Initializing payment processor...'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setIsAddPaymentOpen(false)}
                        >
                          Close
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPaymentMethods ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading payment methods...
              </div>
            ) : !paymentMethods || paymentMethods.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  No payment methods on file
                </p>
                <p className="text-sm text-muted-foreground">
                  Add a payment method to continue your subscription after the trial ends
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method: any) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">
                            {method.cardBrand?.toUpperCase()} •••• {method.cardLast4}
                          </p>
                          {method.isDefault && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Expires {method.cardExpMonth}/{method.cardExpYear}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePaymentMutation.mutate(method.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing Information Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Billing Information</CardTitle>
                <CardDescription>
                  Your billing address and contact information
                </CardDescription>
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
                    <DialogDescription>
                      Update your billing address information
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmitAddress)}
                      className="space-y-4"
                    >
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
                        <Button
                          type="submit"
                          disabled={updateBillingAddressMutation.isPending}
                        >
                          {updateBillingAddressMutation.isPending
                            ? "Saving..."
                            : "Save Address"}
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
                  <p className="font-medium">{billingInfo.name || "Not set"}</p>
                  <p className="text-sm text-muted-foreground">
                    {billingInfo.addressLine1 || "No address on file"}
                  </p>
                  {billingInfo.addressLine2 && (
                    <p className="text-sm text-muted-foreground">
                      {billingInfo.addressLine2}
                    </p>
                  )}
                  {billingInfo.city && (
                    <p className="text-sm text-muted-foreground">
                      {billingInfo.city}, {billingInfo.state} {billingInfo.postalCode}
                    </p>
                  )}
                  {billingInfo.country && (
                    <p className="text-sm text-muted-foreground">
                      {billingInfo.country}
                    </p>
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
            <CardDescription>
              View and download your past invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingInvoices ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading invoices...
              </div>
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
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.invoiceDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        ${parseFloat(invoice.total).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {invoice.status === "paid" ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Paid
                          </Badge>
                        ) : invoice.status === "pending" ? (
                          <Badge variant="secondary">Pending</Badge>
                        ) : (
                          <Badge variant="destructive">
                            {invoice.status}
                          </Badge>
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
