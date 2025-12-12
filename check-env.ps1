# Quick Environment Variable Checker
Write-Host ""
Write-Host "=== Environment Variable Status ===" -ForegroundColor Cyan

# Check if .env file exists
$envExists = Test-Path .env
Write-Host ""
Write-Host "1. .env File:" -ForegroundColor Yellow
if ($envExists) {
    Write-Host "   OK .env file exists" -ForegroundColor Green
    Write-Host "   Location: $PWD\.env" -ForegroundColor Gray
} else {
    Write-Host "   ERROR .env file NOT found" -ForegroundColor Red
    Write-Host "   You need to create it for local development!" -ForegroundColor Yellow
}

# Check current PowerShell environment variables
Write-Host ""
Write-Host "2. Current PowerShell Session:" -ForegroundColor Yellow
$criticalVars = @('DATABASE_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SESSION_SECRET')

foreach ($var in $criticalVars) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if ($value) {
        Write-Host "   OK $var is set" -ForegroundColor Green
    } else {
        Write-Host "   ERROR $var is NOT set" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "3. Supabase Dashboard Variables:" -ForegroundColor Yellow
Write-Host "   INFO These are ONLY available when deployed to Supabase" -ForegroundColor Gray
Write-Host "   INFO For local dev, you need a .env file with the same values" -ForegroundColor Gray

Write-Host ""
Write-Host "=== What You Need To Do ===" -ForegroundColor Cyan

if (-not $envExists) {
    Write-Host ""
    Write-Host "ERROR Problem: No .env file for local development" -ForegroundColor Red
    Write-Host ""
    Write-Host "OK Solution: Create .env file with your Supabase values" -ForegroundColor Green
    Write-Host ""
    Write-Host "Run this command:" -ForegroundColor Yellow
    Write-Host "   .\setup-supabase-env.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "This will:" -ForegroundColor Gray
    Write-Host "   1. Ask for your Supabase URL (from Coolify dashboard)" -ForegroundColor Gray
    Write-Host "   2. Ask for your Supabase keys (from Supabase dashboard)" -ForegroundColor Gray
    Write-Host "   3. Ask for your database credentials" -ForegroundColor Gray
    Write-Host "   4. Create .env file with all values" -ForegroundColor Gray
    Write-Host "   5. Test the connection" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "OK .env file exists" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next: Test if it works:" -ForegroundColor Yellow
    Write-Host "   npx tsx test-auth-connection.ts" -ForegroundColor White
}

Write-Host ""
Write-Host "=== Understanding the Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Supabase Dashboard Variables (PRODUCTION):" -ForegroundColor Yellow
Write-Host "  - Used when code is DEPLOYED to Supabase/Coolify" -ForegroundColor Gray
Write-Host "  - Automatically injected by platform" -ForegroundColor Gray
Write-Host "  - Secure and encrypted" -ForegroundColor Gray
Write-Host ""
Write-Host "Local .env File (DEVELOPMENT):" -ForegroundColor Yellow
Write-Host "  - Used when running LOCALLY on your computer" -ForegroundColor Gray
Write-Host "  - You create this file manually" -ForegroundColor Gray
Write-Host "  - Contains same values as Supabase dashboard" -ForegroundColor Gray
Write-Host "  - Gitignored (never committed)" -ForegroundColor Gray
Write-Host ""
