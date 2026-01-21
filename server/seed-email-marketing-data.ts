import { db } from './db';
import {
  emailTemplates,
  emailCampaigns,
  emailSends,
  emailEvents,
  emailLists,
  emailListMembers,
  emailUnsubscribes,
} from '@shared/schema';

const DEMO_TENANT_ID = 'demo-tenant-001';
const DEMO_USER_ID = 'demo-user-001';

async function seedEmailMarketing() {
  console.log('🌱 Starting email marketing data seeding...');

  try {
    console.log('🧹 Cleaning up existing email marketing data...');
    await db.delete(emailEvents);
    await db.delete(emailSends);
    await db.delete(emailCampaigns);
    await db.delete(emailTemplates);
    await db.delete(emailListMembers);
    await db.delete(emailLists);
    await db.delete(emailUnsubscribes);

    console.log('📧 Seeding email templates...');
    const templates = await db
      .insert(emailTemplates)
      .values([
        {
          tenantId: DEMO_TENANT_ID,
          templateName: 'Welcome Email',
          templateDescription: 'Welcome email for new customers',
          templateType: 'transactional',
          subject: 'Welcome to {{companyName}}!',
          preheaderText: 'Get started with your new copier management platform',
          htmlContent: `
            <html>
              <body style="font-family: Arial, sans-serif;">
                <h1>Welcome to {{companyName}}!</h1>
                <p>Hi {{firstName}},</p>
                <p>We're excited to have you on board. Your new {{productModel}} is ready to be set up.</p>
                <p>Our team will contact you shortly to schedule installation.</p>
                <p>Best regards,<br/>The {{companyName}} Team</p>
              </body>
            </html>
          `,
          textContent:
            "Welcome to {{companyName}}!\n\nHi {{firstName}},\n\nWe're excited to have you on board...",
          variableFields: JSON.stringify(['companyName', 'firstName', 'productModel']),
          category: 'onboarding',
          tags: ['welcome', 'onboarding'],
          version: 1,
          isActive: true,
          createdBy: DEMO_USER_ID,
        },
        {
          tenantId: DEMO_TENANT_ID,
          templateName: 'Monthly Newsletter',
          templateDescription: 'Monthly product updates and tips',
          templateType: 'newsletter',
          subject: '{{monthName}} Newsletter - Latest Updates',
          preheaderText: 'New features, tips, and customer stories',
          htmlContent: `
            <html>
              <body style="font-family: Arial, sans-serif;">
                <h1>{{monthName}} Newsletter</h1>
                <p>Hi {{firstName}},</p>
                <h2>What's New</h2>
                <p>Check out our latest features and updates...</p>
                <h2>Customer Spotlight</h2>
                <p>Learn how businesses like yours are succeeding...</p>
                <h2>Tips & Tricks</h2>
                <p>Maximize your productivity with these tips...</p>
              </body>
            </html>
          `,
          textContent: '{{monthName}} Newsletter...',
          variableFields: JSON.stringify(['monthName', 'firstName']),
          category: 'engagement',
          tags: ['newsletter', 'monthly'],
          version: 1,
          isActive: true,
          createdBy: DEMO_USER_ID,
        },
        {
          tenantId: DEMO_TENANT_ID,
          templateName: 'Service Reminder',
          templateDescription: 'Reminder for upcoming service appointment',
          templateType: 'transactional',
          subject: 'Service Reminder: {{equipmentModel}} - {{serviceDate}}',
          preheaderText: 'Your scheduled service is coming up',
          htmlContent: `
            <html>
              <body style="font-family: Arial, sans-serif;">
                <h1>Service Reminder</h1>
                <p>Hi {{firstName}},</p>
                <p>This is a reminder that your {{equipmentModel}} is scheduled for service on {{serviceDate}} at {{serviceTime}}.</p>
                <p>Our technician {{technicianName}} will arrive at your location.</p>
                <p>If you need to reschedule, please contact us at {{supportPhone}}.</p>
              </body>
            </html>
          `,
          textContent: 'Service Reminder...',
          variableFields: JSON.stringify([
            'firstName',
            'equipmentModel',
            'serviceDate',
            'serviceTime',
            'technicianName',
            'supportPhone',
          ]),
          category: 'retention',
          tags: ['service', 'reminder'],
          version: 1,
          isActive: true,
          createdBy: DEMO_USER_ID,
        },
        {
          tenantId: DEMO_TENANT_ID,
          templateName: 'Promotional Offer',
          templateDescription: 'Special promotional offers for customers',
          templateType: 'promotional',
          subject: 'Exclusive Offer: {{offerTitle}}',
          preheaderText: 'Limited time offer - save {{discountPercent}}%',
          htmlContent: `
            <html>
              <body style="font-family: Arial, sans-serif;">
                <h1>{{offerTitle}}</h1>
                <p>Hi {{firstName}},</p>
                <p>For a limited time, save {{discountPercent}}% on {{productCategory}}!</p>
                <p>Use code: {{promoCode}}</p>
                <p>Offer expires: {{expiryDate}}</p>
                <a href="{{ctaLink}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none;">Shop Now</a>
              </body>
            </html>
          `,
          textContent: '{{offerTitle}}...',
          variableFields: JSON.stringify([
            'firstName',
            'offerTitle',
            'discountPercent',
            'productCategory',
            'promoCode',
            'expiryDate',
            'ctaLink',
          ]),
          category: 'promotion',
          tags: ['promotion', 'discount'],
          version: 1,
          isActive: true,
          createdBy: DEMO_USER_ID,
        },
      ])
      .returning();

    console.log(`✅ Created ${templates.length} email templates`);

    console.log('📋 Seeding email lists...');
    const lists = await db
      .insert(emailLists)
      .values([
        {
          tenantId: DEMO_TENANT_ID,
          listName: 'All Customers',
          listDescription: 'Complete list of all customers',
          listType: 'static',
          category: 'customers',
          tags: ['customers', 'main'],
          isActive: true,
          ownerId: DEMO_USER_ID,
          createdBy: DEMO_USER_ID,
        },
        {
          tenantId: DEMO_TENANT_ID,
          listName: 'Newsletter Subscribers',
          listDescription: 'Customers who opted in to receive newsletters',
          listType: 'static',
          category: 'newsletter',
          tags: ['newsletter', 'subscribers'],
          isActive: true,
          ownerId: DEMO_USER_ID,
          createdBy: DEMO_USER_ID,
        },
        {
          tenantId: DEMO_TENANT_ID,
          listName: 'High-Value Customers',
          listDescription: 'Customers with contracts > $10,000',
          listType: 'dynamic',
          segmentCriteria: JSON.stringify({
            contractValue: { min: 10000 },
            status: 'active',
          }),
          category: 'customers',
          tags: ['high-value', 'vip'],
          isActive: true,
          ownerId: DEMO_USER_ID,
          createdBy: DEMO_USER_ID,
        },
      ])
      .returning();

    console.log(`✅ Created ${lists.length} email lists`);

    console.log('👥 Seeding email list members...');
    const members = await db
      .insert(emailListMembers)
      .values([
        {
          tenantId: DEMO_TENANT_ID,
          listId: lists[0].id,
          email: 'john.smith@acmecorp.com',
          firstName: 'John',
          lastName: 'Smith',
          company: 'Acme Corporation',
          status: 'active',
          subscriptionSource: 'manual',
          engagementScore: 85,
        },
        {
          tenantId: DEMO_TENANT_ID,
          listId: lists[0].id,
          email: 'sarah.johnson@techstart.com',
          firstName: 'Sarah',
          lastName: 'Johnson',
          company: 'TechStart Inc',
          status: 'active',
          subscriptionSource: 'import',
          engagementScore: 92,
        },
        {
          tenantId: DEMO_TENANT_ID,
          listId: lists[1].id,
          email: 'john.smith@acmecorp.com',
          firstName: 'John',
          lastName: 'Smith',
          company: 'Acme Corporation',
          status: 'active',
          subscriptionSource: 'form',
          engagementScore: 85,
        },
        {
          tenantId: DEMO_TENANT_ID,
          listId: lists[1].id,
          email: 'sarah.johnson@techstart.com',
          firstName: 'Sarah',
          lastName: 'Johnson',
          company: 'TechStart Inc',
          status: 'active',
          subscriptionSource: 'form',
          engagementScore: 92,
        },
        {
          tenantId: DEMO_TENANT_ID,
          listId: lists[2].id,
          email: 'michael.brown@bigenterprise.com',
          firstName: 'Michael',
          lastName: 'Brown',
          company: 'Big Enterprise LLC',
          status: 'active',
          subscriptionSource: 'api',
          engagementScore: 78,
        },
      ])
      .returning();

    console.log(`✅ Created ${members.length} list members`);

    console.log('📨 Seeding email campaigns...');
    const campaigns = await db
      .insert(emailCampaigns)
      .values([
        {
          tenantId: DEMO_TENANT_ID,
          campaignName: 'Q1 2024 Newsletter',
          campaignDescription: 'First quarter newsletter with product updates',
          campaignType: 'one_time',
          templateId: templates[1].id,
          subject: 'January Newsletter - Latest Updates',
          senderName: 'Printyx Team',
          senderEmail: 'newsletter@printyx.com',
          replyToEmail: 'support@printyx.com',
          listIds: [lists[1].id],
          scheduleType: 'scheduled',
          scheduledDate: new Date('2024-01-15T10:00:00Z'),
          timezone: 'America/New_York',
          status: 'sent',
          totalRecipients: 2,
          emailsSent: 2,
          emailsDelivered: 2,
          emailsOpened: 1,
          emailsClicked: 1,
          emailsBounced: 0,
          emailsUnsubscribed: 0,
          emailsSpamReported: 0,
          deliveryRate: '100.00',
          openRate: '50.00',
          clickRate: '50.00',
          bounceRate: '0.00',
          unsubscribeRate: '0.00',
          isAbTest: false,
          ownerId: DEMO_USER_ID,
          createdBy: DEMO_USER_ID,
          sentAt: new Date('2024-01-15T10:00:00Z'),
          completedAt: new Date('2024-01-15T10:15:00Z'),
        },
        {
          tenantId: DEMO_TENANT_ID,
          campaignName: 'Spring Promotion 2024',
          campaignDescription: '20% off spring sale promotion',
          campaignType: 'one_time',
          templateId: templates[3].id,
          subject: 'Exclusive Offer: Spring Sale - Save 20%',
          senderName: 'Printyx Sales',
          senderEmail: 'sales@printyx.com',
          replyToEmail: 'sales@printyx.com',
          listIds: [lists[0].id],
          scheduleType: 'scheduled',
          scheduledDate: new Date('2024-03-01T09:00:00Z'),
          timezone: 'America/New_York',
          status: 'draft',
          totalRecipients: 0,
          emailsSent: 0,
          emailsDelivered: 0,
          emailsOpened: 0,
          emailsClicked: 0,
          emailsBounced: 0,
          emailsUnsubscribed: 0,
          emailsSpamReported: 0,
          isAbTest: false,
          ownerId: DEMO_USER_ID,
          createdBy: DEMO_USER_ID,
        },
        {
          tenantId: DEMO_TENANT_ID,
          campaignName: 'Service Reminder Campaign',
          campaignDescription: 'Automated service reminders for all customers',
          campaignType: 'drip',
          templateId: templates[2].id,
          subject: 'Service Reminder: Upcoming Maintenance',
          senderName: 'Printyx Service',
          senderEmail: 'service@printyx.com',
          replyToEmail: 'service@printyx.com',
          listIds: [lists[0].id],
          sequenceSteps: JSON.stringify([
            { step: 1, delayDays: 0, templateId: templates[2].id },
            { step: 2, delayDays: 7, templateId: templates[2].id },
          ]),
          scheduleType: 'recurring',
          recurringPattern: JSON.stringify({ frequency: 'monthly', dayOfMonth: 1 }),
          timezone: 'America/New_York',
          status: 'active',
          totalRecipients: 0,
          emailsSent: 0,
          emailsDelivered: 0,
          emailsOpened: 0,
          emailsClicked: 0,
          emailsBounced: 0,
          emailsUnsubscribed: 0,
          emailsSpamReported: 0,
          isAbTest: false,
          ownerId: DEMO_USER_ID,
          createdBy: DEMO_USER_ID,
        },
      ])
      .returning();

    console.log(`✅ Created ${campaigns.length} email campaigns`);

    console.log('✉️ Seeding email sends...');
    const sends = await db
      .insert(emailSends)
      .values([
        {
          tenantId: DEMO_TENANT_ID,
          campaignId: campaigns[0].id,
          templateId: templates[1].id,
          recipientEmail: 'john.smith@acmecorp.com',
          recipientName: 'John Smith',
          subject: 'January Newsletter - Latest Updates',
          htmlContent: '<html><body><h1>January Newsletter</h1>...</body></html>',
          textContent: 'January Newsletter...',
          mergeData: JSON.stringify({ monthName: 'January', firstName: 'John' }),
          status: 'delivered',
          sendgridMessageId: 'sg-msg-001',
          providerStatus: 'delivered',
          queuedAt: new Date('2024-01-15T10:00:00Z'),
          sentAt: new Date('2024-01-15T10:01:00Z'),
          deliveredAt: new Date('2024-01-15T10:02:00Z'),
        },
        {
          tenantId: DEMO_TENANT_ID,
          campaignId: campaigns[0].id,
          templateId: templates[1].id,
          recipientEmail: 'sarah.johnson@techstart.com',
          recipientName: 'Sarah Johnson',
          subject: 'January Newsletter - Latest Updates',
          htmlContent: '<html><body><h1>January Newsletter</h1>...</body></html>',
          textContent: 'January Newsletter...',
          mergeData: JSON.stringify({ monthName: 'January', firstName: 'Sarah' }),
          status: 'delivered',
          sendgridMessageId: 'sg-msg-002',
          providerStatus: 'delivered',
          queuedAt: new Date('2024-01-15T10:00:00Z'),
          sentAt: new Date('2024-01-15T10:01:00Z'),
          deliveredAt: new Date('2024-01-15T10:02:00Z'),
        },
      ])
      .returning();

    console.log(`✅ Created ${sends.length} email sends`);

    console.log('📊 Seeding email events...');
    const events = await db
      .insert(emailEvents)
      .values([
        {
          tenantId: DEMO_TENANT_ID,
          emailSendId: sends[0].id,
          campaignId: campaigns[0].id,
          eventType: 'delivered',
          eventTimestamp: new Date('2024-01-15T10:02:00Z'),
          sendgridEventId: 'sg-evt-001',
        },
        {
          tenantId: DEMO_TENANT_ID,
          emailSendId: sends[0].id,
          campaignId: campaigns[0].id,
          eventType: 'open',
          eventTimestamp: new Date('2024-01-15T11:30:00Z'),
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ipAddress: '192.168.1.100',
          deviceType: 'desktop',
          emailClient: 'outlook',
          operatingSystem: 'Windows',
          country: 'United States',
          city: 'New York',
          sendgridEventId: 'sg-evt-002',
        },
        {
          tenantId: DEMO_TENANT_ID,
          emailSendId: sends[0].id,
          campaignId: campaigns[0].id,
          eventType: 'click',
          eventTimestamp: new Date('2024-01-15T11:35:00Z'),
          clickedUrl: 'https://printyx.com/latest-features',
          linkLabel: 'View Features',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ipAddress: '192.168.1.100',
          deviceType: 'desktop',
          emailClient: 'outlook',
          operatingSystem: 'Windows',
          country: 'United States',
          city: 'New York',
          sendgridEventId: 'sg-evt-003',
        },
        {
          tenantId: DEMO_TENANT_ID,
          emailSendId: sends[1].id,
          campaignId: campaigns[0].id,
          eventType: 'delivered',
          eventTimestamp: new Date('2024-01-15T10:02:00Z'),
          sendgridEventId: 'sg-evt-004',
        },
      ])
      .returning();

    console.log(`✅ Created ${events.length} email events`);

    console.log('🚫 Seeding email unsubscribes...');
    const unsubscribes = await db
      .insert(emailUnsubscribes)
      .values([
        {
          tenantId: DEMO_TENANT_ID,
          email: 'unsubscribed@example.com',
          unsubscribeType: 'global',
          reason: 'too_frequent',
          feedbackText: 'I was receiving too many emails',
          unsubscribeMethod: 'link',
          unsubscribedAt: new Date('2024-01-10T14:30:00Z'),
        },
      ])
      .returning();

    console.log(`✅ Created ${unsubscribes.length} unsubscribes`);

    console.log('✅ Email marketing data seeding completed successfully!');
    console.log('\nSummary:');
    console.log(`  - Email Templates: ${templates.length}`);
    console.log(`  - Email Lists: ${lists.length}`);
    console.log(`  - List Members: ${members.length}`);
    console.log(`  - Email Campaigns: ${campaigns.length}`);
    console.log(`  - Email Sends: ${sends.length}`);
    console.log(`  - Email Events: ${events.length}`);
    console.log(`  - Unsubscribes: ${unsubscribes.length}`);
  } catch (error) {
    console.error('❌ Error seeding email marketing data:', error);
    throw error;
  }
}

seedEmailMarketing()
  .then(() => {
    console.log('✨ Seeding script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding script failed:', error);
    process.exit(1);
  });
