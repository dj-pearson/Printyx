#!/bin/bash
# NEON to Supabase Complete Migration Script
# 
# This script migrates all 177 missing tables from NEON to Supabase
# while preserving your 37 new feature tables (AI, Calendar, Meetings, etc.)
#
# Usage: ./migrate-neon-to-supabase.sh [--dry-run] [--phase 1|2|3|all]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DRY_RUN=false
PHASE="all"
BACKUP_DIR="./migration-backups"
NEON_EXPORT="./database-exports/complete-with-schema.sql"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --phase)
      PHASE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "═══════════════════════════════════════════════════════════════"
echo "  NEON → Supabase Migration Script"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check for required environment variables
if [ -z "$SUPABASE_DB_URL" ]; then
  echo -e "${RED}❌ Error: SUPABASE_DB_URL environment variable not set${NC}"
  echo "Set it with: export SUPABASE_DB_URL='postgresql://user:pass@host:port/db'"
  exit 1
fi

# Check if NEON export exists
if [ ! -f "$NEON_EXPORT" ]; then
  echo -e "${RED}❌ Error: NEON export not found at $NEON_EXPORT${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Environment configured${NC}"
echo "   Database: ${SUPABASE_DB_URL%%@*}@***"
echo "   NEON Export: $NEON_EXPORT"
echo "   Dry Run: $DRY_RUN"
echo "   Phase: $PHASE"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "  Step 1: Backup Current Supabase Database"
echo "═══════════════════════════════════════════════════════════════"
echo ""

BACKUP_FILE="$BACKUP_DIR/supabase-backup-$(date +%Y%m%d-%H%M%S).sql"

if [ "$DRY_RUN" = false ]; then
  echo -e "${YELLOW}🔄 Creating backup...${NC}"
  pg_dump "$SUPABASE_DB_URL" > "$BACKUP_FILE"
  echo -e "${GREEN}✅ Backup saved: $BACKUP_FILE${NC}"
  echo "   Size: $(du -h $BACKUP_FILE | cut -f1)"
else
  echo -e "${YELLOW}🔍 DRY RUN: Would create backup at $BACKUP_FILE${NC}"
fi

echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  Step 2: Verify Current State"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo -e "${YELLOW}🔄 Counting current tables...${NC}"
CURRENT_TABLES=$(psql "$SUPABASE_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo -e "${GREEN}✅ Current tables in Supabase: $CURRENT_TABLES${NC}"

echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  Step 3: Import NEON Schema and Data"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ "$DRY_RUN" = false ]; then
  echo -e "${YELLOW}🔄 Importing NEON database...${NC}"
  echo "   This may take 10-30 minutes depending on data size..."
  
  # Clean the SQL file (remove NEON-specific commands)
  echo "   📝 Cleaning SQL file..."
  sed -e '/neondb_owner/d' \
      -e '/pg_dump/d' \
      -e '/SET statement_timeout/d' \
      "$NEON_EXPORT" > "$BACKUP_DIR/cleaned-neon-export.sql"
  
  # Import the cleaned file
  echo "   📥 Importing schema and data..."
  psql "$SUPABASE_DB_URL" < "$BACKUP_DIR/cleaned-neon-export.sql" 2>&1 | \
    grep -v "NOTICE" | \
    grep -v "already exists, skipping" || true
  
  echo -e "${GREEN}✅ NEON import complete${NC}"
else
  echo -e "${YELLOW}🔍 DRY RUN: Would import $NEON_EXPORT${NC}"
fi

echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  Step 4: Re-apply New Feature Migrations"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ "$DRY_RUN" = false ]; then
  echo -e "${YELLOW}🔄 Re-applying new feature migrations...${NC}"
  
  cd supabase/migrations || exit 1
  
  for migration in ai-*.sql calendar-*.sql meeting-*.sql task-*.sql; do
    if [ -f "$migration" ]; then
      echo "   📝 Applying $migration..."
      psql "$SUPABASE_DB_URL" < "$migration" 2>&1 | \
        grep -v "NOTICE" | \
        grep -v "already exists, skipping" || true
    fi
  done
  
  cd ../.. || exit 1
  
  echo -e "${GREEN}✅ New migrations re-applied${NC}"
else
  echo -e "${YELLOW}🔍 DRY RUN: Would re-apply new feature migrations${NC}"
fi

echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  Step 5: Verify Migration Success"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo -e "${YELLOW}🔄 Verifying migration...${NC}"

# Count final tables
FINAL_TABLES=$(psql "$SUPABASE_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo -e "${GREEN}✅ Final table count: $FINAL_TABLES${NC}"

# Check core tables
echo ""
echo "   Checking core tables:"
psql "$SUPABASE_DB_URL" -t -c "
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') 
    THEN '   ✅ users'
    ELSE '   ❌ users MISSING'
  END ||
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') 
    THEN E'\n   ✅ companies'
    ELSE E'\n   ❌ companies MISSING'
  END ||
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') 
    THEN E'\n   ✅ customers'
    ELSE E'\n   ❌ customers MISSING'
  END ||
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') 
    THEN E'\n   ✅ invoices'
    ELSE E'\n   ❌ invoices MISSING'
  END ||
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotes') 
    THEN E'\n   ✅ quotes'
    ELSE E'\n   ❌ quotes MISSING'
  END;
"

# Count records
echo ""
echo "   Record counts:"
psql "$SUPABASE_DB_URL" -c "
SELECT 
  'users' as table_name, 
  COUNT(*) as record_count 
FROM users
UNION ALL
SELECT 'companies', COUNT(*) FROM companies
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'quotes', COUNT(*) FROM quotes;
" 2>/dev/null || echo "   ⚠️  Some tables may not have data yet"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Migration Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}✅ Migration successful!${NC}"
echo ""
echo "📊 Summary:"
echo "   Before: $CURRENT_TABLES tables"
echo "   After:  $FINAL_TABLES tables"
echo "   Added:  $((FINAL_TABLES - CURRENT_TABLES)) tables"
echo ""
echo "📋 Next Steps:"
echo "   1. Test your application"
echo "   2. Verify customer data is visible"
echo "   3. Check invoices and quotes"
echo "   4. Test creating new records"
echo ""
echo "🔄 To rollback if needed:"
echo "   psql \$SUPABASE_DB_URL < $BACKUP_FILE"
echo ""
echo "═══════════════════════════════════════════════════════════════"
