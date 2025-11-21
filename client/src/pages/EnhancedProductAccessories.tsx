import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Link as LinkIcon, Settings } from "lucide-react";
import { insertProductAccessorySchema, type ProductAccessory, type InsertProductAccessory, type ProductModel, type AccessoryModelCompatibility, type InsertAccessoryModelCompatibility } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";
import ManagementToolbar from "@/components/product-management/ManagementToolbar";

export default function EnhancedProductAccessories() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [compatibilityDialogOpen, setCompatibilityDialogOpen] = useState(false);
  const [selectedAccessory, setSelectedAccessory] = useState<ProductAccessory | null>(null);
  const [editingAccessory, setEditingAccessory] = useState<ProductAccessory | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accessories = [], isLoading } = useQuery<ProductAccessory[]>({
    queryKey: ['/api/product-accessories'],
  });

  const { data: models = [] } = useQuery<ProductModel[]>({
    queryKey: ['/api/product-models'],
  });

  // Get compatibility for selected accessory
  const { data: compatibilities = [] } = useQuery<AccessoryModelCompatibility[]>({
    queryKey: ['/api/accessories', selectedAccessory?.id, 'compatibility'],
    enabled: !!selectedAccessory?.id,
  });

  const form = useForm<InsertProductAccessory>({
    resolver: zodResolver(insertProductAccessorySchema),
    defaultValues: {
      accessoryCode: "",
      accessoryName: "",
      accessoryType: "",
      manufacturer: "",
      category: "",
      description: "",
      standardCost: "",
      standardRepPrice: "",
      newCost: "",
      newRepPrice: "",
      upgradeCost: "",
      upgradeRepPrice: "",
      partNumber: "",
      weight: "",
      dimensions: "",
      warrantyPeriod: "",
      isActive: true,
      availableForAll: false,
      salesRepCredit: false,
      funding: false,
      lease: false,
    },
  });

  const createAccessoryMutation = useMutation({
    mutationFn: async (data: InsertProductAccessory) => {
      return await apiRequest('/api/product-accessories', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-accessories'] });
      toast({ title: "Accessory created successfully" });
      form.reset();
      setDialogOpen(false);
    },
    onError: (error) => {
      toast({ 
        title: "Error creating accessory", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    },
  });

  const updateAccessoryMutation = useMutation({
    mutationFn: async (data: InsertProductAccessory) => {
      return await apiRequest(`/api/product-accessories/${editingAccessory!.id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-accessories'] });
      toast({ title: "Accessory updated successfully" });
      form.reset();
      setDialogOpen(false);
      setEditingAccessory(null);
    },
    onError: (error) => {
      toast({ 
        title: "Error updating accessory", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    },
  });

  const deleteAccessoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/product-accessories/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-accessories'] });
      setSelectedIds(new Set());
      toast({ title: 'Accessory deleted' });
    },
    onError: (error) => {
      toast({ title: 'Error deleting accessory', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  });

  // Mutations for compatibility management
  const createCompatibilityMutation = useMutation({
    mutationFn: async (data: InsertAccessoryModelCompatibility) => {
      return await apiRequest(`/api/accessories/${data.accessoryId}/compatibility`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accessories', selectedAccessory?.id, 'compatibility'] });
      toast({ title: "Model linked successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error linking model", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    },
  });

  const deleteCompatibilityMutation = useMutation({
    mutationFn: async ({ accessoryId, modelId }: { accessoryId: string; modelId: string }) => {
      return await apiRequest(`/api/accessories/${accessoryId}/compatibility/${modelId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accessories', selectedAccessory?.id, 'compatibility'] });
      toast({ title: "Model unlinked successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error unlinking model", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: InsertProductAccessory) => {
    if (editingAccessory) {
      updateAccessoryMutation.mutate(data);
    } else {
      createAccessoryMutation.mutate(data);
    }
  };

  const handleEditAccessory = (accessory: ProductAccessory) => {
    setEditingAccessory(accessory);
    form.reset(accessory);
    setDialogOpen(true);
  };

  const handleManageCompatibility = (accessory: ProductAccessory) => {
    setSelectedAccessory(accessory);
    setCompatibilityDialogOpen(true);
  };

  const filteredAccessories = accessories.filter(accessory => {
    const matchesSearch = accessory.accessoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         accessory.accessoryCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesManufacturer = selectedManufacturer === "all" || accessory.manufacturer === selectedManufacturer;
    const matchesType = selectedType === "all" || accessory.accessoryType === selectedType;
    
    return matchesSearch && matchesManufacturer && matchesType;
  });

  const manufacturers = Array.from(new Set(accessories.map(a => a.manufacturer).filter(Boolean)));
  const accessoryTypes = Array.from(new Set(accessories.map(a => a.accessoryType).filter(Boolean)));

  const toggleItemSelection = (id: string) => {
    const copy = new Set(selectedIds);
    if (copy.has(id)) copy.delete(id); else copy.add(id);
    setSelectedIds(copy);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try { await apiRequest(`/api/product-accessories/${id}`, 'DELETE'); } catch {}
    }
    queryClient.invalidateQueries({ queryKey: ['/api/product-accessories'] });
    setSelectedIds(new Set());
    setBulkMode(false);
    toast({ title: 'Deleted', description: `Deleted ${ids.length} accessories` });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading accessories...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <ManagementToolbar
          title="Product Accessories"
          description="Manage product accessories and model compatibility"
          searchPlaceholder="Search accessories..."
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onAddClick={() => setDialogOpen(true)}
          productTypeForImport="product-accessories"
          bulkMode={bulkMode}
          onToggleBulkMode={() => setBulkMode(!bulkMode)}
          selectedCount={selectedIds.size}
          totalCount={accessories.length}
          onBulkDelete={handleBulkDelete}
        />

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search accessories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          
          <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
            <SelectTrigger data-testid="select-manufacturer">
              <SelectValue placeholder="All Manufacturers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Manufacturers</SelectItem>
              {manufacturers.map(manufacturer => (
                <SelectItem key={manufacturer} value={manufacturer}>
                  {manufacturer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger data-testid="select-type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {accessoryTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center text-sm text-muted-foreground">
            {filteredAccessories.length} of {accessories.length} accessories
          </div>
        </div>

        {/* Accessories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAccessories.map(accessory => (
            <Card key={accessory.id} className="hover:shadow-md transition-shadow" data-testid={`accessory-card-${accessory.id}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    {bulkMode && (
                      <Checkbox checked={selectedIds.has(accessory.id)} onCheckedChange={() => toggleItemSelection(accessory.id)} />
                    )}
                    <CardTitle className="text-lg font-semibold">{accessory.accessoryName}</CardTitle>
                  </div>
                  <Badge variant={accessory.isActive ? "default" : "secondary"}>
                    {accessory.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Code: {accessory.accessoryCode}</p>
                  <p className="text-sm text-muted-foreground">{accessory.manufacturer} • {accessory.accessoryType}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Standard Cost:</span>
                    <p>${accessory.standardCost}</p>
                  </div>
                  <div>
                    <span className="font-medium">Rep Price:</span>
                    <p>${accessory.standardRepPrice}</p>
                  </div>
                </div>
                
                {accessory.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{accessory.description}</p>
                )}
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleEditAccessory(accessory)}
                    data-testid={`button-edit-${accessory.id}`}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleManageCompatibility(accessory)}
                    data-testid={`button-compatibility-${accessory.id}`}
                  >
                    <LinkIcon className="h-4 w-4 mr-1" />
                    Models
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => deleteAccessoryMutation.mutate(accessory.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredAccessories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No accessories found matching your criteria</p>
          </div>
        )}

        {/* Add/Edit Accessory Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="accessory-dialog-title">
                {editingAccessory ? "Edit Accessory" : "Add New Accessory"}
              </DialogTitle>
              <DialogDescription>
                {editingAccessory ? "Update accessory information" : "Create a new product accessory"}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="accessoryCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accessory Code *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ACC-001" data-testid="input-accessory-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="accessoryName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accessory Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Finisher Unit" data-testid="input-accessory-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufacturer *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-manufacturer">
                              <SelectValue placeholder="Select manufacturer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Canon">Canon</SelectItem>
                            <SelectItem value="HP">HP</SelectItem>
                            <SelectItem value="Xerox">Xerox</SelectItem>
                            <SelectItem value="Ricoh">Ricoh</SelectItem>
                            <SelectItem value="Konica Minolta">Konica Minolta</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="accessoryType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-accessory-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Finisher">Finisher</SelectItem>
                            <SelectItem value="Feeder">Feeder</SelectItem>
                            <SelectItem value="Tray">Tray</SelectItem>
                            <SelectItem value="Stand">Stand</SelectItem>
                            <SelectItem value="Memory">Memory</SelectItem>
                            <SelectItem value="Network">Network</SelectItem>
                            <SelectItem value="Security">Security</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional category" data-testid="input-category" />
                        </FormControl>
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
                        <Textarea {...field} placeholder="Accessory description..." data-testid="textarea-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="standardCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Standard Cost</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="0.00" data-testid="input-standard-cost" />
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
                          <Input {...field} placeholder="0.00" data-testid="input-standard-rep-price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="partNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Part Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="PN123456" data-testid="input-part-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="5.2 lbs" data-testid="input-weight" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="dimensions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dimensions</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="12x8x6 inches" data-testid="input-dimensions" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="warrantyPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Period</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="12 months" data-testid="input-warranty" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createAccessoryMutation.isPending || updateAccessoryMutation.isPending}
                    data-testid="button-save"
                  >
                    {editingAccessory ? "Update" : "Create"} Accessory
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Model Compatibility Dialog */}
        <Dialog open={compatibilityDialogOpen} onOpenChange={setCompatibilityDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="compatibility-dialog-title">
                Model Compatibility - {selectedAccessory?.accessoryName}
              </DialogTitle>
              <DialogDescription>
                Manage which models this accessory is compatible with
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Available Models for Linking */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Available {selectedAccessory?.manufacturer} Models</h3>
                <p className="text-sm text-muted-foreground">
                  Link this accessory to compatible models from the same manufacturer
                </p>
                
                {!selectedAccessory?.manufacturer ? (
                  <p className="text-muted-foreground" data-testid="no-manufacturer">
                    Please set the accessory manufacturer first to see available models
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {(() => {
                      const manufacturerModels = models.filter(model => 
                        model.manufacturer === selectedAccessory.manufacturer
                      );
                      
                      if (manufacturerModels.length === 0) {
                        return (
                          <p className="text-muted-foreground" data-testid="no-models">
                            No {selectedAccessory.manufacturer} models found in the system
                          </p>
                        );
                      }
                      
                      return manufacturerModels.map(model => {
                        const isLinked = compatibilities.some(comp => comp.modelId === model.id);
                        
                        return (
                          <div 
                            key={model.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                            data-testid={`model-${model.id}`}
                          >
                            <div className="flex-1">
                              <div className="font-medium" data-testid={`model-name-${model.id}`}>
                                {model.modelName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {model.manufacturer} • {model.productType || model.category || 'MFP'}
                              </div>
                            </div>
                            <Button
                              variant={isLinked ? "destructive" : "default"}
                              size="sm"
                              onClick={() => {
                                if (isLinked) {
                                  // Unlink the model
                                  const compatibility = compatibilities.find(comp => comp.modelId === model.id);
                                  if (compatibility) {
                                    deleteCompatibilityMutation.mutate({
                                      accessoryId: compatibility.accessoryId,
                                      modelId: compatibility.modelId
                                    });
                                  }
                                } else {
                                  // Link the model
                                  createCompatibilityMutation.mutate({
                                    accessoryId: selectedAccessory.id,
                                    modelId: model.id,
                                    isRequired: false,
                                    isOptional: true,
                                    installationNotes: ""
                                  });
                                }
                              }}
                              disabled={createCompatibilityMutation.isPending || deleteCompatibilityMutation.isPending}
                              data-testid={`button-${isLinked ? 'unlink' : 'link'}-${model.id}`}
                            >
                              {isLinked ? 'Unlink' : 'Link'}
                            </Button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* Current Linked Models Summary */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Current Compatibilities</h3>
                {compatibilities.length === 0 ? (
                  <p className="text-muted-foreground" data-testid="no-compatibilities">
                    No models linked to this accessory yet
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {compatibilities.map(compatibility => {
                      const model = models.find(m => m.id === compatibility.modelId);
                      return (
                        <div 
                          key={`${compatibility.accessoryId}-${compatibility.modelId}`} 
                          className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded"
                          data-testid={`linked-model-${compatibility.id}`}
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium text-green-800 dark:text-green-200">
                              {model?.modelName || 'Unknown Model'}
                            </div>
                            <div className="text-xs text-green-600 dark:text-green-400">
                              {model?.manufacturer} • {model?.productType || model?.category || 'MFP'}
                            </div>
                          </div>
                          <div className="text-xs text-green-600 dark:text-green-400">
                            ✓ Linked
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={() => setCompatibilityDialogOpen(false)}
                data-testid="button-close-compatibility"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}