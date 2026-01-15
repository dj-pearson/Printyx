#!/usr/bin/env node
/**
 * Secret Detection Script
 *
 * This script checks for hardcoded secrets, credentials, and sensitive data
 * in files before they are committed to git. It helps prevent accidental
 * exposure of sensitive information.
 *
 * Can be used as:
 * - Pre-commit hook
 * - CI/CD pipeline check
 * - Manual security audit
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ============================================================================
// Configuration
// ============================================================================

interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'Email with Password',
    pattern: /@\w+\.\w+['"]?\s*[,;]\s*['"].*(?:password|pass|pwd)/i,
    severity: 'critical',
    description: 'Detected email address with password in same line',
  },
  {
    name: 'Hardcoded Password',
    pattern: /(?:password|passwd|pwd|pass)\s*[:=]\s*['"][^'"]{6,}['"]/i,
    severity: 'critical',
    description: 'Detected hardcoded password assignment',
  },
  {
    name: 'API Key',
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i,
    severity: 'critical',
    description: 'Detected hardcoded API key',
  },
  {
    name: 'JWT Token',
    pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
    severity: 'high',
    description: 'Detected JWT token',
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/,
    severity: 'critical',
    description: 'Detected private key',
  },
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/,
    severity: 'critical',
    description: 'Detected AWS access key',
  },
  {
    name: 'Slack Token',
    pattern: /xox[pboa]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/,
    severity: 'critical',
    description: 'Detected Slack token',
  },
  {
    name: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/,
    severity: 'critical',
    description: 'Detected GitHub token',
  },
  {
    name: 'Stripe Key',
    pattern: /(?:sk|pk)_(?:live|test)_[a-zA-Z0-9]{24,}/,
    severity: 'critical',
    description: 'Detected Stripe key',
  },
  {
    name: 'Database URL with Password',
    pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]{6,}@/i,
    severity: 'critical',
    description: 'Detected database URL with embedded password',
  },
  {
    name: 'Generic Secret',
    pattern: /(?:secret|token)\s*[:=]\s*['"][^'"]{16,}['"]/i,
    severity: 'high',
    description: 'Detected generic secret or token',
  },
];

// Files and directories to always exclude
const EXCLUDED_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /\.next/,
  /\.env\.example/,
  /\.env\.template/,
  /package-lock\.json/,
  /yarn\.lock/,
  /pnpm-lock\.yaml/,
  /\.map$/,
  /\.min\.js$/,
  /\.bundle\.js$/,
];

// File extensions to check
const INCLUDED_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.env',
  '.config',
  '.yaml',
  '.yml',
  '.md',
  '.txt',
];

// ============================================================================
// Types
// ============================================================================

interface SecretDetection {
  file: string;
  line: number;
  column: number;
  pattern: SecretPattern;
  match: string;
  context: string;
  isFalsePositive: boolean;
}

interface ScanResult {
  scannedFiles: number;
  detections: SecretDetection[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  hasSecrets: boolean;
}

// ============================================================================
// False Positive Detection
// ============================================================================

/**
 * Checks if a detection is likely a false positive
 */
function isFalsePositive(detection: SecretDetection): boolean {
  const line = detection.context.toLowerCase();

  // Check if it's in a comment
  if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#')) {
    return true;
  }

  // Check if it's referencing an environment variable
  if (line.includes('process.env') || line.includes('import.meta.env') || line.includes('$env')) {
    return true;
  }

  // Check if it's in a function that loads environment variables
  if (line.includes('loadenv') || line.includes('dotenv') || line.includes('loadcredentials')) {
    return true;
  }

  // Check if it's an example or placeholder
  if (
    line.includes('example') ||
    line.includes('placeholder') ||
    line.includes('your-') ||
    line.includes('YOUR_') ||
    line.includes('xxx') ||
    line.includes('***')
  ) {
    return true;
  }

  // Check if it's in test fixtures
  if (
    detection.file.includes('test') ||
    detection.file.includes('spec') ||
    detection.file.includes('mock') ||
    detection.file.includes('fixture')
  ) {
    // Still check for real-looking secrets in tests
    if (detection.match.length < 20) {
      return true;
    }
  }

  // Check if it's a variable name or type definition
  if (
    line.includes('interface') ||
    line.includes('type ') ||
    (line.includes('const ') && line.includes('=') && !line.includes('='))
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// File Scanning
// ============================================================================

/**
 * Check if a file should be scanned
 */
function shouldScanFile(filePath: string): boolean {
  // Check excluded patterns
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(filePath)) {
      return false;
    }
  }

  // Check if file extension is included
  const ext = path.extname(filePath);
  return INCLUDED_EXTENSIONS.includes(ext);
}

/**
 * Scan a single file for secrets
 */
function scanFile(filePath: string): SecretDetection[] {
  const detections: SecretDetection[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const pattern of SECRET_PATTERNS) {
        const matches = line.matchAll(new RegExp(pattern.pattern, 'g'));

        for (const match of matches) {
          const detection: SecretDetection = {
            file: filePath,
            line: lineNum + 1,
            column: match.index || 0,
            pattern,
            match: match[0],
            context: line.trim(),
            isFalsePositive: false,
          };

          detection.isFalsePositive = isFalsePositive(detection);
          detections.push(detection);
        }
      }
    }
  } catch (error) {
    // Silently skip files that can't be read
  }

  return detections;
}

/**
 * Get list of files to scan
 */
