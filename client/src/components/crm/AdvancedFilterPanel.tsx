/**
 * AdvancedFilterPanel - HubSpot-style condition builder for CRM filtering.
 * Supports AND/OR logic, multiple field types, and condition groups.
 * Part of CRM-005: Advanced filter panel with condition builder.
 */
import React, { useState, useCallback } from 'react';
import { X, Plus, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { CrmFieldDef } from '@/lib/crm-object-registry';

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: any;
  conjunction: 'AND' | 'OR';
}

interface AdvancedFilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: CrmFieldDef[];
  conditions: FilterCondition[];
  onConditionsChange: (conditions: FilterCondition[]) => void;
  onApply: (conditions: FilterCondition[]) => void;
}

const OPERATORS: Record<string, Array<{ value: string; label: string }>> = {
  text: [
    { value: 'eq', label: 'equals' },
    { value: 'neq', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'endsWith', label: 'ends with' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
  ],
  number: [
    { value: 'eq', label: 'equals' },
    { value: 'neq', label: 'not equals' },
    { value: 'gt', label: 'greater than' },
    { value: 'gte', label: 'greater or equal' },
    { value: 'lt', label: 'less than' },
    { value: 'lte', label: 'less or equal' },
  ],
  currency: [
    { value: 'eq', label: 'equals' },
    { value: 'gt', label: 'greater than' },
    { value: 'gte', label: 'greater or equal' },
    { value: 'lt', label: 'less than' },
    { value: 'lte', label: 'less or equal' },
  ],
  date: [
    { value: 'eq', label: 'is' },
    { value: 'before', label: 'is before' },
    { value: 'after', label: 'is after' },
    { value: 'between', label: 'is between' },
    { value: 'lastNDays', label: 'in the last N days' },
    { value: 'isEmpty', label: 'is empty' },
  ],
  select: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
    { value: 'isAny', label: 'is any of' },
  ],
  badge: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
  ],
  email: [
    { value: 'eq', label: 'equals' },
    { value: 'contains', label: 'contains' },
    { value: 'endsWith', label: 'ends with' },
    { value: 'isEmpty', label: 'is empty' },
  ],
  phone: [
    { value: 'eq', label: 'equals' },
    { value: 'contains', label: 'contains' },
    { value: 'isEmpty', label: 'is empty' },
  ],
};

function getOperatorsForType(type: string): Array<{ value: string; label: string }> {
  return OPERATORS[type] ?? OPERATORS.text;
}

let conditionCounter = 0;
function generateConditionId(): string {
  return `cond_${++conditionCounter}_${Date.now()}`;
}

export function AdvancedFilterPanel({
  open,
  onOpenChange,
  fields,
  conditions,
  onConditionsChange,
  onApply,
}: AdvancedFilterPanelProps) {
  const [localConditions, setLocalConditions] = useState<FilterCondition[]>(conditions);

  // Sync when opening
  React.useEffect(() => {
    if (open) {
      setLocalConditions(conditions.length > 0 ? conditions : []);
    }
  }, [open, conditions]);

  const addCondition = useCallback(() => {
    const firstField = fields[0];
    if (!firstField) return;
    setLocalConditions((prev) => [
      ...prev,
      {
        id: generateConditionId(),
        field: firstField.field,
        operator: 'eq',
        value: '',
        conjunction: 'AND',
      },
    ]);
  }, [fields]);

  const updateCondition = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setLocalConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    );
  }, []);

  const removeCondition = useCallback((id: string) => {
    setLocalConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleApply = useCallback(() => {
    const validConditions = localConditions.filter((c) => c.field && c.operator);
    onConditionsChange(validConditions);
    onApply(validConditions);
    onOpenChange(false);
  }, [localConditions, onConditionsChange, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    setLocalConditions([]);
    onConditionsChange([]);
    onApply([]);
    onOpenChange(false);
  }, [onConditionsChange, onApply, onOpenChange]);

  const needsValueInput = (operator: string) => !['isEmpty', 'isNotEmpty'].includes(operator);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle>Advanced Filters</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full mt-4">
          <div className="flex-1 overflow-y-auto space-y-3">
            {localConditions.map((condition, index) => {
              const fieldDef = fields.find((f) => f.field === condition.field);
              const operators = getOperatorsForType(fieldDef?.type ?? 'text');

              return (
                <div key={condition.id} className="border rounded-lg p-3 space-y-2">
                  {/* Conjunction toggle (for 2+ conditions) */}
                  {index > 0 && (
                    <div className="flex items-center gap-2 pb-1">
                      <Badge
                        variant={condition.conjunction === 'AND' ? 'default' : 'secondary'}
                        className="cursor-pointer text-[10px]"
                        onClick={() =>
                          updateCondition(condition.id, {
                            conjunction: condition.conjunction === 'AND' ? 'OR' : 'AND',
                          })
                        }
                      >
                        {condition.conjunction}
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      {/* Field selector */}
                      <Select
                        value={condition.field}
                        onValueChange={(value) =>
                          updateCondition(condition.id, { field: value, value: '' })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {fields.map((f) => (
                            <SelectItem key={f.field} value={f.field}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Operator selector */}
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => updateCondition(condition.id, { operator: value })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Value input */}
                      {needsValueInput(condition.operator) && (
                        <>
                          {fieldDef?.type === 'date' ? (
                            <Input
                              type="date"
                              value={condition.value || ''}
                              onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                              className="h-8 text-xs"
                            />
                          ) : fieldDef?.type === 'number' || fieldDef?.type === 'currency' ? (
                            <Input
                              type="number"
                              value={condition.value || ''}
                              onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                              placeholder="Enter value"
                              className="h-8 text-xs"
                            />
                          ) : fieldDef?.options ? (
                            <Select
                              value={condition.value || ''}
                              onValueChange={(value) => updateCondition(condition.id, { value })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select value" />
                              </SelectTrigger>
                              <SelectContent>
                                {fieldDef.options.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={condition.value || ''}
                              onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                              placeholder="Enter value"
                              className="h-8 text-xs"
                            />
                          )}
                        </>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeCondition(condition.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {localConditions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No filter conditions. Click "Add condition" to start filtering.
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex flex-col gap-2 pt-4 border-t mt-4">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={addCondition}>
              <Plus className="h-3.5 w-3.5" /> Add condition
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleClear}>
                Clear all
              </Button>
              <Button size="sm" className="flex-1" onClick={handleApply}>
                Apply filters
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
