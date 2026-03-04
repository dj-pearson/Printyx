/**
 * SEC-001: SQL Injection Static Audit Scanner
 *
 * Scans TypeScript files for common SQL injection vulnerability patterns:
 * 1. sql.raw() with string interpolation (template literals or concatenation)
 * 2. String .replace() used to substitute SQL placeholders with values
 * 3. INTERVAL with sql.raw() interpolation
 * 4. ARRAY construction via sql.raw() with .map().join()
 *
 * Usage:
 *   npx tsx server/scripts/sql-injection-audit.ts [directory]
 *
 * Exit codes:
 *   0 - No vulnerabilities found
 *   1 - Vulnerabilities detected
 */

import * as fs from 'fs';
import * as path from 'path';

interface Finding {
  file: string;
  line: number;
  pattern: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  code: string;
  suggestion: string;
}

const PATTERNS: Array<{
  name: string;
  regex: RegExp;
  severity: Finding['severity'];
  suggestion: string;
}> = [
  {
    name: 'sql.raw with template literal interpolation',
    regex: /sql\.raw\s*\(\s*`[^`]*\$\{/,
    severity: 'CRITICAL',
    suggestion:
      'Use Drizzle sql`` tagged template instead of sql.raw() with interpolation. The sql`` template auto-parameterizes embedded values.',
  },
  {
    name: 'sql.raw with ARRAY construction via map/join',
    regex: /sql\.raw\s*\(\s*`?\s*ARRAY\s*\[/i,
    severity: 'HIGH',
    suggestion:
      'Use Drizzle parameterized arrays: sql`... = ANY(${arrayVar})` or use inArray() operator from drizzle-orm.',
  },
  {
    name: 'String .replace() for SQL parameter substitution',
    regex: /\.replace\s*\(\s*['"]\$\d+['"]/,
    severity: 'CRITICAL',
    suggestion:
      'Use Drizzle sql`` tagged template with parameterized values instead of string replacement. Example: sql`UPDATE t SET col = ${value} WHERE id = ${id}`',
  },
  {
    name: 'INTERVAL with sql.raw() interpolation',
    regex: /INTERVAL\s+'\$\{sql\.raw/,
    severity: 'MEDIUM',
    suggestion:
      "Use parameterized multiplication instead: sql`INTERVAL '1 day' * ${Number(days)}` instead of interpolating into the INTERVAL string.",
  },
  {
    name: 'INTERVAL with direct template interpolation',
    regex: /INTERVAL\s+'\$\{(?!sql)/,
    severity: 'MEDIUM',
    suggestion:
      "Use parameterized multiplication instead: sql`INTERVAL '1 day' * ${Number(days)}` to avoid SQL injection in INTERVAL expressions.",
  },
  {
    name: 'sql.raw() with string concatenation',
    regex: /sql\.raw\s*\(\s*[^`\s)]+\s*\+/,
    severity: 'CRITICAL',
    suggestion:
      'Use Drizzle sql`` tagged template instead of sql.raw() with string concatenation.',
  },
  {
    name: 'sql.raw() wrapping a variable (potential dynamic SQL)',
    regex: /sql\.raw\s*\(\s*(?:query|sqlStr|sqlString|rawSql|rawQuery)\b/,
    severity: 'HIGH',
    suggestion:
      'Avoid passing dynamic strings to sql.raw(). Use Drizzle sql`` tagged templates with parameterized values.',
  },
  {
    name: 'sql.raw(String(...)) pattern',
    regex: /sql\.raw\s*\(\s*String\s*\(/,
    severity: 'MEDIUM',
    suggestion:
      'Avoid sql.raw(String(...)). Use parameterized values within sql`` tagged templates.',
  },
];

const EXCLUDED_DIRS = ['node_modules', 'dist', '.git', 'coverage', 'attached_assets'];
const FILE_EXTENSIONS = ['.ts', '.tsx'];

function scanFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          file: filePath,
          line: lineNumber,
          pattern: pattern.name,
          severity: pattern.severity,
          code: line.trim(),
          suggestion: pattern.suggestion,
        });
      }
    }
  }

  return findings;
}

function walkDirectory(dir: string): string[] {
  const files: string[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(entry.name)) {
        files.push(...walkDirectory(fullPath));
      }
    } else if (entry.isFile() && FILE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

function formatSeverity(severity: Finding['severity']): string {
  const colors: Record<string, string> = {
    CRITICAL: '\x1b[31m', // red
    HIGH: '\x1b[33m', // yellow
    MEDIUM: '\x1b[36m', // cyan
    LOW: '\x1b[37m', // white
  };
  const reset = '\x1b[0m';
  return `${colors[severity] || ''}${severity}${reset}`;
}

function main(): void {
  const targetDir = process.argv[2] || path.resolve(process.cwd());

  console.log('==========================================================');
  console.log('  SEC-001: SQL Injection Static Audit Scanner');
  console.log('==========================================================');
  console.log(`Scanning: ${targetDir}`);
  console.log();

  const files = walkDirectory(targetDir);
  console.log(`Found ${files.length} TypeScript files to scan.\n`);

  const allFindings: Finding[] = [];

  for (const file of files) {
    const findings = scanFile(file);
    allFindings.push(...findings);
  }

  if (allFindings.length === 0) {
    console.log('\x1b[32m[PASS]\x1b[0m No SQL injection patterns detected.\n');
    process.exit(0);
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  allFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Group by file
  const byFile = new Map<string, Finding[]>();
  for (const finding of allFindings) {
    const existing = byFile.get(finding.file) || [];
    existing.push(finding);
    byFile.set(finding.file, existing);
  }

  console.log(`\x1b[31m[FAIL]\x1b[0m Found ${allFindings.length} potential SQL injection patterns:\n`);

  for (const [file, findings] of byFile) {
    const relativePath = path.relative(targetDir, file);
    console.log(`  ${relativePath}`);
    for (const finding of findings) {
      console.log(`    Line ${finding.line}: ${formatSeverity(finding.severity)} - ${finding.pattern}`);
      console.log(`      Code: ${finding.code.substring(0, 120)}`);
      console.log(`      Fix:  ${finding.suggestion}`);
      console.log();
    }
  }

  // Summary
  const critical = allFindings.filter((f) => f.severity === 'CRITICAL').length;
  const high = allFindings.filter((f) => f.severity === 'HIGH').length;
  const medium = allFindings.filter((f) => f.severity === 'MEDIUM').length;
  const low = allFindings.filter((f) => f.severity === 'LOW').length;

  console.log('----------------------------------------------------------');
  console.log('  Summary');
  console.log('----------------------------------------------------------');
  console.log(`  CRITICAL: ${critical}`);
  console.log(`  HIGH:     ${high}`);
  console.log(`  MEDIUM:   ${medium}`);
  console.log(`  LOW:      ${low}`);
  console.log(`  TOTAL:    ${allFindings.length}`);
  console.log('----------------------------------------------------------');
  console.log();

  process.exit(1);
}

main();
