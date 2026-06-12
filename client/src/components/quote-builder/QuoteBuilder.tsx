import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
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
  Download,
  Mail,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { usePricingVisibility } from '@/hooks/usePricingVisibility';
import { effectiveDiscountPct, sumLineDiscounts } from '@shared/quote-math';
import { downloadQuotePdf, emailQuote } from '@/lib/quote-pdf';
import CompanyContactSelector from './CompanyContactSelector';
import LineItemManager from './LineItemManager';
import PricingCalculator from './PricingCalculator';
import { QuoteWizardProgress, DEFAULT_QUOTE_STEPS } from '@/components/quotes/QuoteWizardProgress';
import GenerateProposalDialog from '@/components/proposal-builder/GenerateProposalDialog';

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
  // QUOTE-016: justification, required (enforced at save/submit) when any
  // discount — quote-level or per-line — is set.
  discountReason: z.string().optional(),
  discountReasonNote: z.string().optional(),
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
  // QUOTE-016: dollar amount off the whole line; totalPrice is net of it.
  discount?: number;
  notes?: string;
}

interface QuoteBuilderProps {
  initialQuoteId?: string;
  onSave?: (quoteId: string) => void;
  onCancel?: () => void;
  onCreateProposal?: (quoteId: string) => void;
}

// Build the draft proposal payload from form + line items. Shared by the manual
// Save Draft mutation and the QUOTE-018 autosave so they stay in sync.
function buildQuoteData(quote: QuoteFormData, lineItems: LineItem[]) {
  const subtotalAmount = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmt = parseFloat(quote.discountAmount || '0');
  const taxAmt = parseFloat(quote.taxAmount || '0');
  const totalAmount = subtotalAmount - discountAmt + taxAmt;

  return {
    ...quote,
    proposalType: 'quote',
    status: 'draft',
    lineItems: lineItems.map((item, index) => ({
      lineNumber: index + 1,
      itemType: item.productType || 'equipment',
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      description: item.description || item.productName,
      quantity: item.quantity,
      unitCost: item.unitCost ?? 0,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      discount: item.discount ?? 0,
      margin: item.margin,
      notes: item.notes,
    })),
    subtotal: subtotalAmount.toString(),
    discountAmount: discountAmt.toString(),
    discountPercentage: quote.discountPercentage || '0',
    discountReason: quote.discountReason || null,
    discountReasonNote: quote.discountReasonNote || null,
    taxAmount: taxAmt.toString(),
    totalAmount: totalAmount.toString(),
  };
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
  const [savedQuoteId, setSavedQuoteId] = useState<string | undefined>(
    initialQuoteId && initialQuoteId !== 'new' ? initialQuoteId : undefined,
  );
  const [emailing, setEmailing] = useState(false);
  const [generateProposalOpen, setGenerateProposalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // QUOTE-018: autosave state. Only drafts autosave; non-draft quotes (sent/accepted)
  // are never auto-mutated. `hydratedRef` gates autosave until after the initial
  // server load (or draft creation), so loading never triggers a clobbering save.
  const [isDraft, setIsDraft] = useState(true);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const hydratedRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const dirtyAgainRef = useRef(false);
  const creatingDraftRef = useRef(false);

  // Pricing policy + role (QUOTE-006). Managers (can see dealer cost) may override.
  const { data: pricingVisibility } = usePricingVisibility();
  const minMargin = pricingVisibility?.minMarginPercentage;
  const maxDiscount = pricingVisibility?.maxDiscountPercentage;
  const isManager = pricingVisibility?.showDealerCost === true;

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
      discountReason: '',
      discountReasonNote: '',
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

  // Populate form when existing quote is loaded.
  // QUOTE-018: hydrate exactly once — re-fetches (e.g. after the autosave-created
  // draft updates the URL) must never clobber in-progress local edits.
  useEffect(() => {
    if (existingQuote && !quoteLoading && !hydratedRef.current) {
      hydratedRef.current = true;
      console.log('📝 Populating form with existing quote:', existingQuote);

      // Only drafts autosave; preserve sent/accepted quotes as-is.
      const loadedStatus = existingQuote.status || 'draft';
      setIsDraft(loadedStatus === 'draft');

      // GET /proposals/:id returns snake_case (edge fn). Read both shapes.
      const businessRecordId =
        existingQuote.businessRecordId || existingQuote.business_record_id || '';
      const contactId = existingQuote.contactId || existingQuote.contact_id || '';
      const validUntil = existingQuote.validUntil || existingQuote.valid_until || '';
      const discountAmt = existingQuote.discountAmount ?? existingQuote.discount_amount ?? '0';
      const discountPct =
        existingQuote.discountPercentage ?? existingQuote.discount_percentage ?? '0';
      const loadedDiscountReason =
        existingQuote.discountReason ?? existingQuote.discount_reason ?? '';
      const loadedDiscountReasonNote =
        existingQuote.discountReasonNote ?? existingQuote.discount_reason_note ?? '';
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
        discountReason: String(loadedDiscountReason || ''),
        discountReasonNote: String(loadedDiscountReasonNote || ''),
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
          discount: parseFloat(item.discount || '0') || 0,
          notes: item.notes || '',
        }));
        setLineItems(transformedLineItems);
        console.log('📦 Set line items:', transformedLineItems);
      }

      // QUOTE-018: resume on the furthest valid step. A loaded quote always has a
      // customer; if it has line items, jump to Review so the user sees the whole
      // quote on reload.
      const hasLineItems = !!(existingQuote.lineItems && existingQuote.lineItems.length > 0);
      setCurrentStep(hasLineItems ? 3 : businessRecordId ? 1 : 0);
    }
  }, [existingQuote, quoteLoading, businessRecords, form]);

  // Create or update quote mutation
  const saveQuoteMutation = useMutation({
    mutationFn: async (data: { quote: QuoteFormData; lineItems: LineItem[] }) => {
      const quoteData = buildQuoteData(data.quote, data.lineItems);
      console.log('📤 Submitting quote:', quoteData);

      // Prefer an existing persisted id (route or autosave-created draft).
      const existingId = initialQuoteId && initialQuoteId !== 'new' ? initialQuoteId : savedQuoteId;
      if (existingId) {
        return await apiRequest(`/api/proposals/${existingId}`, 'PATCH', quoteData);
      }
      return await apiRequest('/api/proposals', 'POST', quoteData);
    },
    onSuccess: (data) => {
      // Force clear all related cache
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      queryClient.removeQueries({ queryKey: ['/api/proposals'] });
      if (data?.id) setSavedQuoteId(data.id);
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
        approved: isManager, // managers bypass the below-margin gate
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

  // QUOTE-016: discount justification, owned by the form so it persists with
  // the quote. Returns the validation error message (or null) — a reason is
  // required whenever ANY discount (per-line or quote-level) is set, and the
  // free-text note is required when the reason is 'other'.
  const handleDiscountReasonChange = (reason: string, note: string) => {
    form.setValue('discountReason', reason);
    form.setValue('discountReasonNote', note);
  };

  const discountReasonError = (): string | null => {
    const anyDiscount = sumLineDiscounts(lineItems) > 0 || discountAmount > 0;
    if (!anyDiscount) return null;
    const reason = form.getValues('discountReason');
    if (!reason) return 'Select a discount reason — every discount needs a recorded justification.';
    if (reason === 'other' && !(form.getValues('discountReasonNote') || '').trim()) {
      return "Add a note explaining the discount — required when the reason is 'Other'.";
    }
    return null;
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

    // QUOTE-016: discounts must carry a reason, even on drafts saved manually.
    // (Background autosave still persists work-in-progress without blocking.)
    const reasonError = discountReasonError();
    if (reasonError) {
      toast({
        title: 'Discount reason required',
        description: reasonError,
        variant: 'destructive',
      });
      setCurrentStep(2);
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

    // QUOTE-016: discounts must carry a reason before the quote can be sent.
    const reasonError = discountReasonError();
    if (reasonError) {
      toast({
        title: 'Discount reason required',
        description: reasonError,
        variant: 'destructive',
      });
      setCurrentStep(2);
      return;
    }

    // QUOTE-006/016: enforce pricing policy on send. Managers may override.
    // Margin uses the discounted subtotal (line totals are net of per-line
    // discounts); the max-discount check evaluates the EFFECTIVE discount —
    // per-line plus quote-level, relative to the gross subtotal.
    const totalCost = lineItems.reduce((sum, i) => sum + (i.unitCost || 0) * i.quantity, 0);
    const revenue = totals.subtotal - discountAmount;
    const overallMargin = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0;
    const effectiveDiscount = effectiveDiscountPct(lineItems, Math.max(0, discountAmount));
    const belowMinMargin =
      totalCost > 0 && minMargin != null && minMargin > 0 && overallMargin < minMargin;
    const overMaxDiscount =
      maxDiscount != null && maxDiscount > 0 && effectiveDiscount > maxDiscount;
    if ((belowMinMargin || overMaxDiscount) && !isManager) {
      toast({
        title: 'Manager approval required',
        description: belowMinMargin
          ? `Margin ${overallMargin.toFixed(1)}% is below the ${minMargin}% minimum. Save as draft and request manager approval.`
          : `Effective discount ${effectiveDiscount.toFixed(1)}% (including line discounts) exceeds the ${maxDiscount}% maximum. Save as draft and request manager approval.`,
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

  // ─── QUOTE-018: draft autosave ────────────────────────────────────────────
  // Keep the latest line items in a ref so a serialized re-run saves current state.
  const latestLineItemsRef = useRef<LineItem[]>(lineItems);
  latestLineItemsRef.current = lineItems;

  // Serialized autosave (never overlaps; last-write-wins). Drafts only.
  const doAutosave = async () => {
    if (!savedQuoteId || !isDraft) return;
    if (savingRef.current) {
      dirtyAgainRef.current = true; // a change landed mid-save — re-run after.
      return;
    }
    savingRef.current = true;
    setAutosaveState('saving');
    try {
      await apiRequest(
        `/api/proposals/${savedQuoteId}`,
        'PATCH',
        buildQuoteData(form.getValues(), latestLineItemsRef.current),
      );
      setAutosaveState('saved');
    } catch (err) {
      setAutosaveState('error');
      toast({
        title: 'Autosave failed',
        description: 'Your changes are kept locally and will retry on the next edit.',
        variant: 'destructive',
      });
    } finally {
      savingRef.current = false;
      if (dirtyAgainRef.current) {
        dirtyAgainRef.current = false;
        void doAutosave();
      }
    }
  };

  // Create the draft on the server the moment a customer is chosen, so a refresh /
  // back-button resumes it. Updates the URL to the edit route (no remount).
  const ensureDraft = async (): Promise<string | undefined> => {
    if (savedQuoteId || creatingDraftRef.current) return savedQuoteId;
    creatingDraftRef.current = true;
    try {
      const created = await apiRequest(
        '/api/proposals',
        'POST',
        buildQuoteData(form.getValues(), lineItems),
      );
      if (created?.id) {
        hydratedRef.current = true; // local state is authoritative; don't re-hydrate
        setSavedQuoteId(created.id);
        setIsDraft(true);
        setAutosaveState('saved');
        navigate(`/quotes/${created.id}`, { replace: true });
        return created.id;
      }
    } catch (err) {
      toast({
        title: 'Could not start draft',
        description: 'Your work is kept locally; saving will retry as you edit.',
        variant: 'destructive',
      });
    } finally {
      creatingDraftRef.current = false;
    }
    return undefined;
  };

  // Debounced trigger: any change to line items / pricing / form fields schedules a
  // save ~3s later. Gated until hydrated (load) or a draft exists (create).
  const watchedSig = JSON.stringify(form.watch());
  useEffect(() => {
    if (!savedQuoteId || !isDraft || !hydratedRef.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => void doAutosave(), 3000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedQuoteId, isDraft, lineItems, discountAmount, discountPercentage, taxAmount, watchedSig]);

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
    // QUOTE-018: persist a draft as soon as the customer step is complete, so a
    // refresh / back-button resumes the quote. Fire-and-forget; advance immediately.
    if (currentStep === 0) void ensureDraft();
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

  // Manager-quote figures (QUOTE-007) — only surfaced to managers.
  const managerTotalCost = lineItems.reduce((s, i) => s + (i.unitCost || 0) * i.quantity, 0);
  const managerRevenue = totals.subtotal - discountAmount;
  const managerGrossProfit = managerRevenue - managerTotalCost;
  const managerMargin = managerRevenue > 0 ? (managerGrossProfit / managerRevenue) * 100 : 0;

  const requireSaved = (): string | null => {
    if (!savedQuoteId) {
      toast({ title: 'Save first', description: 'Save the quote to use this action.' });
      return null;
    }
    return savedQuoteId;
  };

  const handleManagerPdf = async () => {
    const id = requireSaved();
    if (!id) return;
    try {
      await downloadQuotePdf(id, undefined, { manager: true });
    } catch (err: any) {
      toast({
        title: 'Export failed',
        description: err?.message || 'Could not export the manager PDF.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadCustomerPdf = async () => {
    const id = requireSaved();
    if (!id) return;
    try {
      await downloadQuotePdf(id, undefined);
    } catch (err: any) {
      toast({
        title: 'Download failed',
        description: err?.message || 'Could not download the PDF.',
        variant: 'destructive',
      });
    }
  };

  const handleEmailQuote = async () => {
    const id = requireSaved();
    if (!id) return;
    setEmailing(true);
    try {
      const r = await emailQuote(id, { to: selectedContact?.email });
      toast({
        title: r.simulated ? 'Email simulated' : 'Email sent',
        description: `Quote sent to ${r.to}${r.simulated ? ' (no email provider configured)' : ''}`,
      });
    } catch (err: any) {
      toast({
        title: 'Email failed',
        description: err?.message || 'Could not email the quote.',
        variant: 'destructive',
      });
    } finally {
      setEmailing(false);
    }
  };

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
          {/* QUOTE-018: autosave status */}
          {savedQuoteId && isDraft && (
            <div className="mt-2 text-xs text-right text-muted-foreground" aria-live="polite">
              {autosaveState === 'saving'
                ? 'Saving…'
                : autosaveState === 'saved'
                  ? 'Draft saved'
                  : autosaveState === 'error'
                    ? 'Save failed — will retry'
                    : 'Draft'}
            </div>
          )}
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
            minMarginPercentage={minMargin}
            maxDiscountPercentage={maxDiscount}
            discountReason={form.watch('discountReason') || ''}
            discountReasonNote={form.watch('discountReasonNote') || ''}
            onDiscountReasonChange={handleDiscountReasonChange}
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
              {sumLineDiscounts(lineItems) > 0 && (
                <div className="flex justify-between text-xs text-red-600">
                  <span>Line discounts (included in subtotal)</span>
                  <span>-{formatCurrency(sumLineDiscounts(lineItems))}</span>
                </div>
              )}
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
              {(sumLineDiscounts(lineItems) > 0 || discountAmount > 0) &&
                form.watch('discountReason') && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Discount reason</span>
                    <span>
                      {form.watch('discountReason')?.replace(/_/g, ' ')}
                      {form.watch('discountReasonNote')
                        ? ` — ${form.watch('discountReasonNote')}`
                        : ''}
                    </span>
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

            {/* Manager Quote — hard costs + profit (managers/admins only) */}
            {isManager && (
              <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-amber-900">Manager Quote — internal</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleManagerPdf}
                    className="min-h-[36px] border-amber-400"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Download Manager PDF
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs text-amber-800">Total Cost</div>
                    <div className="font-semibold text-red-700">
                      {formatCurrency(managerTotalCost)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-amber-800">Gross Profit</div>
                    <div className="font-semibold text-green-700">
                      {formatCurrency(managerGrossProfit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-amber-800">Margin</div>
                    <div
                      className={`font-semibold ${managerMargin >= 20 ? 'text-green-700' : managerMargin >= 10 ? 'text-yellow-700' : 'text-red-700'}`}
                    >
                      {managerMargin.toFixed(1)}%
                    </div>
                  </div>
                </div>
                {managerTotalCost === 0 && (
                  <div className="text-xs text-amber-700">
                    No dealer cost on these items — margin cannot be computed. Add cost in the
                    product catalog.
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-amber-800 border-b border-amber-200">
                        <th className="py-1 pr-2">Item</th>
                        <th className="py-1 px-2 text-right">Qty</th>
                        <th className="py-1 px-2 text-right">Cost</th>
                        <th className="py-1 px-2 text-right">Price</th>
                        <th className="py-1 pl-2 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, idx) => {
                        const cost = item.unitCost || 0;
                        // Margin on the line's net revenue (after per-line discount).
                        const lineRevenue = item.totalPrice;
                        const lineMargin =
                          lineRevenue > 0
                            ? ((lineRevenue - cost * item.quantity) / lineRevenue) * 100
                            : 0;
                        return (
                          <tr key={item.id || idx} className="border-b border-amber-100">
                            <td className="py-1 pr-2">{item.productName}</td>
                            <td className="py-1 px-2 text-right">{item.quantity}</td>
                            <td className="py-1 px-2 text-right">{formatCurrency(cost)}</td>
                            <td className="py-1 px-2 text-right">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="py-1 pl-2 text-right">{lineMargin.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Process actions: download / email the customer-facing quote */}
            <div className="border-t pt-4">
              <div className="text-sm font-medium mb-2">Process quote</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCustomerPdf}
                  className="min-h-[40px]"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEmailQuote}
                  disabled={emailing}
                  className="min-h-[40px]"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {emailing ? 'Sending...' : 'Email to Customer'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGenerateProposalOpen(true)}
                  disabled={!savedQuoteId}
                  className="min-h-[40px]"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Proposal
                </Button>
              </div>
              {!savedQuoteId && (
                <p className="text-xs text-muted-foreground mt-2">
                  Save the quote first to download, email, or generate a proposal.
                </p>
              )}
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
      <GenerateProposalDialog
        quoteId={savedQuoteId ?? null}
        open={generateProposalOpen}
        onOpenChange={setGenerateProposalOpen}
      />
    </div>
  );
}
