#!/usr/bin/env tsx
/**
 * Revert Snake Case Script
 * =========================
 * Reverts incorrect snake_case property accesses back to camelCase
 * to match TypeScript interfaces.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// Map of snake_case to camelCase - reverse of what fix-frontend-schema.ts did
const SNAKE_TO_CAMEL: Record<string, string> = {
  // Timestamps
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  deleted_at: 'deletedAt',
  completed_at: 'completedAt',
  scheduled_at: 'scheduledAt',
  started_at: 'startedAt',
  finished_at: 'finishedAt',
  last_login_at: 'lastLoginAt',
  expires_at: 'expiresAt',
  discontinued_at: 'discontinuedAt',
  archived_at: 'archivedAt',
  cancelled_at: 'cancelledAt',

  // IDs
  tenant_id: 'tenantId',
  user_id: 'userId',
  customer_id: 'customerId',
  company_id: 'companyId',
  contact_id: 'contactId',
  location_id: 'locationId',
  equipment_id: 'equipmentId',
  ticket_id: 'ticketId',
  invoice_id: 'invoiceId',
  quote_id: 'quoteId',
  contract_id: 'contractId',
  product_id: 'productId',
  category_id: 'categoryId',
  parent_id: 'parentId',
  owner_id: 'ownerId',
  assigned_to: 'assignedTo',
  created_by: 'createdBy',
  updated_by: 'updatedBy',
  deleted_by: 'deletedBy',
  business_owner: 'businessOwner',

  // Service/Equipment fields
  request_number: 'requestNumber',
  ticket_number: 'ticketNumber',
  invoice_number: 'invoiceNumber',
  quote_number: 'quoteNumber',
  contract_number: 'contractNumber',
  serial_number: 'serialNumber',
  model_number: 'modelNumber',
  part_number: 'partNumber',
  asset_tag: 'assetTag',

  equipment_make: 'equipmentMake',
  equipment_model: 'equipmentModel',
  equipment_type: 'equipmentType',
  equipment_status: 'equipmentStatus',

  service_type: 'serviceType',
  service_status: 'serviceStatus',
  service_date: 'serviceDate',

  // Request fields
  request_type: 'requestType',
  request_status: 'requestStatus',
  request_date: 'requestDate',
  requested_by: 'requestedBy',
  requested_date: 'requestedDate',

  // Business fields
  business_name: 'businessName',
  business_type: 'businessType',
  business_phone: 'businessPhone',
  business_email: 'businessEmail',
  business_address: 'businessAddress',

  company_name: 'companyName',
  company_type: 'companyType',

  // Names
  first_name: 'firstName',
  last_name: 'lastName',
  full_name: 'fullName',
  display_name: 'displayName',

  // Contact fields
  phone_number: 'phoneNumber',
  email_address: 'emailAddress',
  mobile_phone: 'mobilePhone',
  office_phone: 'officePhone',

  // Address fields
  street_address: 'streetAddress',
  address_line_1: 'addressLine1',
  address_line_2: 'addressLine2',
  city_name: 'cityName',
  state_name: 'stateName',
  zip_code: 'zipCode',
  postal_code: 'postalCode',
  country_code: 'countryCode',

  // Financial fields
  total_amount: 'totalAmount',
  sub_total: 'subTotal',
  tax_amount: 'taxAmount',
  discount_amount: 'discountAmount',
  unit_price: 'unitPrice',
  list_price: 'listPrice',
  sale_price: 'salePrice',
  cost_price: 'costPrice',
  dealer_cost: 'dealerCost',

  // Status/State fields
  is_active: 'isActive',
  is_deleted: 'isDeleted',
  is_complete: 'isComplete',
  is_paid: 'isPaid',
  is_approved: 'isApproved',
  is_public: 'isPublic',
  is_enabled: 'isEnabled',
  is_featured: 'isFeatured',

  // Survey/Portal fields
  template_name: 'templateName',
  question_text: 'questionText',
  answer_text: 'answerText',
  response_text: 'responseText',
  survey_type: 'surveyType',

  // Dates
  due_date: 'dueDate',
  start_date: 'startDate',
  end_date: 'endDate',
  completion_date: 'completionDate',
  estimated_completion_date: 'estimatedCompletionDate',
  actual_completion_date: 'actualCompletionDate',

  // Other common patterns
  order_number: 'orderNumber',
  line_number: 'lineNumber',
  item_number: 'itemNumber',
  reference_number: 'referenceNumber',
  tracking_number: 'trackingNumber',
  confirmation_number: 'confirmationNumber',

  product_type: 'productType',
  product_code: 'productCode',
  product_name: 'productName',

  error_message: 'errorMessage',
  error_code: 'errorCode',

  meta_data: 'metaData',
  extra_data: 'extraData',
  custom_data: 'customData',

  is_admin: 'isAdmin',
  is_owner: 'isOwner',
  is_manager: 'isManager',

  access_level: 'accessLevel',
  permission_level: 'permissionLevel',

  notes_text: 'notesText',
  description_text: 'descriptionText',

  model_code: 'modelCode',
  accessory_code: 'accessoryCode',
  specs_json: 'specsJson',
  margin_percentage: 'marginPercentage',
  item_type: 'itemType',
};

// Patterns to exclude from conversion
const EXCLUDE_PATTERNS = [
  /className/,
  /onChange/,
  /onClick/,
  /onSubmit/,
  /onError/,
  /onSuccess/,
  /onSelect/,
  /onClose/,
  /onOpen/,
  /onDelete/,
  /onUpdate/,
  /useState/,
  /useEffect/,
  /useCallback/,
  /useMemo/,
  /useQuery/,
  /useMutation/,
  /queryKey/,
  /queryFn/,
  /mutationFn/,
];

function shouldExcludeLine(line: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(line));
}

function getAllFiles(dir: string, extensions: string[] = ['.tsx', '.ts']): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          if (!['node_modules', 'dist', 'build', '.git', 'tests'].includes(entry)) {
            files.push(...getAllFiles(fullPath, extensions));
          }
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

function fixFile(filePath: string, dryRun: boolean = true): { fixes: number; details: string[] } {
  let content = readFileSync(filePath, 'utf-8');
  let fixCount = 0;
  const details: string[] = [];

  for (const [snakeCase, camelCase] of Object.entries(SNAKE_TO_CAMEL)) {
    // Pattern 1: Property access (.snake_case)
    const propertyAccessRegex = new RegExp(`\\.${snakeCase}\\b`, 'g');

    const matches = content.match(propertyAccessRegex);
    if (matches) {
      // Check if line should be excluded
      const lines = content.split('\n');
      let validMatches = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(`.${snakeCase}`) && !shouldExcludeLine(line)) {
          validMatches++;
          details.push(`  Line ${i + 1}: .${snakeCase} -> .${camelCase}`);
        }
      }

      if (validMatches > 0) {
        content = content.replace(propertyAccessRegex, `.${camelCase}`);
        fixCount += validMatches;
      }
    }
  }

  if (fixCount > 0 && !dryRun) {
    writeFileSync(filePath, content, 'utf-8');
  }

  return { fixes: fixCount, details };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const verbose = args.includes('--verbose');

  console.log('='.repeat(60));
  console.log('Revert Snake Case Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview)' : 'APPLY (making changes)'}`);
  console.log('');

  // Get all TypeScript files in client/src and server
  const clientFiles = getAllFiles(join(process.cwd(), 'client', 'src'));
  const serverFiles = getAllFiles(join(process.cwd(), 'server'));
  const allFiles = [...clientFiles, ...serverFiles];

  console.log(`Found ${allFiles.length} files to process`);
  console.log('');

  let totalFixes = 0;
  let filesModified = 0;

  for (const file of allFiles) {
    const { fixes, details } = fixFile(file, dryRun);
    if (fixes > 0) {
      filesModified++;
      totalFixes += fixes;
      const relPath = relative(process.cwd(), file);
      console.log(`${relPath}: ${fixes} fixes`);
      if (verbose) {
        details.forEach((d) => console.log(d));
      }
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Files processed: ${allFiles.length}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Total fixes: ${totalFixes}`);
  console.log('');

  if (dryRun) {
    console.log('To apply these changes, run:');
    console.log('  npx tsx scripts/revert-snake-case.ts --apply');
  } else {
    console.log('Changes applied successfully!');
    console.log('Run npm run check to verify.');
  }
}

main().catch(console.error);
