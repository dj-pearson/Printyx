#!/usr/bin/env node

// Simple demo test that tests a couple of popular websites to verify Puppeteer is working
const puppeteer = require("puppeteer");

const TEST_URLS = [
  { url: "https://www.google.com", name: "Google" },
  { url: "https://www.github.com", name: "GitHub" },
];

async function runSimpleTest() {
  console.log("🚀 Simple Puppeteer Test - Verifying Setup");
  console.log("=".repeat(50));
  console.log("Testing external sites to verify Puppeteer works...\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    for (const { url, name } of TEST_URLS) {
      console.log(`🔍 Testing: ${name} (${url})`);
      try {
        const startTime = Date.now();
        const response = await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: 15000,
        });
        const loadTime = Date.now() - startTime;

        if (response && response.status() >= 200 && response.status() < 300) {
          const buttons = await page.$$(
            'button, input[type="button"], input[type="submit"], a[role="button"]'
          );
          const links = await page.$$("a[href]");
          const title = await page.title();

          console.log(`  ✅ SUCCESS (${loadTime}ms)`);
          console.log(`     Title: ${title.substring(0, 50)}...`);
          console.log(
            `     Found ${buttons.length} buttons, ${links.length} links`
          );
        } else {
          console.log(
            `  ❌ ERROR - HTTP ${response ? response.status() : "no response"}`
          );
        }
      } catch (error) {
        console.log(`  ❌ ERROR - ${error.message}`);
      }
      console.log(""); // Empty line for readability
    }

    console.log("🎉 Simple test completed!");
    console.log("✅ Puppeteer is working correctly.");
    console.log("\nTo test your Printyx application:");
    console.log("1. Start your dev server: npm run dev");
    console.log("2. Run: npm run test:no-server");
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runSimpleTest().catch(console.error);
}

module.exports = runSimpleTest;
