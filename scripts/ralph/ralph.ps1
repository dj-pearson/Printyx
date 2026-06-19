# Ralph - Autonomous AI agent loop (PowerShell version)
# Runs Claude Code repeatedly until all PRD items are complete.
#
# Designed to:
#   * Run INLINE in the current terminal (no new windows, no Windows "Open with" picker).
#   * Coexist politely with other Ralph loops on the same machine (CPU affinity slots,
#     BelowNormal priority, capped node heap, randomized jitter) so two runs don't
#     collide and freeze the box.
#
# Usage:  npm run ralph            (10 iterations, claude)
#         npm run ralph -- 25      (25 iterations)

param(
    [int]$MaxIterations = 10,      # bare number => iterations:  npm run ralph -- 25
    [string]$Tool = "claude",      # -Tool claude | -Tool amp
    [int]$MaxParallelRalphs = 2,   # how many Ralphs we expect to share this machine
    [int]$CoreReserve = 2,         # cores left free for the OS + interactive Claude Code
    [int]$NodeHeapMB = 4096,       # heap cap handed to any node child (npm build/check/test)
    [int]$MinJitterSec = 1,        # randomized pause floor between iterations
    [int]$MaxJitterSec = 6,        # randomized pause ceiling between iterations
    [switch]$NoThrottle            # disable affinity/priority throttling
)

$ErrorActionPreference = "Stop"
$ProgressFile = "progress.txt"
$SlotDir = Join-Path $env:TEMP "ralph-slots"

function Get-Prd {
    Get-Content "prd.json" -Raw | ConvertFrom-Json
}

# ---------------------------------------------------------------------------
# Cross-project slot coordination
# ---------------------------------------------------------------------------
function Acquire-RalphSlot {
    New-Item -ItemType Directory -Force -Path $SlotDir | Out-Null

    # Reclaim slots whose owning process is gone.
    Get-ChildItem $SlotDir -Filter '*.json' -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $info = Get-Content $_.FullName -Raw | ConvertFrom-Json
            if (-not (Get-Process -Id $info.pid -ErrorAction SilentlyContinue)) {
                Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
        }
    }

    $taken = @(
        Get-ChildItem $SlotDir -Filter '*.json' -ErrorAction SilentlyContinue | ForEach-Object {
            try { (Get-Content $_.FullName -Raw | ConvertFrom-Json).slot } catch { }
        }
    )

    $slot = 0
    while ($taken -contains $slot) { $slot++ }

    $slotFile = Join-Path $SlotDir ("$PID.json")
    @{ pid = $PID; slot = $slot; repo = (Get-Location).Path; started = (Get-Date).ToString('o') } |
        ConvertTo-Json | Out-File -FilePath $slotFile -Encoding UTF8

    return @{ Slot = $slot; File = $slotFile; Peers = $taken.Count }
}

function Get-AffinityMask {
    param([int]$Slot)
    $total   = [int]$env:NUMBER_OF_PROCESSORS
    $usable  = [Math]::Max(1, $total - $CoreReserve)
    $perSlot = [Math]::Max(1, [Math]::Floor($usable / $MaxParallelRalphs))
    $effSlot = $Slot % $MaxParallelRalphs           # 3rd+ Ralph wraps onto an existing band
    $start   = $effSlot * $perSlot
    $mask = 0
    for ($i = 0; $i -lt $perSlot; $i++) {
        $core = $start + $i
        if ($core -lt $total) { $mask = $mask -bor ([int64]1 -shl $core) }
    }
    return @{ Mask = [int64]$mask; Cores = $perSlot; Start = $start }
}

