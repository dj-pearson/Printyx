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
  createSalesforceClient,
  createStripeClient,
  createQuickBooksClient,
  googleCalendarConfig,
  microsoftCalendarConfig,
  salesforceConfig,
  quickbooksConfig,
  stripeConfig
} from './oauth-config';
import { DataMapper } from './data-mapper';
import { ErrorMonitor } from './error-monitor';
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

    try {
      if (providerId === 'google-calendar') {
        tokens = await this.exchangeGoogleCode(code);
        userInfo = await this.getGoogleUserInfo(tokens.access_token);
      } else if (providerId === 'microsoft-calendar') {
        tokens = await this.exchangeMicrosoftCode(code);
        userInfo = await this.getMicrosoftUserInfo(tokens.access_token);
      } else if (providerId === 'salesforce') {
        tokens = await this.exchangeSalesforceCode(code);
        userInfo = await this.getSalesforceUserInfo(tokens.access_token);
      } else if (providerId === 'quickbooks') {
        tokens = await this.exchangeQuickBooksCode(code, state);
        userInfo = await this.getQuickBooksCompanyInfo(tokens.access_token, tokens.refresh_token!);
      } else if (providerId === 'stripe') {
        tokens = await this.exchangeStripeCode(code);
        userInfo = await this.getStripeAccountInfo(tokens.access_token);
      } else {
        throw new Error(`OAuth flow not implemented for provider: ${providerId}`);
      }
    } catch (error) {
      await ErrorMonitor.recordError('temp-integration', tenantId, providerId, 'oauth_callback', error as Error);
      throw error;
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

  private static async exchangeSalesforceCode(code: string): Promise<OAuthTokens> {
    const response = await axios.post(salesforceConfig.tokenUrl, new URLSearchParams({
      client_id: salesforceConfig.config.clientId,
      client_secret: salesforceConfig.config.clientSecret,
      code,
      redirect_uri: salesforceConfig.config.redirectUri,
      grant_type: 'authorization_code'
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      token_type: response.data.token_type || 'Bearer'
    };
  }

  private static async getSalesforceUserInfo(accessToken: string): Promise<any> {
    const response = await axios.get('https://login.salesforce.com/services/oauth2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return response.data;
  }

  private static async exchangeQuickBooksCode(code: string, state: string): Promise<OAuthTokens> {
    const response = await axios.post(quickbooksConfig.tokenUrl, new URLSearchParams({
      client_id: quickbooksConfig.config.clientId,
      client_secret: quickbooksConfig.config.clientSecret,
      code,
      redirect_uri: quickbooksConfig.config.redirectUri,
      grant_type: 'authorization_code'
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
      token_type: response.data.token_type || 'Bearer'
    };
  }

  private static async getQuickBooksCompanyInfo(accessToken: string, refreshToken: string): Promise<any> {
    // QuickBooks requires the company ID (realmId) which is passed in the OAuth callback
    // For now, we'll return basic info. In production, you'd extract realmId from state parameter
    return {
      displayName: 'QuickBooks Company',
      realmId: 'extracted-from-state' // This should be extracted from the state parameter
    };
  }

  private static async exchangeStripeCode(code: string): Promise<OAuthTokens> {
    const response = await axios.post(stripeConfig.tokenUrl, new URLSearchParams({
      client_id: stripeConfig.config.clientId,
      client_secret: stripeConfig.config.clientSecret,
      code,
      grant_type: 'authorization_code'
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      token_type: response.data.token_type || 'Bearer'
    };
  }

  private static async getStripeAccountInfo(accessToken: string): Promise<any> {
    const response = await axios.get('https://api.stripe.com/v1/account', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return response.data;
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

  /**
   * Get Salesforce data for a tenant
   */
  static async getSalesforceData(integrationId: string, tenantId: string, dataType: 'accounts' | 'contacts' | 'opportunities') {
    const integration = await this.getIntegrationById(integrationId, tenantId);
    if (!integration || integration.providerId !== 'salesforce') {
      throw new Error('Salesforce integration not found');
    }

    const salesforceClient = createSalesforceClient(integration.tokens!.access_token);
    
    try {
      let query = '';
      switch (dataType) {
        case 'accounts':
          query = 'SELECT Id, Name, Website, Phone, Industry, BillingStreet, BillingCity, BillingState FROM Account LIMIT 100';
          break;
        case 'contacts':
          query = 'SELECT Id, FirstName, LastName, Email, Phone, Title, AccountId FROM Contact LIMIT 100';
          break;
        case 'opportunities':
          query = 'SELECT Id, Name, Amount, StageName, CloseDate, AccountId FROM Opportunity LIMIT 100';
          break;
      }

      const result = await salesforceClient.query(query);
      await this.updateLastSync(integrationId);
      
      // Apply data transformation
      const transformResult = DataMapper.transformData('salesforce', dataType === 'accounts' ? 'Account' : dataType === 'contacts' ? 'Contact' : 'Opportunity', result.records);
      return transformResult.success ? transformResult.data : result.records;
    } catch (error) {
      await ErrorMonitor.recordError(integrationId, tenantId, 'salesforce', `get_${dataType}`, error as Error);
      throw error;
    }
  }

  /**
   * Get Stripe data for a tenant
   */
  static async getStripeData(integrationId: string, tenantId: string, dataType: 'customers' | 'invoices' | 'subscriptions') {
    const integration = await this.getIntegrationById(integrationId, tenantId);
    if (!integration || integration.providerId !== 'stripe') {
      throw new Error('Stripe integration not found');
    }

    const stripeClient = createStripeClient(integration.tokens!.access_token);
    
    try {
      let data: any;
      switch (dataType) {
        case 'customers':
          data = await stripeClient.customers.list({ limit: 100 });
          break;
        case 'invoices':
          data = await stripeClient.invoices.list({ limit: 100 });
          break;
        case 'subscriptions':
          data = await stripeClient.subscriptions.list({ limit: 100 });
          break;
      }

      await this.updateLastSync(integrationId);
      
      // Apply data transformation
      if (dataType === 'customers') {
        const transformResult = DataMapper.transformData('stripe', 'Customer', data.data);
        return transformResult.success ? transformResult.data : data.data;
      }
      
      return data.data;
    } catch (error) {
      await ErrorMonitor.recordError(integrationId, tenantId, 'stripe', `get_${dataType}`, error as Error);
      throw error;
    }
  }

  /**
   * Get QuickBooks data for a tenant
   */
  static async getQuickBooksData(integrationId: string, tenantId: string, dataType: 'customers' | 'invoices' | 'items') {
    const integration = await this.getIntegrationById(integrationId, tenantId);
    if (!integration || integration.providerId !== 'quickbooks') {
      throw new Error('QuickBooks integration not found');
    }

    const qboClient = createQuickBooksClient(integration.tokens!.access_token, integration.tokens!.refresh_token!);
    
    try {
      let data: any;
      const companyId = integration.metadata?.realmId || 'default-company';
      
      switch (dataType) {
        case 'customers':
          data = await new Promise((resolve, reject) => {
            qboClient.findCustomers(companyId, (err: any, customers: any) => {
              if (err) reject(err);
              else resolve(customers);
            });
          });
          break;
        case 'invoices':
          data = await new Promise((resolve, reject) => {
            qboClient.findInvoices(companyId, (err: any, invoices: any) => {
              if (err) reject(err);
              else resolve(invoices);
            });
          });
          break;
        case 'items':
          data = await new Promise((resolve, reject) => {
            qboClient.findItems(companyId, (err: any, items: any) => {
              if (err) reject(err);
              else resolve(items);
            });
          });
          break;
      }

      await this.updateLastSync(integrationId);
      
      // Apply data transformation
      if (dataType === 'customers') {
        const transformResult = DataMapper.transformData('quickbooks', 'Customer', data);
        return transformResult.success ? transformResult.data : data;
      }
      
      return data;
    } catch (error) {
      await ErrorMonitor.recordError(integrationId, tenantId, 'quickbooks', `get_${dataType}`, error as Error);
      throw error;
    }
  }

  /**
   * Get integration health for all integrations
   */
  static async getIntegrationsHealth(tenantId: string): Promise<any[]> {
    const integrations = await this.getIntegrations(tenantId);
    const healthMetrics = [];

    for (const integration of integrations) {
      const health = await ErrorMonitor.getIntegrationHealth(integration.id);
      healthMetrics.push({
        ...integration,
        health
      });
    }

    return healthMetrics;
  }

  /**
   * Test integration connection
   */
  static async testIntegrationConnection(integrationId: string, tenantId: string): Promise<boolean> {
    const integration = await this.getIntegrationById(integrationId, tenantId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    try {
      // Test connection based on provider
      switch (integration.providerId) {
        case 'google-calendar':
          await this.getGoogleCalendarEvents(integrationId, tenantId);
          break;
        case 'microsoft-calendar':
          await this.getMicrosoftCalendarEvents(integrationId, tenantId);
          break;
        case 'salesforce':
          await this.getSalesforceData(integrationId, tenantId, 'accounts');
          break;
        case 'stripe':
          await this.getStripeData(integrationId, tenantId, 'customers');
          break;
        case 'quickbooks':
          await this.getQuickBooksData(integrationId, tenantId, 'customers');
          break;
        default:
          throw new Error(`Connection test not implemented for ${integration.providerId}`);
      }

      // Update integration status to connected
      await db.update(systemIntegrations)
        .set({ 
          status: 'connected',
          lastSync: new Date(),
          updatedAt: new Date()
        })
        .where(eq(systemIntegrations.id, integrationId));

      return true;
    } catch (error) {
      await this.handleIntegrationError(integrationId, error);
      return false;
    }
  }

  private static async handleIntegrationError(integrationId: string, error: any): Promise<void> {
    await ErrorMonitor.recordError(integrationId, 'unknown-tenant', 'unknown-provider', 'api_call', error as Error);
    
    await db.update(systemIntegrations)
      .set({ 
        status: 'error',
        updatedAt: new Date()
      })
      .where(eq(systemIntegrations.id, integrationId));
  }
}