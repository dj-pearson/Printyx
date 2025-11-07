#!/bin/bash

# Printyx Client Uninstallation Script for Linux

set -e

echo "========================================="
echo "Printyx Monitoring Client - Uninstall"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (use sudo)"
  exit 1
fi

# Stop and disable service
if systemctl is-active --quiet printyx-client; then
  echo "Stopping Printyx client service..."
  systemctl stop printyx-client
  echo "✓ Service stopped"
fi

if systemctl is-enabled --quiet printyx-client; then
  echo "Disabling Printyx client service..."
  systemctl disable printyx-client
  echo "✓ Service disabled"
fi

# Remove systemd service file
if [ -f /etc/systemd/system/printyx-client.service ]; then
  echo "Removing systemd service file..."
  rm /etc/systemd/system/printyx-client.service
  systemctl daemon-reload
  echo "✓ Service file removed"
fi

# Uninstall npm package
if command -v printyx-client &> /dev/null; then
  echo "Uninstalling global npm package..."
  npm uninstall -g printyx-client
  echo "✓ Package uninstalled"
fi

# Ask about configuration files
echo ""
read -p "Do you want to remove configuration files? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  if [ -d /etc/printyx-client ]; then
    echo "Removing configuration directory..."
    rm -rf /etc/printyx-client
    echo "✓ Configuration removed"
  fi
fi

echo ""
echo "Uninstallation complete!"
