# Edge Function Audit Script
# Scans the frontend codebase to find API calls and compares them against existing edge functions
# Usage: .\scripts\audit-edge-functions.ps1

param(
    [switch]$Verbose,
    [switch]$ExportJson,
    [string]$OutputFile = "edge-function-audit.json"
)

$ErrorActionPreference = "Continue"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Edge Function Audit Tool" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Get the root directory (parent of scripts folder)
$rootDir = Split-Path -Parent $PSScriptRoot
if (-not $rootDir) {
    $rootDir = Get-Location
}

$clientDir = Join-Path $rootDir "client\src"
$functionsDir = Join-Path $rootDir "supabase\functions"
$serverDir = Join-Path $rootDir "server"

Write-Host "Root Directory: $rootDir" -ForegroundColor Gray
Write-Host "Client Directory: $clientDir" -ForegroundColor Gray
Write-Host "Functions Directory: $functionsDir" -ForegroundColor Gray
Write-Host "Server Directory: $serverDir`n" -ForegroundColor Gray

# Step 1: Get all existing edge functions
Write-Host "[1/5] Scanning existing edge functions..." -ForegroundColor Yellow
$existingFunctions = @()
if (Test-Path $functionsDir) {
    $functionDirs = Get-ChildItem -Path $functionsDir -Directory | Where-Object { $_.Name -ne "_shared" }
    foreach ($dir in $functionDirs) {
        $indexFile = Join-Path $dir.FullName "index.ts"
        if (Test-Path $indexFile) {
            $existingFunctions += $dir.Name
        }
    }
}
Write-Host "  Found $($existingFunctions.Count) edge functions:" -ForegroundColor Green
$existingFunctions | ForEach-Object { Write-Host "    - $_" -ForegroundColor Gray }

# Step 2: Scan frontend files for API calls
Write-Host "`n[2/5] Scanning frontend for API calls..." -ForegroundColor Yellow

$apiCalls = @{}
$pageApiCalls = @{}

# Patterns to match API calls - using single quotes to avoid escape issues
$patterns = @(
    'apiRequest\s*\(\s*[''"]([^''"]+)[''"]'
    'apiRequest\s*\(\s*`([^`]+)`'
    'queryKey:\s*\[\s*[''"]([^''"]+)[''"]'
    'fetch\s*\(\s*[''"]([^''"]+)[''"]'
    'fetch\s*\(\s*`([^`]+)`'
    'getApiUrl\s*\(\s*[''"]([^''"]+)[''"]'
    '/api/([a-zA-Z0-9_-]+)'
)

# Scan client files
$clientFiles = Get-ChildItem -Path $clientDir -Recurse -Include "*.tsx","*.ts" -File
$totalFiles = $clientFiles.Count
$processedFiles = 0

