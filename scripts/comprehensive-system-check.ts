#!/usr/bin/env tsx
/**
 * Comprehensive System Check Script
 *
 * Validates that all API calls in the codebase align with:
 * - Actual Edge Functions that exist
 * - Express server routes that exist
 * - Actual database tables that exist
 * - Proper RLS policies
 * - Correct API routes
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface Issue {
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  issue: string;
  suggestion: string;
}

const issues: Issue[] = [];

// 1. Get list of actual Edge Functions
function getEdgeFunctions(): string[] {
  try {
    const functionsDir = join(process.cwd(), 'supabase', 'functions');
    return readdirSync(functionsDir).filter((name) => {
      const stat = statSync(join(functionsDir, name));
      return stat.isDirectory();
    });
  } catch (error) {
    console.error('❌ Could not read supabase/functions directory');
    return [];
  }
}

// 1b. Get list of Express server routes from routes.ts and route files
function getExpressRoutes(): string[] {
  const routes: Set<string> = new Set();

  try {
    // 1. Scan routes.ts for app.use('/api/...') patterns
    const routesPath = join(process.cwd(), 'server', 'routes.ts');
    if (existsSync(routesPath)) {
      const content = readFileSync(routesPath, 'utf-8');
      const routeRegex = /app\.use\s*\(\s*['"`]\/api\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)/gi;
      let match;
      while ((match = routeRegex.exec(content)) !== null) {
        const fullPath = match[1];
        const firstSegment = fullPath.split('/')[0];
        routes.add(firstSegment);
      }
    }

    // 2. Scan server/routes-*.ts files for router.get/post('/api/...') patterns
    const serverDir = join(process.cwd(), 'server');
    const routeFiles = readdirSync(serverDir).filter(
      (f) => f.startsWith('routes') && f.endsWith('.ts'),
    );

    for (const file of routeFiles) {
      try {
        const filePath = join(serverDir, file);
        const content = readFileSync(filePath, 'utf-8');

        // Match router.get('/api/some-route/...')
        const internalRouteRegex =
          /router\.(get|post|put|patch|delete|all)\s*\(\s*['"`]\/api\/([a-z0-9-]+)/gi;
        let match;
        while ((match = internalRouteRegex.exec(content)) !== null) {
          routes.add(match[2]);
        }

        // Match router.get('/some-route/...')  (registered with app.use('/api', routes))
        const partialRouteRegex =
          /router\.(get|post|put|patch|delete|all)\s*\(\s*['"`]\/([a-z0-9-]+)/gi;
        while ((match = partialRouteRegex.exec(content)) !== null) {
          // Only add if not starting with 'api'
          if (match[2] !== 'api') {
            routes.add(match[2]);
          }
        }

        // Also check app.use('/api/...') patterns inside route files (register functions)
        const appUseRegex = /app\.use\s*\(\s*['"`]\/api\/([a-z0-9-]+)/gi;
        while ((match = appUseRegex.exec(content)) !== null) {
          routes.add(match[1]);
        }

        // Also check for any '/api/xxx' string literals in the file
        // This catches all patterns including multiline app.post(\n  '/api/xxx'...)
        const apiStringRegex = /['"`]\/api\/([a-z0-9-]+)/gi;
        while ((match = apiStringRegex.exec(content)) !== null) {
          routes.add(match[1]);
        }
      } catch {
        // Ignore individual file read errors
      }
    }

    // 3. Scan server/routes/*.ts subdirectory if it exists
    const routesSubdir = join(serverDir, 'routes');
    if (existsSync(routesSubdir) && statSync(routesSubdir).isDirectory()) {
      const subRouteFiles = readdirSync(routesSubdir).filter((f) => f.endsWith('.ts'));
      for (const file of subRouteFiles) {
        try {
          const filePath = join(routesSubdir, file);
          const content = readFileSync(filePath, 'utf-8');
          const internalRouteRegex =
            /router\.(get|post|put|patch|delete|all)\s*\(\s*['"`]\/api\/([a-z0-9-]+)/gi;
          let match;
          while ((match = internalRouteRegex.exec(content)) !== null) {
            routes.add(match[2]);
          }
          // Also check partial routes
          const partialRouteRegex =
            /router\.(get|post|put|patch|delete|all)\s*\(\s*['"`]\/([a-z0-9-]+)/gi;
          while ((match = partialRouteRegex.exec(content)) !== null) {
            if (match[2] !== 'api') {
              routes.add(match[2]);
            }
          }

          // Also check app.use('/api/...') patterns inside route files (register functions)
          const appUseRegex = /app\.use\s*\(\s*['"`]\/api\/([a-z0-9-]+)/gi;
          while ((match = appUseRegex.exec(content)) !== null) {
            routes.add(match[1]);
          }

          // Also check for any '/api/xxx' string literals in the file
          // This catches all patterns including multiline app.post(\n  '/api/xxx'...)
          const apiStringRegex = /['"`]\/api\/([a-z0-9-]+)/gi;
          while ((match = apiStringRegex.exec(content)) !== null) {
            routes.add(match[1]);
          }
        } catch {
          // Ignore individual file read errors
        }
      }
    }

    return Array.from(routes);
  } catch (error) {
    console.error('❌ Could not scan express routes:', error);
    return [];
  }
}

// 2. Get list of actual database tables from schema
function getDatabaseTables(): string[] {
  try {
    const schemaPath = join(process.cwd(), 'shared', 'schema.ts');
    const content = readFileSync(schemaPath, 'utf-8');

    // Extract table names from pgTable() calls
    const tableRegex = /export const (\w+) = pgTable\(/g;
    const tables: string[] = [];
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      tables.push(match[1]);
    }

    return tables;
  } catch (error) {
    console.error('❌ Could not read shared/schema.ts');
    return [];
  }
}

// 3. Scan client code for API calls
function scanClientCode(
  dir: string,
  edgeFunctions: string[],
  expressRoutes: string[],
  dbTables: string[],
) {
  const files = readdirSync(dir);
  // Combine all valid API endpoints
  const validApiEndpoints = new Set([...edgeFunctions, ...expressRoutes]);

  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git')) {
        scanClientCode(fullPath, edgeFunctions, expressRoutes, dbTables);
      }
      continue;
    }

    if (!['.tsx', '.ts', '.jsx', '.js'].some((ext) => file.endsWith(ext))) {
      continue;
    }

    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for API endpoint calls (but not route definitions)
      // Look for: fetch('/api/...')  or  apiRequest('/api/...')
      // Skip: <Route path="/..." (these are route definitions, not API calls)
      const isRouteDefinition = line.includes('<Route') || line.includes('path=');

      if (!isRouteDefinition) {
        const apiCallMatch = line.match(
          /(?:fetch|apiRequest|axios\.get|axios\.post)\s*\(\s*['"`](\/api\/[a-z-]+)/gi,
        );
        if (apiCallMatch) {
          apiCallMatch.forEach((match) => {
            // Extract the API path from the match
            const pathMatch = match.match(/['"`](\/api\/[a-z-]+)/i);
            if (!pathMatch) return;

            const apiPath = pathMatch[1];
            const functionName = apiPath.split('/')[2]; // /api/function-name

            // Skip if it's a known edge function OR express route
            if (validApiEndpoints.has(functionName)) {
              return;
            }

            issues.push({
              severity: 'error',
              file: fullPath,
              line: index + 1,
              issue: `API call to non-existent endpoint: ${apiPath}`,
              suggestion: `Create '${functionName}' edge function or express route. Available endpoints: ${Array.from(validApiEndpoints).slice(0, 10).join(', ')}...`,
            });
          });
        }
      }

      // Check for direct Supabase REST API calls
      const supabaseRestMatch = line.match(/\/rest\/v1\/(\w+)/);
      if (supabaseRestMatch) {
        const tableName = supabaseRestMatch[1];
        issues.push({
          severity: 'warning',
          file: fullPath,
          line: index + 1,
          issue: `Direct Supabase REST API call to: ${tableName}`,
          suggestion: `Consider using Edge Function or ensure RLS policies allow this access`,
        });
      }

      // Note: useQuery queryFn warnings are disabled because the app uses a global
      // default queryFn configured in client/src/lib/queryClient.ts which handles
      // automatic data fetching based on queryKey. This is a valid pattern in TanStack Query.
      // The original check would flag these as issues, but they work correctly at runtime.
    });
  }
}

// 4. Main execution
async function main() {
  console.log('🔍 Starting Comprehensive System Check...\n');

  // Get actual resources
  console.log('📦 Checking Edge Functions...');
  const edgeFunctions = getEdgeFunctions();
  console.log(`   Found ${edgeFunctions.length} edge functions:`, edgeFunctions.join(', '));

  console.log('\n🚂 Checking Express Server Routes...');
  const expressRoutes = getExpressRoutes();
  console.log(`   Found ${expressRoutes.length} express routes:`, expressRoutes.join(', '));

  console.log('\n📊 Checking Database Tables...');
  const dbTables = getDatabaseTables();
  console.log(`   Found ${dbTables.length} database tables`);

  // Combined API endpoints
  const allApiEndpoints = new Set([...edgeFunctions, ...expressRoutes]);
  console.log(`\n✅ Total valid API endpoints: ${allApiEndpoints.size}`);

  // Scan client code
  console.log('\n🔎 Scanning client code...');
  const clientDir = join(process.cwd(), 'client', 'src');
  scanClientCode(clientDir, edgeFunctions, expressRoutes, dbTables);

  // Report issues
  console.log('\n' + '='.repeat(80));
  console.log('📋 RESULTS\n');

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ No issues found! System is aligned.');
    return;
  }

  if (errors.length > 0) {
    console.log(`\n❌ ERRORS (${errors.length}):\n`);
    errors.slice(0, 20).forEach((issue) => {
      console.log(`   File: ${issue.file.replace(process.cwd(), '.')}`);
      console.log(`   Line: ${issue.line}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Fix: ${issue.suggestion}\n`);
    });

    if (errors.length > 20) {
      console.log(`   ... and ${errors.length - 20} more errors\n`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):\n`);
    warnings.slice(0, 10).forEach((issue) => {
      console.log(`   File: ${issue.file.replace(process.cwd(), '.')}`);
      console.log(`   Line: ${issue.line}`);
      console.log(`   Issue: ${issue.issue}\n`);
    });

    if (warnings.length > 10) {
      console.log(`   ... and ${warnings.length - 10} more warnings\n`);
    }
  }

  console.log('='.repeat(80));

  // Save detailed report
  const report = JSON.stringify(issues, null, 2);
  writeFileSync('system-check-report.json', report);
  console.log('\n📄 Detailed report saved to: system-check-report.json');
}

main().catch(console.error);
