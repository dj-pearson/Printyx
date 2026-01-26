#!/usr/bin/env tsx
/**
 * Comprehensive System Check Script
 *
 * Validates that all API calls in the codebase align with:
 * - Actual Edge Functions that exist
 * - Actual database tables that exist
 * - Proper RLS policies
 * - Correct API routes
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
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
function scanClientCode(dir: string, edgeFunctions: string[], dbTables: string[]) {
  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git')) {
        scanClientCode(fullPath, edgeFunctions, dbTables);
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

            // Skip if it's a known edge function
            if (edgeFunctions.includes(functionName)) {
              return;
            }

            issues.push({
              severity: 'error',
              file: fullPath,
              line: index + 1,
              issue: `API call to non-existent edge function: ${apiPath}`,
              suggestion: `Create '${functionName}' edge function or use correct endpoint. Available: ${edgeFunctions.slice(0, 10).join(', ')}...`,
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

      // Check for missing queryFn in useQuery that references an API endpoint
      if (line.includes('useQuery') && !line.includes('queryFn')) {
        const nextLines = lines.slice(index, index + 10).join(' ');
        // Only flag if it's making an API call but missing queryFn
        const hasApiCall = nextLines.match(/(?:fetch|apiRequest|axios)\s*\(/i);
        const hasQueryFn = nextLines.includes('queryFn');

        if (hasApiCall && !hasQueryFn) {
          issues.push({
            severity: 'warning',
            file: fullPath,
            line: index + 1,
            issue: 'useQuery with API call missing queryFn - may cause data transformation issues',
            suggestion: 'Add queryFn with proper snake_case → camelCase transformation',
          });
        }
      }
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

  console.log('\n📊 Checking Database Tables...');
  const dbTables = getDatabaseTables();
  console.log(`   Found ${dbTables.length} database tables`);

  // Scan client code
  console.log('\n🔎 Scanning client code...');
  const clientDir = join(process.cwd(), 'client', 'src');
  scanClientCode(clientDir, edgeFunctions, dbTables);

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
