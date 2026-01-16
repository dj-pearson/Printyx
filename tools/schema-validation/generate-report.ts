/**
 * Generate Schema Validation Report
 * Creates a comprehensive report of validation issues
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface Issue {
  file: string;
  line: number;
  table: string;
  invalidColumn: string;
  suggestion?: string;
  context: string;
}

async function generateReport() {
  console.log('📊 Generating Schema Validation Report...\n');

  // Run validation and capture output
  let validationOutput = '';
  try {
    execSync('npx tsx tools/schema-validation/validate-code.ts', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (error: any) {
    validationOutput = error.stdout || '';
  }

  // Parse issues from output
  const issues: Issue[] = [];
  const lines = validationOutput.split('\n');

  let currentFile = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect file header
    if (line.startsWith('📄 ')) {
      currentFile = line.substring(3).trim();
      continue;
    }

    // Detect issue line
    if (line.includes('Line ') && line.includes('Invalid column')) {
      const lineMatch = line.match(/Line (\d+): Invalid column '([^']+)' in table '([^']+)'/);
      if (lineMatch) {
        const [, lineNum, column, table] = lineMatch;
        const nextLine = lines[i + 1];
        const suggestion = nextLine?.includes('💡 Did you mean')
          ? nextLine.match(/'([^']+)'/)?.[1]
          : undefined;
        const contextLine = suggestion ? lines[i + 2] : lines[i + 1];
        const context = contextLine?.includes('Context:')
          ? contextLine.substring(contextLine.indexOf('Context:') + 8).trim()
          : '';

        issues.push({
          file: currentFile,
          line: parseInt(lineNum),
          table,
          invalidColumn: column,
          suggestion,
          context,
        });
      }
    }
  }

  // Group issues by type
  const issuesByColumn = new Map<string, Issue[]>();
  const issuesByFile = new Map<string, Issue[]>();
  const issuesByTable = new Map<string, Issue[]>();

  for (const issue of issues) {
    // By column
    if (!issuesByColumn.has(issue.invalidColumn)) {
      issuesByColumn.set(issue.invalidColumn, []);
    }
    issuesByColumn.get(issue.invalidColumn)!.push(issue);

    // By file
    if (!issuesByFile.has(issue.file)) {
      issuesByFile.set(issue.file, []);
    }
    issuesByFile.get(issue.file)!.push(issue);

    // By table
    if (!issuesByTable.has(issue.table)) {
      issuesByTable.set(issue.table, []);
    }
    issuesByTable.get(issue.table)!.push(issue);
  }

  // Generate markdown report
  let report = `# Database Schema Validation Report\n\n`;
  report += `**Generated**: ${new Date().toISOString()}\n\n`;
  report += `**Total Issues**: ${issues.length}\n\n`;
  report += `---\n\n`;

  // Summary by column
  report += `## Top Invalid Columns\n\n`;
  report += `| Column Name | Occurrences | Suggestion |\n`;
  report += `|-------------|-------------|------------|\n`;

  const sortedColumns = Array.from(issuesByColumn.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 30);

  for (const [column, columnIssues] of sortedColumns) {
    const suggestion = columnIssues.find((i) => i.suggestion)?.suggestion || '—';
    report += `| \`${column}\` | ${columnIssues.length} | ${suggestion ? `\`${suggestion}\`` : '—'} |\n`;
  }

  report += `\n---\n\n`;

  // Most problematic files
  report += `## Most Problematic Files\n\n`;
  report += `| File | Issues |\n`;
  report += `|------|--------|\n`;

  const sortedFiles = Array.from(issuesByFile.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20);

  for (const [file, fileIssues] of sortedFiles) {
    report += `| \`${file}\` | ${fileIssues.length} |\n`;
  }

  report += `\n---\n\n`;

  // Issues by table
  report += `## Issues by Table\n\n`;
  report += `| Table | Issues |\n`;
  report += `|-------|--------|\n`;

  const sortedTables = Array.from(issuesByTable.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );

  for (const [table, tableIssues] of sortedTables) {
    report += `| \`${table}\` | ${tableIssues.length} |\n`;
  }

  report += `\n---\n\n`;

  // Detailed breakdown
  report += `## Detailed Issues\n\n`;

  for (const [file, fileIssues] of sortedFiles.slice(0, 10)) {
    report += `### ${file}\n\n`;

    for (const issue of fileIssues.slice(0, 10)) {
      report += `**Line ${issue.line}**: Invalid column \`${issue.invalidColumn}\``;
      if (issue.table !== 'unknown') {
        report += ` in table \`${issue.table}\``;
      }
      report += `\n`;

      if (issue.suggestion) {
        report += `💡 Suggestion: Use \`${issue.suggestion}\`\n`;
      }

      report += `\`\`\`typescript\n${issue.context}\n\`\`\`\n\n`;
    }

    if (fileIssues.length > 10) {
      report += `... and ${fileIssues.length - 10} more issues\n\n`;
    }
  }

  // Save report
  const reportPath = path.join(process.cwd(), 'tools', 'schema-validation', 'VALIDATION_REPORT.md');
  fs.writeFileSync(reportPath, report, 'utf-8');

  console.log(`✅ Report generated: ${reportPath}`);
  console.log(`📊 Total Issues: ${issues.length}`);
  console.log(`📁 Files affected: ${issuesByFile.size}`);
  console.log(`🗂️  Tables involved: ${issuesByTable.size}`);
  console.log(`🔤 Unique invalid columns: ${issuesByColumn.size}`);
}

generateReport().catch(console.error);
