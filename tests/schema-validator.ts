#!/usr/bin/env tsx
/**
 * Schema Validation Script
 *
 * Cross-references docs/DATABASE_SCHEMA.md with the codebase to identify:
 * 1. References to old databases (NEON)
 * 2. References to non-existent tables
 * 3. References to non-existent columns
 * 4. Mismatched table/column names
 *
 * Usage: npx tsx tests/schema-validator.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  description?: string;
}

interface Table {
  name: string;
  schema: string;
  fullName: string;
  columns: Column[];
  description?: string;
}

interface ValidationIssue {
  type:
    | 'neon_reference'
    | 'invalid_table'
    | 'invalid_column'
    | 'ambiguous_reference'
    | 'deprecated_pattern';
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  content: string;
  message: string;
  suggestion?: string;
}

interface ValidationReport {
  timestamp: string;
  summary: {
    totalFiles: number;
    totalIssues: number;
    errors: number;
    warnings: number;
    info: number;
  };
  schemaInfo: {
    totalTables: number;
    totalColumns: number;
    schemas: string[];
  };
  issues: ValidationIssue[];
}

class SchemaValidator {
  private tables: Map<string, Table> = new Map();
  private issues: ValidationIssue[] = [];
  private schemaPath: string;
  private projectRoot: string;
  private filesScanned: number = 0;

  constructor(schemaPath: string, projectRoot: string) {
    this.schemaPath = schemaPath;
    this.projectRoot = projectRoot;
  }

  /**
   * Parse the DATABASE_SCHEMA.md file to extract all tables and columns
   */
  async parseSchema(): Promise<void> {
    console.log('📖 Parsing DATABASE_SCHEMA.md...');
    const content = fs.readFileSync(this.schemaPath, 'utf-8');
    const lines = content.split('\n').map((line) => line.trim());

    let currentTable: Table | null = null;
    let inColumnSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect table header: ### schema.table_name
      const tableMatch = line.match(/^### (.+)$/);
      if (tableMatch) {
        // Save previous table if exists
        if (currentTable && currentTable.columns.length > 0) {
          this.tables.set(currentTable.fullName, currentTable);
          this.tables.set(currentTable.name, currentTable);
        }

        const fullTableName = tableMatch[1].trim();
        const parts = fullTableName.split('.');

        currentTable = {
          name: parts.length > 1 ? parts[1] : parts[0],
          schema: parts.length > 1 ? parts[0] : 'public',
          fullName: fullTableName,
          columns: [],
        };

        // Check next non-empty line for description
        if (i + 2 < lines.length && lines[i + 2] && !lines[i + 2].startsWith('|')) {
          const potentialDesc = lines[i + 2].trim();
          if (potentialDesc && !potentialDesc.startsWith('#')) {
            currentTable.description = potentialDesc;
          }
        }

        inColumnSection = false;
        continue;
      }

      // Detect column header row
      if (currentTable && line.startsWith('| Column') && line.includes('| Type |')) {
        inColumnSection = true;
        continue;
      }

      // Skip separator row
      if (line.startsWith('|---')) {
        continue;
      }

      // Parse column rows
      if (inColumnSection && currentTable && line.startsWith('|')) {
        const parts = line
          .split('|')
          .map((p) => p.trim())
          .filter((p) => p);

        if (parts.length >= 3) {
          const column: Column = {
            name: parts[0],
            type: parts[1],
            nullable: parts[2] === 'YES',
            default: parts.length > 3 && parts[3] !== '-' ? parts[3] : undefined,
            description: parts.length > 4 && parts[4] !== '-' ? parts[4] : undefined,
          };
          currentTable.columns.push(column);
        }
      }

      // End of table section (empty line or new heading)
      if (inColumnSection && (line.trim() === '' || line.startsWith('#'))) {
        inColumnSection = false;
      }
    }

    // Add last table if exists
    if (currentTable && currentTable.columns.length > 0) {
      this.tables.set(currentTable.fullName, currentTable);
      this.tables.set(currentTable.name, currentTable);
    }

    console.log(`✅ Parsed ${this.tables.size / 2} tables`);
  }

  /**
   * Find all relevant code files to scan
   */
  async findFilesToScan(): Promise<string[]> {
    console.log('🔍 Finding files to scan...');

    const patterns = [
      'server/**/*.ts',
      'server/**/*.js',
      'client/src/**/*.ts',
      'client/src/**/*.tsx',
      'shared/**/*.ts',
      'supabase/functions/**/*.ts',
      'scripts/**/*.ts',
      'migrations/**/*.sql',
      'database/**/*.sql',
    ];

    const ignorePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/tests/schema-validator.ts',
    ];

    let allFiles: string[] = [];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: ignorePatterns,
        absolute: true,
      });
      allFiles = allFiles.concat(files);
    }

    // Remove duplicates
    allFiles = [...new Set(allFiles)];

    console.log(`📁 Found ${allFiles.length} files to scan`);
    return allFiles;
  }

  /**
   * Check for NEON database references
   */
  checkNeonReferences(content: string, filePath: string): void {
    const lines = content.split('\n');

    const neonPatterns = [
      /neon\.tech/gi,
      /NEON_/gi,
      /neondb/gi,
      /@neondatabase/gi,
      /neon-serverless/gi,
    ];

    lines.forEach((line, index) => {
      neonPatterns.forEach((pattern) => {
        if (pattern.test(line)) {
          this.issues.push({
            type: 'neon_reference',
            severity: 'error',
            file: path.relative(this.projectRoot, filePath),
            line: index + 1,
            content: line.trim(),
            message: 'Reference to NEON database found',
            suggestion: 'Update to use Supabase PostgreSQL (209.145.59.219:5433)',
          });
        }
      });
    });
  }

  /**
   * Check for table references in code
   */
  checkTableReferences(content: string, filePath: string): void {
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();

      // Skip comments
      if (
        trimmedLine.startsWith('//') ||
        trimmedLine.startsWith('/*') ||
        trimmedLine.startsWith('*')
      ) {
        return;
      }

      // Skip import statements
      if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('export ')) {
        return;
      }

      // Pattern 1: Drizzle ORM - db.query.tableName
      const queryPattern = /db\.query\.(\w+)/g;
      let match;
      while ((match = queryPattern.exec(line)) !== null) {
        const tableName = match[1];
        this.validateTableReference(tableName, filePath, lineIndex + 1, line.trim());
      }

      // Pattern 2: Drizzle ORM - from(tableName)
      const fromPattern = /from\((\w+)\)/g;
      while ((match = fromPattern.exec(line)) !== null) {
        const tableName = match[1];
        if (!this.isCommonWord(tableName)) {
          this.validateTableReference(tableName, filePath, lineIndex + 1, line.trim());
        }
      }

      // Pattern 3: SQL statements in strings
      const sqlFromPattern = /['"`].*?\bFROM\s+(['"`]?)([\w.]+)\1.*?['"`]/gi;
      while ((match = sqlFromPattern.exec(line)) !== null) {
        const tableName = match[2];
        if (!this.isCommonWord(tableName)) {
          this.validateTableReference(tableName, filePath, lineIndex + 1, line.trim());
        }
      }

      // Pattern 4: SQL INSERT INTO
      const insertPattern = /['"`].*?\bINSERT\s+INTO\s+(['"`]?)([\w.]+)\1.*?['"`]/gi;
      while ((match = insertPattern.exec(line)) !== null) {
        const tableName = match[2];
        if (!this.isCommonWord(tableName)) {
          this.validateTableReference(tableName, filePath, lineIndex + 1, line.trim());
        }
      }

      // Pattern 5: SQL UPDATE
      const updatePattern = /['"`].*?\bUPDATE\s+(['"`]?)([\w.]+)\1.*?['"`]/gi;
      while ((match = updatePattern.exec(line)) !== null) {
        const tableName = match[2];
        if (!this.isCommonWord(tableName)) {
          this.validateTableReference(tableName, filePath, lineIndex + 1, line.trim());
        }
      }

      // Pattern 6: pgTable definitions in schema files
      if (filePath.includes('schema')) {
        const pgTablePattern = /export\s+const\s+(\w+)\s*=\s*pgTable/g;
        while ((match = pgTablePattern.exec(line)) !== null) {
          const tableName = match[1];
          // This is a table definition, check if it exists in DB
          this.validateTableReference(tableName, filePath, lineIndex + 1, line.trim());
        }
      }
    });
  }

  /**
   * Validate a table reference
   */
  private validateTableReference(
    tableName: string,
    filePath: string,
    lineNumber: number,
    lineContent: string,
  ): void {
    // Skip common words and variables
    if (this.isCommonWord(tableName)) {
      return;
    }

    // Check if table exists in schema
    if (!this.tables.has(tableName) && !this.tables.has(`public.${tableName}`)) {
      // Check for case variations
      const snakeCaseName = this.camelToSnake(tableName);
      const camelCaseName = this.snakeToCamel(tableName);

      let suggestion: string | undefined;
      if (this.tables.has(snakeCaseName)) {
        suggestion = `Did you mean '${snakeCaseName}'?`;
      } else if (this.tables.has(camelCaseName)) {
        suggestion = `Did you mean '${camelCaseName}'?`;
      } else {
        // Look for similar table names
        const similarTables = this.findSimilarTables(tableName);
        if (similarTables.length > 0) {
          suggestion = `Similar tables: ${similarTables.slice(0, 3).join(', ')}`;
        } else {
          suggestion = 'Table not found in DATABASE_SCHEMA.md';
        }
      }

      this.issues.push({
        type: 'invalid_table',
        severity: 'error',
        file: path.relative(this.projectRoot, filePath),
        line: lineNumber,
        content: lineContent,
        message: `Table '${tableName}' not found in schema`,
        suggestion,
      });
    }
  }

  /**
   * Find similar table names
   */
  private findSimilarTables(targetTable: string): string[] {
    const similar: string[] = [];
    const targetLower = targetTable.toLowerCase();

    this.tables.forEach((table) => {
      const tableLower = table.name.toLowerCase();

      // Check if target is contained in table name or vice versa
      if (tableLower.includes(targetLower) || targetLower.includes(tableLower)) {
        if (!similar.includes(table.name)) {
          similar.push(table.name);
        }
      }

      // Check Levenshtein distance for short names
      if (targetTable.length >= 4) {
        const distance = this.levenshteinDistance(tableLower, tableLower);
        if (distance <= 2 && !similar.includes(table.name)) {
          similar.push(table.name);
        }
      }
    });

    return similar;
  }

  /**
   * Check for column references in code
   */
  checkColumnReferences(content: string, filePath: string): void {
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();

      // Skip comments and imports
      if (
        trimmedLine.startsWith('//') ||
        trimmedLine.startsWith('/*') ||
        trimmedLine.startsWith('*') ||
        trimmedLine.startsWith('import ')
      ) {
        return;
      }

      // Look for table.column patterns
      const regex = /(\w+)\.(\w+)/g;
      let match;

      while ((match = regex.exec(line)) !== null) {
        const tableName = match[1];
        const columnName = match[2];

        // Skip common words, method calls, and property accesses
        if (
          this.isCommonWord(tableName) ||
          this.isCommonMethod(columnName) ||
          this.isCommonProperty(columnName)
        ) {
          continue;
        }

        // Skip if the tableName looks like a module or object (starts with uppercase)
        if (tableName[0] === tableName[0].toUpperCase() && tableName !== tableName.toUpperCase()) {
          continue;
        }

        // Check if this is a valid table.column reference
        const table = this.tables.get(tableName) || this.tables.get(`public.${tableName}`);

        if (table) {
          // Check if column exists in this table
          const columnExists = table.columns.some((col) => col.name === columnName);

          if (!columnExists) {
            // Check for case variations
            const snakeColumn = this.camelToSnake(columnName);
            const camelColumn = this.snakeToCamel(columnName);

            const hasSnake = table.columns.some((col) => col.name === snakeColumn);
            const hasCamel = table.columns.some((col) => col.name === camelColumn);

            let suggestion: string | undefined;
            if (hasSnake) {
              suggestion = `Did you mean '${tableName}.${snakeColumn}'?`;
            } else if (hasCamel) {
              suggestion = `Did you mean '${tableName}.${camelColumn}'?`;
            } else {
              const similarColumns = this.findSimilarColumns(table, columnName);
              if (similarColumns.length > 0) {
                suggestion = `Similar columns: ${similarColumns.join(', ')}`;
              } else {
                suggestion = `Column not found in table '${tableName}'`;
              }
            }

            this.issues.push({
              type: 'invalid_column',
              severity: 'warning',
              file: path.relative(this.projectRoot, filePath),
              line: lineIndex + 1,
              content: line.trim(),
              message: `Column '${columnName}' not found in table '${tableName}'`,
              suggestion,
            });
          }
        }
      }
    });
  }

  /**
   * Check for deprecated patterns
   */
  checkDeprecatedPatterns(content: string, filePath: string): void {
    const lines = content.split('\n');

    const deprecatedPatterns = [
      {
        pattern: /process\.env\.NEON/g,
        message: 'NEON environment variable reference',
        suggestion: 'Use DATABASE_URL or SUPABASE_DB_URL',
      },
      {
        pattern: /pgNeon/g,
        message: 'Neon-specific PostgreSQL adapter',
        suggestion: 'Use standard PostgreSQL adapter',
      },
      {
        pattern: /@neondatabase/g,
        message: 'Neon package import',
        suggestion: 'Use @supabase/supabase-js or pg',
      },
    ];

    lines.forEach((line, index) => {
      deprecatedPatterns.forEach(({ pattern, message, suggestion }) => {
        if (pattern.test(line)) {
          this.issues.push({
            type: 'deprecated_pattern',
            severity: 'warning',
            file: path.relative(this.projectRoot, filePath),
            line: index + 1,
            content: line.trim(),
            message,
            suggestion,
          });
        }
      });
    });
  }

  /**
   * Scan a single file for issues
   */
  async scanFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.filesScanned++;

      this.checkNeonReferences(content, filePath);
      this.checkTableReferences(content, filePath);
      this.checkColumnReferences(content, filePath);
      this.checkDeprecatedPatterns(content, filePath);

      if (this.filesScanned % 50 === 0) {
        console.log(`  📄 Scanned ${this.filesScanned} files...`);
      }
    } catch (error) {
      console.error(`❌ Error scanning ${filePath}:`, error);
    }
  }

  /**
   * Generate validation report
   */
  generateReport(): ValidationReport {
    const errors = this.issues.filter((i) => i.severity === 'error').length;
    const warnings = this.issues.filter((i) => i.severity === 'warning').length;
    const info = this.issues.filter((i) => i.severity === 'info').length;

    const schemas = new Set<string>();
    const totalColumns = Array.from(this.tables.values()).reduce(
      (sum, table) => sum + table.columns.length,
      0,
    );

    this.tables.forEach((table) => schemas.add(table.schema));

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: this.filesScanned,
        totalIssues: this.issues.length,
        errors,
        warnings,
        info,
      },
      schemaInfo: {
        totalTables: this.tables.size / 2, // Divided by 2 because we store both full and simple names
        totalColumns,
        schemas: Array.from(schemas),
      },
      issues: this.issues,
    };
  }

  /**
   * Helper: Convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Helper: Convert snake_case to camelCase
   */
  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Helper: Check if a word is common and should be ignored
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      // Core JS/TS
      'db',
      'req',
      'res',
      'next',
      'err',
      'error',
      'data',
      'result',
      'response',
      'request',
      'config',
      'options',
      'params',
      'query',
      'body',
      'headers',
      'user',
      'session',
      'auth',
      'token',
      'env',
      'process',
      'console',
      'window',
      'document',
      'this',
      'self',
      'that',
      'super',
      'import',
      'export',
      'default',
      'async',
      'await',
      'return',
      'const',
      'let',
      'var',
      'function',
      'class',
      // Common variables
      'item',
      'items',
      'list',
      'array',
      'obj',
      'object',
      'str',
      'string',
      'num',
      'number',
      'bool',
      'boolean',
      'date',
      'time',
      'timestamp',
      // HTTP/Network
      'http',
      'https',
      'url',
      'uri',
      'api',
      'endpoint',
      'path',
      'route',
      'method',
      'status',
      'code',
      'message',
      'ws',
      'socket',
      // Libraries
      'react',
      'express',
      'axios',
      'lodash',
      'moment',
      'uuid',
      'crypto',
      'bcrypt',
      'jwt',
      'zod',
      'drizzle',
      'supabase',
      'stripe',
      // File operations
      'fs',
      'path',
      'file',
      'dir',
      'directory',
      'folder',
      'buffer',
      // Testing
      'test',
      'describe',
      'it',
      'expect',
      'assert',
      'mock',
      'spy',
      // Common utility names
      'utils',
      'helpers',
      'lib',
      'core',
      'common',
      'shared',
      'types',
      'schema',
      'model',
      'service',
      'controller',
      'middleware',
      'handler',
    ];
    return commonWords.includes(word.toLowerCase());
  }

  /**
   * Helper: Check if a word is a common method name
   */
  private isCommonMethod(word: string): boolean {
    const commonMethods = [
      // Array methods
      'filter',
      'map',
      'reduce',
      'forEach',
      'some',
      'every',
      'includes',
      'push',
      'pop',
      'shift',
      'unshift',
      'slice',
      'splice',
      'join',
      'split',
      'sort',
      'reverse',
      'concat',
      'flat',
      'flatMap',
      'fill',
      // Object methods
      'keys',
      'values',
      'entries',
      'assign',
      'freeze',
      'seal',
      'toString',
      'valueOf',
      'toJSON',
      'hasOwnProperty',
      // String methods
      'trim',
      'toLowerCase',
      'toUpperCase',
      'substring',
      'replace',
      'match',
      'search',
      'indexOf',
      'lastIndexOf',
      'startsWith',
      'endsWith',
      // CRUD operations
      'get',
      'set',
      'add',
      'remove',
      'update',
      'delete',
      'create',
      'find',
      'findOne',
      'findMany',
      'findFirst',
      'findUnique',
      'count',
      // HTTP methods
      'post',
      'put',
      'patch',
      'head',
      'options',
      // Common functions
      'log',
      'warn',
      'info',
      'debug',
      'trace',
      'then',
      'catch',
      'finally',
      'on',
      'off',
      'emit',
      'use',
      'apply',
      'call',
      'bind',
    ];
    return commonMethods.includes(word.toLowerCase());
  }

  /**
   * Helper: Check if a word is a common property name
   */
  private isCommonProperty(word: string): boolean {
    const commonProps = [
      'id',
      'name',
      'type',
      'value',
      'label',
      'title',
      'description',
      'length',
      'size',
      'width',
      'height',
      'count',
      'total',
      'index',
      'key',
      'code',
      'status',
      'state',
      'flag',
      'enabled',
      'active',
      'meta',
      'metadata',
      'props',
      'attributes',
      'settings',
      'config',
      'prototype',
      'constructor',
      'parent',
      'children',
      'next',
      'prev',
      'first',
      'last',
      'current',
      'previous',
      'message',
      'text',
      'content',
    ];
    return commonProps.includes(word.toLowerCase());
  }

  /**
   * Helper: Find similar column names using Levenshtein distance
   */
  private findSimilarColumns(table: Table, targetColumn: string): string[] {
    const similar: string[] = [];

    table.columns.forEach((col) => {
      const distance = this.levenshteinDistance(col.name.toLowerCase(), targetColumn.toLowerCase());
      if (distance <= 3) {
        similar.push(col.name);
      }
    });

    return similar.slice(0, 3); // Return top 3 matches
  }

  /**
   * Helper: Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Schema Validation...\n');

  const projectRoot = path.resolve(__dirname, '..');
  const schemaPath = path.join(projectRoot, 'docs', 'DATABASE_SCHEMA.md');
  const outputPath = path.join(projectRoot, 'tests', 'schema-validation-report.json');
  const markdownOutputPath = path.join(projectRoot, 'tests', 'SCHEMA_VALIDATION_REPORT.md');

  // Check if schema file exists
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Schema file not found: ${schemaPath}`);
    process.exit(1);
  }

  const validator = new SchemaValidator(schemaPath, projectRoot);

  // Step 1: Parse schema
  await validator.parseSchema();

  // Step 2: Find files to scan
  const files = await validator.findFilesToScan();

  // Step 3: Scan all files
  console.log('\n🔍 Scanning files for issues...');
  for (const file of files) {
    await validator.scanFile(file);
  }

  // Step 4: Generate report
  console.log('\n📊 Generating report...');
  const report = validator.generateReport();

  // Save JSON report
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`✅ JSON report saved: ${outputPath}`);

  // Generate and save Markdown report
  const markdown = generateMarkdownReport(report);
  fs.writeFileSync(markdownOutputPath, markdown);
  console.log(`✅ Markdown report saved: ${markdownOutputPath}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files Scanned:    ${report.summary.totalFiles}`);
  console.log(`Total Issues:     ${report.summary.totalIssues}`);
  console.log(`  Errors:         ${report.summary.errors}`);
  console.log(`  Warnings:       ${report.summary.warnings}`);
  console.log(`  Info:           ${report.summary.info}`);
  console.log(`\nSchema Info:`);
  console.log(`  Tables:         ${report.schemaInfo.totalTables}`);
  console.log(`  Columns:        ${report.schemaInfo.totalColumns}`);
  console.log(`  Schemas:        ${report.schemaInfo.schemas.join(', ')}`);
  console.log('='.repeat(60));

  // Exit with error code if there are critical issues
  if (report.summary.errors > 0) {
    console.log('\n❌ Validation failed with errors!');
    process.exit(1);
  } else if (report.summary.warnings > 0) {
    console.log('\n⚠️  Validation completed with warnings.');
    process.exit(0);
  } else {
    console.log('\n✅ Validation passed with no issues!');
    process.exit(0);
  }
}

