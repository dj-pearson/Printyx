import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('pricing-service');

import {
  companyPricingSettings,
  enhancedProductPricing,
  productModels,
  productAccessories,
  type CompanyPricingSettings,
  type EnhancedProductPricing,
} from '@shared/schema';

/**
 * Pricing Service - Handles three-tier pricing calculations and RBAC visibility
 *
 * Three-Tier Pricing Model:
 * 1. Dealer Cost - Hard cost to the dealer (visible to managers/admins only)
 * 2. Rep Cost - Dealer Cost + Markup (visible to sales reps and above)
 * 3. Customer Price - Final price (visible to customers and everyone)
 *
 * Role Hierarchy (from highest to lowest):
 * 1. Platform Admin
 * 2. Super Admin
 * 3. Admin
 * 4. Manager
 * 5. Standard User (Sales Rep)
 * 6. Support
 * 7. Read-Only
 * 8. Guest
 */

// Role levels for comparison
const ROLE_LEVELS = {
  'platform-admin': 1,
  'super-admin': 2,
  admin: 3,
  manager: 4,
  standard: 5,
  support: 6,
  'read-only': 7,
  guest: 8,
};

/**
 * Check if user can see dealer cost
 * Only managers and above can see dealer cost
 */
export function canSeeDealerCost(userRole: string, settings?: CompanyPricingSettings): boolean {
  const roleLevel = ROLE_LEVELS[userRole.toLowerCase() as keyof typeof ROLE_LEVELS] || 999;

  // Managers (level 4) and above can see dealer cost
  return roleLevel <= 4;
}

/**
 * Check if user can see rep cost
 * Sales reps and above can see rep cost (unless company settings restrict it)
 */
export function canSeeRepCost(userRole: string, settings?: CompanyPricingSettings): boolean {
  const roleLevel = ROLE_LEVELS[userRole.toLowerCase() as keyof typeof ROLE_LEVELS] || 999;

  // Standard users (sales reps, level 5) and above can see rep cost
  return roleLevel <= 5;
}

/**
 * Check if user can edit dealer cost
 * Only admins and above can edit dealer cost
 */
export function canEditDealerCost(userRole: string): boolean {
  const roleLevel = ROLE_LEVELS[userRole.toLowerCase() as keyof typeof ROLE_LEVELS] || 999;

  // Admins (level 3) and above can edit dealer cost
  return roleLevel <= 3;
}

/**
 * Check if user can edit customer price
 * Depends on company settings
 */
export function canEditCustomerPrice(userRole: string, settings?: CompanyPricingSettings): boolean {
  // Managers and above can always edit
  const roleLevel = ROLE_LEVELS[userRole.toLowerCase() as keyof typeof ROLE_LEVELS] || 999;
  if (roleLevel <= 4) return true;

  // For sales reps, check company settings
  if (!settings) return false;

  return settings.allowRepPriceEdit === true;
}

/**
 * Check if price change requires approval
 */
export function requiresApproval(
  userRole: string,
  originalPrice: number,
  newPrice: number,
  repCost: number,
  settings?: CompanyPricingSettings,
): boolean {
  // Managers and above don't need approval
  const roleLevel = ROLE_LEVELS[userRole.toLowerCase() as keyof typeof ROLE_LEVELS] || 999;
  if (roleLevel <= 4) return false;

  if (!settings) return true;

  // If approval is always required for price edits
  if (settings.requireApprovalForPriceEdit) return true;

  // If no threshold settings, no approval needed
  if (!settings.requireApprovalAboveThreshold) return false;

  // Calculate discount percentage from rep cost
  const discountAmount = repCost - newPrice;
  const discountPercentage = (discountAmount / repCost) * 100;

  // Check if discount exceeds auto-approval threshold
  const autoApprovalThreshold = parseFloat(settings.autoApprovalThreshold?.toString() || '10');

  return discountPercentage > autoApprovalThreshold;
}

/**
 * Calculate rep cost from dealer cost and markup settings
 */
