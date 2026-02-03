/**
 * API Endpoint Audit Script
 *
 * Tests all API routes for authentication, response validation, and tenant isolation.
 * Run with: npm run audit:api
 */

import * as path from 'path';
import { config } from 'dotenv';
import { discoverAllRoutes, getRouteStats } from './lib/route-parser';
import { TEST_CONTEXTS, CROSS_TENANT_CONTEXT, getAuthHeaders } from './lib/auth-context';
import { generateReport, createIssue } from './lib/report-generator';
import type { DiscoveredEndpoint, EndpointTestResult, AuditReport, AuditIssue } from './lib/types';

// Load environment variables
config();

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const SERVER_DIR = path.join(process.cwd(), 'server');
const TIMEOUT = 10000; // 10 seconds per request
const SLOW_THRESHOLD = 2000; // 2 seconds = slow

// Endpoints to skip (health checks, public routes, etc.)
const SKIP_PATTERNS = [
  /^\/api\/health/,
  /^\/api\/version/,
  /^\/api\/status/,
  /^\/api\/auth\/login/,
  /^\/api\/auth\/signup/,
  /^\/api\/auth\/forgot-password/,
  /^\/api\/public/,
  /^\/api\/webhook/,
];

// ============================================================================
// Audit Functions
// ============================================================================

async function testEndpoint(
  endpoint: DiscoveredEndpoint,
  verbose: boolean = false,
): Promise<EndpointTestResult> {
  const result: EndpointTestResult = {
    endpoint,
    timestamp: new Date(),
    contextResults: [],
    status: 'untested',
    issues: [],
  };

  const url = `${BASE_URL}${endpoint.path}`;

  // Test 1: Unauthenticated access
  try {
    const unauthResult = await makeRequest(url, endpoint.method, {});

    if (endpoint.requiresAuth) {
      if (unauthResult.status !== 401 && unauthResult.status !== 403) {
        result.issues.push(
          createIssue(
            'auth',
            'critical',
            `Endpoint accessible without authentication (got ${unauthResult.status})`,
            endpoint.path,
            { sourceFile: endpoint.sourceFile, lineNumber: endpoint.lineNumber },
          ),
        );
      }
    }

    result.contextResults.push({
      context: 'unauthenticated',
      roleLevel: 0,
      statusCode: unauthResult.status,
      responseTime: unauthResult.responseTime,
      responseBody: unauthResult.body?.substring(0, 500),
      authEnforced: unauthResult.status === 401 || unauthResult.status === 403,
      tenantIsolated: true, // N/A for unauthenticated
    });
  } catch (error) {
    result.contextResults.push({
      context: 'unauthenticated',
      roleLevel: 0,
      statusCode: 0,
      responseTime: 0,
      error: (error as Error).message,
      authEnforced: false,
      tenantIsolated: true,
    });
  }

  // Test 2: Each authenticated context
  for (const context of TEST_CONTEXTS) {
    try {
      const headers = getAuthHeaders(context);
      const authResult = await makeRequest(url, endpoint.method, headers);

      // Check for slow responses
      if (authResult.responseTime > SLOW_THRESHOLD) {
        result.issues.push(
          createIssue(
            'performance',
            'medium',
            `Slow response time: ${authResult.responseTime}ms`,
            endpoint.path,
            { sourceFile: endpoint.sourceFile },
          ),
        );
      }

      // Check for server errors
      if (authResult.status >= 500) {
        result.issues.push(
          createIssue('security', 'high', `Server error: ${authResult.status}`, endpoint.path, {
            sourceFile: endpoint.sourceFile,
          }),
        );
      }

      result.contextResults.push({
        context: context.name,
        roleLevel: context.roleLevel,
        statusCode: authResult.status,
        responseTime: authResult.responseTime,
        responseBody: authResult.body?.substring(0, 500),
        authEnforced: true,
        tenantIsolated: true, // Will verify with cross-tenant test
      });

      if (verbose) {
        console.log(
          `  [${context.name}] ${endpoint.method} ${endpoint.path}: ${authResult.status} (${authResult.responseTime}ms)`,
        );
      }
    } catch (error) {
      result.contextResults.push({
        context: context.name,
        roleLevel: context.roleLevel,
        statusCode: 0,
        responseTime: 0,
        error: (error as Error).message,
        authEnforced: false,
        tenantIsolated: true,
      });
    }
  }

  // Test 3: Cross-tenant isolation (only for data-returning endpoints)
  if (
    endpoint.method === 'GET' &&
    !endpoint.path.includes('/count') &&
    !endpoint.path.includes('/stats')
  ) {
    try {
      const crossTenantHeaders = getAuthHeaders(CROSS_TENANT_CONTEXT);
      const crossTenantResult = await makeRequest(url, endpoint.method, crossTenantHeaders);

      // If we get data back, check if it contains any data from tenant-test-1
      if (crossTenantResult.status === 200 && crossTenantResult.body) {
        try {
          const data = JSON.parse(crossTenantResult.body);
          // Check for common patterns that might indicate cross-tenant data leak
          if (JSON.stringify(data).includes('tenant-test-1')) {
            result.issues.push(
              createIssue(
                'tenant',
                'critical',
                'Potential cross-tenant data leak detected',
                endpoint.path,
                {
                  sourceFile: endpoint.sourceFile,
                  suggestedFix:
                    'Ensure all queries filter by tenantId from the authenticated user context',
                },
              ),
            );
          }
        } catch {
          // Response wasn't JSON, skip this check
        }
      }

      result.contextResults.push({
        context: 'crossTenant',
        roleLevel: CROSS_TENANT_CONTEXT.roleLevel,
        statusCode: crossTenantResult.status,
        responseTime: crossTenantResult.responseTime,
        authEnforced: true,
        tenantIsolated:
          crossTenantResult.status === 403 ||
          crossTenantResult.status === 404 ||
          !crossTenantResult.body?.includes('tenant-test-1'),
      });
    } catch (error) {
      // Cross-tenant test failed, which might be expected
    }
  }

  // Determine overall status
  const hasErrors = result.issues.some((i) => i.severity === 'critical' || i.severity === 'high');
  const hasWarnings = result.issues.some((i) => i.severity === 'medium');
  const allSucceeded = result.contextResults.every((r) => r.statusCode !== 0 && r.statusCode < 500);

  if (hasErrors) {
    result.status = 'failing';
  } else if (hasWarnings || !allSucceeded) {
    result.status = 'partial';
  } else {
    result.status = 'healthy';
  }

  return result;
}

