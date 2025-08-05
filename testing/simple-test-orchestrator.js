const ComprehensiveRouteTest = require("./comprehensive-route-test");
const fs = require("fs");
const path = require("path");

// Simple state management without external dependencies
class SimpleTestState {
  constructor() {
    this.state = {
      isRunning: false,
      currentRoute: null,
      currentViewport: null,
      progress: {
        current: 0,
        total: 0,
        percentage: 0,
      },
      results: {
        summary: {
          totalRoutes: 0,
          successful: 0,
          errors: 0,
          warnings: 0,
          startTime: null,
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
      },
      errors: [],
      warnings: [],
      screenshots: [],
    };
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state)); // Deep copy
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
  }

  startTest() {
    this.setState({
      isRunning: true,
      currentRoute: null,
      currentViewport: null,
      progress: { current: 0, total: 0, percentage: 0 },
      errors: [],
      warnings: [],
      screenshots: [],
      results: {
        ...this.state.results,
        summary: {
          ...this.state.results.summary,
          startTime: new Date(),
        },
      },
    });
  }

  updateProgress(current, total, route, viewport) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    this.setState({
      progress: { current, total, percentage },
      currentRoute: route,
      currentViewport: viewport,
    });
  }

  addResult(routeResult) {
    const currentResults = this.state.results;
    const updatedRoutes = [...currentResults.routes, routeResult];

    // Update summary
    const summary = {
      totalRoutes: updatedRoutes.length,
      successful: updatedRoutes.filter((r) => r.status === "success").length,
      errors: updatedRoutes.filter((r) => r.status === "error").length,
      warnings: updatedRoutes.filter((r) => r.status === "warning").length,
      startTime: currentResults.summary.startTime,
      endTime: null,
    };

    // Collect all buttons and forms
    const allButtons = updatedRoutes.flatMap((r) => r.buttons || []);
    const allForms = updatedRoutes.flatMap((r) => r.forms || []);

    // Update performance metrics
    const totalLoadTime = updatedRoutes.reduce(
      (sum, r) => sum + (r.loadTime || 0),
      0
    );
    const averageLoadTime = totalLoadTime / updatedRoutes.length;
    const slowRoutes = updatedRoutes.filter((r) => (r.loadTime || 0) > 3000);

    this.setState({
      results: {
        summary,
        routes: updatedRoutes,
        buttons: allButtons,
        forms: allForms,
        performance: {
          averageLoadTime,
          slowRoutes,
          totalLoadTime,
        },
      },
    });

    // Add to errors/warnings for quick access
    if (routeResult.errors && routeResult.errors.length > 0) {
      this.setState({
        errors: [
          ...this.state.errors,
          ...routeResult.errors.map((err) => ({
            route: routeResult.route,
            message: err,
            timestamp: new Date(),
          })),
        ],
      });
    }

    if (routeResult.warnings && routeResult.warnings.length > 0) {
      this.setState({
        warnings: [
          ...this.state.warnings,
          ...routeResult.warnings.map((warn) => ({
            route: routeResult.route,
            message: warn,
            timestamp: new Date(),
          })),
        ],
      });
    }

    if (routeResult.screenshot) {
      this.setState({
        screenshots: [
          ...this.state.screenshots,
          {
            route: routeResult.route,
            viewport: routeResult.viewport,
            path: routeResult.screenshot,
            timestamp: new Date(),
          },
        ],
      });
    }
  }

  completeTest() {
    const currentResults = this.state.results;
    this.setState({
      isRunning: false,
      currentRoute: null,
      currentViewport: null,
      results: {
        ...currentResults,
        summary: {
          ...currentResults.summary,
          endTime: new Date(),
        },
      },
    });
  }

  addError(error) {
    this.setState({
      errors: [
        ...this.state.errors,
        {
          route: this.state.currentRoute,
          message: error.message || error,
          timestamp: new Date(),
        },
      ],
    });
  }
}

class SimpleTestOrchestrator {
  constructor() {
    this.testState = new SimpleTestState();
    this.tester = null;
  }

