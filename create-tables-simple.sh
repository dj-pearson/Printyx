#!/bin/bash
# Simple script to create all tables - mirrors deployment pattern
# Run this on the server in the Printyx directory

echo ""
echo "========================================"
echo "CREATE ALL TABLES"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    echo "Please ensure you are in the Printyx directory"
    exit 1
fi

# Load environment variables
echo "Loading .env configuration..."
export $(cat .env | grep -v '^#' | xargs)

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not found in .env"
    exit 1
fi

echo "Running npm run db:push..."
npm run db:push

if [ $? -ne 0 ]; then
    echo ""
    echo "Error: drizzle-kit push failed"
    exit 1
fi

echo ""
echo "Applying triggers and functions..."

# Extract DB credentials from DATABASE_URL
export PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/.*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/postgres/\1/p')
DB_USER="postgres"
DB_NAME="postgres"

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f supabase/migrations/005_comprehensive_schema.sql

echo ""
echo "Final table count:"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public';"

echo ""
echo "========================================"
echo "COMPLETE!"
echo "========================================"
echo ""

