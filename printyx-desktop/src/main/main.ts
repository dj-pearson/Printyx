import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import Store from 'electron-store';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrinterDiscovery } from './services/printer-discovery';
import { MonitoringService } from './services/monitoring-service';
import { ApiClient } from './services/api-client';
import { WindowsService } from './services/windows-service';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Initialize electron-store
const store = new Store({
  schema: {
    apiKey: { type: 'string' },
    serverUrl: { type: 'string', default: 'https://app.printyx.net' },
    companyId: { type: 'string' },
    locationId: { type: 'string' },
    printers: { type: 'array', default: [] },
    monitoringEnabled: { type: 'boolean', default: false },
  },
});

let mainWindow: BrowserWindow | null = null;
let printerDiscovery: PrinterDiscovery | null = null;
let monitoringService: MonitoringService | null = null;
let apiClient: ApiClient | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Printyx Monitor',
    icon: path.join(__dirname, '../../build/icon.png'),
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3001');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();
  checkForUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Auto-updater
function checkForUpdates() {
  if (process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

autoUpdater.on('update-available', () => {
  log.info('Update available');
  mainWindow?.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  log.info('Update downloaded');
  mainWindow?.webContents.send('update-downloaded');
});

// IPC Handlers
function setupIpcHandlers() {
  // Settings
  ipcMain.handle('get-settings', () => {
    return {
      apiKey: store.get('apiKey'),
      serverUrl: store.get('serverUrl'),
      companyId: store.get('companyId'),
      locationId: store.get('locationId'),
      monitoringEnabled: store.get('monitoringEnabled'),
    };
  });

  ipcMain.handle('save-settings', async (_, settings) => {
    try {
      store.set('apiKey', settings.apiKey);
      store.set('serverUrl', settings.serverUrl);
      store.set('companyId', settings.companyId);
      store.set('locationId', settings.locationId);

      // Initialize API client with new settings
      apiClient = new ApiClient(settings.serverUrl, settings.apiKey);

      return { success: true };
    } catch (error) {
      log.error('Failed to save settings:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Printer Discovery
  ipcMain.handle('discover-printers', async (_, subnet?: string) => {
    try {
      if (!printerDiscovery) {
        printerDiscovery = new PrinterDiscovery();
      }

      const printers = await printerDiscovery.discoverPrinters(subnet);

      // Send progress updates
      printerDiscovery.on('device-found', (device) => {
        mainWindow?.webContents.send('printer-discovered', device);
      });

      return { success: true, printers };
    } catch (error) {
      log.error('Printer discovery failed:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get OID Presets from API
  ipcMain.handle('fetch-oid-presets', async () => {
    try {
      if (!apiClient) {
        const apiKey = store.get('apiKey') as string;
        const serverUrl = store.get('serverUrl') as string;

        if (!apiKey || !serverUrl) {
          throw new Error('API key and server URL must be configured');
        }

        apiClient = new ApiClient(serverUrl, apiKey);
      }

      const presets = await apiClient.getOidPresets();
      return { success: true, presets };
    } catch (error) {
      log.error('Failed to fetch OID presets:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Printer Management
  ipcMain.handle('get-printers', () => {
    return store.get('printers', []);
  });

  ipcMain.handle('save-printers', async (_, printers) => {
    try {
      store.set('printers', printers);

      // Restart monitoring service if enabled
      if (store.get('monitoringEnabled')) {
        await restartMonitoring();
      }

      return { success: true };
    } catch (error) {
      log.error('Failed to save printers:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Monitoring Control
  ipcMain.handle('start-monitoring', async () => {
    try {
      const apiKey = store.get('apiKey') as string;
      const serverUrl = store.get('serverUrl') as string;
      const companyId = store.get('companyId') as string;
      const locationId = store.get('locationId') as string;
      const printers = store.get('printers', []) as any[];

      if (!apiKey || !serverUrl) {
        throw new Error('API key and server URL must be configured');
      }

      if (printers.length === 0) {
        throw new Error('No printers configured for monitoring');
      }

      if (!monitoringService) {
        monitoringService = new MonitoringService({
          apiKey,
          serverUrl,
          companyId,
          locationId,
          printers,
        });
      }

      await monitoringService.start();
      store.set('monitoringEnabled', true);

      // Send monitoring updates to renderer
      monitoringService.on('data-collected', (data) => {
        mainWindow?.webContents.send('monitoring-data', data);
      });

      monitoringService.on('error', (error) => {
        mainWindow?.webContents.send('monitoring-error', error);
      });

      return { success: true };
    } catch (error) {
      log.error('Failed to start monitoring:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('stop-monitoring', async () => {
    try {
      if (monitoringService) {
        await monitoringService.stop();
      }
      store.set('monitoringEnabled', false);
      return { success: true };
    } catch (error) {
      log.error('Failed to stop monitoring:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('get-monitoring-status', () => {
    return {
      enabled: store.get('monitoringEnabled', false),
      running: monitoringService?.isRunning() || false,
    };
  });

  // Windows Service Management
  ipcMain.handle('install-service', async () => {
    try {
      if (process.platform !== 'win32') {
        throw new Error('Service installation is only supported on Windows');
      }

      const windowsService = new WindowsService();
      await windowsService.install();

      return { success: true };
    } catch (error) {
      log.error('Failed to install service:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('uninstall-service', async () => {
    try {
      if (process.platform !== 'win32') {
        throw new Error('Service uninstallation is only supported on Windows');
      }

      const windowsService = new WindowsService();
      await windowsService.uninstall();

      return { success: false };
    } catch (error) {
      log.error('Failed to uninstall service:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('get-service-status', async () => {
    try {
      if (process.platform !== 'win32') {
        return { installed: false, running: false };
      }

      const windowsService = new WindowsService();
      const status = await windowsService.getStatus();

      return status;
    } catch (error) {
      log.error('Failed to get service status:', error);
      return { installed: false, running: false };
    }
  });

  // Auto-updater
  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
  });

  // Dialog
  ipcMain.handle('show-error-dialog', async (_, title: string, message: string) => {
    await dialog.showErrorBox(title, message);
  });
}

async function restartMonitoring() {
  if (monitoringService) {
    await monitoringService.stop();
    await monitoringService.start();
  }
}
