// Shared white-label helpers for edge functions (PROD-014).
//
// KEEP IN SYNC with server/services/white-label-service.ts — this is the Deno
// counterpart of the default email templates, the CSS-variable generator and the
// template renderer, following the same duplicate-and-note idiom as
// _shared/print-cost-calculator.ts. The tables are white_label_config,
// white_label_email_templates and white_label_presets (migration 0000).
//
// Rows here are raw PostgREST snake_case. Handlers convert to camelCase on the
// way out, because every consuming page reads camelCase keys.

export interface TemplateVariableDoc {
  name: string;
  description: string;
  example: string;
}

export interface DefaultEmailTemplate {
  template_key: string;
  template_name: string;
  description: string;
  from_name: string;
  subject: string;
  html_body: string;
  text_body: string;
  available_variables: TemplateVariableDoc[];
  is_active: boolean;
  is_default: boolean;
}

/**
 * The five templates seeded when a tenant's config is first created. Mirrors
 * WhiteLabelService.getDefaultTemplates().
 */
export function defaultEmailTemplates(): DefaultEmailTemplate[] {
  return [
    {
      template_key: 'service_request_confirmation',
      template_name: 'Service Request Confirmation',
      description: 'Sent when a customer submits a service request',
      from_name: '{{companyName}} Support',
      subject: 'Service Request Confirmation - #{{requestNumber}}',
      html_body: `
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
      text_body:
        'Service request #{{requestNumber}} confirmed. We will respond within {{responseTime}} hours.',
      available_variables: [
        { name: 'customerName', description: 'Customer name', example: 'John Doe' },
        { name: 'requestNumber', description: 'Service request number', example: 'SR-12345' },
        { name: 'priority', description: 'Request priority', example: 'High' },
        { name: 'equipmentModel', description: 'Equipment model', example: 'Canon imageRUNNER' },
        { name: 'issueDescription', description: 'Issue description', example: 'Paper jam error' },
        { name: 'responseTime', description: 'Expected response time', example: '4' },
      ],
      is_active: true,
      is_default: true,
    },
    {
      template_key: 'invoice_ready',
      template_name: 'Invoice Ready',
      description: 'Sent when a new invoice is ready for payment',
      from_name: '{{companyName}} Billing',
      subject: 'New Invoice from {{companyName}} - Invoice #{{invoiceNumber}}',
      html_body: `
          <h2>New Invoice Available</h2>
          <p>Dear {{customerName}},</p>
          <p>A new invoice is ready for your review and payment.</p>
          <p><strong>Invoice Details:</strong></p>
          <ul>
            <li>Invoice Number: {{invoiceNumber}}</li>
            <li>Invoice Date: {{invoiceDate}}</li>
            <li>Due Date: {{dueDate}}</li>
            <li>Amount Due: \${{amountDue}}</li>
          </ul>
          <p><a href="{{invoiceUrl}}" style="background-color: {{colorPrimary}}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Invoice</a></p>
        `,
      text_body:
        'Invoice #{{invoiceNumber}} is ready. Amount: ${{amountDue}}. Due: {{dueDate}}. View: {{invoiceUrl}}',
      available_variables: [
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
      is_active: true,
      is_default: true,
    },
    {
      template_key: 'supply_low_alert',
      template_name: 'Supply Low Alert',
      description: 'Sent when equipment supply levels are low',
      from_name: '{{companyName}} Alerts',
      subject: 'Supply Alert: {{supplyType}} Running Low - {{equipmentModel}}',
      html_body: `
          <h2>Supply Level Alert</h2>
          <p>Dear {{customerName}},</p>
          <p>We've detected low supply levels on your equipment:</p>
          <p><strong>Equipment:</strong> {{equipmentModel}} ({{serialNumber}})</p>
          <p><strong>Low Supply:</strong> {{supplyType}} - {{currentLevel}}% remaining</p>
          <p>Would you like to order a replacement?</p>
          <p><a href="{{orderUrl}}" style="background-color: {{colorPrimary}}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Order Now</a></p>
        `,
      text_body:
        '{{supplyType}} low on {{equipmentModel}} ({{currentLevel}}%). Order: {{orderUrl}}',
      available_variables: [
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
      is_active: true,
      is_default: true,
    },
    {
      template_key: 'welcome_email',
      template_name: 'Welcome Email',
      description: 'Sent when a new customer portal account is activated',
      from_name: '{{companyName}}',
      subject: 'Welcome to {{companyName}} Customer Portal',
      html_body: `
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
      text_body:
        'Welcome to {{companyName}} portal! Access: {{portalUrl}}. Support: {{supportEmail}}',
      available_variables: [
        { name: 'customerName', description: 'Customer name', example: 'John Doe' },
        {
          name: 'portalUrl',
          description: 'Portal login URL',
          example: 'https://portal.example.com',
        },
        { name: 'supportEmail', description: 'Support email', example: 'support@example.com' },
        { name: 'supportPhone', description: 'Support phone', example: '(555) 123-4567' },
      ],
      is_active: true,
      is_default: true,
    },
    {
      template_key: 'maintenance_reminder',
      template_name: 'Maintenance Reminder',
      description: 'Sent as a reminder for upcoming scheduled maintenance',
      from_name: '{{companyName}} Service',
      subject: 'Maintenance Reminder - {{equipmentModel}} on {{scheduledDate}}',
      html_body: `
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
      text_body:
        'Maintenance scheduled for {{scheduledDate}} at {{scheduledTime}}. Reschedule: {{rescheduleUrl}}',
      available_variables: [
        { name: 'customerName', description: 'Customer name', example: 'John Doe' },
        { name: 'equipmentModel', description: 'Equipment model', example: 'Canon imageRUNNER' },
        { name: 'scheduledDate', description: 'Scheduled date', example: 'Jan 20, 2024' },
        { name: 'scheduledTime', description: 'Scheduled time', example: '2:00 PM' },
        { name: 'technicianName', description: 'Technician name', example: 'Mike Johnson' },
        { name: 'serviceType', description: 'Type of service', example: 'Preventive Maintenance' },
        {
          name: 'rescheduleUrl',
          description: 'Link to reschedule',
          example: 'https://portal.example.com/reschedule/123',
        },
      ],
      is_active: true,
      is_default: true,
    },
  ];
}

type Row = Record<string, any>;

/** Mirrors WhiteLabelService.generateCssVariables(). */
export function generateCssVariables(config: Row): string {
  return `
:root {
  --color-primary: ${config.color_primary};
  --color-secondary: ${config.color_secondary};
  --color-accent: ${config.color_accent};
  --color-success: ${config.color_success};
  --color-warning: ${config.color_warning};
  --color-error: ${config.color_error};
  --color-background: ${config.color_background};
  --color-text: ${config.color_text};
  --font-family: ${config.font_family};
  ${config.font_heading_family ? `--font-heading: ${config.font_heading_family};` : ''}
}

${config.custom_css || ''}
    `.trim();
}

function defaultHeader(config: Row): string {
  return `
<div style="background-color: ${config.color_primary}; padding: 20px; text-align: center;">
  ${
    config.logo_url
      ? `<img src="${config.logo_url}" alt="${config.company_name}" style="max-height: 50px;">`
      : `<h1 style="color: white; margin: 0;">${config.company_name}</h1>`
  }
</div>
    `.trim();
}

function defaultFooter(config: Row, year: number): string {
  return `
<div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
  <p>&copy; ${year} ${config.company_name}. All rights reserved.</p>
  ${config.support_email ? `<p>Questions? Email us at <a href="mailto:${config.support_email}">${config.support_email}</a></p>` : ''}
  ${config.support_phone ? `<p>Call us: ${config.support_phone}</p>` : ''}
</div>
    `.trim();
}

function wrapWithHeaderFooter(body: string, template: Row, config: Row): string {
  const header = template.custom_header || defaultHeader(config);
  const footer = template.custom_footer || defaultFooter(config, new Date().getFullYear());

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: ${config.font_family}; color: ${config.color_text}; background-color: #f5f5f5; margin: 0; padding: 0; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: ${config.color_background}; }
    .email-body { padding: 30px; }
    a { color: ${config.color_primary}; }
  </style>
</head>
<body>
  <div class="email-container">
    ${template.include_header ? header : ''}
    <div class="email-body">
      ${body}
    </div>
    ${template.include_footer ? footer : ''}
  </div>
</body>
</html>
    `.trim();
}

/** Mirrors WhiteLabelService.renderEmailTemplate(). */
export function renderEmailTemplate(
  template: Row,
  variables: Record<string, string>,
  config: Row,
): { subject: string; htmlBody: string; textBody: string } {
  let subject = String(template.subject ?? '');
  let htmlBody = String(template.html_body ?? '');
  let textBody = String(template.text_body ?? '');

  const allVariables: Record<string, string> = {
    ...variables,
    companyName: config.company_name,
    supportEmail: config.support_email || '',
    supportPhone: config.support_phone || '',
    colorPrimary: config.color_primary,
  };

  for (const [key, value] of Object.entries(allVariables)) {
    // Keys come from the template's own variable list and the config, not from
    // arbitrary user input, but escape anyway so a key with regex metacharacters
    // cannot alter the pattern.
    const regex = new RegExp(`{{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}}}`, 'g');
    const replacement = String(value ?? '');
    subject = subject.replace(regex, replacement);
    htmlBody = htmlBody.replace(regex, replacement);
    textBody = textBody.replace(regex, replacement);
  }

  if (template.include_header || template.include_footer) {
    htmlBody = wrapWithHeaderFooter(htmlBody, template, config);
  }

  return { subject, htmlBody, textBody };
}
