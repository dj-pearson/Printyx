const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// All routes from the Printyx application
const ALL_ROUTES = [
  // Marketing/Public Pages
  '/',
  '/copier-dealer-crm',
  '/print-service-dispatch-mobile',
  '/canon-master-product-catalog',

  // Core Application Routes
  '/dashboard',
  '/leads-management',
  '/crm-enhanced',
  '/sales-pipeline',
  '/crm-goals-dashboard',
  '/contacts',
  '/company-contacts',
  '/deals-management',
  '/sales-pipeline-forecasting',
  '/customers',
  '/customer-success-management',
  '/contracts',
  '/quote-proposal-generation',
  '/commission-management',
  '/demo-scheduling',

  // Service Management
  '/task-management',
  '/service-dispatch',
  '/service-dispatch-enhanced',
  '/service-dispatch-optimization',
  '/mobile-field-service',
  '/mobile-field-operations',
  '/mobile-service-app',
  '/service-analytics',
  '/service-products',
  '/remote-monitoring',
  '/preventive-maintenance-scheduling',
  '/preventive-maintenance-automation',
  '/meter-readings',
  '/incident-response-system',

  // Inventory & Products
  '/inventory',
  '/product-hub',
  '/product-management-hub',
  '/product-models',
  '/product-accessories',
  '/software-products',
  '/supplies',
  '/vendors',
  '/vendor-management',
  '/purchase-orders',
  '/warehouse-operations',

  // Financial
  '/invoices',
  '/advanced-billing-engine',
  '/meter-billing',
  '/chart-of-accounts',
  '/journal-entries',
  '/financial-forecasting',
  '/accounts-payable',
  '/accounts-receivable',

  // Analytics & Reporting
  '/reports',
  '/advanced-reporting',
  '/advanced-analytics-dashboard',
  '/ai-analytics-dashboard',
  '/predictive-analytics',

  // Integrations
  '/integration-hub',
  '/quickbooks-integration',
  '/erp-integration',
  '/esignature-integration',
  '/system-integrations',
  '/workflow-automation',
  '/business-process-optimization',

  // Admin & Management
  '/business-records',
  '/document-management',
  '/security-compliance-management',
  '/deployment-readiness',
  '/performance-monitoring',
  '/data-enrichment',
  '/root-admin-dashboard',
  '/social-media-generator',
  '/security-management',
  '/system-monitoring',
  '/access-control',
  '/platform-configuration',
  '/database-management',
  '/tenant-setup',
  '/professional-services',
  '/managed-services',
  '/customer-self-service-portal',
  '/mobile-optimization',
  '/settings',
];

const CONFIG = {
  baseUrl: 'http://localhost:5173', // Vite dev server
  timeout: 15000,
  viewports: [
    { width: 1920, height: 1080, device: 'desktop' },
    { width: 768, height: 1024, device: 'tablet' },
    { width: 375, height: 667, device: 'mobile' },
  ],
  screenshots: true,
  screenshotDir: './test-results/app-screenshots',
  reportDir: './test-results',
  maxRoutesToTest: 20, // Limit for demonstration
};

