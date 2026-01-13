#!/bin/bash
# Create all tables using drizzle-kit push with a database proxy
# Usage: POSTGRES_PASSWORD=your_password bash create-all-tables-from-drizzle.sh

set -e

CONTAINER="supabase-db-cgkko0cscowggwk8sss44wkw"
NETWORK="cgkko0cscowggwk8sss44wkw"

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "ERROR: POSTGRES_PASSWORD environment variable is required"
    echo "Usage: POSTGRES_PASSWORD=your_password bash create-all-tables-from-drizzle.sh"
    exit 1
fi

echo "========================================="
echo "Create All Tables from Drizzle Schema"
echo "========================================="
echo ""

echo "Step 1: Current table count..."
CURRENT_COUNT=$(docker exec $CONTAINER psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
echo "Current tables: $CURRENT_COUNT"
echo ""

echo "Step 2: Creating a temporary database proxy container..."
echo "This allows drizzle-kit to connect to the database"
docker rm -f db-proxy 2>/dev/null || true
docker run -d \
  --name db-proxy \
  --network $NETWORK \
  -p 127.0.0.1:5434:5432 \
  alpine/socat \
  tcp-listen:5432,fork,reuseaddr tcp-connect:$CONTAINER:5432

echo "Waiting for proxy to start..."
sleep 3
echo ""

echo "Step 3: Testing connection through proxy..."
psql "postgresql://postgres:$POSTGRES_PASSWORD@127.0.0.1:5434/postgres" -c "SELECT 'Connection successful' AS status;" || {
    echo "[ERROR] Could not connect through proxy"
    docker rm -f db-proxy
    exit 1
}
echo ""

echo "Step 4: Running drizzle-kit push..."
cd /tmp/Printyx
export DATABASE_URL="postgresql://postgres:$POSTGRES_PASSWORD@127.0.0.1:5434/postgres"
npm run db:push

echo ""
echo "Step 5: Cleaning up proxy container..."
docker rm -f db-proxy
echo ""

echo "Step 6: Verifying new table count..."
NEW_COUNT=$(docker exec $CONTAINER psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
echo "New table count: $NEW_COUNT"
echo ""

if [ "$NEW_COUNT" -gt "$CURRENT_COUNT" ]; then
    echo "[OK] Tables created successfully! Added $((NEW_COUNT - CURRENT_COUNT)) tables."
else
    echo "[WARNING] Table count did not increase."
fi
echo ""

echo "Step 7: Applying triggers and functions (005_comprehensive_schema.sql)..."
# First, drop existing functions to fix ownership issues
docker exec $CONTAINER psql -U postgres -d postgres <<'EOF'
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS set_tenant_id_from_auth() CASCADE;
DROP FUNCTION IF EXISTS log_data_change() CASCADE;
DROP FUNCTION IF EXISTS cascade_delete_business_record() CASCADE;
DROP FUNCTION IF EXISTS generate_quote_number() CASCADE;
DROP FUNCTION IF EXISTS generate_invoice_number() CASCADE;
DROP FUNCTION IF EXISTS generate_ticket_number() CASCADE;
SELECT 'Old functions dropped' AS status;
EOF

docker exec -i $CONTAINER psql -U postgres -d postgres < supabase/migrations/005_comprehensive_schema.sql
echo ""

echo "Step 8: Final table count and list..."
FINAL_COUNT=$(docker exec $CONTAINER psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
echo "Final table count: $FINAL_COUNT"
echo ""

echo "All tables:"
docker exec $CONTAINER psql -U postgres -d postgres -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
echo ""

echo "========================================="
echo "Schema creation complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Restart api.printyx.net in Coolify to refresh PostgREST schema cache"
echo "2. Test the application to verify all features work"