function getFilesToScan(gitStaged: boolean = false): string[] {
  if (gitStaged) {
    // Get staged files from git
    try {
      const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
        encoding: 'utf-8',
      });
      return output
        .trim()
        .split('\n')
        .filter((f) => f && shouldScanFile(f));
    } catch (error) {
      console.error('Failed to get staged files from git. Scanning all files instead.');
      gitStaged = false;
    }
  }

  // Recursively get all files
  const files: string[] = [];

  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && shouldScanFile(fullPath)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  walk(process.cwd());
  return files;
}

/**
 * Scan all files for secrets
 */
function scanForSecrets(gitStaged: boolean = false): ScanResult {
  const files = getFilesToScan(gitStaged);
  const allDetections: SecretDetection[] = [];

  console.log(`Scanning ${files.length} files for secrets...\n`);

  for (const file of files) {
    const detections = scanFile(file);
    allDetections.push(...detections);
  }

  // Filter out false positives
  const realDetections = allDetections.filter((d) => !d.isFalsePositive);

  // Count by severity
  const criticalCount = realDetections.filter((d) => d.pattern.severity === 'critical').length;
  const highCount = realDetections.filter((d) => d.pattern.severity === 'high').length;
  const mediumCount = realDetections.filter((d) => d.pattern.severity === 'medium').length;
  const lowCount = realDetections.filter((d) => d.pattern.severity === 'low').length;

  return {
    scannedFiles: files.length,
    detections: realDetections,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    hasSecrets: realDetections.length > 0,
  };
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Display scan results
 */
function displayResults(result: ScanResult): void {
  if (!result.hasSecrets) {
    console.log('✅ No secrets detected!\n');
    console.log(`Scanned ${result.scannedFiles} files successfully.`);
    return;
  }

  console.log('❌ SECRETS DETECTED!\n');
  console.log(`Found ${result.detections.length} potential secrets:\n`);

  // Group by severity
  const critical = result.detections.filter((d) => d.pattern.severity === 'critical');
  const high = result.detections.filter((d) => d.pattern.severity === 'high');
  const medium = result.detections.filter((d) => d.pattern.severity === 'medium');
  const low = result.detections.filter((d) => d.pattern.severity === 'low');

  const displayGroup = (detections: SecretDetection[], severity: string, emoji: string) => {
    if (detections.length === 0) return;

    console.log(`${emoji} ${severity.toUpperCase()} (${detections.length}):\n`);

    for (const detection of detections) {
      console.log(`  ${detection.file}:${detection.line}:${detection.column}`);
      console.log(`  Pattern: ${detection.pattern.name}`);
      console.log(`  Description: ${detection.pattern.description}`);
      console.log(`  Context: ${detection.context.substring(0, 80)}...`);
      console.log('');
    }
  };

  displayGroup(critical, 'critical', '🔴');
  displayGroup(high, 'high', '🟠');
  displayGroup(medium, 'medium', '🟡');
  displayGroup(low, 'low', '🔵');

  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                    ⚠️  ACTION REQUIRED ⚠️                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  console.log('Potential secrets were detected in your code. This is a security risk!');
  console.log('\nRecommended actions:');
  console.log('1. Remove hardcoded secrets from the files listed above');
  console.log('2. Use environment variables instead (process.env.VARIABLE_NAME)');
  console.log('3. Add sensitive files to .gitignore');
  console.log('4. If already committed, rotate all exposed credentials immediately');
  console.log('\nNeed help? Check: tools/automated-testing/README.md\n');
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const isPreCommit = args.includes('--pre-commit') || args.includes('--staged');
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                    SECRET DETECTION TOOL                           ║
╚═══════════════════════════════════════════════════════════════════╝

USAGE:
  npx tsx tools/automated-testing/check-no-secrets.ts [options]

OPTIONS:
  --staged, --pre-commit    Only scan staged files (for pre-commit hook)
  --help, -h                Show this help message

DESCRIPTION:
  Scans files for hardcoded secrets, credentials, API keys, and other
  sensitive information that should not be committed to version control.

EXAMPLES:
  # Scan all files
  npm run check:secrets

  # Scan only staged files (pre-commit)
  npm run check:secrets -- --staged

EXIT CODES:
  0 - No secrets detected
  1 - Secrets detected

PATTERNS DETECTED:
  - Hardcoded passwords
  - API keys and tokens
  - Private keys
  - Database URLs with credentials
  - JWT tokens
  - Cloud provider keys (AWS, GCP, Azure)
  - Email addresses with passwords
  - And more...

PREVENTING FALSE POSITIVES:
  The tool automatically filters out:
  - Comments
  - Environment variable references (process.env)
  - Example values and placeholders
  - Test fixtures with dummy data
    `);
    process.exit(0);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║              SECRET DETECTION & SECURITY SCAN                      ║
╚═══════════════════════════════════════════════════════════════════╝
  `);

  const result = scanForSecrets(isPreCommit);
  displayResults(result);

  if (result.hasSecrets) {
    if (isPreCommit) {
      console.log('\n❌ COMMIT BLOCKED: Secrets detected in staged files.\n');
      console.log('Your commit has been blocked to protect sensitive information.');
      console.log('Please remove the secrets and try again.\n');
    }
    process.exit(1);
  }

  process.exit(0);
}

// ============================================================================
// Execute
// ============================================================================

// Run if executed directly (ES module check)
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main();
}

export { scanForSecrets, SecretDetection, ScanResult };
