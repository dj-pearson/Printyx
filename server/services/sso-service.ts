/**
 * SSO/SAML Service
 *
 * Provides enterprise SSO authentication support for:
 * - Azure AD (Microsoft Entra ID)
 * - Okta
 * - Google Workspace
 * - Custom SAML 2.0 and OIDC providers
 */

import { db } from '../db';
import { eq, and, isNull } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import {
  ssoProviderConfigs,
  ssoUserMappings,
  ssoLoginAttempts,
  ssoSessions,
  SsoProviderConfig,
  SsoUserMapping,
  NewSsoProviderConfig,
  SSO_PROVIDERS,
  DEFAULT_ATTRIBUTE_MAPPINGS,
} from '@shared/sso-schema';
import { users, tenants } from '@shared/schema';

// Types
export interface SsoAuthRequest {
  tenantId: string;
  providerId: string;
  redirectUrl: string;
  relayState?: string;
}

export interface SsoAuthResponse {
  authUrl: string;
  requestId: string;
  state?: string;
  nonce?: string;
}

export interface SsoCallbackData {
  requestId: string;
  protocol: 'saml2' | 'oidc';
  // SAML-specific
  samlResponse?: string;
  relayState?: string;
  // OIDC-specific
  code?: string;
  state?: string;
  idToken?: string;
}

export interface SsoUserProfile {
  externalId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  department?: string;
  jobTitle?: string;
  phoneNumber?: string;
  groups?: string[];
  rawAttributes: Record<string, any>;
}

export interface SsoAuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    tenantId: string;
  };
  session?: {
    id: string;
    expiresAt: Date;
  };
  provisioned?: boolean;
  updated?: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * SSO Service Class
 */
