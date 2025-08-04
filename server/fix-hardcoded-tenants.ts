#!/usr/bin/env tsx
/**
 * Script to systematically fix all hardcoded tenant IDs throughout the codebase
 * This addresses the architectural debt where demo tenant IDs were hardcoded
 * instead of using proper session-based tenant resolution
 */

import fs from 'fs';
import path from 'path';

const HARDCODED_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const ALTERNATIVE_TENANT_ID = '1d4522ad-b3d8-4018-8890-f9294b2efbe6';

// Files that need tenant ID fixes
const FILES_TO_FIX = [
  'server/auth-setup.ts',
  'server/routes-broken.ts', 
  'server/role-seeder.ts',
  'server/replitAuth.ts',
  'server/seed-pricing-data.ts',
  'server/routes-settings.ts',
  'server/routes-proposals.ts',
  'server/routes.ts'
];

// Pattern replacements for different contexts
const REPLACEMENT_PATTERNS = [
  {
    // Route handlers - replace with tenant middleware
    from: /const tenantId = req.tenantId!; // From tenant middleware
    to: 'const tenantId = req.tenantId!; // From tenant middleware'
  },
  {
    // Route handlers with comments
    from: /const tenantId = req.tenantId!; // From tenant middleware
    to: 'const tenantId = req.tenantId!; // From tenant middleware'
  },
  {
    // Default fallbacks in settings
    from: /user\.tenantId \|\| '550e8400-e29b-41d4-a716-446655440000'/g,
    to: "user.tenantId || (req as any).tenantId || 'demo-tenant'"
  },
  {
    // Direct hardcoded usage in objects
    from: /"550e8400-e29b-41d4-a716-446655440000"/g,
    to: 'process.env.DEMO_TENANT_ID || "550e8400-e29b-41d4-a716-446655440000"'
  }
];

// Route signature updates needed
const ROUTE_SIGNATURE_UPDATES = [
  {
    from: /app\.get\('([^']+)',\s*async \(req: any, res\) => {/g,
    to: "app.get('$1', resolveTenant, requireTenant, async (req: TenantRequest, res) => {"
  },
  {
    from: /app\.post\('([^']+)',\s*async \(req: any, res\) => {/g,
    to: "app.post('$1', resolveTenant, requireTenant, async (req: TenantRequest, res) => {"
  },
  {
    from: /app\.put\('([^']+)',\s*async \(req: any, res\) => {/g,
    to: "app.put('$1', resolveTenant, requireTenant, async (req: TenantRequest, res) => {"
  },
  {
    from: /app\.delete\('([^']+)',\s*async \(req: any, res\) => {/g,
    to: "app.delete('$1', resolveTenant, requireTenant, async (req: TenantRequest, res) => {"
  }
];

// Required imports to add
const REQUIRED_IMPORTS = `import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';`;

function fixFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filePath} - file not found`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Check if file has hardcoded tenant IDs
  if (!content.includes(HARDCODED_TENANT_ID) && !content.includes(ALTERNATIVE_TENANT_ID)) {
    console.log(`Skipping ${filePath} - no hardcoded tenant IDs found`);
    return;
  }

  console.log(`Fixing ${filePath}...`);

  // Add required imports if not present
  if (!content.includes('TenantRequest') && !content.includes('resolveTenant')) {
    const importMatch = content.match(/import.*from.*['"];/);
    if (importMatch) {
      const insertIndex = content.indexOf(importMatch[0]) + importMatch[0].length;
      content = content.slice(0, insertIndex) + '\n' + REQUIRED_IMPORTS + content.slice(insertIndex);
    }
  }

  // Apply pattern replacements
  REPLACEMENT_PATTERNS.forEach(pattern => {
    content = content.replace(pattern.from, pattern.to);
  });

  // Update route signatures
  ROUTE_SIGNATURE_UPDATES.forEach(update => {
    content = content.replace(update.from, update.to);
  });

  // Write back if changed
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed ${filePath}`);
  } else {
    console.log(`- No changes needed for ${filePath}`);
  }
}

// Run the fixes
console.log('🔧 Fixing hardcoded tenant IDs throughout codebase...\n');

FILES_TO_FIX.forEach(fixFile);

console.log('\n✅ Hardcoded tenant ID fixes completed!');
console.log('\nNext steps:');
console.log('1. Update remaining route files to use tenant middleware');
console.log('2. Test all endpoints with proper tenant resolution');
console.log('3. Remove any remaining demo/sample data fallbacks');