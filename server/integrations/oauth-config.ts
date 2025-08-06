/**
 * OAuth Configuration for Third-Party Integrations
 * Supports Google Calendar and Microsoft Outlook Calendar
 */
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { Client, AuthenticationProvider } from '@microsoft/microsoft-graph-client';

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

// Additional integration configs for future expansion
export const availableIntegrations: IntegrationProvider[] = [
  googleCalendarConfig,
  microsoftCalendarConfig,
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
  
  return {
    valid: errors.length === 0,
    errors
  };
}