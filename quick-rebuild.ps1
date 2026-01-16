# Quick Rebuild - No node_modules cleaning
# Just cleans build outputs and rebuilds

Write-Host "Quick Rebuild - Cleaning build cache..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean build outputs only
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
    Write-Host "Removed dist" -ForegroundColor Green
}
if (Test-Path "client/.vite") {
    Remove-Item -Recurse -Force "client/.vite" -ErrorAction SilentlyContinue
    Write-Host "Removed .vite cache" -ForegroundColor Green
}

Write-Host ""

# Step 2: Build
Write-Host "Building..." -ForegroundColor Yellow
npm run build

Write-Host ""

# Step 3: Check result
if (Test-Path "dist/index.html") {
    $indexContent = Get-Content "dist/index.html" -Raw
    $pattern = "QuoteProposalGeneration-([a-zA-Z0-9]+)\.js"
    if ($indexContent -match $pattern) {
        $newHash = $matches[1]
        Write-Host "New build hash: $newHash" -ForegroundColor Green
        Write-Host "Old hash was: C1RFXoMs" -ForegroundColor Gray
        
        if ($newHash -ne "C1RFXoMs") {
            Write-Host "SUCCESS: Hash changed - fresh build!" -ForegroundColor Green
        } else {
            Write-Host "WARNING: Hash did not change" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "Build complete! Now deploy:" -ForegroundColor Green
    Write-Host "  git add ." -ForegroundColor Cyan
    Write-Host "  git commit -m ""Rebuild frontend with quotes fix""" -ForegroundColor Cyan
    Write-Host "  git push origin main" -ForegroundColor Cyan
} else {
    Write-Host "Build failed!" -ForegroundColor Red
}
