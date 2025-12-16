# PowerShell Script to Set Up DATABASE_URL
# This script helps you configure the DATABASE_URL environment variable

Write-Host "`n=== Database URL Setup Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
$envFile = ".env"
$envExists = Test-Path $envFile

if ($envExists) {
    Write-Host "✓ Found existing .env file" -ForegroundColor Green
    $content = Get-Content $envFile -Raw
    
    if ($content -match "DATABASE_URL=") {
        Write-Host "⚠ DATABASE_URL already exists in .env" -ForegroundColor Yellow
        $overwrite = Read-Host "Do you want to update it? (y/n)"
        if ($overwrite -ne "y") {
            Write-Host "Exiting..." -ForegroundColor Yellow
            exit
        }
    }
} else {
    Write-Host "ℹ No .env file found. Will create one." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Please provide your database connection details:" -ForegroundColor Cyan
Write-Host "(Press Enter to use default values shown in brackets)" -ForegroundColor Gray
Write-Host ""

# Get database details
$dbHost = Read-Host "Database Host [localhost]"
if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "localhost" }

$dbPort = Read-Host "Database Port [5432]"
if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "5432" }

$dbUser = Read-Host "Database User [postgres]"
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "postgres" }

$dbPassword = Read-Host "Database Password" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword)
)

if ([string]::IsNullOrWhiteSpace($dbPasswordPlain)) {
    Write-Host "❌ Database password is required!" -ForegroundColor Red
    exit 1
}

$dbName = Read-Host "Database Name [postgres]"
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "postgres" }

# Construct DATABASE_URL
$databaseUrl = "postgresql://${dbUser}:${dbPasswordPlain}@${dbHost}:${dbPort}/${dbName}"

Write-Host ""
Write-Host "Constructed DATABASE_URL:" -ForegroundColor Cyan
Write-Host "postgresql://${dbUser}:****@${dbHost}:${dbPort}/${dbName}" -ForegroundColor Yellow

# Generate SESSION_SECRET if not exists
$sessionSecret = ""
if ($envExists) {
    $content = Get-Content $envFile -Raw
    if ($content -match "SESSION_SECRET=(.+)") {
        $sessionSecret = $matches[1].Trim()
        Write-Host "✓ Using existing SESSION_SECRET" -ForegroundColor Green
    }
}

if ([string]::IsNullOrWhiteSpace($sessionSecret)) {
    Write-Host "Generating new SESSION_SECRET..." -ForegroundColor Yellow
    $sessionSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    Write-Host "✓ Generated new SESSION_SECRET" -ForegroundColor Green
}

# Create or update .env file
Write-Host ""
Write-Host "Writing to .env file..." -ForegroundColor Cyan

if ($envExists) {
    # Update existing .env file
    $content = Get-Content $envFile -Raw
    
    # Update or add DATABASE_URL
    if ($content -match "DATABASE_URL=.+") {
        $content = $content -replace "DATABASE_URL=.+", "DATABASE_URL=$databaseUrl"
    } else {
        $content = "DATABASE_URL=$databaseUrl`n" + $content
    }
    
    # Update or add SESSION_SECRET if it was newly generated
    if ($content -notmatch "SESSION_SECRET=") {
        $content = $content + "`nSESSION_SECRET=$sessionSecret"
    }
    
    $content | Out-File -FilePath $envFile -Encoding utf8 -Force
} else {
    # Create new .env file
    $envContent = @"
# Database Connection
DATABASE_URL=$databaseUrl

# Session Security
SESSION_SECRET=$sessionSecret

# Application Settings
NODE_ENV=development
PORT=5000

# Optional: Database connection pool settings
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_CONNECTION_TIMEOUT_MS=10000
DB_IDLE_TIMEOUT_MS=30000
"@
    
    $envContent | Out-File -FilePath $envFile -Encoding utf8 -Force
}

Write-Host "✓ .env file created/updated successfully!" -ForegroundColor Green

# Test the connection
Write-Host ""
Write-Host "Testing database connection..." -ForegroundColor Cyan
Write-Host ""

$env:DATABASE_URL = $databaseUrl
$env:SESSION_SECRET = $sessionSecret

try {
    npx tsx test-auth-connection.ts
    
    Write-Host ""
    Write-Host "=== Setup Complete ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Review the diagnostic output above" -ForegroundColor White
    Write-Host "2. If all checks passed, start the server: npm run dev" -ForegroundColor White
    Write-Host "3. Navigate to http://localhost:5000/login" -ForegroundColor White
    Write-Host "4. Try logging in with your credentials" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ Connection test failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "- Database password is correct" -ForegroundColor White
    Write-Host "- Database server is running and accessible" -ForegroundColor White
    Write-Host "- Firewall allows connection to port $dbPort" -ForegroundColor White
    Write-Host ""
}

