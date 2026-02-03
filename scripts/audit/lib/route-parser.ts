/**
 * Route Parser
 * Parses Express route files to discover all API endpoints
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DiscoveredEndpoint } from './types';

// ============================================================================
// Route Pattern Definitions
// ============================================================================

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const ROUTE_PATTERNS = [
  // app.get('/path', handler)
  /\b(app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  // router.route('/path').get(handler)
  /\.route\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.(get|post|put|patch|delete)/gi,
];

const AUTH_MIDDLEWARE = [
  'requireAuth',
  'requireSupabaseAuth',
  'protectedRoute',
  'platformAdminRoute',
  'requirePermission',
  'authenticateToken',
  'verifyToken',
];

const RBAC_MIDDLEWARE = ['requirePermission', 'checkPermission', 'hasPermission', 'rbacMiddleware'];

// ============================================================================
// Route Parser Functions
// ============================================================================

export function parseRouteFile(filePath: string): DiscoveredEndpoint[] {
  const endpoints: DiscoveredEndpoint[] = [];

  if (!fs.existsSync(filePath)) {
    return endpoints;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Track registered base paths
  let basePath = '';
  const useRouterMatch = content.match(/app\.use\s*\(\s*['"`]([^'"`]+)['"`]/);
  if (useRouterMatch) {
    basePath = useRouterMatch[1];
  }

  // Parse each line for route definitions
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    for (const method of HTTP_METHODS) {
      // Pattern 1: app.get('/path', ...)
      const pattern1 = new RegExp(
        `\\b(app|router)\\.${method}\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`,
        'i',
      );
      const match1 = line.match(pattern1);

      if (match1) {
        const routePath = match1[2];
        const fullPath = routePath.startsWith('/api') ? routePath : `/api${basePath}${routePath}`;

        // Get the rest of the line and next few lines for middleware detection
        const contextLines = lines.slice(i, Math.min(i + 5, lines.length)).join('\n');

        const endpoint = createEndpoint(
          method.toUpperCase() as DiscoveredEndpoint['method'],
          fullPath,
          filePath,
          lineNumber,
          contextLines,
        );

        endpoints.push(endpoint);
      }
    }
  }

  return endpoints;
}

function createEndpoint(
  method: DiscoveredEndpoint['method'],
  path: string,
  sourceFile: string,
  lineNumber: number,
  context: string,
): DiscoveredEndpoint {
  const middleware = extractMiddleware(context);
  const requiresAuth = middleware.some((m) => AUTH_MIDDLEWARE.some((auth) => m.includes(auth)));
  const permissions = extractPermissions(context);

  return {
    method,
    path: normalizePath(path),
    sourceFile,
    lineNumber,
    requiresAuth,
    permissions,
    middleware,
    handlerName: extractHandlerName(context),
  };
}

function extractMiddleware(context: string): string[] {
  const middleware: string[] = [];

  // Match middleware in route definition
  // e.g., app.get('/path', requireAuth, requirePermission(['perm']), handler)
  const middlewarePattern = /,\s*(\w+)(?:\s*\([^)]*\))?(?=\s*,|\s*\)|\s*async|\s*\()/g;
  let match;

  while ((match = middlewarePattern.exec(context)) !== null) {
    const name = match[1];
    if (name !== 'async' && name !== 'req' && name !== 'res' && name !== 'next') {
      middleware.push(name);
    }
  }

  return middleware;
}

function extractPermissions(context: string): string[] {
  const permissions: string[] = [];

  // Match requirePermission(['sales.lead.view_own', 'sales.lead.view_team'])
  const permPattern = /requirePermission\s*\(\s*\[([^\]]+)\]/g;
  let match;

  while ((match = permPattern.exec(context)) !== null) {
    const perms = match[1].match(/['"`]([^'"`]+)['"`]/g);
    if (perms) {
      perms.forEach((p) => permissions.push(p.replace(/['"`]/g, '')));
    }
  }

  return permissions;
}

function extractHandlerName(context: string): string | undefined {
  // Try to extract handler function name
  const handlerPattern = /(?:async\s+)?(?:function\s+)?(\w+)\s*\(\s*req\s*,\s*res/;
  const match = context.match(handlerPattern);
  return match ? match[1] : undefined;
}

function normalizePath(path: string): string {
  // Normalize path
  return path
    .replace(/\/+/g, '/') // Remove duplicate slashes
    .replace(/\/$/, ''); // Remove trailing slash
}

// ============================================================================
// Directory Scanner
// ============================================================================

export function discoverAllRoutes(serverDir: string): DiscoveredEndpoint[] {
  const endpoints: DiscoveredEndpoint[] = [];
  const routeFiles: string[] = [];

  // Find all route files
  function scanDir(dir: string): void {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        // Skip node_modules and tests
        if (item.name !== 'node_modules' && item.name !== 'tests' && item.name !== '__tests__') {
          scanDir(fullPath);
        }
      } else if (item.isFile()) {
        // Match route files
        if (
          item.name.endsWith('.ts') &&
          (item.name.includes('route') || item.name === 'index.ts')
        ) {
          routeFiles.push(fullPath);
        }
      }
    }
  }

  scanDir(serverDir);

  // Parse each route file
  for (const file of routeFiles) {
    const fileEndpoints = parseRouteFile(file);
    endpoints.push(...fileEndpoints);
  }

  // Deduplicate by method + path
  const seen = new Set<string>();
  return endpoints.filter((e) => {
    const key = `${e.method}:${e.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================================================
// Exports
// ============================================================================

export function getRouteStats(endpoints: DiscoveredEndpoint[]): {
  total: number;
  byMethod: Record<string, number>;
  authRequired: number;
  withPermissions: number;
  bySourceFile: Record<string, number>;
} {
  const byMethod: Record<string, number> = {};
  const bySourceFile: Record<string, number> = {};
  let authRequired = 0;
  let withPermissions = 0;

  for (const e of endpoints) {
    byMethod[e.method] = (byMethod[e.method] || 0) + 1;

    const fileName = path.basename(e.sourceFile);
    bySourceFile[fileName] = (bySourceFile[fileName] || 0) + 1;

    if (e.requiresAuth) authRequired++;
    if (e.permissions && e.permissions.length > 0) withPermissions++;
  }

  return {
    total: endpoints.length,
    byMethod,
    authRequired,
    withPermissions,
    bySourceFile,
  };
}

export default {
  parseRouteFile,
  discoverAllRoutes,
  getRouteStats,
};
