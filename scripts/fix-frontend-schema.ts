#!/usr/bin/env tsx
/**
 * Frontend Schema Fixer
 * ======================
 * Automatically converts camelCase to snake_case property references in frontend code
 * to match the actual database schema.
 *
 * This fixes TypeScript errors like:
 * - TS2551: Property 'createdAt' does not exist. Did you mean 'created_at'?
 * - TS2339: Property 'requestNumber' does not exist on type 'ServiceRequest'
 *
 * Usage:
 *   tsx scripts/fix-frontend-schema.ts              # Preview mode (dry run)
 *   tsx scripts/fix-frontend-schema.ts --apply      # Apply fixes
 *   tsx scripts/fix-frontend-schema.ts --file path  # Fix specific file
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, cpSync } from 'fs';
import { join, relative } from 'path';

interface Fix {
  file: string;
  line: number;
  column: number;
  original: string;
  fixed: string;
  pattern: string;
}

const fixes: Fix[] = [];

// Common database column patterns that need snake_case
const COLUMN_PATTERNS: Record<string, string> = {
  // Timestamps
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  completedAt: 'completed_at',
  scheduledAt: 'scheduled_at',
  startedAt: 'started_at',
  finishedAt: 'finished_at',
  lastLoginAt: 'last_login_at',
  expiresAt: 'expires_at',
  discontinuedAt: 'discontinued_at',
  archivedAt: 'archived_at',
  cancelledAt: 'cancelled_at',

  // IDs
  tenantId: 'tenant_id',
  userId: 'user_id',
  customerId: 'customer_id',
  companyId: 'company_id',
  contactId: 'contact_id',
  locationId: 'location_id',
  equipmentId: 'equipment_id',
  ticketId: 'ticket_id',
  invoiceId: 'invoice_id',
  quoteId: 'quote_id',
  contractId: 'contract_id',
  productId: 'product_id',
  categoryId: 'category_id',
  parentId: 'parent_id',
  ownerId: 'owner_id',
  assignedTo: 'assigned_to',
  createdBy: 'created_by',
  updatedBy: 'updated_by',
  deletedBy: 'deleted_by',
  businessOwner: 'business_owner',

  // Service/Equipment fields
  requestNumber: 'request_number',
  ticketNumber: 'ticket_number',
  invoiceNumber: 'invoice_number',
  quoteNumber: 'quote_number',
  contractNumber: 'contract_number',
  serialNumber: 'serial_number',
  modelNumber: 'model_number',
  partNumber: 'part_number',
  assetTag: 'asset_tag',

  equipmentMake: 'equipment_make',
  equipmentModel: 'equipment_model',
  equipmentType: 'equipment_type',
  equipmentStatus: 'equipment_status',

  serviceType: 'service_type',
  serviceStatus: 'service_status',
  serviceDate: 'service_date',

  // Request fields
  requestType: 'request_type',
  requestStatus: 'request_status',
  requestDate: 'request_date',
  requestedBy: 'requested_by',
  requestedDate: 'requested_date',

  // Business fields
  businessName: 'business_name',
  businessType: 'business_type',
  businessPhone: 'business_phone',
  businessEmail: 'business_email',
  businessAddress: 'business_address',

  companyName: 'company_name',
  companyType: 'company_type',

  // Names
  firstName: 'first_name',
  lastName: 'last_name',
  fullName: 'full_name',
  displayName: 'display_name',

  // Contact fields
  phoneNumber: 'phone_number',
  emailAddress: 'email_address',
  mobilePhone: 'mobile_phone',
  officePhone: 'office_phone',

  // Address fields
  streetAddress: 'street_address',
  addressLine1: 'address_line_1',
  addressLine2: 'address_line_2',
  cityName: 'city_name',
  stateName: 'state_name',
  zipCode: 'zip_code',
  postalCode: 'postal_code',
  countryCode: 'country_code',

  // Financial fields
  totalAmount: 'total_amount',
  subTotal: 'sub_total',
  taxAmount: 'tax_amount',
  discountAmount: 'discount_amount',
  unitPrice: 'unit_price',
  listPrice: 'list_price',
  salePrice: 'sale_price',
  costPrice: 'cost_price',
  dealerCost: 'dealer_cost',

  // Status/State fields
  isActive: 'is_active',
  isDeleted: 'is_deleted',
  isComplete: 'is_complete',
  isPaid: 'is_paid',
  isApproved: 'is_approved',
  isPublic: 'is_public',
  isEnabled: 'is_enabled',
  isFeatured: 'is_featured',

  // Survey/Portal fields
  templateName: 'template_name',
  questionText: 'question_text',
  answerText: 'answer_text',
  responseText: 'response_text',
  surveyType: 'survey_type',

  // Dates (estimation)
  dueDate: 'due_date',
  startDate: 'start_date',
  endDate: 'end_date',
  completionDate: 'completion_date',
  estimatedCompletionDate: 'estimated_completion_date',
  actualCompletionDate: 'actual_completion_date',

  // Other common patterns
  orderNumber: 'order_number',
  lineNumber: 'line_number',
  itemNumber: 'item_number',
  referenceNumber: 'reference_number',
  trackingNumber: 'tracking_number',
  confirmationNumber: 'confirmation_number',

  productType: 'product_type',
  productCode: 'product_code',
  productName: 'product_name',

  errorMessage: 'error_message',
  errorCode: 'error_code',

  metaData: 'meta_data',
  extraData: 'extra_data',
  customData: 'custom_data',

  isAdmin: 'is_admin',
  isOwner: 'is_owner',
  isManager: 'is_manager',

  accessLevel: 'access_level',
  permissionLevel: 'permission_level',

  notesText: 'notes_text',
  descriptionText: 'description_text',

  // More specific patterns
  modelCode: 'model_code',
  accessoryCode: 'accessory_code',
  specsJson: 'specs_json',
  marginPercentage: 'margin_percentage',
  itemType: 'item_type',
};

// Patterns that should NOT be converted (false positives)
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
  /mutationKey/,
  /refetchInterval/,
  /staleTime/,
  /cacheTime/,
  /gcTime/,
  /retry/,
  /enabled/,
  /placeholderData/,
  /keepPreviousData/,
];

function shouldExclude(line: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(line));
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, dist, build
      if (!['node_modules', 'dist', 'build', '.git'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function fixFile(filePath: string, applyFix: boolean = false): number {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let modifiedContent = content;
  let fixCount = 0;

  for (const [camelCase, snake_case] of Object.entries(COLUMN_PATTERNS)) {
    // Pattern 1: Object property access (obj.camelCase)
    const propertyAccessRegex = new RegExp(`\\.${camelCase}\\b`, 'g');

    // Pattern 2: Object destructuring ({ camelCase })
    const destructuringRegex = new RegExp(`\\{([^}]*\\b${camelCase}\\b[^}]*)\\}`, 'g');

    // Pattern 3: Property in object literal (camelCase: value)
    const objectLiteralRegex = new RegExp(`(\\b${camelCase}:)`, 'g');

    lines.forEach((line, index) => {
      if (shouldExclude(line)) return;

      // Check pattern 1: property access
      if (propertyAccessRegex.test(line)) {
        const newLine = line.replace(propertyAccessRegex, `.${snake_case}`);
        if (newLine !== line) {
          fixes.push({
            file: relative(process.cwd(), filePath),
            line: index + 1,
            column: line.indexOf(`.${camelCase}`),
            original: `.${camelCase}`,
            fixed: `.${snake_case}`,
            pattern: 'property-access',
          });
          fixCount++;
        }
      }
    });

    // Apply all pattern 1 fixes
    if (fixCount > 0) {
      modifiedContent = modifiedContent.replace(propertyAccessRegex, `.${snake_case}`);
    }
  }

  if (applyFix && fixCount > 0) {
    writeFileSync(filePath, modifiedContent, 'utf-8');
  }

  return fixCount;
}

async function main() {
  const args = process.argv.slice(2);
  const applyFix = args.includes('--apply');
  const specificFile = args.find((arg) => arg.startsWith('--file='))?.split('=')[1];

  console.log('🚀 Frontend Schema Fixer\n');
  console.log(
    applyFix
      ? '✏️  APPLY MODE - Changes will be saved'
      : '🔍 PREVIEW MODE - No changes will be made',
  );
  console.log('   Use --apply to actually apply fixes\n');

  // Create backup if applying fixes
  if (applyFix) {
    const backupDir = join(
      process.cwd(),
      'tests',
      'backups',
      new Date().toISOString().replace(/:/g, '-'),
    );
    mkdirSync(backupDir, { recursive: true });
    console.log(`💾 Creating backup at: ${backupDir}`);

    const clientSrc = join(process.cwd(), 'client', 'src');
    const backupPath = join(backupDir, 'client-src');
    cpSync(clientSrc, backupPath, { recursive: true });
    console.log('✅ Backup created\n');
  }

  // Get files to process
  let filesToProcess: string[];
  if (specificFile) {
    filesToProcess = [specificFile];
    console.log(`📄 Processing specific file: ${specificFile}\n`);
  } else {
    const clientSrc = join(process.cwd(), 'client', 'src');
    filesToProcess = getAllFiles(clientSrc).filter((f) => f.includes('client'));
    console.log(`📁 Found ${filesToProcess.length} files to process\n`);
  }

  // Process files
  console.log('🔍 Scanning and fixing files...\n');
  let totalFixes = 0;
  let filesModified = 0;

  for (const file of filesToProcess) {
    const fixCount = fixFile(file, applyFix);
    if (fixCount > 0) {
      filesModified++;
      totalFixes += fixCount;
      const relPath = relative(process.cwd(), file);
      console.log(`  ✅ ${relPath} (${fixCount} fixes)`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`📋 SUMMARY`);
  console.log(`============================================================`);
  console.log(`Mode:             ${applyFix ? 'APPLY' : 'PREVIEW'}`);
  console.log(`Files Scanned:    ${filesToProcess.length}`);
  console.log(`Files Modified:   ${filesModified}`);
  console.log(`Total Fixes:      ${totalFixes}`);
  console.log(`============================================================\n`);

  if (applyFix) {
    console.log('✅ Fixes applied successfully!\n');
    console.log('Next steps:');
    console.log('  1. Run: npm run check');
    console.log('  2. Test your application');
    console.log('  3. Commit if everything works\n');
  } else {
    console.log('💡 To apply these fixes, run:');
    console.log('   tsx scripts/fix-frontend-schema.ts --apply\n');
  }

  // Write detailed report
  if (fixes.length > 0) {
    const reportPath = join(process.cwd(), 'tests', 'frontend-schema-fix-report.json');
    writeFileSync(reportPath, JSON.stringify(fixes, null, 2));
    console.log(`📄 Detailed report: ${reportPath}`);
  }
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
