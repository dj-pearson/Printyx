/**
 * Troubleshooting Articles
 *
 * Common issues, error resolution, and diagnostic guides
 */

export const troubleshootingArticles = [
  {
    title: 'Troubleshooting Common Integration Issues',
    slug: 'troubleshooting-integration-issues',
    categorySlug: 'troubleshooting',
    excerpt:
      'Resolve QuickBooks, Salesforce, and manufacturer integration problems with step-by-step diagnostic guides. Get your data flowing again quickly.',
    contentType: 'troubleshooting',
    difficultyLevel: 'intermediate',
    estimatedReadingTime: 10,
    featured: true,
    keywords: ['troubleshooting', 'integrations', 'QuickBooks', 'Salesforce', 'sync errors'],
    tags: ['integrations', 'errors', 'quickbooks', 'salesforce'],
    content: {
      sections: [
        {
          type: 'header',
          content: 'Integration Troubleshooting Basics',
          order: 1,
        },
        {
          type: 'paragraph',
          content:
            'Integration issues typically fall into three categories: authentication failures, sync errors, and data mapping problems. This guide helps you diagnose and resolve the most common scenarios.',
          order: 2,
        },
        {
          type: 'callout',
          content:
            '🔧 **First Step**: Before troubleshooting, check the Integration Hub status dashboard (Settings → Integrations) to see if the issue is service-wide or specific to your connection.',
          formatting: { style: 'info' },
          order: 3,
        },
        {
          type: 'header',
          content: 'QuickBooks Integration Issues',
          order: 4,
        },
        {
          type: 'paragraph',
          content: "**Problem: 'Authentication Error - Token Expired'**",
          order: 5,
        },
        {
          type: 'list',
          content: [
            '**Cause**: QuickBooks OAuth tokens expire every 60 days',
            '**Solution**: Navigate to Settings → Integrations → QuickBooks → Reconnect',
            '**Prevention**: Enable auto-refresh tokens in integration settings',
            '**If reconnect fails**: Disconnect fully, wait 5 minutes, reconnect fresh',
          ],
          order: 6,
        },
        {
          type: 'paragraph',
          content: '**Problem: Invoices not syncing to QuickBooks**',
          order: 7,
        },
        {
          type: 'list',
          content: [
            'Check Sync Log: Settings → Integrations → QuickBooks → View Log',
            'Common causes: Missing customer in QB, invalid account mappings, duplicate invoice numbers',
            "Solution for missing customers: Enable 'Auto-create customers in QB' setting",
            'Solution for account mapping: Settings → QB Settings → Chart of Accounts mapping',
            'For duplicate numbers: QB uses global invoice numbering, Printyx can append prefix',
          ],
          order: 8,
        },
        {
          type: 'code',
          content: `// Example: QuickBooks sync error log
{
  "timestamp": "2025-01-15T10:30:00Z",
  "errorType": "CUSTOMER_NOT_FOUND",
  "invoiceId": "inv-12345",
  "customerName": "Acme Corporation",
  "errorMessage": "Customer 'Acme Corporation' does not exist in QuickBooks",
  "suggestedAction": "Enable auto-create customers or manually create in QB first",
  "retryable": true,
  "retryCount": 3
}`,
          formatting: { language: 'json' },
          order: 9,
        },
        {
          type: 'header',
          content: 'Salesforce Integration Issues',
          order: 10,
        },
        {
          type: 'paragraph',
          content: '**Problem: Leads not syncing to Salesforce**',
          order: 11,
        },
        {
          type: 'list',
          content: [
            'Verify field mappings: Settings → Integrations → Salesforce → Field Mappings',
            'Check required fields: Salesforce may require fields Printyx marks optional',
            'Review sync direction: Is bi-directional sync enabled?',
            'Conflict resolution: Which system wins when data differs? (Last-write-wins default)',
            'Permission check: Does Salesforce API user have Create Lead permission?',
          ],
          order: 12,
        },
        {
          type: 'header',
          content: 'Manufacturer Integration (Canon, Xerox, etc.)',
          order: 13,
        },
        {
          type: 'paragraph',
          content: '**Problem: Device registrations failing**',
          order: 14,
        },
        {
          type: 'list',
          content: [
            '**Verify credentials**: Check dealer code, API key, password in Settings → Integrations → Manufacturer',
            "**Serial number format**: Ensure serial matches manufacturer's exact format (case-sensitive)",
            '**Device already registered**: May be registered to different dealer account',
            '**Contact manufacturer**: Some registrations require manual approval from manufacturer portal',
          ],
          order: 15,
        },
        {
          type: 'header',
          content: 'SNMP/Fleet Monitoring Issues',
          order: 16,
        },
        {
          type: 'paragraph',
          content: '**Problem: Printyx Client not collecting meters**',
          order: 17,
        },
        {
          type: 'table',
          content: {
            headers: ['Symptom', 'Likely Cause', 'Solution'],
            rows: [
              [
                'All devices offline',
                'Network/firewall issue',
                'Check Printyx Client status, verify network connectivity',
              ],
              [
                'Single device offline',
                'Device IP changed or offline',
                'Ping device, update IP if changed, check device power',
              ],
              [
                'Meters showing zeros',
                'Wrong SNMP OID for model',
                'Update device model in Printyx, verify SNMP community string',
              ],
              [
                'Permission denied errors',
                'SNMPv3 auth failure',
                'Verify SNMPv3 credentials, confirm device SNMP enabled',
              ],
              [
                'Timeout errors',
                'Network latency or device slow',
                'Increase timeout setting, check network quality',
              ],
            ],
          },
          order: 18,
        },
        {
          type: 'header',
          content: 'Data Sync Conflicts',
          order: 19,
        },
        {
          type: 'paragraph',
          content:
            'When bi-directional sync is enabled, conflicts can occur when the same record is modified in both systems:',
          order: 20,
        },
        {
          type: 'list',
          content: [
            '**Last-Write-Wins (Default)**: Most recent change wins, previous change lost',
            '**Printyx Authoritative**: Printyx changes always win',
            '**External System Authoritative**: External system (QB/Salesforce) always wins',
            '**Manual Review**: Flag conflicts for admin review (safest but requires intervention)',
          ],
          order: 21,
        },
        {
          type: 'callout',
          content:
            '⚠️ **Best Practice**: Use Printyx as authoritative source for operational data (service calls, quotes) and external system for financial/CRM strategy data.',
          formatting: { style: 'warning' },
          order: 22,
        },
        {
          type: 'header',
          content: 'Diagnostic Tools',
          order: 23,
        },
        {
          type: 'list',
          content: [
            '**Sync History Log**: View all sync attempts with success/failure status',
            '**Test Connection**: Force immediate sync to test connectivity',
            '**Field Mapping Validator**: Highlights missing or mismatched field mappings',
            '**Webhook Inspector**: See incoming webhooks from external systems',
            '**API Request Logger**: View raw API calls for debugging (admins only)',
          ],
          order: 24,
        },
        {
          type: 'header',
          content: 'When to Contact Support',
          order: 25,
        },
        {
          type: 'paragraph',
          content: 'Escalate to Printyx support if:',
          order: 26,
        },
        {
          type: 'list',
          content: [
            'Error persists after trying suggested solutions above',
            'Error affects all users/integrations (service-wide issue)',
            'Data corruption suspected',
            'Need to reset integration completely',
            'Require custom field mappings not available in UI',
          ],
          order: 27,
        },
        {
          type: 'paragraph',
          content:
            'When contacting support, include: Integration type, error message, timestamp, affected records (invoice numbers, customer names), and steps already attempted.',
          order: 28,
        },
      ],
    },
    htmlContent: `<h2>Integration Troubleshooting Basics</h2><p>Integration issues typically fall into three categories...</p>`,
    metaTitle: 'Troubleshooting Integration Issues - Printyx',
    metaDescription:
      'Resolve QuickBooks, Salesforce, and manufacturer integration problems with step-by-step diagnostic guides.',
    relatedArticleSlugs: ['quickbooks-integration-setup', 'salesforce-integration-guide'],
    status: 'published',
  },
  {
    title: 'Resolving Login and Access Issues',
    slug: 'resolving-login-access-issues',
    categorySlug: 'troubleshooting',
    excerpt:
      "Can't log in? Lost access to features? This guide walks you through authentication, password, and permission issues step-by-step.",
    contentType: 'troubleshooting',
    difficultyLevel: 'beginner',
    estimatedReadingTime: 7,
    featured: true,
    keywords: ['login', 'password', 'access', 'authentication', 'permissions'],
    tags: ['login', 'access', 'passwords', 'security'],
    content: {
      sections: [
        {
          type: 'header',
          content: 'Common Login Problems',
          order: 1,
        },
        {
          type: 'paragraph',
          content: "**Problem: 'Invalid email or password' error**",
          order: 2,
        },
        {
          type: 'list',
          content: [
            'Double-check email address for typos',
            'Verify Caps Lock is off (passwords are case-sensitive)',
            "Try password reset if forgotten: Click 'Forgot Password' on login screen",
            'Check if account is locked after multiple failed attempts (unlocks after 30 minutes)',
            "Ensure you're logging into correct tenant (subdomain in URL)",
          ],
          order: 3,
        },
        {
          type: 'callout',
          content:
            '🔒 **Security Note**: After 5 failed login attempts, accounts lock for 30 minutes to prevent brute force attacks. Contact your admin for immediate unlock.',
          formatting: { style: 'warning' },
          order: 4,
        },
        {
          type: 'paragraph',
          content: '**Problem: Password reset email not arriving**',
          order: 5,
        },
        {
          type: 'list',
          content: [
            "Check spam/junk folder (search for 'noreply@printyx.net')",
            'Verify email address is correct in your account',
            'Wait 5 minutes (emails can be delayed)',
            'Try requesting reset again (previous link may have expired)',
            'Contact admin to verify email address on file',
          ],
          order: 6,
        },
        {
          type: 'header',
          content: 'Multi-Factor Authentication (MFA) Issues',
          order: 7,
        },
        {
          type: 'paragraph',
          content: '**Problem: MFA code not working**',
          order: 8,
        },
        {
          type: 'list',
          content: [
            'Ensure device time is synced (TOTP codes are time-sensitive)',
            'Try next code (codes expire every 30 seconds)',
            "Check if you're using correct authenticator app",
            'Use backup codes if you saved them during MFA setup',
            'Contact admin to disable/reset MFA if locked out',
          ],
          order: 9,
        },
        {
          type: 'header',
          content: 'Permission and Access Issues',
          order: 10,
        },
        {
          type: 'paragraph',
          content: "**Problem: 'You don't have permission to access this page'**",
          order: 11,
        },
        {
          type: 'table',
          content: {
            headers: ['Scenario', 'Cause', 'Solution'],
            rows: [
              [
                "Can't access Admin settings",
                'User role insufficient',
                'Ask admin to upgrade role or grant specific permission',
              ],
              [
                "Can't edit customer records",
                'Read-only role',
                'Admin must change to Standard User or higher',
              ],
              [
                "Can't create service calls",
                'Service module not enabled for role',
                "Admin grants 'Create Service Calls' permission",
              ],
              [
                "Can't see certain customers",
                'Tenant/location restriction',
                'Admin adjusts tenant/location access in user settings',
              ],
              [
                "Can't delete records",
                'Typically requires Manager+ role',
                'Ask manager/admin to delete, or request role upgrade',
              ],
            ],
          },
          order: 12,
        },
        {
          type: 'callout',
          content:
            '💡 **Permission Hierarchy**: Printyx uses 8 role levels. Higher roles inherit all lower role permissions. You may need a role upgrade to access certain features.',
          formatting: { style: 'info' },
          order: 13,
        },
        {
          type: 'header',
          content: 'Browser and Cache Issues',
          order: 14,
        },
        {
          type: 'paragraph',
          content: "**Problem: Page appears broken or won't load**",
          order: 15,
        },
        {
          type: 'list',
          content: [
            'Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)',
            'Clear browser cache and cookies for printyx.net',
            'Try incognito/private browsing mode',
            'Update browser to latest version',
            'Try different browser (Chrome, Firefox, Edge, Safari all supported)',
            'Disable browser extensions that might interfere',
          ],
          order: 16,
        },
        {
          type: 'header',
          content: 'Session Timeout Issues',
          order: 17,
        },
        {
          type: 'paragraph',
          content:
            "Printyx sessions expire after 8 hours of inactivity for security. If you see 'Session expired, please log in again':",
          order: 18,
        },
        {
          type: 'list',
          content: [
            'Simply log in again to continue where you left off',
            'Unsaved work may be lost - save frequently!',
            "Use 'Remember Me' option to extend session (if allowed by admin)",
            'Increase timeout: Admins can extend to 24 hours in Settings → Security',
          ],
          order: 19,
        },
        {
          type: 'header',
          content: 'Mobile App Login Issues',
          order: 20,
        },
        {
          type: 'paragraph',
          content: "If the mobile app won't accept your credentials:",
          order: 21,
        },
        {
          type: 'list',
          content: [
            'Ensure app is updated to latest version',
            "Verify you're using same credentials as web login",
            'Check internet connectivity (app requires online access)',
            'Try logging out completely and back in',
            'Uninstall and reinstall app as last resort',
          ],
          order: 22,
        },
      ],
    },
    htmlContent: `<h2>Common Login Problems</h2><p>Invalid email or password errors...</p>`,
    metaTitle: 'Resolving Login and Access Issues - Printyx',
    metaDescription:
      'Troubleshoot authentication, password, and permission issues in Printyx with step-by-step solutions.',
    relatedArticleSlugs: ['user-roles-and-permissions', 'security-best-practices'],
    status: 'published',
  },
];
