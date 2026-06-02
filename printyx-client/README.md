# Printyx Monitoring Client

A lightweight, standalone monitoring client for tracking copier toner levels and sending data to the Printyx platform. Replaces unreliable third-party tools like FM Audit/Printanista with direct SNMP/HTTP monitoring.

## Features

- **SNMP Monitoring**: Industry-standard SNMP protocol support for most copiers
- **Auto-Discovery**: Automatically discover printers on your network
- **Multi-Manufacturer**: Supports Canon, Xerox, HP, Ricoh, Konica Minolta, and more
- **Reliable**: Direct communication without third-party dependencies
- **Lightweight**: Minimal resource usage, runs on any server
- **Configurable**: Flexible polling intervals and device configuration
- **Secure**: API key authentication with your Printyx instance

## Security Features

The Printyx Client is designed for secure enterprise deployments including healthcare (HIPAA), financial services, legal firms, and government contractors.

### Transport Security

- **HTTPS Only**: All API communication over TLS 1.2+ (HTTP rejected)
- **Certificate Validation**: Full chain validation with hostname verification
- **Certificate Pinning**: Optional SHA-256 fingerprint or public key pinning
- **Custom CA Support**: Private certificate authority support

### Data Protection

- **AES-256-GCM Encryption**: API keys and passwords encrypted at rest
- **Machine-Specific Keys**: Derived from hardware identifiers
- **File Permissions**: Auto-set to 600 (owner only) on Unix systems
- **Secure Memory**: Best-effort credential wiping after use

### Authentication

- **API Key Authentication**: SHA-256 hashed keys with bearer tokens
- **Key Rotation**: Zero-downtime key rotation supported
- **Tenant Isolation**: Multi-tenant architecture with strict scoping

### Protocol Security

- **SNMPv3 Support**: Authentication and encryption for printer monitoring
- **TLS Enforcement**: Minimum TLS 1.2, SSLv2/v3/TLS1.0/1.1 disabled
- **Secure Defaults**: All insecure options disabled by default

### Compliance

- ✅ HIPAA compliant (with BAA)
- ✅ PCI DSS requirements met
- ✅ SOC 2 security controls
- ✅ FedRAMP/NIST 800-53 compatible
- ✅ Audit logging for security events

**See [SECURITY.md](SECURITY.md) for complete security documentation, hardening guide, and compliance information.**

## Requirements

- Network access to printers (SNMP port 161 or HTTP/HTTPS)
- An enrollment token (or API key) from your Printyx platform
- **HTTPS endpoint** (HTTP not supported for security)
- Node.js 18+ — **only if you install from source**. The platform installer
  ships a prebuilt, self-contained agent and auto-installs Node LTS if it's
  missing, so a fresh Windows server needs nothing pre-installed.

## Installation

### Quick Install

```bash
# Install dependencies
npm install

# Build the client
npm run build

# Generate sample configuration
npm start init

# Edit config.json with your settings
nano config.json

# Start monitoring
npm start start
```

### Production Install (Linux)

```bash
# Build and install globally
npm run build
npm install -g .

# Create config directory
sudo mkdir -p /etc/printyx-client
sudo printyx-client init -o /etc/printyx-client/config.json

# Edit configuration
sudo nano /etc/printyx-client/config.json

# Create systemd service
sudo nano /etc/systemd/system/printyx-client.service
```

Add the following to `/etc/systemd/system/printyx-client.service`:

```ini
[Unit]
Description=Printyx Monitoring Client
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/etc/printyx-client
ExecStart=/usr/local/bin/printyx-client start -c /etc/printyx-client/config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable printyx-client
sudo systemctl start printyx-client
sudo systemctl status printyx-client
```

### Windows Installation (recommended)

There are three install paths, in order of operator effort:

#### A. Tenant-scoped bundle from the platform

In the Printyx UI: **Monitoring → Monitoring Clients → Add Client →
Download Windows Installer**. You get back a fully self-contained zip,
pre-wired to that tenant and customer:

```
printyx-client-<clientid>.zip
├── install-windows.ps1
├── uninstall-windows.ps1
├── printyx-client.cjs       ← prebuilt agent (all deps inlined)
├── bundle-manifest.json     ← version metadata
└── bootstrap-config.json    ← endpoint + one-time enrollment token
```

On the target server (elevated PowerShell):

