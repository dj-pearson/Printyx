# Quick Start: Connect Existing Client to Dashboard

This guide will help you quickly connect the Printyx monitoring client to the new device monitoring dashboard.

## ⚡ Two-Click Setup (Windows, recommended)

1. **Platform side:** UI → **Monitoring → Monitoring Clients → Add Client →
   Download Windows Installer**. You receive
   `printyx-client-<clientid>.zip`. The zip is tied to that tenant +
   customer; the installer figures out where to send data automatically.
2. **Server side:** copy the zip to the target Windows Server, then in an
   elevated PowerShell:

   ```powershell
   Expand-Archive .\printyx-client-clientid.zip -DestinationPath .\printyx
   cd .\printyx
   Set-ExecutionPolicy -Scope Process Bypass -Force
   .\install-windows.ps1 -ConfigBundle .\bootstrap-config.json
   ```

   That's it. The installer redeems the bundle's one-time enrollment
   token over HTTPS/443, receives the permanent API key, hardens NTFS
   ACLs, registers the `PrintyxClient` Windows service, and starts it.

If you'd rather hand out a single command instead of a zip, use **Generate
Token** in the same UI screen and paste the resulting `iwr ... | iex`
one-liner on the server.

## ⚡ 5-Minute Setup (manual / Linux)

### Step 1: Register Client (Web UI)

1. Open your Printyx web interface
2. Navigate to **Monitoring** → **Monitoring Clients**
3. Click **"Register New Client"**
4. Fill in:
   - **Client Name**: e.g., "Main Office Monitor"
   - **Location** (optional): e.g., "Building A, Floor 2"
5. Click **Register**
6. **IMPORTANT**: Copy the API key shown - it's only displayed once!

### Step 2: Configure Client

```bash
cd printyx-client

# Copy example config
cp config.example.json config.json

# Edit configuration
nano config.json
```

Update these fields:

```json
{
  "client": {
    "id": "main-office-001", // Change to match your client name
    "name": "Main Office Monitor", // Same as registered name
    "version": "1.0.0"
  },
  "api": {
    "endpoint": "https://your-domain.com", // Your Printyx URL (without /api/...)
    "apiKey": "pk_ABC123...", // Paste the API key from Step 1
    "tenantId": "1" // Will be auto-detected
  },
  "devices": [
    {
      "ipAddress": "192.168.1.100", // Your printer IP
      "protocol": "snmp",
      "snmpCommunity": "public", // Your SNMP community string
      "snmpVersion": "2c"
    }
  ]
}
```

### Step 3: Test Connection

```bash
# Install dependencies (first time only)
npm install

# Test the API connection
npm run dev -- test 192.168.1.100

# Or discover printers on your network
npm run dev -- discover 192.168.1.0/24
```

### Step 4: Start Monitoring

```bash
# Start the client
npm run dev -- start
```

You should see output like:

```
✓ Successfully connected to Printyx platform
✓ Monitoring client started successfully
  Polling interval: 300 seconds
  Discovery enabled: true
```

### Step 5: View Live Data in Dashboard

1. Go to **Monitoring** → **Device Monitoring**
2. You should see your devices appear within 5 minutes
3. View real-time:
   - Device status (online/offline)
   - Toner levels with color-coded bars
   - Meter readings
   - Active alerts

## 🔧 Troubleshooting

### "Failed to connect to Printyx platform"

**Check:**

- Is the `endpoint` URL correct? (should be `https://your-domain.com` without `/api/...`)
- Is the API key valid? Try regenerating it in the web UI
- Can you access the URL in a browser?

**Test manually:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "X-Tenant-ID: 1" \
     https://your-domain.com/api/client-metrics/heartbeat
```

Should return: `{"message":"Heartbeat acknowledged","serverTime":"..."}`

### "SNMP connection failed"

**Check:**

- Is SNMP enabled on the printer? (Check printer web interface)
- Is the community string correct? (default is usually "public")
- Can you ping the printer? `ping 192.168.1.100`
- Is SNMP port 161 open? (Check firewall)

**Test manually:**

```bash
# If you have snmpwalk installed
snmpwalk -v2c -c public 192.168.1.100
```

### No devices showing in dashboard

**Check:**

- Is the client running? Check logs: `tail -f printyx-client.log`
- Did you wait 5 minutes? (Initial polling interval)
- Are there errors in the Activity Log? (Web UI → Monitoring → Monitoring Clients → Click your client)

## 📊 What Gets Monitored

Once connected, the dashboard will show:

- ✅ Device status (online/offline/error)
- ✅ Toner levels (Black, Cyan, Magenta, Yellow)
- ✅ Paper levels (Tray 1, 2, 3, 4)
- ✅ Meter readings (Total, B&W, Color prints)
- ✅ Device information (Serial, Model, IP)
- ✅ Automatic toner alerts (<15% threshold)

Data updates every 5 minutes (configurable via `pollingInterval`).

## 🚀 Next Steps

### Run as a Service (Linux)

```bash
npm run build
npm install -g .

# Create systemd service
sudo nano /etc/systemd/system/printyx-client.service
```

Paste:

```ini
[Unit]
Description=Printyx Monitoring Client
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/printyx-client
ExecStart=/usr/local/bin/printyx-client start -c /opt/printyx-client/config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable printyx-client
sudo systemctl start printyx-client
sudo systemctl status printyx-client
```

### Run as a Service (Windows)

Skip the manual steps — there is a one-shot installer:

```powershell
# Elevated PowerShell, from the printyx-client directory
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\install-windows.ps1
```

It builds the client, hardens config-file ACLs, installs the
`PrintyxClient` Windows service via NSSM, adds an outbound firewall rule
restricted to TCP/443, and starts the service. See
[README.md](README.md#windows-installation-recommended) for parameter usage
and unattended install.

### Add More Devices

Edit `config.json` and add devices to the `devices` array:

```json
{
  "devices": [
    {
      "ipAddress": "192.168.1.100",
      "protocol": "snmp",
      "snmpCommunity": "public",
      "snmpVersion": "2c"
    },
    {
      "ipAddress": "192.168.1.101",
      "protocol": "snmp",
      "snmpCommunity": "public",
      "snmpVersion": "2c"
    }
  ]
}
```

Restart the client to pick up changes.

### Enable Auto-Discovery

```json
{
  "collection": {
    "discoveryEnabled": true,
    "networkRanges": ["192.168.1.0/24", "192.168.2.0/24"]
  }
}
```

The client will automatically discover and monitor new printers on these networks.

## 📞 Support

- **Web UI Activity Log**: Monitoring → Monitoring Clients → Your Client → Activity tab
- **Local Logs**: `tail -f printyx-client.log`
- **API Key Issues**: Regenerate in Web UI (Monitoring → Monitoring Clients → Actions → Regenerate Key)

For detailed documentation, see [README.md](README.md).