interface RequestResult {
  status: number;
  body: string;
  responseTime: number;
}

async function makeRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
): Promise<RequestResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' && method !== 'DELETE' ? JSON.stringify({}) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    let body = '';

    try {
      body = await response.text();
    } catch {
      // Ignore body read errors
    }

    return {
      status: response.status,
      body,
      responseTime,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Main Audit Logic
// ============================================================================

async function runAudit(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              API ENDPOINT AUDIT                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  // Step 1: Discover all routes
  console.log('📂 Discovering API endpoints...\n');
  const endpoints = discoverAllRoutes(SERVER_DIR);
  const stats = getRouteStats(endpoints);

  console.log(`   Total endpoints discovered: ${stats.total}`);
  console.log(`   By method: ${JSON.stringify(stats.byMethod)}`);
  console.log(`   Requiring auth: ${stats.authRequired}`);
  console.log(`   With permissions: ${stats.withPermissions}\n`);

  // Step 2: Filter endpoints
  const testableEndpoints = endpoints.filter(
    (e) => !SKIP_PATTERNS.some((pattern) => pattern.test(e.path)),
  );

  console.log(`🧪 Testing ${testableEndpoints.length} endpoints...\n`);

  // Step 3: Test each endpoint
  const results: EndpointTestResult[] = [];
  const allIssues: AuditIssue[] = [];
  let passed = 0;
  let failed = 0;
  let partial = 0;

  for (let i = 0; i < testableEndpoints.length; i++) {
    const endpoint = testableEndpoints[i];
    const progress = (((i + 1) / testableEndpoints.length) * 100).toFixed(0);

    process.stdout.write(
      `\r   Progress: [${progress.padStart(3)}%] ${endpoint.method.padEnd(7)} ${endpoint.path.substring(0, 50)}...`,
    );

    const result = await testEndpoint(endpoint, verbose);
    results.push(result);
    allIssues.push(...result.issues);

    if (result.status === 'healthy') passed++;
    else if (result.status === 'failing') failed++;
    else if (result.status === 'partial') partial++;
  }

  console.log('\n');

  // Step 4: Generate report
  const duration = Date.now() - startTime;

  const report: AuditReport = {
    type: 'api-endpoints',
    timestamp: new Date(),
    duration,
    summary: {
      total: testableEndpoints.length,
      passed,
      failed,
      warnings: partial,
      skipped: endpoints.length - testableEndpoints.length,
    },
    issues: allIssues,
    data: {
      endpoints: results,
      stats,
      config: {
        baseUrl: BASE_URL,
        timeout: TIMEOUT,
        slowThreshold: SLOW_THRESHOLD,
      },
    },
  };

  const { jsonPath, mdPath } = generateReport(report);

  // Step 5: Print summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT COMPLETE                          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Endpoints Tested:    ${String(testableEndpoints.length).padStart(35)} ║`);
  console.log(`║  Passed:              ${String(passed).padStart(35)} ║`);
  console.log(`║  Failed:              ${String(failed).padStart(35)} ║`);
  console.log(`║  Partial:             ${String(partial).padStart(35)} ║`);
  console.log(
    `║  Skipped:             ${String(endpoints.length - testableEndpoints.length).padStart(35)} ║`,
  );
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Duration:            ${formatDuration(duration).padStart(35)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Print issue summary
  const criticalIssues = allIssues.filter((i) => i.severity === 'critical');
  const highIssues = allIssues.filter((i) => i.severity === 'high');

  if (criticalIssues.length > 0) {
    console.log(`🔴 Critical Issues: ${criticalIssues.length}`);
    criticalIssues.slice(0, 5).forEach((i) => console.log(`   - ${i.message} (${i.resource})`));
  }

  if (highIssues.length > 0) {
    console.log(`🟠 High Issues: ${highIssues.length}`);
    highIssues.slice(0, 5).forEach((i) => console.log(`   - ${i.message} (${i.resource})`));
  }

  console.log(`\n📄 Reports saved to:`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   MD:   ${mdPath}\n`);

  // Exit with error code if there are critical issues
  if (criticalIssues.length > 0) {
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
