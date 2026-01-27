#!/usr/bin/env node
/**
 * Company Deduplication CLI Tool
 * Command-line interface for detecting and merging duplicate companies
 *
 * Usage:
 *   npx tsx server/cli/company-dedup-cli.ts <command> [options]
 *
 * Commands:
 *   scan              Scan for duplicate companies (dry-run by default)
 *   merge             Execute merge of duplicate companies
 *   details           Show details for a specific duplicate group
 *   check             Check if a company name would be a duplicate
 */

import { Command } from 'commander';
import {
  findDuplicateGroups,
  mergeCompanies,
  runDeduplication,
  findExistingCompany,
  getDuplicateGroupDetails,
  type DuplicateGroup,
  type DeduplicationSummary,
  type MergeResult,
} from '../services/company-deduplication-service';

const program = new Command();

program
  .name('company-dedup')
  .description('Company Deduplication CLI Tool - Detect and merge duplicate company records')
  .version('1.0.0');

/**
 * Scan for duplicates (dry-run)
 */
program
  .command('scan')
  .description('Scan for duplicate companies (dry-run, no changes made)')
  .requiredOption('-t, --tenant <id>', 'Tenant ID (required)')
  .option('-v, --verbose', 'Show detailed information for each group')
  .action(async (options) => {
    try {
      console.log('\n🔍 Scanning for duplicate companies...\n');
      console.log(`Tenant ID: ${options.tenant}\n`);

      const summary: DeduplicationSummary = await findDuplicateGroups(options.tenant);

      console.log('═══════════════════════════════════════════════════════════════');
      console.log('                    DEDUPLICATION SCAN RESULTS                  ');
      console.log('═══════════════════════════════════════════════════════════════\n');

      console.log(`Total companies in tenant:     ${summary.totalCompanies}`);
      console.log(`Duplicate groups found:        ${summary.duplicateGroups}`);
      console.log(`Total duplicate records:       ${summary.totalDuplicates}`);
      console.log(
        `Records to be merged:          ${summary.totalDuplicates} → ${summary.duplicateGroups} survivors\n`,
      );

      if (summary.groups.length === 0) {
        console.log('✅ No duplicates found! Your data is clean.\n');
        process.exit(0);
      }

      console.log('───────────────────────────────────────────────────────────────');
      console.log('                      DUPLICATE GROUPS                          ');
      console.log('───────────────────────────────────────────────────────────────\n');

      for (let i = 0; i < summary.groups.length; i++) {
        const group = summary.groups[i];
        console.log(`Group ${i + 1}: ${group.key.split('|')[0] || 'Unknown'}`);
        console.log(`  Location: ${group.key.split('|').slice(1).join(', ') || 'No location'}`);
        console.log(`  Duplicate count: ${group.companies.length}`);
        console.log(`  Total contacts: ${group.contactCount}`);
        console.log(`  Survivor ID: ${group.survivorId}`);
        console.log(`  To be deleted: ${group.duplicateIds.length} records`);

        if (options.verbose) {
          console.log('  Companies in group:');
          for (const company of group.companies) {
            const isSurvivor = company.id === group.survivorId;
            const marker = isSurvivor ? '→ [SURVIVOR]' : '  [DELETE]';
            console.log(`    ${marker} ${company.id}`);
            console.log(`             Name: ${company.businessName}`);
            console.log(`             Created: ${company.created_at}`);
            console.log(`             Phone: ${company.phone || 'N/A'}`);
          }
        }
        console.log('');
      }

      console.log('───────────────────────────────────────────────────────────────');
      console.log('                         NEXT STEPS                            ');
      console.log('───────────────────────────────────────────────────────────────\n');
      console.log('To execute the merge, run:');
      console.log(`  npx tsx server/cli/company-dedup-cli.ts merge -t ${options.tenant}\n`);
      console.log('⚠️  IMPORTANT: Make sure to backup your database before merging!\n');

      process.exit(0);
    } catch (error) {
      console.error('Error scanning for duplicates:', error);
      process.exit(1);
    }
  });

/**
 * Execute merge
 */
