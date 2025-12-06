/**
 * Log Transport System for External Aggregation
 *
 * Supports multiple log aggregation providers:
 * - AWS CloudWatch Logs
 * - Elasticsearch / OpenSearch (ELK Stack)
 * - Splunk HTTP Event Collector (HEC)
 * - Generic HTTP/HTTPS endpoints
 * - File rotation (for local development)
 *
 * The transport is selected via LOG_TRANSPORT environment variable.
 */

import { Transform, type TransformCallback } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { createModuleLogger } from './logger';

const log = createModuleLogger('log-transport');

// Transport provider types
export type LogTransportProvider =
  | 'cloudwatch'
  | 'elasticsearch'
  | 'splunk'
  | 'http'
  | 'file'
  | 'console'
  | 'none';

// Common log transport configuration
export interface LogTransportConfig {
  provider: LogTransportProvider;
  batchSize?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

// CloudWatch specific config
export interface CloudWatchConfig extends LogTransportConfig {
  provider: 'cloudwatch';
  region: string;
  logGroupName: string;
  logStreamName: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

// Elasticsearch specific config
export interface ElasticsearchConfig extends LogTransportConfig {
  provider: 'elasticsearch';
  node: string;
  index: string;
  username?: string;
  password?: string;
  apiKey?: string;
  tls?: {
    rejectUnauthorized?: boolean;
    ca?: string;
  };
}

// Splunk specific config
export interface SplunkConfig extends LogTransportConfig {
  provider: 'splunk';
  host: string;
  token: string;
  index?: string;
  source?: string;
  sourcetype?: string;
  port?: number;
  ssl?: boolean;
}

// HTTP transport config
export interface HTTPTransportConfig extends LogTransportConfig {
  provider: 'http';
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  auth?: {
    username: string;
    password: string;
  };
}

// File transport config
export interface FileTransportConfig extends LogTransportConfig {
  provider: 'file';
  directory: string;
  filename: string;
  maxSize?: number; // bytes
  maxFiles?: number;
  compress?: boolean;
}

// Union type for all configs
export type TransportConfig =
  | CloudWatchConfig
  | ElasticsearchConfig
  | SplunkConfig
  | HTTPTransportConfig
  | FileTransportConfig
  | LogTransportConfig;

// Log entry structure
export interface LogEntry {
  timestamp: string;
  level: string;
  msg: string;
  [key: string]: unknown;
}

// Build configuration from environment
function buildConfig(): TransportConfig {
  const provider = (process.env.LOG_TRANSPORT as LogTransportProvider) || 'console';

  const baseConfig: LogTransportConfig = {
    provider,
    batchSize: parseInt(process.env.LOG_BATCH_SIZE || '100', 10),
    flushIntervalMs: parseInt(process.env.LOG_FLUSH_INTERVAL_MS || '5000', 10),
    maxRetries: parseInt(process.env.LOG_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.LOG_RETRY_DELAY_MS || '1000', 10),
  };

  switch (provider) {
    case 'cloudwatch':
      return {
        ...baseConfig,
        provider: 'cloudwatch',
        region: process.env.AWS_REGION || 'us-east-1',
        logGroupName: process.env.CLOUDWATCH_LOG_GROUP || '/printyx/application',
        logStreamName:
          process.env.CLOUDWATCH_LOG_STREAM ||
          `${process.env.NODE_ENV || 'development'}-${new Date().toISOString().split('T')[0]}`,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };

    case 'elasticsearch':
      return {
        ...baseConfig,
        provider: 'elasticsearch',
        node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
        index: process.env.ELASTICSEARCH_INDEX || 'printyx-logs',
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD,
        apiKey: process.env.ELASTICSEARCH_API_KEY,
        tls: {
          rejectUnauthorized: process.env.ELASTICSEARCH_TLS_REJECT_UNAUTHORIZED !== 'false',
          ca: process.env.ELASTICSEARCH_TLS_CA,
        },
      };

    case 'splunk':
      return {
        ...baseConfig,
        provider: 'splunk',
        host: process.env.SPLUNK_HOST || 'localhost',
        token: process.env.SPLUNK_HEC_TOKEN || '',
        index: process.env.SPLUNK_INDEX || 'main',
        source: process.env.SPLUNK_SOURCE || 'printyx',
        sourcetype: process.env.SPLUNK_SOURCETYPE || '_json',
        port: parseInt(process.env.SPLUNK_PORT || '8088', 10),
        ssl: process.env.SPLUNK_SSL !== 'false',
      };

    case 'http':
      return {
        ...baseConfig,
        provider: 'http',
        url: process.env.LOG_HTTP_URL || 'http://localhost:8080/logs',
        method: (process.env.LOG_HTTP_METHOD as 'POST' | 'PUT') || 'POST',
        headers: process.env.LOG_HTTP_HEADERS
          ? JSON.parse(process.env.LOG_HTTP_HEADERS)
          : undefined,
      };

    case 'file':
      return {
        ...baseConfig,
        provider: 'file',
        directory: process.env.LOG_FILE_DIRECTORY || 'logs',
        filename: process.env.LOG_FILE_NAME || 'app.log',
        maxSize: parseInt(process.env.LOG_FILE_MAX_SIZE || '10485760', 10), // 10MB
        maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5', 10),
        compress: process.env.LOG_FILE_COMPRESS === 'true',
      };

    default:
      return baseConfig;
  }
}

/**
 * Abstract base class for log transports
 */
abstract class LogTransport {
  protected config: TransportConfig;
  protected buffer: LogEntry[] = [];
  protected flushTimer: NodeJS.Timeout | null = null;
  protected isShuttingDown = false;

