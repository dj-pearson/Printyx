import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Search, 
  Edit, 
  Save, 
  X, 
  DollarSign,
  TrendingUp,
  Settings
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import { useAuth } from "@/hooks/useAuth";

// Form schemas
const productMarkupSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  productType: z.string().min(1, "Product type is required"),
  dealerCost: z.string().min(1, "Dealer cost is required"),
  companyMarkupPercentage: z.string().min(1, "Company markup percentage is required"),
  minimumSalePrice: z.string().optional(),
  suggestedRetailPrice: z.string().optional(),
});

type ProductMarkupFormData = z.infer<typeof productMarkupSchema>;

interface ProductWithPricing {
  id: string;
  name: string;
  modelNumber?: string;
  category: string;
  dealerCost?: string;
  companyMarkupPercentage?: string;
  companyPrice?: string;
  minimumSalePrice?: string;
  suggestedRetailPrice?: string;
  hasCustomPricing: boolean;
}

export default function ProductManagementHub() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [isMarkupDialogOpen, setIsMarkupDialogOpen] = useState(false);
  const [currentEditProduct, setCurrentEditProduct] = useState<ProductWithPricing | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Check if user is company admin
  const isCompanyAdmin = user?.role?.code === 'COMPANY_ADMIN' || user?.role?.canAccessAllTenants;

  // Fetch all products with pricing information
  const { data: products = [], isLoading } = useQuery<ProductWithPricing[]>({
    queryKey: ["/api/products/with-pricing"],
  });

  // Fetch company pricing settings
  const { data: companySettings } = useQuery({
    queryKey: ["/api/pricing/company-settings"],
  });

  // Fetch product pricing for inline editing
  const { data: productPricing = [] } = useQuery({
    queryKey: ["/api/pricing/products"],
  });

  // Update product pricing mutation
  const updateProductPricingMutation = useMutation({
    mutationFn: async (data: ProductMarkupFormData) => {
      const companyPrice = calculateCompanyPrice(
        parseFloat(data.dealerCost),
        parseFloat(data.companyMarkupPercentage)
      );
      
      return apiRequest("/api/pricing/products", "POST", {
        ...data,
        companyPrice: companyPrice.toString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products/with-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/products"] });
      toast({
        title: "Success",
        description: "Product pricing updated successfully",
      });
      setIsMarkupDialogOpen(false);
      setCurrentEditProduct(null);
    },
  });

  // Bulk update pricing mutation
  const bulkUpdatePricingMutation = useMutation({
    mutationFn: async (updates: { productId: string; markupPercentage: string }[]) => {
      return apiRequest("/api/pricing/products/bulk-update", "POST", { updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products/with-pricing"] });
      toast({
        title: "Success",
        description: "Bulk pricing updates applied successfully",
      });
    },
  });

  // Form setup
  const markupForm = useForm<ProductMarkupFormData>({
    resolver: zodResolver(productMarkupSchema),
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

  const formatCurrency = (value: string | number | undefined): string => {
    if (!value) return "$0.00";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.modelNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);

  // Handle inline editing
  const handleInlineEdit = (product: ProductWithPricing) => {
    setCurrentEditProduct(product);
    markupForm.reset({
      productId: product.id,
      productType: product.category,
      dealerCost: product.dealerCost || "",
      companyMarkupPercentage: product.companyMarkupPercentage || companySettings?.defaultMarkupPercentage || "20",
      minimumSalePrice: product.minimumSalePrice || "",
      suggestedRetailPrice: product.suggestedRetailPrice || "",
    });
    setIsMarkupDialogOpen(true);
  };

  // Handle form submission
  const onMarkupSubmit = (data: ProductMarkupFormData) => {
    updateProductPricingMutation.mutate(data);
  };

  // Apply default markup to all products without custom pricing
  const applyDefaultMarkupToAll = () => {
    const productsWithoutPricing = products.filter(p => !p.hasCustomPricing);
    const updates = productsWithoutPricing.map(p => ({
      productId: p.id,
      markupPercentage: companySettings?.defaultMarkupPercentage || "20"
    }));
    bulkUpdatePricingMutation.mutate(updates);
  };

  return (
    <MainLayout title="Product Management Hub" description="Manage products with company admin markup capabilities">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Product Management Hub</h1>
            <p className="text-gray-600">Manage products with pricing markup for company administrators</p>
          </div>
          {isCompanyAdmin && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={applyDefaultMarkupToAll}
                disabled={bulkUpdatePricingMutation.isPending}
              >
                <Settings className="h-4 w-4 mr-2" />
                Apply Default Markup
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Product Listings with Pricing Control
            </CardTitle>
            <CardDescription>
              {isCompanyAdmin 
                ? "Configure individual product markup percentages and pricing rules"
                : "View product information and current pricing"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Loading products...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Model/SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Dealer Cost</TableHead>
                    <TableHead>Markup %</TableHead>
                    <TableHead>Company Price</TableHead>
                    <TableHead>Status</TableHead>
                    {isCompanyAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.modelNumber || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{product.category}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(product.dealerCost)}</TableCell>
                      <TableCell>
                        {product.companyMarkupPercentage ? (
                          <span className="text-green-600 font-medium">
                            {product.companyMarkupPercentage}%
                          </span>
                        ) : (
                          <span className="text-gray-400">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.companyPrice ? (
                          <span className="font-medium">{formatCurrency(product.companyPrice)}</span>
                        ) : (
                          <span className="text-gray-400">Not calculated</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.hasCustomPricing ? "default" : "outline"}>
                          {product.hasCustomPricing ? "Custom Pricing" : "Default Pricing"}
                        </Badge>
                      </TableCell>
                      {isCompanyAdmin && (
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInlineEdit(product)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Set Markup
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Markup Configuration Dialog */}
        <Dialog open={isMarkupDialogOpen} onOpenChange={setIsMarkupDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configure Product Markup</DialogTitle>
              <DialogDescription>
                Set dealer cost, company markup percentage, and pricing rules for {currentEditProduct?.name}
              </DialogDescription>
            </DialogHeader>
            <Form {...markupForm}>
              <form onSubmit={markupForm.handleSubmit(onMarkupSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={markupForm.control}
                    name="dealerCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dealer Cost ($)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="150.00" type="number" step="0.01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={markupForm.control}
                    name="companyMarkupPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Markup Percentage (%)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="20.00" type="number" step="0.01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={markupForm.control}
                    name="minimumSalePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Sale Price ($)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="160.00" type="number" step="0.01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={markupForm.control}
                    name="suggestedRetailPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suggested Retail Price ($)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="200.00" type="number" step="0.01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Live calculation preview */}
                {markupForm.watch("dealerCost") && markupForm.watch("companyMarkupPercentage") && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Pricing Preview</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Dealer Cost:</span>
                        <div className="font-medium">{formatCurrency(markupForm.watch("dealerCost"))}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Company Price:</span>
                        <div className="font-medium text-green-600">
                          {formatCurrency(
                            calculateCompanyPrice(
                              parseFloat(markupForm.watch("dealerCost") || "0"),
                              parseFloat(markupForm.watch("companyMarkupPercentage") || "0")
                            )
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Markup Amount:</span>
                        <div className="font-medium text-blue-600">
                          {formatCurrency(
                            calculateCompanyPrice(
                              parseFloat(markupForm.watch("dealerCost") || "0"),
                              parseFloat(markupForm.watch("companyMarkupPercentage") || "0")
                            ) - parseFloat(markupForm.watch("dealerCost") || "0")
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsMarkupDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateProductPricingMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Markup
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}