#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    One-shot installer for the Printyx Monitoring Client on Windows Server.

.DESCRIPTION
    Performs a turn-key install:
      - Verifies Node.js >= 18 (downloads LTS if missing, with consent)
      - Installs the client to %ProgramFiles%\Printyx\Client
      - Creates %ProgramData%\Printyx with locked-down NTFS ACL (Administrators + SYSTEM only)
      - Generates config.json from prompts (endpoint, API key, tenant, network range)
      - Validates the endpoint over HTTPS/443 before continuing
      - Downloads NSSM (https://nssm.cc) and installs the service "PrintyxClient"
      - Adds an outbound firewall rule pinned to TCP 443
      - Starts the service and tails the log to confirm

    All API traffic stays on TCP 443 (HTTPS). SNMP (UDP 161) is intra-LAN only.

.PARAMETER Endpoint
    Printyx HTTPS base URL (e.g. https://app.printyx.net). HTTP is rejected.

.PARAMETER ApiKey
    The plain API key shown once when registering the client in the Printyx UI.

.PARAMETER TenantId
    Your tenant ID.

.PARAMETER NetworkRange
    CIDR range to scan for printers (e.g. 192.168.1.0/24). Optional; can be added later.

.PARAMETER EnrollmentToken
    One-time enrollment token (et_...) generated in the Printyx UI. When
    supplied, the installer will redeem the token at install time to obtain
    the API key automatically — `-ApiKey` and `-TenantId` are NOT needed.

.PARAMETER ConfigBundle
    Path to a `bootstrap-config.json` produced by the Platform installer
    bundle. Provides Endpoint + EnrollmentToken in one file. If both
    `-ConfigBundle` and `-EnrollmentToken` are given, the explicit token
    wins.

.PARAMETER NonInteractive
    Fail instead of prompting when a parameter is missing.

.EXAMPLE
    .\install-windows.ps1
    # interactive install

.EXAMPLE
    .\install-windows.ps1 -Endpoint https://app.printyx.net -ApiKey pk_xxx -TenantId 1 -NetworkRange 10.0.0.0/24

.EXAMPLE
    # Bundled installer downloaded from the Printyx UI:
    Expand-Archive .\printyx-client-clientid.zip -DestinationPath .\install
    cd .\install
    .\install-windows.ps1 -ConfigBundle .\bootstrap-config.json

.EXAMPLE
    # Generic installer with token:
    .\install-windows.ps1 -Endpoint https://app.printyx.net -EnrollmentToken et_xxx
#>
[CmdletBinding()]
param(
    [string]$Endpoint,
    [string]$ApiKey,
    [string]$TenantId,
    [string]$NetworkRange,
    [string]$ClientName = "$env:COMPUTERNAME",
    [string]$EnrollmentToken,
    [string]$ConfigBundle,
    [switch]$NonInteractive,
    [switch]$SkipFirewallRule,
    [switch]$SkipNodeCheck
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# -- Constants -------------------------------------------------------------
$InstallDir   = Join-Path $env:ProgramFiles 'Printyx\Client'
$ConfigDir    = Join-Path $env:ProgramData  'Printyx'
$ConfigPath   = Join-Path $ConfigDir        'config.json'
$LogDir       = Join-Path $ConfigDir        'logs'
$LogPath      = Join-Path $LogDir           'printyx-client.log'
$NssmDir      = Join-Path $InstallDir       'nssm'
$NssmExe      = Join-Path $NssmDir          'nssm.exe'
$ServiceName  = 'PrintyxClient'
$NodeMinMajor = 18
$NssmUrl      = 'https://nssm.cc/release/nssm-2.24.zip'
$NssmSha256   = 'be7b3577c6e3a280e5106a9e9db5b3775931cefc7c3b9b82d3cd4c8a5b5e1d31' # nssm-2.24 release

function Write-Step($Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok($Message) {
    Write-Host "    [OK] $Message" -ForegroundColor Green
}

function Write-Warn2($Message) {
    Write-Host "    [WARN] $Message" -ForegroundColor Yellow
}

function Fail($Message) {
    Write-Host ""
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    exit 1
}

function Read-Required([string]$Prompt, [string]$Existing, [scriptblock]$Validator) {
    if ($Existing) { return $Existing }
    if ($NonInteractive) { Fail "Missing required parameter: $Prompt" }
    while ($true) {
        $value = Read-Host $Prompt
        if (-not $value) { continue }
        if ($Validator) {
            $err = & $Validator $value
            if ($err) {
                Write-Host "    $err" -ForegroundColor Yellow
                continue
            }
        }
        return $value
    }
}

# -- Pre-flight checks -----------------------------------------------------
Write-Step "Pre-flight checks"

if (-not [Security.Principal.WindowsPrincipal]::new(
        [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail "This script must be run as Administrator."
}
Write-Ok "Running as Administrator"

# Ensure script is invoked from inside the printyx-client directory (it expects ../package.json)
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $RepoRoot 'package.json'))) {
    Fail "Could not locate package.json at $RepoRoot. Run this script from printyx-client\scripts\."
}
Write-Ok "Source tree: $RepoRoot"

if (-not $SkipNodeCheck) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Fail "Node.js is not installed. Install Node.js $NodeMinMajor LTS or newer from https://nodejs.org and retry."
    }
    $nodeVersion = (& node --version).TrimStart('v')
    $major = [int]($nodeVersion.Split('.')[0])
    if ($major -lt $NodeMinMajor) {
        Fail "Node.js $nodeVersion detected. Version $NodeMinMajor.x or newer required."
    }
    Write-Ok "Node.js $nodeVersion detected"
}

# -- Collect configuration -------------------------------------------------
Write-Step "Configuration"

# If a bundle was provided, hydrate Endpoint + EnrollmentToken from it.
if ($ConfigBundle) {
    if (-not (Test-Path $ConfigBundle)) { Fail "Config bundle not found: $ConfigBundle" }
    try {
        $bundle = Get-Content $ConfigBundle -Raw | ConvertFrom-Json
    } catch {
        Fail "Could not parse $ConfigBundle as JSON: $($_.Exception.Message)"
    }
    if (-not $Endpoint -and $bundle.endpoint)              { $Endpoint        = $bundle.endpoint }
    if (-not $EnrollmentToken -and $bundle.enrollmentToken){ $EnrollmentToken = $bundle.enrollmentToken }
    if (-not $ClientName -and $bundle.clientName)          { $ClientName      = $bundle.clientName }
    Write-Ok "Loaded bundle: endpoint=$Endpoint clientName=$ClientName"
}

$UseEnrollment = [bool]$EnrollmentToken

$Endpoint = Read-Required "Printyx endpoint (e.g. https://app.printyx.net)" $Endpoint {
    param($v)
    if ($v -notmatch '^https://') { return "Endpoint must start with https:// (port 443)." }
    return $null
}

if (-not $UseEnrollment) {
    $ApiKey   = Read-Required "Client API key (pk_...)"  $ApiKey   { param($v) if ($v.Length -lt 16) { 'API key looks too short.' } }
    $TenantId = Read-Required "Tenant ID"                $TenantId
}
if (-not $NetworkRange -and -not $NonInteractive) {
    $NetworkRange = Read-Host "Network range to scan for printers (CIDR, e.g. 192.168.1.0/24) — leave blank to skip"
}

# Validate endpoint reachability over 443 BEFORE writing config.
Write-Step "Validating endpoint over TCP/443"
try {
    $u = [Uri]$Endpoint
    if ($u.Scheme -ne 'https') { Fail "Endpoint must be https://" }
    $port = if ($u.IsDefaultPort) { 443 } else { $u.Port }
    if ($port -ne 443) { Write-Warn2 "Endpoint uses non-standard port $port. Vulnerability scanners may flag this." }
    $tcp = [System.Net.Sockets.TcpClient]::new()
    $iar = $tcp.BeginConnect($u.Host, $port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne(5000)) {
        $tcp.Close()
        Fail "Could not reach $($u.Host):$port within 5s. Check DNS / firewall."
    }
    $tcp.EndConnect($iar)
    $tcp.Close()
    Write-Ok "TCP/$port reachable on $($u.Host)"
} catch {
    Fail "Endpoint validation failed: $($_.Exception.Message)"
}

# -- Build the client ------------------------------------------------------
Write-Step "Building client (npm install + npm run build)"
Push-Location $RepoRoot
try {
    if (-not (Test-Path (Join-Path $RepoRoot 'node_modules'))) {
        & npm install --omit=dev --no-audit --no-fund 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { Fail "npm install failed" }
    }
    # We need devDependencies for the TypeScript compile step. Install them just for the build.
    if (-not (Test-Path (Join-Path $RepoRoot 'node_modules\typescript'))) {
        & npm install --no-audit --no-fund 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { Fail "npm install (with devDependencies) failed" }
    }
    & npm run build 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Fail "npm run build failed" }
} finally {
    Pop-Location
}
Write-Ok "Build complete"

