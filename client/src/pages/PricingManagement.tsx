import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Plus, 
  Search, 
  Settings, 
  TrendingUp,
  Edit,
  Save,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import type { 
  CompanyPricingSetting, 
  ProductPricing, 
  InsertCompanyPricingSetting, 
  InsertProductPricing 
} from "@shared/schema";

// Form schemas
const companyPricingSchema = z.object({
  defaultMarkupPercentage: z.string().min(1, "Default markup percentage is required"),
  allowSalespersonOverride: z.boolean(),
  minimumGrossProfitPercentage: z.string().min(1, "Minimum gross profit percentage is required"),
});

const productPricingSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  productType: z.string().min(1, "Product type is required"),
  dealerCost: z.string().min(1, "Dealer cost is required"),
  companyMarkupPercentage: z.string().optional(),
  minimumSalePrice: z.string().optional(),
  suggestedRetailPrice: z.string().optional(),
});

type CompanyPricingFormData = z.infer<typeof companyPricingSchema>;
type ProductPricingFormData = z.infer<typeof productPricingSchema>;

export default function PricingManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<ProductPricing | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch company pricing settings
  const { data: companySettings, isLoading: isLoadingSettings } = useQuery<CompanyPricingSetting>({
    queryKey: ["/api/pricing/company-settings"],
  });

  // Fetch product pricing
  const { data: productPricing = [], isLoading: isLoadingProducts } = useQuery<ProductPricing[]>({
    queryKey: ["/api/pricing/products"],
  });

  // Fetch available products for selection
  const { data: availableProducts = [] } = useQuery({
    queryKey: ["/api/products/all"],
  });

  // Company settings mutation
  const updateCompanySettingsMutation = useMutation({
    mutationFn: async (data: CompanyPricingFormData) => {
      return apiRequest("/api/pricing/company-settings", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/company-settings"] });
      toast({
        title: "Success",
        description: "Company pricing settings updated successfully",
      });
      setIsCompanyDialogOpen(false);
    },
  });

  // Product pricing mutations
  const createProductPricingMutation = useMutation({
    mutationFn: async (data: ProductPricingFormData) => {
      const companyPrice = calculateCompanyPrice(
        parseFloat(data.dealerCost),
        data.companyMarkupPercentage ? parseFloat(data.companyMarkupPercentage) : (companySettings?.defaultMarkupPercentage ? parseFloat(companySettings.defaultMarkupPercentage) : 20)
      );
      
      return apiRequest("/api/pricing/products", "POST", {
        ...data,
        companyPrice: companyPrice.toString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/products"] });
      toast({
        title: "Success",
        description: "Product pricing created successfully",
      });
      setIsProductDialogOpen(false);
      productForm.reset();
    },
  });

  const updateProductPricingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductPricingFormData }) => {
      const companyPrice = calculateCompanyPrice(
        parseFloat(data.dealerCost),
        data.companyMarkupPercentage ? parseFloat(data.companyMarkupPercentage) : (companySettings?.defaultMarkupPercentage ? parseFloat(companySettings.defaultMarkupPercentage) : 20)
      );
      
      return apiRequest(`/api/pricing/products/${id}`, "PUT", {
        ...data,
        companyPrice: companyPrice.toString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/products"] });
      toast({
        title: "Success",
        description: "Product pricing updated successfully",
      });
      setEditingPricing(null);
    },
  });

  // Form setup with useEffect to update when data loads
  const companyForm = useForm<CompanyPricingFormData>({
    resolver: zodResolver(companyPricingSchema),
    defaultValues: {
      defaultMarkupPercentage: "20.00",
      allowSalespersonOverride: true,
      minimumGrossProfitPercentage: "5.00",
    },
  });

  // Update form when company settings load
  useEffect(() => {
    if (companySettings) {
      companyForm.reset({
        defaultMarkupPercentage: companySettings.defaultMarkupPercentage || "20.00",
        allowSalespersonOverride: companySettings.allowSalespersonOverride ?? true,
        minimumGrossProfitPercentage: companySettings.minimumGrossProfitPercentage || "5.00",
      });
    }
  }, [companySettings, companyForm]);

  const productForm = useForm<ProductPricingFormData>({
    resolver: zodResolver(productPricingSchema),
    defaultValues: {
      productId: "",
      productType: "",
      dealerCost: "",
      companyMarkupPercentage: "",
      minimumSalePrice: "",
      suggestedRetailPrice: "",
    },
  });

  // Helper functions
  const calculateCompanyPrice = (dealerCost: number, markupPercentage: number): number => {
    return dealerCost * (1 + markupPercentage / 100);
  };

  const calculateGrossProfit = (salePrice: number, companyPrice: number): number => {
    return salePrice - companyPrice;
  };

  const calculateGrossProfitPercentage = (salePrice: number, companyPrice: number): number => {
    if (companyPrice === 0) return 0;
    return ((salePrice - companyPrice) / companyPrice) * 100;
  };

  // Filter products
  const filteredPricing = productPricing.filter((pricing) => {
    return pricing.productId?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Handle form submissions
  const onCompanySubmit = (data: CompanyPricingFormData) => {
    updateCompanySettingsMutation.mutate(data);
  };

  const onProductSubmit = (data: ProductPricingFormData) => {
    if (editingPricing) {
      updateProductPricingMutation.mutate({ id: editingPricing.id, data });
    } else {
      createProductPricingMutation.mutate(data);
    }
  };

  const openEditDialog = (pricing: ProductPricing) => {
    setEditingPricing(pricing);
    productForm.reset({
      productId: pricing.productId,
      productType: pricing.productType,
      dealerCost: pricing.dealerCost || "",
      companyMarkupPercentage: pricing.companyMarkupPercentage || "",
      minimumSalePrice: pricing.minimumSalePrice || "",
      suggestedRetailPrice: pricing.suggestedRetailPrice || "",
    });
    setIsProductDialogOpen(true);
  };

  const closeProductDialog = () => {
    setIsProductDialogOpen(false);
    setEditingPricing(null);
    productForm.reset();
  };

  return (
    <MainLayout title="Pricing Management" description="Manage multi-layered pricing for products and quotes">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Pricing Management</h1>
            <p className="text-gray-600">Configure dealer costs, company markups, and salesperson profit margins</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Company Settings
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Company Pricing Settings</DialogTitle>
                  <DialogDescription>
                    Configure global pricing rules and markup percentages
                  </DialogDescription>
                </DialogHeader>
                <Form {...companyForm}>
                  <form onSubmit={companyForm.handleSubmit(onCompanySubmit)} className="space-y-4">
                    <FormField
                      control={companyForm.control}
                      name="defaultMarkupPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Markup Percentage (%)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="20.00" type="number" step="0.01" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={companyForm.control}
                      name="minimumGrossProfitPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Gross Profit Percentage (%)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="5.00" type="number" step="0.01" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={companyForm.control}
                      name="allowSalespersonOverride"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Allow Salesperson Override</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsCompanyDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={updateCompanySettingsMutation.isPending}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Settings
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingPricing(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product Pricing
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingPricing ? "Edit Product Pricing" : "Add Product Pricing"}
                  </DialogTitle>
                  <DialogDescription>
                    Set dealer cost, company markup, and pricing rules for products
                  </DialogDescription>
                </DialogHeader>
                <Form {...productForm}>
                  <form onSubmit={productForm.handleSubmit(onProductSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                      <FormField
                        control={productForm.control}
                        name="productType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select product type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="model">Equipment Model</SelectItem>
                                <SelectItem value="accessory">Accessory</SelectItem>
                                <SelectItem value="service">Service</SelectItem>
                                <SelectItem value="software">Software</SelectItem>
                                <SelectItem value="supply">Supply</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={productForm.control}
                        name="productId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter product ID or search" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                      <FormField
                        control={productForm.control}
                        name="dealerCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dealer Cost ($)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="100.00" type="number" step="0.01" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={productForm.control}
                        name="companyMarkupPercentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Markup (%) - Optional</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Use default" type="number" step="0.01" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                      <FormField
                        control={productForm.control}
                        name="minimumSalePrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Sale Price ($)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="120.00" type="number" step="0.01" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={productForm.control}
                        name="suggestedRetailPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Suggested Retail Price ($)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="150.00" type="number" step="0.01" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={closeProductDialog}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createProductPricingMutation.isPending || updateProductPricingMutation.isPending}>
                        <Save className="h-4 w-4 mr-2" />
                        {editingPricing ? "Update" : "Create"} Pricing
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Company Settings Summary */}
        {companySettings && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Company Pricing Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Default Markup</p>
                  <p className="text-lg font-semibold">{companySettings.defaultMarkupPercentage}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Minimum Profit</p>
                  <p className="text-lg font-semibold">{companySettings.minimumGrossProfitPercentage}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Salesperson Override</p>
                  <Badge variant={companySettings.allowSalespersonOverride ? "default" : "secondary"}>
                    {companySettings.allowSalespersonOverride ? "Allowed" : "Restricted"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by product ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Product Pricing List */}
        <div className="grid gap-4">
          {isLoadingProducts ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading product pricing...</p>
            </div>
          ) : filteredPricing.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No product pricing configured yet</p>
                <p className="text-sm text-gray-500">Add product pricing to get started with multi-layered pricing</p>
              </CardContent>
            </Card>
          ) : (
            filteredPricing.map((pricing) => (
              <Card key={pricing.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{pricing.productId}</h3>
                        <Badge variant="outline">{pricing.productType}</Badge>
                        <Badge variant={pricing.isActive ? "default" : "secondary"}>
                          {pricing.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-gray-600">Dealer Cost</p>
                          <p className="font-semibold">${pricing.dealerCost}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Company Price</p>
                          <p className="font-semibold text-blue-600">${pricing.companyPrice}</p>
                          {pricing.companyMarkupPercentage && (
                            <p className="text-xs text-gray-500">+{pricing.companyMarkupPercentage}%</p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Min Sale Price</p>
                          <p className="font-semibold">${pricing.minimumSalePrice || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Suggested Retail</p>
                          <p className="font-semibold text-green-600">${pricing.suggestedRetailPrice || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(pricing)}
                    >
                      <Edit className="h-4 w-4" />
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