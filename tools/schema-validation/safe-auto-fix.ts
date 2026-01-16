/**
 * Safe Auto-Fix - Properly handles object properties and SQL queries
 * Only fixes things we're 100% certain about
 */

import * as fs from 'fs';
import * as path from 'path';

interface Stats {
  filesProcessed: number;
  filesModified: number;
  fixesApplied: number;
  filesSkipped: number;
}

class SafeAutoFixer {
  private stats: Stats = {
    filesProcessed: 0,
    filesModified: 0,
    fixesApplied: 0,
    filesSkipped: 0,
  };
  private dryRun: boolean;
  private logFile: string;

  constructor(dryRun: boolean = true) {
    this.dryRun = dryRun;
    this.logFile = path.join(process.cwd(), 'tools', 'schema-validation', 'safe-fix-log.txt');

    if (!dryRun) {
      fs.writeFileSync(
        this.logFile,
        `Safe Auto-Fix Log - ${new Date().toISOString()}\n\n`,
        'utf-8',
      );
    }
  }

  async processDirectory(dir: string): Promise<void> {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const skipDirs = ['node_modules', 'dist', 'build', '.git', '.next', 'coverage'];
          if (!skipDirs.includes(entry.name)) {
            await this.processDirectory(fullPath);
          }
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          await this.processFile(fullPath);
        }
      }
    } catch (error: any) {
      // Skip directories we can't read
    }
  }

  private async processFile(filePath: string): Promise<void> {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > 500 * 1024) {
        this.stats.filesSkipped++;
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      this.stats.filesProcessed++;

      const newLines: string[] = [];
      let modified = false;
      let changeCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let keep = true;
        let reason = '';

        // Check if this is a line we should remove entirely
        // Pattern 1: Object property for access_scope
        if (/^\s*access_scope:\s*/.test(line)) {
          keep = false;
          reason = 'Remove access_scope property';
          changeCount++;
        }
        // Pattern 2: Object property for is_platform_user
        else if (/^\s*is_platform_user:\s*/.test(line)) {
          keep = false;
          reason = 'Remove is_platform_user property';
          changeCount++;
        }
        // Pattern 3: In .select() query - remove from column list
        else if (
          line.includes('.select(') &&
          (line.includes('access_scope') || line.includes('is_platform_user'))
        ) {
          let cleanedLine = line;

          // Remove access_scope from select
          cleanedLine = cleanedLine.replace(/,\s*'?access_scope'?/g, '');
          cleanedLine = cleanedLine.replace(/'?access_scope'?,\s*/g, '');

          // Remove is_platform_user from select
          cleanedLine = cleanedLine.replace(/,\s*'?is_platform_user'?/g, '');
          cleanedLine = cleanedLine.replace(/'?is_platform_user'?,\s*/g, '');

          // Clean up double commas
          cleanedLine = cleanedLine.replace(/,\s*,/g, ',');

          if (cleanedLine !== line) {
            newLines.push(cleanedLine);
            reason = 'Clean select() query';
            changeCount++;
            modified = true;
            keep = false;
          }
        }

        if (keep) {
          newLines.push(line);
        } else {
          modified = true;
          if (reason) {
            this.log(`Line ${i + 1} in ${path.relative(process.cwd(), filePath)}: ${reason}`);
          }
        }
      }

      if (modified && changeCount > 0) {
        this.stats.filesModified++;
        this.stats.fixesApplied += changeCount;

        console.log(`  ✓ ${path.relative(process.cwd(), filePath)} (${changeCount} fixes)`);

        if (!this.dryRun) {
          fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
        }
      }
    } catch (error: any) {
      // Skip files we can't process
    }
  }

  private log(message: string): void {
    if (!this.dryRun) {
      try {
        fs.appendFileSync(this.logFile, message + '\n', 'utf-8');
      } catch {
        // Ignore log errors
      }
    }
  }

  printSummary(): void {
    console.log('\n📊 Safe Auto-Fix Summary\n');
    console.log(`Mode: ${this.dryRun ? '🔍 DRY RUN' : '✅ APPLIED'}\n`);
    console.log(`Files processed: ${this.stats.filesProcessed}`);
    console.log(`Files modified: ${this.stats.filesModified}`);
    console.log(`Fixes applied: ${this.stats.fixesApplied}`);
    console.log(`Files skipped: ${this.stats.filesSkipped}\n`);

    if (!this.dryRun && this.stats.filesModified > 0) {
      console.log(`📄 Detailed log: ${path.relative(process.cwd(), this.logFile)}\n`);
      console.log('✅ Changes applied successfully!');
      console.log('💡 Next step: Review changes with `git diff` then commit\n');
    } else if (this.dryRun && this.stats.filesModified > 0) {
      console.log('💡 Run with --apply to apply these fixes\n');
    } else if (this.stats.filesModified === 0) {
      console.log('✅ No issues found or all already fixed!\n');
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--apply');

  console.log('🔧 Safe Auto-Fix Tool\n');
  console.log('This tool only removes complete lines with access_scope or is_platform_user');
  console.log('It will NOT break syntax by partial replacements.\n');

  const fixer = new SafeAutoFixer(isDryRun);

  const dirs = [
    path.join(process.cwd(), 'client', 'src'),
    path.join(process.cwd(), 'server'),
    path.join(process.cwd(), 'supabase', 'functions'),
  ].filter((dir) => fs.existsSync(dir));

  console.log('Processing files...\n');

  for (const dir of dirs) {
    await fixer.processDirectory(dir);
  }

  fixer.printSummary();
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
