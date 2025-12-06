/**
 * Secrets Management Integration
 *
 * Provides a unified interface for managing secrets across different providers:
 * - HashiCorp Vault
 * - AWS Secrets Manager
 * - Environment Variables (fallback)
 *
 * Configuration is determined by the SECRETS_PROVIDER environment variable:
 * - 'vault' - HashiCorp Vault
 * - 'aws' - AWS Secrets Manager
 * - 'env' (default) - Environment variables
 */

import { EventEmitter } from 'events';

// Types for secrets management
export interface SecretConfig {
  key: string;
  version?: string;
  namespace?: string;
}

export interface SecretValue {
  value: string;
  version?: string;
  createdAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, string>;
}

export interface SecretsProvider {
  name: string;
  initialize(): Promise<void>;
  getSecret(config: SecretConfig): Promise<SecretValue | null>;
  setSecret(key: string, value: string, metadata?: Record<string, string>): Promise<void>;
  deleteSecret(key: string): Promise<void>;
  listSecrets(prefix?: string): Promise<string[]>;
  rotateSecret?(key: string): Promise<SecretValue>;
  healthCheck(): Promise<boolean>;
}

// Secret rotation event types
export interface SecretRotationEvent {
  key: string;
  oldVersion?: string;
  newVersion: string;
  rotatedAt: Date;
}

/**
 * HashiCorp Vault Provider
 *
 * Environment variables required:
 * - VAULT_ADDR: Vault server address (e.g., https://vault.example.com)
 * - VAULT_TOKEN: Authentication token (or use VAULT_ROLE_ID + VAULT_SECRET_ID for AppRole)
 * - VAULT_NAMESPACE: Optional namespace for Vault Enterprise
 * - VAULT_MOUNT_PATH: Secret engine mount path (default: 'secret')
 */
class HashiCorpVaultProvider implements SecretsProvider {
  name = 'HashiCorp Vault';
  private token: string | null = null;
  private readonly address: string;
  private readonly namespace: string;
  private readonly mountPath: string;
  private tokenExpiresAt: Date | null = null;
  private readonly renewalThreshold = 300000; // 5 minutes before expiry

  constructor() {
    this.address = process.env.VAULT_ADDR || 'http://localhost:8200';
    this.namespace = process.env.VAULT_NAMESPACE || '';
    this.mountPath = process.env.VAULT_MOUNT_PATH || 'secret';
  }

  async initialize(): Promise<void> {
    // Support both direct token and AppRole authentication
    if (process.env.VAULT_TOKEN) {
      this.token = process.env.VAULT_TOKEN;
      await this.verifyToken();
    } else if (process.env.VAULT_ROLE_ID && process.env.VAULT_SECRET_ID) {
      await this.authenticateAppRole();
    } else {
      throw new Error(
        'Vault authentication not configured. Provide VAULT_TOKEN or VAULT_ROLE_ID + VAULT_SECRET_ID'
      );
    }

    // Start token renewal loop
    this.startTokenRenewal();
    console.log(`[SecretsManager] HashiCorp Vault initialized at ${this.address}`);
  }

  private async authenticateAppRole(): Promise<void> {
    const response = await this.makeRequest('/v1/auth/approle/login', 'POST', {
      role_id: process.env.VAULT_ROLE_ID,
      secret_id: process.env.VAULT_SECRET_ID,
    });

    if (!response.auth?.client_token) {
      throw new Error('Failed to authenticate with Vault AppRole');
    }

    this.token = response.auth.client_token;
    if (response.auth.lease_duration) {
      this.tokenExpiresAt = new Date(Date.now() + response.auth.lease_duration * 1000);
    }
  }

  private async verifyToken(): Promise<void> {
    try {
      const response = await this.makeRequest('/v1/auth/token/lookup-self', 'GET');
      if (response.data?.expire_time) {
        this.tokenExpiresAt = new Date(response.data.expire_time);
      }
    } catch (error) {
      throw new Error(`Invalid Vault token: ${error}`);
    }
  }

