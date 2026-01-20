#!/usr/bin/env tsx
/**
 * Migration Script: business_records → companies
 *
 * This script finds all references to business_records and helps migrate them to companies table.
 *
 * Usage:
 *   npm run migrate:analyze        # Analyze only (safe, no changes)
 *   npm run migrate:preview        # Show what would change
 *   npm run migrate:execute        # Apply changes (CAREFUL!)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

interface Reference {
  file: string;
  line: number;
  content: string;
  type: 'table_reference' | 'api_endpoint' | 'type_definition' | 'column_reference' | 'comment';
  confidence: 'high' | 'medium' | 'low';
  replacement?: string;
}

// Patterns to search for
const patterns = {
  tableReferences: [
    /\.from\(['"`]business_records['"`]\)/g,
    /table\(['"`]business_records['"`]\)/g,
    /pgTable\(['"`]business_records['"`]/g,
    /'business_records'/g,
    /"business_records"/g,
    /`business_records`/g,
  ],
  apiEndpoints: [/\/api\/business-records/g, /['"`]\/api\/business-records/g, /business-records/g],
  typeNames: [
    /BusinessRecord(?!s)/g, // BusinessRecord but not BusinessRecords
    /business_records/g,
  ],
  columnReferences: [/company_name/g, /primary_contact_name/g, /address_line1/g, /record_type/g],
};

// Field mapping from business_records to companies
const fieldMapping: Record<string, string> = {
  company_name: 'business_name',
  companyName: 'businessName',
  primary_contact_name: 'contact_name', // This might need contacts table
  primary_contact_email: 'contact_email', // This might need contacts table
  primary_contact_phone: 'phone',
  address_line1: 'billing_address',
  address_line2: 'shipping_address',
  city: 'billing_city',
  state: 'billing_state',
  postal_code: 'billing_zip',
  record_type: 'business_record_type',
  recordType: 'businessRecordType',
  lead_source: 'source', // Might need to track separately
  source: 'source',
  owner_id: 'business_owner',
  ownerId: 'businessOwner',
};

// Files to exclude from search
const excludePatterns = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/database-exports/**',
  '**/migrations/**', // Don't touch migrations
  '**/*.md', // Skip documentation for now
  '**/scripts/migrate-business-records-to-companies.ts', // Don't analyze self
];

// Files to include in search
const includePatterns = [
  'client/src/**/*.{ts,tsx}',
  'server/**/*.ts',
  'shared/**/*.ts',
  'supabase/functions/**/*.ts',
];

async function findReferences(): Promise<Reference[]> {
  const references: Reference[] = [];

  console.log('🔍 Searching for business_records references...\n');

  for (const pattern of includePatterns) {
    const files = await glob(pattern, {
      cwd: rootDir,
      ignore: excludePatterns,
      absolute: true,
    });

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();

        // Skip comments (but record them separately)
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          if (line.includes('business_records') || line.includes('business-records')) {
            references.push({
              file: path.relative(rootDir, file),
              line: lineNum,
              content: trimmed,
              type: 'comment',
              confidence: 'low',
            });
          }
          return;
        }

        // Check for table references
        if (line.includes('business_records')) {
          let type: Reference['type'] = 'table_reference';
          let confidence: Reference['confidence'] = 'medium';
          let replacement: string | undefined;

          // Determine type and confidence
          if (line.includes('.from(') || line.includes('pgTable(')) {
            type = 'table_reference';
            confidence = 'high';
            replacement = line.replace(/business_records/g, 'companies');
          } else if (line.includes('/api/')) {
            type = 'api_endpoint';
            confidence = 'high';
            replacement = line.replace(/business-records/g, 'companies');
          } else if (line.match(/interface|type|class/) && line.includes('BusinessRecord')) {
            type = 'type_definition';
            confidence = 'high';
            replacement = line.replace(/BusinessRecord(?!s)/g, 'Company');
          } else if (Object.keys(fieldMapping).some((field) => line.includes(field))) {
            type = 'column_reference';
            confidence = 'medium';
            // Try to replace field names
            let newLine = line;
            Object.entries(fieldMapping).forEach(([old, newField]) => {
              newLine = newLine.replace(new RegExp(old, 'g'), newField);
            });
            if (newLine !== line) {
              replacement = newLine;
            }
          }

          references.push({
            file: path.relative(rootDir, file),
            line: lineNum,
            content: trimmed,
            type,
            confidence,
            replacement,
          });
        }

        // Check for API endpoint references
        if (line.includes('business-records')) {
          references.push({
            file: path.relative(rootDir, file),
            line: lineNum,
            content: trimmed,
            type: 'api_endpoint',
            confidence: 'high',
            replacement: line.replace(/business-records/g, 'companies'),
          });
        }
      });
    }
  }

  return references;
}

