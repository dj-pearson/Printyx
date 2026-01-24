#!/usr/bin/env tsx
/**
 * Data Transformation Auto-Fixer
 *
 * Automatically adds queryFn transformations to useQuery calls
 * that fetch from API endpoints.
 *
 * Usage: tsx tools/data-transformation-fixer.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const DRY_RUN = process.argv.includes('--dry-run');

interface Fix {
  file: string;
  line: number;
  original: string;
  fixed: string;
  type: string;
}

const fixes: Fix[] = [];

// Common field transformations
const FIELD_MAPPINGS: Record<string, string> = {
  first_name: 'firstName',
  last_name: 'lastName',
  company_id: 'companyId',
  tenant_id: 'tenantId',
  is_primary_contact: 'isPrimaryContact',
  is_primary: 'isPrimary',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  business_name: 'businessName',
  primary_contact: 'primaryContact',
  contact_id: 'contactId',
  business_record_type: 'businessRecordType',
  billing_address: 'billingAddress',
  billing_city: 'billingCity',
  billing_state: 'billingState',
  billing_zip: 'billingZip',
  phone_number: 'phoneNumber',
  email_address: 'emailAddress',
};

function generateTransformation(endpoint: string, fields: string[]): string {
  const transformations = fields
    .map((field) => {
      const camelField = FIELD_MAPPINGS[field] || field;
      return `        ${camelField}: c.${field}`;
    })
    .join(',\n');

  return `    queryFn: async () => {
      const response = await apiRequest('${endpoint}', 'GET');
      return (response || []).map((c: any) => ({
        id: c.id,
${transformations},
      }));
    },`;
}

async function fixFile(filePath: string): Promise<void> {
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find useQuery without queryFn
    if (line.includes('useQuery') && !line.includes('queryFn')) {
      // Look ahead for queryKey with /api/ endpoint
      const contextStart = i;
      const contextEnd = Math.min(i + 15, lines.length);
      const context = lines.slice(contextStart, contextEnd).join('\n');

      if (context.includes('queryKey') && context.includes('/api/')) {
        // Extract the API endpoint
        const apiMatch = context.match(/['"`](\/api\/[^'"`]+)['"`]/);
        if (apiMatch) {
          const endpoint = apiMatch[1];

          // Check if it already has queryFn in the context
          if (context.includes('queryFn:')) continue;

          // Find the line with queryKey
          let queryKeyLineIndex = i;
          for (let j = i; j < contextEnd; j++) {
            if (lines[j].includes('queryKey')) {
              queryKeyLineIndex = j;
              break;
            }
          }

          // Determine common fields for this endpoint type
          const fields = getFieldsForEndpoint(endpoint);

          if (fields.length > 0) {
            const transformation = generateTransformation(endpoint, fields);

            // Insert queryFn after queryKey line
            const indent = lines[queryKeyLineIndex].match(/^\s*/)?.[0] || '    ';
            const transformationLines = transformation.split('\n').map((l) => indent + l);

            lines.splice(queryKeyLineIndex + 1, 0, transformationLines.join('\n'));

            fixes.push({
              file: filePath,
              line: i + 1,
              original: line.trim(),
              fixed: transformation.split('\n')[0].trim(),
              type: 'add_query_fn',
            });

            modified = true;
          }
        }
      }
    }
  }

  if (modified && !DRY_RUN) {
    fs.writeFileSync(filePath, lines.join('\n'));
  }
}

function getFieldsForEndpoint(endpoint: string): string[] {
  if (endpoint.includes('contacts') || endpoint.includes('company-contacts')) {
    return [
      'first_name',
      'last_name',
      'email',
      'phone',
      'mobile',
      'title',
      'department',
      'is_primary_contact',
      'company_id',
    ];
  }

  if (endpoint.includes('companies')) {
    return [
      'business_name',
      'business_record_type',
      'billing_address',
      'billing_city',
      'billing_state',
      'billing_zip',
      'phone',
      'created_at',
      'updated_at',
    ];
  }

  if (endpoint.includes('customers') || endpoint.includes('business-records')) {
    return ['business_name', 'company_id', 'contact_id', 'tenant_id', 'created_at', 'updated_at'];
  }

  return [];
}

async function main() {
  console.log(`🔧 ${DRY_RUN ? 'DRY RUN - ' : ''}Fixing data transformation issues...\n`);

  const files = await glob('client/src/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/*.test.*'],
  });

  for (const file of files) {
    await fixFile(file);
  }

  console.log(`\n📊 Results:\n`);
  console.log(`Files scanned: ${files.length}`);
  console.log(`Fixes applied: ${fixes.length}\n`);

  if (fixes.length > 0) {
    console.log('Fixed files:\n');

    const byFile = fixes.reduce(
      (acc, fix) => {
        if (!acc[fix.file]) acc[fix.file] = [];
        acc[fix.file].push(fix);
        return acc;
      },
      {} as Record<string, Fix[]>,
    );

    Object.entries(byFile).forEach(([file, fileFixes]) => {
      console.log(`  ✅ ${path.relative(process.cwd(), file)} (${fileFixes.length} fixes)`);
    });
  }

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN - No files were modified');
    console.log('Run without --dry-run to apply fixes');
  } else {
    console.log('\n✅ Fixes applied! Review changes and test before committing.');
  }
}

main().catch(console.error);
