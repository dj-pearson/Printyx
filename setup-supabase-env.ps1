# PowerShell Script to Set Up Supabase Environment Variables
# For Coolify/Self-hosted Supabase + Cloudflare deployment

Write-Host "`n=== Supabase Environment Setup Script ===" -ForegroundColor Cyan
Write-Host "For Coolify + Self-hosted Supabase + Cloudflare" -ForegroundColor Yellow
Write-Host ""

# Check if .env file exists
$envFile = ".env"
$envExists = Test-Path $envFile

if ($envExists) {
    Write-Host "✓ Found existing .env file" -ForegroundColor Green
    Write-Host "This script will add/update Supabase configuration" -ForegroundColor Yellow
} else {
    Write-Host "ℹ No .env file found. Will create one." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Coolify/Supabase Configuration ===" -ForegroundColor Cyan
Write-Host ""

# Get Supabase Kong URL from Coolify
Write-Host "From your Coolify dashboard, find these values:" -ForegroundColor Yellow
Write-Host "  SERVICE_URL_SUPABASEKONG or SERVICE_FQDN_SUPABASEKONG" -ForegroundColor Gray
Write-Host ""

$supabaseUrl = Read-Host "Supabase URL (e.g., https://api.yourdomain.com)"
if ([string]::IsNullOrWhiteSpace($supabaseUrl)) {
    Write-Host "❌ Supabase URL is required!" -ForegroundColor Red
    exit 1
}

# Get Supabase Anon Key
Write-Host ""
Write-Host "From Supabase Dashboard → Settings → API:" -ForegroundColor Yellow
$anonKey = Read-Host "Supabase Anon Key"
if ([string]::IsNullOrWhiteSpace($anonKey)) {
    Write-Host "❌ Supabase Anon Key is required!" -ForegroundColor Red
    exit 1
}

# Get Functions URL
Write-Host ""
$functionsUrl = Read-Host "Functions URL [https://functions.yourdomain.com]"
if ([string]::IsNullOrWhiteSpace($functionsUrl)) { 
    $functionsUrl = "https://functions.yourdomain.com" 
}

# Get Service Role Key (optional but recommended for backend)
Write-Host ""
Write-Host "Service Role Key (optional, for backend operations):" -ForegroundColor Yellow
$serviceRoleKey = Read-Host "Supabase Service Role Key (press Enter to skip)"

Write-Host ""
Write-Host "=== Database Configuration ===" -ForegroundColor Cyan
Write-Host "Now we need to construct the DATABASE_URL for your backend" -ForegroundColor Yellow
Write-Host ""

# Database details (from env.template)
$dbHost = Read-Host "Database Host [YOUR_SERVER_IP]"
if ([string]::IsNullOrWhiteSpace($dbHost)) { 
    Write-Host "⚠ You must provide a database host!" -ForegroundColor Yellow
    $dbHost = Read-Host "Database Host (required)"
}

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
Write-Host "=== Configuration Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Supabase URL:      $supabaseUrl" -ForegroundColor Yellow
Write-Host "Functions URL:     $functionsUrl" -ForegroundColor Yellow
Write-Host "Anon Key:          ${anonKey.Substring(0, [Math]::Min(20, $anonKey.Length))}..." -ForegroundColor Yellow
Write-Host "Database URL:      postgresql://${dbUser}:****@${dbHost}:${dbPort}/${dbName}" -ForegroundColor Yellow
if (-not [string]::IsNullOrWhiteSpace($serviceRoleKey)) {
    Write-Host "Service Role Key:  ${serviceRoleKey.Substring(0, [Math]::Min(20, $serviceRoleKey.Length))}..." -ForegroundColor Yellow
}

# Generate SESSION_SECRET if not exists
$sessionSecret = ""
if ($envExists) {
    $content = Get-Content $envFile -Raw
    if ($content -match "SESSION_SECRET=(.+)") {
        $sessionSecret = $matches[1].Trim()
        Write-Host "Session Secret:    Using existing" -ForegroundColor Green
    }
}

if ([string]::IsNullOrWhiteSpace($sessionSecret)) {
    Write-Host "Generating new SESSION_SECRET..." -ForegroundColor Yellow
    $sessionSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    Write-Host "Session Secret:    Generated" -ForegroundColor Green
}

# Create or update .env file
Write-Host ""
Write-Host "Writing to .env file..." -ForegroundColor Cyan

if ($envExists) {
    # Update existing .env file
    $content = Get-Content $envFile -Raw
    
    # Update or add each variable
    $variables = @{
        "DATABASE_URL" = $databaseUrl
        "SESSION_SECRET" = $sessionSecret
        "VITE_SUPABASE_URL" = $supabaseUrl
        "VITE_SUPABASE_ANON_KEY" = $anonKey
        "VITE_FUNCTIONS_URL" = $functionsUrl
    }
    
    if (-not [string]::IsNullOrWhiteSpace($serviceRoleKey)) {
        $variables["SUPABASE_SERVICE_ROLE_KEY"] = $serviceRoleKey
    }
    
    foreach ($key in $variables.Keys) {
        $value = $variables[$key]
        if ($content -match "${key}=.+") {
            $content = $content -replace "${key}=.+", "${key}=${value}"
        } else {
            $content = $content + "`n${key}=${value}"
        }
    }
    
    $content | Out-File -FilePath $envFile -Encoding utf8 -Force
} else {
    # Create new .env file
    $envContent = @"
# ============================================================================
# Backend Configuration
# ============================================================================

# Database Connection (PostgreSQL)
DATABASE_URL=$databaseUrl

# Session Security
SESSION_SECRET=$sessionSecret

# Application Settings
NODE_ENV=development
PORT=5000

# ============================================================================
# Supabase Configuration (Self-hosted via Coolify)
# ============================================================================

# Supabase API URL (from SERVICE_URL_SUPABASEKONG or SERVICE_FQDN_SUPABASEKONG)
VITE_SUPABASE_URL=$supabaseUrl

# Supabase Anonymous Key (public key for frontend)
VITE_SUPABASE_ANON_KEY=$anonKey

# Edge Functions URL
VITE_FUNCTIONS_URL=$functionsUrl
"@

    if (-not [string]::IsNullOrWhiteSpace($serviceRoleKey)) {
        $envContent += @"

# Supabase Service Role Key (private key for backend operations)
SUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey
"@
    }

    $envContent += @"

# ============================================================================
# Optional: Database Connection Pool Settings
# ============================================================================
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_CONNECTION_TIMEOUT_MS=10000
DB_IDLE_TIMEOUT_MS=30000
"@
    
    $envContent | Out-File -FilePath $envFile -Encoding utf8 -Force
}

Write-Host "✓ .env file created/updated successfully!" -ForegroundColor Green

# Display Cloudflare instructions
Write-Host ""
Write-Host "=== Cloudflare Environment Variables ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Add these to your Cloudflare Pages project settings:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Variable Name                 Value" -ForegroundColor White
Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "VITE_SUPABASE_URL             $supabaseUrl" -ForegroundColor Yellow
Write-Host "VITE_SUPABASE_ANON_KEY        $anonKey" -ForegroundColor Yellow
Write-Host "VITE_FUNCTIONS_URL            $functionsUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "To add these in Cloudflare Pages:" -ForegroundColor Cyan
Write-Host "1. Go to Cloudflare Dashboard → Pages → Your Project" -ForegroundColor White
Write-Host "2. Settings → Environment Variables" -ForegroundColor White
Write-Host "3. Add each variable above" -ForegroundColor White
Write-Host "4. Redeploy your site" -ForegroundColor White

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
    Write-Host "1. ✓ Local .env file configured" -ForegroundColor Green
    Write-Host "2. ☐ Add variables to Cloudflare (see above)" -ForegroundColor Yellow
    Write-Host "3. ☐ Start local server: npm run dev" -ForegroundColor Yellow
    Write-Host "4. ☐ Test login at http://localhost:5000/login" -ForegroundColor Yellow
    Write-Host "5. ☐ Deploy to Cloudflare Pages" -ForegroundColor Yellow
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "⚠ Connection test had issues, but .env file is configured" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You can:" -ForegroundColor Cyan
    Write-Host "1. Check your database credentials" -ForegroundColor White
    Write-Host "2. Verify database is running" -ForegroundColor White
    Write-Host "3. Try starting the server: npm run dev" -ForegroundColor White
    Write-Host ""
}