/**
 * Generate Markdown report from validation results
 */
function generateMarkdownReport(report: ValidationReport): string {
  let md = `# Schema Validation Report\n\n`;
  md += `**Generated:** ${report.timestamp}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Files Scanned:** ${report.summary.totalFiles}\n`;
  md += `- **Total Issues:** ${report.summary.totalIssues}\n`;
  md += `  - Errors: ${report.summary.errors} ❌\n`;
  md += `  - Warnings: ${report.summary.warnings} ⚠️\n`;
  md += `  - Info: ${report.summary.info} ℹ️\n\n`;

  md += `## Schema Information\n\n`;
  md += `- **Total Tables:** ${report.schemaInfo.totalTables}\n`;
  md += `- **Total Columns:** ${report.schemaInfo.totalColumns}\n`;
  md += `- **Schemas:** ${report.schemaInfo.schemas.join(', ')}\n\n`;

  if (report.issues.length === 0) {
    md += `## ✅ No Issues Found!\n\n`;
    md += `All table and column references are valid.\n`;
    return md;
  }

  // Group issues by type
  const issuesByType = report.issues.reduce(
    (acc, issue) => {
      if (!acc[issue.type]) {
        acc[issue.type] = [];
      }
      acc[issue.type].push(issue);
      return acc;
    },
    {} as Record<string, ValidationIssue[]>,
  );

  // Report each type
  const typeLabels: Record<string, string> = {
    neon_reference: '🔴 NEON Database References',
    invalid_table: '❌ Invalid Table References',
    invalid_column: '⚠️ Invalid Column References',
    deprecated_pattern: '⚠️ Deprecated Patterns',
    ambiguous_reference: 'ℹ️ Ambiguous References',
  };

  Object.entries(issuesByType).forEach(([type, issues]) => {
    md += `## ${typeLabels[type] || type}\n\n`;
    md += `Found ${issues.length} issue(s)\n\n`;

    // Group by file
    const issuesByFile = issues.reduce(
      (acc, issue) => {
        if (!acc[issue.file]) {
          acc[issue.file] = [];
        }
        acc[issue.file].push(issue);
        return acc;
      },
      {} as Record<string, ValidationIssue[]>,
    );

    Object.entries(issuesByFile).forEach(([file, fileIssues]) => {
      md += `### \`${file}\`\n\n`;

      fileIssues.forEach((issue) => {
        const severity =
          issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        md += `${severity} **Line ${issue.line}:** ${issue.message}\n\n`;
        md += `\`\`\`\n${issue.content}\n\`\`\`\n\n`;

        if (issue.suggestion) {
          md += `💡 **Suggestion:** ${issue.suggestion}\n\n`;
        }

        md += `---\n\n`;
      });
    });
  });

  // Recommendations
  md += `## 🎯 Recommendations\n\n`;

  if (report.summary.errors > 0) {
    md += `### Critical Issues\n\n`;
    md += `1. Fix all NEON database references immediately\n`;
    md += `2. Update invalid table references to match DATABASE_SCHEMA.md\n`;
    md += `3. Verify all database connection strings point to Supabase (209.145.59.219:5433)\n\n`;
  }

  if (report.summary.warnings > 0) {
    md += `### Warnings\n\n`;
    md += `1. Review and fix invalid column references\n`;
    md += `2. Update deprecated patterns to modern equivalents\n`;
    md += `3. Ensure camelCase vs snake_case consistency\n\n`;
  }

  md += `## Next Steps\n\n`;
  md += `1. Review this report and prioritize fixes\n`;
  md += `2. Update code to reference correct tables and columns\n`;
  md += `3. Remove all NEON database references\n`;
  md += `4. Re-run validation: \`npx tsx tests/schema-validator.ts\`\n`;
  md += `5. Update DATABASE_SCHEMA.md if schema changes are needed\n\n`;

  return md;
}

// Run the validator
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
