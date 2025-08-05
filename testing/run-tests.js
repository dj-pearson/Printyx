#!/usr/bin/env node

const { spawn } = require("child_process");
const http = require("http");
const SimpleTestOrchestrator = require("./simple-test-orchestrator");
const path = require("path");

class TestRunner {
  constructor(options = {}) {
    this.serverProcess = null;
    this.serverUrl = "http://localhost:5000";
    this.serverStartTimeout = 60000; // 1 minute
    this.options = options;
  }

  async run() {
    console.log("🚀 Printyx Comprehensive Test Runner");
    console.log("=".repeat(50));

    try {
      // Check if server should be started
      if (this.options.autoServer) {
        // Check if server is already running
        const isServerRunning = await this.checkServer();

        if (!isServerRunning) {
          console.log("📡 Starting development server...");
          await this.startServer();
        } else {
          console.log("✅ Server is already running");
        }
      } else {
        console.log("⚙️ Skipping server startup (--no-server flag)");
        // Still check if server is accessible
        const isServerRunning = await this.checkServer();
        if (!isServerRunning) {
          throw new Error(
            "Server is not running! Please start it manually or remove --no-server flag."
          );
        }
        console.log("✅ External server is accessible");
      }

      // Wait a moment for server to fully initialize
      await this.sleep(2000);

      // Run the comprehensive tests
      console.log("🧪 Starting comprehensive route testing...");
      const orchestrator = new SimpleTestOrchestrator();

      const results = await orchestrator.runTest({
        includeScreenshots: this.options.screenshots,
        viewports: this.options.viewports,
        maxButtonsPerPage: 5,
        realTimeUpdates: true,
      });

      // Print summary
      this.printFinalSummary(results);

      return results;
    } catch (error) {
      console.error("❌ Test run failed:", error.message);
      throw error;
    } finally {
      // Cleanup
      if (this.serverProcess) {
        console.log("🛑 Stopping development server...");
        this.serverProcess.kill();
      }
    }
  }

  async checkServer() {
    try {
      await this.makeHttpRequest(this.serverUrl);
      return true;
    } catch (error) {
      return false;
    }
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      // Change to project root directory
      const projectRoot = path.resolve(__dirname, "..");

      // Start the development server
      this.serverProcess = spawn("npm", ["run", "dev"], {
        cwd: projectRoot,
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        env: { 
          ...process.env,
          DATABASE_URL: "sqlite://test.db",
          REPLIT_DOMAINS: "localhost"
        }
      });

      let serverOutput = "";

      this.serverProcess.stdout.on("data", (data) => {
        const output = data.toString();
        serverOutput += output;

        // Check if server is ready
        if (
          output.includes("Local:") ||
          output.includes("localhost:5000") ||
          output.includes("ready")
        ) {
          console.log("✅ Development server started successfully");
          resolve();
        }
      });

      this.serverProcess.stderr.on("data", (data) => {
        const output = data.toString();
        serverOutput += output;
        console.log("Server stderr:", output);
      });

      this.serverProcess.on("error", (error) => {
        console.error("❌ Failed to start server:", error.message);
        reject(error);
      });

      this.serverProcess.on("exit", (code) => {
        if (code !== 0) {
          console.error(`❌ Server exited with code ${code}`);
          console.log("Server output:", serverOutput);
        }
      });

      // Timeout if server doesn't start
      setTimeout(() => {
        if (this.serverProcess && !this.serverProcess.killed) {
          console.log(
            "⏰ Server startup timeout, checking if it's accessible..."
          );
          this.checkServer().then((isRunning) => {
            if (isRunning) {
              console.log("✅ Server is accessible despite timeout");
              resolve();
            } else {
              reject(new Error("Server failed to start within timeout"));
            }
          });
        }
      }, this.serverStartTimeout);
    });
  }

  makeHttpRequest(url) {
    return new Promise((resolve, reject) => {
      const request = http.get(url, (response) => {
        if (response.statusCode >= 200 && response.statusCode < 400) {
          resolve(response);
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      });

      request.on("error", reject);
      request.setTimeout(5000, () => {
        request.destroy();
        reject(new Error("Request timeout"));
      });
    });
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  printFinalSummary(results) {
    console.log("\n" + "=".repeat(60));
    console.log("🎉 COMPREHENSIVE TEST COMPLETED");
    console.log("=".repeat(60));

    const summary = results.summary;
    const duration = Math.round((summary.endTime - summary.startTime) / 1000);

    console.log(`📊 RESULTS:`);
    console.log(`   Total Routes: ${summary.totalRoutes}`);
    console.log(
      `   ✅ Successful: ${summary.successful} (${(
        (summary.successful / summary.totalRoutes) *
        100
      ).toFixed(1)}%)`
    );
    console.log(`   ❌ Errors: ${summary.errors}`);
    console.log(`   ⚠️  Warnings: ${summary.warnings}`);
    console.log(`   ⏱️  Duration: ${duration}s`);

    console.log(`\n⚡ PERFORMANCE:`);
    console.log(
      `   Average Load: ${Math.round(results.performance.averageLoadTime)}ms`
    );
    console.log(`   Slow Routes: ${results.performance.slowRoutes.length}`);

    console.log(`\n🔘 INTERACTIONS:`);
    console.log(`   Buttons Found: ${results.buttons.length}`);
    console.log(`   Forms Found: ${results.forms.length}`);

    if (summary.errors > 0) {
      console.log("\n❌ CRITICAL ISSUES TO ADDRESS:");
      // This would be populated by the orchestrator's error analysis
    }

    if (results.performance.slowRoutes.length > 0) {
      console.log("\n🐌 PERFORMANCE OPTIMIZATION NEEDED:");
      results.performance.slowRoutes.slice(0, 5).forEach((route) => {
        console.log(`   ${route.route}: ${route.loadTime}ms`);
      });
    }

    console.log("\n📄 Reports generated in ./test-results/");
    console.log("   📊 orchestrated-test-results.json - Full results");
    console.log("   📋 test-summary.json - Summary data");
    console.log("   🎯 actionable-report.json - Action items");
    console.log("   🌐 test-report.html - Visual report");

    console.log("\n🎯 NEXT STEPS:");
    console.log("   1. Review actionable-report.json for priority fixes");
    console.log("   2. Address critical errors first");
    console.log("   3. Optimize slow-loading routes");
    console.log("   4. Add missing button handlers");
    console.log("=".repeat(60));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    autoServer: !args.includes("--no-server"),
    screenshots: !args.includes("--no-screenshots"),
    viewports: args.includes("--desktop-only")
      ? ["desktop"]
      : ["desktop", "tablet", "mobile"],
    verbose: args.includes("--verbose"),
  };

  if (args.includes("--help")) {
    console.log(`
🚀 Printyx Comprehensive Test Runner

Usage: node run-tests.js [options]

Options:
  --help            Show this help message
  --no-server       Don't start development server (assume it's running)
  --no-screenshots  Skip taking screenshots
  --desktop-only    Only test desktop viewport
  --verbose         Show detailed output

Examples:
  node run-tests.js                    # Full test with auto server start
  node run-tests.js --no-server        # Test with external server
  node run-tests.js --desktop-only     # Quick desktop-only test
    `);
    return;
  }

  try {
    const runner = new TestRunner(options);
    await runner.run();
    console.log("\n✅ All tests completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test runner failed:", error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = TestRunner;
