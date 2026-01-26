#!/usr/bin/env tsx
/**
 * Schema Auto-Fixer
 *
 * Automatically fixes common schema validation issues:
 * 1. Updates NEON references to Supabase
 * 2. Suggests fixes for invalid table/column references
 * 3. Creates a backup before making changes
 *
 * Usage: npx tsx tests/schema-fixer.ts [--dry-run] [--auto]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Fix {
  file: string;
  line: number;
  oldContent: string;
  newContent: string;
  type: 'neon_reference' | 'case_mismatch' | 'deprecated_pattern';
  confidence: 'high' | 'medium' | 'low';
}

interface FixReport {
  timestamp: string;
  mode: 'dry-run' | 'auto' | 'interactive';
  filesModified: number;
  totalFixes: number;
  fixes: Fix[];
  backupPath?: string;
}

class SchemaFixer {
  private fixes: Fix[] = [];
  private dryRun: boolean;
  private auto: boolean;
  private projectRoot: string;
  private backupDir: string;

  constructor(projectRoot: string, dryRun: boolean = true, auto: boolean = false) {
    this.projectRoot = projectRoot;
    this.dryRun = dryRun;
    this.auto = auto;
    this.backupDir = path.join(
      projectRoot,
      'tests',
      'backups',
      new Date().toISOString().replace(/:/g, '-'),
    );
  }

  /**
   * Find and fix NEON references
   */
  async fixNeonReferences(): Promise<void> {
    console.log('🔍 Finding NEON references...');

    const patterns = [
      'server/**/*.ts',
      'server/**/*.js',
      'scripts/**/*.ts',
      'supabase/functions/**/*.ts',
    ];

    const files = await glob(patterns, {
      cwd: this.projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/tests/**'],
      absolute: true,
    });

    for (const file of files) {
      await this.processFileForNeonFixes(file);
    }

    console.log(
      `✅ Found ${this.fixes.filter((f) => f.type === 'neon_reference').length} NEON references`,
    );
  }

  /**
   * Process a single file for NEON fixes
   */
  private async processFileForNeonFixes(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const neonFixes = [
      {
        pattern: /@neondatabase\/serverless/g,
        replacement: '@supabase/supabase-js',
        confidence: 'high' as const,
      },
      {
        pattern: /from ['"]@neondatabase\/serverless['"]/g,
        replacement: "from 'drizzle-orm/postgres-js'",
        confidence: 'high' as const,
      },
      {
        pattern: /neon\(process\.env\.NEON_DATABASE_URL\)/g,
        replacement: 'postgres(process.env.DATABASE_URL)',
        confidence: 'high' as const,
      },
      {
        pattern: /process\.env\.NEON_DATABASE_URL/g,
        replacement: 'process.env.DATABASE_URL',
        confidence: 'high' as const,
      },
      {
        pattern: /const sql = neon\(/g,
        replacement: 'const sql = postgres(',
        confidence: 'high' as const,
      },
      {
        pattern: /import { neon }/g,
        replacement: 'import postgres',
        confidence: 'high' as const,
      },
    ];

    lines.forEach((line, index) => {
      neonFixes.forEach(({ pattern, replacement, confidence }) => {
        if (pattern.test(line)) {
          const newLine = line.replace(pattern, replacement);
          this.fixes.push({
            file: path.relative(this.projectRoot, filePath),
            line: index + 1,
            oldContent: line.trim(),
            newContent: newLine.trim(),
            type: 'neon_reference',
            confidence,
          });
        }
      });
    });
  }

  /**
   * Find and fix case mismatches
   */
  async fixCaseMismatches(): Promise<void> {
    console.log('🔍 Finding case mismatches...');

    // Common case fixes
    const caseFixes = [
      { from: 'userId', to: 'user_id', confidence: 'medium' as const },
      { from: 'tenantId', to: 'tenant_id', confidence: 'high' as const },
      { from: 'createdAt', to: 'created_at', confidence: 'medium' as const },
      { from: 'updatedAt', to: 'updated_at', confidence: 'medium' as const },
    ];

    const patterns = ['server/**/*.ts', 'supabase/functions/**/*.ts'];

    const files = await glob(patterns, {
      cwd: this.projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/tests/**'],
      absolute: true,
    });

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        caseFixes.forEach(({ from, to, confidence }) => {
          // Look for patterns like: table.userId
          const pattern = new RegExp(`\\.(${from})\\b`, 'g');
          if (pattern.test(line)) {
            const newLine = line.replace(pattern, `.${to}`);
            this.fixes.push({
              file: path.relative(this.projectRoot, file),
              line: index + 1,
              oldContent: line.trim(),
              newContent: newLine.trim(),
              type: 'case_mismatch',
              confidence,
            });
          }
        });
      });
    }

    console.log(
      `✅ Found ${this.fixes.filter((f) => f.type === 'case_mismatch').length} case mismatches`,
    );
  }

  /**
   * Create backup of files before modifying
   */
  private async createBackup(files: Set<string>): Promise<void> {
    if (this.dryRun) return;

    console.log('💾 Creating backup...');

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    for (const file of files) {
      const fullPath = path.join(this.projectRoot, file);
      const backupPath = path.join(this.backupDir, file);
      const backupDirPath = path.dirname(backupPath);

      if (!fs.existsSync(backupDirPath)) {
        fs.mkdirSync(backupDirPath, { recursive: true });
      }

      fs.copyFileSync(fullPath, backupPath);
    }

    console.log(`✅ Backup created at: ${this.backupDir}`);
  }

  /**
   * Apply fixes to files
   */
  async applyFixes(): Promise<void> {
    if (this.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
      return;
    }

    // Group fixes by file
    const fixesByFile = this.fixes.reduce(
      (acc, fix) => {
        if (!acc[fix.file]) {
          acc[fix.file] = [];
        }
        acc[fix.file].push(fix);
        return acc;
      },
      {} as Record<string, Fix[]>,
    );

    const files = new Set(Object.keys(fixesByFile));

    // Create backup
    await this.createBackup(files);

    console.log('✏️  Applying fixes...');

    // Apply fixes to each file
    for (const [file, fileFixes] of Object.entries(fixesByFile)) {
      const fullPath = path.join(this.projectRoot, file);
      let content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Sort fixes by line number (descending) to avoid offset issues
      fileFixes.sort((a, b) => b.line - a.line);

      // Apply each fix
      fileFixes.forEach((fix) => {
        if (fix.confidence === 'high' || this.auto) {
          const lineIndex = fix.line - 1;
          if (lines[lineIndex] && lines[lineIndex].includes(fix.oldContent.trim())) {
            lines[lineIndex] = lines[lineIndex].replace(
              fix.oldContent.trim(),
              fix.newContent.trim(),
            );
          }
        }
      });

      // Write modified content back
      fs.writeFileSync(fullPath, lines.join('\n'));
      console.log(`  ✅ Fixed ${file}`);
    }

    console.log(`✅ Applied ${this.fixes.length} fixes to ${files.size} files`);
  }

  /**
   * Generate fix report
   */
  generateReport(): FixReport {
    const filesModified = new Set(this.fixes.map((f) => f.file)).size;

    return {
      timestamp: new Date().toISOString(),
      mode: this.dryRun ? 'dry-run' : this.auto ? 'auto' : 'interactive',
      filesModified,
      totalFixes: this.fixes.length,
      fixes: this.fixes,
      backupPath: this.dryRun ? undefined : this.backupDir,
    };
  }
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(report: FixReport): string {
  let md = `# Schema Auto-Fix Report\n\n`;
  md += `**Generated:** ${report.timestamp}\n`;
  md += `**Mode:** ${report.mode}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Files Modified:** ${report.filesModified}\n`;
  md += `- **Total Fixes:** ${report.totalFixes}\n`;

  if (report.backupPath) {
    md += `- **Backup Location:** \`${report.backupPath}\`\n`;
  }

  md += `\n`;

  if (report.fixes.length === 0) {
    md += `## ✅ No Fixes Needed!\n\n`;
    return md;
  }

  // Group by type
  const fixesByType = report.fixes.reduce(
    (acc, fix) => {
      if (!acc[fix.type]) {
        acc[fix.type] = [];
      }
      acc[fix.type].push(fix);
      return acc;
    },
    {} as Record<string, Fix[]>,
  );

  Object.entries(fixesByType).forEach(([type, fixes]) => {
    md += `## ${type.replace(/_/g, ' ').toUpperCase()}\n\n`;
    md += `Found ${fixes.length} fix(es)\n\n`;

    // Group by file
    const fixesByFile = fixes.reduce(
      (acc, fix) => {
        if (!acc[fix.file]) {
          acc[fix.file] = [];
        }
        acc[fix.file].push(fix);
        return acc;
      },
      {} as Record<string, Fix[]>,
    );

    Object.entries(fixesByFile).forEach(([file, fileFixes]) => {
      md += `### \`${file}\`\n\n`;

      fileFixes.forEach((fix) => {
        const confidenceIcon =
          fix.confidence === 'high' ? '✅' : fix.confidence === 'medium' ? '⚠️' : 'ℹ️';
        md += `${confidenceIcon} **Line ${fix.line}** (${fix.confidence} confidence)\n\n`;
        md += `**Before:**\n\`\`\`\n${fix.oldContent}\n\`\`\`\n\n`;
        md += `**After:**\n\`\`\`\n${fix.newContent}\n\`\`\`\n\n`;
        md += `---\n\n`;
      });
    });
  });

  return md;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const auto = args.includes('--auto');

  console.log('🚀 Starting Schema Auto-Fixer...\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('   Use --apply to actually apply fixes');
    console.log('   Use --auto to apply all fixes automatically\n');
  }

  const projectRoot = path.resolve(__dirname, '..');
  const fixer = new SchemaFixer(projectRoot, dryRun, auto);

  // Find issues
  await fixer.fixNeonReferences();
  await fixer.fixCaseMismatches();

  // Apply fixes
  if (!dryRun) {
    await fixer.applyFixes();
  }

  // Generate report
  const report = fixer.generateReport();

  // Save reports
  const jsonPath = path.join(projectRoot, 'tests', 'schema-fix-report.json');
  const mdPath = path.join(projectRoot, 'tests', 'SCHEMA_FIX_REPORT.md');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, generateMarkdownReport(report));

  console.log('\n' + '='.repeat(60));
  console.log('📋 AUTO-FIX SUMMARY');
  console.log('='.repeat(60));
  console.log(`Mode:             ${report.mode}`);
  console.log(`Files Modified:   ${report.filesModified}`);
  console.log(`Total Fixes:      ${report.totalFixes}`);

  if (report.backupPath) {
    console.log(`Backup Location:  ${report.backupPath}`);
  }

  console.log('='.repeat(60));
  console.log(`\n📄 Reports saved:`);
  console.log(`  - JSON: ${jsonPath}`);
  console.log(`  - Markdown: ${mdPath}`);

  if (dryRun && report.totalFixes > 0) {
    console.log('\n💡 To apply these fixes, run:');
    console.log('   npx tsx tests/schema-fixer.ts --apply');
    console.log('\n   Or to auto-apply all fixes:');
    console.log('   npx tsx tests/schema-fixer.ts --apply --auto');
  }

  if (!dryRun && report.totalFixes > 0) {
    console.log('\n✅ Fixes applied successfully!');
    console.log('   Backup saved to:', report.backupPath);
    console.log('\n   Next steps:');
    console.log('   1. Test your application');
    console.log('   2. Run: npx tsx tests/schema-validator.ts');
    console.log('   3. Commit changes if everything works');
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
