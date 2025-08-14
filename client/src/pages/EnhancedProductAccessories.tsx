import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Package, Edit3, Tag, DollarSign, Filter, Link2, Trash2, Check, X } from "lucide-react";
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
import { 
  insertProductAccessorySchema, 
  insertAccessoryModelCompatibilitySchema,
  type ProductAccessory, 
  type InsertProductAccessory, 
  type ProductModel,
  type AccessoryModelCompatibility,
  type InsertAccessoryModelCompatibility
} from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";

export default function EnhancedProductAccessories() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [compatibilityDialogOpen, setCompatibilityDialogOpen] = useState(false);
  const [selectedAccessory, setSelectedAccessory] = useState<ProductAccessory | null>(null);
  const [editingAccessory, setEditingAccessory] = useState<ProductAccessory | null>(null);

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

  // Filter models by manufacturer and remove duplicates
  const getAvailableModels = () => {
    if (!selectedAccessory?.manufacturer) return [];
    
    const manufacturerModels = models.filter(model => 
      model.manufacturer === selectedAccessory.manufacturer
    );
    
    // Remove already compatible models
    const availableModels = manufacturerModels.filter(model => 
      !compatibilities.some(comp => comp.modelId === model.id)
    );
    
    // Remove duplicates based on modelName
    const uniqueModels = availableModels.reduce((acc, model) => {
      const exists = acc.find(m => m.modelName === model.modelName);
      if (!exists) {
        acc.push(model);
      }
      return acc;
    }, [] as ProductModel[]);
    
    return uniqueModels;
  };

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

  const compatibilityForm = useForm<InsertAccessoryModelCompatibility>({
    resolver: zodResolver(insertAccessoryModelCompatibilitySchema),
    defaultValues: {
      isRequired: false,
      isOptional: true,
      installationNotes: "",
    },
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
    onError: () => {
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
      setEditingAccessory(null);
      toast({
        title: "Success",
        description: "Product accessory updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update product accessory",
        variant: "destructive",
      });
    },
  });

  const createCompatibilityMutation = useMutation({
    mutationFn: async (data: InsertAccessoryModelCompatibility) => {
      return await apiRequest('/api/accessory-model-compatibility', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accessories', selectedAccessory?.id, 'compatibility'] });
      compatibilityForm.reset();
      toast({
        title: "Success",
        description: "Accessory compatibility added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add compatibility",
        variant: "destructive",
      });
    },
  });

  const deleteCompatibilityMutation = useMutation({
    mutationFn: async ({ accessoryId, modelId }: { accessoryId: string; modelId: string }) => {
      return await apiRequest(`/api/accessory-model-compatibility/${accessoryId}/${modelId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accessories', selectedAccessory?.id, 'compatibility'] });
      toast({
        title: "Success",
        description: "Compatibility removed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove compatibility",
        variant: "destructive",
      });
    },
  });

  const filteredAccessories = accessories.filter(accessory => {
    const matchesSearch = !searchTerm || 
      accessory.accessoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      accessory.accessoryCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesManufacturer = selectedManufacturer === "all" || accessory.manufacturer === selectedManufacturer;
    const matchesType = selectedType === "all" || accessory.accessoryType === selectedType;
    return matchesSearch && matchesManufacturer && matchesType;
  });

  const manufacturers = Array.from(new Set(accessories.map(a => a.manufacturer).filter(Boolean)));
  const accessoryTypes = Array.from(new Set(accessories.map(a => a.accessoryType).filter(Boolean)));

  const onSubmit = (data: InsertProductAccessory) => {
    if (editingAccessory) {
      updateAccessoryMutation.mutate({ id: editingAccessory.id, data });
    } else {
      createAccessoryMutation.mutate(data);
    }
  };

  const onCompatibilitySubmit = (data: InsertAccessoryModelCompatibility) => {
    if (selectedAccessory) {
      createCompatibilityMutation.mutate({
        ...data,
        accessoryId: selectedAccessory.id,
      });
    }
  };

  const handleEditAccessory = (accessory: ProductAccessory) => {
    setEditingAccessory(accessory);
    form.reset(accessory);
    setDialogOpen(true);
  };

  const handleNewAccessory = () => {
    setEditingAccessory(null);
    form.reset();
    setDialogOpen(true);
  };

  const handleViewCompatibility = (accessory: ProductAccessory) => {
    setSelectedAccessory(accessory);
    setCompatibilityDialogOpen(true);
  };

  const getCompatibleModelNames = (accessoryId: string) => {
    const accessoryCompatibilities = compatibilities.filter(c => c.accessoryId === accessoryId);
    return accessoryCompatibilities
      .map(comp => models.find(m => m.id === comp.modelId)?.modelName)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-8" data-testid="enhanced-product-accessories-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="page-title">Product Accessories</h1>
            <p className="text-muted-foreground" data-testid="page-description">
              Manage your product accessory catalog with model compatibility
            </p>
          </div>
          <Button onClick={handleNewAccessory} data-testid="button-create-accessory">
            <Plus className="h-4 w-4 mr-2" />
            Add Accessory
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
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
            <SelectTrigger className="w-48" data-testid="select-manufacturer">
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
            <SelectTrigger className="w-48" data-testid="select-type">
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
        </div>

        {/* Accessories Grid */}
        {isLoading ? (
          <div className="text-center py-8" data-testid="loading-state">Loading accessories...</div>
        ) : filteredAccessories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="empty-state">
            No accessories found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAccessories.map(accessory => (
              <Card key={accessory.id} className="relative" data-testid={`card-accessory-${accessory.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg" data-testid={`text-name-${accessory.id}`}>
                        {accessory.accessoryName}
                      </CardTitle>
                      <CardDescription data-testid={`text-code-${accessory.id}`}>
                        {accessory.accessoryCode}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditAccessory(accessory)}
                        data-testid={`button-edit-${accessory.id}`}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewCompatibility(accessory)}
                        data-testid={`button-compatibility-${accessory.id}`}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {accessory.manufacturer && (
                    <div className="flex items-center space-x-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm" data-testid={`text-manufacturer-${accessory.id}`}>
                        {accessory.manufacturer}
                      </span>
                    </div>
                  )}
                  
                  {accessory.accessoryType && (
                    <Badge variant="secondary" data-testid={`badge-type-${accessory.id}`}>
                      {accessory.accessoryType}
                    </Badge>
                  )}

                  {/* Pricing Info */}
                  <div className="space-y-2">
                    {accessory.standardRepPrice && (
                      <div className="flex justify-between items-center text-sm">
                        <span>Standard Price:</span>
                        <span className="font-medium" data-testid={`price-standard-${accessory.id}`}>
                          ${Number(accessory.standardRepPrice).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {accessory.newRepPrice && (
                      <div className="flex justify-between items-center text-sm">
                        <span>New Price:</span>
                        <span className="font-medium" data-testid={`price-new-${accessory.id}`}>
                          ${Number(accessory.newRepPrice).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status Indicators */}
                  <div className="flex flex-wrap gap-2">
                    {accessory.isActive && <Badge variant="outline" className="text-green-600">Active</Badge>}
                    {accessory.availableForAll && <Badge variant="outline">Available for All</Badge>}
                    {accessory.salesRepCredit && <Badge variant="outline">Sales Credit</Badge>}
                    {accessory.funding && <Badge variant="outline">Funding</Badge>}
                    {accessory.lease && <Badge variant="outline">Lease</Badge>}
                  </div>

                  {/* Compatible Models Preview */}
                  <div className="text-sm text-muted-foreground">
                    <div className="font-medium">Compatible Models:</div>
                    <div className="truncate" data-testid={`compatible-models-${accessory.id}`}>
                      {getCompatibleModelNames(accessory.id) || "No compatibilities set"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Accessory Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="dialog-title">
                {editingAccessory ? "Edit Accessory" : "Add New Accessory"}
              </DialogTitle>
              <DialogDescription>
                {editingAccessory ? "Update accessory details" : "Create a new product accessory"}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="accessoryCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accessory Code *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-accessory-code" />
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
                          <Input {...field} data-testid="input-accessory-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufacturer *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
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
                            <SelectItem value="Sharp">Sharp</SelectItem>
                            <SelectItem value="Brother">Brother</SelectItem>
                            <SelectItem value="Kyocera">Kyocera</SelectItem>
                            <SelectItem value="Lexmark">Lexmark</SelectItem>
                            <SelectItem value="Toshiba">Toshiba</SelectItem>
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
                        <FormLabel>Accessory Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-accessory-type">
                              <SelectValue placeholder="Select accessory type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Document Feeder">Document Feeder</SelectItem>
                            <SelectItem value="Paper Tray">Paper Tray</SelectItem>
                            <SelectItem value="Finisher">Finisher</SelectItem>
                            <SelectItem value="Stapler">Stapler</SelectItem>
                            <SelectItem value="Hole Punch">Hole Punch</SelectItem>
                            <SelectItem value="Booklet Maker">Booklet Maker</SelectItem>
                            <SelectItem value="Duplex Unit">Duplex Unit</SelectItem>
                            <SelectItem value="Memory Module">Memory Module</SelectItem>
                            <SelectItem value="Fax Module">Fax Module</SelectItem>
                            <SelectItem value="Network Card">Network Card</SelectItem>
                            <SelectItem value="Hard Drive">Hard Drive</SelectItem>
                            <SelectItem value="Stand">Stand</SelectItem>
                            <SelectItem value="Caster Base">Caster Base</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="partNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Part Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-part-number" />
                        </FormControl>
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
                          <Input {...field} data-testid="input-category" />
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
                        <Textarea {...field} data-testid="textarea-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />
                
                {/* Pricing Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Pricing</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="standardCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Standard Cost</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" data-testid="input-standard-cost" />
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
                            <Input {...field} type="number" step="0.01" data-testid="input-standard-rep-price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="newCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Cost</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" data-testid="input-new-cost" />
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
                            <Input {...field} type="number" step="0.01" data-testid="input-new-rep-price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="upgradeCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Upgrade Cost</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" data-testid="input-upgrade-cost" />
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
                            <Input {...field} type="number" step="0.01" data-testid="input-upgrade-rep-price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />
                
                {/* Status & Options */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Status & Options</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Active</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-active" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="availableForAll"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Available for All</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-available-for-all" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="salesRepCredit"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Sales Rep Credit</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-sales-rep-credit" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="funding"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Funding</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-funding" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="lease"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Lease</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-lease" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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
              {/* Add New Compatibility */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Add Model Compatibility</h3>
                <Form {...compatibilityForm}>
                  <form onSubmit={compatibilityForm.handleSubmit(onCompatibilitySubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={compatibilityForm.control}
                        name="modelId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Compatible Model *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-compatible-model">
                                  <SelectValue placeholder="Select a model" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(() => {
                                  const availableModels = getAvailableModels();
                                  
                                  if (availableModels.length === 0) {
                                    return (
                                      <div className="p-2 text-muted-foreground text-sm">
                                        {selectedAccessory?.manufacturer 
                                          ? `No compatible ${selectedAccessory.manufacturer} models available`
                                          : "Please set accessory manufacturer first"
                                        }
                                      </div>
                                    );
                                  }
                                  
                                  return availableModels.map(model => (
                                    <SelectItem key={model.id} value={model.id}>
                                      {model.modelName} ({model.productType || model.category}) - {model.manufacturer}
                                    </SelectItem>
                                  ));
                                })()}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="space-y-3">
                        <FormField
                          control={compatibilityForm.control}
                          name="isRequired"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox 
                                  checked={field.value} 
                                  onCheckedChange={field.onChange} 
                                  data-testid="checkbox-is-required"
                                />
                              </FormControl>
                              <FormLabel>Required Accessory</FormLabel>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={compatibilityForm.control}
                          name="isOptional"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox 
                                  checked={field.value} 
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-is-optional"
                                />
                              </FormControl>
                              <FormLabel>Optional Accessory</FormLabel>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <FormField
                      control={compatibilityForm.control}
                      name="installationNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Installation Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Any special installation requirements or notes..."
                              data-testid="textarea-installation-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      disabled={createCompatibilityMutation.isPending}
                      data-testid="button-add-compatibility"
                    >
                      Add Compatibility
                    </Button>
                  </form>
                </Form>
              </div>

              {/* Existing Compatibilities */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Current Compatibilities</h3>
                {compatibilities.length === 0 ? (
                  <p className="text-muted-foreground" data-testid="no-compatibilities">
                    No model compatibilities set for this accessory
                  </p>
                ) : (
                  <div className="space-y-2">
                    {compatibilities.map(compatibility => {
                      const model = models.find(m => m.id === compatibility.modelId);
                      return (
                        <div 
                          key={`${compatibility.accessoryId}-${compatibility.modelId}`} 
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`compatibility-${compatibility.id}`}
                        >
                          <div className="flex-1">
                            <div className="font-medium" data-testid={`model-name-${compatibility.id}`}>
                              {model?.modelName || 'Unknown Model'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {model?.manufacturer} • {model?.productType || model?.category || 'MFP'}
                            </div>
                            {compatibility.installationNotes && (
                              <div className="text-sm text-muted-foreground mt-1">
                                Notes: {compatibility.installationNotes}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {compatibility.isRequired && (
                              <Badge variant="destructive" size="sm">Required</Badge>
                            )}
                            {compatibility.isOptional && (
                              <Badge variant="secondary" size="sm">Optional</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteCompatibilityMutation.mutate({
                                accessoryId: compatibility.accessoryId,
                                modelId: compatibility.modelId
                              })}
                              data-testid={`button-remove-${compatibility.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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