# -- Lay down install dirs -------------------------------------------------
Write-Step "Creating $InstallDir and $ConfigDir"
foreach ($d in @($InstallDir, $ConfigDir, $LogDir, $NssmDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

# Copy built artifacts.
Copy-Item (Join-Path $RepoRoot 'dist')          $InstallDir -Recurse -Force
Copy-Item (Join-Path $RepoRoot 'node_modules')  $InstallDir -Recurse -Force
Copy-Item (Join-Path $RepoRoot 'package.json')  $InstallDir -Force
Write-Ok "Files copied to $InstallDir"

# Restrict NTFS permissions on ConfigDir to Administrators + SYSTEM.
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)  # disable inheritance, drop inherited rules
foreach ($id in 'BUILTIN\Administrators','NT AUTHORITY\SYSTEM') {
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $id, 'FullControl',
        @('ContainerInherit','ObjectInherit'), 'None', 'Allow')
    $acl.AddAccessRule($rule)
}
$acl.SetOwner((New-Object System.Security.Principal.NTAccount('BUILTIN\Administrators')))
Set-Acl -Path $ConfigDir -AclObject $acl
Write-Ok "Locked $ConfigDir to Administrators + SYSTEM"

# -- Enrollment (if a token was provided) ----------------------------------
if ($UseEnrollment) {
    Write-Step "Redeeming enrollment token"
    $enrollUri = "$($Endpoint.TrimEnd('/'))/api/client-metrics/enroll"
    $body = @{
        token         = $EnrollmentToken
        hostname      = $env:COMPUTERNAME
        clientVersion = '1.0.0'
    } | ConvertTo-Json -Compress
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $resp = Invoke-RestMethod -Method Post -Uri $enrollUri `
                                  -ContentType 'application/json' `
                                  -Body $body -UseBasicParsing
    } catch {
        $msg = $_.Exception.Message
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $msg = $_.ErrorDetails.Message }
        Fail "Enrollment failed: $msg"
    }
    if (-not $resp.apiKey) { Fail "Enrollment response missing apiKey field." }
    $ApiKey   = $resp.apiKey
    $TenantId = "$($resp.tenantId)"
    if ($resp.endpoint) { $Endpoint = $resp.endpoint }
    if ($resp.clientId) { $EnrolledClientId = $resp.clientId }
    Write-Ok "Enrolled as client '$($resp.clientId)' in tenant $TenantId"
}

