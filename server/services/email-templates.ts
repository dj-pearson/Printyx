/**
 * EMAIL TEMPLATES
 *
 * HTML email templates for various system emails.
 * All templates use a consistent branded design.
 */

/** Escape user-controlled strings for safe embedding in HTML */
function escapeHtml(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return '';
  const str = String(text);
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

const EMAIL_BASE_STYLES = `
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white !important; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .button:hover { background: #1d4ed8; }
    .code { font-family: monospace; background: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 18px; letter-spacing: 2px; text-align: center; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
  </style>
`;

export interface EmailTemplateData {
  companyName?: string;
  userName?: string;
  userEmail?: string;
  resetLink?: string;
  resetToken?: string;
  trialDays?: number;
  trialEndDate?: string;
  planName?: string;
  amount?: string;
}

export class EmailTemplates {
  private static baseUrl = process.env.PUBLIC_URL || 'http://localhost:5000';

  /**
   * Password Reset Email
   */
  static passwordReset(data: EmailTemplateData): { subject: string; html: string; text: string } {
    const safeToken = encodeURIComponent(data.resetToken || '');
    const resetUrl = `${this.baseUrl}/reset-password?token=${safeToken}`;

    return {
      subject: 'Reset Your Printyx Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          ${EMAIL_BASE_STYLES}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🔐 Password Reset</h1>
            </div>
            <div class="content">
              <p>Hello${data.userName ? ` ${escapeHtml(data.userName)}` : ''},</p>

              <p>We received a request to reset your password for your Printyx account.</p>

              <p style="text-align: center;">
                <a href="${escapeHtml(resetUrl)}" class="button">Reset Password</a>
              </p>

              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #2563eb; font-size: 14px;">${escapeHtml(resetUrl)}</p>

              <div class="warning">
                <strong>Security Notice:</strong>
                <ul style="margin: 8px 0;">
                  <li>This link expires in 1 hour</li>
                  <li>This link can only be used once</li>
                  <li>If you didn't request this, please ignore this email</li>
                </ul>
              </div>

              <p>If you continue to have problems, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>© 2025 Printyx. All rights reserved.</p>
              <p>This email was sent to ${escapeHtml(data.userEmail)}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Password Reset Request

Hello${data.userName ? ` ${data.userName}` : ''},

We received a request to reset your password for your Printyx account.

Please click the link below to reset your password:
${resetUrl}

SECURITY NOTICE:
- This link expires in 1 hour
- This link can only be used once
- If you didn't request this, please ignore this email

If you continue to have problems, please contact our support team.

© 2025 Printyx
This email was sent to ${data.userEmail}
      `.trim(),
    };
  }

  /**
   * Password Changed Confirmation
   */
  static passwordChanged(data: EmailTemplateData): { subject: string; html: string; text: string } {
    return {
      subject: 'Your Printyx Password Has Been Changed',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          ${EMAIL_BASE_STYLES}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">✅ Password Changed</h1>
            </div>
            <div class="content">
              <p>Hello${data.userName ? ` ${escapeHtml(data.userName)}` : ''},</p>

              <p>This email confirms that your Printyx password has been successfully changed.</p>

              <div class="warning">
                <strong>Security Alert:</strong><br>
                If you did not make this change, please contact our support team immediately at <a href="mailto:support@printyx.com">support@printyx.com</a>
              </div>

              <p>Your account security is important to us. We recommend:</p>
              <ul>
                <li>Using a strong, unique password</li>
                <li>Enabling two-factor authentication (if available)</li>
                <li>Never sharing your password with anyone</li>
              </ul>
            </div>
            <div class="footer">
              <p>© 2025 Printyx. All rights reserved.</p>
              <p>This email was sent to ${escapeHtml(data.userEmail)}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Password Changed

Hello${data.userName ? ` ${data.userName}` : ''},

This email confirms that your Printyx password has been successfully changed.

SECURITY ALERT:
If you did not make this change, please contact our support team immediately at support@printyx.com

Your account security is important to us. We recommend:
- Using a strong, unique password
- Enabling two-factor authentication (if available)
- Never sharing your password with anyone

© 2025 Printyx
This email was sent to ${data.userEmail}
      `.trim(),
    };
  }

  /**
   * Email Verification
   */
  static emailVerification(data: EmailTemplateData & { verificationToken: string }): {
    subject: string;
    html: string;
    text: string;
  } {
    const safeVerifyToken = encodeURIComponent(data.verificationToken || '');
    const verifyUrl = `${this.baseUrl}/verify-email?token=${safeVerifyToken}`;

    return {
      subject: 'Verify Your Printyx Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          ${EMAIL_BASE_STYLES}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">📧 Verify Your Email</h1>
            </div>
            <div class="content">
              <p>Hello${data.userName ? ` ${escapeHtml(data.userName)}` : ''},</p>

              <p>Welcome to Printyx! Please verify your email address to activate your account.</p>

              <p style="text-align: center;">
                <a href="${escapeHtml(verifyUrl)}" class="button">Verify Email Address</a>
              </p>

              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #2563eb; font-size: 14px;">${escapeHtml(verifyUrl)}</p>

              <p>This link will expire in 24 hours.</p>
            </div>
            <div class="footer">
              <p>© 2025 Printyx. All rights reserved.</p>
              <p>This email was sent to ${escapeHtml(data.userEmail)}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Verify Your Email

Hello${data.userName ? ` ${data.userName}` : ''},

Welcome to Printyx! Please verify your email address to activate your account.

Click the link below to verify:
${verifyUrl}

This link will expire in 24 hours.

© 2025 Printyx
This email was sent to ${data.userEmail}
      `.trim(),
    };
  }

  /**
   * Welcome Email (after signup)
   */
  static welcome(data: EmailTemplateData): { subject: string; html: string; text: string } {
    const loginUrl = `${this.baseUrl}/login`;

    return {
      subject: 'Welcome to Printyx!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          ${EMAIL_BASE_STYLES}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🎉 Welcome to Printyx!</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(data.userName)},</p>

              <p>Welcome to Printyx - the unified platform for copier dealers! Your account has been created successfully.</p>

              ${
                data.trialDays
                  ? `
                <div style="background: #dbeafe; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                  <h2 style="margin: 0 0 10px 0; color: #1e40af;">Your ${escapeHtml(data.trialDays)}-Day Free Trial Has Started!</h2>
                  <p style="margin: 0; color: #1e3a8a;">No credit card required. Full access to all features.</p>
                </div>
              `
                  : ''
              }

              <h3>What's Next?</h3>
              <ul>
                <li>🏢 Set up your company profile</li>
                <li>👥 Invite your team members</li>
                <li>🎯 Add your first customer or lead</li>
                <li>📊 Explore the dashboard</li>
              </ul>

              <p style="text-align: center;">
                <a href="${loginUrl}" class="button">Get Started</a>
              </p>

              <p>Need help getting started? Check out our <a href="${this.baseUrl}/knowledge-base">Knowledge Base</a> or contact our support team.</p>
            </div>
            <div class="footer">
              <p>© 2025 Printyx. All rights reserved.</p>
              <p>This email was sent to ${escapeHtml(data.userEmail)}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to Printyx!

Hello ${data.userName},

Welcome to Printyx - the unified platform for copier dealers! Your account has been created successfully.

${data.trialDays ? `Your ${data.trialDays}-Day Free Trial Has Started!\nNo credit card required. Full access to all features.\n` : ''}

What's Next?
- Set up your company profile
- Invite your team members
- Add your first customer or lead
- Explore the dashboard

Get started at: ${loginUrl}

Need help? Visit our Knowledge Base or contact support.

© 2025 Printyx
This email was sent to ${data.userEmail}
      `.trim(),
    };
  }

  /**
   * Trial Day 3 - Engagement Check
   */
  static trialDay3(data: EmailTemplateData): { subject: string; html: string; text: string } {
    const dashboardUrl = `${this.baseUrl}/`;
    const helpUrl = `${this.baseUrl}/help`;

    return {
      subject: 'Making the most of your Printyx trial',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          ${EMAIL_BASE_STYLES}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🚀 Getting Started with Printyx</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(data.userName)},</p>

              <p>You're now 3 days into your Printyx trial! Here are some tips to help you get the most out of the platform:</p>

              <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">🎯 Quick Wins</h3>
                <ul style="line-height: 2;">
                  <li><strong>Import your customers</strong> - Bulk import from CSV or integrate with your existing tools</li>
                  <li><strong>Set up service dispatch</strong> - Optimize technician routes and reduce travel time</li>
                  <li><strong>Configure meter billing</strong> - Automate your billing and increase accuracy</li>
                  <li><strong>Connect integrations</strong> - Link QuickBooks, Salesforce, or other tools</li>
                </ul>
              </div>

              <p style="text-align: center;">
                <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
              </p>

              <p><strong>Need help?</strong> Our team is standing by:</p>
              <ul>
                <li>📚 <a href="${helpUrl}">Browse our knowledge base</a></li>
                <li>💬 Reply to this email to talk to our team</li>
              </ul>
            </div>
            <div class="footer">
              <p>© 2025 Printyx. All rights reserved.</p>
              <p>This email was sent to ${escapeHtml(data.userEmail)}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Making the Most of Your Printyx Trial

Hello ${data.userName},

You're now 3 days into your Printyx trial! Here are some tips:

QUICK WINS:
• Import your customers
• Set up service dispatch
• Configure meter billing
• Connect integrations

Go to dashboard: ${dashboardUrl}

Need help? Reply to this email!

© 2025 Printyx
      `.trim(),
    };
  }

  /**
   * Trial Day 7 - Mid-Trial
   */
  static trialDay7(data: EmailTemplateData): { subject: string; html: string; text: string } {
    const dashboardUrl = `${this.baseUrl}/`;

    return {
      subject: "You're halfway through your Printyx trial",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          ${EMAIL_BASE_STYLES}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">⏳ Halfway There!</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(data.userName)},</p>

              <p>You're at the midpoint of your 14-day trial.</p>

              <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">💡 Pro Tips</h3>
                <ul style="line-height: 2;">
                  <li>Set up automated meter billing (saves 10+ hours/month)</li>
                  <li>Use smart dispatch to reduce drive time by 40%</li>
                  <li>Track contract profitability</li>
                </ul>
              </div>

              <p style="text-align: center;">
                <a href="${dashboardUrl}" class="button">Continue Exploring</a>
              </p>

              <p><strong>Have questions?</strong> Reply to this email!</p>
            </div>
            <div class="footer">
              <p>© 2025 Printyx. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Halfway Through Your Trial

Hello ${data.userName},

You're at the midpoint of your 14-day trial.

Pro tips: Set up automated billing, use smart dispatch, track profitability.

Continue exploring: ${dashboardUrl}

© 2025 Printyx
      `.trim(),
    };
  }

  /**
   * Trial Ending Soon
   */
  static trialEndingSoon(data: EmailTemplateData): { subject: string; html: string; text: string } {
    const upgradeUrl = `${this.baseUrl}/settings/subscription`;

    return {
      subject: `Your Printyx Trial Ends ${data.trialEndDate ? `on ${String(data.trialEndDate).replace(/[<>"'&]/g, '')}` : 'Soon'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          ${EMAIL_BASE_STYLES}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">⏰ Trial Ending Soon</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(data.userName)},</p>

              <p>Your Printyx trial is ending soon${data.trialEndDate ? ` on ${escapeHtml(data.trialEndDate)}` : ''}.</p>

              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h2 style="margin: 0 0 10px 0; color: #92400e;">Don't Lose Access!</h2>
                <p style="margin: 0; color: #78350f;">Add a payment method to continue using Printyx without interruption.</p>
              </div>

              <p style="text-align: center;">
                <a href="${upgradeUrl}" class="button">Add Payment Method</a>
              </p>

              <p>Questions? Our team is here to help. Just reply to this email.</p>
            </div>
            <div class="footer">
              <p>© 2025 Printyx. All rights reserved.</p>
              <p>This email was sent to ${escapeHtml(data.userEmail)}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Trial Ending Soon

Hello ${data.userName},

Your Printyx trial is ending soon${data.trialEndDate ? ` on ${data.trialEndDate}` : ''}.

Don't lose access! Add a payment method to continue using Printyx without interruption.

Add payment method at: ${upgradeUrl}

Questions? Our team is here to help. Just reply to this email.

© 2025 Printyx
This email was sent to ${data.userEmail}
      `.trim(),
    };
  }
}
