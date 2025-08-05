import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Edit, Send, Eye, FileText, Building2, User, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
// Using a simple div container since MainLayout doesn't exist

interface Quote {
  id: string;
  proposalNumber: string;
  title: string;
  businessRecordId: string;
  contactId: string;
  status: string;
  subtotal: string;
  totalAmount: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  assignedTo: string;
  description?: string;
  customerNotes?: string;
  internalNotes?: string;
  lineItems?: LineItem[];
}

interface LineItem {
  id: string;
  lineNumber: number;
  itemType: string;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

export default function QuoteView() {
  const [match, params] = useRoute('/quotes/:quoteId/view');
  const [, setLocation] = useLocation();
  const quoteId = params?.quoteId;

  // Fetch quote details
  const { data: quote, isLoading: quoteLoading } = useQuery<Quote>({
    queryKey: [`/api/proposals/${quoteId}`],
    enabled: !!quoteId,
    queryFn: async () => {
      return await apiRequest(`/api/proposals/${quoteId}`, 'GET');
    },
  });

  // Line items come from the quote response
  const lineItems = quote?.lineItems || [];

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num || 0);
  };

  const statusConfig = {
    draft: { label: 'Draft', variant: 'secondary' as const, color: 'text-gray-600' },
    sent: { label: 'Sent', variant: 'default' as const, color: 'text-blue-600' },
    accepted: { label: 'Accepted', variant: 'default' as const, color: 'text-green-600' },
    closed_lost: { label: 'Closed Lost', variant: 'destructive' as const, color: 'text-red-600' },
  };

  if (quoteLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold">Quote not found</h2>
          <Button onClick={() => setLocation('/quotes')} className="mt-4">
            Back to Quotes
          </Button>
        </div>
      </div>
    );
  }

  const status = statusConfig[quote.status as keyof typeof statusConfig] || statusConfig.draft;

  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/quotes')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotes
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{quote.title}</h1>
              <p className="text-muted-foreground">Quote #{quote.proposalNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Button onClick={() => setLocation(`/quotes/${quote.id}`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Quote
            </Button>
          </div>
        </div>

        {/* Quote Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quote Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valid Until</p>
                <p>{quote.validUntil ? format(new Date(quote.validUntil), 'PPP') : 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p>{format(new Date(quote.createdAt), 'PPP')}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Business Record ID</p>
                <p>{quote.businessRecordId}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contact ID</p>
                <p>{quote.contactId}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subtotal</p>
                <p className="text-lg font-semibold">{formatCurrency(quote.subtotal)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(quote.totalAmount)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
            <CardDescription>Products and services included in this quote</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lineItems.map((item, index) => (
                <div key={item.id || index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold">{item.productName}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span>Qty: {item.quantity}</span>
                        <span>Unit Price: {formatCurrency(item.unitPrice)}</span>
                        <Badge variant="outline">{item.itemType}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.totalPrice)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {lineItems.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No line items found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {(quote.description || quote.customerNotes || quote.internalNotes) && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {quote.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                  <p>{quote.description}</p>
                </div>
              )}
              {quote.customerNotes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Customer Notes</p>
                  <p>{quote.customerNotes}</p>
                </div>
              )}
              {quote.internalNotes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Internal Notes</p>
                  <p>{quote.internalNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}