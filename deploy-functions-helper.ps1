# Quick helper for deploying Edge Functions
# Auto-detects and strips container name prefix

param(
    [string]$ContainerNameOrId = "supabase-edge-functions-cgkko0cscowggwk8sss44wkw",
    [string]$ServerHost = "209.145.59.219",
    [string]$FunctionName = "all"
)

Write-Host ""
Write-Host "=== Edge Functions Deployment Helper ===" -ForegroundColor Cyan
Write-Host ""

# Extract Service ID from container name
if ($ContainerNameOrId -match "^supabase-edge-functions-(.+)$") {
    $ServiceId = $Matches[1]
    Write-Host "[INFO] Extracted Service ID: $ServiceId" -ForegroundColor Green
}
else {
    $ServiceId = $ContainerNameOrId
    Write-Host "[INFO] Using Service ID: $ServiceId" -ForegroundColor Green
}

Write-Host ""
Write-Host "Calling deployment script..." -ForegroundColor Cyan
Write-Host ""

# Call the main deployment script
& ".\deploy-edge-functions.ps1" -ServerHost $ServerHost -ServiceId $ServiceId -FunctionName $FunctionName

