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
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export default function RequiredAccessoriesDialog({
  open,
  modelName,
  accessories,
  onConfirm,
  onCancel,
}: RequiredAccessoriesDialogProps) {
  const { data: visibility } = usePricingVisibility();
  const showDealerCost = visibility?.showDealerCost === true;

  // Required rows are always checked; optional rows toggle. Quantities default to 1.
  const [optionalChecked, setOptionalChecked] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const isChecked = (row: AccessoryConfirmRow) => row.required || optionalChecked[row.id] === true;
  const qtyOf = (id: string) => Math.max(1, quantities[id] ?? 1);
  const setQty = (id: string, n: number) =>
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, Math.floor(n) || 1) }));

  const checkedRows = accessories.filter(isChecked);
  const checkedTotal = checkedRows.reduce((sum, row) => sum + row.unitPrice * qtyOf(row.id), 0);

  const handleConfirm = () => {
    onConfirm(checkedRows.map((row) => ({ ...row, quantity: qtyOf(row.id) })));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Accessories for {modelName}
          </DialogTitle>
          <DialogDescription>
            This model has required accessories. Review them before they're added to the quote —
            Cancel adds only the model.
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
                      onClick={() => setQty(row.id, qtyOf(row.id) - 1)}
                      className="px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                      disabled={!checked}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm tabular-nums">{qtyOf(row.id)}</span>
                    <button
                      type="button"
                      onClick={() => setQty(row.id, qtyOf(row.id) + 1)}
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
            {checkedRows.length} accessor{checkedRows.length === 1 ? 'y' : 'ies'} ·{' '}
            <span className="font-medium text-foreground">{formatCurrency(checkedTotal)}</span>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={onCancel} className="min-h-[44px]">
              Cancel — model only
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={checkedRows.length === 0}
              className="min-h-[44px]"
            >
              Confirm — add {checkedRows.length} accessor
              {checkedRows.length === 1 ? 'y' : 'ies'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
