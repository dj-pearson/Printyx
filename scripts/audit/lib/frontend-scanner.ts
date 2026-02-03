/**
 * Frontend Scanner
 * Scans frontend source files to discover all API calls
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FrontendApiCall } from './types';

// ============================================================================
// API Call Patterns
// ============================================================================

const API_CALL_PATTERNS = [
  // fetch('/api/...') or fetch(`/api/...`)
  /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
  /fetch\s*\(\s*`([^`]+)`/g,

  // axios.get('/api/...'), axios.post, etc.
  /axios\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g,
  /axios\.(get|post|put|patch|delete)\s*\(\s*`([^`]+)`/g,

  // apiRequest('/api/...')
  /apiRequest\s*\(\s*['"`]([^'"`]+)['"`]/g,
  /apiRequest\s*\(\s*`([^`]+)`/g,

  // queryClient patterns - useQuery, useMutation
  /useQuery\s*\(\s*\{[^}]*queryFn:\s*\(\)\s*=>\s*fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
  /useQuery\s*<[^>]*>\s*\(\s*\{[^}]*queryFn:\s*\(\)\s*=>\s*fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,

  // useMutation
  /useMutation\s*\(\s*\{[^}]*mutationFn:\s*[^}]*fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,

  // queryOptions/queryKey with apiClient
  /queryKey:\s*\[['"`]([^'"`]+)['"`]/g,
];

// ============================================================================
// Scanner Functions
// ============================================================================

export function scanFile(filePath: string): FrontendApiCall[] {
  const calls: FrontendApiCall[] = [];

  if (!fs.existsSync(filePath)) {
    return calls;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for fetch calls
    const fetchMatches = extractFetchCalls(line, filePath, lineNumber);
    calls.push(...fetchMatches);

    // Check for axios calls
    const axiosMatches = extractAxiosCalls(line, filePath, lineNumber);
    calls.push(...axiosMatches);

    // Check for apiRequest calls
    const apiRequestMatches = extractApiRequestCalls(line, filePath, lineNumber);
    calls.push(...apiRequestMatches);

    // Check for TanStack Query patterns
    const queryMatches = extractQueryCalls(line, content, filePath, lineNumber);
    calls.push(...queryMatches);
  }

  return calls;
}

function extractFetchCalls(
  line: string,
  sourceFile: string,
  lineNumber: number,
): FrontendApiCall[] {
  const calls: FrontendApiCall[] = [];

  // Pattern: fetch('/api/...')
  const pattern = /fetch\s*\(\s*['"`]([^'"`]+)['"`](?:,\s*\{([^}]+)\})?/g;
  let match;

  while ((match = pattern.exec(line)) !== null) {
    const endpoint = match[1];
    const options = match[2] || '';

    // Only include /api calls
    if (endpoint.includes('/api') || endpoint.startsWith('/')) {
      const method = extractMethod(options) || 'GET';

      calls.push({
        sourceFile,
        lineNumber,
        method,
        endpoint: normalizeEndpoint(endpoint),
        type: 'direct',
      });
    }
  }

  // Pattern: fetch(`/api/...`)
  const templatePattern = /fetch\s*\(\s*`([^`]+)`(?:,\s*\{([^}]+)\})?/g;

  while ((match = templatePattern.exec(line)) !== null) {
    const endpoint = match[1];
    const options = match[2] || '';

    if (endpoint.includes('/api') || endpoint.startsWith('/')) {
      const method = extractMethod(options) || 'GET';

      calls.push({
        sourceFile,
        lineNumber,
        method,
        endpoint: normalizeEndpoint(endpoint),
        type: 'direct',
      });
    }
  }

  return calls;
}

function extractAxiosCalls(
  line: string,
  sourceFile: string,
  lineNumber: number,
): FrontendApiCall[] {
  const calls: FrontendApiCall[] = [];

  const pattern = /axios\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let match;

  while ((match = pattern.exec(line)) !== null) {
    const method = match[1].toUpperCase();
    const endpoint = match[2];

    if (endpoint.includes('/api') || endpoint.startsWith('/')) {
      calls.push({
        sourceFile,
        lineNumber,
        method,
        endpoint: normalizeEndpoint(endpoint),
        type: 'direct',
      });
    }
  }

  // Template literal version
  const templatePattern = /axios\.(get|post|put|patch|delete)\s*\(\s*`([^`]+)`/gi;

  while ((match = templatePattern.exec(line)) !== null) {
    const method = match[1].toUpperCase();
    const endpoint = match[2];

    if (endpoint.includes('/api') || endpoint.startsWith('/')) {
      calls.push({
        sourceFile,
        lineNumber,
        method,
        endpoint: normalizeEndpoint(endpoint),
        type: 'direct',
      });
    }
  }

  return calls;
}

function extractApiRequestCalls(
  line: string,
  sourceFile: string,
  lineNumber: number,
): FrontendApiCall[] {
  const calls: FrontendApiCall[] = [];

  const pattern = /apiRequest\s*\(\s*['"`]([^'"`]+)['"`](?:,\s*\{([^}]+)\})?/g;
  let match;

  while ((match = pattern.exec(line)) !== null) {
    const endpoint = match[1];
    const options = match[2] || '';
    const method = extractMethod(options) || 'GET';

    calls.push({
      sourceFile,
      lineNumber,
      method,
      endpoint: normalizeEndpoint(endpoint),
      type: 'direct',
    });
  }

  return calls;
}

function extractQueryCalls(
  line: string,
  fullContent: string,
  sourceFile: string,
  lineNumber: number,
): FrontendApiCall[] {
  const calls: FrontendApiCall[] = [];

  // Look for useQuery patterns
  if (line.includes('useQuery') || line.includes('useMutation')) {
    // Try to find the query key or fetch URL in nearby context
    const startIdx = fullContent.indexOf(line);
    const context = fullContent.substring(
      Math.max(0, startIdx - 100),
      Math.min(fullContent.length, startIdx + 500),
    );

    // Extract fetch URL from queryFn
    const fetchPattern = /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;

    while ((match = fetchPattern.exec(context)) !== null) {
      const endpoint = match[1];
      if (endpoint.includes('/api') || endpoint.startsWith('/')) {
        const isQuery = line.includes('useQuery');
        calls.push({
          sourceFile,
          lineNumber,
          method: isQuery ? 'GET' : 'POST',
          endpoint: normalizeEndpoint(endpoint),
          type: isQuery ? 'query' : 'mutation',
        });
      }
    }

    // Extract queryKey
    const keyPattern = /queryKey:\s*\[['"`]([^'"`]+)['"`]/g;
    while ((match = keyPattern.exec(context)) !== null) {
      const queryKey = match[1];
      // Query keys often match API paths
      if (queryKey.startsWith('/api') || queryKey.includes('/')) {
        calls.push({
          sourceFile,
          lineNumber,
          method: 'GET',
          endpoint: normalizeEndpoint(queryKey),
          queryKey,
          type: 'query',
        });
      }
    }
  }

  return calls;
}

function extractMethod(options: string): string | undefined {
  const methodMatch = options.match(/method:\s*['"`](\w+)['"`]/i);
  return methodMatch ? methodMatch[1].toUpperCase() : undefined;
}

function normalizeEndpoint(endpoint: string): string {
  // Replace template literals with placeholders
  let normalized = endpoint
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/\/\/+/g, '/')
    .replace(/\/$/, '');

  // Ensure it starts with /
  if (!normalized.startsWith('/') && !normalized.startsWith('http')) {
    normalized = '/' + normalized;
  }

  return normalized;
}

// ============================================================================
// Directory Scanner
// ============================================================================

export function scanFrontendDirectory(clientDir: string): FrontendApiCall[] {
  const calls: FrontendApiCall[] = [];
  const sourceFiles: string[] = [];

  function scanDir(dir: string): void {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        // Skip node_modules and build directories
        if (
          item.name !== 'node_modules' &&
          item.name !== 'dist' &&
          item.name !== 'build' &&
          item.name !== '.next'
        ) {
          scanDir(fullPath);
        }
      } else if (item.isFile()) {
        // Match TypeScript/JavaScript files
        if (item.name.endsWith('.tsx') || item.name.endsWith('.ts') || item.name.endsWith('.jsx')) {
          sourceFiles.push(fullPath);
        }
      }
    }
  }

  scanDir(clientDir);

  // Scan each file
  for (const file of sourceFiles) {
    const fileCalls = scanFile(file);
    calls.push(...fileCalls);
  }

  return calls;
}

// ============================================================================
// Analysis Functions
// ============================================================================

export function getApiCallStats(calls: FrontendApiCall[]): {
  total: number;
  byMethod: Record<string, number>;
  byType: Record<string, number>;
  uniqueEndpoints: number;
  byFile: Record<string, number>;
} {
  const byMethod: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byFile: Record<string, number> = {};
  const endpoints = new Set<string>();

  for (const call of calls) {
    byMethod[call.method] = (byMethod[call.method] || 0) + 1;
    byType[call.type] = (byType[call.type] || 0) + 1;

    const fileName = path.basename(call.sourceFile);
    byFile[fileName] = (byFile[fileName] || 0) + 1;

    endpoints.add(`${call.method}:${call.endpoint}`);
  }

  return {
    total: calls.length,
    byMethod,
    byType,
    uniqueEndpoints: endpoints.size,
    byFile,
  };
}

export function findOrphanedCalls(
  frontendCalls: FrontendApiCall[],
  backendEndpoints: Set<string>,
): FrontendApiCall[] {
  return frontendCalls.filter((call) => {
    const key = `${call.method}:${call.endpoint}`;
    // Check exact match
    if (backendEndpoints.has(key)) return false;

    // Check with parameter normalization
    const normalizedKey = key.replace(/:param/g, ':id');
    if (backendEndpoints.has(normalizedKey)) return false;

    // Check if any backend endpoint matches the pattern
    for (const be of backendEndpoints) {
      if (matchEndpointPattern(call.endpoint, be.split(':')[1])) {
        return false;
      }
    }

    return true;
  });
}

function matchEndpointPattern(frontendPath: string, backendPath: string): boolean {
  // Normalize both paths
  const feNorm = frontendPath.replace(/:param/g, '[^/]+');
  const beNorm = backendPath.replace(/:(\w+)/g, '[^/]+');

  try {
    const feRegex = new RegExp(`^${feNorm}$`);
    const beRegex = new RegExp(`^${beNorm}$`);

    return feRegex.test(backendPath) || beRegex.test(frontendPath);
  } catch {
    return frontendPath === backendPath;
  }
}

export default {
  scanFile,
  scanFrontendDirectory,
  getApiCallStats,
  findOrphanedCalls,
};
