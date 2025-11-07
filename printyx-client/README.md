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

## Requirements

- Node.js 18.0 or higher
- Network access to printers (SNMP port 161 or HTTP/HTTPS)
- API credentials from your Printyx platform

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

### Windows Installation

```powershell
# Build the client
npm run build
npm install -g .

# Generate config
printyx-client init -o C:\ProgramData\Printyx\config.json

# Edit configuration
notepad C:\ProgramData\Printyx\config.json

# Install as Windows Service (using nssm or similar)
# Download nssm from https://nssm.cc/
nssm install PrintyxClient "C:\Program Files\nodejs\printyx-client" start -c C:\ProgramData\Printyx\config.json
nssm start PrintyxClient
```

## Configuration

### Getting API Credentials

1. Log in to your Printyx platform
2. Navigate to **Settings** → **Monitoring Clients**
3. Click **"Add New Client"**
4. Copy the generated API key (shown only once!)
5. Note your Tenant ID from the settings page

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
    "endpoint": "https://your-printyx.com/api/client-metrics/submit",
    "apiKey": "your-api-key-here",
    "tenantId": "your-tenant-id",
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

# Discover printers on network
printyx-client discover 192.168.1.0/24

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

# Build
npm run build

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
