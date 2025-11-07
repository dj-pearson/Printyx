export interface TonerLevels {
  black?: number;
  cyan?: number;
  magenta?: number;
  yellow?: number;
  [key: string]: number | undefined; // For additional colors
}

export interface PaperLevels {
  [tray: string]: number; // tray1: 80, tray2: 45, etc.
}

export interface MeterReadings {
  totalImpressions?: number;
  bwImpressions?: number;
  colorImpressions?: number;
  largeImpressions?: number;
}

export interface DeviceMetrics {
  serialNumber: string;
  ipAddress: string;
  macAddress?: string;
  manufacturer?: string;
  model?: string;
  tonerLevels?: TonerLevels;
  paperLevels?: PaperLevels;
  meters?: MeterReadings;
  deviceStatus: 'online' | 'offline' | 'error' | 'maintenance' | 'unknown';
  errorCodes?: string[];
  collectionTimestamp: string;
  rawData?: any;
}

export interface ICollector {
  /**
   * Collect metrics from a device
   */
  collect(ipAddress: string, options?: any): Promise<DeviceMetrics>;

  /**
   * Test connection to a device
   */
  testConnection(ipAddress: string, options?: any): Promise<boolean>;
}
