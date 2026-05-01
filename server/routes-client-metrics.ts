// Admin endpoints for monitoring clients + enrollment + installer bundle.
//
// IMPORTANT: This module USED to expose duplicate /submit, /heartbeat, and
// /config handlers backed by a different table (`client_registrations`).
// Those handlers were shadowed by the active implementation in
// `routes-client-monitoring.ts` and are intentionally not present here.
// All admin endpoints in this file now operate on `monitoring_clients`,
// the same table the active /submit handler authenticates against.
import express, { type Request, type Response } from 'express';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-client-metrics');

import {
  monitoringClients,
  clientActivityLogs,
  clientEnrollmentTokens,
  clientCommands,
  type MonitoringClient,
} from '@shared/schema';
import { eq, and, desc, gt, isNull, lt, inArray } from 'drizzle-orm';
import { resolveTenant, requireTenant, type TenantRequest } from './middleware/tenancy';
import { enhanceUserContext } from './middleware/rbac-route-helper';
import crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
// `archiver` ships its own d.ts in newer versions; fall back to `any` if
// @types/archiver isn't present in this checkout.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — types are provided by the runtime package or @types/archiver
import archiver from 'archiver';

const router = express.Router();

// All admin endpoints in this file require an authenticated user; tenancy
// middleware enforces tenant scoping. The actual ingest endpoints
// (/submit, /heartbeat, /config) live in routes-client-monitoring.ts and
// authenticate via the per-client API key.
router.use(enhanceUserContext);

// =====================================================
// HELPERS
// =====================================================

const hashApiKey = (key: string) => crypto.createHash('sha256').update(key).digest('hex');

/** Generates a fresh API key + its SHA-256 hash. The plain key is shown once. */
function newApiKeyPair() {
  const plain = `pk_${crypto.randomBytes(32).toString('base64url')}`;
  return { plain, hash: hashApiKey(plain) };
}

/** Build the public-facing client object (never includes the api key hash). */
function publicClient(c: MonitoringClient) {
  const { apiKey, ...rest } = c;
  return rest;
}

/** Map the active /submit endpoint URL given the request, falling back to env. */
function resolvePlatformBaseUrl(req: Request): string {
  // Configured base URL wins — useful when the API is behind a proxy that
  // rewrites Host. Otherwise reflect what the caller used.
  const configured = process.env.PUBLIC_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost';
  return `${proto}://${host}`;
}

// =====================================================
// 1. ADMIN: list / create / fetch / rotate / delete clients
//    (UI calls these — URLs unchanged from the previous version)
// =====================================================

