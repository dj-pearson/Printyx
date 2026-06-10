import React, { useState, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
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

// Normalized product shape. Source rows come from edge functions (PostgREST,
// snake_case) in prod and from Express/Drizzle (camelCase) in dev, so we read
// both. See normalizeProduct().
interface Product {
  id: string;
  productCode: string;
  productName: string;
  description?: string;
  category?: string;
  manufacturer?: string;
  isActive?: boolean;
  requiredAccessories?: string;
  msrp?: number; // list price
  sellingPriceNew?: number; // customer price (new)
  sellingPriceUpgrade?: number; // customer price (upgrade)
  dealerCostNew?: number; // hard cost (new)
  dealerCostUpgrade?: number; // hard cost (upgrade)
}

// What we hand back to the line-item manager: the normalized product plus the
// pricing-type-resolved unitPrice (customer price) and unitCost (dealer cost).
export interface SelectedProduct extends Product {
  type: ProductType;
  unitPrice: number;
  unitCost: number;
}

interface ProductTypeSelectorProps {
  onProductSelect: (product: SelectedProduct) => void;
  pricingType: 'new' | 'upgrade';
  parentProductId?: string; // For selecting accessories for a specific product
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

// Read the first defined value across a list of camel/snake field names.
function pick(raw: Record<string, any>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
  }
  return undefined;
}

// Map a raw catalog row (any product type, camel or snake) to the normalized shape.
export function normalizeProduct(raw: Record<string, any>): Product {
  return {
    id: String(raw.id ?? ''),
    productCode: String(
      pick(raw, 'productCode', 'product_code', 'accessoryCode', 'accessory_code', 'code', 'sku') ??
        '',
    ),
    productName: String(
      pick(
        raw,
        'productName',
        'product_name',
        'accessoryName',
        'accessory_name',
        'name',
        'modelName',
        'model_name',
        'displayName',
        'display_name',
      ) ?? 'Unnamed Product',
    ),
    description: (pick(raw, 'description') as string) ?? undefined,
    category: (pick(raw, 'category') as string) ?? undefined,
    manufacturer: (pick(raw, 'manufacturer') as string) ?? undefined,
    isActive: pick(raw, 'isActive', 'is_active') !== false && raw.status !== 'inactive',
    requiredAccessories:
      (pick(raw, 'requiredAccessories', 'required_accessories') as string) ?? undefined,
    msrp: num(pick(raw, 'msrp')),
    sellingPriceNew: num(
      pick(
        raw,
        'newRepPrice',
        'new_rep_price',
        'newRepCost',
        'new_rep_cost',
        'standardRepPrice',
        'standard_rep_price',
        'newSuggestedRetail',
        'new_suggested_retail',
        'price',
        'unitPrice',
        'unit_price',
        'rate',
      ),
    ),
    sellingPriceUpgrade: num(
      pick(
        raw,
        'upgradeRepPrice',
        'upgrade_rep_price',
        'upgradeRepCost',
        'upgrade_rep_cost',
        'upgradeSuggestedRetail',
        'upgrade_suggested_retail',
      ),
    ),
    dealerCostNew: num(
      pick(
        raw,
        'newDealerCost',
        'new_dealer_cost',
        'standardDealerCost',
        'standard_dealer_cost',
        'dealerCost',
        'dealer_cost',
        'cost',
        'unitCost',
        'unit_cost',
      ),
    ),
    dealerCostUpgrade: num(pick(raw, 'upgradeDealerCost', 'upgrade_dealer_cost')),
  };
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [manufacturerFilter, setManufacturerFilter] = useState('all');

  const selectedTypeOption = productTypes.find((type) => type.value === selectedType);

  // QUOTE-012: debounce the search box 300ms before hitting the API (mirrors
  // CompanyContactSelector). The query key includes the debounced term + filters,
  // so changing any of them resets to page 1.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const PAGE_SIZE = 50;

  // QUOTE-012: server-side search + pagination (QUOTE-011 endpoints). "Load more"
  // fetches subsequent pages; total match count comes from the pagination envelope.
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [
        selectedTypeOption?.endpoint,
        parentProductId,
        debouncedSearch,
        categoryFilter,
        manufacturerFilter,
      ],
      initialPageParam: 1,
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams({ page: String(pageParam), limit: String(PAGE_SIZE) });
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (categoryFilter !== 'all') params.set('category', categoryFilter);
        if (manufacturerFilter !== 'all') params.set('manufacturer', manufacturerFilter);
        if (selectedType === 'product_accessories' && parentProductId) {
          params.set('modelId', parentProductId);
        }
        const response = await apiRequest(
          `${selectedTypeOption?.endpoint}?${params.toString()}`,
          'GET',
        );
        const raw =
          response?.data || response?.records || (Array.isArray(response) ? response : []);
        const rows = (Array.isArray(raw) ? raw : []).map((row: Record<string, any>) =>
          normalizeProduct(row),
        );
        const total = response?.pagination?.total ?? response?.total ?? rows.length;
        return { rows, total, page: Number(pageParam) };
      },
      getNextPageParam: (lastPage, allPages) => {
        const loaded = allPages.reduce((n, p) => n + p.rows.length, 0);
        return loaded < lastPage.total ? lastPage.page + 1 : undefined;
      },
      enabled: !!selectedTypeOption,
    });

  // Flatten loaded pages.
  const productsArray: Product[] = (data?.pages ?? []).flatMap((p) => p.rows);
  const totalMatches = data?.pages?.[0]?.total ?? productsArray.length;

  // Get unique categories and manufacturers for filtering
  const categories = Array.from(
    new Set(productsArray.map((p) => p.category).filter((c): c is string => Boolean(c))),
  );
  const manufacturers = Array.from(
    new Set(productsArray.map((p) => p.manufacturer).filter((m): m is string => Boolean(m))),
  );

  // QUOTE-012: search + category + manufacturer are now applied server-side. Only
  // the cheap active/inactive guard stays client-side.
  const filteredProducts = productsArray.filter((product) => product.isActive !== false);

  // Customer (selling) price for the active pricing tier, falling back to MSRP.
  const getPrice = (product: Product): number => {
    if (pricingType === 'upgrade' && product.sellingPriceUpgrade)
      return product.sellingPriceUpgrade;
    if (product.sellingPriceNew) return product.sellingPriceNew;
    return product.msrp || 0;
  };

  // Dealer (hard) cost for the active pricing tier. 0 when the catalog has no cost.
  const getCost = (product: Product): number => {
    if (pricingType === 'upgrade' && product.dealerCostUpgrade) return product.dealerCostUpgrade;
    return product.dealerCostNew || 0;
  };

  // QUOTE-009: flag products with no dealer cost so reps/managers know margin will
  // be unavailable for them.
  const hasCost = (product: Product): boolean => getCost(product) > 0;

  const handleProductSelect = (product: Product) => {
    onProductSelect({
      ...product,
      type: selectedType,
      unitPrice: getPrice(product),
      unitCost: getCost(product),
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
        {!isLoading && !isError && filteredProducts.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Showing {filteredProducts.length} of {totalMatches} products
          </div>
        )}
        <div className="border rounded-lg flex-1 min-h-0 flex flex-col">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading products...</p>
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-3">Couldn’t load products.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>
                {debouncedSearch
                  ? `No products match “${debouncedSearch}”`
                  : 'No products found matching your criteria'}
              </p>
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
                        {!hasCost(product) && (
                          <span className="inline-block mt-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            No cost — margin unavailable
                          </span>
                        )}
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
                      <TableHead className="w-[40%]">Product</TableHead>
                      <TableHead className="w-[12%]">Code</TableHead>
                      {selectedType === 'product_models' && (
                        <>
                          <TableHead className="w-[12%]">Category</TableHead>
                          <TableHead className="w-[12%]">Manufacturer</TableHead>
                        </>
                      )}
                      <TableHead className="w-[10%] text-right">MSRP</TableHead>
                      <TableHead className="w-[10%] text-right">Price</TableHead>
                      <TableHead className="w-[6%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id} className="group">
                        <TableCell className="py-2">
                          <div className="max-w-[300px]">
                            <div
                              className="font-medium text-sm truncate"
                              title={product.productName}
                            >
                              {product.productName}
                            </div>
                            {product.description && (
                              <div
                                className="text-xs text-muted-foreground truncate"
                                title={product.description}
                              >
                                {product.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            {product.productCode}
                          </span>
                        </TableCell>
                        {selectedType === 'product_models' && (
                          <>
                            <TableCell className="py-2 text-sm">
                              {product.category || '-'}
                            </TableCell>
                            <TableCell className="py-2 text-sm">
                              {product.manufacturer || '-'}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="py-2 text-right text-sm text-muted-foreground">
                          {formatPrice(product.msrp)}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <span className="font-medium text-sm">
                            {formatPrice(getPrice(product))}
                          </span>
                          {!hasCost(product) && (
                            <div
                              className="text-[10px] text-amber-700"
                              title="No dealer cost in catalog — margin unavailable"
                            >
                              no cost
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleProductSelect(product)}
                            className="h-8 w-8 p-0 opacity-60 group-hover:opacity-100 transition-opacity"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* QUOTE-012: load subsequent pages */}
              {hasNextPage && (
                <div className="p-3 text-center border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="min-h-[40px]"
                  >
                    {isFetchingNextPage
                      ? 'Loading…'
                      : `Load more (${filteredProducts.length} of ${totalMatches})`}
                  </Button>
                </div>
              )}
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
