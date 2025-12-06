import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Monitor,
  Wrench,
  Users,
  Cog,
  Package,
  Server,
  Layers,
  Search,
  Plus,
  BarChart3,
  FileText,
  Settings,
  DollarSign,
  Edit,
  Save,
  X,
  Upload,
  CheckCircle,
  Filter,
  TrendingUp,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiFormRequest } from "@/lib/queryClient";
import {
  type MasterProductModel,
  type EnabledProduct,
} from "@shared/schema";

// Product module definitions
interface ProductModule {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  category: string;
  itemCount?: number;
  status: "active" | "setup" | "coming-soon";
}

const productModules: ProductModule[] = [
  {
    id: "product-models",
    title: "Product Models",
    description: "Manage copier equipment with CPC rates and manufacturer specifications",
    icon: Monitor,
    path: "/product-models",
    category: "Hardware",
    itemCount: 0,
    status: "active",
  },
  {
    id: "product-accessories",
    title: "Product Accessories",
    description: "Hardware add-ons with model compatibility tracking",
    icon: Wrench,
    path: "/product-accessories",
    category: "Hardware",
    itemCount: 0,
    status: "active",
  },
  {
    id: "professional-services",
    title: "Professional Services",
    description: "Consulting, installation, and training service offerings",
    icon: Users,
    path: "/professional-services",
    category: "Services",
    itemCount: 0,
    status: "active",
  },
  {
    id: "service-products",
    title: "Service Products",
    description: "Ongoing service offerings with subscription models",
    icon: Cog,
    path: "/service-products",
    category: "Services",
    itemCount: 0,
    status: "active",
  },
  {
    id: "supplies",
    title: "Supplies",
    description: "Consumables, toner, paper, and maintenance kits with inventory tracking",
    icon: Package,
    path: "/supplies",
    category: "Consumables",
    itemCount: 0,
    status: "active",
  },
  {
    id: "inventory",
    title: "Inventory",
    description: "Stock levels, adjustments, reorders, and receiving",
    icon: Package,
    path: "/inventory",
    category: "Operations",
    itemCount: 0,
    status: "active",
  },
  {
    id: "it-services",
    title: "IT & Managed Services",
    description: "Network management, cloud services, security, and IT support",
    icon: Server,
    path: "/managed-services",
    category: "Technology",
    itemCount: 0,
    status: "active",
  },
  {
    id: "software-products",
    title: "Software Products",
    description: "Licenses and software offerings with pricing and bundles",
    icon: Layers,
    path: "/software-products",
    category: "Technology",
    itemCount: 0,
    status: "active",
  },
];

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