router.post('/clients', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { clientName, location, customerId, networkRanges, autoOrderEnabled } = req.body || {};
    if (!clientName) return res.status(400).json({ message: 'clientName is required' });

    const clientShortId = `client-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const { plain, hash } = newApiKeyPair();

    const [created] = await db
      .insert(monitoringClients)
      .values({
        tenantId,
        clientId: clientShortId,
        clientName,
        location,
        apiKey: hash,
        apiKeyLastRotated: new Date(),
        status: 'pending_setup',
        networkRanges: Array.isArray(networkRanges) ? networkRanges : undefined,
        customerId: customerId || null,
        configuration: {
          pollingInterval: 300,
          discoveryEnabled: true,
          retryAttempts: 3,
          timeout: 10000,
          tonerThreshold: 15,
          paperThreshold: 20,
          // Off by default — opt in deliberately. When true, the alert
          // materialiser will fire device_supply_orders rows on critical
          // alerts; operators see them under Supply Orders.
          autoOrderEnabled: autoOrderEnabled === true,
        },
      })
      .returning();

    await db.insert(clientActivityLogs).values({
      tenantId,
      clientId: created.id,
      activity: 'config_update',
      status: 'success',
      message: `Client '${clientName}' registered`,
      details: { action: 'client_registered', by: req.user?.id },
    });

    res.status(201).json({
      message: 'Client registered successfully',
      client: {
        ...publicClient(created),
        // Surfaced once at creation — never returned again.
        plainApiKey: plain,
      },
    });
  } catch (error) {
    log.error('Error registering client:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/clients', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const clients = await db.query.monitoringClients.findMany({
      where: eq(monitoringClients.tenantId, tenantId),
      orderBy: [desc(monitoringClients.createdAt)],
    });
    res.json({ clients: clients.map(publicClient) });
  } catch (error) {
    log.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/clients/:clientId', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const client = await loadClientForTenant(req.params.clientId, tenantId);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const activity = await db.query.clientActivityLogs.findMany({
      where: and(
        eq(clientActivityLogs.tenantId, tenantId),
        eq(clientActivityLogs.clientId, client.id),
      ),
      orderBy: [desc(clientActivityLogs.timestamp)],
      limit: 100,
    });

    res.json({ client: publicClient(client), activity });
  } catch (error) {
    log.error('Error fetching client details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post(
  '/clients/:clientId/regenerate-key',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const client = await loadClientForTenant(req.params.clientId, tenantId);
      if (!client) return res.status(404).json({ message: 'Client not found' });

      const { plain, hash } = newApiKeyPair();
      await db
        .update(monitoringClients)
        .set({ apiKey: hash, apiKeyLastRotated: new Date(), updatedAt: new Date() })
        .where(eq(monitoringClients.id, client.id));

      await db.insert(clientActivityLogs).values({
        tenantId,
        clientId: client.id,
        activity: 'config_update',
        status: 'warning',
        message: 'API key rotated',
        details: { by: req.user?.id },
      });

      res.json({ message: 'API key regenerated successfully', apiKey: plain });
    } catch (error) {
      log.error('Error regenerating API key:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

router.patch(
  '/clients/:clientId',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const client = await loadClientForTenant(req.params.clientId, tenantId);
      if (!client) return res.status(404).json({ message: 'Client not found' });

      const { customerId, autoOrderEnabled, location, clientName } = req.body || {};
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (typeof customerId === 'string' || customerId === null) {
        updates.customerId = customerId || null;
      }
      if (typeof location === 'string') updates.location = location;
      if (typeof clientName === 'string' && clientName.trim())
        updates.clientName = clientName.trim();

      // autoOrderEnabled lives in the JSON config blob — read-modify-write.
      if (typeof autoOrderEnabled === 'boolean') {
        const cfg = (client.configuration as any) || {};
        updates.configuration = { ...cfg, autoOrderEnabled };
      }

      await db.update(monitoringClients).set(updates).where(eq(monitoringClients.id, client.id));

      const refreshed = await db.query.monitoringClients.findFirst({
        where: eq(monitoringClients.id, client.id),
      });
      res.json({ client: refreshed ? publicClient(refreshed) : null });
    } catch (error) {
      log.error('Error updating client:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

router.delete(
  '/clients/:clientId',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const client = await loadClientForTenant(req.params.clientId, tenantId);
      if (!client) return res.status(404).json({ message: 'Client not found' });

      await db.delete(monitoringClients).where(eq(monitoringClients.id, client.id));
      res.json({ message: 'Client deleted' });
    } catch (error) {
      log.error('Error deleting client:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

// =====================================================
// 1b. REMOTE COMMANDS — enqueue / list / cancel
// =====================================================
//
// Each row in `client_commands` is a one-shot instruction the agent
// will execute on its next heartbeat. The agent acks via
// /api/client-metrics/commands/:id/ack.
//
// Supported commands (validated client-side too):
//   rescan          — agent re-runs network discovery now
//   reload-config   — agent re-fetches /config and applies updates
//   force-submit    — agent collects + submits a metrics cycle now
//   rotate-key      — agent treats this heartbeat as the last one with
//                     the current key and prompts for re-enrollment
//                     (server has not yet rotated the stored hash —
//                     pair with POST /clients/:id/regenerate-key for
//                     the actual rotation).

const SUPPORTED_COMMANDS = new Set(['rescan', 'reload-config', 'force-submit', 'rotate-key']);

const DEFAULT_COMMAND_TTL_MS = 30 * 60 * 1000; // 30 minutes

router.post(
  '/clients/:clientId/commands',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const client = await loadClientForTenant(req.params.clientId, tenantId);
      if (!client) return res.status(404).json({ message: 'Client not found' });

      const { command, payload, ttlSeconds } = req.body || {};
      if (!command || !SUPPORTED_COMMANDS.has(command)) {
        return res.status(400).json({
          message: `Unsupported command. Use one of: ${[...SUPPORTED_COMMANDS].join(', ')}`,
        });
      }

      const ttlMs = Math.min(
        Math.max(Number(ttlSeconds || 0) * 1000 || DEFAULT_COMMAND_TTL_MS, 60_000),
        24 * 60 * 60 * 1000, // hard cap 24h
      );

      const [created] = await db
        .insert(clientCommands)
        .values({
          tenantId,
          clientId: client.id,
          command,
          payload: payload && typeof payload === 'object' ? payload : {},
          status: 'queued',
          issuedByUserId: req.user?.id,
          expiresAt: new Date(Date.now() + ttlMs),
        })
        .returning();

      await db.insert(clientActivityLogs).values({
        tenantId,
        clientId: client.id,
        activity: 'config_update',
        status: 'success',
        message: `Command '${command}' queued`,
        details: { commandId: created.id, by: req.user?.id },
      });

      res.status(201).json({ command: created });
    } catch (error) {
      log.error('Error enqueueing command:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

router.get(
  '/clients/:clientId/commands',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const client = await loadClientForTenant(req.params.clientId, tenantId);
      if (!client) return res.status(404).json({ message: 'Client not found' });

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const rows = await db.query.clientCommands.findMany({
        where: eq(clientCommands.clientId, client.id),
        orderBy: [desc(clientCommands.createdAt)],
        limit,
      });
      res.json({ commands: rows });
    } catch (error) {
      log.error('Error listing commands:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

router.delete(
  '/clients/:clientId/commands/:commandId',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const client = await loadClientForTenant(req.params.clientId, tenantId);
      if (!client) return res.status(404).json({ message: 'Client not found' });

      const cmd = await db.query.clientCommands.findFirst({
        where: and(
          eq(clientCommands.id, req.params.commandId),
          eq(clientCommands.clientId, client.id),
        ),
      });
      if (!cmd) return res.status(404).json({ message: 'Command not found' });
      if (!['queued', 'dispatched'].includes(cmd.status)) {
        return res
          .status(409)
          .json({ message: `Command is already ${cmd.status} — nothing to cancel` });
      }
      await db
        .update(clientCommands)
        .set({ status: 'expired', completedAt: new Date() })
        .where(eq(clientCommands.id, cmd.id));
      res.json({ message: 'Command cancelled' });
    } catch (error) {
      log.error('Error cancelling command:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

// =====================================================
// 2. ENROLLMENT: admin generates a token, installer redeems it.
// =====================================================

const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * POST /api/client-metrics/clients/:clientId/enrollment-token
 *
 * Admin endpoint. Returns a one-time token (and a copy-paste install
 * command) that the installer can exchange for the client's API key.
 */
router.post(
  '/clients/:clientId/enrollment-token',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const client = await loadClientForTenant(req.params.clientId, tenantId);
      if (!client) return res.status(404).json({ message: 'Client not found' });

      const ttlMs = Math.min(
        Math.max(Number(req.body?.ttlSeconds || 0) * 1000 || DEFAULT_TOKEN_TTL_MS, 60_000),
        7 * 24 * 60 * 60 * 1000, // hard cap 7d
      );

      const plain = `et_${crypto.randomBytes(32).toString('base64url')}`;
      const tokenHash = hashApiKey(plain);
      const expiresAt = new Date(Date.now() + ttlMs);

      await db.insert(clientEnrollmentTokens).values({
        tenantId,
        clientId: client.id,
        tokenHash,
        createdByUserId: req.user?.id,
        expiresAt,
      });

      const baseUrl = resolvePlatformBaseUrl(req);
      const installCommand =
        `iwr -UseBasicParsing ${baseUrl}/install/printyx-client.ps1 -OutFile $env:TEMP\\printyx-install.ps1; ` +
        `& $env:TEMP\\printyx-install.ps1 -EnrollmentToken '${plain}' -Endpoint '${baseUrl}'`;

      res.status(201).json({
        token: plain,
        expiresAt: expiresAt.toISOString(),
        endpoint: baseUrl,
        clientId: client.clientId,
        installCommand,
      });
    } catch (error) {
      log.error('Error creating enrollment token:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

/**
 * POST /api/client-metrics/enroll
 *
 * No-auth endpoint (the token IS the auth). Installer body:
 *   { token: "et_...", hostname?: "WINSRV01", clientVersion?: "1.0.0" }
 *
 * Response:
 *   { tenantId, clientId, apiKey, endpoint, configuration }
 */
router.post('/enroll', async (req, res) => {
  try {
    const { token, hostname, clientVersion } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'token is required' });
    }
    const tokenHash = hashApiKey(token);

    const enrollment = await db.query.clientEnrollmentTokens.findFirst({
      where: eq(clientEnrollmentTokens.tokenHash, tokenHash),
    });
    if (!enrollment) return res.status(404).json({ message: 'Invalid enrollment token' });
    if (enrollment.usedAt)
      return res.status(409).json({ message: 'Enrollment token already used' });
    if (enrollment.revokedAt) return res.status(403).json({ message: 'Enrollment token revoked' });
    if (enrollment.expiresAt.getTime() < Date.now()) {
      return res.status(410).json({ message: 'Enrollment token expired' });
    }

    const client = await db.query.monitoringClients.findFirst({
      where: eq(monitoringClients.id, enrollment.clientId),
    });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    // Issue a fresh API key on enrollment so a token leak doesn't reveal a
    // pre-existing key.
    const { plain, hash } = newApiKeyPair();
    await db
      .update(monitoringClients)
      .set({
        apiKey: hash,
        apiKeyLastRotated: new Date(),
        hostname: hostname || client.hostname,
        version: clientVersion || client.version,
        status: 'active',
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(monitoringClients.id, client.id));

    await db
      .update(clientEnrollmentTokens)
      .set({
        usedAt: new Date(),
        usedFromIp: req.ip,
        usedFromHostname: hostname || null,
      })
      .where(eq(clientEnrollmentTokens.id, enrollment.id));

    await db.insert(clientActivityLogs).values({
      tenantId: client.tenantId,
      clientId: client.id,
      activity: 'config_update',
      status: 'success',
      message: 'Client enrolled via one-time token',
      details: { hostname, ip: req.ip },
    });

    res.json({
      tenantId: client.tenantId,
      clientId: client.clientId,
      clientName: client.clientName,
      customerId: client.customerId,
      apiKey: plain,
      endpoint: resolvePlatformBaseUrl(req),
      configuration: client.configuration,
    });
  } catch (error) {
    log.error('Error during enrollment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// 3. INSTALLER BUNDLE
// =====================================================

/**
 * GET /api/client-metrics/clients/:clientId/installer.zip
 *
 * Streams a zip with:
 *   - install-windows.ps1     (the generic installer)
 *   - uninstall-windows.ps1
 *   - bootstrap-config.json   (endpoint + enrollment token, no API key)
 *
 * The bundled config contains a freshly generated enrollment token rather
 * than the API key itself. The installer will redeem that token at install
 * time, so a leaked zip exposes only a short-lived enrollment artifact —
 * not a long-lived credential.
 */
router.get(
  '/clients/:clientId/installer.zip',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const client = await loadClientForTenant(req.params.clientId, tenantId);
      if (!client) return res.status(404).json({ message: 'Client not found' });

      // Issue a fresh enrollment token scoped to this client.
      const plain = `et_${crypto.randomBytes(32).toString('base64url')}`;
      const ttlHours = Math.min(Math.max(Number(req.query.ttlHours || 24), 1), 168);
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
      await db.insert(clientEnrollmentTokens).values({
        tenantId,
        clientId: client.id,
        tokenHash: hashApiKey(plain),
        createdByUserId: req.user?.id,
        expiresAt,
      });

      const installerDir = resolveInstallerDir();
      const installPs1 = path.join(installerDir, 'install-windows.ps1');
      const uninstallPs1 = path.join(installerDir, 'uninstall-windows.ps1');
      if (!fs.existsSync(installPs1)) {
        return res.status(503).json({
          message:
            'Installer scripts not found on the server. Re-deploy the platform with printyx-client/scripts/ included.',
        });
      }

      const bootstrap = {
        endpoint: resolvePlatformBaseUrl(req),
        tenantId,
        clientId: client.clientId,
        clientName: client.clientName,
        customerId: client.customerId,
        enrollmentToken: plain,
        enrollmentExpiresAt: expiresAt.toISOString(),
      };

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="printyx-client-${client.clientId}.zip"`,
      );

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => {
        log.error('Archiver error:', err);
        if (!res.headersSent) res.status(500).end();
      });
      archive.pipe(res);

      archive.file(installPs1, { name: 'install-windows.ps1' });
      if (fs.existsSync(uninstallPs1)) {
        archive.file(uninstallPs1, { name: 'uninstall-windows.ps1' });
      }
      archive.append(JSON.stringify(bootstrap, null, 2), { name: 'bootstrap-config.json' });
      archive.append(README_FOR_BUNDLE, { name: 'README.txt' });

      await archive.finalize();
    } catch (error) {
      log.error('Error generating installer bundle:', error);
      if (!res.headersSent) res.status(500).json({ message: 'Internal server error' });
    }
  },
);

