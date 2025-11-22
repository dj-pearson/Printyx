import * as fs from 'fs';
import * as path from 'path';
import { DeviceMetrics, MeterReadings } from '../collectors/collector-interface';
import { getLogger } from '../utils/logger';

/**
 * Meter tracking system for 100% accuracy in billing
 * Handles counter rollovers, differential calculations, and duplicate detection
 */
export class MeterTracker {
  private logger = getLogger();
  private storePath: string;
  private lastReadings: Map<string, MeterRecord> = new Map();

  constructor(storePath?: string) {
    this.storePath = storePath || path.join(process.cwd(), 'meters.json');
    this.loadState();
  }

  /**
   * Process device metrics and calculate differentials
   * Returns processed metrics with accurate usage since last reading
   */
  processMetrics(metrics: DeviceMetrics): ProcessedMetrics {
    const key = this.getDeviceKey(metrics);
    const lastRecord = this.lastReadings.get(key);
    const currentTimestamp = new Date(metrics.collectionTimestamp);

    // First reading for this device
    if (!lastRecord) {
      this.logger.info(`First meter reading for device ${key}`);
      const record: MeterRecord = {
        serialNumber: metrics.serialNumber,
        ipAddress: metrics.ipAddress,
        lastMeters: metrics.meters || {},
        lastTimestamp: currentTimestamp.toISOString(),
        totalReadings: 1,
        lastTonerLevels: metrics.tonerLevels,
      };

      this.lastReadings.set(key, record);
      this.saveState();

      return {
        ...metrics,
        differential: {
          totalImpressions: 0,
          bwImpressions: 0,
          colorImpressions: 0,
          largeImpressions: 0,
          hasRollover: false,
        },
        isFirstReading: true,
        isDuplicate: false,
        hasRollover: false,
        tonerAlerts: this.checkTonerLevels(metrics.tonerLevels),
      };
    }

    // Check for duplicate reading (same meters as last time)
    const isDuplicate = this.isDuplicateReading(metrics.meters, lastRecord.lastMeters);
    if (isDuplicate) {
      this.logger.warn(`Duplicate meter reading detected for device ${key}`);
      return {
        ...metrics,
        differential: {
          totalImpressions: 0,
          bwImpressions: 0,
          colorImpressions: 0,
          largeImpressions: 0,
          hasRollover: false,
        },
        isFirstReading: false,
        isDuplicate: true,
        hasRollover: false,
        tonerAlerts: this.checkTonerLevels(metrics.tonerLevels),
      };
    }

    // Calculate differential
    const differential = this.calculateDifferential(metrics.meters || {}, lastRecord.lastMeters);

    // Update stored record
    lastRecord.lastMeters = metrics.meters || {};
    lastRecord.lastTimestamp = currentTimestamp.toISOString();
    lastRecord.totalReadings++;
    lastRecord.lastTonerLevels = metrics.tonerLevels;
    this.lastReadings.set(key, lastRecord);
    this.saveState();

    return {
      ...metrics,
      differential,
      isFirstReading: false,
      isDuplicate: false,
      hasRollover: differential.hasRollover,
      tonerAlerts: this.checkTonerLevels(metrics.tonerLevels, lastRecord.lastTonerLevels),
    };
  }

  /**
   * Calculate meter differential with rollover detection
   */
  private calculateDifferential(
    current: MeterReadings,
    previous: MeterReadings,
  ): MeterDifferential {
    const result: MeterDifferential = {
      totalImpressions: 0,
      bwImpressions: 0,
      colorImpressions: 0,
      largeImpressions: 0,
      hasRollover: false,
    };

    // Maximum meter value before rollover (typically 8-digit counter = 99,999,999)
    const MAX_COUNTER = 99999999;

    // Calculate each meter differential
    if (current.totalImpressions !== undefined && previous.totalImpressions !== undefined) {
      result.totalImpressions = this.calculateSingleMeter(
        current.totalImpressions,
        previous.totalImpressions,
        MAX_COUNTER,
      );

      if (current.totalImpressions < previous.totalImpressions) {
        result.hasRollover = true;
        this.logger.warn('Counter rollover detected for total impressions', {
          current: current.totalImpressions,
          previous: previous.totalImpressions,
          differential: result.totalImpressions,
        });
      }
    }

    if (current.bwImpressions !== undefined && previous.bwImpressions !== undefined) {
      result.bwImpressions = this.calculateSingleMeter(
        current.bwImpressions,
        previous.bwImpressions,
        MAX_COUNTER,
      );

      if (current.bwImpressions < previous.bwImpressions) {
        result.hasRollover = true;
      }
    }

    if (current.colorImpressions !== undefined && previous.colorImpressions !== undefined) {
      result.colorImpressions = this.calculateSingleMeter(
        current.colorImpressions,
        previous.colorImpressions,
        MAX_COUNTER,
      );

      if (current.colorImpressions < previous.colorImpressions) {
        result.hasRollover = true;
      }
    }

    if (current.largeImpressions !== undefined && previous.largeImpressions !== undefined) {
      result.largeImpressions = this.calculateSingleMeter(
        current.largeImpressions,
        previous.largeImpressions,
        MAX_COUNTER,
      );

      if (current.largeImpressions < previous.largeImpressions) {
        result.hasRollover = true;
      }
    }

    return result;
  }

