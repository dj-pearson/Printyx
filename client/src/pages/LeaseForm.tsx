import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { ArrowLeft, Save } from 'lucide-react';
import { planLeaseFromProposal } from '@shared/lease-draft';

const leaseFormSchema = z.object({
  leaseName: z.string().min(1, 'Lease name is required'),
  leaseNumber: z.string().min(1, 'Lease number is required'),
  customerId: z.string().min(1, 'Customer is required'),
  leaseType: z.enum(['fmv', 'dollar_buyout', 'ten_percent', 'trac', 'operating', 'capital']),
  status: z.enum([
    'pending',
    'active',
    'pending_renewal',
    'renewed',
    'expired',
    'terminated',
    'defaulted',
  ]),
  totalAmount: z.string().min(1, 'Total amount is required'),
  monthlyPayment: z.string().min(1, 'Monthly payment is required'),
  term: z.coerce.number().min(1, 'Term must be at least 1 month'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  firstPaymentDate: z.string().min(1, 'First payment date is required'),
  lastPaymentDate: z.string().min(1, 'Last payment date is required'),
  residualValue: z.string().optional(),
  buyoutAmount: z.string().optional(),
  autoPayEnabled: z.boolean().default(false),
  notes: z.string().optional(),
});

type LeaseFormData = z.infer<typeof leaseFormSchema>;

type Customer = {
  id: string;
  companyName: string;
};

export default function LeaseForm() {
  const [, params] = useRoute('/leases/:id/edit');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const leaseId = params?.id;
  const isEditMode = !!leaseId;
  const [prefillNote, setPrefillNote] = useState<string | null>(null);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/business-records'],
  });

  const { data: lease } = useQuery({
    queryKey: [`/api/leases/${leaseId}`],
    enabled: isEditMode,
  });

  // WF-C-05 AC3: open pre-filled from an accepted lease proposal, for manual
  // correction. The accept handler drafts the lease itself when the terms are
  // complete; this is the path for the ones it declined to draft, and for a rep
  // who wants to see the numbers before they exist as a row. It derives the
  // draft with planLeaseFromProposal - the same function the server runs - so
  // the two cannot disagree about the end date or the total.
  const proposalId = new URLSearchParams(
    typeof window === 'undefined' ? '' : window.location.search,
  ).get('proposalId');
  const { data: sourceProposal } = useQuery({
    queryKey: [`/api/proposals/${proposalId}`],
    enabled: !isEditMode && Boolean(proposalId),
  });

  const form = useForm<LeaseFormData>({
    resolver: zodResolver(leaseFormSchema),
    defaultValues: lease || {
      leaseName: '',
      leaseNumber: '',
      customerId: '',
      leaseType: 'fmv',
      status: 'pending',
      totalAmount: '',
      monthlyPayment: '',
      term: 36,
      startDate: '',
      endDate: '',
      firstPaymentDate: '',
      lastPaymentDate: '',
      autoPayEnabled: false,
      notes: '',
    },
  });

  useEffect(() => {
    if (!sourceProposal || isEditMode) return;
    const p = sourceProposal as Record<string, unknown>;
    const snake = (camel: string, snakeKey: string) => p[camel] ?? p[snakeKey] ?? null;
    const plan = planLeaseFromProposal(
      {
        id: String(p.id ?? ''),
        title: (snake('title', 'title') as string) ?? null,
        proposal_number: (snake('proposalNumber', 'proposal_number') as string) ?? null,
        business_record_id: (snake('businessRecordId', 'business_record_id') as string) ?? null,
        acquisition_type: snake('acquisitionType', 'acquisition_type'),
        funding_partner: snake('fundingPartner', 'funding_partner'),
        finance_term_months: snake('financeTermMonths', 'finance_term_months'),
        finance_monthly_payment: snake('financeMonthlyPayment', 'finance_monthly_payment'),
        first_payment_date: snake('firstPaymentDate', 'first_payment_date'),
      },
      { tenantId: '', contractId: null, createdBy: '', leaseNumber: '' },
    );

    // No row means the proposal does not state complete terms. The rep still gets
    // the account and the name; inventing a term and a payment schedule here is
    // exactly what the server refuses to do.
    const day = (value: unknown) => (value ? String(value).split('T')[0] : '');
    form.reset({
      ...form.getValues(),
      leaseName: String(plan.row?.lease_name ?? p.title ?? ''),
      customerId: String(
        plan.row?.customer_id ?? snake('businessRecordId', 'business_record_id') ?? '',
      ),
      status: 'pending',
      totalAmount: String(plan.row?.total_amount ?? ''),
      monthlyPayment: String(plan.row?.monthly_payment ?? ''),
      term: Number(plan.row?.term ?? 36),
      startDate: day(plan.row?.start_date),
      endDate: day(plan.row?.end_date),
      firstPaymentDate: day(plan.row?.first_payment_date),
      lastPaymentDate: day(plan.row?.last_payment_date),
    });
    setPrefillNote(plan.row ? null : (plan.reason ?? null));
  }, [sourceProposal, isEditMode, form]);

  const createMutation = useMutation({
    mutationFn: async (data: LeaseFormData) => {
      return await apiRequest('/api/leases', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Lease created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leases'] });
      setLocation('/leases');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create lease',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: LeaseFormData) => {
      return await apiRequest(`/api/leases/${leaseId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Lease updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leases'] });
      queryClient.invalidateQueries({ queryKey: [`/api/leases/${leaseId}`] });
      setLocation(`/leases/${leaseId}`);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update lease',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: LeaseFormData) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(isEditMode ? `/leases/${leaseId}` : '/leases')}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            {isEditMode ? 'Edit Lease' : 'Create New Lease'}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode ? 'Update lease details' : 'Set up a new equipment lease'}
          </p>
        </div>
      </div>

      {prefillNote && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Pre-filled from the proposal as far as it goes: {prefillNote}. Fill in the missing terms
          below before saving.
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Core lease identification and customer details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="leaseName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lease Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Canon MFP Lease 2024"
                          {...field}
                          data-testid="input-lease-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="leaseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lease Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="LS-2024-001"
                          {...field}
                          data-testid="input-lease-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-customer">
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer) => (
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="pending_renewal">Pending Renewal</SelectItem>
                          <SelectItem value="renewed">Renewed</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="terminated">Terminated</SelectItem>
                          <SelectItem value="defaulted">Defaulted</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Financial Terms</CardTitle>
              <CardDescription>Payment amounts and lease structure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="leaseType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lease Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-lease-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fmv">Fair Market Value (FMV)</SelectItem>
                          <SelectItem value="dollar_buyout">$1 Buyout</SelectItem>
                          <SelectItem value="ten_percent">10% Buyout</SelectItem>
                          <SelectItem value="trac">TRAC</SelectItem>
                          <SelectItem value="operating">Operating Lease</SelectItem>
                          <SelectItem value="capital">Capital Lease</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="term"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Term (Months)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="36" {...field} data-testid="input-term" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="monthlyPayment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Payment ($)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="450.00"
                          {...field}
                          data-testid="input-monthly-payment"
                        />
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
                      <FormLabel>Total Amount ($)</FormLabel>
                      <FormControl>
                        <Input placeholder="16200.00" {...field} data-testid="input-total-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="residualValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Residual Value ($)</FormLabel>
                      <FormControl>
                        <Input placeholder="500.00" {...field} data-testid="input-residual-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="buyoutAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Buyout Amount ($)</FormLabel>
                      <FormControl>
                        <Input placeholder="50.00" {...field} data-testid="input-buyout-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dates</CardTitle>
              <CardDescription>Lease timeline and payment schedule</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-end-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="firstPaymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Payment Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-first-payment-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastPaymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Payment Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-last-payment-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Details</CardTitle>
              <CardDescription>Notes and configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional notes or special terms..."
                        className="min-h-[100px]"
                        {...field}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation(isEditMode ? `/leases/${leaseId}` : '/leases')}
              disabled={isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save">
              <Save className="h-4 w-4 mr-2" />
              {isPending ? 'Saving...' : isEditMode ? 'Update Lease' : 'Create Lease'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
