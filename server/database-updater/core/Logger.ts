/**
 * Logger
 * Comprehensive logging system for the database updater
 */

import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
  source?: string;
}

export interface LoggerOptions {
  level?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  logDirectory?: string;
  maxFileSize?: number;
  maxFiles?: number;
  dateFormat?: string;
}

export class Logger {
  private options: Required<LoggerOptions>;
  private logLevels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(options: LoggerOptions = {}) {
    this.options = {
      level: options.level || 'info',
      enableConsole: options.enableConsole !== false,
      enableFile: options.enableFile !== false,
      logDirectory: options.logDirectory || 'logs',
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: options.maxFiles || 5,
      dateFormat: options.dateFormat || 'YYYY-MM-DD',
    };

    this.ensureLogDirectory();
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: any): void {
    let errorData;
    
    if (error instanceof Error) {
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      errorData = error;
    }

    this.log('error', message, errorData);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (this.logLevels[level] < this.logLevels[this.options.level]) {
      return; // Skip if below configured log level
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      source: 'database-updater',
    };

    if (this.options.enableConsole) {
      this.logToConsole(logEntry);
    }

    if (this.options.enableFile) {
      this.logToFile(logEntry);
    }
  }

  /**
   * Log to console with colors
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    
    // Color codes
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      reset: '\x1b[0m',  // Reset
    };

    const color = colors[entry.level] || colors.reset;
    const message = `${colors.reset}[${timestamp}] ${color}${level}${colors.reset} ${entry.message}`;
    
    console.log(message);
    
    if (entry.data) {
      console.log('  Data:', entry.data);
    }
  }

  /**
   * Log to file
   */
  private logToFile(entry: LogEntry): void {
    try {
      const filename = this.getLogFilename();
      const filepath = path.join(this.options.logDirectory, filename);
      
      // Check file size and rotate if necessary
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        if (stats.size > this.options.maxFileSize) {
          this.rotateLogFile(filepath);
        }
      }

      const logLine = this.formatLogEntry(entry);
      fs.appendFileSync(filepath, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Format log entry for file output
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    let logLine = `[${timestamp}] ${level} ${entry.message}`;
    
    if (entry.data) {
      try {
        logLine += ` | Data: ${JSON.stringify(entry.data)}`;
      } catch (error) {
        logLine += ` | Data: [Circular or non-serializable object]`;
      }
    }
    
    return logLine;
  }

  /**
   * Get current log filename
   */
  private getLogFilename(): string {
    const date = new Date();
    const dateString = this.formatDate(date);
    return `database-updater-${dateString}.log`;
  }

  /**
   * Format date for filename
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Rotate log file when it exceeds max size
   */
  private rotateLogFile(filepath: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = filepath.replace('.log', `-${timestamp}.log`);
    
    try {
      fs.renameSync(filepath, rotatedPath);
      this.cleanupOldLogFiles();
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Clean up old log files
   */
  private cleanupOldLogFiles(): void {
    try {
      const files = fs.readdirSync(this.options.logDirectory)
        .filter(file => file.startsWith('database-updater-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.options.logDirectory, file),
          stats: fs.statSync(path.join(this.options.logDirectory, file)),
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      // Remove files beyond max count
      if (files.length > this.options.maxFiles) {
        const filesToDelete = files.slice(this.options.maxFiles);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          console.log(`Cleaned up old log file: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.options.logDirectory)) {
        fs.mkdirSync(this.options.logDirectory, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
      // Disable file logging if directory cannot be created
      this.options.enableFile = false;
    }
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count = 100): LogEntry[] {
    try {
      const filename = this.getLogFilename();
      const filepath = path.join(this.options.logDirectory, filename);
      
      if (!fs.existsSync(filepath)) {
        return [];
      }

      const content = fs.readFileSync(filepath, 'utf8');
      const lines = content.trim().split('\n');
      
      // Get last 'count' lines
      const recentLines = lines.slice(-count);
      
      return recentLines.map(line => this.parseLogLine(line)).filter(Boolean) as LogEntry[];
    } catch (error) {
      console.error('Failed to read recent logs:', error);
      return [];
    }
  }

  /**
   * Parse log line back to LogEntry
   */
  private parseLogLine(line: string): LogEntry | null {
    try {
      // Parse format: [timestamp] LEVEL message | Data: {...}
      const regex = /^\[([^\]]+)\]\s+(\w+)\s+(.+?)(?:\s+\|\s+Data:\s+(.+))?$/;
      const match = line.match(regex);
      
      if (!match) return null;
      
      const [, timestamp, level, message, dataStr] = match;
      
      let data;
      if (dataStr) {
        try {
          data = JSON.parse(dataStr);
        } catch {
          data = dataStr;
        }
      }
      
      return {
        timestamp: new Date(timestamp),
        level: level.toLowerCase() as LogLevel,
        message,
        data,
        source: 'database-updater',
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.options.level = level;
    this.info(`Log level changed to: ${level}`);
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.options };
  }

  /**
   * Create child logger with prefix
   */
  child(prefix: string) {
    const childLogger = new Logger(this.options);
    
    // Override log method to add prefix
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel, message: string, data?: any) => {
      originalLog(level, `[${prefix}] ${message}`, data);
    };
    
    return childLogger;
  }
}

export default Logger;
