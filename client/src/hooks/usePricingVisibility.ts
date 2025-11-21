import { useQuery } from "@tanstack/react-query";

/**
 * Pricing Visibility Hook
 *
 * Fetches and returns what pricing fields the current user can see and edit.
 * Used throughout the app to show/hide pricing fields based on role.
 */

export interface PricingVisibility {
  showDealerCost: boolean;
  showRepCost: boolean;
  showMargin: boolean;
  canEditDealerCost: boolean;
  canEditRepCost: boolean;
  canEditCustomerPrice: boolean;
  requiresApprovalForPriceChange: boolean;
  maxDiscountPercentage: number;
  minMarginPercentage: number;
}

export function usePricingVisibility() {
  return useQuery<PricingVisibility>({
    queryKey: ['/api/pricing/visibility'],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

/**
 * Hook to get company pricing settings (admin only)
 */
export interface CompanyPricingSettings {
  id: string;
  tenantId: string;
  defaultMarkupType: string;
  defaultMarkupPercentage: string;
  defaultMarkupAmount: string | null;
  categoryMarkupOverrides: Record<string, number> | null;
  allowRepPriceEdit: boolean;
  requireApprovalForPriceEdit: boolean;
  requireApprovalAboveThreshold: boolean;
  maxDiscountPercentage: string;
  minMarginPercentage: string;
  autoApprovalThreshold: string;
  showDealerCostToReps: boolean;
  showMarginToReps: boolean;
  notifyOnPriceChange: boolean;
  notifyManagersOnApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export function usePricingSettings() {
  return useQuery<CompanyPricingSettings>({
    queryKey: ['/api/pricing/settings'],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