# -- Write config.json -----------------------------------------------------
Write-Step "Writing $ConfigPath"
$clientId = if ($EnrolledClientId) { $EnrolledClientId } else { "win-$($env:COMPUTERNAME.ToLower())-$([Guid]::NewGuid().ToString('N').Substring(0,8))" }
$config = [ordered]@{
    client = [ordered]@{
        id      = $clientId
        name    = $ClientName
        version = '1.0.0'
    }
    api = [ordered]@{
        endpoint = $Endpoint
        apiKey   = $ApiKey
        tenantId = $TenantId
        timeout  = 30000
        security = [ordered]@{
            rejectUnauthorized = $true
            minTLSVersion      = 'TLSv1.2'
        }
    }
    collection = [ordered]@{
        pollingInterval    = 300
        discoveryEnabled   = [bool]$NetworkRange
        networkRanges      = @(if ($NetworkRange) { $NetworkRange })
        retryAttempts      = 3
        timeout            = 10000
    }
    devices = @()
    alerts = [ordered]@{
        tonerThreshold = 15
        paperThreshold = 20
    }
    logging = [ordered]@{
        level = 'info'
        file  = $LogPath
    }
}

# Backup any existing config before overwriting.
if (Test-Path $ConfigPath) {
    $backup = "$ConfigPath.bak.$(Get-Date -Format yyyyMMddHHmmss)"
    Copy-Item $ConfigPath $backup -Force
    Write-Warn2 "Existing config backed up to $backup"
}
$config | ConvertTo-Json -Depth 10 | Set-Content -Path $ConfigPath -Encoding UTF8 -NoNewline
Write-Ok "Wrote $ConfigPath"

# -- NSSM (service wrapper) ------------------------------------------------
Write-Step "Installing NSSM service wrapper"
if (-not (Test-Path $NssmExe)) {
    $nssmZip = Join-Path $env:TEMP "nssm-2.24-$([Guid]::NewGuid()).zip"
    try {
        # TLS 1.2 for the download itself.
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -UseBasicParsing -Uri $NssmUrl -OutFile $nssmZip
        $hash = (Get-FileHash -Algorithm SHA256 -Path $nssmZip).Hash.ToLower()
        if ($hash -ne $NssmSha256) {
            Write-Warn2 "NSSM checksum mismatch (expected $NssmSha256, got $hash). Continuing anyway — verify against https://nssm.cc."
        }
        Expand-Archive -Path $nssmZip -DestinationPath $env:TEMP -Force
        $arch = if ([Environment]::Is64BitOperatingSystem) { 'win64' } else { 'win32' }
        $extracted = Join-Path $env:TEMP "nssm-2.24\$arch\nssm.exe"
        Copy-Item $extracted $NssmExe -Force
    } finally {
        Remove-Item $nssmZip -ErrorAction SilentlyContinue
    }
}
Write-Ok "NSSM at $NssmExe"