export default function ProductHubUnified() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState("overview");

  // Overview tab state
  const [overviewSearchTerm, setOverviewSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Browse Catalog tab state
  const [catalogSearchTerm, setCatalogSearchTerm] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState("all");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [selectedItemType, setSelectedItemType] = useState("all");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [masterCsvFile, setMasterCsvFile] = useState<File | null>(null);
  const [enableForm, setEnableForm] = useState({
    dealerCost: "",
    companyPrice: "",
    markupRuleId: "",
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
  const [showImportResults, setShowImportResults] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);

  // Pricing Management tab state
  const [pricingSearchTerm, setPricingSearchTerm] = useState("");
  const [pricingCategory, setPricingCategory] = useState("all");
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  const [currentEditProduct, setCurrentEditProduct] = useState<ProductWithPricing | null>(null);
  const [pricingForm, setPricingForm] = useState({
    productId: "",
    productType: "",
    dealerCost: "",
    companyMarkupPercentage: "",
    minimumSalePrice: "",
    suggestedRetailPrice: "",
  });

  // Settings tab state
  const [defaultMarkup, setDefaultMarkup] = useState("");

  // Check permissions
  const isCompanyAdmin = user?.role?.code === 'COMPANY_ADMIN' || user?.role?.canAccessAllTenants;
  const isPlatformAdmin = user?.role?.includes('platform');

  // Queries
  const { data: masterProducts = [], isLoading: isLoadingMaster } = useQuery<MasterProductModel[]>({
    queryKey: ["/api/catalog/models", { manufacturer: selectedManufacturer, search: catalogSearchTerm, category: catalogCategory }],
  });

  const { data: enabledProducts = [], isLoading: isLoadingEnabled } = useQuery<EnabledProduct[]>({
    queryKey: ["/api/enabled-products"],
  });

  const { data: manufacturers = [] } = useQuery({
    queryKey: ["/api/catalog/manufacturers"],
  });

  const { data: productsWithPricing = [], isLoading: isLoadingPricing } = useQuery<ProductWithPricing[]>({
    queryKey: ["/api/products/with-pricing"],
  });

  const { data: companySettings } = useQuery({
    queryKey: ["/api/pricing/company-settings"],
  });

  // Mutations
  const enableProductMutation = useMutation({
    mutationFn: (data: { productId: string; overrides: any }) =>
      apiRequest(`/api/catalog/models/${data.productId}/enable`, "POST", data.overrides),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enabled-products"] });
      toast({ title: "Product enabled successfully" });
    },
  });

  const bulkEnableMutation = useMutation({
    mutationFn: (data: { masterProductIds: string[]; defaultOverrides: any }) =>
      apiRequest("/api/catalog/models/bulk-enable", "POST", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/enabled-products"] });
      toast({
        title: "Products enabled",
        description: `${data.enabled} products enabled, ${data.skipped} already enabled`,
      });
      setSelectedProducts(new Set());
    },
  });

  const enhancedImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFormRequest("/api/catalog/import-enhanced", "POST", formData);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalog/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enabled-products"] });
      toast({
        title: "CSV Import Complete",
        description: `Created: ${data.summary.created}, Updated: ${data.summary.updated}, Skipped: ${data.summary.skipped}`,
      });
      setImportResults(data);
      setShowImportResults(true);
      setMasterCsvFile(null);
    },
  });

  const updateMasterProductMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest(`/api/catalog/models/${data.id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalog/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enabled-products"] });
      toast({ title: "Product updated successfully" });
      setEditingProduct(null);
    },
  });

  const updateProductPricingMutation = useMutation({
    mutationFn: async (data: any) => {
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
      toast({ title: "Product pricing updated successfully" });
      setIsPricingDialogOpen(false);
      setCurrentEditProduct(null);
    },
  });

  const bulkUpdatePricingMutation = useMutation({
    mutationFn: (updates: { productId: string; markupPercentage: string }[]) =>
      apiRequest("/api/pricing/products/bulk-update", "POST", { updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products/with-pricing"] });
      toast({ title: "Bulk pricing updates applied successfully" });
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

  const isProductEnabled = (productId: string) => {
    return enabledProducts.some((ep: EnabledProduct) => ep.masterProductId === productId);
  };

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
      toast({ title: "No products selected", variant: "destructive" });
      return;
    }

    bulkEnableMutation.mutate({
      masterProductIds: Array.from(selectedProducts),
      defaultOverrides: {
        dealerCost: enableForm.dealerCost ? parseFloat(enableForm.dealerCost) : null,
        companyPrice: enableForm.companyPrice ? parseFloat(enableForm.companyPrice) : null,
        markupRuleId: enableForm.markupRuleId || null,
      },
    });
  };

  const handleEditProduct = (product: MasterProductModel) => {
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

  const handlePricingEdit = (product: ProductWithPricing) => {
    setCurrentEditProduct(product);
    setPricingForm({
      productId: product.id,
      productType: product.category,
      dealerCost: product.dealerCost || "",
      companyMarkupPercentage: product.companyMarkupPercentage || companySettings?.defaultMarkupPercentage || "20",
      minimumSalePrice: product.minimumSalePrice || "",
      suggestedRetailPrice: product.suggestedRetailPrice || "",
    });
    setIsPricingDialogOpen(true);
  };

  const handlePricingSave = () => {
    updateProductPricingMutation.mutate(pricingForm);
  };

  const applyDefaultMarkupToAll = () => {
    const productsWithoutPricing = productsWithPricing.filter(p => !p.hasCustomPricing);
    const updates = productsWithoutPricing.map(p => ({
      productId: p.id,
      markupPercentage: companySettings?.defaultMarkupPercentage || "20"
    }));
    bulkUpdatePricingMutation.mutate(updates);
  };

  // Filter products for overview
  const filteredModules = productModules.filter((module) => {
    const matchesSearch =
      module.title.toLowerCase().includes(overviewSearchTerm.toLowerCase()) ||
      module.description.toLowerCase().includes(overviewSearchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || module.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filter master catalog products
  const filteredCatalogProducts = masterProducts.filter((product: MasterProductModel) => {
    if (catalogSearchTerm && !product.displayName.toLowerCase().includes(catalogSearchTerm.toLowerCase()) &&
        !product.modelCode.toLowerCase().includes(catalogSearchTerm.toLowerCase())) {
      return false;
    }
    if (selectedManufacturer !== "all" && product.manufacturer !== selectedManufacturer) {
      return false;
    }
    if (catalogCategory !== "all" && product.category !== catalogCategory) {
      return false;
    }
    if (selectedItemType !== "all" && product.itemType !== selectedItemType) {
      return false;
    }
    return true;
  });

  // Filter pricing products
  const filteredPricingProducts = productsWithPricing.filter((product: ProductWithPricing) => {
    const matchesSearch = product.name?.toLowerCase().includes(pricingSearchTerm.toLowerCase()) ||
                         product.modelNumber?.toLowerCase().includes(pricingSearchTerm.toLowerCase());
    const matchesCategory = pricingCategory === "all" || product.category === pricingCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(productModules.map((m) => m.category)));
  const catalogCategories = Array.from(new Set(masterProducts.map((p: MasterProductModel) => p.category).filter(Boolean)));
  const pricingCategories = Array.from(new Set(productsWithPricing.map(p => p.category).filter(Boolean)));

  return (
    <MainLayout
      title="Product Hub"
      description="Unified product management - browse, enable, price, and configure all products"
    >
      <div className="space-y-6">
        {/* Header with Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Master Catalog</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{masterProducts.length}</div>
              <p className="text-xs text-muted-foreground">Available products</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enabled</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enabledProducts.length}</div>
              <p className="text-xs text-muted-foreground">Products in use</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{catalogCategories.length}</div>
              <p className="text-xs text-muted-foreground">Product types</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Manufacturers</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{manufacturers.length}</div>
              <p className="text-xs text-muted-foreground">Vendors</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="catalog" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Browse Catalog</span>
            </TabsTrigger>
            <TabsTrigger value="my-products" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">My Products</span>
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Pricing</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Product Module Overview</CardTitle>
                <CardDescription>
                  Access all product management modules from one central location
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search modules..."
                      value={overviewSearchTerm}
                      onChange={(e) => setOverviewSearchTerm(e.target.value)}
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredModules.map((module) => {
                    const IconComponent = module.icon;
                    return (
                      <Card key={module.id} className="hover:shadow-lg transition-shadow">
                        <Link href={module.path}>
                          <CardHeader className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                  <IconComponent className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg">{module.title}</CardTitle>
                                  <Badge variant="secondary" className="text-xs">
                                    {module.category}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <CardDescription className="text-sm mb-4">
                              {module.description}
                            </CardDescription>
                            <div className="flex items-center justify-between">
                              <Button size="sm" variant="ghost">
                                Manage <Plus className="ml-1 h-3 w-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </Link>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Browse Catalog Tab */}
          <TabsContent value="catalog" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Master Product Catalog</CardTitle>
                    <CardDescription>
                      Browse Printyx's master catalog and enable products for your organization
                    </CardDescription>
                  </div>
                  {isPlatformAdmin && (
                    <div className="flex items-center gap-2">
                      <input
                        id="masterCsvUpload"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => setMasterCsvFile(e.target.files?.[0] || null)}
                      />
                      <label htmlFor="masterCsvUpload">
                        <Button asChild variant="outline" size="sm">
                          <span className="flex items-center gap-2 cursor-pointer">
                            <Upload className="h-4 w-4" />
                            Import CSV
                          </span>
                        </Button>
                      </label>
                      <Button
                        size="sm"
                        disabled={!masterCsvFile || enhancedImportMutation.isPending}
                        onClick={() => {
                          if (masterCsvFile) {
                            enhancedImportMutation.mutate(masterCsvFile);
                          }
                        }}
                      >
                        {enhancedImportMutation.isPending ? "Processing..." : "Smart Import"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <Label>Search Products</Label>
                    <Input
                      placeholder="Search by name or model..."
                      value={catalogSearchTerm}
                      onChange={(e) => setCatalogSearchTerm(e.target.value)}
                    />
                  </div>
                  <div>
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
                  <div>
                    <Label>Category</Label>
                    <Select value={catalogCategory} onValueChange={setCatalogCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {catalogCategories.map((category: string) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Product Type</Label>
                    <Select value={selectedItemType} onValueChange={setSelectedItemType}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="model">Models</SelectItem>
                        <SelectItem value="accessory">Accessories</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bulk Actions</Label>
                    <Button
                      onClick={handleBulkEnable}
                      disabled={selectedProducts.size === 0 || bulkEnableMutation.isPending}
                      className="w-full"
                    >
                      Enable Selected ({selectedProducts.size})
                    </Button>
                  </div>
                </div>

                {/* Bulk Enable Settings */}
                {selectedProducts.size > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Bulk Enable Settings</CardTitle>
                      <CardDescription>
                        Configure default settings for {selectedProducts.size} selected products
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Default Dealer Cost</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={enableForm.dealerCost}
                            onChange={(e) => setEnableForm(prev => ({ ...prev, dealerCost: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Default Company Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={enableForm.companyPrice}
                            onChange={(e) => setEnableForm(prev => ({ ...prev, companyPrice: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Markup Rule</Label>
                          <Select value={enableForm.markupRuleId} onValueChange={(value) => setEnableForm(prev => ({ ...prev, markupRuleId: value }))}>
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
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Products Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {isLoadingMaster ? (
                    Array.from({ length: 8 }).map((_, i) => (
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
                    filteredCatalogProducts.map((product: MasterProductModel) => {
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
                              <div className="flex items-start gap-2">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleSelectProduct(product.id)}
                                  disabled={isEnabled}
                                />
                                <div className="flex-1">
                                  <CardTitle className="text-sm">{product.displayName}</CardTitle>
                                  <CardDescription className="text-xs">
                                    {product.modelCode}
                                  </CardDescription>
                                </div>
                              </div>
                              {isEnabled && (
                                <Badge variant="default" className="text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Enabled
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Manufacturer:</span>
                              <span className="font-medium">{product.manufacturer}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">MSRP:</span>
                              <span className="font-medium">{formatCurrency(product.msrp)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Dealer Cost:</span>
                              <span className="font-medium">{formatCurrency(product.dealerCost)}</span>
                            </div>
                            {isPlatformAdmin && editingProduct === product.id ? (
                              <div className="flex gap-1 pt-2">
                                <Button size="sm" variant="default" onClick={handleSaveEdit}>
                                  <Save className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingProduct(null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-1 pt-2">
                                {!isEnabled && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="flex-1"
                                    onClick={() =>
                                      enableProductMutation.mutate({ productId: product.id, overrides: {} })
                                    }
                                  >
                                    Enable
                                  </Button>
                                )}
                                {isPlatformAdmin && (
                                  <Button size="sm" variant="outline" onClick={() => handleEditProduct(product)}>
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Products Tab */}
          <TabsContent value="my-products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Enabled Products</CardTitle>
                <CardDescription>
                  Products you've enabled from the master catalog
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingEnabled ? (
                  <div className="text-center py-8">Loading enabled products...</div>
                ) : enabledProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No products enabled yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start by browsing the catalog and enabling products for your organization
                    </p>
                    <Button onClick={() => setActiveTab("catalog")}>
                      <Search className="h-4 w-4 mr-2" />
                      Browse Catalog
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {enabledProducts.map((product: EnabledProduct) => (
                      <Card key={product.id}>
                        <CardHeader>
                          <CardTitle className="text-sm">
                            {product.customName || "Product"}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {product.customSku}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Dealer Cost:</span>
                              <span className="font-medium">{formatCurrency(product.dealerCost)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Company Price:</span>
                              <span className="font-medium">{formatCurrency(product.companyPrice)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Status:</span>
                              <Badge variant={product.isActive ? "default" : "secondary"}>
                                {product.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Management Tab */}
          <TabsContent value="pricing" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Pricing Management</CardTitle>
                    <CardDescription>
                      {isCompanyAdmin
                        ? "Configure individual product markup percentages and pricing rules"
                        : "View product information and current pricing"}
                    </CardDescription>
                  </div>
                  {isCompanyAdmin && (
                    <Button variant="outline" onClick={applyDefaultMarkupToAll}>
                      <Settings className="h-4 w-4 mr-2" />
                      Apply Default Markup
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search products..."
                      value={pricingSearchTerm}
                      onChange={(e) => setPricingSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={pricingCategory} onValueChange={setPricingCategory}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {pricingCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Products Table */}
                {isLoadingPricing ? (
                  <div className="text-center py-4">Loading pricing data...</div>
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
                      {filteredPricingProducts.map((product) => (
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
                                onClick={() => handlePricingEdit(product)}
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
          </TabsContent>
        </Tabs>

        {/* Pricing Dialog */}
        <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configure Product Markup</DialogTitle>
              <DialogDescription>
                Set dealer cost, company markup percentage, and pricing rules for {currentEditProduct?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dealer Cost ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="150.00"
                    value={pricingForm.dealerCost}
                    onChange={(e) => setPricingForm(prev => ({ ...prev, dealerCost: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Company Markup Percentage (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="20.00"
                    value={pricingForm.companyMarkupPercentage}
                    onChange={(e) => setPricingForm(prev => ({ ...prev, companyMarkupPercentage: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Minimum Sale Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="160.00"
                    value={pricingForm.minimumSalePrice}
                    onChange={(e) => setPricingForm(prev => ({ ...prev, minimumSalePrice: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Suggested Retail Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="200.00"
                    value={pricingForm.suggestedRetailPrice}
                    onChange={(e) => setPricingForm(prev => ({ ...prev, suggestedRetailPrice: e.target.value }))}
                  />
                </div>
              </div>

              {/* Live calculation preview */}
              {pricingForm.dealerCost && pricingForm.companyMarkupPercentage && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Pricing Preview</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Dealer Cost:</span>
                      <div className="font-medium">{formatCurrency(pricingForm.dealerCost)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Company Price:</span>
                      <div className="font-medium text-green-600">
                        {formatCurrency(
                          calculateCompanyPrice(
                            parseFloat(pricingForm.dealerCost || "0"),
                            parseFloat(pricingForm.companyMarkupPercentage || "0")
                          )
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Markup Amount:</span>
                      <div className="font-medium text-blue-600">
                        {formatCurrency(
                          calculateCompanyPrice(
                            parseFloat(pricingForm.dealerCost || "0"),
                            parseFloat(pricingForm.companyMarkupPercentage || "0")
                          ) - parseFloat(pricingForm.dealerCost || "0")
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsPricingDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePricingSave} disabled={updateProductPricingMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Markup
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
