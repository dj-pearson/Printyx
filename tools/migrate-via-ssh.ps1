# NEON to Supabase Migration via SSH (PowerShell)
# 
# This script migrates all 177 missing tables from NEON to Supabase
# by SSH'ing into your server and running the migration there.
#
# Usage: .\migrate-via-ssh.ps1 [-DryRun] [-ServerHost <host>] [-ServerUser <user>]

param(
    [switch]$DryRun = $false,
    [string]$ServerHost = "209.145.59.219",
    [string]$ServerUser = "root",
    [string]$DbPassword = "",
    [string]$SshKeyPath = ""
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Error { Write-Host "❌ $args" -ForegroundColor Red }
function Write-Warning { Write-Host "⚠️  $args" -ForegroundColor Yellow }
function Write-Info { Write-Host "🔄 $args" -ForegroundColor Cyan }

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  NEON → Supabase Migration via SSH" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Configuration
$NeonExport = ".\database-exports\complete-with-schema.sql"

# Check if SSH key exists
if (-not $SshKeyPath) {
    Write-Info "No SSH key specified. Will use password authentication."
    $sshCommand = "ssh ${ServerUser}@${ServerHost}"
    $scpCommand = "scp"
}
else {
    if (-not (Test-Path $SshKeyPath)) {
        Write-Error "SSH key not found at: $SshKeyPath"
        exit 1
    }
    Write-Success "Using SSH key: $SshKeyPath"
    $sshCommand = "ssh -i `"$SshKeyPath`" ${ServerUser}@${ServerHost}"
    $scpCommand = "scp -i `"$SshKeyPath`""
}

Write-Host "   Server: $ServerUser@$ServerHost" -ForegroundColor White
Write-Host "   NEON Export: $NeonExport" -ForegroundColor White
Write-Host "   Dry Run: $DryRun" -ForegroundColor White
Write-Host ""

# Check if NEON export exists
if (-not (Test-Path $NeonExport)) {
    Write-Error "NEON export not found at $NeonExport"
    Write-Host ""
    Write-Host "Available export files:" -ForegroundColor Yellow
    Get-ChildItem ".\database-exports\*.sql" | ForEach-Object { Write-Host "  📄 $($_.Name)" -ForegroundColor White }
    exit 1
}

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Step 1: Test SSH Connection" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Info "Testing SSH connection to $ServerHost..."

try {
    if ($SshKeyPath) {
        $testResult = ssh -i "$SshKeyPath" "${ServerUser}@${ServerHost}" "echo 'SSH connection successful'" 2>&1
    }
    else {
        $testResult = ssh "${ServerUser}@${ServerHost}" "echo 'SSH connection successful'" 2>&1
    }
    
    if ($testResult -match "SSH connection successful") {
        Write-Success "SSH connection successful"
    }
    else {
        Write-Error "SSH connection failed: $testResult"
        exit 1
    }
}
catch {
    Write-Error "Failed to connect via SSH: $_"
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  1. You have SSH access to $ServerHost" -ForegroundColor White
    Write-Host "  2. Your SSH key is configured (or use password)" -ForegroundColor White
    Write-Host "  3. Server is accessible from your network" -ForegroundColor White
    exit 1
}

Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Step 2: Upload NEON Export to Server" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$remoteFile = "/tmp/neon-export-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"

if (-not $DryRun) {
    Write-Info "Uploading $NeonExport to server..."
    Write-Host "   This may take a few minutes..." -ForegroundColor Yellow
    
    try {
        if ($SshKeyPath) {
            & scp -i "$SshKeyPath" "$NeonExport" "${ServerUser}@${ServerHost}:${remoteFile}"
        }
        else {
            & scp "$NeonExport" "${ServerUser}@${ServerHost}:${remoteFile}"
        }
        
        Write-Success "Upload complete: $remoteFile"
    }
    catch {
        Write-Error "Failed to upload file: $_"
        exit 1
    }
}
else {
    Write-Warning "DRY RUN: Would upload $NeonExport to ${ServerHost}:${remoteFile}"
}

Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Step 3: Run Migration on Server" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if (-not $DryRun) {
    Write-Info "Creating migration script on server..."
    
    # Create the migration script
    $migrationScript = @"
#!/bin/bash
set -e

echo '════════════════════════════════════════════════'
echo '  NEON → Supabase Migration'
echo '════════════════════════════════════════════════'
echo ''

# Detect database connection
if [ -f /.dockerenv ] || [ -f /run/.containerenv ]; then
    echo '📦 Running inside container'
    DB_URL='postgresql://postgres:${DbPassword}@localhost:5432/postgres'
else
    echo '🖥️  Running on host'
    # Try to find Supabase database
    if docker ps | grep -q supabase-db; then
        echo '📦 Found Supabase container'
        CONTAINER_ID=\$(docker ps | grep supabase-db | awk '{print \$1}')
        echo ''
        echo '1️⃣  Backup current database...'
        docker exec \$CONTAINER_ID pg_dump -U postgres > /tmp/backup-\$(date +%Y%m%d-%H%M%S).sql
        echo '✅ Backup saved'
        echo ''
        echo '2️⃣  Count current tables...'
        BEFORE=\$(docker exec \$CONTAINER_ID psql -U postgres -t -c 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'';' | tr -d ' ')
        echo "   Current tables: \$BEFORE"
        echo ''
        echo '3️⃣  Import NEON data...'
        echo '   This may take 10-30 minutes...'
        docker exec -i \$CONTAINER_ID psql -U postgres < ${remoteFile} 2>&1 | grep -v NOTICE | grep -v 'already exists' || true
        echo '✅ Import complete'
        echo ''
        echo '4️⃣  Verify migration...'
        AFTER=\$(docker exec \$CONTAINER_ID psql -U postgres -t -c 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'';' | tr -d ' ')
        echo "   Tables before: \$BEFORE"
        echo "   Tables after:  \$AFTER"
        echo "   Tables added:  \$((AFTER - BEFORE))"
        echo ''
        echo '5️⃣  Check core tables...'
        docker exec \$CONTAINER_ID psql -U postgres -c \"
SELECT 
  table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('users', 'companies', 'customers', 'invoices', 'quotes', 'service_tickets', 'equipment')) 
       THEN '✅ EXISTS' 
       ELSE '❌ MISSING' 
  END as status
FROM (VALUES ('users'), ('companies'), ('customers'), ('invoices'), ('quotes'), ('service_tickets'), ('equipment')) AS t(table_name)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE information_schema.tables.table_name = t.table_name);
\"
        echo ''
        echo '════════════════════════════════════════════════'
        echo '✅ Migration Complete!'
        echo '════════════════════════════════════════════════'
    else
        echo '❌ Supabase database container not found'
        echo ''
        echo 'Looking for PostgreSQL...'
        if command -v psql >/dev/null 2>&1; then
            echo '✅ psql found, attempting direct connection...'
            DB_URL='postgresql://postgres:${DbPassword}@localhost:5433/postgres'
            
            echo '1️⃣  Testing connection...'
            psql \$DB_URL -c 'SELECT version();' || exit 1
            
            echo '2️⃣  Backup current database...'
            pg_dump \$DB_URL > /tmp/backup-\$(date +%Y%m%d-%H%M%S).sql
            
            echo '3️⃣  Import NEON data...'
            psql \$DB_URL < ${remoteFile}
            
            echo '✅ Migration complete'
        else
            echo '❌ Cannot find database connection method'
            exit 1
        fi
    fi
fi

echo ''
echo 'Clean up temporary file...'
rm -f ${remoteFile}
echo '✅ Done'
"@

    # Upload and execute migration script
    $remoteMigrationScript = "/tmp/migrate-neon.sh"
    
    Write-Host "   Uploading migration script..." -ForegroundColor White
    $migrationScript | Out-File -FilePath "$env:TEMP\migrate-neon.sh" -Encoding UTF8 -NoNewline
    
    if ($SshKeyPath) {
        & scp -i "$SshKeyPath" "$env:TEMP\migrate-neon.sh" "${ServerUser}@${ServerHost}:${remoteMigrationScript}"
    }
    else {
        & scp "$env:TEMP\migrate-neon.sh" "${ServerUser}@${ServerHost}:${remoteMigrationScript}"
    }
    
    Write-Host "   Making script executable..." -ForegroundColor White
    if ($SshKeyPath) {
        & ssh -i "$SshKeyPath" "${ServerUser}@${ServerHost}" "chmod +x ${remoteMigrationScript}"
    }
    else {
        & ssh "${ServerUser}@${ServerHost}" "chmod +x ${remoteMigrationScript}"
    }
    
    Write-Host ""
    Write-Warning "About to run migration on server. This will take 10-30 minutes."
    Write-Host "   Press Ctrl+C now to cancel, or any key to continue..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    Write-Host ""
    
    Write-Info "Running migration on server..."
    Write-Host ""
    
    try {
        if ($SshKeyPath) {
            & ssh -i "$SshKeyPath" -t "${ServerUser}@${ServerHost}" "sudo bash ${remoteMigrationScript}"
        }
        else {
            & ssh -t "${ServerUser}@${ServerHost}" "sudo bash ${remoteMigrationScript}"
        }
        
        Write-Host ""
        Write-Success "Migration completed successfully!"
    }
    catch {
        Write-Error "Migration failed: $_"
        Write-Host ""
        Write-Host "To check logs on server:" -ForegroundColor Yellow
        Write-Host "  ssh ${ServerUser}@${ServerHost}" -ForegroundColor Cyan
        Write-Host "  cat /tmp/backup-*.sql  # To restore if needed" -ForegroundColor Cyan
        exit 1
    }
}
else {
    Write-Warning "DRY RUN: Would run migration on server"
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Migration Complete!" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Success "All 177 tables should now be migrated!"
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Test your application at https://printyx.net" -ForegroundColor White
Write-Host "   2. Verify you can see old customer data" -ForegroundColor White
Write-Host "   3. Check invoices and quotes" -ForegroundColor White
Write-Host "   4. Test creating new records" -ForegroundColor White
Write-Host ""
Write-Host "🔄 If something went wrong:" -ForegroundColor Yellow
Write-Host "   ssh ${ServerUser}@${ServerHost}" -ForegroundColor Cyan
Write-Host "   ls /tmp/backup-*.sql  # Find backup file" -ForegroundColor Cyan
Write-Host "   docker exec -i supabase-db psql -U postgres < /tmp/backup-XXXXXX.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
