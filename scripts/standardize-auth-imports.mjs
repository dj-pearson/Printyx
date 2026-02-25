/**
 * Standardize auth middleware imports across all route files.
 *
 * This script:
 * 1. Removes inline requireAuth definitions
 * 2. Adds proper import from centralized location
 * 3. Adds getUserId/getTenantId imports where needed
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, '..', 'server');

// Inline requireAuth patterns to remove (multi-line)
const inlinePatterns = [
  // Pattern 1: const requireAuth = (req: any, res: any, next: any) => { ... };
  /\n?\/\/[^\n]*auth[^\n]*\n?const requireAuth\s*=\s*\(req:\s*any,\s*res:\s*any,\s*next:\s*any\)\s*=>\s*\{[^}]*\};\n?/gi,
  /const requireAuth\s*=\s*\(req:\s*any,\s*res:\s*any,\s*next:\s*any\)\s*=>\s*\{[^}]*\};\n?/gi,
  // Pattern 2: function requireAuth(req, res, next) { ... }
  /function requireAuth\s*\(req:\s*any,\s*res:\s*any,\s*next:\s*any\)\s*\{[^}]*\}\n?/gi,
];

// Files that need fixing (from audit)
const routeFiles = [];

function findRouteFiles(dir, prefix = '') {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && file === 'routes') {
      findRouteFiles(fullPath, 'routes/');
    } else if (file.endsWith('.ts') && (file.startsWith('routes-') || prefix === 'routes/')) {
      routeFiles.push(fullPath);
    }
  }
}

findRouteFiles(serverDir);

// Also add integrations/routes.ts
const integrationsRoutes = path.join(serverDir, 'integrations', 'routes.ts');
if (fs.existsSync(integrationsRoutes)) {
  routeFiles.push(integrationsRoutes);
}

let totalFixed = 0;
let totalFiles = 0;

for (const filePath of routeFiles) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  const relPath = path.relative(path.join(__dirname, '..'), filePath);
  const isSubDir = filePath.includes('/routes/');

  // Determine correct relative import paths
  const authImport = isSubDir
    ? `import { requireAuth } from '../replitAuth';`
    : `import { requireAuth } from './replitAuth';`;
  const helpersImport = isSubDir
    ? `import { getUserId, getTenantId } from '../utils/auth-helpers';`
    : `import { getUserId, getTenantId } from './utils/auth-helpers';`;

  let changed = false;

  // 1. Remove inline requireAuth definitions
  for (const pattern of inlinePatterns) {
    const before = content;
    content = content.replace(pattern, '\n');
    if (content !== before) changed = true;
  }

  // 2. Check if file already has a proper requireAuth import
  const hasRequireAuthImport = /import\s*\{[^}]*requireAuth[^}]*\}\s*from/.test(content);
  const hasRequireSupabaseAuth = /import\s*\{[^}]*requireSupabaseAuth[^}]*\}\s*from/.test(content);
  const usesRequireAuth = /requireAuth[^I]/.test(content); // Avoid matching requireAuthImport

  // 3. Replace incorrect import patterns with standardized import
  if (hasRequireAuthImport) {
    // Normalize: replace various import sources with replitAuth
    content = content.replace(
      /import\s*\{\s*requireAuth\s*\}\s*from\s*['"]\.\/auth-setup['"]\s*;?\n?/g,
      authImport + '\n'
    );
    // Leave replitAuth imports as-is (they're correct)
    // Leave supabase-auth aliased imports as-is (they're fine)
  }

  // 4. If inline was removed and no import exists, add one
  if (changed && !hasRequireAuthImport && !hasRequireSupabaseAuth && usesRequireAuth) {
    // Find the first import statement and add after it
    const firstImportMatch = content.match(/^import\s/m);
    if (firstImportMatch) {
      const idx = content.lastIndexOf('\nimport ');
      const nextNewline = content.indexOf('\n', idx + 1);
      if (nextNewline > -1) {
        // Find the end of all imports
        let lastImportEnd = 0;
        const importRegex = /^import\s[^]*?;\s*$/gm;
        let m;
        while ((m = importRegex.exec(content)) !== null) {
          lastImportEnd = m.index + m[0].length;
        }
        if (lastImportEnd > 0) {
          content = content.slice(0, lastImportEnd) + '\n' + authImport + content.slice(lastImportEnd);
        }
      }
    } else {
      // No imports at all, add at top
      content = authImport + '\n' + content;
    }
  }

  // 5. Add getUserId/getTenantId import if file uses req.user directly but doesn't have helpers
  const hasHelpersImport = /import.*getUserId.*from/.test(content) || /import.*getTenantId.*from/.test(content);
  const usesReqUser = /req\.user\b/.test(content);

  if (!hasHelpersImport && usesReqUser) {
    // Find the end of all imports
    let lastImportEnd = 0;
    const importRegex = /^import\s[^]*?;\s*$/gm;
    let m;
    while ((m = importRegex.exec(content)) !== null) {
      lastImportEnd = m.index + m[0].length;
    }
    if (lastImportEnd > 0) {
      content = content.slice(0, lastImportEnd) + '\n' + helpersImport + content.slice(lastImportEnd);
      changed = true;
    }
  }

  if (content !== originalContent) {
    // Clean up extra blank lines
    content = content.replace(/\n{4,}/g, '\n\n\n');
    fs.writeFileSync(filePath, content, 'utf-8');
    totalFixed++;
    console.log(`✅ Fixed: ${relPath}`);
  }
  totalFiles++;
}

console.log(`\nDone: ${totalFixed}/${totalFiles} files fixed`);
