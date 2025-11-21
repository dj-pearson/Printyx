import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Info, Calculator, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { usePricingVisibility } from "@/hooks/usePricingVisibility";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PricingTier {
  active: boolean;
  dealerCost?: number | string;
  repMarkupPercentage?: number | string;
  repCost?: number | string;
  suggestedRetail?: number | string;
}

interface ProductPricingFormProps {
  tier: "new" | "upgrade" | "lexmark" | "standard";
  tierLabel: string;
  values: PricingTier;
  onChange: (values: PricingTier) => void;
  productCategory?: string;
  disabled?: boolean;
}

export function ProductPricingForm({
  tier,
  tierLabel,
  values,
  onChange,
  productCategory,
  disabled = false,
}: ProductPricingFormProps) {
  const { data: visibility } = usePricingVisibility();
  const { toast } = useToast();
  const [calculating, setCalculating] = useState(false);

  // Calculate rep cost when dealer cost or markup changes
  const calculateRepCost = async (dealerCost: number, markupPercentage?: number) => {
    if (!dealerCost || dealerCost <= 0) {
      onChange({ ...values, repCost: "0.00" });
      return;
    }

    setCalculating(true);
    try {
      const result = await apiRequest<{
        dealerCost: number;
        repCost: number;
        markupPercentage: string;
      }>('/api/pricing/calculate-rep-cost', 'POST', {
        dealerCost: dealerCost.toString(),
        markupPercentage: markupPercentage?.toString(),
        productCategory,
      });

      onChange({
        ...values,
        repCost: result.repCost.toFixed(2),
        repMarkupPercentage: result.markupPercentage,
      });
    } catch (error) {
      console.error('Error calculating rep cost:', error);
      toast({
        title: "Calculation Error",
        description: "Failed to calculate rep cost. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  };

  // Auto-calculate rep cost when dealer cost changes
  const handleDealerCostChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    onChange({ ...values, dealerCost: value });

    if (numValue > 0) {
      const markup = values.repMarkupPercentage ? parseFloat(values.repMarkupPercentage.toString()) : undefined;
      calculateRepCost(numValue, markup);
    }
  };

  // Recalculate when markup percentage changes
  const handleMarkupChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    onChange({ ...values, repMarkupPercentage: value });

    const dealerCost = values.dealerCost ? parseFloat(values.dealerCost.toString()) : 0;
    if (dealerCost > 0) {
      calculateRepCost(dealerCost, numValue);
    }
  };

  // Calculate margin percentage
  const calculateMargin = () => {
    const dealer = parseFloat(values.dealerCost?.toString() || "0");
    const customer = parseFloat(values.suggestedRetail?.toString() || "0");

    if (dealer > 0 && customer > 0) {
      return (((customer - dealer) / dealer) * 100).toFixed(2);
    }
    return "0.00";
  };

  // Check if margin is below minimum
  const isMarginLow = () => {
    const margin = parseFloat(calculateMargin());
    const minMargin = visibility?.minMarginPercentage || 5;
    return margin > 0 && margin < minMargin;
  };

  if (!values.active) {
    return (
      <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/30">
        <Switch
          checked={false}
          onCheckedChange={(checked) => onChange({ ...values, active: checked })}
          disabled={disabled}
        />
        <Label className="text-sm font-medium cursor-pointer">
          Enable {tierLabel} Pricing Tier
        </Label>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Switch
            checked={values.active}
            onCheckedChange={(checked) => onChange({ ...values, active: checked })}
            disabled={disabled}
          />
          <Label className="text-sm font-medium">{tierLabel} Pricing Tier</Label>
        </div>
        <Badge variant="outline">{tier.toUpperCase()}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dealer Cost - Only show if user has permission */}
        {visibility?.showDealerCost && (
          <div className="space-y-2">
            <Label htmlFor={`${tier}-dealer-cost`}>
              Dealer Cost ($)
              {visibility?.canEditDealerCost && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={`${tier}-dealer-cost`}
              type="number"
              step="0.01"
              min="0"
              placeholder="5000.00"
              value={values.dealerCost || ""}
              onChange={(e) => handleDealerCostChange(e.target.value)}
              disabled={!visibility?.canEditDealerCost || disabled}
            />
            <p className="text-xs text-muted-foreground">
              Hard cost to dealer (fluctuates with supplier)
            </p>
          </div>
        )}

        {/* Rep Markup Percentage */}
        {visibility?.canEditDealerCost && (
          <div className="space-y-2">
            <Label htmlFor={`${tier}-markup`}>
              Rep Markup (%)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={`${tier}-markup`}
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="13.00"
                value={values.repMarkupPercentage || ""}
                onChange={(e) => handleMarkupChange(e.target.value)}
                disabled={disabled}
              />
              {calculating && (
                <Calculator className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Leave blank to use company default
            </p>
          </div>
        )}

        {/* Rep Cost - Always calculated, not editable */}
        {visibility?.showRepCost && (
          <div className="space-y-2">
            <Label htmlFor={`${tier}-rep-cost`}>
              Rep Cost ($)
            </Label>
            <Input
              id={`${tier}-rep-cost`}
              type="text"
              value={values.repCost ? `$${parseFloat(values.repCost.toString()).toFixed(2)}` : "$0.00"}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Automatically calculated from dealer cost + markup
            </p>
          </div>
        )}

        {/* Suggested Retail - Customer Price */}
        <div className="space-y-2">
          <Label htmlFor={`${tier}-retail`}>
            Suggested Retail ($)
          </Label>
          <Input
            id={`${tier}-retail`}
            type="number"
            step="0.01"
            min="0"
            placeholder="7500.00"
            value={values.suggestedRetail || ""}
            onChange={(e) => onChange({ ...values, suggestedRetail: e.target.value })}
            disabled={!visibility?.canEditCustomerPrice || disabled}
          />
          <p className="text-xs text-muted-foreground">
            MSRP / Suggested customer price
          </p>
        </div>
      </div>

      {/* Margin Display */}
      {visibility?.showMargin && values.dealerCost && values.suggestedRetail && (
        <>
          <Separator />
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Margin Analysis</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Margin %</p>
                <p className={`text-sm font-bold ${isMarginLow() ? 'text-orange-600' : 'text-green-600'}`}>
                  {calculateMargin()}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Margin $</p>
                <p className="text-sm font-bold">
                  ${(
                    (parseFloat(values.suggestedRetail?.toString() || "0") -
                      parseFloat(values.dealerCost?.toString() || "0"))
                  ).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {isMarginLow() && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Warning: Margin is below minimum ({visibility?.minMarginPercentage || 5}%).
                This price may require manager approval.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Discount Warning */}
      {visibility?.requiresApprovalForPriceChange && values.repCost && values.suggestedRetail && (
        <>
          {(() => {
            const repCost = parseFloat(values.repCost.toString());
            const customerPrice = parseFloat(values.suggestedRetail.toString());
            const discountPct = repCost > 0 ? ((repCost - customerPrice) / repCost) * 100 : 0;
            const threshold = visibility?.maxDiscountPercentage || 10;

            if (discountPct > threshold) {
              return (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This pricing represents a {discountPct.toFixed(1)}% discount from rep cost.
                    Manager approval will be required.
                  </AlertDescription>
                </Alert>
              );
            }
            return null;
          })()}
        </>
      )}
    </div>
  );
}
