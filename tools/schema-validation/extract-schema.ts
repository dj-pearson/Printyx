/**
 * Schema Extractor
 * Extracts database schema from SQL migration files and creates a comprehensive schema definition
 */

import * as fs from 'fs';
import * as path from 'path';

interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: {
    table: string;
    column: string;
  };
  defaultValue?: string;
}

interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  primaryKeys: string[];
  foreignKeys: Array<{
    column: string;
    references: {
      table: string;
      column: string;
    };
  }>;
}

interface SchemaDefinition {
  tables: Record<string, TableDefinition>;
  generatedAt: string;
  sourceFiles: string[];
}

class SchemaExtractor {
  private schema: SchemaDefinition = {
    tables: {},
    generatedAt: new Date().toISOString(),
    sourceFiles: [],
  };

  /**
   * Extract schema from SQL files
   */
  async extractFromSQLFiles(sqlDir: string): Promise<void> {
    const sqlFiles = this.findSQLFiles(sqlDir);
    console.log(`📂 Found ${sqlFiles.length} SQL files to process`);

    for (const file of sqlFiles) {
      console.log(`📄 Processing: ${path.basename(file)}`);
      const content = fs.readFileSync(file, 'utf-8');
      this.parseSQLFile(content, file);
      this.schema.sourceFiles.push(path.relative(process.cwd(), file));
    }
  }

  /**
   * Find all SQL files in directory
   */
  private findSQLFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        files.push(...this.findSQLFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.sql')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Parse SQL file and extract table definitions
   */
  private parseSQLFile(content: string, filename: string): void {
    // Remove comments
    const cleaned = content
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    // Extract CREATE TABLE statements
    const createTableRegex =
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\);/gi;
    let match;

    while ((match = createTableRegex.exec(cleaned)) !== null) {
      const tableName = match[1];
      const tableBody = match[2];

      if (!this.schema.tables[tableName]) {
        this.schema.tables[tableName] = {
          name: tableName,
          columns: [],
          primaryKeys: [],
          foreignKeys: [],
        };
      }

      this.parseTableBody(tableName, tableBody);
    }

    // Extract ALTER TABLE statements for additional constraints
    this.parseAlterStatements(cleaned);
  }

