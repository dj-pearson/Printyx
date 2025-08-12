import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Package, AlertTriangle } from "lucide-react";
import { type InventoryItem } from '@shared/schema';

export default function Inventory() {
  const { data: inventory, isLoading: inventoryLoading } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory'],
  });

  const getStockStatus = (currentStock: number, reorderPoint: number) => {
    if (currentStock <= reorderPoint) return 'low';
    if (currentStock <= reorderPoint * 1.5) return 'medium';
    return 'good';
  };

  const getStockBadge = (status: string) => {
    switch (status) {
      case 'low': return { variant: 'destructive' as const, label: 'Low Stock' };
      case 'medium': return { variant: 'secondary' as const, label: 'Medium Stock' };
      case 'good': return { variant: 'default' as const, label: 'In Stock' };
      default: return { variant: 'outline' as const, label: 'Unknown' };
    }
  };

  if (inventoryLoading) {
    return (
      <MainLayout 
        title="Inventory" 
        description="Manage parts, supplies, and stock levels"
      >
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Inventory" 
      description="Manage parts, supplies, and stock levels"
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input placeholder="Search inventory..." className="pl-10" />
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>

        {inventory && Array.isArray(inventory) && inventory.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.isArray(inventory) && inventory.map((item: InventoryItem) => {
              const stockStatus = getStockStatus(item.currentStock, item.reorderPoint);
              const stockBadge = getStockBadge(stockStatus);
              
              return (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                          <Package className="h-5 w-5 text-primary-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{item.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">SKU: {item.sku}</p>
                        </div>
                      </div>
                      <Badge variant={stockBadge.variant}>
                        {stockBadge.label}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Current Stock</p>
                        <p className="text-lg font-semibold text-gray-900">{item.currentStock}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Unit Cost</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ${Number(item.unitCost || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    
                    {stockStatus === 'low' && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-red-700">Reorder needed</span>
                      </div>
                    )}
                    
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      <Button variant="outline" size="sm">
                        Update Stock
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No inventory items</h3>
                <p className="text-gray-600 mb-6">Add your first inventory item to start tracking stock levels.</p>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add First Item
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}