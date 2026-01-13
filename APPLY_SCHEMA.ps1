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
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" | Out-Null
    Write-Host "✓ Database connection successful" -ForegroundColor Green
} catch {
    Write-Host "✗ Cannot connect to database!" -ForegroundColor Red
    Write-Host "Make sure PostgreSQL is running and connection details are correct." -ForegroundColor Red
    exit 1
}
Write-Host ""

# Create backup
Write-Host "Creating backup..." -ForegroundColor Yellow
$BackupFile = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema=public --no-owner --no-acl > $BackupFile
Write-Host "✓ Backup created: $BackupFile" -ForegroundColor Green
Write-Host ""

# Apply complete schema
Write-Host "Applying complete schema from database-exports..." -ForegroundColor Yellow
if (Test-Path "database-exports\complete-with-schema.sql") {
    # Read and clean the SQL file
    $sqlContent = Get-Content "database-exports\complete-with-schema.sql" -Raw
    $sqlContent = $sqlContent -replace 'OWNER TO neondb_owner;', '' `
                               -replace 'ALTER .* OWNER TO neondb_owner;', '' `
                               -replace 'OWNER TO postgres;', ''
    
    # Save cleaned SQL to temp file
    $tempFile = "temp_cleaned_schema.sql"
    $sqlContent | Out-File -FilePath $tempFile -Encoding UTF8
    
    # Apply to database
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $tempFile 2>&1 | Tee-Object -FilePath "schema_import.log"
    
    Remove-Item $tempFile
    Write-Host "✓ Schema applied" -ForegroundColor Green
} else {
    Write-Host "✗ database-exports\complete-with-schema.sql not found!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Apply Supabase migrations
Write-Host "Applying Supabase migrations..." -ForegroundColor Yellow
Get-ChildItem "supabase\migrations\*.sql" | Sort-Object Name | ForEach-Object {
    Write-Host "  Applying: $($_.Name)"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $_.FullName 2>&1 | Where-Object { $_ -notmatch "NOTICE" }
}
Write-Host "✓ Supabase migrations applied" -ForegroundColor Green
Write-Host ""

# Apply RLS and fixes
Write-Host "Applying final fixes..." -ForegroundColor Yellow
if (Test-Path "setup-rls-policies.sql") {
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "setup-rls-policies.sql" 2>&1 | Where-Object { $_ -notmatch "NOTICE" }
}
if (Test-Path "fix-tenant-id-camelcase-v2.sql") {
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "fix-tenant-id-camelcase-v2.sql" 2>&1 | Where-Object { $_ -notmatch "NOTICE" }
}
Write-Host "✓ Fixes applied" -ForegroundColor Green
Write-Host ""

# Verify tables
Write-Host "Verifying tables..." -ForegroundColor Yellow
$TableCount = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
Write-Host "Tables created: $($TableCount.Trim())"
Write-Host ""

# List key tables
Write-Host "Key tables status:" -ForegroundColor Yellow
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c @"
SELECT 
    table_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables t 
        WHERE t.table_schema = 'public' AND t.table_name = tables_to_check.table_name
    ) THEN '✓' ELSE '✗' END as exists
FROM (
    VALUES 
        ('tenants'),
        ('users'),
        ('roles'),
        ('teams'),
        ('business_records'),
        ('business_record_activities'),
        ('service_tickets'),
        ('equipment'),
        ('quotes'),
        ('invoices'),
        ('deals'),
        ('opportunities'),
        ('tasks'),
        ('projects')
) AS tables_to_check(table_name)
ORDER BY table_name;
"@
Write-Host ""

# Reload schema
Write-Host "Reloading PostgREST schema cache..." -ForegroundColor Yellow
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "NOTIFY pgrst, 'reload schema';" | Out-Null
Write-Host "✓ Schema cache reloaded" -ForegroundColor Green
Write-Host ""

Write-Host "=== Migration Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:"
Write-Host "  - Backup: $BackupFile"
Write-Host "  - Log: schema_import.log"
Write-Host "  - Tables: $($TableCount.Trim())"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test Edge Functions at https://functions.printyx.net"
Write-Host "  2. Verify frontend at https://printyx.net"
Write-Host "  3. Check for any errors in schema_import.log"
Write-Host ""

# Clean up
Remove-Item Env:\PGPASSWORD

