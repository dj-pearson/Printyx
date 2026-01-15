/**
 * Comprehensive Test Configuration
 *
 * This configuration file sets up automated testing for all forms and buttons
 * in the application. It uses environment variables for credentials to ensure
 * no secrets are hardcoded.
 *
 * IMPORTANT: Never commit hardcoded credentials. Always use environment variables.
 */

import { config as loadEnv } from 'dotenv';
import { TestConfig } from './types';
import { DEFAULT_CONFIG } from './config';
import path from 'path';
import fs from 'fs';

// ============================================================================
// Environment Variable Loading
// ============================================================================

/**
 * Loads environment variables from .env file
 * Throws error if credentials are not found
 */
function loadCredentials(): { username: string; password: string } {
  // Load .env file from project root
  const envPath = path.resolve(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    throw new Error(
      `.env file not found at ${envPath}. Please create one with TEST_USERNAME and TEST_PASSWORD`,
    );
  }

  loadEnv();

  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'TEST_USERNAME and TEST_PASSWORD must be set in .env file.\n' +
        'Add the following to your .env file:\n' +
        'TEST_USERNAME=your-test-user@example.com\n' +
        'TEST_PASSWORD=your-test-password',
    );
  }

  // Validate that credentials are not placeholder values
  if (
    username.includes('YOUR_') ||
    password.includes('YOUR_') ||
    username === 'test@example.com' ||
    password === 'password'
  ) {
    throw new Error(
      'Detected placeholder credentials in .env file.\n' +
        'Please update TEST_USERNAME and TEST_PASSWORD with real test account credentials.',
    );
  }

  return { username, password };
}

/**
 * Note: We don't validate the runtime config object for hardcoded secrets because
 * it legitimately contains credentials loaded from environment variables.
 * Source code validation is handled by check-no-secrets.ts (pre-commit hook).
 * Runtime validation is handled by performSafetyCheck() which ensures .env exists
 * and credentials are properly loaded from environment variables.
 */

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Creates comprehensive test configuration
 * Loads credentials from environment variables
 */
export function createComprehensiveTestConfig(baseUrl?: string): TestConfig {
  const credentials = loadCredentials();

  const config: TestConfig = {
    ...DEFAULT_CONFIG,

    // Use provided URL or default to localhost
    baseUrl: baseUrl || process.env.BASE_URL || 'http://localhost:5000',

    // Deep testing - comprehensive coverage
    depth: 'deep',

    // Test all pages
    maxPages: 0, // unlimited

    // Timeout configuration
    timeout: 45000, // 45 seconds per test
    retries: 3, // Retry failed tests up to 3 times

    // Browser configuration
    browser: 'chromium',
    headless: process.env.CI ? true : false, // Show browser in dev, headless in CI

    // Enable all testing features
    accessibilityTesting: true,
    performanceTesting: true,
    edgeFunctionTesting: true,
    consoleMonitoring: true,
    networkMonitoring: true,

    // Screenshots and video
    screenshots: true,
    video: false, // Can enable for debugging

    // Output directory
    outputDir: './test-reports/comprehensive',

    // Navigation delay to allow for loading
    navigationDelay: 1000, // 1 second between navigations

    // Authentication configuration
    auth: {
      loginUrl: '/login',
      // Try multiple selector strategies for email field
      usernameSelector:
        'input[type="email"], input[placeholder*="email" i], input[autocomplete="email"]',
      // Try multiple selector strategies for password field
      passwordSelector:
        'input[type="password"], input[placeholder*="password" i], input[autocomplete="current-password"]',
      // Try multiple selector strategies for submit button
      submitSelector:
        'button[type="submit"], button:has-text("Sign In"), button:has-text("Sign in")',
      credentials: {
        username: credentials.username,
        password: credentials.password,
      },
      successUrl: '/',
      sessionKey: 'supabase.auth.token',
    },

    // Enhanced selectors for comprehensive testing
    selectors: {
      forms: [
        'form',
        '[role="form"]',
        '[data-testid*="form"]',
        '[data-form]',
        '.form',
        '[id*="form"]',
        // Common form containers
        'div[class*="form"]',
        'section[class*="form"]',
      ],
      buttons: [
        'button:not([disabled])',
        '[role="button"]:not([disabled])',
        'input[type="submit"]:not([disabled])',
        'input[type="button"]:not([disabled])',
        '[data-testid*="button"]:not([disabled])',
        '[data-testid*="btn"]:not([disabled])',
        '.btn:not([disabled])',
        '.button:not([disabled])',
        'a.button:not([disabled])',
        '[onclick]:not([disabled])',
        // Common button patterns
        'div[role="button"]:not([disabled])',
        'span[role="button"]:not([disabled])',
      ],
      links: ['a[href]:not([href="#"])', '[role="link"]', 'a[data-testid*="link"]'],
      inputs: [
        'input:not([type="hidden"]):not([disabled])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        '[contenteditable="true"]',
        '[role="textbox"]',
        '[role="combobox"]',
        '[role="listbox"]',
        '[role="searchbox"]',
        '[role="spinbutton"]',
      ],
      interactive: [
        'button:not([disabled])',
        'a[href]',
        'input:not([type="hidden"]):not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"]):not([disabled])',
        '[role="button"]:not([disabled])',
        '[role="link"]',
        '[role="checkbox"]:not([disabled])',
        '[role="radio"]:not([disabled])',
        '[role="switch"]:not([disabled])',
        '[role="slider"]:not([disabled])',
        '[role="tab"]',
        '[role="menuitem"]',
        '[onclick]:not([disabled])',
        '[data-clickable]:not([disabled])',
      ],
      ignore: [
        '[aria-hidden="true"]',
        '[disabled]',
        '[style*="display: none"]',
        '[style*="visibility: hidden"]',
        '.hidden',
        '.invisible',
        '[data-test-ignore]',
        '[data-ignore-test]',
      ],
    },

    // Exclude sensitive/problematic patterns
    excludePatterns: [
      '/api/',
      '/static/',
      '/_next/',
      '/favicon',
      '.ico',
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.css',
      '.js',
      '.map',
      '/logout',
      '/signout',
      '/auth/callback',
      '/auth/reset-password',
      '/stripe/',
      '/api/webhooks',
      '/delete', // Avoid destructive actions
      '/remove',
      '/destroy',
    ],

    // Routes directory for static analysis
    routesDir: './server',

    // Edge functions directory
    edgeFunctionsDir: './supabase/functions',

    // Reporter configuration
    reporters: {
      html: true,
      json: true,
      markdown: true,
      filenamePrefix: 'comprehensive-test-report',
      includeScreenshots: true,
      includePerformance: true,
      includeAccessibility: true,
    },

    // Parallel execution for faster tests
    parallel: {
      enabled: process.env.CI ? true : false, // Parallel in CI, sequential in dev
      workers: 4,
    },
  };

  return config;
}

/**
 * Export a safety check function that can be run before tests
 */
export function performSafetyCheck(): { safe: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    // Check 1: Ensure .env exists
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      errors.push('.env file not found');
    }

    // Check 2: Ensure .env is in .gitignore
    const gitignorePath = path.resolve(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignoreContent.includes('.env')) {
        errors.push('.env is not in .gitignore - this is a security risk!');
      }
    } else {
      errors.push('.gitignore file not found');
    }

    // Check 3: Ensure credentials are loaded
    loadCredentials();

    // Note: More comprehensive secret scanning is done by check-no-secrets.ts
    // which runs as a pre-commit hook. This safety check focuses on the basics.
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    safe: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Export
// ============================================================================

export default createComprehensiveTestConfig;
