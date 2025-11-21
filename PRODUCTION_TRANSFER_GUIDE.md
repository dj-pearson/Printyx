# Printyx Production Database Transfer Guide

## Database Overview
Your Printyx application has a robust database with:
- **144 total tables** (comprehensive business management system)
- **20 users** across 2 tenant organizations
- **384 master product models** (Canon, HP, Xerox products)
- **Complete role-based access control** (8-level hierarchy)
- **Multi-tenant architecture** with proper data isolation

## Export Methods Available

### 1. SQL Exports (Recommended)
**Location**: `database-exports/` folder
- Individual table exports: `[table-name].sql`
- Combined export: `priority-tables-export.sql`
- Manual export: `manual-data-export.sql`

### 2. CSV Exports (For Data Migration Tools)
Best for importing into other systems:
```bash
# Export key tables to CSV
psql "$DATABASE_URL" -c "\COPY tenants TO 'tenants.csv' WITH CSV HEADER"
psql "$DATABASE_URL" -c "\COPY users TO 'users.csv' WITH CSV HEADER" 
psql "$DATABASE_URL" -c "\COPY master_product_models TO 'products.csv' WITH CSV HEADER"
```

### 3. Complete Database Backup
For full production transfer:
```bash
# Complete schema + data backup
pg_dump "$DATABASE_URL" > printyx-complete-backup.sql

# Schema only (for new deployment)
pg_dump "$DATABASE_URL" --schema-only > printyx-schema.sql

# Data only (for existing deployment)
pg_dump "$DATABASE_URL" --data-only --inserts > printyx-data.sql
```

## Production Deployment Steps

### Option A: Using Replit Deployment (Recommended)
1. **Deploy your app** - Replit will automatically create production database
2. **The schema is applied automatically** during deployment
3. **Import your data** using the SQL files from `database-exports/`

### Option B: External Database Transfer
1. **Export complete backup**: `pg_dump "$DATABASE_URL" > complete-backup.sql`
2. **Set up production database** (PostgreSQL 16+)
3. **Import schema**: `psql $PROD_DB < printyx-schema.sql`
4. **Import data**: `psql $PROD_DB < printyx-data.sql`

## Key Data to Transfer

### Critical Tables (With Your Data):
- `tenants` - 2 tenant organizations
- `users` - 20 user accounts with authentication
- `master_product_models` - 384 products (Canon, HP, Xerox)
- `roles` + `role_permissions` - Complete RBAC system
- `enabled_products` - Tenant-specific product catalogs

### System Tables (Auto-populated):
- All other 139 tables support the business logic
- Most are currently empty but provide the framework
- Will populate as you use the system in production

## Download Files

All export files are in the `database-exports/` folder:
1. Download the entire folder
2. Use `manual-data-export.sql` for quick setup
3. Use individual table files for selective imports

## Security Notes
- All passwords are properly hashed with bcrypt
- Tenant data is properly isolated
- Role permissions are correctly configured
- Ready for production use

## Next Steps
1. **Try deployment again** (platform issue should be resolved)
2. **Download backup files** before deploying
3. **Test in production** with existing data
4. **Scale as needed** with real customer data

Your Printyx platform is production-ready with comprehensive data structure and proper security implementation.