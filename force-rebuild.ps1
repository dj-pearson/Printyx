# Force Complete Rebuild and Deploy
# This ensures a fresh build with no cache

Write-Host "Force Rebuilding Printyx Frontend..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean all caches
Write-Host "1. Cleaning build caches..." -ForegroundColor Yellow
if (Test-Path "client/dist") {
    Remove-Item -Recurse -Force "client/dist"
    Write-Host "   Removed client/dist" -ForegroundColor Green
}
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "   Removed dist" -ForegroundColor Green
}
if (Test-Path "client/.vite") {
    Remove-Item -Recurse -Force "client/.vite"
    Write-Host "   Removed .vite cache" -ForegroundColor Green
}
if (Test-Path "client/node_modules/.vite") {
    Remove-Item -Recurse -Force "client/node_modules/.vite"
    Write-Host "   Removed node_modules/.vite cache" -ForegroundColor Green
}

Write-Host ""

# Step 2: Install fresh dependencies
Write-Host "2. Installing fresh dependencies..." -ForegroundColor Yellow
npm ci --legacy-peer-deps
Write-Host "   Dependencies installed" -ForegroundColor Green

Write-Host ""

# Step 3: Build with no cache
Write-Host "3. Building (no cache)..." -ForegroundColor Yellow
$env:VITE_FORCE_NO_CACHE = "true"
npm run build
Write-Host "   Build complete" -ForegroundColor Green

Write-Host ""

# Step 4: Check the build output
Write-Host "4. Verifying build..." -ForegroundColor Yellow
if (Test-Path "dist/index.html") {
    $indexContent = Get-Content "dist/index.html" -Raw
    $pattern = "QuoteProposalGeneration-([a-zA-Z0-9]+)\.js"
    if ($indexContent -match $pattern) {
        $newHash = $matches[1]
        Write-Host "   New build hash: $newHash" -ForegroundColor Green
        Write-Host "   Old hash was: C1RFXoMs" -ForegroundColor Gray
        
        if ($newHash -eq "C1RFXoMs") {
            Write-Host "   WARNING: Hash did not change!" -ForegroundColor Red
        } else {
            Write-Host "   Hash changed - build is fresh!" -ForegroundColor Green
        }
    }
} else {
    Write-Host "   Build failed - dist/index.html not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Commit and push the new build:" -ForegroundColor White
Write-Host "      git add dist/" -ForegroundColor Cyan
Write-Host "      git commit -m ""Force rebuild with fresh cache""" -ForegroundColor Cyan
Write-Host "      git push origin main" -ForegroundColor Cyan
Write-Host ""
Write-Host "   2. Or deploy directly to server:" -ForegroundColor White
Write-Host "      scp -r dist/ root@209.145.59.219:/path/to/app/" -ForegroundColor Cyan
Write-Host ""
Write-Host "   3. Restart your frontend service" -ForegroundColor White
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