program
  .command('merge')
  .description('Execute merge of duplicate companies (DESTRUCTIVE - backs up recommended)')
  .requiredOption('-t, --tenant <id>', 'Tenant ID (required)')
  .option('-u, --user <id>', 'User ID performing the merge', 'cli-user')
  .option('--confirm', 'Confirm execution without prompt')
  .action(async (options) => {
    try {
      if (!options.confirm) {
        console.log('\n⚠️  WARNING: This operation will permanently modify your database!');
        console.log('Make sure you have a database backup before proceeding.\n');
        console.log('To confirm, add the --confirm flag:\n');
        console.log(
          `  npx tsx server/cli/company-dedup-cli.ts merge -t ${options.tenant} --confirm\n`,
        );
        process.exit(0);
      }

      console.log('\n🔄 Starting company deduplication merge...\n');
      console.log(`Tenant ID: ${options.tenant}`);
      console.log(`Performed by: ${options.user}\n`);

      const result = await runDeduplication(options.tenant, {
        dryRun: false,
        performedBy: options.user,
      });

      console.log('═══════════════════════════════════════════════════════════════');
      console.log('                      MERGE RESULTS                             ');
      console.log('═══════════════════════════════════════════════════════════════\n');

      console.log(`Groups processed: ${result.summary.duplicateGroups}`);
      console.log(`Duplicates merged: ${result.summary.totalDuplicates}\n`);

      let totalContactsMoved = 0;
      let totalActivitiesMoved = 0;
      let successCount = 0;
      let failCount = 0;

      for (const mergeResult of result.results) {
        if (mergeResult.success) {
          successCount++;
          totalContactsMoved += mergeResult.contactsMoved;
          totalActivitiesMoved += mergeResult.activitiesMoved;
          console.log(
            `✅ Merged ${mergeResult.mergedCompanyIds.length} companies into ${mergeResult.survivorId}`,
          );
          console.log(`   - Contacts moved: ${mergeResult.contactsMoved}`);
          console.log(`   - Activities moved: ${mergeResult.activitiesMoved}`);
        } else {
          failCount++;
          console.log(`❌ Failed to merge into ${mergeResult.survivorId}: ${mergeResult.error}`);
        }
      }

      console.log('\n───────────────────────────────────────────────────────────────');
      console.log('                         SUMMARY                               ');
      console.log('───────────────────────────────────────────────────────────────\n');
      console.log(`Successful merges:    ${successCount}`);
      console.log(`Failed merges:        ${failCount}`);
      console.log(`Total contacts moved: ${totalContactsMoved}`);
      console.log(`Total activities moved: ${totalActivitiesMoved}\n`);

      if (failCount === 0) {
        console.log('✅ All merges completed successfully!\n');
      } else {
        console.log('⚠️  Some merges failed. Check the errors above.\n');
      }

      process.exit(failCount > 0 ? 1 : 0);
    } catch (error) {
      console.error('Error executing merge:', error);
      process.exit(1);
    }
  });

/**
 * Show details for a specific duplicate group
 */
program
  .command('details')
  .description('Show detailed information about specific company IDs')
  .requiredOption('-t, --tenant <id>', 'Tenant ID (required)')
  .requiredOption('-i, --ids <ids>', 'Comma-separated company IDs to inspect')
  .action(async (options) => {
    try {
      const companyIds = options.ids.split(',').map((id: string) => id.trim());

      console.log('\n📋 Fetching details for company IDs...\n');

      const details = await getDuplicateGroupDetails(options.tenant, companyIds);

      console.log('═══════════════════════════════════════════════════════════════');
      console.log('                     COMPANY DETAILS                            ');
      console.log('═══════════════════════════════════════════════════════════════\n');

      console.log(`Companies found: ${details.companies.length}`);
      console.log(`Total contacts: ${details.contacts.length}`);
      console.log(`Total activities: ${details.activities.length}`);
      console.log(`Recommended survivor: ${details.recommendedSurvivor?.id || 'None'}\n`);

      console.log('───────────────────────────────────────────────────────────────');
      console.log('                       COMPANIES                               ');
      console.log('───────────────────────────────────────────────────────────────\n');

      for (const company of details.companies) {
        const isSurvivor = company.id === details.recommendedSurvivor?.id;
        console.log(`${isSurvivor ? '→ [RECOMMENDED SURVIVOR]' : '  [DUPLICATE]'}`);
        console.log(`  ID: ${company.id}`);
        console.log(`  Name: ${company.businessName}`);
        console.log(`  City: ${company.billingCity || 'N/A'}`);
        console.log(`  State: ${company.billingState || 'N/A'}`);
        console.log(`  Phone: ${company.phone || 'N/A'}`);
        console.log(`  Created: ${company.created_at}`);
        console.log('');
      }

      if (details.contacts.length > 0) {
        console.log('───────────────────────────────────────────────────────────────');
        console.log('                       CONTACTS                                ');
        console.log('───────────────────────────────────────────────────────────────\n');

        for (const contact of details.contacts) {
          console.log(
            `  • ${contact.firstName || ''} ${contact.lastName || ''} (${contact.email || 'no email'})`,
          );
          console.log(`    Company ID: ${contact.companyId}`);
          console.log(`    Phone: ${contact.phone || 'N/A'}`);
          console.log('');
        }
      }

      process.exit(0);
    } catch (error) {
      console.error('Error fetching details:', error);
      process.exit(1);
    }
  });

/**
 * Check if a company name would be a duplicate
 */
program
  .command('check')
  .description('Check if a company name would be a duplicate')
  .requiredOption('-t, --tenant <id>', 'Tenant ID (required)')
  .requiredOption('-n, --name <name>', 'Company name to check')
  .option('-c, --city <city>', 'City (optional)')
  .option('-s, --state <state>', 'State (optional)')
  .action(async (options) => {
    try {
      console.log('\n🔍 Checking for existing company...\n');
      console.log(`Name: ${options.name}`);
      console.log(`City: ${options.city || 'Any'}`);
      console.log(`State: ${options.state || 'Any'}\n`);

      const existing = await findExistingCompany(
        options.tenant,
        options.name,
        options.city,
        options.state,
      );

      if (existing) {
        console.log('⚠️  DUPLICATE FOUND!\n');
        console.log(`Existing company ID: ${existing.id}`);
        console.log(`Name: ${existing.businessName}`);
        console.log(`City: ${existing.billingCity || 'N/A'}`);
        console.log(`State: ${existing.billingState || 'N/A'}`);
        console.log(`Phone: ${existing.phone || 'N/A'}`);
        console.log(`Created: ${existing.created_at}\n`);
        console.log(
          'Recommendation: Add contacts to the existing company instead of creating a new one.\n',
        );
      } else {
        console.log('✅ No duplicate found. Safe to create new company.\n');
      }

      process.exit(0);
    } catch (error) {
      console.error('Error checking for duplicate:', error);
      process.exit(1);
    }
  });

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