  // Start the comprehensive test with simplified state management
  async runTest(options = {}) {
    const {
      includeScreenshots = true,
      viewports = ["desktop", "tablet", "mobile"],
      maxButtonsPerPage = 5,
      realTimeUpdates = false, // Disabled for simplicity
    } = options;

    try {
      console.log("🚀 Starting Simple Test Orchestrator...");

      // Initialize test state
      this.testState.startTest();

      // Create enhanced tester with callbacks
      this.tester = new SimpleEnhancedRouteTest({
        screenshots: includeScreenshots,
        viewports: viewports,
        maxButtonsPerPage: maxButtonsPerPage,
        onProgress: this.handleProgress.bind(this),
        onRouteComplete: this.handleRouteComplete.bind(this),
        onError: this.handleError.bind(this),
      });

      await this.tester.runTests();

      // Complete test
      this.testState.completeTest();

      // Generate final reports
      await this.generateFinalReports();

      return this.testState.getState().results;
    } catch (error) {
      console.error("❌ Test orchestration failed:", error.message);
      this.testState.addError(error);
      this.testState.completeTest();
      throw error;
    }
  }

  handleProgress(current, total, route, viewport) {
    this.testState.updateProgress(current, total, route, viewport);
    console.log(
      `📊 Progress: ${current}/${total} (${Math.round(
        (current / total) * 100
      )}%) - ${route} [${viewport}]`
    );
  }

  handleRouteComplete(routeResult) {
    this.testState.addResult(routeResult);
    const status = routeResult.status === "success" ? "✅" : "❌";
    console.log(`${status} ${routeResult.route} (${routeResult.loadTime}ms)`);
  }

  handleError(error) {
    this.testState.addError(error);
    console.error(`❌ Test error: ${error.message || error}`);
  }

  getState() {
    return this.testState.getState();
  }

  async generateFinalReports() {
    const state = this.testState.getState();
    const reportDir = "./test-results";

    // Ensure directory exists
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // Generate JSON report
    const jsonPath = path.join(reportDir, "simple-test-results.json");
    fs.writeFileSync(jsonPath, JSON.stringify(state.results, null, 2));

    // Generate summary report
    const summaryPath = path.join(reportDir, "simple-test-summary.json");
    const summary = {
      ...state.results.summary,
      testDuration:
        state.results.summary.endTime - state.results.summary.startTime,
      errorCount: state.errors.length,
      warningCount: state.warnings.length,
      screenshotCount: state.screenshots.length,
      topErrors: this.getTopErrors(state.errors),
      performanceInsights: this.getPerformanceInsights(state.results),
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`📄 Reports generated in ${reportDir}/`);
    return { jsonPath, summaryPath };
  }

  getTopErrors(errors) {
    const errorCounts = {};
    errors.forEach((error) => {
      const key = error.message;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    return Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));
  }

  getPerformanceInsights(results) {
    const routes = results.routes;
    const loadTimes = routes.map((r) => r.loadTime).filter(Boolean);

    if (loadTimes.length === 0) {
      return { message: "No performance data available" };
    }

    return {
      fastest: Math.min(...loadTimes),
      slowest: Math.max(...loadTimes),
      median: loadTimes.sort((a, b) => a - b)[Math.floor(loadTimes.length / 2)],
      over1s: loadTimes.filter((t) => t > 1000).length,
      over3s: loadTimes.filter((t) => t > 3000).length,
      over5s: loadTimes.filter((t) => t > 5000).length,
    };
  }
}

// Enhanced version of the route tester with callback support
class SimpleEnhancedRouteTest extends ComprehensiveRouteTest {
  constructor(options = {}) {
    super();
    this.options = options;
    this.onProgress = options.onProgress || (() => {});
    this.onRouteComplete = options.onRouteComplete || (() => {});
    this.onError = options.onError || (() => {});
    this.currentRouteIndex = 0;
    this.totalRoutes = 0;
  }

