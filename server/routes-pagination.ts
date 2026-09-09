/**
 * Backend pagination support for performance optimization
 */

import { Request, Response } from 'express';
import { desc, asc, sql, count, and, or, like, ilike, eq, getTableColumns } from 'drizzle-orm';
import { db } from './db';
import { businessRecords, serviceTickets, inventoryItems, invoices } from '../shared/schema';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-pagination');

interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
  [key: string]: any; // For filters
}

/**
 * Resolve ?sortBy= to a real column, or fall back.
 *
 * Every handler below used to write `table[sortBy as keyof typeof table] || table.createdAt`,
 * indexing a Drizzle table object with a raw query-string value. An unknown key
 * falls back correctly, but a key that exists on the table OBJECT rather than as a
 * column does not: `?sortBy=enableRLS` and `?sortBy=constructor` both resolve to a
 * FUNCTION, which is truthy, so the `||` never fires and drizzle binds it as a bind
 * parameter - the statement comes out as `order by $1 asc`, which Postgres rejects.
 * That is a 500 on four list endpoints from a query string.
 *
 * getTableColumns returns only the declared columns, so a name that is not one of
 * them cannot get through however the caller spells it.
 */
function resolveSortColumn(table: PgTable, sortBy: string | undefined, fallback: PgColumn) {
  if (!sortBy) return fallback;
  const columns = getTableColumns(table) as Record<string, PgColumn | undefined>;
  // hasOwn, not a plain lookup: the columns object inherits from Object.prototype, so
  // `columns['constructor']` and `columns['toString']` are truthy and would sail
  // straight past a `?? fallback`. That is the same shape as the bug being fixed.
  if (!Object.prototype.hasOwnProperty.call(columns, sortBy)) return fallback;
  return columns[sortBy] ?? fallback;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function parsePaginationParams(query: PaginationQuery) {
  const page = Math.max(1, parseInt(query.page || '1'));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(query.limit || DEFAULT_PAGE_SIZE.toString())),
  );
  const offset = (page - 1) * limit;
  const sortBy = query.sortBy || 'createdAt';
  const sortDirection = query.sortDirection === 'asc' ? asc : desc;

  return { page, limit, offset, sortBy, sortDirection, search: query.search };
}

