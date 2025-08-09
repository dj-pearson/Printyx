import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Search,
  Package,
  ShoppingCart,
  Settings,
  Eye,
  CheckCircle,
  Filter,
  ArrowLeft,
  Upload,
} from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import { Link } from "wouter";

interface MasterProduct {
  id: string;
  manufacturer: string;
  modelCode: string;
  displayName: string;
  specsJson?: any;
  msrp?: number;
  dealerCost?: number;
  marginPercentage?: number;
  status: string;
  category?: string;
  productType?: string;
  itemType?: 'model' | 'accessory';
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedItemType, setSelectedItemType] = useState("all");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set()
  );
  const [masterCsvFile, setMasterCsvFile] = useState<File | null>(null);
  const [tenantCsvFile, setTenantCsvFile] = useState<File | null>(null);
  const [enableForm, setEnableForm] = useState({
    customSku: "",
    customName: "",
    dealerCost: "",
    companyPrice: "",
    markupRuleId: "",
    priceOverridden: false,
  });
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: "",
    dealerCost: "",
    marginPercentage: "",
    msrp: "",
    category: "",
    productType: "",
    status: "",
  });
  
  const [importResults, setImportResults] = useState<any>(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper: upload CSV via multipart/form-data
  const uploadCsv = async (url: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const headers: HeadersInit = {};
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("demo-authenticated") === "true"
    ) {
      headers["X-Demo-Auth"] = "true";
    }
    if (typeof window !== "undefined") {
      const tenantId =
        localStorage.getItem("demo-tenant-id") ||
        "550e8400-e29b-41d4-a716-446655440000";
      if (tenantId) headers["x-tenant-id"] = tenantId;
    }
    const res = await fetch(url, {
      method: "POST",
      body: form,
      headers,
      credentials: "include",
    });
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json();
  };

  // Fetch master catalog products
  const { data: masterProducts = [], isLoading: isLoadingMaster } = useQuery({
    queryKey: [
      "/api/catalog/models",
      {
        manufacturer: selectedManufacturer,
        search: searchTerm,
        category: selectedCategory,
        itemType: selectedItemType,
      },
    ],
    queryFn: () =>
      apiRequest(
        `/api/catalog/models?manufacturer=${selectedManufacturer}&search=${searchTerm}&category=${selectedCategory}`
      ),
  });

  // Fetch enabled products for tenant
  const { data: enabledProducts = [], isLoading: isLoadingEnabled } = useQuery({
    queryKey: ["/api/enabled-products"],
    queryFn: () => apiRequest("/api/enabled-products"),
  });

  // Fetch manufacturers list
  const { data: manufacturers = [] } = useQuery({
    queryKey: ["/api/catalog/manufacturers"],
    queryFn: () => apiRequest("/api/catalog/manufacturers"),
  });

  // Derive categories from products
  const categories = [...new Set(masterProducts.map((p: MasterProduct) => p.category).filter(Boolean))];

  // Enable single product mutation
  const enableProductMutation = useMutation({
    mutationFn: (data: { productId: string; overrides: any }) =>
      apiRequest(`/api/catalog/models/${data.productId}/enable`, {
        method: "POST",
        body: JSON.stringify(data.overrides),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enabled-products"] });
      toast({ title: "Product enabled successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error enabling product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk enable products mutation
  const bulkEnableMutation = useMutation({
    mutationFn: (data: { masterProductIds: string[]; defaultOverrides: any }) =>
      apiRequest("/api/catalog/models/bulk-enable", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/enabled-products"] });
      toast({
        title: "Products enabled",
        description: `${data.enabled} products enabled, ${data.skipped} already enabled`,
      });
      setSelectedProducts(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Error enabling products",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Enhanced CSV import mutation
  const enhancedImportMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return uploadCsv("/api/catalog/import-enhanced", file);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalog/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enabled-products"] });
      
      toast({
        title: "CSV Import Complete",
        description: `Created: ${data.summary.created}, Updated: ${data.summary.updated}, Skipped: ${data.summary.skipped}${data.summary.errors > 0 ? `, Errors: ${data.summary.errors}` : ''}`,
      });
      
      // Show detailed results
      setImportResults(data);
      setShowImportResults(true);
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update master product mutation
  const updateMasterProductMutation = useMutation({
    mutationFn: (data: { 
      id: string; 
      displayName: string; 
      dealerCost?: number; 
      marginPercentage?: number; 
      msrp?: number;
      category?: string;
      productType?: string;
      status?: string;
    }) =>
      apiRequest(`/api/catalog/models/${data.id}`, "PATCH", {
        displayName: data.displayName,
        dealerCost: data.dealerCost,
        marginPercentage: data.marginPercentage,
        msrp: data.msrp,
        category: data.category,
        productType: data.productType,
        status: data.status,
      }),
    onSuccess: () => {
      // Force refetch of all product-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/catalog/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enabled-products"] });
      queryClient.refetchQueries({ queryKey: ["/api/catalog/models"] });
      
      toast({ title: "Product updated successfully" });
      setEditingProduct(null);
      setEditForm({
        displayName: "",
        dealerCost: "",
        marginPercentage: "",
        msrp: "",
        category: "",
        productType: "",
        status: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating product",
        description: error.message,
        variant: "destructive",
      });
    },
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

  const handleEditProduct = (product: MasterProduct) => {
    setEditingProduct(product.id);
    setEditForm({
      displayName: product.displayName,
      dealerCost: product.dealerCost?.toString() || "",
      marginPercentage: product.marginPercentage?.toString() || "",
      msrp: product.msrp?.toString() || "",
      category: product.category || "",
      productType: product.productType || "",
      status: product.status || "active",
    });
  };

  const handleSaveEdit = () => {
    if (!editingProduct) return;
    
    updateMasterProductMutation.mutate({
      id: editingProduct,
      displayName: editForm.displayName,
      dealerCost: editForm.dealerCost ? parseFloat(editForm.dealerCost) : undefined,
      marginPercentage: editForm.marginPercentage ? parseFloat(editForm.marginPercentage) : undefined,
      msrp: editForm.msrp ? parseFloat(editForm.msrp) : undefined,
      category: editForm.category || undefined,
      productType: editForm.productType || undefined,
      status: editForm.status || undefined,
    });
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setEditForm({
      displayName: "",
      dealerCost: "",
      marginPercentage: "",
      msrp: "",
      category: "",
      productType: "",
      status: "",
    });
  };

  const handleBulkEnable = () => {
    if (selectedProducts.size === 0) {
      toast({ title: "No products selected", variant: "destructive" });
      return;
    }

    bulkEnableMutation.mutate({
      masterProductIds: Array.from(selectedProducts),
      defaultOverrides: {
        dealerCost: enableForm.dealerCost
          ? parseFloat(enableForm.dealerCost)
          : null,
        companyPrice: enableForm.companyPrice
          ? parseFloat(enableForm.companyPrice)
          : null,
        markupRuleId: enableForm.markupRuleId || null,
      },
    });
  };

  const isProductEnabled = (productId: string) => {
    return enabledProducts.some(
      (ep: EnabledProduct) => ep.masterProductId === productId
    );
  };



  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-4">
            <Link href="/product-hub">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Back to Product Hub</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                Master Product Catalog
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Browse Printyx's master catalog and enable products for your
                organization
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {/* Platform Admin: Import to Master Catalog */}
            <div className="flex items-center gap-2">
              <input
                id="masterCsv"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setMasterCsvFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="masterCsv">
                <Button asChild variant="outline" size="sm">
                  <span className="flex items-center gap-2 cursor-pointer">
                    <Upload className="h-4 w-4" />
                    Import Master CSV
                  </span>
                </Button>
              </label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!masterCsvFile}
                  onClick={async () => {
                    if (!masterCsvFile) return;
                    try {
                      const result = await uploadCsv(
                        "/api/catalog/models/import",
                        masterCsvFile
                      );
                      toast({
                        title: "Master catalog imported",
                        description: `${result.created ?? 0} processed`,
                      });
                      setMasterCsvFile(null);
                      // Refresh catalog
                      queryClient.invalidateQueries();
                    } catch (err: any) {
                      toast({
                        title: "Import failed",
                        description: err.message,
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Legacy
                </Button>
                <Button
                  size="sm"
                  disabled={!masterCsvFile || enhancedImportMutation.isPending}
                  onClick={() => {
                    if (masterCsvFile) {
                      enhancedImportMutation.mutate(masterCsvFile);
                      setMasterCsvFile(null);
                    }
                  }}
                >
                  {enhancedImportMutation.isPending ? "Processing..." : "Smart Import"}
                </Button>
              </div>
            </div>
            {/* Tenant: Enable from CSV with Dealer Prices */}
            <div className="flex items-center gap-2">
              <input
                id="tenantCsv"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setTenantCsvFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="tenantCsv">
                <Button asChild variant="outline" size="sm">
                  <span className="flex items-center gap-2 cursor-pointer">
                    <Upload className="h-4 w-4" />
                    Enable From CSV
                  </span>
                </Button>
              </label>
              <Button
                size="sm"
                disabled={!tenantCsvFile}
                onClick={async () => {
                  if (!tenantCsvFile) return;
                  try {
                    const result = await uploadCsv(
                      "/api/catalog/models/enable-from-csv",
                      tenantCsvFile
                    );
                    toast({
                      title: "Products enabled",
                      description: `${result.enabled ?? 0} enabled`,
                    });
                    setTenantCsvFile(null);
                    queryClient.invalidateQueries({
                      queryKey: ["/api/enabled-products"],
                    });
                  } catch (err: any) {
                    toast({
                      title: "Enable failed",
                      description: err.message,
                      variant: "destructive",
                    });
                  }
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="browse" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger
              value="browse"
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <Search className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Browse Catalog</span>
              <span className="sm:hidden">Browse</span>
            </TabsTrigger>
            <TabsTrigger
              value="enabled"
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Enabled Products</span>
              <span className="sm:hidden">Enabled</span>
            </TabsTrigger>
            <TabsTrigger
              value="tenant"
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <Package className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Tenant Products</span>
              <span className="sm:hidden">Tenant</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            {/* Search and Filter Controls - Mobile Optimized */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Filter className="h-4 w-4" />
                  Search & Filter
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mobile-first responsive grid */}
                <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-5 sm:gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Search Products
                    </Label>
                    <Input
                      placeholder="Search by name or model..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Manufacturer</Label>
                    <Select
                      value={selectedManufacturer}
                      onValueChange={setSelectedManufacturer}
                    >
                      <SelectTrigger className="h-9">
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
                    <Label className="text-sm font-medium">Category</Label>
                    <Select
                      value={selectedCategory}
                      onValueChange={setSelectedCategory}
                    >
                      <SelectTrigger className="h-9">
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
                    <Label className="text-sm font-medium">Product Type</Label>
                    <Select
                      value={selectedItemType}
                      onValueChange={setSelectedItemType}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="model">Models</SelectItem>
                        <SelectItem value="accessory">Accessories</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Bulk Actions</Label>
                    <Button
                      onClick={handleBulkEnable}
                      disabled={
                        selectedProducts.size === 0 ||
                        bulkEnableMutation.isPending
                      }
                      className="w-full h-9 text-sm"
                      size="sm"
                    >
                      Enable Selected ({selectedProducts.size})
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bulk Enable Form - Collapsible on Mobile */}
            {selectedProducts.size > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    Bulk Enable Settings
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Configure default settings for {selectedProducts.size}{" "}
                    selected products
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Default Dealer Cost
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={enableForm.dealerCost}
                        onChange={(e) =>
                          setEnableForm((prev) => ({
                            ...prev,
                            dealerCost: e.target.value,
                          }))
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Default Company Price
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={enableForm.companyPrice}
                        onChange={(e) =>
                          setEnableForm((prev) => ({
                            ...prev,
                            companyPrice: e.target.value,
                          }))
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Markup Rule</Label>
                      <Select
                        value={enableForm.markupRuleId}
                        onValueChange={(value) =>
                          setEnableForm((prev) => ({
                            ...prev,
                            markupRuleId: value,
                          }))
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select markup rule" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">
                            Standard Markup (25%)
                          </SelectItem>
                          <SelectItem value="premium">
                            Premium Markup (35%)
                          </SelectItem>
                          <SelectItem value="bulk">
                            Bulk Discount (15%)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Import Results Dialog */}
            <Dialog open={showImportResults} onOpenChange={setShowImportResults}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>CSV Import Results</DialogTitle>
                  <DialogDescription>
                    Enhanced CSV import completed with intelligent field mapping and duplicate handling
                  </DialogDescription>
                </DialogHeader>
                {importResults && (
                  <div className="space-y-4">
                    {/* Summary Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {importResults.summary.created}
                        </div>
                        <div className="text-sm text-muted-foreground">Created</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {importResults.summary.updated}
                        </div>
                        <div className="text-sm text-muted-foreground">Updated</div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">
                          {importResults.summary.skipped}
                        </div>
                        <div className="text-sm text-muted-foreground">Skipped</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {importResults.summary.errors || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Errors</div>
                      </div>
                    </div>

                    {/* Field Mappings */}
                    {importResults.fieldMappings && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Field Mappings Detected</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.entries(importResults.fieldMappings).map(([field, csvHeader]) => (
                              <div key={field} className="flex justify-between items-center py-1">
                                <span className="text-sm font-medium capitalize">
                                  {field.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {csvHeader as string}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Errors List */}
                    {importResults.errors && importResults.errors.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base text-red-600">Import Errors</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {importResults.errors.map((error: string, index: number) => (
                              <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                {error}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Master Products Grid - Mobile Optimized */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {isLoadingMaster
                ? // Loading skeleton
                  Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader className="pb-3">
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
                : masterProducts
                    .filter((product: MasterProduct) => {
                      // Search term filter
                      if (searchTerm && !product.displayName.toLowerCase().includes(searchTerm.toLowerCase()) && 
                          !product.modelCode.toLowerCase().includes(searchTerm.toLowerCase())) {
                        return false;
                      }
                      
                      // Manufacturer filter
                      if (selectedManufacturer !== "all" && product.manufacturer !== selectedManufacturer) {
                        return false;
                      }
                      
                      // Category filter
                      if (selectedCategory !== "all" && product.category !== selectedCategory) {
                        return false;
                      }
                      
                      // Item type filter
                      if (selectedItemType !== "all" && product.itemType !== selectedItemType) {
                        return false;
                      }
                      
                      return true;
                    })
                    .map((product: MasterProduct) => {
                    const isEnabled = isProductEnabled(product.id);
                    const isSelected = selectedProducts.has(product.id);

                    return (
                      <Card
                        key={product.id}
                        className={`transition-all hover:shadow-md ${
                          isSelected ? "ring-2 ring-blue-500" : ""
                        } ${isEnabled ? "bg-green-50 border-green-200" : ""}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base sm:text-lg leading-tight">
                                {product.displayName}
                              </CardTitle>
                              <CardDescription className="text-xs sm:text-sm">
                                {product.manufacturer} - {product.modelCode}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isEnabled ? (
                                <Badge
                                  variant="outline"
                                  className="bg-green-100 text-green-800 text-xs"
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  <span className="hidden sm:inline">
                                    Enabled
                                  </span>
                                  <span className="sm:hidden">✓</span>
                                </Badge>
                              ) : (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() =>
                                    handleSelectProduct(product.id)
                                  }
                                />
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">
                                MSRP:
                              </span>
                              <span className="text-sm font-medium">
                                {product.msrp
                                  ? `$${product.msrp.toLocaleString()}`
                                  : "N/A"}
                              </span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">
                                Dealer Cost:
                              </span>
                              <span className="text-sm font-medium text-green-600">
                                {product.dealerCost 
                                  ? `$${product.dealerCost.toLocaleString()}`
                                  : "Not Set"}
                              </span>
                            </div>

                            {product.marginPercentage && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">
                                  Margin:
                                </span>
                                <span className="text-sm font-medium text-blue-600">
                                  {product.marginPercentage}%
                                </span>
                              </div>
                            )}

                            {/* Product Type and Category Badges */}
                            <div className="flex flex-wrap gap-2 pt-2">
                              {product.itemType && (
                                <Badge 
                                  variant={product.itemType === 'model' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {product.itemType === 'model' ? 'Model' : 'Accessory'}
                                </Badge>
                              )}
                              {product.category && (
                                <Badge variant="outline" className="text-xs">
                                  {product.category}
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-xs min-h-[44px] sm:min-h-[36px]"
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    <span className="hidden sm:inline">
                                      View Details
                                    </span>
                                    <span className="sm:hidden">View Details</span>
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl mx-4">
                                  <DialogHeader>
                                    <DialogTitle>
                                      {product.displayName}
                                    </DialogTitle>
                                    <DialogDescription>
                                      {product.manufacturer} {product.modelCode}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    {/* Product Type and Category Badges */}
                                    <div className="flex flex-wrap gap-2">
                                      {product.itemType && (
                                        <Badge 
                                          variant={product.itemType === 'model' ? 'default' : 'secondary'}
                                          className="text-sm"
                                        >
                                          {product.itemType === 'model' ? 'Equipment Model' : 'Accessory'}
                                        </Badge>
                                      )}
                                      {product.category && (
                                        <Badge variant="outline" className="text-sm">
                                          {product.category}
                                        </Badge>
                                      )}
                                      {product.productType && product.productType !== product.itemType && (
                                        <Badge variant="secondary" className="text-sm">
                                          {product.productType}
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div>
                                        <Label className="text-sm font-medium">
                                          Manufacturer
                                        </Label>
                                        <p className="text-sm">
                                          {product.manufacturer}
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium">
                                          Model Code
                                        </Label>
                                        <p className="text-sm">
                                          {product.modelCode}
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium">
                                          MSRP
                                        </Label>
                                        <p className="text-sm">
                                          {product.msrp
                                            ? `$${product.msrp.toLocaleString()}`
                                            : "N/A"}
                                        </p>
                                      </div>
                                      {product.dealerCost && (
                                        <div>
                                          <Label className="text-sm font-medium">
                                            Dealer Cost
                                          </Label>
                                          <p className="text-sm text-green-600">
                                            ${product.dealerCost.toLocaleString()}
                                          </p>
                                        </div>
                                      )}
                                      {product.marginPercentage && (
                                        <div>
                                          <Label className="text-sm font-medium">
                                            Margin
                                          </Label>
                                          <p className="text-sm text-blue-600">
                                            {product.marginPercentage}%
                                          </p>
                                        </div>
                                      )}
                                      <div>
                                        <Label className="text-sm font-medium">
                                          Status
                                        </Label>
                                        <p className="text-sm">
                                          {product.status}
                                        </p>
                                      </div>
                                    </div>
                                    {product.specsJson && (
                                      <div>
                                        <Label className="text-sm font-medium">
                                          Specifications
                                        </Label>
                                        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40 mt-2">
                                          {JSON.stringify(
                                            product.specsJson,
                                            null,
                                            2
                                          )}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>

                              {/* Edit Button */}
                              <Dialog open={editingProduct === product.id} onOpenChange={(open) => {
                                if (!open) handleCancelEdit();
                              }}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs min-h-[44px] sm:min-h-[36px]"
                                    onClick={() => handleEditProduct(product)}
                                  >
                                    <Settings className="h-3 w-3 mr-1" />
                                    <span className="hidden sm:inline">Edit</span>
                                    <span className="sm:hidden">Edit</span>
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Edit Product</DialogTitle>
                                    <DialogDescription>
                                      Update product details and pricing
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
                                    <div>
                                      <Label className="text-sm font-medium">
                                        Display Name
                                      </Label>
                                      <Input
                                        value={editForm.displayName}
                                        onChange={(e) =>
                                          setEditForm((prev) => ({
                                            ...prev,
                                            displayName: e.target.value,
                                          }))
                                        }
                                        placeholder="Product display name"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm font-medium">
                                        MSRP ($)
                                      </Label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={editForm.msrp}
                                        onChange={(e) =>
                                          setEditForm((prev) => ({
                                            ...prev,
                                            msrp: e.target.value,
                                          }))
                                        }
                                        placeholder="0.00"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm font-medium">
                                        Dealer Cost ($)
                                      </Label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={editForm.dealerCost}
                                        onChange={(e) =>
                                          setEditForm((prev) => ({
                                            ...prev,
                                            dealerCost: e.target.value,
                                          }))
                                        }
                                        placeholder="0.00"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm font-medium">
                                        Margin Percentage (%)
                                      </Label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={editForm.marginPercentage}
                                        onChange={(e) =>
                                          setEditForm((prev) => ({
                                            ...prev,
                                            marginPercentage: e.target.value,
                                          }))
                                        }
                                        placeholder="0.00"
                                      />
                                    </div>

                                    {/* Category Field */}
                                    <div>
                                      <Label className="text-sm font-medium">
                                        Category
                                      </Label>
                                      <select
                                        value={editForm.category}
                                        onChange={(e) =>
                                          setEditForm((prev) => ({
                                            ...prev,
                                            category: e.target.value,
                                          }))
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="">Select category...</option>
                                        <option value="Equipment">Equipment</option>
                                        <option value="Supplies">Supplies</option>
                                        <option value="Hardware Accessories">Hardware Accessories</option>
                                        <option value="Software">Software</option>
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Consumables">Consumables</option>
                                      </select>
                                    </div>

                                    {/* Product Type Field */}
                                    <div>
                                      <Label className="text-sm font-medium">
                                        Product Type
                                      </Label>
                                      <select
                                        value={editForm.productType}
                                        onChange={(e) =>
                                          setEditForm((prev) => ({
                                            ...prev,
                                            productType: e.target.value,
                                          }))
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="">Select product type...</option>
                                        <option value="MFP">MFP</option>
                                        <option value="Printer">Printer</option>
                                        <option value="Scanner">Scanner</option>
                                        <option value="Copier">Copier</option>
                                        <option value="Accessory">Accessory</option>
                                        <option value="Toner">Toner</option>
                                        <option value="Paper">Paper</option>
                                        <option value="Service">Service</option>
                                        <option value="Software">Software</option>
                                      </select>
                                    </div>

                                    {/* Status Field */}
                                    <div>
                                      <Label className="text-sm font-medium">
                                        Status
                                      </Label>
                                      <select
                                        value={editForm.status}
                                        onChange={(e) =>
                                          setEditForm((prev) => ({
                                            ...prev,
                                            status: e.target.value,
                                          }))
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="active">Active</option>
                                        <option value="discontinued">Discontinued</option>
                                        <option value="pending">Pending</option>
                                        <option value="draft">Draft</option>
                                      </select>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-2 pt-4 sticky bottom-0 bg-white p-2 -m-2 border-t">
                                      <Button
                                        onClick={handleSaveEdit}
                                        disabled={updateMasterProductMutation.isPending}
                                        className="flex-1 min-h-[44px] sm:min-h-[36px]"
                                      >
                                        {updateMasterProductMutation.isPending
                                          ? "Saving..."
                                          : "Save Changes"}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={handleCancelEdit}
                                        disabled={updateMasterProductMutation.isPending}
                                        className="min-h-[44px] sm:min-h-[36px]"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>

                              {!isEnabled && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    enableProductMutation.mutate({
                                      productId: product.id,
                                      overrides: {},
                                    });
                                  }}
                                  disabled={enableProductMutation.isPending}
                                  className="text-xs min-h-[44px] sm:min-h-[36px]"
                                >
                                  <ShoppingCart className="h-3 w-3 mr-1" />
                                  <span className="hidden sm:inline">
                                    Enable
                                  </span>
                                  <span className="sm:hidden">Enable</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
            </div>
          </TabsContent>

          <TabsContent value="enabled" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Enabled Products</CardTitle>
                <CardDescription className="text-sm">
                  Products you've enabled from the master catalog
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {isLoadingEnabled ? (
                    <div>Loading enabled products...</div>
                  ) : enabledProducts.length === 0 ? (
                    <div className="col-span-full text-center text-muted-foreground py-12">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">No products enabled yet.</p>
                      <p className="text-xs">
                        Browse the catalog to enable products.
                      </p>
                    </div>
                  ) : (
                    enabledProducts.map((product: EnabledProduct) => (
                      <Card key={product.enabledProductId}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base leading-tight">
                            {product.customName || product.displayName}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {product.manufacturer} -{" "}
                            {product.customSku || product.modelCode}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-xs text-muted-foreground">
                                MSRP:
                              </span>
                              <span className="text-sm">
                                {product.msrp
                                  ? `$${product.msrp.toLocaleString()}`
                                  : "N/A"}
                              </span>
                            </div>
                            {product.dealerCost && (
                              <div className="flex justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Dealer Cost:
                                </span>
                                <span className="text-sm">
                                  ${product.dealerCost.toLocaleString()}
                                </span>
                              </div>
                            )}
                            {product.companyPrice && (
                              <div className="flex justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Company Price:
                                </span>
                                <span className="text-sm font-medium">
                                  ${product.companyPrice.toLocaleString()}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-xs text-muted-foreground">
                                Source:
                              </span>
                              <Badge variant="outline" className="text-xs">
                                Master Catalog
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs"
                            >
                              <Settings className="h-3 w-3 mr-1" />
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

          <TabsContent value="tenant" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  Tenant-Specific Products
                </CardTitle>
                <CardDescription className="text-sm">
                  Products created specifically for your organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground py-12">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No tenant-specific products yet.</p>
                  <p className="text-xs">
                    Create custom products not available in the master catalog.
                  </p>
                  <Button className="mt-4" size="sm">
                    <Package className="h-4 w-4 mr-2" />
                    Add Custom Product
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
