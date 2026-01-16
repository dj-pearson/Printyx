/**
 * Code Validator
 * Validates that TypeScript/JavaScript code uses correct database column names
 */

import * as fs from 'fs';
import * as path from 'path';

interface SchemaDefinition {
  tables: Record<
    string,
    {
      name: string;
      columns: Array<{ name: string }>;
    }
  >;
}

interface ValidationIssue {
  file: string;
  line: number;
  column: number;
  table: string;
  invalidColumn: string;
  suggestion?: string;
  context: string;
}

class CodeValidator {
  private schema: SchemaDefinition;
  private issues: ValidationIssue[] = [];
  private allColumns: Map<string, Set<string>> = new Map();

  constructor(schemaPath: string) {
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    this.schema = JSON.parse(schemaContent);

    // Build column map for faster lookups
    for (const [tableName, table] of Object.entries(this.schema.tables)) {
      const columns = new Set(table.columns.map((c) => c.name));
      this.allColumns.set(tableName, columns);
    }
  }

  /**
   * Validate all TypeScript/JavaScript files
   */
  async validateFiles(directories: string[]): Promise<void> {
    console.log('🔍 Validating code against database schema...\n');

    for (const dir of directories) {
      if (fs.existsSync(dir)) {
        await this.validateDirectory(dir);
      }
    }
  }

