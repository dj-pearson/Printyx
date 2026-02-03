/**
 * Route Overlap Detection Script
 *
 * Finds duplicate functionality between Express routes and Edge Functions.
 * Run with: npm run audit:overlaps
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { discoverAllRoutes, getRouteStats } from './lib/route-parser';
import { generateReport, createIssue } from './lib/report-generator';
import type {
  DiscoveredEndpoint,
  DiscoveredEdgeFunction,
  AuditReport,
  AuditIssue,
} from './lib/types';

// Load environment variables
config();

// ============================================================================
// Configuration
// ============================================================================

const SERVER_DIR = path.join(process.cwd(), 'server');
const FUNCTIONS_DIR = path.join(process.cwd(), 'supabase', 'functions');

// ============================================================================
// Edge Function Discovery
// ============================================================================

function discoverEdgeFunctions(): DiscoveredEdgeFunction[] {
  const functions: DiscoveredEdgeFunction[] = [];

  if (!fs.existsSync(FUNCTIONS_DIR)) {
    return functions;
  }

  const directories = fs.readdirSync(FUNCTIONS_DIR, { withFileTypes: true });

  for (const dir of directories) {
    if (!dir.isDirectory() || dir.name.startsWith('_')) continue;

    const functionPath = path.join(FUNCTIONS_DIR, dir.name);
    const indexFile = path.join(functionPath, 'index.ts');

    if (!fs.existsSync(indexFile)) continue;

    const sourceCode = fs.readFileSync(indexFile, 'utf-8');

    functions.push({
      name: dir.name,
      path: functionPath,
      endpoint: `/functions/v1/${dir.name}`,
      methods: detectMethods(sourceCode),
      requiresAuth: detectAuthRequirement(sourceCode),
      hasCors: detectCorsConfiguration(sourceCode),
      sourceAnalysis: {
        hasTodo: false,
        todoComments: [],
        hasIncompleteHandlers: false,
        incompleteHandlers: [],
        imports: [],
        usesSupabaseClient: sourceCode.includes('createClient'),
      },
    });
  }

  return functions;
}

function detectMethods(sourceCode: string): string[] {
  const methods: string[] = [];

  if (sourceCode.includes("method === 'GET'") || sourceCode.includes('method === "GET"')) {
    methods.push('GET');
  }
  if (sourceCode.includes("method === 'POST'") || sourceCode.includes('method === "POST"')) {
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

  if (methods.length === 0) {
    methods.push('POST');
  }

  return methods;
}

function detectAuthRequirement(sourceCode: string): boolean {
  return (
    sourceCode.includes('Authorization') ||
    sourceCode.includes('auth.getUser') ||
    sourceCode.includes('verifyJwt')
  );
}

function detectCorsConfiguration(sourceCode: string): boolean {
  return sourceCode.includes('corsHeaders') || sourceCode.includes('Access-Control-Allow-Origin');
}

// ============================================================================
// Overlap Detection
// ============================================================================

interface RouteOverlap {
  resource: string;
  expressRoute: {
    method: string;
    path: string;
    sourceFile: string;
  };
  edgeFunction: {
    name: string;
    methods: string[];
    path: string;
  };
  overlapType: 'exact' | 'partial' | 'resource';
  recommendation: string;
}

function extractResourceName(path: string): string {
  // Extract resource name from path
  // /api/customers -> customers
  // /api/customers/:id -> customers
  // /functions/v1/customers -> customers

  const normalized = path
    .replace(/^\/api\//, '')
    .replace(/^\/functions\/v1\//, '')
    .replace(/\/:[^/]+/g, '')
    .replace(/\/:.*$/, '')
    .split('/')[0];

  return normalized.toLowerCase();
}

function findOverlaps(
  expressRoutes: DiscoveredEndpoint[],
  edgeFunctions: DiscoveredEdgeFunction[],
): RouteOverlap[] {
  const overlaps: RouteOverlap[] = [];

  // Build a map of Express routes by resource
  const expressByResource = new Map<string, DiscoveredEndpoint[]>();
  for (const route of expressRoutes) {
    const resource = extractResourceName(route.path);
    if (!expressByResource.has(resource)) {
      expressByResource.set(resource, []);
    }
    expressByResource.get(resource)!.push(route);
  }

  // Check each edge function for overlaps
  for (const func of edgeFunctions) {
    const funcResource = func.name.toLowerCase().replace(/-/g, '_');

    // Check for exact name match
    if (expressByResource.has(funcResource)) {
      const expressRoutes = expressByResource.get(funcResource)!;

      for (const route of expressRoutes) {
        const methodOverlap = func.methods.some((m) => m === route.method);

        if (methodOverlap) {
          overlaps.push({
            resource: funcResource,
            expressRoute: {
              method: route.method,
              path: route.path,
              sourceFile: route.sourceFile,
            },
            edgeFunction: {
              name: func.name,
              methods: func.methods,
              path: func.path,
            },
            overlapType: 'exact',
            recommendation: determineRecommendation(route, func),
          });
        } else {
          overlaps.push({
            resource: funcResource,
            expressRoute: {
              method: route.method,
              path: route.path,
              sourceFile: route.sourceFile,
            },
            edgeFunction: {
              name: func.name,
              methods: func.methods,
              path: func.path,
            },
            overlapType: 'resource',
            recommendation:
              'Consider if both implementations are needed or if one should be deprecated.',
          });
        }
      }
    }

    // Check for partial name matches (e.g., "customer" matches "customers")
    const singularResource = funcResource.replace(/s$/, '');
    const pluralResource = funcResource + 's';

    for (const [resource, routes] of expressByResource) {
      if (
        resource !== funcResource &&
        (resource === singularResource || resource === pluralResource)
      ) {
        overlaps.push({
          resource: funcResource,
          expressRoute: {
            method: routes[0].method,
            path: routes[0].path,
            sourceFile: routes[0].sourceFile,
          },
          edgeFunction: {
            name: func.name,
            methods: func.methods,
            path: func.path,
          },
          overlapType: 'partial',
          recommendation: 'Partial overlap detected. Verify if these handle the same data.',
        });
      }
    }
  }

  // Deduplicate by resource
  const seen = new Set<string>();
  return overlaps.filter((o) => {
    const key = `${o.resource}-${o.overlapType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function determineRecommendation(route: DiscoveredEndpoint, func: DiscoveredEdgeFunction): string {
  // If edge function uses Supabase client directly, recommend keeping it
  if (func.sourceAnalysis.usesSupabaseClient) {
    return 'Edge function uses Supabase client directly - consider migrating Express route to use Edge function.';
  }

  // If Express route has RBAC
  if (route.permissions && route.permissions.length > 0) {
    return 'Express route has RBAC permissions - consider adding RBAC to Edge function or deprecating it.';
  }

  return 'Consolidate to a single implementation. Edge functions recommended for Supabase-native operations.';
}

// ============================================================================
// Main Audit Logic
// ============================================================================

async function runAudit(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              ROUTE OVERLAP AUDIT                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  // Step 1: Discover Express routes
  console.log('📂 Discovering Express routes...\n');
  const expressRoutes = discoverAllRoutes(SERVER_DIR);
  const expressStats = getRouteStats(expressRoutes);

  console.log(`   Express routes: ${expressStats.total}`);
  console.log(`   By method: ${JSON.stringify(expressStats.byMethod)}\n`);

  // Step 2: Discover Edge functions
  console.log('📂 Discovering Edge Functions...\n');
  const edgeFunctions = discoverEdgeFunctions();

  console.log(`   Edge functions: ${edgeFunctions.length}\n`);

  // Step 3: Find overlaps
  console.log('🔍 Detecting overlaps...\n');
  const overlaps = findOverlaps(expressRoutes, edgeFunctions);

  const exactOverlaps = overlaps.filter((o) => o.overlapType === 'exact');
  const partialOverlaps = overlaps.filter((o) => o.overlapType === 'partial');
  const resourceOverlaps = overlaps.filter((o) => o.overlapType === 'resource');

  console.log(`   Exact overlaps: ${exactOverlaps.length}`);
  console.log(`   Partial overlaps: ${partialOverlaps.length}`);
  console.log(`   Resource overlaps: ${resourceOverlaps.length}\n`);

  // Step 4: Create issues
  const allIssues: AuditIssue[] = [];

  for (const overlap of exactOverlaps) {
    allIssues.push(
      createIssue(
        'contract',
        'high',
        `Exact overlap: ${overlap.expressRoute.method} ${overlap.expressRoute.path} and Edge function ${overlap.edgeFunction.name}`,
        overlap.resource,
        {
          sourceFile: overlap.expressRoute.sourceFile,
          suggestedFix: overlap.recommendation,
        },
      ),
    );
  }

  for (const overlap of resourceOverlaps) {
    allIssues.push(
      createIssue(
        'contract',
        'medium',
        `Resource overlap: Express routes and Edge function both handle "${overlap.resource}"`,
        overlap.resource,
        {
          suggestedFix: overlap.recommendation,
        },
      ),
    );
  }

  for (const overlap of partialOverlaps) {
    allIssues.push(
      createIssue(
        'contract',
        'low',
        `Partial overlap: "${overlap.resource}" handled by both Express and Edge functions`,
        overlap.resource,
        {
          suggestedFix: overlap.recommendation,
        },
      ),
    );
  }

  // Step 5: Generate report
  const duration = Date.now() - startTime;

  const report: AuditReport = {
    type: 'route-overlaps',
    timestamp: new Date(),
    duration,
    summary: {
      total: expressStats.total + edgeFunctions.length,
      passed: expressStats.total + edgeFunctions.length - overlaps.length,
      failed: exactOverlaps.length,
      warnings: resourceOverlaps.length + partialOverlaps.length,
      skipped: 0,
    },
    issues: allIssues,
    data: {
      expressRoutes: expressStats,
      edgeFunctions: edgeFunctions.length,
      overlaps: overlaps.map((o) => ({
        resource: o.resource,
        type: o.overlapType,
        expressRoute: o.expressRoute,
        edgeFunction: {
          name: o.edgeFunction.name,
          methods: o.edgeFunction.methods,
        },
        recommendation: o.recommendation,
      })),
    },
  };

  const { jsonPath, mdPath } = generateReport(report);

  // Step 6: Print summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT COMPLETE                          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Express Routes:      ${String(expressStats.total).padStart(35)} ║`);
  console.log(`║  Edge Functions:      ${String(edgeFunctions.length).padStart(35)} ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Exact Overlaps:      ${String(exactOverlaps.length).padStart(35)} ║`);
  console.log(`║  Resource Overlaps:   ${String(resourceOverlaps.length).padStart(35)} ║`);
  console.log(`║  Partial Overlaps:    ${String(partialOverlaps.length).padStart(35)} ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Duration:            ${formatDuration(duration).padStart(35)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Print overlap details
  if (exactOverlaps.length > 0) {
    console.log('🔴 Exact Overlaps (require attention):');
    exactOverlaps.forEach((o) => {
      console.log(`   Resource: ${o.resource}`);
      console.log(`      Express: ${o.expressRoute.method} ${o.expressRoute.path}`);
      console.log(`      Edge:    ${o.edgeFunction.name} (${o.edgeFunction.methods.join(', ')})`);
      console.log(`      Action:  ${o.recommendation}`);
      console.log('');
    });
  }

  if (verbose && resourceOverlaps.length > 0) {
    console.log('🟠 Resource Overlaps:');
    resourceOverlaps.slice(0, 10).forEach((o) => {
      console.log(
        `   ${o.resource}: Express ${o.expressRoute.method} ${o.expressRoute.path} vs Edge ${o.edgeFunction.name}`,
      );
    });
    if (resourceOverlaps.length > 10) {
      console.log(`   ... and ${resourceOverlaps.length - 10} more`);
    }
    console.log('');
  }

  console.log(`📄 Reports saved to:`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   MD:   ${mdPath}\n`);

  // Exit with error code if there are exact overlaps
  if (exactOverlaps.length > 0) {
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
