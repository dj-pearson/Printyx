/**
 * Comprehensive Discovery Script
 *
 * This script discovers all forms, buttons, and interactive elements in the application.
 * It creates a comprehensive catalog that can be used for testing.
 *
 * Stage 1 of the two-stage testing process.
 */

import { chromium, Page, Browser } from 'playwright';
import { createComprehensiveTestConfig, performSafetyCheck } from './comprehensive-test.config';
import { Logger } from './utils/logger';
import { PageCrawler } from './crawlers/page-crawler';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface DiscoveredElement {
  type: 'form' | 'button' | 'link' | 'input' | 'interactive';
  selector: string;
  xpath: string;
  pageUrl: string;
  attributes: Record<string, string>;
  text?: string;
  isVisible: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  tagName: string;
  id?: string;
  classes?: string[];
  name?: string;
  formContext?: {
    formId?: string;
    formAction?: string;
    formMethod?: string;
    parentForm?: string;
  };
}

export interface DiscoveryReport {
  timestamp: Date;
  baseUrl: string;
  totalPages: number;
  totalElements: number;
  elementsByType: Record<string, number>;
  elementsByPage: Record<string, DiscoveredElement[]>;
  pages: string[];
  errors: Array<{ page: string; error: string }>;
  duration: number;
}

// ============================================================================
// Discovery Engine
// ============================================================================

export class ComprehensiveDiscovery {
  private logger: Logger;
  private config: ReturnType<typeof createComprehensiveTestConfig>;
  private browser?: Browser;
  private discoveredElements: DiscoveredElement[] = [];
  private errors: Array<{ page: string; error: string }> = [];
  private visitedPages: Set<string> = new Set();

  constructor(baseUrl?: string) {
    this.logger = new Logger({ context: 'Discovery', level: 'info' });
    this.config = createComprehensiveTestConfig(baseUrl);
  }