export function calculateRepCost(
  dealerCost: number,
  productMarkupPercentage: number | null,
  settings: CompanyPricingSettings | null,
  productCategory?: string,
): number {
  let markupPercentage: number;

  // 1. Use product-specific markup if provided
  if (productMarkupPercentage !== null && productMarkupPercentage !== undefined) {
    markupPercentage = productMarkupPercentage;
  }
  // 2. Check for category-specific markup override
  else if (
    settings?.categoryMarkupOverrides &&
    productCategory &&
    typeof settings.categoryMarkupOverrides === 'object'
  ) {
    const categoryOverrides = settings.categoryMarkupOverrides as Record<string, number>;
    markupPercentage =
      categoryOverrides[productCategory] ||
      parseFloat(settings.defaultMarkupPercentage?.toString() || '13');
  }
  // 3. Fall back to company default
  else {
    markupPercentage = parseFloat(settings?.defaultMarkupPercentage?.toString() || '13');
  }

  return dealerCost * (1 + markupPercentage / 100);
}

/**
 * Calculate margin percentage
 */
export function calculateMarginPercentage(customerPrice: number, cost: number): number {
  if (cost === 0) return 0;
  return ((customerPrice - cost) / cost) * 100;
}

/**
 * Calculate discount percentage
 */
export function calculateDiscountPercentage(
  originalPrice: number,
  discountedPrice: number,
): number {
  if (originalPrice === 0) return 0;
  return ((originalPrice - discountedPrice) / originalPrice) * 100;
}

/**
 * Validate price against minimum margin requirements
 */
export function validateMinimumMargin(
  customerPrice: number,
  dealerCost: number,
  settings: CompanyPricingSettings | null,
): { valid: boolean; message?: string; actualMargin: number; requiredMargin: number } {
  const minMarginPercentage = parseFloat(settings?.minMarginPercentage?.toString() || '5');
  const actualMargin = calculateMarginPercentage(customerPrice, dealerCost);

  if (actualMargin < minMarginPercentage) {
    return {
      valid: false,
      message: `Price below minimum margin. Required: ${minMarginPercentage}%, Actual: ${actualMargin.toFixed(2)}%`,
      actualMargin,
      requiredMargin: minMarginPercentage,
    };
  }

  return {
    valid: true,
    actualMargin,
    requiredMargin: minMarginPercentage,
  };
}

/**
 * Get company pricing settings for a tenant
 */
export async function getCompanyPricingSettings(
  tenantId: string,
): Promise<CompanyPricingSettings | null> {
  try {
    const [settings] = await db
      .select()
      .from(companyPricingSettings)
      .where(eq(companyPricingSettings.tenantId, tenantId))
      .limit(1);

    return settings || null;
  } catch (error) {
    log.error('Error fetching company pricing settings:', error);
    return null;
  }
}

/**
 * Get or create default company pricing settings
 */
export async function getOrCreatePricingSettings(
  tenantId: string,
): Promise<CompanyPricingSettings> {
  let settings = await getCompanyPricingSettings(tenantId);

  if (!settings) {
    // Create default settings
    const [newSettings] = await db
      .insert(companyPricingSettings)
      .values({
        tenantId,
        defaultMarkupPercentage: '13.00',
        allowRepPriceEdit: true,
        requireApprovalForPriceEdit: false,
        requireApprovalAboveThreshold: true,
        maxDiscountPercentage: '20.00',
        minMarginPercentage: '5.00',
        autoApprovalThreshold: '10.00',
        showDealerCostToReps: false,
        showMarginToReps: true,
        notifyOnPriceChange: true,
        notifyManagersOnApproval: true,
      })
      .returning();

    settings = newSettings;
  }

  return settings;
}

/**
 * Filter pricing data based on user role
 * Removes fields that the user shouldn't see
 */