```powershell
Expand-Archive .\printyx-client-clientid.zip -DestinationPath .\printyx
cd .\printyx
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install-windows.ps1 -ConfigBundle .\bootstrap-config.json
```

Because the agent is prebuilt, there is **no `npm install` and no compile**
on the target — install is seconds, not minutes. If Node.js is missing the
installer installs Node LTS automatically. It then redeems the bundle's
enrollment token over HTTPS/443, receives a permanent API key, writes
`config.json`, and starts the Windows service. **No API key ever touches the
zip** — just a short-lived token that becomes useless after redemption.

#### B. One-line web install + enrollment token

Hand out one PowerShell command per server. The bootstrap it downloads pulls
the prebuilt agent and the installer from the platform, so there's no repo
checkout and no build:

```powershell
# In the platform UI: Monitoring → Monitoring Clients → Generate Token
# It returns an `et_...` token + a copy-paste command that looks like:
iwr -UseBasicParsing https://app.printyx.net/install/printyx-client.ps1 `
    -OutFile $env:TEMP\printyx-install.ps1
& $env:TEMP\printyx-install.ps1 `
    -EnrollmentToken 'et_xxxxxxxxxxxxxxxx' `
    -Endpoint        'https://app.printyx.net'
```

The platform serves three public files behind this: `/install/printyx-client.ps1`
(the bootstrap), `/install/install-windows.ps1` (the installer), and
`/install/printyx-client.cjs` (the agent). None contains a secret — the API
key only materialises after the enrollment token is redeemed over HTTPS.

#### C. Local checkout (developer install)

If you cloned the repo manually:

```powershell
# From the printyx-client directory, in an elevated PowerShell:
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\install-windows.ps1
```

It will prompt for endpoint, API key, tenant ID, and (optionally) a CIDR
range. To run unattended:

```powershell
.\scripts\install-windows.ps1 `
    -Endpoint     'https://app.printyx.net' `
    -ApiKey       'pk_xxxxxxxxxxxxxxxx' `
    -TenantId     '1' `
    -NetworkRange '192.168.1.0/24' `
    -NonInteractive
```

What the installer does:

