/**
 * Page Error Audit Script
 *
 * Crawls all application pages and logs console/network errors.
 * Run with: npx playwright test scripts/page-error-audit.ts --reporter=html
 * Or standalone: npx tsx scripts/page-error-audit.ts
 */

import { chromium, Browser, Page, ConsoleMessage, Response } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TIMEOUT = 15000; // 15 seconds per page
const OUTPUT_DIR = './audit-reports';
const CAPTURE_WARNINGS = process.env.CAPTURE_WARNINGS === 'true';

// All routes organized by auth requirement
const ROUTES = {
  // Public routes (no auth needed)
  public: [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/eula',
    '/privacy',
    '/terms',
    '/accessibility',
    '/p/copier-dealer-crm',
    '/p/print-service-dispatch-mobile',
    '/p/master-product-catalog-canon-imagerunner',
    '/predictive-intelligence',
    '/modern-architecture',
    '/integration-marketplace',
    '/dealer-expertise',
    '/roi-calculator',
    '/case-studies',
    '/battle-card',
    '/blog',
    '/blog/ai-predictive-maintenance-vs-reactive-service',
    '/blog/e-automate-vs-modern-cloud-platforms',
    '/blog/dynamic-pricing-ai-copier-dealers',
  ],

  // Authenticated routes (need localStorage auth)
  authenticated: [
    '/today',
    '/dashboard/today',
    '/crm',
    '/customers',
    '/business-records',
    '/contacts',
    '/company-contacts',
    '/leads-management',
    '/deals',
    '/opportunities',
    '/deals-management',
    '/sales-pipeline',
    '/sales-pipeline-workflow',
    '/sales-pipeline-forecasting',
    '/sales/command-center',
    '/quotes',
    '/quotes/new',
    '/quote-proposal-generation',
    '/proposal-builder',
    '/deal-desk',
    '/deal-desk/rules',
    '/pipeline-config',
    '/equipment-lifecycle',
    '/preventive-maintenance',
    '/preventive-maintenance-hub',
    '/preventive-maintenance-automation',
    '/proactive-service',
    '/service-dispatch',
    '/product-hub',
    '/product-catalog',
    '/product-management-hub',
    '/product-models',
    '/product-models-v2',
    '/product-accessories',
    '/enhanced-product-accessories',
    '/professional-services',
    '/service-products',
    '/software-products',
    '/supplies',
    '/managed-services',
    '/inventory',
    '/pricing',
    '/pricing/settings',
    '/pricing/margin-report',
    '/pricing/approvals',
    '/billing',
    '/meter-billing',
    '/meter-readings',
    '/advanced-billing',
    '/advanced-billing-engine',
    '/billing-rules',
    '/billing-analytics',
    '/pricing-management',
    '/pricing-settings',
    '/vendors',
    '/vendor-management',
    '/accounts-payable',
    '/accounts-receivable',
    '/chart-of-accounts',
    '/journal-entries',
    '/financial-forecasting',
    '/commission-management',
    '/reports',
    '/reports/custom/new',
    '/custom-dashboard',
    '/advanced-reporting',
    '/advanced-analytics',
    '/advanced-analytics-dashboard',
    '/scheduled-reports',
    '/service-analytics',
    '/task-hub',
    '/tasks',
    '/workflow-automation',
    '/technician-management',
    '/vehicle-management',
    '/asset-management',
    '/mobile-field-service',
    '/mobile-field-operations',
    '/remote-monitoring',
    '/fleet-monitoring',
    '/service-hub',
    '/customer-portal',
    '/customer-self-service-portal',
    '/customer-success-management',
    '/customer-success',
    '/leases',
    '/leases/new',
    '/data-enrichment',
    '/quickbooks-integration',
    '/apollo-leads',
    '/integrations',
    '/integration-hub',
    '/system-integrations',
    '/erp-integration',
    '/esignature-integration',
    '/manufacturer-integration',
    '/manufacturer-integration/devices',
    '/manufacturer-integration/audit',
    '/autopilot',
    '/auto-lead-routing',
    '/predictive-service-dispatch',
    '/connect',
    '/white-label',
    '/auto-supply-replenishment',
    '/contract-renewal-autopilot',
    '/compare-eautomate',
    '/meeting-to-proposal',
    '/document-builder',
    '/document-management',
    '/contracts',
    '/contract-renewals',
    '/ai-hub',
    '/ai-employees',
    '/ai-search',
    '/conversational-ai-dashboard',
    '/gpt5-dashboard',
    '/predictive-analytics',
    '/predictive-contract-profitability',
    '/ai-service-intelligence',
    '/ai-analytics-dashboard',
    '/calendar',
    '/meeting-transcription',
    '/demo-scheduling',
    '/settings',
    '/settings/subscription',
    '/settings/billing',
    '/tenant-setup',
    '/platform-configuration',
    '/monitoring-clients',
    '/device-monitoring',
    '/oid-management',
    '/mobile-optimization',
    '/performance-monitoring',
    '/system-monitoring',
    '/deployment-readiness',
    '/knowledge-base',
    '/import',
    '/onboarding',
    '/onboarding/new',
    '/onboarding/enhanced',
    '/role-management',
  ],

  // Admin routes (require elevated permissions)
  admin: [
    '/admin-hub',
    '/admin-command-center',
    '/admin/root-admin-security',
    '/admin/system-security',
    '/admin/database-updater',
    '/admin/tenant-management',
    '/admin/user-management',
    '/admin/system-settings',
    '/admin/platform-analytics',
    '/admin/knowledge-base',
    '/admin/knowledge-base/new',
    '/root-admin-dashboard',
    '/root-admin-signups-crm',
    '/root-admin/seo',
    '/seo',
    '/platform-crm',
    '/platform-crm/dashboard',
    '/platform-crm/business-records',
    '/platform-crm/pipeline',
    '/platform-crm/territories',
    '/platform-crm/lead-scoring',
    '/platform-crm/assignment-rules',
    '/platform-crm/customer-success',
    '/platform-crm/analytics',
    '/platform-crm/cohort-analysis',
    '/security-compliance-management',
    '/incident-response',
    '/incident-response-system',
    '/business-process-optimization',
    '/database-management',
  ],
};

