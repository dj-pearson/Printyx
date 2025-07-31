import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNav from "@/components/ui/mobile-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Package, AlertTriangle } from "lucide-react";

export default function Inventory() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const { data: inventory, isLoading: inventoryLoading } = useQuery({
    queryKey: ['/api/inventory'],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inventory...</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <Header title="Inventory" description="Manage parts, supplies, and stock levels" />
        
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search inventory..."
                className="pl-10"
              />
            </div>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>

          {inventoryLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : inventory && inventory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inventory.map((item: any) => {
                const stockStatus = getStockStatus(item.currentStock, item.reorderPoint);
                const stockBadge = getStockBadge(stockStatus);
                
                return (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Package className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{item.name}</h3>
                            <p className="text-sm text-gray-600">{item.category}</p>
                          </div>
                        </div>
                        <Badge variant={stockBadge.variant}>
                          {stockStatus === 'low' && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {stockBadge.label}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        {item.partNumber && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Part #:</span> {item.partNumber}
                          </p>
                        )}
                        {item.supplier && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Supplier:</span> {item.supplier}
                          </p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Current Stock</p>
                          <p className="text-lg font-semibold text-gray-900">{item.currentStock}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Reorder Point</p>
                          <p className="text-lg font-semibold text-gray-900">{item.reorderPoint}</p>
                        </div>
                      </div>
                      
                      {item.unitCost && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Unit Cost</p>
                          <p className="text-lg font-semibold text-gray-900">
                            ${Number(item.unitCost).toFixed(2)}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          Update Stock
                        </Button>
                        <Button variant="outline" size="sm">
                          Edit
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No inventory items found</h3>
                  <p className="text-gray-600 mb-6">Add your first inventory item to start tracking stock.</p>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      
      <MobileNav />
    </div>
  );
}
