/**
 * Table Schema Viewer
 * Interactive tool to view table schemas
 */

import * as fs from 'fs';
import * as path from 'path';

interface SchemaDefinition {
  tables: Record<string, any>;
  generatedAt: string;
  sourceFiles: string[];
}

function viewTable(tableName?: string) {
  const schemaPath = path.join(
    process.cwd(),
    'tools',
    'schema-validation',
    'schema-definition.json',
  );
  const schema: SchemaDefinition = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

  if (!tableName) {
    // List all tables
    console.log('📊 Database Tables\n');
    console.log(`Total: ${Object.keys(schema.tables).length} tables\n`);

    const sortedTables = Object.keys(schema.tables).sort();
    for (const table of sortedTables) {
      const columnCount = schema.tables[table].columns.length;
      console.log(`  📋 ${table.padEnd(40)} (${columnCount} columns)`);
    }

    console.log('\n💡 Usage: npx tsx tools/schema-validation/view-table.ts [table-name]\n');
    return;
  }

  // View specific table
  const table = schema.tables[tableName];
  if (!table) {
    console.error(`❌ Table '${tableName}' not found in schema.`);
    console.log('\nAvailable tables:');
    Object.keys(schema.tables).forEach((t) => console.log(`  - ${t}`));
    process.exit(1);
  }

  console.log(`\n📋 Table: ${tableName}\n`);
  console.log(`Columns: ${table.columns.length}`);
  if (table.primaryKeys.length > 0) {
    console.log(`Primary Keys: ${table.primaryKeys.join(', ')}`);
  }
  if (table.foreignKeys.length > 0) {
    console.log(`Foreign Keys: ${table.foreignKeys.length}`);
  }
  console.log('');

  // Print columns in a nice table format
  console.log(
    '┌─────────────────────────────────┬──────────────────────┬──────────┬────────┬────────┐',
  );
  console.log(
    '│ Column Name                     │ Type                 │ Nullable │ PK     │ FK     │',
  );
  console.log(
    '├─────────────────────────────────┼──────────────────────┼──────────┼────────┼────────┤',
  );

  for (const column of table.columns) {
    const name = column.name.padEnd(31);
    const type = column.type.padEnd(20);
    const nullable = (column.nullable ? 'Yes' : 'No').padEnd(8);
    const pk = (column.isPrimaryKey ? '✓' : '').padEnd(6);
    const fk = (column.isForeignKey ? '✓' : '').padEnd(6);

    console.log(`│ ${name} │ ${type} │ ${nullable} │ ${pk} │ ${fk} │`);

    if (column.references) {
      console.log(
        `│ ${' '.repeat(31)} │ → ${column.references.table}.${column.references.column}`.padEnd(
          20,
        ) + ' │          │        │        │',
      );
    }
  }

  console.log(
    '└─────────────────────────────────┴──────────────────────┴──────────┴────────┴────────┘',
  );
  console.log('');

  // Print foreign keys
  if (table.foreignKeys.length > 0) {
    console.log('🔗 Foreign Key Relationships:\n');
    for (const fk of table.foreignKeys) {
      console.log(`   ${fk.column} → ${fk.references.table}.${fk.references.column}`);
    }
    console.log('');
  }
}

// Get table name from command line args
const tableName = process.argv[2];
viewTable(tableName);
