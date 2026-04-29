#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Removes the Printyx Monitoring Client service and (optionally) all data.

.PARAMETER KeepConfig
    Leave %ProgramData%\Printyx and the log directory in place.
#>
[CmdletBinding()]
param(
    [switch]$KeepConfig
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$InstallDir  = Join-Path $env:ProgramFiles 'Printyx\Client'
$ConfigDir   = Join-Path $env:ProgramData  'Printyx'
$NssmExe     = Join-Path $InstallDir       'nssm\nssm.exe'
$ServiceName = 'PrintyxClient'

function Write-Step($Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok  ($Message) { Write-Host "    [OK] $Message" -ForegroundColor Green }

if (-not [Security.Principal.WindowsPrincipal]::new(
        [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "[FAIL] Run as Administrator." -ForegroundColor Red
    exit 1
}

Write-Step "Stopping and removing service '$ServiceName'"
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    if (Test-Path $NssmExe) {
        & $NssmExe stop   $ServiceName confirm | Out-Null
        & $NssmExe remove $ServiceName confirm | Out-Null
    } else {
        # Fallback when nssm.exe isn't around.
        sc.exe stop   $ServiceName | Out-Null
        sc.exe delete $ServiceName | Out-Null
    }
    Write-Ok "Service removed"
} else {
    Write-Ok "Service was not registered"
}

Write-Step "Removing firewall rule"
Get-NetFirewallRule -DisplayName 'Printyx Client - Outbound HTTPS' -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule
Write-Ok "Firewall rule removed (if present)"

Write-Step "Removing $InstallDir"
if (Test-Path $InstallDir) {
    Remove-Item $InstallDir -Recurse -Force
    Write-Ok "Removed"
}

if ($KeepConfig) {
    Write-Host "    Keeping $ConfigDir as requested." -ForegroundColor Yellow
} elseif (Test-Path $ConfigDir) {
    Write-Step "Removing $ConfigDir (config + logs + meter state)"
    Remove-Item $ConfigDir -Recurse -Force
    Write-Ok "Removed"
}

Write-Host ""
Write-Host "Uninstall complete." -ForegroundColor Green
