# Database Schema Reporter - Documentation

## Overview

The Database Schema Reporter is a comprehensive tool that connects to your Supabase PostgreSQL database and generates detailed documentation about all tables, columns, and relationships.

## What It Does

✅ **Connects to your database** via SSH/connection string  
✅ **Extracts complete schema** - all tables, columns, types, keys  
✅ **Generates 4 outputs:**
1. Comprehensive schema documentation (Markdown)
2. Quick reference guide (Markdown)
3. Validation helper with mappings (Markdown)
4. JSON report for programmatic use

---

## Usage

### Run the Reporter

**Direct Connection (default):**
```bash
npm run check:schema
```

**SSH Tunnel Mode:**
```bash
npm run check:schema:ssh
```

**Use SSH mode when:**
- Database is behind a firewall
- You have SSH access to the database server
- You want an extra layer of security
- Direct database connection is blocked

**📖 See full SSH guide:** `docs/DATABASE_SCHEMA_REPORTER_SSH.md`

### What You Need

#### Direct Connection Mode
The script uses your existing `DATABASE_URL` environment variable from `.env`:

```env
DATABASE_URL=postgresql://postgres:PASSWORD@209.145.59.219:5433/postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

#### SSH Tunnel Mode
Add these to your `.env`:

```env
DB_HOST=209.145.59.219
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=postgres

SSH_HOST=209.145.59.219   # Often same as DB_HOST
SSH_PORT=22
SSH_USER=postgres
SSH_PASSWORD=your_ssh_password
# OR: SSH_PRIVATE_KEY=/path/to/key
```

---

## Generated Files

### 1. `docs/DATABASE_SCHEMA.md`
**Purpose:** Complete, detailed schema documentation

**Contents:**
- Table of contents with links
- Every table with full details:
  - Row count
  - All columns with types
  - Primary keys (🔑 PK)
  - Foreign keys (🔗 FK → referenced.table.column)
  - Nullable flags
  - Default values

**Use for:**
- Onboarding new developers
- Architecture reviews
- Planning migrations
- Understanding relationships

**Example:**
```markdown
### `public.company_contacts`

**Row Count:** 1,234

**Columns:** 15

| Column | Type | Nullable | Default | Keys |
|--------|------|----------|---------|------|
| `id` | uuid | ✗ | uuid_generate_v4() | 🔑 PK |
| `company_id` | uuid | ✗ | - | 🔗 FK → public.business_records.id |
| `first_name` | character varying | ✓ | - | - |
| `last_name` | character varying | ✗ | - | - |
| `email` | character varying | ✓ | - | - |
| `is_primary_contact` | boolean | ✓ | false | - |
...
```

---

### 2. `docs/DATABASE_QUICK_REFERENCE.md`
**Purpose:** Fast lookup of all tables and columns

**Contents:**
- Condensed view of all tables
- Just table names and column lists
- Perfect for quick checks

**Use for:**
- Quick column name lookups
- Verifying table exists
- Copy-pasting column names
- IDE reference window

**Example:**
```markdown
### company_contacts
```
  id: uuid [PK]
  company_id: uuid [FK → public.business_records.id]
  first_name: character varying
  last_name: character varying
  email: character varying
  is_primary_contact: boolean
  ...
```
```

---

### 3. `docs/DATABASE_VALIDATION_HELPER.md`
**Purpose:** Validation constants and field mappings

**Contents:**
- Array of all valid table names
- Object mapping tables to their columns
- snake_case → camelCase conversion map

**Use for:**
- Validating code references
- Auto-complete in IDEs
- Transformation helpers
- Linting rules

**Example:**
```javascript
const VALID_TABLES = [
  'public.company_contacts',
  'public.business_records',
  'public.service_tickets',
  // ... all tables
];

const TABLE_COLUMNS = {
  'public.company_contacts': [
    'id',
    'company_id',
    'first_name',
    'last_name',
    // ... all columns
  ],
};

