# Generate Apple Client Secret from JWT
# 
# This script generates a client_secret for Sign in with Apple OAuth
# by creating a signed JWT token using your Apple credentials.
# 
# Required inputs:
# - Team ID (from Apple Developer account)
# - Key ID (from your .p8 key in Apple Developer)
# - .p8 private key file path
# - Client ID (Services ID from Apple)
# 
# Usage:
#   .\scripts\generate-apple-client-secret.ps1
# 
# Or with custom values:
#   .\scripts\generate-apple-client-secret.ps1 -TeamId "YOUR_TEAM_ID" -KeyId "YOUR_KEY_ID" -KeyFile ".\AuthKey.p8" -ClientId "com.yourapp.service"

param(
    [string]$TeamId = $env:APPLE_TEAM_ID,
    [string]$KeyId = $env:APPLE_KEY_ID,
    [string]$KeyFile = $env:APPLE_KEY_FILE,
    [string]$ClientId = $env:APPLE_CLIENT_ID
)

# Set defaults if not provided
if (-not $TeamId) { $TeamId = "YOUR_TEAM_ID" }
if (-not $KeyId) { $KeyId = "YOUR_KEY_ID" }
if (-not $KeyFile) { $KeyFile = ".\AuthKey.p8" }
if (-not $ClientId) { $ClientId = "com.yourapp.service" }

# Validate inputs
if ($TeamId -eq "YOUR_TEAM_ID") {
    Write-Host "❌ Error: TEAM_ID not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please provide your Apple Team ID:"
    Write-Host "  .\scripts\generate-apple-client-secret.ps1 -TeamId YOUR_TEAM_ID"
    Write-Host "  or set `$env:APPLE_TEAM_ID environment variable"
    exit 1
}

if ($KeyId -eq "YOUR_KEY_ID") {
    Write-Host "❌ Error: KEY_ID not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please provide your Apple Key ID:"
    Write-Host "  .\scripts\generate-apple-client-secret.ps1 -KeyId YOUR_KEY_ID"
    Write-Host "  or set `$env:APPLE_KEY_ID environment variable"
    exit 1
}

if (-not (Test-Path $KeyFile)) {
    Write-Host "❌ Error: Key file not found: $KeyFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please provide the path to your .p8 key file:"
    Write-Host "  .\scripts\generate-apple-client-secret.ps1 -KeyFile .\path\to\AuthKey.p8"
    Write-Host "  or set `$env:APPLE_KEY_FILE environment variable"
    exit 1
}

Write-Host "🔐 Generating Apple Client Secret using Node.js..." -ForegroundColor Cyan
Write-Host ""

# Run the Node.js script with the parameters
node scripts/generate-apple-client-secret.js --team $TeamId --keyid $KeyId --keyfile $KeyFile --clientid $ClientId

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Failed to generate client secret" -ForegroundColor Red
    exit 1
}
