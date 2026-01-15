#!/usr/bin/env node
/**
 * Comprehensive Test Runner
 *
 * Orchestrates the complete two-stage testing process:
 * 1. Discovery - Find all forms and interactive elements
 * 2. Execution - Test all discovered elements
 *
 * This is the main entry point for comprehensive testing.
 */

import { ComprehensiveDiscovery } from './comprehensive-discovery';
import { ComprehensiveExecution } from './comprehensive-execution';
import { performSafetyCheck } from './comprehensive-test.config';
import { Logger } from './utils/logger';
import path from 'path';

// ============================================================================
// CLI Options Interface
// ============================================================================

interface RunnerOptions {
  baseUrl?: string;
  skipDiscovery?: boolean;
  skipExecution?: boolean;
  discoveryOnly?: boolean;
  executionOnly?: boolean;
  discoveryReportPath?: string;
  help?: boolean;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(args: string[]): RunnerOptions {
  const options: RunnerOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--url':
      case '-u':
        options.baseUrl = nextArg;
        i++;
        break;
      case '--skip-discovery':
        options.skipDiscovery = true;
        break;
      case '--skip-execution':
        options.skipExecution = true;
        break;
      case '--discovery-only':
        options.discoveryOnly = true;
        break;
      case '--execution-only':
        options.executionOnly = true;
        break;
      case '--discovery-report':
        options.discoveryReportPath = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║        COMPREHENSIVE TEST RUNNER - Two-Stage Testing               ║
╚═══════════════════════════════════════════════════════════════════╝

DESCRIPTION:
  Comprehensive automated testing system that discovers and tests all
  forms, buttons, and interactive elements in your application.

USAGE:
  npm run test:comprehensive [options]

  Or directly:
  npx tsx tools/automated-testing/comprehensive-runner.ts [options]

OPTIONS:
  --url, -u <url>           Base URL to test (default: http://localhost:5000)
  --discovery-only          Run only discovery stage
  --execution-only          Run only execution stage (requires prior discovery)
  --skip-discovery          Skip discovery, use existing report
  --skip-execution          Run discovery but skip execution
  --discovery-report <path> Path to specific discovery report to use
  --help, -h                Show this help message

STAGES:
  1. Discovery:  Crawls application and catalogs all interactive elements
  2. Execution:  Tests all discovered elements systematically

EXAMPLES:
  # Run complete test (both stages)
  npm run test:comprehensive

  # Run with custom URL
  npm run test:comprehensive -- --url http://localhost:3000

  # Run discovery only
  npm run test:comprehensive -- --discovery-only

  # Run execution only (using most recent discovery)
  npm run test:comprehensive -- --execution-only

  # Use specific discovery report
  npm run test:comprehensive -- --execution-only --discovery-report ./reports/discovery.json

ENVIRONMENT VARIABLES:
  The following environment variables must be set in .env:

  TEST_USERNAME=your-test-user@example.com
  TEST_PASSWORD=your-test-password

  ⚠️  IMPORTANT: Never commit hardcoded credentials!
  All credentials MUST come from environment variables.

SAFETY FEATURES:
  ✅ Automatic safety checks before running
  ✅ No hardcoded credentials allowed
  ✅ .env file validation
  ✅ .gitignore validation
  ✅ Credential pattern detection

OUTPUT:
  Reports are saved to: ./test-reports/comprehensive/
  
  - discovery-report-[timestamp].json  (Discovery results)
  - discovery-report-[timestamp].md    (Discovery summary)
  - test-report-[timestamp].html       (Interactive test report)
  - test-report-[timestamp].json       (Machine-readable results)
  - test-report-[timestamp].md         (Test summary)

EXIT CODES:
  0 - All tests passed
  1 - Tests failed or error occurred

For more information, see the README in tools/automated-testing/
  `);
}

// ============================================================================
// Main Runner
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const logger = new Logger({ context: 'Runner', level: 'info' });

  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║           COMPREHENSIVE AUTOMATED TESTING SYSTEM                   ║
║                    Two-Stage Test Process                          ║
╚═══════════════════════════════════════════════════════════════════╝
  `);

  const baseUrl = options.baseUrl || process.env.BASE_URL || 'http://localhost:5000';
  logger.info(`Base URL: ${baseUrl}\n`);

  try {
    // Step 1: Pre-flight safety checks
    logger.info('🔒 Running pre-flight safety checks...');
    const safetyCheck = performSafetyCheck();

    if (!safetyCheck.safe) {
      logger.error('❌ Safety check failed!\n');
      safetyCheck.errors.forEach((err) => logger.error(`  ❌ ${err}`));
      console.log(`
⚠️  SECURITY ALERT ⚠️

The safety check detected potential security issues that must be resolved
before testing can proceed. This is to prevent accidentally committing
sensitive credentials to version control.

Common fixes:
1. Ensure .env file exists and contains TEST_USERNAME and TEST_PASSWORD
2. Ensure .env is listed in .gitignore
3. Remove any hardcoded credentials from test files

Please fix these issues and try again.
      `);
      process.exit(1);
    }

    logger.success('✅ Safety checks passed\n');

    // Determine which stages to run
    const runDiscovery = !options.skipDiscovery && !options.executionOnly;
    const runExecution = !options.skipExecution && !options.discoveryOnly;

    let discoveryReportPath = options.discoveryReportPath;

    // Step 2: Discovery Stage
    if (runDiscovery) {
      console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                      STAGE 1: DISCOVERY                            ║
║          Finding all forms and interactive elements                ║
╚═══════════════════════════════════════════════════════════════════╝
      `);

      logger.info('Starting discovery phase...\n');

      const discovery = new ComprehensiveDiscovery(baseUrl);
      const discoveryReport = await discovery.discover();

      // Save path for execution stage
      const timestamp = discoveryReport.timestamp.toISOString().replace(/:/g, '-');
      discoveryReportPath = path.join(
        'test-reports',
        'comprehensive',
        `discovery-report-${timestamp}.json`,
      );

      console.log(`
✅ Discovery Complete!

Summary:
  Pages:     ${discoveryReport.totalPages}
  Elements:  ${discoveryReport.totalElements}
  
Element Breakdown:`);

      Object.entries(discoveryReport.elementsByType)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          console.log(`  ${type.padEnd(15)} ${count}`);
        });

      if (discoveryReport.errors.length > 0) {
        console.log(`\n⚠️  Errors during discovery: ${discoveryReport.errors.length}`);
      }

      console.log(`\nReport saved to: ${path.resolve(process.cwd(), discoveryReportPath)}\n`);
    }

    // Step 3: Execution Stage
    if (runExecution) {
      console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                      STAGE 2: EXECUTION                            ║
║            Testing all discovered elements                         ║
╚═══════════════════════════════════════════════════════════════════╝
      `);

      logger.info('Starting execution phase...\n');

      const execution = new ComprehensiveExecution(baseUrl);
      await execution.execute(discoveryReportPath);

      console.log('\n✅ Comprehensive testing completed!\n');
    }

    // Final message
    if (runDiscovery && !runExecution) {
      console.log(`
📋 Discovery completed successfully!

Next steps:
  1. Review the discovery report
  2. Run execution stage:
     npm run test:execute

Or run both stages together:
  npm run test:comprehensive
      `);
    }

    process.exit(0);
  } catch (error) {
    logger.error(`\n❌ Testing failed: ${(error as Error).message}`);

    if ((error as Error).stack) {
      logger.error(`\nStack trace:\n${(error as Error).stack}`);
    }

    console.log(`
❌ Testing Failed

An error occurred during the testing process. Please review the error
message above and try again.

Common issues:
- Dev server not running (start with: npm run dev)
- Wrong URL (specify with: --url http://localhost:YOUR_PORT)
- Network connectivity issues
- Authentication problems

For more help, run: npm run test:comprehensive -- --help
    `);

    process.exit(1);
  }
}

// ============================================================================
// Error Handling
// ============================================================================

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// ============================================================================
// Execute
// ============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
