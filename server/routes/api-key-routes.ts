/**
 * API Key Management Routes
 *
 * REST API endpoints for managing API keys.
 * Mounted at /api/api-keys behind requireAuth (see routes-registry.ts).
 */

import { Router, Request, Response } from 'express';
import { apiKeyService, maskApiKey } from '../services/api-key-service';
import { createApiKeyRequestSchema, updateApiKeyRequestSchema } from '@shared/api-key-schema';
import { getUserId, getTenantId } from '../utils/auth-helpers';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('api-key-routes');

const router = Router();

/**
 * Create a new API key
 * POST /api/api-keys
 *
 * The full key is returned ONCE in this response and never again.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = createApiKeyRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const apiKey = await apiKeyService.createApiKey(tenantId, userId, validation.data);

    res.status(201).json({
      ...apiKey,
      message: 'Save this key securely. It will only be shown once.',
    });
  } catch (error) {
    log.error({ err: error }, 'Error creating API key');
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

/**
 * List API keys
 * GET /api/api-keys
 *
 * Returns key metadata only - the key itself is masked (last 4 chars).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const { status, keyType, limit, offset } = req.query;

    const result = await apiKeyService.listApiKeys(tenantId, {
      status: status as string,
      keyType: keyType as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    // Remove sensitive data from response
    const sanitizedKeys = result.keys.map((key) => ({
      id: key.id,
      name: key.name,
      description: key.description,
      keyType: key.keyType,
      keyPrefix: key.keyPrefix,
      maskedKey: maskApiKey(key.keyLast4),
      status: key.status,
      isActive: key.isActive,
      scopes: key.scopes,
      permissions: key.permissions,
      expiresAt: key.expiresAt,
      neverExpires: key.neverExpires,
      allowedIps: key.allowedIps,
      allowAllIps: key.allowAllIps,
      rateLimitPerMinute: key.rateLimitPerMinute,
      rateLimitPerHour: key.rateLimitPerHour,
      rateLimitPerDay: key.rateLimitPerDay,
      environment: key.environment,
      lastUsedAt: key.lastUsedAt,
      usageCount: key.usageCount,
      tags: key.tags,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }));

    res.json({
      keys: sanitizedKeys,
      total: result.total,
    });
  } catch (error) {
    log.error({ err: error }, 'Error listing API keys');
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

/**
 * Get API key details
 * GET /api/api-keys/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const apiKey = await apiKeyService.getApiKey(id, tenantId);

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Remove sensitive data
    const { keyHash, keySalt, ...safeKey } = apiKey;

    res.json({ ...safeKey, maskedKey: maskApiKey(apiKey.keyLast4) });
  } catch (error) {
    log.error({ err: error }, 'Error getting API key');
    res.status(500).json({ error: 'Failed to get API key' });
  }
});

/**
 * Update API key
 * PATCH /api/api-keys/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { id } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = updateApiKeyRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const apiKey = await apiKeyService.updateApiKey(id, tenantId, userId, validation.data);

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const { keyHash, keySalt, ...safeKey } = apiKey;
    res.json(safeKey);
  } catch (error) {
    log.error({ err: error }, 'Error updating API key');
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

/**
 * Revoke API key (DELETE = immediate revocation)
 * DELETE /api/api-keys/:id
 *
 * Revokes rather than hard-deletes so the audit trail (usage logs,
 * rotation history) is preserved. The key stops working immediately.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { id } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const success = await apiKeyService.revokeApiKey(
      id,
      tenantId,
      userId,
      'Revoked via DELETE /api/api-keys/:id',
    );

    if (!success) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    log.error({ err: error }, 'Error revoking API key');
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

/**
 * Revoke API key (explicit endpoint with reason)
 * POST /api/api-keys/:id/revoke
 */
router.post('/:id/revoke', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { id } = req.params;
    const { reason } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const success = await apiKeyService.revokeApiKey(id, tenantId, userId, reason);

    if (!success) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    log.error({ err: error }, 'Error revoking API key');
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

/**
 * Rotate API key
 * POST /api/api-keys/:id/rotate
 */
router.post('/:id/rotate', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { id } = req.params;
    const { gracePeriodHours, reason } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const newKey = await apiKeyService.rotateApiKey(id, tenantId, userId, {
      gracePeriodHours,
      reason,
    });

    if (!newKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({
      ...newKey,
      message:
        'Key rotated. Save the new key securely. Old key will remain active during grace period.',
    });
  } catch (error) {
    log.error({ err: error }, 'Error rotating API key');
    res.status(500).json({ error: 'Failed to rotate API key' });
  }
});

/**
 * Get API key usage statistics
 * GET /api/api-keys/:id/stats
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const stats = await apiKeyService.getUsageStats(id, tenantId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json(stats);
  } catch (error) {
    log.error({ err: error }, 'Error getting API key stats');
    res.status(500).json({ error: 'Failed to get API key statistics' });
  }
});

/**
 * Validate API key (for testing an integration setup)
 * POST /api/api-keys/validate
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const result = await apiKeyService.validateApiKey(key, req.ip);

    if (!result.valid) {
      return res.status(401).json({
        valid: false,
        error: result.error,
        errorCode: result.errorCode,
      });
    }

    res.json({
      valid: true,
      keyPrefix: result.apiKey!.keyPrefix,
      name: result.apiKey!.name,
      scopes: result.apiKey!.scopes,
    });
  } catch (error) {
    log.error({ err: error }, 'Error validating API key');
    res.status(500).json({ error: 'Failed to validate API key' });
  }
});

export default router;
