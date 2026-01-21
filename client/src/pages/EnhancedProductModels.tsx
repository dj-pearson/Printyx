import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit3, Trash2, CheckSquare, Square, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  insertProductModelSchema,
  type ProductModel,
  type InsertProductModel,
} from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import ManagementToolbar from '@/components/product-management/ManagementToolbar';
import { ProductPricingForm } from '@/components/product-management/ProductPricingForm';
import { ProductPricingDisplay } from '@/components/product-management/ProductPricingDisplay';
import { usePricingVisibility } from '@/hooks/usePricingVisibility';

export default function EnhancedProductModels() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ProductModel | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: visibility } = usePricingVisibility();

  // Pricing tier states
  const [newTier, setNewTier] = useState({
    active: false,
    dealerCost: '',
    repMarkupPercentage: '',
    repCost: '',
    suggestedRetail: '',
  });

  const [upgradeTier, setUpgradeTier] = useState({
    active: false,
    dealerCost: '',
    repMarkupPercentage: '',
    repCost: '',
    suggestedRetail: '',
  });

  const [lexmarkTier, setLexmarkTier] = useState({
    active: false,
    dealerCost: '',
    repMarkupPercentage: '',
    repCost: '',
    suggestedRetail: '',
  });

  const { data: models = [], isLoading } = useQuery<ProductModel[]>({
    queryKey: ['/api/product-models'],
  });

  const createModelMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/product-models', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-models'] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Product model created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create product model',
        variant: 'destructive',
      });
    },
  });

  const updateModelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductModel> }) => {
      return await apiRequest(`/api/product-models/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-models'] });
      setSelectedModel(null);
      toast({
        title: 'Success',
        description: 'Product model updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update product model',
        variant: 'destructive',
      });
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/product-models/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-models'] });
      setSelectedModel(null);
      toast({
        title: 'Success',
        description: 'Product model deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete product model',
        variant: 'destructive',
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest('/api/product-models/bulk-delete', 'DELETE', { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-models'] });
      setSelectedIds(new Set());
      setBulkMode(false);
      toast({
        title: 'Success',
        description: `Successfully deleted ${selectedIds.size} product models`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete product models',
        variant: 'destructive',
      });
    },
  });

  const form = useForm<InsertProductModel>({
    resolver: zodResolver(insertProductModelSchema),
    defaultValues: {
      tenantId: '',
      productCode: '',
      productName: '',
      category: 'MFP',
      manufacturer: 'Canon',
      description: null,
      msrp: null,
      colorSpeed: null,
      bwSpeed: null,
      isActive: true,
    },
  });

  const resetForm = () => {
    form.reset();
    setNewTier({
      active: false,
      dealerCost: '',
      repMarkupPercentage: '',
      repCost: '',
      suggestedRetail: '',
    });
    setUpgradeTier({
      active: false,
      dealerCost: '',
      repMarkupPercentage: '',
      repCost: '',
      suggestedRetail: '',
    });
    setLexmarkTier({
      active: false,
      dealerCost: '',
      repMarkupPercentage: '',
      repCost: '',
      suggestedRetail: '',
    });
  };

  const onSubmit = (data: InsertProductModel) => {
    const productData = {
      ...data,
      // New tier
      newActive: newTier.active,
      newDealerCost: newTier.active ? newTier.dealerCost : null,
      newRepMarkupPercentage: newTier.active ? newTier.repMarkupPercentage : null,
      newRepCost: newTier.active ? newTier.repCost : null,
      newSuggestedRetail: newTier.active ? newTier.suggestedRetail : null,
      // Upgrade tier
      upgradeActive: upgradeTier.active,
      upgradeDealerCost: upgradeTier.active ? upgradeTier.dealerCost : null,
      upgradeRepMarkupPercentage: upgradeTier.active ? upgradeTier.repMarkupPercentage : null,
      upgradeRepCost: upgradeTier.active ? upgradeTier.repCost : null,
      upgradeSuggestedRetail: upgradeTier.active ? upgradeTier.suggestedRetail : null,
      // Lexmark tier
      lexmarkActive: lexmarkTier.active,
      lexmarkDealerCost: lexmarkTier.active ? lexmarkTier.dealerCost : null,
      lexmarkRepMarkupPercentage: lexmarkTier.active ? lexmarkTier.repMarkupPercentage : null,
      lexmarkRepCost: lexmarkTier.active ? lexmarkTier.repCost : null,
      lexmarkSuggestedRetail: lexmarkTier.active ? lexmarkTier.suggestedRetail : null,
    };

    createModelMutation.mutate(productData);
  };

  // Filter and search
  const filteredModels = models.filter((model) => {
    const matchesSearch =
      !searchTerm ||
      (model.productName || model.modelName || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (model.productCode || model.modelCode || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || model.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(models.map((m) => m.category).filter(Boolean)));

  const toggleItemSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedIds.size === filteredModels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredModels.map((m) => m.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

  const formatCurrency = (value?: string | number | null): string => {
    if (value === null || value === undefined || value === '') return '—';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <MainLayout title="Product Models" description="Manage product models with three-tier pricing">
      <div className="space-y-6">
        <ManagementToolbar
          title="Product Models"
          description="Manage your copier and MFP product catalog with advanced pricing"
          searchPlaceholder="Search models..."
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onAddClick={() => setDialogOpen(true)}
          productTypeForImport="product-models"
          bulkMode={bulkMode}
          onToggleBulkMode={() => setBulkMode(!bulkMode)}
          selectedCount={selectedIds.size}
          totalCount={models.length}
          onBulkDelete={handleBulkDelete}
        />

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Add New Product Model</DialogTitle>
              <DialogDescription>
                Create a new product model with three-tier pricing (Dealer Cost → Rep Cost →
                Customer Price)
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 pr-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="basic">Basic Info</TabsTrigger>
                      <TabsTrigger value="pricing">Pricing Tiers</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="productCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product Code</FormLabel>
                              <FormControl>
                                <Input placeholder="CN-IPCV1000" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="productName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product Name</FormLabel>
                              <FormControl>
                                <Input placeholder="imagePRESS V1000" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="MFP">MFP</SelectItem>
                                  <SelectItem value="Production Printer">
                                    Production Printer
                                  </SelectItem>
                                  <SelectItem value="Production">Production</SelectItem>
                                  <SelectItem value="Wide Format">Wide Format</SelectItem>
                                  <SelectItem value="Desktop">Desktop</SelectItem>
                                  <SelectItem value="Software">Software</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="manufacturer"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Manufacturer</FormLabel>
                              <Select value={field.value || ''} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Canon">Canon</SelectItem>
                                  <SelectItem value="Ricoh">Ricoh</SelectItem>
                                  <SelectItem value="HP">HP</SelectItem>
                                  <SelectItem value="Xerox">Xerox</SelectItem>
                                  <SelectItem value="Konica Minolta">Konica Minolta</SelectItem>
                                  <SelectItem value="Duplo">Duplo</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="colorMode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Color Mode</FormLabel>
                              <Select value={field.value || ''} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Color">Color</SelectItem>
                                  <SelectItem value="B/W">B/W</SelectItem>
                                  <SelectItem value="Both">Both</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="High-performance production printer..."
                                value={field.value || ''}
                                onChange={field.onChange}
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="colorSpeed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Color Speed (ppm)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="100"
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bwSpeed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>B/W Speed (ppm)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="120"
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="msrp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>MSRP ($) - Reference Only</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="171930.00"
                                value={field.value || ''}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>

                    <TabsContent value="pricing" className="space-y-6 mt-4">
                      <ProductPricingForm
                        tier="new"
                        tierLabel="New"
                        values={newTier}
                        onChange={setNewTier}
                        productCategory={form.watch('category')}
                      />

                      <ProductPricingForm
                        tier="upgrade"
                        tierLabel="Upgrade"
                        values={upgradeTier}
                        onChange={setUpgradeTier}
                        productCategory={form.watch('category')}
                      />

                      <ProductPricingForm
                        tier="lexmark"
                        tierLabel="Lexmark"
                        values={lexmarkTier}
                        onChange={setLexmarkTier}
                        productCategory={form.watch('category')}
                      />
                    </TabsContent>
                  </Tabs>

                  <Separator />

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDialogOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createModelMutation.isPending}>
                      {createModelMutation.isPending ? 'Creating...' : 'Create Model'}
                    </Button>
                  </div>
                </form>
              </Form>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center p-12">
              <p className="text-muted-foreground">Loading product models...</p>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 text-center">
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchTerm
                  ? 'Try adjusting your search'
                  : 'Add your first product model to get started'}
              </p>
            </div>
          ) : (
            filteredModels.map((model) => (
              <Card key={model.id} className="relative">
                {bulkMode && (
                  <div className="absolute top-4 left-4 z-10">
                    <Checkbox
                      checked={selectedIds.has(model.id)}
                      onCheckedChange={() => toggleItemSelection(model.id)}
                    />
                  </div>
                )}
                <CardHeader className={bulkMode ? 'pl-12' : ''}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {model.productName || model.modelName}
                      </CardTitle>
                      <CardDescription>
                        <span className="font-medium">{model.productCode || model.modelCode}</span>
                        {model.manufacturer && <span className="ml-2">• {model.manufacturer}</span>}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {model.isActive ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {model.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {model.description}
                    </p>
                  )}

                  {model.category && <Badge variant="outline">{model.category}</Badge>}

                  {(model.colorSpeed || model.bwSpeed) && (
                    <div className="text-sm text-muted-foreground">
                      {model.colorSpeed && <span>Color: {model.colorSpeed}ppm</span>}
                      {model.bwSpeed && <span className="ml-3">B/W: {model.bwSpeed}ppm</span>}
                    </div>
                  )}

                  <Separator />

                  <ProductPricingDisplay
                    msrp={model.msrp}
                    newTier={{
                      active: model.newActive,
                      dealerCost: model.newDealerCost,
                      repCost: model.newRepCost,
                      suggestedRetail: model.newSuggestedRetail,
                    }}
                    upgradeTier={{
                      active: model.upgradeActive,
                      dealerCost: model.upgradeDealerCost,
                      repCost: model.upgradeRepCost,
                      suggestedRetail: model.upgradeSuggestedRetail,
                    }}
                    lexmarkTier={{
                      active: model.lexmarkActive,
                      dealerCost: model.lexmarkDealerCost,
                      repCost: model.lexmarkRepCost,
                      suggestedRetail: model.lexmarkSuggestedRetail,
                    }}
                  />

                  <Separator />

                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedModel(model)}>
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteModelMutation.mutate(model.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
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
