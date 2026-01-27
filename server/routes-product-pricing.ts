import type { Express, Request, Response } from 'express';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import {
  companyPricingSettings,
  enhancedProductPricing,
  enhancedQuotePricing,
  enhancedQuotePricingLineItems,
  priceChangeApprovals,
  productModels,
  productAccessories,
  users,
  type CompanyPricingSettings,
  type EnhancedProductPricing,
  type EnhancedQuotePricing,
  type PriceChangeApproval,
} from '@shared/schema';
import {
  getOrCreatePricingSettings,
  getPricingVisibility,
  calculateRepCost,
  calculateMarginPercentage,
  requiresApproval,
  validateMinimumMargin,
  filterPricingByRole,
  filterPricingArrayByRole,
  canEditDealerCost,
  canSeeDealerCost,
} from './services/pricing-service';

/**
 * Product Pricing Routes - Three-Tier Pricing Management
 *
 * Handles:
 * - Company pricing settings (CRUD)
 * - Product pricing management (with RBAC)
 * - Price approval workflows
 * - Margin analysis reports
 */

// Type for authenticated request with user and tenant info
interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    roleId?: string;
    role?: string;
  };
}

export function registerProductPricingRoutes(app: Express) {
  /**
   * Get company pricing settings
   * Accessible to: Managers and above
   */
  app.get('/api/pricing/settings', isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const settings = await getOrCreatePricingSettings(tenantId);
      res.json(settings);
    } catch (error) {
      console.error('Error fetching pricing settings:', error);
      res.status(500).json({ error: 'Failed to fetch pricing settings' });
    }
  });

  /**
   * Update company pricing settings
   * Accessible to: Admins and above
   */
  app.put('/api/pricing/settings', isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenant_id;
      const userRole = req.user?.role || 'standard';

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      // Check if user can edit settings (admins and above)
      if (!canEditDealerCost(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions to edit pricing settings' });
      }

      const {
        defaultMarkupPercentage,
        categoryMarkupOverrides,
        allowRepPriceEdit,
        requireApprovalForPriceEdit,
        requireApprovalAboveThreshold,
        maxDiscountPercentage,
        minMarginPercentage,
        autoApprovalThreshold,
        showDealerCostToReps,
        showMarginToReps,
        notifyOnPriceChange,
        notifyManagersOnApproval,
      } = req.body;

      const [updated] = await db
        .update(companyPricingSettings)
        .set({
          defaultMarkupPercentage,
          categoryMarkupOverrides,
          allowRepPriceEdit,
          requireApprovalForPriceEdit,
          requireApprovalAboveThreshold,
          maxDiscountPercentage,
          minMarginPercentage,
          autoApprovalThreshold,
          showDealerCostToReps,
          showMarginToReps,
          notifyOnPriceChange,
          notifyManagersOnApproval,
          updatedAt: new Date(),
        })
        .where(eq(companyPricingSettings.tenant_id, tenantId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Error updating pricing settings:', error);
      res.status(500).json({ error: 'Failed to update pricing settings' });
    }
  });

  /**
   * Get pricing visibility for current user
   * Returns what pricing fields the user can see and edit
   */
  app.get('/api/pricing/visibility', isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenant_id;
      const userRole = req.user?.role || 'standard';

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const visibility = await getPricingVisibility(tenantId, userRole);
      res.json(visibility);
    } catch (error) {
      console.error('Error fetching pricing visibility:', error);
      res.status(500).json({ error: 'Failed to fetch pricing visibility' });
    }
  });

  /**
   * Calculate rep cost for a given dealer cost
   * Used when updating dealer costs to show the new rep cost
   */
  app.post(
    '/api/pricing/calculate-rep-cost',
    isAuthenticated,
    async (req: AuthRequest, res: Response) => {
      try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
          return res.status(400).json({ error: 'Tenant ID required' });
        }

        const { dealerCost, markupPercentage, productCategory } = req.body;

        if (!dealerCost || isNaN(parseFloat(dealerCost))) {
          return res.status(400).json({ error: 'Valid dealer cost required' });
        }

        const settings = await getOrCreatePricingSettings(tenantId);
        const repCost = calculateRepCost(
          parseFloat(dealerCost),
          markupPercentage ? parseFloat(markupPercentage) : null,
          settings,
          productCategory,
        );

        res.json({
          dealerCost: parseFloat(dealerCost),
          repCost,
          markupPercentage: markupPercentage || settings.defaultMarkupPercentage,
        });
      } catch (error) {
        console.error('Error calculating rep cost:', error);
        res.status(500).json({ error: 'Failed to calculate rep cost' });
      }
    },
  );

  /**
   * Update product model pricing (supports three-tier pricing)
   * Accessible to: Admins can edit all, Managers can edit rep/customer price
   */
  app.patch(
    '/api/product-models/:id/pricing',
    isAuthenticated,
    async (req: AuthRequest, res: Response) => {
      try {
        const tenantId = req.user?.tenant_id;
        const userRole = req.user?.role || 'standard';
        const productId = req.params.id;

        if (!tenantId) {
          return res.status(400).json({ error: 'Tenant ID required' });
        }

        const {
          tier, // "new", "upgrade", "lexmark"
          dealerCost,
          repMarkupPercentage,
          repCost,
          suggestedRetail,
        } = req.body;

        if (!tier) {
          return res.status(400).json({ error: 'Pricing tier required' });
        }

        // Get current product
        const [product] = await db
          .select()
          .from(productModels)
          .where(and(eq(productModels.id, productId), eq(productModels.tenant_id, tenantId)))
          .limit(1);

        if (!product) {
          return res.status(404).json({ error: 'Product not found' });
        }

        const settings = await getOrCreatePricingSettings(tenantId);
        const updateData: any = {};

        // Dealer cost update (admins only)
        if (dealerCost !== undefined) {
          if (!canEditDealerCost(userRole)) {
            return res.status(403).json({ error: 'Insufficient permissions to edit dealer cost' });
          }

          updateData[`${tier}DealerCost`] = dealerCost;

          // Recalculate rep cost
          const newRepCost = calculateRepCost(
            parseFloat(dealerCost),
            repMarkupPercentage ? parseFloat(repMarkupPercentage) : null,
            settings,
            product.category || undefined,
          );
          updateData[`${tier}RepCost`] = newRepCost.toFixed(2);
        }

        // Rep markup percentage update
        if (repMarkupPercentage !== undefined) {
          if (!canEditDealerCost(userRole)) {
            return res.status(403).json({ error: 'Insufficient permissions to edit markup' });
          }

          updateData[`${tier}RepMarkupPercentage`] = repMarkupPercentage;

          // Recalculate rep cost
          const currentDealerCost =
            updateData[`${tier}DealerCost`] || product[`${tier}DealerCost` as keyof typeof product];

          if (currentDealerCost) {
            const newRepCost = calculateRepCost(
              parseFloat(currentDealerCost.toString()),
              parseFloat(repMarkupPercentage),
              settings,
              product.category || undefined,
            );
            updateData[`${tier}RepCost`] = newRepCost.toFixed(2);
          }
        }

        // Suggested retail update
        if (suggestedRetail !== undefined) {
          updateData[`${tier}SuggestedRetail`] = suggestedRetail;
        }

        updateData.updated_at = new Date();

        // Update the product
        const [updated] = await db
          .update(productModels)
          .set(updateData)
          .where(and(eq(productModels.id, productId), eq(productModels.tenant_id, tenantId)))
          .returning();

        // Filter response based on user role
        const filtered = filterPricingByRole(updated, userRole, settings);

        res.json(filtered);
      } catch (error) {
        console.error('Error updating product pricing:', error);
        res.status(500).json({ error: 'Failed to update product pricing' });
      }
    },
  );

  /**
   * Bulk update dealer costs for multiple products
   * Useful when supplier costs change
   * Accessible to: Admins only
   */
  app.post(
    '/api/pricing/bulk-update-dealer-cost',
    isAuthenticated,
    async (req: AuthRequest, res: Response) => {
      try {
        const tenantId = req.user?.tenant_id;
        const userRole = req.user?.role || 'standard';

        if (!tenantId) {
          return res.status(400).json({ error: 'Tenant ID required' });
        }

        if (!canEditDealerCost(userRole)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { updates } = req.body; // Array of { productId, tier, dealerCost }

        if (!Array.isArray(updates)) {
          return res.status(400).json({ error: 'Updates must be an array' });
        }

        const settings = await getOrCreatePricingSettings(tenantId);
        const results = [];

        for (const update of updates) {
          const { productId, tier, dealerCost } = update;

          // Get product to calculate rep cost
          const [product] = await db
            .select()
            .from(productModels)
            .where(and(eq(productModels.id, productId), eq(productModels.tenant_id, tenantId)))
            .limit(1);

          if (!product) continue;

          const currentMarkup = product[`${tier}RepMarkupPercentage` as keyof typeof product];
          const newRepCost = calculateRepCost(
            parseFloat(dealerCost),
            currentMarkup ? parseFloat(currentMarkup.toString()) : null,
            settings,
            product.category || undefined,
          );

          const updateData: any = {
            [`${tier}DealerCost`]: dealerCost,
            [`${tier}RepCost`]: newRepCost.toFixed(2),
            updatedAt: new Date(),
          };

          const [updated] = await db
            .update(productModels)
            .set(updateData)
            .where(and(eq(productModels.id, productId), eq(productModels.tenant_id, tenantId)))
            .returning();

          results.push(updated);
        }

        res.json({
          message: `Updated ${results.length} products`,
          updated: results,
        });
      } catch (error) {
        console.error('Error bulk updating dealer costs:', error);
        res.status(500).json({ error: 'Failed to bulk update dealer costs' });
      }
    },
  );

  /**
   * Get margin analysis report for sales managers
   * Shows dealer cost, rep cost, customer price, and margins
   * Accessible to: Managers and above
   */
  app.get(
    '/api/pricing/margin-report',
    isAuthenticated,
    async (req: AuthRequest, res: Response) => {
      try {
        const tenantId = req.user?.tenant_id;
        const userRole = req.user?.role || 'standard';

        if (!tenantId) {
          return res.status(400).json({ error: 'Tenant ID required' });
        }

        // Only managers and above can see margin reports
        if (!canSeeDealerCost(userRole)) {
          return res.status(403).json({ error: 'Insufficient permissions to view margin report' });
        }

        const { quoteId, startDate, endDate, salesRepId } = req.query;

        let query = db
          .select({
            quote: enhancedQuotePricing,
            salesRep: {
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            },
          })
          .from(enhancedQuotePricing)
          .leftJoin(users, eq(enhancedQuotePricing.createdBy, users.id))
          .where(eq(enhancedQuotePricing.tenant_id, tenantId))
          .$dynamic();

        // Apply filters
        if (quoteId) {
          query = query.where(eq(enhancedQuotePricing.id, quoteId as string));
        }

        if (startDate) {
          query = query.where(sql`${enhancedQuotePricing.created_at} >= ${startDate}`);
        }

        if (endDate) {
          query = query.where(sql`${enhancedQuotePricing.created_at} <= ${endDate}`);
        }

        if (salesRepId) {
          query = query.where(eq(enhancedQuotePricing.createdBy, salesRepId as string));
        }

        const quotes = await query.orderBy(desc(enhancedQuotePricing.created_at)).limit(100);

        // Get line items for each quote
        const quoteIds = quotes.map((q) => q.quote.id);
        const lineItems =
          quoteIds.length > 0
            ? await db
                .select()
                .from(enhancedQuotePricingLineItems)
                .where(inArray(enhancedQuotePricingLineItems.quotePricingId, quoteIds))
            : [];

        // Group line items by quote
        const lineItemsByQuote: Record<string, typeof lineItems> = {};
        lineItems.forEach((item) => {
          if (!lineItemsByQuote[item.quotePricingId]) {
            lineItemsByQuote[item.quotePricingId] = [];
          }
          lineItemsByQuote[item.quotePricingId].push(item);
        });

        // Build margin report
        const report = quotes.map(({ quote, salesRep }) => ({
          quoteNumber: quote.quoteNumber,
          quoteDate: quote.created_at,
          quoteStatus: quote.status,
          salesRep: salesRep ? `${salesRep.firstName} ${salesRep.lastName}` : 'Unknown',
          salesRepEmail: salesRep?.email,

          // Financial summary
          totalDealerCost: parseFloat(quote.totalDealerCost?.toString() || '0'),
          totalRepCost: parseFloat(quote.totalRepCost?.toString() || '0'),
          totalCustomerPrice: parseFloat(quote.totalCustomerPrice?.toString() || '0'),
          totalMargin: parseFloat(quote.totalMarginAmount?.toString() || '0'),
          marginPercentage: parseFloat(quote.totalMarginPercentage?.toString() || '0'),
          totalRepMargin: parseFloat(quote.totalRepMarginAmount?.toString() || '0'),
          repMarginPercentage: parseFloat(quote.totalRepMarginPercentage?.toString() || '0'),

          // Line items with margin breakdown
          lineItems: (lineItemsByQuote[quote.id] || []).map((item) => ({
            productName: item.productName,
            productCode: item.productCode,
            quantity: item.quantity,
            unitDealerCost: parseFloat(item.unitDealerCost?.toString() || '0'),
            unitRepCost: parseFloat(item.unitRepCost?.toString() || '0'),
            unitCustomerPrice: parseFloat(item.unitCustomerPrice?.toString() || '0'),
            totalDealerCost: parseFloat(item.totalDealerCost?.toString() || '0'),
            totalRepCost: parseFloat(item.totalRepCost?.toString() || '0'),
            totalCustomerPrice: parseFloat(item.totalCustomerPrice?.toString() || '0'),
            lineMargin: parseFloat(item.lineMarginAmount?.toString() || '0'),
            lineMarginPercentage: parseFloat(item.lineMarginPercentage?.toString() || '0'),
            discountAmount: parseFloat(item.discountAmount?.toString() || '0'),
            discountPercentage: parseFloat(item.discountPercentage?.toString() || '0'),
          })),
        }));

        res.json({
          count: report.length,
          report,
        });
      } catch (error) {
        console.error('Error generating margin report:', error);
        res.status(500).json({ error: 'Failed to generate margin report' });
      }
    },
  );

  /**
   * Export margin report to CSV
   * Accessible to: Managers and above
   */
  app.get(
    '/api/pricing/margin-report/export',
    isAuthenticated,
    async (req: AuthRequest, res: Response) => {
      try {
        const tenantId = req.user?.tenant_id;
        const userRole = req.user?.role || 'standard';

        if (!tenantId) {
          return res.status(400).json({ error: 'Tenant ID required' });
        }

        if (!canSeeDealerCost(userRole)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // Get margin report data (reuse logic from above)
        const quotes = await db
          .select({
            quote: enhancedQuotePricing,
            salesRep: {
              firstName: users.firstName,
              lastName: users.lastName,
            },
          })
          .from(enhancedQuotePricing)
          .leftJoin(users, eq(enhancedQuotePricing.createdBy, users.id))
          .where(eq(enhancedQuotePricing.tenant_id, tenantId))
          .orderBy(desc(enhancedQuotePricing.created_at))
          .limit(1000);

        // Build CSV
        const headers = [
          'Quote Number',
          'Date',
          'Sales Rep',
          'Status',
          'Total Dealer Cost',
          'Total Rep Cost',
          'Total Customer Price',
          'Total Margin ($)',
          'Margin %',
          'Rep Margin ($)',
          'Rep Margin %',
        ];

        const rows = quotes.map(({ quote, salesRep }) => [
          quote.quoteNumber,
          quote.created_at?.toISOString().split('T')[0] || '',
          salesRep ? `${salesRep.firstName} ${salesRep.lastName}` : '',
          quote.status,
          quote.totalDealerCost || '0',
          quote.totalRepCost || '0',
          quote.totalCustomerPrice || '0',
          quote.totalMarginAmount || '0',
          quote.totalMarginPercentage || '0',
          quote.totalRepMarginAmount || '0',
          quote.totalRepMarginPercentage || '0',
        ]);

        const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="margin-report.csv"');
        res.send(csv);
      } catch (error) {
        console.error('Error exporting margin report:', error);
        res.status(500).json({ error: 'Failed to export margin report' });
      }
    },
  );

  /**
   * Submit price change for approval
   * Used when sales rep wants to discount below approval threshold
   */
  app.post(
    '/api/pricing/request-approval',
    isAuthenticated,
    async (req: AuthRequest, res: Response) => {
      try {
        const tenantId = req.user?.tenant_id;
        const userId = req.user?.id;

        if (!tenantId || !userId) {
          return res.status(400).json({ error: 'Tenant ID and User ID required' });
        }

        const {
          requestType, // "quote", "product_pricing", "line_item"
          referenceId, // ID of quote, product, or line item
          originalPrice,
          requestedPrice,
          requestReason,
        } = req.body;

        if (!requestType || !referenceId || !requestedPrice || !requestReason) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const discountAmount = (originalPrice || 0) - requestedPrice;
        const discountPercentage = originalPrice > 0 ? (discountAmount / originalPrice) * 100 : 0;

        const [approval] = await db
          .insert(priceChangeApprovals)
          .values({
            tenantId,
            requestType,
            referenceId,
            requestedBy: userId,
            requestReason,
            originalPrice: originalPrice?.toString(),
            requestedPrice: requestedPrice.toString(),
            discountAmount: discountAmount.toString(),
            discountPercentage: discountPercentage.toString(),
            status: 'pending',
          })
          .returning();

        res.status(201).json(approval);
      } catch (error) {
        console.error('Error creating price approval request:', error);
        res.status(500).json({ error: 'Failed to create approval request' });
      }
    },
  );

  /**
   * Approve or reject price change request
   * Accessible to: Managers and above
   */
  app.patch(
    '/api/pricing/approval/:id',
    isAuthenticated,
    async (req: AuthRequest, res: Response) => {
      try {
        const tenantId = req.user?.tenant_id;
        const userId = req.user?.id;
        const userRole = req.user?.role || 'standard';
        const approvalId = req.params.id;

        if (!tenantId || !userId) {
          return res.status(400).json({ error: 'Tenant ID and User ID required' });
        }

        // Only managers and above can approve
        if (!canSeeDealerCost(userRole)) {
          return res.status(403).json({ error: 'Insufficient permissions to approve pricing' });
        }

        const { status, approvalNotes, rejectionReason } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
          return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
        }

        const [updated] = await db
          .update(priceChangeApprovals)
          .set({
            status,
            approvedBy: userId,
            approvedDate: new Date(),
            approvalNotes: status === 'approved' ? approvalNotes : undefined,
            rejectionReason: status === 'rejected' ? rejectionReason : undefined,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(priceChangeApprovals.id, approvalId),
              eq(priceChangeApprovals.tenant_id, tenantId),
            ),
          )
          .returning();

        res.json(updated);
      } catch (error) {
        console.error('Error updating approval status:', error);
        res.status(500).json({ error: 'Failed to update approval status' });
      }
    },
  );

  /**
   * Get pending price approvals
   * Accessible to: Managers and above
   */
  app.get(
    '/api/pricing/approvals/pending',
    isAuthenticated,
    async (req: AuthRequest, res: Response) => {
      try {
        const tenantId = req.user?.tenant_id;
        const userRole = req.user?.role || 'standard';

        if (!tenantId) {
          return res.status(400).json({ error: 'Tenant ID required' });
        }

        if (!canSeeDealerCost(userRole)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const pending = await db
          .select({
            approval: priceChangeApprovals,
            requestedBy: {
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            },
          })
          .from(priceChangeApprovals)
          .leftJoin(users, eq(priceChangeApprovals.requestedBy, users.id))
          .where(
            and(
              eq(priceChangeApprovals.tenant_id, tenantId),
              eq(priceChangeApprovals.status, 'pending'),
            ),
          )
          .orderBy(desc(priceChangeApprovals.requestedDate));

        res.json(pending);
      } catch (error) {
        console.error('Error fetching pending approvals:', error);
        res.status(500).json({ error: 'Failed to fetch pending approvals' });
      }
    },
  );
}