  /**
   * Validate all files in a directory
   */
  private async validateDirectory(dir: string): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules, dist, build folders
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'build', '.git', '.next'].includes(entry.name)) {
          await this.validateDirectory(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        await this.validateFile(fullPath);
      }
    }
  }

  /**
   * Validate a single file
   */
  private async validateFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      // Check for .select() calls with column names
      this.checkSelectStatement(filePath, lineNum + 1, line);

      // Check for object property access
      this.checkPropertyAccess(filePath, lineNum + 1, line);

      // Check for INSERT/UPDATE operations
      this.checkDMLOperations(filePath, lineNum + 1, line);
    }
  }

  /**
   * Check .select() statements
   */
  private checkSelectStatement(filePath: string, lineNum: number, line: string): void {
    // Match .select('column1, column2, ...')
    const selectMatch = line.match(/\.select\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
    if (!selectMatch) return;

    const selectClause = selectMatch[1];

    // Try to determine which table this is querying
    const fromMatch = line.match(/\.from\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
    if (!fromMatch) {
      // Try to find table name in previous context
      const tableMatch = line.match(/supabase\.from\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
      if (tableMatch) {
        this.validateColumns(filePath, lineNum, tableMatch[1], selectClause, line);
      }
      return;
    }

    const tableName = fromMatch[1];
    this.validateColumns(filePath, lineNum, tableName, selectClause, line);
  }

  /**
   * Check property access like customer.columnName
   */
  private checkPropertyAccess(filePath: string, lineNum: number, line: string): void {
    // Look for patterns like: user?.column_name or data.column_name
    const propertyMatches = line.matchAll(/(?:user|customer|data|profile|record|row)\.([a-z_]+)/g);

    for (const match of propertyMatches) {
      const columnName = match[1];

      // Check if this column exists in any table
      let found = false;
      for (const [tableName, columns] of this.allColumns.entries()) {
        if (columns.has(columnName)) {
          found = true;
          break;
        }
      }

      // If not found in any table, it might be invalid
      // (though we can't be 100% sure without type information)
      if (!found && this.looksLikeDBColumn(columnName)) {
        // Find the most similar column name for suggestion
        const suggestion = this.findSimilarColumn(columnName);
        this.issues.push({
          file: filePath,
          line: lineNum,
          column: match.index || 0,
          table: 'unknown',
          invalidColumn: columnName,
          suggestion,
          context: line.trim(),
        });
      }
    }
  }

  /**
   * Check INSERT/UPDATE operations
   */
  private checkDMLOperations(filePath: string, lineNum: number, line: string): void {
    // Match .insert({ ... }) or .update({ ... })
    const dmlMatch = line.match(/\.(insert|update)\s*\(\s*\{/);
    if (!dmlMatch) return;

    // This would require more complex parsing to extract the object properties
    // For now, we'll just flag it for manual review if it contains suspicious patterns
  }

  /**
   * Validate column names in a select clause
   */
  private validateColumns(
    filePath: string,
    lineNum: number,
    tableName: string,
    selectClause: string,
    context: string,
  ): void {
    const columns = this.allColumns.get(tableName);
    if (!columns) {
      console.log(`⚠️  Unknown table: ${tableName} in ${path.basename(filePath)}:${lineNum}`);
      return;
    }

    // Parse column names from select clause
    const selectedColumns = selectClause
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c && !c.includes('(') && !c.includes('*')); // Skip functions and wildcards

    for (const col of selectedColumns) {
      // Handle nested selects and aliases
      const columnName = col.split('.').pop()?.split(' ')[0] || col;

      if (!columns.has(columnName)) {
        const suggestion = this.findSimilarColumnInTable(tableName, columnName);
        this.issues.push({
          file: filePath,
          line: lineNum,
          column: 0,
          table: tableName,
          invalidColumn: columnName,
          suggestion,
          context: context.trim(),
        });
      }
    }
  }

  /**
   * Check if a name looks like a database column
   */
  private looksLikeDBColumn(name: string): boolean {
    // Database columns typically use snake_case
    return /^[a-z][a-z0-9_]*$/.test(name) && name.includes('_');
  }

  /**
   * Find similar column name across all tables
   */
  private findSimilarColumn(columnName: string): string | undefined {
    let bestMatch: string | undefined;
    let bestDistance = Infinity;

    for (const columns of this.allColumns.values()) {
      for (const col of columns) {
        const distance = this.levenshteinDistance(columnName, col);
        if (distance < bestDistance && distance <= 3) {
          bestDistance = distance;
          bestMatch = col;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Find similar column name in a specific table
   */
  private findSimilarColumnInTable(tableName: string, columnName: string): string | undefined {
    const columns = this.allColumns.get(tableName);
    if (!columns) return undefined;

    let bestMatch: string | undefined;
    let bestDistance = Infinity;

    for (const col of columns) {
      const distance = this.levenshteinDistance(columnName, col);
      if (distance < bestDistance && distance <= 3) {
        bestDistance = distance;
        bestMatch = col;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate Levenshtein distance between two strings
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

  /**
   * Print validation results
   */
  printResults(): void {
    console.log('\n📊 Validation Results\n');

    if (this.issues.length === 0) {
      console.log('✅ No issues found! All column references appear to be valid.\n');
      return;
    }

    console.log(`⚠️  Found ${this.issues.length} potential issues:\n`);

    // Group issues by file
    const issuesByFile = new Map<string, ValidationIssue[]>();
    for (const issue of this.issues) {
      const relPath = path.relative(process.cwd(), issue.file);
      if (!issuesByFile.has(relPath)) {
        issuesByFile.set(relPath, []);
      }
      issuesByFile.get(relPath)!.push(issue);
    }

    for (const [file, fileIssues] of issuesByFile.entries()) {
      console.log(`📄 ${file}`);
      for (const issue of fileIssues) {
        console.log(
          `   Line ${issue.line}: Invalid column '${issue.invalidColumn}' in table '${issue.table}'`,
        );
        if (issue.suggestion) {
          console.log(`   💡 Did you mean '${issue.suggestion}'?`);
        }
        console.log(`   Context: ${issue.context}`);
        console.log('');
      }
    }

    console.log(
      `\n📊 Summary: ${this.issues.length} issues found across ${issuesByFile.size} files\n`,
    );
  }

  /**
   * Get all issues
   */
  getIssues(): ValidationIssue[] {
    return this.issues;
  }
}

// Main execution
async function main() {
  const schemaPath = path.join(
    process.cwd(),
    'tools',
    'schema-validation',
    'schema-definition.json',
  );

  if (!fs.existsSync(schemaPath)) {
    console.error('❌ Schema definition not found. Run extract-schema.ts first.');
    process.exit(1);
  }

  const validator = new CodeValidator(schemaPath);

  // Validate these directories
  const directoriesToValidate = [
    path.join(process.cwd(), 'client', 'src'),
    path.join(process.cwd(), 'server'),
    path.join(process.cwd(), 'supabase', 'functions'),
    path.join(process.cwd(), 'shared'),
  ].filter((dir) => fs.existsSync(dir));

  await validator.validateFiles(directoriesToValidate);
  validator.printResults();

  // Exit with error code if issues found
  if (validator.getIssues().length > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