class ComprehensiveAppTest {
  constructor() {
    this.results = {
      summary: {
        totalRoutes: 0,
        successful: 0,
        errors: 0,
        warnings: 0,
        reactErrors: 0,
        loadingIssues: 0,
        startTime: new Date(),
        endTime: null,
      },
      routes: [],
      commonIssues: [],
      performance: {
        averageLoadTime: 0,
        slowRoutes: [],
        totalLoadTime: 0,
      },
      mobileCompatibility: {
        touchOptimized: 0,
        responsiveIssues: 0,
        viewportIssues: 0,
      },
    };

    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = [CONFIG.reportDir, CONFIG.screenshotDir];
    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async runTests() {
    console.log('🚀 Starting Comprehensive Printyx App Testing...');
    console.log(`📊 Testing ${Math.min(ALL_ROUTES.length, CONFIG.maxRoutesToTest)} routes`);
    console.log(`📱 Across ${CONFIG.viewports.length} viewports`);
    console.log('='.repeat(80));

    const routesToTest = ALL_ROUTES.slice(0, CONFIG.maxRoutesToTest);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-features=VizDisplayCompositor',
      ],
    });

    try {
      // First, test if the main app loads at all
      const appStatus = await this.testAppAccessibility(browser);

      if (appStatus.accessible) {
        console.log('✅ Main application is accessible');

        // Test each viewport
        for (const viewport of CONFIG.viewports) {
          console.log(
            `\n📱 Testing ${viewport.device} viewport (${viewport.width}x${viewport.height})`,
          );
          await this.testViewport(browser, viewport, routesToTest);
        }
      } else {
        console.log('❌ Main application is not accessible');
        console.log("🔍 Analyzing what's available...");
        await this.analyzeAvailableContent(browser);
      }

      this.results.summary.endTime = new Date();
      await this.generateReport();
    } finally {
      await browser.close();
    }

    this.printSummary();
    return this.results;
  }

  async testAppAccessibility(browser) {
    const page = await browser.newPage();

    try {
      console.log('🔍 Testing main application accessibility...');

      await page.goto(CONFIG.baseUrl, {
        waitUntil: 'networkidle0',
        timeout: CONFIG.timeout,
      });

      // Check if React app loaded
      const reactRoot = await page.$('#root');
      const hasContent = reactRoot
        ? await page.evaluate((el) => el.children.length > 0, reactRoot)
        : false;

      // Check for common error patterns
      const hasReactError = (await page.$('.react-error, [data-testid="error"]')) !== null;
      const hasAuthRedirect = (await page.$('.login, [data-testid="login"]')) !== null;

      const status = {
        accessible: hasContent && !hasReactError,
        hasReactRoot: !!reactRoot,
        hasContent,
        hasReactError,
        hasAuthRedirect,
        url: page.url(),
      };

      console.log(`  📱 React Root: ${status.hasReactRoot ? '✅' : '❌'}`);
      console.log(`  📄 Has Content: ${status.hasContent ? '✅' : '❌'}`);
      console.log(`  🔐 Auth Redirect: ${status.hasAuthRedirect ? '✅' : '❌'}`);
      console.log(`  ❌ React Error: ${status.hasReactError ? '❌' : '✅'}`);

      return status;
    } catch (error) {
      console.log(`  ❌ Error accessing app: ${error.message}`);
      return { accessible: false, error: error.message };
    } finally {
      await page.close();
    }
  }

  async analyzeAvailableContent(browser) {
    console.log('🔍 Analyzing available content...');

    const page = await browser.newPage();

    try {
      // Check what's actually serving on the port
      await page.goto(CONFIG.baseUrl, { timeout: CONFIG.timeout });

      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body.textContent.substring(0, 500));

      console.log(`  📄 Page Title: ${title}`);
      console.log(`  📝 Body Preview: ${bodyText.substring(0, 100)}...`);

      // Check for specific elements
      const hasViteError = (await page.$('.vite-error')) !== null;
      const hasModuleErrors =
        bodyText.includes('Failed to resolve') || bodyText.includes('Cannot resolve');

      console.log(`  ⚡ Vite Error: ${hasViteError ? '❌' : '✅'}`);
      console.log(`  📦 Module Errors: ${hasModuleErrors ? '❌' : '✅'}`);

      // Take a screenshot of what's actually showing
      await page.screenshot({
        path: path.join(CONFIG.screenshotDir, 'app-status-analysis.png'),
        fullPage: true,
      });
    } catch (error) {
      console.log(`  ❌ Analysis error: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  async testViewport(browser, viewport, routes) {
    const page = await browser.newPage();

    try {
      await page.setViewport({
        width: viewport.width,
        height: viewport.height,
        isMobile: viewport.device.includes('mobile'),
        hasTouch: viewport.device.includes('mobile'),
      });

      // Set up console error tracking
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Set up request interception to handle 404s gracefully
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        request.continue();
      });

      // Test each route
      for (const route of routes) {
        await this.testRoute(page, route, viewport, consoleErrors);

        // Clear console errors for next route
        consoleErrors.length = 0;
      }
    } finally {
      await page.close();
    }
  }

  async testRoute(page, route, viewport, consoleErrors) {
    const routeTest = {
      route: route,
      viewport: viewport.device,
      status: 'unknown',
      loadTime: 0,
      httpStatus: null,
      errors: [],
      warnings: [],
      reactStatus: 'unknown',
      authRequired: false,
      contentLoaded: false,
      mobileOptimized: false,
      screenshot: null,
      timestamp: new Date(),
    };

    console.log(`  🔍 Testing: ${route} (${viewport.device})`);

    try {
      const startTime = Date.now();

      // Navigate to route
      const response = await page.goto(`${CONFIG.baseUrl}${route}`, {
        waitUntil: 'networkidle0',
        timeout: CONFIG.timeout,
      });

      const loadTime = Date.now() - startTime;
      routeTest.loadTime = loadTime;
      routeTest.httpStatus = response ? response.status() : null;

      // Analyze the page content
      await this.analyzePage(page, routeTest, viewport);

      // Determine overall status
      if (routeTest.httpStatus >= 200 && routeTest.httpStatus < 300) {
        if (routeTest.contentLoaded) {
          routeTest.status = 'success';
          this.results.summary.successful++;
        } else {
          routeTest.status = 'warning';
          routeTest.warnings.push('Page loaded but content analysis failed');
          this.results.summary.warnings++;
        }
      } else if (routeTest.httpStatus === 404) {
        routeTest.status = 'error';
        routeTest.errors.push('404 - Route not found');
        this.results.summary.errors++;
      } else {
        routeTest.status = 'warning';
        routeTest.warnings.push(`HTTP ${routeTest.httpStatus}`);
        this.results.summary.warnings++;
      }

      // Performance warnings
      if (loadTime > 3000) {
        routeTest.warnings.push(`Slow loading: ${loadTime}ms`);
        this.results.performance.slowRoutes.push({
          route,
          loadTime,
          viewport: viewport.device,
        });
      }

      // Handle console errors
      if (consoleErrors.length > 0) {
        routeTest.warnings.push(`Console errors: ${consoleErrors.slice(0, 2).join(', ')}`);
      }

      // Take screenshot if enabled
      if (CONFIG.screenshots && routeTest.status === 'success') {
        const screenshotPath = path.join(
          CONFIG.screenshotDir,
          `${route.replace(/\//g, '_') || 'home'}_${viewport.device}.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        routeTest.screenshot = screenshotPath;
      }
    } catch (error) {
      routeTest.status = 'error';
      routeTest.errors.push(`Navigation error: ${error.message}`);
      this.results.summary.errors++;

      if (error.message.includes('timeout')) {
        this.results.summary.loadingIssues++;
      }
    }

    this.results.routes.push(routeTest);
    this.results.summary.totalRoutes++;
    this.results.performance.totalLoadTime += routeTest.loadTime;

    // Progress indicator
    const statusIcon = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      unknown: '❓',
    }[routeTest.status];

    console.log(`    ${statusIcon} ${routeTest.status.toUpperCase()} (${routeTest.loadTime}ms)`);

    if (routeTest.warnings.length > 0) {
      console.log(`    ⚠️  ${routeTest.warnings[0]}`);
    }
    if (routeTest.errors.length > 0) {
      console.log(`    ❌ ${routeTest.errors[0]}`);
    }
  }

  async analyzePage(page, routeTest, viewport) {
    try {
      // Wait a moment for any dynamic content
      await page.waitForTimeout(1000);

      // Check React app status
      const reactRoot = await page.$('#root');
      const hasReactContent = reactRoot
        ? await page.evaluate((el) => el.children.length > 0, reactRoot)
        : false;

      routeTest.reactStatus = hasReactContent ? 'loaded' : 'empty';
      routeTest.contentLoaded = hasReactContent;

      // Check for authentication requirements
      const hasLoginForm =
        (await page.$('form[action*="login"], .login-form, [data-testid*="login"]')) !== null;
      const hasAuthError = (await page.$('.auth-error, [data-testid*="auth-error"]')) !== null;
      routeTest.authRequired = hasLoginForm || hasAuthError;

      // Check for React errors
      const hasReactError = (await page.$('.react-error, [data-testid*="error"]')) !== null;
      if (hasReactError) {
        routeTest.errors.push('React error detected');
        this.results.summary.reactErrors++;
      }

      // Mobile optimization checks
      if (viewport.device.includes('mobile')) {
        const viewportMeta = await page
          .$eval('meta[name="viewport"]', (el) => el.content)
          .catch(() => null);
        const touchOptimized = await this.checkTouchOptimization(page);

        routeTest.mobileOptimized = !!(viewportMeta && touchOptimized);

        if (routeTest.mobileOptimized) {
          this.results.mobileCompatibility.touchOptimized++;
        } else {
          this.results.mobileCompatibility.responsiveIssues++;
        }
      }

      // Check for specific app indicators
      const hasNavigation = (await page.$('nav, .nav, [role="navigation"]')) !== null;
      const hasHeader = (await page.$('header, .header')) !== null;
      const hasSidebar = (await page.$('.sidebar, [role="complementary"]')) !== null;

      if (hasNavigation || hasHeader || hasSidebar) {
        routeTest.contentLoaded = true;
      }
    } catch (error) {
      routeTest.warnings.push(`Page analysis failed: ${error.message}`);
    }
  }

  async checkTouchOptimization(page) {
    try {
      // Check for touch-friendly elements
      const touchElements = await page.$$eval('button, a, input, [role="button"]', (elements) => {
        return elements.slice(0, 10).map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            touchFriendly: rect.width >= 44 && rect.height >= 44,
          };
        });
      });

      const touchFriendlyCount = touchElements.filter((el) => el.touchFriendly).length;
      return touchFriendlyCount / touchElements.length > 0.7; // 70% touch-friendly
    } catch (error) {
      return false;
    }
  }

  async generateReport() {
    // Calculate performance metrics
    if (this.results.summary.totalRoutes > 0) {
      this.results.performance.averageLoadTime =
        this.results.performance.totalLoadTime / this.results.summary.totalRoutes;
    }

    // Identify common issues
    this.identifyCommonIssues();

    // Generate detailed JSON report
    const reportPath = path.join(CONFIG.reportDir, 'comprehensive-app-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    // Generate HTML report
    await this.generateHtmlReport();

    console.log(`\n📄 Reports generated:`);
    console.log(`  📊 JSON: ${reportPath}`);
    console.log(`  🌐 HTML: ${path.join(CONFIG.reportDir, 'comprehensive-app-test-report.html')}`);
  }

  identifyCommonIssues() {
    const issueMap = {};

    this.results.routes.forEach((route) => {
      [...route.errors, ...route.warnings].forEach((issue) => {
        const key = issue.substring(0, 50); // Truncate for grouping
        issueMap[key] = (issueMap[key] || 0) + 1;
      });
    });

    this.results.commonIssues = Object.entries(issueMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([issue, count]) => ({ issue, count }));
  }

  async generateHtmlReport() {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Printyx Comprehensive App Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; line-height: 1.6; background: #f5f7fa; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .metric { font-size: 2.5em; font-weight: bold; margin-bottom: 10px; }
        .metric.success { color: #10b981; }
        .metric.warning { color: #f59e0b; }
        .metric.error { color: #ef4444; }
        .route { border: 1px solid #e5e7eb; margin: 15px 0; padding: 20px; border-radius: 8px; background: white; }
        .success { border-left: 5px solid #10b981; }
        .error { border-left: 5px solid #ef4444; }
        .warning { border-left: 5px solid #f59e0b; }
        .unknown { border-left: 5px solid #6b7280; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: 500; margin: 2px; }
        .badge-success { background: #d1fae5; color: #065f46; }
        .badge-error { background: #fee2e2; color: #991b1b; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .screenshot { max-width: 300px; margin: 10px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .issues-list { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .recommendations { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Printyx Comprehensive App Test Report</h1>
        <p>Complete application testing and analysis</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Test Duration:</strong> ${Math.round((this.results.summary.endTime - this.results.summary.startTime) / 1000)}s</p>
    </div>

    <div class="summary">
        <div class="card">
            <div class="metric success">${this.results.summary.successful}</div>
            <h3>Successful Routes</h3>
            <p>Out of ${this.results.summary.totalRoutes} tested</p>
        </div>
        <div class="card">
            <div class="metric error">${this.results.summary.errors}</div>
            <h3>Errors Found</h3>
            <p>Routes with critical issues</p>
        </div>
        <div class="card">
            <div class="metric warning">${this.results.summary.warnings}</div>
            <h3>Warnings</h3>
            <p>Routes with minor issues</p>
        </div>
        <div class="card">
            <div class="metric">${Math.round(this.results.performance.averageLoadTime)}ms</div>
            <h3>Avg Load Time</h3>
            <p>Performance metric</p>
        </div>
        <div class="card">
            <div class="metric">${this.results.summary.reactErrors}</div>
            <h3>React Errors</h3>
            <p>Frontend framework issues</p>
        </div>
        <div class="card">
            <div class="metric">${this.results.mobileCompatibility.touchOptimized}</div>
            <h3>Mobile Optimized</h3>
            <p>Touch-friendly pages</p>
        </div>
    </div>

    ${
      this.results.commonIssues.length > 0
        ? `
    <div class="issues-list">
        <h2>🔍 Most Common Issues</h2>
        <ol>
            ${this.results.commonIssues
              .map(
                (issue) => `
                <li><strong>${issue.issue}</strong> (${issue.count} occurrences)</li>
            `,
              )
              .join('')}
        </ol>
    </div>
    `
        : ''
    }

    <div class="recommendations">
        <h2>💡 Key Recommendations</h2>
        <ul>
            <li><strong>Authentication:</strong> ${this.results.routes.filter((r) => r.authRequired).length} routes require authentication - consider implementing proper auth flow testing</li>
            <li><strong>Performance:</strong> ${this.results.performance.slowRoutes.length} routes load slowly (>3s) - optimize for better user experience</li>
            <li><strong>Mobile:</strong> ${this.results.mobileCompatibility.responsiveIssues} routes have mobile compatibility issues</li>
            <li><strong>Error Handling:</strong> Implement proper error boundaries and loading states for better UX</li>
            <li><strong>Testing:</strong> Consider implementing unit tests and integration tests alongside E2E testing</li>
        </ul>
    </div>

    <h2>📱 Route Test Results</h2>
    ${this.results.routes
      .map(
        (route) => `
        <div class="route ${route.status}">
            <h3>${route.route} <span class="badge badge-${route.status}">${route.viewport}</span></h3>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0;">
                <div>
                    <strong>Status:</strong> <span class="badge badge-${route.status}">${route.status.toUpperCase()}</span><br>
                    <strong>Load Time:</strong> ${route.loadTime}ms<br>
                    <strong>HTTP Status:</strong> ${route.httpStatus || 'N/A'}
                </div>
                <div>
                    <strong>React Status:</strong> ${route.reactStatus}<br>
                    <strong>Content Loaded:</strong> ${route.contentLoaded ? '✅' : '❌'}<br>
                    <strong>Auth Required:</strong> ${route.authRequired ? '🔐' : '✅'}
                </div>
                <div>
                    <strong>Mobile Optimized:</strong> ${route.mobileOptimized ? '📱✅' : '📱❌'}<br>
                    <strong>Errors:</strong> ${route.errors.length}<br>
                    <strong>Warnings:</strong> ${route.warnings.length}
                </div>
            </div>

            ${
              route.errors.length > 0
                ? `
                <div style="margin-top: 15px;"><strong>❌ Errors:</strong>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        ${route.errors.map((error) => `<li style="color: #dc2626;">${error}</li>`).join('')}
                    </ul>
                </div>
            `
                : ''
            }

            ${
              route.warnings.length > 0
                ? `
                <div style="margin-top: 15px;"><strong>⚠️ Warnings:</strong>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        ${route.warnings.map((warning) => `<li style="color: #d97706;">${warning}</li>`).join('')}
                    </ul>
                </div>
            `
                : ''
            }

            ${
              route.screenshot
                ? `
                <div style="margin-top: 15px;">
                    <strong>📸 Screenshot:</strong><br>
                    <img src="${path.relative(CONFIG.reportDir, route.screenshot)}" alt="Screenshot" class="screenshot">
                </div>
            `
                : ''
            }
        </div>
    `,
      )
      .join('')}

    <div style="margin-top: 40px; padding: 20px; background: #f9fafb; border-radius: 8px; text-align: center; color: #6b7280;">
        <p>Generated by Printyx Testing Suite • ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>
    `;

    const htmlPath = path.join(CONFIG.reportDir, 'comprehensive-app-test-report.html');
    fs.writeFileSync(htmlPath, htmlContent);
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE APP TEST RESULTS');
    console.log('='.repeat(80));

    const totalRoutes = this.results.summary.totalRoutes;
    const successRate =
      totalRoutes > 0 ? Math.round((this.results.summary.successful / totalRoutes) * 100) : 0;

    console.log(
      `📈 SUCCESS RATE: ${successRate}% (${this.results.summary.successful}/${totalRoutes})`,
    );
    console.log(`✅ Successful: ${this.results.summary.successful}`);
    console.log(`❌ Errors: ${this.results.summary.errors}`);
    console.log(`⚠️  Warnings: ${this.results.summary.warnings}`);
    console.log(`⚛️  React Errors: ${this.results.summary.reactErrors}`);
    console.log(`🐌 Slow Routes: ${this.results.performance.slowRoutes.length}`);
    console.log('');

    console.log('📱 MOBILE COMPATIBILITY:');
    console.log(`Touch Optimized: ${this.results.mobileCompatibility.touchOptimized}`);
    console.log(`Responsive Issues: ${this.results.mobileCompatibility.responsiveIssues}`);
    console.log('');

    console.log('⚡ PERFORMANCE:');
    console.log(`Average Load Time: ${Math.round(this.results.performance.averageLoadTime)}ms`);
    console.log('');

    if (this.results.commonIssues.length > 0) {
      console.log('🔍 TOP ISSUES:');
      this.results.commonIssues.slice(0, 5).forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.issue} (${issue.count}x)`);
      });
    }

    console.log('='.repeat(80));
  }
}

// Main execution
async function main() {
  const tester = new ComprehensiveAppTest();
  return await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ComprehensiveAppTest;
