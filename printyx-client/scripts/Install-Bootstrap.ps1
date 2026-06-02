#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    True one-line web bootstrap for the Printyx Monitoring Client.

.DESCRIPTION
    This is what the platform serves at GET /install/printyx-client.ps1, so a
    fresh print server with no repo checkout can install in one line:

        iwr -UseBasicParsing https://app.printyx.net/install/printyx-client.ps1 `
            -OutFile $env:TEMP\printyx-install.ps1
        & $env:TEMP\printyx-install.ps1 -EnrollmentToken 'et_xxx' -Endpoint 'https://app.printyx.net'

    It downloads the prebuilt agent (printyx-client.cjs) and the real
    installer (install-windows.ps1) from the same platform into a temp
    directory, then runs install-windows.ps1 in "bundle mode" — no source
    checkout, no npm, no TypeScript build. Node.js is auto-installed by the
    inner installer if missing.

.PARAMETER Endpoint
    Printyx HTTPS base URL. Also the host the agent + installer are fetched
    from. Required.

.PARAMETER EnrollmentToken
    One-time enrollment token (et_...). Redeemed at install time for the
    permanent API key. Preferred over -ApiKey/-TenantId.

.PARAMETER ApiKey
    Plain client API key (pk_...). Use with -TenantId instead of a token.

.PARAMETER TenantId
    Tenant ID (required when using -ApiKey).

.PARAMETER NetworkRange
    Optional CIDR to scan for printers (e.g. 192.168.1.0/24).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Endpoint,
    [string]$EnrollmentToken,
    [string]$ApiKey,
    [string]$TenantId,
    [string]$NetworkRange,
    [string]$ClientName = "$env:COMPUTERNAME",
    [switch]$EnableDiscoveryFirewall,
    [switch]$SkipNodeAutoInstall
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if ($Endpoint -notmatch '^https://') {
    throw "Endpoint must start with https:// (got '$Endpoint')."
}
$base = $Endpoint.TrimEnd('/')

$work = Join-Path $env:TEMP ("printyx-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $work -Force | Out-Null

Write-Host "==> Downloading agent + installer from $base" -ForegroundColor Cyan
Invoke-WebRequest -UseBasicParsing -Uri "$base/install/printyx-client.cjs" `
    -OutFile (Join-Path $work 'printyx-client.cjs')
Invoke-WebRequest -UseBasicParsing -Uri "$base/install/install-windows.ps1" `
    -OutFile (Join-Path $work 'install-windows.ps1')

# Forward arguments to the real installer. The .cjs sitting next to it makes
# install-windows.ps1 choose bundle mode automatically.
$forward = @{ Endpoint = $base }
if ($EnrollmentToken)         { $forward.EnrollmentToken = $EnrollmentToken }
if ($ApiKey)                  { $forward.ApiKey = $ApiKey }
if ($TenantId)                { $forward.TenantId = $TenantId }
if ($NetworkRange)            { $forward.NetworkRange = $NetworkRange }
if ($ClientName)              { $forward.ClientName = $ClientName }
if ($EnableDiscoveryFirewall) { $forward.EnableDiscoveryFirewall = $true }
if ($SkipNodeAutoInstall)     { $forward.SkipNodeAutoInstall = $true }

Write-Host "==> Handing off to install-windows.ps1 (bundle mode)" -ForegroundColor Cyan
& (Join-Path $work 'install-windows.ps1') @forward
