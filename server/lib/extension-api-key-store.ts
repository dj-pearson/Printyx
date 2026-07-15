/**
 * Data access for Chrome-extension API keys (PA-044). Thin wrapper over Drizzle;
 * the crypto/validity logic lives in ./extension-api-keys.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { extensionApiKeys, type ExtensionApiKey } from '@shared/extension-api-keys-schema';
import {
  generateExtensionApiKey,
  keyLookupPrefix,
  isApiKeyValid,
  DEFAULT_KEY_TTL_MS,
} from './extension-api-keys';

export interface CreatedKey {
  key: string;
  expiresAt: Date;
  id: string;
}

/** Generate a key, persist only its hash + prefix, and return the plaintext once. */
export async function createExtensionApiKey(
  tenantId: string,
  userId: string,
  opts?: { name?: string; ttlMs?: number; now?: number },
): Promise<CreatedKey> {
  const { key, keyHash, keyPrefix } = generateExtensionApiKey();
  const now = opts?.now ?? Date.now();
  const expiresAt = new Date(now + (opts?.ttlMs ?? DEFAULT_KEY_TTL_MS));
  const [row] = await db
    .insert(extensionApiKeys)
    .values({ tenantId, userId, keyHash, keyPrefix, name: opts?.name ?? null, expiresAt })
    .returning();
  return { key, expiresAt, id: row.id };
}

/**
 * Resolve a plaintext key to its stored record if it is valid (not revoked, not
 * expired, hash matches). Updates last_used_at on success. Returns null otherwise.
 */
export async function verifyExtensionApiKey(key: string): Promise<ExtensionApiKey | null> {
  if (!key || !key.startsWith('pyx_ext_')) return null;
  const prefix = keyLookupPrefix(key);
  const rows = await db
    .select()
    .from(extensionApiKeys)
    .where(eq(extensionApiKeys.keyPrefix, prefix));

  const now = new Date();
  const match = rows.find((r) => isApiKeyValid(key, r, now));
  if (!match) return null;

  await db
    .update(extensionApiKeys)
    .set({ lastUsedAt: now })
    .where(eq(extensionApiKeys.id, match.id));
  return match;
}

/** Revoke a key (soft) by id, scoped to the owning tenant. */
export async function revokeExtensionApiKey(id: string, tenantId: string): Promise<void> {
  await db
    .update(extensionApiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(extensionApiKeys.id, id), eq(extensionApiKeys.tenantId, tenantId)));
}
