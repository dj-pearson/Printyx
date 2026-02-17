/**
 * BoardOptionsMenu - In-context board configuration UI.
 * Provides Edit Cards, Edit Columns, and Board Settings panels.
 * Part of CRM-009: Board options and in-context configuration UIs.
 */
import React, { useState } from 'react';
import { Settings2, Columns, CreditCard, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { CrmFieldDef } from '@/lib/crm-object-registry';

interface BoardOptionsMenuProps {
  fields: CrmFieldDef[];
  cardStyle: 'compact' | 'standard' | 'detailed';
  onCardStyleChange: (style: 'compact' | 'standard' | 'detailed') => void;
  tagDisplayEnabled: boolean;
  onTagDisplayChange: (enabled: boolean) => void;
  columnTotals: 'sum' | 'count' | 'weighted' | 'average' | 'none';
  onColumnTotalsChange: (type: 'sum' | 'count' | 'weighted' | 'average' | 'none') => void;
  onSave: (applyForEveryone: boolean) => void;
}

export function BoardOptionsMenu({
  fields,
  cardStyle,
  onCardStyleChange,
  tagDisplayEnabled,
  onTagDisplayChange,
  columnTotals,
  onColumnTotalsChange,
  onSave,
}: BoardOptionsMenuProps) {
  const [activePanel, setActivePanel] = useState<'cards' | 'columns' | 'settings' | null>(null);
  const [applyForEveryone, setApplyForEveryone] = useState(false);

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
          <DropdownMenuItem onClick={() => setActivePanel('cards')}>
            <CreditCard className="h-4 w-4 mr-2" /> Edit Cards
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActivePanel('columns')}>
            <Columns className="h-4 w-4 mr-2" /> Edit Columns
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setActivePanel('settings')}>
            <SlidersHorizontal className="h-4 w-4 mr-2" /> Board Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Cards Panel */}
      <Sheet open={activePanel === 'cards'} onOpenChange={(open) => !open && setActivePanel(null)}>
        <SheetContent side="right" className="w-[380px]">
          <SheetHeader>
            <SheetTitle>Edit Card Layout</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            {/* Card style selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Card Style</Label>
              <RadioGroup value={cardStyle} onValueChange={(v) => onCardStyleChange(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="compact" id="compact" />
                  <Label htmlFor="compact" className="text-sm">Compact (title + 1 field)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="standard" id="standard" />
                  <Label htmlFor="standard" className="text-sm">Standard (title + 3 fields + tags)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="detailed" id="detailed" />
                  <Label htmlFor="detailed" className="text-sm">Detailed (title + 5 fields + tags + associations)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Tag display toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">Show tags on cards</Label>
              <Switch checked={tagDisplayEnabled} onCheckedChange={onTagDisplayChange} />
            </div>

            {/* Apply scope */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Label className="text-sm">Apply for everyone</Label>
              <Switch checked={applyForEveryone} onCheckedChange={setApplyForEveryone} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setActivePanel(null)}>Cancel</Button>
            <Button onClick={() => { onSave(applyForEveryone); setActivePanel(null); }}>Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Columns Panel */}
      <Sheet open={activePanel === 'columns'} onOpenChange={(open) => !open && setActivePanel(null)}>
        <SheetContent side="right" className="w-[380px]">
          <SheetHeader>
            <SheetTitle>Edit Column Display</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Column Total Display</Label>
              <Select value={columnTotals} onValueChange={(v) => onColumnTotalsChange(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Sum (total value)</SelectItem>
                  <SelectItem value="count">Count (number of records)</SelectItem>
                  <SelectItem value="weighted">Weighted (value x probability)</SelectItem>
                  <SelectItem value="average">Average value</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setActivePanel(null)}>Cancel</Button>
            <Button onClick={() => { onSave(applyForEveryone); setActivePanel(null); }}>Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Board Settings Panel */}
      <Sheet open={activePanel === 'settings'} onOpenChange={(open) => !open && setActivePanel(null)}>
        <SheetContent side="right" className="w-[380px]">
          <SheetHeader>
            <SheetTitle>Board Settings</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Default Sort Within Columns</Label>
              <Select defaultValue="newest">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="highest_value">Highest value</SelectItem>
                  <SelectItem value="closest_close">Closest close date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setActivePanel(null)}>Cancel</Button>
            <Button onClick={() => { onSave(applyForEveryone); setActivePanel(null); }}>Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