| Step | Result |
| --- | --- |
| Ensures Node.js >= 18 | auto-installs Node LTS (winget → MSI) if missing |
| Picks bundle mode when `printyx-client.cjs` is present | skips npm install + TypeScript build entirely |
| Validates the endpoint over TCP/443 before writing config | catches DNS/firewall errors early |
| Copies the agent to `C:\Program Files\Printyx\Client` | single `.cjs` in bundle mode; `dist/` + `node_modules` in source mode |
| Writes `C:\ProgramData\Printyx\config.json` | NTFS ACL: Administrators + SYSTEM only |
| Downloads NSSM (https://nssm.cc) and registers `PrintyxClient` service | runs as `NetworkService`, auto-start, auto-restart, 10 MB log rotation |
| Adds outbound firewall rule | agent → TCP/443 only |
| Starts the service and confirms it is `Running` | |
| Runs a post-install self-test | one discovery+collect cycle; reports "N/M printers reporting" to the platform UI |

After install:

```powershell
Get-Service PrintyxClient
Get-Content 'C:\ProgramData\Printyx\logs\printyx-client.log' -Tail 50 -Wait
```

To remove:

```powershell
.\scripts\uninstall-windows.ps1                # full removal
.\scripts\uninstall-windows.ps1 -KeepConfig    # keep config + meter state
```

### Windows: one-line bootstrap

The recommended fresh-server path is option **B** above — the platform's own
`/install/printyx-client.ps1` bootstrap pulls the prebuilt agent and runs the
installer with no repo checkout and no build.

`Install-FromWeb.ps1` is an alternative that clones the **full source**
archive and builds it on the target (source mode). Prefer it only when you
explicitly want to build from a specific git ref:

```powershell
irm https://your-printyx.example/install.ps1 | iex
```

## Configuration

### Getting API Credentials

1. Log in to your Printyx platform
2. Navigate to **Monitoring** → **Monitoring Clients**
3. Click **"Register New Client"**
4. Enter a client name and optional location
5. Copy the generated API key (shown only once!)
6. The tenant ID will be automatically associated with your account

### Configuration File

Edit `config.json`:

```json
{
  "client": {
    "id": "client-001",
    "name": "Main Office Client",
    "version": "1.0.0"
  },
  "api": {
    "endpoint": "https://your-printyx.com",
    "apiKey": "pk_your_api_key_here",
    "tenantId": "1",
    "timeout": 30000
  },
  "collection": {
    "pollingInterval": 300,
    "discoveryEnabled": true,
    "networkRanges": ["192.168.1.0/24"],
    "retryAttempts": 3,
    "timeout": 10000
  },
  "devices": [
    {
      "ipAddress": "192.168.1.100",
      "protocol": "snmp",
      "snmpCommunity": "public",
      "snmpVersion": "2c"
    }
  ],
  "alerts": {
    "tonerThreshold": 15,
    "paperThreshold": 20
  },
  "logging": {
    "level": "info",
    "file": "printyx-client.log"
  }
}
```

## Usage

### Commands

```bash
# Initialize configuration
printyx-client init

# Start monitoring
printyx-client start

# Start with custom config
printyx-client start -c /path/to/config.json

# Test device connectivity
printyx-client test 192.168.1.100
printyx-client test 192.168.1.100 --community private

# Discover printers on the local subnet (default: mDNS + WSD, ~5s)
printyx-client discover

# Pick specific discovery methods
printyx-client discover --method mdns
printyx-client discover --method wsd
printyx-client discover 192.168.1.0/24 --method cidr      # legacy CIDR sweep
printyx-client discover 192.168.1.0/24 --method all       # all three, merged

# Show version
printyx-client version
```

### Testing a Device

Before adding a device to your configuration, test connectivity:

```bash
printyx-client test 192.168.1.100
```

This will:

- Test SNMP connectivity
- Retrieve device information
- Display toner levels
- Show meter readings

### Network Discovery

Automatically find printers on your network:

```bash
printyx-client discover 192.168.1.0/24
```

This will scan the specified network range and display all discoverable printers.

## Monitoring

### Logs

View logs:

```bash
# Linux (systemd)
sudo journalctl -u printyx-client -f

# Or check log file
tail -f printyx-client.log
```

### Troubleshooting

**Connection Failed**

- Verify API endpoint URL is correct
- Check API key and tenant ID
- Ensure network connectivity to Printyx platform

**No Devices Found**

- Verify SNMP is enabled on printers (check printer settings)
- Confirm correct SNMP community string (default: "public")
- Check firewall rules allow SNMP (UDP port 161)
- Ensure network ranges are correct

**Incomplete Metrics**

- Some manufacturers use proprietary MIBs
- Try different SNMP versions (v1, v2c, v3)
- Check printer documentation for SNMP configuration

**High CPU Usage**

- Increase polling interval in config
- Reduce number of devices per client
- Check for network latency issues

## SNMP Configuration

### Enable SNMP on Printers

**Canon imageRUNNER:**

1. Access web interface
2. Settings → Network → SNMP Settings
3. Enable SNMP v1/v2
4. Set community name (default: public)

**Xerox:**

1. Access web interface
2. Properties → Connectivity → Protocols
3. Enable SNMP
4. Set access control

**HP LaserJet/PageWide:**

1. Access web interface
2. Network → SNMP → Access Control
3. Enable SNMP v1/v2
4. Set community name

### Security Best Practices

1. Change default SNMP community from "public"
2. Use read-only SNMP access
3. Restrict SNMP access by IP address
4. Consider SNMPv3 for encryption (where supported)
5. Keep API keys secure and rotate regularly

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build (TypeScript → dist/, for source-mode installs)
npm run build

# Bundle (single self-contained dist/printyx-client.cjs the platform ships)
npm run bundle

# Build a zero-dependency Windows .exe (Node SEA — experimental, opt-in)
npm run build:exe

# Run tests
npm test

# Lint code
npm run lint
```

## Architecture

```
printyx-client/
├── src/
│   ├── collectors/          # SNMP and HTTP collectors
│   ├── discovery/           # Network scanning
│   ├── api/                 # Printyx API client
│   ├── config/              # Configuration management
│   ├── services/            # Scheduler and orchestration
│   ├── utils/               # Logging utilities
│   └── index.ts             # Main entry point
├── config.json              # Configuration file
└── package.json
```

## Support

For issues or questions:

- Check logs for error messages
- Verify network connectivity
- Ensure SNMP is enabled on devices
- Contact Printyx support with log excerpts

## License

MIT License - See LICENSE file for details