// =====================================================
// HELPERS (shared with the routes above)
// =====================================================

async function loadClientForTenant(idOrSlug: string, tenantId: string) {
  // Accept either the UUID primary key or the human-readable client_id slug.
  const byUuid = await db.query.monitoringClients.findFirst({
    where: and(eq(monitoringClients.id, idOrSlug), eq(monitoringClients.tenantId, tenantId)),
  });
  if (byUuid) return byUuid;
  return db.query.monitoringClients.findFirst({
    where: and(eq(monitoringClients.clientId, idOrSlug), eq(monitoringClients.tenantId, tenantId)),
  });
}

function resolveInstallerDir(): string {
  // The repo layout puts the scripts at <repo-root>/printyx-client/scripts.
  // In a built/deployed image they should be copied to the same relative
  // path next to the server bundle. Allow override via env.
  const envDir = process.env.PRINTYX_CLIENT_SCRIPTS_DIR;
  if (envDir) return envDir;
  return path.resolve(process.cwd(), 'printyx-client', 'scripts');
}

const README_FOR_BUNDLE = `Printyx Monitoring Client — install bundle
================================================

This zip contains everything needed to install the monitoring client on a
Windows Server. Run from an elevated PowerShell:

    Set-ExecutionPolicy -Scope Process Bypass -Force
    .\\install-windows.ps1 -ConfigBundle .\\bootstrap-config.json

The bundled config includes a one-time enrollment token (NOT an API key).
The installer will redeem the token at install time over HTTPS/443 to
receive its permanent API key. The token expires per the timestamp inside
bootstrap-config.json — generate a new bundle from the platform if it
expires before you install.

To uninstall later:

    .\\uninstall-windows.ps1
`;

export default router;
