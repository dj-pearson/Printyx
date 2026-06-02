#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import { ConfigManager, ClientConfig } from './config/config-manager';
import { PrintyxAPIClient } from './api/printyx-client';
import { MetricsScheduler } from './services/scheduler';
import { initLogger, getLogger } from './utils/logger';
import { SNMPCollector } from './collectors/snmp-collector';
import { NetworkScanner } from './discovery/network-scanner';

const program = new Command();
const packageJson = require('../package.json');

program
  .name('printyx-client')
  .description('Lightweight monitoring client for Printyx toner level tracking')
  .version(packageJson.version);

// Start command
program
  .command('start')
  .description('Start the monitoring client')
  .option('-c, --config <path>', 'Path to configuration file', 'config.json')
  .option('-l, --log-level <level>', 'Log level (error, warn, info, debug)', 'info')
  .action(async (options) => {
    try {
      const configPath = path.resolve(options.config);

      // Initialize logger
      const configManager = new ConfigManager(configPath);
      const config = configManager.loadConfig();

      initLogger(options.logLevel || config.logging?.level || 'info', config.logging?.file);

      const logger = getLogger();
      logger.info('Starting Printyx Monitoring Client', {
        version: packageJson.version,
        configPath,
      });

      // Initialize API client
      const apiClient = new PrintyxAPIClient({
        endpoint: config.api.endpoint,
        apiKey: config.api.apiKey,
        tenantId: config.api.tenantId,
        timeout: config.api.timeout,
        clientVersion: packageJson.version,
        security: config.api.security,
      });

      // Test connection
      logger.info('Testing connection to Printyx platform...');
      const connected = await apiClient.testConnection();

      if (!connected) {
        logger.error('Failed to connect to Printyx platform. Please check your configuration.');
        process.exit(1);
      }

      logger.info('Successfully connected to Printyx platform');

      // Initialize and start scheduler
      const scheduler = new MetricsScheduler(configManager, apiClient);
      scheduler.start();

      logger.info('Monitoring client started successfully');
      logger.info(`Polling interval: ${config.collection.pollingInterval} seconds`);
      logger.info(`Discovery enabled: ${config.collection.discoveryEnabled}`);

      // Handle graceful shutdown
      const shutdown = () => {
        logger.info('Shutting down monitoring client...');
        scheduler.stop();
        logger.info('Monitoring client stopped');
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (error) {
      console.error('Failed to start monitoring client:', error);
      process.exit(1);
    }
  });

// Selftest command — post-install verification. Runs one discovery+collect
// cycle, submits what it found, reports the result to the platform, and
// prints a pass/fail summary. The Windows installer runs this right after
// starting the service so the operator gets immediate confirmation.
program
  .command('selftest')
  .description('Verify the install: discover + collect once, report result to the platform')
  .option('-c, --config <path>', 'Path to configuration file', 'config.json')
  .action(async (options) => {
    initLogger('info');
    const logger = getLogger();
    const start = Date.now();
    try {
      const configManager = new ConfigManager(path.resolve(options.config));
      const config = configManager.loadConfig();

      const apiClient = new PrintyxAPIClient({
        endpoint: config.api.endpoint,
        apiKey: config.api.apiKey,
        tenantId: config.api.tenantId,
        timeout: config.api.timeout,
        clientVersion: packageJson.version,
        security: config.api.security,
      });

      logger.info('Running install self-test (discovery + one collection cycle)...');
      const scheduler = new MetricsScheduler(configManager, apiClient);
      const result = await scheduler.runSelfTest();
      const durationMs = Date.now() - start;
      const ok = result.printersReporting > 0;

      // Report to the platform (best-effort — a failed report shouldn't mask
      // the local result the operator can already see).
      try {
        await apiClient.submitInstallReport({
          agentVersion: packageJson.version,
          printersFound: result.printersFound,
          printersReporting: result.printersReporting,
          errors: result.errors,
          durationMs,
          ok,
        });
      } catch {
        logger.warn('Could not report self-test result to the platform (will still run normally).');
      }

      console.log('');
      console.log('  Install self-test');
      console.log('  -----------------');
      console.log(`  Printers found     : ${result.printersFound}`);
      console.log(`  Printers reporting : ${result.printersReporting}`);
      console.log(`  Duration           : ${(durationMs / 1000).toFixed(1)}s`);
      if (result.errors.length > 0) {
        console.log('  Notes:');
        for (const e of result.errors.slice(0, 10)) console.log(`    - ${e}`);
      }
      console.log('');
      if (ok) {
        console.log('  RESULT: PASS — data is flowing to the platform.');
      } else {
        console.log('  RESULT: NO DATA YET — service is installed but no printer reported.');
        console.log('  Check SNMP is enabled on the printers and the network range is correct.');
      }
      console.log('');
      // Exit 0 only when at least one printer reported; 2 = installed-but-no-data.
      process.exit(ok ? 0 : 2);
    } catch (error) {
      logger.error('Self-test failed', { error: errorMessage(error) });
      process.exit(1);
    }
  });

// Init command - Generate sample configuration
program
  .command('init')
  .description('Generate a sample configuration file')
  .option('-o, --output <path>', 'Output path for configuration file', 'config.json')
  .action((options) => {
    try {
      const outputPath = path.resolve(options.output);

      if (fs.existsSync(outputPath)) {
        console.error(`Configuration file already exists: ${outputPath}`);
        console.log('Use --output to specify a different location');
        process.exit(1);
      }

      ConfigManager.generateSampleConfig(outputPath);
      console.log(`Sample configuration file created: ${outputPath}`);
      console.log('\nPlease edit the configuration file with your Printyx credentials:');
      console.log('  - api.endpoint: Your Printyx instance URL');
      console.log('  - api.apiKey: Your client API key');
      console.log('  - api.tenantId: Your tenant ID');
      console.log('  - collection.networkRanges: Your network ranges to scan');
      console.log('  - devices: Add your printer IP addresses');
    } catch (error) {
      console.error('Failed to generate configuration file:', error);
      process.exit(1);
    }
  });

// Test command - Test device connectivity
program
  .command('test <ip>')
  .description('Test connectivity to a device')
  .option('-p, --protocol <protocol>', 'Protocol to test (snmp, http)', 'snmp')
  .option('-c, --community <community>', 'SNMP community string (v1/v2c only)', 'public')
  .option('-V, --snmp-version <version>', 'SNMP version: 1 | 2c | 3', '2c')
  .option('-u, --snmp-username <name>', 'SNMPv3 username')
  .option('--snmp-auth-protocol <p>', 'SNMPv3 auth protocol: MD5|SHA|SHA224|SHA256|SHA384|SHA512')
  .option('--snmp-auth-key <key>', 'SNMPv3 auth key')
  .option('--snmp-priv-protocol <p>', 'SNMPv3 priv protocol: DES|AES')
  .option('--snmp-priv-key <key>', 'SNMPv3 priv key')
  .action(async (ip, options) => {
    initLogger('info');
    const logger = getLogger();

    logger.info(`Testing connectivity to ${ip} via ${options.protocol.toUpperCase()}`);

    if (options.protocol === 'snmp') {
      const collector = new SNMPCollector();
      const isV3 = options.snmpVersion === '3';
      const collectorOpts: any = {
        community: options.community,
        version: options.snmpVersion,
      };
      if (isV3) {
        if (!options.snmpUsername) {
          logger.error('SNMPv3 requires --snmp-username');
          process.exit(1);
        }
        collectorOpts.v3 = {
          username: options.snmpUsername,
          authProtocol: options.snmpAuthProtocol,
          authKey: options.snmpAuthKey,
          privProtocol: options.snmpPrivProtocol,
          privKey: options.snmpPrivKey,
        };
      }

      try {
        const connected = await collector.testConnection(ip, collectorOpts);

        if (connected) {
          logger.info(`✓ SNMP connection successful`);

          // Try to collect metrics
          logger.info('Attempting to collect metrics...');
          const metrics = await collector.collect(ip, collectorOpts);

          console.log('\nDevice Information:');
          console.log(`  Serial Number: ${metrics.serialNumber}`);
          console.log(`  Manufacturer: ${metrics.manufacturer || 'Unknown'}`);
          console.log(`  Model: ${metrics.model || 'Unknown'}`);
          console.log(`  Status: ${metrics.deviceStatus}`);

          if (metrics.tonerLevels && Object.keys(metrics.tonerLevels).length > 0) {
            console.log('\nToner Levels:');
            for (const [color, level] of Object.entries(metrics.tonerLevels)) {
              console.log(`  ${color}: ${level}%`);
            }
          }

          if (metrics.paperLevels && Object.keys(metrics.paperLevels).length > 0) {
            console.log('\nPaper Levels:');
            for (const [tray, level] of Object.entries(metrics.paperLevels)) {
              console.log(`  ${tray}: ${level}%`);
            }
          }

          if (metrics.meters) {
            console.log('\nMeter Readings:');
            if (metrics.meters.totalImpressions) {
              console.log(`  Total: ${metrics.meters.totalImpressions}`);
            }
            if (metrics.meters.bwImpressions) {
              console.log(`  B&W: ${metrics.meters.bwImpressions}`);
            }
            if (metrics.meters.colorImpressions) {
              console.log(`  Color: ${metrics.meters.colorImpressions}`);
            }
          }
        } else {
          logger.error('✗ SNMP connection failed');
          process.exit(1);
        }
      } catch (error) {
        logger.error('Test failed', { error });
        process.exit(1);
      }
    } else {
      logger.error('HTTP testing not yet implemented. Use SNMP for now.');
      process.exit(1);
    }
  });

// Discover command - Scan network for printers
program
  .command('discover [network]')
  .description(
    'Discover printers on the local network. Defaults to mDNS + WSD; pass a CIDR (e.g., 192.168.1.0/24) to also do a CIDR sweep.',
  )
  .option(
    '-m, --method <methods>',
    'Comma-separated list of discovery methods: mdns, wsd, cidr, all',
    'mdns,wsd',
  )
  .action(async (network, options) => {
    initLogger('info');
    const logger = getLogger();

    const methods = (options.method as string)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as Array<'mdns' | 'wsd' | 'cidr' | 'all'>;

    if (network) {
      logger.info(`Discovery: ${methods.join(',')} (CIDR target: ${network})`);
    } else {
      logger.info(`Discovery: ${methods.join(',')} (no CIDR target)`);
      if (methods.includes('cidr')) {
        logger.warn('Method "cidr" requested but no network range supplied — skipping CIDR sweep.');
      }
    }

    const scanner = new NetworkScanner();
    const devices = await scanner.discoverDevices(network ? [network] : [], methods);

    if (devices.length === 0) {
      console.log('\nNo devices found.');
      return;
    }

    console.log(`\nFound ${devices.length} devices:\n`);

    for (const device of devices) {
      console.log(`  IP: ${device.ipAddress}`);
      if (device.manufacturer) console.log(`    Manufacturer: ${device.manufacturer}`);
      if (device.model) console.log(`    Model: ${device.model}`);
      console.log(`    Protocol: ${device.protocol.toUpperCase()}`);
      if (device.discoveredVia && device.discoveredVia.length > 0) {
        console.log(`    Found via: ${device.discoveredVia.join(', ')}`);
      }
      if (device.hostname) console.log(`    Hostname: ${device.hostname}`);
      console.log('');
    }

    console.log('Add these devices to your config.json file to monitor them.');
  });

// Enroll command — exchange a one-time enrollment token for a permanent
// API key and write a working config.json. This is what the bundled
// platform installer calls.
program
  .command('enroll')
  .description('Redeem a one-time enrollment token for a permanent API key + config')
  .requiredOption('-t, --token <token>', 'Enrollment token (et_...)')
  .requiredOption('-e, --endpoint <url>', 'Printyx HTTPS endpoint (e.g. https://app.printyx.net)')
  .option('-o, --output <path>', 'Where to write config.json', 'config.json')
  .option('--bundle <path>', 'Read endpoint+token from a bootstrap-config.json bundle')
  .option('--client-name <name>', 'Friendly name for this installation', os.hostname())
  .action(async (options) => {
    initLogger('info');
    const logger = getLogger();
    try {
      let endpoint = options.endpoint;
      let token = options.token;
      if (options.bundle) {
        const bundle = JSON.parse(fs.readFileSync(options.bundle, 'utf-8'));
        endpoint = bundle.endpoint || endpoint;
        token = bundle.enrollmentToken || token;
      }
      if (!endpoint?.startsWith('https://')) {
        throw new Error('Endpoint must be HTTPS.');
      }

      logger.info(`Enrolling against ${endpoint}`);
      const result = await postJson(`${endpoint}/api/client-metrics/enroll`, {
        token,
        hostname: os.hostname(),
        clientVersion: packageJson.version,
      });

      const config: ClientConfig = {
        client: {
          id: result.clientId,
          name: options.clientName || result.clientName || os.hostname(),
          version: packageJson.version,
        },
        api: {
          endpoint: result.endpoint || endpoint,
          apiKey: result.apiKey,
          tenantId: String(result.tenantId),
          timeout: 30000,
          security: {
            rejectUnauthorized: true,
            minTLSVersion: 'TLSv1.2',
          },
        },
        collection: {
          pollingInterval: result.configuration?.pollingInterval || 300,
          discoveryEnabled: result.configuration?.discoveryEnabled ?? true,
          networkRanges: [],
          retryAttempts: result.configuration?.retryAttempts || 3,
          timeout: result.configuration?.timeout || 10000,
        },
        devices: [],
        alerts: {
          tonerThreshold: result.configuration?.tonerThreshold || 15,
          paperThreshold: result.configuration?.paperThreshold || 20,
        },
        logging: { level: 'info' },
      };

      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
      if (process.platform !== 'win32') {
        fs.chmodSync(outputPath, 0o600);
      }

      logger.info(`Enrollment complete. Config written to ${outputPath}`);
      console.log('');
      console.log(`  client id   : ${result.clientId}`);
      console.log(`  tenant id   : ${result.tenantId}`);
      console.log(`  endpoint    : ${result.endpoint || endpoint}`);
      console.log('');
      console.log('Start with: printyx-client start -c ' + outputPath);
    } catch (error) {
      logger.error('Enrollment failed', { error: errorMessage(error) });
      process.exit(1);
    }
  });

// Register command — for admins who already have a session/admin token.
// Calls the platform's POST /api/client-metrics/clients endpoint to
// register a brand-new client and writes config.json with the freshly
// issued API key. Most users won't need this — use `enroll` with a token
// generated in the platform UI instead.
program
  .command('register')
  .description('Register a new client against the platform (admin auth required)')
  .requiredOption('-e, --endpoint <url>', 'Printyx HTTPS endpoint')
  .requiredOption('--admin-token <token>', 'Admin session token / Bearer JWT')
  .requiredOption('--tenant-id <id>', 'Tenant ID')
  .requiredOption('--client-name <name>', 'Friendly name for this installation')
  .option('-o, --output <path>', 'Where to write config.json', 'config.json')
  .option('--location <text>', 'Optional physical location label')
  .action(async (options) => {
    initLogger('info');
    const logger = getLogger();
    try {
      if (!options.endpoint.startsWith('https://')) {
        throw new Error('Endpoint must be HTTPS.');
      }
      const body = { clientName: options.clientName, location: options.location };
      const headers = {
        Authorization: `Bearer ${options.adminToken}`,
        'X-Tenant-ID': options.tenantId,
      };
      logger.info(`Registering '${options.clientName}' at ${options.endpoint}`);
      const result = await postJson(
        `${options.endpoint}/api/client-metrics/clients`,
        body,
        headers,
      );
      const created = result.client || result;

      const config: ClientConfig = {
        client: {
          id: created.clientId,
          name: created.clientName,
          version: packageJson.version,
        },
        api: {
          endpoint: options.endpoint,
          apiKey: created.plainApiKey,
          tenantId: String(options.tenantId),
          timeout: 30000,
          security: { rejectUnauthorized: true, minTLSVersion: 'TLSv1.2' },
        },
        collection: {
          pollingInterval: 300,
          discoveryEnabled: true,
          networkRanges: [],
          retryAttempts: 3,
          timeout: 10000,
        },
        devices: [],
        alerts: { tonerThreshold: 15, paperThreshold: 20 },
        logging: { level: 'info' },
      };
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
      if (process.platform !== 'win32') {
        fs.chmodSync(outputPath, 0o600);
      }
      logger.info(`Registration complete. Config written to ${outputPath}`);
    } catch (error) {
      logger.error('Registration failed', { error: errorMessage(error) });
      process.exit(1);
    }
  });

// Version command
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(`Printyx Monitoring Client v${packageJson.version}`);
  });

// -----------------------------------------------------------------------
// Helpers used by enroll/register. Kept out of services/ because they
// are CLI-only HTTPS POST helpers that intentionally don't pull the full
// PrintyxAPIClient construction path (we don't have an api key yet).
// -----------------------------------------------------------------------

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function postJson<T = any>(
  url: string,
  body: any,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'https:') {
      return reject(new Error('Refusing to enroll over non-HTTPS endpoint.'));
    }
    const payload = Buffer.from(JSON.stringify(body));
    const req = https.request(
      {
        method: 'POST',
        host: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          'User-Agent': `Printyx-Client/${packageJson.version}`,
          ...extraHeaders,
        },
        // Strict TLS 1.2+ — same posture as the runtime client.
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}: ${text || res.statusMessage}`));
          }
          try {
            resolve(JSON.parse(text) as T);
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${text.substring(0, 200)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Parse command line arguments
program.parse(process.argv);

// Show help if no command specified
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
