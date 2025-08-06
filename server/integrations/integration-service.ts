/**
 * Integration Service Layer
 * Handles OAuth flows and API interactions for third-party services
 */
import { db } from '../db';
import { systemIntegrations } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { 
  getIntegrationConfig, 
  generateAuthUrl, 
  createGoogleAuthClient, 
  createMicrosoftGraphClient,
  googleCalendarConfig,
  microsoftCalendarConfig
} from './oauth-config';
import { google } from 'googleapis';
import axios from 'axios';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface IntegrationData {
  id: string;
  tenantId: string;
  providerId: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  config: any;
  tokens?: OAuthTokens;
  lastSync?: Date;
  metadata?: any;
}

export class IntegrationService {
  /**
   * Initialize OAuth flow for a provider
   */
  static async initializeOAuth(tenantId: string, providerId: string, userId: string): Promise<{ authUrl: string; state: string }> {
    const state = `${tenantId}-${providerId}-${userId}-${Date.now()}`;
    const authUrl = generateAuthUrl(providerId, state);
    
    return { authUrl, state };
  }

  /**
   * Handle OAuth callback and store tokens
   */
  static async handleOAuthCallback(
    tenantId: string, 
    providerId: string, 
    code: string, 
    state: string
  ): Promise<IntegrationData> {
    const config = getIntegrationConfig(providerId);
    if (!config) {
      throw new Error(`Integration provider ${providerId} not found`);
    }

    let tokens: OAuthTokens;
    let userInfo: any = {};

    if (providerId === 'google-calendar') {
      tokens = await this.exchangeGoogleCode(code);
      userInfo = await this.getGoogleUserInfo(tokens.access_token);
    } else if (providerId === 'microsoft-calendar') {
      tokens = await this.exchangeMicrosoftCode(code);
      userInfo = await this.getMicrosoftUserInfo(tokens.access_token);
    } else {
      throw new Error(`OAuth flow not implemented for provider: ${providerId}`);
    }

    // Store integration in database
    const integrationData = {
      tenantId,
      name: `${config.name} - ${userInfo.email || userInfo.displayName || 'User'}`,
      category: config.category,
      provider: providerId,
      description: config.description,
      status: 'connected' as const,
      config: {
        ...config.config,
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type || 'Bearer'
        },
        userInfo
      },
      lastSync: new Date(),
      syncFrequency: 'real-time'
    };

    const [integration] = await db.insert(systemIntegrations)
      .values(integrationData)
      .returning();

