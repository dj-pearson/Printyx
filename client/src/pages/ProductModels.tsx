import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Package, Edit3, Tag, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductModelSchema, type ProductModel, type InsertProductModel } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";
import ProductImport from "@/components/product-import/ProductImport";

export default function ProductModels() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ProductModel | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: models = [], isLoading } = useQuery<ProductModel[]>({
    queryKey: ['/api/product-models'],
  });

  const createModelMutation = useMutation({
    mutationFn: async (data: InsertProductModel) => {
      return await apiRequest('/api/product-models', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-models'] });
      setDialogOpen(false);
      toast({
        title: "Success",
        description: "Product model created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create product model",
        variant: "destructive",
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
        title: "Success",
        description: "Product model updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update product model",
        variant: "destructive",
      });
    },
  });

  const form = useForm<InsertProductModel>({
    resolver: zodResolver(insertProductModelSchema),
    defaultValues: {
      tenantId: "",
      productCode: "",
      productName: "",
      category: "MFP",
      manufacturer: "Canon",
      description: null,
      msrp: null,
      colorSpeed: null,
      bwSpeed: null,
      newActive: false,
      newRepPrice: null,
      upgradeActive: false,
      upgradeRepPrice: null,
      lexmarkActive: false,
      lexmarkRepPrice: null,
      isActive: true,
    },
  });

  const editForm = useForm<Partial<ProductModel>>({
    resolver: zodResolver(insertProductModelSchema.partial()),
    defaultValues: {},
  });

  const onSubmit = (data: InsertProductModel) => {
    createModelMutation.mutate(data);
  };

  const onEditSubmit = (data: Partial<ProductModel>) => {
    if (selectedModel) {
      updateModelMutation.mutate({ id: selectedModel.id, data });
    }
  };

  // Populate edit form when selectedModel changes
  useEffect(() => {
    if (selectedModel) {
      editForm.reset({
        productCode: selectedModel.productCode,
        productName: selectedModel.productName,
        category: selectedModel.category,
        manufacturer: selectedModel.manufacturer,
        description: selectedModel.description,
        msrp: selectedModel.msrp,
        colorMode: selectedModel.colorMode,
        colorSpeed: selectedModel.colorSpeed,
        bwSpeed: selectedModel.bwSpeed,
        productFamily: selectedModel.productFamily,
        newActive: selectedModel.newActive,
        newRepPrice: selectedModel.newRepPrice,
        upgradeActive: selectedModel.upgradeActive,
        upgradeRepPrice: selectedModel.upgradeRepPrice,
        lexmarkActive: selectedModel.lexmarkActive,
        lexmarkRepPrice: selectedModel.lexmarkRepPrice,
        isActive: selectedModel.isActive,
      });
    }
  }, [selectedModel, editForm]);

  const filteredModels = models.filter(model => {
    const matchesSearch = (model.productName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (model.productCode || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (model.manufacturer || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || model.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(models.map(m => m.category))).filter(Boolean);

  const formatCurrency = (value: string | null) => {
    if (!value) return "$0.00";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(value));
  };

  const ModelCard = ({ model }: { model: ProductModel }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{model.productName}</CardTitle>
            <CardDescription>
              <span className="font-medium">{model.productCode}</span>
              {model.manufacturer && <span className="ml-2 text-muted-foreground">• {model.manufacturer}</span>}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {model.isActive ? (
              <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline">{model.category}</Badge>
          {model.colorMode && <Badge variant="outline">{model.colorMode}</Badge>}
        </div>

        {model.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {model.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">MSRP</span>
            </div>
            <p className="text-lg font-bold">{formatCurrency(model.msrp)}</p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Pricing Tiers</span>
            <div className="space-y-1">
              {model.newActive && (
                <div className="flex justify-between text-sm">
                  <span>New:</span>
                  <span className="font-medium">{formatCurrency(model.newRepPrice)}</span>
                </div>
              )}
              {model.upgradeActive && (
                <div className="flex justify-between text-sm">
                  <span>Upgrade:</span>
                  <span className="font-medium">{formatCurrency(model.upgradeRepPrice)}</span>
                </div>
              )}
              {model.lexmarkActive && (
                <div className="flex justify-between text-sm">
                  <span>Lexmark:</span>
                  <span className="font-medium">{formatCurrency(model.lexmarkRepPrice)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {model.colorSpeed && <span>Color: {model.colorSpeed}ppm</span>}
            {model.bwSpeed && <span className="ml-3">B/W: {model.bwSpeed}ppm</span>}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSelectedModel(model)}
          >
            <Edit3 className="h-4 w-4 mr-1" />
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <MainLayout title="Product Models" description="Manage product models and specifications">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Models</h1>
          <p className="text-muted-foreground">
            Manage your copier and MFP product catalog with pricing tiers
          </p>
        </div>
        <div className="flex gap-2">
          <ProductImport />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Model
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Product Model</DialogTitle>
              <DialogDescription>
                Create a new copier or MFP model with pricing information
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                            <SelectItem value="Production Printer">Production Printer</SelectItem>
                            <SelectItem value="Wide Format">Wide Format</SelectItem>
                            <SelectItem value="Desktop">Desktop</SelectItem>
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
                        <Select value={field.value || ""} onValueChange={field.onChange}>
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
                        <Select value={field.value || ""} onValueChange={field.onChange}>
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
                          placeholder="High-performance production printer with advanced finishing options..."
                          value={field.value || ""}
                          onChange={field.onChange}
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
                          <Input placeholder="100" value={field.value || ""} onChange={field.onChange} />
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
                          <Input placeholder="120" value={field.value || ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Pricing Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="msrp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MSRP ($)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="171930.00" value={field.value || ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <FormField
                          control={form.control}
                          name="newActive"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={!!field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium">New Pricing Tier</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                      {form.watch('newActive') && (
                        <FormField
                          control={form.control}
                          name="newRepPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Rep Price ($)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="0.00" value={field.value || ""} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <FormField
                          control={form.control}
                          name="upgradeActive"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={!!field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium">Upgrade Pricing Tier</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                      {form.watch('upgradeActive') && (
                        <FormField
                          control={form.control}
                          name="upgradeRepPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Upgrade Rep Price ($)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="0.00" value={field.value || ""} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <FormField
                          control={form.control}
                          name="lexmarkActive"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={!!field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium">Lexmark Pricing Tier</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                      {form.watch('lexmarkActive') && (
                        <FormField
                          control={form.control}
                          name="lexmarkRepPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lexmark Rep Price ($)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="0.00" value={field.value || ""} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createModelMutation.isPending}>
                    {createModelMutation.isPending ? "Creating..." : "Create Model"}
                  </Button>
                </div>
              </form>
            </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Models Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-5/6"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredModels.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-8">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Product Models Found</h3>
          <p className="text-muted-foreground text-center mb-4">
            {searchTerm || selectedCategory !== "all" 
              ? "No models match your current filters. Try adjusting your search criteria."
              : "Get started by adding your first product model to the catalog."
            }
          </p>
          {!searchTerm && selectedCategory === "all" && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Model
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModels.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filteredModels.length} of {models.length} models
        </span>
        <span>
          {models.filter(m => m.isActive).length} active models
        </span>
      </div>

      {/* Edit Model Dialog */}
      <Dialog open={!!selectedModel} onOpenChange={() => setSelectedModel(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product Model</DialogTitle>
            <DialogDescription>
              Update {selectedModel?.productName} details and pricing information
            </DialogDescription>
          </DialogHeader>
          {selectedModel && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="productCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Code</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="productName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={editForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MFP">MFP</SelectItem>
                            <SelectItem value="Printer">Printer</SelectItem>
                            <SelectItem value="Production Printer">Production Printer</SelectItem>
                            <SelectItem value="Wide Format">Wide Format</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufacturer</FormLabel>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
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
                            <SelectItem value="Kyocera">Kyocera</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="colorMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color Mode</FormLabel>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Color">Color</SelectItem>
                            <SelectItem value="Monochrome">Monochrome</SelectItem>
                            <SelectItem value="B/W">B/W</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          value={field.value || ""}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={editForm.control}
                    name="colorSpeed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color Speed (ppm)</FormLabel>
                        <FormControl>
                          <Input value={field.value || ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="bwSpeed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>B/W Speed (ppm)</FormLabel>
                        <FormControl>
                          <Input value={field.value || ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="productFamily"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Family</FormLabel>
                        <FormControl>
                          <Input value={field.value || ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Pricing Information</h3>
                  
                  <FormField
                    control={editForm.control}
                    name="msrp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MSRP ($)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" value={field.value || ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <FormField
                          control={editForm.control}
                          name="newActive"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={!!field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium">New Pricing Tier</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                      {editForm.watch('newActive') && (
                        <FormField
                          control={editForm.control}
                          name="newRepPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Rep Price ($)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" value={field.value || ""} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <FormField
                          control={editForm.control}
                          name="upgradeActive"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={!!field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium">Upgrade Pricing Tier</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                      {editForm.watch('upgradeActive') && (
                        <FormField
                          control={editForm.control}
                          name="upgradeRepPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Upgrade Rep Price ($)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" value={field.value || ""} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <FormField
                          control={editForm.control}
                          name="lexmarkActive"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={!!field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium">Lexmark Pricing Tier</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                      {editForm.watch('lexmarkActive') && (
                        <FormField
                          control={editForm.control}
                          name="lexmarkRepPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lexmark Rep Price ($)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" value={field.value || ""} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <FormField
                      control={editForm.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Switch
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium">Active Product</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setSelectedModel(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateModelMutation.isPending}>
                    {updateModelMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </MainLayout>
  );
}