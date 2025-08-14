import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Plus, Trash2, CheckSquare, Square } from "lucide-react";
import ProductImport from "@/components/product-import/ProductImport";
import { ReactNode } from "react";

type ManagementToolbarProps = {
  title: string;
  description?: string;
  searchPlaceholder?: string;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onAddClick: () => void;
  productTypeForImport?: string;
  bulkMode: boolean;
  onToggleBulkMode: () => void;
  selectedCount: number;
  totalCount: number;
  onBulkDelete?: () => void;
  rightExtras?: ReactNode;
};

export default function ManagementToolbar(props: ManagementToolbarProps) {
  const {
    title,
    description,
    searchPlaceholder = "Search...",
    searchTerm,
    onSearchTermChange,
    onAddClick,
    productTypeForImport,
    bulkMode,
    onToggleBulkMode,
    selectedCount,
    totalCount,
    onBulkDelete,
    rightExtras,
  } = props;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {productTypeForImport && (
            <ProductImport productType={productTypeForImport} />
          )}
          <Button onClick={onAddClick} data-testid="button-add-item">
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onToggleBulkMode} data-testid="button-bulk-mode">
              {bulkMode ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              {bulkMode ? "Bulk Mode On" : "Bulk Mode"}
            </Button>
            <Button
              variant="destructive"
              onClick={onBulkDelete}
              disabled={!bulkMode || selectedCount === 0}
              data-testid="button-bulk-delete"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedCount})
            </Button>
            {rightExtras}
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {selectedCount} selected • {totalCount} total
        </div>
      </Card>
    </div>
  );
}


