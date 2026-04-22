# Phase 1 Implementation Plan

## User Acquisition & Onboarding - Weeks 1-4

**Branch:** `claude/phase-1-implementation-011CUvaaMQFU38ejVxbpXUSm`
**Status:** In Progress
**Start Date:** November 8, 2025

---

## Overview

This plan addresses the 4 critical blockers preventing user acquisition and activation:

1. ✅ Password Recovery (Days 1-2)
2. 🔧 Self-Service Signup Flow (Days 3-7)
3. 🔧 Payment Integration & Billing Page (Days 8-12)
4. 🔧 First-Time User Onboarding (Days 13-16)
5. 🔧 Testing & Polish (Days 17-20)

---

## 1. Password Recovery Implementation

### 1.1 Database Schema

```sql
-- Add to users table or create password_resets table
CREATE TABLE password_resets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 1.2 API Endpoints

- `POST /api/auth/forgot-password` - Request reset (sends email)
- `POST /api/auth/reset-password` - Reset with token
- `GET /api/auth/verify-reset-token` - Validate token before showing form

### 1.3 UI Components

- `client/src/pages/ForgotPassword.tsx` - Email entry form
- `client/src/pages/ResetPassword.tsx` - New password form
- Update `Login.tsx` - Add "Forgot Password?" link

### 1.4 Email Templates

- Password reset email with secure link
- Password changed confirmation email

### 1.5 Security Considerations

- Token expires in 1 hour
- Token single-use only
- Rate limiting on reset requests (5 per hour per email)
- No email enumeration (always show success message)

---

## 2. Self-Service Signup Flow

### 2.1 Database Schema

```sql
-- Extend tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
  signup_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INT DEFAULT 0,
  trial_started_at TIMESTAMP,
  trial_ends_at TIMESTAMP;

-- Track signup source
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  signup_source VARCHAR(50), -- 'self_service', 'invite', 'admin_created'
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  email_verification_sent_at TIMESTAMP;
```

### 2.2 Signup Wizard Pages

1. **Company Information** (`/signup/step-1`)
   - Company name
   - Industry (dropdown)
   - Company size (dropdown: 1-10, 11-50, 51-200, 200+)
   - Website (optional)

2. **Admin User** (`/signup/step-2`)
   - First name, Last name
   - Email
   - Password (with strength indicator)
   - Confirm password
   - Phone

3. **Company Details** (`/signup/step-3`)
   - Address
   - City, State, ZIP
   - Country
   - Main phone
   - Time zone

4. **Plan Selection** (`/signup/step-4`)
   - Shows pricing plans
   - Select plan
   - Billing cycle toggle
   - Trial disclaimer: "14-day free trial, no credit card required"

5. **Terms & Verification** (`/signup/step-5`)
   - Terms checkbox
   - Privacy policy checkbox
   - EULA checkbox
   - "Create Account" button

6. **Email Verification** (`/signup/verify-email`)
   - Check inbox message
   - Resend link
   - Auto-verify if clicked from email

7. **Welcome & Next Steps** (`/signup/welcome`)
   - Success message
   - What happens next
   - "Go to Dashboard" button

### 2.3 API Endpoints

- `POST /api/auth/signup` - Create tenant + admin user
- `POST /api/auth/verify-email` - Verify email token
- `POST /api/auth/resend-verification` - Resend email
- `GET /api/auth/check-email` - Check if email exists (for validation)

### 2.4 Email Sequence

- Immediate: Email verification
- Immediate after verify: Welcome email
- Day 1: Getting started guide
- Day 7: Mid-trial check-in
- Day 11: Trial ending in 3 days
- Day 13: Trial ending tomorrow
- Day 14: Trial ended - upgrade prompt

### 2.5 Marketing Homepage Updates

- Change "Coming October 1st" to "Start Free Trial"
- Add prominent "Get Started" CTA
- Update navigation: "Sign Up" button
- Add trust badges: "No credit card required"

---

## 3. Payment Integration & Billing Page

### 3.1 Database Schema

```sql
-- Add payment methods table
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  stripe_payment_method_id VARCHAR(255),
  type VARCHAR(50), -- 'card', 'ach'
  card_brand VARCHAR(50),
  card_last4 VARCHAR(4),
  card_exp_month INT,
  card_exp_year INT,
  is_default BOOLEAN DEFAULT FALSE,
  billing_address JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add to subscriptions table
ALTER TABLE tenant_subscriptions ADD COLUMN IF NOT EXISTS
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  payment_method_id UUID REFERENCES payment_methods(id);

-- Invoice history
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  subscription_id UUID REFERENCES tenant_subscriptions(id),
  stripe_invoice_id VARCHAR(255),
  invoice_number VARCHAR(50) UNIQUE,
  amount DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2),
  status VARCHAR(50), -- 'draft', 'open', 'paid', 'void', 'uncollectible'
  due_date DATE,
  paid_at TIMESTAMP,
  invoice_pdf_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 Stripe Integration Setup

