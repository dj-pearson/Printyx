#!/usr/bin/env tsx
/**
 * Data Transformation Linter
 *
 * Scans the codebase for common data transformation issues:
 * 1. useQuery without queryFn (no transformation)
 * 2. Accessing snake_case properties directly
 * 3. Missing camelCase transformations
 *
 * Usage: tsx tools/data-transformation-linter.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface Issue {
  file: string;
  line: number;
  type: 'missing_query_fn' | 'snake_case_access' | 'missing_transformation';
  severity: 'error' | 'warning' | 'info';
  message: string;
  context: string;
  suggestion?: string;
}

const issues: Issue[] = [];

// Patterns to detect
const PATTERNS = {
  // useQuery without queryFn
  USE_QUERY_WITHOUT_FN: /useQuery\s*<[^>]*>\s*\(\s*\{[^}]*queryKey[^}]*\}\s*\)/g,

  // Direct access to snake_case properties (common DB fields)
  SNAKE_CASE_ACCESS:
    /\.(first_name|last_name|is_primary_contact|company_id|tenant_id|created_at|updated_at|business_name|primary_contact)/g,

  // API endpoints that should have transformations
  API_ENDPOINTS: /['"`]\/api\/(companies|customers|contacts|business-records|company-contacts)/g,
};

// Known safe patterns (already transformed)
const SAFE_PATTERNS = [/queryFn:\s*async/, /map\(\s*\([^)]*\)\s*=>\s*\{/, /\.map\(\s*\(c:\s*any\)/];

async function scanFile(filePath: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Check for useQuery without queryFn
  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Pattern 1: useQuery without queryFn
    if (line.includes('useQuery') && !line.includes('queryFn')) {
      // Check if next few lines have queryFn
      const nextLines = lines.slice(index, index + 10).join('\n');
      const hasSafePattern = SAFE_PATTERNS.some((pattern) => pattern.test(nextLines));

      if (!hasSafePattern && nextLines.includes('queryKey') && nextLines.includes('/api/')) {
        // Extract the API endpoint
        const apiMatch = nextLines.match(/['"`](\/api\/[^'"`]+)['"`]/);
        const endpoint = apiMatch ? apiMatch[1] : 'unknown';

        issues.push({
          file: filePath,
          line: lineNum,
          type: 'missing_query_fn',
          severity: 'error',
          message: `useQuery without queryFn - data transformation likely missing`,
          context: line.trim(),
          suggestion: `Add queryFn with snake_case to camelCase transformation for ${endpoint}`,
        });
      }
    }

    // Pattern 2: Direct snake_case access (not in comments or strings that are SQL)
    if (!line.trim().startsWith('//') && !line.includes('from(') && !line.includes('.eq(')) {
      const matches = line.matchAll(PATTERNS.SNAKE_CASE_ACCESS);
      for (const match of matches) {
        if (match.index !== undefined) {
          issues.push({
            file: filePath,
            line: lineNum,
            type: 'snake_case_access',
            severity: 'warning',
            message: `Direct access to snake_case property: ${match[1]}`,
            context: line.trim(),
            suggestion: `Use camelCase property instead: ${toCamelCase(match[1])}`,
          });
        }
      }
    }
  });
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

async function main() {
  console.log('🔍 Scanning codebase for data transformation issues...\n');

  // Scan client-side files
  const files = await glob('client/src/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/*.test.*'],
  });

  for (const file of files) {
    await scanFile(file);
  }

  // Group issues by type
  const grouped = issues.reduce(
    (acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    },
    {} as Record<string, Issue[]>,
  );

  // Report results
  console.log('📊 Results:\n');
  console.log(`Total issues found: ${issues.length}\n`);

  Object.entries(grouped).forEach(([type, typeIssues]) => {
    const emoji = typeIssues[0].severity === 'error' ? '❌' : '⚠️';
    console.log(`${emoji} ${type.replace(/_/g, ' ').toUpperCase()}: ${typeIssues.length} issues`);
  });

  console.log('\n' + '='.repeat(80) + '\n');

  // Detailed report
  Object.entries(grouped).forEach(([type, typeIssues]) => {
    console.log(`\n### ${type.replace(/_/g, ' ').toUpperCase()}\n`);

    typeIssues.slice(0, 10).forEach((issue) => {
      console.log(
        `${issue.severity === 'error' ? '❌' : '⚠️'} ${path.relative(process.cwd(), issue.file)}:${issue.line}`,
      );
      console.log(`   ${issue.message}`);
      console.log(`   Context: ${issue.context.substring(0, 80)}...`);
      if (issue.suggestion) {
        console.log(`   💡 Suggestion: ${issue.suggestion}`);
      }
      console.log('');
    });

    if (typeIssues.length > 10) {
      console.log(`   ... and ${typeIssues.length - 10} more\n`);
    }
  });

  // Write detailed report to file
  const reportPath = 'tools/data-transformation-report.json';
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalIssues: issues.length,
        issues: issues,
        summary: Object.entries(grouped).map(([type, typeIssues]) => ({
          type,
          count: typeIssues.length,
          severity: typeIssues[0].severity,
        })),
      },
      null,
      2,
    ),
  );

  console.log(`\n📄 Detailed report written to: ${reportPath}`);

  // Exit with error code if critical issues found
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    console.log(`\n❌ Found ${errors.length} critical issues that need fixing`);
    process.exit(1);
  } else {
    console.log('\n✅ No critical issues found');
  }
}

main().catch(console.error);
