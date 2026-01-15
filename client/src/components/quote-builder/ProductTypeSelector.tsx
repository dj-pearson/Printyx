import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Package,
  Wrench,
  UserCheck,
  Cog,
  ShoppingCart,
  Monitor,
  Search,
  Plus,
  DollarSign,
  Tag,
  Code,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

type ProductType =
  | 'product_models'
  | 'product_accessories'
  | 'professional_services'
  | 'service_products'
  | 'supplies'
  | 'managed_services'
  | 'software_products';

interface ProductTypeOption {
  value: ProductType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  endpoint: string;
}

interface Product {
  id: string;
  productCode: string;
  productName: string;
  description?: string;
  msrp?: number;
  newRepPrice?: number;
  upgradeRepPrice?: number;
  category?: string;
  manufacturer?: string;
  isActive?: boolean;
}

interface ProductTypeSelectorProps {
  onProductSelect: (product: Product & { type: ProductType }) => void;
  pricingType: 'new' | 'upgrade';
  parentProductId?: string; // For selecting accessories for a specific product
}

const productTypes: ProductTypeOption[] = [
  {
    value: 'product_models',
    label: 'Product Models',
    description: 'Copiers, printers, and MFPs',
    icon: Package,
    endpoint: '/api/product-models',
  },
  {
    value: 'product_accessories',
    label: 'Product Accessories',
    description: 'Finishers, trays, and accessories',
    icon: Wrench,
    endpoint: '/api/product-accessories',
  },
  {
    value: 'professional_services',
    label: 'Professional Services',
    description: 'Installation, training, consulting',
    icon: UserCheck,
    endpoint: '/api/professional-services',
  },
  {
    value: 'service_products',
    label: 'Service Products',
    description: 'Maintenance and service contracts',
    icon: Cog,
    endpoint: '/api/service-products',
  },
  {
    value: 'supplies',
    label: 'Supplies',
    description: 'Toner, paper, and consumables',
    icon: ShoppingCart,
    endpoint: '/api/supplies',
  },
  {
    value: 'managed_services',
    label: 'IT & Managed Services',
    description: 'IT support and managed solutions',
    icon: Monitor,
    endpoint: '/api/managed-services',
  },
  {
    value: 'software_products',
    label: 'Software Products',
    description: 'Software licenses and digital solutions',
    icon: Code,
    endpoint: '/api/software-products',
  },
];

