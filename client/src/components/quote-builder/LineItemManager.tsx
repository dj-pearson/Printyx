import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
} from 'lucide-react';
import ProductTypeSelector from './ProductTypeSelector';

type ProductType = 'product_models' | 'product_accessories' | 'professional_services' | 'service_products' | 'supplies' | 'managed_services';

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
  supplies: ShoppingCart,
  managed_services: Monitor,
};

const productTypeLabels = {
  product_models: 'Product Model',
  product_accessories: 'Accessory',
  professional_services: 'Professional Service',
  service_products: 'Service Product',
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

  const handleProductSelect = (product: any) => {
    // Ensure product name is not empty or undefined
    const productName = product.productName || product.name || product.description || 'Unnamed Product';
    const productCode = product.productCode || product.code || product.sku || '';
    
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
      listPrice: getProductPrice(product, pricingType),
      unitPrice: getProductPrice(product, pricingType),
      totalPrice: parseFloat(getProductPrice(product, pricingType).toString()),
      unitCost: product.unitCost || 0,
      margin: calculateMargin(getProductPrice(product, pricingType), product.unitCost || 0),
    };

    onAddItem(newItem);
    setShowProductSelector(false);
    setParentProductForAccessory(undefined);
  };

  const getProductPrice = (product: any, pricing: 'new' | 'upgrade'): number => {
    if (pricing === 'new' && product.newRepPrice) return product.newRepPrice;
    if (pricing === 'upgrade' && product.upgradeRepPrice) return product.upgradeRepPrice;
    return product.msrp || 0;
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
    return <Icon className="h-4 w-4" />;
  };

  // Group items by main products and their accessories
  const groupedItems = lineItems.reduce((acc, item, index) => {
    if (!item.isSubline) {
      acc.push({
        item,
        index,
        sublines: lineItems
          .map((subItem, subIndex) => ({ item: subItem, index: subIndex }))
          .filter(sub => sub.item.parentLineId === item.id),
      });
    }
    return acc;
  }, [] as Array<{ item: LineItem; index: number; sublines: Array<{ item: LineItem; index: number }> }>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Quote Line Items
            </CardTitle>
            <CardDescription>
              Add and manage products, services, and accessories for this quote
            </CardDescription>
          </div>
          <Dialog open={showProductSelector} onOpenChange={setShowProductSelector}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>
                  {parentProductForAccessory ? 'Add Accessory' : 'Add Product'}
                </DialogTitle>
                <DialogDescription>
                  {parentProductForAccessory 
                    ? 'Select an accessory for the selected product'
                    : 'Select a product or service to add to the quote'
                  }
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
      <CardContent>
        {lineItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No items added yet</h3>
            <p className="text-muted-foreground mb-4">
              Start building your quote by adding products and services
            </p>
            <Button onClick={() => setShowProductSelector(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Item
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedItems.map(({ item: mainItem, index: mainIndex, sublines }) => {
              // Calculate total for this line including sublines
              const lineTotal = mainItem.totalPrice + sublines.reduce((sum, sub) => sum + sub.item.totalPrice, 0);
              
              return (
              <div key={mainItem.id || mainIndex} className="border rounded-lg">
                {/* Total Summary Line */}
                <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {mainItem.lineNumber}
                      </Badge>
                      <div className="flex items-center gap-2">
                        {getProductTypeIcon(mainItem.productType)}
                        <div className="font-semibold">
                          {mainItem.productName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {mainItem.productType === 'product_models' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddAccessory(mainIndex)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Wrench className="h-4 w-4 mr-1" />
                          Add Accessory
                        </Button>
                      )}
                      <div className="font-bold text-lg">
                        {formatCurrency(lineTotal)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Product Details */}
                <div className="p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
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
                        <div className="font-medium">{mainItem.productName}</div>
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
                          className="text-blue-600 hover:text-blue-700"
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
                            onChange={(e) => handleQuantityChange(mainIndex, parseInt(e.target.value) || 1)}
                            className="w-16 h-8"
                            min="1"
                          />
                          <span className="text-sm text-muted-foreground">×</span>
                          <Input
                            type="number"
                            value={mainItem.unitPrice}
                            onChange={(e) => handlePriceChange(mainIndex, parseFloat(e.target.value) || 0)}
                            className="w-24 h-8"
                            step="0.01"
                          />
                          <span className="text-sm text-muted-foreground">=</span>
                          <div className="font-medium w-20 text-right">
                            {formatCurrency(mainItem.totalPrice)}
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
                                  Are you sure you want to delete this item? This action cannot be undone.
                                  {sublines.length > 0 && (
                                    <span className="block mt-2 text-orange-600">
                                      This will also delete {sublines.length} associated accessory/accessories.
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
                      <div key={subItem.id || subIndex} className="p-4 pl-8 bg-muted/10 border-t border-dashed">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MoveDown className="h-4 w-4" />
                              {getProductTypeIcon(subItem.productType)}
                              <Badge variant="outline" size="sm">
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
                                  onChange={(e) => handleQuantityChange(subIndex, parseInt(e.target.value) || 1)}
                                  className="w-16 h-8"
                                  min="1"
                                />
                                <span className="text-sm text-muted-foreground">×</span>
                                <Input
                                  type="number"
                                  value={subItem.unitPrice}
                                  onChange={(e) => handlePriceChange(subIndex, parseFloat(e.target.value) || 0)}
                                  className="w-24 h-8"
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
                                        Are you sure you want to delete this accessory? This action cannot be undone.
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Line Item</DialogTitle>
              <DialogDescription>
                Modify the details for this line item
              </DialogDescription>
            </DialogHeader>
            {editingItem && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Quantity</label>
                    <Input
                      type="number"
                      value={editingItem.quantity}
                      onChange={(e) => setEditingItem({
                        ...editingItem,
                        quantity: parseInt(e.target.value) || 1
                      })}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unit Price</label>
                    <Input
                      type="number"
                      value={editingItem.unitPrice}
                      onChange={(e) => setEditingItem({
                        ...editingItem,
                        unitPrice: parseFloat(e.target.value) || 0
                      })}
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Input
                    value={editingItem.notes || ''}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      notes: e.target.value
                    })}
                    placeholder="Additional notes for this item..."
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEdit}>
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