// Error types
interface ConsoleError {
  type: 'error' | 'warning';
  text: string;
  location?: string;
}

interface NetworkError {
  status: number;
  url: string;
  method: string;
  statusText: string;
}

interface PageResult {
  route: string;
  category: 'public' | 'authenticated' | 'admin';
  loadTime: number;
  consoleErrors: ConsoleError[];
  networkErrors: NetworkError[];
  crashed: boolean;
  errorMessage?: string;
}

interface AuditReport {
  timestamp: string;
  baseUrl: string;
  totalPages: number;
  pagesWithErrors: number;
  totalConsoleErrors: number;
  totalNetworkErrors: number;
  results: PageResult[];
  summary: {
    errorsByRoute: { route: string; errorCount: number }[];
    commonErrors: { error: string; count: number; routes: string[] }[];
  };
}

class PageAuditor {
  private browser: Browser | null = null;
  private results: PageResult[] = [];

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
    });

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private async setupAuthenticatedPage(page: Page): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('demo-authenticated', 'true');
      localStorage.setItem('demo-tenant-id', '550e8400-e29b-41d4-a716-446655440000');
      localStorage.setItem('demo-user-role', 'platform_admin');
      localStorage.setItem('demo-user-id', 'audit-user-001');
    });
  }

  private async auditPage(
    route: string,
    category: 'public' | 'authenticated' | 'admin',
  ): Promise<PageResult> {
    const context = await this.browser!.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();
    const consoleErrors: ConsoleError[] = [];
    const networkErrors: NetworkError[] = [];
    let crashed = false;
    let errorMessage: string | undefined;

    // Set up auth for protected routes
    if (category !== 'public') {
      await this.setupAuthenticatedPage(page);
    }

    // Listen for console messages
    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      if (type === 'error') {
        consoleErrors.push({
          type: 'error',
          text: msg.text(),
          location: msg.location()?.url,
        });
      } else if (CAPTURE_WARNINGS && type === 'warning') {
        consoleErrors.push({
          type: 'warning',
          text: msg.text(),
          location: msg.location()?.url,
        });
      }
    });

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', (error: Error) => {
      consoleErrors.push({
        type: 'error',
        text: `Uncaught: ${error.message}`,
        location: error.stack?.split('\n')[1]?.trim(),
      });
    });

    // Listen for network responses
    page.on('response', (response: Response) => {
      const status = response.status();
      // Capture 4xx and 5xx errors, excluding expected cases
      if (status >= 400) {
        const url = response.url();
        // Skip favicon and other non-critical assets
        if (!url.includes('favicon') && !url.includes('.map')) {
          networkErrors.push({
            status,
            url,
            method: response.request().method(),
            statusText: response.statusText(),
          });
        }
      }
    });

    const startTime = Date.now();

    try {
      await page.goto(`${BASE_URL}${route}`, {
        waitUntil: 'networkidle',
        timeout: TIMEOUT,
      });

      // Wait a bit more for any async content
      await page.waitForTimeout(1000);
    } catch (error) {
      crashed = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    const loadTime = Date.now() - startTime;

    await context.close();

    return {
      route,
      category,
      loadTime,
      consoleErrors,
      networkErrors,
      crashed,
      errorMessage,
    };
  }

  async auditAllPages(): Promise<void> {
    console.log('\n🔍 Starting Page Error Audit\n');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Capture Warnings: ${CAPTURE_WARNINGS}`);
    console.log('─'.repeat(50));

    // Audit public routes
    console.log('\n📄 Auditing Public Pages...');
    for (const route of ROUTES.public) {
      process.stdout.write(`  ${route}...`);
      const result = await this.auditPage(route, 'public');
      this.results.push(result);
      this.printResultSummary(result);
    }

    // Audit authenticated routes
    console.log('\n🔐 Auditing Authenticated Pages...');
    for (const route of ROUTES.authenticated) {
      process.stdout.write(`  ${route}...`);
      const result = await this.auditPage(route, 'authenticated');
      this.results.push(result);
      this.printResultSummary(result);
    }

    // Audit admin routes
    console.log('\n👑 Auditing Admin Pages...');
    for (const route of ROUTES.admin) {
      process.stdout.write(`  ${route}...`);
      const result = await this.auditPage(route, 'admin');
      this.results.push(result);
      this.printResultSummary(result);
    }
  }

  private printResultSummary(result: PageResult): void {
    const errorCount = result.consoleErrors.length + result.networkErrors.length;
    if (result.crashed) {
      console.log(` ❌ CRASHED (${result.errorMessage})`);
    } else if (errorCount > 0) {
      console.log(` ⚠️  ${errorCount} error(s) (${result.loadTime}ms)`);
    } else {
      console.log(` ✅ OK (${result.loadTime}ms)`);
    }
  }

  generateReport(): AuditReport {
    const pagesWithErrors = this.results.filter(
      (r) => r.consoleErrors.length > 0 || r.networkErrors.length > 0 || r.crashed,
    );

    const totalConsoleErrors = this.results.reduce((sum, r) => sum + r.consoleErrors.length, 0);

    const totalNetworkErrors = this.results.reduce((sum, r) => sum + r.networkErrors.length, 0);

    // Find common errors
    const errorMap = new Map<string, { count: number; routes: string[] }>();
    for (const result of this.results) {
      for (const err of result.consoleErrors) {
        // Normalize error text (remove line numbers, etc.)
        const normalized = err.text.replace(/:\d+:\d+/g, '').substring(0, 100);
        const existing = errorMap.get(normalized);
        if (existing) {
          existing.count++;
          if (!existing.routes.includes(result.route)) {
            existing.routes.push(result.route);
          }
        } else {
          errorMap.set(normalized, { count: 1, routes: [result.route] });
        }
      }
    }

    const commonErrors = Array.from(errorMap.entries())
      .map(([error, data]) => ({ error, ...data }))
      .filter((e) => e.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const errorsByRoute = this.results
      .map((r) => ({
        route: r.route,
        errorCount: r.consoleErrors.length + r.networkErrors.length + (r.crashed ? 1 : 0),
      }))
      .filter((r) => r.errorCount > 0)
      .sort((a, b) => b.errorCount - a.errorCount);

    return {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      totalPages: this.results.length,
      pagesWithErrors: pagesWithErrors.length,
      totalConsoleErrors,
      totalNetworkErrors,
      results: this.results,
      summary: {
        errorsByRoute,
        commonErrors,
      },
    };
  }

  async saveReport(report: AuditReport): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(OUTPUT_DIR, `audit-${timestamp}.json`);
    const mdPath = path.join(OUTPUT_DIR, `audit-${timestamp}.md`);

    // Save JSON report
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Generate Markdown report
    const md = this.generateMarkdownReport(report);
    fs.writeFileSync(mdPath, md);

    // Also save as latest
    fs.writeFileSync(path.join(OUTPUT_DIR, 'audit-latest.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(OUTPUT_DIR, 'audit-latest.md'), md);

    return mdPath;
  }

  private generateMarkdownReport(report: AuditReport): string {
    let md = `# Page Error Audit Report

**Generated:** ${report.timestamp}
**Base URL:** ${report.baseUrl}

## Summary

| Metric | Value |
|--------|-------|
| Total Pages Audited | ${report.totalPages} |
| Pages with Errors | ${report.pagesWithErrors} |
| Total Console Errors | ${report.totalConsoleErrors} |
| Total Network Errors | ${report.totalNetworkErrors} |

## Routes with Most Errors

| Route | Error Count |
|-------|-------------|
${report.summary.errorsByRoute
  .slice(0, 20)
  .map((r) => `| \`${r.route}\` | ${r.errorCount} |`)
  .join('\n')}

## Common Errors (appearing on multiple pages)

${report.summary.commonErrors
  .map(
    (e) => `### ${e.error.substring(0, 80)}...
- **Occurrences:** ${e.count}
- **Routes:** ${e.routes
      .slice(0, 5)
      .map((r) => `\`${r}\``)
      .join(', ')}${e.routes.length > 5 ? ` and ${e.routes.length - 5} more` : ''}
`,
  )
  .join('\n')}

## Detailed Results

### Pages with Errors

${report.results
  .filter((r) => r.consoleErrors.length > 0 || r.networkErrors.length > 0 || r.crashed)
  .map(
    (r) => `#### \`${r.route}\` (${r.category})
- **Load Time:** ${r.loadTime}ms
- **Crashed:** ${r.crashed ? `Yes - ${r.errorMessage}` : 'No'}

${
  r.consoleErrors.length > 0
    ? `**Console Errors:**
${r.consoleErrors.map((e) => `- [${e.type}] ${e.text.substring(0, 200)}`).join('\n')}
`
    : ''
}
${
  r.networkErrors.length > 0
    ? `**Network Errors:**
${r.networkErrors.map((e) => `- [${e.status}] ${e.method} ${e.url}`).join('\n')}
`
    : ''
}
`,
  )
  .join('\n---\n')}

## All Results

| Route | Category | Load Time | Console Errors | Network Errors | Status |
|-------|----------|-----------|----------------|----------------|--------|
${report.results
  .map(
    (r) =>
      `| \`${r.route}\` | ${r.category} | ${r.loadTime}ms | ${r.consoleErrors.length} | ${r.networkErrors.length} | ${r.crashed ? '❌ Crashed' : r.consoleErrors.length + r.networkErrors.length > 0 ? '⚠️ Errors' : '✅ OK'} |`,
  )
  .join('\n')}
`;

    return md;
  }
}

// Main execution
async function main(): Promise<void> {
  const auditor = new PageAuditor();

  try {
    await auditor.init();
    await auditor.auditAllPages();

    const report = auditor.generateReport();
    const reportPath = await auditor.saveReport(report);

    console.log('\n' + '═'.repeat(50));
    console.log('📊 AUDIT COMPLETE');
    console.log('═'.repeat(50));
    console.log(`\nTotal Pages: ${report.totalPages}`);
    console.log(`Pages with Errors: ${report.pagesWithErrors}`);
    console.log(`Console Errors: ${report.totalConsoleErrors}`);
    console.log(`Network Errors: ${report.totalNetworkErrors}`);
    console.log(`\nReport saved to: ${reportPath}`);

    // Exit with error code if there were errors
    if (report.pagesWithErrors > 0) {
      console.log('\n⚠️  Some pages have errors. Review the report for details.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Audit failed:', error);
    process.exit(1);
  } finally {
    await auditor.close();
  }
}

main();