export function filterPricingByRole<T extends Record<string, any>>(
  data: T,
  userRole: string,
  settings?: CompanyPricingSettings,
): Partial<T> {
  const filtered: any = { ...data };

  // Remove dealer cost fields if user can't see them
  if (!canSeeDealerCost(userRole, settings)) {
    // Remove all *DealerCost fields
    Object.keys(filtered).forEach((key) => {
      if (key.toLowerCase().includes('dealercost') || key.toLowerCase().includes('dealer_cost')) {
        delete filtered[key];
      }
    });
  }

  // Remove rep cost fields if user can't see them (though this is rare)
  if (!canSeeRepCost(userRole, settings)) {
    Object.keys(filtered).forEach((key) => {
      if (key.toLowerCase().includes('repcost') || key.toLowerCase().includes('rep_cost')) {
        delete filtered[key];
      }
    });
  }

  // Remove margin fields if settings say so
  if (settings && !settings.showMarginToReps && !canSeeDealerCost(userRole, settings)) {
    Object.keys(filtered).forEach((key) => {
      if (key.toLowerCase().includes('margin')) {
        delete filtered[key];
      }
    });
  }

  return filtered;
}

/**
 * Filter array of pricing data by role
 */
export function filterPricingArrayByRole<T extends Record<string, any>>(
  dataArray: T[],
  userRole: string,
  settings?: CompanyPricingSettings,
): Partial<T>[] {
  return dataArray.map((item) => filterPricingByRole(item, userRole, settings));
}

/**
 * Calculate complete pricing breakdown for a product
 */
export interface PricingBreakdown {
  dealerCost: number;
  repCost: number;
  suggestedRetail: number;
  minimumSalePrice: number;
  markupPercentage: number;
  marginFromDealerCost: number;
  marginFromRepCost: number;
  canEditDealerCost: boolean;
  canEditCustomerPrice: boolean;
  showDealerCost: boolean;
  showRepCost: boolean;
}

export async function calculatePricingBreakdown(
  tenantId: string,
  productId: string,
  pricingTier: string | null,
  userRole: string,
  dealerCost: number,
  productMarkupPercentage: number | null = null,
  productCategory?: string,
): Promise<PricingBreakdown> {
  const settings = await getOrCreatePricingSettings(tenantId);

  const repCost = calculateRepCost(dealerCost, productMarkupPercentage, settings, productCategory);

  const markupPercentage =
    productMarkupPercentage ?? parseFloat(settings.defaultMarkupPercentage?.toString() || '13');

  return {
    dealerCost,
    repCost,
    suggestedRetail: repCost * 1.2, // Default 20% markup for suggested retail
    minimumSalePrice: repCost * 1.05, // Default 5% minimum margin
    markupPercentage,
    marginFromDealerCost: 0,
    marginFromRepCost: 0,
    canEditDealerCost: canEditDealerCost(userRole),
    canEditCustomerPrice: canEditCustomerPrice(userRole, settings),
    showDealerCost: canSeeDealerCost(userRole, settings),
    showRepCost: canSeeRepCost(userRole, settings),
  };
}

/**
 * Pricing visibility response type
 * Used to communicate what pricing fields are visible to the current user
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

/**
 * Get pricing visibility settings for current user
 */
export async function getPricingVisibility(
  tenantId: string,
  userRole: string,
): Promise<PricingVisibility> {
  const settings = await getOrCreatePricingSettings(tenantId);

  return {
    showDealerCost: canSeeDealerCost(userRole, settings),
    showRepCost: canSeeRepCost(userRole, settings),
    showMargin: settings.showMarginToReps || canSeeDealerCost(userRole, settings),
    canEditDealerCost: canEditDealerCost(userRole),
    canEditRepCost: false, // Rep cost is always calculated
    canEditCustomerPrice: canEditCustomerPrice(userRole, settings),
    requiresApprovalForPriceChange: settings.requireApprovalForPriceEdit || false,
    maxDiscountPercentage: parseFloat(settings.maxDiscountPercentage?.toString() || '20'),
    minMarginPercentage: parseFloat(settings.minMarginPercentage?.toString() || '5'),
  };
}
