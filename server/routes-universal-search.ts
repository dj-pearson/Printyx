import { Router } from 'express';
import { db } from './db';
import {
  businessRecords,
  deals,
  businessRecordActivities,
  quotes,
  invoices,
  equipment,
} from '@shared/schema';
import { ilike, or, and, eq, sql } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-universal-search');

const router = Router();

interface TenantRequest extends Request {
  tenantId?: number;
}

interface SearchResult {
  id: string;
  type: 'customer' | 'lead' | 'deal' | 'activity' | 'quote' | 'invoice' | 'equipment';
  title: string;
  subtitle?: string;
  path?: string;
  metadata?: {
    value?: string;
    status?: string;
    date?: string;
  };
  relevance: number;
}

/**
 * Universal search endpoint
 * Searches across customers, leads, deals, activities, and quotes
 * Returns unified results sorted by relevance
 */
router.get('/api/universal-search', async (req: TenantRequest, res: Response) => {
  try {
    const { tenantId } = req;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID required' });
    }

    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${query}%`;
    const results: SearchResult[] = [];

    // Search business records (customers and leads)
    const businessRecordsResults = await db
      .select({
        id: businessRecords.id,
        companyName: businessRecords.companyName,
        contactName: businessRecords.contactName,
        email: businessRecords.email,
        phone: businessRecords.phone,
        recordType: businessRecords.recordType,
        status: businessRecords.status,
        estimatedValue: businessRecords.estimatedValue,
        urlSlug: businessRecords.urlSlug,
      })
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.tenantId, tenantId),
          or(
            ilike(businessRecords.companyName, searchTerm),
            ilike(businessRecords.contactName, searchTerm),
            ilike(businessRecords.email, searchTerm),
            ilike(businessRecords.phone, searchTerm),
          ),
        ),
      )
      .limit(limit);

    for (const record of businessRecordsResults) {
      const isLead = record.recordType === 'lead';
      const title = record.companyName || record.contactName || 'Unnamed';
      const subtitle = [record.contactName, record.email, record.phone].filter(Boolean).join(' • ');

      // Calculate relevance score
      let relevance = 10;
      if (record.companyName?.toLowerCase().includes(query.toLowerCase())) {
        relevance += 5;
      }
      if (record.contactName?.toLowerCase().includes(query.toLowerCase())) {
        relevance += 3;
      }

      results.push({
        id: `${isLead ? 'lead' : 'customer'}-${record.id}`,
        type: isLead ? 'lead' : 'customer',
        title,
        subtitle,
        path: record.urlSlug
          ? `/${isLead ? 'leads' : 'customers'}/${record.urlSlug}`
          : `/${isLead ? 'leads' : 'customers'}?id=${record.id}`,
        metadata: {
          status: record.status || undefined,
          value: record.estimatedValue ? `$${record.estimatedValue.toLocaleString()}` : undefined,
        },
        relevance,
      });
    }

    // Search deals
    const dealsResults = await db
      .select({
        id: deals.id,
        name: deals.name,
        value: deals.value,
        stage: deals.stage,
        status: deals.status,
        expectedCloseDate: deals.expectedCloseDate,
        companyName: businessRecords.companyName,
      })
      .from(deals)
      .leftJoin(businessRecords, eq(deals.businessRecordId, businessRecords.id))
      .where(
        and(
          eq(deals.tenantId, tenantId),
          or(ilike(deals.name, searchTerm), ilike(businessRecords.companyName, searchTerm)),
        ),
      )
      .limit(limit);

    for (const deal of dealsResults) {
      const title = deal.name || 'Unnamed Deal';
      const subtitle = [
        deal.companyName,
        deal.stage,
        deal.expectedCloseDate
          ? `Close: ${new Date(deal.expectedCloseDate).toLocaleDateString()}`
          : null,
      ]
        .filter(Boolean)
        .join(' • ');

      let relevance = 8;
      if (deal.name?.toLowerCase().includes(query.toLowerCase())) {
        relevance += 5;
      }

      results.push({
        id: `deal-${deal.id}`,
        type: 'deal',
        title,
        subtitle,
        path: `/deals?id=${deal.id}`,
        metadata: {
          value: deal.value ? `$${deal.value.toLocaleString()}` : undefined,
          status: deal.stage || deal.status || undefined,
        },
        relevance,
      });
    }

    // Search activities
    try {
      const activitiesResults = await db
        .select({
          id: businessRecordActivities.id,
          title: businessRecordActivities.title,
          type: businessRecordActivities.type,
          status: businessRecordActivities.status,
          dueDate: businessRecordActivities.dueDate,
          companyName: businessRecords.companyName,
        })
        .from(businessRecordActivities)
        .leftJoin(
          businessRecords,
          eq(businessRecordActivities.businessRecordId, businessRecords.id),
        )
        .where(
          and(
            eq(businessRecordActivities.tenantId, tenantId),
            or(
              ilike(businessRecordActivities.title, searchTerm),
              ilike(businessRecordActivities.notes, searchTerm),
            ),
          ),
        )
        .limit(limit);

      for (const activity of activitiesResults) {
        const title = activity.title || `${activity.type || 'Activity'}`;
        const subtitle = [
          activity.companyName,
          activity.dueDate ? `Due: ${new Date(activity.dueDate).toLocaleDateString()}` : null,
        ]
          .filter(Boolean)
          .join(' • ');

        results.push({
          id: `activity-${activity.id}`,
          type: 'activity',
          title,
          subtitle,
          path: `/activities?id=${activity.id}`,
          metadata: {
            status: activity.status || undefined,
          },
          relevance: 6,
        });
      }
    } catch (error) {
      // Activities table might not exist in all setups, continue without it
      log.warn('Could not search activities:', error);
    }

    // Search quotes
    try {
      const quotesResults = await db
        .select({
          id: quotes.id,
          quoteNumber: quotes.quoteNumber,
          status: quotes.status,
          totalAmount: quotes.totalAmount,
          validUntil: quotes.validUntil,
          companyName: businessRecords.companyName,
        })
        .from(quotes)
        .leftJoin(businessRecords, eq(quotes.businessRecordId, businessRecords.id))
        .where(
          and(
            eq(quotes.tenantId, tenantId),
            or(
              ilike(quotes.quoteNumber, searchTerm),
              ilike(businessRecords.companyName, searchTerm),
            ),
          ),
        )
        .limit(limit);

      for (const quote of quotesResults) {
        const title = `Quote ${quote.quoteNumber || quote.id}`;
        const subtitle = [
          quote.companyName,
          quote.validUntil
            ? `Valid until: ${new Date(quote.validUntil).toLocaleDateString()}`
            : null,
        ]
          .filter(Boolean)
          .join(' • ');

        results.push({
          id: `quote-${quote.id}`,
          type: 'quote',
          title,
          subtitle,
          path: `/quotes?id=${quote.id}`,
          metadata: {
            value: quote.totalAmount ? `$${quote.totalAmount.toLocaleString()}` : undefined,
            status: quote.status || undefined,
          },
          relevance: 7,
        });
      }
    } catch (error) {
      // Quotes table might not exist in all setups, continue without it
      log.warn('Could not search quotes:', error);
    }

    // Search invoices
    try {
      const invoiceResults = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          invoiceDate: invoices.invoiceDate,
          totalAmount: invoices.totalAmount,
          balanceDue: invoices.balanceDue,
          invoiceType: invoices.invoiceType,
          companyName: businessRecords.companyName,
        })
        .from(invoices)
        .leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id))
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            or(
              ilike(invoices.invoiceNumber, searchTerm),
              ilike(businessRecords.companyName, searchTerm),
              ilike(invoices.poNumber, searchTerm),
            ),
          ),
        )
        .limit(limit);

      for (const invoice of invoiceResults) {
        const title = `Invoice ${invoice.invoiceNumber || invoice.id}`;
        const subtitle = [
          invoice.companyName,
          invoice.invoiceDate
            ? `Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}`
            : null,
        ]
          .filter(Boolean)
          .join(' • ');

        results.push({
          id: `invoice-${invoice.id}`,
          type: 'invoice',
          title,
          subtitle,
          path: `/invoices?id=${invoice.id}`,
          metadata: {
            value: invoice.totalAmount
              ? `$${Number(invoice.totalAmount).toLocaleString()}`
              : undefined,
            status: invoice.invoiceType || undefined,
          },
          relevance: 7,
        });
      }
    } catch (error) {
      log.warn('Could not search invoices:', error);
    }

    // Search equipment
    try {
      const equipmentResults = await db
        .select({
          id: equipment.id,
          serialNumber: equipment.serialNumber,
          modelNumber: equipment.modelNumber,
          manufacturer: equipment.manufacturer,
          description: equipment.description,
          equipmentStatus: equipment.equipmentStatus,
          companyName: businessRecords.companyName,
        })
        .from(equipment)
        .leftJoin(businessRecords, eq(equipment.customerId, businessRecords.id))
        .where(
          and(
            eq(equipment.tenantId, tenantId),
            or(
              ilike(equipment.serialNumber, searchTerm),
              ilike(equipment.modelNumber, searchTerm),
              ilike(equipment.manufacturer, searchTerm),
              ilike(equipment.description, searchTerm),
              ilike(businessRecords.companyName, searchTerm),
            ),
          ),
        )
        .limit(limit);

      for (const equip of equipmentResults) {
        const title =
          [equip.manufacturer, equip.modelNumber].filter(Boolean).join(' ') ||
          equip.serialNumber ||
          'Unknown Equipment';
        const subtitle = [
          equip.companyName,
          equip.serialNumber ? `S/N: ${equip.serialNumber}` : null,
        ]
          .filter(Boolean)
          .join(' • ');

        results.push({
          id: `equipment-${equip.id}`,
          type: 'equipment',
          title,
          subtitle,
          path: `/equipment?id=${equip.id}`,
          metadata: {
            status: equip.equipmentStatus || undefined,
          },
          relevance: 6,
        });
      }
    } catch (error) {
      log.warn('Could not search equipment:', error);
    }

    // Sort by relevance and limit
    const sortedResults = results.sort((a, b) => b.relevance - a.relevance).slice(0, limit);

    res.json(sortedResults);
  } catch (error) {
    log.error('Universal search error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
});

export default router;