# Save Cloudflare instructions to file
$cloudflareInstructions = @"
# Cloudflare Pages Environment Variables

Add these to your Cloudflare Pages project:

1. Go to: Cloudflare Dashboard → Pages → Your Project
2. Navigate to: Settings → Environment Variables
3. Add the following:

Variable Name               Value
────────────────────────────────────────────────────────────
VITE_SUPABASE_URL           $supabaseUrl
VITE_SUPABASE_ANON_KEY      $anonKey
VITE_FUNCTIONS_URL          $functionsUrl

## Important Notes:

- These variables are prefixed with VITE_ because they're used in the frontend
- They will be embedded in your client-side code during build
- The ANON_KEY is safe to expose publicly (it's rate-limited)
- DO NOT add DATABASE_URL or SESSION_SECRET to Cloudflare (backend only)

## After Adding Variables:

1. Save the environment variables
2. Trigger a new deployment (Settings → Deployments → Retry deployment)
3. Your frontend will now connect to your Supabase instance

## Testing:

After deployment, check your browser console:
- It should connect to: $supabaseUrl
- No CORS errors should appear
- API calls should work

"@

$cloudflareInstructions | Out-File -FilePath "CLOUDFLARE_ENV_VARS.txt" -Encoding utf8 -Force
Write-Host "📄 Cloudflare instructions saved to: CLOUDFLARE_ENV_VARS.txt" -ForegroundColor Cyan

