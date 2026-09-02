/**
 * BoardOptionsMenu - what a pipeline card shows, and what a column totals.
 *
 * CRM-009 shipped this component with three panels and no wiring: it took a
 * `fields` prop it never read, its "Default sort within columns" select had no
 * onValueChange, its "Apply for everyone" switch went into a local useState and
 * nowhere else, and nothing imported the file at all (it was in
 * docs/orphan-files-baseline.json). So there was no card configuration, which
 * is why COP-M04's ten copier columns could reach the table and not the board.
 *
 * The two panels that remain are the two that persist, into
 * saved_views.board_config - a column the schema, the migration and the
 * saved-views edge function have all had since migration 0003, with no writer.
 * The inert third panel is gone rather than left looking operable; sharing a
 * board layout with the team is what a saved view's `visibility` already does.
 */
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Columns, CreditCard, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { CrmFieldDef } from '@/lib/crm-object-registry';
import {
  COLUMN_TOTALS_MODES,
  DEFAULT_COLUMN_TOTALS,
  MAX_CARD_FIELDS,
  buildWorkingCardFields,
  moveCardField,
  toCardFieldEntries,
  toggleCardField,
  type BoardConfig,
  type ColumnTotalsMode,
} from '@/lib/crm-board-config';

interface BoardOptionsMenuProps {
  objectType: string;
  fields: CrmFieldDef[];
  boardConfig: BoardConfig | null | undefined;
  onBoardConfigChange: (config: BoardConfig) => void;
  /** False when there is no saved view, so changes last for the session only. */
  persists: boolean;
}

export function BoardOptionsMenu({
  objectType,
  fields,
  boardConfig,
  onBoardConfigChange,
  persists,
}: BoardOptionsMenuProps) {
  const [activePanel, setActivePanel] = useState<'cards' | 'columns' | null>(null);
  const [working, setWorking] = useState(() =>
    buildWorkingCardFields(fields, boardConfig, objectType),
  );
  const [refused, setRefused] = useState(false);
  const [totals, setTotals] = useState<ColumnTotalsMode>(
    boardConfig?.columnTotals ?? DEFAULT_COLUMN_TOTALS,
  );

  const selectedCount = useMemo(() => working.filter((c) => c.selected).length, [working]);

  const openCards = () => {
    setWorking(buildWorkingCardFields(fields, boardConfig, objectType));
    setRefused(false);
    setActivePanel('cards');
  };

  const openColumns = () => {
    setTotals(boardConfig?.columnTotals ?? DEFAULT_COLUMN_TOTALS);
    setActivePanel('columns');
  };

  const saveCards = () => {
    onBoardConfigChange({ ...boardConfig, cardFields: toCardFieldEntries(working) });
    setActivePanel(null);
  };

  const saveColumns = () => {
    onBoardConfigChange({ ...boardConfig, columnTotals: totals });
    setActivePanel(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
            <Settings2 className="h-3.5 w-3.5" />
            Board options
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={openCards}>
            <CreditCard className="h-4 w-4 mr-2" /> Card fields
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openColumns}>
            <Columns className="h-4 w-4 mr-2" /> Column totals
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={activePanel === 'cards'} onOpenChange={(open) => !open && setActivePanel(null)}>
        <SheetContent side="right" className="w-[380px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Card fields</SheetTitle>
          </SheetHeader>
          <p className="mt-2 text-sm text-muted-foreground">
            The title always shows. Pick up to {MAX_CARD_FIELDS} more, in the order they should
            appear.
          </p>
          {!persists && (
            <p className="mt-2 text-sm text-muted-foreground">
              There is no saved view selected, so this applies for this session only.
            </p>
          )}
          <div className="mt-4 space-y-1">
            {working.map((choice, index) => (
              <div
                key={choice.field}
                className="flex items-center gap-2 rounded-md border p-2 text-sm"
              >
                <Checkbox
                  id={`card-field-${choice.field}`}
                  checked={choice.selected}
                  onCheckedChange={() => {
                    const { next, refused: wasRefused } = toggleCardField(working, choice.field);
                    setWorking(next);
                    setRefused(wasRefused);
                  }}
                />
                <Label htmlFor={`card-field-${choice.field}`} className="flex-1 cursor-pointer">
                  {choice.label}
                </Label>
                {choice.selected && (
                  <span className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      aria-label={`Move ${choice.label} up`}
                      disabled={index === 0}
                      onClick={() => setWorking(moveCardField(working, choice.field, -1))}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      aria-label={`Move ${choice.label} down`}
                      disabled={index === selectedCount - 1}
                      onClick={() => setWorking(moveCardField(working, choice.field, 1))}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {refused && (
            <p className="mt-3 text-sm text-destructive">
              A card holds {MAX_CARD_FIELDS} fields. Remove one before adding another.
            </p>
          )}
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setActivePanel(null)}>
              Cancel
            </Button>
            <Button onClick={saveCards}>Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={activePanel === 'columns'}
        onOpenChange={(open) => !open && setActivePanel(null)}
      >
        <SheetContent side="right" className="w-[380px]">
          <SheetHeader>
            <SheetTitle>Column totals</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            <Label className="text-sm font-medium" htmlFor="board-column-totals">
              What each stage header shows
            </Label>
            <Select value={totals} onValueChange={(v) => setTotals(v as ColumnTotalsMode)}>
              <SelectTrigger id="board-column-totals">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMN_TOTALS_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              A stage whose records carry no value, or no probability for the weighted total, shows
              no total rather than a zero.
            </p>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setActivePanel(null)}>
              Cancel
            </Button>
            <Button onClick={saveColumns}>Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
