#!/bin/bash

# Printyx Client Installation Script for Linux
# This script installs the Printyx monitoring client as a systemd service

set -e

echo "========================================="
echo "Printyx Monitoring Client - Linux Setup"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (use sudo)"
  exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed"
  echo "Please install Node.js 18 or higher first"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "Error: Node.js version 18 or higher is required"
  echo "Current version: $(node -v)"
  exit 1
fi

echo "✓ Node.js $(node -v) detected"
echo ""

# Install the client globally
echo "Installing Printyx client globally..."
npm install -g .

if [ $? -ne 0 ]; then
  echo "Error: Failed to install client"
  exit 1
fi

echo "✓ Client installed successfully"
echo ""

# Create configuration directory
CONFIG_DIR="/etc/printyx-client"
echo "Creating configuration directory: $CONFIG_DIR"
mkdir -p $CONFIG_DIR

# Generate sample configuration
echo "Generating sample configuration..."
printyx-client init -o $CONFIG_DIR/config.json

echo "✓ Configuration file created: $CONFIG_DIR/config.json"
echo ""

# Create systemd service file
SERVICE_FILE="/etc/systemd/system/printyx-client.service"
echo "Creating systemd service..."

cat > $SERVICE_FILE <<EOF
[Unit]
Description=Printyx Monitoring Client
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$CONFIG_DIR
ExecStart=$(which printyx-client) start -c $CONFIG_DIR/config.json
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "✓ Systemd service created: $SERVICE_FILE"
echo ""

# Reload systemd
echo "Reloading systemd..."
systemctl daemon-reload

echo "✓ Systemd reloaded"
echo ""

echo "========================================="
echo "Installation Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Edit the configuration file:"
echo "   sudo nano $CONFIG_DIR/config.json"
echo ""
echo "2. Add your Printyx credentials:"
echo "   - api.endpoint: Your Printyx instance URL"
echo "   - api.apiKey: Your client API key"
echo "   - api.tenantId: Your tenant ID"
echo "   - collection.networkRanges: Your network ranges"
echo ""
echo "3. Test a device (optional):"
echo "   printyx-client test 192.168.1.100"
echo ""
echo "4. Start the service:"
echo "   sudo systemctl start printyx-client"
echo ""
echo "5. Enable auto-start on boot:"
echo "   sudo systemctl enable printyx-client"
echo ""
echo "6. Check service status:"
echo "   sudo systemctl status printyx-client"
echo ""
echo "7. View logs:"
echo "   sudo journalctl -u printyx-client -f"
echo ""
