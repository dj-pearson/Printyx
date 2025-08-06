/**
 * OAuth Configuration for Third-Party Integrations
 * Supports Google Calendar and Microsoft Outlook Calendar
 */
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { Client, AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import jsforce from 'jsforce';
import Stripe from 'stripe';
import QuickBooks from 'node-quickbooks';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface IntegrationProvider {
  id: string;
  name: string;
  description: string;
  category: string;
  config: OAuthConfig;
  authUrl: string;
  tokenUrl: string;
}

// Google Calendar Configuration
export const googleCalendarConfig: IntegrationProvider = {
  id: 'google-calendar',
  name: 'Google Calendar',
  description: 'Sync events, meetings, and schedules with Google Calendar',
  category: 'calendar',
  config: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL}/api/integrations/google/callback`,
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ]
  },
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token'
};

// Microsoft Outlook Calendar Configuration
export const microsoftCalendarConfig: IntegrationProvider = {
  id: 'microsoft-calendar',
  name: 'Microsoft Outlook Calendar',
  description: 'Integrate with Outlook Calendar for meeting and event management',
  category: 'calendar',
  config: {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${process.env.BASE_URL}/api/integrations/microsoft/callback`,
    scopes: [
      'https://graph.microsoft.com/calendars.readwrite',
      'https://graph.microsoft.com/user.read'
    ]
  },
  authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
};

// Salesforce CRM Configuration
export const salesforceConfig: IntegrationProvider = {
  id: 'salesforce',
  name: 'Salesforce CRM',
  description: 'Sync customers, leads, opportunities, and activities with Salesforce',
  category: 'crm',
  config: {
    clientId: process.env.SALESFORCE_CLIENT_ID || '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
    redirectUri: process.env.SALESFORCE_REDIRECT_URI || `${process.env.BASE_URL}/api/integrations/salesforce/callback`,
    scopes: [
      'api',
      'refresh_token',
      'offline_access'
    ]
  },
  authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
  tokenUrl: 'https://login.salesforce.com/services/oauth2/token'
};

// QuickBooks Online Configuration
export const quickbooksConfig: IntegrationProvider = {
  id: 'quickbooks',
  name: 'QuickBooks Online',
  description: 'Sync customers, invoices, and financial data with QuickBooks Online',
  category: 'accounting',
  config: {
    clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || `${process.env.BASE_URL}/api/integrations/quickbooks/callback`,
    scopes: ['com.intuit.quickbooks.accounting']
  },
  authUrl: 'https://appcenter.intuit.com/connect/oauth2',
  tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
};

// Stripe Payments Configuration
export const stripeConfig: IntegrationProvider = {
  id: 'stripe',
  name: 'Stripe Payments',
  description: 'Process payments and manage subscriptions with Stripe',
  category: 'payments',
  config: {
    clientId: process.env.STRIPE_CLIENT_ID || '',
    clientSecret: process.env.STRIPE_SECRET_KEY || '',
    redirectUri: process.env.STRIPE_REDIRECT_URI || `${process.env.BASE_URL}/api/integrations/stripe/callback`,
    scopes: ['read_write']
  },
  authUrl: 'https://connect.stripe.com/oauth/authorize',
  tokenUrl: 'https://connect.stripe.com/oauth/token'
};

// Additional integration configs for future expansion
export const availableIntegrations: IntegrationProvider[] = [
  googleCalendarConfig,
  microsoftCalendarConfig,
  salesforceConfig,
  quickbooksConfig,
  stripeConfig,
  // Future integrations can be added here
];

/**
 * Get integration config by provider ID
 */
export function getIntegrationConfig(providerId: string): IntegrationProvider | undefined {
  return availableIntegrations.find(integration => integration.id === providerId);
}

/**
 * Generate OAuth authorization URL
 */
