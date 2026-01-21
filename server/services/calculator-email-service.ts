/**
 * Print Cost Calculator Email Service
 * Handles email sequence delivery for calculator leads
 */

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Email sequence templates for different days and user types
const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  day_0_standard: {
    subject: 'Your Print Fleet Analysis Report + First Action Step',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e40af;">Your Print Fleet Analysis Report</h1>
        <p>Thank you for using the Printyx Print Cost Calculator! Your comprehensive report is attached.</p>

        <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0;">🎯 First Action Step: Audit Your Toner Inventory</h2>
          <p>Most companies find $2-5K in unused or expired supplies just sitting in storage.</p>
          <ul>
            <li>Check expiration dates on all toner cartridges</li>
            <li>Identify any opened but unused supplies</li>
            <li>Calculate the value of wasted inventory</li>
            <li>Implement just-in-time ordering to prevent this</li>
          </ul>
        </div>

        <p><strong>What's in your report:</strong></p>
        <ul>
          <li>Complete cost breakdown by category</li>
          <li>Industry benchmark comparison</li>
          <li>Personalized savings recommendations</li>
          <li>Step-by-step implementation roadmap</li>
        </ul>

        <div style="margin: 30px 0;">
          <a href="https://printyx.net/demo" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Track Costs in Real-Time with Printyx →</a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          P.S. Instead of running this analysis annually, imagine having real-time visibility into every print cost.
          <a href="https://printyx.net/demo">See how Printyx works →</a>
        </p>
      </div>
    `,
    text: 'Your Print Fleet Analysis Report is ready! Check your email for the PDF...',
  },

  day_0_dealer: {
    subject: 'Your Print Fleet Analysis Report + New Sales Tool',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e40af;">Your Print Fleet Analysis + Dealer Resources</h1>
        <p>Thank you for trying the Printyx Print Cost Calculator! As a copier dealer, you can use this powerful tool with your prospects.</p>

        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0;">🎯 Use This Calculator in Your Sales Process</h2>
          <p>Give prospects instant value and position yourself as a trusted advisor:</p>
          <ul>
            <li>Share the calculator link in your email signature</li>
            <li>Use it during discovery calls to quantify pain</li>
            <li>Include in proposals to justify your solution</li>
            <li>Track prospects who complete the analysis</li>
          </ul>
        </div>

        <p><strong>Dealer Resources Available:</strong></p>
        <ul>
          <li>Co-branded calculator for your website</li>
          <li>Email templates for sending to prospects</li>
          <li>Sales scripts for discussing results</li>
          <li>Lead notifications when prospects use your link</li>
        </ul>

        <div style="margin: 30px 0;">
          <a href="https://printyx.net/dealer-program" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Explore Dealer Program →</a>
        </div>
      </div>
    `,
    text: 'Your calculator results plus dealer resources...',
  },

  day_1_standard: {
    subject: "The hidden cost of printer downtime (it's worse than you think)",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>The True Cost of Printer Downtime</h1>
        <p>Did you know that every hour of printer downtime costs your organization more than just lost productivity?</p>

        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">📊 Downtime Cost Formula</h3>
          <p><strong>Hours Down × Affected Employees × Hourly Rate = Real Cost</strong></p>
          <p>For a 50-person office, just 4 hours of downtime per month costs <strong>$8,400 annually</strong> in lost productivity.</p>
        </div>

        <p><strong>How Printyx Prevents Downtime:</strong></p>
        <ul>
          <li>Predictive alerts before supplies run out</li>
          <li>Automated service ticket creation</li>
          <li>Real-time device health monitoring</li>
          <li>Automatic supply reordering</li>
        </ul>

        <div style="margin: 30px 0;">
          <a href="https://printyx.net/demo" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Eliminate Downtime Surprises →</a>
        </div>
      </div>
    `,
    text: 'Learn about the true cost of printer downtime...',
  },

  day_2_standard: {
    subject: 'Case Study: Regional law firm saves $47K with print management',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Real Results: $47K Annual Savings</h1>
        <p><em>"We had no idea how much we were overspending until we saw the data."</em></p>
        <p>— Sarah Johnson, IT Director at Regional Law Firm (120 employees)</p>

        <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">The Challenge</h3>
          <ul>
            <li>42 devices across 3 offices</li>
            <li>No visibility into print costs</li>
            <li>Frequent emergency supply orders</li>
            <li>Surprise service bills</li>
          </ul>

          <h3>The Solution: Printyx Implementation</h3>
          <ul>
            <li>Automated cost tracking</li>
            <li>Consolidated vendor management</li>
            <li>Predictive supply ordering</li>
            <li>Print policy enforcement</li>
          </ul>

          <h3 style="color: #10b981;">The Results</h3>
          <ul>
            <li><strong>$47K</strong> annual savings (31% cost reduction)</li>
            <li><strong>Zero</strong> unplanned downtime in 6 months</li>
            <li><strong>65%</strong> reduction in supply waste</li>
            <li><strong>8 hours/month</strong> time saved on management</li>
          </ul>
        </div>

        <div style="margin: 30px 0;">
          <a href="https://printyx.net/demo" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Get Results Like This →</a>
        </div>
      </div>
    `,
    text: 'Read how a law firm saved $47K annually...',
  },

  // Additional day templates would go here (days 3, 5, 6, 7)
};

/**
 * Send email using configured email service (Resend, SendGrid, etc.)
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments?: Array<{ filename: string; content: Buffer }>,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // TODO: Implement actual email sending using Resend or SendGrid
    // For now, log the email that would be sent
    console.log('📧 Email would be sent:', {
      to,
      subject,
      hasAttachments: !!attachments?.length,
    });

    // Simulate successful send
    return {
      success: true,
      messageId: `sim_${Date.now()}`,
    };

    // Example Resend implementation:
    /*
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: 'Printyx <noreply@printyx.net>',
      to: [to],
      subject,
      html,
      text,
      attachments,
    });

    return {
      success: true,
      messageId: result.id,
    };
    */
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get email template for specific day and user type
 */
export function getEmailTemplate(day: number, isDealer: boolean): EmailTemplate {
  const templateKey = isDealer ? `day_${day}_dealer` : `day_${day}_standard`;
  return EMAIL_TEMPLATES[templateKey] || EMAIL_TEMPLATES.day_0_standard;
}

/**
 * Send calculator report email with PDF attachment
 */
export async function sendCalculatorReportEmail(
  email: string,
  companyName: string,
  isDealer: boolean,
  pdfBuffer?: Buffer,
): Promise<boolean> {
  const template = getEmailTemplate(0, isDealer);

  const attachments = pdfBuffer
    ? [{ filename: `${companyName}_Print_Fleet_Analysis.pdf`, content: pdfBuffer }]
    : [];

  const result = await sendEmail(
    email,
    template.subject,
    template.html,
    template.text,
    attachments,
  );

  return result.success;
}

/**
 * Process scheduled email sequences
 * This should be called by a cron job or scheduled worker
 */
export async function processScheduledEmails(): Promise<void> {
  // TODO: Implement cron job to send scheduled emails
  // Query database for pending emails where scheduledFor <= now
  // Send emails and update status
  console.log('Processing scheduled emails...');
}
