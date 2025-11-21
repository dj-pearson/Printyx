#!/usr/bin/env node

/**
 * Quick demo test to verify the testing system works
 * Tests just 3 routes to ensure everything is set up correctly
 */

const puppeteer = require("puppeteer");

const DEMO_ROUTES = ["/", "/leads-management", "/task-management"];

async function runDemoTest() {
  console.log("🚀 Printyx Demo Test - Quick Verification");
  console.log("==========================================");
  console.log(
    `Testing ${DEMO_ROUTES.length} sample routes to verify setup...\n`
  );

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    for (const route of DEMO_ROUTES) {
      console.log(`🔍 Testing: ${route}`);

      try {
        const startTime = Date.now();
        const response = await page.goto(`http://localhost:5000${route}`, {
          waitUntil: "networkidle0",
          timeout: 15000,
        });

        const loadTime = Date.now() - startTime;

        if (response.status() >= 200 && response.status() < 300) {
          // Test buttons
          const buttons = await page.$$(
            'button, input[type="button"], input[type="submit"]'
          );
          console.log(
            `  ✅ SUCCESS (${loadTime}ms) - Found ${buttons.length} buttons`
          );
        } else {
          console.log(`  ❌ ERROR - HTTP ${response.status()}`);
        }
      } catch (error) {
        console.log(`  ❌ ERROR - ${error.message}`);
      }
    }

    console.log("\n🎉 Demo test completed!");
    console.log(
      "If all routes showed SUCCESS, your setup is working correctly."
    );
    console.log("Run the full test suite with: npm run test");
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runDemoTest().catch(console.error);
}

module.exports = runDemoTest;
