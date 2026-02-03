/**
 * API Contract Audit Script
 *
 * Ensures all frontend API calls have working backend endpoints.
 * Run with: npm run audit:contracts
 */

import * as path from 'path';
import { config } from 'dotenv';
import { discoverAllRoutes, getRouteStats } from './lib/route-parser';
import { scanFrontendDirectory, getApiCallStats, findOrphanedCalls } from './lib/frontend-scanner';
import { generateReport, createIssue } from './lib/report-generator';
import type {
  FrontendApiCall,
  DiscoveredEndpoint,
  AuditReport,
  AuditIssue,
  ContractMismatch,
} from './lib/types';

// Load environment variables
config();

// ============================================================================
// Configuration
// ============================================================================

const SERVER_DIR = path.join(process.cwd(), 'server');
const CLIENT_DIR = path.join(process.cwd(), 'client', 'src');

// ============================================================================
// Contract Analysis
// ============================================================================

function normalizeBackendPath(path: string): string {
  // Normalize path parameters
  return path
    .replace(/:\w+/g, ':param') // Convert :id, :userId, etc. to :param
    .replace(/\/+/g, '/') // Remove duplicate slashes
    .replace(/\/$/, ''); // Remove trailing slash
}

function normalizeFrontendPath(path: string): string {
  // Normalize template literals and path parameters
  return path
    .replace(/\$\{[^}]+\}/g, ':param') // Convert ${id} to :param
    .replace(/:\w+/g, ':param') // Convert :id to :param
    .replace(/\/+/g, '/') // Remove duplicate slashes
    .replace(/\/$/, ''); // Remove trailing slash
}

function buildBackendEndpointSet(endpoints: DiscoveredEndpoint[]): Set<string> {
  const set = new Set<string>();

  for (const endpoint of endpoints) {
    const normalized = normalizeBackendPath(endpoint.path);
    set.add(`${endpoint.method}:${normalized}`);

    // Also add variations for common parameter patterns
    const withId = normalized.replace(/:param/g, ':id');
    set.add(`${endpoint.method}:${withId}`);
  }

  return set;
}

function findContractMismatches(
  frontendCalls: FrontendApiCall[],
  backendEndpoints: DiscoveredEndpoint[],
): ContractMismatch[] {
  const mismatches: ContractMismatch[] = [];
  const backendSet = buildBackendEndpointSet(backendEndpoints);

  // Group frontend calls by endpoint
  const frontendByEndpoint = new Map<string, FrontendApiCall[]>();
  for (const call of frontendCalls) {
    const normalized = normalizeFrontendPath(call.endpoint);
    const key = `${call.method}:${normalized}`;
    if (!frontendByEndpoint.has(key)) {
      frontendByEndpoint.set(key, []);
    }
    frontendByEndpoint.get(key)!.push(call);
  }

  // Check each unique frontend call
  for (const [key, calls] of frontendByEndpoint) {
    const [method, endpoint] = key.split(':');

    // Check if backend exists
    if (!backendSet.has(key)) {
      // Try with different parameter variations
      const variations = [
        key,
        `${method}:${endpoint.replace(/:param/g, ':id')}`,
        `${method}:/api${endpoint}`,
        `${method}:${endpoint.replace('/api', '')}`,
      ];

      const found = variations.some((v) => backendSet.has(v));

      if (!found) {
        // Check for method mismatch
        const anyMethodMatch = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].some((m) =>
          backendSet.has(`${m}:${endpoint}`),
        );

        if (anyMethodMatch) {
          mismatches.push({
            frontendCall: calls[0],
            type: 'method-mismatch',
            description: `Frontend uses ${method} but endpoint exists with different method`,
          });
        } else {
          mismatches.push({
            frontendCall: calls[0],
            type: 'orphaned',
            description: `No backend endpoint found for ${method} ${endpoint}`,
          });
        }
      }
    }
  }

  return mismatches;
}

