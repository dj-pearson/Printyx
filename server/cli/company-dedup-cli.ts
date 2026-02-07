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
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('company-dedup-cli');

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
      log.info('\n🔍 Scanning for duplicate companies...\n');
      log.info(`Tenant ID: ${options.tenant}\n`);

      const summary: DeduplicationSummary = await findDuplicateGroups(options.tenant);

      log.info('═══════════════════════════════════════════════════════════════');
      log.info('                    DEDUPLICATION SCAN RESULTS                  ');
      log.info('═══════════════════════════════════════════════════════════════\n');

      log.info(`Total companies in tenant:     ${summary.totalCompanies}`);
      log.info(`Duplicate groups found:        ${summary.duplicateGroups}`);
      log.info(`Total duplicate records:       ${summary.totalDuplicates}`);
      log.info(
        `Records to be merged:          ${summary.totalDuplicates} → ${summary.duplicateGroups} survivors\n`,
      );

      if (summary.groups.length === 0) {
        log.info('✅ No duplicates found! Your data is clean.\n');
        process.exit(0);
      }

      log.info('───────────────────────────────────────────────────────────────');
      log.info('                      DUPLICATE GROUPS                          ');
      log.info('───────────────────────────────────────────────────────────────\n');

      for (let i = 0; i < summary.groups.length; i++) {
        const group = summary.groups[i];
        log.info(`Group ${i + 1}: ${group.key.split('|')[0] || 'Unknown'}`);
        log.info(`  Location: ${group.key.split('|').slice(1).join(', ') || 'No location'}`);
        log.info(`  Duplicate count: ${group.companies.length}`);
        log.info(`  Total contacts: ${group.contactCount}`);
        log.info(`  Survivor ID: ${group.survivorId}`);
        log.info(`  To be deleted: ${group.duplicateIds.length} records`);

        if (options.verbose) {
          log.info('  Companies in group:');
          for (const company of group.companies) {
            const isSurvivor = company.id === group.survivorId;
            const marker = isSurvivor ? '→ [SURVIVOR]' : '  [DELETE]';
            log.info(`    ${marker} ${company.id}`);
            log.info(`             Name: ${company.businessName}`);
            log.info(`             Created: ${company.createdAt}`);
            log.info(`             Phone: ${company.phone || 'N/A'}`);
          }
        }
        log.info('');
      }

      log.info('───────────────────────────────────────────────────────────────');
      log.info('                         NEXT STEPS                            ');
      log.info('───────────────────────────────────────────────────────────────\n');
      log.info('To execute the merge, run:');
      log.info(`  npx tsx server/cli/company-dedup-cli.ts merge -t ${options.tenant}\n`);
      log.info('⚠️  IMPORTANT: Make sure to backup your database before merging!\n');

      process.exit(0);
    } catch (error) {
      log.error('Error scanning for duplicates:', error);
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
        log.info('\n⚠️  WARNING: This operation will permanently modify your database!');
        log.info('Make sure you have a database backup before proceeding.\n');
        log.info('To confirm, add the --confirm flag:\n');
        log.info(
          `  npx tsx server/cli/company-dedup-cli.ts merge -t ${options.tenant} --confirm\n`,
        );
        process.exit(0);
      }

      log.info('\n🔄 Starting company deduplication merge...\n');
      log.info(`Tenant ID: ${options.tenant}`);
      log.info(`Performed by: ${options.user}\n`);

      const result = await runDeduplication(options.tenant, {
        dryRun: false,
        performedBy: options.user,
      });

      log.info('═══════════════════════════════════════════════════════════════');
      log.info('                      MERGE RESULTS                             ');
      log.info('═══════════════════════════════════════════════════════════════\n');

      log.info(`Groups processed: ${result.summary.duplicateGroups}`);
      log.info(`Duplicates merged: ${result.summary.totalDuplicates}\n`);

      let totalContactsMoved = 0;
      let totalActivitiesMoved = 0;
      let successCount = 0;
      let failCount = 0;

      for (const mergeResult of result.results) {
        if (mergeResult.success) {
          successCount++;
          totalContactsMoved += mergeResult.contactsMoved;
          totalActivitiesMoved += mergeResult.activitiesMoved;
          log.info(
            `✅ Merged ${mergeResult.mergedCompanyIds.length} companies into ${mergeResult.survivorId}`,
          );
          log.info(`   - Contacts moved: ${mergeResult.contactsMoved}`);
          log.info(`   - Activities moved: ${mergeResult.activitiesMoved}`);
        } else {
          failCount++;
          log.info(`❌ Failed to merge into ${mergeResult.survivorId}: ${mergeResult.error}`);
        }
      }

      log.info('\n───────────────────────────────────────────────────────────────');
      log.info('                         SUMMARY                               ');
      log.info('───────────────────────────────────────────────────────────────\n');
      log.info(`Successful merges:    ${successCount}`);
      log.info(`Failed merges:        ${failCount}`);
      log.info(`Total contacts moved: ${totalContactsMoved}`);
      log.info(`Total activities moved: ${totalActivitiesMoved}\n`);

      if (failCount === 0) {
        log.info('✅ All merges completed successfully!\n');
      } else {
        log.info('⚠️  Some merges failed. Check the errors above.\n');
      }

      process.exit(failCount > 0 ? 1 : 0);
    } catch (error) {
      log.error('Error executing merge:', error);
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

      log.info('\n📋 Fetching details for company IDs...\n');

      const details = await getDuplicateGroupDetails(options.tenant, companyIds);

      log.info('═══════════════════════════════════════════════════════════════');
      log.info('                     COMPANY DETAILS                            ');
      log.info('═══════════════════════════════════════════════════════════════\n');

      log.info(`Companies found: ${details.companies.length}`);
      log.info(`Total contacts: ${details.contacts.length}`);
      log.info(`Total activities: ${details.activities.length}`);
      log.info(`Recommended survivor: ${details.recommendedSurvivor?.id || 'None'}\n`);

      log.info('───────────────────────────────────────────────────────────────');
      log.info('                       COMPANIES                               ');
      log.info('───────────────────────────────────────────────────────────────\n');

      for (const company of details.companies) {
        const isSurvivor = company.id === details.recommendedSurvivor?.id;
        log.info(`${isSurvivor ? '→ [RECOMMENDED SURVIVOR]' : '  [DUPLICATE]'}`);
        log.info(`  ID: ${company.id}`);
        log.info(`  Name: ${company.businessName}`);
        log.info(`  City: ${company.billingCity || 'N/A'}`);
        log.info(`  State: ${company.billingState || 'N/A'}`);
        log.info(`  Phone: ${company.phone || 'N/A'}`);
        log.info(`  Created: ${company.createdAt}`);
        log.info('');
      }

      if (details.contacts.length > 0) {
        log.info('───────────────────────────────────────────────────────────────');
        log.info('                       CONTACTS                                ');
        log.info('───────────────────────────────────────────────────────────────\n');

        for (const contact of details.contacts) {
          log.info(
            `  • ${contact.firstName || ''} ${contact.lastName || ''} (${contact.email || 'no email'})`,
          );
          log.info(`    Company ID: ${contact.companyId}`);
          log.info(`    Phone: ${contact.phone || 'N/A'}`);
          log.info('');
        }
      }

      process.exit(0);
    } catch (error) {
      log.error('Error fetching details:', error);
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
      log.info('\n🔍 Checking for existing company...\n');
      log.info(`Name: ${options.name}`);
      log.info(`City: ${options.city || 'Any'}`);
      log.info(`State: ${options.state || 'Any'}\n`);

      const existing = await findExistingCompany(
        options.tenant,
        options.name,
        options.city,
        options.state,
      );

      if (existing) {
        log.info('⚠️  DUPLICATE FOUND!\n');
        log.info(`Existing company ID: ${existing.id}`);
        log.info(`Name: ${existing.businessName}`);
        log.info(`City: ${existing.billingCity || 'N/A'}`);
        log.info(`State: ${existing.billingState || 'N/A'}`);
        log.info(`Phone: ${existing.phone || 'N/A'}`);
        log.info(`Created: ${existing.createdAt}\n`);
        log.info(
          'Recommendation: Add contacts to the existing company instead of creating a new one.\n',
        );
      } else {
        log.info('✅ No duplicate found. Safe to create new company.\n');
      }

      process.exit(0);
    } catch (error) {
      log.error('Error checking for duplicate:', error);
      process.exit(1);
    }
  });

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
