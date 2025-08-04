/**
 * Backend pagination support for performance optimization
 */

import { Request, Response } from 'express';
import { desc, asc, sql, count, and, or, like, ilike, eq } from 'drizzle-orm';
import { db } from './db';
import { businessRecords, serviceTickets, inventoryItems, invoices } from '../shared/schema';
import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';

interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
  [key: string]: any; // For filters
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function parsePaginationParams(query: PaginationQuery) {
  const page = Math.max(1, parseInt(query.page || '1'));
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit || DEFAULT_PAGE_SIZE.toString())));
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
          ilike(businessRecords.primaryContactEmail, `%${search}%`)
        )!
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
      .orderBy(sortDirection(businessRecords[sortBy as keyof typeof businessRecords] || businessRecords.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(createPaginatedResponse(records, totalCount, page, limit));
  } catch (error) {
    console.error('Error fetching paginated business records:', error);
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
          ilike(serviceTickets.issueDescription, `%${search}%`)
        )!
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
      .orderBy(sortDirection(serviceTickets[sortBy as keyof typeof serviceTickets] || serviceTickets.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(createPaginatedResponse(tickets, totalCount, page, limit));
  } catch (error) {
    console.error('Error fetching paginated service tickets:', error);
    res.status(500).json({ message: 'Failed to fetch service tickets' });
  }
}

// Paginated inventory endpoint
export async function getPaginatedInventory(req: TenantRequest, res: Response) {
  try {
    const tenantId = req.tenantId!;
    const { page, limit, offset, sortBy, sortDirection, search } = parsePaginationParams(req.query);

    const conditions = [eq(inventoryItems.tenantId, tenantId)];
    
    if (search) {
      conditions.push(
        or(
          ilike(inventoryItems.itemName, `%${search}%`),
          ilike(inventoryItems.sku, `%${search}%`),
          ilike(inventoryItems.description, `%${search}%`)
        )!
      );
    }

    if (req.query.category) {
      conditions.push(eq(inventoryItems.category, req.query.category as string));
    }
    if (req.query.lowStock === 'true') {
      conditions.push(sql`${inventoryItems.currentStock} <= ${inventoryItems.reorderPoint}`);
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
      .orderBy(sortDirection(inventoryItems[sortBy as keyof typeof inventoryItems] || inventoryItems.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(createPaginatedResponse(items, totalCount, page, limit));
  } catch (error) {
    console.error('Error fetching paginated inventory:', error);
    res.status(500).json({ message: 'Failed to fetch inventory' });
  }
}

// Paginated invoices endpoint
export async function getPaginatedInvoices(req: TenantRequest, res: Response) {
  try {
    const tenantId = req.tenantId!;
    const { page, limit, offset, sortBy, sortDirection, search } = parsePaginationParams(req.query);

    const conditions = [eq(invoices.tenantId, tenantId)];
    
    if (search) {
      conditions.push(
        or(
          ilike(invoices.invoiceNumber, `%${search}%`),
          ilike(invoices.description, `%${search}%`)
        )!
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
      .orderBy(sortDirection(invoices[sortBy as keyof typeof invoices] || invoices.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(createPaginatedResponse(invoiceList, totalCount, page, limit));
  } catch (error) {
    console.error('Error fetching paginated invoices:', error);
    res.status(500).json({ message: 'Failed to fetch invoices' });
  }
}