  /**
   * Calculate single meter differential with rollover handling
   */
  private calculateSingleMeter(current: number, previous: number, maxCounter: number): number {
    if (current >= previous) {
      // Normal case: counter incremented
      return current - previous;
    } else {
      // Rollover case: counter reset to 0
      // Calculate: (MAX - previous) + current + 1
      return maxCounter - previous + current + 1;
    }
  }

  /**
   * Check if reading is duplicate
   */
  private isDuplicateReading(current?: MeterReadings, previous?: MeterReadings): boolean {
    if (!current || !previous) return false;

    return (
      current.totalImpressions === previous.totalImpressions &&
      current.bwImpressions === previous.bwImpressions &&
      current.colorImpressions === previous.colorImpressions &&
      current.largeImpressions === previous.largeImpressions
    );
  }

  /**
   * Check toner levels and generate alerts
   */
  private checkTonerLevels(
    current?: { [key: string]: number | undefined },
    previous?: { [key: string]: number | undefined },
  ): TonerAlert[] {
    const alerts: TonerAlert[] = [];

    if (!current) return alerts;

    // Default thresholds
    const WARNING_THRESHOLD = 20; // Warn at 20%
    const CRITICAL_THRESHOLD = 10; // Critical at 10%

    for (const [color, level] of Object.entries(current)) {
      // Skip undefined levels
      if (level === undefined || level === null) continue;

      // Critical alert
      if (level <= CRITICAL_THRESHOLD) {
        alerts.push({
          color,
          level,
          severity: 'critical',
          message: `${color} toner critically low (${level}%)`,
          shouldOrder: true,
        });
      }
      // Warning alert
      else if (level <= WARNING_THRESHOLD) {
        alerts.push({
          color,
          level,
          severity: 'warning',
          message: `${color} toner low (${level}%)`,
          shouldOrder: level <= 15, // Order if below 15%
        });
      }
      // Trend alert (dropping quickly)
      else if (previous && previous[color] !== undefined && previous[color] !== null) {
        const prevLevel = previous[color]!;
        const drop = prevLevel - level;
        if (drop > 10) {
          // Dropped more than 10% since last reading
          alerts.push({
            color,
            level,
            severity: 'info',
            message: `${color} toner usage high (dropped ${drop}% since last reading)`,
            shouldOrder: false,
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Get device key for tracking
   */
  private getDeviceKey(metrics: DeviceMetrics): string {
    return `${metrics.serialNumber}:${metrics.ipAddress}`;
  }

  /**
   * Get historical data for a device
   */
  getDeviceHistory(serialNumber: string, ipAddress: string): MeterRecord | undefined {
    const key = `${serialNumber}:${ipAddress}`;
    return this.lastReadings.get(key);
  }

  /**
   * Get all tracked devices
   */
  getAllDevices(): MeterRecord[] {
    return Array.from(this.lastReadings.values());
  }

  /**
   * Load state from disk
   */
  private loadState(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8');
        const records = JSON.parse(data);

        this.lastReadings = new Map(Object.entries(records));
        this.logger.info(`Loaded meter state from disk`, {
          devices: this.lastReadings.size,
          path: this.storePath,
        });
      }
    } catch (error) {
      this.logger.error('Failed to load meter state from disk', { error });
      this.lastReadings = new Map();
    }
  }

  /**
   * Save state to disk
   */
  private saveState(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convert Map to object for JSON serialization
      const records: any = {};
      for (const [key, value] of this.lastReadings.entries()) {
        records[key] = value;
      }

      fs.writeFileSync(this.storePath, JSON.stringify(records, null, 2), 'utf-8');

      // Set file permissions to 600 (owner only)
      if (process.platform !== 'win32') {
        fs.chmodSync(this.storePath, 0o600);
      }
    } catch (error) {
      this.logger.error('Failed to save meter state to disk', { error });
    }
  }
}

export interface MeterRecord {
  serialNumber: string;
  ipAddress: string;
  lastMeters: MeterReadings;
  lastTimestamp: string;
  totalReadings: number;
  lastTonerLevels?: { [key: string]: number | undefined };
}

export interface MeterDifferential {
  totalImpressions: number;
  bwImpressions: number;
  colorImpressions: number;
  largeImpressions: number;
  hasRollover: boolean;
}

export interface TonerAlert {
  color: string;
  level: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  shouldOrder: boolean;
}

export interface ProcessedMetrics extends DeviceMetrics {
  differential: MeterDifferential;
  isFirstReading: boolean;
  isDuplicate: boolean;
  hasRollover: boolean;
  tonerAlerts: TonerAlert[];
}
