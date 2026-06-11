import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Wrench, Lock } from 'lucide-react';
import { usePricingVisibility } from '@/hooks/usePricingVisibility';

// QUOTE-014: confirmation list shown when a selected product model resolves
// required/suggested accessories. Replaces the old silent auto-add — the rep
// sees every accessory with its price before anything hits the quote.
// QUOTE-015 reuses it (via title/description/noun overrides) to preview an
// equipment package's contents before they're expanded into line items.

export interface AccessoryConfirmRow {
  id: string;
  productCode: string;
  productName: string;
  description?: string;
  msrp?: number;
  unitPrice: number;
  unitCost: number;
  /** Required accessories are pre-checked and locked; optional ones start unchecked. */
  required: boolean;
  /** QUOTE-015: package items carry their own quantity; defaults to 1. */
  defaultQuantity?: number;
  /** QUOTE-015: line-item product type for this row (packages mix types). */
  productType?: string;
  /** QUOTE-015: package item kind — the first confirmed 'equipment' row becomes the parent line. */
  itemKind?: 'equipment' | 'accessory' | 'service';
}

export interface ConfirmedAccessory extends AccessoryConfirmRow {
  quantity: number;
}

interface RequiredAccessoriesDialogProps {
  open: boolean;
  modelName: string;
  accessories: AccessoryConfirmRow[];
  onConfirm: (selected: ConfirmedAccessory[]) => void;
  onCancel: () => void;
  /** Overrides for package previews (QUOTE-015). Defaults keep QUOTE-014 copy. */
  title?: string;
  description?: string;
  itemNoun?: { singular: string; plural: string };
  cancelLabel?: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export default function RequiredAccessoriesDialog({
  open,
  modelName,
  accessories,
  onConfirm,
  onCancel,
  title,
  description,
  itemNoun = { singular: 'accessory', plural: 'accessories' },
  cancelLabel = 'Cancel — model only',
}: RequiredAccessoriesDialogProps) {
  const { data: visibility } = usePricingVisibility();
  const showDealerCost = visibility?.showDealerCost === true;

  // Required rows are always checked; optional rows toggle. Quantities default
  // to the row's defaultQuantity (package items carry one) or 1.
  const [optionalChecked, setOptionalChecked] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const isChecked = (row: AccessoryConfirmRow) => row.required || optionalChecked[row.id] === true;
  const qtyOf = (row: AccessoryConfirmRow) =>
    Math.max(1, quantities[row.id] ?? Math.floor(row.defaultQuantity ?? 1) ?? 1);
  const setQty = (id: string, n: number) =>
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, Math.floor(n) || 1) }));

  const checkedRows = accessories.filter(isChecked);
  const checkedTotal = checkedRows.reduce((sum, row) => sum + row.unitPrice * qtyOf(row), 0);

  const noun = (n: number) => (n === 1 ? itemNoun.singular : itemNoun.plural);

  const handleConfirm = () => {
    onConfirm(checkedRows.map((row) => ({ ...row, quantity: qtyOf(row) })));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {title ?? `Accessories for ${modelName}`}
          </DialogTitle>
          <DialogDescription>
            {description ??
              "This model has required accessories. Review them before they're added to the quote — Cancel adds only the model."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
          {accessories.map((row) => {
            const checked = isChecked(row);
            return (
              <div
                key={row.id}
                className={`border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
                  checked ? 'bg-muted/30' : 'opacity-80'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Checkbox
                    checked={checked}
                    disabled={row.required}
                    onCheckedChange={(value) =>
                      setOptionalChecked((prev) => ({ ...prev, [row.id]: value === true }))
                    }
                    aria-label={`Include ${row.productName}`}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{row.productName}</span>
                      {row.required ? (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Lock className="h-3 w-3" />
                          Required
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Optional
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{row.productCode}</div>
                    {row.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {row.description}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pl-7 sm:pl-0 shrink-0">
                  <div className="flex items-center border rounded">
                    <button
                      type="button"
                      onClick={() => setQty(row.id, qtyOf(row) - 1)}
                      className="px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                      disabled={!checked}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm tabular-nums">{qtyOf(row)}</span>
                    <button
                      type="button"
                      onClick={() => setQty(row.id, qtyOf(row) + 1)}
                      className="px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                      disabled={!checked}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-sm">{formatCurrency(row.unitPrice)}</div>
                    {showDealerCost && (
                      <div className="text-xs text-muted-foreground">
                        Cost: {formatCurrency(row.unitCost)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 border-t pt-3">
          <div className="text-sm text-muted-foreground sm:mr-auto">
            {checkedRows.length} {noun(checkedRows.length)} ·{' '}
            <span className="font-medium text-foreground">{formatCurrency(checkedTotal)}</span>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={onCancel} className="min-h-[44px]">
              {cancelLabel}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={checkedRows.length === 0}
              className="min-h-[44px]"
            >
              Confirm — add {checkedRows.length} {noun(checkedRows.length)}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
