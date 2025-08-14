import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Package, Edit3, Tag, DollarSign, Filter } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductAccessorySchema, type ProductAccessory, type InsertProductAccessory, type ProductModel } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";

export default function ProductAccessories() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAccessory, setSelectedAccessory] = useState<ProductAccessory | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accessories = [], isLoading } = useQuery<ProductAccessory[]>({
    queryKey: ['/api/product-accessories'],
  });

  const { data: models = [] } = useQuery<ProductModel[]>({
    queryKey: ['/api/product-models'],
  });

  const createAccessoryMutation = useMutation({
    mutationFn: async (data: InsertProductAccessory) => {
      return await apiRequest('/api/product-accessories', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-accessories'] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Product accessory created successfully",
      });
    },
    onError: (error) => {
      console.error("Create accessory error:", error);
      toast({
        title: "Error",
        description: "Failed to create product accessory",
        variant: "destructive",
      });
    },
  });

  const updateAccessoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductAccessory> }) => {
      return await apiRequest(`/api/product-accessories/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-accessories'] });
      setSelectedAccessory(null);
      toast({
        title: "Success",
        description: "Product accessory updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update product accessory",
        variant: "destructive",
      });
    },
  });

  const form = useForm<InsertProductAccessory>({
    resolver: zodResolver(insertProductAccessorySchema),
    defaultValues: {
      tenantId: "",
      accessoryCode: "",
      accessoryName: "",
      accessoryType: "Document Feeder",
      category: null,
      manufacturer: "",
      description: null,
      standardCost: null,
      standardRepPrice: null,
      newCost: null,
      newRepPrice: null,
      upgradeCost: null,
      upgradeRepPrice: null,
      isActive: true,
      availableForAll: false,
      salesRepCredit: false,
      funding: false,
      lease: false,
    },
  });

  const editForm = useForm<Partial<ProductAccessory>>({
    resolver: zodResolver(insertProductAccessorySchema.partial()),
    defaultValues: {},
  });

  const onSubmit = (data: InsertProductAccessory) => {
    console.log("Submitting accessory data:", data);
    console.log("Form errors:", form.formState.errors);
    createAccessoryMutation.mutate(data);
  };

  const onEditSubmit = (data: Partial<ProductAccessory>) => {
    if (selectedAccessory) {
      updateAccessoryMutation.mutate({ id: selectedAccessory.id, data });
    }
  };

  // Populate edit form when selectedAccessory changes
  useEffect(() => {
    if (selectedAccessory) {
      editForm.reset({
        accessoryCode: selectedAccessory.accessoryCode,
        accessoryName: selectedAccessory.accessoryName,
        category: selectedAccessory.category,
        description: selectedAccessory.description,
        msrp: selectedAccessory.msrp,
        repPrice: selectedAccessory.repPrice,
        isRequired: selectedAccessory.isRequired,
        isActive: selectedAccessory.isActive,
      });
    }
  }, [selectedAccessory, editForm]);

  // Get unique manufacturers from models
  const manufacturers = Array.from(new Set(models.map(m => m.manufacturer).filter(Boolean)));

  // Filter models by selected manufacturer
  const filteredModels = selectedManufacturer === "all" 
    ? models 
    : models.filter(m => m.manufacturer === selectedManufacturer);

  // Filter accessories by search and manufacturer
  const filteredAccessories = accessories.filter(accessory => {
    const matchesSearch = accessory.accessoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         accessory.accessoryCode.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedManufacturer === "all") return matchesSearch;
    
    // Find the model this accessory belongs to and check manufacturer
    const relatedModel = models.find(m => m.id === accessory.modelId);
    const matchesManufacturer = relatedModel?.manufacturer === selectedManufacturer;
    
    return matchesSearch && matchesManufacturer;
  });

  const formatCurrency = (value: string | null) => {
    if (!value) return "$0.00";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(value));
  };

  const AccessoryCard = ({ accessory }: { accessory: ProductAccessory }) => {
    const relatedModel = models.find(m => m.id === accessory.modelId);
    
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">{accessory.accessoryName}</CardTitle>
              <CardDescription>
                <span className="font-medium">{accessory.accessoryCode}</span>
                {relatedModel && <span className="ml-2 text-muted-foreground">• {relatedModel.productName}</span>}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {accessory.isRequired && (
                <Badge variant="destructive">Required</Badge>
              )}
              {accessory.isActive ? (
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
            <Badge variant="outline">{accessory.category}</Badge>
            {relatedModel?.manufacturer && <Badge variant="outline">{relatedModel.manufacturer}</Badge>}
          </div>

          {accessory.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {accessory.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">MSRP</span>
              </div>
              <p className="text-lg font-bold">{formatCurrency(accessory.msrp)}</p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">Rep Price</span>
              <p className="text-lg font-bold text-green-600">{formatCurrency(accessory.repPrice)}</p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Model: {relatedModel?.productCode || 'Unknown'}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedAccessory(accessory)}
            >
              <Edit3 className="h-4 w-4 mr-1" />
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout title="Product Accessories" description="Manage accessory products and configurations">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Product Accessories</h1>
            <p className="text-muted-foreground">
              Manage accessories and options for your copier models
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Accessory
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Price Book List: Accessory</DialogTitle>
                <DialogDescription>
                  Create a new accessory and assign it to multiple product models
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Information Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Information</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="accessoryName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Saddle Stitching Finisher" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Product Type</label>
                        <Select value="Accessory" disabled>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Accessory">Accessory</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="accessoryCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Code <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="FINISHER-SR5020" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Record Type</label>
                        <div className="text-sm text-blue-600">Accessory</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="accessoryType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Accessory Type</FormLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Document Feeder">Document Feeder</SelectItem>
                                <SelectItem value="Finisher">Finisher</SelectItem>
                                <SelectItem value="Paper Handling">Paper Handling</SelectItem>
                                <SelectItem value="Security">Security</SelectItem>
                                <SelectItem value="Connectivity">Connectivity</SelectItem>
                                <SelectItem value="Storage">Storage</SelectItem>
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
                                <SelectItem value="Xerox">Xerox</SelectItem>
                                <SelectItem value="Konica Minolta">Konica Minolta</SelectItem>
                                <SelectItem value="HP">HP</SelectItem>
                                <SelectItem value="Brother">Brother</SelectItem>
                                <SelectItem value="Lexmark">Lexmark</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <FormControl>
                              <Input placeholder="Finishing Products" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-3">
                        <label className="text-sm font-medium">Options</label>
                        <div className="space-y-2">
                          <FormField
                            control={form.control}
                            name="salesRepCredit"
                            render={({ field }) => (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  checked={!!field.value}
                                  onCheckedChange={field.onChange}
                                />
                                <label className="text-sm">Sales Rep Credit</label>
                              </div>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="funding"
                            render={({ field }) => (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  checked={!!field.value}
                                  onCheckedChange={field.onChange}
                                />
                                <label className="text-sm">Funding</label>
                              </div>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="lease"
                            render={({ field }) => (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  checked={!!field.value}
                                  onCheckedChange={field.onChange}
                                />
                                <label className="text-sm">Lease</label>
                              </div>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                            <label className="text-sm font-medium">Active</label>
                          </div>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="availableForAll"
                        render={({ field }) => (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                            <label className="text-sm font-medium">Available for All</label>
                          </div>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Detail Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Detail</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Summary</label>
                        <Textarea
                          placeholder="Brief summary of the accessory..."
                          className="mt-1"
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
                                placeholder="Detailed description of the accessory and its capabilities..."
                                value={field.value || ""}
                                onChange={field.onChange}
                                rows={4}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Pricing Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Pricing Information</h3>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="standardCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Standard Cost</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="5500.00" 
                                value={field.value || ""} 
                                onChange={field.onChange} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="standardRepPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Standard Rep Price</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="6800.00" 
                                value={field.value || ""} 
                                onChange={field.onChange} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div></div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="newCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Cost</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="5200.00" 
                                value={field.value || ""} 
                                onChange={field.onChange} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="newRepPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Rep Price</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="6500.00" 
                                value={field.value || ""} 
                                onChange={field.onChange} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div></div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="upgradeCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Upgrade Cost</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="4800.00" 
                                value={field.value || ""} 
                                onChange={field.onChange} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="upgradeRepPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Upgrade Rep Price</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="6000.00" 
                                value={field.value || ""} 
                                onChange={field.onChange} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div></div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createAccessoryMutation.isPending}
                      onClick={() => console.log("Submit button clicked", { isValid: form.formState.isValid, errors: form.formState.errors })}
                    >
                      {createAccessoryMutation.isPending ? "Creating..." : "Create Accessory"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search accessories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
            <SelectTrigger className="w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Manufacturers</SelectItem>
              {manufacturers.map(manufacturer => (
                <SelectItem key={manufacturer} value={manufacturer}>{manufacturer}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Accessories Grid */}
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
        ) : filteredAccessories.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-8">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Accessories Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || selectedManufacturer !== "all" 
                ? "No accessories match your current filters. Try adjusting your search criteria."
                : "Get started by adding your first accessory to the catalog."
              }
            </p>
            {!searchTerm && selectedManufacturer === "all" && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Accessory
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAccessories.map((accessory) => (
              <AccessoryCard key={accessory.id} accessory={accessory} />
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredAccessories.length} of {accessories.length} accessories
          </span>
          <span>
            {accessories.filter(a => a.isActive).length} active accessories
          </span>
        </div>

        {/* Edit Accessory Dialog */}
        <Dialog open={!!selectedAccessory} onOpenChange={() => setSelectedAccessory(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Product Accessory</DialogTitle>
              <DialogDescription>
                Update {selectedAccessory?.accessoryName} details and pricing information
              </DialogDescription>
            </DialogHeader>
            {selectedAccessory && (
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="accessoryCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Accessory Code</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="accessoryName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Accessory Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                            <SelectItem value="Finishing">Finishing</SelectItem>
                            <SelectItem value="Paper Handling">Paper Handling</SelectItem>
                            <SelectItem value="Connectivity">Connectivity</SelectItem>
                            <SelectItem value="Security">Security</SelectItem>
                            <SelectItem value="Storage">Storage</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
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
                    <FormField
                      control={editForm.control}
                      name="repPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rep Price ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" value={field.value || ""} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <FormField
                      control={editForm.control}
                      name="isRequired"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Switch
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium">Required Accessory</FormLabel>
                        </FormItem>
                      )}
                    />
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
                          <FormLabel className="text-sm font-medium">Active</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setSelectedAccessory(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateAccessoryMutation.isPending}>
                      {updateAccessoryMutation.isPending ? "Saving..." : "Save Changes"}
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