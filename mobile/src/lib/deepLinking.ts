/**
 * Deep Linking Configuration
 *
 * Maps URL paths to app screens for both Universal Links (iOS)
 * and App Links (Android).
 *
 * Server-side requirements:
 * - iOS: Host apple-app-site-association at https://app.printyx.net/.well-known/apple-app-site-association
 * - Android: Host assetlinks.json at https://app.printyx.net/.well-known/assetlinks.json
 */

/**
 * Apple App Site Association (AASA) file content.
 * Host this at: https://app.printyx.net/.well-known/apple-app-site-association
 *
 * {
 *   "applinks": {
 *     "apps": [],
 *     "details": [
 *       {
 *         "appID": "TEAM_ID.com.printyx.app",
 *         "paths": [
 *           "/dashboard*",
 *           "/leads*",
 *           "/customers*",
 *           "/contacts*",
 *           "/deals*",
 *           "/service*",
 *           "/equipment*",
 *           "/reports*"
 *         ]
 *       }
 *     ]
 *   }
 * }
 */

/**
 * Android Asset Links file content.
 * Host this at: https://app.printyx.net/.well-known/assetlinks.json
 *
 * [
 *   {
 *     "relation": ["delegate_permission/common.handle_all_urls"],
 *     "target": {
 *       "namespace": "android_app",
 *       "package_name": "com.printyx.app",
 *       "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
 *     }
 *   }
 * ]
 */

/**
 * Map incoming deep link URLs to app routes.
 * Expo Router handles this automatically via the file-based routing,
 * but this helper provides explicit URL-to-screen mapping for
 * notification payloads and custom URL handling.
 */
export function resolveDeepLink(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // Dashboard
    if (path === '/' || path === '/dashboard') {
      return '/(app)/(dashboard)';
    }

    // CRM
    if (path.startsWith('/leads')) return '/(app)/(crm)/leads';
    if (path.startsWith('/customers')) return '/(app)/(crm)/customers';
    if (path.startsWith('/contacts')) return '/(app)/(crm)/contacts';
    if (path.startsWith('/deals')) return '/(app)/(crm)/deals';

    // Service
    if (path.startsWith('/service/tickets')) return '/(app)/(service)/tickets';
    if (path.startsWith('/service/dispatch')) return '/(app)/(service)/dispatch';
    if (path.startsWith('/service')) return '/(app)/(service)';

    // Equipment
    if (path.match(/^\/equipment\/\d+/)) {
      const id = path.split('/')[2];
      return `/(app)/(equipment)/${id}`;
    }
    if (path.startsWith('/equipment')) return '/(app)/(equipment)';

    // Reports
    if (path.startsWith('/reports')) return '/(app)/(reports)';

    // Settings
    if (path.startsWith('/settings')) return '/(app)/(settings)';

    // Auth
    if (path.startsWith('/login')) return '/(auth)/login';
    if (path.startsWith('/signup')) return '/(auth)/signup';
    if (path.startsWith('/reset-password')) return '/(auth)/forgot-password';

    return null;
  } catch {
    return null;
  }
}