# ---------------------------------------------------------------------------
# Run the AI tool inline, throttled, prompt via stdin (no arg escaping, no picker)
# ---------------------------------------------------------------------------
function Invoke-Agent {
    param(
        [string]$ExePath,
        [string[]]$ExeArgs,
        [string]$PromptContent,
        [int]$Slot
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $ExePath
    $psi.Arguments = ($ExeArgs -join ' ')
    $psi.UseShellExecute = $false          # <-- bypass ShellExecute: no "Open with" picker, no new window
    $psi.RedirectStandardInput = $true     # feed the prompt via stdin
    $psi.WorkingDirectory = (Get-Location).Path
    # Cap heap of any node children the agent spawns (npm run build/check/test).
    $psi.EnvironmentVariables["NODE_OPTIONS"] = "--max-old-space-size=$NodeHeapMB"

    $proc = [System.Diagnostics.Process]::Start($psi)

    if (-not $NoThrottle) {
        try { $proc.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal } catch { }
        try {
            $aff = Get-AffinityMask -Slot $Slot
            $proc.ProcessorAffinity = [IntPtr][int64]$aff.Mask
            Write-Host ("   throttle: slot {0} -> cores {1}-{2}, BelowNormal, node heap {3}MB" -f `
                $Slot, $aff.Start, ($aff.Start + $aff.Cores - 1), $NodeHeapMB) -ForegroundColor DarkGray
        } catch {
            Write-Host "   (affinity not applied: $($_.Exception.Message))" -ForegroundColor DarkGray
        }
    }

    # Hand the prompt to the agent, then let stdout/stderr stream to THIS console.
    $proc.StandardInput.Write($PromptContent)
    $proc.StandardInput.Close()
    $proc.WaitForExit()
    return $proc.ExitCode
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
Write-Host "🤖 Ralph starting with $Tool (max $MaxIterations iterations)" -ForegroundColor Cyan

if (-not (Test-Path "prd.json")) {
    Write-Host "❌ Error: prd.json not found" -ForegroundColor Red
    Write-Host "Create a PRD first using the prd skill"
    exit 1
}

# Resolve the agent executable directly (avoids the Windows file-association picker).
$exeName = if ($Tool -eq "claude") { "claude" } else { $Tool }
$cmd = Get-Command $exeName -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $cmd) {
    Write-Host "❌ Error: '$exeName' executable not found on PATH" -ForegroundColor Red
    exit 1
}
$ExePath = $cmd.Source
Write-Host "🔧 Using $ExePath" -ForegroundColor DarkGray

# Get branch name from prd.json
$prd = Get-Prd
$branchName = if ($prd.branchName) { $prd.branchName } else { "ralph-feature" }
$currentBranch = git branch --show-current

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

# Claim a coordination slot for the lifetime of this loop.
$slotInfo = $null
if (-not $NoThrottle) {
    $slotInfo = Acquire-RalphSlot
    Write-Host ("🤝 Coordination: slot {0} ({1} peer Ralph(s) already active)" -f $slotInfo.Slot, $slotInfo.Peers) -ForegroundColor Cyan
}
$mySlot = if ($slotInfo) { $slotInfo.Slot } else { 0 }

try {
    $currentIteration = 0
    while ($currentIteration -lt $MaxIterations) {
        $currentIteration++
        Write-Host ""
        Write-Host "🔄 Iteration $currentIteration/$MaxIterations" -ForegroundColor Cyan
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

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
            if (-not (Test-Path $promptFile)) { $promptFile = "CLAUDE.md" }
            if (-not (Test-Path $promptFile)) {
                Write-Host "❌ Error: CLAUDE.md not found" -ForegroundColor Red
                exit 1
            }
            $agentArgs = @('-p', '--dangerously-skip-permissions')
        }
        else {
            $promptFile = "scripts\ralph\prompt.md"
            if (-not (Test-Path $promptFile)) { $promptFile = "prompt.md" }
            if (-not (Test-Path $promptFile)) {
                Write-Host "❌ Error: prompt.md not found" -ForegroundColor Red
                exit 1
            }
            $agentArgs = @()
        }

        Write-Host "🧠 Running $Tool (inline, throttled)..." -ForegroundColor Magenta
        $promptContent = Get-Content $promptFile -Raw
        Invoke-Agent -ExePath $ExePath -ExeArgs $agentArgs -PromptContent $promptContent -Slot $mySlot | Out-Null

        # Check if story is now complete
        $story = (Get-Prd).userStories | Where-Object { $_.id -eq $nextStory } | Select-Object -First 1
        $storyComplete = ($story -and $story.passes -eq $true)

        if ($storyComplete) {
            Write-Host "✅ Story $nextStory completed" -ForegroundColor Green
        }
        else {
            Write-Host "⚠️  Story $nextStory not marked complete - may need manual review" -ForegroundColor Yellow
        }

        @"

Iteration $currentIteration ($(Get-Date)): Story $nextStory
Status: $(if ($storyComplete) { "Complete" } else { "Needs Review" })
"@ | Out-File -FilePath $ProgressFile -Append -Encoding UTF8

        # Randomized jitter so parallel Ralphs don't hit heavy build/test phases in lockstep.
        $pause = Get-Random -Minimum $MinJitterSec -Maximum ($MaxJitterSec + 1)
        Write-Host "   …cooldown ${pause}s" -ForegroundColor DarkGray
        Start-Sleep -Seconds $pause
    }

    Write-Host ""
    Write-Host "⏸️  Max iterations ($MaxIterations) reached" -ForegroundColor Yellow
    Write-Host "Check prd.json for remaining stories"

    $remaining = @((Get-Prd).userStories | Where-Object { $_.passes -eq $false }).Count
    Write-Host "📊 $remaining stories remaining" -ForegroundColor Cyan
}
finally {
    # Always release our coordination slot.
    if ($slotInfo -and (Test-Path $slotInfo.File)) {
        Remove-Item $slotInfo.File -Force -ErrorAction SilentlyContinue
    }
}