  /**
   * Main discovery method
   */
  async discover(): Promise<DiscoveryReport> {
    const startTime = Date.now();

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

      // Step 2: Initialize browser
      this.logger.info('Initializing browser...');
      this.browser = await chromium.launch({
        headless: this.config.headless,
        timeout: 30000,
      });
      this.logger.success('Browser initialized');

      // Step 3: Create page and login
      const context = await this.browser.newContext({
        viewport: this.config.viewport,
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();

      // Login if auth is configured
      if (this.config.auth) {
        this.logger.info('Logging in...');
        const loginSuccess = await this.performLogin(page);
        if (!loginSuccess) {
          throw new Error('Login failed. Cannot proceed with discovery.');
        }
        this.logger.success('Login successful');
      }

      // Step 4: Discover all pages using the page crawler
      this.logger.info('Discovering pages...');
      const pageCrawler = new PageCrawler(this.config, this.logger);
      const discoveredPages = await pageCrawler.crawl(page);
      this.logger.success(`Discovered ${discoveredPages.length} pages`);

      // Step 5: For each page, discover all interactive elements
      this.logger.info('Discovering elements on each page...');
      let pageCount = 0;
      for (const pageUrl of discoveredPages) {
        pageCount++;
        this.logger.info(`[${pageCount}/${discoveredPages.length}] Processing: ${pageUrl}`);

        try {
          await page.goto(pageUrl, {
            waitUntil: 'networkidle',
            timeout: this.config.timeout,
          });

          // Wait for page to stabilize
          await page.waitForTimeout(1000);

          // Discover elements on this page
          const elements = await this.discoverElementsOnPage(page, pageUrl);
          this.discoveredElements.push(...elements);
          this.visitedPages.add(pageUrl);

          this.logger.info(`  Found ${elements.length} interactive elements`);
        } catch (error) {
          const errorMsg = (error as Error).message;
          this.logger.error(`  Error on ${pageUrl}: ${errorMsg}`);
          this.errors.push({ page: pageUrl, error: errorMsg });
        }

        // Rate limiting
        await page.waitForTimeout(this.config.navigationDelay);
      }

      // Step 6: Generate report
      this.logger.info('Generating discovery report...');
      const report = this.generateReport(startTime);

      // Step 7: Save report
      await this.saveReport(report);
      this.logger.success(
        `Discovery complete! Found ${report.totalElements} elements across ${report.totalPages} pages`,
      );

      return report;
    } catch (error) {
      this.logger.error(`Discovery failed: ${(error as Error).message}`);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
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
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout,
      });

      // Wait for the page to fully load and React to render
      this.logger.info('Waiting for React app to render...');
      await page.waitForTimeout(3000);

      // Wait for the email input to be visible
      this.logger.info('Looking for email input field...');
      await page.waitForSelector(auth.usernameSelector, {
        state: 'visible',
        timeout: 15000,
      });

      this.logger.info('Email field found, filling credentials...');

      // Fill credentials
      await page.fill(auth.usernameSelector, auth.credentials.username);
      await page.fill(auth.passwordSelector, auth.credentials.password);

      // Wait a moment before clicking submit
      await page.waitForTimeout(500);

      // Submit form
      this.logger.info('Submitting login form...');
      await page.click(auth.submitSelector);

      // Wait for navigation with longer timeout
      this.logger.info('Waiting for post-login navigation...');
      if (auth.successUrl) {
        await page.waitForURL(`**${auth.successUrl}**`, { timeout: 20000 });
      } else {
        await page.waitForLoadState('networkidle', { timeout: 20000 });
      }

      // Additional wait for app to initialize
      await page.waitForTimeout(2000);

      // Verify login success
      const currentUrl = page.url();
      const success = auth.successUrl
        ? currentUrl.includes(auth.successUrl)
        : !currentUrl.includes(auth.loginUrl);

      if (success) {
        this.logger.success(`Successfully logged in! Current URL: ${currentUrl}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Login failed: ${(error as Error).message}`);

      // Take a screenshot for debugging
      try {
        const screenshotDir = path.resolve(process.cwd(), this.config.outputDir);
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true });
        }
        const screenshotPath = path.join(screenshotDir, 'login-error.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        this.logger.info(`Screenshot saved to: ${screenshotPath}`);
      } catch (screenshotError) {
        this.logger.error(`Could not save screenshot: ${(screenshotError as Error).message}`);
      }

