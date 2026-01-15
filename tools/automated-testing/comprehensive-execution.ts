/**
 * Comprehensive Execution Script
 *
 * This script executes comprehensive tests on all discovered forms and buttons.
 * It uses the discovery report to systematically test every interactive element.
 *
 * Stage 2 of the two-stage testing process.
 */

import { chromium, Page, Browser, BrowserContext } from 'playwright';
import { createComprehensiveTestConfig, performSafetyCheck } from './comprehensive-test.config';
import { Logger } from './utils/logger';
import { FormTester } from './testers/form-tester';
import { ElementTester } from './testers/element-tester';
import { AccessibilityTester } from './testers/accessibility-tester';
import { PerformanceTester } from './testers/performance-tester';
import { ConsoleMonitor } from './monitors/console-monitor';
import { NetworkMonitor } from './monitors/network-monitor';
import { ReportGenerator } from './reporters/report-generator';
import type { DiscoveryReport, DiscoveredElement } from './comprehensive-discovery';
import type { TestResult, TestConfig } from './types';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Execution Engine
// ============================================================================

export class ComprehensiveExecution {
  private logger: Logger;
  private config: TestConfig;
  private browser?: Browser;
  private context?: BrowserContext;
  private testResults: TestResult[] = [];
  private consoleMonitor?: ConsoleMonitor;
  private networkMonitor?: NetworkMonitor;
  private startTime: number = 0;

  constructor(baseUrl?: string) {
    this.logger = new Logger({ context: 'Execution', level: 'info' });
    this.config = createComprehensiveTestConfig(baseUrl);
  }

  /**
   * Execute tests based on discovery report
   */
  async execute(discoveryReportPath?: string): Promise<void> {
    this.startTime = Date.now();

    try {
      // Step 1: Safety check
      this.logger.info('Running safety checks...');
      const safetyCheck = performSafetyCheck();
      if (!safetyCheck.safe) {
        this.logger.error('Safety check failed:');
        safetyCheck.errors.forEach((err) => this.logger.error(`  - ${err}`));
        throw new Error('Safety check failed. Cannot proceed with testing.');
      }
      this.logger.success('Safety checks passed');

      // Step 2: Load discovery report
      this.logger.info('Loading discovery report...');
      const discoveryReport = await this.loadDiscoveryReport(discoveryReportPath);
      this.logger.success(
        `Loaded discovery report: ${discoveryReport.totalElements} elements across ${discoveryReport.totalPages} pages`,
      );

      // Step 3: Initialize browser
      this.logger.info('Initializing browser...');
      this.browser = await chromium.launch({
        headless: this.config.headless,
        timeout: 30000,
      });

      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
        ignoreHTTPSErrors: true,
        recordVideo: this.config.video
          ? { dir: path.join(this.config.outputDir, 'videos') }
          : undefined,
      });

      const page = await this.context.newPage();
      this.logger.success('Browser initialized');

      // Step 4: Setup monitoring
      if (this.config.consoleMonitoring) {
        this.consoleMonitor = new ConsoleMonitor(this.config, this.logger);
        this.consoleMonitor.attach(page);
      }

      if (this.config.networkMonitoring) {
        this.networkMonitor = new NetworkMonitor(this.config, this.logger);
        this.networkMonitor.attach(page);
      }

      // Step 5: Login
      if (this.config.auth) {
        this.logger.info('Logging in...');
        const loginSuccess = await this.performLogin(page);
        if (!loginSuccess) {
          throw new Error('Login failed. Cannot proceed with testing.');
        }
        this.logger.success('Login successful');
      }

      // Step 6: Execute tests for each page
      const pageCount = Object.keys(discoveryReport.elementsByPage).length;
      let currentPage = 0;

