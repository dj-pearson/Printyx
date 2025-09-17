const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration for standalone testing
const CONFIG = {
  baseUrl: 'http://localhost:8080', // Use HTTP server
  timeout: 30000,
  viewports: [
    { width: 1920, height: 1080, device: 'desktop' },
    { width: 768, height: 1024, device: 'tablet' },
    { width: 375, height: 667, device: 'mobile' },
    { width: 414, height: 896, device: 'mobile-large' },
    { width: 320, height: 568, device: 'mobile-small' },
  ],
  screenshots: true,
  screenshotDir: './test-results/screenshots',
  reportDir: './test-results',
};

// Test routes that we can test without a backend
const STANDALONE_ROUTES = [
  '/Printyx/mobile-test.html', // Mobile optimization test page
  '/Printyx/client/index.html', // Main React app entry point
];

class StandaloneTest {
  constructor() {
    this.results = {
      summary: {
        totalRoutes: 0,
        successful: 0,
        errors: 0,
        warnings: 0,
        startTime: new Date(),
        endTime: null,
      },
      routes: [],
      mobileFeatures: [],
      performance: {
        averageLoadTime: 0,
        slowRoutes: [],
        totalLoadTime: 0,
      },
      screenshots: [],
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
    console.log('🚀 Starting Standalone Printyx Testing...');
    console.log(
      `📱 Testing ${STANDALONE_ROUTES.length} pages across ${CONFIG.viewports.length} viewports`,
    );
    console.log('='.repeat(80));

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
      // Test each viewport
      for (const viewport of CONFIG.viewports) {
        console.log(
          `\n📱 Testing ${viewport.device} viewport (${viewport.width}x${viewport.height})`,
        );
        await this.testViewport(browser, viewport);
      }

      // Run specific mobile tests
      await this.runMobileOptimizationTests(browser);

      this.results.summary.endTime = new Date();
      await this.generateReport();
    } finally {
      await browser.close();
    }

    this.printSummary();
    return this.results;
  }

  async testViewport(browser, viewport) {
    const page = await browser.newPage();

    try {
      await page.setViewport({
        width: viewport.width,
        height: viewport.height,
        isMobile: viewport.device.includes('mobile'),
        hasTouch: viewport.device.includes('mobile'),
      });

      // Test each route
      for (const route of STANDALONE_ROUTES) {
        await this.testRoute(page, route, viewport);
      }
    } finally {
      await page.close();
    }
  }

  async testRoute(page, route, viewport) {
    const routeTest = {
      route: route,
      viewport: viewport.device,
      status: 'unknown',
      loadTime: 0,
      errors: [],
      warnings: [],
      mobileFeatures: [],
      screenshot: null,
      timestamp: new Date(),
    };

    console.log(`  🔍 Testing: ${route} (${viewport.device})`);

    try {
      const startTime = Date.now();
      const url = `${CONFIG.baseUrl}${route}`;

      console.log(`    📂 Loading: ${url}`);

      // Navigate to the file
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: CONFIG.timeout,
      });

      const loadTime = Date.now() - startTime;
      routeTest.loadTime = loadTime;
      routeTest.status = 'success';

      // Test mobile-specific features if it's the mobile test page
      if (route.includes('mobile-test.html')) {
        await this.testMobileFeatures(page, routeTest, viewport);
      }

      // Test React app features if it's the main app
      if (route.includes('client/index.html')) {
        await this.testReactAppFeatures(page, routeTest, viewport);
      }

