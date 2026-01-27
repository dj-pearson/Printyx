/**
 * OAuth Token Refresh Service
 *
 * Implements silent token refresh for calendar and third-party integrations.
 * Automatically refreshes expired tokens before they expire.
 */

import axios from 'axios';
import { db } from '../db';
import { systemIntegrations } from '../../shared/schema';
import { eq, and, lt, isNotNull } from 'drizzle-orm';
import {
  googleCalendarConfig,
  microsoftCalendarConfig,
  salesforceConfig,
  quickbooksConfig,
  stripeConfig,
  createGoogleAuthClient,
} from '../integrations/oauth-config';

// Token refresh configuration
export const TOKEN_REFRESH_CONFIG = {
  // Refresh tokens this many minutes before expiration
  refreshBeforeExpiryMinutes: 10,
  // Maximum retry attempts for failed refreshes
  maxRetryAttempts: 3,
  // Delay between retry attempts (exponential backoff base)
  retryBaseDelayMs: 1000,
  // Check interval for proactive refresh
  checkIntervalMinutes: 5,
};

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at?: number; // Unix timestamp
  expires_in?: number; // Seconds from now
  token_type?: string;
  scope?: string;
}

export interface RefreshResult {
  success: boolean;
  tokens?: TokenData;
  error?: string;
  retryable?: boolean;
}

/**
 * Check if token needs refresh
 */
export function needsRefresh(tokenData: TokenData): boolean {
  if (!tokenData.expires_at && !tokenData.expires_in) {
    return false; // No expiration info, assume valid
  }

  const expiresAt = tokenData.expires_at
    ? tokenData.expires_at * 1000 // Convert to milliseconds
    : Date.now() + (tokenData.expires_in || 0) * 1000;

  const refreshThreshold = TOKEN_REFRESH_CONFIG.refreshBeforeExpiryMinutes * 60 * 1000;
  return Date.now() >= expiresAt - refreshThreshold;
}

/**
 * Refresh Google OAuth tokens
 */
async function refreshGoogleToken(refreshToken: string): Promise<RefreshResult> {
  try {
    const oauth2Client = createGoogleAuthClient(refreshToken);
    const { credentials } = await oauth2Client.refreshAccessToken();

    return {
      success: true,
      tokens: {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || refreshToken,
        expires_at: credentials.expiry_date
          ? Math.floor(credentials.expiry_date / 1000)
          : undefined,
        token_type: credentials.token_type || 'Bearer',
        scope: credentials.scope,
      },
    };
  } catch (error: any) {
    const isRetryable = error.code !== 400 && error.code !== 401;
    return {
      success: false,
      error: error.message || 'Failed to refresh Google token',
      retryable: isRetryable,
    };
  }
}

/**
 * Refresh Microsoft OAuth tokens
 */
