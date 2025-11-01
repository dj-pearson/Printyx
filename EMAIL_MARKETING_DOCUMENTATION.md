# Email Marketing Service Integration - Technical Documentation

## Overview

The Email Marketing Service Integration is a comprehensive platform-level system that enables copier dealers to manage email marketing campaigns, track engagement metrics, and automate customer communications. The system provides a provider-agnostic architecture where dealers configure their own SendGrid API credentials through the existing integrationCredentials management system.

## Key Features

1. **Template Management** - Create, manage, and version email templates with variable substitution
2. **Campaign Management** - Design and execute one-time, drip, or recurring email campaigns  
3. **List Management** - Organize contacts into static or dynamic segmented lists
4. **Email Sending** - Send emails individually or in bulk with comprehensive tracking
5. **Event Tracking** - Monitor email delivery, opens, clicks, bounces, and unsubscribes
6. **Engagement Analytics** - Calculate campaign metrics and recipient engagement scores
7. **Webhook Processing** - Real-time event updates from SendGrid via webhooks
8. **Unsubscribe Management** - Handle global and campaign-specific unsubscribe requests

## System Architecture

### Platform-Level Integration Pattern

This system follows Printyx's platform-level integration approach:
- **Dealers configure their own SendGrid API keys** through the existing `integrationCredentials` table
- **Provider-agnostic design** supports future email service providers
- **Centralized credential management** with health monitoring and OAuth token refresh
- **No shared API keys** - each tenant uses their own SendGrid account

### Database Schema

The system includes 7 comprehensive database tables:

#### 1. email_templates
Stores reusable email templates with variable substitution support.

