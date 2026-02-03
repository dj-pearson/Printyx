/**
 * Edge Function Audit Script
 *
 * Verifies all Supabase Edge Functions for completeness, CORS, and functionality.
 * Run with: npm run audit:edge
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { generateReport, createIssue } from './lib/report-generator';
import type {
  DiscoveredEdgeFunction,
  EdgeFunctionTestResult,
  AuditReport,
  AuditIssue,
} from './lib/types';

// Load environment variables
config();

// ============================================================================
// Configuration
// ============================================================================

const EDGE_FUNCTIONS_URL =
  process.env.EDGE_FUNCTIONS_URL ||
  process.env.VITE_EDGE_FUNCTIONS_URL ||
  'https://functions.printyx.net';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FUNCTIONS_DIR = path.join(process.cwd(), 'supabase', 'functions');
const TIMEOUT = 15000; // 15 seconds per request

// ============================================================================
// Function Discovery
// ============================================================================

function discoverEdgeFunctions(): DiscoveredEdgeFunction[] {
  const functions: DiscoveredEdgeFunction[] = [];

  if (!fs.existsSync(FUNCTIONS_DIR)) {
    console.warn(`Functions directory not found: ${FUNCTIONS_DIR}`);
    return functions;
  }

  const directories = fs.readdirSync(FUNCTIONS_DIR, { withFileTypes: true });

  for (const dir of directories) {
    if (!dir.isDirectory() || dir.name.startsWith('_')) continue;

    const functionPath = path.join(FUNCTIONS_DIR, dir.name);
    const indexFile = path.join(functionPath, 'index.ts');

    if (!fs.existsSync(indexFile)) continue;

    const sourceCode = fs.readFileSync(indexFile, 'utf-8');
    const analysis = analyzeSourceCode(sourceCode);

    functions.push({
      name: dir.name,
      path: functionPath,
      endpoint: `${EDGE_FUNCTIONS_URL}/${dir.name}`,
      methods: detectMethods(sourceCode),
      requiresAuth: detectAuthRequirement(sourceCode),
      hasCors: detectCorsConfiguration(sourceCode),
      sourceAnalysis: analysis,
    });
  }

  return functions;
}

function analyzeSourceCode(sourceCode: string): DiscoveredEdgeFunction['sourceAnalysis'] {
  const todoPattern = /\/\/\s*TODO[:\s](.+)$/gim;
  const todoComments: string[] = [];
  let match;

  while ((match = todoPattern.exec(sourceCode)) !== null) {
    todoComments.push(match[1].trim());
  }

  // Detect incomplete handlers
  const incompleteHandlers: string[] = [];

  // Check for throw new Error('Not implemented')
  if (sourceCode.includes('Not implemented') || sourceCode.includes('not implemented')) {
    incompleteHandlers.push('Contains "Not implemented" placeholder');
  }

  // Check for empty response bodies
  if (sourceCode.match(/return\s+new\s+Response\s*\(\s*['"`]['"`]\s*\)/)) {
    incompleteHandlers.push('Returns empty response body');
  }

  // Check for stub responses
  if (sourceCode.includes('{ stub: true }') || sourceCode.includes('"stub"')) {
    incompleteHandlers.push('Contains stub response');
  }

  // Check for console.log only handlers
  if (sourceCode.match(/=>\s*\{\s*console\.log\([^)]+\)\s*\}/)) {
    incompleteHandlers.push('Handler only contains console.log');
  }

  // Extract imports
  const importPattern = /import\s+(?:{[^}]+}|[^{]+)\s+from\s+['"`]([^'"`]+)['"`]/g;
  const imports: string[] = [];

  while ((match = importPattern.exec(sourceCode)) !== null) {
    imports.push(match[1]);
  }

  // Check for Supabase client usage
  const usesSupabaseClient =
    sourceCode.includes('createClient') || sourceCode.includes('supabaseClient');

  return {
    hasTodo: todoComments.length > 0,
    todoComments,
    hasIncompleteHandlers: incompleteHandlers.length > 0,
    incompleteHandlers,
    imports,
    usesSupabaseClient,
  };
}

function detectMethods(sourceCode: string): string[] {
  const methods: string[] = [];

  if (
    sourceCode.includes("method === 'GET'") ||
    sourceCode.includes('method === "GET"') ||
    sourceCode.includes('GET')
  ) {
    methods.push('GET');
  }
  if (
    sourceCode.includes("method === 'POST'") ||
    sourceCode.includes('method === "POST"') ||
    sourceCode.includes('POST')
  ) {
    methods.push('POST');
  }
  if (sourceCode.includes("method === 'PUT'") || sourceCode.includes('method === "PUT"')) {
    methods.push('PUT');
  }
  if (sourceCode.includes("method === 'PATCH'") || sourceCode.includes('method === "PATCH"')) {
    methods.push('PATCH');
  }
  if (sourceCode.includes("method === 'DELETE'") || sourceCode.includes('method === "DELETE"')) {
    methods.push('DELETE');
  }
  if (sourceCode.includes('OPTIONS')) {
    methods.push('OPTIONS');
  }

  // Default to POST if no methods detected
  if (methods.length === 0) {
    methods.push('POST', 'OPTIONS');
  }

  return [...new Set(methods)];
}

function detectAuthRequirement(sourceCode: string): boolean {
  return (
    sourceCode.includes('Authorization') ||
    sourceCode.includes('auth.getUser') ||
    sourceCode.includes('verifyJwt') ||
    sourceCode.includes('authHeader') ||
    sourceCode.includes('supabaseClient.auth')
  );
}

function detectCorsConfiguration(sourceCode: string): boolean {
  return (
    sourceCode.includes('corsHeaders') ||
    sourceCode.includes('Access-Control-Allow-Origin') ||
    sourceCode.includes('_shared/cors')
  );
}

// ============================================================================
// Function Testing
// ============================================================================

async function testEdgeFunction(func: DiscoveredEdgeFunction): Promise<EdgeFunctionTestResult> {
  const result: EdgeFunctionTestResult = {
    function: func,
    timestamp: new Date(),
    reachable: false,
    status: 'unreachable',
    issues: [],
  };

  // Add issues from source analysis
  if (func.sourceAnalysis.hasTodo) {
    func.sourceAnalysis.todoComments.forEach((todo) => {
      result.issues.push(
        createIssue('incomplete', 'medium', `TODO: ${todo}`, func.name, {
          sourceFile: path.join(func.path, 'index.ts'),
        }),
      );
    });
  }

  if (func.sourceAnalysis.hasIncompleteHandlers) {
    func.sourceAnalysis.incompleteHandlers.forEach((issue) => {
      result.issues.push(
        createIssue('incomplete', 'high', `Incomplete handler: ${issue}`, func.name, {
          sourceFile: path.join(func.path, 'index.ts'),
        }),
      );
    });
  }

  if (!func.hasCors) {
    result.issues.push(
      createIssue('cors', 'medium', 'No CORS configuration detected', func.name, {
        sourceFile: path.join(func.path, 'index.ts'),
        suggestedFix: 'Import corsHeaders from _shared/cors.ts and include in all responses',
      }),
    );
  }

  // Test 1: CORS preflight
  try {
    const corsResponse = await fetch(func.endpoint, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type, authorization',
      },
    });

    result.corsHeaders = {};
    corsResponse.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('access-control')) {
        result.corsHeaders![key] = value;
      }
    });

    // Validate CORS headers
    if (!result.corsHeaders['access-control-allow-origin']) {
      result.issues.push(
        createIssue('cors', 'high', 'Missing Access-Control-Allow-Origin header', func.name),
      );
    }
  } catch (error) {
    result.issues.push(
      createIssue(
        'cors',
        'medium',
        `CORS preflight failed: ${(error as Error).message}`,
        func.name,
      ),
    );
  }

  // Test 2: Without auth
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(func.endpoint, {
      method: func.methods.includes('POST') ? 'POST' : func.methods[0],
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: func.methods[0] !== 'GET' ? JSON.stringify({}) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    result.reachable = true;
    result.statusCode = response.status;
    result.responseTime = responseTime;

    result.authTest = {
      withoutAuth: {
        status: response.status,
      },
    };

    // Check for expected auth behavior
    if (func.requiresAuth && response.status !== 401 && response.status !== 403) {
      result.issues.push(
        createIssue(
          'auth',
          'critical',
          `Function accessible without auth (got ${response.status})`,
          func.name,
          { sourceFile: path.join(func.path, 'index.ts') },
        ),
      );
    }
  } catch (error) {
    result.authTest = {
      withoutAuth: {
        status: 0,
        error: (error as Error).message,
      },
    };
  }

  // Test 3: With auth (if service key available)
  if (SUPABASE_SERVICE_KEY && func.requiresAuth) {
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

      const response = await fetch(func.endpoint, {
        method: func.methods.includes('POST') ? 'POST' : func.methods[0],
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: func.methods[0] !== 'GET' ? JSON.stringify({}) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      result.reachable = true;
      result.statusCode = response.status;
      result.responseTime = responseTime;

      result.authTest!.withAuth = {
        status: response.status,
      };

      // Check for server errors with valid auth
      if (response.status >= 500) {
        result.issues.push(
          createIssue(
            'security',
            'high',
            `Server error with valid auth: ${response.status}`,
            func.name,
          ),
        );
      }
    } catch (error) {
      result.authTest!.withAuth = {
        status: 0,
        error: (error as Error).message,
      };
    }
  }

  // Determine overall status
  if (!result.reachable) {
    result.status = 'unreachable';
  } else if (result.issues.some((i) => i.severity === 'critical' || i.severity === 'high')) {
    result.status = 'failing';
  } else if (func.sourceAnalysis.hasIncompleteHandlers || func.sourceAnalysis.hasTodo) {
    result.status = 'incomplete';
  } else {
    result.status = 'healthy';
  }

  return result;
}

// ============================================================================
// Main Audit Logic
// ============================================================================

async function runAudit(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              EDGE FUNCTION AUDIT                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  // Step 1: Discover all edge functions
  console.log('📂 Discovering Edge Functions...\n');
  const functions = discoverEdgeFunctions();

  console.log(`   Total functions discovered: ${functions.length}`);
  console.log(`   Requiring auth: ${functions.filter((f) => f.requiresAuth).length}`);
  console.log(`   With CORS: ${functions.filter((f) => f.hasCors).length}`);
  console.log(`   With TODOs: ${functions.filter((f) => f.sourceAnalysis.hasTodo).length}`);
  console.log(
    `   Incomplete: ${functions.filter((f) => f.sourceAnalysis.hasIncompleteHandlers).length}\n`,
  );

  // Step 2: Test each function
  console.log(`🧪 Testing ${functions.length} edge functions...\n`);

  const results: EdgeFunctionTestResult[] = [];
  const allIssues: AuditIssue[] = [];
  let healthy = 0;
  let failing = 0;
  let incomplete = 0;
  let unreachable = 0;

  for (let i = 0; i < functions.length; i++) {
    const func = functions[i];
    const progress = (((i + 1) / functions.length) * 100).toFixed(0);

    process.stdout.write(
      `\r   Progress: [${progress.padStart(3)}%] ${func.name.substring(0, 40).padEnd(40)}...`,
    );

    const result = await testEdgeFunction(func);
    results.push(result);
    allIssues.push(...result.issues);

    switch (result.status) {
      case 'healthy':
        healthy++;
        break;
      case 'failing':
        failing++;
        break;
      case 'incomplete':
        incomplete++;
        break;
      case 'unreachable':
        unreachable++;
        break;
    }

    if (verbose) {
      console.log(`\n   [${result.status}] ${func.name}`);
      result.issues.forEach((issue) => console.log(`      - ${issue.message}`));
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log('\n');

  // Step 3: Generate report
  const duration = Date.now() - startTime;

  const report: AuditReport = {
    type: 'edge-functions',
    timestamp: new Date(),
    duration,
    summary: {
      total: functions.length,
      passed: healthy,
      failed: failing,
      warnings: incomplete,
      skipped: unreachable,
    },
    issues: allIssues,
    data: {
      functions: results,
      config: {
        edgeFunctionsUrl: EDGE_FUNCTIONS_URL,
        timeout: TIMEOUT,
      },
    },
  };

  const { jsonPath, mdPath } = generateReport(report);

  // Step 4: Print summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT COMPLETE                          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Functions Tested:    ${String(functions.length).padStart(35)} ║`);
  console.log(`║  Healthy:             ${String(healthy).padStart(35)} ║`);
  console.log(`║  Failing:             ${String(failing).padStart(35)} ║`);
  console.log(`║  Incomplete:          ${String(incomplete).padStart(35)} ║`);
  console.log(`║  Unreachable:         ${String(unreachable).padStart(35)} ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Duration:            ${formatDuration(duration).padStart(35)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Print issue summary
  const criticalIssues = allIssues.filter((i) => i.severity === 'critical');
  const highIssues = allIssues.filter((i) => i.severity === 'high');
  const todoCount = allIssues.filter((i) => i.message.startsWith('TODO:')).length;

  if (criticalIssues.length > 0) {
    console.log(`🔴 Critical Issues: ${criticalIssues.length}`);
    criticalIssues.slice(0, 5).forEach((i) => console.log(`   - ${i.message} (${i.resource})`));
  }

  if (highIssues.length > 0) {
    console.log(`🟠 High Issues: ${highIssues.length}`);
    highIssues.slice(0, 5).forEach((i) => console.log(`   - ${i.message} (${i.resource})`));
  }

  if (todoCount > 0) {
    console.log(`📝 TODO Items: ${todoCount}`);
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
