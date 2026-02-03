/**
 * Database RLS (Row-Level Security) Audit Script
 *
 * Audits database schema for tenant isolation and verifies queries properly filter by tenantId.
 * Run with: npm run audit:rls
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { generateReport, createIssue } from './lib/report-generator';
import type { TableAuditResult, AuditReport, AuditIssue } from './lib/types';

// Load environment variables
config();

// ============================================================================
// Configuration
// ============================================================================

const SHARED_DIR = path.join(process.cwd(), 'shared');
const SERVER_DIR = path.join(process.cwd(), 'server');

// Tables that are intentionally global (no tenant isolation needed)
// These include:
// - Auth/user tables: users, sessions, password resets, etc.
// - Platform-level configuration: settings, subscription plans, roles
// - Reference data: master products, OID presets
// - Knowledge base: articles shared across platform
const GLOBAL_TABLES = new Set([
  // Auth & User Management
  'users',
  'sessions',
  'tenants',
  'passwordResets',
  'password_resets',
  'emailVerifications',
  'email_verifications',
  'loginAttempts',
  'login_attempts',

  // Platform Configuration
  'platformSettings',
  'platform_settings',
  'systemMetrics',
  'system_metrics',
  'auditLogs',
  'audit_logs',
  'notifications',

  // Subscription & Billing (platform-wide plans)
  'subscriptionPlans',
  'subscription_plans',
  'subscriptionFeatures',
  'subscription_features',

  // RBAC (platform-wide roles and permissions)
  'roles',
  'permissions',
  'rolePermissions',
  'role_permissions',

  // Knowledge Base (shared across platform)
  'knowledgeBaseArticles',
  'knowledge_base_articles',

  // Platform CRM (platform-level lead rules)
  'platformLeadScoringRules',
  'platform_lead_scoring_rules',
  'platformLeadAssignmentRules',
  'platform_lead_assignment_rules',
  'platformRepCapacity',
  'platform_rep_capacity',

  // Master/Reference Data (shared product catalogs)
  'masterProductAccessories',
  'master_product_accessories',
  'masterProducts',
  'master_products',
  'oidPresets',
  'oid_presets',

  // Incident Resolution Patterns (platform knowledge base)
  'incidentResolutionPatterns',
  'incident_resolution_patterns',

  // Tenant Onboarding (platform-level operations)
  'tenantOnboardingTemplates',
  'tenant_onboarding_templates',
  'onboardingAnalytics',
  'onboarding_analytics',
  'tenantCloneOperations',
  'tenant_clone_operations',
]);

// System tables that don't need RLS
const SYSTEM_TABLES = new Set(['migrations', 'schema_migrations', 'drizzle_migrations']);

// ============================================================================
// Schema Parser
// ============================================================================

interface TableDefinition {
  name: string;
  exportName: string;
  sourceFile: string;
  lineNumber: number;
  columns: string[];
  hasTenantId: boolean;
  hasCreatedAt: boolean;
  hasUpdatedAt: boolean;
  foreignKeys: string[];
}

function discoverSchemas(): string[] {
  const schemaFiles: string[] = [];

  const files = fs.readdirSync(SHARED_DIR);
  for (const file of files) {
    if (file.endsWith('.ts') && (file.includes('schema') || file === 'schema.ts')) {
      schemaFiles.push(path.join(SHARED_DIR, file));
    }
  }

  return schemaFiles;
}

function parseSchemaFile(filePath: string): TableDefinition[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const tables: TableDefinition[] = [];

  // Regex to match table definitions
  const tableRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*['"`]([^'"`]+)['"`]/;

  let currentTable: TableDefinition | null = null;
  let braceCount = 0;
  let inTableDef = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = tableRegex.exec(line);

    if (match) {
      // Start of a new table definition
      currentTable = {
        name: match[2], // SQL table name
        exportName: match[1], // TypeScript export name
        sourceFile: filePath,
        lineNumber: i + 1,
        columns: [],
        hasTenantId: false,
        hasCreatedAt: false,
        hasUpdatedAt: false,
        foreignKeys: [],
      };
      inTableDef = true;
      braceCount = 0;
    }

    if (inTableDef && currentTable) {
      // Count braces to determine when table definition ends
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // Check for column definitions
      const columnMatch = line.match(/^\s*(\w+):\s*(\w+)\(/);
      if (columnMatch) {
        currentTable.columns.push(columnMatch[1]);

        if (columnMatch[1] === 'tenantId' || columnMatch[1] === 'tenant_id') {
          currentTable.hasTenantId = true;
        }
        if (columnMatch[1] === 'createdAt' || columnMatch[1] === 'created_at') {
          currentTable.hasCreatedAt = true;
        }
        if (columnMatch[1] === 'updatedAt' || columnMatch[1] === 'updated_at') {
          currentTable.hasUpdatedAt = true;
        }
      }

      // Check for references (foreign keys)
      const refMatch = line.match(/references\(\s*\(\s*\)\s*=>\s*(\w+)/);
      if (refMatch) {
        currentTable.foreignKeys.push(refMatch[1]);
      }

      // End of table definition
      if (braceCount === 0 && line.includes(')')) {
        tables.push(currentTable);
        currentTable = null;
        inTableDef = false;
      }
    }
  }

  return tables;
}

// ============================================================================
// Query Analyzer
// ============================================================================

interface QueryUsage {
  sourceFile: string;
  lineNumber: number;
  tableName: string;
  queryType:
    | 'select'
    | 'insert'
    | 'update'
    | 'delete'
    | 'findMany'
    | 'findFirst'
    | 'findUnique'
    | 'unknown';
  hasTenantFilter: boolean;
  codeSnippet: string;
}

function analyzeRouteFiles(): QueryUsage[] {
  const queryUsages: QueryUsage[] = [];

  function scanDirectory(dir: string) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          scanDirectory(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        const usages = analyzeFile(fullPath);
        queryUsages.push(...usages);
      }
    }
  }

  scanDirectory(SERVER_DIR);
  return queryUsages;
}

function analyzeFile(filePath: string): QueryUsage[] {
  const usages: QueryUsage[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Patterns to detect database queries
  const queryPatterns = [
    // Drizzle ORM patterns
    { regex: /db\.query\.(\w+)\.findMany\s*\(/g, type: 'findMany' as const },
    { regex: /db\.query\.(\w+)\.findFirst\s*\(/g, type: 'findFirst' as const },
    { regex: /db\.select\(\)\.from\((\w+)\)/g, type: 'select' as const },
    { regex: /db\.insert\((\w+)\)/g, type: 'insert' as const },
    { regex: /db\.update\((\w+)\)/g, type: 'update' as const },
    { regex: /db\.delete\((\w+)\)/g, type: 'delete' as const },
    // Direct query patterns
    { regex: /await\s+db\s*\.\s*query\s*\.\s*(\w+)/g, type: 'unknown' as const },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { regex, type } of queryPatterns) {
      regex.lastIndex = 0;
      let match;

      while ((match = regex.exec(line)) !== null) {
        const tableName = match[1];

        // Get surrounding context (5 lines before and after) to check for tenant filtering
        const startLine = Math.max(0, i - 5);
        const endLine = Math.min(lines.length - 1, i + 5);
        const context = lines.slice(startLine, endLine + 1).join('\n');

        // Check if tenant filtering is present
        const hasTenantFilter =
          context.includes('tenantId') ||
          context.includes('tenant_id') ||
          (context.includes('eq(') &&
            (context.includes('.tenantId') || context.includes("'tenantId'")));

        usages.push({
          sourceFile: filePath,
          lineNumber: i + 1,
          tableName,
          queryType: type,
          hasTenantFilter,
          codeSnippet: line.trim().substring(0, 100),
        });
      }
    }
  }

  return usages;
}

// ============================================================================
// Audit Logic
// ============================================================================

function auditTable(
  table: TableDefinition,
  queryUsages: QueryUsage[],
  verbose: boolean,
): TableAuditResult {
  const issues: AuditIssue[] = [];

  const tableSqlName = table.name;
  const tableExportName = table.exportName;

  // Check if this is a global or system table
  const isGlobal = GLOBAL_TABLES.has(tableSqlName) || GLOBAL_TABLES.has(tableExportName);
  const isSystem = SYSTEM_TABLES.has(tableSqlName) || SYSTEM_TABLES.has(tableExportName);

  // Skip system tables
  if (isSystem) {
    return {
      tableName: tableSqlName,
      hasTenantId: table.hasTenantId,
      rlsEnforced: true, // N/A for system tables
      issues: [],
    };
  }

  // Check for tenantId column
  if (!table.hasTenantId && !isGlobal) {
    issues.push(
      createIssue(
        'database',
        'critical',
        `Table "${tableSqlName}" is missing tenantId column for tenant isolation`,
        tableSqlName,
        {
          sourceFile: table.sourceFile,
          lineNumber: table.lineNumber,
          suggestedFix: `Add "tenantId: text('tenant_id').notNull().references(() => tenants.id)" to the table schema`,
        },
      ),
    );
  }

  // Find queries that use this table
  const tableQueries = queryUsages.filter(
    (q) =>
      q.tableName === tableExportName ||
      q.tableName === tableSqlName ||
      q.tableName.toLowerCase() === tableSqlName.toLowerCase().replace(/_/g, ''),
  );

  // Check each query for tenant filtering
  for (const query of tableQueries) {
    if (!query.hasTenantFilter && !isGlobal && table.hasTenantId) {
      // Read queries without tenant filter are more critical than writes
      const severity =
        query.queryType === 'findMany' || query.queryType === 'select'
          ? 'critical'
          : query.queryType === 'findFirst' || query.queryType === 'findUnique'
            ? 'high'
            : 'medium';

      issues.push(
        createIssue(
          'tenant',
          severity,
          `Query on "${tableSqlName}" may be missing tenantId filter`,
          tableSqlName,
          {
            sourceFile: query.sourceFile,
            lineNumber: query.lineNumber,
            suggestedFix: `Add "where: eq(${tableExportName}.tenantId, tenantId)" to ensure tenant isolation`,
          },
        ),
      );
    }
  }

  // Check for missing audit columns
  if (!table.hasCreatedAt && !isSystem) {
    issues.push(
      createIssue(
        'database',
        'low',
        `Table "${tableSqlName}" is missing createdAt column`,
        tableSqlName,
        {
          sourceFile: table.sourceFile,
          suggestedFix: 'Add "createdAt: timestamp(\'created_at\').defaultNow()" for audit trail',
        },
      ),
    );
  }

  return {
    tableName: tableSqlName,
    hasTenantId: table.hasTenantId,
    rlsEnforced: issues.filter((i) => i.severity === 'critical').length === 0,
    issues,
  };
}

// ============================================================================
// Main Audit Logic
// ============================================================================

async function runAudit(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              DATABASE RLS AUDIT                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  // Step 1: Discover schema files
  console.log('📂 Discovering schema files...\n');
  const schemaFiles = discoverSchemas();
  console.log(`   Found ${schemaFiles.length} schema files\n`);

  // Step 2: Parse all tables
  console.log('📊 Parsing table definitions...\n');
  const allTables: TableDefinition[] = [];

  for (const schemaFile of schemaFiles) {
    const tables = parseSchemaFile(schemaFile);
    allTables.push(...tables);
    if (verbose) {
      console.log(`   ${path.basename(schemaFile)}: ${tables.length} tables`);
    }
  }

  console.log(`   Total tables discovered: ${allTables.length}\n`);

  // Step 3: Analyze route files for queries
  console.log('🔍 Analyzing database queries in route files...\n');
  const queryUsages = analyzeRouteFiles();
  console.log(`   Found ${queryUsages.length} database queries\n`);

  // Step 4: Audit each table
  console.log('🔒 Auditing tables for RLS compliance...\n');
  const results: TableAuditResult[] = [];
  const allIssues: AuditIssue[] = [];

  let tablesWithTenantId = 0;
  let tablesWithoutTenantId = 0;
  let globalTables = 0;

  for (const table of allTables) {
    const isGlobal = GLOBAL_TABLES.has(table.name) || GLOBAL_TABLES.has(table.exportName);
    const isSystem = SYSTEM_TABLES.has(table.name) || SYSTEM_TABLES.has(table.exportName);

    if (isSystem) continue;

    if (isGlobal) {
      globalTables++;
    } else if (table.hasTenantId) {
      tablesWithTenantId++;
    } else {
      tablesWithoutTenantId++;
    }

    const result = auditTable(table, queryUsages, verbose);
    results.push(result);
    allIssues.push(...result.issues);

    if (verbose && result.issues.length > 0) {
      console.log(`   ${table.name}: ${result.issues.length} issues`);
    }
  }

  // Step 5: Generate report
  const duration = Date.now() - startTime;

  const criticalIssues = allIssues.filter((i) => i.severity === 'critical');
  const highIssues = allIssues.filter((i) => i.severity === 'high');

  const report: AuditReport = {
    type: 'database-rls',
    timestamp: new Date(),
    duration,
    summary: {
      total: allTables.length,
      passed: results.filter((r) => r.issues.length === 0).length,
      failed: results.filter((r) => r.issues.some((i) => i.severity === 'critical')).length,
      warnings: results.filter(
        (r) =>
          r.issues.some((i) => i.severity === 'medium' || i.severity === 'high') &&
          !r.issues.some((i) => i.severity === 'critical'),
      ).length,
      skipped: SYSTEM_TABLES.size,
    },
    issues: allIssues,
    data: {
      tables: results,
      stats: {
        totalTables: allTables.length,
        tablesWithTenantId,
        tablesWithoutTenantId,
        globalTables,
        totalQueries: queryUsages.length,
        queriesWithTenantFilter: queryUsages.filter((q) => q.hasTenantFilter).length,
        queriesWithoutTenantFilter: queryUsages.filter((q) => !q.hasTenantFilter).length,
      },
    },
  };

  const { jsonPath, mdPath } = generateReport(report);

  // Step 6: Print summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT COMPLETE                          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Tables:        ${String(allTables.length).padStart(35)} ║`);
  console.log(`║  With Tenant ID:      ${String(tablesWithTenantId).padStart(35)} ║`);
  console.log(`║  Without Tenant ID:   ${String(tablesWithoutTenantId).padStart(35)} ║`);
  console.log(`║  Global Tables:       ${String(globalTables).padStart(35)} ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Queries Analyzed:    ${String(queryUsages.length).padStart(35)} ║`);
  console.log(
    `║  With Tenant Filter:  ${String(queryUsages.filter((q) => q.hasTenantFilter).length).padStart(35)} ║`,
  );
  console.log(
    `║  Without Filter:      ${String(queryUsages.filter((q) => !q.hasTenantFilter).length).padStart(35)} ║`,
  );
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Duration:            ${formatDuration(duration).padStart(35)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Print issue summary
  if (criticalIssues.length > 0) {
    console.log(`🔴 Critical Issues: ${criticalIssues.length}`);
    criticalIssues
      .slice(0, 10)
      .forEach((i) => console.log(`   - ${i.message} (${i.sourceFile}:${i.lineNumber || '?'})`));
    if (criticalIssues.length > 10) {
      console.log(`   ... and ${criticalIssues.length - 10} more`);
    }
    console.log('');
  }

  if (highIssues.length > 0) {
    console.log(`🟠 High Priority Issues: ${highIssues.length}`);
    highIssues
      .slice(0, 5)
      .forEach((i) => console.log(`   - ${i.message} (${i.sourceFile}:${i.lineNumber || '?'})`));
    if (highIssues.length > 5) {
      console.log(`   ... and ${highIssues.length - 5} more`);
    }
    console.log('');
  }

  console.log(`📄 Reports saved to:`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   MD:   ${mdPath}\n`);

  // Exit with error code if there are critical issues
  if (criticalIssues.length > 0) {
    process.exit(1);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

// ============================================================================
// Entry Point
// ============================================================================

runAudit().catch((error) => {
  console.error('Audit failed:', error);
  process.exit(1);
});
