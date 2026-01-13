# Create all missing tables from shared/schema.ts
# This uses Drizzle to push the complete schema to Supabase

Write-Host "=== Creating Missing Tables ===" -ForegroundColor Green
Write-Host ""

# Set the database connection
$DB_HOST = "209.145.59.219"
$DB_PORT = "5433"
$DB_NAME = "postgres"
$DB_USER = "postgres"
$DB_PASS = "Ta881v34EPbKK92E2F0oZpc4Els39giz"

$env:DATABASE_URL = "postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

Write-Host "Database: $env:DATABASE_URL" -ForegroundColor Cyan
Write-Host ""

# Check current tables
Write-Host "Current tables in database:" -ForegroundColor Yellow
$env:PGPASSWORD = $DB_PASS
$currentTables = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
Write-Host "  Tables: $($currentTables.Trim())" -ForegroundColor Gray
Write-Host ""

# Run Drizzle push to create all tables from shared/schema.ts
Write-Host "Running Drizzle push to create all tables..." -ForegroundColor Yellow
Write-Host "(This will create all 127+ tables from shared/schema.ts)" -ForegroundColor Gray
Write-Host ""

npm run db:push

Write-Host ""
Write-Host "Verifying new table count..." -ForegroundColor Yellow
$newTables = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
Write-Host "  Tables: $($newTables.Trim())" -ForegroundColor Gray
Write-Host ""

# Apply the triggers and hooks
Write-Host "Applying triggers and hooks..." -ForegroundColor Yellow
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "supabase\migrations\005_comprehensive_schema.sql"
Write-Host "[OK] Triggers applied" -ForegroundColor Green
Write-Host ""

# Reload PostgREST
Write-Host "Reloading PostgREST schema..." -ForegroundColor Yellow
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "NOTIFY pgrst, 'reload schema';"
Write-Host "[OK] Schema reloaded" -ForegroundColor Green
Write-Host ""

Write-Host "=== Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Before: $($currentTables.Trim()) tables"
Write-Host "  After: $($newTables.Trim()) tables"
Write-Host ""

# Clean up
Remove-Item Env:\PGPASSWORD
Remove-Item Env:\DATABASE_URL