function analyzeReferences(references: Reference[]) {
  console.log('\n📊 Analysis Results\n');
  console.log('='.repeat(80));

  const byType = references.reduce(
    (acc, ref) => {
      acc[ref.type] = (acc[ref.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const byConfidence = references.reduce(
    (acc, ref) => {
      acc[ref.confidence] = (acc[ref.confidence] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const byFile = references.reduce(
    (acc, ref) => {
      acc[ref.file] = (acc[ref.file] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log(`\n📈 Total References Found: ${references.length}\n`);

  console.log('By Type:');
  Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`  ${type.padEnd(20)} ${count}`);
    });

  console.log('\nBy Confidence:');
  Object.entries(byConfidence)
    .sort(([, a], [, b]) => b - a)
    .forEach(([conf, count]) => {
      const emoji = conf === 'high' ? '🟢' : conf === 'medium' ? '🟡' : '🔴';
      console.log(`  ${emoji} ${conf.padEnd(15)} ${count}`);
    });

  console.log('\nTop 10 Files with Most References:');
  Object.entries(byFile)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([file, count]) => {
      console.log(`  ${count.toString().padStart(4)} ${file}`);
    });
}

function generateReport(references: Reference[], outputFile: string) {
  const report = {
    timestamp: new Date().toISOString(),
    totalReferences: references.length,
    byType: {} as Record<string, number>,
    byConfidence: {} as Record<string, number>,
    byFile: {} as Record<string, Reference[]>,
    highConfidenceChanges: references.filter((r) => r.confidence === 'high' && r.replacement),
    mediumConfidenceChanges: references.filter((r) => r.confidence === 'medium' && r.replacement),
    manualReviewNeeded: references.filter((r) => !r.replacement || r.confidence === 'low'),
  };

  // Group by file
  references.forEach((ref) => {
    report.byType[ref.type] = (report.byType[ref.type] || 0) + 1;
    report.byConfidence[ref.confidence] = (report.byConfidence[ref.confidence] || 0) + 1;

    if (!report.byFile[ref.file]) {
      report.byFile[ref.file] = [];
    }
    report.byFile[ref.file].push(ref);
  });

  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
  console.log(`\n💾 Detailed report saved to: ${outputFile}`);
}

function previewChanges(references: Reference[]) {
  console.log('\n🔍 Preview of Proposed Changes\n');
  console.log('='.repeat(80));

  const highConfidence = references.filter((r) => r.confidence === 'high' && r.replacement);
  const mediumConfidence = references.filter((r) => r.confidence === 'medium' && r.replacement);
  const needsReview = references.filter((r) => !r.replacement || r.confidence === 'low');

  console.log(`\n🟢 High Confidence Changes (${highConfidence.length}):`);
  console.log('These can be automatically applied safely.\n');

  highConfidence.slice(0, 10).forEach((ref) => {
    console.log(`📄 ${ref.file}:${ref.line}`);
    console.log(`   - ${ref.content.substring(0, 80)}`);
    console.log(`   + ${ref.replacement?.substring(0, 80)}`);
    console.log('');
  });

  if (highConfidence.length > 10) {
    console.log(`   ... and ${highConfidence.length - 10} more\n`);
  }

  console.log(`\n🟡 Medium Confidence Changes (${mediumConfidence.length}):`);
  console.log('These should be reviewed before applying.\n');

  mediumConfidence.slice(0, 5).forEach((ref) => {
    console.log(`📄 ${ref.file}:${ref.line}`);
    console.log(`   - ${ref.content.substring(0, 80)}`);
    console.log(`   + ${ref.replacement?.substring(0, 80)}`);
    console.log('');
  });

  if (mediumConfidence.length > 5) {
    console.log(`   ... and ${mediumConfidence.length - 5} more\n`);
  }

  console.log(`\n🔴 Needs Manual Review (${needsReview.length}):`);
  console.log('These require human judgment.\n');

  needsReview.slice(0, 5).forEach((ref) => {
    console.log(`📄 ${ref.file}:${ref.line}`);
    console.log(`   ${ref.content.substring(0, 80)}`);
    console.log('');
  });

  if (needsReview.length > 5) {
    console.log(`   ... and ${needsReview.length - 5} more\n`);
  }
}

async function executeChanges(references: Reference[], dryRun: boolean = true) {
  console.log(`\n${dryRun ? '🔍 DRY RUN' : '✅ EXECUTING'} Changes\n`);
  console.log('='.repeat(80));

  // Group changes by file
  const changesByFile = references
    .filter((r) => r.confidence === 'high' && r.replacement)
    .reduce(
      (acc, ref) => {
        if (!acc[ref.file]) {
          acc[ref.file] = [];
        }
        acc[ref.file].push(ref);
        return acc;
      },
      {} as Record<string, Reference[]>,
    );

  let filesChanged = 0;
  let linesChanged = 0;

  for (const [relativeFile, refs] of Object.entries(changesByFile)) {
    const filePath = path.join(rootDir, relativeFile);

    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      let modified = false;

      // Sort by line number descending to avoid offset issues
      const sortedRefs = refs.sort((a, b) => b.line - a.line);

      const lines = content.split('\n');

      for (const ref of sortedRefs) {
        const lineIndex = ref.line - 1;
        if (lines[lineIndex] === ref.content && ref.replacement) {
          lines[lineIndex] = ref.replacement;
          modified = true;
          linesChanged++;
        }
      }

      if (modified) {
        const newContent = lines.join('\n');

        if (!dryRun) {
          // Create backup
          const backupPath = `${filePath}.backup-${Date.now()}`;
          fs.writeFileSync(backupPath, content);

          // Write new content
          fs.writeFileSync(filePath, newContent);
          console.log(`✅ Modified: ${relativeFile} (${refs.length} changes)`);
        } else {
          console.log(`Would modify: ${relativeFile} (${refs.length} changes)`);
        }

        filesChanged++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${relativeFile}:`, error);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Files ${dryRun ? 'to be ' : ''}changed: ${filesChanged}`);
  console.log(`   Lines ${dryRun ? 'to be ' : ''}modified: ${linesChanged}`);

  if (!dryRun) {
    console.log(`\n💾 Backup files created with .backup-* extension`);
    console.log(`⚠️  Run tests and verify changes before committing!`);
  }
}

async function main() {
  const command = process.argv[2] || 'analyze';

  console.log('🚀 Business Records → Companies Migration Tool\n');

  const references = await findReferences();

  switch (command) {
    case 'analyze':
      analyzeReferences(references);
      generateReport(references, path.join(rootDir, 'migration-report.json'));
      console.log('\n💡 Next steps:');
      console.log('   npm run migrate:preview  - See what would change');
      console.log('   npm run migrate:execute  - Apply high-confidence changes');
      break;

    case 'preview':
      previewChanges(references);
      generateReport(references, path.join(rootDir, 'migration-report.json'));
      console.log('\n💡 To apply changes:');
      console.log('   npm run migrate:execute');
      break;

    case 'execute':
      console.log('⚠️  WARNING: This will modify files!');
      console.log('Press Ctrl+C within 5 seconds to cancel...\n');

      await new Promise((resolve) => setTimeout(resolve, 5000));

      await executeChanges(references, false);
      generateReport(references, path.join(rootDir, 'migration-report.json'));
      console.log('\n✅ Migration complete!');
      console.log('⚠️  Please review changes and run tests before committing.');
      break;

    default:
      console.log('Unknown command:', command);
      console.log('Valid commands: analyze, preview, execute');
      process.exit(1);
  }
}

main().catch(console.error);
