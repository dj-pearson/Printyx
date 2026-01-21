import { db } from '../db';
import {
  whiteLabelConfig,
  whiteLabelEmailTemplates,
  whiteLabelPresets,
  EMAIL_TEMPLATE_TYPES,
  type InsertWhiteLabelConfig,
  type UpdateWhiteLabelConfig,
  type InsertWhiteLabelEmailTemplate,
  type UpdateWhiteLabelEmailTemplate,
  type WhiteLabelConfig,
  type WhiteLabelEmailTemplate,
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export class WhiteLabelService {
  /**
   * Get white-label configuration for a tenant
   */
  async getConfig(tenantId: string): Promise<WhiteLabelConfig | null> {
    const config = await db.query.whiteLabelConfig.findFirst({
      where: eq(whiteLabelConfig.tenantId, tenantId),
    });

    return config || null;
  }

  /**
   * Create or update white-label configuration
   */
  async upsertConfig(
    tenantId: string,
    data: InsertWhiteLabelConfig | UpdateWhiteLabelConfig,
  ): Promise<WhiteLabelConfig> {
    const existing = await this.getConfig(tenantId);

    if (existing) {
      // Update existing config
      const [updated] = await db
        .update(whiteLabelConfig)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(whiteLabelConfig.tenantId, tenantId))
        .returning();

      return updated;
    } else {
      // Create new config
      const [created] = await db
        .insert(whiteLabelConfig)
        .values({
          ...data,
          tenantId,
        } as InsertWhiteLabelConfig)
        .returning();

      // Initialize default email templates for new config
      await this.initializeDefaultEmailTemplates(tenantId);

      return created;
    }
  }

  /**
   * Verify custom domain ownership
   */
  async verifyCustomDomain(tenantId: string, domain: string): Promise<boolean> {
    // In production, this would verify DNS records (TXT record or CNAME)
    // For now, we'll just mark it as verified
    // TODO: Implement actual DNS verification via DNS lookup

    await db
      .update(whiteLabelConfig)
      .set({
        customDomainVerified: true,
        customDomainVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(whiteLabelConfig.tenantId, tenantId), eq(whiteLabelConfig.customDomain, domain)),
      );

    return true;
  }

  /**
   * Get all email templates for a tenant
   */
  async getEmailTemplates(tenantId: string): Promise<WhiteLabelEmailTemplate[]> {
    return await db.query.whiteLabelEmailTemplates.findMany({
      where: eq(whiteLabelEmailTemplates.tenantId, tenantId),
      orderBy: [whiteLabelEmailTemplates.templateKey],
    });
  }

  /**
   * Get a specific email template
   */
  async getEmailTemplate(
    tenantId: string,
    templateKey: string,
  ): Promise<WhiteLabelEmailTemplate | null> {
    const template = await db.query.whiteLabelEmailTemplates.findFirst({
      where: and(
        eq(whiteLabelEmailTemplates.tenantId, tenantId),
        eq(whiteLabelEmailTemplates.templateKey, templateKey),
        eq(whiteLabelEmailTemplates.isActive, true),
      ),
    });

    return template || null;
  }

  /**
   * Create or update an email template
   */
  async upsertEmailTemplate(
    tenantId: string,
    templateKey: string,
    data: InsertWhiteLabelEmailTemplate | UpdateWhiteLabelEmailTemplate,
  ): Promise<WhiteLabelEmailTemplate> {
    const existing = await db.query.whiteLabelEmailTemplates.findFirst({
      where: and(
        eq(whiteLabelEmailTemplates.tenantId, tenantId),
        eq(whiteLabelEmailTemplates.templateKey, templateKey),
      ),
    });

    if (existing) {
      // Update existing template
      const [updated] = await db
        .update(whiteLabelEmailTemplates)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(whiteLabelEmailTemplates.tenantId, tenantId),
            eq(whiteLabelEmailTemplates.templateKey, templateKey),
          ),
        )
        .returning();

      return updated;
    } else {
      // Create new template
      const [created] = await db
        .insert(whiteLabelEmailTemplates)
        .values({
          ...data,
          tenantId,
          templateKey,
        } as InsertWhiteLabelEmailTemplate)
        .returning();

      return created;
    }
  }

  /**
   * Delete an email template
   */
  async deleteEmailTemplate(tenantId: string, templateId: string): Promise<boolean> {
    const result = await db
      .delete(whiteLabelEmailTemplates)
      .where(
        and(
          eq(whiteLabelEmailTemplates.id, templateId),
          eq(whiteLabelEmailTemplates.tenantId, tenantId),
        ),
      );

    return true;
  }

  /**
   * Initialize default email templates for a new tenant
   */
  private async initializeDefaultEmailTemplates(tenantId: string): Promise<void> {
    const defaultTemplates = this.getDefaultTemplates(tenantId);

    for (const template of defaultTemplates) {
      await db.insert(whiteLabelEmailTemplates).values(template);
    }
  }

  /**
   * Get default email template definitions
   */
  private getDefaultTemplates(tenantId: string): InsertWhiteLabelEmailTemplate[] {
    return [
      // Service Request Confirmation
      {
        tenantId,
        templateKey: EMAIL_TEMPLATE_TYPES.SERVICE_REQUEST_CONFIRMATION,
        templateName: 'Service Request Confirmation',
        description: 'Sent when a customer submits a service request',
        fromName: '{{companyName}} Support',
        subject: 'Service Request Confirmation - #{{requestNumber}}',
        htmlBody: `
          <h2>Service Request Confirmed</h2>
          <p>Dear {{customerName}},</p>
          <p>We have received your service request and will respond shortly.</p>
          <p><strong>Request Details:</strong></p>
          <ul>
            <li>Request Number: {{requestNumber}}</li>
            <li>Priority: {{priority}}</li>
            <li>Equipment: {{equipmentModel}}</li>
            <li>Issue: {{issueDescription}}</li>
          </ul>
          <p>We'll contact you within {{responseTime}} hours to schedule service.</p>
        `,
        textBody:
          'Service request #{{requestNumber}} confirmed. We will respond within {{responseTime}} hours.',
        availableVariables: [
          { name: 'customerName', description: 'Customer name', example: 'John Doe' },
          { name: 'requestNumber', description: 'Service request number', example: 'SR-12345' },
          { name: 'priority', description: 'Request priority', example: 'High' },
          { name: 'equipmentModel', description: 'Equipment model', example: 'Canon imageRUNNER' },
          {
            name: 'issueDescription',
            description: 'Issue description',
            example: 'Paper jam error',
          },
          { name: 'responseTime', description: 'Expected response time', example: '4' },
        ],
        isActive: true,
        isDefault: true,
      },

      // Invoice Ready
      {
        tenantId,
        templateKey: EMAIL_TEMPLATE_TYPES.INVOICE_READY,
        templateName: 'Invoice Ready',
        description: 'Sent when a new invoice is ready for payment',
        fromName: '{{companyName}} Billing',
        subject: 'New Invoice from {{companyName}} - Invoice #{{invoiceNumber}}',
        htmlBody: `
          <h2>New Invoice Available</h2>
          <p>Dear {{customerName}},</p>
          <p>A new invoice is ready for your review and payment.</p>
          <p><strong>Invoice Details:</strong></p>
          <ul>
            <li>Invoice Number: {{invoiceNumber}}</li>
            <li>Invoice Date: {{invoiceDate}}</li>
            <li>Due Date: {{dueDate}}</li>
            <li>Amount Due: ${{ amountDue }}</li>
          </ul>
          <p><a href="{{invoiceUrl}}" style="background-color: {{colorPrimary}}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Invoice</a></p>
        `,
        textBody:
          'Invoice #{{invoiceNumber}} is ready. Amount: ${{amountDue}}. Due: {{dueDate}}. View: {{invoiceUrl}}',
        availableVariables: [
          { name: 'customerName', description: 'Customer name', example: 'John Doe' },
          { name: 'invoiceNumber', description: 'Invoice number', example: 'INV-2024-001' },
          { name: 'invoiceDate', description: 'Invoice date', example: 'Jan 15, 2024' },
          { name: 'dueDate', description: 'Payment due date', example: 'Feb 15, 2024' },
          { name: 'amountDue', description: 'Amount due', example: '1,250.00' },
          {
            name: 'invoiceUrl',
            description: 'Link to view invoice',
            example: 'https://portal.example.com/invoices/123',
          },
        ],
        isActive: true,
        isDefault: true,
      },

      // Supply Low Alert
      {
        tenantId,
        templateKey: EMAIL_TEMPLATE_TYPES.SUPPLY_LOW_ALERT,
        templateName: 'Supply Low Alert',
        description: 'Sent when equipment supply levels are low',
        fromName: '{{companyName}} Alerts',
        subject: 'Supply Alert: {{supplyType}} Running Low - {{equipmentModel}}',
        htmlBody: `
          <h2>Supply Level Alert</h2>
          <p>Dear {{customerName}},</p>
          <p>We've detected low supply levels on your equipment:</p>
          <p><strong>Equipment:</strong> {{equipmentModel}} ({{serialNumber}})</p>
          <p><strong>Low Supply:</strong> {{supplyType}} - {{currentLevel}}% remaining</p>
          <p>Would you like to order a replacement?</p>
          <p><a href="{{orderUrl}}" style="background-color: {{colorPrimary}}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Order Now</a></p>
        `,
        textBody:
          '{{supplyType}} low on {{equipmentModel}} ({{currentLevel}}%). Order: {{orderUrl}}',
        availableVariables: [
          { name: 'customerName', description: 'Customer name', example: 'John Doe' },
          { name: 'equipmentModel', description: 'Equipment model', example: 'Canon imageRUNNER' },
          { name: 'serialNumber', description: 'Equipment serial number', example: 'ABC123456' },
          { name: 'supplyType', description: 'Supply type', example: 'Black Toner' },
          { name: 'currentLevel', description: 'Current supply level %', example: '12' },
          {
            name: 'orderUrl',
            description: 'Link to order supplies',
            example: 'https://portal.example.com/supplies/order',
          },
        ],
        isActive: true,
        isDefault: true,
      },

      // Welcome Email
      {
        tenantId,
        templateKey: EMAIL_TEMPLATE_TYPES.WELCOME_EMAIL,
        templateName: 'Welcome Email',
        description: 'Sent when a new customer portal account is activated',
        fromName: '{{companyName}}',
        subject: 'Welcome to {{companyName}} Customer Portal',
        htmlBody: `
          <h2>Welcome to Your Portal!</h2>
          <p>Dear {{customerName}},</p>
          <p>Your {{companyName}} customer portal account is now active!</p>
          <p><strong>What you can do:</strong></p>
          <ul>
            <li>Submit service requests 24/7</li>
            <li>View and pay invoices</li>
            <li>Monitor equipment health</li>
            <li>Order supplies</li>
            <li>View service history</li>
          </ul>
          <p><a href="{{portalUrl}}" style="background-color: {{colorPrimary}}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Access Your Portal</a></p>
          <p>Need help? Contact us at {{supportEmail}} or {{supportPhone}}</p>
        `,
        textBody:
          'Welcome to {{companyName}} portal! Access: {{portalUrl}}. Support: {{supportEmail}}',
        availableVariables: [
          { name: 'customerName', description: 'Customer name', example: 'John Doe' },
          {
            name: 'portalUrl',
            description: 'Portal login URL',
            example: 'https://portal.example.com',
          },
          { name: 'supportEmail', description: 'Support email', example: 'support@example.com' },
          { name: 'supportPhone', description: 'Support phone', example: '(555) 123-4567' },
        ],
        isActive: true,
        isDefault: true,
      },

      // Maintenance Reminder
      {
        tenantId,
        templateKey: EMAIL_TEMPLATE_TYPES.MAINTENANCE_REMINDER,
        templateName: 'Maintenance Reminder',
        description: 'Sent as a reminder for upcoming scheduled maintenance',
        fromName: '{{companyName}} Service',
        subject: 'Maintenance Reminder - {{equipmentModel}} on {{scheduledDate}}',
        htmlBody: `
          <h2>Upcoming Maintenance Reminder</h2>
          <p>Dear {{customerName}},</p>
          <p>This is a reminder of your scheduled maintenance:</p>
          <p><strong>Details:</strong></p>
          <ul>
            <li>Equipment: {{equipmentModel}}</li>
            <li>Date: {{scheduledDate}}</li>
            <li>Time: {{scheduledTime}}</li>
            <li>Technician: {{technicianName}}</li>
            <li>Service Type: {{serviceType}}</li>
          </ul>
          <p>Please ensure someone is available to provide access to the equipment.</p>
          <p>Need to reschedule? <a href="{{rescheduleUrl}}">Click here</a></p>
        `,
        textBody:
          'Maintenance scheduled for {{scheduledDate}} at {{scheduledTime}}. Reschedule: {{rescheduleUrl}}',
        availableVariables: [
          { name: 'customerName', description: 'Customer name', example: 'John Doe' },
          { name: 'equipmentModel', description: 'Equipment model', example: 'Canon imageRUNNER' },
          { name: 'scheduledDate', description: 'Scheduled date', example: 'Jan 20, 2024' },
          { name: 'scheduledTime', description: 'Scheduled time', example: '2:00 PM' },
          { name: 'technicianName', description: 'Technician name', example: 'Mike Johnson' },
          {
            name: 'serviceType',
            description: 'Type of service',
            example: 'Preventive Maintenance',
          },
          {
            name: 'rescheduleUrl',
            description: 'Link to reschedule',
            example: 'https://portal.example.com/reschedule/123',
          },
        ],
        isActive: true,
        isDefault: true,
      },
    ];
  }

  /**
   * Get all available presets
   */
  async getPresets(): Promise<any[]> {
    return await db.query.whiteLabelPresets.findMany({
      where: eq(whiteLabelPresets.isPublic, true),
      orderBy: [whiteLabelPresets.usageCount],
    });
  }

  /**
   * Apply a preset to a tenant's configuration
   */
  async applyPreset(tenantId: string, presetSlug: string): Promise<WhiteLabelConfig> {
    const preset = await db.query.whiteLabelPresets.findFirst({
      where: eq(whiteLabelPresets.presetSlug, presetSlug),
    });

    if (!preset) {
      throw new Error(`Preset not found: ${presetSlug}`);
    }

    // Apply preset colors and fonts to config
    const config = await this.upsertConfig(tenantId, {
      colorPrimary: preset.config.colorPrimary,
      colorSecondary: preset.config.colorSecondary,
      colorAccent: preset.config.colorAccent,
      fontFamily: preset.config.fontFamily,
      fontHeadingFamily: preset.config.fontHeadingFamily,
    } as UpdateWhiteLabelConfig);

    // Increment usage count
    await db
      .update(whiteLabelPresets)
      .set({
        usageCount: String(parseInt(preset.usageCount) + 1),
      })
      .where(eq(whiteLabelPresets.id, preset.id));

    return config;
  }

  /**
   * Generate CSS variables from white-label config
   */
  generateCssVariables(config: WhiteLabelConfig): string {
    return `
:root {
  --color-primary: ${config.colorPrimary};
  --color-secondary: ${config.colorSecondary};
  --color-accent: ${config.colorAccent};
  --color-success: ${config.colorSuccess};
  --color-warning: ${config.colorWarning};
  --color-error: ${config.colorError};
  --color-background: ${config.colorBackground};
  --color-text: ${config.colorText};
  --font-family: ${config.fontFamily};
  ${config.fontHeadingFamily ? `--font-heading: ${config.fontHeadingFamily};` : ''}
}

${config.customCss || ''}
    `.trim();
  }

  /**
   * Render email template with variables
   */
  renderEmailTemplate(
    template: WhiteLabelEmailTemplate,
    variables: Record<string, string>,
    config: WhiteLabelConfig,
  ): { subject: string; htmlBody: string; textBody: string } {
    let subject = template.subject;
    let htmlBody = template.htmlBody;
    let textBody = template.textBody || '';

    // Replace all variables
    const allVariables = {
      ...variables,
      companyName: config.companyName,
      supportEmail: config.supportEmail || '',
      supportPhone: config.supportPhone || '',
      colorPrimary: config.colorPrimary,
    };

    for (const [key, value] of Object.entries(allVariables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      htmlBody = htmlBody.replace(regex, value);
      textBody = textBody.replace(regex, value);
    }

    // Wrap HTML with header/footer if enabled
    if (template.includeHeader || template.includeFooter) {
      htmlBody = this.wrapEmailWithHeaderFooter(htmlBody, template, config);
    }

    return { subject, htmlBody, textBody };
  }

  /**
   * Wrap email body with branded header and footer
   */
  private wrapEmailWithHeaderFooter(
    body: string,
    template: WhiteLabelEmailTemplate,
    config: WhiteLabelConfig,
  ): string {
    const header = template.customHeader || this.generateDefaultHeader(config);
    const footer = template.customFooter || this.generateDefaultFooter(config);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: ${config.fontFamily}; color: ${config.colorText}; background-color: #f5f5f5; margin: 0; padding: 0; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: ${config.colorBackground}; }
    .email-body { padding: 30px; }
    a { color: ${config.colorPrimary}; }
  </style>
</head>
<body>
  <div class="email-container">
    ${template.includeHeader ? header : ''}
    <div class="email-body">
      ${body}
    </div>
    ${template.includeFooter ? footer : ''}
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate default email header
   */
  private generateDefaultHeader(config: WhiteLabelConfig): string {
    return `
<div style="background-color: ${config.colorPrimary}; padding: 20px; text-align: center;">
  ${config.logoUrl ? `<img src="${config.logoUrl}" alt="${config.companyName}" style="max-height: 50px;">` : `<h1 style="color: white; margin: 0;">${config.companyName}</h1>`}
</div>
    `.trim();
  }

  /**
   * Generate default email footer
   */
  private generateDefaultFooter(config: WhiteLabelConfig): string {
    const year = new Date().getFullYear();
    return `
<div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
  <p>&copy; ${year} ${config.companyName}. All rights reserved.</p>
  ${config.supportEmail ? `<p>Questions? Email us at <a href="mailto:${config.supportEmail}">${config.supportEmail}</a></p>` : ''}
  ${config.supportPhone ? `<p>Call us: ${config.supportPhone}</p>` : ''}
</div>
    `.trim();
  }
}

// Export singleton
export const whiteLabelService = new WhiteLabelService();
