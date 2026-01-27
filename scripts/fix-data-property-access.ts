#!/usr/bin/env tsx
/**
 * Fix Data Property Access Script
 * ================================
 * Targeted script to fix camelCase to snake_case for data property accesses.
 * Only targets patterns that appear after data variable names, not React props.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// Data property patterns - camelCase to snake_case
const PROPERTY_FIXES: Record<string, string> = {
  // Common data properties
  '.createdAt': '.created_at',
  '.updatedAt': '.updated_at',
  '.deletedAt': '.deleted_at',
  '.completedAt': '.completed_at',
  '.startedAt': '.started_at',
  '.finishedAt': '.finished_at',
  '.expiresAt': '.expires_at',
  '.issuedAt': '.issued_at',
  '.resolvedAt': '.resolved_at',
  '.scheduledAt': '.scheduled_at',

  // IDs
  '.tenantId': '.tenant_id',
  '.userId': '.user_id',
  '.customerId': '.customer_id',
  '.companyId': '.company_id',
  '.contactId': '.contact_id',
  '.equipmentId': '.equipment_id',
  '.ticketId': '.ticket_id',
  '.invoiceId': '.invoice_id',
  '.quoteId': '.quote_id',
  '.contractId': '.contract_id',
  '.productId': '.product_id',
  '.ownerId': '.owner_id',
  '.vendorId': '.vendor_id',
  '.locationId': '.location_id',

  // Names
  '.firstName': '.first_name',
  '.lastName': '.last_name',
  '.fullName': '.full_name',
  '.displayName': '.display_name',
  '.companyName': '.company_name',
  '.customerName': '.customer_name',
  '.vendorName': '.vendor_name',

  // Equipment
  '.equipmentModel': '.equipment_model',
  '.equipmentMake': '.equipment_make',
  '.equipmentType': '.equipment_type',
  '.equipmentStatus': '.equipment_status',
  '.serialNumber': '.serial_number',
  '.modelNumber': '.model_number',
  '.assetTag': '.asset_tag',

  // Numbers
  '.invoiceNumber': '.invoice_number',
  '.quoteNumber': '.quote_number',
  '.contractNumber': '.contract_number',
  '.orderNumber': '.order_number',
  '.ticketNumber': '.ticket_number',
  '.requestNumber': '.request_number',
  '.trackingNumber': '.tracking_number',
  '.customerNumber': '.customer_number',
  '.accountNumber': '.account_number',

  // Dates
  '.dueDate': '.due_date',
  '.startDate': '.start_date',
  '.endDate': '.end_date',
  '.closeDate': '.close_date',
  '.issueDate': '.issue_date',
  '.lastContactDate': '.last_contact_date',
  '.nextFollowUpDate': '.next_follow_up_date',
  '.estimatedCompletionDate': '.estimated_completion_date',

  // Amounts
  '.totalAmount': '.total_amount',
  '.subTotal': '.sub_total',
  '.taxAmount': '.tax_amount',
  '.unitPrice': '.unit_price',
  '.listPrice': '.list_price',

  // Status/Flags
  '.isActive': '.is_active',
  '.isPrimary': '.is_primary',
  '.isPrimaryContact': '.is_primary_contact',
  '.isFeatured': '.is_featured',
  '.isPublic': '.is_public',
  '.isApproved': '.is_approved',

  // Other common
  '.createdBy': '.created_by',
  '.updatedBy': '.updated_by',
  '.assignedTo': '.assigned_to',
  '.recordType': '.record_type',
  '.leadStatus': '.lead_status',
  '.leadSource': '.lead_source',
  '.leadScore': '.lead_score',
  '.questionText': '.question_text',
  '.templateName': '.template_name',
  '.surveyType': '.survey_type',
  '.overallScore': '.overall_score',
  '.npsScore': '.nps_score',
  '.serviceType': '.service_type',
  '.requestType': '.request_type',
  '.productType': '.product_type',
  '.billingCycle': '.billing_cycle',
  '.paymentTerms': '.payment_terms',
};

// Files/directories to skip
const SKIP_PATHS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'tests/backups',
  'components/ui/', // Skip shadcn UI components
];

function shouldSkipPath(filePath: string): boolean {
  return SKIP_PATHS.some((skip) => filePath.includes(skip));
}

function getAllFiles(dir: string, extensions: string[] = ['.tsx', '.ts']): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);

      if (shouldSkipPath(fullPath)) continue;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...getAllFiles(fullPath, extensions));
        } else if (extensions.some((ext) => entry.endsWith(ext))) {
          files.push(fullPath);
        }
      } catch (e) {
        // Skip files we can't access
      }
    }
  } catch (e) {
    // Skip directories we can't access
  }

  return files;
}

function fixFile(filePath: string, dryRun: boolean = true): { fixes: number } {
  let content = readFileSync(filePath, 'utf-8');
  let fixCount = 0;

  for (const [camelCase, snakeCase] of Object.entries(PROPERTY_FIXES)) {
    const regex = new RegExp(camelCase.replace('.', '\\.') + '(?![a-zA-Z])', 'g');
    const matches = content.match(regex);
    if (matches) {
      fixCount += matches.length;
      content = content.replace(regex, snakeCase);
    }
  }

  if (fixCount > 0 && !dryRun) {
    writeFileSync(filePath, content, 'utf-8');
  }

  return { fixes: fixCount };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');

  console.log('='.repeat(60));
  console.log('Fix Data Property Access Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log('');

  const clientFiles = getAllFiles(join(process.cwd(), 'client', 'src'));
  const serverFiles = getAllFiles(join(process.cwd(), 'server'));
  const allFiles = [...clientFiles, ...serverFiles];

  console.log(`Found ${allFiles.length} files to process`);
  console.log('');

  let totalFixes = 0;
  let filesModified = 0;

  for (const file of allFiles) {
    const { fixes } = fixFile(file, dryRun);
    if (fixes > 0) {
      filesModified++;
      totalFixes += fixes;
      console.log(`${relative(process.cwd(), file)}: ${fixes} fixes`);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`Files modified: ${filesModified}`);
  console.log(`Total fixes: ${totalFixes}`);
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('To apply: npx tsx scripts/fix-data-property-access.ts --apply');
  }
}

main().catch(console.error);
