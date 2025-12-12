# Test CORS Configuration
Write-Host ""
Write-Host "=== Testing CORS Configuration ===" -ForegroundColor Cyan
Write-Host ""

$apiUrl = "https://api.printyx.net"
$origin = "https://printyx.net"

Write-Host "Testing API at: $apiUrl" -ForegroundColor Yellow
Write-Host "From origin: $origin" -ForegroundColor Yellow
Write-Host ""

# Test 1: OPTIONS request (preflight)
Write-Host "Test 1: OPTIONS /api/auth/login (preflight check)" -ForegroundColor Cyan
Write-Host "-----------------------------------------------" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest `
        -Uri "$apiUrl/api/auth/login" `
        -Method OPTIONS `
        -Headers @{
            "Origin" = $origin
            "Access-Control-Request-Method" = "POST"
            "Access-Control-Request-Headers" = "Content-Type"
        } `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    
    $allowOrigin = $response.Headers['Access-Control-Allow-Origin']
    $allowCreds = $response.Headers['Access-Control-Allow-Credentials']
    $allowMethods = $response.Headers['Access-Control-Allow-Methods']
    
    Write-Host ""
    Write-Host "CORS Headers Received:" -ForegroundColor Yellow
    Write-Host "  Access-Control-Allow-Origin: $allowOrigin" -ForegroundColor $(if ($allowOrigin -eq $origin) { "Green" } elseif ($allowOrigin -eq "*") { "Red" } else { "Yellow" })
    Write-Host "  Access-Control-Allow-Credentials: $allowCreds" -ForegroundColor $(if ($allowCreds -eq "true") { "Green" } else { "Red" })
    Write-Host "  Access-Control-Allow-Methods: $allowMethods" -ForegroundColor Gray
    
    Write-Host ""
    if ($allowOrigin -eq "*") {
        Write-Host "❌ PROBLEM: Origin is wildcard '*'" -ForegroundColor Red
        Write-Host "   This won't work with credentials!" -ForegroundColor Red
        Write-Host ""
        Write-Host "   Fix needed: Configure Kong or backend to return:" -ForegroundColor Yellow
        Write-Host "   Access-Control-Allow-Origin: $origin" -ForegroundColor Yellow
    } elseif ($allowOrigin -eq $origin) {
        Write-Host "✅ CORRECT: Origin is set to $origin" -ForegroundColor Green
        if ($allowCreds -eq "true") {
            Write-Host "✅ CORRECT: Credentials allowed" -ForegroundColor Green
            Write-Host ""
            Write-Host "🎉 CORS is configured correctly!" -ForegroundColor Green
        } else {
            Write-Host "❌ PROBLEM: Credentials not allowed" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️  WARNING: Unexpected origin: $allowOrigin" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible causes:" -ForegroundColor Yellow
    Write-Host "  1. Server is not running" -ForegroundColor Gray
    Write-Host "  2. URL is incorrect" -ForegroundColor Gray
    Write-Host "  3. CORS is blocking the request" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Check the CORS headers above" -ForegroundColor Gray
Write-Host "  2. If origin is '*', configure Kong CORS plugin" -ForegroundColor Gray
Write-Host "  3. If origin is correct, try logging in again" -ForegroundColor Gray
Write-Host ""

