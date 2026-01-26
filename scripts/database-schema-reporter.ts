#!/usr/bin/env tsx
/**
 * Database Schema Reporter
 *
 * Connects to the Supabase PostgreSQL database and generates:
 * - Comprehensive schema documentation
 * - Table/column reference for validation
 * - Easy-to-read markdown report
 * - JSON export for programmatic validation
 */

import { Client } from 'pg';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyRef?: string;
}

interface Table {
  schema: string;
  name: string;
  columns: Column[];
  rowCount: number;
  description?: string;
}

interface SchemaReport {
  generatedAt: string;
  database: string;
  totalTables: number;
  totalColumns: number;
  schemas: {
    [schemaName: string]: Table[];
  };
}

async function getDatabaseConnection(): Promise<Client> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable not set');
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl:
      process.env.DB_SSL === 'true'
        ? {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          }
        : false,
  });

  await client.connect();
  console.log('✅ Connected to database');

  return client;
}

async function getAllTables(client: Client): Promise<Table[]> {
  const query = `
    SELECT 
      table_schema,
      table_name,
      obj_description((table_schema||'.'||table_name)::regclass, 'pg_class') as table_description
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name;
  `;

  const result = await client.query(query);

  const tables: Table[] = [];

  for (const row of result.rows) {
    const columns = await getTableColumns(client, row.table_schema, row.table_name);
    const rowCount = await getTableRowCount(client, row.table_schema, row.table_name);

    tables.push({
      schema: row.table_schema,
      name: row.table_name,
      columns,
      rowCount,
      description: row.table_description,
    });
  }

  return tables;
}

async function getTableColumns(
  client: Client,
  schema: string,
  tableName: string,
): Promise<Column[]> {
  const query = `
    SELECT 
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default,
      CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
      CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
      fk.foreign_table_schema || '.' || fk.foreign_table_name || '.' || fk.foreign_column_name as foreign_key_ref
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT ku.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        AND tc.table_schema = ku.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
    ) pk ON c.column_name = pk.column_name
    LEFT JOIN (
      SELECT 
        ku.column_name,
        ccu.table_schema as foreign_table_schema,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        AND tc.table_schema = ku.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
    ) fk ON c.column_name = fk.column_name
    WHERE c.table_schema = $1
      AND c.table_name = $2
    ORDER BY c.ordinal_position;
  `;

  const result = await client.query(query, [schema, tableName]);

  return result.rows.map((row) => ({
    name: row.column_name,
    type: row.data_type,
    nullable: row.is_nullable === 'YES',
    default: row.column_default,
    isPrimaryKey: row.is_primary_key,
    isForeignKey: row.is_foreign_key,
    foreignKeyRef: row.foreign_key_ref,
  }));
}

async function getTableRowCount(
  client: Client,
  schema: string,
  tableName: string,
): Promise<number> {
  try {
    const result = await client.query(`SELECT COUNT(*) as count FROM "${schema}"."${tableName}"`);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.warn(`⚠️  Could not get row count for ${schema}.${tableName}`);
    return 0;
  }
}

function generateMarkdownReport(report: SchemaReport): string {
  let markdown = `# Database Schema Report\n\n`;
  markdown += `**Generated:** ${report.generatedAt}\n`;
  markdown += `**Database:** ${report.database}\n`;
  markdown += `**Total Tables:** ${report.totalTables}\n`;
  markdown += `**Total Columns:** ${report.totalColumns}\n\n`;

  markdown += `---\n\n`;
  markdown += `## Table of Contents\n\n`;

  // Generate TOC
  Object.entries(report.schemas).forEach(([schemaName, tables]) => {
    markdown += `### ${schemaName} Schema (${tables.length} tables)\n\n`;
    tables.forEach((table) => {
      markdown += `- [${table.name}](#${schemaName}-${table.name.replace(/_/g, '-')})\n`;
    });
    markdown += `\n`;
  });

  markdown += `---\n\n`;

  // Generate detailed tables
  Object.entries(report.schemas).forEach(([schemaName, tables]) => {
    markdown += `## ${schemaName} Schema\n\n`;

    tables.forEach((table) => {
      markdown += `### \`${schemaName}.${table.name}\`\n\n`;

      if (table.description) {
        markdown += `**Description:** ${table.description}\n\n`;
      }

      markdown += `**Row Count:** ${table.rowCount.toLocaleString()}\n\n`;
      markdown += `**Columns:** ${table.columns.length}\n\n`;

      markdown += `| Column | Type | Nullable | Default | Keys |\n`;
      markdown += `|--------|------|----------|---------|------|\n`;

      table.columns.forEach((col) => {
        const keys = [];
        if (col.isPrimaryKey) keys.push('🔑 PK');
        if (col.isForeignKey) keys.push(`🔗 FK → ${col.foreignKeyRef}`);

        markdown += `| \`${col.name}\` | ${col.type} | ${col.nullable ? '✓' : '✗'} | ${col.default || '-'} | ${keys.join(', ') || '-'} |\n`;
      });

      markdown += `\n`;
    });
  });

  return markdown;
}

