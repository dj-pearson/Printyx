import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useRequiredAccessories,
  addRequiredAccessoriesToQuote,
  getRequiredAccessoriesInfo,
} from '@/lib/useRequiredAccessories';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Trash2,
  Edit,
  MoreHorizontal,
  Package,
  Wrench,
  UserCheck,
  Cog,
  ShoppingCart,
  Monitor,
  DollarSign,
  Hash,
  MoveDown,
  MoveUp,
  Minus,
} from 'lucide-react';
import ProductTypeSelector, { normalizeProduct } from './ProductTypeSelector';

type ProductType =
  | 'product_models'
  | 'product_accessories'
  | 'professional_services'
  | 'service_products'
  | 'software_products'
  | 'supplies'
  | 'managed_services';

interface LineItem {
  id?: string;
  lineNumber: number;
  parentLineId?: string;
  isSubline: boolean;
  productType: ProductType;
  productId: string;
  productCode: string;
  productName: string;
  description?: string;
  quantity: number;
  msrp?: number;
  listPrice?: number;
  unitPrice: number;
  totalPrice: number;
  unitCost?: number;
  margin?: number;
  notes?: string;
}

interface LineItemManagerProps {
  lineItems: LineItem[];
  pricingType: 'new' | 'upgrade';
  onAddItem: (item: Omit<LineItem, 'lineNumber'>) => void;
  onUpdateItem: (index: number, item: LineItem) => void;
  onDeleteItem: (index: number) => void;
}

const productTypeIcons = {
  product_models: Package,
  product_accessories: Wrench,
  professional_services: UserCheck,
  service_products: Cog,
  software_products: Hash,
  supplies: ShoppingCart,
  managed_services: Monitor,
};

const productTypeLabels = {
  product_models: 'Product Model',
  product_accessories: 'Accessory',
  professional_services: 'Professional Service',
  service_products: 'Service Product',
  software_products: 'Software Product',
  supplies: 'Supply',
  managed_services: 'Managed Service',
};

