#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from './config/config-manager';
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
  .option('-c, --community <community>', 'SNMP community string', 'public')
  .action(async (ip, options) => {
    initLogger('info');
    const logger = getLogger();

    logger.info(`Testing connectivity to ${ip} via ${options.protocol.toUpperCase()}`);

    if (options.protocol === 'snmp') {
      const collector = new SNMPCollector();

      try {
        const connected = await collector.testConnection(ip, {
          community: options.community,
        });

        if (connected) {
          logger.info(`✓ SNMP connection successful`);

          // Try to collect metrics
          logger.info('Attempting to collect metrics...');
          const metrics = await collector.collect(ip, {
            community: options.community,
          });

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
  .command('discover <network>')
  .description('Discover printers on network (e.g., 192.168.1.0/24)')
  .action(async (network) => {
    initLogger('info');
    const logger = getLogger();

    logger.info(`Scanning network: ${network}`);

    const scanner = new NetworkScanner();
    const devices = await scanner.discoverDevices([network]);

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
      console.log('');
    }

    console.log('Add these devices to your config.json file to monitor them.');
  });

// Version command
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(`Printyx Monitoring Client v${packageJson.version}`);
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command specified
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
