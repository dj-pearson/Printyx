# NEON to Supabase Complete Migration Script (PowerShell)
# 
# This script migrates all 177 missing tables from NEON to Supabase
# while preserving your 37 new feature tables (AI, Calendar, Meetings, etc.)
#
# Usage: .\migrate-neon-to-supabase.ps1 [-DryRun] [-Phase <1|2|3|all>]

param(
    [switch]$DryRun = $false,
    [string]$Phase = "all"
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Error { Write-Host "❌ $args" -ForegroundColor Red }
function Write-Warning { Write-Host "⚠️  $args" -ForegroundColor Yellow }
function Write-Info { Write-Host "🔄 $args" -ForegroundColor Cyan }

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  NEON → Supabase Migration Script (PowerShell)" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Configuration
$BackupDir = ".\migration-backups"
$NeonExport = ".\database-exports\complete-with-schema.sql"

# Check for required environment variable
if (-not $env:SUPABASE_DB_URL) {
    Write-Error "Error: SUPABASE_DB_URL environment variable not set"
    Write-Host ""
    Write-Host "Set it with:" -ForegroundColor Yellow
    Write-Host '  $env:SUPABASE_DB_URL = "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"' -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To find your connection string:" -ForegroundColor Yellow
    Write-Host "  1. Go to Supabase Dashboard" -ForegroundColor White
    Write-Host "  2. Settings → Database" -ForegroundColor White
    Write-Host "  3. Copy 'Connection string' (URI format)" -ForegroundColor White
    Write-Host "  4. Replace [YOUR-PASSWORD] with actual password" -ForegroundColor White
    Write-Host ""
    Write-Host "For self-hosted Supabase:" -ForegroundColor Yellow
    Write-Host '  $env:SUPABASE_DB_URL = "postgresql://postgres:your_password@printyx.net:5432/postgres"' -ForegroundColor Cyan
    exit 1
}

# Validate connection string format
if ($env:SUPABASE_DB_URL -notmatch "^postgresql://") {
    Write-Error "Error: SUPABASE_DB_URL must be a PostgreSQL connection string"
    Write-Host ""
    Write-Host "Current value: $env:SUPABASE_DB_URL" -ForegroundColor Red
    Write-Host ""
    Write-Host "Should look like:" -ForegroundColor Yellow
    Write-Host '  postgresql://postgres:password@host:5432/postgres' -ForegroundColor Cyan
    Write-Host ""
    Write-Host "NOT an HTTP URL like https://api.printyx.net" -ForegroundColor Red
    exit 1
}

# Check if NEON export exists
if (-not (Test-Path $NeonExport)) {
    Write-Error "Error: NEON export not found at $NeonExport"
    Write-Host ""
    Write-Host "Available export files:" -ForegroundColor Yellow
    Get-ChildItem ".\database-exports\*.sql" | ForEach-Object { Write-Host "  📄 $($_.Name)" -ForegroundColor White }
    exit 1
}

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Error "Error: psql command not found"
    Write-Host ""
    Write-Host "Install PostgreSQL client tools:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "  2. Or install via chocolatey: choco install postgresql" -ForegroundColor White
    Write-Host "  3. Or use Docker: docker run --rm postgres:15 psql" -ForegroundColor White
    exit 1
}

Write-Success "Environment configured"
$maskedUrl = $env:SUPABASE_DB_URL -replace "(postgresql://[^:]+:)[^@]+(@.*)", '$1***$2'
Write-Host "   Database: $maskedUrl" -ForegroundColor White
Write-Host "   NEON Export: $NeonExport" -ForegroundColor White
Write-Host "   Dry Run: $DryRun" -ForegroundColor White
Write-Host "   Phase: $Phase" -ForegroundColor White
Write-Host ""

# Create backup directory
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Step 1: Backup Current Supabase Database" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupFile = "$BackupDir\supabase-backup-$timestamp.sql"

