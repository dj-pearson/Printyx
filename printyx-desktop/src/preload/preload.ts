import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),

  // Printer Discovery
  discoverPrinters: (subnet?: string) => ipcRenderer.invoke('discover-printers', subnet),
  onPrinterDiscovered: (callback: (device: any) => void) => {
    ipcRenderer.on('printer-discovered', (_, device) => callback(device));
  },

  // OID Presets
  fetchOidPresets: () => ipcRenderer.invoke('fetch-oid-presets'),

  // Printer Management
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  savePrinters: (printers: any[]) => ipcRenderer.invoke('save-printers', printers),

  // Monitoring
  startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  getMonitoringStatus: () => ipcRenderer.invoke('get-monitoring-status'),
  onMonitoringData: (callback: (data: any) => void) => {
    ipcRenderer.on('monitoring-data', (_, data) => callback(data));
  },
  onMonitoringError: (callback: (error: any) => void) => {
    ipcRenderer.on('monitoring-error', (_, error) => callback(error));
  },

  // Windows Service
  installService: () => ipcRenderer.invoke('install-service'),
  uninstallService: () => ipcRenderer.invoke('uninstall-service'),
  getServiceStatus: () => ipcRenderer.invoke('get-service-status'),

  // Auto-updater
  onUpdateAvailable: (callback: () => void) => {
    ipcRenderer.on('update-available', callback);
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', callback);
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Dialogs
  showErrorDialog: (title: string, message: string) =>
    ipcRenderer.invoke('show-error-dialog', title, message),
});

// TypeScript types for window.electronAPI
export interface ElectronAPI {
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  discoverPrinters: (
    subnet?: string,
  ) => Promise<{ success: boolean; printers?: any[]; error?: string }>;
  onPrinterDiscovered: (callback: (device: any) => void) => void;
  fetchOidPresets: () => Promise<{ success: boolean; presets?: any[]; error?: string }>;
  getPrinters: () => Promise<any[]>;
  savePrinters: (printers: any[]) => Promise<{ success: boolean; error?: string }>;
  startMonitoring: () => Promise<{ success: boolean; error?: string }>;
  stopMonitoring: () => Promise<{ success: boolean; error?: string }>;
  getMonitoringStatus: () => Promise<{ enabled: boolean; running: boolean }>;
  onMonitoringData: (callback: (data: any) => void) => void;
  onMonitoringError: (callback: (error: any) => void) => void;
  installService: () => Promise<{ success: boolean; error?: string }>;
  uninstallService: () => Promise<{ success: boolean; error?: string }>;
  getServiceStatus: () => Promise<{ installed: boolean; running: boolean }>;
  onUpdateAvailable: (callback: () => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;
  installUpdate: () => Promise<void>;
  showErrorDialog: (title: string, message: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
