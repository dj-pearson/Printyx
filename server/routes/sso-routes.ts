/**
 * SSO/SAML Routes
 *
 * API routes for SSO authentication and management.
 */

import { Router, Request, Response } from 'express';
import { ssoService, SsoCallbackData } from '../services/sso-service';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createProviderSchema = z.object({
  providerType: z.enum(['azure_ad', 'okta', 'google_workspace', 'onelogin', 'ping_identity', 'custom_saml', 'custom_oidc']),
  protocol: z.enum(['saml2', 'oidc']),
  name: z.string().min(1).max(255),
  displayName: z.string().max(255).optional(),
  description: z.string().optional(),

  // SAML config
  samlEntityId: z.string().max(512).optional(),
  samlSsoUrl: z.string().url().optional(),
  samlSloUrl: z.string().url().optional(),
  samlCertificate: z.string().optional(),

  // OIDC config
  oidcClientId: z.string().max(512).optional(),
  oidcClientSecret: z.string().optional(),
  oidcIssuer: z.string().url().optional(),
  oidcScopes: z.string().max(512).optional(),

  // Options
  isPrimary: z.boolean().optional(),
  autoProvisionUsers: z.boolean().optional(),
  autoUpdateUserAttributes: z.boolean().optional(),
  jitProvisioning: z.boolean().optional(),
  defaultRole: z.string().max(100).optional(),
  allowedEmailDomains: z.string().max(1024).optional(),

  // Provider-specific settings
  providerSettings: z.record(z.any()).optional(),
});

const updateProviderSchema = createProviderSchema.partial();

const initiateAuthSchema = z.object({
  providerId: z.string().uuid().optional(),
  redirectUrl: z.string().url(),
  relayState: z.string().optional(),
});

/**
 * List SSO providers for the tenant
 * GET /api/sso/providers
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const providers = await ssoService.listProviders(tenantId);

    // Remove sensitive data
    const sanitizedProviders = providers.map(p => ({
      id: p.id,
      providerType: p.providerType,
      protocol: p.protocol,
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      status: p.status,
      isEnabled: p.isEnabled,
      isPrimary: p.isPrimary,
      lastLoginAt: p.lastLoginAt,
      loginCount: p.loginCount,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.json(sanitizedProviders);
  } catch (error: any) {
    console.error('[SSO Routes] Error listing providers:', error);
    res.status(500).json({ error: 'Failed to list SSO providers' });
  }
});

/**
 * Get SSO provider details
 * GET /api/sso/providers/:id
 */
router.get('/providers/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const providerId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const provider = await ssoService.getProviderConfig(tenantId, providerId);

    if (!provider) {
      return res.status(404).json({ error: 'SSO provider not found' });
    }

    // Remove sensitive data for response
    const { oidcClientSecret, ...safeProvider } = provider;

    res.json({
      ...safeProvider,
      hasClientSecret: !!oidcClientSecret,
    });
  } catch (error: any) {
    console.error('[SSO Routes] Error getting provider:', error);
    res.status(500).json({ error: 'Failed to get SSO provider' });
  }
});

/**
 * Create SSO provider
 * POST /api/sso/providers
 */
router.post('/providers', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).user?.id;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const validation = createProviderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const provider = await ssoService.createProvider({
      ...validation.data,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    // Remove sensitive data
    const { oidcClientSecret, ...safeProvider } = provider;

    res.status(201).json(safeProvider);
  } catch (error: any) {
    console.error('[SSO Routes] Error creating provider:', error);
    res.status(500).json({ error: 'Failed to create SSO provider' });
  }
});

/**
 * Update SSO provider
 * PATCH /api/sso/providers/:id
 */
router.patch('/providers/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).user?.id;
    const providerId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const validation = updateProviderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const provider = await ssoService.updateProvider(providerId, {
      ...validation.data,
      updatedBy: userId,
    });

    if (!provider) {
      return res.status(404).json({ error: 'SSO provider not found' });
    }

    const { oidcClientSecret, ...safeProvider } = provider;
    res.json(safeProvider);
  } catch (error: any) {
    console.error('[SSO Routes] Error updating provider:', error);
    res.status(500).json({ error: 'Failed to update SSO provider' });
  }
});

/**
 * Delete SSO provider
 * DELETE /api/sso/providers/:id
 */
router.delete('/providers/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const providerId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const success = await ssoService.deleteProvider(providerId);

    if (!success) {
      return res.status(404).json({ error: 'SSO provider not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('[SSO Routes] Error deleting provider:', error);
    res.status(500).json({ error: 'Failed to delete SSO provider' });
  }
});

/**
 * Initiate SSO authentication
 * POST /api/sso/auth/initiate
 */
router.post('/auth/initiate', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const validation = initiateAuthSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const authResponse = await ssoService.initiateAuth({
      tenantId,
      providerId: validation.data.providerId || '',
      redirectUrl: validation.data.redirectUrl,
      relayState: validation.data.relayState,
    });

    res.json(authResponse);
  } catch (error: any) {
    console.error('[SSO Routes] Error initiating auth:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate SSO authentication' });
  }
});

