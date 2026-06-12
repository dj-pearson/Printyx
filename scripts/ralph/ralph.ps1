# Ralph - Autonomous AI agent loop (PowerShell version)
# Runs Claude Code repeatedly until all PRD items are complete

param(
    [string]$Tool = "claude",
    [int]$MaxIterations = 10
)

$ErrorActionPreference = "Stop"
$ProgressFile = "progress.txt"

function Get-Prd {
    Get-Content "prd.json" -Raw | ConvertFrom-Json
}

Write-Host "🤖 Ralph starting with $Tool (max $MaxIterations iterations)" -ForegroundColor Cyan

# Check for required files
if (-not (Test-Path "prd.json")) {
    Write-Host "❌ Error: prd.json not found" -ForegroundColor Red
    Write-Host "Create a PRD first using the prd skill"
    exit 1
}

# Get branch name from prd.json
$prd = Get-Prd
$branchName = if ($prd.branchName) { $prd.branchName } else { "ralph-feature" }
$currentBranch = git branch --show-current

# Create feature branch if not already on it
if ($currentBranch -ne $branchName) {
    Write-Host "📝 Creating/switching to branch: $branchName" -ForegroundColor Yellow
    git show-ref --verify --quiet "refs/heads/$branchName"
    if ($LASTEXITCODE -eq 0) {
        git checkout $branchName
    }
    else {
        git checkout -b $branchName
    }
}

# Initialize progress log if it doesn't exist
if (-not (Test-Path $ProgressFile)) {
    $progressDir = Split-Path -Parent $ProgressFile
    if ($progressDir -and -not (Test-Path $progressDir)) {
        New-Item -ItemType Directory -Path $progressDir -Force | Out-Null
    }
    @"
Ralph Progress Log - $(Get-Date)
Branch: $branchName

"@ | Out-File -FilePath $ProgressFile -Encoding UTF8
}

# Main loop
$currentIteration = 0
while ($currentIteration -lt $MaxIterations) {
    $currentIteration++
    Write-Host ""
    Write-Host "🔄 Iteration $currentIteration/$MaxIterations" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Find next incomplete story
    $nextStory = (Get-Prd).userStories |
        Where-Object { $_.passes -eq $false } |
        Select-Object -First 1 -ExpandProperty id

    if ([string]::IsNullOrEmpty($nextStory)) {
        Write-Host "✅ All stories complete!" -ForegroundColor Green
        Write-Host "<promise>COMPLETE</promise>"
        exit 0
    }

    Write-Host "📋 Next story: $nextStory" -ForegroundColor Yellow

    # Determine prompt file
    if ($Tool -eq "claude") {
        $promptFile = "scripts\ralph\CLAUDE.md"
        if (-not (Test-Path $promptFile)) {
            $promptFile = "CLAUDE.md"
        }

        if (-not (Test-Path $promptFile)) {
            Write-Host "❌ Error: CLAUDE.md not found" -ForegroundColor Red
            exit 1
        }

        Write-Host "🧠 Running Claude Code..." -ForegroundColor Magenta
        $promptContent = Get-Content $promptFile -Raw
        claude -p $promptContent --dangerously-skip-permissions
    }
    else {
        $promptFile = "scripts\ralph\prompt.md"
        if (-not (Test-Path $promptFile)) {
            $promptFile = "prompt.md"
        }

        if (-not (Test-Path $promptFile)) {
            Write-Host "❌ Error: prompt.md not found" -ForegroundColor Red
            exit 1
        }

        Write-Host "🧠 Running Amp..." -ForegroundColor Magenta
        $promptContent = Get-Content $promptFile -Raw
        amp $promptContent
    }

    # Check if story is now complete
    $story = (Get-Prd).userStories | Where-Object { $_.id -eq $nextStory } | Select-Object -First 1
    $storyComplete = ($story -and $story.passes -eq $true)

    if ($storyComplete) {
        Write-Host "✅ Story $nextStory completed" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Story $nextStory not marked complete - may need manual review" -ForegroundColor Yellow
    }

    # Add iteration summary to progress.txt
    @"

Iteration $currentIteration ($(Get-Date)): Story $nextStory
Status: $(if ($storyComplete) { "Complete" } else { "Needs Review" })
"@ | Out-File -FilePath $ProgressFile -Append -Encoding UTF8

    # Short pause between iterations
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "⏸️  Max iterations ($MaxIterations) reached" -ForegroundColor Yellow
Write-Host "Check prd.json for remaining stories"

# Show remaining stories
$remaining = @((Get-Prd).userStories | Where-Object { $_.passes -eq $false }).Count
Write-Host "📊 $remaining stories remaining" -ForegroundColor Cyan
