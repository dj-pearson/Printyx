import * as fs from 'fs';
import * as path from 'path';
import { DeviceMetrics } from '../collectors/collector-interface';
import { getLogger } from '../utils/logger';

/**
 * Persistent data buffer for offline operation
 * Ensures 99.9% uptime by buffering metrics when platform is unreachable
 */
export class DataBuffer {
  private logger = getLogger();
  private bufferPath: string;
  private maxBufferSize: number;
  private buffer: BufferedSubmission[] = [];

  constructor(bufferPath?: string, maxBufferSize: number = 1000) {
    this.bufferPath = bufferPath || path.join(process.cwd(), 'buffer.json');
    this.maxBufferSize = maxBufferSize;
    this.loadBuffer();
  }

  /**
   * Add metrics to buffer
   */
  add(clientId: string, clientVersion: string, devices: DeviceMetrics[]): void {
    const submission: BufferedSubmission = {
      id: this.generateId(),
      clientId,
      clientVersion,
      timestamp: new Date().toISOString(),
      devices,
      attempts: 0,
      firstAttempt: new Date().toISOString(),
    };

    this.buffer.push(submission);

    // Trim buffer if exceeds max size
    if (this.buffer.length > this.maxBufferSize) {
      const removed = this.buffer.length - this.maxBufferSize;
      this.logger.warn(`Buffer exceeded maximum size, removing ${removed} oldest entries`);
      this.buffer = this.buffer.slice(-this.maxBufferSize);
    }

    this.saveBuffer();
    this.logger.info(`Added submission to buffer`, {
      id: submission.id,
      devices: devices.length,
      bufferSize: this.buffer.length,
    });
  }

  /**
   * Get all pending submissions
   */
  getAll(): BufferedSubmission[] {
    return [...this.buffer];
  }

  /**
   * Get submissions ready for retry
   * Uses exponential backoff based on attempt count
   */
  getReadyForRetry(): BufferedSubmission[] {
    const now = Date.now();

    return this.buffer.filter((submission) => {
      if (submission.attempts === 0) {
        return true; // First attempt
      }

      // Exponential backoff: 30s, 1m, 2m, 4m, 8m, 16m, 30m (max)
      const backoffMs = Math.min(
        30000 * Math.pow(2, submission.attempts - 1),
        1800000, // 30 minutes max
      );

      const nextRetry = new Date(submission.lastAttempt!).getTime() + backoffMs;
      return now >= nextRetry;
    });
  }

  /**
   * Mark submission as attempted
   */
  markAttempted(id: string): void {
    const submission = this.buffer.find((s) => s.id === id);
    if (submission) {
      submission.attempts++;
      submission.lastAttempt = new Date().toISOString();
      this.saveBuffer();
    }
  }

  /**
   * Remove submission from buffer (after successful submission)
   */
  remove(id: string): void {
    const index = this.buffer.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.buffer.splice(index, 1);
      this.saveBuffer();
      this.logger.info(`Removed submission from buffer`, { id });
    }
  }

  /**
   * Remove submissions older than specified age
   */
  removeOlderThan(days: number): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffTime = cutoff.getTime();

    const originalSize = this.buffer.length;
    this.buffer = this.buffer.filter((s) => {
      const submissionTime = new Date(s.firstAttempt).getTime();
      return submissionTime > cutoffTime;
    });

    const removed = originalSize - this.buffer.length;
    if (removed > 0) {
      this.saveBuffer();
      this.logger.info(`Removed ${removed} submissions older than ${days} days`);
    }

    return removed;
  }

  /**
   * Get buffer statistics
   */
  getStats(): BufferStats {
    const now = Date.now();
    const oldestSubmission = this.buffer.reduce((oldest, s) => {
      const time = new Date(s.firstAttempt).getTime();
      return time < oldest ? time : oldest;
    }, now);

    return {
      totalSubmissions: this.buffer.length,
      oldestAge: now - oldestSubmission,
      totalDevices: this.buffer.reduce((sum, s) => sum + s.devices.length, 0),
      failedAttempts: this.buffer.reduce((sum, s) => sum + s.attempts, 0),
    };
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
    this.saveBuffer();
    this.logger.info('Buffer cleared');
  }

  /**
   * Load buffer from disk
   */
  private loadBuffer(): void {
    try {
      if (fs.existsSync(this.bufferPath)) {
        const data = fs.readFileSync(this.bufferPath, 'utf-8');
        this.buffer = JSON.parse(data);
        this.logger.info(`Loaded buffer from disk`, {
          submissions: this.buffer.length,
          path: this.bufferPath,
        });

        // Clean up old submissions on load
        this.removeOlderThan(7); // Remove submissions older than 7 days
      }
    } catch (error) {
      this.logger.error('Failed to load buffer from disk', { error });
      this.buffer = [];
    }
  }

  /**
   * Save buffer to disk
   */
  private saveBuffer(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.bufferPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.bufferPath, JSON.stringify(this.buffer, null, 2), 'utf-8');

      // Set file permissions to 600 (owner only)
      if (process.platform !== 'win32') {
        fs.chmodSync(this.bufferPath, 0o600);
      }
    } catch (error) {
      this.logger.error('Failed to save buffer to disk', { error });
    }
  }

  /**
   * Generate unique ID for submission
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

export interface BufferedSubmission {
  id: string;
  clientId: string;
  clientVersion: string;
  timestamp: string;
  devices: DeviceMetrics[];
  attempts: number;
  firstAttempt: string;
  lastAttempt?: string;
}

export interface BufferStats {
  totalSubmissions: number;
  oldestAge: number; // milliseconds
  totalDevices: number;
  failedAttempts: number;
}
