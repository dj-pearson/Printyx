# Move all .md and .txt from repo root into ./documents/ (one-time cleanup).
# Does not recurse into subfolders. Keeps project entrypoints at repo root.
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dest = Join-Path $root "documents"
$keepAtRoot = @("CLAUDE.md", "progress.txt", "README.md")
if (-not (Test-Path $dest)) {
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
}
$moved = @()
Get-ChildItem -Path $root -File -ErrorAction Stop |
  Where-Object { $_.Extension -in @(".md", ".txt") -and $keepAtRoot -notcontains $_.Name } |
  ForEach-Object {
    $target = Join-Path $dest $_.Name
    if (Test-Path -LiteralPath $target) {
      throw "Destination already exists, refusing to overwrite: $target"
    }
    Move-Item -LiteralPath $_.FullName -Destination $target
    $moved += $_.Name
  }
Write-Host "Moved $($moved.Count) file(s) to $dest"
$moved | ForEach-Object { Write-Host "  $_" }
