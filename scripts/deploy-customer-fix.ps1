# Customer Creation Fix - Quick Deployment Script
# Date: January 15, 2026

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Customer Creation Fix - Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "migrations/002_add_foreign_key_constraints.sql")) {
    Write-Host "ERROR: Please run this script from the Printyx project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Pre-Migration Checks" -ForegroundColor Yellow
Write-Host "Running database checks to identify potential issues..." -ForegroundColor Gray
Write-Host ""

# Ask user if they want to run pre-migration checks
$runChecks = Read-Host "Run pre-migration checks? (recommended) [Y/n]"
if ($runChecks -eq "" -or $runChecks -eq "Y" -or $runChecks -eq "y") {
    Write-Host "Running checks via Supabase CLI..." -ForegroundColor Gray
    supabase db execute -f migrations/002_pre_migration_checks.sql
    
    Write-Host ""
    $continue = Read-Host "Did the checks pass (no rows returned)? [Y/n]"
    if ($continue -eq "n" -or $continue -eq "N") {
        Write-Host ""
        Write-Host "Data issues found. Running cleanup script..." -ForegroundColor Yellow
        
        $runCleanup = Read-Host "Run data cleanup script? (recommended) [Y/n]"
        if ($runCleanup -eq "" -or $runCleanup -eq "Y" -or $runCleanup -eq "y") {
            Write-Host "Running cleanup..." -ForegroundColor Gray
            supabase db execute -f migrations/002_data_cleanup.sql
            
            if ($LASTEXITCODE -ne 0) {
                Write-Host "ERROR: Data cleanup failed. Check the error above." -ForegroundColor Red
                exit 1
            }
            
            Write-Host "✓ Data cleanup completed" -ForegroundColor Green
            Write-Host ""
            Write-Host "IMPORTANT: Review the cleanup log above to see which records were affected." -ForegroundColor Yellow
            Write-Host ""
            
            $continueAfterCleanup = Read-Host "Continue with migration? [Y/n]"
            if ($continueAfterCleanup -eq "n" -or $continueAfterCleanup -eq "N") {
                Write-Host "Stopping. You can review the changes and run this script again." -ForegroundColor Yellow
                exit 0
            }
        } else {
            Write-Host "Please manually fix the data issues before continuing." -ForegroundColor Red
            Write-Host "See migrations/MIGRATION_ORDER.md for guidance." -ForegroundColor Yellow
            exit 1
        }
    }
}

Write-Host ""
Write-Host "Step 2: Apply Database Migration" -ForegroundColor Yellow
Write-Host "This will:" -ForegroundColor Gray
Write-Host "  - Convert column types to UUID" -ForegroundColor Gray
Write-Host "  - Add foreign key constraints" -ForegroundColor Gray
Write-Host "  - Create performance indexes" -ForegroundColor Gray
Write-Host ""

$applyMigration = Read-Host "Apply database migration? [Y/n]"
if ($applyMigration -eq "" -or $applyMigration -eq "Y" -or $applyMigration -eq "y") {
    Write-Host "Applying migration..." -ForegroundColor Gray
    supabase db push
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Migration failed. Check the error above." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Migration applied successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 3: Deploy Edge Function" -ForegroundColor Yellow
Write-Host "Deploying updated customers edge function..." -ForegroundColor Gray
Write-Host ""

$deployFunction = Read-Host "Deploy customers edge function? [Y/n]"
if ($deployFunction -eq "" -or $deployFunction -eq "Y" -or $deployFunction -eq "y") {
    Write-Host "Deploying..." -ForegroundColor Gray
    supabase functions deploy customers
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Edge function deployment failed. Check the error above." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Edge function deployed successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 4: Deploy Frontend" -ForegroundColor Yellow
Write-Host "Building and deploying frontend..." -ForegroundColor Gray
Write-Host ""

$deployFrontend = Read-Host "Deploy frontend? [Y/n]"
if ($deployFrontend -eq "" -or $deployFrontend -eq "Y" -or $deployFrontend -eq "y") {
    Write-Host "Building client..." -ForegroundColor Gray
    Set-Location client
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Frontend build failed. Check the error above." -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    
    Write-Host "✓ Frontend built successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "NOTE: You need to deploy the build manually to Cloudflare Pages or your hosting platform." -ForegroundColor Yellow
    Write-Host "The build is in client/dist/" -ForegroundColor Gray
    
    Set-Location ..
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. If you haven't already, deploy the frontend build to your hosting platform" -ForegroundColor Gray
Write-Host "2. Test customer creation at https://printyx.net/customers?tab=active" -ForegroundColor Gray
Write-Host "3. Check browser console for any errors" -ForegroundColor Gray
Write-Host "4. Review CUSTOMER_CREATION_FIX_SUMMARY.md for testing checklist" -ForegroundColor Gray
Write-Host ""
Write-Host "If you encounter issues, see CUSTOMER_CREATION_FIX_DEPLOYMENT.md for troubleshooting." -ForegroundColor Gray
Write-Host ""