export function generateAuthUrl(providerId: string, state?: string): string {
  const integration = getIntegrationConfig(providerId);
  if (!integration) {
    throw new Error(`Integration provider ${providerId} not found`);
  }

  const params = new URLSearchParams({
    client_id: integration.config.clientId,
    redirect_uri: integration.config.redirectUri,
    response_type: 'code',
    scope: integration.config.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    ...(state && { state })
  });

  return `${integration.authUrl}?${params.toString()}`;
}

/**
 * Custom Microsoft Graph Authentication Provider
 */
export class CustomAuthProvider implements AuthenticationProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }
}

/**
 * Create Google Auth client
 */
export function createGoogleAuthClient(refreshToken?: string): OAuth2Client {
  const oauth2Client = new OAuth2Client(
    googleCalendarConfig.config.clientId,
    googleCalendarConfig.config.clientSecret,
    googleCalendarConfig.config.redirectUri
  );

  if (refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
  }

  return oauth2Client;
}

/**
 * Create Microsoft Graph client
 */
export function createMicrosoftGraphClient(accessToken: string): Client {
  const authProvider = new CustomAuthProvider(accessToken);
  
  return Client.initWithMiddleware({
    authProvider
  });
}

/**
 * Create Salesforce client
 */
export function createSalesforceClient(accessToken: string, instanceUrl?: string): jsforce.Connection {
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: salesforceConfig.config.clientId,
      clientSecret: salesforceConfig.config.clientSecret,
      redirectUri: salesforceConfig.config.redirectUri
    },
    instanceUrl: instanceUrl || 'https://login.salesforce.com',
    accessToken: accessToken
  });

  return conn;
}

/**
 * Create Stripe client
 */
export function createStripeClient(accessToken?: string): Stripe {
  // For Stripe, we typically use the secret key for server-side operations
  // accessToken would be for Stripe Connect applications
  const apiKey = accessToken || process.env.STRIPE_SECRET_KEY;
  
  return new Stripe(apiKey!, {
    apiVersion: '2024-06-20'
  });
}

/**
 * Create QuickBooks client
 */
export function createQuickBooksClient(accessToken: string, refreshToken: string, companyId: string): QuickBooks {
  return new QuickBooks(
    quickbooksConfig.config.clientId,
    quickbooksConfig.config.clientSecret,
    accessToken,
    false, // not sandbox
    companyId,
    true, // use the sandbox flag, but set to false for production
    true, // debug mode
    null, // minor_version
    '2.0', // oauth_version
    refreshToken
  );
}

/**
 * Validate OAuth configuration
 */
export function validateOAuthConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check Google Calendar config
  if (!googleCalendarConfig.config.clientId) {
    errors.push('GOOGLE_CLIENT_ID environment variable not set');
  }
  if (!googleCalendarConfig.config.clientSecret) {
    errors.push('GOOGLE_CLIENT_SECRET environment variable not set');
  }
  
  // Check Microsoft Calendar config
  if (!microsoftCalendarConfig.config.clientId) {
    errors.push('MICROSOFT_CLIENT_ID environment variable not set');
  }
  if (!microsoftCalendarConfig.config.clientSecret) {
    errors.push('MICROSOFT_CLIENT_SECRET environment variable not set');
  }
  
  // Check Salesforce config
  if (!salesforceConfig.config.clientId) {
    errors.push('SALESFORCE_CLIENT_ID environment variable not set');
  }
  if (!salesforceConfig.config.clientSecret) {
    errors.push('SALESFORCE_CLIENT_SECRET environment variable not set');
  }
  
  // Check QuickBooks config
  if (!quickbooksConfig.config.clientId) {
    errors.push('QUICKBOOKS_CLIENT_ID environment variable not set');
  }
  if (!quickbooksConfig.config.clientSecret) {
    errors.push('QUICKBOOKS_CLIENT_SECRET environment variable not set');
  }
  
  // Check Stripe config
  if (!stripeConfig.config.clientId) {
    errors.push('STRIPE_CLIENT_ID environment variable not set');
  }
  if (!stripeConfig.config.clientSecret) {
    errors.push('STRIPE_SECRET_KEY environment variable not set');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}