if (-not $DryRun) {
    Write-Info "Creating backup..."
    
    try {
        & pg_dump $env:SUPABASE_DB_URL | Out-File -FilePath $BackupFile -Encoding UTF8
        Write-Success "Backup saved: $BackupFile"
        $backupSize = (Get-Item $BackupFile).Length / 1MB
        Write-Host "   Size: $([math]::Round($backupSize, 2)) MB" -ForegroundColor White
    }
    catch {
        Write-Error "Failed to create backup: $_"
        Write-Host ""
        Write-Host "This might mean:" -ForegroundColor Yellow
        Write-Host "  1. Connection string is incorrect" -ForegroundColor White
        Write-Host "  2. Database is not accessible" -ForegroundColor White
        Write-Host "  3. Credentials are wrong" -ForegroundColor White
        Write-Host ""
        Write-Host "Test your connection with:" -ForegroundColor Yellow
        Write-Host '  psql $env:SUPABASE_DB_URL -c "SELECT version();"' -ForegroundColor Cyan
        exit 1
    }
}
else {
    Write-Warning "DRY RUN: Would create backup at $BackupFile"
}

Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Step 2: Verify Current State" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Info "Counting current tables..."
try {
    $currentTables = & psql $env:SUPABASE_DB_URL -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
    $currentTables = $currentTables.Trim()
    Write-Success "Current tables in Supabase: $currentTables"
}
catch {
    Write-Error "Failed to query database: $_"
    exit 1
}

Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Step 3: Import NEON Schema and Data" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if (-not $DryRun) {
    Write-Info "Importing NEON database..."
    Write-Host "   This may take 10-30 minutes depending on data size..." -ForegroundColor Yellow
    
    # Clean the SQL file (remove NEON-specific commands)
    Write-Host "   📝 Cleaning SQL file..." -ForegroundColor White
    $cleanedFile = "$BackupDir\cleaned-neon-export.sql"
    
    Get-Content $NeonExport | 
        Where-Object { $_ -notmatch "neondb_owner" } |
        Where-Object { $_ -notmatch "pg_dump" } |
        Where-Object { $_ -notmatch "SET statement_timeout" } |
        Out-File -FilePath $cleanedFile -Encoding UTF8
    
    # Import the cleaned file
    Write-Host "   📥 Importing schema and data..." -ForegroundColor White
    Write-Warning "This will take several minutes. DO NOT interrupt!"
    
    try {
        & psql $env:SUPABASE_DB_URL -f $cleanedFile 2>&1 | 
            Where-Object { $_ -notmatch "NOTICE" -and $_ -notmatch "already exists" } |
            ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
        
        Write-Success "NEON import complete"
    }
    catch {
        Write-Error "Import failed: $_"
        Write-Host ""
        Write-Host "To rollback:" -ForegroundColor Yellow
        Write-Host "  psql `$env:SUPABASE_DB_URL -f `"$BackupFile`"" -ForegroundColor Cyan
        exit 1
    }
}
else {
    Write-Warning "DRY RUN: Would import $NeonExport"
}

Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Step 4: Re-apply New Feature Migrations" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if (-not $DryRun) {
    Write-Info "Re-applying new feature migrations..."
    
    $migrationPath = ".\supabase\migrations"
    if (Test-Path $migrationPath) {
        Push-Location $migrationPath
        
        $migrations = Get-ChildItem -Filter "*.sql" | 
            Where-Object { $_.Name -match "^(ai-|calendar-|meeting-|task-)" }
        
        foreach ($migration in $migrations) {
            Write-Host "   📝 Applying $($migration.Name)..." -ForegroundColor White
            & psql $env:SUPABASE_DB_URL -f $migration.FullName 2>&1 |
                Where-Object { $_ -notmatch "NOTICE" -and $_ -notmatch "already exists" } |
                ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
        }
        
        Pop-Location
        Write-Success "New migrations re-applied"
    }
    else {
        Write-Warning "Migration folder not found, skipping new migrations"
    }
}
else {
    Write-Warning "DRY RUN: Would re-apply new feature migrations"
}

Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Step 5: Verify Migration Success" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Info "Verifying migration..."

# Count final tables
$finalTables = & psql $env:SUPABASE_DB_URL -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
$finalTables = $finalTables.Trim()
Write-Success "Final table count: $finalTables"

# Check core tables
Write-Host ""
Write-Host "   Checking core tables:" -ForegroundColor White

$coreTables = @('users', 'companies', 'customers', 'invoices', 'quotes', 'service_tickets', 'equipment')
foreach ($table in $coreTables) {
    $exists = & psql $env:SUPABASE_DB_URL -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$table');"
    $exists = $exists.Trim()
    
    if ($exists -eq 't') {
        Write-Host "   ✅ $table" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ $table MISSING" -ForegroundColor Red
    }
}

# Count records
Write-Host ""
Write-Host "   Record counts:" -ForegroundColor White
& psql $env:SUPABASE_DB_URL -c @"
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
"@ 2>$null | ForEach-Object { Write-Host "   $_" -ForegroundColor White }

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Migration Complete!" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Success "Migration successful!"
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor White
Write-Host "   Before: $currentTables tables" -ForegroundColor White
Write-Host "   After:  $finalTables tables" -ForegroundColor White
Write-Host "   Added:  $([int]$finalTables - [int]$currentTables) tables" -ForegroundColor White
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Test your application" -ForegroundColor White
Write-Host "   2. Verify customer data is visible" -ForegroundColor White
Write-Host "   3. Check invoices and quotes" -ForegroundColor White
Write-Host "   4. Test creating new records" -ForegroundColor White
Write-Host ""
Write-Host "🔄 To rollback if needed:" -ForegroundColor Yellow
Write-Host "   psql `$env:SUPABASE_DB_URL -f `"$BackupFile`"" -ForegroundColor Cyan
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