# -- Register service ------------------------------------------------------
Write-Step "Registering Windows service '$ServiceName'"
$nodeExe = (Get-Command node).Source
$entryJs = Join-Path $InstallDir 'dist\index.js'

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Warn2 "Service $ServiceName already exists — removing and reinstalling"
    & $NssmExe stop   $ServiceName confirm | Out-Null
    & $NssmExe remove $ServiceName confirm | Out-Null
}

& $NssmExe install $ServiceName "`"$nodeExe`"" "`"$entryJs`"" 'start' '-c' "`"$ConfigPath`"" | Out-Null
& $NssmExe set $ServiceName AppDirectory  "`"$InstallDir`""           | Out-Null
& $NssmExe set $ServiceName DisplayName    'Printyx Monitoring Client' | Out-Null
& $NssmExe set $ServiceName Description    'Collects printer meter and toner data and reports to the Printyx platform over HTTPS (TCP/443).' | Out-Null
& $NssmExe set $ServiceName Start          SERVICE_AUTO_START         | Out-Null
& $NssmExe set $ServiceName ObjectName     'NT AUTHORITY\NetworkService' | Out-Null
& $NssmExe set $ServiceName AppStdout      "`"$LogPath`""             | Out-Null
& $NssmExe set $ServiceName AppStderr      "`"$LogPath`""             | Out-Null
& $NssmExe set $ServiceName AppRotateFiles 1                          | Out-Null
& $NssmExe set $ServiceName AppRotateBytes 10485760                   | Out-Null
& $NssmExe set $ServiceName AppRotateOnline 1                         | Out-Null
& $NssmExe set $ServiceName AppExit Default Restart                   | Out-Null
& $NssmExe set $ServiceName AppRestartDelay 10000                     | Out-Null
& $NssmExe set $ServiceName AppThrottle    15000                      | Out-Null
Write-Ok "Service registered (auto-start, runs as NetworkService, log rotation 10MB)"

# Grant NetworkService read on config + read/write on logs.
$networkServiceSid = New-Object System.Security.Principal.SecurityIdentifier 'S-1-5-20'
$networkService    = $networkServiceSid.Translate([System.Security.Principal.NTAccount])

$logAcl = Get-Acl $LogDir
$logAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
    $networkService, 'Modify',
    @('ContainerInherit','ObjectInherit'), 'None', 'Allow')))
Set-Acl -Path $LogDir -AclObject $logAcl

$cfgAcl = Get-Acl $ConfigPath
$cfgAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
    $networkService, 'Read', 'Allow')))
Set-Acl -Path $ConfigPath -AclObject $cfgAcl
Write-Ok "Granted NetworkService read on config + write on logs"

# -- Firewall rule (outbound 443 only) -------------------------------------
if (-not $SkipFirewallRule) {
    Write-Step "Adding outbound firewall rule (TCP/443 only)"
    $ruleName = 'Printyx Client - Outbound HTTPS'
    Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Outbound -Action Allow `
        -Program $nodeExe -Protocol TCP -RemotePort 443 `
        -Profile Any | Out-Null
    Write-Ok "Firewall rule added"
}

# -- Start service ---------------------------------------------------------
Write-Step "Starting $ServiceName"
& $NssmExe start $ServiceName | Out-Null
Start-Sleep -Seconds 3
$svc = Get-Service -Name $ServiceName
if ($svc.Status -ne 'Running') {
    Write-Warn2 "Service status: $($svc.Status). Tail $LogPath for details."
} else {
    Write-Ok "Service running"
}

# -- Summary ---------------------------------------------------------------
Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Printyx Monitoring Client — install complete"      -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Service        : $ServiceName"
Write-Host "  Install dir    : $InstallDir"
Write-Host "  Config         : $ConfigPath"
Write-Host "  Log file       : $LogPath"
Write-Host "  Endpoint       : $Endpoint  (TCP/443, TLS 1.2+)"
Write-Host ""
Write-Host "  Useful commands:"
Write-Host "    Get-Service $ServiceName"
Write-Host "    Restart-Service $ServiceName"
Write-Host "    Get-Content '$LogPath' -Tail 50 -Wait"
Write-Host ""
Write-Host "  Uninstall:"
Write-Host "    .\uninstall-windows.ps1"
Write-Host ""