function generateQuickReference(report: SchemaReport): string {
  let markdown = `# Database Quick Reference\n\n`;
  markdown += `**Generated:** ${report.generatedAt}\n\n`;
  markdown += `This is a condensed reference showing all tables and their columns for quick lookup.\n\n`;
  markdown += `---\n\n`;

  Object.entries(report.schemas).forEach(([schemaName, tables]) => {
    markdown += `## ${schemaName}\n\n`;

    tables.forEach((table) => {
      markdown += `### ${table.name}\n`;
      markdown += `\`\`\`\n`;
      markdown += table.columns
        .map((col) => {
          const pk = col.isPrimaryKey ? ' [PK]' : '';
          const fk = col.isForeignKey ? ` [FK → ${col.foreignKeyRef}]` : '';
          return `  ${col.name}: ${col.type}${pk}${fk}`;
        })
        .join('\n');
      markdown += `\n\`\`\`\n\n`;
    });
  });

  return markdown;
}

function generateValidationHelper(report: SchemaReport): string {
  let output = `# Schema Validation Helper\n\n`;
  output += `Use this file to validate your code references.\n\n`;
  output += `---\n\n`;

  output += `## All Tables\n\n`;
  output += `\`\`\`javascript\n`;
  output += `const VALID_TABLES = [\n`;

  Object.entries(report.schemas).forEach(([schemaName, tables]) => {
    tables.forEach((table) => {
      output += `  '${schemaName}.${table.name}',\n`;
    });
  });

  output += `];\n\`\`\`\n\n`;

  output += `## All Columns by Table\n\n`;
  output += `\`\`\`javascript\n`;
  output += `const TABLE_COLUMNS = {\n`;

  Object.entries(report.schemas).forEach(([schemaName, tables]) => {
    tables.forEach((table) => {
      output += `  '${schemaName}.${table.name}': [\n`;
      table.columns.forEach((col) => {
        output += `    '${col.name}',\n`;
      });
      output += `  ],\n`;
    });
  });

  output += `};\n\`\`\`\n\n`;

  output += `## Common snake_case → camelCase Mappings\n\n`;
  output += `\`\`\`javascript\n`;
  output += `const FIELD_MAPPING = {\n`;

  const allColumns = new Set<string>();
  Object.values(report.schemas).forEach((tables) => {
    tables.forEach((table) => {
      table.columns.forEach((col) => allColumns.add(col.name));
    });
  });

  Array.from(allColumns)
    .sort()
    .forEach((col) => {
      if (col.includes('_')) {
        const camelCase = col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        output += `  '${col}': '${camelCase}',\n`;
      }
    });

  output += `};\n\`\`\`\n`;

  return output;
}

async function main() {
  console.log('🔍 Starting Database Schema Report Generation...\n');

  let client: Client | null = null;

  try {
    // Connect to database
    client = await getDatabaseConnection();

    // Get all tables
    console.log('📊 Fetching all tables and columns...');
    const tables = await getAllTables(client);
    console.log(`   Found ${tables.length} tables\n`);

    // Group by schema
    const schemas: { [key: string]: Table[] } = {};
    tables.forEach((table) => {
      if (!schemas[table.schema]) {
        schemas[table.schema] = [];
      }
      schemas[table.schema].push(table);
    });

    // Calculate totals
    const totalColumns = tables.reduce((sum, table) => sum + table.columns.length, 0);

    // Create report
    const report: SchemaReport = {
      generatedAt: new Date().toISOString(),
      database: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Unknown',
      totalTables: tables.length,
      totalColumns,
      schemas,
    };

    console.log('📝 Generating reports...\n');

    // Generate markdown report
    const markdown = generateMarkdownReport(report);
    writeFileSync('docs/DATABASE_SCHEMA.md', markdown);
    console.log('✅ Generated: docs/DATABASE_SCHEMA.md');

    // Generate quick reference
    const quickRef = generateQuickReference(report);
    writeFileSync('docs/DATABASE_QUICK_REFERENCE.md', quickRef);
    console.log('✅ Generated: docs/DATABASE_QUICK_REFERENCE.md');

    // Generate validation helper
    const validationHelper = generateValidationHelper(report);
    writeFileSync('docs/DATABASE_VALIDATION_HELPER.md', validationHelper);
    console.log('✅ Generated: docs/DATABASE_VALIDATION_HELPER.md');

    // Generate JSON for programmatic use
    writeFileSync('database-schema-report.json', JSON.stringify(report, null, 2));
    console.log('✅ Generated: database-schema-report.json\n');

    // Print summary
    console.log('='.repeat(80));
    console.log('📋 SUMMARY\n');

    Object.entries(schemas).forEach(([schemaName, schemaTables]) => {
      const schemaColumns = schemaTables.reduce((sum, table) => sum + table.columns.length, 0);
      const schemaRows = schemaTables.reduce((sum, table) => sum + table.rowCount, 0);

      console.log(`📁 ${schemaName}`);
      console.log(`   Tables: ${schemaTables.length}`);
      console.log(`   Columns: ${schemaColumns}`);
      console.log(`   Total Rows: ${schemaRows.toLocaleString()}\n`);
    });

    console.log('='.repeat(80));
    console.log('\n✅ Schema report generation complete!\n');
  } catch (error) {
    console.error('❌ Error generating schema report:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
      console.log('🔌 Database connection closed');
    }
  }
}

main().catch(console.error);
