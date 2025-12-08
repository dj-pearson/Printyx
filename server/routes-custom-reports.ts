/**
 * Custom Reports API Routes
 *
 * Endpoints for creating, managing, and executing user-created custom reports.
 * Supports:
 * - Report creation with visual configuration
 * - Report preview with live data
 * - Report saving and management
 * - Report execution and export
 */

import type { Express, Request, Response } from "express";
import { eq, and, desc, sql, count, or, like, isNull, inArray } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./replitAuth";
import {
  resolveTenant,
  requireTenant,
  type TenantRequest,
} from "./middleware/tenancy";
import {
  enhanceUserContext,
  requirePermission,
  hasPermission,
  type AuthenticatedRequest,
} from "./middleware/enhanced-rbac-middleware";
import { HierarchicalQueryBuilder } from "./middleware/hierarchical-query-builder";
import {
  reportDefinitions,
  reportExecutions,
  dashboardLayouts,
  userReportPreferences,
} from "@shared/reporting-schema";
import { businessRecords, opportunities, equipment, contracts, invoices } from "@shared/schema";

// Table mappings for data sources
const DATA_SOURCE_TABLES: Record<string, any> = {
  business_records: businessRecords,
  opportunities: opportunities,
  equipment: equipment,
  contacts: contacts,
  invoices: invoices,
};

// Column mappings for each data source (matches frontend definitions)
const SOURCE_COLUMN_MAPPINGS: Record<string, Record<string, { dbColumn: string; type: string }>> = {
  business_records: {
    companyName: { dbColumn: "company_name", type: "string" },
    recordType: { dbColumn: "record_type", type: "string" },
    status: { dbColumn: "status", type: "string" },
    industry: { dbColumn: "industry", type: "string" },
    city: { dbColumn: "city", type: "string" },
    state: { dbColumn: "state", type: "string" },
    leadSource: { dbColumn: "lead_source", type: "string" },
    annualRevenue: { dbColumn: "annual_revenue", type: "currency" },
    employeeCount: { dbColumn: "employee_count", type: "number" },
    createdAt: { dbColumn: "created_at", type: "date" },
    updatedAt: { dbColumn: "updated_at", type: "date" },
  },
  opportunities: {
    name: { dbColumn: "name", type: "string" },
    stage: { dbColumn: "stage", type: "string" },
    amount: { dbColumn: "value", type: "currency" },
    probability: { dbColumn: "probability", type: "number" },
    expectedCloseDate: { dbColumn: "expected_close_date", type: "date" },
    createdAt: { dbColumn: "created_at", type: "date" },
    closedAt: { dbColumn: "closed_at", type: "date" },
    assignedTo: { dbColumn: "assigned_to", type: "string" },
    product: { dbColumn: "product", type: "string" },
    quantity: { dbColumn: "quantity", type: "number" },
  },
  equipment: {
    serialNumber: { dbColumn: "serial_number", type: "string" },
    model: { dbColumn: "model", type: "string" },
    manufacturer: { dbColumn: "manufacturer", type: "string" },
    status: { dbColumn: "status", type: "string" },
    location: { dbColumn: "location", type: "string" },
    installDate: { dbColumn: "install_date", type: "date" },
    lastServiceDate: { dbColumn: "last_service_date", type: "date" },
    meterReading: { dbColumn: "meter_reading", type: "number" },
    contractEndDate: { dbColumn: "contract_end_date", type: "date" },
  },
  contacts: {
    firstName: { dbColumn: "first_name", type: "string" },
    lastName: { dbColumn: "last_name", type: "string" },
    email: { dbColumn: "email", type: "string" },
    phone: { dbColumn: "phone", type: "string" },
    title: { dbColumn: "title", type: "string" },
    department: { dbColumn: "department", type: "string" },
    isPrimary: { dbColumn: "is_primary", type: "boolean" },
    createdAt: { dbColumn: "created_at", type: "date" },
  },
  invoices: {
    invoiceNumber: { dbColumn: "invoice_number", type: "string" },
    status: { dbColumn: "status", type: "string" },
    amount: { dbColumn: "total_amount", type: "currency" },
    balance: { dbColumn: "balance_due", type: "currency" },
    invoiceDate: { dbColumn: "invoice_date", type: "date" },
    dueDate: { dbColumn: "due_date", type: "date" },
    paidDate: { dbColumn: "paid_date", type: "date" },
    daysOverdue: { dbColumn: "days_overdue", type: "number" },
  },
};

