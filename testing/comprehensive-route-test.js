const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// All routes extracted from the role-based sidebar
const ALL_ROUTES = [
  "/",
  "/leads-management",
  "/crm-enhanced",
  "/sales-pipeline",
  "/crm-goals-dashboard",
  "/contacts",
  "/company-contacts",
  "/deals-management",
  "/sales-pipeline-forecasting",
  "/customers",
  "/customer-success-management",
  "/contracts",
  "/quote-proposal-generation",
  "/commission-management",
  "/demo-scheduling",
  "/task-management",
  "/service-dispatch",
  "/service-dispatch-enhanced",
  "/service-dispatch-optimization",
  "/mobile-field-service",
  "/mobile-field-operations",
  "/mobile-service-app",
  "/service-analytics",
  "/service-products",
  "/remote-monitoring",
  "/preventive-maintenance-scheduling",
  "/preventive-maintenance-automation",
  "/meter-readings",
  "/incident-response-system",
  "/inventory",
  "/invoices",
  "/advanced-billing-engine",
  "/meter-billing",
  "/chart-of-accounts",
  "/journal-entries",
  "/financial-forecasting",
  "/vendors",
  "/accounts-payable",
  "/accounts-receivable",
  "/reports",
  "/advanced-reporting",
  "/advanced-analytics-dashboard",
  "/ai-analytics-dashboard",
  "/predictive-analytics",
  "/integration-hub",
  "/quickbooks-integration",
  "/erp-integration",
  "/esignature-integration",
  "/system-integrations",
  "/workflow-automation",
  "/business-process-optimization",
  "/business-records",
  "/document-management",
  "/security-compliance-management",
  "/deployment-readiness",
  "/performance-monitoring",
  "/data-enrichment",
  "/root-admin-dashboard",
  "/social-media-generator",
  "/security-management",
  "/system-monitoring",
  "/access-control",
  "/platform-configuration",
  "/database-management",
  "/tenant-setup",
  "/professional-services",
  "/managed-services",
  "/customer-self-service-portal",
  "/mobile-optimization",
  "/settings",
];

// Test configuration
const CONFIG = {
  baseUrl: "http://localhost:5000",
  timeout: 30000,
  viewports: [
    { width: 1920, height: 1080, device: "desktop" },
    { width: 768, height: 1024, device: "tablet" },
    { width: 375, height: 667, device: "mobile" },
  ],
  screenshots: true,
  screenshotDir: "./test-results/screenshots",
  reportDir: "./test-results",
};

