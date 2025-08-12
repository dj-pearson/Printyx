import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { 
  Filter, 
  X, 
  Calendar as CalendarIcon, 
  Search, 
  RefreshCw,
  Save,
  Download
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

export interface FilterValue {
  id: string;
  label: string;
  value: any;
  type: 'select' | 'multiselect' | 'dateRange' | 'number' | 'text' | 'boolean' | 'slider';
}

export interface FilterOption {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'dateRange' | 'number' | 'text' | 'boolean' | 'slider';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  defaultValue?: any;
}

interface AdvancedFilterProps {
  filters: FilterOption[];
  values: FilterValue[];
  onFiltersChange: (filters: FilterValue[]) => void;
  onReset: () => void;
  onSave?: (name: string) => void;
  onExport?: () => void;
  savedFilters?: { name: string; filters: FilterValue[] }[];
  className?: string;
}

export default function AdvancedFilter({
  filters,
  values,
  onFiltersChange,
  onReset,
  onSave,
  onExport,
  savedFilters = [],
  className = ''
}: AdvancedFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const updateFilter = (id: string, value: any) => {
    const filter = filters.find(f => f.id === id);
    if (!filter) return;

    const newValues = values.filter(v => v.id !== id);
    newValues.push({
      id,
      label: filter.label,
      value,
      type: filter.type
    });
    onFiltersChange(newValues);
  };

  const removeFilter = (id: string) => {
    onFiltersChange(values.filter(v => v.id !== id));
  };

  const getFilterValue = (id: string) => {
    return values.find(v => v.id === id)?.value;
  };

  const activeFiltersCount = values.filter(v => {
    if (v.type === 'text') return v.value && v.value.trim() !== '';
    if (v.type === 'multiselect') return v.value && v.value.length > 0;
    if (v.type === 'dateRange') return v.value && (v.value.from || v.value.to);
    return v.value !== undefined && v.value !== null && v.value !== '';
  }).length;

  const renderFilterInput = (filter: FilterOption) => {
    const currentValue = getFilterValue(filter.id);

    switch (filter.type) {
      case 'select':
        return (
          <Select value={currentValue || ''} onValueChange={(value) => updateFilter(filter.id, value)}>
            <SelectTrigger>
              <SelectValue placeholder={filter.placeholder || `Select ${filter.label}`} />
            </SelectTrigger>
            <SelectContent>
              {filter.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {filter.options?.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${filter.id}-${option.value}`}
                  checked={(currentValue || []).includes(option.value)}
                  onCheckedChange={(checked) => {
                    const current = currentValue || [];
                    if (checked) {
                      updateFilter(filter.id, [...current, option.value]);
                    } else {
                      updateFilter(filter.id, current.filter((v: string) => v !== option.value));
                    }
                  }}
                />
                <Label htmlFor={`${filter.id}-${option.value}`}>{option.label}</Label>
              </div>
            ))}
          </div>
        );

      case 'text':
        return (
          <Input
            placeholder={filter.placeholder || `Search ${filter.label}`}
            value={currentValue || ''}
            onChange={(e) => updateFilter(filter.id, e.target.value)}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            placeholder={filter.placeholder || `Enter ${filter.label}`}
            value={currentValue || ''}
            onChange={(e) => updateFilter(filter.id, e.target.value)}
            min={filter.min}
            max={filter.max}
            step={filter.step || 1}
          />
        );

      case 'boolean':
        return (
          <Checkbox
            checked={currentValue || false}
            onCheckedChange={(checked) => updateFilter(filter.id, checked)}
          />
        );

      case 'slider':
        return (
          <div className="space-y-2">
            <Slider
              value={[currentValue || filter.min || 0]}
              onValueChange={([value]) => updateFilter(filter.id, value)}
              min={filter.min || 0}
              max={filter.max || 100}
              step={filter.step || 1}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{filter.min || 0}</span>
              <span>{currentValue || filter.min || 0}</span>
              <span>{filter.max || 100}</span>
            </div>
          </div>
        );

      case 'dateRange':
        return (
          <div className="space-y-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {currentValue?.from ? (
                    currentValue.to ? (
                      <>
                        {format(currentValue.from, "LLL dd, y")} -{" "}
                        {format(currentValue.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(currentValue.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={currentValue?.from}
                  selected={currentValue}
                  onSelect={(range) => updateFilter(filter.id, range)}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filter Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-6" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Advanced Filters</h4>
                  <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filters.map(filter => (
                    <div key={filter.id} className="space-y-2">
                      <Label htmlFor={filter.id}>{filter.label}</Label>
                      {renderFilterInput(filter)}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onReset}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  {onSave && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSaveDialog(true)}
                      className="flex-1"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  )}
                </div>

                {savedFilters.length > 0 && (
                  <div className="pt-4 border-t">
                    <Label>Saved Filters</Label>
                    <div className="space-y-2 mt-2">
                      {savedFilters.map((saved, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            onFiltersChange(saved.filters);
                            setIsOpen(false);
                          }}
                        >
                          {saved.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Clear all ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {values
            .filter(v => {
              if (v.type === 'text') return v.value && v.value.trim() !== '';
              if (v.type === 'multiselect') return v.value && v.value.length > 0;
              if (v.type === 'dateRange') return v.value && (v.value.from || v.value.to);
              return v.value !== undefined && v.value !== null && v.value !== '';
            })
            .map(filter => (
              <Badge key={filter.id} variant="secondary" className="gap-1">
                <span className="font-medium">{filter.label}:</span>
                <span>
                  {filter.type === 'multiselect' 
                    ? `${filter.value.length} selected`
                    : filter.type === 'dateRange' && filter.value
                      ? filter.value.from && filter.value.to
                        ? `${format(filter.value.from, "MMM dd")} - ${format(filter.value.to, "MMM dd")}`
                        : filter.value.from
                          ? format(filter.value.from, "MMM dd, yyyy")
                          : 'Date selected'
                      : String(filter.value)
                  }
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1"
                  onClick={() => removeFilter(filter.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
        </div>
      )}

      {/* Save Filter Dialog */}
      {showSaveDialog && onSave && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Save Filter Set</CardTitle>
              <CardDescription>Give this filter configuration a name</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Filter set name"
                value={saveFilterName}
                onChange={(e) => setSaveFilterName(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (saveFilterName.trim()) {
                      onSave(saveFilterName.trim());
                      setSaveFilterName('');
                      setShowSaveDialog(false);
                    }
                  }}
                  disabled={!saveFilterName.trim()}
                  className="flex-1"
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSaveFilterName('');
                    setShowSaveDialog(false);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}