export class SsoService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  }

  /**
   * Get SSO provider configuration for a tenant
   */
  async getProviderConfig(
    tenantId: string,
    providerId?: string
  ): Promise<SsoProviderConfig | null> {
    const conditions = [eq(ssoProviderConfigs.tenantId, tenantId)];

    if (providerId) {
      conditions.push(eq(ssoProviderConfigs.id, providerId));
    } else {
      // Get primary enabled provider
      conditions.push(eq(ssoProviderConfigs.isEnabled, true));
      conditions.push(eq(ssoProviderConfigs.isPrimary, true));
    }

    const [config] = await db
      .select()
      .from(ssoProviderConfigs)
      .where(and(...conditions))
      .limit(1);

    return config || null;
  }

  /**
   * List all SSO providers for a tenant
   */
  async listProviders(tenantId: string): Promise<SsoProviderConfig[]> {
    return db
      .select()
      .from(ssoProviderConfigs)
      .where(eq(ssoProviderConfigs.tenantId, tenantId))
      .orderBy(ssoProviderConfigs.createdAt);
  }

  /**
   * Create a new SSO provider configuration
   */
  async createProvider(config: NewSsoProviderConfig): Promise<SsoProviderConfig> {
    // If this is the first provider or marked as primary, ensure only one primary
    if (config.isPrimary) {
      await db
        .update(ssoProviderConfigs)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(ssoProviderConfigs.tenantId, config.tenantId));
    }

    // Apply default attribute mappings if not provided
    if (!config.attributeMapping || Object.keys(config.attributeMapping).length === 0) {
      const providerType = config.providerType;
      config.attributeMapping = DEFAULT_ATTRIBUTE_MAPPINGS[providerType] || {};
    }

    const [provider] = await db
      .insert(ssoProviderConfigs)
      .values(config)
      .returning();

    return provider;
  }

  /**
   * Update SSO provider configuration
   */
  async updateProvider(
    providerId: string,
    updates: Partial<NewSsoProviderConfig>
  ): Promise<SsoProviderConfig | null> {
    const [provider] = await db
      .update(ssoProviderConfigs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(ssoProviderConfigs.id, providerId))
      .returning();

    return provider || null;
  }

  /**
   * Delete SSO provider configuration
   */
  async deleteProvider(providerId: string): Promise<boolean> {
    const result = await db
      .delete(ssoProviderConfigs)
      .where(eq(ssoProviderConfigs.id, providerId))
      .returning({ id: ssoProviderConfigs.id });

    return result.length > 0;
  }

  /**
   * Initiate SSO authentication flow
   */
  async initiateAuth(request: SsoAuthRequest): Promise<SsoAuthResponse> {
    const provider = await this.getProviderConfig(request.tenantId, request.providerId);

    if (!provider) {
      throw new Error('SSO provider not found or not enabled');
    }

    if (!provider.isEnabled) {
      throw new Error('SSO provider is not enabled');
    }

    const requestId = randomBytes(16).toString('hex');

    if (provider.protocol === 'saml2') {
      return this.initiateSamlAuth(provider, requestId, request);
    } else {
      return this.initiateOidcAuth(provider, requestId, request);
    }
  }

  /**
   * Initiate SAML authentication
   */
  private async initiateSamlAuth(
    provider: SsoProviderConfig,
    requestId: string,
    request: SsoAuthRequest
  ): Promise<SsoAuthResponse> {
    // Build SAML AuthnRequest
    const issuer = `${this.baseUrl}/api/sso/metadata/${provider.id}`;
    const acsUrl = `${this.baseUrl}/api/sso/callback/saml/${provider.id}`;
    const timestamp = new Date().toISOString();

    // For production, you would use a proper SAML library like saml2-js or passport-saml
    // This is a simplified version for illustration
    const authnRequest = this.buildSamlAuthnRequest({
      id: requestId,
      issuer,
      acsUrl,
      destination: provider.samlSsoUrl || '',
      timestamp,
      forceAuthn: provider.forceReauthentication || false,
    });

    // Encode and prepare redirect URL
    const encodedRequest = Buffer.from(authnRequest).toString('base64');
    const relayState = request.relayState || request.redirectUrl;

    // Build redirect URL
    const authUrl = new URL(provider.samlSsoUrl || '');
    authUrl.searchParams.set('SAMLRequest', encodedRequest);
    if (relayState) {
      authUrl.searchParams.set('RelayState', relayState);
    }

    // Log the attempt
    await this.logLoginAttempt({
      tenantId: request.tenantId,
      providerId: provider.id,
      requestId,
      protocol: 'saml2',
      success: false, // Will be updated on callback
      relayState,
    });

    return {
      authUrl: authUrl.toString(),
      requestId,
    };
  }

  /**
   * Initiate OIDC authentication
   */
  private async initiateOidcAuth(
    provider: SsoProviderConfig,
    requestId: string,
    request: SsoAuthRequest
  ): Promise<SsoAuthResponse> {
    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');
    const redirectUri = `${this.baseUrl}/api/sso/callback/oidc/${provider.id}`;

    // Build authorization URL based on provider type
    let authUrl: URL;

    switch (provider.providerType) {
      case 'azure_ad':
        authUrl = this.buildAzureAdAuthUrl(provider, state, nonce, redirectUri);
        break;
      case 'okta':
        authUrl = this.buildOktaAuthUrl(provider, state, nonce, redirectUri);
        break;
      case 'google_workspace':
        authUrl = this.buildGoogleAuthUrl(provider, state, nonce, redirectUri);
        break;
      default:
        authUrl = this.buildGenericOidcAuthUrl(provider, state, nonce, redirectUri);
    }

    // Store state and nonce for verification (in production, use Redis or similar)
    // For now, we'll include them in the relay state
    const relayStateData = JSON.stringify({
      requestId,
      state,
      nonce,
      redirectUrl: request.redirectUrl,
      originalRelayState: request.relayState,
    });
    const encodedRelayState = Buffer.from(relayStateData).toString('base64');

    authUrl.searchParams.set('state', encodedRelayState);

    // Log the attempt
    await this.logLoginAttempt({
      tenantId: request.tenantId,
      providerId: provider.id,
      requestId,
      protocol: 'oidc',
      success: false,
      oidcState: state,
      oidcNonce: nonce,
    });

    return {
      authUrl: authUrl.toString(),
      requestId,
      state,
      nonce,
    };
  }

  /**
   * Build Azure AD authorization URL
   */
  private buildAzureAdAuthUrl(
    provider: SsoProviderConfig,
    state: string,
    nonce: string,
    redirectUri: string
  ): URL {
    const tenantId = provider.providerSettings?.tenantId || 'common';
    const baseUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;

    const url = new URL(baseUrl);
    url.searchParams.set('client_id', provider.oidcClientId || '');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', provider.oidcScopes || 'openid profile email');
    url.searchParams.set('nonce', nonce);

    if (provider.forceReauthentication) {
      url.searchParams.set('prompt', 'login');
    }

    // Domain hint for faster login
    const allowedDomains = provider.allowedEmailDomains?.split(',')[0]?.trim();
    if (allowedDomains) {
      url.searchParams.set('domain_hint', allowedDomains);
    }

    return url;
  }

  /**
   * Build Okta authorization URL
   */
  private buildOktaAuthUrl(
    provider: SsoProviderConfig,
    state: string,
    nonce: string,
    redirectUri: string
  ): URL {
    const oktaDomain = provider.providerSettings?.oktaDomain;
    if (!oktaDomain) {
      throw new Error('Okta domain not configured');
    }

    const url = new URL(`https://${oktaDomain}/oauth2/v1/authorize`);
    url.searchParams.set('client_id', provider.oidcClientId || '');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', provider.oidcScopes || 'openid profile email groups');
    url.searchParams.set('nonce', nonce);

    if (provider.forceReauthentication) {
      url.searchParams.set('prompt', 'login');
    }

    return url;
  }

  /**
   * Build Google Workspace authorization URL
   */
  private buildGoogleAuthUrl(
    provider: SsoProviderConfig,
    state: string,
    nonce: string,
    redirectUri: string
  ): URL {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', provider.oidcClientId || '');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', provider.oidcScopes || 'openid profile email');
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('access_type', 'offline');

    if (provider.forceReauthentication) {
      url.searchParams.set('prompt', 'consent');
    }

    // Hosted domain restriction for Google Workspace
    const hostedDomain = provider.providerSettings?.hostedDomain ||
      provider.allowedEmailDomains?.split(',')[0]?.trim();
    if (hostedDomain) {
      url.searchParams.set('hd', hostedDomain);
    }

    return url;
  }

  /**
   * Build generic OIDC authorization URL
   */
  private buildGenericOidcAuthUrl(
    provider: SsoProviderConfig,
    state: string,
    nonce: string,
    redirectUri: string
  ): URL {
    const authUrl = provider.oidcAuthorizationUrl || `${provider.oidcIssuer}/authorize`;
    const url = new URL(authUrl);

    url.searchParams.set('client_id', provider.oidcClientId || '');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', provider.oidcScopes || 'openid profile email');
    url.searchParams.set('nonce', nonce);

    return url;
  }

  /**
   * Handle SSO callback
   */
  async handleCallback(
    providerId: string,
    callbackData: SsoCallbackData,
    clientIp?: string,
    userAgent?: string
  ): Promise<SsoAuthResult> {
    const startTime = Date.now();
    let loginAttemptId: string | undefined;

    try {
      // Get provider configuration
      const [provider] = await db
        .select()
        .from(ssoProviderConfigs)
        .where(eq(ssoProviderConfigs.id, providerId));

      if (!provider) {
        throw new Error('SSO provider not found');
      }

      // Parse user profile from response
      let userProfile: SsoUserProfile;

      if (callbackData.protocol === 'saml2') {
        userProfile = await this.parseSamlResponse(provider, callbackData);
      } else {
        userProfile = await this.handleOidcCallback(provider, callbackData);
      }

      // Validate email domain if restrictions are set
      if (provider.allowedEmailDomains) {
        const allowedDomains = provider.allowedEmailDomains.split(',').map(d => d.trim().toLowerCase());
        const emailDomain = userProfile.email.split('@')[1]?.toLowerCase();

        if (!allowedDomains.includes(emailDomain)) {
          throw new Error(`Email domain ${emailDomain} is not allowed for this SSO provider`);
        }
      }

      // Find or create user
      const { user, provisioned, updated } = await this.findOrCreateUser(
        provider,
        userProfile
      );

      // Create SSO session
      const session = await this.createSsoSession(provider, user.id, callbackData);

      // Update login attempt
      await this.updateLoginAttempt(callbackData.requestId, {
        success: true,
        userId: user.id,
        externalId: userProfile.externalId,
        externalEmail: userProfile.email,
        userProvisioned: provisioned,
        userUpdated: updated,
        durationMs: (Date.now() - startTime).toString(),
        clientIp,
        userAgent,
      });

      // Update provider stats
      await db
        .update(ssoProviderConfigs)
        .set({
          lastLoginAt: new Date(),
          loginCount: ((parseInt(provider.loginCount || '0', 10) + 1).toString()),
          updatedAt: new Date(),
        })
        .where(eq(ssoProviderConfigs.id, providerId));

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          tenantId: provider.tenantId,
        },
        session: {
          id: session.sessionId,
          expiresAt: session.expiresAt,
        },
        provisioned,
        updated,
      };
    } catch (error: any) {
      console.error('[SsoService] Callback error:', error);

      // Update login attempt with error
      if (callbackData.requestId) {
        await this.updateLoginAttempt(callbackData.requestId, {
          success: false,
          errorCode: error.code || 'SSO_ERROR',
          errorMessage: error.message,
          durationMs: (Date.now() - startTime).toString(),
          clientIp,
          userAgent,
        });
      }

      return {
        success: false,
        error: error.message,
        errorCode: error.code || 'SSO_ERROR',
      };
    }
  }

  /**
   * Parse SAML response and extract user profile
   */
  private async parseSamlResponse(
    provider: SsoProviderConfig,
    callbackData: SsoCallbackData
  ): Promise<SsoUserProfile> {
    // In production, use a proper SAML library for validation
    // This is a simplified version for illustration

    if (!callbackData.samlResponse) {
      throw new Error('SAML response is required');
    }

    // Decode and parse SAML response
    const samlXml = Buffer.from(callbackData.samlResponse, 'base64').toString('utf-8');

    // In production:
    // 1. Validate signature using provider's certificate
    // 2. Validate conditions (NotBefore, NotOnOrAfter)
    // 3. Validate audience restriction
    // 4. Validate issuer

    // Extract attributes using regex (simplified - use proper XML parser in production)
    const attributeMapping = provider.attributeMapping || {};
    const attributes: Record<string, string> = {};

    // Parse basic attributes from SAML response
    const nameIdMatch = samlXml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
    const externalId = nameIdMatch?.[1] || '';

    // Parse attribute statements
    const attrRegex = /<saml:Attribute Name="([^"]+)"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g;
    let match;
    while ((match = attrRegex.exec(samlXml)) !== null) {
      attributes[match[1]] = match[2];
    }

    // Map attributes to user profile
    const email = attributes[attributeMapping.email || 'email'] ||
      attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
      externalId;

    if (!email || !email.includes('@')) {
      throw new Error('Unable to extract email from SAML response');
    }

    return {
      externalId,
      email,
      firstName: attributes[attributeMapping.firstName || 'firstName'],
      lastName: attributes[attributeMapping.lastName || 'lastName'],
      displayName: attributes[attributeMapping.displayName || 'displayName'],
      department: attributes[attributeMapping.department || 'department'],
      groups: attributes[attributeMapping.groups || 'groups']?.split(','),
      rawAttributes: attributes,
    };
  }

  /**
   * Handle OIDC callback and exchange code for tokens
   */
  private async handleOidcCallback(
    provider: SsoProviderConfig,
    callbackData: SsoCallbackData
  ): Promise<SsoUserProfile> {
    if (!callbackData.code) {
      throw new Error('Authorization code is required');
    }

    // Parse relay state to get original state and nonce
    let stateData: any = {};
    if (callbackData.state) {
      try {
        const decoded = Buffer.from(callbackData.state, 'base64').toString('utf-8');
        stateData = JSON.parse(decoded);
      } catch {
        // Invalid state format
      }
    }

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(provider, callbackData.code);

    // Decode and validate ID token
    const idTokenPayload = this.decodeJwt(tokens.id_token);

    // Validate nonce
    if (stateData.nonce && idTokenPayload.nonce !== stateData.nonce) {
      throw new Error('Invalid nonce in ID token');
    }

    // Get user info for additional attributes
    let userInfo: Record<string, any> = {};
    if (provider.oidcUserInfoUrl || tokens.access_token) {
      try {
        userInfo = await this.fetchUserInfo(provider, tokens.access_token);
      } catch (error) {
        console.warn('[SsoService] Failed to fetch user info:', error);
      }
    }

    // Merge token claims and user info
    const attributes = { ...idTokenPayload, ...userInfo };
    const attributeMapping = provider.attributeMapping || {};

    const email = attributes[attributeMapping.email || 'email'] ||
      attributes.email ||
      attributes.preferred_username;

    if (!email || !email.includes('@')) {
      throw new Error('Unable to extract email from OIDC response');
    }

    return {
      externalId: attributes.sub || attributes.oid || email,
      email,
      firstName: attributes[attributeMapping.firstName || 'given_name'] || attributes.given_name,
      lastName: attributes[attributeMapping.lastName || 'family_name'] || attributes.family_name,
      displayName: attributes[attributeMapping.displayName || 'name'] || attributes.name,
      department: attributes[attributeMapping.department || 'department'],
      groups: attributes[attributeMapping.groups || 'groups'] || attributes.groups,
      rawAttributes: attributes,
    };
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    provider: SsoProviderConfig,
    code: string
  ): Promise<{ id_token: string; access_token: string; refresh_token?: string }> {
    let tokenUrl: string;

    switch (provider.providerType) {
      case 'azure_ad':
        const tenantId = provider.providerSettings?.tenantId || 'common';
        tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        break;
      case 'okta':
        const oktaDomain = provider.providerSettings?.oktaDomain;
        tokenUrl = `https://${oktaDomain}/oauth2/v1/token`;
        break;
      case 'google_workspace':
        tokenUrl = 'https://oauth2.googleapis.com/token';
        break;
      default:
        tokenUrl = provider.oidcTokenUrl || `${provider.oidcIssuer}/token`;
    }

    const redirectUri = `${this.baseUrl}/api/sso/callback/oidc/${provider.id}`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: provider.oidcClientId || '',
        client_secret: provider.oidcClientSecret || '',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Fetch user info from OIDC provider
   */
  private async fetchUserInfo(
    provider: SsoProviderConfig,
    accessToken: string
  ): Promise<Record<string, any>> {
    let userInfoUrl: string;

    switch (provider.providerType) {
      case 'azure_ad':
        userInfoUrl = 'https://graph.microsoft.com/oidc/userinfo';
        break;
      case 'okta':
        const oktaDomain = provider.providerSettings?.oktaDomain;
        userInfoUrl = `https://${oktaDomain}/oauth2/v1/userinfo`;
        break;
      case 'google_workspace':
        userInfoUrl = 'https://openidconnect.googleapis.com/v1/userinfo';
        break;
      default:
        userInfoUrl = provider.oidcUserInfoUrl || `${provider.oidcIssuer}/userinfo`;
    }

    const response = await fetch(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Decode JWT token (without validation - for payload extraction)
   */
  private decodeJwt(token: string): Record<string, any> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  }

  /**
   * Find or create user from SSO profile
   */
  private async findOrCreateUser(
    provider: SsoProviderConfig,
    profile: SsoUserProfile
  ): Promise<{ user: any; provisioned: boolean; updated: boolean }> {
    // Check for existing user mapping
    const [existingMapping] = await db
      .select()
      .from(ssoUserMappings)
      .where(
        and(
          eq(ssoUserMappings.providerId, provider.id),
          eq(ssoUserMappings.externalId, profile.externalId)
        )
      );

    if (existingMapping) {
      // Get the existing user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, existingMapping.userId));

      if (!user) {
        throw new Error('Mapped user not found');
      }

      // Update user attributes if configured
      let updated = false;
      if (provider.autoUpdateUserAttributes) {
        const updates: Record<string, any> = {};

        if (profile.firstName && profile.firstName !== user.firstName) {
          updates.firstName = profile.firstName;
        }
        if (profile.lastName && profile.lastName !== user.lastName) {
          updates.lastName = profile.lastName;
        }

        if (Object.keys(updates).length > 0) {
          await db
            .update(users)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(users.id, user.id));
          updated = true;
        }
      }

      // Update mapping
      await db
        .update(ssoUserMappings)
        .set({
          lastLoginAt: new Date(),
          loginCount: ((parseInt(existingMapping.loginCount || '0', 10) + 1).toString()),
          lastSyncedAt: new Date(),
          externalAttributes: profile.rawAttributes,
          externalGroups: profile.groups || [],
          updatedAt: new Date(),
        })
        .where(eq(ssoUserMappings.id, existingMapping.id));

      return { user, provisioned: false, updated };
    }

    // Check for existing user by email
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, profile.email.toLowerCase()));

    if (existingUser) {
      // Link existing user to SSO provider
      await db.insert(ssoUserMappings).values({
        tenantId: provider.tenantId,
        userId: existingUser.id,
        providerId: provider.id,
        externalId: profile.externalId,
        externalEmail: profile.email,
        externalAttributes: profile.rawAttributes,
        externalGroups: profile.groups || [],
        provisionedBy: 'link',
      });

      return { user: existingUser, provisioned: false, updated: false };
    }

    // JIT provisioning if enabled
    if (!provider.jitProvisioning && !provider.autoProvisionUsers) {
      throw new Error('User not found and auto-provisioning is disabled');
    }

    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        email: profile.email.toLowerCase(),
        firstName: profile.firstName,
        lastName: profile.lastName,
        tenantId: provider.tenantId,
        role: provider.defaultRole || 'user',
        isActive: true,
        emailVerified: true, // Verified by SSO provider
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create SSO mapping
    await db.insert(ssoUserMappings).values({
      tenantId: provider.tenantId,
      userId: newUser.id,
      providerId: provider.id,
      externalId: profile.externalId,
      externalEmail: profile.email,
      externalAttributes: profile.rawAttributes,
      externalGroups: profile.groups || [],
      provisionedBy: 'jit',
    });

    return { user: newUser, provisioned: true, updated: false };
  }

  /**
   * Create SSO session
   */
  private async createSsoSession(
    provider: SsoProviderConfig,
    userId: string,
    callbackData: SsoCallbackData
  ): Promise<{ sessionId: string; expiresAt: Date }> {
    const sessionId = randomBytes(32).toString('hex');
    const sessionTimeout = this.parseSessionTimeout(provider.sessionTimeout || '8h');
    const expiresAt = new Date(Date.now() + sessionTimeout);

    await db.insert(ssoSessions).values({
      tenantId: provider.tenantId,
      userId,
      providerId: provider.id,
      sessionId,
      expiresAt,
      lastActivityAt: new Date(),
    });

    return { sessionId, expiresAt };
  }

  /**
   * Parse session timeout string to milliseconds
   */
  private parseSessionTimeout(timeout: string): number {
    const match = timeout.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      return 8 * 60 * 60 * 1000; // Default 8 hours
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 8 * 60 * 60 * 1000;
    }
  }

  /**
   * Log login attempt
   */
  private async logLoginAttempt(data: Partial<{
    tenantId: string;
    providerId: string;
    requestId: string;
    protocol: 'saml2' | 'oidc';
    success: boolean;
    relayState?: string;
    oidcState?: string;
    oidcNonce?: string;
  }>): Promise<void> {
    await db.insert(ssoLoginAttempts).values({
      tenantId: data.tenantId,
      providerId: data.providerId,
      requestId: data.requestId || randomBytes(16).toString('hex'),
      protocol: data.protocol || 'oidc',
      success: data.success || false,
      relayState: data.relayState,
      oidcState: data.oidcState,
      oidcNonce: data.oidcNonce,
    });
  }

  /**
   * Update login attempt
   */
  private async updateLoginAttempt(
    requestId: string,
    updates: Partial<{
      success: boolean;
      userId: string;
      externalId: string;
      externalEmail: string;
      userProvisioned: boolean;
      userUpdated: boolean;
      errorCode: string;
      errorMessage: string;
      durationMs: string;
      clientIp: string;
      userAgent: string;
    }>
  ): Promise<void> {
    await db
      .update(ssoLoginAttempts)
      .set({
        ...updates,
        completedAt: new Date(),
      })
      .where(eq(ssoLoginAttempts.requestId, requestId));
  }

  /**
   * Build SAML AuthnRequest (simplified)
   */
  private buildSamlAuthnRequest(params: {
    id: string;
    issuer: string;
    acsUrl: string;
    destination: string;
    timestamp: string;
    forceAuthn: boolean;
  }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="_${params.id}"
  Version="2.0"
  IssueInstant="${params.timestamp}"
  Destination="${params.destination}"
  AssertionConsumerServiceURL="${params.acsUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
  ${params.forceAuthn ? 'ForceAuthn="true"' : ''}>
  <saml:Issuer>${params.issuer}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>
</samlp:AuthnRequest>`;
  }

  /**
   * Generate SAML metadata for this service provider
   */
  async generateSpMetadata(providerId: string): Promise<string> {
    const [provider] = await db
      .select()
      .from(ssoProviderConfigs)
      .where(eq(ssoProviderConfigs.id, providerId));

    if (!provider) {
      throw new Error('Provider not found');
    }

    const entityId = `${this.baseUrl}/api/sso/metadata/${providerId}`;
    const acsUrl = `${this.baseUrl}/api/sso/callback/saml/${providerId}`;
    const sloUrl = `${this.baseUrl}/api/sso/logout/saml/${providerId}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="true" WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}" index="0" isDefault="true"/>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${sloUrl}"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }

  /**
   * Handle single logout
   */
  async handleLogout(
    sessionId: string,
    initiator: 'user' | 'idp' | 'admin' = 'user'
  ): Promise<{ success: boolean; redirectUrl?: string }> {
    const [session] = await db
      .select()
      .from(ssoSessions)
      .where(eq(ssoSessions.sessionId, sessionId));

    if (!session) {
      return { success: true }; // Already logged out
    }

    // Mark session as inactive
    await db
      .update(ssoSessions)
      .set({
        isActive: false,
        logoutInitiatedAt: new Date(),
        logoutCompletedAt: new Date(),
        logoutMethod: initiator,
      })
      .where(eq(ssoSessions.id, session.id));

    // Get provider for SLO URL
    const [provider] = await db
      .select()
      .from(ssoProviderConfigs)
      .where(eq(ssoProviderConfigs.id, session.providerId));

    if (provider?.singleLogoutEnabled && provider.samlSloUrl) {
      return {
        success: true,
        redirectUrl: provider.samlSloUrl,
      };
    }

    return { success: true };
  }

  /**
   * Validate SSO session
   */
  async validateSession(sessionId: string): Promise<{
    valid: boolean;
    userId?: string;
    tenantId?: string;
    expiresAt?: Date;
  }> {
    const [session] = await db
      .select()
      .from(ssoSessions)
      .where(
        and(
          eq(ssoSessions.sessionId, sessionId),
          eq(ssoSessions.isActive, true)
        )
      );

    if (!session) {
      return { valid: false };
    }

    if (session.expiresAt < new Date()) {
      // Session expired
      await db
        .update(ssoSessions)
        .set({
          isActive: false,
          logoutMethod: 'timeout',
          logoutCompletedAt: new Date(),
        })
        .where(eq(ssoSessions.id, session.id));

      return { valid: false };
    }

    // Update last activity
    await db
      .update(ssoSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(ssoSessions.id, session.id));

    return {
      valid: true,
      userId: session.userId,
      tenantId: session.tenantId,
      expiresAt: session.expiresAt,
    };
  }
}

// Export singleton instance
export const ssoService = new SsoService();