  /**
   * Parse table body to extract columns
   */
  private parseTableBody(tableName: string, tableBody: string): void {
    const lines = tableBody.split(',').map((l) => l.trim());

    for (const line of lines) {
      // Skip constraint definitions (we'll handle them separately)
      if (
        line.toUpperCase().includes('CONSTRAINT') ||
        line.toUpperCase().includes('PRIMARY KEY (') ||
        line.toUpperCase().includes('FOREIGN KEY (') ||
        line.toUpperCase().includes('UNIQUE (') ||
        line.toUpperCase().includes('CHECK (')
      ) {
        // Extract primary key
        const pkMatch = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          const pkColumns = pkMatch[1].split(',').map((c) => c.trim());
          this.schema.tables[tableName].primaryKeys.push(...pkColumns);
        }
        continue;
      }

      // Parse column definition
      const columnMatch = line.match(/^([a-z_]+)\s+([A-Z_\(\)\s\d,]+)(.*)$/i);
      if (columnMatch) {
        const columnName = columnMatch[1];
        const typeAndConstraints = columnMatch[2] + ' ' + (columnMatch[3] || '');

        const column: ColumnDefinition = {
          name: columnName,
          type: this.extractType(typeAndConstraints),
          nullable: !typeAndConstraints.toUpperCase().includes('NOT NULL'),
          isPrimaryKey: typeAndConstraints.toUpperCase().includes('PRIMARY KEY'),
          isForeignKey: typeAndConstraints.toUpperCase().includes('REFERENCES'),
        };

        // Extract default value
        const defaultMatch = typeAndConstraints.match(/DEFAULT\s+([^,\s]+)/i);
        if (defaultMatch) {
          column.defaultValue = defaultMatch[1];
        }

        // Extract foreign key reference
        const fkMatch = typeAndConstraints.match(/REFERENCES\s+([a-z_]+)\s*\(([a-z_]+)\)/i);
        if (fkMatch) {
          column.references = {
            table: fkMatch[1],
            column: fkMatch[2],
          };
          this.schema.tables[tableName].foreignKeys.push({
            column: columnName,
            references: column.references,
          });
        }

        if (column.isPrimaryKey) {
          this.schema.tables[tableName].primaryKeys.push(columnName);
        }

        this.schema.tables[tableName].columns.push(column);
      }
    }
  }

  /**
   * Extract data type from column definition
   */
  private extractType(typeStr: string): string {
    const typeMatch = typeStr.match(/^([A-Z_]+(?:\([^)]+\))?)/i);
    return typeMatch ? typeMatch[1].trim() : 'UNKNOWN';
  }

  /**
   * Parse ALTER TABLE statements
   */
  private parseAlterStatements(content: string): void {
    // Extract ADD COLUMN statements
    const addColumnRegex =
      /ALTER\s+TABLE\s+(?:public\.)?([a-z_]+)\s+ADD\s+COLUMN\s+([a-z_]+)\s+([^;]+);/gi;
    let match;

    while ((match = addColumnRegex.exec(content)) !== null) {
      const tableName = match[1];
      const columnName = match[2];
      const typeAndConstraints = match[3];

      if (!this.schema.tables[tableName]) {
        this.schema.tables[tableName] = {
          name: tableName,
          columns: [],
          primaryKeys: [],
          foreignKeys: [],
        };
      }

      const column: ColumnDefinition = {
        name: columnName,
        type: this.extractType(typeAndConstraints),
        nullable: !typeAndConstraints.toUpperCase().includes('NOT NULL'),
        isPrimaryKey: false,
        isForeignKey: typeAndConstraints.toUpperCase().includes('REFERENCES'),
      };

      const fkMatch = typeAndConstraints.match(/REFERENCES\s+([a-z_]+)\s*\(([a-z_]+)\)/i);
      if (fkMatch) {
        column.references = {
          table: fkMatch[1],
          column: fkMatch[2],
        };
      }

      // Check if column already exists
      if (!this.schema.tables[tableName].columns.find((c) => c.name === columnName)) {
        this.schema.tables[tableName].columns.push(column);
      }
    }
  }

  /**
   * Get the complete schema
   */
  getSchema(): SchemaDefinition {
    return this.schema;
  }

  /**
   * Save schema to file
   */
  saveSchema(outputPath: string): void {
    fs.writeFileSync(outputPath, JSON.stringify(this.schema, null, 2), 'utf-8');
    console.log(`✅ Schema saved to: ${outputPath}`);
    console.log(`📊 Tables extracted: ${Object.keys(this.schema.tables).length}`);
  }

  /**
   * Generate TypeScript definition file
   */
  generateTypeScriptDefinitions(outputPath: string): void {
    let content = `/**
 * Auto-generated Database Schema Definitions
 * Generated at: ${this.schema.generatedAt}
 * 
 * DO NOT EDIT MANUALLY - This file is auto-generated
 */

export interface DatabaseSchema {
`;

    for (const [tableName, table] of Object.entries(this.schema.tables)) {
      content += `  ${tableName}: {\n`;
      for (const column of table.columns) {
        const tsType = this.sqlTypeToTSType(column.type);
        const optional = column.nullable ? '?' : '';
        content += `    ${column.name}${optional}: ${tsType};\n`;
      }
      content += `  };\n`;
    }

    content += `}\n\n`;

    // Add column name constants for each table
    content += `// Column name constants for type-safe queries\n`;
    content += `export const TableColumns = {\n`;
    for (const [tableName, table] of Object.entries(this.schema.tables)) {
      content += `  ${tableName}: {\n`;
      for (const column of table.columns) {
        content += `    ${column.name}: '${column.name}' as const,\n`;
      }
      content += `  },\n`;
    }
    content += `} as const;\n`;

    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`✅ TypeScript definitions saved to: ${outputPath}`);
  }

  /**
   * Convert SQL type to TypeScript type
   */
  private sqlTypeToTSType(sqlType: string): string {
    const upperType = sqlType.toUpperCase();
    if (
      upperType.includes('INT') ||
      upperType.includes('NUMERIC') ||
      upperType.includes('DECIMAL')
    ) {
      return 'number';
    }
    if (upperType.includes('BOOL')) {
      return 'boolean';
    }
    if (upperType.includes('JSON')) {
      return 'Record<string, any>';
    }
    if (upperType.includes('TIMESTAMP') || upperType.includes('DATE')) {
      return 'string';
    }
    if (upperType.includes('UUID')) {
      return 'string';
    }
    return 'string';
  }
}

// Main execution
async function main() {
  const extractor = new SchemaExtractor();

  console.log('🔍 Extracting database schema from SQL files...\n');

  // Extract from migrations and database folders
  const migrationsDirpaths = [
    path.join(process.cwd(), 'migrations'),
    path.join(process.cwd(), 'database'),
    path.join(process.cwd(), 'supabase', 'migrations'),
  ].filter((p) => fs.existsSync(p));

  for (const dir of migrationsDirpaths) {
    await extractor.extractFromSQLFiles(dir);
  }

  // Save outputs
  const outputDir = path.join(process.cwd(), 'tools', 'schema-validation');
  extractor.saveSchema(path.join(outputDir, 'schema-definition.json'));
  extractor.generateTypeScriptDefinitions(path.join(outputDir, 'schema-types.ts'));

  console.log('\n✨ Schema extraction complete!');
}

main().catch(console.error);