export default function ProductTypeSelector({
  onProductSelect,
  pricingType,
  parentProductId,
}: ProductTypeSelectorProps) {
  // If we're adding accessories for a parent product, default to accessories
  const [selectedType, setSelectedType] = useState<ProductType>(
    parentProductId ? 'product_accessories' : 'product_models',
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [manufacturerFilter, setManufacturerFilter] = useState('all');

  const selectedTypeOption = productTypes.find((type) => type.value === selectedType);

  // Fetch products based on selected type
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: [selectedTypeOption?.endpoint, parentProductId],
    queryFn: async () => {
      let url = selectedTypeOption?.endpoint || '';

      // For accessories, filter by parent product if specified
      if (selectedType === 'product_accessories' && parentProductId) {
        url += `?modelId=${parentProductId}`;
      }

      const response = await apiRequest(url, 'GET');
      console.log('API Response for', url, ':', response);
      // Ensure response is always an array
      return Array.isArray(response) ? response : [];
    },
    enabled: !!selectedTypeOption,
  });

  // Ensure products is always an array before using array methods
  const productsArray = Array.isArray(products) ? products : [];

  // Get unique categories and manufacturers for filtering
  const categories = Array.from(new Set(productsArray.map((p) => p.category).filter(Boolean)));
  const manufacturers = Array.from(
    new Set(productsArray.map((p) => p.manufacturer).filter(Boolean)),
  );

  // Filter products
  const filteredProducts = productsArray.filter((product) => {
    // Check for active status - handle both field names
    const isActive = product.isActive !== false && product.status !== 'inactive';
    if (!isActive) return false;

    const matchesSearch =
      (product.productName &&
        product.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.modelName && product.modelName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.displayName &&
        product.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.productCode &&
        product.productCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.modelCode && product.modelCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const matchesManufacturer =
      manufacturerFilter === 'all' || product.manufacturer === manufacturerFilter;

    return matchesSearch && matchesCategory && matchesManufacturer;
  });

  const getPrice = (product: Product) => {
    if (pricingType === 'new' && product.newRepPrice) {
      return product.newRepPrice;
    }
    if (pricingType === 'upgrade' && product.upgradeRepPrice) {
      return product.upgradeRepPrice;
    }
    return product.msrp || 0;
  };

  const handleProductSelect = (product: Product) => {
    onProductSelect({
      ...product,
      type: selectedType,
    });
  };

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden touch-manipulation">
      <div className="flex-shrink-0 p-4 sm:p-6 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Package className="h-5 w-5" />
          <h3 className="text-base sm:text-lg font-semibold">Product Selection</h3>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Select the type of product and choose from available options
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Product Type Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Product Type</Label>
          <Select
            value={selectedType}
            onValueChange={(value: ProductType) => setSelectedType(value)}
          >
            <SelectTrigger className="min-h-[44px]">
              <SelectValue>
                {selectedTypeOption && (
                  <div className="flex items-center gap-2">
                    <selectedTypeOption.icon className="h-4 w-4" />
                    <span className="truncate">{selectedTypeOption.label}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {productTypes
                .filter((type) => !parentProductId || type.value === 'product_accessories')
                .map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 min-h-[44px]"
            />
          </div>

          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Category" />
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
          )}

          {manufacturers.length > 0 && (
            <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Manufacturer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Manufacturers</SelectItem>
                {manufacturers.map((manufacturer) => (
                  <SelectItem key={manufacturer} value={manufacturer}>
                    {manufacturer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Pricing Type Indicator */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="font-medium">Current Pricing:</span>
            </div>
            <Badge variant={pricingType === 'new' ? 'default' : 'secondary'}>
              {pricingType === 'new' ? 'New Customer' : 'Upgrade'} Pricing
            </Badge>
          </div>
        </div>

        {/* Product List */}
        <div className="border rounded-lg flex-1 min-h-0 flex flex-col">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No products found matching your criteria</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3 p-3">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="border rounded-lg p-3 space-y-3 active:scale-[0.99] transition-transform"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-2">{product.productName}</h4>
                        {product.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {product.productCode}
                      </Badge>
                    </div>

                    {selectedType === 'product_models' &&
                      (product.category || product.manufacturer) && (
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {product.category && <span className="truncate">{product.category}</span>}
                          {product.manufacturer && (
                            <span className="truncate">{product.manufacturer}</span>
                          )}
                        </div>
                      )}

                    <div className="flex justify-between items-center gap-2 pt-2 border-t">
                      <div className="text-xs flex-1 min-w-0">
                        <div className="text-muted-foreground truncate">
                          MSRP: {formatPrice(product.msrp)}
                        </div>
                        <div className="font-medium truncate">
                          Your Price: {formatPrice(getPrice(product))}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleProductSelect(product)}
                        className="shrink-0 min-h-[44px] active:scale-[0.98] transition-transform"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Code</TableHead>
                      {selectedType === 'product_models' && (
                        <>
                          <TableHead>Category</TableHead>
                          <TableHead>Manufacturer</TableHead>
                        </>
                      )}
                      <TableHead>MSRP</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{product.productName}</div>
                            {product.description && (
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {product.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.productCode}</Badge>
                        </TableCell>
                        {selectedType === 'product_models' && (
                          <>
                            <TableCell>{product.category || 'N/A'}</TableCell>
                            <TableCell>{product.manufacturer || 'N/A'}</TableCell>
                          </>
                        )}
                        <TableCell>{formatPrice(product.msrp)}</TableCell>
                        <TableCell>
                          <span className="font-medium">{formatPrice(getPrice(product))}</span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleProductSelect(product)}
                            className="min-h-[44px] active:scale-[0.98] transition-transform"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Help Text */}
        {selectedType === 'product_accessories' && parentProductId && (
          <div className="text-xs sm:text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Wrench className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Showing accessories compatible with the selected product model.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
