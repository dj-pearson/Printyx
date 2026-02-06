/**
 * Product Pricing Service
 *
 * Centralized service for all product pricing operations.
 * Handles three-tier pricing model: Dealer Cost → Rep Cost → Customer Price
 *
 * This service provides:
 * - Single source of truth for pricing data
 * - Pricing calculations (markup, margin)
 * - Pricing validation and approval logic
 * - Audit trail for price changes
 * - Company markup rules
 *
 * @module product-pricing-service
 * @version 1.0.0
 */

import { db } from '../db';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('product-pricing-service');

import {
  enhancedProductPricing,
  companyPricingSettings,
  productModels,
  productAccessories,
  type EnhancedProductPricing,
  type InsertEnhancedProductPricing,
  type CompanyPricingSettings,
} from '@shared/schema';
import { eq, and, isNull, or } from 'drizzle-orm';

/**
 * Pricing tier types
 */
export type PricingTier = 'new' | 'upgrade' | 'lexmark' | 'standard' | string;

/**
 * Product type for pricing
 */
export type ProductType = 'model' | 'accessory' | 'software' | 'service';

/**
 * Markup type for calculations
 */
export type MarkupType = 'percentage' | 'fixed_amount' | 'custom';

/**
 * Pricing validation result
 */
export interface PricingValidationResult {
  isValid: boolean;
  requiresApproval: boolean;
  reason?: string;
  discountPercentage?: number;
  marginPercentage?: number;
}

/**
 * Company markup configuration
 */
export interface CompanyMarkupConfig {
  type: MarkupType;
  value: number;
}

/**
 * Pricing update parameters
 */
export interface PricingUpdateParams {
  dealerCost?: number;
  repCost?: number;
  suggestedRetailPrice?: number;
  minimumSalePrice?: number;
  markupPercentage?: number;
  markupAmount?: number;
  markupType?: MarkupType;
  useCustomMarkup?: boolean;
}

/**
 * Product Pricing Service Class
 */
export class ProductPricingService {
  /**
   * Get pricing for a specific product and tier
   *
   * @param productId - Product ID
   * @param productType - Type of product (model, accessory, etc.)
   * @param pricingTier - Optional pricing tier (new, upgrade, etc.)
   * @returns Pricing record or null
   */
  async getProductPricing(
    productId: string,
    productType: ProductType,
    pricingTier?: PricingTier,
  ): Promise<EnhancedProductPricing | null> {
    const conditions = [
      eq(enhancedProductPricing.productId, productId),
      eq(enhancedProductPricing.productType, productType),
      eq(enhancedProductPricing.isActive, true),
    ];

    if (pricingTier) {
      conditions.push(eq(enhancedProductPricing.pricingTier, pricingTier));
    }

    const pricing = await db.query.enhancedProductPricing.findFirst({
      where: and(...conditions),
    });

    return pricing || null;
  }

  /**
   * Get all pricing tiers for a product
   *
   * @param productId - Product ID
   * @param productType - Type of product
   * @returns Array of pricing records
   */
  async getAllProductPricingTiers(
    productId: string,
    productType: ProductType,
  ): Promise<EnhancedProductPricing[]> {
    return db.query.enhancedProductPricing.findMany({
      where: and(
        eq(enhancedProductPricing.productId, productId),
        eq(enhancedProductPricing.productType, productType),
        eq(enhancedProductPricing.isActive, true),
      ),
    });
  }

