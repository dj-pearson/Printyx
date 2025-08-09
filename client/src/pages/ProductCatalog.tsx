import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Search, Package, ShoppingCart, Settings, Eye, CheckCircle, Circle, Filter } from 'lucide-react';

interface MasterProduct {
  id: string;
  manufacturer: string;
  modelCode: string;
  displayName: string;
  specsJson?: any;
  msrp?: number;
  status: string;
  category?: string;
  productType?: string;
  createdAt: string;
  updatedAt: string;
}

interface EnabledProduct {
  enabledProductId: string;
  tenantId: string;
  source: string;
  enabled: boolean;
  customSku?: string;
  customName?: string;
  dealerCost?: number;
  companyPrice?: number;
  priceOverridden: boolean;
  enabledAt: string;
  // Master product fields
  masterProductId?: string;
  manufacturer?: string;
  modelCode?: string;
  displayName?: string;
  specsJson?: any;
  msrp?: number;
  status?: string;
  category?: string;
  productType?: string;
}

export default function ProductCatalog() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [enableForm, setEnableForm] = useState({
    customSku: '',
    customName: '',
    dealerCost: '',
    companyPrice: '',
    markupRuleId: '',
    priceOverridden: false
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch master catalog products
  const { data: masterProducts = [], isLoading: isLoadingMaster } = useQuery({
    queryKey: ['/api/catalog/models', { manufacturer: selectedManufacturer, search: searchTerm, category: selectedCategory }],
    queryFn: () => apiRequest(`/api/catalog/models?manufacturer=${selectedManufacturer}&search=${searchTerm}&category=${selectedCategory}`)
  });

  // Fetch enabled products for tenant
  const { data: enabledProducts = [], isLoading: isLoadingEnabled } = useQuery({
    queryKey: ['/api/enabled-products'],
    queryFn: () => apiRequest('/api/enabled-products')
  });

  // Fetch manufacturers list
  const { data: manufacturers = [] } = useQuery({
    queryKey: ['/api/catalog/manufacturers'],
    queryFn: () => apiRequest('/api/catalog/manufacturers')
  });

  // Enable single product mutation
  const enableProductMutation = useMutation({
    mutationFn: (data: { productId: string; overrides: any }) =>
      apiRequest(`/api/catalog/models/${data.productId}/enable`, {
        method: 'POST',
        body: JSON.stringify(data.overrides)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enabled-products'] });
      toast({ title: 'Product enabled successfully' });
      setShowEnableDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error enabling product', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  // Bulk enable products mutation
  const bulkEnableMutation = useMutation({
    mutationFn: (data: { masterProductIds: string[]; defaultOverrides: any }) =>
      apiRequest('/api/catalog/models/bulk-enable', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/enabled-products'] });
      toast({ 
        title: 'Products enabled', 
        description: `${data.enabled} products enabled, ${data.skipped} already enabled` 
      });
      setSelectedProducts(new Set());
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error enabling products', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  const handleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleBulkEnable = () => {
    if (selectedProducts.size === 0) {
      toast({ title: 'No products selected', variant: 'destructive' });
      return;
    }

    bulkEnableMutation.mutate({
      masterProductIds: Array.from(selectedProducts),
      defaultOverrides: {
        dealerCost: enableForm.dealerCost ? parseFloat(enableForm.dealerCost) : null,
        companyPrice: enableForm.companyPrice ? parseFloat(enableForm.companyPrice) : null,
        markupRuleId: enableForm.markupRuleId || null
      }
    });
  };

  const isProductEnabled = (productId: string) => {
    return enabledProducts.some((ep: EnabledProduct) => ep.masterProductId === productId);
  };

  const categories = Array.from(new Set(masterProducts.map((p: MasterProduct) => p.category).filter(Boolean)));

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Product Catalog</h1>
        <p className="text-muted-foreground">
          Browse the master catalog and enable products for your organization
        </p>
      </div>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="browse" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Browse Catalog
          </TabsTrigger>
          <TabsTrigger value="enabled" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Enabled Products
          </TabsTrigger>
          <TabsTrigger value="tenant" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Tenant Products
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          {/* Search and Filter Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Search & Filter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Search Products</Label>
                  <Input
                    placeholder="Search by name or model..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Manufacturer</Label>
                  <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Manufacturers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Manufacturers</SelectItem>
                      {manufacturers.map((manufacturer: string) => (
                        <SelectItem key={manufacturer} value={manufacturer}>
                          {manufacturer}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category: string) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Actions</Label>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleBulkEnable}
                      disabled={selectedProducts.size === 0 || bulkEnableMutation.isPending}
                      className="flex-1"
                    >
                      Enable Selected ({selectedProducts.size})
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Enable Form */}
          {selectedProducts.size > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Bulk Enable Settings</CardTitle>
                <CardDescription>
                  Configure default settings for {selectedProducts.size} selected products
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Default Dealer Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={enableForm.dealerCost}
                    onChange={(e) => setEnableForm(prev => ({ ...prev, dealerCost: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Company Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={enableForm.companyPrice}
                    onChange={(e) => setEnableForm(prev => ({ ...prev, companyPrice: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Markup Rule</Label>
                  <Select 
                    value={enableForm.markupRuleId} 
                    onValueChange={(value) => setEnableForm(prev => ({ ...prev, markupRuleId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select markup rule" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard Markup (25%)</SelectItem>
                      <SelectItem value="premium">Premium Markup (35%)</SelectItem>
                      <SelectItem value="bulk">Bulk Discount (15%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Master Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoadingMaster ? (
              // Loading skeleton
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              masterProducts.map((product: MasterProduct) => {
                const isEnabled = isProductEnabled(product.id);
                const isSelected = selectedProducts.has(product.id);
                
                return (
                  <Card key={product.id} className={`transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''} ${isEnabled ? 'bg-green-50 border-green-200' : ''}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{product.displayName}</CardTitle>
                          <CardDescription>
                            {product.manufacturer} - {product.modelCode}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {isEnabled ? (
                            <Badge variant="success" className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Enabled
                            </Badge>
                          ) : (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleSelectProduct(product.id)}
                            />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">MSRP:</span>
                          <span className="font-medium">
                            {product.msrp ? `$${product.msrp.toLocaleString()}` : 'N/A'}
                          </span>
                        </div>
                        
                        {product.category && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Category:</span>
                            <Badge variant="outline">{product.category}</Badge>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="flex-1">
                                <Eye className="h-4 w-4 mr-1" />
                                View Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>{product.displayName}</DialogTitle>
                                <DialogDescription>
                                  {product.manufacturer} {product.modelCode}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Manufacturer</Label>
                                    <p className="text-sm">{product.manufacturer}</p>
                                  </div>
                                  <div>
                                    <Label>Model Code</Label>
                                    <p className="text-sm">{product.modelCode}</p>
                                  </div>
                                  <div>
                                    <Label>MSRP</Label>
                                    <p className="text-sm">{product.msrp ? `$${product.msrp.toLocaleString()}` : 'N/A'}</p>
                                  </div>
                                  <div>
                                    <Label>Status</Label>
                                    <p className="text-sm">{product.status}</p>
                                  </div>
                                </div>
                                {product.specsJson && (
                                  <div>
                                    <Label>Specifications</Label>
                                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                                      {JSON.stringify(product.specsJson, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                          
                          {!isEnabled && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setEnableForm({
                                  customSku: '',
                                  customName: '',
                                  dealerCost: '',
                                  companyPrice: '',
                                  markupRuleId: '',
                                  priceOverridden: false
                                });
                                enableProductMutation.mutate({
                                  productId: product.id,
                                  overrides: {}
                                });
                              }}
                              disabled={enableProductMutation.isPending}
                            >
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              Enable
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="enabled" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enabled Products</CardTitle>
              <CardDescription>
                Products you've enabled from the master catalog
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoadingEnabled ? (
                  <div>Loading enabled products...</div>
                ) : enabledProducts.length === 0 ? (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No products enabled yet. Browse the catalog to enable products.
                  </div>
                ) : (
                  enabledProducts.map((product: EnabledProduct) => (
                    <Card key={product.enabledProductId}>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          {product.customName || product.displayName}
                        </CardTitle>
                        <CardDescription>
                          {product.manufacturer} - {product.customSku || product.modelCode}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">MSRP:</span>
                            <span className="text-sm">{product.msrp ? `$${product.msrp.toLocaleString()}` : 'N/A'}</span>
                          </div>
                          {product.dealerCost && (
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Dealer Cost:</span>
                              <span className="text-sm">${product.dealerCost.toLocaleString()}</span>
                            </div>
                          )}
                          {product.companyPrice && (
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Company Price:</span>
                              <span className="text-sm font-medium">${product.companyPrice.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Source:</span>
                            <Badge variant="outline">Master Catalog</Badge>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-3">
                          <Button variant="outline" size="sm" className="flex-1">
                            <Settings className="h-4 w-4 mr-1" />
                            Configure
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenant" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tenant-Specific Products</CardTitle>
              <CardDescription>
                Products created specifically for your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tenant-specific products yet.</p>
                <p className="text-sm">Create custom products not available in the master catalog.</p>
                <Button className="mt-4">
                  <Package className="h-4 w-4 mr-2" />
                  Add Custom Product
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}