#!/usr/bin/env tsx
/**
 * Convert to Snake Case Script
 * =============================
 * Converts camelCase property accesses to snake_case to match database schema.
 * This ensures consistency with the database column naming convention.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// Map of camelCase to snake_case - comprehensive list
const CAMEL_TO_SNAKE: Record<string, string> = {
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
  issuedAt: 'issued_at',
  resolvedAt: 'resolved_at',
  closedAt: 'closed_at',
  submittedAt: 'submitted_at',
  approvedAt: 'approved_at',
  rejectedAt: 'rejected_at',
  lastActivityAt: 'last_activity_at',
  lastContactAt: 'last_contact_at',
  nextFollowUpAt: 'next_follow_up_at',

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
  assignedToId: 'assigned_to_id',
  leadId: 'lead_id',
  dealId: 'deal_id',
  opportunityId: 'opportunity_id',
  proposalId: 'proposal_id',
  templateId: 'template_id',
  workflowId: 'workflow_id',
  articleId: 'article_id',
  surveyId: 'survey_id',
  responseId: 'response_id',
  vendorId: 'vendor_id',
  warehouseId: 'warehouse_id',
  technicianId: 'technician_id',
  assignedTechnicianId: 'assigned_technician_id',
  primaryContactId: 'primary_contact_id',
  billingContactId: 'billing_contact_id',
  serviceContactId: 'service_contact_id',

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
  orderNumber: 'order_number',
  poNumber: 'po_number',
  customerNumber: 'customer_number',
  accountNumber: 'account_number',

  equipmentMake: 'equipment_make',
  equipmentModel: 'equipment_model',
  equipmentType: 'equipment_type',
  equipmentStatus: 'equipment_status',
  equipmentLocation: 'equipment_location',
  equipmentSerialNumber: 'equipment_serial_number',

  serviceType: 'service_type',
  serviceStatus: 'service_status',
  serviceDate: 'service_date',
  servicePriority: 'service_priority',

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
  recordType: 'record_type',
  leadStatus: 'lead_status',
  leadSource: 'lead_source',
  leadScore: 'lead_score',

  companyName: 'company_name',
  companyType: 'company_type',
  companySize: 'company_size',

  // Names
  firstName: 'first_name',
  lastName: 'last_name',
  fullName: 'full_name',
  displayName: 'display_name',
  contactName: 'contact_name',
  customerName: 'customer_name',
  vendorName: 'vendor_name',
  technicianName: 'technician_name',

  // Contact fields
  phoneNumber: 'phone_number',
  emailAddress: 'email_address',
  mobilePhone: 'mobile_phone',
  officePhone: 'office_phone',
  contactPhone: 'contact_phone',
  contactEmail: 'contact_email',
  customerEmail: 'customer_email',
  customerPhone: 'customer_phone',

  // Address fields
  streetAddress: 'street_address',
  addressLine1: 'address_line_1',
  addressLine2: 'address_line_2',
  cityName: 'city_name',
  stateName: 'state_name',
  zipCode: 'zip_code',
  postalCode: 'postal_code',
  countryCode: 'country_code',
  billingAddress: 'billing_address',
  billingCity: 'billing_city',
  billingState: 'billing_state',
  billingZip: 'billing_zip',
  shippingAddress: 'shipping_address',
  shippingCity: 'shipping_city',
  shippingState: 'shipping_state',
  shippingZip: 'shipping_zip',

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
  estimatedAmount: 'estimated_amount',
  monthlyAmount: 'monthly_amount',
  annualAmount: 'annual_amount',
  basePrice: 'base_price',
  lineTotal: 'line_total',

  // Status/State fields
  isActive: 'is_active',
  isDeleted: 'is_deleted',
  isComplete: 'is_complete',
  isPaid: 'is_paid',
  isApproved: 'is_approved',
  isPublic: 'is_public',
  isEnabled: 'is_enabled',
  isFeatured: 'is_featured',
  isPrimary: 'is_primary',
  isPrimaryContact: 'is_primary_contact',
  isDefault: 'is_default',
  isArchived: 'is_archived',
  isLocked: 'is_locked',
  isVerified: 'is_verified',

  // Survey/Portal fields
  templateName: 'template_name',
  questionText: 'question_text',
  answerText: 'answer_text',
  responseText: 'response_text',
  surveyType: 'survey_type',
  overallScore: 'overall_score',
  npsScore: 'nps_score',

  // Dates
  dueDate: 'due_date',
  startDate: 'start_date',
  endDate: 'end_date',
  closeDate: 'close_date',
  completionDate: 'completion_date',
  estimatedCompletionDate: 'estimated_completion_date',
  actualCompletionDate: 'actual_completion_date',
  lastContactDate: 'last_contact_date',
  nextFollowUpDate: 'next_follow_up_date',
  customerSince: 'customer_since',
  expirationDate: 'expiration_date',
  renewalDate: 'renewal_date',
  issueDate: 'issue_date',

  // Other common patterns
  lineNumber: 'line_number',
  itemNumber: 'item_number',
  referenceNumber: 'reference_number',
  trackingNumber: 'tracking_number',
  confirmationNumber: 'confirmation_number',

  productType: 'product_type',
  productCode: 'product_code',
  productName: 'product_name',
  modelCode: 'model_code',
  accessoryCode: 'accessory_code',

  errorMessage: 'error_message',
  errorCode: 'error_code',

  metaData: 'meta_data',
  extraData: 'extra_data',
  customData: 'custom_data',
  specsJson: 'specs_json',

  isAdmin: 'is_admin',
  isOwner: 'is_owner',
  isManager: 'is_manager',

  accessLevel: 'access_level',
  permissionLevel: 'permission_level',
  roleLevel: 'role_level',
  roleId: 'role_id',
  roleName: 'role_name',

  notesText: 'notes_text',
  descriptionText: 'description_text',

  marginPercentage: 'margin_percentage',
  itemType: 'item_type',

  // Additional fields
  employeeCount: 'employee_count',
  annualRevenue: 'annual_revenue',
  invoiceStatus: 'invoice_status',
  paymentStatus: 'payment_status',
  paymentMethod: 'payment_method',
  paymentTerms: 'payment_terms',
  billingCycle: 'billing_cycle',
  invoiceNotes: 'invoice_notes',
  internalNotes: 'internal_notes',
  publicNotes: 'public_notes',
  customerNotes: 'customer_notes',
};

// Patterns to exclude from conversion (React/JS patterns, not DB columns)
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
  /onLoad/,
  /onBlur/,
  /onFocus/,
  /onKeyDown/,
  /onKeyUp/,
  /onMouseDown/,
  /onMouseUp/,
  /onMouseEnter/,
  /onMouseLeave/,
  /useState/,
  /useEffect/,
  /useCallback/,
  /useMemo/,
  /useRef/,
  /useContext/,
  /useQuery/,
  /useMutation/,
  /useForm/,
  /queryKey/,
  /queryFn/,
  /mutationFn/,
  /mutationKey/,
  /refetchInterval/,
  /staleTime/,
  /cacheTime/,
  /gcTime/,
  /placeholderData/,
  /keepPreviousData/,
  /defaultValue/,
  /defaultValues/,
  /formState/,
  /isLoading/,
  /isError/,
  /isSuccess/,
  /isPending/,
  /isFetching/,
  /htmlFor/,
  /tabIndex/,
  /colSpan/,
  /rowSpan/,
  /maxLength/,
  /minLength/,
  /readOnly/,
  /autoComplete/,
  /autoFocus/,
  /spellCheck/,
  /contentEditable/,
  /ariaLabel/,
  /ariaHidden/,
  /ariaDescribedBy/,
  /dataTestId/,
  /viewBox/,
  /fillRule/,
  /clipRule/,
  /strokeWidth/,
  /strokeLinecap/,
  /strokeLinejoin/,
  /textAnchor/,
  /dominantBaseline/,
  /alignItems/,
  /justifyContent/,
  /flexDirection/,
  /flexWrap/,
  /flexGrow/,
  /flexShrink/,
  /gridColumn/,
  /gridRow/,
  /zIndex/,
  /boxShadow/,
  /borderRadius/,
  /backgroundColor/,
  /textDecoration/,
  /fontWeight/,
  /fontSize/,
  /lineHeight/,
  /letterSpacing/,
  /textTransform/,
  /whiteSpace/,
  /wordBreak/,
  /overflowX/,
  /overflowY/,
  /scrollBehavior/,
  /pointerEvents/,
  /userSelect/,
  /objectFit/,
  /objectPosition/,
  /aspectRatio/,
  /animationDuration/,
  /animationDelay/,
  /transitionDuration/,
  /transitionDelay/,
  // Form field names that should stay camelCase
  /register\(/,
  /setValue\(/,
  /getValues\(/,
  /watch\(/,
  /control\./,
  /errors\./,
  // TypeScript type definitions
  /interface\s+\w+/,
  /type\s+\w+\s*=/,
  /:\s*\{/,
  // Import statements
  /^import\s/,
  /from\s+['"]/,
  // Export statements with type
  /export\s+type/,
  /export\s+interface/,
];

// Files/directories to skip
const SKIP_PATHS = ['node_modules', 'dist', 'build', '.git', 'tests/backups', '.storybook'];

function shouldExcludeLine(line: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(line));
}

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

function fixFile(filePath: string, dryRun: boolean = true): { fixes: number; details: string[] } {
  let content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let fixCount = 0;
  const details: string[] = [];

  for (const [camelCase, snakeCase] of Object.entries(CAMEL_TO_SNAKE)) {
    // Pattern: Property access (.camelCase)
    const propertyAccessRegex = new RegExp(`\\.${camelCase}\\b(?!\\s*[:(])`, 'g');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip lines that match exclude patterns
      if (shouldExcludeLine(line)) continue;

      // Skip type definition lines
      if (
        line.includes(`: ${camelCase}`) ||
        line.includes(`${camelCase}:`) ||
        line.includes(`${camelCase}?:`)
      )
        continue;

      // Skip destructuring patterns
      if (line.match(new RegExp(`\\{[^}]*\\b${camelCase}\\b[^}]*\\}`))) continue;

      if (line.includes(`.${camelCase}`)) {
        const matches = line.match(propertyAccessRegex);
        if (matches) {
          matches.forEach(() => {
            details.push(`  Line ${i + 1}: .${camelCase} -> .${snakeCase}`);
            fixCount++;
          });
        }
      }
    }

    // Apply fixes
    content = content.replace(propertyAccessRegex, `.${snakeCase}`);
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
  const specificFile = args.find((arg) => arg.startsWith('--file='))?.split('=')[1];

  console.log('='.repeat(60));
  console.log('Convert to Snake Case Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview)' : 'APPLY (making changes)'}`);
  console.log('');

  let filesToProcess: string[];

  if (specificFile) {
    filesToProcess = [specificFile];
    console.log(`Processing specific file: ${specificFile}`);
  } else {
    // Get all TypeScript files in client/src and server
    const clientFiles = getAllFiles(join(process.cwd(), 'client', 'src'));
    const serverFiles = getAllFiles(join(process.cwd(), 'server'));
    filesToProcess = [...clientFiles, ...serverFiles];
    console.log(`Found ${filesToProcess.length} files to process`);
  }

  console.log('');

  let totalFixes = 0;
  let filesModified = 0;

  for (const file of filesToProcess) {
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
  console.log(`Files processed: ${filesToProcess.length}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Total fixes: ${totalFixes}`);
  console.log('');

  if (dryRun) {
    console.log('To apply these changes, run:');
    console.log('  npx tsx scripts/convert-to-snake-case.ts --apply');
  } else {
    console.log('Changes applied successfully!');
    console.log('Run npm run check to verify.');
  }
}

main().catch(console.error);