const FIELD_MAPPING = {
  'first_name': 'firstName',
  'last_name': 'lastName',
  'is_primary_contact': 'isPrimaryContact',
  // ... all snake_case fields
};
```

---

### 4. `database-schema-report.json`
**Purpose:** Machine-readable schema data

**Contents:**
- Full schema as structured JSON
- All tables, columns, types, keys
- Metadata (row counts, timestamps)

**Use for:**
- Automated validation scripts
- Code generators
- Schema comparison tools
- CI/CD checks

**Structure:**
```json
{
  "generatedAt": "2026-01-24T...",
  "database": "209.145.59.219",
  "totalTables": 127,
  "totalColumns": 1543,
  "schemas": {
    "public": [
      {
        "schema": "public",
        "name": "company_contacts",
        "columns": [
          {
            "name": "id",
            "type": "uuid",
            "nullable": false,
            "default": "uuid_generate_v4()",
            "isPrimaryKey": true,
            "isForeignKey": false
          },
          ...
        ],
        "rowCount": 1234
      },
      ...
    ]
  }
}
```

---

## Use Cases

### 1. **Verify Code References**

**Before deploying:**
```bash
npm run check:schema
```

**Then check:**
- Does my code reference valid table names?
- Are column names spelled correctly?
- Do relationships match actual foreign keys?

**Use:** `DATABASE_VALIDATION_HELPER.md`

---

### 2. **Onboard New Developers**

**Give them:**
1. `DATABASE_SCHEMA.md` - comprehensive overview
2. `DATABASE_QUICK_REFERENCE.md` - quick lookups

**They can:**
- Understand the data model quickly
- See all relationships visually
- Know what data exists before coding

---

### 3. **Debug Data Issues**

**When users report bugs:**
1. Check `DATABASE_SCHEMA.md`
2. Verify column types match expectations
3. Check for nullable vs. required fields
4. Verify foreign key relationships

---

### 4. **Plan Migrations**

**Before schema changes:**
1. Run `npm run check:schema` for baseline
2. Make database changes
3. Run `npm run check:schema` again
4. Compare JSON files to see exact diff

---

### 5. **Auto-Generate Code**

**Use the JSON to generate:**
- TypeScript types
- API validation schemas
- Drizzle ORM models
- GraphQL schemas
- Documentation

---

## Integration with Other Tools

### With System Check Tool

```bash
# Generate schema docs
npm run check:schema

# Then check code alignment
npm run check:system
```

**Combined workflow:**
1. Schema reporter shows what **exists in DB**
2. System check validates **code matches DB**

### With Data Transformation Tools

```bash
# 1. Get field mappings
npm run check:schema

# 2. Check for transformation issues
npm run lint:transformations

# 3. Use FIELD_MAPPING from DATABASE_VALIDATION_HELPER.md
```

---

## Automation Ideas

### 1. **Pre-Deploy Check**
```bash
# In CI/CD pipeline
npm run check:schema
git diff docs/DATABASE_SCHEMA.md
# If changed, review before deploy
```

### 2. **Weekly Schema Snapshot**
```bash
# Cron job
npm run check:schema
git add database-schema-report.json
git commit -m "Weekly schema snapshot"
```

### 3. **Migration Validation**
```bash
# Before migration
npm run check:schema
mv database-schema-report.json schema-before.json

# Run migration
npm run db:push

# After migration
npm run check:schema
diff schema-before.json database-schema-report.json
```

---

## Troubleshooting

### Error: "DATABASE_URL environment variable not set"
**Fix:** Ensure `.env` file has `DATABASE_URL`

### Error: "Connection refused"
**Fix:** Check database is running and accessible

### Error: "Could not get row count for table X"
**Fix:** Check RLS policies allow read access (won't fail, just warns)

### Slow execution
**Reason:** Counting rows on large tables  
**Solution:** Normal - takes ~30-60 seconds for full schema

---

## Output Example

```bash
$ npm run check:schema

🔍 Starting Database Schema Report Generation...

✅ Connected to database
📊 Fetching all tables and columns...
   Found 127 tables

📝 Generating reports...

✅ Generated: docs/DATABASE_SCHEMA.md
✅ Generated: docs/DATABASE_QUICK_REFERENCE.md
✅ Generated: docs/DATABASE_VALIDATION_HELPER.md
✅ Generated: database-schema-report.json

================================================================================
📋 SUMMARY

📁 public
   Tables: 127
   Columns: 1543
   Total Rows: 45,678

================================================================================

✅ Schema report generation complete!

🔌 Database connection closed
```

---

## Best Practices

### 1. **Run Regularly**
- Weekly snapshots
- Before major deployments
- After schema changes
- When onboarding developers

### 2. **Commit Reports**
```bash
# Commit markdown docs for easy viewing in GitHub
git add docs/DATABASE_*.md
git commit -m "Update schema documentation"

# Optionally commit JSON for comparison
git add database-schema-report.json
```

### 3. **Review Before Deploys**
Always generate fresh schema docs before deploying code that references database:
```bash
npm run check:schema
npm run check:system
# Review any issues before deploying
```

### 4. **Use for Code Reviews**
When reviewing PRs that touch database:
1. Check if schema changes are needed
2. Reference `DATABASE_SCHEMA.md` for correct column names
3. Verify foreign keys are used correctly

---

## Security Notes

⚠️ **The reports contain database structure but NO actual data**

**Safe to commit:**
- Table names
- Column names  
- Data types
- Relationships

**NOT included:**
- Actual data values
- Passwords
- API keys
- User information

**However:**
- Exposing your database structure could help attackers
- Consider keeping `database-schema-report.json` in `.gitignore` if repo is public
- Markdown docs in `docs/` are generally safe for internal/private repos

---

## Future Enhancements

Possible additions:
- [ ] Index documentation
- [ ] View and materialized view support
- [ ] Enum type listings
- [ ] Trigger documentation
- [ ] Function listings
- [ ] RLS policy documentation
- [ ] HTML output format
- [ ] Mermaid ERD diagrams
- [ ] Schema diff tool

---

*Last Updated: January 24, 2026*
