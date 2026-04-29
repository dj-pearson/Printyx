#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Bootstrap script: clone the printyx-client source from a release URL
    or git ref and run install-windows.ps1.

.DESCRIPTION
    Use this when you want a true one-line install on a fresh server:

        irm https://your-printyx.example/install.ps1 | iex

    The serving site should expose this script verbatim (or call it directly
    via PowerShell). It downloads the printyx-client release archive,
    extracts it under %ProgramData%\Printyx\src, then hands off to
    install-windows.ps1.

.PARAMETER ReleaseUrl
    HTTPS URL to a .zip archive containing the printyx-client/ directory at
    its root. Default: latest GitHub release.

.PARAMETER Endpoint
    Forwarded to install-windows.ps1.

.PARAMETER ApiKey
    Forwarded to install-windows.ps1.

.PARAMETER TenantId
    Forwarded to install-windows.ps1.

.PARAMETER NetworkRange
    Forwarded to install-windows.ps1.
#>
[CmdletBinding()]
param(
    [string]$ReleaseUrl = 'https://github.com/dj-pearson/Printyx/archive/refs/heads/main.zip',
    [string]$Endpoint,
    [string]$ApiKey,
    [string]$TenantId,
    [string]$NetworkRange
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$workDir = Join-Path $env:TEMP "printyx-bootstrap-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $workDir -Force | Out-Null
$zipPath = Join-Path $workDir 'printyx.zip'

Write-Host "==> Downloading client source from $ReleaseUrl" -ForegroundColor Cyan
Invoke-WebRequest -UseBasicParsing -Uri $ReleaseUrl -OutFile $zipPath

Write-Host "==> Extracting" -ForegroundColor Cyan
Expand-Archive -Path $zipPath -DestinationPath $workDir -Force

# Locate the printyx-client directory inside the extracted tree.
$clientDir = Get-ChildItem -Path $workDir -Recurse -Directory -Filter 'printyx-client' |
    Select-Object -First 1
if (-not $clientDir) { throw "Could not find printyx-client/ inside $ReleaseUrl" }

$installScript = Join-Path $clientDir.FullName 'scripts\install-windows.ps1'
if (-not (Test-Path $installScript)) { throw "install-windows.ps1 not found at $installScript" }

# Forward any non-empty arguments.
$forward = @{}
if ($Endpoint)      { $forward.Endpoint     = $Endpoint }
if ($ApiKey)        { $forward.ApiKey       = $ApiKey }
if ($TenantId)      { $forward.TenantId     = $TenantId }
if ($NetworkRange)  { $forward.NetworkRange = $NetworkRange }

Write-Host "==> Handing off to install-windows.ps1" -ForegroundColor Cyan
& $installScript @forward