async function refreshMicrosoftToken(refreshToken: string): Promise<RefreshResult> {
  try {
    const response = await axios.post(
      microsoftCalendarConfig.tokenUrl,
      new URLSearchParams({
        client_id: microsoftCalendarConfig.config.clientId,
        client_secret: microsoftCalendarConfig.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: microsoftCalendarConfig.config.scopes.join(' '),
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const data = response.data;
    return {
      success: true,
      tokens: {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        expires_in: data.expires_in,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
        token_type: data.token_type || 'Bearer',
        scope: data.scope,
      },
    };
  } catch (error: any) {
    const status = error.response?.status;
    const isRetryable = status !== 400 && status !== 401;
    return {
      success: false,
      error: error.response?.data?.error_description || error.message,
      retryable: isRetryable,
    };
  }
}

/**
 * Refresh Salesforce OAuth tokens
 */
async function refreshSalesforceToken(refreshToken: string): Promise<RefreshResult> {
  try {
    const response = await axios.post(
      salesforceConfig.tokenUrl,
      new URLSearchParams({
        client_id: salesforceConfig.config.clientId,
        client_secret: salesforceConfig.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const data = response.data;
    return {
      success: true,
      tokens: {
        access_token: data.access_token,
        refresh_token: refreshToken, // Salesforce doesn't return new refresh token
        token_type: data.token_type || 'Bearer',
        // Salesforce tokens typically don't have explicit expiry
      },
    };
  } catch (error: any) {
    const status = error.response?.status;
    const isRetryable = status !== 400 && status !== 401;
    return {
      success: false,
      error: error.response?.data?.error_description || error.message,
      retryable: isRetryable,
    };
  }
}

/**
 * Refresh QuickBooks OAuth tokens
 */
async function refreshQuickBooksToken(refreshToken: string): Promise<RefreshResult> {
  try {
    const credentials = Buffer.from(
      `${quickbooksConfig.config.clientId}:${quickbooksConfig.config.clientSecret}`,
    ).toString('base64');

    const response = await axios.post(
      quickbooksConfig.tokenUrl,
      new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
          Accept: 'application/json',
        },
      },
    );

    const data = response.data;
    return {
      success: true,
      tokens: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
        token_type: data.token_type || 'Bearer',
      },
    };
  } catch (error: any) {
    const status = error.response?.status;
    const isRetryable = status !== 400 && status !== 401;
    return {
      success: false,
      error: error.response?.data?.error_description || error.message,
      retryable: isRetryable,
    };
  }
}

/**
 * Refresh tokens for a specific provider
 */
export async function refreshToken(provider: string, refreshToken: string): Promise<RefreshResult> {
  switch (provider) {
    case 'google-calendar':
      return refreshGoogleToken(refreshToken);
    case 'microsoft-calendar':
      return refreshMicrosoftToken(refreshToken);
    case 'salesforce':
      return refreshSalesforceToken(refreshToken);
    case 'quickbooks':
      return refreshQuickBooksToken(refreshToken);
    default:
      return {
        success: false,
        error: `Token refresh not implemented for provider: ${provider}`,
        retryable: false,
      };
  }
}

/**
 * Refresh token with retry logic
 */
export async function refreshTokenWithRetry(
  provider: string,
  refreshTokenValue: string,
  maxAttempts: number = TOKEN_REFRESH_CONFIG.maxRetryAttempts,
): Promise<RefreshResult> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await refreshToken(provider, refreshTokenValue);

    if (result.success) {
      return result;
    }

    lastError = result.error;

    if (!result.retryable || attempt === maxAttempts) {
      return result;
    }

    // Exponential backoff
    const delay = TOKEN_REFRESH_CONFIG.retryBaseDelayMs * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return {
    success: false,
    error: lastError || 'Token refresh failed after all retry attempts',
    retryable: false,
  };
}

/**
 * Update integration tokens in database
 */
export async function updateIntegrationTokens(
  integrationId: string,
  tokens: TokenData,
): Promise<boolean> {
  try {
    const [integration] = await db
      .select()
      .from(systemIntegrations)
      .where(eq(systemIntegrations.id, integrationId))
      .limit(1);

    if (!integration) {
      console.error(`Integration not found: ${integrationId}`);
      return false;
    }

    // Update tokens in config
    const updatedConfig = {
      ...integration.config,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || integration.config?.tokens?.refresh_token,
        expires_at: tokens.expiresAt,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        scope: tokens.scope,
      },
    };

    await db
      .update(systemIntegrations)
      .set({
        config: updatedConfig,
        lastSync: new Date(),
        status: 'connected',
      })
      .where(eq(systemIntegrations.id, integrationId));

    console.log(`[TOKEN REFRESH] Updated tokens for integration: ${integrationId}`);
    return true;
  } catch (error) {
    console.error('Failed to update integration tokens:', error);
    return false;
  }
}

/**
 * Mark integration as requiring reauthorization
 */
async function markIntegrationForReauth(integrationId: string, error: string): Promise<void> {
  try {
    await db
      .update(systemIntegrations)
      .set({
        status: 'error',
        config: db.sql`jsonb_set(config, '{error}', ${JSON.stringify({ message: error, at: new Date().toISOString() })})`,
      })
      .where(eq(systemIntegrations.id, integrationId));

    console.log(`[TOKEN REFRESH] Marked integration for reauthorization: ${integrationId}`);
  } catch (err) {
    console.error('Failed to mark integration for reauth:', err);
  }
}

/**
 * Refresh tokens for a specific integration
 */
export async function refreshIntegrationTokens(
  integrationId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const [integration] = await db
      .select()
      .from(systemIntegrations)
      .where(eq(systemIntegrations.id, integrationId))
      .limit(1);

    if (!integration) {
      return { success: false, error: 'Integration not found' };
    }

    const tokens = integration.config?.tokens;
    if (!tokens?.refresh_token) {
      return { success: false, error: 'No refresh token available' };
    }

    // Check if refresh is needed
    if (!needsRefresh(tokens)) {
      return { success: true }; // Token is still valid
    }

    // Refresh the token
    const result = await refreshTokenWithRetry(integration.provider, tokens.refresh_token);

    if (result.success && result.tokens) {
      await updateIntegrationTokens(integrationId, result.tokens);
      return { success: true };
    }

    // Handle refresh failure
    if (!result.retryable) {
      await markIntegrationForReauth(integrationId, result.error || 'Token refresh failed');
    }

    return { success: false, error: result.error };
  } catch (error: any) {
    console.error('Error refreshing integration tokens:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Proactively refresh all expiring tokens
 */
export async function refreshExpiringTokens(): Promise<{
  total: number;
  refreshed: number;
  failed: number;
  errors: Array<{ integrationId: string; error: string }>;
}> {
  const result = {
    total: 0,
    refreshed: 0,
    failed: 0,
    errors: [] as Array<{ integrationId: string; error: string }>,
  };

  try {
    // Get all connected integrations with tokens
    const integrations = await db
      .select()
      .from(systemIntegrations)
      .where(eq(systemIntegrations.status, 'connected'));

    for (const integration of integrations) {
      const tokens = integration.config?.tokens;
      if (!tokens?.refresh_token) continue;

      result.total++;

      if (needsRefresh(tokens)) {
        const refreshResult = await refreshIntegrationTokens(integration.id);

        if (refreshResult.success) {
          result.refreshed++;
        } else {
          result.failed++;
          result.errors.push({
            integrationId: integration.id,
            error: refreshResult.error || 'Unknown error',
          });
        }
      }
    }

    console.log(
      `[TOKEN REFRESH] Checked ${result.total} integrations, refreshed ${result.refreshed}, failed ${result.failed}`,
    );
  } catch (error) {
    console.error('Error in proactive token refresh:', error);
  }

  return result;
}

/**
 * Get valid access token for an integration (refresh if needed)
 */
export async function getValidAccessToken(
  integrationId: string,
): Promise<{ token: string | null; error?: string }> {
  try {
    const [integration] = await db
      .select()
      .from(systemIntegrations)
      .where(eq(systemIntegrations.id, integrationId))
      .limit(1);

    if (!integration) {
      return { token: null, error: 'Integration not found' };
    }

    const tokens = integration.config?.tokens;
    if (!tokens?.access_token) {
      return { token: null, error: 'No access token available' };
    }

    // Check if token needs refresh
    if (needsRefresh(tokens)) {
      if (!tokens.refresh_token) {
        return { token: null, error: 'Token expired and no refresh token available' };
      }

      const refreshResult = await refreshIntegrationTokens(integrationId);
      if (!refreshResult.success) {
        return { token: null, error: refreshResult.error };
      }

      // Get updated token
      const [updatedIntegration] = await db
        .select()
        .from(systemIntegrations)
        .where(eq(systemIntegrations.id, integrationId))
        .limit(1);

      return { token: updatedIntegration?.config?.tokens?.access_token || null };
    }

    return { token: tokens.access_token };
  } catch (error: any) {
    console.error('Error getting valid access token:', error);
    return { token: null, error: error.message };
  }
}

/**
 * Start periodic token refresh job
 */
let refreshJobInterval: NodeJS.Timer | null = null;

export function startTokenRefreshJob(): void {
  if (refreshJobInterval) {
    console.warn('[TOKEN REFRESH] Job already running');
    return;
  }

  const intervalMs = TOKEN_REFRESH_CONFIG.checkIntervalMinutes * 60 * 1000;

  refreshJobInterval = setInterval(async () => {
    console.log('[TOKEN REFRESH] Running proactive refresh check...');
    await refreshExpiringTokens();
  }, intervalMs);

  console.log(
    `[TOKEN REFRESH] Started periodic refresh job (every ${TOKEN_REFRESH_CONFIG.checkIntervalMinutes} minutes)`,
  );

  // Run initial check
  refreshExpiringTokens().catch(console.error);
}

/**
 * Stop periodic token refresh job
 */
export function stopTokenRefreshJob(): void {
  if (refreshJobInterval) {
    clearInterval(refreshJobInterval);
    refreshJobInterval = null;
    console.log('[TOKEN REFRESH] Stopped periodic refresh job');
  }
}

export default {
  needsRefresh,
  refreshToken,
  refreshTokenWithRetry,
  updateIntegrationTokens,
  refreshIntegrationTokens,
  refreshExpiringTokens,
  getValidAccessToken,
  startTokenRefreshJob,
  stopTokenRefreshJob,
  TOKEN_REFRESH_CONFIG,
};
