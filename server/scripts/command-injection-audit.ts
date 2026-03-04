/**
 * SEC-005: Command Injection Audit Scanner
 *
 * Scans the codebase for patterns that may indicate command injection risks:
 * - child_process.exec/execSync with template literals
 * - shell: true in spawn options
 * - eval(), new Function(), vm.runIn* with user input
 *
 * Outputs results in structured JSON format.
 */

import * as fs from 'fs';
import * as path from 'path';

interface AuditFinding {
  file: string;
  line: number;
  pattern: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  snippet: string;
}

interface AuditResult {
  scanDate: string;
  totalFilesScanned: number;
  totalFindings: number;
  findings: AuditFinding[];
  summary: Record<string, number>;
}

// Patterns to detect potential command injection vulnerabilities
const PATTERNS: Array<{
  name: string;
  regex: RegExp;
  severity: AuditFinding['severity'];
  description: string;
}> = [
  {
    name: 'exec-template-literal',
    regex: /\bexec\s*\(\s*`/,
    severity: 'critical',
    description: 'child_process.exec() called with template literal - potential command injection',
  },
  {
    name: 'execSync-template-literal',
    regex: /\bexecSync\s*\(\s*`/,
    severity: 'critical',
    description: 'child_process.execSync() called with template literal - potential command injection',
  },
  {
    name: 'exec-string-concat',
    regex: /\bexec\s*\(\s*[a-zA-Z_$][\w$]*\s*\+/,
    severity: 'high',
    description: 'child_process.exec() called with string concatenation - potential command injection',
  },
  {
    name: 'execSync-string-concat',
    regex: /\bexecSync\s*\(\s*[a-zA-Z_$][\w$]*\s*\+/,
    severity: 'high',
    description: 'child_process.execSync() called with string concatenation - potential command injection',
  },
  {
    name: 'spawn-shell-true',
    regex: /shell\s*:\s*true/,
    severity: 'high',
    description: 'spawn/spawnSync called with shell: true - enables shell interpretation',
  },
  {
    name: 'eval-call',
    regex: /\beval\s*\(/,
    severity: 'critical',
    description: 'eval() usage detected - potential code injection',
  },
  {
    name: 'new-function',
    regex: /new\s+Function\s*\(/,
    severity: 'critical',
    description: 'new Function() usage detected - potential code injection',
  },
  {
    name: 'vm-runInContext',
    regex: /\bvm\s*\.\s*runIn(NewContext|ThisContext|Context)\s*\(/,
    severity: 'high',
    description: 'vm.runIn*() usage detected - potential code execution with user input',
  },
  {
    name: 'vm-compileFunction',
    regex: /\bvm\s*\.\s*compileFunction\s*\(/,
    severity: 'high',
    description: 'vm.compileFunction() usage detected - potential code execution',
  },
  {
    name: 'exec-variable',
    regex: /\bexec\s*\(\s*[a-zA-Z_$][\w$.]*\s*[,)]/,
    severity: 'medium',
    description: 'child_process.exec() called with variable argument - review for user input',
  },
];

// File extensions to scan
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// Directories to skip
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '.next']);

function getAllFiles(dirPath: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function scanFile(filePath: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment lines
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          file: filePath,
          line: i + 1,
          pattern: pattern.name,
          severity: pattern.severity,
          description: pattern.description,
          snippet: line.trim().substring(0, 200),
        });
      }
    }
  }

  return findings;
}

export function runAudit(rootDir: string): AuditResult {
  const files = getAllFiles(rootDir);
  const allFindings: AuditFinding[] = [];

  for (const file of files) {
    try {
      const findings = scanFile(file);
      allFindings.push(...findings);
    } catch {
      // Skip files that can't be read
    }
  }

  // Build severity summary
  const summary: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const finding of allFindings) {
    summary[finding.severity]++;
  }

  return {
    scanDate: new Date().toISOString(),
    totalFilesScanned: files.length,
    totalFindings: allFindings.length,
    findings: allFindings,
    summary,
  };
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const rootDir = process.argv[2] || path.resolve(__dirname, '../..');
  const result = runAudit(rootDir);
  console.log(JSON.stringify(result, null, 2));

  if (result.totalFindings > 0) {
    console.error(
      `\nFound ${result.totalFindings} potential command injection risks ` +
        `(${result.summary.critical} critical, ${result.summary.high} high, ` +
        `${result.summary.medium} medium, ${result.summary.low} low)`
    );
  } else {
    console.error('\nNo command injection risks found.');
  }
}
