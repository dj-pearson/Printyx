import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Calculator, DollarSign, Percent, TrendingUp, Info } from 'lucide-react';

interface LineItem {
  id?: string;
  lineNumber: number;
  parentLineId?: string;
  isSubline: boolean;
  productType: string;
  productId: string;
  productCode: string;
  productName: string;
  description?: string;
  quantity: number;
  msrp?: number;
  listPrice?: number;
  unitPrice: number;
  totalPrice: number;
  unitCost?: number;
  margin?: number;
  notes?: string;
}

interface PricingCalculatorProps {
  lineItems: LineItem[];
  subtotal: number;
  total: number;
  initialDiscountAmount?: number;
  initialDiscountPercentage?: number;
  initialTaxAmount?: number;
  onDiscountChange?: (discountAmount: number, discountPercentage: number) => void;
  onTaxChange?: (taxAmount: number) => void;
  // Pricing policy (QUOTE-006)
  minMarginPercentage?: number;
  maxDiscountPercentage?: number;
}

export default function PricingCalculator({
  lineItems,
  subtotal,
  total,
  initialDiscountAmount = 0,
  initialDiscountPercentage = 0,
  initialTaxAmount = 0,
  onDiscountChange,
  onTaxChange,
  minMarginPercentage,
  maxDiscountPercentage,
}: PricingCalculatorProps) {
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('percentage');
  const [discountAmount, setDiscountAmount] = useState(initialDiscountAmount);
  const [discountPercentage, setDiscountPercentage] = useState(initialDiscountPercentage);
  const [taxRate, setTaxRate] = useState(8.25); // Default tax rate
  const [taxAmount, setTaxAmount] = useState(initialTaxAmount);

  // Update local state when initial values change (for editing existing quotes)
  useEffect(() => {
    setDiscountAmount(initialDiscountAmount);
    setDiscountPercentage(initialDiscountPercentage);
    setTaxAmount(initialTaxAmount);
  }, [initialDiscountAmount, initialDiscountPercentage, initialTaxAmount]);

  // Calculate totals
  const itemsSubtotal = lineItems.reduce(
    (sum, item) => sum + (parseFloat(item.totalPrice.toString()) || 0),
    0,
  );
  const discountValue =
    discountType === 'percentage' ? (itemsSubtotal * discountPercentage) / 100 : discountAmount;
  const afterDiscountTotal = itemsSubtotal - discountValue;
  const taxValue = taxAmount > 0 ? taxAmount : (afterDiscountTotal * taxRate) / 100;
  const finalTotal = afterDiscountTotal + taxValue;

  // Calculate overall margin on pre-tax revenue (after discount) — matches the
  // server recompute and the manager PDF. Tax is not revenue.
  const totalCost = lineItems.reduce((sum, item) => sum + (item.unitCost || 0) * item.quantity, 0);
  const overallMargin =
    afterDiscountTotal > 0 ? ((afterDiscountTotal - totalCost) / afterDiscountTotal) * 100 : 0;

  // Pricing policy violations (QUOTE-006)
  const belowMinMargin =
    totalCost > 0 &&
    minMarginPercentage !== undefined &&
    minMarginPercentage > 0 &&
    overallMargin < minMarginPercentage;
  const overMaxDiscount =
    maxDiscountPercentage !== undefined &&
    maxDiscountPercentage > 0 &&
    discountPercentage > maxDiscountPercentage;

  const handleDiscountAmountChange = (value: number) => {
    setDiscountAmount(value);
    setDiscountPercentage(itemsSubtotal > 0 ? (value / itemsSubtotal) * 100 : 0);
    if (onDiscountChange) {
      onDiscountChange(value, itemsSubtotal > 0 ? (value / itemsSubtotal) * 100 : 0);
    }
  };

  const handleDiscountPercentageChange = (value: number) => {
    setDiscountPercentage(value);
    setDiscountAmount((itemsSubtotal * value) / 100);
    if (onDiscountChange) {
      onDiscountChange((itemsSubtotal * value) / 100, value);
    }
  };

  const handleTaxAmountChange = (value: number) => {
    setTaxAmount(value);
    if (onTaxChange) {
      onTaxChange(value);
    }
  };

  const handleTaxRateChange = (value: number) => {
    setTaxRate(value);
    const calculatedTax = (afterDiscountTotal * value) / 100;
    setTaxAmount(calculatedTax);
    if (onTaxChange) {
      onTaxChange(calculatedTax);
    }
  };

  // Auto-calculate tax when afterDiscountTotal or taxRate changes (unless tax amount is manually overridden)
  useEffect(() => {
    if (taxAmount === 0 || taxAmount === initialTaxAmount) {
      const calculatedTax = (afterDiscountTotal * taxRate) / 100;
      if (calculatedTax !== taxAmount) {
        setTaxAmount(calculatedTax);
        if (onTaxChange) {
          onTaxChange(calculatedTax);
        }
      }
    }
  }, [afterDiscountTotal, taxRate, taxAmount, initialTaxAmount, onTaxChange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(2)}%`;
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Calculator className="h-5 w-5" />
          Pricing Summary
        </CardTitle>
        <CardDescription className="text-sm">
          Calculate totals, discounts, taxes, and margins
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Line Items Summary */}
        <div className="space-y-3">
          <h4 className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Line Items Breakdown
          </h4>
          <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
            <div className="space-y-2">
              {lineItems.map((item, index) => (
                <div
                  key={item.id || index}
                  className="flex justify-between items-start sm:items-center gap-2 text-xs sm:text-sm"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 min-w-0 flex-1">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {item.lineNumber}
                    </Badge>
                    <span
                      className={`${item.isSubline ? 'text-muted-foreground pl-4' : ''} line-clamp-1`}
                    >
                      {item.isSubline && '↳ '}
                      {item.productName}
                    </span>
                    <span className="text-muted-foreground shrink-0">(Qty: {item.quantity})</span>
                  </div>
                  <span className="font-medium shrink-0">{formatCurrency(item.totalPrice)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="flex justify-between items-center font-semibold text-sm sm:text-base">
              <span>Subtotal</span>
              <span>{formatCurrency(itemsSubtotal)}</span>
            </div>
          </div>
        </div>

        {/* Markup/Discount Section */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <h4 className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Markup & Discount
            </h4>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDiscountPercentageChange(-10)}
                className="text-green-600 hover:text-green-700 flex-1 sm:flex-none min-h-[44px] active:scale-[0.98] transition-transform"
              >
                Markup
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDiscountPercentageChange(10)}
                className="text-red-600 hover:text-red-700 flex-1 sm:flex-none min-h-[44px] active:scale-[0.98] transition-transform"
              >
                Discount
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Type</Label>
              <Select
                value={discountType}
                onValueChange={(value: 'amount' | 'percentage') => setDiscountType(value)}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="amount">Dollar Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {discountType === 'percentage' ? (
              <div className="space-y-2">
                <Label className="text-sm">Percentage</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={Math.abs(discountPercentage)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      handleDiscountPercentageChange(value);
                    }}
                    step="0.01"
                    min="0"
                    max="100"
                    className="pr-8 min-h-[44px]"
                  />
                  <Percent className="absolute right-2 top-3 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm">Amount</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={Math.abs(discountAmount)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      handleDiscountAmountChange(value);
                    }}
                    step="0.01"
                    min="0"
                    className="pl-8 min-h-[44px]"
                  />
                  <DollarSign className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm">Value</Label>
              <div
                className={`p-3 bg-muted rounded border text-center font-medium min-h-[44px] flex items-center justify-center ${
                  discountPercentage < 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {discountPercentage < 0 ? '+' : '-'}
                {formatCurrency(Math.abs(discountValue))}
              </div>
            </div>
          </div>
        </div>

        {/* Tax Section */}
        <div className="space-y-3">
          <h4 className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Tax Calculation
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Tax Rate (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={taxRate}
                  onChange={(e) => handleTaxRateChange(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  max="100"
                  className="pr-8 min-h-[44px]"
                />
                <Percent className="absolute right-2 top-3 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Tax Amount (Override)</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={taxAmount}
                  onChange={(e) => handleTaxAmountChange(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  className="pl-8 min-h-[44px]"
                  placeholder="Auto-calculated"
                />
                <DollarSign className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Tax Total</Label>
              <div className="p-3 bg-muted rounded border text-center font-medium min-h-[44px] flex items-center justify-center">
                {formatCurrency(taxValue)}
              </div>
            </div>
          </div>
        </div>

        {/* Final Totals */}
        <div className="space-y-3">
          <Separator />
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 sm:p-4">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center text-base sm:text-lg">
                <span className="font-semibold">Subtotal:</span>
                <span className="font-bold">{formatCurrency(itemsSubtotal)}</span>
              </div>

              {discountValue !== 0 && (
                <div
                  className={`flex justify-between items-center text-xs sm:text-sm ${
                    discountPercentage < 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  <span>
                    {discountPercentage < 0 ? 'Markup' : 'Discount'} (
                    {formatPercentage(Math.abs(discountPercentage))}):
                  </span>
                  <span>
                    {discountPercentage < 0 ? '+' : '-'}
                    {formatCurrency(Math.abs(discountValue))}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span>After Discount:</span>
                <span className="font-medium">{formatCurrency(afterDiscountTotal)}</span>
              </div>

              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span>Tax ({formatPercentage(taxRate)}):</span>
                <span className="font-medium">{formatCurrency(taxValue)}</span>
              </div>

              <Separator />

              <div className="flex justify-between items-center text-lg sm:text-xl">
                <span className="font-bold">Total:</span>
                <span className="font-bold text-primary">{formatCurrency(finalTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Sticky Total (visible only on mobile) */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 pb-safe-bottom z-10">
          <div className="flex justify-between items-center">
            <span className="text-base font-bold">Quote Total:</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(finalTotal)}</span>
          </div>
        </div>

        {/* Pricing Policy Warnings (QUOTE-006) */}
        {(belowMinMargin || overMaxDiscount) && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800">
            <div className="flex items-start gap-2 text-xs sm:text-sm">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <div className="font-medium">Manager approval required to send</div>
                {belowMinMargin && (
                  <div>
                    Margin {formatPercentage(overallMargin)} is below the minimum{' '}
                    {formatPercentage(minMarginPercentage!)}.
                  </div>
                )}
                {overMaxDiscount && (
                  <div>
                    Discount {formatPercentage(Math.abs(discountPercentage))} exceeds the maximum{' '}
                    {formatPercentage(maxDiscountPercentage!)}.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Margin Analysis */}
        {totalCost > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Margin Analysis
            </h4>
            <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                <div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Total Cost</div>
                  <div className="text-sm sm:text-lg font-semibold text-red-600">
                    {formatCurrency(totalCost)}
                  </div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Revenue (pre-tax)</div>
                  <div className="text-sm sm:text-lg font-semibold text-blue-600">
                    {formatCurrency(afterDiscountTotal)}
                  </div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Gross Margin</div>
                  <div
                    className={`text-sm sm:text-lg font-semibold ${overallMargin >= 20 ? 'text-green-600' : overallMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}
                  >
                    {formatPercentage(overallMargin)}
                  </div>
                </div>
              </div>

              <div className="mt-3 p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2 text-xs sm:text-sm text-blue-800">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Margin Guidelines:</div>
                    <div>
                      • <span className="text-green-600">Good:</span> 20%+ margin
                    </div>
                    <div>
                      • <span className="text-yellow-600">Acceptable:</span> 10-20% margin
                    </div>
                    <div>
                      • <span className="text-red-600">Low:</span> &lt;10% margin
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-3 pb-16 sm:pb-0">
          <h4 className="text-sm sm:text-base font-semibold">Quick Actions</h4>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleDiscountPercentageChange(5);
                setDiscountType('percentage');
              }}
              className="min-h-[44px] active:scale-[0.98] transition-transform"
            >
              5% Discount
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleDiscountPercentageChange(10);
                setDiscountType('percentage');
              }}
              className="min-h-[44px] active:scale-[0.98] transition-transform"
            >
              10% Discount
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleDiscountPercentageChange(15);
                setDiscountType('percentage');
              }}
              className="min-h-[44px] active:scale-[0.98] transition-transform"
            >
              15% Discount
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleDiscountPercentageChange(0);
                setDiscountAmount(0);
              }}
              className="min-h-[44px] active:scale-[0.98] transition-transform col-span-2 sm:col-span-1"
            >
              Clear Discount
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