  /**
   * Get pricing with fallback to old schema (backward compatibility)
   *
   * @param productId - Product ID
   * @param productType - Type of product
   * @param pricingTier - Pricing tier
   * @returns Pricing data or null
   */
  async getProductPricingWithFallback(
    productId: string,
    productType: ProductType,
    pricingTier: PricingTier,
  ): Promise<any> {
    // Try new pricing table first
    const newPricing = await this.getProductPricing(productId, productType, pricingTier);

    if (newPricing) {
      return {
        dealerCost: newPricing.dealerCost,
        repCost: newPricing.repCost,
        suggestedRetailPrice: newPricing.suggestedRetailPrice,
        minimumSalePrice: newPricing.minimumSalePrice,
        markupPercentage: newPricing.markupPercentage,
        useCustomMarkup: newPricing.useCustomMarkup,
        isActive: newPricing.isActive,
        source: 'enhanced_product_pricing',
      };
    }

    // Fallback to old pricing fields
    if (productType === 'model') {
      const product = await db.query.productModels.findFirst({
        where: eq(productModels.id, productId),
      });

      if (!product) return null;

      const tierMapping: Record<string, any> = {
        new: {
          dealerCost: product.newDealerCost,
          repCost: product.newRepCost,
          suggestedRetailPrice: product.newSuggestedRetail,
          markupPercentage: product.newRepMarkupPercentage,
          isActive: product.newActive,
          source: 'product_models_legacy',
        },
        upgrade: {
          dealerCost: product.upgradeDealerCost,
          repCost: product.upgradeRepCost,
          suggestedRetailPrice: product.upgradeSuggestedRetail,
          markupPercentage: product.upgradeRepMarkupPercentage,
          isActive: product.upgradeActive,
          source: 'product_models_legacy',
        },
        lexmark: {
          dealerCost: product.lexmarkDealerCost,
          repCost: product.lexmarkRepCost,
          suggestedRetailPrice: product.lexmarkSuggestedRetail,
          markupPercentage: product.lexmarkRepMarkupPercentage,
          isActive: product.lexmarkActive,
          source: 'product_models_legacy',
        },
      };

      return tierMapping[pricingTier] || null;
    }

    if (productType === 'accessory') {
      const accessory = await db.query.productAccessories.findFirst({
        where: eq(productAccessories.id, productId),
      });

      if (!accessory) return null;

      const tierMapping: Record<string, any> = {
        standard: {
          dealerCost: accessory.standardDealerCost || accessory.standardCost,
          repCost: accessory.standardRepCost,
          suggestedRetailPrice: accessory.standardSuggestedRetail,
          markupPercentage: accessory.standardRepMarkupPercentage,
          isActive: accessory.isActive,
          source: 'product_accessories_legacy',
        },
        new: {
          dealerCost: accessory.newDealerCost || accessory.newCost,
          repCost: accessory.newRepCost,
          suggestedRetailPrice: accessory.newSuggestedRetail,
          markupPercentage: accessory.newRepMarkupPercentage,
          isActive: accessory.isActive,
          source: 'product_accessories_legacy',
        },
        upgrade: {
          dealerCost: accessory.upgradeDealerCost || accessory.upgradeCost,
          repCost: accessory.upgradeRepCost,
          suggestedRetailPrice: accessory.upgradeSuggestedRetail,
          markupPercentage: accessory.upgradeRepMarkupPercentage,
          isActive: accessory.isActive,
          source: 'product_accessories_legacy',
        },
      };

      return tierMapping[pricingTier] || null;
    }

    return null;
  }

  /**
   * Calculate rep cost from dealer cost and markup
   *
   * @param dealerCost - Dealer cost (Tier 1)
   * @param markupType - Type of markup (percentage or fixed)
   * @param markupValue - Markup value
   * @returns Calculated rep cost
   */
  calculateRepCost(dealerCost: number, markupType: MarkupType, markupValue: number): number {
    if (markupType === 'percentage') {
      return dealerCost * (1 + markupValue / 100);
    } else if (markupType === 'fixed_amount') {
      return dealerCost + markupValue;
    }
    return dealerCost; // For 'custom' type, return as-is
  }

  /**
   * Calculate margin percentage
   *
   * @param dealerCost - Dealer cost (Tier 1)
   * @param customerPrice - Customer price (Tier 3)
   * @returns Margin percentage
   */
  calculateMarginPercentage(dealerCost: number, customerPrice: number): number {
    if (dealerCost === 0) return 0;
    return ((customerPrice - dealerCost) / dealerCost) * 100;
  }

  /**
   * Calculate margin amount
   *
   * @param dealerCost - Dealer cost (Tier 1)
   * @param customerPrice - Customer price (Tier 3)
   * @returns Margin amount in dollars
   */
  calculateMarginAmount(dealerCost: number, customerPrice: number): number {
    return customerPrice - dealerCost;
  }

  /**
   * Calculate rep margin percentage (from rep cost)
   *
   * @param repCost - Rep cost (Tier 2)
   * @param customerPrice - Customer price (Tier 3)
   * @returns Rep margin percentage
   */
  calculateRepMarginPercentage(repCost: number, customerPrice: number): number {
    if (repCost === 0) return 0;
    return ((customerPrice - repCost) / repCost) * 100;
  }

  /**
   * Calculate discount percentage
   *
   * @param originalPrice - Original price
   * @param discountedPrice - Discounted price
   * @returns Discount percentage
   */
  calculateDiscountPercentage(originalPrice: number, discountedPrice: number): number {
    if (originalPrice === 0) return 0;
    return ((originalPrice - discountedPrice) / originalPrice) * 100;
  }