export default function LineItemManager({
  lineItems,
  pricingType,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: LineItemManagerProps) {
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<LineItem | null>(null);
  const [parentProductForAccessory, setParentProductForAccessory] = useState<string | undefined>();

  // Resolve customer (selling) price for a normalized product by pricing tier.
  const resolveSellingPrice = (p: any, pricing: 'new' | 'upgrade'): number => {
    if (pricing === 'upgrade' && p.sellingPriceUpgrade) return p.sellingPriceUpgrade;
    return p.sellingPriceNew || p.msrp || 0;
  };
  const resolveDealerCost = (p: any, pricing: 'new' | 'upgrade'): number => {
    if (pricing === 'upgrade' && p.dealerCostUpgrade) return p.dealerCostUpgrade;
    return p.dealerCostNew || 0;
  };

  const handleProductSelect = async (product: any) => {
    const productName = product.productName || product.name || 'Unnamed Product';
    const productCode = product.productCode || product.code || product.sku || '';
    // ProductTypeSelector resolves unitPrice/unitCost for the active tier; fall
    // back to local resolution if a raw product slips through.
    const unitPrice =
      typeof product.unitPrice === 'number'
        ? product.unitPrice
        : resolveSellingPrice(product, pricingType);
    const unitCost =
      typeof product.unitCost === 'number'
        ? product.unitCost
        : resolveDealerCost(product, pricingType);

    const newItem: Omit<LineItem, 'lineNumber'> = {
      isSubline: !!parentProductForAccessory,
      parentLineId: parentProductForAccessory,
      productType: product.type,
      productId: product.id,
      productCode: productCode,
      productName: productName,
      description: product.description || '',
      quantity: 1,
      msrp: product.msrp || 0,
      listPrice: unitPrice,
      unitPrice: unitPrice,
      totalPrice: unitPrice,
      unitCost: unitCost,
      margin: calculateMargin(unitPrice, unitCost),
    };

    // Add the main product
    onAddItem(newItem);

    // If this is a product model, automatically add required accessories
    if (product.type === 'product_models' && product.requiredAccessories) {
      // Parse required accessory codes
      const requiredCodes = product.requiredAccessories
        .split(',')
        .map((code: string) => code.trim())
        .filter((code: string) => code.length > 0);

      if (requiredCodes.length > 0) {
        // Fetch matching accessories from product accessories catalog
        try {
          const response = await fetch(`/api/product-accessories?codes=${requiredCodes.join(',')}`);
          if (response.ok) {
            const payload = await response.json();
            const rawAccessories = Array.isArray(payload)
              ? payload
              : payload?.data || payload?.records || [];

            // Add each required accessory as a line item (normalized for cost/price)
            rawAccessories.forEach((raw: any) => {
              const accessory = normalizeProduct(raw);
              const accPrice = resolveSellingPrice(accessory, pricingType);
              const accCost = resolveDealerCost(accessory, pricingType);
              const accessoryItem: Omit<LineItem, 'lineNumber'> = {
                isSubline: false,
                productType: 'product_accessories',
                productId: accessory.id,
                productCode: accessory.productCode,
                productName: `${accessory.productName} (Required for ${productName})`,
                description: `Required accessory for ${productName}`,
                quantity: 1,
                msrp: accessory.msrp || 0,
                listPrice: accPrice,
                unitPrice: accPrice,
                totalPrice: accPrice,
                unitCost: accCost,
                margin: calculateMargin(accPrice, accCost),
                notes: `Auto-added required accessory for ${productName}`,
              };
              onAddItem(accessoryItem);
            });
          }
        } catch (error) {
          console.warn('Failed to fetch required accessories:', error);
        }
      }
    }

    setShowProductSelector(false);
    setParentProductForAccessory(undefined);
  };

  const calculateMargin = (price: number, cost: number): number => {
    if (cost === 0) return 0;
    return ((price - cost) / price) * 100;
  };

  const handleQuantityChange = (index: number, newQuantity: number) => {
    const item = lineItems[index];
    const updatedItem = {
      ...item,
      quantity: newQuantity,
      totalPrice: newQuantity * parseFloat(item.unitPrice.toString()),
    };
    onUpdateItem(index, updatedItem);
  };

  const handlePriceChange = (index: number, newPrice: number) => {
    const item = lineItems[index];
    const updatedItem = {
      ...item,
      unitPrice: newPrice,
      totalPrice: parseFloat(item.quantity.toString()) * parseFloat(newPrice.toString()),
      margin: calculateMargin(newPrice, item.unitCost || 0),
    };
    onUpdateItem(index, updatedItem);
  };

  const handleEditItem = (index: number) => {
    setEditingIndex(index);
    setEditingItem({ ...lineItems[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editingItem) {
      const updatedItem = {
        ...editingItem,
        totalPrice: editingItem.quantity * editingItem.unitPrice,
        margin: calculateMargin(editingItem.unitPrice, editingItem.unitCost || 0),
      };
      onUpdateItem(editingIndex, updatedItem);
      setEditingIndex(null);
      setEditingItem(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingItem(null);
  };

  const handleAddAccessory = (parentIndex: number) => {
    const parentItem = lineItems[parentIndex];
    if (parentItem.productType === 'product_models') {
      setParentProductForAccessory(parentItem.productId);
      setShowProductSelector(true);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getProductTypeIcon = (type: ProductType) => {
    const Icon = productTypeIcons[type];
    if (!Icon) {
      console.warn(`Missing icon for product type: ${type}`);
      return <Package className="h-4 w-4" />; // fallback icon
    }
    return <Icon className="h-4 w-4" />;
  };

  // Group items by main products and their accessories
  const groupedItems = lineItems.reduce(
    (acc, item, index) => {
      if (!item.isSubline) {
        acc.push({
          item,
          index,
          sublines: lineItems
            .map((subItem, subIndex) => ({ item: subItem, index: subIndex }))
            .filter((sub) => sub.item.parentLineId === item.productId),
        });
      }
      return acc;
    },
    [] as Array<{
      item: LineItem;
      index: number;
      sublines: Array<{ item: LineItem; index: number }>;
    }>,
  );

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Package className="h-5 w-5" />
              Quote Line Items
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Add and manage products, services, and accessories for this quote
            </CardDescription>
          </div>
          <Dialog open={showProductSelector} onOpenChange={setShowProductSelector}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto min-h-[44px] active:scale-[0.98] transition-transform">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] w-[95vw] sm:w-full overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>
                  {parentProductForAccessory ? 'Add Accessory' : 'Add Product'}
                </DialogTitle>
                <DialogDescription>
                  {parentProductForAccessory
                    ? 'Select an accessory for the selected product'
                    : 'Select a product or service to add to the quote'}
                </DialogDescription>
              </DialogHeader>
              <ProductTypeSelector
                onProductSelect={handleProductSelect}
                pricingType={pricingType}
                parentProductId={parentProductForAccessory}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {lineItems.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">No items added yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start building your quote by adding products and services
            </p>
            <Button
              onClick={() => setShowProductSelector(true)}
              className="min-h-[44px] active:scale-[0.98] transition-transform"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Item
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedItems.map(({ item: mainItem, index: mainIndex, sublines }) => {
              // Calculate total for this line including sublines
              const lineTotal =
                mainItem.totalPrice + sublines.reduce((sum, sub) => sum + sub.item.totalPrice, 0);

              return (
                <div key={mainItem.id || mainIndex} className="border rounded-lg overflow-hidden">
                  {/* Main Item with darker background to show it's the total line */}
                  <div className="p-3 sm:p-4 bg-slate-100 dark:bg-slate-800">
                    {/* Mobile Layout */}
                    <div className="block sm:hidden space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <Badge variant="outline" className="flex items-center gap-1 shrink-0">
                            <Hash className="h-3 w-3" />
                            {mainItem.lineNumber}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getProductTypeIcon(mainItem.productType)}
                              <Badge variant="secondary" className="text-xs">
                                {productTypeLabels[mainItem.productType]}
                              </Badge>
                            </div>
                            <div className="font-semibold text-sm line-clamp-2">
                              {mainItem.productName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {mainItem.productCode}
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditItem(mainIndex)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            {mainItem.productType === 'product_models' && (
                              <DropdownMenuItem onClick={() => handleAddAccessory(mainIndex)}>
                                <Wrench className="h-4 w-4 mr-2" />
                                Add Accessory
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Item
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Line Item</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this item? This action cannot be
                                    undone.
                                    {sublines.length > 0 && (
                                      <span className="block mt-2 text-orange-600">
                                        This will also delete {sublines.length} associated
                                        accessory/accessories.
                                      </span>
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => onDeleteItem(mainIndex)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Quantity and Price Controls - Mobile */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-16">Quantity:</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 w-9 p-0 active:scale-[0.95]"
                              onClick={() =>
                                handleQuantityChange(mainIndex, Math.max(1, mainItem.quantity - 1))
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              value={mainItem.quantity}
                              onChange={(e) =>
                                handleQuantityChange(mainIndex, parseInt(e.target.value) || 1)
                              }
                              className="w-16 h-9 text-center"
                              min="1"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 w-9 p-0 active:scale-[0.95]"
                              onClick={() => handleQuantityChange(mainIndex, mainItem.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-16">Unit Price:</span>
                          <Input
                            type="number"
                            value={mainItem.unitPrice}
                            onChange={(e) =>
                              handlePriceChange(mainIndex, parseFloat(e.target.value) || 0)
                            }
                            className="flex-1 h-9"
                            step="0.01"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm font-medium">Line Total:</span>
                          <span className="text-lg font-bold">{formatCurrency(lineTotal)}</span>
                        </div>
                        {mainItem.msrp && mainItem.msrp !== mainItem.unitPrice && (
                          <div className="text-xs text-muted-foreground text-right">
                            MSRP: {formatCurrency(mainItem.msrp)}
                          </div>
                        )}
                      </div>

                      {mainItem.productType === 'product_models' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddAccessory(mainIndex)}
                          className="w-full text-blue-600 hover:text-blue-700 min-h-[44px]"
                        >
                          <Wrench className="h-4 w-4 mr-2" />
                          Add Accessory
                        </Button>
                      )}
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {mainItem.lineNumber}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {getProductTypeIcon(mainItem.productType)}
                          <Badge variant="secondary">
                            {productTypeLabels[mainItem.productType]}
                          </Badge>
                        </div>
                        <div>
                          <div className="font-semibold">{mainItem.productName}</div>
                          <div className="text-sm text-muted-foreground">
                            {mainItem.productCode}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {mainItem.productType === 'product_models' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddAccessory(mainIndex)}
                            className="text-blue-600 hover:text-blue-700 min-h-[44px]"
                          >
                            <Wrench className="h-4 w-4 mr-1" />
                            Add Accessory
                          </Button>
                        )}
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={mainItem.quantity}
                              onChange={(e) =>
                                handleQuantityChange(mainIndex, parseInt(e.target.value) || 1)
                              }
                              className="w-16 h-9 min-h-[44px]"
                              min="1"
                            />
                            <span className="text-sm text-muted-foreground">×</span>
                            <Input
                              type="number"
                              value={mainItem.unitPrice}
                              onChange={(e) =>
                                handlePriceChange(mainIndex, parseFloat(e.target.value) || 0)
                              }
                              className="w-24 h-9 min-h-[44px]"
                              step="0.01"
                            />
                            <span className="text-sm text-muted-foreground">=</span>
                            <div className="font-bold text-lg w-24 text-right">
                              {formatCurrency(lineTotal)}
                            </div>
                          </div>
                          {mainItem.msrp && mainItem.msrp !== mainItem.unitPrice && (
                            <div className="text-xs text-muted-foreground">
                              MSRP: {formatCurrency(mainItem.msrp)}
                            </div>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditItem(mainIndex)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            {mainItem.productType === 'product_models' && (
                              <DropdownMenuItem onClick={() => handleAddAccessory(mainIndex)}>
                                <Wrench className="h-4 w-4 mr-2" />
                                Add Accessory
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Item
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Line Item</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this item? This action cannot be
                                    undone.
                                    {sublines.length > 0 && (
                                      <span className="block mt-2 text-orange-600">
                                        This will also delete {sublines.length} associated
                                        accessory/accessories.
                                      </span>
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => onDeleteItem(mainIndex)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>

                  {/* Sublines (Accessories) */}
                  {sublines.length > 0 && (
                    <div className="border-t">
                      {sublines.map(({ item: subItem, index: subIndex }) => (
                        <div
                          key={subItem.id || subIndex}
                          className="p-3 sm:p-4 sm:pl-8 bg-muted/10 border-t border-dashed"
                        >
                          {/* Mobile Subline Layout */}
                          <div className="block sm:hidden space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <MoveDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    {getProductTypeIcon(subItem.productType)}
                                    <Badge variant="outline" className="text-xs">
                                      {productTypeLabels[subItem.productType]}
                                    </Badge>
                                  </div>
                                  <div className="font-medium text-sm line-clamp-2">
                                    {subItem.productName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {subItem.productCode}
                                  </div>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 p-0 shrink-0"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditItem(subIndex)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Accessory</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this accessory? This
                                          action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => onDeleteItem(subIndex)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <div className="space-y-2 pl-6">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-16">
                                  Quantity:
                                </span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 w-9 p-0 active:scale-[0.95]"
                                    onClick={() =>
                                      handleQuantityChange(
                                        subIndex,
                                        Math.max(1, subItem.quantity - 1),
                                      )
                                    }
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    value={subItem.quantity}
                                    onChange={(e) =>
                                      handleQuantityChange(subIndex, parseInt(e.target.value) || 1)
                                    }
                                    className="w-16 h-9 text-center"
                                    min="1"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 w-9 p-0 active:scale-[0.95]"
                                    onClick={() =>
                                      handleQuantityChange(subIndex, subItem.quantity + 1)
                                    }
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-16">
                                  Unit Price:
                                </span>
                                <Input
                                  type="number"
                                  value={subItem.unitPrice}
                                  onChange={(e) =>
                                    handlePriceChange(subIndex, parseFloat(e.target.value) || 0)
                                  }
                                  className="flex-1 h-9"
                                  step="0.01"
                                />
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t">
                                <span className="text-sm font-medium">Total:</span>
                                <span className="font-semibold">
                                  {formatCurrency(subItem.totalPrice)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Desktop Subline Layout */}
                          <div className="hidden sm:flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MoveDown className="h-4 w-4" />
                                {getProductTypeIcon(subItem.productType)}
                                <Badge variant="outline" className="text-xs">
                                  {productTypeLabels[subItem.productType]}
                                </Badge>
                              </div>
                              <div>
                                <div className="font-medium">{subItem.productName}</div>
                                <div className="text-sm text-muted-foreground">
                                  {subItem.productCode}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={subItem.quantity}
                                    onChange={(e) =>
                                      handleQuantityChange(subIndex, parseInt(e.target.value) || 1)
                                    }
                                    className="w-16 h-9 min-h-[44px]"
                                    min="1"
                                  />
                                  <span className="text-sm text-muted-foreground">×</span>
                                  <Input
                                    type="number"
                                    value={subItem.unitPrice}
                                    onChange={(e) =>
                                      handlePriceChange(subIndex, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-24 h-9 min-h-[44px]"
                                    step="0.01"
                                  />
                                  <span className="text-sm text-muted-foreground">=</span>
                                  <div className="font-medium w-20 text-right">
                                    {formatCurrency(subItem.totalPrice)}
                                  </div>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditItem(subIndex)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Accessory</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this accessory? This
                                          action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => onDeleteItem(subIndex)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editingIndex !== null} onOpenChange={(open) => !open && handleCancelEdit()}>
          <DialogContent className="w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Line Item</DialogTitle>
              <DialogDescription>Modify the details for this line item</DialogDescription>
            </DialogHeader>
            {editingItem && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Quantity</label>
                    <Input
                      type="number"
                      value={editingItem.quantity}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          quantity: parseInt(e.target.value) || 1,
                        })
                      }
                      min="1"
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unit Price</label>
                    <Input
                      type="number"
                      value={editingItem.unitPrice}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          unitPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      step="0.01"
                      className="min-h-[44px]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Input
                    value={editingItem.notes || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        notes: e.target.value,
                      })
                    }
                    placeholder="Additional notes for this item..."
                    className="min-h-[44px]"
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="min-h-[44px] active:scale-[0.98] transition-transform"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    className="min-h-[44px] active:scale-[0.98] transition-transform"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
