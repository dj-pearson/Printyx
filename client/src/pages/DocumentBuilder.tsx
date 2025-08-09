import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, FileText, Download, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { MainLayout } from '@/components/layout/main-layout';

interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface DocumentData {
  // Purchase Agreement Fields
  agreementNumber: string;
  buyerName: string;
  buyerAddress: string;
  shipToName: string;
  shipToAddress: string;
  poNumber: string;
  orderDate: string;
  
  // Equipment/Line Items
  lineItems: QuoteLineItem[];
  
  // Service Contract Fields
  includeServiceContract: boolean;
  serviceTerm: number; // months
  serviceStartDate: string;
  autoRenewal: boolean;
  
  // Meter/Billing Details
  minimumBlackPrints: number;
  minimumColorPrints: number;
  blackRate: number;
  colorRate: number;
  monthlyBase: number;
  
  // Consumable Supplies
  includeConsumables: boolean;
  includeBlackSupplies: boolean;
  includeColorSupplies: boolean;
  
  // Terms and Conditions
  paymentTerms: string;
  warrantyTerms: string;
  specialTerms: string;
  
  // Customer Info
  customerId: string;
  customerName: string;
  authorizedSignerTitle: string;
}

export default function DocumentBuilder() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [documentForm, setDocumentForm] = useState<Partial<DocumentData>>({
    includeServiceContract: false,
    serviceTerm: 60,
    autoRenewal: false,
    minimumBlackPrints: 500,
    minimumColorPrints: 500,
    blackRate: 0.008,
    colorRate: 0.050,
    monthlyBase: 30,
    includeConsumables: true,
    includeBlackSupplies: true,
    includeColorSupplies: true,
    paymentTerms: 'net_30',
    orderDate: format(new Date(), 'yyyy-MM-dd'),
    serviceStartDate: format(new Date(), 'yyyy-MM-dd'),
  });

  // Fetch available quotes for import
  const { data: availableQuotes = [] } = useQuery({
    queryKey: ['/api/quotes'],
  });

  // Fetch quote line items when quote is selected
  const { data: quoteLineItems = [] } = useQuery({
    queryKey: ['/api/quotes', selectedQuoteId, 'line-items'],
    enabled: !!selectedQuoteId,
  });

  // Fetch customers for selection
  const { data: customers = [] } = useQuery({
    queryKey: ['/api/business-records'],
  });

  // Fetch existing documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['/api/documents'],
  });

  useEffect(() => {
    // Auto-populate from selected quote
    if (!selectedQuoteId) return;
    const quote = availableQuotes.find((q: any) => q.id === selectedQuoteId);
    if (quote) {
      const customer = customers.find((c: any) => c.id === quote.customerId);
      setDocumentForm(prev => ({
        ...prev,
        customerId: quote.customerId,
        customerName: customer?.company_name || customer?.primary_contact_name || '',
        lineItems: quoteLineItems,
        agreementNumber: `PA-${Date.now()}`,
      }));
    }
  }, [selectedQuoteId, availableQuotes, customers, quoteLineItems]);

  const createDocumentMutation = useMutation({
    mutationFn: async (documentData: DocumentData) => {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(documentData),
      });
      if (!res.ok) throw new Error('Failed to create document');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setIsCreateOpen(false);
      setSelectedQuoteId('');
      setDocumentForm({});
    },
  });

  const generatePDFMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}/pdf`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      
      // Download the PDF
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${docId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
  });

  const calculateTotal = () => {
    return (documentForm.lineItems || []).reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const handleCreateDocument = () => {
    if (!documentForm.customerId) {
      alert('Please select a customer');
      return;
    }
    createDocumentMutation.mutate(documentForm as DocumentData);
  };

  if (isLoading) {
    return (
      <MainLayout title="Document Builder" description="Create combined purchase agreements and service contracts">
        <div className="animate-pulse space-y-4">
          <Card><CardContent className="p-6"><div className="h-4 bg-gray-200 rounded w-1/4"></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="h-4 bg-gray-200 rounded w-1/2"></div></CardContent></Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Document Builder" description="Create combined purchase agreements and service contracts">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Document Builder</h2>
            <p className="text-muted-foreground">Create comprehensive purchase agreements with service contracts</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Purchase Agreement & Service Contract</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Quote Import Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Import from Quote</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Select Quote to Import</Label>
                      <Select value={selectedQuoteId} onValueChange={setSelectedQuoteId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a quote to import data from" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableQuotes.map((quote: any) => (
                            <SelectItem key={quote.id} value={quote.id}>
                              {quote.quoteNumber} - {quote.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {selectedQuoteId && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-800">
                          ✓ Quote data imported! Line items, customer info, and pricing will be pre-filled.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Agreement Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Agreement Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Agreement Number</Label>
                      <Input 
                        value={documentForm.agreementNumber || ''}
                        onChange={(e) => setDocumentForm(prev => ({ ...prev, agreementNumber: e.target.value }))}
                        placeholder="Auto-generated"
                      />
                    </div>
                    <div>
                      <Label>Order Date</Label>
                      <Input 
                        type="date"
                        value={documentForm.orderDate || ''}
                        onChange={(e) => setDocumentForm(prev => ({ ...prev, orderDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Buyer Name</Label>
                      <Input 
                        value={documentForm.buyerName || documentForm.customerName || ''}
                        onChange={(e) => setDocumentForm(prev => ({ ...prev, buyerName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>P.O. Number</Label>
                      <Input 
                        value={documentForm.poNumber || ''}
                        onChange={(e) => setDocumentForm(prev => ({ ...prev, poNumber: e.target.value }))}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Line Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Equipment & Services</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(documentForm.lineItems || []).length > 0 ? (
                      <div className="space-y-3">
                        {documentForm.lineItems.map((item, index) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                            <div className="flex-1">
                              <p className="font-medium">{item.description}</p>
                              <p className="text-sm text-gray-600">Qty: {item.quantity} × ${item.unitPrice}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">${item.totalPrice.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                        <Separator />
                        <div className="flex justify-between items-center font-bold text-lg">
                          <span>Total Equipment & Services:</span>
                          <span>${calculateTotal().toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">No line items. Import from a quote to populate.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Service Contract Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Service Contract Options</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="includeService"
                        checked={documentForm.includeServiceContract}
                        onCheckedChange={(checked) => 
                          setDocumentForm(prev => ({ ...prev, includeServiceContract: !!checked }))
                        }
                      />
                      <Label htmlFor="includeService">Include Service Contract</Label>
                    </div>

                    {documentForm.includeServiceContract && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Service Term (Months)</Label>
                            <Input 
                              type="number"
                              value={documentForm.serviceTerm || 60}
                              onChange={(e) => setDocumentForm(prev => ({ 
                                ...prev, 
                                serviceTerm: parseInt(e.target.value) || 60 
                              }))}
                            />
                          </div>
                          <div>
                            <Label>Service Start Date</Label>
                            <Input 
                              type="date"
                              value={documentForm.serviceStartDate || ''}
                              onChange={(e) => setDocumentForm(prev => ({ 
                                ...prev, 
                                serviceStartDate: e.target.value 
                              }))}
                            />
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="autoRenewal"
                            checked={documentForm.autoRenewal}
                            onCheckedChange={(checked) => 
                              setDocumentForm(prev => ({ ...prev, autoRenewal: !!checked }))
                            }
                          />
                          <Label htmlFor="autoRenewal">Auto-Renewal (12-month terms)</Label>
                        </div>

                        {/* Billing Rates */}
                        <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                          <h4 className="font-semibold text-blue-800">Service Billing Rates</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label>Monthly Base</Label>
                              <Input 
                                type="number"
                                step="0.01"
                                value={documentForm.monthlyBase || 30}
                                onChange={(e) => setDocumentForm(prev => ({ 
                                  ...prev, 
                                  monthlyBase: parseFloat(e.target.value) || 30 
                                }))}
                              />
                            </div>
                            <div>
                              <Label>Black Rate (per print)</Label>
                              <Input 
                                type="number"
                                step="0.001"
                                value={documentForm.blackRate || 0.008}
                                onChange={(e) => setDocumentForm(prev => ({ 
                                  ...prev, 
                                  blackRate: parseFloat(e.target.value) || 0.008 
                                }))}
                              />
                            </div>
                            <div>
                              <Label>Color Rate (per print)</Label>
                              <Input 
                                type="number"
                                step="0.001"
                                value={documentForm.colorRate || 0.050}
                                onChange={(e) => setDocumentForm(prev => ({ 
                                  ...prev, 
                                  colorRate: parseFloat(e.target.value) || 0.050 
                                }))}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Minimum Black Prints</Label>
                              <Input 
                                type="number"
                                value={documentForm.minimumBlackPrints || 500}
                                onChange={(e) => setDocumentForm(prev => ({ 
                                  ...prev, 
                                  minimumBlackPrints: parseInt(e.target.value) || 500 
                                }))}
                              />
                            </div>
                            <div>
                              <Label>Minimum Color Prints</Label>
                              <Input 
                                type="number"
                                value={documentForm.minimumColorPrints || 500}
                                onChange={(e) => setDocumentForm(prev => ({ 
                                  ...prev, 
                                  minimumColorPrints: parseInt(e.target.value) || 500 
                                }))}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Consumables */}
                        <div>
                          <Label className="text-base font-medium">Consumable Supplies</Label>
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="includeBlackSupplies"
                                checked={documentForm.includeBlackSupplies}
                                onCheckedChange={(checked) => 
                                  setDocumentForm(prev => ({ ...prev, includeBlackSupplies: !!checked }))
                                }
                              />
                              <Label htmlFor="includeBlackSupplies">Include Black Supplies (toner, developer, fuser lubricant)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="includeColorSupplies"
                                checked={documentForm.includeColorSupplies}
                                onCheckedChange={(checked) => 
                                  setDocumentForm(prev => ({ ...prev, includeColorSupplies: !!checked }))
                                }
                              />
                              <Label htmlFor="includeColorSupplies">Include Color Supplies (toner, developer, fuser lubricant)</Label>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Terms and Conditions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Terms & Conditions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Payment Terms</Label>
                      <Select 
                        value={documentForm.paymentTerms} 
                        onValueChange={(value) => setDocumentForm(prev => ({ ...prev, paymentTerms: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="net_15">Net 15</SelectItem>
                          <SelectItem value="net_30">Net 30</SelectItem>
                          <SelectItem value="net_60">Net 60</SelectItem>
                          <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Special Terms</Label>
                      <Textarea 
                        value={documentForm.specialTerms || ''}
                        onChange={(e) => setDocumentForm(prev => ({ ...prev, specialTerms: e.target.value }))}
                        placeholder="Any special terms or conditions"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label>Authorized Signer Title</Label>
                      <Input 
                        value={documentForm.authorizedSignerTitle || ''}
                        onChange={(e) => setDocumentForm(prev => ({ ...prev, authorizedSignerTitle: e.target.value }))}
                        placeholder="e.g., VP Director Tax & Treasury"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-end space-x-4 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateDocument}
                    disabled={createDocumentMutation.isPending || !documentForm.customerId}
                  >
                    {createDocumentMutation.isPending ? 'Creating...' : 'Create Document'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Documents List */}
        <div className="grid gap-4">
          {documents.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold mb-2">No documents created yet</h3>
                <p className="text-gray-600 mb-4">
                  Create your first combined purchase agreement and service contract
                </p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Document
                </Button>
              </CardContent>
            </Card>
          ) : (
            documents.map((doc: any) => (
              <Card key={doc.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold">
                          Agreement #{doc.agreementNumber}
                        </h3>
                        <Badge variant={doc.includeServiceContract ? "default" : "secondary"}>
                          {doc.includeServiceContract ? "Purchase + Service" : "Purchase Only"}
                        </Badge>
                      </div>
                      <p className="text-gray-600">
                        Customer: {doc.customerName || doc.buyerName}
                      </p>
                      <p className="text-sm text-gray-500">
                        Created: {format(new Date(doc.createdAt), 'MMM dd, yyyy')}
                      </p>
                      {doc.includeServiceContract && (
                        <div className="text-sm text-blue-600">
                          Service Term: {doc.serviceTerm} months • 
                          Base: ${doc.monthlyBase} • 
                          B&W: ${doc.blackRate}/print • 
                          Color: ${doc.colorRate}/print
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => generatePDFMutation.mutate(doc.id)}
                        disabled={generatePDFMutation.isPending}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}