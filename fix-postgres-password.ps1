# Simple PowerShell script to fix Supabase PostgreSQL password
# This fixes the "invalid_password" error for supabase_admin

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Fix Supabase PostgreSQL Password" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Prompt for the new password
$NEW_PASSWORD = Read-Host "Enter your NEW PostgreSQL password (must match POSTGRES_PASSWORD in Coolify)"

# Find PostgreSQL containers
Write-Host ""
Write-Host "Finding PostgreSQL containers..." -ForegroundColor Yellow
Write-Host ""

# Get all postgres containers with details
$allContainers = docker ps --format "{{.Names}}|{{.Image}}|{{.Status}}" | Select-String -Pattern "(postgres|supabase)" 

if (-not $allContainers) {
    Write-Host "❌ ERROR: Could not find any PostgreSQL/Supabase containers" -ForegroundColor Red
    Write-Host ""
    Write-Host "All running containers:" -ForegroundColor Yellow
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
    Write-Host ""
    exit 1
}

# Display containers with numbers
Write-Host "Found PostgreSQL/Supabase containers:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

$containerList = @()
$index = 1

foreach ($container in $allContainers) {
    $parts = $container.ToString().Split('|')
    $name = $parts[0]
    $image = $parts[1]
    $status = $parts[2]
    
    $containerList += $name
    
    # Highlight if it contains "printyx"
    if ($name -like "*printyx*") {
        Write-Host "  [$index] " -NoNewline -ForegroundColor Green
        Write-Host "$name" -ForegroundColor Green -NoNewline
        Write-Host " ⭐ (Likely PrintyxSupabase)" -ForegroundColor Yellow
    } else {
        Write-Host "  [$index] $name" -ForegroundColor White
    }
    Write-Host "      Image: $image" -ForegroundColor Gray
    Write-Host "      Status: $status" -ForegroundColor Gray
    Write-Host ""
    
    $index++
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Let user choose
if ($containerList.Count -eq 1) {
    $POSTGRES_CONTAINER = $containerList[0]
    Write-Host "Using: $POSTGRES_CONTAINER" -ForegroundColor Green
} else {
    $selection = Read-Host "Select the PostgreSQL container number for PrintyxSupabase [1-$($containerList.Count)]"
    
    try {
        $selectedIndex = [int]$selection - 1
        if ($selectedIndex -ge 0 -and $selectedIndex -lt $containerList.Count) {
            $POSTGRES_CONTAINER = $containerList[$selectedIndex]
            Write-Host ""
            Write-Host "✅ Selected: $POSTGRES_CONTAINER" -ForegroundColor Green
        } else {
            Write-Host "❌ Invalid selection" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "❌ Invalid input" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Update passwords
Write-Host "Updating PostgreSQL passwords..." -ForegroundColor Yellow
Write-Host ""

$updateSQL = @"
ALTER USER postgres WITH PASSWORD '$NEW_PASSWORD';
ALTER USER supabase_admin WITH PASSWORD '$NEW_PASSWORD';
SELECT 'Passwords updated successfully!' as result;
"@

$result = $updateSQL | docker exec -i $POSTGRES_CONTAINER psql -U postgres -d postgres 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ SUCCESS! PostgreSQL passwords updated" -ForegroundColor Green
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "NEXT STEPS:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Go to Coolify → Your Supabase Service → Environment" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Verify these variables match your new password:" -ForegroundColor White
    Write-Host "   • POSTGRES_PASSWORD" -ForegroundColor Yellow
    Write-Host "   • DB_PASSWORD" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "3. Restart all Supabase services in Coolify" -ForegroundColor White
    Write-Host ""
    Write-Host "4. Check Analytics/Logflare logs:" -ForegroundColor White
    Write-Host "   Should see GREEN status with no password errors ✨" -ForegroundColor Green
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ ERROR: Failed to update passwords" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor Yellow
    Write-Host $result -ForegroundColor Red
    Write-Host ""
    Write-Host "Try connecting manually:" -ForegroundColor Yellow
    Write-Host "docker exec -it $POSTGRES_CONTAINER psql -U postgres -d postgres" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run:" -ForegroundColor Yellow
    Write-Host "ALTER USER supabase_admin WITH PASSWORD 'your-password';" -ForegroundColor White
}