  async runTests() {
    console.log("🚀 Starting Enhanced Route Testing...");

    // Import config from base class
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

    const viewportsToTest = CONFIG.viewports.filter((vp) =>
      this.options.viewports.includes(vp.device)
    );

    // Import routes from base class
    const ALL_ROUTES = [
      "/",
      "/leads-management",
      "/lead-detail/:id",
      "/customers",
      "/customer-detail/:id",
      "/deals-management",
      "/contacts",
      "/company-contacts",
      "/invoices",
      "/service-dispatch",
      "/service-dispatch-enhanced",
      "/inventory",
      "/billing",
      "/reports",
      "/settings",
      "/dashboard",
      "/task-management",
      "/basic-tasks",
      "/pricing-management",
      "/product-hub",
      "/product-management-hub",
      "/product-models",
      "/product-accessories",
      "/software-products",
      "/service-products",
      "/supplies",
      "/vendors",
      "/vendor-management",
      "/purchase-orders",
      "/accounts-payable",
      "/accounts-receivable",
      "/chart-of-accounts",
      "/journal-entries",
      "/advanced-billing-engine",
      "/meter-billing",
      "/meter-readings",
      "/contracts",
      "/quote-proposal-generation",
      "/demo-scheduling",
      "/crm-enhanced",
      "/crm-goals-dashboard",
      "/sales-pipeline-forecasting",
      "/customer-success-management",
      "/commission-management",
      "/data-enrichment",
      "/advanced-analytics-dashboard",
      "/ai-analytics-dashboard",
      "/predictive-analytics",
      "/advanced-reporting",
      "/financial-forecasting",
      "/business-process-optimization",
      "/workflow-automation",
      "/document-management",
      "/esignature-integration",
      "/integration-hub",
      "/system-integrations",
      "/erp-integration",
      "/quickbooks-integration",
      "/salesforce-integration",
      "/customer-self-service-portal",
      "/equipment-lifecycle",
      "/equipment-lifecycle-management",
      "/preventive-maintenance-scheduling",
      "/preventive-maintenance-automation",
      "/remote-monitoring",
      "/service-analytics",
      "/service-dispatch-optimization",
      "/mobile-field-operations",
      "/mobile-field-service",
      "/mobile-service-app",
      "/mobile-optimization",
      "/performance-monitoring",
      "/security-compliance-management",
      "/incident-response-system",
      "/deployment-readiness",
      "/tenant-setup",
      "/business-records",
      "/warehouse-operations",
      "/managed-services",
      "/professional-services",
    ];

    this.totalRoutes = ALL_ROUTES.length * viewportsToTest.length;

    const puppeteer = require("puppeteer");
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
      for (const viewport of viewportsToTest) {
        console.log(
          `\n📱 Testing ${viewport.device} viewport (${viewport.width}x${viewport.height})`
        );
        await this.testViewport(browser, viewport, ALL_ROUTES, CONFIG);
      }

      this.results.summary.endTime = new Date();
      await this.generateReport();
    } finally {
      await browser.close();
    }
  }

  async testViewport(browser, viewport, routes, config) {
    const page = await browser.newPage();
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
    });

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    for (const route of routes) {
      try {
        await this.testRoute(page, route, viewport, consoleErrors, config);
      } catch (error) {
        this.onError(error);
      }
    }

    await page.close();
  }

  async testRoute(page, route, viewport, consoleErrors, config) {
    const routeTest = {
      route,
      viewport: viewport.device,
      status: "pending",
      loadTime: 0,
      httpStatus: null,
      errors: [],
      warnings: [],
      buttons: [],
      forms: [],
      screenshot: null,
      timestamp: new Date(),
    };

    try {
      console.log(`🔍 Testing ${route} on ${viewport.device}...`);

      const startTime = Date.now();
      const response = await page.goto(`${config.baseUrl}${route}`, {
        waitUntil: "networkidle0",
        timeout: config.timeout,
      });

      const loadTime = Date.now() - startTime;
      routeTest.loadTime = loadTime;
      routeTest.httpStatus = response ? response.status() : null;

      // Check for successful response
      if (response && response.status() >= 200 && response.status() < 300) {
        routeTest.status = "success";
      } else if (response && response.status() === 404) {
        routeTest.status = "error";
        routeTest.errors.push(`404 Not Found`);
      } else {
        routeTest.status = "warning";
        routeTest.warnings.push(
          `HTTP ${response ? response.status() : "no response"}`
        );
      }

      // Test page interactions
      await this.testPageInteractions(page, routeTest);

      // Take screenshot if enabled
      if (config.screenshots) {
        const screenshotPath = `${config.screenshotDir}/${
          viewport.device
        }-${route.replace(/[\/\:]/g, "_")}.png`;
        if (!require("fs").existsSync(config.screenshotDir)) {
          require("fs").mkdirSync(config.screenshotDir, { recursive: true });
        }
        await page.screenshot({ path: screenshotPath, fullPage: true });
        routeTest.screenshot = screenshotPath;
      }
    } catch (error) {
      routeTest.status = "error";
      routeTest.errors.push(error.message);
    }

    // Add console errors
    if (consoleErrors.length > 0) {
      routeTest.warnings.push(...consoleErrors.splice(0)); // Clear the array
    }

    // Update progress
    this.currentRouteIndex++;
    this.onProgress(
      this.currentRouteIndex,
      this.totalRoutes,
      route,
      viewport.device
    );

    // Add to results
    if (!this.results) {
      this.results = { routes: [], summary: {} };
    }
    this.results.routes.push(routeTest);

    // Notify route completion
    this.onRouteComplete(routeTest);
  }

  async testPageInteractions(page, routeTest) {
    try {
      // Test button interactions
      await this.testButtonClicks(page, routeTest);

      // Test form interactions
      await this.testFormSubmissions(page, routeTest);
    } catch (error) {
      routeTest.warnings.push(`Interaction test failed: ${error.message}`);
    }
  }

  async testButtonClicks(page, routeTest) {
    try {
      const buttons = await page.$$(
        'button, input[type="button"], input[type="submit"], a[role="button"]'
      );

      for (
        let i = 0;
        i < Math.min(buttons.length, this.options.maxButtonsPerPage || 5);
        i++
      ) {
        const button = buttons[i];
        try {
          const text = await page.evaluate(
            (el) =>
              el.textContent ||
              el.value ||
              el.getAttribute("aria-label") ||
              "Button",
            button
          );
          const hasHandler = await page.evaluate((el) => {
            return !!(
              el.onclick ||
              el.addEventListener ||
              el.getAttribute("href") ||
              el.form
            );
          }, button);

          routeTest.buttons.push({
            text: text.trim().substring(0, 50),
            hasHandler,
            index: i,
          });
        } catch (error) {
          routeTest.warnings.push(`Button analysis failed: ${error.message}`);
        }
      }
    } catch (error) {
      routeTest.warnings.push(`Button testing failed: ${error.message}`);
    }
  }

  async testFormSubmissions(page, routeTest) {
    try {
      const forms = await page.$$("form");

      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        try {
          const action = await page.evaluate(
            (el) => el.action || el.getAttribute("action"),
            form
          );
          const method = await page.evaluate((el) => el.method || "GET", form);
          const hasSubmitHandler = await page.evaluate((el) => {
            return !!(
              el.onsubmit ||
              el.querySelector('input[type="submit"], button[type="submit"]')
            );
          }, form);

          routeTest.forms.push({
            action,
            method,
            hasSubmitHandler,
            index: i,
          });
        } catch (error) {
          routeTest.warnings.push(`Form analysis failed: ${error.message}`);
        }
      }
    } catch (error) {
      routeTest.warnings.push(`Form testing failed: ${error.message}`);
    }
  }

  async generateReport() {
    // Simple report generation
    console.log("\n📊 Test Summary:");
    console.log(`Total routes tested: ${this.results.routes.length}`);
    console.log(
      `Successful: ${
        this.results.routes.filter((r) => r.status === "success").length
      }`
    );
    console.log(
      `Errors: ${
        this.results.routes.filter((r) => r.status === "error").length
      }`
    );
    console.log(
      `Warnings: ${
        this.results.routes.filter((r) => r.status === "warning").length
      }`
    );
  }
}

module.exports = SimpleTestOrchestrator;
