/**
 * CRMX-012: column picker for CRM list views.
 *
 * Show/hide + reorder the columns of a table. Operates on a complete working
 * column config (every catalog column) and emits a new config on every change;
 * the parent persists it into saved_views.columnConfig.
 */
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Columns3, ChevronUp, ChevronDown } from 'lucide-react';
import { type ColumnConfigEntry, toggleColumnVisible, moveColumn } from '@/lib/crm-columns';

interface ColumnPickerProps {
  /** Full, ordered working config covering every catalog column. */
  workingConfig: ColumnConfigEntry[];
  onChange: (config: ColumnConfigEntry[]) => void;
  /** Whether changes persist to a saved view (false ⇒ session-local only). */
  persists?: boolean;
}

export function ColumnPicker({ workingConfig, onChange, persists = true }: ColumnPickerProps) {
  const visibleCount = useMemo(
    () => workingConfig.filter((c) => c.visible).length,
    [workingConfig],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Columns3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Columns</span>
          <span className="text-muted-foreground text-xs">({visibleCount})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-medium">Customize columns</p>
          <p className="text-xs text-muted-foreground">
            {persists ? 'Saved to this view.' : 'Select a saved view to persist.'}
          </p>
        </div>
        <ScrollArea className="max-h-80">
          <div className="p-1">
            {workingConfig.map((col, index) => (
              <div
                key={col.field}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted/60"
              >
                <Checkbox
                  id={`col-${col.field}`}
                  checked={col.visible}
                  onCheckedChange={() => onChange(toggleColumnVisible(workingConfig, col.field))}
                  aria-label={`Toggle ${col.label}`}
                />
                <label
                  htmlFor={`col-${col.field}`}
                  className="flex-1 text-sm truncate cursor-pointer select-none"
                >
                  {col.label}
                </label>
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === 0}
                    onClick={() => onChange(moveColumn(workingConfig, col.field, -1))}
                    aria-label={`Move ${col.label} up`}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === workingConfig.length - 1}
                    onClick={() => onChange(moveColumn(workingConfig, col.field, 1))}
                    aria-label={`Move ${col.label} down`}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
