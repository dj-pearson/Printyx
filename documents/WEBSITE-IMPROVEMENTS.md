# Website Improvement Plan - Quick Reference

**Date:** November 13, 2025

## 🔴 CRITICAL: Must Fix Before Launch (Weeks 1-4)

### 1. Self-Service Signup Flow

**Problem:** Marketing site has CTAs but users can't sign up
**Files to create:**

- `client/src/pages/Signup.tsx`
- Backend: `POST /api/auth/signup`

**Key fields:** Company name, admin email/password, plan selection, terms acceptance

### 2. Payment Collection (/settings/billing)

**Problem:** Page returns 404, can't collect payments
**Files to create:**

- `client/src/pages/settings/Billing.tsx`
- Backend: Stripe integration endpoints

**Features:** Add/update payment method, view invoices, billing history

### 3. User Onboarding Wizard

**Problem:** Users land on 160+ pages with no guidance
**Solution:** Multi-step onboarding after first login

- Welcome screen → Company profile → Invite team → Setup checklist → Feature tour

### 4. Password Recovery

**Problem:** No "Forgot Password" flow
**Pages:** `/forgot-password`, `/reset-password/:token`

### 5. Trial Management

**Problem:** No confirmation, no reminders
**Solution:** Email sequence (welcome, day 3, day 7, day 11, day 13, day 14)

---

## 🟡 HIGH: Performance & Mobile (Weeks 5-6)

### Performance Optimization

- Code splitting (route-based lazy loading)
- Image optimization (WebP, lazy loading)
- Bundle size reduction (< 500KB gzipped)
- Core Web Vitals monitoring
- Target: PageSpeed score > 90

### Mobile Refinements

- Convert tables to cards on mobile
- Minimum 44px touch targets
- Fix horizontal scrolling
- Test on iPhone SE, Galaxy S21, iPad

---

## 🟡 HIGH: SEO System Completion (Weeks 7-8)

### Complete Setup

```bash
npm run db:push  # Apply migrations
```

Add to .env:

```
PAGESPEED_INSIGHTS_API_KEY=your_key
```

### Content Strategy

**Create landing pages:**

- /solutions/copier-dealer-crm
- /solutions/service-dispatch
- /solutions/meter-billing
- /alternatives/e-automate
- /pricing (optimize)

**Blog calendar:** 4 posts/month (problem-awareness → solution-awareness → product content)

---

## 🟠 MEDIUM: UX Polish (Weeks 9-12)

### Consolidate Duplicate Pages

1. Proposal tools → `/proposals` (single page with tabs)
2. Billing pages → `/billing-hub` (tabs: meter, manual, rules, history)
3. Mobile service → `/field-service` (responsive)
4. PM → `/preventive-maintenance` (tabs: schedule, automation, history)

### Add Missing Elements

- Confirmation modals for critical actions
- Empty states with helpful CTAs
- Progress indicators for multi-step flows
- Global search (Cmd+K)
- In-app notification center

---

## 🟢 MEDIUM: Security (Weeks 13-14)

### Essential Security

- Rate limiting (express-rate-limit)
- CSRF protection
- Input validation (Zod schemas on all endpoints)
- Security headers (Helmet.js)
- SQL injection prevention audit

### Compliance

- GDPR: Data export, right to be forgotten
- Audit logging for sensitive actions
- SOC 2 readiness documentation

---

## 📊 Ongoing: Analytics

### Setup PostHog

```bash
npm install posthog-js
```

### Track Key Metrics

- Signup conversion rate
- Trial-to-paid conversion
- Onboarding completion
- Feature adoption
- Churn rate

---

## Success Metrics

**Acquisition:**

- Signup conversion: 15%+
- Email verification: 80%+
- Onboarding completion: 70%+

**Conversion:**

- Trial-to-paid: 25%+ (industry avg: 15-20%)
- Payment collection during signup: 60%+

**Performance:**

- LCP < 2.5s, FID < 100ms, CLS < 0.1
- PageSpeed score > 90

**SEO:**

- 1,000+ monthly organic visits by month 3
- Top 10 for 5+ target keywords

---

## Quick Wins (Do First!)

1. ✅ Fix "Coming October 1st" on homepage → "Start Free Trial"
2. ✅ Add "Forgot Password" link on login page
3. ✅ Create 404 page with helpful navigation
4. ✅ Add loading states to all forms
5. ✅ Implement toast notifications consistently

---

## Implementation Order

**Week 1-2:** Signup + Email verification + Password recovery
**Week 3:** Onboarding wizard + Trial management
**Week 4:** Payment collection + Stripe integration
**Week 5:** Performance optimization
**Week 6:** Mobile refinements
**Week 7:** SEO system setup + First audit
**Week 8:** Landing pages + Blog posts
**Week 9-10:** Consolidate duplicates + UX polish
**Week 11-12:** Search + Notifications + Filters
**Week 13-14:** Security hardening + Compliance

---

## Files Roadmap

### Create New Files

```
client/src/pages/Signup.tsx
client/src/pages/ForgotPassword.tsx
client/src/pages/ResetPassword.tsx
client/src/pages/Welcome.tsx (post-signup)
client/src/pages/onboarding/CompanySetup.tsx
client/src/pages/onboarding/InviteTeam.tsx
client/src/pages/onboarding/Checklist.tsx
client/src/pages/onboarding/FeatureTour.tsx
client/src/pages/settings/Billing.tsx
client/src/components/OnboardingWidget.tsx
server/routes-auth.ts (expand with signup/recovery)
server/services/email-service.ts
server/services/stripe-service.ts
```

### Update Existing Files

```
client/src/pages/marketing/Homepage.tsx (enable CTAs)
client/src/pages/Login.tsx (add forgot password link)
client/src/pages/settings/Subscription.tsx (link to billing)
server/index.ts (add Helmet, rate limiting)
vite.config.ts (performance optimizations)
```

---

**Priority:** Focus on CRITICAL items first. Without signup/payment/onboarding, nothing else matters.
