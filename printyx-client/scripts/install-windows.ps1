#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    One-shot installer for the Printyx Monitoring Client on Windows Server.

.DESCRIPTION
    Performs a turn-key install:
      - Ensures Node.js >= 18 (auto-installs Node LTS via winget/MSI if missing)
      - Uses a prebuilt, self-contained printyx-client.cjs when present (no
        npm install, no TypeScript build) — falls back to building from a
        source checkout only when no bundle is found
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

.PARAMETER BundlePath
    Explicit path to a prebuilt printyx-client.cjs. When omitted, the
    installer looks for one next to this script or in ..\dist. If none is
    found and a source checkout is present, it builds from TypeScript.

.PARAMETER SkipNodeAutoInstall
    Do not auto-install Node.js — fail if Node >= 18 is missing. Useful on
    locked-down hosts that manage Node through their own packaging.

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
    # Explicit path to a prebuilt printyx-client.cjs. When omitted, the
    # installer auto-detects one next to this script or in ..\dist.
    [string]$BundlePath,
    # Install the self-contained printyx-client.exe (Node SEA) instead of the
    # JS bundle. Needs no Node on the host. Downloaded from the platform if not
    # shipped locally. Note: auto-update is disabled for .exe installs.
    [switch]$UseExe,
    [switch]$NonInteractive,
    [switch]$SkipFirewallRule,
    [switch]$SkipNodeCheck,
    # By default, if Node.js >=18 is missing the installer installs Node LTS
    # automatically (winget, falling back to the official MSI). Set this to
    # fail instead — useful on locked-down hosts with their own packaging.
    [switch]$SkipNodeAutoInstall,
    # When set, add inbound firewall rules for mDNS (UDP 5353) and WSD
    # (UDP 3702) scoped to the local subnet so the agent can do
    # zero-config printer discovery. Off by default — only relevant if
    # discoveryMethods includes 'mdns' or 'wsd'.
    [switch]$EnableDiscoveryFirewall
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
# LTS pinned for the MSI fallback path (winget tracks LTS on its own).
$NodeLtsVersion = '20.18.1'
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