  private startTokenRenewal(): void {
    setInterval(async () => {
      if (this.tokenExpiresAt) {
        const timeUntilExpiry = this.tokenExpiresAt.getTime() - Date.now();
        if (timeUntilExpiry < this.renewalThreshold) {
          try {
            await this.renewToken();
          } catch (error) {
            console.error('[SecretsManager] Failed to renew Vault token:', error);
            // Try to re-authenticate with AppRole
            if (process.env.VAULT_ROLE_ID && process.env.VAULT_SECRET_ID) {
              await this.authenticateAppRole();
            }
          }
        }
      }
    }, 60000); // Check every minute
  }

  private async renewToken(): Promise<void> {
    const response = await this.makeRequest('/v1/auth/token/renew-self', 'POST', {});
    if (response.auth?.lease_duration) {
      this.tokenExpiresAt = new Date(Date.now() + response.auth.lease_duration * 1000);
      console.log('[SecretsManager] Vault token renewed successfully');
    }
  }

  private async makeRequest(
    path: string,
    method: string,
    body?: Record<string, unknown>
  ): Promise<any> {
    const url = `${this.address}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['X-Vault-Token'] = this.token;
    }
    if (this.namespace) {
      headers['X-Vault-Namespace'] = this.namespace;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vault request failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async getSecret(config: SecretConfig): Promise<SecretValue | null> {
    try {
      const path = config.namespace
        ? `${config.namespace}/${config.key}`
        : config.key;

      // Use KV v2 API
      const versionParam = config.version ? `?version=${config.version}` : '';
      const response = await this.makeRequest(
        `/v1/${this.mountPath}/data/${path}${versionParam}`,
        'GET'
      );

      if (!response.data?.data) {
        return null;
      }

      return {
        value: response.data.data.value || JSON.stringify(response.data.data),
        version: response.data.metadata?.version?.toString(),
        createdAt: response.data.metadata?.created_time
          ? new Date(response.data.metadata.created_time)
          : undefined,
        metadata: response.data.metadata?.custom_metadata,
      };
    } catch (error: any) {
      if (error.message?.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async setSecret(
    key: string,
    value: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    const data: Record<string, unknown> = { value };

    // If value is valid JSON, spread it
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) {
        Object.assign(data, parsed);
      }
    } catch {
      // Keep value as-is if not valid JSON
    }

    await this.makeRequest(`/v1/${this.mountPath}/data/${key}`, 'POST', {
      data,
      options: metadata ? { custom_metadata: metadata } : undefined,
    });
  }

  async deleteSecret(key: string): Promise<void> {
    await this.makeRequest(`/v1/${this.mountPath}/metadata/${key}`, 'DELETE');
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    try {
      const path = prefix || '';
      const response = await this.makeRequest(
        `/v1/${this.mountPath}/metadata/${path}?list=true`,
        'GET'
      );
      return response.data?.keys || [];
    } catch {
      return [];
    }
  }

  async rotateSecret(key: string): Promise<SecretValue> {
    // Get current secret
    const current = await this.getSecret({ key });
    if (!current) {
      throw new Error(`Secret ${key} not found for rotation`);
    }

    // Generate new secret value (for credentials, use crypto)
    const crypto = await import('crypto');
    const newValue = crypto.randomBytes(32).toString('base64');

    // Store new version
    await this.setSecret(key, newValue, { rotated_at: new Date().toISOString() });

    // Get updated secret with new version
    const updated = await this.getSecret({ key });
    if (!updated) {
      throw new Error(`Failed to retrieve rotated secret ${key}`);
    }

    return updated;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.address}/v1/sys/health`);
      const health = await response.json();
      return health.initialized && !health.sealed;
    } catch {
      return false;
    }
  }
}

/**
 * AWS Secrets Manager Provider
 *
 * Environment variables required:
 * - AWS_REGION: AWS region (default: us-east-1)
 * - AWS_ACCESS_KEY_ID: AWS access key (optional if using IAM roles)
 * - AWS_SECRET_ACCESS_KEY: AWS secret key (optional if using IAM roles)
 * - AWS_SECRET_PREFIX: Optional prefix for all secret names
 */