function findUnusedBackendEndpoints(
  frontendCalls: FrontendApiCall[],
  backendEndpoints: DiscoveredEndpoint[],
): DiscoveredEndpoint[] {
  const unused: DiscoveredEndpoint[] = [];

  // Build set of frontend endpoints
  const frontendSet = new Set<string>();
  for (const call of frontendCalls) {
    const normalized = normalizeFrontendPath(call.endpoint);
    frontendSet.add(`${call.method}:${normalized}`);
    frontendSet.add(`${call.method}:${normalized.replace(/:param/g, ':id')}`);
    frontendSet.add(`${call.method}:/api${normalized}`);
    frontendSet.add(`${call.method}:${normalized.replace('/api', '')}`);
  }

  // Check each backend endpoint
  for (const endpoint of backendEndpoints) {
    const normalized = normalizeBackendPath(endpoint.path);
    const key = `${endpoint.method}:${normalized}`;

    // Skip internal/system endpoints
    if (
      endpoint.path.includes('/health') ||
      endpoint.path.includes('/webhook') ||
      endpoint.path.includes('/internal') ||
      endpoint.path.includes('/cron') ||
      endpoint.path.includes('/stripe/') ||
      endpoint.path.includes('/auth/')
    ) {
      continue;
    }

    // Check if frontend calls this endpoint
    const variations = [
      key,
      `${endpoint.method}:${normalized.replace(/:param/g, ':id')}`,
      `${endpoint.method}:${normalized.replace('/api', '')}`,
    ];

    const found = variations.some((v) => frontendSet.has(v));

    if (!found) {
      unused.push(endpoint);
    }
  }

  return unused;
}

// ============================================================================
// Main Audit Logic
// ============================================================================