type CustomReportRequest = AuthenticatedRequest & TenantRequest;

interface ReportColumn {
  id: string;
  columnId: string;
  columnName: string;
  aggregation?: string;
  alias?: string;
}

interface ReportFilter {
  id: string;
  columnId: string;
  columnName: string;
  operator: string;
  value: string;
  value2?: string;
  conjunction: "and" | "or";
}

interface ReportGrouping {
  id: string;
  columnId: string;
  columnName: string;
}

interface CustomReportConfig {
  name: string;
  description: string;
  category: string;
  dataSource: string;
  columns: ReportColumn[];
  filters: ReportFilter[];
  groupings: ReportGrouping[];
  visualization: string;
  chartConfig: {
    xAxis?: string;
    yAxis?: string;
    colorField?: string;
  };
  isPublic: boolean;
  cacheDuration: number;
}

export function registerCustomReportsRoutes(app: Express) {
  // Apply tenant resolution to all custom report routes
  app.use("/api/reports/custom", resolveTenant, requireTenant, enhanceUserContext);

  /**
   * Get list of user's custom reports
   */
  app.get("/api/reports/custom", isAuthenticated, async (req: CustomReportRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.id || req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get reports created by user or public reports
      const reports = await db
        .select({
          id: reportDefinitions.id,
          name: reportDefinitions.name,
          code: reportDefinitions.code,
          description: reportDefinitions.description,
          category: reportDefinitions.category,
          defaultVisualization: reportDefinitions.defaultVisualization,
          isActive: reportDefinitions.isActive,
          createdBy: reportDefinitions.createdBy,
          createdAt: reportDefinitions.createdAt,
          updatedAt: reportDefinitions.updatedAt,
        })
        .from(reportDefinitions)
        .where(
          and(
            eq(reportDefinitions.tenantId, tenantId),
            or(
              eq(reportDefinitions.createdBy, userId),
              sql`${reportDefinitions.requiredPermissions}::jsonb @> '["reports.custom.view_public"]'::jsonb`
            )
          )
        )
        .orderBy(desc(reportDefinitions.updatedAt));

      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching custom reports:", error);
      res.status(500).json({ message: "Failed to fetch custom reports" });
    }
  });

  /**
   * Preview custom report with live data
   */
  app.post("/api/reports/custom/preview", isAuthenticated, async (req: CustomReportRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const { dataSource, columns, filters, groupings, limit = 100 } = req.body;

      if (!dataSource || !columns || columns.length === 0) {
        return res.status(400).json({ message: "Data source and columns are required" });
      }

      const table = DATA_SOURCE_TABLES[dataSource];
      const columnMappings = SOURCE_COLUMN_MAPPINGS[dataSource];

      if (!table || !columnMappings) {
        return res.status(400).json({ message: `Unsupported data source: ${dataSource}` });
      }

      // Build the query dynamically
      const selectFields: Record<string, any> = {};
      const validColumns: ReportColumn[] = [];

      for (const col of columns) {
        const mapping = columnMappings[col.columnId];
        if (!mapping) continue;

        validColumns.push(col);
        const fieldName = col.alias || col.columnId;

        if (col.aggregation && groupings && groupings.length > 0) {
          switch (col.aggregation) {
            case "count":
              selectFields[fieldName] = sql`COUNT(${sql.raw(mapping.dbColumn)})`;
              break;
            case "sum":
              selectFields[fieldName] = sql`SUM(${sql.raw(mapping.dbColumn)})`;
              break;
            case "avg":
              selectFields[fieldName] = sql`AVG(${sql.raw(mapping.dbColumn)})`;
              break;
            case "min":
              selectFields[fieldName] = sql`MIN(${sql.raw(mapping.dbColumn)})`;
              break;
            case "max":
              selectFields[fieldName] = sql`MAX(${sql.raw(mapping.dbColumn)})`;
              break;
            default:
              selectFields[fieldName] = table[col.columnId];
          }
        } else {
          selectFields[fieldName] = table[col.columnId];
        }
      }

      // Build where conditions
      const conditions: any[] = [eq(table.tenantId, tenantId)];

      if (filters && filters.length > 0) {
        for (const filter of filters) {
          const mapping = columnMappings[filter.columnId];
          if (!mapping) continue;

          const column = table[filter.columnId];
          const condition = buildFilterCondition(column, filter, mapping.type);
          if (condition) {
            conditions.push(condition);
          }
        }
      }

      // Execute query with tenant filtering
      let query = db.select(selectFields).from(table).where(and(...conditions));

      // Add grouping if specified
      if (groupings && groupings.length > 0) {
        const groupByColumns = groupings
          .map((g: ReportGrouping) => {
            const mapping = columnMappings[g.columnId];
            return mapping ? table[g.columnId] : null;
          })
          .filter(Boolean);

        if (groupByColumns.length > 0) {
          query = query.groupBy(...groupByColumns);
        }
      }

      // Limit results
      query = query.limit(Math.min(limit, 1000));

      const data = await query;

      res.json({
        data,
        rowCount: data.length,
        columns: validColumns.map((c) => ({
          id: c.columnId,
          name: c.alias || c.columnName,
          type: columnMappings[c.columnId]?.type,
        })),
      });
    } catch (error: any) {
      console.error("Error executing preview:", error);
      res.status(500).json({ message: error.message || "Failed to execute preview" });
    }
  });

  /**
   * Create and save a custom report
   */
  app.post("/api/reports/custom", isAuthenticated, async (req: CustomReportRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.id || req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const config: CustomReportConfig = req.body;

      if (!config.name || !config.dataSource || !config.columns || config.columns.length === 0) {
        return res.status(400).json({ message: "Name, data source, and columns are required" });
      }

      // Generate unique code
      const code = `custom_${config.name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;

      // Build SQL query from configuration
      const sqlQuery = buildSQLQuery(config);

      // Determine permissions based on public flag
      const requiredPermissions = config.isPublic
        ? ["reports.custom.view_public"]
        : ["reports.custom.view_own"];

      // Create report definition
      const [newReport] = await db
        .insert(reportDefinitions)
        .values({
          tenantId,
          name: config.name,
          code,
          description: config.description || "",
          category: config.category as any || "custom",
          sqlQuery,
          defaultParameters: {
            dataSource: config.dataSource,
            columns: config.columns,
            filters: config.filters,
            groupings: config.groupings,
          },
          availableFilters: config.filters.reduce((acc, f) => {
            acc[f.columnId] = { type: "string", label: f.columnName };
            return acc;
          }, {} as Record<string, any>),
          availableGroupings: config.groupings.reduce((acc, g) => {
            acc[g.columnId] = g.columnName;
            return acc;
          }, {} as Record<string, any>),
          requiredPermissions,
          organizationalScope: "company",
          defaultVisualization: config.visualization as any || "table",
          chartConfig: config.chartConfig,
          cacheDuration: config.cacheDuration || 300,
          supportsExport: true,
          isActive: true,
          createdBy: userId,
        })
        .returning();

      res.status(201).json({
        id: newReport.id,
        code: newReport.code,
        name: newReport.name,
        message: "Custom report created successfully",
      });
    } catch (error: any) {
      console.error("Error creating custom report:", error);
      res.status(500).json({ message: error.message || "Failed to create custom report" });
    }
  });

  /**
   * Update a custom report
   */
  app.put("/api/reports/custom/:id", isAuthenticated, async (req: CustomReportRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.id || req.session?.userId;
      const reportId = req.params.id;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify ownership
      const [existing] = await db
        .select()
        .from(reportDefinitions)
        .where(
          and(
            eq(reportDefinitions.id, reportId),
            eq(reportDefinitions.tenantId, tenantId),
            eq(reportDefinitions.createdBy, userId)
          )
        );

      if (!existing) {
        return res.status(404).json({ message: "Report not found or access denied" });
      }

      const config: Partial<CustomReportConfig> = req.body;

      // Build updates
      const updates: any = { updatedAt: new Date() };

      if (config.name) updates.name = config.name;
      if (config.description !== undefined) updates.description = config.description;
      if (config.category) updates.category = config.category;
      if (config.visualization) updates.defaultVisualization = config.visualization;
      if (config.chartConfig) updates.chartConfig = config.chartConfig;
      if (config.cacheDuration !== undefined) updates.cacheDuration = config.cacheDuration;

      if (config.columns && config.dataSource) {
        updates.sqlQuery = buildSQLQuery(config as CustomReportConfig);
        updates.defaultParameters = {
          dataSource: config.dataSource,
          columns: config.columns,
          filters: config.filters || [],
          groupings: config.groupings || [],
        };
      }

      if (config.isPublic !== undefined) {
        updates.requiredPermissions = config.isPublic
          ? ["reports.custom.view_public"]
          : ["reports.custom.view_own"];
      }

      const [updatedReport] = await db
        .update(reportDefinitions)
        .set(updates)
        .where(eq(reportDefinitions.id, reportId))
        .returning();

      res.json({
        id: updatedReport.id,
        code: updatedReport.code,
        message: "Report updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating custom report:", error);
      res.status(500).json({ message: error.message || "Failed to update custom report" });
    }
  });

  /**
   * Delete a custom report
   */
  app.delete("/api/reports/custom/:id", isAuthenticated, async (req: CustomReportRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.id || req.session?.userId;
      const reportId = req.params.id;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify ownership
      const [deleted] = await db
        .delete(reportDefinitions)
        .where(
          and(
            eq(reportDefinitions.id, reportId),
            eq(reportDefinitions.tenantId, tenantId),
            eq(reportDefinitions.createdBy, userId)
          )
        )
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Report not found or access denied" });
      }

      res.json({ message: "Report deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting custom report:", error);
      res.status(500).json({ message: error.message || "Failed to delete custom report" });
    }
  });

  /**
   * Get a custom report by ID or code
   */
  app.get("/api/reports/custom/:identifier", isAuthenticated, async (req: CustomReportRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.id || req.session?.userId;
      const identifier = req.params.identifier;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const [report] = await db
        .select()
        .from(reportDefinitions)
        .where(
          and(
            eq(reportDefinitions.tenantId, tenantId),
            or(
              eq(reportDefinitions.id, identifier),
              eq(reportDefinitions.code, identifier)
            ),
            or(
              eq(reportDefinitions.createdBy, userId),
              sql`${reportDefinitions.requiredPermissions}::jsonb @> '["reports.custom.view_public"]'::jsonb`
            )
          )
        );

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json(report);
    } catch (error: any) {
      console.error("Error fetching custom report:", error);
      res.status(500).json({ message: "Failed to fetch custom report" });
    }
  });

  /**
   * Execute a custom report
   */
  app.post("/api/reports/custom/:identifier/execute", isAuthenticated, async (req: CustomReportRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.id || req.session?.userId;
      const identifier = req.params.identifier;
      const { filters: runtimeFilters, limit = 1000, offset = 0 } = req.body;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get report definition
      const [report] = await db
        .select()
        .from(reportDefinitions)
        .where(
          and(
            eq(reportDefinitions.tenantId, tenantId),
            or(
              eq(reportDefinitions.id, identifier),
              eq(reportDefinitions.code, identifier)
            )
          )
        );

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Track execution
      const startTime = Date.now();

      // Parse stored configuration
      const config = report.defaultParameters as any;
      const dataSource = config?.dataSource;
      const columns = config?.columns || [];
      const storedFilters = config?.filters || [];
      const groupings = config?.groupings || [];

      if (!dataSource) {
        return res.status(400).json({ message: "Report configuration is invalid" });
      }

      const table = DATA_SOURCE_TABLES[dataSource];
      const columnMappings = SOURCE_COLUMN_MAPPINGS[dataSource];

      if (!table || !columnMappings) {
        return res.status(400).json({ message: `Unsupported data source: ${dataSource}` });
      }

      // Build select fields
      const selectFields: Record<string, any> = {};
      for (const col of columns) {
        const mapping = columnMappings[col.columnId];
        if (!mapping) continue;

        const fieldName = col.alias || col.columnId;
        if (col.aggregation && groupings.length > 0) {
          switch (col.aggregation) {
            case "count":
              selectFields[fieldName] = sql`COUNT(${sql.raw(mapping.dbColumn)})`;
              break;
            case "sum":
              selectFields[fieldName] = sql`SUM(${sql.raw(mapping.dbColumn)})`;
              break;
            case "avg":
              selectFields[fieldName] = sql`AVG(${sql.raw(mapping.dbColumn)})`;
              break;
            case "min":
              selectFields[fieldName] = sql`MIN(${sql.raw(mapping.dbColumn)})`;
              break;
            case "max":
              selectFields[fieldName] = sql`MAX(${sql.raw(mapping.dbColumn)})`;
              break;
            default:
              selectFields[fieldName] = table[col.columnId];
          }
        } else {
          selectFields[fieldName] = table[col.columnId];
        }
      }

      // Build conditions
      const conditions: any[] = [eq(table.tenantId, tenantId)];

      // Apply stored filters
      for (const filter of storedFilters) {
        const mapping = columnMappings[filter.columnId];
        if (!mapping) continue;

        const column = table[filter.columnId];
        const condition = buildFilterCondition(column, filter, mapping.type);
        if (condition) {
          conditions.push(condition);
        }
      }

      // Apply runtime filters
      if (runtimeFilters) {
        for (const [key, value] of Object.entries(runtimeFilters)) {
          if (value !== undefined && value !== null && value !== "") {
            const column = table[key];
            if (column) {
              conditions.push(eq(column, value as any));
            }
          }
        }
      }

      // Execute query
      let query = db.select(selectFields).from(table).where(and(...conditions));

      // Add grouping
      if (groupings.length > 0) {
        const groupByColumns = groupings
          .map((g: any) => {
            const mapping = columnMappings[g.columnId];
            return mapping ? table[g.columnId] : null;
          })
          .filter(Boolean);

        if (groupByColumns.length > 0) {
          query = query.groupBy(...groupByColumns);
        }
      }

      // Pagination
      query = query.limit(Math.min(limit, report.maxRowLimit || 10000)).offset(offset);

      const data = await query;

      // Record execution
      const executionTime = Date.now() - startTime;
      await db.insert(reportExecutions).values({
        tenantId,
        reportDefinitionId: report.id,
        userId,
        parameters: runtimeFilters || {},
        filters: storedFilters,
        executionTimeMs: executionTime,
        rowCount: data.length,
        status: "success",
        startedAt: new Date(startTime),
        completedAt: new Date(),
      });

      res.json({
        data,
        meta: {
          rowCount: data.length,
          executionTimeMs: executionTime,
          reportName: report.name,
          visualization: report.defaultVisualization,
          chartConfig: report.chartConfig,
        },
      });
    } catch (error: any) {
      console.error("Error executing custom report:", error);
      res.status(500).json({ message: error.message || "Failed to execute report" });
    }
  });
}

// Helper function to build filter conditions
function buildFilterCondition(column: any, filter: ReportFilter, type: string): any {
  if (!column || !filter.operator) return null;

  switch (filter.operator) {
    case "equals":
      return eq(column, filter.value);
    case "not_equals":
      return sql`${column} != ${filter.value}`;
    case "contains":
      return like(column, `%${filter.value}%`);
    case "not_contains":
      return sql`${column} NOT LIKE ${`%${filter.value}%`}`;
    case "starts_with":
      return like(column, `${filter.value}%`);
    case "ends_with":
      return like(column, `%${filter.value}`);
    case "greater_than":
      return sql`${column} > ${filter.value}`;
    case "less_than":
      return sql`${column} < ${filter.value}`;
    case "greater_equal":
      return sql`${column} >= ${filter.value}`;
    case "less_equal":
      return sql`${column} <= ${filter.value}`;
    case "between":
      return sql`${column} BETWEEN ${filter.value} AND ${filter.value2}`;
    case "is_empty":
      return or(isNull(column), eq(column, ""));
    case "is_not_empty":
      return and(sql`${column} IS NOT NULL`, sql`${column} != ''`);
    case "is_true":
      return eq(column, true);
    case "is_false":
      return eq(column, false);
    case "before":
      return sql`${column} < ${filter.value}`;
    case "after":
      return sql`${column} > ${filter.value}`;
    case "this_week":
      return sql`${column} >= date_trunc('week', CURRENT_DATE) AND ${column} < date_trunc('week', CURRENT_DATE) + interval '7 days'`;
    case "this_month":
      return sql`${column} >= date_trunc('month', CURRENT_DATE) AND ${column} < date_trunc('month', CURRENT_DATE) + interval '1 month'`;
    case "this_quarter":
      return sql`${column} >= date_trunc('quarter', CURRENT_DATE) AND ${column} < date_trunc('quarter', CURRENT_DATE) + interval '3 months'`;
    case "this_year":
      return sql`${column} >= date_trunc('year', CURRENT_DATE) AND ${column} < date_trunc('year', CURRENT_DATE) + interval '1 year'`;
    case "last_n_days":
      return sql`${column} >= CURRENT_DATE - interval '${sql.raw(filter.value)} days'`;
    default:
      return null;
  }
}

// Helper function to build SQL query string for storage
function buildSQLQuery(config: CustomReportConfig): string {
  const columnMappings = SOURCE_COLUMN_MAPPINGS[config.dataSource];
  if (!columnMappings) return "";

  const selectParts: string[] = [];
  for (const col of config.columns) {
    const mapping = columnMappings[col.columnId];
    if (!mapping) continue;

    let fieldExpr = mapping.dbColumn;
    if (col.aggregation && config.groupings.length > 0) {
      fieldExpr = `${col.aggregation.toUpperCase()}(${mapping.dbColumn})`;
    }

    const alias = col.alias || col.columnId;
    selectParts.push(`${fieldExpr} AS "${alias}"`);
  }

  let query = `SELECT ${selectParts.join(", ")} FROM ${config.dataSource} WHERE tenant_id = :tenantId`;

  // Add filters
  if (config.filters.length > 0) {
    for (const filter of config.filters) {
      const mapping = columnMappings[filter.columnId];
      if (!mapping) continue;

      const conjunction = filter.conjunction === "or" ? " OR " : " AND ";
      query += `${conjunction}${mapping.dbColumn} ${getOperatorSQL(filter.operator)} :${filter.columnId}`;
    }
  }

  // Add grouping
  if (config.groupings.length > 0) {
    const groupParts = config.groupings
      .map((g) => columnMappings[g.columnId]?.dbColumn)
      .filter(Boolean);
    if (groupParts.length > 0) {
      query += ` GROUP BY ${groupParts.join(", ")}`;
    }
  }

  return query;
}

function getOperatorSQL(operator: string): string {
  const operatorMap: Record<string, string> = {
    equals: "=",
    not_equals: "!=",
    contains: "LIKE",
    not_contains: "NOT LIKE",
    starts_with: "LIKE",
    ends_with: "LIKE",
    greater_than: ">",
    less_than: "<",
    greater_equal: ">=",
    less_equal: "<=",
    between: "BETWEEN",
    is_empty: "IS NULL OR = ''",
    is_not_empty: "IS NOT NULL AND != ''",
    before: "<",
    after: ">",
  };
  return operatorMap[operator] || "=";
}
