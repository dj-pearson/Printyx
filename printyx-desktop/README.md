# Printyx Desktop - Printer Monitoring Application

A beautiful, customer-facing desktop application for monitoring network-connected printers and copiers. Built with Electron, React, and TypeScript.

## Features

- **Automatic Printer Discovery**: Scan your network to find SNMP-enabled printers automatically
- **OID Preset Management**: Pull manufacturer-specific OID configurations from the Printyx platform
- **Beautiful Modern UI**: Clean, intuitive interface built with React and Tailwind CSS
- **Real-time Monitoring**: Collect and upload printer metrics on a scheduled basis
- **Windows Service**: Install as a Windows service for automatic startup
- **Auto-updates**: Built-in update mechanism using electron-updater
- **Secure**: API key authentication with the main Printyx platform

## Architecture

### Main Process (`src/main/`)
- **main.ts**: Electron app entry point and IPC handlers
- **services/**:
  - `printer-discovery.ts`: SNMP-based network printer discovery
  - `monitoring-service.ts`: Periodic data collection and upload
  - `api-client.ts`: Communication with Printyx API
  - `windows-service.ts`: Windows service installation/management

### Renderer Process (`src/renderer/`)
- **React UI** with TypeScript
- **Pages**:
  - `SettingsPage`: Configure API key and server settings
  - `DiscoveryPage`: Discover printers on the network
  - `PrintersPage`: Manage configured printers
  - `MonitoringPage`: Control monitoring service and view status

### Preload Script (`src/preload/`)
- **preload.ts**: Secure IPC bridge between main and renderer processes

## Prerequisites

- Node.js 18+ and npm
- Windows (for Windows service features)
- Network access to SNMP-enabled printers

## Development

### Install Dependencies

```bash
cd printyx-desktop
npm install
```

### Run in Development Mode

```bash
npm run dev
```

This starts:
- Vite dev server for the renderer process (port 3001)
- Main process with hot reload

### Build for Production

```bash
npm run build
```

This compiles:
- Main process → `dist/main/`
- Renderer process → `dist/renderer/`

### Package the Application

**Windows Installer:**
```bash
npm run package:win
```

**macOS DMG:**
```bash
npm run package:mac
```

**Linux AppImage:**
```bash
npm run package:linux
```

**All Platforms:**
```bash
npm run package
```

Built packages will be in the `release/` directory.

## Configuration

### API Key Setup

1. Log in to your Printyx account at https://app.printyx.net
2. Navigate to **Settings → API Keys**
3. Create a new API key with "Monitoring" permissions
4. Copy the API key
5. Open Printyx Desktop and go to Settings
6. Paste the API key and save

### Printer Discovery

1. Click **Discover Printers** in the sidebar
2. Optionally specify a subnet (e.g., `192.168.1.0/24`)
3. Click **Start Discovery**
4. Select the printers you want to monitor
5. Click **Add Selected**

The app will automatically fetch manufacturer-specific OID presets from the Printyx platform.

### Monitoring

1. Go to the **Monitoring** page
2. Click **Start Monitoring** to begin data collection
3. Data will be collected every 15 minutes (configurable)
4. Optionally install as a Windows service for automatic startup

## Windows Service

The app can run as a Windows service that starts automatically on system boot:

1. Go to the **Monitoring** page
2. Click **Install Service**
3. Grant administrator permissions when prompted
4. The service will start automatically

To uninstall:
1. Go to the **Monitoring** page
2. Click **Uninstall Service**
3. Grant administrator permissions when prompted

## API Integration

The desktop app communicates with the main Printyx platform via HTTPS:

### Required API Endpoints

The main platform should expose these endpoints:

- `GET /api/printer-monitoring/oid-presets`: Get OID configurations by manufacturer
- `POST /api/printer-monitoring/devices`: Register a new device
- `POST /api/printer-monitoring/metrics`: Upload monitoring data
- `GET /api/health`: Health check endpoint

### Authentication

All API requests include an `X-API-Key` header with the user's API key.

## Project Structure

```
printyx-desktop/
├── src/
│   ├── main/              # Main process (Node.js)
│   │   ├── main.ts       # Entry point
│   │   └── services/     # Business logic
│   ├── renderer/         # Renderer process (React)
│   │   ├── pages/       # Page components
│   │   ├── App.tsx      # Root component
│   │   └── main.tsx     # React entry
│   └── preload/         # Preload scripts
│       └── preload.ts   # IPC bridge
├── dist/                # Compiled output
├── release/            # Packaged apps
├── build/              # Build assets (icons)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

## Building from Source

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the app: `npm run build`
4. Package for your platform: `npm run package:win` (or `:mac`, `:linux`)
5. Find the installer in `release/`

## Troubleshooting

### SNMP Discovery Issues

- Ensure printers have SNMP enabled
- Check that community string is correct (default: "public")
- Verify network connectivity
- Some printers may require SNMPv3 authentication

### Service Installation Fails

- Run the app as Administrator
- Check Windows Event Viewer for errors
- Ensure no conflicting services are running

### API Connection Fails

- Verify API key is correct
- Check server URL (default: https://app.printyx.net)
- Ensure network connectivity
- Check firewall settings

## Technologies Used

- **Electron 33**: Desktop app framework
- **React 18**: UI library
- **TypeScript 5**: Type-safe development
- **Vite 5**: Fast build tool
- **Tailwind CSS 3**: Utility-first styling
- **net-snmp**: SNMP protocol implementation
- **electron-store**: Persistent configuration storage
- **electron-updater**: Auto-update functionality
- **node-windows**: Windows service management

## Security

- API keys are stored encrypted using electron-store
- SNMP credentials are never exposed to the renderer process
- All API communication uses HTTPS
- Context isolation and node integration disabled in renderer

## License

MIT

## Support

For issues and questions:
- GitHub Issues: https://github.com/printyx/printyx-desktop/issues
- Email: support@printyx.net
- Documentation: https://docs.printyx.net