function Install-NodeLts {
    # Prefer winget (present on Windows Server 2025 / recent Win10+). Fall
    # back to the official MSI from nodejs.org over HTTPS/TLS1.2.
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Step "Installing Node.js LTS via winget"
        & winget install --id OpenJS.NodeJS.LTS -e --silent `
            --accept-package-agreements --accept-source-agreements 2>&1 | Out-Host
        if ($LASTEXITCODE -eq 0) { return }
        Write-Warn2 "winget install failed (exit $LASTEXITCODE) — falling back to MSI."
    }

    $arch = if ([Environment]::Is64BitOperatingSystem) {
        if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    } else { 'x86' }
    $msiUrl = "https://nodejs.org/dist/v$NodeLtsVersion/node-v$NodeLtsVersion-$arch.msi"
    $msi    = Join-Path $env:TEMP "node-v$NodeLtsVersion-$arch.msi"
    Write-Step "Downloading Node.js LTS MSI ($arch) from nodejs.org"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri $msiUrl -OutFile $msi
    Write-Step "Installing Node.js (silent MSI)"
    $p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait -PassThru
    Remove-Item $msi -ErrorAction SilentlyContinue
    if ($p.ExitCode -ne 0) { Fail "Node.js MSI install failed (exit $($p.ExitCode))." }
}

function Ensure-Node {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        $nodeVersion = (& node --version).TrimStart('v')
        $major = [int]($nodeVersion.Split('.')[0])
        if ($major -ge $NodeMinMajor) {
            Write-Ok "Node.js $nodeVersion detected"
            return
        }
        Write-Warn2 "Node.js $nodeVersion is older than $NodeMinMajor.x — upgrading."
    } else {
        Write-Warn2 "Node.js not found — installing Node $NodeMinMajor LTS automatically."
    }
    if ($SkipNodeAutoInstall) {
        Fail "Node.js $NodeMinMajor+ required and auto-install is disabled (-SkipNodeAutoInstall). Install from https://nodejs.org and retry."
    }
    Install-NodeLts
    # Refresh PATH for this process so the freshly-installed node resolves.
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Fail "Node.js installed but 'node' is still not on PATH. Open a new elevated PowerShell and re-run, or reboot."
    }
    $nodeVersion = (& node --version).TrimStart('v')
    Write-Ok "Node.js $nodeVersion ready"
}

# -- Pre-flight checks -----------------------------------------------------
Write-Step "Pre-flight checks"

if (-not [Security.Principal.WindowsPrincipal]::new(
        [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail "This script must be run as Administrator."
}
Write-Ok "Running as Administrator"

# Resolve where our payload lives. Three supported layouts:
#   exe     — a self-contained printyx-client.exe (Node SEA). Zero
#             prerequisites — Node is embedded. Opt-in via -UseExe or by
#             shipping the .exe next to this script. Auto-update is disabled
#             for exe installs (a SEA can't self-replace).
#   bundle  — a prebuilt printyx-client.cjs sits next to this script (this is
#             what the platform ships in the installer zip). Zero build, no
#             node_modules, no devDependencies. Needs Node (auto-installed).
#   source  — a full source checkout (../package.json + ../src). We compile
#             from TypeScript. Legacy path, used for developer installs.
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$RepoRoot  = Split-Path -Parent $ScriptDir

$exeCandidates = @(
    (Join-Path $ScriptDir 'printyx-client.exe'),
    (Join-Path $ScriptDir 'dist\printyx-client.exe'),
    (Join-Path $RepoRoot  'dist\printyx-client.exe')
) | Where-Object { $_ }
$ExeFile = $exeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

$bundleCandidates = @(
    $BundlePath,
    (Join-Path $ScriptDir 'printyx-client.cjs'),
    (Join-Path $ScriptDir 'dist\printyx-client.cjs'),
    (Join-Path $RepoRoot  'dist\printyx-client.cjs')
) | Where-Object { $_ }
$BundleFile = $bundleCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$HasSource  = Test-Path (Join-Path $RepoRoot 'package.json')

$NeedsBundleDownload = $false
$NeedsExeDownload     = $false
if ($UseExe -or $ExeFile) {
    $InstallMode = 'exe'
    if ($ExeFile) {
        Write-Ok "Self-contained binary: $ExeFile (no Node required)"
    } else {
        $NeedsExeDownload = $true
        Write-Ok "No local binary — will download printyx-client.exe from the platform (no Node required)"
    }
} elseif ($BundleFile) {
    $InstallMode = 'bundle'
    Write-Ok "Prebuilt bundle: $BundleFile (no build required)"
} elseif ($HasSource) {
    $InstallMode = 'source'
    Write-Ok "Source checkout: $RepoRoot (will compile from TypeScript)"
} else {
    # No bundle in the payload and no source — fetch the prebuilt agent from
    # the platform later (after the endpoint is known + validated). This is
    # the path the UI "Download Installer" zip takes: it ships only the
    # scripts, and the agent is pulled from <Endpoint>/install/printyx-client.cjs.
    $InstallMode = 'bundle'
    $NeedsBundleDownload = $true
    Write-Ok "No local agent — will download the prebuilt bundle from the platform"
}

# The .exe embeds Node; only the JS paths need a Node runtime on the host.
if (-not $SkipNodeCheck -and $InstallMode -ne 'exe') {
    Ensure-Node
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

# -- Build the client (source mode only) -----------------------------------
# In bundle mode there is nothing to build — printyx-client.cjs already has
# every dependency inlined. This is the common path for platform installs.
if ($InstallMode -eq 'source') {
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
}

# -- Lay down install dirs -------------------------------------------------
Write-Step "Creating $InstallDir and $ConfigDir"
foreach ($d in @($InstallDir, $ConfigDir, $LogDir, $NssmDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

# Copy artifacts. exe mode lays down a single self-contained .exe; bundle mode
# a single .cjs; source mode the compiled dist/ plus node_modules. $entryJs is
# the JS the service runs (node modes); $ServiceExe is set for exe mode.
$ServiceExe = $null
if ($InstallMode -eq 'exe') {
    $destExe = Join-Path $InstallDir 'printyx-client.exe'
    if ($NeedsExeDownload) {
        Write-Step "Downloading self-contained binary from $Endpoint"
        $exeUrl = "$($Endpoint.TrimEnd('/'))/install/printyx-client.exe"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        try {
            Invoke-WebRequest -UseBasicParsing -Uri $exeUrl -OutFile $destExe
        } catch {
            Fail "Could not download printyx-client.exe from $exeUrl : $($_.Exception.Message)"
        }
        if (-not (Test-Path $destExe) -or (Get-Item $destExe).Length -lt 1MB) {
            Fail "Downloaded binary is missing or too small — aborting."
        }
        Write-Ok ("Binary downloaded ({0} MB)" -f [math]::Round((Get-Item $destExe).Length / 1MB, 2))
    } else {
        Copy-Item $ExeFile $destExe -Force
        Write-Ok "Binary copied to $InstallDir (Node embedded — no runtime needed)"
    }
    $ServiceExe = $destExe
} elseif ($InstallMode -eq 'bundle') {
    $destBundle = Join-Path $InstallDir 'printyx-client.cjs'
    if ($NeedsBundleDownload) {
        Write-Step "Downloading agent bundle from $Endpoint"
        $bundleUrl = "$($Endpoint.TrimEnd('/'))/install/printyx-client.cjs"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        try {
            Invoke-WebRequest -UseBasicParsing -Uri $bundleUrl -OutFile $destBundle
        } catch {
            Fail "Could not download the agent bundle from $bundleUrl : $($_.Exception.Message)"
        }
        if (-not (Test-Path $destBundle) -or (Get-Item $destBundle).Length -lt 100KB) {
            Fail "Downloaded agent bundle is missing or too small — aborting."
        }
        Write-Ok ("Agent bundle downloaded ({0} MB)" -f [math]::Round((Get-Item $destBundle).Length / 1MB, 2))
    } else {
        Copy-Item $BundleFile $destBundle -Force
        $manifest = Join-Path (Split-Path $BundleFile) 'bundle-manifest.json'
        if (Test-Path $manifest) { Copy-Item $manifest $InstallDir -Force }
        if ($HasSource) { Copy-Item (Join-Path $RepoRoot 'package.json') $InstallDir -Force }
        Write-Ok "Bundle copied to $InstallDir (no node_modules required)"
    }
    $entryJs = $destBundle
} else {
    Copy-Item (Join-Path $RepoRoot 'dist')          $InstallDir -Recurse -Force
    Copy-Item (Join-Path $RepoRoot 'node_modules')  $InstallDir -Recurse -Force
    Copy-Item (Join-Path $RepoRoot 'package.json')  $InstallDir -Force
    $entryJs = Join-Path $InstallDir 'dist\index.js'
    Write-Ok "Files copied to $InstallDir"
}

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
# Resolve the binary the service launches + its argument list. In exe mode the
# SEA binary runs directly; otherwise node runs the JS entry point. $RunBinary
# is also what the outbound firewall rule is scoped to.
if ($InstallMode -eq 'exe') {
    $RunBinary  = $ServiceExe
    $RunAppArgs = @('start', '-c', "`"$ConfigPath`"")
    # $SelfTestCmd invokes the same binary for the post-install check.
} else {
    $RunBinary  = (Get-Command node).Source
    $RunAppArgs = @("`"$entryJs`"", 'start', '-c', "`"$ConfigPath`"")
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Warn2 "Service $ServiceName already exists — removing and reinstalling"
    & $NssmExe stop   $ServiceName confirm | Out-Null
    & $NssmExe remove $ServiceName confirm | Out-Null
}

& $NssmExe install $ServiceName "`"$RunBinary`"" @RunAppArgs | Out-Null
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
        -Program $RunBinary -Protocol TCP -RemotePort 443 `
        -Profile Any | Out-Null
    Write-Ok "Firewall rule added"
}

