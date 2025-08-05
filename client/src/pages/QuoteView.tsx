import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Edit, Send, Eye, FileText, Building2, User, Calendar, DollarSign, Download, Percent, TrendingUp, Phone, Mail, MapPin, Hash, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import MainLayout from '@/components/layout/main-layout';

interface Quote {
  id: string;
  proposalNumber: string;
  title: string;
  businessRecordId: string;
  contactId: string;
  status: string;
  subtotal: string;
  discountAmount?: string;
  discountPercentage?: string;
  taxAmount?: string;
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

interface Company {
  id: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  recordType: 'lead' | 'customer';
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
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

  // Fetch company details
  const { data: company } = useQuery<Company>({
    queryKey: [`/api/business-records/${quote?.businessRecordId}`],
    enabled: !!quote?.businessRecordId,
    queryFn: async () => {
      const response = await apiRequest(`/api/business-records`, 'GET');
      return response.find((record: Company) => record.id === quote?.businessRecordId);
    },
  });

  // Fetch contact details
  const { data: contact } = useQuery<Contact>({
    queryKey: [`/api/business-records/${quote?.businessRecordId}/contacts/${quote?.contactId}`],
    enabled: !!quote?.businessRecordId && !!quote?.contactId,
    queryFn: async () => {
      const response = await apiRequest(`/api/business-records/${quote?.businessRecordId}/contacts`, 'GET');
      return response.find((c: Contact) => c.id === quote?.contactId);
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

  const formatPercentage = (percentage: string | number) => {
    const num = typeof percentage === 'string' ? parseFloat(percentage) : percentage;
    return `${Math.abs(num || 0)}%`;
  };

  const getCompanyDisplayName = (company: Company) => {
    if (company.companyName) {
      return company.companyName;
    }
    return `${company.firstName || ''} ${company.lastName || ''}`.trim() || 'Unknown Company';
  };

  const getContactDisplayName = (contact: Contact) => {
    return `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown Contact';
  };

  const statusConfig = {
    draft: { label: 'Draft', variant: 'secondary' as const, color: 'text-gray-600' },
    sent: { label: 'Sent', variant: 'default' as const, color: 'text-blue-600' },
    accepted: { label: 'Accepted', variant: 'default' as const, color: 'text-green-600' },
    closed_lost: { label: 'Closed Lost', variant: 'destructive' as const, color: 'text-red-600' },
  };

  if (quoteLoading) {
    return (
      <MainLayout title="Loading Quote...">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!quote) {
    return (
      <MainLayout title="Quote Not Found">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold">Quote not found</h2>
          <Button onClick={() => setLocation('/quotes')} className="mt-4">
            Back to Quotes
          </Button>
        </div>
      </MainLayout>
    );
  }

  const status = statusConfig[quote.status as keyof typeof statusConfig] || statusConfig.draft;

  // Calculate pricing details for client-facing display
  const rawSubtotalAmount = parseFloat(quote.subtotal || '0');
  const discountAmount = parseFloat(quote.discountAmount || '0');
  const discountPercentage = parseFloat(quote.discountPercentage || '0');
  const taxAmount = parseFloat(quote.taxAmount || '0');
  
  // Debug log to understand the data
  console.log('Debug pricing data:', {
    rawSubtotal: rawSubtotalAmount,
    discountAmount,
    discountPercentage,
    taxAmount
  });
  
  // Apply markup/discount to line items for client display
  // For markup: discountPercentage is negative (e.g., -10 means 10% markup)
  // For discount: discountPercentage is positive (e.g., 10 means 10% discount)
  // Multiplier should be: 1 - (discountPercentage / 100)
  // So -10% becomes 1 - (-10/100) = 1.1 (markup)
  // And +10% becomes 1 - (10/100) = 0.9 (discount)
  const adjustmentMultiplier = 1 - (discountPercentage / 100);
  
  console.log('Adjustment multiplier:', adjustmentMultiplier);
  
  // Adjust line items with markup/discount applied
  const adjustedLineItems = lineItems.map(item => {
    const adjustedUnitPrice = parseFloat(item.unitPrice) * adjustmentMultiplier;
    const adjustedTotalPrice = parseFloat(item.totalPrice) * adjustmentMultiplier;
    
    console.log(`Item ${item.productName}: ${item.unitPrice} * ${adjustmentMultiplier} = ${adjustedUnitPrice}`);
    
    return {
      ...item,
      adjustedUnitPrice,
      adjustedTotalPrice
    };
  });
  
  // Calculate totals with adjustments applied
  const adjustedSubtotal = adjustedLineItems.reduce((sum, item) => sum + item.adjustedTotalPrice, 0);
  const finalTotal = adjustedSubtotal + taxAmount;
  
  console.log('Final calculations:', {
    adjustedSubtotal,
    taxAmount,
    finalTotal
  });

  return (
    <MainLayout title={`Quote ${quote.proposalNumber}`} description={`View and manage quote for ${company ? getCompanyDisplayName(company) : 'customer'}`}>
      <div className="space-y-6">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/quotes')}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Quotes
              </Button>
              <div>
                <h1 className="text-3xl font-bold">{quote.title}</h1>
                <p className="text-blue-100">Quote #{quote.proposalNumber}</p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Created {format(new Date(quote.createdAt), 'MMM dd, yyyy')}
                  </span>
                  {quote.validUntil && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Valid until {format(new Date(quote.validUntil), 'MMM dd, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={status.variant} className="bg-white/20 text-white border-white/30">
                {status.label}
              </Badge>
              <Button 
                onClick={() => setLocation(`/quotes/${quote.id}`)}
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Quote
              </Button>
              <Button 
                variant="outline"
                className="text-white border-white/30 hover:bg-white/20"
              >
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Quote Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quote Information */}
          <Card className="bg-white shadow-sm border-0 ring-1 ring-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <FileText className="h-5 w-5 text-blue-600" />
                Quote Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <Badge variant={status.variant} className="mt-1">{status.label}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Valid Until</p>
                <p className="font-medium">{quote.validUntil ? format(new Date(quote.validUntil), 'PPP') : 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Created</p>
                <p className="font-medium">{format(new Date(quote.createdAt), 'PPP')}</p>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card className="bg-white shadow-sm border-0 ring-1 ring-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Building2 className="h-5 w-5 text-blue-600" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Company</p>
                <p className="font-semibold text-lg">{company ? getCompanyDisplayName(company) : 'Loading...'}</p>
                {company?.email && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                    <Mail className="h-3 w-3" />
                    {company.email}
                  </div>
                )}
                {company?.phone && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                    <Phone className="h-3 w-3" />
                    {company.phone}
                  </div>
                )}
              </div>
              {contact && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Primary Contact</p>
                  <p className="font-medium">{getContactDisplayName(contact)}</p>
                  {contact.title && (
                    <p className="text-sm text-gray-600">{contact.title}</p>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                      <Mail className="h-3 w-3" />
                      {contact.email}
                    </div>
                  )}
                </div>
              )}
              {company?.address && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Address</p>
                  <div className="flex items-start gap-1 text-sm text-gray-600">
                    <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <p>{company.address}</p>
                      {company.city && company.state && (
                        <p>{company.city}, {company.state} {company.zipCode}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Professional Line Items */}
        <Card className="bg-white shadow-sm border-0 ring-1 ring-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Hash className="h-5 w-5 text-blue-600" />
              Line Items
            </CardTitle>
            <CardDescription>Products and services included in this quote</CardDescription>
          </CardHeader>
          <CardContent>
            {lineItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Hash className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No line items found</p>
                <p className="text-sm">This quote doesn't contain any products or services yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {adjustedLineItems.map((item, index) => (
                  <div key={item.id || index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 text-lg">{item.productName}</h4>
                            <p className="text-gray-600 mt-1">{item.description}</p>
                            <div className="flex items-center gap-6 mt-3">
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-medium text-gray-500">Qty:</span>
                                <span className="text-sm font-semibold">{item.quantity}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-medium text-gray-500">Unit Price:</span>
                                <span className="text-sm font-semibold">{formatCurrency(item.adjustedUnitPrice)}</span>
                              </div>
                              <Badge variant="outline" className="bg-white">
                                {item.itemType?.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(item.adjustedTotalPrice)}</p>
                        <p className="text-sm text-gray-500">Line Total</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Summary Row */}
                <div className="border-t pt-4 mt-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          {adjustedLineItems.length} item{adjustedLineItems.length !== 1 ? 's' : ''} total
                        </p>
                        <p className="text-lg font-semibold text-gray-900">Subtotal</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(adjustedSubtotal)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clean Pricing Summary - Client Facing */}
        <Card className="bg-white shadow-sm border-0 ring-1 ring-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Quote Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Subtotal */}
              <div className="flex justify-between items-center py-3 text-lg">
                <span className="text-gray-700 font-medium">Subtotal</span>
                <span className="font-semibold">{formatCurrency(adjustedSubtotal)}</span>
              </div>
              
              {/* Tax */}
              {taxAmount > 0 && (
                <div className="flex justify-between items-center py-3 border-t border-gray-100 text-lg">
                  <span className="text-gray-700 font-medium">Tax</span>
                  <span className="font-semibold">{formatCurrency(taxAmount)}</span>
                </div>
              )}
              
              {/* Grand Total */}
              <div className="border-t-2 border-gray-300 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-gray-900">Total</span>
                  <span className="text-3xl font-bold text-green-600">{formatCurrency(finalTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes Section */}
        {(quote.description || quote.customerNotes || quote.internalNotes) && (
          <Card className="bg-white shadow-sm border-0 ring-1 ring-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <FileText className="h-5 w-5 text-blue-600" />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {quote.description && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Description</p>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-900">{quote.description}</p>
                  </div>
                </div>
              )}
              {quote.customerNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Customer Notes</p>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-gray-900">{quote.customerNotes}</p>
                  </div>
                </div>
              )}
              {quote.internalNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Internal Notes</p>
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <p className="text-gray-900">{quote.internalNotes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}