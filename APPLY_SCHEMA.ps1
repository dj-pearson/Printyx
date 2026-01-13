# Apply Complete Schema to Supabase Database
# Windows PowerShell version
# Usage: .\APPLY_SCHEMA.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Supabase Schema Migration ===" -ForegroundColor Green
Write-Host ""

# Database connection details
$DB_HOST = "127.0.0.1"
$DB_PORT = "5433"
$DB_NAME = "postgres"
$DB_USER = "postgres"
$DB_PASS = "Ta881v34EPbKK92E2F0oZpc4Els39giz"

$env:PGPASSWORD = $DB_PASS
$DATABASE_URL = "postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Test connection
Write-Host "Testing database connection..." -ForegroundColor Yellow
try {
    $testResult = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Connection failed"
    }
    Write-Host "[OK] Database connection successful" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Cannot connect to database!" -ForegroundColor Red
    Write-Host "Make sure PostgreSQL is running and connection details are correct." -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Create backup
Write-Host "Creating backup..." -ForegroundColor Yellow
$BackupFile = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema=public --no-owner --no-acl > $BackupFile
Write-Host "[OK] Backup created: $BackupFile" -ForegroundColor Green
Write-Host ""

# Apply complete schema
Write-Host "Applying complete schema from database-exports..." -ForegroundColor Yellow
if (Test-Path "database-exports\complete-with-schema.sql") {
    # Read and clean the SQL file
    Write-Host "  Reading SQL file..." -ForegroundColor Gray
    $sqlContent = Get-Content "database-exports\complete-with-schema.sql" -Raw
    
    Write-Host "  Cleaning SQL (removing NEON-specific commands)..." -ForegroundColor Gray
    $sqlContent = $sqlContent -replace 'OWNER TO neondb_owner;', ''
    $sqlContent = $sqlContent -replace 'ALTER .* OWNER TO neondb_owner;', ''
    $sqlContent = $sqlContent -replace 'OWNER TO postgres;', ''
    
    # Save cleaned SQL to temp file
    $tempFile = "temp_cleaned_schema.sql"
    $sqlContent | Out-File -FilePath $tempFile -Encoding UTF8
    
    Write-Host "  Applying to database..." -ForegroundColor Gray
    # Apply to database
    $applyResult = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $tempFile 2>&1 | Tee-Object -FilePath "schema_import.log"
    
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    Write-Host "[OK] Schema applied" -ForegroundColor Green
} else {
    Write-Host "[ERROR] database-exports\complete-with-schema.sql not found!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Apply Supabase migrations
Write-Host "Applying Supabase migrations..." -ForegroundColor Yellow
if (Test-Path "supabase\migrations") {
    Get-ChildItem "supabase\migrations\*.sql" | Sort-Object Name | ForEach-Object {
        Write-Host "  Applying: $($_.Name)" -ForegroundColor Gray
        $migrateResult = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $_.FullName 2>&1 | Where-Object { $_ -notmatch "NOTICE" }
    }
    Write-Host "[OK] Supabase migrations applied" -ForegroundColor Green
} else {
    Write-Host "[WARN] supabase\migrations folder not found, skipping" -ForegroundColor Yellow
}
Write-Host ""

# Apply RLS and fixes
Write-Host "Applying final fixes..." -ForegroundColor Yellow
if (Test-Path "setup-rls-policies.sql") {
    Write-Host "  Applying RLS policies..." -ForegroundColor Gray
    $rlsResult = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "setup-rls-policies.sql" 2>&1 | Where-Object { $_ -notmatch "NOTICE" }
}
if (Test-Path "fix-tenant-id-camelcase-v2.sql") {
    Write-Host "  Applying tenant ID fixes..." -ForegroundColor Gray
    $tenantResult = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "fix-tenant-id-camelcase-v2.sql" 2>&1 | Where-Object { $_ -notmatch "NOTICE" }
}
Write-Host "[OK] Fixes applied" -ForegroundColor Green
Write-Host ""

# Verify tables
Write-Host "Verifying tables..." -ForegroundColor Yellow
$countQuery = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
$TableCount = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $countQuery
$TableCountTrimmed = $TableCount.Trim()
Write-Host "  Tables created: $TableCountTrimmed" -ForegroundColor Gray
Write-Host ""

# List key tables (simpler approach)
Write-Host "Checking key tables..." -ForegroundColor Yellow
$keyTables = @('tenants', 'users', 'roles', 'teams', 'business_records', 'business_record_activities', 
               'service_tickets', 'equipment', 'quotes', 'invoices', 'deals', 'opportunities', 'tasks', 'projects')

foreach ($table in $keyTables) {
    $checkQuery = "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');"
    $exists = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $checkQuery
    if ($exists.Trim() -eq 't') {
        Write-Host "  [OK] $table" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $table" -ForegroundColor Red
    }
}
Write-Host ""

# Reload schema
Write-Host "Reloading PostgREST schema cache..." -ForegroundColor Yellow
$reloadResult = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "NOTIFY pgrst, 'reload schema';" 2>&1
Write-Host "[OK] Schema cache reloaded" -ForegroundColor Green
Write-Host ""

Write-Host "=== Migration Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  - Backup: $BackupFile"
Write-Host "  - Log: schema_import.log"
Write-Host "  - Tables: $TableCountTrimmed"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test Edge Functions at https://functions.printyx.net"
Write-Host "  2. Verify frontend at https://printyx.net"
Write-Host "  3. Check for any errors in schema_import.log"
Write-Host ""

# Clean up
Remove-Item Env:\PGPASSWORD
