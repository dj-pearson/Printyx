/**
 * CrmFilterBar - Quick filters inline with 'More Filters' button.
 * Part of CRM-005: Advanced filter panel with condition builder.
 */
import React, { useState, useCallback } from 'react';
import { Filter, X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AdvancedFilterPanel, type FilterCondition } from './AdvancedFilterPanel';
import type { CrmQuickFilter, CrmFieldDef } from '@/lib/crm-object-registry';

interface CrmFilterBarProps {
  quickFilters: CrmQuickFilter[];
  fields: CrmFieldDef[];
  activeFilters: Record<string, any>;
  onFilterChange: (field: string, value: any) => void;
  onClearAll: () => void;
  advancedConditions: FilterCondition[];
  onAdvancedConditionsChange: (conditions: FilterCondition[]) => void;
  className?: string;
}

export function CrmFilterBar({
  quickFilters,
  fields,
  activeFilters,
  onFilterChange,
  onClearAll,
  advancedConditions,
  onAdvancedConditionsChange,
  className,
}: CrmFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeFilterCount = Object.keys(activeFilters).length + advancedConditions.length;

  const handleAdvancedApply = useCallback(
    (conditions: FilterCondition[]) => {
      // Convert conditions to activeFilters format for the query
      for (const condition of conditions) {
        onFilterChange(condition.field, condition.value);
      }
    },
    [onFilterChange],
  );

  // Active filter chips
  const activeFilterChips = Object.entries(activeFilters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([field, value]) => {
      const qf = quickFilters.find((f) => f.field === field);
      const option = qf?.options.find((o) => o.value === value);
      return {
        field,
        label: qf?.label ?? field,
        value: option?.label ?? String(value),
      };
    });

  return (
    <>
      <div className={cn('flex items-center gap-2 flex-wrap', className)}>
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

        {/* Quick filter dropdowns */}
        {quickFilters.slice(0, 4).map((filter) => (
          <Select
            key={filter.field}
            value={activeFilters[filter.field] ?? ''}
            onValueChange={(value) => onFilterChange(filter.field, value === '__all__' ? undefined : value)}
          >
            <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All {filter.label}</SelectItem>
              {filter.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {/* More Filters button */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setShowAdvanced(true)}
        >
          <SlidersHorizontal className="h-3 w-3" />
          More Filters
          {advancedConditions.length > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 min-w-[16px] ml-0.5 p-0 justify-center">
              {advancedConditions.length}
            </Badge>
          )}
        </Button>

        {/* Active filter chips */}
        {activeFilterChips.map((chip) => (
          <Badge
            key={chip.field}
            variant="secondary"
            className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/10"
            onClick={() => onFilterChange(chip.field, undefined)}
          >
            {chip.label}: {chip.value}
            <X className="h-2.5 w-2.5" />
          </Badge>
        ))}

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={onClearAll}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Advanced filter panel */}
      <AdvancedFilterPanel
        open={showAdvanced}
        onOpenChange={setShowAdvanced}
        fields={fields}
        conditions={advancedConditions}
        onConditionsChange={onAdvancedConditionsChange}
        onApply={handleAdvancedApply}
      />
    </>
  );
}
