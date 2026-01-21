/**
 * Auth Middleware Pattern Checker
 *
 * Detects local requireAuth definitions that should be imported from centralized locations.
 * Run with: npx tsx tools/automated-testing/check-auth-middleware.ts
 *
 * Standard Pattern:
 *   import { requireAuth } from '../replitAuth';
 *   import { requireAuth } from '../auth-setup';
 *
 * Anti-Pattern (detected):
 *   const requireAuth = (req, res, next) => { ... }
 */

import * as fs from 'fs';
import * as path from 'path';

interface Violation {
  file: string;
  line: number;
  content: string;
}

const LOCAL_REQUIREAUTH_PATTERN = /^(?:const|let|var)\s+requireAuth\s*=/;
const ALLOWED_FILES = [
  'replitAuth.ts', // Central definition
  'supabase-auth.ts', // Supabase auth export
];

function findViolations(directory: string): Violation[] {
  const violations: Violation[] = [];

  function scanDirectory(dir: string) {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        // Skip node_modules, _archived, and dist directories
        if (['node_modules', '_archived', 'dist', '.git'].includes(item.name)) {
          continue;
        }
        scanDirectory(fullPath);
      } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
        // Skip allowed files
        if (ALLOWED_FILES.includes(item.name)) {
          continue;
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (LOCAL_REQUIREAUTH_PATTERN.test(line)) {
            violations.push({
              file: fullPath,
              line: i + 1,
              content: line.substring(0, 80) + (line.length > 80 ? '...' : ''),
            });
          }
        }
      }
    }
  }

  scanDirectory(directory);
  return violations;
}

function main() {
  const serverDir = path.join(process.cwd(), 'server');

  if (!fs.existsSync(serverDir)) {
    console.error('Error: server directory not found. Run from project root.');
    process.exit(1);
  }

  console.log('Checking for local requireAuth definitions...\n');

  const violations = findViolations(serverDir);

  if (violations.length === 0) {
    console.log('✅ No local requireAuth definitions found.');
    console.log('All routes are using centralized auth middleware.\n');
    process.exit(0);
  }

  console.log(`⚠️  Found ${violations.length} local requireAuth definitions:\n`);

  for (const v of violations) {
    const relativePath = path.relative(process.cwd(), v.file);
    console.log(`  ${relativePath}:${v.line}`);
    console.log(`    ${v.content}\n`);
  }

  console.log('\n📋 To fix, replace local definitions with imports:');
  console.log('   import { requireAuth } from "../replitAuth";');
  console.log('   // or');
  console.log('   import { requireAuth } from "../auth-setup";\n');

  // Exit with error code to fail CI
  process.exit(1);
}

main();