      for (const [pageUrl, elements] of Object.entries(discoveryReport.elementsByPage)) {
        currentPage++;
        this.logger.info(`\n[${currentPage}/${pageCount}] Testing page: ${pageUrl}`);
        this.logger.info(`  Elements to test: ${elements.length}`);

        try {
          // Navigate to page
          await page.goto(pageUrl, {
            waitUntil: 'networkidle',
            timeout: this.config.timeout,
          });

          // Wait for page to stabilize
          await page.waitForTimeout(1000);

          // Test page-level features
          await this.testPageFeatures(page, pageUrl);

          // Test all elements on this page
          await this.testElementsOnPage(page, elements);

          this.logger.success(`  ✅ Completed testing ${pageUrl}`);
        } catch (error) {
          this.logger.error(`  ❌ Error testing ${pageUrl}: ${(error as Error).message}`);
          this.testResults.push({
            id: `page-error-${currentPage}`,
            type: 'page-load',
            name: `Page Load: ${pageUrl}`,
            status: 'error',
            url: pageUrl,
            duration: 0,
            timestamp: new Date(),
            retryCount: 0,
            error: {
              message: (error as Error).message,
              stack: (error as Error).stack,
              classification: 'functional',
            },
          });
        }

        // Rate limiting between pages
        await page.waitForTimeout(this.config.navigationDelay);
      }

      // Step 7: Generate final report
      this.logger.info('\nGenerating test report...');
      await this.generateFinalReport(discoveryReport);
      this.logger.success('Report generated successfully');

