const { createContext7 } = require("context7");
const ComprehensiveRouteTest = require("./comprehensive-route-test");
const fs = require("fs");
const path = require("path");

// Create Context7 instance for managing test state
const TestContext = createContext7({
  state: {
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
  },

  actions: {
    startTest: (context) => {
      context.setState({
        isRunning: true,
        currentRoute: null,
        currentViewport: null,
        progress: { current: 0, total: 0, percentage: 0 },
        errors: [],
        warnings: [],
        screenshots: [],
      });
    },

    updateProgress: (context, { current, total, route, viewport }) => {
      const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
      context.setState({
        progress: { current, total, percentage },
        currentRoute: route,
        currentViewport: viewport,
      });
    },

    addResult: (context, routeResult) => {
      const currentResults = context.getState().results;
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

      context.setState({
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
        context.setState({
          errors: [
            ...context.getState().errors,
            ...routeResult.errors.map((err) => ({
              route: routeResult.route,
              message: err,
              timestamp: new Date(),
            })),
          ],
        });
      }

      if (routeResult.warnings && routeResult.warnings.length > 0) {
        context.setState({
          warnings: [
            ...context.getState().warnings,
            ...routeResult.warnings.map((warn) => ({
              route: routeResult.route,
              message: warn,
              timestamp: new Date(),
            })),
          ],
        });
      }

      if (routeResult.screenshot) {
        context.setState({
          screenshots: [
            ...context.getState().screenshots,
            {
              route: routeResult.route,
              viewport: routeResult.viewport,
              path: routeResult.screenshot,
              timestamp: new Date(),
            },
          ],
        });
      }
    },

    completeTest: (context) => {
      const currentResults = context.getState().results;
      context.setState({
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
    },

    addError: (context, error) => {
      context.setState({
        errors: [
          ...context.getState().errors,
          {
            route: context.getState().currentRoute,
            message: error.message || error,
            timestamp: new Date(),
          },
        ],
      });
    },
  },
});

class TestOrchestrator {
  constructor() {
    this.context = TestContext;
    this.tester = null;
    this.websocketClients = new Set();
  }

  // Start the comprehensive test with real-time updates
  async runTest(options = {}) {
    const {
      includeScreenshots = true,
      viewports = ["desktop", "tablet", "mobile"],
      maxButtonsPerPage = 5,
      realTimeUpdates = true,
    } = options;

    try {
      // Initialize test state
      this.context.actions.startTest();

      // Set start time
      const currentState = this.context.getState();
      this.context.setState({
        results: {
          ...currentState.results,
          summary: {
            ...currentState.results.summary,
            startTime: new Date(),
          },
        },
      });

      // Create enhanced tester with callbacks
      this.tester = new EnhancedRouteTest({
        screenshots: includeScreenshots,
        viewports: viewports,
        maxButtonsPerPage: maxButtonsPerPage,
        onProgress: this.handleProgress.bind(this),
        onRouteComplete: this.handleRouteComplete.bind(this),
        onError: this.handleError.bind(this),
      });

      await this.tester.runTests();

      // Complete test
      this.context.actions.completeTest();

      // Generate final reports
      await this.generateFinalReports();

      return this.context.getState().results;
    } catch (error) {
      this.context.actions.addError(error);
      this.context.actions.completeTest();
      throw error;
    }
  }

  handleProgress(current, total, route, viewport) {
    this.context.actions.updateProgress({ current, total, route, viewport });

    // Broadcast to websocket clients if any
    this.broadcastUpdate({
      type: "progress",
      data: {
        current,
        total,
        route,
        viewport,
        percentage: Math.round((current / total) * 100),
      },
    });
  }

  handleRouteComplete(routeResult) {
    this.context.actions.addResult(routeResult);

    // Broadcast to websocket clients
    this.broadcastUpdate({
      type: "routeComplete",
      data: routeResult,
    });
  }

  handleError(error) {
    this.context.actions.addError(error);

    // Broadcast error
    this.broadcastUpdate({
      type: "error",
      data: error,
    });
  }

  broadcastUpdate(message) {
    const messageStr = JSON.stringify(message);
    this.websocketClients.forEach((client) => {
      try {
        if (client.readyState === 1) {
          // WebSocket.OPEN
          client.send(messageStr);
        }
      } catch (error) {
        // Remove dead connections
        this.websocketClients.delete(client);
      }
    });
  }

  addWebSocketClient(client) {
    this.websocketClients.add(client);

    // Send current state to new client
    client.send(
      JSON.stringify({
        type: "initialState",
        data: this.context.getState(),
      })
    );
  }

  removeWebSocketClient(client) {
    this.websocketClients.delete(client);
  }

  getState() {
    return this.context.getState();
  }

  async generateFinalReports() {
    const state = this.context.getState();
    const reportDir = "./test-results";

    // Ensure directory exists
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // Generate JSON report
    const jsonPath = path.join(reportDir, "orchestrated-test-results.json");
    fs.writeFileSync(jsonPath, JSON.stringify(state.results, null, 2));

    // Generate summary report
    const summaryPath = path.join(reportDir, "test-summary.json");
    const summary = {
      ...state.results.summary,
      testDuration:
        state.results.summary.endTime - state.results.summary.startTime,
      errorCount: state.errors.length,
      warningCount: state.warnings.length,
      screenshotCount: state.screenshots.length,
      topErrors: this.getTopErrors(state.errors),
      topWarnings: this.getTopWarnings(state.warnings),
      performanceInsights: this.getPerformanceInsights(state.results),
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    // Generate actionable report
    await this.generateActionableReport(state);

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

  getTopWarnings(warnings) {
    const warningCounts = {};
    warnings.forEach((warning) => {
      const key = warning.message;
      warningCounts[key] = (warningCounts[key] || 0) + 1;
    });

    return Object.entries(warningCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));
  }

  getPerformanceInsights(results) {
    const routes = results.routes;
    const loadTimes = routes.map((r) => r.loadTime).filter(Boolean);

    return {
      fastest: Math.min(...loadTimes),
      slowest: Math.max(...loadTimes),
      median: loadTimes.sort((a, b) => a - b)[Math.floor(loadTimes.length / 2)],
      over1s: loadTimes.filter((t) => t > 1000).length,
      over3s: loadTimes.filter((t) => t > 3000).length,
      over5s: loadTimes.filter((t) => t > 5000).length,
    };
  }

  async generateActionableReport(state) {
    const actionableItems = {
      criticalIssues: [],
      improvements: [],
      successfulPatterns: [],
    };

    // Analyze results for actionable insights
    state.results.routes.forEach((route) => {
      // Critical issues
      if (route.status === "error") {
        actionableItems.criticalIssues.push({
          type: "route_error",
          route: route.route,
          issues: route.errors,
          priority: "high",
        });
      }

      // Performance improvements
      if (route.loadTime > 3000) {
        actionableItems.improvements.push({
          type: "performance",
          route: route.route,
          loadTime: route.loadTime,
          recommendation: "Optimize page load time",
          priority: "medium",
        });
      }

      // Button handler issues
      const buttonsWithoutHandlers =
        route.buttons?.filter((btn) => !btn.hasHandler) || [];
      if (buttonsWithoutHandlers.length > 0) {
        actionableItems.improvements.push({
          type: "button_handlers",
          route: route.route,
          count: buttonsWithoutHandlers.length,
          buttons: buttonsWithoutHandlers.map((btn) => btn.text),
          recommendation: "Add click handlers to buttons",
          priority: "low",
        });
      }

      // Successful patterns
      if (
        route.status === "success" &&
        route.loadTime < 1000 &&
        route.buttons?.length > 0
      ) {
        actionableItems.successfulPatterns.push({
          type: "fast_interactive_page",
          route: route.route,
          loadTime: route.loadTime,
          buttonCount: route.buttons.length,
        });
      }
    });

    const reportPath = path.join("./test-results", "actionable-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(actionableItems, null, 2));

    return actionableItems;
  }
}

// Enhanced version of the route tester with callback support
class EnhancedRouteTest extends ComprehensiveRouteTest {
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
    console.log("🚀 Starting Enhanced Route Testing with Real-time Updates...");

    const viewportsToTest = CONFIG.viewports.filter((vp) =>
      this.options.viewports.includes(vp.device)
    );

    this.totalRoutes = ALL_ROUTES.length * viewportsToTest.length;

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
        console.log(`\n📱 Testing ${viewport.device} viewport`);
        await this.testViewport(browser, viewport);
      }

      this.results.summary.endTime = new Date();
      await this.generateReport();
    } finally {
      await browser.close();
    }
  }

  async testRoute(page, route, viewport, consoleErrors) {
    // Call parent method
    await super.testRoute(page, route, viewport, consoleErrors);

    // Get the latest route result
    const latestResult = this.results.routes[this.results.routes.length - 1];

    // Update progress
    this.currentRouteIndex++;
    this.onProgress(
      this.currentRouteIndex,
      this.totalRoutes,
      route,
      viewport.device
    );

    // Notify route completion
    this.onRouteComplete(latestResult);
  }
}

module.exports = TestOrchestrator;
