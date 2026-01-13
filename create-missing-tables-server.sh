#!/bin/bash
# Create all missing tables from shared/schema.ts
# Run this ON the Supabase server via SSH

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;37m'
NC='\033[0m'

echo -e "${GREEN}=== Creating Missing Tables ===${NC}"
echo ""

# Database connection (localhost on server)
DB_HOST="127.0.0.1"
DB_PORT="5433"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASS="Ta881v34EPbKK92E2F0oZpc4Els39giz"

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
export PGPASSWORD="${DB_PASS}"

# Check current tables
echo -e "${YELLOW}Current tables in database:${NC}"
CURRENT_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
echo -e "${GRAY}  Tables: $CURRENT_COUNT${NC}"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
    npm install
    echo ""
fi

# Run Drizzle push to create all tables
echo -e "${YELLOW}Running Drizzle push to create all tables...${NC}"
echo -e "${GRAY}(This will create all 127+ tables from shared/schema.ts)${NC}"
echo ""

npm run db:push

echo ""

# Verify new table count
echo -e "${YELLOW}Verifying new table count...${NC}"
NEW_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
echo -e "${GRAY}  Tables: $NEW_COUNT${NC}"
echo ""

# Apply triggers and hooks
echo -e "${YELLOW}Applying triggers and hooks...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f supabase/migrations/005_comprehensive_schema.sql
echo -e "${GREEN}[OK] Triggers applied${NC}"
echo ""

# Reload PostgREST
echo -e "${YELLOW}Reloading PostgREST schema...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "NOTIFY pgrst, 'reload schema';"
echo -e "${GREEN}[OK] Schema reloaded${NC}"
echo ""

# Restart PostgREST container to pick up new schema
echo -e "${YELLOW}Restarting PostgREST container...${NC}"
POSTGREST_CONTAINER=$(docker ps --filter "name=supabase-rest" --format "{{.Names}}" | head -n 1)
if [ -n "$POSTGREST_CONTAINER" ]; then
    docker restart "$POSTGREST_CONTAINER"
    echo -e "${GREEN}[OK] PostgREST restarted${NC}"
else
    echo -e "${GRAY}[SKIP] PostgREST container not found${NC}"
fi
echo ""

echo -e "${GREEN}=== Complete! ===${NC}"
echo ""
echo -e "Summary:"
echo -e "  Before: $CURRENT_COUNT tables"
echo -e "  After: $NEW_COUNT tables"
echo -e "  Created: $((NEW_COUNT - CURRENT_COUNT)) new tables"
echo ""

# List some key tables
echo -e "${YELLOW}Checking key tables:${NC}"
KEY_TABLES=("deals" "opportunities" "quotes" "invoices" "equipment" "service_tickets" "contracts" "product_models" "roles" "teams")

for table in "${KEY_TABLES[@]}"; do
    EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');")
    if [[ "$EXISTS" =~ "t" ]]; then
        echo -e "  ${GREEN}[OK]${NC} $table"
    else
        echo -e "  ${RED}[MISSING]${NC} $table"
    fi
done
echo ""

# Clean up
unset PGPASSWORD
unset DATABASE_URL

echo -e "${GREEN}Done! Test your Edge Functions now.${NC}"