      // Take screenshot
      if (CONFIG.screenshots) {
        const screenshotPath = path.join(
          CONFIG.screenshotDir,
          `${route.replace(/[\/\\.]/g, '_')}_${viewport.device}.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        routeTest.screenshot = screenshotPath;
        this.results.screenshots.push({
          route,
          viewport: viewport.device,
          path: screenshotPath,
        });
      }

      // Performance check
      if (loadTime > 3000) {
        routeTest.warnings.push(`Slow loading time: ${loadTime}ms`);
      }

      this.results.summary.successful++;
    } catch (error) {
      routeTest.status = 'error';
      routeTest.errors.push(`Navigation Error: ${error.message}`);
      this.results.summary.errors++;
      console.log(`    ❌ Error: ${error.message}`);
    }

    this.results.routes.push(routeTest);
    this.results.summary.totalRoutes++;
    this.results.performance.totalLoadTime += routeTest.loadTime;

    // Progress indicator
    const statusIcon = routeTest.status === 'success' ? '✅' : '❌';
    console.log(`    ${statusIcon} ${routeTest.status.toUpperCase()} (${routeTest.loadTime}ms)`);
  }

  async testMobileFeatures(page, routeTest, viewport) {
    try {
      console.log(`    📱 Testing mobile features...`);

      // Test viewport meta tag
      const viewportMeta = await page
        .$eval('meta[name="viewport"]', (el) => el.content)
        .catch(() => null);
      if (viewportMeta) {
        routeTest.mobileFeatures.push({
          feature: 'viewport-meta',
          status: 'present',
          value: viewportMeta,
        });
      } else {
        routeTest.warnings.push('Missing viewport meta tag');
      }

      // Test touch targets (minimum 44x44px)
      const touchTargets = await page
        .$$eval('.touch-target', (elements) => {
          return elements.map((el) => {
            const rect = el.getBoundingClientRect();
            return {
              width: rect.width,
              height: rect.height,
              meetsStandard: rect.width >= 44 && rect.height >= 44,
            };
          });
        })
        .catch(() => []);

      routeTest.mobileFeatures.push({
        feature: 'touch-targets',
        status: 'tested',
        count: touchTargets.length,
        compliant: touchTargets.filter((t) => t.meetsStandard).length,
      });

      // Test safe area support
      const safeAreaSupport = await page.evaluate(() => {
        const testEl = document.createElement('div');
        testEl.style.paddingTop = 'env(safe-area-inset-top)';
        return testEl.style.paddingTop !== 'env(safe-area-inset-top)';
      });

      routeTest.mobileFeatures.push({
        feature: 'safe-area-support',
        status: safeAreaSupport ? 'supported' : 'not-supported',
      });

      // Test form inputs (16px minimum to prevent zoom)
      const formInputs = await page
        .$$eval('.mobile-input', (elements) => {
          return elements.map((el) => {
            const styles = window.getComputedStyle(el);
            const fontSize = parseFloat(styles.fontSize);
            return {
              fontSize: fontSize,
              preventsZoom: fontSize >= 16,
            };
          });
        })
        .catch(() => []);

      routeTest.mobileFeatures.push({
        feature: 'form-inputs',
        status: 'tested',
        count: formInputs.length,
        zoomPrevention: formInputs.filter((i) => i.preventsZoom).length,
      });

      // Test touch events
      const touchSupport = await page.evaluate(() => {
        return 'ontouchstart' in window;
      });

      routeTest.mobileFeatures.push({
        feature: 'touch-events',
        status: touchSupport ? 'supported' : 'not-supported',
      });

      console.log(`    ✅ Tested ${routeTest.mobileFeatures.length} mobile features`);
    } catch (error) {
      routeTest.warnings.push(`Mobile feature testing failed: ${error.message}`);
    }
  }

  async testReactAppFeatures(page, routeTest, viewport) {
    try {
      console.log(`    ⚛️ Testing React app features...`);

      // Wait a bit for React to potentially load
      await page.waitForTimeout(3000);

      // Check if React app loaded
      const reactRoot = await page.$('#root').catch(() => null);
      if (reactRoot) {
        const hasContent = await page.evaluate((el) => el.children.length > 0, reactRoot);
        if (hasContent) {
          routeTest.mobileFeatures.push({
            feature: 'react-app',
            status: 'loaded',
          });
        } else {
          routeTest.warnings.push('React app root is empty - may not have loaded properly');
        }
      } else {
        routeTest.warnings.push('React app root element not found');
      }

      // Check for console errors
      const logs = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          logs.push(msg.text());
        }
      });

      if (logs.length > 0) {
        routeTest.warnings.push(`Console errors: ${logs.slice(0, 3).join(', ')}`);
      }
    } catch (error) {
      routeTest.warnings.push(`React app testing failed: ${error.message}`);
    }
  }

  async runMobileOptimizationTests(browser) {
    console.log(`\n📱 Running specialized mobile optimization tests...`);

    const page = await browser.newPage();

    try {
      // Test different mobile viewports with the mobile test page
      const mobileViewports = [
        { width: 375, height: 667, device: 'iPhone 8' },
        { width: 414, height: 896, device: 'iPhone 11 Pro' },
        { width: 360, height: 740, device: 'Samsung Galaxy S10' },
        { width: 320, height: 568, device: 'iPhone 5/SE' },
      ];

      for (const viewport of mobileViewports) {
        await page.setViewport({
          width: viewport.width,
          height: viewport.height,
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 2,
        });

        await page.goto(`${CONFIG.baseUrl}/mobile-test.html`, {
          waitUntil: 'networkidle0',
        });

        // Take screenshot
        const screenshotPath = path.join(
          CONFIG.screenshotDir,
          `mobile-optimization-${viewport.device.replace(/[\s\/]/g, '-')}.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });

