import { Router } from 'express';
import { db } from './db';
import {
  businessRecords,
  deals,
  businessRecordActivities,
  quotes,
  invoices,
  equipment,
  contracts,
} from '@shared/schema';
import { ilike, or, and, eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { createModuleLogger } from './lib/logger';
import { MemoryCacheService } from './cache-service';
const log = createModuleLogger('routes-universal-search');

const router = Router();

// CR-029: cache frequent identical searches for a short window. Universal search
// is read-only and re-issued on every keystroke-debounce; a small TTL collapses
// repeated (tenant, query, limit) lookups without letting results go meaningfully
// stale.
const searchCache = new MemoryCacheService();
const SEARCH_CACHE_TTL_SECONDS = 20;

interface TenantRequest extends Request {
  // COP-I05: this was `number`, but tenant ids are varchar everywhere — in the
  // schema, in getTenantId(), and in every other route file. The wrong type made
  // eq(<table>.tenantId, tenantId) fail to typecheck in every branch of this
  // search, and it also made TenantRequest incorrectly extend Request.
  tenantId?: string;
}

interface SearchResult {
  id: string;
  type: 'customer' | 'lead' | 'deal' | 'activity' | 'quote' | 'invoice' | 'equipment' | 'contract';
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
 * Searches across customers, leads, deals, activities, quotes, invoices, equipment.
 * Returns unified results sorted by relevance.
 *
 * CR-029: the six entity searches run in PARALLEL (Promise.all) instead of six
 * sequential awaits. Each is a self-contained async unit returning its own
 * SearchResult[]; the four optional-table searches keep their graceful
 * degradation (a missing table logs and yields no rows rather than failing the
 * whole search). Groups are concatenated in the same entity order before the
 * final relevance sort, so equal-relevance ordering is unchanged.
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

    const normalizedQuery = query.toLowerCase();
    const cacheKey = `universal-search:${tenantId}:${limit}:${normalizedQuery}`;
    const cached = await searchCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const searchTerm = `%${query}%`;

    const [
      businessRecordGroup,
      dealGroup,
      activityGroup,
      quoteGroup,
      invoiceGroup,
      equipmentGroup,
      contractGroup,
    ] = await Promise.all([
      // ---- Business records (customers and leads) ----
      (async (): Promise<SearchResult[]> => {
        const out: SearchResult[] = [];
        const rows = await db
          .select({
            id: businessRecords.id,
            companyName: businessRecords.companyName,
            // contactName/email/phone are not columns on business_records — the real
            // ones are the primaryContact* trio (billingContact* is the finance-specific
            // pair and is not what a global search should match on). Response keys are
            // unchanged so the search API contract is preserved.
            contactName: businessRecords.primaryContactName,
            email: businessRecords.primaryContactEmail,
            phone: businessRecords.primaryContactPhone,
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
                ilike(businessRecords.primaryContactName, searchTerm),
                ilike(businessRecords.primaryContactEmail, searchTerm),
                ilike(businessRecords.primaryContactPhone, searchTerm),
              ),
            ),
          )
          .limit(limit);

        for (const record of rows) {
          const isLead = record.recordType === 'lead';
          const title = record.companyName || record.contactName || 'Unnamed';
          const subtitle = [record.contactName, record.email, record.phone]
            .filter(Boolean)
            .join(' • ');

          let relevance = 10;
          if (record.companyName?.toLowerCase().includes(normalizedQuery)) {
            relevance += 5;
          }
          if (record.contactName?.toLowerCase().includes(normalizedQuery)) {
            relevance += 3;
          }

          out.push({
            id: `${isLead ? 'lead' : 'customer'}-${record.id}`,
            type: isLead ? 'lead' : 'customer',
            title,
            subtitle,
            path: record.urlSlug
              ? `/${isLead ? 'leads' : 'customers'}/${record.urlSlug}`
              : `/${isLead ? 'leads' : 'customers'}?id=${record.id}`,
            metadata: {
              status: record.status || undefined,
              value: record.estimatedValue
                ? `$${record.estimatedValue.toLocaleString()}`
                : undefined,
            },
            relevance,
          });
        }
        return out;
      })(),

      // ---- Deals ----
      (async (): Promise<SearchResult[]> => {
        const out: SearchResult[] = [];
        const rows = await db
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

        for (const deal of rows) {
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
          if (deal.name?.toLowerCase().includes(normalizedQuery)) {
            relevance += 5;
          }

          out.push({
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
        return out;
      })(),

      // ---- Activities (optional table — degrade gracefully) ----
      (async (): Promise<SearchResult[]> => {
        const out: SearchResult[] = [];
        try {
          const rows = await db
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

          for (const activity of rows) {
            const title = activity.title || `${activity.type || 'Activity'}`;
            const subtitle = [
              activity.companyName,
              activity.dueDate ? `Due: ${new Date(activity.dueDate).toLocaleDateString()}` : null,
            ]
              .filter(Boolean)
              .join(' • ');

            out.push({
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
        return out;
      })(),

      // ---- Quotes (optional table — degrade gracefully) ----
      (async (): Promise<SearchResult[]> => {
        const out: SearchResult[] = [];
        try {
          const rows = await db
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

          for (const quote of rows) {
            const title = `Quote ${quote.quoteNumber || quote.id}`;
            const subtitle = [
              quote.companyName,
              quote.validUntil
                ? `Valid until: ${new Date(quote.validUntil).toLocaleDateString()}`
                : null,
            ]
              .filter(Boolean)
              .join(' • ');

            out.push({
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
        return out;
      })(),

      // ---- Invoices (optional table — degrade gracefully) ----
      (async (): Promise<SearchResult[]> => {
        const out: SearchResult[] = [];
        try {
          const rows = await db
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

          for (const invoice of rows) {
            const title = `Invoice ${invoice.invoiceNumber || invoice.id}`;
            const subtitle = [
              invoice.companyName,
              invoice.invoiceDate
                ? `Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}`
                : null,
            ]
              .filter(Boolean)
              .join(' • ');

            out.push({
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
        return out;
      })(),

      // ---- Equipment (optional table — degrade gracefully) ----
      (async (): Promise<SearchResult[]> => {
        const out: SearchResult[] = [];
        try {
          const rows = await db
            .select({
              id: equipment.id,
              serialNumber: equipment.serialNumber,
              assetTag: equipment.assetTag,
              customerId: equipment.customerId,
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
                  // COP-I05: a copier rep searches by asset tag as often as serial.
                  ilike(equipment.assetTag, searchTerm),
                  ilike(equipment.modelNumber, searchTerm),
                  ilike(equipment.manufacturer, searchTerm),
                  ilike(equipment.description, searchTerm),
                  ilike(businessRecords.companyName, searchTerm),
                ),
              ),
            )
            .limit(limit);

          for (const equip of rows) {
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

            out.push({
              id: `equipment-${equip.id}`,
              type: 'equipment',
              title,
              subtitle,
              // COP-I05 AC2: a serial hit must resolve to the owning ACCOUNT, which
              // is what the rep actually wants — the equipment list filtered to one
              // machine is a dead end.
              path: equip.customerId
                ? `/customers/${equip.customerId}`
                : `/equipment?id=${equip.id}`,
              metadata: {
                status: equip.equipmentStatus || undefined,
              },
              // An exact serial or asset-tag match is the most specific thing a
              // rep can type — rank it above a fuzzy name match.
              relevance:
                equip.serialNumber?.toLowerCase() === normalizedQuery ||
                equip.assetTag?.toLowerCase() === normalizedQuery
                  ? 12
                  : 6,
            });
          }
        } catch (error) {
          log.warn('Could not search equipment:', error);
        }
        return out;
      })(),

      // ---- Contracts (COP-I05: reps search by contract number constantly) ----
      (async (): Promise<SearchResult[]> => {
        const out: SearchResult[] = [];
        try {
          const rows = await db
            .select({
              id: contracts.id,
              contractNumber: contracts.contractNumber,
              customerId: contracts.customerId,
              status: contracts.status,
              endDate: contracts.endDate,
              monthlyBase: contracts.monthlyBase,
              companyName: businessRecords.companyName,
            })
            .from(contracts)
            .leftJoin(businessRecords, eq(contracts.customerId, businessRecords.id))
            .where(
              and(
                eq(contracts.tenantId, tenantId),
                or(
                  ilike(contracts.contractNumber, searchTerm),
                  ilike(businessRecords.companyName, searchTerm),
                ),
              ),
            )
            .limit(limit);

          for (const contract of rows) {
            out.push({
              id: `contract-${contract.id}`,
              type: 'contract',
              title: contract.contractNumber ? `Contract ${contract.contractNumber}` : 'Contract',
              subtitle: [
                contract.companyName,
                contract.endDate ? `Ends ${new Date(contract.endDate).toLocaleDateString()}` : null,
              ]
                .filter(Boolean)
                .join(' • '),
              // Same rule as equipment: resolve to the owning account.
              path: contract.customerId
                ? `/customers/${contract.customerId}`
                : `/contracts?id=${contract.id}`,
              metadata: {
                status: contract.status || undefined,
                value: contract.monthlyBase ? String(contract.monthlyBase) : undefined,
                date: contract.endDate ? new Date(contract.endDate).toISOString() : undefined,
              },
              relevance: contract.contractNumber?.toLowerCase() === normalizedQuery ? 12 : 6,
            });
          }
        } catch (error) {
          // Optional table — degrade gracefully, same as the other four.
          log.warn('Could not search contracts:', error);
        }
        return out;
      })(),
    ]);

    // Concatenate in entity order (stable relevance tie-breaking), sort, limit.
    const results: SearchResult[] = [
      ...businessRecordGroup,
      ...dealGroup,
      ...activityGroup,
      ...quoteGroup,
      ...invoiceGroup,
      ...equipmentGroup,
      ...contractGroup,
    ];

    const sortedResults = results.sort((a, b) => b.relevance - a.relevance).slice(0, limit);

    await searchCache.set(cacheKey, sortedResults, SEARCH_CACHE_TTL_SECONDS);

    res.json(sortedResults);
  } catch (error) {
    log.error('Universal search error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
});

export default router;