class AWSSecretsManagerProvider implements SecretsProvider {
  name = 'AWS Secrets Manager';
  private client: any = null;
  private readonly region: string;
  private readonly prefix: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.prefix = process.env.AWS_SECRET_PREFIX || '';
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import to avoid requiring AWS SDK if not used
      const { SecretsManagerClient } = await import('@aws-sdk/client-secrets-manager');

      const config: any = { region: this.region };

      // Explicit credentials (optional - SDK will use default credential chain)
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        config.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        };
      }

      this.client = new SecretsManagerClient(config);
      console.log(`[SecretsManager] AWS Secrets Manager initialized in ${this.region}`);
    } catch (error: any) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        throw new Error(
          'AWS SDK not installed. Install @aws-sdk/client-secrets-manager to use AWS Secrets Manager.'
        );
      }
      throw error;
    }
  }

  private getFullSecretName(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  async getSecret(config: SecretConfig): Promise<SecretValue | null> {
    try {
      const { GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');

      const secretName = this.getFullSecretName(config.key);
      const command = new GetSecretValueCommand({
        SecretId: secretName,
        VersionId: config.version,
        VersionStage: config.version ? undefined : 'AWSCURRENT',
      });

      const response = await this.client.send(command);

      return {
        value: response.SecretString || '',
        version: response.VersionId,
        createdAt: response.CreatedDate,
        metadata: response.Tags?.reduce((acc: Record<string, string>, tag: any) => {
          if (tag.Key && tag.Value) {
            acc[tag.Key] = tag.Value;
          }
          return acc;
        }, {}),
      };
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  async setSecret(
    key: string,
    value: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    const secretName = this.getFullSecretName(key);

    try {
      // Try to update existing secret
      const { PutSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
      const command = new PutSecretValueCommand({
        SecretId: secretName,
        SecretString: value,
      });
      await this.client.send(command);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        // Create new secret
        const { CreateSecretCommand } = await import('@aws-sdk/client-secrets-manager');
        const command = new CreateSecretCommand({
          Name: secretName,
          SecretString: value,
          Tags: metadata
            ? Object.entries(metadata).map(([Key, Value]) => ({ Key, Value }))
            : undefined,
        });
        await this.client.send(command);
      } else {
        throw error;
      }
    }
  }

  async deleteSecret(key: string): Promise<void> {
    const { DeleteSecretCommand } = await import('@aws-sdk/client-secrets-manager');
    const secretName = this.getFullSecretName(key);

    const command = new DeleteSecretCommand({
      SecretId: secretName,
      ForceDeleteWithoutRecovery: false, // Allow 30-day recovery
    });

    await this.client.send(command);
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    const { ListSecretsCommand } = await import('@aws-sdk/client-secrets-manager');

    const secrets: string[] = [];
    let nextToken: string | undefined;
    const filterPrefix = prefix
      ? this.getFullSecretName(prefix)
      : this.prefix || undefined;

    do {
      const command = new ListSecretsCommand({
        NextToken: nextToken,
        Filters: filterPrefix
          ? [{ Key: 'name', Values: [filterPrefix] }]
          : undefined,
      });

      const response = await this.client.send(command);

      if (response.SecretList) {
        secrets.push(
          ...response.SecretList.map((s: any) => s.Name).filter(Boolean) as string[]
        );
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return secrets;
  }

  async rotateSecret(key: string): Promise<SecretValue> {
    const { RotateSecretCommand } = await import('@aws-sdk/client-secrets-manager');
    const secretName = this.getFullSecretName(key);

    const command = new RotateSecretCommand({
      SecretId: secretName,
      RotateImmediately: true,
    });

    await this.client.send(command);

    // Wait a moment for rotation to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fetch the new value
    const newValue = await this.getSecret({ key });
    if (!newValue) {
      throw new Error(`Failed to retrieve rotated secret ${key}`);
    }

    return newValue;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { ListSecretsCommand } = await import('@aws-sdk/client-secrets-manager');
      const command = new ListSecretsCommand({ MaxResults: 1 });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Environment Variables Provider (Fallback)
 *
 * Uses environment variables as secrets source.
 * Useful for development and simple deployments.
 */
class EnvironmentProvider implements SecretsProvider {
  name = 'Environment Variables';
  private readonly prefix: string;

  constructor() {
    this.prefix = process.env.SECRET_ENV_PREFIX || '';
  }

  async initialize(): Promise<void> {
    console.log('[SecretsManager] Using environment variables for secrets');
  }

  private getEnvKey(key: string): string {
    const normalizedKey = key
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toUpperCase();
    return this.prefix ? `${this.prefix}_${normalizedKey}` : normalizedKey;
  }

  async getSecret(config: SecretConfig): Promise<SecretValue | null> {
    const envKey = this.getEnvKey(config.key);
    const value = process.env[envKey];

    if (!value) {
      return null;
    }

    return {
      value,
      version: '1', // Env vars don't have versions
    };
  }

  async setSecret(key: string, value: string): Promise<void> {
    const envKey = this.getEnvKey(key);
    process.env[envKey] = value;
    console.warn(
      `[SecretsManager] Warning: Setting ${envKey} in process.env. This is temporary and will not persist.`
    );
  }

  async deleteSecret(key: string): Promise<void> {
    const envKey = this.getEnvKey(key);
    delete process.env[envKey];
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    const searchPrefix = prefix
      ? this.getEnvKey(prefix)
      : this.prefix;

    return Object.keys(process.env)
      .filter(key => !searchPrefix || key.startsWith(searchPrefix));
  }

  async healthCheck(): Promise<boolean> {
    return true; // Always healthy
  }
}

/**
 * Secrets Manager Class
 *
 * Main interface for secrets management with caching,
 * rotation events, and multi-provider support.
 */
class SecretsManager extends EventEmitter {
  private provider: SecretsProvider | null = null;
  private cache: Map<string, { value: SecretValue; expiresAt: number }> = new Map();
  private readonly cacheTTL: number;
  private initialized = false;

  constructor() {
    super();
    // Cache TTL in milliseconds (default: 5 minutes)
    this.cacheTTL = parseInt(process.env.SECRETS_CACHE_TTL || '300000', 10);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const providerType = process.env.SECRETS_PROVIDER?.toLowerCase() || 'env';

    switch (providerType) {
      case 'vault':
        this.provider = new HashiCorpVaultProvider();
        break;
      case 'aws':
        this.provider = new AWSSecretsManagerProvider();
        break;
      case 'env':
      default:
        this.provider = new EnvironmentProvider();
        break;
    }

    await this.provider.initialize();
    this.initialized = true;

    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60000);
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  private getCacheKey(config: SecretConfig): string {
    return `${config.namespace || ''}:${config.key}:${config.version || 'latest'}`;
  }

  /**
   * Get a secret value
   *
   * @param key - Secret key/name
   * @param options - Optional configuration
   * @returns Secret value or null if not found
   */
  async getSecret(
    key: string,
    options: { namespace?: string; version?: string; bypassCache?: boolean } = {}
  ): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const config: SecretConfig = {
      key,
      namespace: options.namespace,
      version: options.version,
    };

    // Check cache
    if (!options.bypassCache) {
      const cacheKey = this.getCacheKey(config);
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value.value;
      }
    }

    // Fetch from provider
    const secret = await this.provider!.getSecret(config);
    if (!secret) {
      return null;
    }

    // Cache the result
    if (!options.bypassCache) {
      const cacheKey = this.getCacheKey(config);
      this.cache.set(cacheKey, {
        value: secret,
        expiresAt: Date.now() + this.cacheTTL,
      });
    }

    return secret.value;
  }

  /**
   * Get a secret with full metadata
   */
  async getSecretWithMetadata(
    key: string,
    options: { namespace?: string; version?: string } = {}
  ): Promise<SecretValue | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.provider!.getSecret({
      key,
      namespace: options.namespace,
      version: options.version,
    });
  }

  /**
   * Set a secret value
   */
  async setSecret(
    key: string,
    value: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.provider!.setSecret(key, value, metadata);

    // Invalidate cache
    this.invalidateCache(key);
  }

  /**
   * Delete a secret
   */
  async deleteSecret(key: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.provider!.deleteSecret(key);
    this.invalidateCache(key);
  }

  /**
   * List secrets
   */
  async listSecrets(prefix?: string): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.provider!.listSecrets(prefix);
  }

  /**
   * Rotate a secret and emit rotation event
   */
  async rotateSecret(key: string): Promise<SecretValue> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.provider!.rotateSecret) {
      throw new Error(`Provider ${this.provider!.name} does not support secret rotation`);
    }

    const oldSecret = await this.provider!.getSecret({ key });
    const newSecret = await this.provider!.rotateSecret(key);

    // Emit rotation event
    const event: SecretRotationEvent = {
      key,
      oldVersion: oldSecret?.version,
      newVersion: newSecret.version || 'unknown',
      rotatedAt: new Date(),
    };
    this.emit('secretRotated', event);

    // Invalidate cache
    this.invalidateCache(key);

    return newSecret;
  }

  /**
   * Invalidate cached secrets
   */
  invalidateCache(keyPattern?: string): void {
    if (!keyPattern) {
      this.cache.clear();
      return;
    }

    for (const cacheKey of this.cache.keys()) {
      if (cacheKey.includes(keyPattern)) {
        this.cache.delete(cacheKey);
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; provider: string }> {
    if (!this.initialized) {
      return { healthy: false, provider: 'not initialized' };
    }

    const healthy = await this.provider!.healthCheck();
    return { healthy, provider: this.provider!.name };
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.provider?.name || 'not initialized';
  }

  /**
   * Get multiple secrets at once
   */
  async getSecrets(keys: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.getSecret(key);
        results.set(key, value);
      })
    );

    return results;
  }

  /**
   * Get a required secret (throws if not found)
   */
  async getRequiredSecret(key: string, options?: { namespace?: string }): Promise<string> {
    const value = await this.getSecret(key, options);
    if (!value) {
      throw new Error(`Required secret '${key}' not found`);
    }
    return value;
  }
}