/**
 * SSO callback for SAML
 * POST /api/sso/callback/saml/:providerId
 */
router.post('/callback/saml/:providerId', async (req: Request, res: Response) => {
  try {
    const providerId = req.params.providerId;
    const { SAMLResponse, RelayState } = req.body;

    if (!SAMLResponse) {
      return res.status(400).json({ error: 'SAMLResponse is required' });
    }

    const callbackData: SsoCallbackData = {
      requestId: '', // Will be extracted from SAML response
      protocol: 'saml2',
      samlResponse: SAMLResponse,
      relayState: RelayState,
    };

    const result = await ssoService.handleCallback(
      providerId,
      callbackData,
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success) {
      // Redirect to error page
      const errorUrl = new URL('/login', process.env.BASE_URL || 'http://localhost:5000');
      errorUrl.searchParams.set('error', result.error || 'SSO authentication failed');
      return res.redirect(errorUrl.toString());
    }

    // Set session cookie
    if (result.session) {
      (req.session as any).userId = result.user!.id;
      (req.session as any).tenantId = result.user!.tenantId;
      (req.session as any).ssoSessionId = result.session.id;
    }

    // Redirect to the original destination or dashboard
    const redirectUrl = RelayState || '/dashboard';
    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('[SSO Routes] SAML callback error:', error);
    const errorUrl = new URL('/login', process.env.BASE_URL || 'http://localhost:5000');
    errorUrl.searchParams.set('error', 'SSO authentication failed');
    res.redirect(errorUrl.toString());
  }
});

/**
 * SSO callback for OIDC
 * GET /api/sso/callback/oidc/:providerId
 */
router.get('/callback/oidc/:providerId', async (req: Request, res: Response) => {
  try {
    const providerId = req.params.providerId;
    const { code, state, error, error_description } = req.query;

    if (error) {
      const errorUrl = new URL('/login', process.env.BASE_URL || 'http://localhost:5000');
      errorUrl.searchParams.set('error', error_description?.toString() || error.toString());
      return res.redirect(errorUrl.toString());
    }

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Parse state to get relay state
    let relayStateData: any = {};
    let redirectUrl = '/dashboard';

    if (state) {
      try {
        const decoded = Buffer.from(state.toString(), 'base64').toString('utf-8');
        relayStateData = JSON.parse(decoded);
        redirectUrl = relayStateData.redirectUrl || redirectUrl;
      } catch {
        // Invalid state format
      }
    }

    const callbackData: SsoCallbackData = {
      requestId: relayStateData.requestId || '',
      protocol: 'oidc',
      code: code.toString(),
      state: state?.toString(),
    };

    const result = await ssoService.handleCallback(
      providerId,
      callbackData,
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success) {
      const errorUrl = new URL('/login', process.env.BASE_URL || 'http://localhost:5000');
      errorUrl.searchParams.set('error', result.error || 'SSO authentication failed');
      return res.redirect(errorUrl.toString());
    }

    // Set session cookie
    if (result.session) {
      (req.session as any).userId = result.user!.id;
      (req.session as any).tenantId = result.user!.tenantId;
      (req.session as any).ssoSessionId = result.session.id;
    }

    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('[SSO Routes] OIDC callback error:', error);
    const errorUrl = new URL('/login', process.env.BASE_URL || 'http://localhost:5000');
    errorUrl.searchParams.set('error', 'SSO authentication failed');
    res.redirect(errorUrl.toString());
  }
});

/**
 * Get SAML metadata for service provider
 * GET /api/sso/metadata/:providerId
 */
router.get('/metadata/:providerId', async (req: Request, res: Response) => {
  try {
    const providerId = req.params.providerId;
    const metadata = await ssoService.generateSpMetadata(providerId);

    res.type('application/xml');
    res.send(metadata);
  } catch (error: any) {
    console.error('[SSO Routes] Error generating metadata:', error);
    res.status(500).json({ error: 'Failed to generate SAML metadata' });
  }
});

/**
 * SSO logout
 * POST /api/sso/logout
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const ssoSessionId = (req.session as any).ssoSessionId;

    if (ssoSessionId) {
      const result = await ssoService.handleLogout(ssoSessionId, 'user');

      // Clear local session
      req.session.destroy(() => {});

      if (result.redirectUrl) {
        return res.json({ redirectUrl: result.redirectUrl });
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[SSO Routes] Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

/**
 * Validate SSO session
 * GET /api/sso/session/validate
 */
router.get('/session/validate', async (req: Request, res: Response) => {
  try {
    const ssoSessionId = (req.session as any).ssoSessionId;

    if (!ssoSessionId) {
      return res.json({ valid: false });
    }

    const result = await ssoService.validateSession(ssoSessionId);
    res.json(result);
  } catch (error: any) {
    console.error('[SSO Routes] Session validation error:', error);
    res.status(500).json({ error: 'Failed to validate session' });
  }
});

