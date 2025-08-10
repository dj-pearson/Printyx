#!/bin/bash
# Database Export Commands for Printyx
# Generated on: 2025-08-10T13:20:37.588Z

echo "🔄 Starting database export..."

# Create exports directory
mkdir -p database-exports

# Export individual tables with data

echo "📊 Exporting tenants..."
pg_dump "$DATABASE_URL" --table=tenants --data-only --inserts > "database-exports/tenants.sql"

echo "📊 Exporting users..."
pg_dump "$DATABASE_URL" --table=users --data-only --inserts > "database-exports/users.sql"

echo "📊 Exporting roles..."
pg_dump "$DATABASE_URL" --table=roles --data-only --inserts > "database-exports/roles.sql"

echo "📊 Exporting enhanced_roles..."
pg_dump "$DATABASE_URL" --table=enhanced_roles --data-only --inserts > "database-exports/enhanced_roles.sql"

echo "📊 Exporting role_permissions..."
pg_dump "$DATABASE_URL" --table=role_permissions --data-only --inserts > "database-exports/role_permissions.sql"

echo "📊 Exporting companies..."
pg_dump "$DATABASE_URL" --table=companies --data-only --inserts > "database-exports/companies.sql"

echo "📊 Exporting locations..."
pg_dump "$DATABASE_URL" --table=locations --data-only --inserts > "database-exports/locations.sql"

echo "📊 Exporting regions..."
pg_dump "$DATABASE_URL" --table=regions --data-only --inserts > "database-exports/regions.sql"

echo "📊 Exporting business_records..."
pg_dump "$DATABASE_URL" --table=business_records --data-only --inserts > "database-exports/business_records.sql"

echo "📊 Exporting master_product_models..."
pg_dump "$DATABASE_URL" --table=master_product_models --data-only --inserts > "database-exports/master_product_models.sql"

echo "📊 Exporting master_product_accessories..."
pg_dump "$DATABASE_URL" --table=master_product_accessories --data-only --inserts > "database-exports/master_product_accessories.sql"

echo "📊 Exporting enabled_products..."
pg_dump "$DATABASE_URL" --table=enabled_products --data-only --inserts > "database-exports/enabled_products.sql"

echo "📊 Exporting product_models..."
pg_dump "$DATABASE_URL" --table=product_models --data-only --inserts > "database-exports/product_models.sql"

echo "📊 Exporting deals..."
pg_dump "$DATABASE_URL" --table=deals --data-only --inserts > "database-exports/deals.sql"

echo "📊 Exporting quotes..."
pg_dump "$DATABASE_URL" --table=quotes --data-only --inserts > "database-exports/quotes.sql"

# Export complete schema
echo "📋 Exporting complete schema..."
pg_dump "$DATABASE_URL" --schema-only > "database-exports/schema.sql"

# Export all data in one file
echo "📦 Exporting all data..."
pg_dump "$DATABASE_URL" --data-only --inserts > "database-exports/all-data.sql"

# Create CSV exports for key tables
echo "📊 Creating CSV exports..."
psql "$DATABASE_URL" -c "\COPY tenants TO 'database-exports/tenants.csv' WITH CSV HEADER"
psql "$DATABASE_URL" -c "\COPY users TO 'database-exports/users.csv' WITH CSV HEADER"
psql "$DATABASE_URL" -c "\COPY roles TO 'database-exports/roles.csv' WITH CSV HEADER"
psql "$DATABASE_URL" -c "\COPY enhanced_roles TO 'database-exports/enhanced_roles.csv' WITH CSV HEADER"
psql "$DATABASE_URL" -c "\COPY role_permissions TO 'database-exports/role_permissions.csv' WITH CSV HEADER"
psql "$DATABASE_URL" -c "\COPY companies TO 'database-exports/companies.csv' WITH CSV HEADER"
psql "$DATABASE_URL" -c "\COPY locations TO 'database-exports/locations.csv' WITH CSV HEADER"
psql "$DATABASE_URL" -c "\COPY regions TO 'database-exports/regions.csv' WITH CSV HEADER"

echo "✅ Export completed!"
echo "📁 Files created in database-exports/ folder"
