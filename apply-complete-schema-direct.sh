#!/bin/bash
# Apply the complete schema from database-exports/complete-with-schema.sql
# This bypasses drizzle-kit and applies the full schema directly
# Usage: bash apply-complete-schema-direct.sh

set -e

CONTAINER="supabase-db-cgkko0cscowggwk8sss44wkw"

echo "========================================="
echo "Apply Complete Schema Directly"
echo "========================================="
echo ""

echo "WARNING: This will apply the COMPLETE schema from the old NEON database."
echo "This includes all 127+ tables."
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

echo "Step 1: Backup current database..."
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
docker exec $CONTAINER pg_dump -U postgres -d postgres --schema=public > "$BACKUP_FILE"
echo "Backup saved to: $BACKUP_FILE"
echo ""

echo "Step 2: Current table count..."
CURRENT_COUNT=$(docker exec $CONTAINER psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
echo "Current tables: $CURRENT_COUNT"
echo ""

echo "Step 3: Applying complete-with-schema.sql..."
echo "This may take a few minutes..."
docker exec -i $CONTAINER psql -U postgres -d postgres < database-exports/complete-with-schema.sql 2>&1 | tee schema-apply.log
echo ""

echo "Step 4: Verifying new table count..."
NEW_COUNT=$(docker exec $CONTAINER psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
echo "New table count: $NEW_COUNT"
echo ""

if [ "$NEW_COUNT" -gt "$CURRENT_COUNT" ]; then
    echo "[OK] Schema applied successfully! Added $((NEW_COUNT - CURRENT_COUNT)) tables."
else
    echo "[WARNING] Table count did not increase. Check schema-apply.log for details."
fi
echo ""

echo "Step 5: Applying 005_comprehensive_schema.sql (triggers and functions)..."
docker exec -i $CONTAINER psql -U postgres -d postgres < supabase/migrations/005_comprehensive_schema.sql
echo ""

echo "Step 6: Restarting PostgREST to refresh schema cache..."
echo "Please restart the Kong/PostgREST container in Coolify for api.printyx.net"
echo ""

echo "Step 7: Listing all tables..."
docker exec $CONTAINER psql -U postgres -d postgres -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
echo ""

echo "========================================="
echo "Schema application complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Restart api.printyx.net in Coolify to refresh PostgREST schema cache"
echo "2. Test the application to verify all features work"
echo "3. Check schema-apply.log for any errors or warnings"