/**
 * SAML Single Logout (SLO) endpoint
 * POST /api/sso/logout/saml/:providerId
 */
router.post('/logout/saml/:providerId', async (req: Request, res: Response) => {
  try {
    const { SAMLRequest, SAMLResponse, RelayState } = req.body;

    // Handle IdP-initiated logout
    if (SAMLRequest) {
      // Parse logout request and terminate session
      // In production, validate signature and parse XML properly

      // Clear local session
      const ssoSessionId = (req.session as any).ssoSessionId;
      if (ssoSessionId) {
        await ssoService.handleLogout(ssoSessionId, 'idp');
      }
      req.session.destroy(() => {});

      // TODO: Send LogoutResponse back to IdP
      res.redirect(RelayState || '/login');
    } else if (SAMLResponse) {
      // Handle logout response from IdP
      req.session.destroy(() => {});
      res.redirect(RelayState || '/login');
    } else {
      res.status(400).json({ error: 'Invalid SLO request' });
    }
  } catch (error: any) {
    console.error('[SSO Routes] SLO error:', error);
    res.status(500).json({ error: 'Failed to process single logout' });
  }
});

/**
 * Test SSO provider connection
 * POST /api/sso/providers/:id/test
 */
router.post('/providers/:id/test', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const providerId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const provider = await ssoService.getProviderConfig(tenantId, providerId);

    if (!provider) {
      return res.status(404).json({ error: 'SSO provider not found' });
    }

    // Test based on protocol
    const tests: { name: string; passed: boolean; message: string }[] = [];

    if (provider.protocol === 'saml2') {
      // Test SAML configuration
      tests.push({
        name: 'Entity ID',
        passed: !!provider.samlEntityId,
        message: provider.samlEntityId ? 'Configured' : 'Missing',
      });
      tests.push({
        name: 'SSO URL',
        passed: !!provider.samlSsoUrl,
        message: provider.samlSsoUrl ? 'Configured' : 'Missing',
      });
      tests.push({
        name: 'Certificate',
        passed: !!provider.samlCertificate,
        message: provider.samlCertificate ? 'Configured' : 'Missing',
      });
    } else {
      // Test OIDC configuration
      tests.push({
        name: 'Client ID',
        passed: !!provider.oidcClientId,
        message: provider.oidcClientId ? 'Configured' : 'Missing',
      });
      tests.push({
        name: 'Client Secret',
        passed: !!provider.oidcClientSecret,
        message: provider.oidcClientSecret ? 'Configured' : 'Missing',
      });

      // Test OIDC discovery if issuer is set
      if (provider.oidcIssuer) {
        try {
          const discoveryUrl = `${provider.oidcIssuer}/.well-known/openid-configuration`;
          const response = await fetch(discoveryUrl);
          tests.push({
            name: 'OIDC Discovery',
            passed: response.ok,
            message: response.ok ? 'Available' : `Failed: ${response.status}`,
          });
        } catch (error: any) {
          tests.push({
            name: 'OIDC Discovery',
            passed: false,
            message: `Failed: ${error.message}`,
          });
        }
      }
    }

    const allPassed = tests.every(t => t.passed);

    res.json({
      success: allPassed,
      tests,
    });
  } catch (error: any) {
    console.error('[SSO Routes] Test error:', error);
    res.status(500).json({ error: 'Failed to test SSO provider' });
  }
});

/**
 * Import SSO provider from metadata URL
 * POST /api/sso/providers/import
 */
router.post('/providers/import', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).user?.id;
    const { metadataUrl, name, providerType } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    if (!metadataUrl || !name) {
      return res.status(400).json({ error: 'metadataUrl and name are required' });
    }

    // Fetch metadata
    const response = await fetch(metadataUrl);
    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch metadata' });
    }

    const metadataXml = await response.text();

    // Parse metadata (simplified - use proper XML parser in production)
    const entityIdMatch = metadataXml.match(/entityID="([^"]+)"/);
    const ssoUrlMatch = metadataXml.match(/SingleSignOnService[^>]*Location="([^"]+)"/);
    const sloUrlMatch = metadataXml.match(/SingleLogoutService[^>]*Location="([^"]+)"/);
    const certMatch = metadataXml.match(/<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/);

    const provider = await ssoService.createProvider({
      tenantId,
      providerType: providerType || 'custom_saml',
      protocol: 'saml2',
      name,
      samlEntityId: entityIdMatch?.[1],
      samlSsoUrl: ssoUrlMatch?.[1],
      samlSloUrl: sloUrlMatch?.[1],
      samlCertificate: certMatch?.[1]?.replace(/\s/g, ''),
      metadataUrl,
      metadataXml,
      metadataLastFetched: new Date(),
      createdBy: userId,
      updatedBy: userId,
    });

    const { oidcClientSecret, ...safeProvider } = provider;
    res.status(201).json(safeProvider);
  } catch (error: any) {
    console.error('[SSO Routes] Import error:', error);
    res.status(500).json({ error: 'Failed to import SSO provider from metadata' });
  }
});

export default router;
