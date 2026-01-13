#!/bin/bash
# Fix function ownership and apply schema to Supabase database
# Usage: POSTGRES_PASSWORD=your_password bash fix-ownership-and-apply-schema.sh

set -e

CONTAINER="supabase-db-cgkko0cscowggwk8sss44wkw"

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "ERROR: POSTGRES_PASSWORD environment variable is required"
    echo "Usage: POSTGRES_PASSWORD=your_password bash fix-ownership-and-apply-schema.sh"
    exit 1
fi

echo "========================================="
echo "Fix Ownership and Apply Schema"
echo "========================================="
echo ""

echo "Step 1: Current table count..."
docker exec $CONTAINER psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
echo ""

echo "Step 2: Dropping existing functions (to fix ownership)..."
docker exec $CONTAINER psql -U postgres -d postgres <<'EOF'
-- Drop all existing functions that might have ownership issues
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS set_tenant_id_from_auth() CASCADE;
DROP FUNCTION IF EXISTS log_data_change() CASCADE;
DROP FUNCTION IF EXISTS cascade_delete_business_record() CASCADE;
DROP FUNCTION IF EXISTS generate_quote_number() CASCADE;
DROP FUNCTION IF EXISTS generate_invoice_number() CASCADE;
DROP FUNCTION IF EXISTS generate_ticket_number() CASCADE;

-- Drop existing triggers on business_records
DROP TRIGGER IF EXISTS update_business_records_updated_at ON business_records CASCADE;
DROP TRIGGER IF EXISTS set_business_records_tenant_id ON business_records CASCADE;
DROP TRIGGER IF EXISTS cascade_delete_business_record_trigger ON business_records CASCADE;
DROP TRIGGER IF EXISTS set_quote_number ON quotes CASCADE;
DROP TRIGGER IF EXISTS set_invoice_number ON invoices CASCADE;
DROP TRIGGER IF EXISTS set_ticket_number ON service_tickets CASCADE;

SELECT 'Functions and triggers dropped successfully' AS status;
EOF
echo ""

echo "Step 3: Applying 005_comprehensive_schema.sql..."
docker exec -i $CONTAINER psql -U postgres -d postgres < supabase/migrations/005_comprehensive_schema.sql
echo ""

echo "Step 4: Verifying functions were created..."
docker exec $CONTAINER psql -U postgres -d postgres -c "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION' ORDER BY routine_name;"
echo ""

echo "Step 5: Running drizzle-kit push from inside container..."
# We need to run npm commands inside a container with Node.js
# Since the DB container doesn't have Node, we'll use docker exec with the correct network

# First, let's check if we can connect using 127.0.0.1 from inside the container
docker exec $CONTAINER psql -U postgres -d postgres -c "SELECT 'Connection test successful' AS status;"
echo ""

echo "========================================="
echo "Manual Step Required for drizzle-kit push"
echo "========================================="
echo ""
echo "The database is not accessible from the host for external tools."
echo "You have two options:"
echo ""
echo "Option 1: Temporarily expose the database port"
echo "  docker run -d --name db-proxy --network cgkko0cscowggwk8sss44wkw -p 5432:5432 alpine/socat tcp-listen:5432,fork,reuseaddr tcp-connect:$CONTAINER:5432"
echo "  Then run: DATABASE_URL='postgresql://postgres:$POSTGRES_PASSWORD@localhost:5432/postgres' npm run db:push"
echo "  After success: docker rm -f db-proxy"
echo ""
echo "Option 2: Apply the full schema SQL directly (complete-with-schema.sql)"
echo "  docker exec -i $CONTAINER psql -U postgres -d postgres < database-exports/complete-with-schema.sql"
echo ""

echo "Current table count after migration:"
docker exec $CONTAINER psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
echo ""

echo "Tables currently in database:"
docker exec $CONTAINER psql -U postgres -d postgres -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"

