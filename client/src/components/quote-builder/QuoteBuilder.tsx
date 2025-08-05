import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
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
  Building2,
  User,
  Plus,
  Trash2,
  Calculator,
  Save,
  Send,
  MapPin,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import CompanyContactSelector from './CompanyContactSelector';
import ProductTypeSelector from './ProductTypeSelector';
import LineItemManager from './LineItemManager';
import PricingCalculator from './PricingCalculator';

// Quote form schema
const quoteSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  businessRecordId: z.string().min(1, 'Company is required'),
  contactId: z.string().optional(),
  billingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  pricingType: z.enum(['new', 'upgrade']).default('new'),
  validUntil: z.string().optional(),
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),
});

type QuoteFormData = z.infer<typeof quoteSchema>;

interface LineItem {
  id?: string;
  lineNumber: number;
  parentLineId?: string;
  isSubline: boolean;
  productType: string;
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
}

export default function QuoteBuilder({ 
  initialQuoteId, 
  onSave, 
  onCancel 
}: QuoteBuilderProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
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
    },
  });

  // Load existing quote if editing
  const { data: existingQuote, isLoading: quoteLoading } = useQuery({
    queryKey: [`/api/proposals/${initialQuoteId}`],
    enabled: !!initialQuoteId && initialQuoteId !== 'new',
    queryFn: async () => {
      const response = await apiRequest(`/api/proposals/${initialQuoteId}`, 'GET');
      return response;
    },
  });

  // Load quote line items if editing
  const { data: existingLineItems = [] } = useQuery({
    queryKey: [`/api/proposals/${initialQuoteId}/line-items`],
    enabled: !!initialQuoteId && initialQuoteId !== 'new',
    queryFn: async () => {
      const response = await apiRequest(`/api/proposals/${initialQuoteId}/line-items`, 'GET');
      return response;
    },
  });

  // Create or update quote mutation
  const saveQuoteMutation = useMutation({
    mutationFn: async (data: { quote: QuoteFormData; lineItems: LineItem[] }) => {
      const subtotalAmount = data.lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const quoteData = {
        ...data.quote,
        proposalType: 'quote',
        status: 'draft',
        validUntil: data.quote.validUntil ? new Date(data.quote.validUntil) : undefined,
        lineItems: data.lineItems.map((item, index) => ({
          lineNumber: index + 1,
          productId: item.productId,
          productName: item.productName,
          description: item.description || item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          margin: item.margin,
          notes: item.notes,
        })),
        subtotal: subtotalAmount.toString(),
        totalAmount: subtotalAmount.toString(),
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
        status: 'sent' 
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

  // Load existing data if editing
  useEffect(() => {
    if (existingQuote) {
      form.reset({
        title: existingQuote.title,
        businessRecordId: existingQuote.businessRecordId,
        contactId: existingQuote.contactId || '',
        pricingType: 'new', // Default, could be enhanced to store this
        validUntil: existingQuote.validUntil ? new Date(existingQuote.validUntil).toISOString().split('T')[0] : '',
        customerNotes: existingQuote.customerFeedback || '',
        internalNotes: existingQuote.internalNotes || '',
      });
    }
  }, [existingQuote, form]);

  useEffect(() => {
    if (existingLineItems.length > 0) {
      const formattedItems: LineItem[] = existingLineItems.map((item: any, index: number) => ({
        id: item.id,
        lineNumber: item.lineNumber || index + 1,
        parentLineId: item.parentLineId,
        isSubline: !!item.parentLineId,
        productType: item.itemType || 'equipment',
        productId: item.productId || '',
        productCode: item.productCode || '',
        productName: item.productName,
        description: item.description,
        quantity: item.quantity,
        msrp: parseFloat(item.unitCost || '0'),
        listPrice: parseFloat(item.unitPrice || '0'),
        unitPrice: parseFloat(item.unitPrice || '0'),
        totalPrice: parseFloat(item.totalPrice || '0'),
        unitCost: parseFloat(item.unitCost || '0'),
        margin: parseFloat(item.margin || '0'),
        notes: item.notes,
      }));
      setLineItems(formattedItems);
    }
  }, [existingLineItems]);

  const handleCompanySelect = (company: any) => {
    setSelectedCompany(company);
    form.setValue('businessRecordId', company.id);
    
    // Auto-populate billing address if available
    if (company.address) {
      form.setValue('billingAddress', {
        street: company.address,
        city: company.city,
        state: company.state,
        zipCode: company.zipCode,
        country: 'US',
      });
    }
  };

  const handleContactSelect = (contact: any) => {
    setSelectedContact(contact);
    form.setValue('contactId', contact?.id || '');
  };

  const handleAddLineItem = (newItem: Omit<LineItem, 'lineNumber'>) => {
    const lineNumber = Math.max(0, ...lineItems.map(item => item.lineNumber)) + 1;
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
        lineItems 
      });
      
      // Then submit it
      await submitQuoteMutation.mutateAsync(savedQuote.id);
    } catch (error) {
      // Error handling is done in the mutations
    }
  };

  const totals = {
    subtotal: lineItems.reduce((sum, item) => sum + item.totalPrice, 0),
    total: lineItems.reduce((sum, item) => sum + item.totalPrice, 0),
  };

  if (quoteLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {initialQuoteId ? 'Edit Quote' : 'New Quote Builder'}
          </CardTitle>
          <CardDescription>
            Build a comprehensive quote with line-by-line product selection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Quote Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quote Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Equipment Quote - Company Name" {...field} />
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
                      <FormLabel>Pricing Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
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

              {/* Company and Contact Selection */}
              <CompanyContactSelector
                selectedCompany={selectedCompany}
                selectedContact={selectedContact}
                onCompanySelect={handleCompanySelect}
                onContactSelect={handleContactSelect}
              />

              {/* Valid Until Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid Until</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Line Items Management */}
      <LineItemManager
        lineItems={lineItems}
        pricingType={form.watch('pricingType')}
        onAddItem={handleAddLineItem}
        onUpdateItem={handleUpdateLineItem}
        onDeleteItem={handleDeleteLineItem}
      />

      {/* Pricing Calculator */}
      <PricingCalculator
        lineItems={lineItems}
        subtotal={totals.subtotal}
        total={totals.total}
      />

      {/* Notes Section */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <FormField
              control={form.control}
              name="customerNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Notes visible to customer..."
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
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Internal notes (not visible to customer)..."
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

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={form.handleSubmit(onSubmit)}
            disabled={saveQuoteMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveQuoteMutation.isPending ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button
            onClick={handleSubmitQuote}
            disabled={saveQuoteMutation.isPending || submitQuoteMutation.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            {submitQuoteMutation.isPending ? 'Submitting...' : 'Submit Quote'}
          </Button>
        </div>
      </div>
    </div>
  );
}