  constructor(config: TransportConfig) {
    this.config = config;
    this.startFlushTimer();
  }

  protected startFlushTimer(): void {
    if (this.config.flushIntervalMs && this.config.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch((err) => {
          log.error(err as Error, 'Error flushing logs');
        });
      }, this.config.flushIntervalMs);
    }
  }

  public async write(entry: LogEntry): Promise<void> {
    this.buffer.push(entry);

    if (this.buffer.length >= (this.config.batchSize || 100)) {
      await this.flush();
    }
  }

  public async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await this.send(entries);
    } catch (error) {
      // Put entries back in buffer for retry
      this.buffer = [...entries, ...this.buffer];
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    await this.flush();
  }

  protected abstract send(entries: LogEntry[]): Promise<void>;
}

/**
 * CloudWatch Logs Transport
 */
class CloudWatchTransport extends LogTransport {
  private client: import('@aws-sdk/client-cloudwatch-logs').CloudWatchLogsClient | null = null;
  private sequenceToken: string | undefined;
  private config_: CloudWatchConfig;

  constructor(config: CloudWatchConfig) {
    super(config);
    this.config_ = config;
  }

  private async getClient(): Promise<
    import('@aws-sdk/client-cloudwatch-logs').CloudWatchLogsClient
  > {
    if (!this.client) {
      const { CloudWatchLogsClient } = await import('@aws-sdk/client-cloudwatch-logs');

      this.client = new CloudWatchLogsClient({
        region: this.config_.region,
        ...(this.config_.accessKeyId && {
          credentials: {
            accessKeyId: this.config_.accessKeyId,
            secretAccessKey: this.config_.secretAccessKey || '',
          },
        }),
      });

      // Ensure log group and stream exist
      await this.ensureLogGroupAndStream();
    }

    return this.client;
  }

  private async ensureLogGroupAndStream(): Promise<void> {
    const {
      CreateLogGroupCommand,
      CreateLogStreamCommand,
      ResourceAlreadyExistsException,
    } = await import('@aws-sdk/client-cloudwatch-logs');

    const client = this.client!;

    // Create log group
    try {
      await client.send(
        new CreateLogGroupCommand({
          logGroupName: this.config_.logGroupName,
        }),
      );
    } catch (error) {
      if (!(error instanceof ResourceAlreadyExistsException)) {
        throw error;
      }
    }

    // Create log stream
    try {
      await client.send(
        new CreateLogStreamCommand({
          logGroupName: this.config_.logGroupName,
          logStreamName: this.config_.logStreamName,
        }),
      );
    } catch (error) {
      if (!(error instanceof ResourceAlreadyExistsException)) {
        throw error;
      }
    }
  }