// Singleton instance
export const secretsManager = new SecretsManager();

// Helper functions for common use cases
export async function getSecret(key: string): Promise<string | null> {
  return secretsManager.getSecret(key);
}

export async function getRequiredSecret(key: string): Promise<string> {
  return secretsManager.getRequiredSecret(key);
}

export async function getDatabaseUrl(): Promise<string> {
  // First check environment variable (for backwards compatibility)
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  return secretsManager.getRequiredSecret('database/url');
}

export async function getSessionSecret(): Promise<string> {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  return secretsManager.getRequiredSecret('session/secret');
}

export async function getStripeSecretKey(): Promise<string> {
  if (process.env.STRIPE_SECRET_KEY) {
    return process.env.STRIPE_SECRET_KEY;
  }
  return secretsManager.getRequiredSecret('stripe/secret_key');
}

export async function getApiCredentials(
  provider: 'salesforce' | 'quickbooks' | 'google' | 'microsoft'
): Promise<{ clientId: string; clientSecret: string }> {
  const [clientId, clientSecret] = await Promise.all([
    secretsManager.getSecret(`${provider}/client_id`) || process.env[`${provider.toUpperCase()}_CLIENT_ID`],
    secretsManager.getSecret(`${provider}/client_secret`) || process.env[`${provider.toUpperCase()}_CLIENT_SECRET`],
  ]);

  if (!clientId || !clientSecret) {
    throw new Error(`Credentials for ${provider} not configured`);
  }

  return { clientId, clientSecret };
}
