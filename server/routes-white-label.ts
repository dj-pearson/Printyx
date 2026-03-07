import type { Express } from 'express';
import { db } from './db';
import { whiteLabelService } from './services/white-label-service';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-white-label');

import {
  insertWhiteLabelConfigSchema,
  updateWhiteLabelConfigSchema,
  insertWhiteLabelEmailTemplateSchema,
  updateWhiteLabelEmailTemplateSchema,
} from '@shared/schema';

export function registerWhiteLabelRoutes(app: Express) {
  /**
   * Get white-label configuration for current tenant
   */
  app.get('/api/white-label/config', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const config = await whiteLabelService.getConfig(tenantId);

      if (!config) {
        return res.status(404).json({ error: 'White-label configuration not found' });
      }

      res.json(config);
    } catch (error: any) {
      log.error('Failed to fetch white-label config:', error);
      res.status(500).json({ error: 'Failed to fetch configuration' });
    }
  });

  /**
   * Create or update white-label configuration
   */
  app.put('/api/white-label/config', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      // Validate request body
      const validation = updateWhiteLabelConfigSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid configuration data',
          details: validation.error.errors,
        });
      }

      const config = await whiteLabelService.upsertConfig(tenantId, validation.data);

      res.json({
        success: true,
        message: 'Configuration updated successfully',
        config,
      });
    } catch (error: any) {
      log.error('Failed to update white-label config:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  });

  /**
   * Verify custom domain ownership
   */
  app.post('/api/white-label/verify-domain', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { domain } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      if (!domain) {
        return res.status(400).json({ error: 'Domain required' });
      }

      const verified = await whiteLabelService.verifyCustomDomain(tenantId, domain);

      if (verified) {
        res.json({
          success: true,
          message: 'Domain verified successfully',
          domain,
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Domain verification failed. Please check DNS records.',
        });
      }
    } catch (error: any) {
      log.error('Domain verification failed:', error);
      res.status(500).json({ error: 'Failed to verify domain' });
    }
  });

  /**
   * Get all email templates
   */
  app.get('/api/white-label/email-templates', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const templates = await whiteLabelService.getEmailTemplates(tenantId);

      res.json({
        templates,
        count: templates.length,
      });
    } catch (error: any) {
      log.error('Failed to fetch email templates:', error);
      res.status(500).json({ error: 'Failed to fetch email templates' });
    }
  });

  /**
   * Get a specific email template
   */
  app.get('/api/white-label/email-templates/:templateKey', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { templateKey } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const template = await whiteLabelService.getEmailTemplate(tenantId, templateKey);

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json(template);
    } catch (error: any) {
      log.error('Failed to fetch email template:', error);
      res.status(500).json({ error: 'Failed to fetch email template' });
    }
  });

  /**
   * Create or update an email template
   */
  app.put('/api/white-label/email-templates/:templateKey', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { templateKey } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      // Validate request body
      const validation = updateWhiteLabelEmailTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid template data',
          details: validation.error.errors,
        });
      }

      const template = await whiteLabelService.upsertEmailTemplate(
        tenantId,
        templateKey,
        validation.data,
      );

      res.json({
        success: true,
        message: 'Template updated successfully',
        template,
      });
    } catch (error: any) {
      log.error('Failed to update email template:', error);
      res.status(500).json({ error: 'Failed to update email template' });
    }
  });

  /**
   * Delete an email template
   */
  app.delete('/api/white-label/email-templates/:templateId', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { templateId } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      await whiteLabelService.deleteEmailTemplate(tenantId, templateId);

      res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error: any) {
      log.error('Failed to delete email template:', error);
      res.status(500).json({ error: 'Failed to delete email template' });
    }
  });

  /**
   * Get all available presets
   */
  app.get('/api/white-label/presets', async (req, res) => {
    try {
      const presets = await whiteLabelService.getPresets();

      res.json({
        presets,
        count: presets.length,
      });
    } catch (error: any) {
      log.error('Failed to fetch presets:', error);
      res.status(500).json({ error: 'Failed to fetch presets' });
    }
  });

  /**
   * Apply a preset to tenant configuration
   */
  app.post('/api/white-label/apply-preset/:presetSlug', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { presetSlug } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const config = await whiteLabelService.applyPreset(tenantId, presetSlug);

      res.json({
        success: true,
        message: 'Preset applied successfully',
        config,
      });
    } catch (error: any) {
      log.error('Failed to apply preset:', error);
      res.status(500).json({ error: 'Failed to apply preset' });
    }
  });

  /**
   * Generate CSS variables from configuration
   */
  app.get('/api/white-label/css', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const config = await whiteLabelService.getConfig(tenantId);

      if (!config) {
        return res.status(404).json({ error: 'Configuration not found' });
      }

      const css = whiteLabelService.generateCssVariables(config);

      res.setHeader('Content-Type', 'text/css');
      res.send(css);
    } catch (error: any) {
      log.error('Failed to generate CSS:', error);
      res.status(500).json({ error: 'Failed to generate CSS' });
    }
  });

  /**
   * Preview email template with sample data
   */
  app.post('/api/white-label/email-templates/:templateKey/preview', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { templateKey } = req.params;
      const { variables } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const config = await whiteLabelService.getConfig(tenantId);
      const template = await whiteLabelService.getEmailTemplate(tenantId, templateKey);

      if (!config || !template) {
        return res.status(404).json({ error: 'Configuration or template not found' });
      }

      const rendered = whiteLabelService.renderEmailTemplate(template, variables || {}, config);

      res.json({
        success: true,
        preview: rendered,
      });
    } catch (error: any) {
      log.error('Failed to preview email template:', error);
      res.status(500).json({ error: 'Failed to preview email template' });
    }
  });

  /**
   * Get white-label configuration by custom domain (for customer portal)
   */
  app.get('/api/white-label/config-by-domain/:domain', async (req, res) => {
    try {
      const { domain } = req.params;

      // Find config by custom domain
      const config = await db.query.whiteLabelConfig.findFirst({
        where: (whiteLabelConfig, { eq, and }) =>
          and(
            eq(whiteLabelConfig.customDomain, domain),
            eq(whiteLabelConfig.customDomainVerified, true),
            eq(whiteLabelConfig.isActive, true),
          ),
      });

      if (!config) {
        return res.status(404).json({ error: 'Configuration not found for this domain' });
      }

      // Return only public-facing configuration (exclude sensitive data)
      res.json({
        companyName: config.companyName,
        companyTagline: config.companyTagline,
        logoUrl: config.logoUrl,
        logoSquareUrl: config.logoSquareUrl,
        faviconUrl: config.faviconUrl,
        colorPrimary: config.colorPrimary,
        colorSecondary: config.colorSecondary,
        colorAccent: config.colorAccent,
        colorSuccess: config.colorSuccess,
        colorWarning: config.colorWarning,
        colorError: config.colorError,
        colorBackground: config.colorBackground,
        colorText: config.colorText,
        fontFamily: config.fontFamily,
        fontHeadingFamily: config.fontHeadingFamily,
        welcomeTitle: config.welcomeTitle,
        welcomeMessage: config.welcomeMessage,
        welcomeBannerUrl: config.welcomeBannerUrl,
        supportEmail: config.supportEmail,
        supportPhone: config.supportPhone,
        supportHoursText: config.supportHoursText,
        socialLinks: config.socialLinks,
        features: config.features,
      });
    } catch (error: any) {
      log.error('Failed to fetch config by domain:', error);
      res.status(500).json({ error: 'Failed to fetch configuration' });
    }
  });
}
