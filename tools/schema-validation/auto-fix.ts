/**
 * Auto-Fix Schema Validation Issues
 * Automatically fixes common column reference errors
 */

import * as fs from 'fs';
import * as path from 'path';

interface FixRule {
  pattern: RegExp;
  replacement: string;
  description: string;
  category: 'remove' | 'rename' | 'nested' | 'manual';
}

interface Fix {
  file: string;
  line: number;
  original: string;
  fixed: string;
  rule: string;
}

interface AutoFixResult {
  fixesApplied: Fix[];
  manualReviewNeeded: Array<{
    file: string;
    line: number;
    issue: string;
    suggestion: string;
  }>;
  filesModified: string[];
}

class AutoFixer {
  private fixRules: FixRule[] = [];
  private result: AutoFixResult = {
    fixesApplied: [],
    manualReviewNeeded: [],
    filesModified: [],
  };
  private dryRun: boolean;

  constructor(dryRun: boolean = true) {
    this.dryRun = dryRun;
    this.initializeFixRules();
  }

  /**
   * Initialize fix rules based on validation report
   */
  private initializeFixRules(): void {
    // Rule 1: Remove non-existent columns from select statements
    this.fixRules.push(
      {
        pattern: /\.select\(['"](.*?access_scope.*?)['"]=/g,
        replacement: '',
        description: 'Remove access_scope (does not exist)',
        category: 'remove',
      },
      {
        pattern: /\.select\(['"](.*?is_platform_user.*?)['"]=/g,
        replacement: '',
        description: 'Remove is_platform_user (does not exist)',
        category: 'remove',
      },
    );

    // Rule 2: Fix common column renames
    this.fixRules.push(
      {
        pattern: /(\w+)\.customer_since/g,
        replacement: '$1.companies.customer_since',
        description: 'customer_since is in companies table, not customers',
        category: 'nested',
      },
      {
        pattern: /(\w+)\.company_name/g,
        replacement: '$1.companies?.business_name',
        description: 'company_name → companies.business_name',
        category: 'nested',
      },
      {
        pattern: /(\w+)\.location_id/g,
        replacement: '$1.location',
        description: 'location_id → location',
        category: 'rename',
      },
    );

    // Rule 3: Fix metadata access (these are valid on auth.users)
    this.fixRules.push({
      pattern: /user\.user_metadata/g,
      replacement: 'user.user_metadata',
      description: 'user_metadata is valid on auth.User (skip)',
      category: 'manual',
    });
  }

  /**
   * Analyze files and determine which can be auto-fixed
   */
  async analyzeFiles(directories: string[]): Promise<void> {
    console.log('🔍 Analyzing files for auto-fixable issues...\n');

    for (const dir of directories) {
      if (fs.existsSync(dir)) {
        await this.analyzeDirectory(dir);
      }
    }

    this.printAnalysisReport();
  }

  /**
   * Analyze directory recursively
   */
  private async analyzeDirectory(dir: string): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'build', '.git', '.next'].includes(entry.name)) {
          await this.analyzeDirectory(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        await this.analyzeFile(fullPath);
      }
    }
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let modified = false;
    const newLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const originalLine = line;

      // Try to apply fix rules
      for (const rule of this.fixRules) {
        if (rule.category === 'manual') continue; // Skip manual rules

        if (rule.pattern.test(line)) {
          const fixedLine = line.replace(rule.pattern, rule.replacement);

          if (fixedLine !== line) {
            this.result.fixesApplied.push({
              file: filePath,
              line: i + 1,
              original: originalLine.trim(),
              fixed: fixedLine.trim(),
              rule: rule.description,
            });

            line = fixedLine;
            modified = true;
          }
        }
      }

      newLines.push(line);
    }

    // Write changes if not dry run
    if (modified) {
      if (!this.result.filesModified.includes(filePath)) {
        this.result.filesModified.push(filePath);
      }

      if (!this.dryRun) {
        fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
      }
    }
  }