  /**
   * Create or update product pricing
   *
   * @param productId - Product ID
   * @param productType - Type of product
   * @param pricingTier - Pricing tier
   * @param tenantId - Tenant ID
   * @param updates - Pricing updates
   * @param userId - User making the change
   * @param changeReason - Reason for change (optional)
   * @returns Updated pricing record
   */
  async upsertProductPricing(
    productId: string,
    productType: ProductType,
    pricingTier: PricingTier,
    tenantId: string,
    updates: PricingUpdateParams,
    userId: string,
    changeReason?: string,
  ): Promise<EnhancedProductPricing> {
    // Check if pricing already exists
    const existing = await this.getProductPricing(productId, productType, pricingTier);

    if (existing) {
      // Update existing pricing
      return this.updateProductPricing(
        productId,
        productType,
        pricingTier,
        updates,
        userId,
        changeReason,
      );
    } else {
      // Create new pricing
      const newPricing: InsertEnhancedProductPricing = {
        tenantId,
        productId,
        productType,
        pricingTier,
        dealerCost: updates.dealerCost?.toString(),
        repCost: updates.repCost?.toString(),
        suggestedRetailPrice: updates.suggestedRetailPrice?.toString(),
        minimumSalePrice: updates.minimumSalePrice?.toString(),
        useCustomMarkup: updates.useCustomMarkup || false,
        markupType: updates.markupType || null,
        markupPercentage: updates.markupPercentage?.toString(),
        markupAmount: updates.markupAmount?.toString(),
        isActive: true,
        effectiveDate: new Date(),
        createdBy: userId,
        lastCostUpdateBy: userId,
        costChangeReason: changeReason || 'Initial pricing creation',
      };

      const [created] = await db.insert(enhancedProductPricing).values(newPricing).returning();

      return created;
    }
  }

  /**
   * Update product pricing (with audit trail)
   *
   * @param productId - Product ID
   * @param productType - Type of product
   * @param pricingTier - Pricing tier
   * @param updates - Pricing updates
   * @param userId - User making the change
   * @param changeReason - Reason for change (optional)
   * @returns Updated pricing record
   */
  async updateProductPricing(
    productId: string,
    productType: ProductType,
    pricingTier: PricingTier,
    updates: PricingUpdateParams,
    userId: string,
    changeReason?: string,
  ): Promise<EnhancedProductPricing> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Only update fields that are provided
    if (updates.dealerCost !== undefined) {
      updateData.dealerCost = updates.dealerCost.toString();
      updateData.lastCostUpdate = new Date();
      updateData.lastCostUpdateBy = userId;
      updateData.costChangeReason = changeReason || 'Dealer cost update';
    }

    if (updates.repCost !== undefined) {
      updateData.repCost = updates.repCost.toString();
    }

    if (updates.suggestedRetailPrice !== undefined) {
      updateData.suggestedRetailPrice = updates.suggestedRetailPrice.toString();
    }

    if (updates.minimumSalePrice !== undefined) {
      updateData.minimumSalePrice = updates.minimumSalePrice.toString();
    }

    if (updates.markupPercentage !== undefined) {
      updateData.markupPercentage = updates.markupPercentage.toString();
      updateData.useCustomMarkup = true;
      updateData.markupType = 'percentage';
    }

    if (updates.markupAmount !== undefined) {
      updateData.markupAmount = updates.markupAmount.toString();
      updateData.useCustomMarkup = true;
      updateData.markupType = 'fixed_amount';
    }

    if (updates.useCustomMarkup !== undefined) {
      updateData.useCustomMarkup = updates.useCustomMarkup;
    }

    const [updated] = await db
      .update(enhancedProductPricing)
      .set(updateData)
      .where(
        and(
          eq(enhancedProductPricing.productId, productId),
          eq(enhancedProductPricing.productType, productType),
          eq(enhancedProductPricing.pricingTier, pricingTier),
        ),
      )
      .returning();