# -- Discovery firewall rules (opt-in: -EnableDiscoveryFirewall) -----------
# mDNS (UDP/5353) and WSD (UDP/3702) are intra-LAN multicast. We allow
# them on the Domain + Private profiles only — never Public — so a
# laptop that wanders onto an airport WiFi can't be probed remotely.
if ($EnableDiscoveryFirewall) {
    Write-Step "Adding firewall rules for mDNS + WSD (Domain/Private profiles only)"

    foreach ($rule in @(
        @{ Name = 'Printyx Client - mDNS Discovery (in)';  Direction = 'Inbound';  Port = 5353 },
        @{ Name = 'Printyx Client - mDNS Discovery (out)'; Direction = 'Outbound'; Port = 5353 },
        @{ Name = 'Printyx Client - WSD Discovery (in)';   Direction = 'Inbound';  Port = 3702 },
        @{ Name = 'Printyx Client - WSD Discovery (out)';  Direction = 'Outbound'; Port = 3702 }
    )) {
        Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        $params = @{
            DisplayName = $rule.Name
            Direction   = $rule.Direction
            Action      = 'Allow'
            Program     = $RunBinary
            Protocol    = 'UDP'
            Profile     = 'Domain,Private'
        }
        if ($rule.Direction -eq 'Inbound') {
            $params.LocalPort = $rule.Port
        } else {
            $params.RemotePort = $rule.Port
        }
        New-NetFirewallRule @params | Out-Null
    }
    Write-Ok "Discovery firewall rules added (mDNS 5353, WSD 3702 — Domain/Private only)"
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

# -- Post-install self-test ------------------------------------------------
# Runs one discovery + collection cycle and reports the result to the
# platform, so the operator gets immediate confirmation (and the dealer sees
# a green status in the UI) instead of having to read logs. Non-fatal: the
# service keeps running regardless.
Write-Step "Running install self-test (discovery + one collection cycle)"
$selftestExit = 1
try {
    if ($InstallMode -eq 'exe') {
        & $RunBinary selftest -c $ConfigPath 2>&1 | Out-Host
    } else {
        & $RunBinary $entryJs selftest -c $ConfigPath 2>&1 | Out-Host
    }
    $selftestExit = $LASTEXITCODE
} catch {
    Write-Warn2 "Self-test could not run: $($_.Exception.Message)"
}
if ($selftestExit -eq 0) {
    Write-Ok "Self-test passed — printers are reporting to the platform."
} elseif ($selftestExit -eq 2) {
    Write-Warn2 "Service installed, but no printer reported yet. The agent keeps polling — verify SNMP is enabled and the network range is correct."
} else {
    Write-Warn2 "Self-test did not complete cleanly. The service is still running and will keep trying."
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