- Install: `npm install stripe @stripe/stripe-js @stripe/react-stripe-js`
- Server-side: `server/services/stripe.ts`
- Client components: `client/src/components/payment/`

### 3.3 Billing Page Components (`/settings/billing`)

**Sections:**

1. **Payment Methods**
   - Current card (last 4 digits, expiry)
   - "Update Payment Method" button
   - "Add Payment Method" button

2. **Billing History**
   - Table: Date, Description, Amount, Status, Invoice PDF
   - Download button per invoice
   - Date range filter

3. **Billing Information**
   - Company name
   - Billing address
   - Tax ID
   - "Edit" button

4. **Upcoming Charges**
   - Next billing date
   - Amount preview
   - Plan details

### 3.4 Payment Method Dialog

- Stripe Elements card input
- Billing address form
- "Save Payment Method" button
- Security badges (PCI compliant, SSL)

### 3.5 API Endpoints

- `POST /api/billing/payment-methods` - Add payment method
- `PUT /api/billing/payment-methods/:id` - Update payment method
- `DELETE /api/billing/payment-methods/:id` - Remove payment method
- `GET /api/billing/invoices` - List invoices
- `GET /api/billing/invoices/:id/pdf` - Download PDF
- `POST /api/billing/update-billing-info` - Update address/tax ID

### 3.6 Stripe Webhooks

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `payment_method.attached`
- `payment_method.detached`

---

## 4. First-Time User Onboarding

### 4.1 Database Schema