    return updated;
  }

  /**
   * Get company default markup for a tenant
   *
   * @param tenantId - Tenant ID
   * @param category - Optional product category for category-specific markup
   * @returns Markup configuration
   */
  async getCompanyMarkup(tenantId: string, category?: string): Promise<CompanyMarkupConfig> {
    const settings = await db.query.companyPricingSettings.findFirst({
      where: eq(companyPricingSettings.tenantId, tenantId),
    });

    if (!settings) {
      // Return default 13% markup
      return { type: 'percentage', value: 13.0 };
    }

    // Check for category-specific override
    if (category && settings.categoryMarkupOverrides) {
      const overrides = settings.categoryMarkupOverrides as Record<string, number>;
      if (overrides[category]) {
        return { type: 'percentage', value: overrides[category] };
      }
    }

    // Return company default
    return {
      type: (settings.defaultMarkupType as MarkupType) || 'percentage',
      value: parseFloat(settings.defaultMarkupPercentage || '13.0'),
    };
  }

  /**
   * Get company pricing settings
   *
   * @param tenantId - Tenant ID
   * @returns Company pricing settings or null
   */
  async getCompanyPricingSettings(tenantId: string): Promise<CompanyPricingSettings | null> {
    const settings = await db.query.companyPricingSettings.findFirst({
      where: eq(companyPricingSettings.tenantId, tenantId),
    });

    return settings || null;
  }

  /**
   * Apply default markup to products without custom pricing
   *
   * @param tenantId - Tenant ID
   * @param productIds - Array of product IDs
   * @param productType - Type of products
   * @param userId - User applying the markup
   * @returns Number of products updated
   */
  async applyDefaultMarkupToProducts(
    tenantId: string,
    productIds: string[],
    productType: ProductType,
    userId: string,
  ): Promise<number> {
    const markup = await this.getCompanyMarkup(tenantId);
    let updatedCount = 0;

    for (const productId of productIds) {
      const pricingRecords = await this.getAllProductPricingTiers(productId, productType);

      for (const record of pricingRecords) {
        // Only update if not using custom markup
        if (!record.useCustomMarkup && record.dealerCost) {
          const dealerCost = parseFloat(record.dealerCost);
          const newRepCost = this.calculateRepCost(
            dealerCost,
            markup.type as MarkupType,
            markup.value,
          );

          await this.updateProductPricing(
            productId,
            productType,
            record.pricingTier || 'standard',
            {
              repCost: newRepCost,
              markupPercentage: markup.type === 'percentage' ? markup.value : undefined,
              useCustomMarkup: false,
            },
            userId,
            'Applied default company markup',
          );

          updatedCount++;
        }
      }
    }

    return updatedCount;
  }

  /**
   * Validate price change against business rules
   *
   * @param tenantId - Tenant ID
   * @param oldPrice - Original price
   * @param newPrice - New price
   * @param dealerCost - Dealer cost (for margin calculation)
   * @returns Validation result
   */
  async validatePriceChange(
    tenantId: string,
    oldPrice: number,
    newPrice: number,
    dealerCost: number,
  ): Promise<PricingValidationResult> {
    const settings = await this.getCompanyPricingSettings(tenantId);

    if (!settings) {
      // No settings, allow change without approval
      return { isValid: true, requiresApproval: false };
    }

    const discountPercentage = this.calculateDiscountPercentage(oldPrice, newPrice);
    const marginPercentage = this.calculateMarginPercentage(dealerCost, newPrice);

    const maxDiscount = parseFloat(settings.maxDiscountPercentage || '20');
    const minMargin = parseFloat(settings.minMarginPercentage || '5');
    const autoApprovalThreshold = parseFloat(settings.autoApprovalThreshold || '10');

    // Check if discount exceeds maximum
    if (discountPercentage > maxDiscount) {
      return {
        isValid: false,
        requiresApproval: false,
        reason: `Discount (${discountPercentage.toFixed(1)}%) exceeds maximum allowed (${maxDiscount}%)`,
        discountPercentage,
        marginPercentage,
      };
    }

    // Check if margin is below minimum
    if (marginPercentage < minMargin) {
      return {
        isValid: false,
        requiresApproval: false,
        reason: `Margin (${marginPercentage.toFixed(1)}%) is below minimum required (${minMargin}%)`,
        discountPercentage,
        marginPercentage,
      };
    }

    // Check if approval is required
    if (discountPercentage > autoApprovalThreshold) {
      return {
        isValid: true,
        requiresApproval: true,
        reason: `Discount (${discountPercentage.toFixed(1)}%) exceeds auto-approval threshold (${autoApprovalThreshold}%)`,
        discountPercentage,
        marginPercentage,
      };
    }

    // Price change is valid and doesn't require approval
    return {
      isValid: true,
      requiresApproval: false,
      discountPercentage,
      marginPercentage,
    };
  }

  /**
   * Get pricing history for a product (audit trail)
   *
   * @param productId - Product ID
   * @param productType - Type of product
   * @returns Array of pricing records with history
   */
  async getPricingHistory(
    productId: string,
    productType: ProductType,
  ): Promise<EnhancedProductPricing[]> {
    // For now, return current pricing with audit information
    // In future, implement a separate pricing_history table for complete audit trail
    return this.getAllProductPricingTiers(productId, productType);
  }

  /**
   * Bulk update pricing for multiple products
   *
   * @param updates - Array of updates with productId, productType, tier, and pricing data
   * @param userId - User making the changes
   * @returns Number of products updated
   */
  async bulkUpdatePricing(
    updates: Array<{
      productId: string;
      productType: ProductType;
      pricingTier: PricingTier;
      updates: PricingUpdateParams;
    }>,
    userId: string,
  ): Promise<number> {
    let updatedCount = 0;

    for (const update of updates) {
      try {
        await this.updateProductPricing(
          update.productId,
          update.productType,
          update.pricingTier,
          update.updates,
          userId,
          'Bulk pricing update',
        );
        updatedCount++;
      } catch (error) {
        log.error(
          `Failed to update pricing for ${update.productId} (${update.productType}/${update.pricingTier}):`,
          error,
        );
        // Continue with other updates
      }
    }

    return updatedCount;
  }
}

// Export singleton instance
export const productPricingService = new ProductPricingService();

// Export class for testing
export default ProductPricingService;
