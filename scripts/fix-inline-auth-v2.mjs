/**
 * Fix inline requireAuth definitions that span multiple lines.
 * Uses brace matching to find the full function body.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, '..', 'server');

const targetFiles = [
  'routes-admin-workflows.ts',
  'routes-ai-analytics.ts',
  'routes-ai-gpt5.ts',
  'routes-business-process-optimization.ts',
  'routes-client-metrics.ts',
  'routes-company-ids.ts',
  'routes-content-marketing.ts',
  'routes-contract-alerts.ts',
  'routes-customer-numbers.ts',
  'routes-customer-portal.ts',
  'routes-device-monitoring.ts',
  'routes-documents.ts',
  'routes-enhanced-rbac.ts',
  'routes-erp-integration.ts',
  'routes-incident-response.ts',
  'routes-integration-hub.ts',
  'routes-knowledge-base.ts',
  'routes-mobile.ts',
  'routes-onboarding.ts',
  'routes-operations-extended.ts',
  'routes-predictive-analytics.ts',
  'routes-predictive-maintenance-hub.ts',
  'routes-print-cost-calculator.ts',
  'routes-proactive-maintenance.ts',
  'routes-proposals.ts',
  'routes-reporting-architecture.ts',
  'routes-root-admin.ts',
  'routes-seo.ts',
  'routes-tasks.ts',
  'routes-tenant-onboarding.ts',
  'routes-user-lifecycle.ts',
  'routes-workflow-automation.ts',
  'routes/article-bookmarks-routes.ts',
  'routes/article-ratings-routes.ts',
  'routes/content-gap-analysis-routes.ts',
  'routes/knowledge-base-admin-routes.ts',
  'routes/reading-history-routes.ts',
];

function removeFunctionBlock(content, startMarker) {
  const idx = content.indexOf(startMarker);
  if (idx === -1) return content;

  // Find the opening brace of the arrow function body
  const arrowIdx = content.indexOf('=>', idx);
  if (arrowIdx === -1) return content;

  const braceStart = content.indexOf('{', arrowIdx);
  if (braceStart === -1) return content;

  // Match braces to find the end
  let depth = 0;
  let i = braceStart;
  while (i < content.length) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }

  // Find the end including the semicolon
  let end = i + 1;
  while (end < content.length && (content[end] === ';' || content[end] === '\n')) {
    end++;
  }

  // Find the start of the line (include comments on line above)
  let start = idx;
  // Go back to start of line
  while (start > 0 && content[start - 1] !== '\n') start--;
  // Check if previous line is a comment about auth
  const prevLineEnd = start - 1;
  if (prevLineEnd > 0) {
    let prevLineStart = prevLineEnd;
    while (prevLineStart > 0 && content[prevLineStart - 1] !== '\n') prevLineStart--;
    const prevLine = content.slice(prevLineStart, prevLineEnd + 1).trim();
    if (prevLine.startsWith('//') && /auth/i.test(prevLine)) {
      start = prevLineStart;
    }
  }

  return content.slice(0, start) + content.slice(end);
}

let fixed = 0;

for (const relFile of targetFiles) {
  const filePath = path.join(serverDir, relFile);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Not found: ${relFile}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  const isSubDir = relFile.startsWith('routes/');

  // Remove inline requireAuth
  content = removeFunctionBlock(content, 'const requireAuth');

  if (content === original) {
    console.log(`⏭  No change: ${relFile}`);
    continue;
  }

  // Check if file still uses requireAuth
  const usesRequireAuth = /\brequireAuth\b/.test(content);

  // Check if proper import exists
  const hasImport = /import\s*\{[^}]*requireAuth[^}]*\}\s*from/.test(content);

  if (usesRequireAuth && !hasImport) {
    // Add import after last import line
    const authImport = isSubDir
      ? `import { requireAuth } from '../replitAuth';`
      : `import { requireAuth } from './replitAuth';`;

    let lastImportEnd = 0;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ') || lines[i].match(/^import\s*\{/)) {
        // Find the end of this import (might be multi-line)
        let j = i;
        while (j < lines.length && !lines[j].includes(';')) j++;
        lastImportEnd = j + 1;
      }
    }

    if (lastImportEnd > 0) {
      lines.splice(lastImportEnd, 0, authImport);
      content = lines.join('\n');
    } else {
      content = authImport + '\n' + content;
    }
  }

  // Clean up extra blank lines
  content = content.replace(/\n{4,}/g, '\n\n\n');

  fs.writeFileSync(filePath, content, 'utf-8');
  fixed++;
  console.log(`✅ Fixed: ${relFile}`);
}

console.log(`\nDone: ${fixed} files fixed`);
