# Printyx Platform - Admin Setup Checklist

**Purpose:** Complete checklist for setting up and deploying a Printyx platform instance
**Last Updated:** November 23, 2025
**Status:** Living Document

---

## Pre-Installation Requirements

### Infrastructure
- [ ] **Server/Hosting** provisioned
  - Min: 2 vCPU, 4GB RAM for small deployments
  - Recommended: 4 vCPU, 8GB RAM for production
- [ ] **Node.js 18+** installed
- [ ] **PostgreSQL 14+** database server access
- [ ] **Domain name** registered and configured
- [ ] **SSL certificate** obtained (Let's Encrypt recommended)
- [ ] **SMTP server** access for email sending
- [ ] **Cloud storage** account (optional, for file uploads)

### Accounts to Create
- [ ] Stripe account (for payment processing)
- [ ] Google Cloud Console account (for Calendar integration - optional)
- [ ] Microsoft Azure account (for Calendar integration - optional)
- [ ] Anthropic account (for Claude AI - optional)
- [ ] OpenAI account (for GPT features - optional)
- [ ] Cloud storage provider account (GCS/S3/Azure - optional)

---

## Database Setup

### Main Database
- [ ] Create database: `printyx`
- [ ] Create user with full privileges
- [ ] Note connection string (for DATABASE_URL)
- [ ] Configure connection pooling (recommended: max 20 connections)
- [ ] Enable pgvector extension (for AI search): `CREATE EXTENSION vector;`

### Forecasting Database
- [ ] Create database: `printyx_forecasting`
- [ ] Use same user as main database
- [ ] Note connection string (for DATABASE_FORECASTING_URL)

### Database Configuration Checklist
- [ ] `shared_buffers` = 25% of RAM (PostgreSQL tuning)
- [ ] `max_connections` = 200
- [ ] `work_mem` = 50MB
- [ ] Automated backups configured (daily minimum)
- [ ] Point-in-time recovery enabled
- [ ] Monitoring enabled (connection count, query performance)

---

## Environment Variables Setup

### ✅ CRITICAL - Required for Startup

Copy `.env.example` to `.env` and configure:

#### Core Application
```bash
# Database (REQUIRED)
DATABASE_URL=postgresql://username:password@localhost:5432/printyx
DATABASE_FORECASTING_URL=postgresql://username:password@localhost:5432/printyx_forecasting

# Server Configuration (REQUIRED)
NODE_ENV=production                    # production | development
PORT=5000                              # Server port
BASE_URL=https://api.printyx.com       # Full API URL (with https://)
CLIENT_URL=https://app.printyx.com     # Frontend URL

# Session Security (REQUIRED)
SESSION_SECRET=<generate-with-openssl-rand-base64-32>
```

**Verification Steps:**
- [ ] DATABASE_URL connects successfully (test with: `psql $DATABASE_URL`)
- [ ] SESSION_SECRET is random and secure (32+ characters)
- [ ] BASE_URL and CLIENT_URL match your domains
- [ ] NODE_ENV set to `production` for production deployments

---

### 🔐 Authentication & OAuth

#### Option 1: Replit Auth (if hosted on Replit)
```bash
REPL_ID=your-repl-id
REPL_OWNER=your-replit-username
```
- [ ] Replit Auth configured in Replit Dashboard
- [ ] OAuth redirect URLs whitelisted

#### Option 2: Custom Auth
- [ ] Implement custom auth strategy (see server/auth-routes.ts)
- [ ] Configure email verification flow

**Verification:**
- [ ] Can create new user account
- [ ] Can log in successfully
- [ ] Session persists across requests
- [ ] Logout works correctly

---

### 💳 Payment Processing (REQUIRED for billing features)

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_live_... or sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_live_... or pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Setup Steps:**
1. [ ] Create Stripe account at https://dashboard.stripe.com
2. [ ] Get API keys from Dashboard → Developers → API Keys
3. [ ] Create webhook endpoint in Stripe:
   - URL: `https://api.printyx.com/api/billing/webhook`
   - Events: `invoice.*, payment_intent.*, customer.*`
4. [ ] Copy webhook signing secret
5. [ ] Test in Stripe test mode first
6. [ ] Switch to live keys for production

**Verification:**
- [ ] Can add payment method
- [ ] Can process test payment
- [ ] Webhooks received and processed
- [ ] Invoice generation works

---

### 📧 Email Service (REQUIRED for notifications)

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com                # Or your email provider
SMTP_PORT=587                           # Usually 587 for TLS
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@printyx.com           # Sender email
```

**Common Providers:**

**Gmail:**
- [ ] Enable 2FA on Google account
- [ ] Create App Password at myaccount.google.com/apppasswords
- [ ] Use App Password for SMTP_PASS

**SendGrid:**
- [ ] Create SendGrid account
- [ ] Generate API key
- [ ] Use: SMTP_HOST=smtp.sendgrid.net, SMTP_USER=apikey, SMTP_PASS=<your-key>

**AWS SES:**
- [ ] Verify domain in SES
- [ ] Create SMTP credentials
- [ ] Move out of sandbox mode

**Verification:**
- [ ] Send test email: `POST /api/test/email`
- [ ] Verify delivery (check spam folder)
- [ ] Test password reset email
- [ ] Test welcome email

---

### 🗄️ File Storage (Optional)

#### Option 1: Local Storage (Development)
```bash
STORAGE_PROVIDER=local
STORAGE_PATH=./uploads
```
- [ ] Create uploads directory: `mkdir -p uploads`
- [ ] Set permissions: `chmod 755 uploads`

#### Option 2: Google Cloud Storage (Production)
```bash
STORAGE_PROVIDER=gcs
GCS_PROJECT_ID=your-project-id
GCS_BUCKET=printyx-uploads
GCS_KEYFILE=/path/to/service-account.json
```
- [ ] Create GCS bucket
- [ ] Create service account with Storage Admin role
- [ ] Download JSON key file
- [ ] Configure CORS on bucket

#### Option 3: AWS S3
```bash
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
AWS_BUCKET=printyx-uploads
```
- [ ] Create S3 bucket
- [ ] Create IAM user with S3 permissions
- [ ] Configure bucket policy

**Verification:**
- [ ] Upload test file
- [ ] Retrieve file via URL
- [ ] Delete file

---

### 📅 Calendar Integration (Optional)

#### Google Calendar
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://api.printyx.com/api/integrations/google-calendar/callback
```

**Setup:**
1. [ ] Create project in Google Cloud Console
2. [ ] Enable Google Calendar API
3. [ ] Create OAuth 2.0 credentials (Web application)
4. [ ] Add authorized redirect URI
5. [ ] Copy client ID and secret

#### Microsoft Calendar
```bash
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_REDIRECT_URI=https://api.printyx.com/api/integrations/microsoft-calendar/callback
```

**Setup:**
1. [ ] Register app in Azure Portal
2. [ ] Add Microsoft Graph permissions (Calendars.ReadWrite)
3. [ ] Add redirect URI
4. [ ] Create client secret
5. [ ] Copy application ID and secret

**Verification:**
- [ ] Connect calendar account
- [ ] Create test event
- [ ] Sync events
- [ ] Disconnect account

---

### 🔌 Third-Party Integrations (Optional)

#### Salesforce
```bash
SALESFORCE_CLIENT_ID=your-connected-app-id
SALESFORCE_CLIENT_SECRET=your-connected-app-secret
SALESFORCE_REDIRECT_URI=https://api.printyx.com/api/integrations/salesforce/callback
```
- [ ] Create Salesforce Connected App
- [ ] Configure OAuth scopes
- [ ] Enable API access

#### QuickBooks
```bash
QUICKBOOKS_CLIENT_ID=your-app-id
QUICKBOOKS_CLIENT_SECRET=your-app-secret
QUICKBOOKS_REDIRECT_URI=https://api.printyx.com/api/integrations/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox or production
```
- [ ] Create app in QuickBooks Developer Portal
- [ ] Set redirect URI
- [ ] Test in sandbox first

#### Note: Apollo.io and ZoomInfo
These are configured **per-tenant** via the Integration Hub UI, not via environment variables.

---

### 🎨 SEO & Marketing (Optional)

```bash
# Google PageSpeed Insights (FREE)
PAGESPEED_INSIGHTS_API_KEY=your-api-key

# Google Search Console (FREE)
GOOGLE_SEO_CLIENT_ID=your-client-id
GOOGLE_SEO_CLIENT_SECRET=your-client-secret
GOOGLE_SEO_REDIRECT_URI=https://api.printyx.com/api/seo/gsc-oauth/callback

# Backlink Tracking (Choose one - PAID)
AHREFS_API_KEY=your-ahrefs-key
# OR
MOZ_ACCESS_ID=your-moz-id
MOZ_SECRET_KEY=your-moz-secret

# SERP Tracking (Choose one - PAID)
SERPAPI_KEY=your-serpapi-key
# OR
DATAFORSEO_LOGIN=your-login
DATAFORSEO_PASSWORD=your-password
```

---

### 🤖 AI Services (Optional)

```bash
# Claude AI (Recommended)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI/GPT
OPENAI_API_KEY=sk-...
```

**Setup:**
- [ ] Create Anthropic account at console.anthropic.com
- [ ] Generate API key
- [ ] Set usage limits/alerts
- [ ] Test API connection

---

### 🔔 Webhooks & Background Jobs

```bash
WEBHOOK_BASE_URL=https://api.printyx.com/api/webhooks
INTEGRATION_SYNC_INTERVAL=300000  # 5 minutes in milliseconds
```

---

## Application Deployment

### Build & Install

```bash
# 1. Clone repository
git clone <repository-url>
cd Printyx

# 2. Install dependencies
npm install

# 3. Build frontend
npm run build

# 4. Run database migrations
npm run db:push
npm run db:push:forecast

# 5. Verify TypeScript compilation
npm run check
```

**Checklist:**
- [ ] All npm packages installed successfully
- [ ] Frontend build completed without errors
- [ ] Main database schema created
- [ ] Forecasting database schema created
- [ ] No TypeScript errors

---

### First-Time Startup

```bash
# Start production server
npm start

# Or with PM2 (recommended)
npm install -g pm2
pm2 start npm --name "printyx" -- start
pm2 save
pm2 startup
```

**Verification:**
- [ ] Server starts without errors
- [ ] Health check responds: `curl https://api.printyx.com/api/health`
- [ ] Frontend loads successfully
- [ ] No console errors in browser
- [ ] Can access login page

---

### Create Root Admin Account

Via psql or database tool:

```sql
-- Create first user
INSERT INTO users (email, password_hash, name, role, created_at)
VALUES (
  'admin@printyx.com',
  '<bcrypt-hash-of-password>',
  'Platform Administrator',
  'platform_admin',
  NOW()
);
```

Or use the signup flow and manually promote to platform_admin.

**Checklist:**
- [ ] Root admin account created
- [ ] Can log in as root admin
- [ ] Can access /admin routes
- [ ] Can view all tenants

---

### Create First Tenant

Via Admin UI or API:

```bash
POST /api/tenants
{
  "name": "Demo Company",
  "subdomain": "demo",
  "industry": "office_equipment",
  "company_size": "small",
  "timezone": "America/New_York"
}
```

**Checklist:**
- [ ] First tenant created
- [ ] Tenant admin user created
- [ ] Can log in as tenant user
- [ ] Tenant-isolated data verified
- [ ] Dashboard loads for tenant

---

## Production Hardening

### Security Configuration

- [ ] **HTTPS Only**
  - Force HTTPS redirect
  - HSTS headers enabled
  - SSL certificate valid

- [ ] **Security Headers** (verify in server/index.ts)
  - Content-Security-Policy configured
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy configured
  - Permissions-Policy configured

- [ ] **CORS Configuration**
  - Whitelist only necessary origins
  - Production: `*.printyx.net`
  - Verify credentials: true

- [ ] **Rate Limiting**
  - Auth routes: 5 requests/15 min
  - API routes: 100 requests/15 min
  - Configure per route as needed

- [ ] **Session Security**
  - httpOnly cookies
  - secure cookies (production)
  - sameSite: 'lax'
  - Max age: appropriate for your use case

- [ ] **Input Validation**
  - All routes use Zod schemas
  - SQL injection prevention (Drizzle ORM)
  - XSS prevention (sanitize HTML)

- [ ] **File Upload Security**
  - File type validation
  - File size limits (10MB default)
  - Virus scanning (optional)
  - Secure file serving

---

### Monitoring & Logging

- [ ] **Application Logs**
  - Log level appropriate (info for prod)
  - Structured logging format
  - Log rotation configured
  - Error log aggregation (Sentry, etc.)

- [ ] **Audit Logs**
  - Root admin actions logged to server/audit.log
  - Sensitive operations logged
  - User activity tracking enabled

- [ ] **Performance Monitoring**
  - Request duration tracking
  - Database query performance
  - Memory usage monitoring
  - CPU usage monitoring

- [ ] **Uptime Monitoring**
  - External health check ping
  - Alert on downtime
  - Status page (optional)

- [ ] **Error Tracking**
  - JavaScript errors captured
  - API errors captured
  - Alert on critical errors
  - Error grouping and deduplication

---

### Backup & Recovery

- [ ] **Database Backups**
  - Automated daily backups
  - Point-in-time recovery enabled
  - Backup retention: 30 days minimum
  - Backup verification (test restore)
  - Offsite backup storage

- [ ] **File Backups** (if using local storage)
  - Uploads directory backed up
  - Backup frequency: daily
  - Backup retention: 30 days

- [ ] **Configuration Backups**
  - Environment variables documented
  - Infrastructure as code (if applicable)
  - Disaster recovery plan documented

- [ ] **Test Recovery**
  - Restore from backup tested
  - Recovery time objective (RTO) < 4 hours
  - Recovery point objective (RPO) < 24 hours

---

### Performance Optimization

- [ ] **Database**
  - Indexes created (see docs/PERFORMANCE_OPTIMIZATION_SCHEMA_INDEXES.md)
  - Query performance analyzed
  - Connection pooling configured
  - Vacuum and analyze scheduled

- [ ] **Caching**
  - Response caching enabled (cache-middleware.ts)
  - ETags configured
  - Vary-by-tenant headers
  - Redis cache (optional, for sessions)

- [ ] **Frontend**
  - Static assets compressed (gzip)
  - Assets served from CDN (optional)
  - Browser caching headers
  - Code splitting enabled (Vite)

- [ ] **API**
  - Compression middleware enabled
  - Pagination for large datasets
  - Field selection support
  - GraphQL (optional optimization)

---

## Post-Deployment Verification

### Functional Testing

- [ ] **Authentication**
  - [ ] Signup flow works
  - [ ] Email verification works
  - [ ] Login works
  - [ ] Logout works
  - [ ] Password reset works
  - [ ] Session persists
  - [ ] Multi-factor auth works (if enabled)

- [ ] **CRM Features**
  - [ ] Create lead
  - [ ] Convert lead to customer
  - [ ] Create opportunity
  - [ ] Create quote
  - [ ] Create invoice
  - [ ] Chrome extension connects

- [ ] **Service Features**
  - [ ] Create service call
  - [ ] Assign technician
  - [ ] Mobile app connects
  - [ ] GPS tracking works

- [ ] **Billing Features**
  - [ ] Add payment method
  - [ ] Process test payment
  - [ ] Generate invoice
  - [ ] Send invoice email

- [ ] **Integrations**
  - [ ] Salesforce sync works
  - [ ] QuickBooks sync works
  - [ ] Calendar sync works

---

### Performance Testing

- [ ] Page load times < 3 seconds
- [ ] API response times < 500ms (p95)
- [ ] Database query times < 100ms (p95)
- [ ] Concurrent user test (100+ users)
- [ ] Large dataset handling tested

---

### Security Testing

- [ ] **Basic Security Audit**
  - [ ] SQL injection test (should be prevented)
  - [ ] XSS test (should be prevented)
  - [ ] CSRF protection verified
  - [ ] Authentication bypass test (should fail)
  - [ ] Authorization check (tenant isolation)

- [ ] **SSL/TLS**
  - [ ] A+ rating on SSL Labs
  - [ ] No mixed content warnings
  - [ ] Certificate expiration monitoring

- [ ] **Secrets Management**
  - [ ] No secrets in code
  - [ ] No secrets in logs
  - [ ] Environment variables secured
  - [ ] API keys rotatable

---

## Ongoing Maintenance

### Weekly Tasks
- [ ] Review error logs
- [ ] Check database backup status
- [ ] Monitor disk usage
- [ ] Review performance metrics
- [ ] Check for stuck background jobs

### Monthly Tasks
- [ ] Security updates (npm audit fix)
- [ ] Review API usage and quotas
- [ ] Database performance review
- [ ] Check SSL certificate expiration (if < 30 days)
- [ ] Review and rotate old logs

### Quarterly Tasks
- [ ] Database vacuum and analyze
- [ ] Review and optimize slow queries
- [ ] Audit user access (remove inactive)
- [ ] Test disaster recovery
- [ ] Security audit
- [ ] Review integration health

### Annual Tasks
- [ ] Rotate all API keys and secrets
- [ ] SSL certificate renewal
- [ ] Major version upgrades (Node.js, PostgreSQL)
- [ ] Security penetration test
- [ ] Disaster recovery full test
- [ ] Review and update documentation

---

## Troubleshooting

### Server Won't Start
1. Check DATABASE_URL is correct
2. Check SESSION_SECRET is set
3. Check port not already in use
4. Review startup logs
5. Verify all required env vars present

### Database Connection Errors
1. Verify PostgreSQL is running
2. Check connection string format
3. Verify user has privileges
4. Check firewall rules
5. Test connection with psql

### Email Not Sending
1. Verify SMTP credentials
2. Check SMTP port (587 for TLS)
3. Check firewall/security groups
4. Test with telnet to SMTP server
5. Review email service logs

### Payment Processing Fails
1. Verify Stripe keys are correct
2. Check webhook secret matches
3. Test in Stripe test mode first
4. Review Stripe dashboard logs
5. Check webhook URL is accessible

### Integration Issues
1. Verify OAuth credentials
2. Check redirect URIs match exactly
3. Test OAuth flow manually
4. Review API rate limits
5. Check integration service logs

---

## Support Resources

### Documentation
- Main docs: `/docs` directory
- API docs: `docs/API_DOCUMENTATION.md` (to be created)
- Architecture: `CLAUDE.md`
- Schema docs: `shared/` directory

### Logs Location
- Application logs: `logs/` directory
- Audit logs: `server/audit.log`
- Database logs: PostgreSQL data directory
- Web server logs: nginx/Apache logs

### Monitoring Dashboards
- Application: [Your monitoring URL]
- Database: [Your DB monitoring URL]
- Uptime: [Your uptime monitor URL]
- Error tracking: [Your error tracker URL]

### Emergency Contacts
- Platform admin: [Email/Phone]
- Database admin: [Email/Phone]
- DevOps on-call: [Email/Phone]
- Security contact: [Email/Phone]

---

## Completion Status

**Last Reviewed:** [Date]
**Reviewed By:** [Name]
**Environment:** [ ] Development [ ] Staging [ ] Production
**Status:** [ ] In Progress [ ] Complete [ ] Needs Review

### Sign-off

- [ ] DevOps Lead: ________________ Date: ________
- [ ] Security Lead: ________________ Date: ________
- [ ] Platform Admin: ________________ Date: ________

---

**Next Review Date:** _____________

**Notes:**
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________
