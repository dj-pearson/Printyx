import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Filter,
  X,
  ChevronDown,
  Save,
  Star,
  Share2,
  Trash2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterOption {
  label: string;
  value: string | number;
  count?: number;
}

export interface FilterConfig {
  field: string;
  label: string;
  type: "select" | "multiselect" | "range" | "date" | "text";
  options?: FilterOption[];
  min?: number;
  max?: number;
  placeholder?: string;
}

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, any>;
  shared: boolean;
  isPinned?: boolean;
  userId?: string;
  createdAt?: Date;
}

interface SmartFilterBarProps {
  filters: FilterConfig[];
  activeFilters: Record<string, any>;
  onFilterChange: (field: string, value: any) => void;
  onClearAll: () => void;
  savedViews?: SavedView[];
  onSaveView?: (name: string, filters: Record<string, any>) => void;
  onLoadView?: (view: SavedView) => void;
  onDeleteView?: (viewId: string) => void;
  onPinView?: (viewId: string) => void;
  className?: string;
}

export function SmartFilterBar({
  filters,
  activeFilters,
  onFilterChange,
  onClearAll,
  savedViews = [],
  onSaveView,
  onLoadView,
  onDeleteView,
  onPinView,
  className,
}: SmartFilterBarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return Object.values(activeFilters).filter((v) => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "string") return v !== "" && v !== "all";
      return v !== null && v !== undefined;
    }).length;
  }, [activeFilters]);

  // Pinned views
  const pinnedViews = useMemo(
    () => savedViews.filter((v) => v.isPinned),
    [savedViews]
  );

  const handleSaveView = () => {
    if (viewName.trim() && onSaveView) {
      onSaveView(viewName.trim(), activeFilters);
      setViewName("");
      setSaveDialogOpen(false);
    }
  };

  const renderFilter = (config: FilterConfig) => {
    const value = activeFilters[config.field];

    switch (config.type) {
      case "select":
        return (
          <Select
            value={value || "all"}
            onValueChange={(v) => onFilterChange(config.field, v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={config.placeholder || "Select..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {config.label}</SelectItem>
              {config.options?.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                  {option.count !== undefined && (
                    <span className="ml-2 text-muted-foreground">({option.count})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multiselect":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-between">
                {Array.isArray(value) && value.length > 0
                  ? `${value.length} selected`
                  : config.label}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                <CommandInput placeholder={`Search ${config.label.toLowerCase()}...`} />
                <CommandEmpty>No options found.</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {config.options?.map((option) => (
                    <CommandItem
                      key={option.value}
                      onSelect={() => {
                        const currentValue = Array.isArray(value) ? value : [];
                        const newValue = currentValue.includes(option.value)
                          ? currentValue.filter((v) => v !== option.value)
                          : [...currentValue, option.value];
                        onFilterChange(config.field, newValue);
                      }}
                    >
                      <Checkbox
                        checked={Array.isArray(value) && value.includes(option.value)}
                        className="mr-2"
                      />
                      <span className="flex-1">{option.label}</span>
                      {option.count !== undefined && (
                        <Badge variant="secondary" className="ml-2">
                          {option.count}
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        );

      case "range":
        const rangeValue = value || [config.min || 0, config.max || 100];
        return (
          <div className="w-[200px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{config.label}</span>
              <span className="text-sm text-muted-foreground">
                ${rangeValue[0].toLocaleString()} - ${rangeValue[1].toLocaleString()}
              </span>
            </div>
            <Slider
              min={config.min || 0}
              max={config.max || 100}
              step={(config.max || 100) / 100}
              value={rangeValue}
              onValueChange={(v) => onFilterChange(config.field, v)}
              className="w-full"
            />
          </div>
        );

      case "text":
        return (
          <Input
            type="text"
            placeholder={config.placeholder || `Search ${config.label.toLowerCase()}...`}
            value={value || ""}
            onChange={(e) => onFilterChange(config.field, e.target.value)}
            className="w-[200px]"
          />
        );

      case "date":
        return (
          <Select
            value={value || "all"}
            onValueChange={(v) => onFilterChange(config.field, v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select date range..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="30days">Over 30 days ago</SelectItem>
              <SelectItem value="60days">Over 60 days ago</SelectItem>
              <SelectItem value="90days">Over 90 days ago</SelectItem>
            </SelectContent>
          </Select>
        );

      default:
        return null;
    }
  };

  const renderActiveFilterChips = () => {
    const chips: JSX.Element[] = [];

    filters.forEach((config) => {
      const value = activeFilters[config.field];
      if (!value) return;

      if (config.type === "multiselect" && Array.isArray(value)) {
        value.forEach((v) => {
          const option = config.options?.find((o) => o.value === v);
          if (option) {
            chips.push(
              <Badge
                key={`${config.field}-${v}`}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80"
              >
                <span className="text-xs">{config.label}: {option.label}</span>
                <X
                  className="ml-1 h-3 w-3"
                  onClick={() => {
                    const newValue = value.filter((val) => val !== v);
                    onFilterChange(config.field, newValue);
                  }}
                />
              </Badge>
            );
          }
        });
      } else if (config.type === "select" && value !== "all" && value !== "") {
        const option = config.options?.find((o) => String(o.value) === String(value));
        if (option) {
          chips.push(
            <Badge
              key={config.field}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
            >
              <span className="text-xs">{config.label}: {option.label}</span>
              <X
                className="ml-1 h-3 w-3"
                onClick={() => onFilterChange(config.field, "")}
              />
            </Badge>
          );
        }
      } else if (config.type === "text" && value !== "") {
        chips.push(
          <Badge
            key={config.field}
            variant="secondary"
            className="cursor-pointer hover:bg-secondary/80"
          >
            <span className="text-xs">{config.label}: "{value}"</span>
            <X
              className="ml-1 h-3 w-3"
              onClick={() => onFilterChange(config.field, "")}
            />
          </Badge>
        );
      } else if (config.type === "date" && value !== "all" && value !== "") {
        chips.push(
          <Badge
            key={config.field}
            variant="secondary"
            className="cursor-pointer hover:bg-secondary/80"
          >
            <span className="text-xs">{config.label}: {value}</span>
            <X
              className="ml-1 h-3 w-3"
              onClick={() => onFilterChange(config.field, "")}
            />
          </Badge>
        );
      }
    });

    return chips;
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Top Row: Filter Button, Saved Views, Save Button */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter Button */}
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filter Options</h4>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={onClearAll}>
                    Clear All
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {filters.map((config) => (
                  <div key={config.field} className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      {config.label}
                    </Label>
                    {renderFilter(config)}
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Pinned Saved Views */}
        {pinnedViews.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Quick:</span>
            {pinnedViews.map((view) => (
              <Button
                key={view.id}
                variant="outline"
                size="sm"
                onClick={() => onLoadView?.(view)}
              >
                <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                {view.name}
              </Button>
            ))}
          </div>
        )}

        {/* Saved Views Dropdown */}
        {savedViews.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Search className="h-4 w-4 mr-2" />
                Saved Views
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <div className="space-y-1">
                {savedViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-accent group"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 justify-start"
                      onClick={() => onLoadView?.(view)}
                    >
                      {view.isPinned && (
                        <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                      )}
                      {view.shared && <Share2 className="h-3 w-3 mr-1 text-blue-500" />}
                      {view.name}
                    </Button>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => onPinView?.(view.id)}
                      >
                        <Star className={cn("h-3 w-3", view.isPinned && "fill-yellow-400 text-yellow-400")} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => onDeleteView?.(view.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Save Current View */}
        {onSaveView && activeFilterCount > 0 && (
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save View
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Filter View</DialogTitle>
                <DialogDescription>
                  Save your current filter configuration for quick access later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="view-name">View Name</Label>
                  <Input
                    id="view-name"
                    placeholder="e.g., My Hot Leads"
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">Active Filters:</p>
                  <div className="flex flex-wrap gap-1">
                    {renderActiveFilterChips()}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveView} disabled={!viewName.trim()}>
                  Save View
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Clear All */}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            Clear All
          </Button>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active:</span>
          {renderActiveFilterChips()}
        </div>
      )}
    </div>
  );
}
