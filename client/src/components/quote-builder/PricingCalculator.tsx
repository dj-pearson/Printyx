import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import {
  Separator,
} from '@/components/ui/separator';
import {
  Calculator,
  DollarSign,
  Percent,
  TrendingUp,
  Info,
} from 'lucide-react';

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
  const itemsSubtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.totalPrice.toString()) || 0), 0);
  const discountValue = discountType === 'percentage' 
    ? (itemsSubtotal * discountPercentage / 100)
    : discountAmount;
  const afterDiscountTotal = itemsSubtotal - discountValue;
  const taxValue = taxAmount > 0 ? taxAmount : (afterDiscountTotal * taxRate / 100);
  const finalTotal = afterDiscountTotal + taxValue;

  // Calculate overall margin
  const totalCost = lineItems.reduce((sum, item) => sum + ((item.unitCost || 0) * item.quantity), 0);
  const overallMargin = totalCost > 0 ? ((finalTotal - totalCost) / finalTotal) * 100 : 0;

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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Pricing Summary
        </CardTitle>
        <CardDescription>
          Calculate totals, discounts, taxes, and margins
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Line Items Summary */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Line Items Breakdown
          </h4>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="space-y-2">
              {lineItems.map((item, index) => (
                <div key={item.id || index} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {item.lineNumber}
                    </Badge>
                    <span className={item.isSubline ? 'text-muted-foreground pl-4' : ''}>
                      {item.isSubline && '↳ '}
                      {item.productName}
                    </span>
                    <span className="text-muted-foreground">
                      (Qty: {item.quantity})
                    </span>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="flex justify-between items-center font-semibold">
              <span>Subtotal</span>
              <span>{formatCurrency(itemsSubtotal)}</span>
            </div>
          </div>
        </div>

        {/* Markup/Discount Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Markup & Discount
            </h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDiscountPercentageChange(-10)}
                className="text-green-600 hover:text-green-700"
              >
                Markup
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDiscountPercentageChange(10)}
                className="text-red-600 hover:text-red-700"
              >
                Discount
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={discountType} onValueChange={(value: 'amount' | 'percentage') => setDiscountType(value)}>
                <SelectTrigger>
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
                <Label>Percentage</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={Math.abs(discountPercentage)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      // Make it negative for discounts (positive values), positive for markup (negative values)
                      handleDiscountPercentageChange(value);
                    }}
                    step="0.01"
                    min="0"
                    max="100"
                    className="pr-8"
                  />
                  <Percent className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Amount</Label>
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
                    className="pl-8"
                  />
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Value</Label>
              <div className={`p-2 bg-muted rounded border text-center font-medium ${
                discountPercentage < 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {discountPercentage < 0 ? '+' : '-'}{formatCurrency(Math.abs(discountValue))}
              </div>
            </div>
          </div>
        </div>

        {/* Tax Section */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Tax Calculation
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={taxRate}
                  onChange={(e) => handleTaxRateChange(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  max="100"
                  className="pr-8"
                />
                <Percent className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Tax Amount (Override)</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={taxAmount}
                  onChange={(e) => handleTaxAmountChange(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  className="pl-8"
                  placeholder="Auto-calculated"
                />
                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tax Total</Label>
              <div className="p-2 bg-muted rounded border text-center font-medium">
                {formatCurrency(taxValue)}
              </div>
            </div>
          </div>
        </div>

        {/* Final Totals */}
        <div className="space-y-3">
          <Separator />
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-lg">
                <span className="font-semibold">Subtotal:</span>
                <span className="font-bold">{formatCurrency(itemsSubtotal)}</span>
              </div>
              
              {discountValue !== 0 && (
                <div className={`flex justify-between items-center text-sm ${
                  discountPercentage < 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  <span>
                    {discountPercentage < 0 ? 'Markup' : 'Discount'} ({formatPercentage(Math.abs(discountPercentage))}):
                  </span>
                  <span>
                    {discountPercentage < 0 ? '+' : '-'}{formatCurrency(Math.abs(discountValue))}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center text-sm">
                <span>After Discount:</span>
                <span className="font-medium">{formatCurrency(afterDiscountTotal)}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span>Tax ({formatPercentage(taxRate)}):</span>
                <span className="font-medium">{formatCurrency(taxValue)}</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center text-xl">
                <span className="font-bold">Total:</span>
                <span className="font-bold text-primary">{formatCurrency(finalTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Margin Analysis */}
        {totalCost > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Margin Analysis
            </h4>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-muted-foreground">Total Cost</div>
                  <div className="text-lg font-semibold text-red-600">
                    {formatCurrency(totalCost)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Revenue</div>
                  <div className="text-lg font-semibold text-blue-600">
                    {formatCurrency(finalTotal)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Gross Margin</div>
                  <div className={`text-lg font-semibold ${overallMargin >= 20 ? 'text-green-600' : overallMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {formatPercentage(overallMargin)}
                  </div>
                </div>
              </div>
              
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2 text-sm text-blue-800">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Margin Guidelines:</div>
                    <div>• <span className="text-green-600">Good:</span> 20%+ margin</div>
                    <div>• <span className="text-yellow-600">Acceptable:</span> 10-20% margin</div>
                    <div>• <span className="text-red-600">Low:</span> &lt;10% margin</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-3">
          <h4 className="font-semibold">Quick Actions</h4>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleDiscountPercentageChange(5);
                setDiscountType('percentage');
              }}
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
            >
              Clear Discount
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}