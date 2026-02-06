/**
 * Bulk replace console.log/error/warn with structured logger
 * across server/ directory.
 *
 * Usage: node scripts/replace-console-with-logger.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');

const DRY_RUN = process.argv.includes('--dry-run');

// Files/directories to exclude
const EXCLUDE_PATHS = [
  'server/vite.ts',
  'server/tests/',
  'server/lib/logger.ts', // Don't modify the logger itself
  'server/lib/db-logger.ts', // DB logger uses console intentionally
];

function shouldExclude(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  return EXCLUDE_PATHS.some(ex => rel === ex || rel.startsWith(ex));
}

function getAllTsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function getRelativeImportPath(filePath) {
  const fileDir = path.dirname(filePath);
  let rel = path.relative(fileDir, path.join(SERVER_DIR, 'lib', 'logger')).replace(/\\/g, '/');
  if (!rel.startsWith('.')) {
    rel = './' + rel;
  }
  return rel;
}

function getModuleName(filePath) {
  const rel = path.relative(SERVER_DIR, filePath).replace(/\\/g, '/');
  // Strip .ts extension and create a clean module name
  let name = rel.replace(/\.ts$/, '');
  // For files like routes-foo.ts -> routes-foo
  // For files like services/foo-service.ts -> foo-service
  // Just use the filename without extension
  name = path.basename(name);
  return name;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Check if file has any console.log/error/warn
  if (!/console\.(log|error|warn)\s*\(/.test(content)) {
    return { changed: false, replacements: 0 };
  }

  // Check if file already imports createModuleLogger
  const hasLoggerImport = /import\s+.*createModuleLogger.*from/.test(content);
  const hasLogDecl = /const\s+log\s*=\s*createModuleLogger/.test(content);

  // Count replacements
  let replacements = 0;

  // Replace console.log -> log.info
  content = content.replace(/console\.log\s*\(/g, () => {
    replacements++;
    return 'log.info(';
  });

  // Replace console.error -> log.error
  content = content.replace(/console\.error\s*\(/g, () => {
    replacements++;
    return 'log.error(';
  });

  // Replace console.warn -> log.warn
  content = content.replace(/console\.warn\s*\(/g, () => {
    replacements++;
    return 'log.warn(';
  });

  if (replacements === 0) {
    return { changed: false, replacements: 0 };
  }

  // Add logger import if not present
  if (!hasLoggerImport) {
    const importPath = getRelativeImportPath(filePath);
    const moduleName = getModuleName(filePath);
    const importLine = `import { createModuleLogger } from '${importPath}';`;
    const logLine = `const log = createModuleLogger('${moduleName}');`;

    // Find a good place to insert the import
    // After existing imports, or at the top of the file
    const lines = content.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Track last import statement
      if (line.startsWith('import ') || (lastImportIndex >= 0 && (line.startsWith('} from') || line.endsWith("from '") || /^\s*['"]/.test(line)))) {
        // Check if this line or a continuation ends an import
        if (line.includes(' from ') || line.includes("from '") || line.includes('from "')) {
          lastImportIndex = i;
        }
      }
      // Handle multi-line imports
      if (lastImportIndex >= 0 && i > lastImportIndex && !line.startsWith('import ') && !line.startsWith('}') && line !== '' && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
        break;
      }
    }

    if (lastImportIndex >= 0) {
      // Insert after the last import
      lines.splice(lastImportIndex + 1, 0, importLine);
      if (!hasLogDecl) {
        lines.splice(lastImportIndex + 2, 0, logLine);
        lines.splice(lastImportIndex + 3, 0, '');
      }
    } else {
      // No imports found, add at the very top (after any leading comments/shebang)
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('/**') || line.startsWith(' *') || line.startsWith('*/') || line.startsWith('//') || line === '' || line.startsWith('#!')) {
          insertIndex = i + 1;
        } else {
          break;
        }
      }
      lines.splice(insertIndex, 0, '', importLine, logLine, '');
    }

    content = lines.join('\n');
  } else if (!hasLogDecl) {
    // Has import but no log declaration - add it after the import
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('createModuleLogger') && lines[i].includes('import')) {
        const moduleName = getModuleName(filePath);
        lines.splice(i + 1, 0, `const log = createModuleLogger('${moduleName}');`);
        break;
      }
    }
    content = lines.join('\n');
  }

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  return { changed: true, replacements };
}

// Main
console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Processing server/ directory...`);

const files = getAllTsFiles(SERVER_DIR);
let totalFiles = 0;
let totalReplacements = 0;
const changedFiles = [];

for (const file of files) {
  if (shouldExclude(file)) continue;

  const { changed, replacements } = processFile(file);
  if (changed) {
    totalFiles++;
    totalReplacements += replacements;
    changedFiles.push({ file: path.relative(ROOT, file).replace(/\\/g, '/'), replacements });
  }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Summary:`);
console.log(`  Files modified: ${totalFiles}`);
console.log(`  Total replacements: ${totalReplacements}`);

if (changedFiles.length > 0 && changedFiles.length <= 50) {
  console.log(`\nChanged files:`);
  for (const { file, replacements } of changedFiles) {
    console.log(`  ${file} (${replacements} replacements)`);
  }
} else if (changedFiles.length > 50) {
  console.log(`\nTop 20 changed files:`);
  changedFiles.sort((a, b) => b.replacements - a.replacements);
  for (const { file, replacements } of changedFiles.slice(0, 20)) {
    console.log(`  ${file} (${replacements} replacements)`);
  }
  console.log(`  ... and ${changedFiles.length - 20} more files`);
}