```sql
-- Onboarding progress tracking
CREATE TABLE user_onboarding (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  onboarding_type VARCHAR(50), -- 'tenant_admin', 'sales_rep', 'service_tech', etc.
  completed_steps JSONB DEFAULT '[]', -- ['welcome', 'company_profile', 'invite_team', ...]
  current_step VARCHAR(50),
  completed BOOLEAN DEFAULT FALSE,
  skipped BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Quick start checklist
CREATE TABLE quick_start_checklist (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  items JSONB, -- [{ id, label, completed, route }]
  progress_percentage INT DEFAULT 0,
  dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4.2 Onboarding Wizard Flow

**Welcome Modal** (shows on first login after email verification)

```
┌──────────────────────────────────────────────┐
│  🎉 Welcome to Printyx, [First Name]!       │
│                                              │
│  Let's set up your workspace in 5 minutes.  │
│                                              │
│  You'll learn how to:                        │
│  • Set up your company profile               │
│  • Invite your team                          │
│  • Configure basic settings                  │
│  • Discover key features                     │
│                                              │
│  [Skip for now] [Let's Get Started →]       │
└──────────────────────────────────────────────┘
```

**Step 1: Company Profile**

- Upload logo
- Add locations (at least one)
- Set business hours
- Configure currency/locale

**Step 2: Invite Team**

- Email + Role assignment
- Send invites (skippable)
- Pre-filled roles: Sales Manager, Service Manager, Admin

**Step 3: Basic Configuration**

- Customer number format: [PREFIX]-[NUMBER]
- Service ticket prefix
- Default tax rate
- (All have smart defaults)

**Step 4: Quick Tour**

- Role-based highlights (5 features)
- Interactive tooltips
- "Learn More" links

**Step 5: Quick Start Checklist**

```
Your Quick Start Guide:
☐ Add your first customer
☐ Create a lead
☐ Set up a product
☐ Schedule a service
☐ Configure billing

[Minimize] [Take me to Dashboard]
```

### 4.3 Onboarding Components

- `client/src/components/onboarding/WelcomeModal.tsx`
- `client/src/components/onboarding/OnboardingWizard.tsx`
- `client/src/components/onboarding/QuickStartWidget.tsx`
- `client/src/components/onboarding/FeatureTour.tsx`

### 4.4 API Endpoints

- `GET /api/onboarding/status` - Get user onboarding state
- `POST /api/onboarding/complete-step` - Mark step completed
- `POST /api/onboarding/skip` - Skip onboarding
- `GET /api/onboarding/checklist` - Get quick start checklist
- `POST /api/onboarding/checklist/complete-item` - Mark item done

### 4.5 Quick Start Checklist Widget

**Persistent Dashboard Widget:**

- Collapsible/expandable
- Shows progress bar
- Each item links to relevant page
- Auto-checks when action completed
- Dismissible (with confirmation)

### 4.6 Role-Based Onboarding

Different flows based on user role:

**Tenant Admin:**

- Full setup wizard
- Focus on configuration & team setup

**Sales Rep (invited user):**

- Welcome message
- CRM tour (leads, deals, quotes)
- Quick start: Add first lead

**Service Technician:**

- Welcome message
- Service hub tour
- Mobile app download prompt
- Quick start: View assigned tickets

**Billing Manager:**

- Welcome message
- Billing tour
- Quick start: Review AR

---

## 5. Testing & Validation

### 5.1 Test Scenarios

**Password Recovery:**

- [ ] Request reset for existing email
- [ ] Request reset for non-existent email (no error disclosure)
- [ ] Token expiry after 1 hour
- [ ] Token single-use validation
- [ ] Rate limiting (5 requests/hour)
- [ ] Email delivery
- [ ] Password reset success

**Signup Flow:**

- [ ] Complete full wizard
- [ ] Email verification
- [ ] Duplicate email detection
- [ ] Password strength validation
- [ ] Terms acceptance required
- [ ] Trial activation
- [ ] Welcome email delivery
- [ ] First login after signup

**Billing Page:**

- [ ] Add payment method
- [ ] Update payment method
- [ ] View invoice history
- [ ] Download invoice PDF
- [ ] Update billing address

**Payment Integration:**

- [ ] Stripe test card acceptance
- [ ] Card validation
- [ ] 3D Secure handling
- [ ] Failed payment handling
- [ ] Webhook processing

**User Onboarding:**

- [ ] Welcome modal shows on first login
- [ ] Each wizard step saves progress
- [ ] Skip functionality
- [ ] Quick start checklist updates
- [ ] Role-based flows work correctly

### 5.2 Edge Cases

- Signup interrupted mid-flow (resume)
- Email verification link expires
- Multiple browser tabs during signup
- Payment method declined
- Stripe API errors
- Network failures during critical operations

### 5.3 Performance

- Signup wizard loads in <1 second
- Payment method save <2 seconds
- Email delivery <30 seconds
- Dashboard first load <2 seconds

---

## 6. Implementation Timeline

### Week 1: Foundation

- **Day 1-2:** Password recovery (backend + frontend + emails)
- **Day 3-5:** Signup wizard pages (UI components)
- **Day 6-7:** Signup API endpoints + email verification

### Week 2: Payment & Billing

- **Day 8-9:** Stripe integration setup
- **Day 10-11:** Billing page UI components
- **Day 11-12:** Payment method management APIs
- **Day 12:** Invoice history + webhooks

### Week 3: Onboarding

- **Day 13-14:** Onboarding wizard components
- **Day 15:** Quick start checklist widget
- **Day 16:** Role-based onboarding logic

### Week 4: Testing & Launch

- **Day 17-18:** End-to-end testing
- **Day 19:** Bug fixes + polish
- **Day 20:** Documentation + launch

---

## 7. Launch Checklist

### Pre-Launch

- [ ] All test scenarios pass
- [ ] Stripe webhooks configured in production
- [ ] Email templates tested
- [ ] Error monitoring enabled (Sentry/etc)
- [ ] Database migrations run
- [ ] Backup created

### Launch

- [ ] Update marketing homepage
- [ ] Enable signup flow
- [ ] Monitor error logs
- [ ] Track signup funnel metrics
- [ ] Send announcement (if applicable)

### Post-Launch (Week 1)

- [ ] Monitor signup completion rate
- [ ] Check email delivery rates
- [ ] Review payment success rate
- [ ] Gather user feedback
- [ ] Fix critical issues immediately

---

## 8. Success Metrics

Track these KPIs weekly:

| Metric                   | Target        | Current |
| ------------------------ | ------------- | ------- |
| Signup starts            | 50/week       | 0       |
| Signup completions       | 40/week (80%) | 0       |
| Email verification rate  | 90%           | -       |
| Payment method added     | 50% in trial  | 0       |
| Onboarding completion    | 70%           | 0       |
| Trial-to-paid conversion | 25% → 40%     | -       |
| Time to first value      | <15 min       | -       |

---

## 9. Risk Mitigation

| Risk                       | Probability | Impact | Mitigation                                 |
| -------------------------- | ----------- | ------ | ------------------------------------------ |
| Stripe integration issues  | Medium      | High   | Thorough testing, sandbox first            |
| Email deliverability       | Medium      | High   | Use SendGrid/Mailgun, monitor bounce rates |
| Signup fraud               | Low         | Medium | Add reCAPTCHA, email verification          |
| Database performance       | Low         | Medium | Index optimization, connection pooling     |
| User abandonment in wizard | High        | High   | Save progress, allow resume                |

---

## 10. Rollback Plan

If critical issues arise:

1. **Password Recovery:** Can be disabled via feature flag, revert to manual reset
2. **Signup Flow:** Hide "Sign Up" button, show waitlist form
3. **Billing Page:** Show "Coming Soon" message
4. **Onboarding:** Skip wizard, show simple dashboard

All features will have feature flags for quick disable.

---

## Next Steps

1. Review this plan
2. Set up feature branch
3. Start with password recovery (lowest risk)
4. Daily commits and progress updates
5. Launch one feature at a time (can be phased)

**Estimated LOC:** ~3,000-4,000 new lines
**Estimated Files:** ~30 new files + 10 modified
**Complexity:** Medium-High

Let's build! 🚀
