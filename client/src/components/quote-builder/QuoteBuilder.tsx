import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  Calculator,
  Save,
  Send,
  FileText,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import CompanyContactSelector from './CompanyContactSelector';
import LineItemManager from './LineItemManager';
import PricingCalculator from './PricingCalculator';
import { QuoteWizardProgress, DEFAULT_QUOTE_STEPS } from '@/components/quotes/QuoteWizardProgress';

// Quote form schema
const quoteSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  businessRecordId: z.string().min(1, 'Company is required'),
  contactId: z.string().optional(),
  billingAddress: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  pricingType: z.enum(['new', 'upgrade']).default('new'),
  validUntil: z.string().optional(),
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  // Pricing fields
  discountAmount: z.string().optional(),
  discountPercentage: z.string().optional(),
  taxAmount: z.string().optional(),
  subtotal: z.string().optional(),
  totalAmount: z.string().optional(),
});

type QuoteFormData = z.infer<typeof quoteSchema>;

type ProductType =
  | 'product_models'
  | 'product_accessories'
  | 'professional_services'
  | 'service_products'
  | 'software_products'
  | 'supplies'
  | 'managed_services';

interface LineItem {
  id?: string;
  lineNumber: number;
  parentLineId?: string;
  isSubline: boolean;
  productType: ProductType;
  productId: string;
  productCode: string;
  productName: string;
  description?: string;
  quantity: number;
  msrp?: number;
  listPrice?: number;
  unitPrice: number;
  totalPrice: number;
  unitCost?: number;
  margin?: number;
  notes?: string;
}

interface QuoteBuilderProps {
  initialQuoteId?: string;
  onSave?: (quoteId: string) => void;
  onCancel?: () => void;
  onCreateProposal?: (quoteId: string) => void;
}

