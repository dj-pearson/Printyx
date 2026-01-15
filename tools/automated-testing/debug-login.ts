/**
 * Debug Login Page Script
 *
 * This script helps debug what's actually on the login page
 * to determine the correct selectors to use.
 */

import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';

loadEnv();

async function debugLogin() {
  console.log('🔍 Debugging Login Page...\n');

  const browser = await chromium.launch({
    headless: false, // Show browser
    slowMo: 1000, // Slow down so you can see what's happening
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to login page
    console.log('Navigating to http://localhost:5000/login...');
    await page.goto('http://localhost:5000/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for React to render
    console.log('Waiting for page to render...');
    await page.waitForTimeout(5000);

    // Take screenshot
    await page.screenshot({ path: 'login-debug.png', fullPage: true });
    console.log('Screenshot saved: login-debug.png');

    // Get page title
    const title = await page.title();
    console.log(`\nPage Title: ${title}`);

    // Find all input fields
    console.log('\n📝 Finding all input fields...\n');
    const inputs = await page.$$('input');
    console.log(`Found ${inputs.length} input fields:\n`);

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const type = await input.getAttribute('type');
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      const placeholder = await input.getAttribute('placeholder');
      const autocomplete = await input.getAttribute('autocomplete');
      const isVisible = await input.isVisible();

      console.log(`Input #${i + 1}:`);
      console.log(`  Type: ${type || 'text'}`);
      console.log(`  Name: ${name || '(none)'}`);
      console.log(`  ID: ${id || '(none)'}`);
      console.log(`  Placeholder: ${placeholder || '(none)'}`);
      console.log(`  Autocomplete: ${autocomplete || '(none)'}`);
      console.log(`  Visible: ${isVisible}`);
      console.log('');
    }

    // Find all buttons
    console.log('\n🔘 Finding all buttons...\n');
    const buttons = await page.$$('button');
    console.log(`Found ${buttons.length} buttons:\n`);

    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const type = await button.getAttribute('type');
      const text = await button.textContent();
      const isVisible = await button.isVisible();

      console.log(`Button #${i + 1}:`);
      console.log(`  Type: ${type || '(none)'}`);
      console.log(`  Text: ${text?.trim() || '(none)'}`);
      console.log(`  Visible: ${isVisible}`);
      console.log('');
    }

    // Try the selectors we're using
    console.log('\n🎯 Testing Selectors...\n');

    const emailSelectors = [
      'input[placeholder="Enter your email"]',
      'input[type="email"]',
      'input[placeholder*="email" i]',
      'input[autocomplete="email"]',
    ];

    for (const selector of emailSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          console.log(`✅ FOUND: ${selector} (Visible: ${isVisible})`);
        } else {
          console.log(`❌ NOT FOUND: ${selector}`);
        }
      } catch (error) {
        console.log(`❌ ERROR: ${selector} - ${(error as Error).message}`);
      }
    }

    console.log('\nKeeping browser open for 10 seconds...');
    console.log('Check the browser window to see the login page.');
    await page.waitForTimeout(10000);
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
  } finally {
    await browser.close();
  }
}

debugLogin();