  /**
   * Print analysis report
   */
  private printAnalysisReport(): void {
    console.log('\n📊 Auto-Fix Analysis Report\n');
    console.log(`Mode: ${this.dryRun ? '🔍 DRY RUN (no changes made)' : '✏️  APPLY FIXES'}\n`);

    if (this.result.fixesApplied.length === 0) {
      console.log('✅ No auto-fixable issues found!\n');
      return;
    }

    console.log(`🔧 Auto-fixable issues: ${this.result.fixesApplied.length}`);
    console.log(`📁 Files affected: ${this.result.filesModified.length}\n`);

    // Group by rule type
    const byRule = new Map<string, Fix[]>();
    for (const fix of this.result.fixesApplied) {
      if (!byRule.has(fix.rule)) {
        byRule.set(fix.rule, []);
      }
      byRule.get(fix.rule)!.push(fix);
    }

    console.log('📋 Fixes by Type:\n');
    for (const [rule, fixes] of byRule.entries()) {
      console.log(`  ${rule}: ${fixes.length} fixes`);
    }

    console.log('\n📝 Sample Fixes (first 10):\n');
    for (const fix of this.result.fixesApplied.slice(0, 10)) {
      const relPath = path.relative(process.cwd(), fix.file);
      console.log(`  📄 ${relPath}:${fix.line}`);
      console.log(`     ❌ ${fix.original}`);
      console.log(`     ✅ ${fix.fixed}`);
      console.log(`     💡 ${fix.rule}\n`);
    }

    if (this.result.fixesApplied.length > 10) {
      console.log(`  ... and ${this.result.fixesApplied.length - 10} more fixes\n`);
    }

    if (this.dryRun) {
      console.log('💡 Run with --apply flag to apply these fixes\n');
    } else {
      console.log('✅ Fixes applied! Please review the changes and run validation again.\n');
    }
  }

  /**
   * Get results
   */
  getResults(): AutoFixResult {
    return this.result;
  }
}

/**
 * Create intelligent fix rules from validation report
 */
async function createIntelligentFixRules(): Promise<void> {
  console.log('🧠 Creating intelligent fix rules from validation report...\n');

  // Read validation report to find patterns
  const reportPath = path.join(process.cwd(), 'tools', 'schema-validation', 'VALIDATION_REPORT.md');

  if (!fs.existsSync(reportPath)) {
    console.log('⚠️  Run generate-report.ts first to create VALIDATION_REPORT.md\n');
    return;
  }

  const report = fs.readFileSync(reportPath, 'utf-8');

  // Extract top invalid columns
  const columnSection = report.match(/## Top Invalid Columns([\s\S]*?)---/);
  if (!columnSection) return;

  const lines = columnSection[1].split('\n');
  const invalidColumns: Array<{ column: string; count: number; suggestion?: string }> = [];

  for (const line of lines) {
    const match = line.match(/\| `([^`]+)` \| (\d+) \| `?([^`|]+)?`? \|/);
    if (match) {
      invalidColumns.push({
        column: match[1],
        count: parseInt(match[2]),
        suggestion: match[3] !== '—' ? match[3] : undefined,
      });
    }
  }

  console.log('📊 Top Invalid Columns Found:\n');
  for (const col of invalidColumns.slice(0, 20)) {
    console.log(
      `  ${col.column.padEnd(30)} (${col.count} occurrences)${col.suggestion ? ` → ${col.suggestion}` : ''}`,
    );
  }

  console.log('\n💡 These need manual review because:');
  console.log('  • app_metadata & user_metadata are valid on auth.User');
  console.log('  • company_name needs nested access (companies.business_name)');
  console.log('  • Many require business logic decisions\n');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--apply');
  const showRules = args.includes('--rules');

  if (showRules) {
    await createIntelligentFixRules();
    return;
  }

  console.log('🔧 Schema Auto-Fix Tool\n');

  const fixer = new AutoFixer(isDryRun);

  // Directories to fix
  const directoriesToFix = [
    path.join(process.cwd(), 'client', 'src'),
    path.join(process.cwd(), 'server'),
    path.join(process.cwd(), 'supabase', 'functions'),
    path.join(process.cwd(), 'shared'),
  ].filter((dir) => fs.existsSync(dir));

  await fixer.analyzeFiles(directoriesToFix);

  const results = fixer.getResults();

  // Save detailed report
  const reportPath = path.join(process.cwd(), 'tools', 'schema-validation', 'AUTO_FIX_REPORT.md');
  let reportContent = `# Auto-Fix Report\n\n`;
  reportContent += `**Generated**: ${new Date().toISOString()}\n`;
  reportContent += `**Mode**: ${isDryRun ? 'Dry Run' : 'Applied'}\n\n`;
  reportContent += `**Fixes Applied**: ${results.fixesApplied.length}\n`;
  reportContent += `**Files Modified**: ${results.filesModified.length}\n\n`;

  reportContent += `## Modified Files\n\n`;
  for (const file of results.filesModified) {
    const relPath = path.relative(process.cwd(), file);
    const fileFixes = results.fixesApplied.filter((f) => f.file === file);
    reportContent += `### ${relPath} (${fileFixes.length} fixes)\n\n`;
    for (const fix of fileFixes) {
      reportContent += `**Line ${fix.line}**: ${fix.rule}\n`;
      reportContent += `\`\`\`typescript\n// Before\n${fix.original}\n\n// After\n${fix.fixed}\n\`\`\`\n\n`;
    }
  }

  fs.writeFileSync(reportPath, reportContent, 'utf-8');
  console.log(`📄 Detailed report saved to: ${path.relative(process.cwd(), reportPath)}\n`);
}

main().catch(console.error);
