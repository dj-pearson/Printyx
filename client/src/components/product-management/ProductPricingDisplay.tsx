import { DollarSign, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePricingVisibility } from '@/hooks/usePricingVisibility';

interface PricingTierData {
  active?: boolean;
  dealerCost?: string | number | null;
  repCost?: string | number | null;
  suggestedRetail?: string | number | null;
}

interface ProductPricingDisplayProps {
  msrp?: string | number | null;
  newTier?: PricingTierData;
  upgradeTier?: PricingTierData;
  lexmarkTier?: PricingTierData;
  compact?: boolean;
}

export function ProductPricingDisplay({
  msrp,
  newTier,
  upgradeTier,
  lexmarkTier,
  compact = false,
}: ProductPricingDisplayProps) {
  const { data: visibility } = usePricingVisibility();

  const formatCurrency = (value?: string | number | null): string => {
    if (value === null || value === undefined || value === '') return '—';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const calculateMargin = (
    dealerCost?: string | number | null,
    retailPrice?: string | number | null,
  ): string => {
    if (!dealerCost || !retailPrice) return '—';
    const dealer = typeof dealerCost === 'string' ? parseFloat(dealerCost) : dealerCost;
    const retail = typeof retailPrice === 'string' ? parseFloat(retailPrice) : retailPrice;

    if (dealer === 0 || isNaN(dealer) || isNaN(retail)) return '—';

    const margin = ((retail - dealer) / dealer) * 100;
    return `${margin.toFixed(1)}%`;
  };

  const renderTierPricing = (
    tierData: PricingTierData | undefined,
    tierName: string,
    tierColor: string,
  ) => {
    if (!tierData?.active) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={tierColor}>
            {tierName}
          </Badge>
        </div>

        <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3'} gap-2`}>
          {/* Dealer Cost - Only show if user has permission */}
          {visibility?.showDealerCost && tierData.dealerCost && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Dealer Cost</p>
              <p className="text-sm font-semibold text-blue-600">
                {formatCurrency(tierData.dealerCost)}
              </p>
            </div>
          )}

          {/* Rep Cost - Show if user has permission */}
          {visibility?.showRepCost && tierData.repCost && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Rep Cost</p>
              <p className="text-sm font-semibold text-purple-600">
                {formatCurrency(tierData.repCost)}
              </p>
            </div>
          )}

          {/* Suggested Retail - Always show */}
          {tierData.suggestedRetail && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Suggested Retail</p>
              <p className="text-sm font-bold text-green-600">
                {formatCurrency(tierData.suggestedRetail)}
              </p>
            </div>
          )}

          {/* Margin - Only show if user has permission */}
          {visibility?.showMargin && tierData.dealerCost && tierData.suggestedRetail && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Margin
              </p>
              <p className="text-sm font-semibold text-orange-600">
                {calculateMargin(tierData.dealerCost, tierData.suggestedRetail)}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // If no tiers are active, show MSRP only
  const hasActiveTiers = newTier?.active || upgradeTier?.active || lexmarkTier?.active;

  if (!hasActiveTiers) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">MSRP</span>
        </div>
        <p className="text-lg font-bold">{formatCurrency(msrp)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Pricing Tiers</span>
      </div>

      {renderTierPricing(newTier, 'New', 'bg-blue-50 text-blue-700')}
      {newTier?.active && upgradeTier?.active && <Separator className="my-2" />}
      {renderTierPricing(upgradeTier, 'Upgrade', 'bg-purple-50 text-purple-700')}
      {(newTier?.active || upgradeTier?.active) && lexmarkTier?.active && (
        <Separator className="my-2" />
      )}
      {renderTierPricing(lexmarkTier, 'Lexmark', 'bg-green-50 text-green-700')}

      {/* MSRP as reference if tiers exist */}
      {msrp && (
        <>
          <Separator className="my-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>MSRP Reference:</span>
            <span className="font-medium">{formatCurrency(msrp)}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function ProductPricingDisplayCompact({
  tier,
  tierData,
  tierName,
}: {
  tier: 'new' | 'upgrade' | 'lexmark';
  tierData?: PricingTierData;
  tierName: string;
}) {
  const { data: visibility } = usePricingVisibility();

  const formatCurrency = (value?: string | number | null): string => {
    if (value === null || value === undefined || value === '') return '—';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (!tierData?.active) return null;

  const tierColors = {
    new: 'bg-blue-100 text-blue-800',
    upgrade: 'bg-purple-100 text-purple-800',
    lexmark: 'bg-green-100 text-green-800',
  };

  return (
    <div className="flex items-center justify-between text-sm py-1">
      <Badge variant="outline" className={tierColors[tier]}>
        {tierName}
      </Badge>
      <div className="flex items-center gap-3">
        {visibility?.showDealerCost && tierData.dealerCost && (
          <span className="text-blue-600 font-medium">
            D: {formatCurrency(tierData.dealerCost)}
          </span>
        )}
        {visibility?.showRepCost && tierData.repCost && (
          <span className="text-purple-600 font-medium">R: {formatCurrency(tierData.repCost)}</span>
        )}
        {tierData.suggestedRetail && (
          <span className="text-green-600 font-bold">
            {formatCurrency(tierData.suggestedRetail)}
          </span>
        )}
      </div>
    </div>
  );
}