async function runAudit(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              API CONTRACT AUDIT                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  // Step 1: Discover backend endpoints
  console.log('📂 Discovering backend endpoints...\n');
  const backendEndpoints = discoverAllRoutes(SERVER_DIR);
  const backendStats = getRouteStats(backendEndpoints);

  console.log(`   Backend endpoints: ${backendStats.total}`);
  console.log(`   By method: ${JSON.stringify(backendStats.byMethod)}\n`);

  // Step 2: Scan frontend for API calls
  console.log('📂 Scanning frontend for API calls...\n');
  const frontendCalls = scanFrontendDirectory(CLIENT_DIR);
  const frontendStats = getApiCallStats(frontendCalls);

  console.log(`   Frontend API calls: ${frontendStats.total}`);
  console.log(`   Unique endpoints: ${frontendStats.uniqueEndpoints}`);
  console.log(`   By method: ${JSON.stringify(frontendStats.byMethod)}`);
  console.log(`   By type: ${JSON.stringify(frontendStats.byType)}\n`);

  // Step 3: Find contract mismatches
  console.log('🔍 Analyzing contracts...\n');

  const mismatches = findContractMismatches(frontendCalls, backendEndpoints);
  const orphanedCalls = mismatches.filter((m) => m.type === 'orphaned');
  const methodMismatches = mismatches.filter((m) => m.type === 'method-mismatch');

  const unusedEndpoints = findUnusedBackendEndpoints(frontendCalls, backendEndpoints);

  console.log(`   Orphaned frontend calls: ${orphanedCalls.length}`);
  console.log(`   Method mismatches: ${methodMismatches.length}`);
  console.log(`   Unused backend endpoints: ${unusedEndpoints.length}\n`);

  // Step 4: Create issues
  const allIssues: AuditIssue[] = [];

  for (const mismatch of orphanedCalls) {
    allIssues.push(
      createIssue('contract', 'high', mismatch.description, mismatch.frontendCall.endpoint, {
        sourceFile: mismatch.frontendCall.sourceFile,
        lineNumber: mismatch.frontendCall.lineNumber,
        suggestedFix: 'Add missing backend endpoint or remove unused frontend call',
      }),
    );
  }

  for (const mismatch of methodMismatches) {
    allIssues.push(
      createIssue('contract', 'medium', mismatch.description, mismatch.frontendCall.endpoint, {
        sourceFile: mismatch.frontendCall.sourceFile,
        lineNumber: mismatch.frontendCall.lineNumber,
        suggestedFix: 'Align HTTP methods between frontend and backend',
      }),
    );
  }

  for (const endpoint of unusedEndpoints.slice(0, 50)) {
    // Limit to first 50
    allIssues.push(
      createIssue(
        'contract',
        'low',
        `Backend endpoint not called by frontend: ${endpoint.method} ${endpoint.path}`,
        endpoint.path,
        {
          sourceFile: endpoint.sourceFile,
          lineNumber: endpoint.lineNumber,
          suggestedFix: 'Verify if endpoint is used by external clients or can be removed',
        },
      ),
    );
  }

  // Step 5: Generate report
  const duration = Date.now() - startTime;

  const report: AuditReport = {
    type: 'api-contracts',
    timestamp: new Date(),
    duration,
    summary: {
      total: frontendStats.uniqueEndpoints + backendStats.total,
      passed: frontendStats.uniqueEndpoints - orphanedCalls.length,
      failed: orphanedCalls.length,
      warnings: methodMismatches.length + unusedEndpoints.length,
      skipped: 0,
    },
    issues: allIssues,
    data: {
      frontendCalls: frontendStats,
      backendEndpoints: backendStats,
      mismatches: {
        orphaned: orphanedCalls.map((m) => ({
          endpoint: m.frontendCall.endpoint,
          method: m.frontendCall.method,
          sourceFile: m.frontendCall.sourceFile,
          lineNumber: m.frontendCall.lineNumber,
        })),
        methodMismatches: methodMismatches.map((m) => ({
          endpoint: m.frontendCall.endpoint,
          method: m.frontendCall.method,
          description: m.description,
        })),
      },
      unusedEndpoints: unusedEndpoints.map((e) => ({
        method: e.method,
        path: e.path,
        sourceFile: e.sourceFile,
      })),
    },
  };

  const { jsonPath, mdPath } = generateReport(report);

  // Step 6: Print summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT COMPLETE                          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Backend Endpoints:   ${String(backendStats.total).padStart(35)} ║`);
  console.log(`║  Frontend API Calls:  ${String(frontendStats.uniqueEndpoints).padStart(35)} ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Orphaned Calls:      ${String(orphanedCalls.length).padStart(35)} ║`);
  console.log(`║  Method Mismatches:   ${String(methodMismatches.length).padStart(35)} ║`);
  console.log(`║  Unused Endpoints:    ${String(unusedEndpoints.length).padStart(35)} ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Duration:            ${formatDuration(duration).padStart(35)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Print details if verbose
  if (verbose || orphanedCalls.length > 0) {
    if (orphanedCalls.length > 0) {
      console.log('🔴 Orphaned Frontend Calls (no backend):');
      orphanedCalls.slice(0, 10).forEach((m) => {
        console.log(`   ${m.frontendCall.method} ${m.frontendCall.endpoint}`);
        console.log(
          `      File: ${path.basename(m.frontendCall.sourceFile)}:${m.frontendCall.lineNumber}`,
        );
      });
      if (orphanedCalls.length > 10) {
        console.log(`   ... and ${orphanedCalls.length - 10} more`);
      }
      console.log('');
    }
  }

  if (verbose && unusedEndpoints.length > 0) {
    console.log('🟡 Unused Backend Endpoints (not called by frontend):');
    unusedEndpoints.slice(0, 10).forEach((e) => {
      console.log(`   ${e.method} ${e.path}`);
    });
    if (unusedEndpoints.length > 10) {
      console.log(`   ... and ${unusedEndpoints.length - 10} more`);
    }
    console.log('');
  }

  console.log(`📄 Reports saved to:`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   MD:   ${mdPath}\n`);

  // Exit with error code if there are orphaned calls
  if (orphanedCalls.length > 0) {
    process.exit(1);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

// ============================================================================
// Entry Point
// ============================================================================

runAudit().catch((error) => {
  console.error('Audit failed:', error);
  process.exit(1);
});
