import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Star, StarOff, Save, Trash2, Filter, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterState {
  [key: string]: any;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
  isDefault?: boolean;
  createdAt: string;
}

export interface SavedFiltersProps {
  /** Storage key for localStorage */
  storageKey: string;
  /** Current filter state */
  currentFilters: FilterState;
  /** Callback when a saved filter is applied */
  onApplyFilter: (filters: FilterState) => void;
  /** Callback when filters are cleared */
  onClearFilters: () => void;
  /** Get a human-readable description of the filter state */
  getFilterDescription?: (filters: FilterState) => string;
  /** Number of active filters */
  activeFilterCount?: number;
  className?: string;
}

export function SavedFilters({
  storageKey,
  currentFilters,
  onApplyFilter,
  onClearFilters,
  getFilterDescription,
  activeFilterCount = 0,
  className,
}: SavedFiltersProps) {
  const [savedFilters, setSavedFilters] = React.useState<SavedFilter[]>([]);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [filterName, setFilterName] = React.useState('');
  const [deleteFilterId, setDeleteFilterId] = React.useState<string | null>(null);

  // Load saved filters from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setSavedFilters(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load saved filters:', e);
      }
    }
  }, [storageKey]);

  // Save to localStorage whenever savedFilters changes
  const persistFilters = (filters: SavedFilter[]) => {
    localStorage.setItem(storageKey, JSON.stringify(filters));
    setSavedFilters(filters);
  };

  const handleSaveFilter = () => {
    if (!filterName.trim()) return;

    const newFilter: SavedFilter = {
      id: `filter-${Date.now()}`,
      name: filterName.trim(),
      filters: currentFilters,
      createdAt: new Date().toISOString(),
    };

    persistFilters([...savedFilters, newFilter]);
    setFilterName('');
    setShowSaveDialog(false);
  };

  const handleDeleteFilter = (id: string) => {
    persistFilters(savedFilters.filter((f) => f.id !== id));
    setDeleteFilterId(null);
  };

  const handleSetDefault = (id: string) => {
    persistFilters(
      savedFilters.map((f) => ({
        ...f,
        isDefault: f.id === id,
      })),
    );
  };

  const handleApplyFilter = (filter: SavedFilter) => {
    onApplyFilter(filter.filters);
  };

  const defaultFilter = savedFilters.find((f) => f.isDefault);

  // Apply default filter on component mount if exists
  React.useEffect(() => {
    if (defaultFilter && activeFilterCount === 0) {
      onApplyFilter(defaultFilter.filters);
    }
  }, []); // Only run once on mount

  return (
    <>
      <div className={cn('flex items-center gap-2', className)}>
        {/* Active Filters Badge */}
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            <Filter className="h-3 w-3" />
            {activeFilterCount} active
          </Badge>
        )}

        {/* Saved Filters Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Saved Filters</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Saved Filters</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {savedFilters.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No saved filters yet
              </div>
            ) : (
              <>
                {savedFilters.map((filter) => (
                  <div
                    key={filter.id}
                    className="flex items-center gap-1 hover:bg-muted rounded-sm"
                  >
                    <button
                      onClick={() => handleSetDefault(filter.id)}
                      className="p-2 hover:bg-muted rounded-sm"
                      title={filter.isDefault ? 'Remove as default' : 'Set as default'}
                    >
                      {filter.isDefault ? (
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ) : (
                        <StarOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => handleApplyFilter(filter)}
                      className="flex-1 px-2 py-1.5 text-left text-sm"
                    >
                      <div className="font-medium">{filter.name}</div>
                      {getFilterDescription && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {getFilterDescription(filter.filters)}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => setDeleteFilterId(filter.id)}
                      className="p-2 hover:bg-destructive/10 rounded-sm"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
              <Save className="h-4 w-4 mr-2" />
              Save Current Filter
            </DropdownMenuItem>

            {activeFilterCount > 0 && (
              <DropdownMenuItem onClick={onClearFilters}>
                <Filter className="h-4 w-4 mr-2" />
                Clear All Filters
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Save Filter Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter</DialogTitle>
            <DialogDescription>
              Give this filter a name to save it for quick access later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filter-name">Filter Name</Label>
              <Input
                id="filter-name"
                placeholder="e.g., High Priority Deals"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveFilter();
                  }
                }}
              />
            </div>

            {getFilterDescription && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="text-sm font-medium mb-1">Current Filters:</div>
                <div className="text-sm text-muted-foreground">
                  {getFilterDescription(currentFilters)}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFilter} disabled={!filterName.trim()}>
              <Check className="h-4 w-4 mr-2" />
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteFilterId !== null}
        onOpenChange={(open) => !open && setDeleteFilterId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Saved Filter</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this saved filter? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFilterId && handleDeleteFilter(deleteFilterId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Hook to manage filter state with saved filters support
 */
export function useFilterState<T extends FilterState>(initialState: T) {
  const [filters, setFilters] = React.useState<T>(initialState);

  const updateFilter = (key: keyof T, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const updateFilters = (updates: Partial<T>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const clearFilters = () => {
    setFilters(initialState);
  };

  const applyFilters = (newFilters: Partial<T>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // Count active filters (non-default values)
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    const initialValue = initialState[key as keyof T];
    return (
      value !== initialValue &&
      value !== '' &&
      value !== 'all' &&
      value !== null &&
      value !== undefined
    );
  }).length;

  return {
    filters,
    updateFilter,
    updateFilters,
    clearFilters,
    applyFilters,
    activeFilterCount,
  };
}