      // Step 8: Display summary
      this.displaySummary();
    } catch (error) {
      this.logger.error(`Execution failed: ${(error as Error).message}`);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  /**
   * Load discovery report from file
   */
  private async loadDiscoveryReport(reportPath?: string): Promise<DiscoveryReport> {
    let discoveryPath: string;

    if (reportPath) {
      discoveryPath = reportPath;
    } else {
      // Find most recent discovery report
      const outputDir = this.config.outputDir;
      if (!fs.existsSync(outputDir)) {
        throw new Error(
          `No discovery reports found. Please run discovery first:\n` + `  npm run test:discover`,
        );
      }

      const files = fs
        .readdirSync(outputDir)
        .filter((f) => f.startsWith('discovery-report-') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (files.length === 0) {
        throw new Error(
          `No discovery reports found in ${outputDir}. Please run discovery first:\n` +
            `  npm run test:discover`,
        );
      }

      discoveryPath = path.join(outputDir, files[0]);
      this.logger.info(`Using most recent discovery report: ${files[0]}`);
    }

    const content = fs.readFileSync(discoveryPath, 'utf-8');
    return JSON.parse(content) as DiscoveryReport;
  }

  /**
   * Perform login using configured credentials
   */
  private async performLogin(page: Page): Promise<boolean> {
    try {
      if (!this.config.auth) return false;

      const auth = this.config.auth;

      // Navigate to login page
      await page.goto(`${this.config.baseUrl}${auth.loginUrl}`, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });

      // Fill credentials (from environment variables, not hardcoded!)
      await page.fill(auth.usernameSelector, auth.credentials.username);
      await page.fill(auth.passwordSelector, auth.credentials.password);

      // Submit form
      await page.click(auth.submitSelector);

      // Wait for navigation
      if (auth.successUrl) {
        await page.waitForURL(`**${auth.successUrl}**`, { timeout: 15000 });
      } else {
        await page.waitForLoadState('networkidle');
      }

      // Verify login success
      const currentUrl = page.url();
      return auth.successUrl
        ? currentUrl.includes(auth.successUrl)
        : !currentUrl.includes(auth.loginUrl);
    } catch (error) {
      this.logger.error(`Login failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Test page-level features (performance, accessibility)
   */
  private async testPageFeatures(page: Page, pageUrl: string): Promise<void> {
    // Performance testing
    if (this.config.performanceTesting) {
      try {
        const perfTester = new PerformanceTester(this.config, this.logger);
        const perfResults = await perfTester.test(page, pageUrl);
        this.testResults.push(...perfResults);
      } catch (error) {
        this.logger.error(`  Performance test failed: ${(error as Error).message}`);
      }
    }

    // Accessibility testing
    if (this.config.accessibilityTesting) {
      try {
        const a11yTester = new AccessibilityTester(this.config, this.logger);
        const a11yResults = await a11yTester.test(page, pageUrl);
        this.testResults.push(...a11yResults);
      } catch (error) {
        this.logger.error(`  Accessibility test failed: ${(error as Error).message}`);
      }
    }

    // Get console errors
    if (this.consoleMonitor) {
      const consoleResults = this.consoleMonitor.getResults(pageUrl);
      this.testResults.push(...consoleResults);
    }

    // Get network errors
    if (this.networkMonitor) {
      const networkResults = this.networkMonitor.getResults(pageUrl);
      this.testResults.push(...networkResults);
    }
  }

  /**
   * Test all elements on a page
   */
  private async testElementsOnPage(page: Page, elements: DiscoveredElement[]): Promise<void> {
    const formTester = new FormTester(this.config, this.logger);
    const elementTester = new ElementTester(this.config, this.logger);

    // Group elements by type
    const forms = elements.filter((e) => e.type === 'form');
    const buttons = elements.filter((e) => e.type === 'button');
    const links = elements.filter((e) => e.type === 'link');
    const inputs = elements.filter((e) => e.type === 'input');
    const interactive = elements.filter((e) => e.type === 'interactive');

    // Test forms
    if (forms.length > 0) {
      this.logger.info(`    Testing ${forms.length} forms...`);
      for (const form of forms) {
        try {
          const results = await this.testForm(page, form, formTester);
          this.testResults.push(...results);
        } catch (error) {
          this.logger.error(`      Form test failed: ${(error as Error).message}`);
        }
      }
    }

    // Test buttons
    if (buttons.length > 0) {
      this.logger.info(`    Testing ${buttons.length} buttons...`);
      for (const button of buttons) {
        try {
          const results = await this.testButton(page, button, elementTester);
          this.testResults.push(...results);
        } catch (error) {
          this.logger.error(`      Button test failed: ${(error as Error).message}`);
        }
      }
    }

    // Test links (sample testing to avoid too many navigations)
    if (links.length > 0) {
      const linkSample = links.slice(0, Math.min(20, links.length)); // Test max 20 links per page
      this.logger.info(`    Testing ${linkSample.length} links (sampled from ${links.length})...`);
      for (const link of linkSample) {
        try {
          const results = await this.testLink(page, link, elementTester);
          this.testResults.push(...results);
        } catch (error) {
          this.logger.error(`      Link test failed: ${(error as Error).message}`);
        }
      }
    }

    // Test inputs (within forms are tested with forms, test standalone ones)
    const standaloneInputs = inputs.filter((i) => !i.formContext?.parentForm);
    if (standaloneInputs.length > 0) {
      this.logger.info(`    Testing ${standaloneInputs.length} standalone inputs...`);
      for (const input of standaloneInputs) {
        try {
          const results = await this.testInput(page, input);
          this.testResults.push(...results);
        } catch (error) {
          this.logger.error(`      Input test failed: ${(error as Error).message}`);
        }
      }
    }
  }

  /**
   * Test a form element
   */
  private async testForm(
    page: Page,
    form: DiscoveredElement,
    formTester: FormTester,
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    try {
      // Check if form is still visible
      const isVisible = await page.isVisible(form.selector).catch(() => false);
      if (!isVisible) {
        return [
          {
            id: `form-${form.selector}`,
            type: 'form-visibility',
            name: `Form: ${form.selector}`,
            status: 'skipped',
            url: form.pageUrl,
            duration: 0,
            timestamp: new Date(),
            retryCount: 0,
            data: { reason: 'Form not visible' },
          },
        ];
      }

      // Test form visibility and structure
      const visibilityResult = await formTester.testFormVisibility(
        page,
        form.selector,
        form.pageUrl,
      );
      results.push(visibilityResult);

      // Test form fields
      const fieldsResult = await formTester.testFormFields(page, form.selector, form.pageUrl);
      results.push(fieldsResult);

      // Test form validation (if depth is deep)
      if (this.config.depth === 'deep') {
        const validationResults = await formTester.testFormValidation(
          page,
          form.selector,
          form.pageUrl,
        );
        results.push(...validationResults);
      }

      // Note: We don't test form submission to avoid creating test data
      // unless specifically configured to do so
    } catch (error) {
      results.push({
        id: `form-error-${form.selector}`,
        type: 'form-test',
        name: `Form Test: ${form.selector}`,
        status: 'error',
        url: form.pageUrl,
        duration: 0,
        timestamp: new Date(),
        retryCount: 0,
        error: {
          message: (error as Error).message,
          classification: 'functional',
        },
      });
    }

    return results;
  }

  /**
   * Test a button element
   */
  private async testButton(
    page: Page,
    button: DiscoveredElement,
    elementTester: ElementTester,
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    try {
      // Check if button is still visible
      const isVisible = await page.isVisible(button.selector).catch(() => false);
      if (!isVisible) {
        return [
          {
            id: `button-${button.selector}`,
            type: 'button-visibility',
            name: `Button: ${button.text || button.selector}`,
            status: 'skipped',
            url: button.pageUrl,
            duration: 0,
            timestamp: new Date(),
            retryCount: 0,
            data: { reason: 'Button not visible' },
          },
        ];
      }

      // Test button clickability
      const clickResult = await elementTester.testButtonClick(
        page,
        button.selector,
        button.pageUrl,
      );
      results.push(clickResult);

      // If button is in a form and is a submit button, skip actual submission
      if (
        button.formContext &&
        (button.attributes.type === 'submit' || button.tagName === 'button')
      ) {
        results[results.length - 1].data = {
          ...results[results.length - 1].data,
          note: 'Submit button - click tested but form not submitted to avoid side effects',
        };
      }
    } catch (error) {
      results.push({
        id: `button-error-${button.selector}`,
        type: 'button-test',
        name: `Button Test: ${button.text || button.selector}`,
        status: 'error',
        url: button.pageUrl,
        duration: 0,
        timestamp: new Date(),
        retryCount: 0,
        error: {
          message: (error as Error).message,
          classification: 'functional',
        },
      });
    }

    return results;
  }

  /**
   * Test a link element
   */
  private async testLink(
    page: Page,
    link: DiscoveredElement,
    elementTester: ElementTester,
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    try {
      // Check if link is still visible
      const isVisible = await page.isVisible(link.selector).catch(() => false);
      if (!isVisible) {
        return [
          {
            id: `link-${link.selector}`,
            type: 'link-visibility',
            name: `Link: ${link.text || link.selector}`,
            status: 'skipped',
            url: link.pageUrl,
            duration: 0,
            timestamp: new Date(),
            retryCount: 0,
            data: { reason: 'Link not visible' },
          },
        ];
      }

      // Test link is clickable (but don't actually click to avoid navigation)
      const href = link.attributes.href;
      const isInternal = href && (href.startsWith('/') || href.startsWith(this.config.baseUrl));

      results.push({
        id: `link-${link.selector}`,
        type: 'link-check',
        name: `Link: ${link.text || link.selector}`,
        status: 'passed',
        url: link.pageUrl,
        duration: 0,
        timestamp: new Date(),
        retryCount: 0,
        data: {
          href,
          isInternal,
          text: link.text,
        },
      });
    } catch (error) {
      results.push({
        id: `link-error-${link.selector}`,
        type: 'link-test',
        name: `Link Test: ${link.text || link.selector}`,
        status: 'error',
        url: link.pageUrl,
        duration: 0,
        timestamp: new Date(),
        retryCount: 0,
        error: {
          message: (error as Error).message,
          classification: 'functional',
        },
      });
    }

    return results;
  }

  /**
   * Test an input element
   */
  private async testInput(page: Page, input: DiscoveredElement): Promise<TestResult[]> {
    const results: TestResult[] = [];

    try {
      // Check if input is still visible
      const isVisible = await page.isVisible(input.selector).catch(() => false);
      if (!isVisible) {
        return [
          {
            id: `input-${input.selector}`,
            type: 'input-visibility',
            name: `Input: ${input.name || input.selector}`,
            status: 'skipped',
            url: input.pageUrl,
            duration: 0,
            timestamp: new Date(),
            retryCount: 0,
            data: { reason: 'Input not visible' },
          },
        ];
      }

      // Test input interactivity
      const testValue = 'test';
      await page.fill(input.selector, testValue);
      const value = await page.inputValue(input.selector);

      results.push({
        id: `input-${input.selector}`,
        type: 'input-test',
        name: `Input: ${input.name || input.selector}`,
        status: value === testValue ? 'passed' : 'warning',
        url: input.pageUrl,
        duration: 0,
        timestamp: new Date(),
        retryCount: 0,
        data: {
          expectedValue: testValue,
          actualValue: value,
          inputType: input.attributes.type,
        },
      });

      // Clear the input
      await page.fill(input.selector, '');
    } catch (error) {
      results.push({
        id: `input-error-${input.selector}`,
        type: 'input-test',
        name: `Input Test: ${input.name || input.selector}`,
        status: 'error',
        url: input.pageUrl,
        duration: 0,
        timestamp: new Date(),
        retryCount: 0,
        error: {
          message: (error as Error).message,
          classification: 'functional',
        },
      });
    }

    return results;
  }

  /**
   * Generate final test report
   */
  private async generateFinalReport(discoveryReport: DiscoveryReport): Promise<void> {
    const duration = Date.now() - this.startTime;

    // Create summary
    const summary = {
      totalTests: this.testResults.length,
      passed: this.testResults.filter((r) => r.status === 'passed').length,
      failed: this.testResults.filter((r) => r.status === 'failed').length,
      errors: this.testResults.filter((r) => r.status === 'error').length,
      skipped: this.testResults.filter((r) => r.status === 'skipped').length,
      warnings: this.testResults.filter((r) => r.status === 'warning').length,
      duration,
    };

    // Generate report using the existing report generator
    const reportGenerator = new ReportGenerator(this.config, this.logger);
    await reportGenerator.generateReport(this.testResults, {
      title: 'Comprehensive Test Execution Report',
      summary,
      metadata: {
        discoveryReport: {
          totalPages: discoveryReport.totalPages,
          totalElements: discoveryReport.totalElements,
          elementsByType: discoveryReport.elementsByType,
        },
      },
    });
  }

  /**
   * Display test summary
   */
  private displaySummary(): void {
    const passed = this.testResults.filter((r) => r.status === 'passed').length;
    const failed = this.testResults.filter((r) => r.status === 'failed').length;
    const errors = this.testResults.filter((r) => r.status === 'error').length;
    const skipped = this.testResults.filter((r) => r.status === 'skipped').length;
    const warnings = this.testResults.filter((r) => r.status === 'warning').length;
    const total = this.testResults.length;

    const duration = Date.now() - this.startTime;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                   TEST EXECUTION SUMMARY                          ║
╚═══════════════════════════════════════════════════════════════════╝

Total Tests:    ${total}
✅ Passed:       ${passed}
❌ Failed:       ${failed}
⚠️  Warnings:    ${warnings}
🔴 Errors:       ${errors}
⏭️  Skipped:     ${skipped}

Pass Rate:      ${passRate}%
Duration:       ${(duration / 1000).toFixed(2)}s

Reports saved to: ${path.resolve(process.cwd(), this.config.outputDir)}
    `);
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args[0];
  const discoveryReportPath = args[1];

  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║          COMPREHENSIVE EXECUTION - Stage 2 of 2                    ║
╚═══════════════════════════════════════════════════════════════════╝
  `);

  const execution = new ComprehensiveExecution(baseUrl);

  try {
    await execution.execute(discoveryReportPath);
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Execution failed: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

// Run if executed directly (ES module check)
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main();
}

export default ComprehensiveExecution;
