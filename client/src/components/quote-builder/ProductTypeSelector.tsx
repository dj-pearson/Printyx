import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

type ProductType = 'product_models' | 'product_accessories' | 'professional_services' | 'service_products' | 'supplies' | 'managed_services';

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
];

export default function ProductTypeSelector({
  onProductSelect,
  pricingType,
  parentProductId,
}: ProductTypeSelectorProps) {
  // If we're adding accessories for a parent product, default to accessories
  const [selectedType, setSelectedType] = useState<ProductType>(
    parentProductId ? 'product_accessories' : 'product_models'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [manufacturerFilter, setManufacturerFilter] = useState('all');

  const selectedTypeOption = productTypes.find(type => type.value === selectedType);

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
      return response;
    },
    enabled: !!selectedTypeOption,
  });

  // Get unique categories and manufacturers for filtering
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const manufacturers = Array.from(new Set(products.map(p => p.manufacturer).filter(Boolean)));

  // Filter products
  const filteredProducts = products.filter((product) => {
    if (!product.isActive) return false;
    
    const matchesSearch = 
      (product.productName && product.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.productCode && product.productCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const matchesManufacturer = manufacturerFilter === 'all' || product.manufacturer === manufacturerFilter;

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Product Selection
        </CardTitle>
        <CardDescription>
          Select the type of product and choose from available options
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product Type Selection */}
        <div className="space-y-2">
          <Label>Product Type</Label>
          <Select value={selectedType} onValueChange={(value: ProductType) => setSelectedType(value)}>
            <SelectTrigger>
              <SelectValue>
                {selectedTypeOption && (
                  <div className="flex items-center gap-2">
                    <selectedTypeOption.icon className="h-4 w-4" />
                    {selectedTypeOption.label}
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {productTypes
                .filter(type => !parentProductId || type.value === 'product_accessories')
                .map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex items-center gap-2">
                    <type.icon className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {type.description}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
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
              <SelectTrigger>
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
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4" />
            <span className="font-medium">Current Pricing:</span>
            <Badge variant={pricingType === 'new' ? 'default' : 'secondary'}>
              {pricingType === 'new' ? 'New Customer' : 'Upgrade'} Pricing
            </Badge>
          </div>
        </div>

        {/* Product List */}
        <div className="border rounded-lg">
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
            <div className="max-h-96 overflow-y-auto">
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
                        <span className="font-medium">
                          {formatPrice(getPrice(product))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleProductSelect(product)}
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
          )}
        </div>

        {/* Help Text */}
        {selectedType === 'product_accessories' && parentProductId && (
          <div className="text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span>
                Showing accessories compatible with the selected product model.
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}