export default function QuoteBuilder({
  initialQuoteId,
  onSave,
  onCancel,
  onCreateProposal,
}: QuoteBuilderProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0=Customer 1=Products 2=Pricing 3=Review
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      title: '',
      businessRecordId: '',
      contactId: '',
      billingAddress: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US',
      },
      pricingType: 'new',
      validUntil: '',
      customerNotes: '',
      internalNotes: '',
      discountAmount: '0',
      discountPercentage: '0',
      taxAmount: '0',
      subtotal: '0',
      totalAmount: '0',
    },
  });

  // Load existing quote if editing
  const { data: existingQuote, isLoading: quoteLoading } = useQuery({
    queryKey: [`/api/proposals/${initialQuoteId}`],
    enabled: !!initialQuoteId && initialQuoteId !== 'new',
    queryFn: async () => {
      const response = await apiRequest(`/api/proposals/${initialQuoteId}`, 'GET');
      // Return response as-is (not an array, it's a single object)
      return response;
    },
  });

  // Fetch companies for company/contact selection
  const { data: businessRecords = [] } = useQuery({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const response = await apiRequest('/api/companies', 'GET');
      // Handle both formats: { data: [...] } or { records: [...] } wrapper or direct array
      const data = response?.data || response?.records || (Array.isArray(response) ? response : []);
      return Array.isArray(data) ? data : [];
    },
  });

  // Handle URL parameters for pre-filling (e.g., from leads page)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const leadId = urlParams.get('leadId');
    const companyName = urlParams.get('companyName');
    const shouldPrefill = urlParams.get('prefill') === 'true';

    if (shouldPrefill && leadId && Array.isArray(businessRecords) && !initialQuoteId) {
      // Find the lead/company in business records
      const company = businessRecords.find((record: any) => record.id === leadId);
      if (company) {
        console.log('🏢 Pre-filling quote with company:', company.companyName);
        setSelectedCompany(company);
        form.setValue('businessRecordId', company.id);
        form.setValue(
          'title',
          `Quote for ${company.companyName || company.business_name || ''}`.trim(),
        );
        form.setValue('billingAddress', mapBillingAddress(company));
      }
    }
  }, [businessRecords, form, initialQuoteId]);

  // Populate form when existing quote is loaded
  useEffect(() => {
    if (existingQuote && !quoteLoading) {
      console.log('📝 Populating form with existing quote:', existingQuote);

      // GET /proposals/:id returns snake_case (edge fn). Read both shapes.
      const businessRecordId =
        existingQuote.businessRecordId || existingQuote.business_record_id || '';
      const contactId = existingQuote.contactId || existingQuote.contact_id || '';
      const validUntil = existingQuote.validUntil || existingQuote.valid_until || '';
      const discountAmt = existingQuote.discountAmount ?? existingQuote.discount_amount ?? '0';
      const discountPct =
        existingQuote.discountPercentage ?? existingQuote.discount_percentage ?? '0';
      const taxAmt = existingQuote.taxAmount ?? existingQuote.tax_amount ?? '0';
      const customer = existingQuote.customer || null;
      const billingAddress = customer
        ? mapBillingAddress(customer)
        : { street: '', city: '', state: '', zipCode: '', country: 'US' };

      // Update form with existing data
      form.reset({
        title: existingQuote.title || '',
        businessRecordId,
        contactId,
        billingAddress,
        pricingType: 'new',
        validUntil: validUntil ? String(validUntil).split('T')[0] : '',
        customerNotes: existingQuote.customerNotes || existingQuote.customer_notes || '',
        internalNotes: existingQuote.internalNotes || existingQuote.internal_notes || '',
        discountAmount: String(discountAmt),
        discountPercentage: String(discountPct),
        taxAmount: String(taxAmt),
      });

      // Set local state for pricing calculator
      setDiscountAmount(parseFloat(String(discountAmt)) || 0);
      setDiscountPercentage(parseFloat(String(discountPct)) || 0);
      setTaxAmount(parseFloat(String(taxAmt)) || 0);

      // Prefer the customer object returned with the proposal; fall back to the
      // companies list lookup.
      const company =
        customer ||
        (Array.isArray(businessRecords)
          ? businessRecords.find((record: any) => record.id === businessRecordId)
          : null);
      if (company) {
        setSelectedCompany(company);

        // Fetch and set the contact if one was chosen
        if (contactId && businessRecordId) {
          apiRequest(`/api/companies/${businessRecordId}/contacts`, 'GET')
            .then((contacts: any[]) => {
              const list = Array.isArray(contacts) ? contacts : [];
              const contact = list.find((cc: any) => cc.id === contactId);
              if (contact) setSelectedContact(contact);
            })
            .catch((error) => {
              console.warn('Failed to fetch contacts for company:', error);
            });
        }
      }

      // Update line items if they exist
      if (existingQuote.lineItems && existingQuote.lineItems.length > 0) {
        const transformedLineItems = existingQuote.lineItems.map((item: any, index: number) => ({
          id: item.id,
          lineNumber: index + 1,
          parentLineId: undefined,
          isSubline: false,
          productType: ((item.itemType || item.item_type) as ProductType) || 'product_models',
          productId: item.productId || item.product_id || '',
          productCode: item.productCode || item.product_code || '',
          productName: item.productName || item.product_name || '',
          description: item.description || '',
          quantity: item.quantity || 1,
          msrp: 0,
          listPrice: parseFloat(item.unitPrice || item.unit_price || '0'),
          unitPrice: parseFloat(item.unitPrice || item.unit_price || '0'),
          totalPrice: parseFloat(item.totalPrice || item.total_price || '0'),
          unitCost: parseFloat(item.unitCost || item.unit_cost || '0'),
          margin: parseFloat(item.margin || '0') || 0,
          notes: item.notes || '',
        }));
        setLineItems(transformedLineItems);
        console.log('📦 Set line items:', transformedLineItems);
      }
    }
  }, [existingQuote, quoteLoading, businessRecords, form]);

  // Create or update quote mutation
  const saveQuoteMutation = useMutation({
    mutationFn: async (data: { quote: QuoteFormData; lineItems: LineItem[] }) => {
      const subtotalAmount = data.lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const discountAmt = parseFloat(data.quote.discountAmount || '0');
      const taxAmt = parseFloat(data.quote.taxAmount || '0');
      const totalAmount = subtotalAmount - discountAmt + taxAmt;

      const quoteData = {
        ...data.quote,
        proposalType: 'quote',
        status: 'draft',
        // Keep validUntil as string - backend will convert to Date
        lineItems: data.lineItems.map((item, index) => ({
          lineNumber: index + 1,
          itemType: item.productType || 'equipment', // Map productType to itemType
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          description: item.description || item.productName,
          quantity: item.quantity,
          unitCost: item.unitCost ?? 0, // dealer/hard cost — required for margin
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          margin: item.margin,
          notes: item.notes,
        })),
        subtotal: subtotalAmount.toString(),
        discountAmount: discountAmt.toString(),
        discountPercentage: data.quote.discountPercentage || '0',
        taxAmount: taxAmt.toString(),
        totalAmount: totalAmount.toString(),
      };

      console.log('📤 Submitting quote:', quoteData);

      if (initialQuoteId && initialQuoteId !== 'new') {
        return await apiRequest(`/api/proposals/${initialQuoteId}`, 'PATCH', quoteData);
      } else {
        return await apiRequest('/api/proposals', 'POST', quoteData);
      }
    },
    onSuccess: (data) => {
      // Force clear all related cache
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      queryClient.removeQueries({ queryKey: ['/api/proposals'] });
      toast({
        title: 'Success',
        description: `Quote ${initialQuoteId ? 'updated' : 'created'} successfully`,
      });
      if (onSave) {
        onSave(data.id);
      }
    },
    onError: (error) => {
      console.error('❌ Quote save error:', error);
      toast({
        title: 'Error',
        description: `Failed to ${initialQuoteId ? 'update' : 'create'} quote: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    },
  });

  // Submit quote mutation (change status to sent)
  const submitQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return await apiRequest(`/api/proposals/${quoteId}/status`, 'PATCH', {
        status: 'sent',
      });
    },
    onSuccess: () => {
      // Force clear all related cache
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      queryClient.removeQueries({ queryKey: ['/api/proposals'] });
      toast({
        title: 'Success',
        description: 'Quote submitted successfully',
      });
      // Redirect to quotes management after successful submission
      if (onSave) {
        onSave('redirect-to-management');
      }
    },
  });

  // This is now handled by the earlier useEffect that includes line items

  // Line items are now loaded with the quote data in the useEffect above

  // Map a customer record (companies or business_records shape, camel or snake) to
  // the quote billing address. Reads billing_* first, then plain address fields.
  const mapBillingAddress = (company: any) => ({
    street:
      company.billing_address ||
      company.billingAddressLine1 ||
      company.billing_address_line1 ||
      company.addressLine1 ||
      company.address_line1 ||
      company.address ||
      '',
    city: company.billing_city || company.billingCity || company.city || '',
    state: company.billing_state || company.billingState || company.state || '',
    zipCode:
      company.billing_zip ||
      company.billingPostalCode ||
      company.billing_postal_code ||
      company.postalCode ||
      company.postal_code ||
      company.zipCode ||
      '',
    country: company.country || 'US',
  });

  const handleCompanySelect = (company: any) => {
    setSelectedCompany(company);
    form.setValue('businessRecordId', company.id);
    if (!form.getValues('title')) {
      form.setValue(
        'title',
        `Quote for ${company.companyName || company.business_name || ''}`.trim(),
      );
    }
    form.setValue('billingAddress', mapBillingAddress(company));
  };

  const handleContactSelect = (contact: any) => {
    setSelectedContact(contact);
    form.setValue('contactId', contact?.id || '');
  };

  const handleAddLineItem = (newItem: Omit<LineItem, 'lineNumber'>) => {
    const lineNumber = Math.max(0, ...lineItems.map((item) => item.lineNumber)) + 1;
    setLineItems([...lineItems, { ...newItem, lineNumber }]);
  };

  const handleUpdateLineItem = (index: number, updatedItem: LineItem) => {
    const updated = [...lineItems];
    updated[index] = updatedItem;
    setLineItems(updated);
  };

  const handleDeleteLineItem = (index: number) => {
    const itemToDelete = lineItems[index];
    const filtered = lineItems.filter((_, i) => {
      // Remove the item and any sublines
      if (i === index) return false;
      if (itemToDelete.id && lineItems[i].parentLineId === itemToDelete.id) return false;
      return true;
    });
    setLineItems(filtered);
  };

  const handleDiscountChange = (discountAmt: number, discountPct: number) => {
    setDiscountAmount(discountAmt);
    setDiscountPercentage(discountPct);
    form.setValue('discountAmount', discountAmt.toString());
    form.setValue('discountPercentage', discountPct.toString());
  };

  const handleTaxChange = (taxAmt: number) => {
    setTaxAmount(taxAmt);
    form.setValue('taxAmount', taxAmt.toString());
  };

  // Update form totals when line items, discount, or tax change
  useEffect(() => {
    const subtotalAmount = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalAmount = subtotalAmount - discountAmount + taxAmount;

    form.setValue('subtotal', subtotalAmount.toString());
    form.setValue('totalAmount', totalAmount.toString());
  }, [lineItems, discountAmount, taxAmount, form]);

  const onSubmit = (data: QuoteFormData) => {
    if (lineItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one line item',
        variant: 'destructive',
      });
      return;
    }

    saveQuoteMutation.mutate({ quote: data, lineItems });
  };

  const handleSubmitQuote = async () => {
    const formData = form.getValues();
    if (lineItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one line item',
        variant: 'destructive',
      });
      return;
    }

    try {
      // First save the quote
      const savedQuote = await saveQuoteMutation.mutateAsync({
        quote: formData,
        lineItems,
      });

      // Then submit it
      await submitQuoteMutation.mutateAsync(savedQuote.id);
    } catch (error) {
      // Error handling is done in the mutations
    }
  };

  const handleCreateProposal = async () => {
    const formData = form.getValues();
    if (lineItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one line item before creating a proposal',
        variant: 'destructive',
      });
      return;
    }

    try {
      // First save the quote if needed
      let quoteId = initialQuoteId;
      if (!quoteId) {
        const savedQuote = await saveQuoteMutation.mutateAsync({
          quote: formData,
          lineItems,
        });
        quoteId = savedQuote.id;
      }

      // Navigate to proposal builder with quote data
      if (onCreateProposal && quoteId) {
        onCreateProposal(quoteId);
      }
    } catch (error) {
      console.error('Error creating proposal:', error);
      toast({
        title: 'Error',
        description: 'Failed to create proposal. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const totals = {
    subtotal: lineItems.reduce((sum, item) => sum + item.totalPrice, 0),
    total: lineItems.reduce((sum, item) => sum + item.totalPrice, 0) - discountAmount + taxAmount,
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

  // ─── Wizard navigation + step gating ──────────────────────────────────────
  const businessRecordId = form.watch('businessRecordId');
  const stepValid = (step: number): boolean => {
    if (step === 0) return !!businessRecordId;
    if (step === 1) return lineItems.length > 0;
    return true;
  };
  const stepBlockedMessage = (step: number): string =>
    step === 0 ? 'Select a customer to continue' : 'Add at least one line item to continue';

  const goToStep = (step: number) => {
    // Allow jumping backwards freely; forward only if all prior steps are valid.
    if (step <= currentStep) {
      setCurrentStep(step);
      return;
    }
    for (let s = currentStep; s < step; s++) {
      if (!stepValid(s)) {
        toast({ title: 'Incomplete', description: stepBlockedMessage(s), variant: 'destructive' });
        return;
      }
    }
    setCurrentStep(step);
  };
  const handleNext = () => {
    if (!stepValid(currentStep)) {
      toast({
        title: 'Incomplete',
        description: stepBlockedMessage(currentStep),
        variant: 'destructive',
      });
      return;
    }
    setCurrentStep((s) => Math.min(DEFAULT_QUOTE_STEPS.length - 1, s + 1));
  };
  const handleBack = () => setCurrentStep((s) => Math.max(0, s - 1));

  if (quoteLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const customerName =
    selectedCompany?.companyName || selectedCompany?.business_name || selectedCompany?.company_name;

  return (
    <div className="space-y-4 sm:space-y-6 touch-manipulation">
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-0">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Calculator className="h-5 w-5" />
            {initialQuoteId ? 'Edit Quote' : 'New Quote'}
          </CardTitle>
          <CardDescription className="text-sm">
            {DEFAULT_QUOTE_STEPS[currentStep]?.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <QuoteWizardProgress
            steps={DEFAULT_QUOTE_STEPS}
            currentStep={currentStep}
            onStepClick={goToStep}
          />
        </CardContent>
      </Card>

      {/* ── Step 0: Customer & setup ───────────────────────────────────────── */}
      {currentStep === 0 && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <Form {...form}>
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Quote Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Equipment Quote - Company Name"
                            className="min-h-[44px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pricingType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Pricing Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="min-h-[44px]">
                              <SelectValue placeholder="Select pricing type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new">New Customer Pricing</SelectItem>
                            <SelectItem value="upgrade">Upgrade Pricing</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <CompanyContactSelector
                  selectedCompany={selectedCompany}
                  selectedContact={selectedContact}
                  onCompanySelect={handleCompanySelect}
                  onContactSelect={handleContactSelect}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Valid Until</FormLabel>
                        <FormControl>
                          <Input type="date" className="min-h-[44px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* ── Step 1: Products ───────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <LineItemManager
          lineItems={lineItems}
          pricingType={form.watch('pricingType')}
          onAddItem={handleAddLineItem}
          onUpdateItem={handleUpdateLineItem}
          onDeleteItem={handleDeleteLineItem}
        />
      )}

      {/* ── Step 2: Pricing & notes ────────────────────────────────────────── */}
      {currentStep === 2 && (
        <>
          <PricingCalculator
            lineItems={lineItems}
            subtotal={totals.subtotal}
            total={totals.total}
            initialDiscountAmount={discountAmount}
            initialDiscountPercentage={discountPercentage}
            initialTaxAmount={taxAmount}
            onDiscountChange={handleDiscountChange}
            onTaxChange={handleTaxChange}
          />
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <Form {...form}>
                <FormField
                  control={form.control}
                  name="customerNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Customer Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Notes visible to customer..."
                          className="min-h-[44px] resize-y"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="internalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Internal notes (not visible to customer)..."
                          className="min-h-[44px] resize-y"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Form>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Step 3: Review & process ───────────────────────────────────────── */}
      {currentStep === 3 && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg">Review</CardTitle>
            <CardDescription className="text-sm">
              Confirm the details, then save, submit, or convert to a proposal.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground">Customer</span>
                <div className="font-medium">{customerName || 'Not selected'}</div>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground">Contact</span>
                <div className="font-medium">
                  {selectedContact
                    ? `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() ||
                      '—'
                    : '—'}
                </div>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground">Line items</span>
                <div className="font-medium">{lineItems.length}</div>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground">Title</span>
                <div className="font-medium">{form.watch('title') || '—'}</div>
              </div>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Wizard navigation + actions ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-2 sticky bottom-0 bg-background p-4 sm:p-0 border-t sm:border-0 -mx-4 sm:mx-0">
        <div className="flex gap-2 order-2 sm:order-1">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} className="flex-1 sm:flex-none min-h-[44px]">
              Cancel
            </Button>
          )}
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1 sm:flex-none min-h-[44px] active:scale-[0.98] transition-transform"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 order-1 sm:order-2">
          {currentStep < DEFAULT_QUOTE_STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              className="min-h-[44px] active:scale-[0.98] transition-transform"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={form.handleSubmit(onSubmit)}
                disabled={saveQuoteMutation.isPending}
                className="min-h-[44px] active:scale-[0.98] transition-transform"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveQuoteMutation.isPending ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button
                onClick={handleSubmitQuote}
                disabled={saveQuoteMutation.isPending || submitQuoteMutation.isPending}
                className="min-h-[44px] active:scale-[0.98] transition-transform"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitQuoteMutation.isPending ? 'Submitting...' : 'Submit Quote'}
              </Button>
              {onCreateProposal && (
                <Button
                  onClick={handleCreateProposal}
                  disabled={saveQuoteMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 min-h-[44px] active:scale-[0.98] transition-transform"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Create Proposal</span>
                  <span className="sm:hidden">Proposal</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