foreach ($file in $clientFiles) {
    $processedFiles++
    $relativePath = $file.FullName.Replace($clientDir, "").TrimStart("\")
    $content = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue

    if (-not $content) { continue }

    $fileApis = @()

    foreach ($pattern in $patterns) {
        try {
            $matches = [regex]::Matches($content, $pattern)
            foreach ($match in $matches) {
                $apiPath = $match.Groups[1].Value

                # Clean up the path
                $apiPath = $apiPath -replace '\$\{[^}]+\}', '{param}'
                $apiPath = $apiPath -replace '`', ''

                # Only include /api/ paths or direct endpoint names
                if ($apiPath -match "^/?api/" -or $apiPath -match "^[a-zA-Z]") {
                    # Normalize the path
                    $apiPath = $apiPath -replace "^/", ""
                    $apiPath = $apiPath -replace "\?.*$", ""

                    # Extract the base endpoint
                    $segments = $apiPath -split "/"
                    $baseEndpoint = $null

                    if ($apiPath -match "^api/") {
                        if ($segments.Count -ge 2) {
                            $baseEndpoint = $segments[1]
                        }
                    } else {
                        $baseEndpoint = $segments[0]
                    }

                    if ($baseEndpoint -and $baseEndpoint -ne '{param}' -and $baseEndpoint.Length -gt 1) {
                        $fileApis += $baseEndpoint

                        if (-not $apiCalls.ContainsKey($baseEndpoint)) {
                            $apiCalls[$baseEndpoint] = @{
                                Endpoint = $baseEndpoint
                                FullPaths = @()
                                Files = @()
                                Count = 0
                            }
                        }

                        $apiCalls[$baseEndpoint].Count++
                        if ($apiPath -notin $apiCalls[$baseEndpoint].FullPaths) {
                            $apiCalls[$baseEndpoint].FullPaths += $apiPath
                        }
                        if ($relativePath -notin $apiCalls[$baseEndpoint].Files) {
                            $apiCalls[$baseEndpoint].Files += $relativePath
                        }
                    }
                }
            }
        } catch {
            # Skip pattern errors
        }
    }

    # Track API calls per page
    if ($file.Name -match "\.tsx$" -and ($relativePath -match "^pages\\" -or $relativePath -match "Page\.tsx$")) {
        $pageName = $file.BaseName
        if ($fileApis.Count -gt 0) {
            $pageApiCalls[$pageName] = @{
                File = $relativePath
                Apis = ($fileApis | Select-Object -Unique)
            }
        }
    }

    if ($Verbose -and ($processedFiles % 50 -eq 0)) {
        Write-Host "  Processed $processedFiles / $totalFiles files..." -ForegroundColor Gray
    }
}

Write-Host "  Found $($apiCalls.Count) unique API endpoints across $totalFiles files" -ForegroundColor Green

# Step 3: Categorize endpoints
Write-Host "`n[3/5] Categorizing endpoints..." -ForegroundColor Yellow

$missingFunctions = @()
$existingWithCalls = @()
$existingNoCalls = @()

foreach ($endpoint in $apiCalls.Keys | Sort-Object) {
    $info = $apiCalls[$endpoint]

    if ($endpoint -in $existingFunctions) {
        $existingWithCalls += @{
            Endpoint = $endpoint
            CallCount = $info.Count
            Paths = $info.FullPaths
            Files = $info.Files
        }
    } else {
        $missingFunctions += @{
            Endpoint = $endpoint
            CallCount = $info.Count
            Paths = $info.FullPaths
            Files = $info.Files
        }
    }
}

# Find edge functions with no frontend calls
foreach ($func in $existingFunctions) {
    if (-not $apiCalls.ContainsKey($func)) {
        $existingNoCalls += $func
    }
}

# Step 4: Check Express server routes for coverage
Write-Host "`n[4/5] Checking Express server routes..." -ForegroundColor Yellow

$expressRoutes = @{}
if (Test-Path $serverDir) {
    $routeFiles = Get-ChildItem -Path $serverDir -Filter "routes*.ts" -File
    foreach ($file in $routeFiles) {
        $content = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
        if ($content) {
            # Match route definitions
            $routePattern = '(app|router)\.(get|post|put|patch|delete)\s*\(\s*[''"]/?(?:api/)?([^''"]+)[''"]'
            try {
                $routeMatches = [regex]::Matches($content, $routePattern)
                foreach ($match in $routeMatches) {
                    $routePath = $match.Groups[3].Value
                    $routePath = $routePath -replace ":[^/]+", "{param}"
                    $segments = $routePath -split "/"
                    if ($segments.Count -ge 1 -and $segments[0]) {
                        $baseRoute = $segments[0]
                        if (-not $expressRoutes.ContainsKey($baseRoute)) {
                            $expressRoutes[$baseRoute] = @{
                                File = $file.Name
                                Paths = @()
                            }
                        }
                        if ($routePath -notin $expressRoutes[$baseRoute].Paths) {
                            $expressRoutes[$baseRoute].Paths += $routePath
                        }
                    }
                }
            } catch {
                # Skip errors
            }
        }
    }
}

# Add Express route info to missing functions
foreach ($missing in $missingFunctions) {
    if ($expressRoutes.ContainsKey($missing.Endpoint)) {
        $missing.HasExpressRoute = $true
        $missing.ExpressFile = $expressRoutes[$missing.Endpoint].File
    } else {
        $missing.HasExpressRoute = $false
    }
}

Write-Host "  Found $($expressRoutes.Count) Express route groups" -ForegroundColor Green

# Step 5: Generate Report
Write-Host "`n[5/5] Generating report..." -ForegroundColor Yellow

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  AUDIT RESULTS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Missing Edge Functions (Critical)
Write-Host "MISSING EDGE FUNCTIONS (Frontend calls exist, no edge function):" -ForegroundColor Red
Write-Host "----------------------------------------------------------------" -ForegroundColor Red
$sortedMissing = $missingFunctions | Sort-Object { $_.CallCount } -Descending
foreach ($item in $sortedMissing) {
    $expressNote = ""
    if ($item.HasExpressRoute -eq $true) {
        $expressNote = " [Has Express route in $($item.ExpressFile)]"
    } elseif ($item.HasExpressRoute -eq $false) {
        $expressNote = " [NO Express route]"
    }
    Write-Host "  $($item.Endpoint)" -ForegroundColor Yellow -NoNewline
    Write-Host " ($($item.CallCount) calls)$expressNote" -ForegroundColor Gray
    if ($Verbose) {
        Write-Host "    Paths:" -ForegroundColor DarkGray
        foreach ($path in $item.Paths | Select-Object -First 5) {
            Write-Host "      - $path" -ForegroundColor DarkGray
        }
        Write-Host "    Used in:" -ForegroundColor DarkGray
        foreach ($file in $item.Files | Select-Object -First 3) {
            Write-Host "      - $file" -ForegroundColor DarkGray
        }
    }
}

# Working Edge Functions
Write-Host "`nWORKING EDGE FUNCTIONS (Frontend calls exist, edge function exists):" -ForegroundColor Green
Write-Host "--------------------------------------------------------------------" -ForegroundColor Green
$sortedExisting = $existingWithCalls | Sort-Object { $_.CallCount } -Descending
foreach ($item in $sortedExisting) {
    Write-Host "  $($item.Endpoint)" -ForegroundColor Green -NoNewline
    Write-Host " ($($item.CallCount) calls)" -ForegroundColor Gray
}

# Unused Edge Functions
if ($existingNoCalls.Count -gt 0) {
    Write-Host "`nUNUSED EDGE FUNCTIONS (No frontend calls detected):" -ForegroundColor DarkYellow
    Write-Host "---------------------------------------------------" -ForegroundColor DarkYellow
    foreach ($func in $existingNoCalls) {
        Write-Host "  $func" -ForegroundColor DarkYellow
    }
}

# Page-by-page breakdown
Write-Host "`nPAGE-BY-PAGE API USAGE:" -ForegroundColor Cyan
Write-Host "-----------------------" -ForegroundColor Cyan
foreach ($page in $pageApiCalls.Keys | Sort-Object) {
    $info = $pageApiCalls[$page]
    $missingApis = $info.Apis | Where-Object { $_ -notin $existingFunctions }
    $workingApis = $info.Apis | Where-Object { $_ -in $existingFunctions }

    $statusIcon = if ($missingApis.Count -eq 0) { "[OK]" } else { "[!!]" }
    $statusColor = if ($missingApis.Count -eq 0) { "Green" } else { "Yellow" }

    Write-Host "  $statusIcon $page" -ForegroundColor $statusColor -NoNewline
    Write-Host " ($($info.File))" -ForegroundColor Gray

    if ($missingApis.Count -gt 0) {
        Write-Host "      Missing: " -ForegroundColor Red -NoNewline
        Write-Host ($missingApis -join ", ") -ForegroundColor Red
    }
    if ($workingApis.Count -gt 0 -and $Verbose) {
        Write-Host "      Working: " -ForegroundColor DarkGreen -NoNewline
        Write-Host ($workingApis -join ", ") -ForegroundColor DarkGreen
    }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Total Edge Functions:     $($existingFunctions.Count)" -ForegroundColor White
Write-Host "  Working (with calls):     $($existingWithCalls.Count)" -ForegroundColor Green
Write-Host "  Unused (no calls):        $($existingNoCalls.Count)" -ForegroundColor DarkYellow
Write-Host "  MISSING (needs creation): $($missingFunctions.Count)" -ForegroundColor Red
Write-Host ""

# Priority list for creation
$priorityList = $sortedMissing | Where-Object { $_.HasExpressRoute -eq $true } | Select-Object -First 10
if ($priorityList.Count -gt 0) {
    Write-Host "TOP PRIORITY - Edge functions to create (have Express routes):" -ForegroundColor Magenta
    Write-Host "--------------------------------------------------------------" -ForegroundColor Magenta
    $priority = 1
    foreach ($item in $priorityList) {
        Write-Host "  $priority. $($item.Endpoint) - $($item.CallCount) frontend calls" -ForegroundColor White
        Write-Host "     Express: $($item.ExpressFile)" -ForegroundColor Gray
        $samplePaths = $item.Paths | Select-Object -First 2
        Write-Host "     Sample paths: $($samplePaths -join ', ')" -ForegroundColor Gray
        $priority++
    }
}

# Export to JSON if requested
if ($ExportJson) {
    $report = @{
        GeneratedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Summary = @{
            TotalEdgeFunctions = $existingFunctions.Count
            WorkingWithCalls = $existingWithCalls.Count
            UnusedNoCalls = $existingNoCalls.Count
            MissingNeedsCreation = $missingFunctions.Count
        }
        ExistingFunctions = $existingFunctions
        MissingFunctions = $sortedMissing
        WorkingFunctions = $sortedExisting
        UnusedFunctions = $existingNoCalls
        PageBreakdown = $pageApiCalls
        ExpressRoutes = $expressRoutes.Keys | Sort-Object
    }

    $outputPath = Join-Path $rootDir $OutputFile
    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputPath -Encoding UTF8
    Write-Host "`nReport exported to: $outputPath" -ForegroundColor Cyan
}

Write-Host "`nAudit complete!" -ForegroundColor Green
Write-Host "Run with -Verbose for detailed file listings" -ForegroundColor Gray
Write-Host "Run with -ExportJson to save results to JSON`n" -ForegroundColor Gray