  protected async send(entries: LogEntry[]): Promise<void> {
    const { PutLogEventsCommand } = await import('@aws-sdk/client-cloudwatch-logs');

    const client = await this.getClient();

    const logEvents = entries.map((entry) => ({
      timestamp: new Date(entry.timestamp).getTime(),
      message: JSON.stringify(entry),
    }));

    const response = await client.send(
      new PutLogEventsCommand({
        logGroupName: this.config_.logGroupName,
        logStreamName: this.config_.logStreamName,
        logEvents,
        sequenceToken: this.sequenceToken,
      }),
    );

    this.sequenceToken = response.nextSequenceToken;
  }
}

/**
 * Elasticsearch Transport
 */
class ElasticsearchTransport extends LogTransport {
  private config_: ElasticsearchConfig;

  constructor(config: ElasticsearchConfig) {
    super(config);
    this.config_ = config;
  }

  protected async send(entries: LogEntry[]): Promise<void> {
    const body = entries.flatMap((entry) => [
      {
        index: {
          _index: `${this.config_.index}-${new Date().toISOString().split('T')[0]}`,
        },
      },
      {
        ...entry,
        '@timestamp': entry.timestamp,
      },
    ]);

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-ndjson',
    };

    if (this.config_.apiKey) {
      headers['Authorization'] = `ApiKey ${this.config_.apiKey}`;
    } else if (this.config_.username && this.config_.password) {
      const credentials = Buffer.from(
        `${this.config_.username}:${this.config_.password}`,
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(`${this.config_.node}/_bulk`, {
      method: 'POST',
      headers,
      body: body.map((item) => JSON.stringify(item)).join('\n') + '\n',
    });

    if (!response.ok) {
      throw new Error(`Elasticsearch bulk request failed: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as { errors?: boolean };
    if (result.errors) {
      log.warn('Some Elasticsearch bulk operations had errors');
    }
  }
}

/**
 * Splunk HEC Transport
 */
class SplunkTransport extends LogTransport {
  private config_: SplunkConfig;

  constructor(config: SplunkConfig) {
    super(config);
    this.config_ = config;
  }

  protected async send(entries: LogEntry[]): Promise<void> {
    const protocol = this.config_.ssl ? 'https' : 'http';
    const url = `${protocol}://${this.config_.host}:${this.config_.port}/services/collector/event`;

    const events = entries.map((entry) => ({
      time: new Date(entry.timestamp).getTime() / 1000,
      host: process.env.HOSTNAME || 'unknown',
      source: this.config_.source,
      sourcetype: this.config_.sourcetype,
      index: this.config_.index,
      event: entry,
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Splunk ${this.config_.token}`,
      },
      body: events.map((e) => JSON.stringify(e)).join('\n'),
    });

    if (!response.ok) {
      throw new Error(`Splunk HEC request failed: ${response.status} ${response.statusText}`);
    }
  }
}

/**
 * Generic HTTP Transport
 */
class HTTPTransport extends LogTransport {
  private config_: HTTPTransportConfig;

  constructor(config: HTTPTransportConfig) {
    super(config);
    this.config_ = config;
  }

  protected async send(entries: LogEntry[]): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config_.headers,
    };

    if (this.config_.auth) {
      const credentials = Buffer.from(
        `${this.config_.auth.username}:${this.config_.auth.password}`,
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(this.config_.url, {
      method: this.config_.method || 'POST',
      headers,
      body: JSON.stringify(entries),
    });

    if (!response.ok) {
      throw new Error(`HTTP transport request failed: ${response.status} ${response.statusText}`);
    }
  }
}

/**
 * File Transport with rotation
 */
class FileTransport extends LogTransport {
  private config_: FileTransportConfig;
  private currentFile: string;
  private currentSize = 0;
  private fileIndex = 0;
  private writeStream: fs.WriteStream | null = null;

  constructor(config: FileTransportConfig) {
    super(config);
    this.config_ = config;
    this.currentFile = this.getFilePath();
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.config_.directory)) {
      fs.mkdirSync(this.config_.directory, { recursive: true });
    }
  }

  private getFilePath(index = 0): string {
    const base = path.basename(this.config_.filename, path.extname(this.config_.filename));
    const ext = path.extname(this.config_.filename);
    const suffix = index > 0 ? `.${index}` : '';
    return path.join(this.config_.directory, `${base}${suffix}${ext}`);
  }

  private async rotate(): Promise<void> {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }

    // Rotate files
    for (let i = (this.config_.maxFiles || 5) - 1; i >= 0; i--) {
      const currentPath = this.getFilePath(i);
      const nextPath = this.getFilePath(i + 1);

      if (fs.existsSync(currentPath)) {
        if (i === (this.config_.maxFiles || 5) - 1) {
          fs.unlinkSync(currentPath);
        } else {
          fs.renameSync(currentPath, nextPath);
        }
      }
    }

    this.currentFile = this.getFilePath();
    this.currentSize = 0;
  }

  private getWriteStream(): fs.WriteStream {
    if (!this.writeStream) {
      this.writeStream = fs.createWriteStream(this.currentFile, { flags: 'a' });
    }
    return this.writeStream;
  }

  protected async send(entries: LogEntry[]): Promise<void> {
    const data = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
    const dataSize = Buffer.byteLength(data);

    // Check if rotation is needed
    if (
      this.config_.maxSize &&
      this.currentSize + dataSize > this.config_.maxSize
    ) {
      await this.rotate();
    }

    return new Promise((resolve, reject) => {
      this.getWriteStream().write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          this.currentSize += dataSize;
          resolve();
        }
      });
    });
  }

  public async shutdown(): Promise<void> {
    await super.shutdown();

    if (this.writeStream) {
      await new Promise<void>((resolve) => {
        this.writeStream!.end(resolve);
      });
    }
  }
}

/**
 * Console Transport (default, uses stdout)
 */
class ConsoleTransport extends LogTransport {
  protected async send(entries: LogEntry[]): Promise<void> {
    for (const entry of entries) {
      process.stdout.write(JSON.stringify(entry) + '\n');
    }
  }
}

// Global transport instance
let transportInstance: LogTransport | null = null;

/**
 * Create a Pino transport stream that writes to the configured transport
 */
export function createTransportStream(): Transform {
  const config = buildConfig();

  // Initialize transport based on provider
  switch (config.provider) {
    case 'cloudwatch':
      transportInstance = new CloudWatchTransport(config as CloudWatchConfig);
      break;
    case 'elasticsearch':
      transportInstance = new ElasticsearchTransport(config as ElasticsearchConfig);
      break;
    case 'splunk':
      transportInstance = new SplunkTransport(config as SplunkConfig);
      break;
    case 'http':
      transportInstance = new HTTPTransport(config as HTTPTransportConfig);
      break;
    case 'file':
      transportInstance = new FileTransport(config as FileTransportConfig);
      break;
    case 'console':
    default:
      transportInstance = new ConsoleTransport(config);
  }

  // Return a transform stream that writes to the transport
  return new Transform({
    objectMode: true,
    transform(chunk: string, _encoding: BufferEncoding, callback: TransformCallback) {
      try {
        const entry = JSON.parse(chunk) as LogEntry;
        transportInstance!.write(entry).then(() => {
          callback(null, chunk);
        }).catch((err) => {
          callback(err as Error);
        });
      } catch (error) {
        callback(error as Error);
      }
    },
    flush(callback: TransformCallback) {
      if (transportInstance) {
        transportInstance.flush().then(() => {
          callback();
        }).catch((err) => {
          callback(err as Error);
        });
      } else {
        callback();
      }
    },
  });
}

/**
 * Shutdown the transport gracefully
 */
export async function shutdownTransport(): Promise<void> {
  if (transportInstance) {
    await transportInstance.shutdown();
    transportInstance = null;
  }
}

/**
 * Get current transport configuration
 */
export function getTransportConfig(): TransportConfig {
  return buildConfig();
}

export { buildConfig };