      return false;
    }
  }

  /**
   * Discover all interactive elements on a page
   */
  private async discoverElementsOnPage(page: Page, pageUrl: string): Promise<DiscoveredElement[]> {
    const elements: DiscoveredElement[] = [];

    try {
      // Discover forms
      const forms = await this.discoverForms(page, pageUrl);
      elements.push(...forms);

      // Discover buttons
      const buttons = await this.discoverButtons(page, pageUrl);
      elements.push(...buttons);

      // Discover links
      const links = await this.discoverLinks(page, pageUrl);
      elements.push(...links);

      // Discover inputs
      const inputs = await this.discoverInputs(page, pageUrl);
      elements.push(...inputs);

      // Discover other interactive elements
      const interactive = await this.discoverInteractive(page, pageUrl);
      elements.push(...interactive);
    } catch (error) {
      this.logger.error(`Error discovering elements on ${pageUrl}: ${(error as Error).message}`);
    }

    return elements;
  }

  /**
   * Discover all forms on the page
   */
  private async discoverForms(page: Page, pageUrl: string): Promise<DiscoveredElement[]> {
    const formSelector = this.config.selectors.forms.join(', ');
    const ignoreSelector = this.config.selectors.ignore.join(', ');

    return await page.evaluate(
      ({ formSelector, ignoreSelector, pageUrl }) => {
        const elements: any[] = [];
        const forms = document.querySelectorAll(formSelector);

        forms.forEach((form, index) => {
          // Skip ignored elements
          if (ignoreSelector && form.matches(ignoreSelector)) return;

          const rect = form.getBoundingClientRect();
          const isVisible =
            rect.width > 0 &&
            rect.height > 0 &&
            window.getComputedStyle(form).display !== 'none' &&
            window.getComputedStyle(form).visibility !== 'hidden';

          if (!isVisible) return;

          // Get XPath
          const getXPath = (element: Element): string => {
            if (element.id) return `//*[@id="${element.id}"]`;
            if (element === document.body) return '/html/body';

            const parent = element.parentElement;
            if (!parent) return '';

            const siblings = Array.from(parent.children).filter(
              (e) => e.tagName === element.tagName,
            );
            const index = siblings.indexOf(element) + 1;
            return `${getXPath(parent)}/${element.tagName.toLowerCase()}[${index}]`;
          };

          const attributes: Record<string, string> = {};
          Array.from(form.attributes).forEach((attr) => {
            attributes[attr.name] = attr.value;
          });

          elements.push({
            type: 'form',
            selector: form.id
              ? `#${form.id}`
              : `${form.tagName.toLowerCase()}:nth-of-type(${index + 1})`,
            xpath: getXPath(form),
            pageUrl,
            attributes,
            text: (form as HTMLElement).innerText?.substring(0, 100),
            isVisible,
            position: { x: rect.x, y: rect.y },
            size: { width: rect.width, height: rect.height },
            tagName: form.tagName.toLowerCase(),
            id: form.id || undefined,
            classes: Array.from(form.classList),
            name: (form as HTMLFormElement).name || undefined,
            formContext: {
              formId: form.id || undefined,
              formAction: (form as HTMLFormElement).action || undefined,
              formMethod: (form as HTMLFormElement).method || undefined,
            },
          });
        });

        return elements;
      },
      { formSelector, ignoreSelector, pageUrl },
    );
  }

  /**
   * Discover all buttons on the page
   */
  private async discoverButtons(page: Page, pageUrl: string): Promise<DiscoveredElement[]> {
    const buttonSelector = this.config.selectors.buttons.join(', ');
    const ignoreSelector = this.config.selectors.ignore.join(', ');

    return await page.evaluate(
      ({ buttonSelector, ignoreSelector, pageUrl }) => {
        const elements: any[] = [];
        const buttons = document.querySelectorAll(buttonSelector);

        buttons.forEach((button, index) => {
          if (ignoreSelector && button.matches(ignoreSelector)) return;

          const rect = button.getBoundingClientRect();
          const isVisible =
            rect.width > 0 &&
            rect.height > 0 &&
            window.getComputedStyle(button).display !== 'none' &&
            window.getComputedStyle(button).visibility !== 'hidden';

          if (!isVisible) return;

          const getXPath = (element: Element): string => {
            if (element.id) return `//*[@id="${element.id}"]`;
            const parent = element.parentElement;
            if (!parent) return '';
            const siblings = Array.from(parent.children).filter(
              (e) => e.tagName === element.tagName,
            );
            const index = siblings.indexOf(element) + 1;
            return `${getXPath(parent)}/${element.tagName.toLowerCase()}[${index}]`;
          };

          const attributes: Record<string, string> = {};
          Array.from(button.attributes).forEach((attr) => {
            attributes[attr.name] = attr.value;
          });

          // Find parent form if exists
          const parentForm = button.closest('form');

          elements.push({
            type: 'button',
            selector: button.id
              ? `#${button.id}`
              : `${button.tagName.toLowerCase()}:nth-of-type(${index + 1})`,
            xpath: getXPath(button),
            pageUrl,
            attributes,
            text:
              (button as HTMLElement).innerText?.substring(0, 100) ||
              button.getAttribute('aria-label') ||
              button.getAttribute('title'),
            isVisible,
            position: { x: rect.x, y: rect.y },
            size: { width: rect.width, height: rect.height },
            tagName: button.tagName.toLowerCase(),
            id: button.id || undefined,
            classes: Array.from(button.classList),
            name: (button as HTMLInputElement).name || undefined,
            formContext: parentForm
              ? {
                  formId: parentForm.id || undefined,
                  formAction: parentForm.action || undefined,
                  formMethod: parentForm.method || undefined,
                  parentForm: parentForm.id || 'anonymous-form',
                }
              : undefined,
          });
        });

        return elements;
      },
      { buttonSelector, ignoreSelector, pageUrl },
    );
  }

  /**
   * Discover all links on the page
   */
  private async discoverLinks(page: Page, pageUrl: string): Promise<DiscoveredElement[]> {
    const linkSelector = this.config.selectors.links.join(', ');
    const ignoreSelector = this.config.selectors.ignore.join(', ');

    return await page.evaluate(
      ({ linkSelector, ignoreSelector, pageUrl }) => {
        const elements: any[] = [];
        const links = document.querySelectorAll(linkSelector);

        links.forEach((link) => {
          if (ignoreSelector && link.matches(ignoreSelector)) return;

          const rect = link.getBoundingClientRect();
          const isVisible =
            rect.width > 0 && rect.height > 0 && window.getComputedStyle(link).display !== 'none';

          if (!isVisible) return;

          const attributes: Record<string, string> = {};
          Array.from(link.attributes).forEach((attr) => {
            attributes[attr.name] = attr.value;
          });

          elements.push({
            type: 'link',
            selector: link.id ? `#${link.id}` : `a[href="${(link as HTMLAnchorElement).href}"]`,
            xpath: '',
            pageUrl,
            attributes,
            text: (link as HTMLElement).innerText?.substring(0, 100),
            isVisible,
            tagName: link.tagName.toLowerCase(),
            id: link.id || undefined,
            classes: Array.from(link.classList),
          });
        });

        return elements;
      },
      { linkSelector, ignoreSelector, pageUrl },
    );
  }

  /**
   * Discover all input fields on the page
   */
  private async discoverInputs(page: Page, pageUrl: string): Promise<DiscoveredElement[]> {
    const inputSelector = this.config.selectors.inputs.join(', ');
    const ignoreSelector = this.config.selectors.ignore.join(', ');

    return await page.evaluate(
      ({ inputSelector, ignoreSelector, pageUrl }) => {
        const elements: any[] = [];
        const inputs = document.querySelectorAll(inputSelector);

        inputs.forEach((input) => {
          if (ignoreSelector && input.matches(ignoreSelector)) return;

          const rect = input.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;

          if (!isVisible) return;

          const attributes: Record<string, string> = {};
          Array.from(input.attributes).forEach((attr) => {
            attributes[attr.name] = attr.value;
          });

          const parentForm = input.closest('form');

          elements.push({
            type: 'input',
            selector: input.id
              ? `#${input.id}`
              : `input[name="${(input as HTMLInputElement).name}"]`,
            xpath: '',
            pageUrl,
            attributes,
            isVisible,
            tagName: input.tagName.toLowerCase(),
            id: input.id || undefined,
            classes: Array.from(input.classList),
            name: (input as HTMLInputElement).name || undefined,
            formContext: parentForm
              ? {
                  formId: parentForm.id || undefined,
                  parentForm: parentForm.id || 'anonymous-form',
                }
              : undefined,
          });
        });

        return elements;
      },
      { inputSelector, ignoreSelector, pageUrl },
    );
  }

  /**
   * Discover other interactive elements
   */
  private async discoverInteractive(page: Page, pageUrl: string): Promise<DiscoveredElement[]> {
    const interactiveSelector = this.config.selectors.interactive
      .filter(
        (sel) =>
          !this.config.selectors.buttons.includes(sel) &&
          !this.config.selectors.links.includes(sel) &&
          !this.config.selectors.inputs.includes(sel),
      )
      .join(', ');

    if (!interactiveSelector) return [];

    const ignoreSelector = this.config.selectors.ignore.join(', ');

    return await page.evaluate(
      ({ interactiveSelector, ignoreSelector, pageUrl }) => {
        const elements: any[] = [];
        const interactives = document.querySelectorAll(interactiveSelector);

        interactives.forEach((el) => {
          if (ignoreSelector && el.matches(ignoreSelector)) return;

          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;

          if (!isVisible) return;

          const attributes: Record<string, string> = {};
          Array.from(el.attributes).forEach((attr) => {
            attributes[attr.name] = attr.value;
          });

          elements.push({
            type: 'interactive',
            selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
            xpath: '',
            pageUrl,
            attributes,
            text: (el as HTMLElement).innerText?.substring(0, 100),
            isVisible,
            tagName: el.tagName.toLowerCase(),
            id: el.id || undefined,
            classes: Array.from(el.classList),
          });
        });

        return elements;
      },
      { interactiveSelector, ignoreSelector, pageUrl },
    );
  }

  /**
   * Generate discovery report
   */
  private generateReport(startTime: number): DiscoveryReport {
    const elementsByType: Record<string, number> = {};
    const elementsByPage: Record<string, DiscoveredElement[]> = {};

    this.discoveredElements.forEach((element) => {
      // Count by type
      elementsByType[element.type] = (elementsByType[element.type] || 0) + 1;

      // Group by page
      if (!elementsByPage[element.pageUrl]) {
        elementsByPage[element.pageUrl] = [];
      }
      elementsByPage[element.pageUrl].push(element);
    });

    return {
      timestamp: new Date(),
      baseUrl: this.config.baseUrl,
      totalPages: this.visitedPages.size,
      totalElements: this.discoveredElements.length,
      elementsByType,
      elementsByPage,
      pages: Array.from(this.visitedPages),
      errors: this.errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Save discovery report to disk
   */
  private async saveReport(report: DiscoveryReport): Promise<void> {
    const outputDir = this.config.outputDir;
    const timestamp = new Date().toISOString().replace(/:/g, '-');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save JSON report
    const jsonPath = path.join(outputDir, `discovery-report-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    this.logger.success(`JSON report saved: ${jsonPath}`);

    // Save Markdown report
    const mdPath = path.join(outputDir, `discovery-report-${timestamp}.md`);
    const mdContent = this.generateMarkdownReport(report);
    fs.writeFileSync(mdPath, mdContent);
    this.logger.success(`Markdown report saved: ${mdPath}`);
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(report: DiscoveryReport): string {
    let md = `# Discovery Report\n\n`;
    md += `**Generated:** ${report.timestamp.toLocaleString()}\n\n`;
    md += `**Base URL:** ${report.baseUrl}\n\n`;
    md += `**Duration:** ${(report.duration / 1000).toFixed(2)}s\n\n`;

    md += `## Summary\n\n`;
    md += `- **Total Pages:** ${report.totalPages}\n`;
    md += `- **Total Elements:** ${report.totalElements}\n\n`;

    md += `### Elements by Type\n\n`;
    Object.entries(report.elementsByType)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        md += `- **${type}:** ${count}\n`;
      });

    md += `\n## Pages\n\n`;
    report.pages.forEach((page) => {
      const elements = report.elementsByPage[page] || [];
      md += `### ${page}\n`;
      md += `Found ${elements.length} interactive elements\n\n`;
    });

    if (report.errors.length > 0) {
      md += `\n## Errors\n\n`;
      report.errors.forEach(({ page, error }) => {
        md += `- **${page}:** ${error}\n`;
      });
    }

    return md;
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const baseUrl = process.argv[2];

  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║          COMPREHENSIVE DISCOVERY - Stage 1 of 2                    ║
╚═══════════════════════════════════════════════════════════════════╝
  `);

  const discovery = new ComprehensiveDiscovery(baseUrl);

  try {
    const report = await discovery.discover();

    console.log(`
✅ Discovery completed successfully!

Summary:
- Pages discovered: ${report.totalPages}
- Interactive elements found: ${report.totalElements}
- Forms: ${report.elementsByType.form || 0}
- Buttons: ${report.elementsByType.button || 0}
- Links: ${report.elementsByType.link || 0}
- Inputs: ${report.elementsByType.input || 0}
- Other interactive: ${report.elementsByType.interactive || 0}
- Errors: ${report.errors.length}

Reports saved to: ${path.resolve(process.cwd(), 'test-reports/comprehensive')}

Next step: Run the execution script to test all discovered elements.
    `);

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Discovery failed: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

// Run if executed directly (ES module check)
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main();
}

export default ComprehensiveDiscovery;
