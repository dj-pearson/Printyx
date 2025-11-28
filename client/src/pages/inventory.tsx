import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BulkOperationsToolbar,
  useBulkSelection,
  BulkAction,
} from "@/components/ui/bulk-operations-toolbar";
import {
  exportToCSV,
  exportToJSON,
  createExportColumn,
} from "@/lib/export-utils";
import { SavedFilters, useFilterState } from "@/components/ui/saved-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  Download,
  FileText,
  Trash2,
  LayoutGrid,
  List as ListIcon,
  Upload,
} from "lucide-react";
import { CsvImportWizard } from "@/components/import";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type InventoryItem } from '@shared/schema';
import WarehouseTeamStatsWidget from "@/components/stats/WarehouseTeamStatsWidget";

export default function Inventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // View mode
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // Filter state management
  const filterState = useFilterState({
    searchTerm: '',
    stockStatus: 'all',
  });

  const { searchTerm, stockStatus } = filterState.filters;

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

  // Filter inventory items
  const filteredInventory = useMemo(() => {
    if (!inventory) return [];

    return inventory.filter((item) => {
      // Search filter
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term || (
        item.name?.toLowerCase().includes(term) ||
        item.sku?.toLowerCase().includes(term)
      );

      // Stock status filter
      const itemStockStatus = getStockStatus(item.currentStock, item.reorderPoint);
      const matchesStockStatus = stockStatus === 'all' || itemStockStatus === stockStatus;

      return matchesSearch && matchesStockStatus;
    });
  }, [inventory, searchTerm, stockStatus]);

  // Bulk selection
  const bulkSelection = useBulkSelection(filteredInventory);

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      await Promise.all(
        itemIds.map(id => apiRequest(`/api/inventory/${id}`, 'DELETE'))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      bulkSelection.clearSelection();
      toast({
        title: 'Success',
        description: `${bulkSelection.selectedCount} item(s) deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete some items',
        variant: 'destructive',
      });
    },
  });

  // Bulk export function
  const handleBulkExport = (format: 'csv' | 'json') => {
    const selectedItems = filteredInventory.filter((item) =>
      bulkSelection.selectedIds.includes(item.id)
    );

    const columns = [
      createExportColumn('name', 'Item Name'),
      createExportColumn('sku', 'SKU'),
      createExportColumn('currentStock', 'Current Stock'),
      createExportColumn('reorderPoint', 'Reorder Point'),
      createExportColumn('unitCost', 'Unit Cost', 'currency'),
      createExportColumn('location', 'Location'),
    ];

    if (format === 'csv') {
      exportToCSV(selectedItems, columns, { filename: 'inventory-export' });
    } else {
      exportToJSON(selectedItems, columns, { filename: 'inventory-export' });
    }

    toast({
      title: 'Export Complete',
      description: `${selectedItems.length} item(s) exported successfully`,
    });
  };

  // Bulk actions configuration
  const bulkActions: BulkAction[] = [
    {
      id: 'export-csv',
      label: 'Export CSV',
      icon: Download,
      onClick: () => handleBulkExport('csv'),
    },
    {
      id: 'export-json',
      label: 'Export JSON',
      icon: FileText,
      onClick: () => handleBulkExport('json'),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: (ids) => bulkDeleteMutation.mutate(ids),
      variant: 'destructive',
      requiresConfirmation: true,
      confirmationTitle: 'Delete Inventory Items',
      confirmationDescription: `Are you sure you want to delete ${bulkSelection.selectedCount} item(s)? This action cannot be undone.`,
    },
  ];

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
        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search inventory by name or SKU..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => filterState.updateFilter('searchTerm', e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                {/* Stock Status Filter */}
                <Select
                  value={stockStatus}
                  onValueChange={(value) => filterState.updateFilter('stockStatus', value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Stock Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="medium">Medium Stock</SelectItem>
                    <SelectItem value="good">In Stock</SelectItem>
                  </SelectContent>
                </Select>

                {/* Saved Filters */}
                <SavedFilters
                  storageKey="inventory.savedFilters"
                  currentFilters={filterState.filters}
                  onApplyFilter={filterState.applyFilters}
                  onClearFilters={filterState.clearFilters}
                  activeFilterCount={filterState.activeFilterCount}
                  getFilterDescription={(filters) => {
                    const parts: string[] = [];
                    if (filters.searchTerm) parts.push(`Search: "${filters.searchTerm}"`);
                    if (filters.stockStatus !== 'all') {
                      const statusLabels: Record<string, string> = {
                        low: 'Low Stock',
                        medium: 'Medium Stock',
                        good: 'In Stock',
                      };
                      parts.push(`Status: ${statusLabels[filters.stockStatus]}`);
                    }
                    return parts.length > 0 ? parts.join(' • ') : 'No filters applied';
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warehouse Team Performance Stats */}
        <WarehouseTeamStatsWidget variant="compact" />

        {/* View Controls */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {filteredInventory.length > 0 && (
              <Badge variant="secondary">
                {filteredInventory.length} {filteredInventory.length === 1 ? 'item' : 'items'}
              </Badge>
            )}
            {stockStatus === 'low' && filteredInventory.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Reorder needed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('cards')}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              <ListIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => setIsImportDialogOpen(true)}
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Item</span>
            </Button>
          </div>
        </div>

        {/* Bulk Operations Toolbar */}
        <BulkOperationsToolbar
          selectedCount={bulkSelection.selectedCount}
          totalCount={filteredInventory.length}
          onClearSelection={bulkSelection.clearSelection}
          onSelectAll={bulkSelection.selectAll}
          selectedIds={bulkSelection.selectedIds}
          actions={bulkActions}
        />

        {filteredInventory.length > 0 ? (
          viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInventory.map((item: InventoryItem) => {
              const itemStockStatus = getStockStatus(item.currentStock, item.reorderPoint);
              const stockBadge = getStockBadge(itemStockStatus);
              const isSelected = bulkSelection.isSelected(item.id);

              return (
                <Card
                  key={item.id}
                  className={`hover:shadow-md transition-shadow ${
                    isSelected ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-start space-x-3 flex-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => bulkSelection.toggleSelection(item.id)}
                          aria-label={`Select ${item.name}`}
                        />
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="h-5 w-5 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">SKU: {item.sku}</p>
                        </div>
                      </div>
                      <Badge variant={stockBadge.variant} className="ml-2 flex-shrink-0">
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

                    {itemStockStatus === 'low' && (
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
            /* Table View */
            <div className="bg-background rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={bulkSelection.isAllSelected}
                        onCheckedChange={bulkSelection.toggleAll}
                        aria-label="Select all items"
                      />
                    </TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Stock Status</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Reorder Point</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item: InventoryItem) => {
                    const itemStockStatus = getStockStatus(item.currentStock, item.reorderPoint);
                    const stockBadge = getStockBadge(itemStockStatus);

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={bulkSelection.isSelected(item.id)}
                            onCheckedChange={() => bulkSelection.toggleSelection(item.id)}
                            aria-label={`Select ${item.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell>
                          <Badge variant={stockBadge.variant}>{stockBadge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{item.currentStock}</TableCell>
                        <TableCell className="text-right">{item.reorderPoint}</TableCell>
                        <TableCell className="text-right">
                          ${Number(item.unitCost || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>{item.location || '—'}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" className="h-8">
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )
        ) : (
          <Card>
            <CardContent className="py-12">
              <EmptyState
                icon={Package}
                title={
                  searchTerm || stockStatus !== 'all'
                    ? 'No inventory items match your filters'
                    : 'No inventory items yet'
                }
                description={
                  searchTerm || stockStatus !== 'all'
                    ? 'Try adjusting your search criteria or filters'
                    : 'Add your first inventory item to start tracking stock levels and manage reorder points'
                }
                type={searchTerm || stockStatus !== 'all' ? 'filter' : 'default'}
                action={{
                  label: 'Add First Item',
                  onClick: () => toast({ title: 'Add Item', description: 'Add item dialog would open here' }),
                  icon: Plus,
                }}
                secondaryAction={
                  searchTerm || stockStatus !== 'all'
                    ? {
                        label: 'Clear Filters',
                        onClick: filterState.clearFilters,
                        variant: 'outline',
                      }
                    : undefined
                }
                suggestions={
                  !searchTerm && stockStatus === 'all'
                    ? [
                        'Track stock levels and get low stock alerts',
                        'Set reorder points to automate purchasing',
                        'Export inventory data for accounting and reporting',
                      ]
                    : undefined
                }
              />
            </CardContent>
          </Card>
        )}

        {/* CSV Import Wizard */}
        <CsvImportWizard
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          defaultEntityType="inventory"
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
            toast({
              title: "Import Complete",
              description: "Inventory items have been imported successfully.",
            });
          }}
        />
      </div>
    </MainLayout>
  );
}