# Database Schema Validation System

This tool validates that your TypeScript/JavaScript code uses correct database column names, preventing runtime errors from typos or outdated column references.

## Overview

The system consists of three main components:

1. **Schema Extractor** (`extract-schema.ts`) - Parses SQL migration files to build a schema definition
2. **Schema Definition** (`schema-definition.json`) - Generated JSON file containing all tables and columns
3. **Code Validator** (`validate-code.ts`) - Validates TypeScript/JavaScript files against the schema

## Quick Start

### 1. Extract Schema

First, extract the database schema from your SQL migration files:

```bash
npx tsx tools/schema-validation/extract-schema.ts
```

This will:

- Scan all SQL files in `migrations/`, `database/`, and `supabase/migrations/`
- Extract table and column definitions
- Generate `schema-definition.json` and `schema-types.ts`

### 2. Validate Code

Then validate your codebase against the extracted schema:

```bash
npx tsx tools/schema-validation/validate-code.ts
```

This will:

- Scan all `.ts`, `.tsx`, `.js`, `.jsx` files in your codebase
- Check for invalid column references
- Provide suggestions for misspelled columns
- Report all issues with file locations and line numbers

## Generated Files

### `schema-definition.json`

Complete database schema in JSON format:

```json
{
  "tables": {
    "users": {
      "name": "users",
      "columns": [
        {
          "name": "id",
          "type": "UUID",
          "nullable": false,
          "isPrimaryKey": true
        },
        {
          "name": "email",
          "type": "VARCHAR(255)",
          "nullable": false
        }
      ],
      "primaryKeys": ["id"],
      "foreignKeys": []
    }
  },
  "generatedAt": "2026-01-16T00:00:00.000Z",
  "sourceFiles": ["migrations/001_initial.sql"]
}
```

### `schema-types.ts`

TypeScript type definitions for type-safe database queries:

```typescript
export interface DatabaseSchema {
  users: {
    id: string;
    email: string;
    first_name?: string;
  };
}

export const TableColumns = {
  users: {
    id: 'id' as const,
    email: 'email' as const,
    first_name: 'first_name' as const,
  },
} as const;
```

## Usage in Code

### Type-Safe Column References

```typescript
import { TableColumns } from '@/tools/schema-validation/schema-types';

// Instead of:
.select('id, email, first_name')

// Use:
.select(`${TableColumns.users.id}, ${TableColumns.users.email}, ${TableColumns.users.first_name}`)

// TypeScript will catch typos at compile time!
```

### Validation Examples

The validator catches these common issues:

```typescript
// ❌ Invalid - column doesn't exist
const { data } = await supabase.from('users').select('id, email, access_scope'); // access_scope doesn't exist!

// ✅ Valid
const { data } = await supabase.from('users').select('id, email, role_id');

// ⚠️ Suggestion provided
// Invalid column 'is_platform_user'
// 💡 Did you mean 'isPlatformUser'?
```

## Integration

### Pre-commit Hook

Add to your `package.json`:

```json
{
  "scripts": {
    "validate-schema": "npx tsx tools/schema-validation/validate-code.ts",
    "extract-schema": "npx tsx tools/schema-validation/extract-schema.ts"
  },
  "husky": {
    "hooks": {
      "pre-commit": "npm run validate-schema"
    }
  }
}
```

### CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Extract Database Schema
  run: npx tsx tools/schema-validation/extract-schema.ts

- name: Validate Code Against Schema
  run: npx tsx tools/schema-validation/validate-code.ts
```

## Configuration

### Directories to Validate

Edit `validate-code.ts` to customize which directories are checked:

```typescript
const directoriesToValidate = [
  path.join(process.cwd(), 'client', 'src'),
  path.join(process.cwd(), 'server'),
  path.join(process.cwd(), 'supabase', 'functions'),
];
```

### SQL Source Directories

Edit `extract-schema.ts` to customize where SQL files are found:

```typescript
const migrationsDirs = [
  path.join(process.cwd(), 'migrations'),
  path.join(process.cwd(), 'database'),
  path.join(process.cwd(), 'supabase', 'migrations'),
];
```

## Detected Patterns

The validator detects column references in:

1. **Supabase queries**

   ```typescript
   .select('column1, column2')
   .insert({ column1: value })
   .update({ column1: value })
   ```

2. **Property access**

   ```typescript
   user.column_name;
   customer?.column_name;
   data.column_name;
   ```

3. **Object destructuring**
   ```typescript
   const { column1, column2 } = data;
   ```

## Limitations

- Cannot detect dynamically constructed column names
- May produce false positives for columns from computed properties
- Requires running `extract-schema.ts` after schema changes

## Workflow

1. **After schema changes:**

   ```bash
   npm run extract-schema
   ```

2. **Before committing code:**

   ```bash
   npm run validate-schema
   ```

3. **Review and fix any issues** reported by the validator

## Benefits

- ✅ Catch typos before runtime
- ✅ Prevent accessing non-existent columns
- ✅ Get suggestions for misspelled columns
- ✅ Type-safe database queries
- ✅ Automated validation in CI/CD
- ✅ Documentation of current schema

## Examples

See the issues we've fixed in this session:

- ❌ `users.access_scope` - Column doesn't exist
- ❌ `users.is_platform_user` - Column doesn't exist
- ❌ `users.role` - Column doesn't exist (uses `role_id` FK)
- ✅ All caught by this validation system!