```typescript
{
  id: varchar (UUID primary key)
  tenantId: varchar (multi-tenant isolation)
  templateName: varchar
  templateDescription: text
  templateType: varchar (transactional | promotional | newsletter)
  subject: varchar
  preheaderText: varchar
  htmlContent: text
  textContent: text
  variableFields: json (array of variable names)
  category: varchar
  tags: text[] (array for filtering)
  version: integer
  isActive: boolean
  createdBy: varchar (user ID)
  lastModifiedBy: varchar
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Indexes:**
- `idx_email_templates_tenant_type` on (tenantId, templateType)
- `idx_email_templates_active` on (tenantId, isActive)

#### 2. email_campaigns
Manages email marketing campaigns with comprehensive metrics tracking.

```typescript
{
  id: varchar (UUID primary key)
  tenantId: varchar
  campaignName: varchar
  campaignDescription: text
  campaignType: varchar (one_time | drip | recurring | ab_test)
  templateId: varchar (foreign key to email_templates)
  subject: varchar
  senderName: varchar
  senderEmail: varchar
  replyToEmail: varchar
  listIds: varchar[] (array of list IDs)
  sequenceSteps: json (for drip campaigns)
  scheduleType: varchar (immediate | scheduled | recurring)
  scheduledDate: timestamp
  recurringPattern: json
  timezone: varchar
  status: varchar (draft | scheduled | sending | sent | paused | cancelled | completed)
  
  // Metrics
  totalRecipients: integer
  emailsSent: integer
  emailsDelivered: integer
  emailsOpened: integer
  emailsClicked: integer
  emailsBounced: integer
  emailsUnsubscribed: integer
  emailsSpamReported: integer
  deliveryRate: decimal
  openRate: decimal
  clickRate: decimal
  bounceRate: decimal
  unsubscribeRate: decimal
  
  // A/B Testing
  isAbTest: boolean
  abTestVariants: json
  abTestWinner: varchar
  
  ownerId: varchar (user ID)
  createdBy: varchar
  createdAt: timestamp
  updatedAt: timestamp
  sentAt: timestamp
  completedAt: timestamp
}
```

**Indexes:**
- `idx_email_campaigns_tenant_status` on (tenantId, status)
- `idx_email_campaigns_template` on (templateId)
- `idx_email_campaigns_scheduled` on (tenantId, scheduleType, scheduledDate)

#### 3. email_sends
Tracks individual email sends to recipients with delivery status.

```typescript
{
  id: varchar (UUID primary key)
  tenantId: varchar
  campaignId: varchar (foreign key to email_campaigns)
  templateId: varchar (foreign key to email_templates)
  recipientEmail: varchar
  recipientName: varchar
  subject: varchar
  htmlContent: text
  textContent: text
  mergeData: json (template variables)
  status: varchar (queued | sent | delivered | bounced | failed)
  sendgridMessageId: varchar (unique provider message ID)
  providerStatus: varchar
  errorMessage: text
  queuedAt: timestamp
  sentAt: timestamp
  deliveredAt: timestamp
  bouncedAt: timestamp
  createdAt: timestamp
}
```

**Indexes:**
- `idx_email_sends_campaign` on (campaignId, status)
- `idx_email_sends_recipient` on (tenantId, recipientEmail)
- `idx_email_sends_message_id` on (sendgridMessageId)

#### 4. email_events
Records detailed email engagement events (opens, clicks, bounces).

```typescript
{
  id: varchar (UUID primary key)
  tenantId: varchar
  emailSendId: varchar (foreign key to email_sends)
  campaignId: varchar (foreign key to email_campaigns)
  eventType: varchar (delivered | open | click | bounce | spam_report | unsubscribe)
  eventTimestamp: timestamp
  
  // Click tracking
  clickedUrl: varchar
  linkLabel: varchar
  
  // Device & Location data
  userAgent: varchar
  ipAddress: varchar
  deviceType: varchar
  emailClient: varchar
  operatingSystem: varchar
  country: varchar
  region: varchar
  city: varchar
  
  sendgridEventId: varchar (unique provider event ID)
  createdAt: timestamp
}
```

**Indexes:**
- `idx_email_events_send` on (emailSendId, eventType)
- `idx_email_events_campaign` on (campaignId, eventType, eventTimestamp)
- `idx_email_events_type_time` on (tenantId, eventType, eventTimestamp)

#### 5. email_lists
Manages email contact lists with static or dynamic segmentation.

```typescript
{
  id: varchar (UUID primary key)
  tenantId: varchar
  listName: varchar
  listDescription: text
  listType: varchar (static | dynamic)
  segmentCriteria: json (for dynamic lists)
  category: varchar
  tags: text[]
  isActive: boolean
  totalMembers: integer
  activeMembers: integer
  ownerId: varchar
  createdBy: varchar
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Indexes:**
- `idx_email_lists_tenant_type` on (tenantId, listType)
- `idx_email_lists_active` on (tenantId, isActive)

#### 6. email_list_members
Stores individual contacts within email lists.

```typescript
{
  id: varchar (UUID primary key)
  tenantId: varchar
  listId: varchar (foreign key to email_lists)
  email: varchar
  firstName: varchar
  lastName: varchar
  company: varchar
  phone: varchar
  customFields: json
  status: varchar (active | unsubscribed | bounced | complained)
  subscriptionSource: varchar (manual | import | api | form)
  engagementScore: integer (0-100)
  lastEngagementDate: timestamp
  subscribedAt: timestamp
  unsubscribedAt: timestamp
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Indexes:**
- `idx_email_list_members_list` on (listId, status)
- `idx_email_list_members_email` on (tenantId, email)

#### 7. email_unsubscribes
Tracks global and campaign-specific unsubscribe requests.

```typescript
{
  id: varchar (UUID primary key)
  tenantId: varchar
  email: varchar
  campaignId: varchar (optional)
  listId: varchar (optional)
  unsubscribeType: varchar (global | campaign | list)
  reason: varchar
  feedbackText: text
  unsubscribeMethod: varchar (link | reply | manual)
  unsubscribedAt: timestamp
  createdAt: timestamp
}
```

**Indexes:**
- `idx_email_unsubscribes_email` on (tenantId, email, unsubscribeType)
- `idx_email_unsubscribes_campaign` on (campaignId)

## Storage Layer

The storage interface provides 28 comprehensive methods for email marketing operations:

### Email Templates (5 methods)
- `getEmailTemplates(tenantId, filters)` - List templates with optional filtering
- `getEmailTemplateById(id, tenantId)` - Get single template
- `createEmailTemplate(data)` - Create new template
- `updateEmailTemplate(id, tenantId, data)` - Update template
- `deleteEmailTemplate(id, tenantId)` - Delete template

### Email Campaigns (6 methods)
- `getEmailCampaigns(tenantId, filters)` - List campaigns with filtering
- `getEmailCampaignById(id, tenantId)` - Get single campaign
- `createEmailCampaign(data)` - Create new campaign
- `updateEmailCampaign(id, tenantId, data)` - Update campaign
- `deleteEmailCampaign(id, tenantId)` - Delete campaign
- `updateCampaignMetrics(campaignId, tenantId)` - Recalculate campaign metrics from events

### Email Sends (5 methods)
- `getEmailSends(campaignId, tenantId)` - List sends for a campaign
- `getEmailSendById(id, tenantId)` - Get single send
- `createEmailSend(data)` - Create new send
- `bulkCreateEmailSends(sends[])` - Bulk create sends
- `updateEmailSend(id, tenantId, data)` - Update send status

### Email Events (3 methods)
- `getEmailEvents(emailSendId, tenantId)` - Get events for a send
- `getEmailEventsByCampaign(campaignId, tenantId, filters)` - Get campaign events
- `createEmailEvent(data)` - Record new event

### Email Lists (5 methods)
- `getEmailLists(tenantId, filters)` - List email lists
- `getEmailListById(id, tenantId)` - Get single list
- `createEmailList(data)` - Create new list
- `updateEmailList(id, tenantId, data)` - Update list
- `deleteEmailList(id, tenantId)` - Delete list
- `updateListMemberCounts(listId, tenantId)` - Recalculate member counts

### Email List Members (6 methods)
- `getEmailListMembers(listId, tenantId, filters)` - List members in a list
- `getEmailListMemberById(id, tenantId)` - Get single member
- `createEmailListMember(data)` - Add member to list
- `bulkCreateEmailListMembers(members[])` - Bulk add members
- `updateEmailListMember(id, tenantId, data)` - Update member
- `deleteEmailListMember(id, tenantId)` - Remove member from list

### Email Unsubscribes (3 methods)
- `getEmailUnsubscribes(tenantId, filters)` - List unsubscribes
- `createEmailUnsubscribe(data)` - Record new unsubscribe
- `checkUnsubscribeStatus(email, tenantId)` - Check if email is unsubscribed

## API Endpoints

The system provides 30+ RESTful API endpoints:

### Email Templates
- `GET /api/email-templates` - List templates (supports templateType, isActive, category filters)
- `GET /api/email-templates/:id` - Get single template
- `POST /api/email-templates` - Create template
- `PATCH /api/email-templates/:id` - Update template
- `DELETE /api/email-templates/:id` - Delete template

### Email Campaigns
- `GET /api/email-campaigns` - List campaigns (supports status, campaignType, ownerId filters)
- `GET /api/email-campaigns/:id` - Get single campaign
- `POST /api/email-campaigns` - Create campaign
- `PATCH /api/email-campaigns/:id` - Update campaign
- `DELETE /api/email-campaigns/:id` - Delete campaign
- `POST /api/email-campaigns/:id/refresh-metrics` - Recalculate campaign metrics
- `GET /api/email-campaigns/:campaignId/sends` - Get all sends for campaign
- `GET /api/email-campaigns/:campaignId/events` - Get all events for campaign

### Email Sends
- `GET /api/email-sends/:id` - Get single send
- `POST /api/email-sends` - Create single send
- `POST /api/email-sends/bulk` - Bulk create sends
- `PATCH /api/email-sends/:id` - Update send status
- `GET /api/email-sends/:sendId/events` - Get events for a send

### Email Events
- `POST /api/email-events` - Record new event

### Email Lists
- `GET /api/email-lists` - List email lists (supports listType, isActive, category filters)
- `GET /api/email-lists/:id` - Get single list
- `POST /api/email-lists` - Create list
- `PATCH /api/email-lists/:id` - Update list
- `DELETE /api/email-lists/:id` - Delete list
- `POST /api/email-lists/:id/refresh-counts` - Recalculate member counts
- `GET /api/email-lists/:listId/members` - Get list members

### Email List Members
- `GET /api/email-list-members/:id` - Get single member
- `POST /api/email-list-members` - Add member to list
- `POST /api/email-list-members/bulk` - Bulk add members
- `PATCH /api/email-list-members/:id` - Update member
- `DELETE /api/email-list-members/:id` - Remove member

### Email Unsubscribes
- `GET /api/email-unsubscribes` - List unsubscribes
- `POST /api/email-unsubscribes` - Record unsubscribe
- `GET /api/email-unsubscribes/check/:email` - Check unsubscribe status

### Webhooks
- `POST /api/webhooks/sendgrid` - SendGrid webhook handler for real-time events

## Integration Setup

### Prerequisites

1. **SendGrid Account** - Dealer must have their own SendGrid account
2. **SendGrid API Key** - Dealer must generate an API key with Mail Send permissions
3. **Webhook Configuration** - (Optional) Configure SendGrid webhook to point to your Replit deployment

### Step 1: Configure SendGrid Credentials

Dealers configure their SendGrid API key through the existing integrationCredentials system:

```typescript
POST /api/integration-credentials
{
  "provider": "sendgrid",
  "credentialType": "api_key",
  "apiKey": "SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "isActive": true,
  "isSandbox": false
}
```

### Step 2: Set Up Webhook (Optional)

For real-time email event tracking, configure SendGrid webhook:

1. Log in to SendGrid dashboard
2. Navigate to Settings > Mail Settings > Event Webhook
3. Set HTTP POST URL to: `https://your-replit-app.replit.app/api/webhooks/sendgrid`
4. Select events to track: Delivered, Opens, Clicks, Bounces, Spam Reports, Unsubscribes
5. Save configuration

### Step 3: Create Email Templates

```typescript
POST /api/email-templates
{
  "templateName": "Welcome Email",
  "templateDescription": "Welcome email for new customers",
  "templateType": "transactional",
  "subject": "Welcome to {{companyName}}!",
  "htmlContent": "<h1>Welcome {{firstName}}!</h1>",
  "textContent": "Welcome {{firstName}}!",
  "variableFields": ["companyName", "firstName"],
  "category": "onboarding",
  "tags": ["welcome"],
  "isActive": true
}
```

### Step 4: Create Email Lists

```typescript
POST /api/email-lists
{
  "listName": "All Customers",
  "listDescription": "Complete customer list",
  "listType": "static",
  "category": "customers",
  "tags": ["main"],
  "isActive": true
}
```

### Step 5: Add List Members

```typescript
POST /api/email-list-members/bulk
{
  "members": [
    {
      "listId": "list-uuid-here",
      "email": "customer@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "company": "Acme Corp",
      "status": "active",
      "subscriptionSource": "import"
    }
  ]
}
```

### Step 6: Create and Send Campaign

```typescript
POST /api/email-campaigns
{
  "campaignName": "Monthly Newsletter",
  "campaignDescription": "January 2024 newsletter",
  "campaignType": "one_time",
  "templateId": "template-uuid-here",
  "subject": "January Newsletter",
  "senderName": "Your Company",
  "senderEmail": "newsletter@yourcompany.com",
  "replyToEmail": "support@yourcompany.com",
  "listIds": ["list-uuid-here"],
  "scheduleType": "scheduled",
  "scheduledDate": "2024-01-15T10:00:00Z",
  "timezone": "America/New_York",
  "status": "scheduled"
}
```

## Campaign Types

### 1. One-Time Campaigns
Standard email campaigns sent once to a list of recipients.

```typescript
{
  "campaignType": "one_time",
  "scheduleType": "scheduled",
  "scheduledDate": "2024-01-15T10:00:00Z"
}
```

### 2. Drip Campaigns
Automated sequence of emails sent over time.

```typescript
{
  "campaignType": "drip",
  "sequenceSteps": [
    { "step": 1, "delayDays": 0, "templateId": "welcome-template-id" },
    { "step": 2, "delayDays": 3, "templateId": "followup-template-id" },
    { "step": 3, "delayDays": 7, "templateId": "tips-template-id" }
  ]
}
```

### 3. Recurring Campaigns
Campaigns sent on a regular schedule.

```typescript
{
  "campaignType": "recurring",
  "scheduleType": "recurring",
  "recurringPattern": {
    "frequency": "monthly",
    "dayOfMonth": 1,
    "hour": 10
  }
}
```

### 4. A/B Test Campaigns
Test different email variations to optimize performance.

```typescript
{
  "campaignType": "ab_test",
  "isAbTest": true,
  "abTestVariants": [
    { "variant": "A", "subject": "Subject A", "templateId": "template-a-id" },
    { "variant": "B", "subject": "Subject B", "templateId": "template-b-id" }
  ]
}
```

## Template Variables

Templates support dynamic variable substitution using `{{variableName}}` syntax:

```html
<h1>Welcome to {{companyName}}!</h1>
<p>Hi {{firstName}},</p>
<p>Your {{productModel}} is ready for setup.</p>
```

When sending, provide merge data:

```typescript
{
  "mergeData": {
    "companyName": "Printyx",
    "firstName": "John",
    "productModel": "Canon ImageRunner 2525"
  }
}
```

## Engagement Scoring

The system tracks recipient engagement with a 0-100 scoring algorithm:

- **Email Opens**: +10 points per unique open
- **Link Clicks**: +20 points per unique click
- **Recent Activity**: Bonus points for engagement within 30 days
- **Bounces**: -20 points
- **Spam Reports**: -50 points

Engagement scores are automatically calculated and stored in `email_list_members.engagementScore`.

## Metrics Calculation

Campaign metrics are automatically calculated from email events:

- **Delivery Rate** = (emailsDelivered / emailsSent) × 100
- **Open Rate** = (emailsOpened / emailsDelivered) × 100
- **Click Rate** = (emailsClicked / emailsOpened) × 100
- **Bounce Rate** = (emailsBounced / emailsSent) × 100
- **Unsubscribe Rate** = (emailsUnsubscribed / emailsDelivered) × 100

Call `/api/email-campaigns/:id/refresh-metrics` to recalculate metrics from events.

## Webhook Event Processing

When SendGrid sends webhook events, the system:

1. Receives POST to `/api/webhooks/sendgrid`
2. Extracts event type and message ID
3. Looks up corresponding `email_send` record
4. Creates `email_event` record
5. Updates `email_send` status if needed
6. Triggers metric recalculation for campaign

## Unsubscribe Handling

The system supports three types of unsubscribes:

1. **Global Unsubscribe** - User unsubscribes from all emails
2. **Campaign Unsubscribe** - User unsubscribes from specific campaign
3. **List Unsubscribe** - User unsubscribes from specific list

Check unsubscribe status before sending:

```typescript
GET /api/email-unsubscribes/check/customer@example.com
```

Response:
```json
{
  "email": "customer@example.com",
  "isUnsubscribed": true,
  "unsubscribeType": "global",
  "unsubscribedAt": "2024-01-10T14:30:00Z"
}
```

## Security & Compliance

1. **API Key Security** - SendGrid API keys stored encrypted in integrationCredentials
2. **Tenant Isolation** - All queries filtered by tenantId
3. **Authentication Required** - All endpoints require valid session
4. **CAN-SPAM Compliance** - Include unsubscribe links in all emails
5. **GDPR Compliance** - Support data export and deletion requests

## Integration with Existing Systems

### Customer Success Management
Link email campaigns to customer health scores and automated interventions.

### CRM System
Trigger email campaigns based on lead stage changes and customer lifecycle.

### Service Dispatch
Send automated service reminders and follow-up emails after technician visits.

### Prospecting Campaigns
Integrate with existing prospectingCampaigns table for multi-channel outreach.

## Mock Data

The seed file creates comprehensive mock data:

- **4 Email Templates**: Welcome, Newsletter, Service Reminder, Promotional
- **3 Email Lists**: All Customers, Newsletter Subscribers, High-Value Customers
- **5 List Members**: Sample contacts across different lists
- **3 Email Campaigns**: Sent newsletter, draft promotion, active drip
- **2 Email Sends**: Individual sends with tracking
- **4 Email Events**: Delivered, open, click events
- **1 Unsubscribe**: Global unsubscribe example

Run seed data:
```bash
tsx server/seed-email-marketing-data.ts
```

## Testing Endpoints

### Test Template Creation
```bash
curl -X POST http://localhost:5000/api/email-templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "Test Template",
    "templateType": "transactional",
    "subject": "Test {{subject}}",
    "htmlContent": "<p>Hello {{name}}</p>",
    "isActive": true
  }'
```

### Test Campaign Creation
```bash
curl -X POST http://localhost:5000/api/email-campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "campaignName": "Test Campaign",
    "campaignType": "one_time",
    "templateId": "template-id-here",
    "status": "draft"
  }'
```

### Test List Management
```bash
curl -X GET http://localhost:5000/api/email-lists
```

## File Structure

```
server/
  ├── routes/
  │   └── email-marketing-routes.ts     # 30+ API endpoints
  ├── storage.ts                         # 28 storage methods
  └── seed-email-marketing-data.ts       # Mock data seeding

shared/
  └── schema.ts                          # 7 database tables
```

## Future Enhancements

1. **Multi-Provider Support** - Add support for Mailchimp, Constant Contact
2. **Advanced Segmentation** - Dynamic list building with complex criteria
3. **Email Builder UI** - Drag-and-drop email template designer
4. **Analytics Dashboard** - Visual campaign performance dashboards
5. **AI-Powered Optimization** - Smart send time and subject line recommendations
6. **SMS Integration** - Multi-channel campaign support
7. **Email Validation** - Real-time email verification before sending
8. **Spam Score Checking** - Pre-send spam score analysis

## Support & Troubleshooting

### Common Issues

**Problem**: Emails not sending
- Verify SendGrid API key is configured correctly
- Check integrationCredentials health status
- Ensure campaign status is "scheduled" or "sending"

**Problem**: Webhook events not received
- Verify webhook URL is publicly accessible
- Check SendGrid webhook configuration
- Review webhook event logs

**Problem**: Metrics not updating
- Call `/api/email-campaigns/:id/refresh-metrics` to recalculate
- Verify email_events are being created

## Conclusion

The Email Marketing Service Integration provides a complete, enterprise-grade email marketing platform for copier dealers. With comprehensive tracking, analytics, and automation capabilities, dealers can effectively manage customer communications, improve engagement, and drive business growth.