        this.results.screenshots.push({
          route: '/mobile-test.html',
          viewport: viewport.device,
          path: screenshotPath,
          type: 'mobile-optimization',
        });

        console.log(`  📸 Screenshot taken for ${viewport.device}`);
      }
    } finally {
      await page.close();
    }
  }

  async generateReport() {
    // Calculate performance metrics
    this.results.performance.averageLoadTime =
      this.results.performance.totalLoadTime / this.results.summary.totalRoutes;

    // Generate detailed JSON report
    const reportPath = path.join(CONFIG.reportDir, 'standalone-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    // Generate HTML report
    await this.generateHtmlReport();

    console.log(`\n📄 Reports generated:`);
    console.log(`  📊 JSON: ${reportPath}`);
    console.log(`  🌐 HTML: ${path.join(CONFIG.reportDir, 'standalone-test-report.html')}`);
  }

  async generateHtmlReport() {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Printyx Standalone Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: white; border: 1px solid #e1e5e9; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric { font-size: 2em; font-weight: bold; color: #667eea; }
        .route { border: 1px solid #ddd; margin: 15px 0; padding: 20px; border-radius: 8px; }
        .success { border-left: 5px solid #10b981; background: #f0fdf4; }
        .error { border-left: 5px solid #ef4444; background: #fef2f2; }
        .warning { border-left: 5px solid #f59e0b; background: #fffbeb; }
        .mobile-feature { background: #f8fafc; padding: 10px; margin: 8px 0; border-radius: 6px; border-left: 3px solid #3b82f6; }
        .screenshot { max-width: 300px; margin: 10px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .screenshot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background-color: #f9fafb; font-weight: 600; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 500; }
        .badge-success { background: #d1fae5; color: #065f46; }
        .badge-error { background: #fee2e2; color: #991b1b; }
        .badge-warning { background: #fef3c7; color: #92400e; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Printyx Standalone Test Report</h1>
        <p>Mobile-first testing and optimization analysis</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>

    <div class="summary">
        <div class="card">
            <h3>Test Summary</h3>
            <div class="metric">${this.results.summary.totalRoutes}</div>
            <p>Total Routes Tested</p>
        </div>
        <div class="card">
            <h3>Success Rate</h3>
            <div class="metric">${Math.round((this.results.summary.successful / this.results.summary.totalRoutes) * 100)}%</div>
            <p>${this.results.summary.successful}/${this.results.summary.totalRoutes} Successful</p>
        </div>
        <div class="card">
            <h3>Performance</h3>
            <div class="metric">${Math.round(this.results.performance.averageLoadTime)}ms</div>
            <p>Average Load Time</p>
        </div>
        <div class="card">
            <h3>Screenshots</h3>
            <div class="metric">${this.results.screenshots.length}</div>
            <p>Captured Screenshots</p>
        </div>
    </div>

    <h2>📱 Route Test Results</h2>
    ${this.results.routes
      .map(
        (route) => `
        <div class="route ${route.status}">
            <h3>${route.route} (${route.viewport})</h3>
            <p><strong>Status:</strong> <span class="badge badge-${route.status}">${route.status.toUpperCase()}</span></p>
            <p><strong>Load Time:</strong> ${route.loadTime}ms</p>

            ${
              route.errors.length > 0
                ? `
                <div><strong>❌ Errors:</strong>
                    <ul>${route.errors.map((error) => `<li>${error}</li>`).join('')}</ul>
                </div>
            `
                : ''
            }

            ${
              route.warnings.length > 0
                ? `
                <div><strong>⚠️ Warnings:</strong>
                    <ul>${route.warnings.map((warning) => `<li>${warning}</li>`).join('')}</ul>
                </div>
            `
                : ''
            }

            ${
              route.mobileFeatures.length > 0
                ? `
                <div><strong>📱 Mobile Features Tested:</strong>
                    ${route.mobileFeatures
                      .map(
                        (feature) => `
                        <div class="mobile-feature">
                            <strong>${feature.feature}:</strong> ${feature.status}
                            ${feature.count !== undefined ? ` (${feature.count} items)` : ''}
                            ${feature.compliant !== undefined ? ` - ${feature.compliant} compliant` : ''}
                            ${feature.value ? ` - ${feature.value}` : ''}
                        </div>
                    `,
                      )
                      .join('')}
                </div>
            `
                : ''
            }

            ${
              route.screenshot
                ? `
                <div><strong>📸 Screenshot:</strong><br>
                    <img src="${path.relative(CONFIG.reportDir, route.screenshot)}" alt="Screenshot" class="screenshot">
                </div>
            `
                : ''
            }
        </div>
    `,
      )
      .join('')}

    <h2>📸 Screenshots Gallery</h2>
    <div class="screenshot-grid">
        ${this.results.screenshots
          .map(
            (screenshot) => `
            <div>
                <h4>${screenshot.route} - ${screenshot.viewport}</h4>
                <img src="${path.relative(CONFIG.reportDir, screenshot.path)}" alt="Screenshot" class="screenshot">
            </div>
        `,
          )
          .join('')}
    </div>

    <h2>📊 Mobile Optimization Analysis</h2>
    <div class="card">
        <p>This report provides insights into the mobile optimization and responsiveness of the Printyx application.
        Key areas tested include touch targets, safe area support, form input optimization, and viewport configuration.</p>

        <h3>Recommendations:</h3>
        <ul>
            <li>Ensure all touch targets meet the 44x44px minimum size requirement</li>
            <li>Implement safe area support for devices with notches or dynamic islands</li>
            <li>Use 16px or larger font sizes for form inputs to prevent unwanted zooming</li>
            <li>Test across multiple device types and orientations</li>
            <li>Optimize loading performance for mobile networks</li>
        </ul>
    </div>
</body>
</html>
    `;

    const htmlPath = path.join(CONFIG.reportDir, 'standalone-test-report.html');
    fs.writeFileSync(htmlPath, htmlContent);
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 STANDALONE TEST RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Routes Tested: ${this.results.summary.totalRoutes}`);
    console.log(
      `✅ Successful: ${this.results.summary.successful} (${Math.round((this.results.summary.successful / this.results.summary.totalRoutes) * 100)}%)`,
    );
    console.log(`❌ Errors: ${this.results.summary.errors}`);
    console.log(
      `⚠️ Warnings: ${this.results.routes.reduce((sum, r) => sum + r.warnings.length, 0)}`,
    );
    console.log('');
    console.log('⚡ PERFORMANCE:');
    console.log(`Average Load Time: ${Math.round(this.results.performance.averageLoadTime)}ms`);
    console.log('');
    console.log('📱 MOBILE OPTIMIZATION:');
    console.log(`Total Screenshots: ${this.results.screenshots.length}`);
    console.log(
      `Mobile Features Tested: ${this.results.routes.reduce((sum, r) => sum + r.mobileFeatures.length, 0)}`,
    );
    console.log('');
    console.log('🎯 KEY FINDINGS:');

    // Analyze mobile features
    const allFeatures = this.results.routes.flatMap((r) => r.mobileFeatures);
    const touchTargets = allFeatures.find((f) => f.feature === 'touch-targets');
    if (touchTargets) {
      console.log(
        `• Touch Targets: ${touchTargets.compliant}/${touchTargets.count} meet 44px minimum`,
      );
    }

    const safeArea = allFeatures.find((f) => f.feature === 'safe-area-support');
    if (safeArea) {
      console.log(`• Safe Area Support: ${safeArea.status}`);
    }

    const formInputs = allFeatures.find((f) => f.feature === 'form-inputs');
    if (formInputs) {
      console.log(
        `• Form Inputs: ${formInputs.zoomPrevention}/${formInputs.count} prevent unwanted zoom`,
      );
    }

    console.log('='.repeat(80));
  }
}

// Main execution
async function main() {
  const tester = new StandaloneTest();
  return await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = StandaloneTest;