function createPaginatedResponse<T>(data: T[], totalCount: number, page: number, limit: number) {
  const totalPages = Math.ceil(totalCount / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      totalItems: totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

// Paginated business records endpoint
export async function getPaginatedBusinessRecords(req: TenantRequest, res: Response) {
  try {
    const tenantId = req.tenantId!;
    const { page, limit, offset, sortBy, sortDirection, search } = parsePaginationParams(req.query);

    // Build where conditions
    const conditions = [eq(businessRecords.tenantId, tenantId)];

    if (search) {
      conditions.push(
        or(
          ilike(businessRecords.companyName, `%${search}%`),
          ilike(businessRecords.primaryContactName, `%${search}%`),
          ilike(businessRecords.primaryContactEmail, `%${search}%`),
        )!,
      );
    }

    // Add filters
    if (req.query.recordType) {
      conditions.push(eq(businessRecords.recordType, req.query.recordType as string));
    }
    if (req.query.status) {
      conditions.push(eq(businessRecords.status, req.query.status as string));
    }
    if (req.query.salesStage) {
      conditions.push(eq(businessRecords.salesStage, req.query.salesStage as string));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(businessRecords)
      .where(whereClause);

    // Get paginated data
    const records = await db
      .select()
      .from(businessRecords)
      .where(whereClause)
      .orderBy(
        sortDirection(resolveSortColumn(businessRecords, sortBy, businessRecords.createdAt) as any),
      )
      .limit(limit)
      .offset(offset);

    res.json(createPaginatedResponse(records, totalCount, page, limit));
  } catch (error) {
    log.error('Error fetching paginated business records:', error);
    res.status(500).json({ message: 'Failed to fetch business records' });
  }
}

// Paginated service tickets endpoint
export async function getPaginatedServiceTickets(req: TenantRequest, res: Response) {
  try {
    const tenantId = req.tenantId!;
    const { page, limit, offset, sortBy, sortDirection, search } = parsePaginationParams(req.query);

    const conditions = [eq(serviceTickets.tenantId, tenantId)];

    if (search) {
      conditions.push(
        or(
          ilike(serviceTickets.ticketNumber, `%${search}%`),
          ilike(serviceTickets.description, `%${search}%`),
        )!,
      );
    }

    if (req.query.status) {
      conditions.push(eq(serviceTickets.status, req.query.status as string));
    }
    if (req.query.priority) {
      conditions.push(eq(serviceTickets.priority, req.query.priority as string));
    }

    const whereClause = and(...conditions);

    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(serviceTickets)
      .where(whereClause);

    const tickets = await db
      .select()
      .from(serviceTickets)
      .where(whereClause)
      .orderBy(
        sortDirection(resolveSortColumn(serviceTickets, sortBy, serviceTickets.createdAt) as any),
      )
      .limit(limit)
      .offset(offset);

    res.json(createPaginatedResponse(tickets, totalCount, page, limit));
  } catch (error) {
    log.error('Error fetching paginated service tickets:', error);
    res.status(500).json({ message: 'Failed to fetch service tickets' });
  }
}

// Paginated inventory endpoint
export async function getPaginatedInventory(req: TenantRequest, res: Response) {
  try {
    const tenantId = req.tenantId!;
    const { page, limit, offset, sortBy, sortDirection, search } = parsePaginationParams(req.query);

    const conditions = [eq(inventoryItems.tenantId, tenantId)];

    // itemName, sku, description and currentStock are not columns on inventory_items.
    // ilike(undefined, ...) throws, so ?search= and ?lowStock=true were each a 500 on
    // this endpoint; tsc had been reporting all four as TS2339 the whole time. The real
    // names are name / part_number / item_description / quantity_on_hand.
    if (search) {
      conditions.push(
        or(
          ilike(inventoryItems.name, `%${search}%`),
          ilike(inventoryItems.partNumber, `%${search}%`),
          ilike(inventoryItems.itemDescription, `%${search}%`),
        )!,
      );
    }

    if (req.query.category) {
      conditions.push(eq(inventoryItems.category, req.query.category as string));
    }
    if (req.query.lowStock === 'true') {
      conditions.push(sql`${inventoryItems.quantityOnHand} <= ${inventoryItems.reorderPoint}`);
    }

    const whereClause = and(...conditions);

    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(inventoryItems)
      .where(whereClause);

    const items = await db
      .select()
      .from(inventoryItems)
      .where(whereClause)
      .orderBy(
        sortDirection(resolveSortColumn(inventoryItems, sortBy, inventoryItems.createdAt) as any),
      )
      .limit(limit)
      .offset(offset);

    res.json(createPaginatedResponse(items, totalCount, page, limit));
  } catch (error) {
    log.error('Error fetching paginated inventory:', error);
    res.status(500).json({ message: 'Failed to fetch inventory' });
  }
}

// Paginated invoices endpoint
export async function getPaginatedInvoices(req: TenantRequest, res: Response) {
  try {
    const tenantId = req.tenantId!;
    const { page, limit, offset, sortBy, sortDirection, search } = parsePaginationParams(req.query);

    const conditions = [eq(invoices.tenantId, tenantId)];

    // invoices has no `description`; the free-text column is invoice_notes.
    if (search) {
      conditions.push(
        or(
          ilike(invoices.invoiceNumber, `%${search}%`),
          ilike(invoices.invoiceNotes, `%${search}%`),
        )!,
      );
    }

    if (req.query.status) {
      conditions.push(eq(invoices.status, req.query.status as string));
    }
    if (req.query.customerId) {
      conditions.push(eq(invoices.customerId, req.query.customerId as string));
    }

    const whereClause = and(...conditions);

    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(invoices)
      .where(whereClause);

    const invoiceList = await db
      .select()
      .from(invoices)
      .where(whereClause)
      .orderBy(sortDirection(resolveSortColumn(invoices, sortBy, invoices.createdAt) as any))
      .limit(limit)
      .offset(offset);

    res.json(createPaginatedResponse(invoiceList, totalCount, page, limit));
  } catch (error) {
    log.error('Error fetching paginated invoices:', error);
    res.status(500).json({ message: 'Failed to fetch invoices' });
  }
}