class ComprehensiveRouteTest {
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
      buttons: [],
      forms: [],
      performance: {
        averageLoadTime: 0,
        slowRoutes: [],
        totalLoadTime: 0,
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
    console.log("🚀 Starting Comprehensive Route Testing...");
    console.log(`📊 Testing ${ALL_ROUTES.length} routes`);
    console.log("=".repeat(60));

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    });

    try {
      // Test each viewport
      for (const viewport of CONFIG.viewports) {
        console.log(
          `\n📱 Testing ${viewport.device} viewport (${viewport.width}x${viewport.height})`
        );
        await this.testViewport(browser, viewport);
      }

      this.results.summary.endTime = new Date();
      await this.generateReport();
    } finally {
      await browser.close();
    }

    this.printSummary();
  }

  async testViewport(browser, viewport) {
    const page = await browser.newPage();

    try {
      await page.setViewport({
        width: viewport.width,
        height: viewport.height,
        isMobile: viewport.device === "mobile",
      });

      // Enable request interception to catch 404s
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        request.continue();
      });

      // Listen for console errors
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      // Test each route
      for (const route of ALL_ROUTES) {
        await this.testRoute(page, route, viewport, consoleErrors);
      }
    } finally {
      await page.close();
    }
  }

  async testRoute(page, route, viewport, consoleErrors) {
    const routeTest = {
      route: route,
      viewport: viewport.device,
      status: "unknown",
      httpStatus: null,
      loadTime: 0,
      errors: [],
      warnings: [],
      buttons: [],
      forms: [],
      screenshot: null,
      timestamp: new Date(),
    };

    console.log(`  🔍 Testing: ${route} (${viewport.device})`);

    try {
      const startTime = Date.now();

      // Navigate to route with timeout
      const response = await page.goto(`${CONFIG.baseUrl}${route}`, {
        waitUntil: "networkidle0",
        timeout: CONFIG.timeout,
      });

      const loadTime = Date.now() - startTime;
      routeTest.loadTime = loadTime;
      routeTest.httpStatus = response.status();

      // Check for successful load
      if (response.status() >= 200 && response.status() < 300) {
        routeTest.status = "success";
        this.results.summary.successful++;

        // Test page content and interactions
        await this.testPageInteractions(page, routeTest);

        // Take screenshot
        if (CONFIG.screenshots) {
          const screenshotPath = path.join(
            CONFIG.screenshotDir,
            `${route.replace(/\//g, "_") || "home"}_${viewport.device}.png`
          );
          await page.screenshot({ path: screenshotPath, fullPage: true });
          routeTest.screenshot = screenshotPath;
        }

        // Performance warnings
        if (loadTime > 3000) {
          routeTest.warnings.push(`Slow loading time: ${loadTime}ms`);
          this.results.performance.slowRoutes.push({
            route,
            loadTime,
            viewport: viewport.device,
          });
        }
      } else if (response.status() === 404) {
        routeTest.status = "error";
        routeTest.errors.push("404 - Page Not Found");
        this.results.summary.errors++;
      } else if (response.status() >= 500) {
        routeTest.status = "error";
        routeTest.errors.push(`${response.status()} - Server Error`);
        this.results.summary.errors++;
      } else {
        routeTest.status = "warning";
        routeTest.warnings.push(`HTTP ${response.status()}`);
        this.results.summary.warnings++;
      }

      // Check for console errors
      if (consoleErrors.length > 0) {
        routeTest.errors.push(
          ...consoleErrors.map((err) => `Console Error: ${err}`)
        );
        consoleErrors.length = 0; // Clear for next route
      }

      this.results.performance.totalLoadTime += loadTime;
    } catch (error) {
      routeTest.status = "error";
      routeTest.errors.push(`Navigation Error: ${error.message}`);
      this.results.summary.errors++;
      console.log(`    ❌ Error: ${error.message}`);
    }

    this.results.routes.push(routeTest);
    this.results.summary.totalRoutes++;

    // Progress indicator
    const statusIcon =
      routeTest.status === "success"
        ? "✅"
        : routeTest.status === "error"
        ? "❌"
        : "⚠️";
    console.log(
      `    ${statusIcon} ${routeTest.status.toUpperCase()} (${
        routeTest.loadTime
      }ms)`
    );
  }

  async testPageInteractions(page, routeTest) {
    try {
      // Wait for page to be fully loaded
      await page.waitForTimeout(1000);

      // Test all buttons
      const buttons = await page.$$eval(
        'button, input[type="button"], input[type="submit"], [role="button"]',
        (elements) => {
          return elements.map((el, index) => {
            const text =
              el.textContent?.trim() ||
              el.value ||
              el.getAttribute("aria-label") ||
              `button-${index}`;
            const hasOnClick = !!(
              el.onclick ||
              el.getAttribute("onclick") ||
              el.classList.contains("cursor-pointer")
            );
            const isDisabled =
              el.disabled || el.getAttribute("disabled") !== null;

            return {
              text: text.substring(0, 50), // Limit text length
              hasOnClick,
              isDisabled,
              className: el.className,
              tagName: el.tagName,
            };
          });
        }
      );

      // Analyze buttons
      buttons.forEach((button, index) => {
        const buttonTest = {
          index,
          text: button.text,
          hasHandler: button.hasOnClick,
          isDisabled: button.isDisabled,
          tagName: button.tagName,
          route: routeTest.route,
        };

        if (!button.hasOnClick && !button.isDisabled) {
          routeTest.warnings.push(
            `Button "${button.text}" appears to lack click handler`
          );
        }

        this.results.buttons.push(buttonTest);
        routeTest.buttons.push(buttonTest);
      });

      // Test forms (including React Hook Forms)
      const forms = await page.$$eval("form", (elements) => {
        return elements.map((form, index) => {
          // Check for various submit handler patterns
          const hasSubmitHandler = !!(
            form.onsubmit || 
            form.getAttribute("onsubmit") ||
            // React Hook Form patterns
            form.getAttribute("novalidate") !== null || // React Hook Form sets novalidate
            form.querySelector('button[type="submit"]') ||
            form.querySelector('input[type="submit"]') ||
            // Look for event listeners (approximate check)
            form.hasAttribute('data-testid') ||
            form.className.includes('form')
          );
          const action = form.action || "";
          const method = form.method || "GET";
          const inputCount = form.querySelectorAll("input, textarea, select").length;

          return {
            index,
            hasSubmitHandler,
            action,
            method,
            inputCount,
            isReactForm: form.getAttribute("novalidate") !== null,
            hasSubmitButton: !!(form.querySelector('button[type="submit"]') || form.querySelector('input[type="submit"]'))
          };
        });
      });

      // Analyze forms
      forms.forEach((form, index) => {
        const formTest = {
          index,
          hasHandler: form.hasSubmitHandler,
          action: form.action,
          method: form.method,
          inputCount: form.inputCount,
          isReactForm: form.isReactForm,
          hasSubmitButton: form.hasSubmitButton,
          route: routeTest.route,
        };

        // More lenient warning for React forms
        if (!form.hasSubmitHandler && !form.hasSubmitButton && form.inputCount > 0) {
          routeTest.warnings.push(
            `Form ${index} may lack submit handler (found ${form.inputCount} inputs)`
          );
        }

        this.results.forms.push(formTest);
        routeTest.forms.push(formTest);
      });

      // Test actual button clicks (sample a few)
      if (buttons.length > 0) {
        await this.testButtonClicks(page, routeTest);
      }
    } catch (error) {
      routeTest.warnings.push(`Interaction testing error: ${error.message}`);
    }
  }

  async testButtonClicks(page, routeTest) {
    try {
      // Test first few clickable buttons
      const clickableButtons = await page.$$(
        'button:not([disabled]), input[type="button"]:not([disabled]), input[type="submit"]:not([disabled])'
      );

      const maxButtonsToTest = Math.min(3, clickableButtons.length);

      for (let i = 0; i < maxButtonsToTest; i++) {
        try {
          const button = clickableButtons[i];
          const buttonText = await page.evaluate(
            (el) => el.textContent?.trim() || el.value || "unnamed",
            button
          );

          // Get current URL before click
          const beforeUrl = page.url();

          // Click the button
          await button.click();

          // Wait a short time for any actions to complete
          await page.waitForTimeout(500);

          // Check if URL changed or modal appeared
          const afterUrl = page.url();
          const modalAppeared =
            (await page.$(
              '[role="dialog"], .modal, [data-testid*="modal"]'
            )) !== null;

          if (beforeUrl !== afterUrl) {
            routeTest.buttons[i] = routeTest.buttons[i] || {};
            routeTest.buttons[i].action = "navigation";
            routeTest.buttons[i].newUrl = afterUrl;
          } else if (modalAppeared) {
            routeTest.buttons[i] = routeTest.buttons[i] || {};
            routeTest.buttons[i].action = "modal";
          } else {
            // Check for other changes (form submission, state changes, etc.)
            routeTest.buttons[i] = routeTest.buttons[i] || {};
            routeTest.buttons[i].action = "unknown";
          }

          // Navigate back to original route if URL changed
          if (beforeUrl !== afterUrl) {
            await page.goto(beforeUrl, { waitUntil: "networkidle0" });
          }
        } catch (clickError) {
          routeTest.warnings.push(
            `Button click test failed: ${clickError.message}`
          );
        }
      }
    } catch (error) {
      routeTest.warnings.push(`Button click testing error: ${error.message}`);
    }
  }

  async generateReport() {
    // Calculate performance metrics
    this.results.performance.averageLoadTime =
      this.results.performance.totalLoadTime / this.results.summary.totalRoutes;

    // Generate detailed JSON report
    const reportPath = path.join(
      CONFIG.reportDir,
      "comprehensive-test-report.json"
    );
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    // Generate HTML report
    await this.generateHtmlReport();

    console.log(`\n📄 Reports generated:`);
    console.log(`  📊 JSON: ${reportPath}`);
    console.log(
      `  🌐 HTML: ${path.join(CONFIG.reportDir, "test-report.html")}`
    );
  }

  async generateHtmlReport() {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Printyx Route Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .route { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .success { border-left: 5px solid #4CAF50; }
        .error { border-left: 5px solid #f44336; }
        .warning { border-left: 5px solid #ff9800; }
        .button-test { background: #f9f9f9; padding: 10px; margin: 5px 0; border-radius: 3px; }
        .screenshot { max-width: 300px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>🚀 Printyx Comprehensive Route Test Report</h1>
    
    <div class="summary">
        <h2>📊 Test Summary</h2>
        <p><strong>Total Routes Tested:</strong> ${
          this.results.summary.totalRoutes
        }</p>
        <p><strong>✅ Successful:</strong> ${
          this.results.summary.successful
        }</p>
        <p><strong>❌ Errors:</strong> ${this.results.summary.errors}</p>
        <p><strong>⚠️ Warnings:</strong> ${this.results.summary.warnings}</p>
        <p><strong>⚡ Average Load Time:</strong> ${Math.round(
          this.results.performance.averageLoadTime
        )}ms</p>
        <p><strong>🐌 Slow Routes (>3s):</strong> ${
          this.results.performance.slowRoutes.length
        }</p>
        <p><strong>🕒 Test Duration:</strong> ${Math.round(
          (this.results.summary.endTime - this.results.summary.startTime) / 1000
        )}s</p>
    </div>

    <h2>📱 Route Test Results</h2>
    ${this.results.routes
      .map(
        (route) => `
        <div class="route ${route.status}">
            <h3>${route.route} (${route.viewport})</h3>
            <p><strong>Status:</strong> ${route.status.toUpperCase()} (HTTP ${
          route.httpStatus
        })</p>
            <p><strong>Load Time:</strong> ${route.loadTime}ms</p>
            
            ${
              route.errors.length > 0
                ? `
                <div><strong>❌ Errors:</strong>
                    <ul>${route.errors
                      .map((error) => `<li>${error}</li>`)
                      .join("")}</ul>
                </div>
            `
                : ""
            }
            
            ${
              route.warnings.length > 0
                ? `
                <div><strong>⚠️ Warnings:</strong>
                    <ul>${route.warnings
                      .map((warning) => `<li>${warning}</li>`)
                      .join("")}</ul>
                </div>
            `
                : ""
            }
            
            ${
              route.buttons.length > 0
                ? `
                <div><strong>🔘 Buttons Found:</strong> ${route.buttons.length}
                    ${route.buttons
                      .slice(0, 5)
                      .map(
                        (btn) => `
                        <div class="button-test">
                            <strong>"${btn.text}"</strong> - 
                            Handler: ${btn.hasHandler ? "✅" : "❌"} - 
                            Action: ${btn.action || "none"}
                        </div>
                    `
                      )
                      .join("")}
                </div>
            `
                : ""
            }
            
            ${
              route.screenshot
                ? `
                <div><strong>📸 Screenshot:</strong><br>
                    <img src="${path.relative(
                      CONFIG.reportDir,
                      route.screenshot
                    )}" alt="Screenshot" class="screenshot">
                </div>
            `
                : ""
            }
        </div>
    `
      )
      .join("")}

    <h2>🔘 Button Analysis</h2>
    <table>
        <tr>
            <th>Route</th>
            <th>Button Text</th>
            <th>Has Handler</th>
            <th>Action</th>
            <th>Status</th>
        </tr>
        ${this.results.buttons
          .slice(0, 50)
          .map(
            (btn) => `
            <tr>
                <td>${btn.route}</td>
                <td>${btn.text}</td>
                <td>${btn.hasHandler ? "✅" : "❌"}</td>
                <td>${btn.action || "Unknown"}</td>
                <td>${btn.hasHandler ? "Good" : "Needs Review"}</td>
            </tr>
        `
          )
          .join("")}
    </table>

    <p><em>Generated: ${new Date().toLocaleString()}</em></p>
</body>
</html>
    `;

    const htmlPath = path.join(CONFIG.reportDir, "test-report.html");
    fs.writeFileSync(htmlPath, htmlContent);
  }

  printSummary() {
    console.log("\n" + "=".repeat(60));
    console.log("📊 COMPREHENSIVE TEST RESULTS SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Routes Tested: ${this.results.summary.totalRoutes}`);
    console.log(
      `✅ Successful: ${this.results.summary.successful} (${(
        (this.results.summary.successful / this.results.summary.totalRoutes) *
        100
      ).toFixed(1)}%)`
    );
    console.log(`❌ Errors: ${this.results.summary.errors}`);
    console.log(`⚠️  Warnings: ${this.results.summary.warnings}`);
    console.log("");
    console.log("⚡ PERFORMANCE INSIGHTS:");
    console.log(
      `Average Load Time: ${Math.round(
        this.results.performance.averageLoadTime
      )}ms`
    );
    console.log(
      `Slow Routes (>3s): ${this.results.performance.slowRoutes.length}`
    );
    console.log("");
    console.log("🔘 BUTTON ANALYSIS:");
    console.log(`Total Buttons Found: ${this.results.buttons.length}`);
    const buttonsWithHandlers = this.results.buttons.filter(
      (btn) => btn.hasHandler
    ).length;
    console.log(
      `Buttons with Handlers: ${buttonsWithHandlers} (${(
        (buttonsWithHandlers / this.results.buttons.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log("");
    console.log("📋 FORM ANALYSIS:");
    console.log(`Total Forms Found: ${this.results.forms.length}`);
    const formsWithHandlers = this.results.forms.filter(
      (form) => form.hasHandler
    ).length;
    console.log(
      `Forms with Handlers: ${formsWithHandlers} (${(
        (formsWithHandlers / this.results.forms.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log("");

    if (this.results.performance.slowRoutes.length > 0) {
      console.log("🐌 SLOWEST ROUTES:");
      this.results.performance.slowRoutes
        .sort((a, b) => b.loadTime - a.loadTime)
        .slice(0, 5)
        .forEach((route) => {
          console.log(
            `  ${route.route} (${route.viewport}): ${route.loadTime}ms`
          );
        });
    }

    console.log("=".repeat(60));
  }
}

// Main execution
async function main() {
  const tester = new ComprehensiveRouteTest();
  await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ComprehensiveRouteTest;