    return {
      id: integration.id,
      tenantId: integration.tenantId!,
      providerId,
      name: integration.name,
      status: integration.status as any,
      config: integration.config,
      tokens,
      lastSync: integration.lastSync || undefined,
      metadata: userInfo
    };
  }

  /**
   * Get all integrations for a tenant
   */
  static async getIntegrations(tenantId: string): Promise<IntegrationData[]> {
    const integrations = await db.select()
      .from(systemIntegrations)
      .where(eq(systemIntegrations.tenantId, tenantId));

    return integrations.map(integration => ({
      id: integration.id,
      tenantId: integration.tenantId!,
      providerId: integration.provider,
      name: integration.name,
      status: integration.status as any,
      config: integration.config,
      tokens: integration.config?.tokens,
      lastSync: integration.lastSync || undefined,
      metadata: integration.config?.userInfo
    }));
  }

  /**
   * Get calendar events from Google Calendar
   */
  static async getGoogleCalendarEvents(integrationId: string, tenantId: string, startDate?: Date, endDate?: Date) {
    const integration = await this.getIntegrationById(integrationId, tenantId);
    if (!integration || integration.providerId !== 'google-calendar') {
      throw new Error('Google Calendar integration not found');
    }

    const oauth2Client = createGoogleAuthClient();
    oauth2Client.setCredentials({
      access_token: integration.tokens?.access_token,
      refresh_token: integration.tokens?.refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate?.toISOString() || new Date().toISOString(),
        timeMax: endDate?.toISOString() || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime'
      });

      await this.updateLastSync(integrationId);
      return response.data.items || [];
    } catch (error) {
      await this.handleIntegrationError(integrationId, error);
      throw error;
    }
  }

  /**
   * Get calendar events from Microsoft Calendar
   */
  static async getMicrosoftCalendarEvents(integrationId: string, tenantId: string, startDate?: Date, endDate?: Date) {
    const integration = await this.getIntegrationById(integrationId, tenantId);
    if (!integration || integration.providerId !== 'microsoft-calendar') {
      throw new Error('Microsoft Calendar integration not found');
    }

    const graphClient = createMicrosoftGraphClient(integration.tokens!.access_token);
    
    try {
      const startTime = startDate?.toISOString() || new Date().toISOString();
      const endTime = endDate?.toISOString() || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const events = await graphClient
        .api('/me/calendar/calendarView')
        .query({
          startDateTime: startTime,
          endDateTime: endTime,
          $top: 100,
          $orderby: 'start/dateTime'
        })
        .get();

      await this.updateLastSync(integrationId);
      return events.value || [];
    } catch (error) {
      await this.handleIntegrationError(integrationId, error);
      throw error;
    }
  }

  /**
   * Delete an integration
   */
  static async deleteIntegration(integrationId: string, tenantId: string): Promise<void> {
    await db.delete(systemIntegrations)
      .where(and(
        eq(systemIntegrations.id, integrationId),
        eq(systemIntegrations.tenantId, tenantId)
      ));
  }

  // Private helper methods

  private static async exchangeGoogleCode(code: string): Promise<OAuthTokens> {
    const oauth2Client = createGoogleAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    
    return {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token || undefined,
      expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : undefined,
      token_type: tokens.token_type || 'Bearer'
    };
  }

  private static async exchangeMicrosoftCode(code: string): Promise<OAuthTokens> {
    const response = await axios.post(microsoftCalendarConfig.tokenUrl, new URLSearchParams({
      client_id: microsoftCalendarConfig.config.clientId,
      client_secret: microsoftCalendarConfig.config.clientSecret,
      code,
      redirect_uri: microsoftCalendarConfig.config.redirectUri,
      grant_type: 'authorization_code'
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data;
  }

  private static async getGoogleUserInfo(accessToken: string): Promise<any> {
    const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return response.data;
  }

  private static async getMicrosoftUserInfo(accessToken: string): Promise<any> {
    const graphClient = createMicrosoftGraphClient(accessToken);
    return await graphClient.api('/me').get();
  }

  private static async getIntegrationById(integrationId: string, tenantId: string): Promise<IntegrationData | null> {
    const [integration] = await db.select()
      .from(systemIntegrations)
      .where(and(
        eq(systemIntegrations.id, integrationId),
        eq(systemIntegrations.tenantId, tenantId)
      ));

    if (!integration) return null;

    return {
      id: integration.id,
      tenantId: integration.tenantId!,
      providerId: integration.provider,
      name: integration.name,
      status: integration.status as any,
      config: integration.config,
      tokens: integration.config?.tokens,
      lastSync: integration.lastSync || undefined,
      metadata: integration.config?.userInfo
    };
  }

  private static async updateLastSync(integrationId: string): Promise<void> {
    await db.update(systemIntegrations)
      .set({ lastSync: new Date() })
      .where(eq(systemIntegrations.id, integrationId));
  }

  private static async handleIntegrationError(integrationId: string, error: any): Promise<void> {
    console.error(`Integration error for ${integrationId}:`, error);
    
    await db.update(systemIntegrations)
      .set({ 
        status: 'error',
        config: {
          // Preserve existing config but add error info
          error: {
            message: error.message,
            timestamp: new Date().toISOString()
          }
        }
      })
      .where(eq(systemIntegrations.id, integrationId));
  }
}