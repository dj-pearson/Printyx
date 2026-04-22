# Authentication Improvement Plan

**Date:** January 7, 2026  
**Project:** Printyx  
**Status:** In Progress

---

## Executive Summary

This document outlines improvements to Printyx's authentication system to align with best practices from our self-hosted Supabase deployment. We've migrated from session-based auth to Supabase GoTrue (JWT), but several opportunities remain to enhance security, user experience, and maintainability.

---

## Current State Analysis

### ✅ Already Implemented (Good!)

1. **Supabase Client Setup**
   - File: `client/src/lib/supabase.ts`
   - ✅ PKCE flow configured
   - ✅ Auto-refresh tokens
   - ✅ Persistent sessions in localStorage
   - ✅ Custom fetch for CORS handling
   - ✅ Proper storage key (`printyx-auth`)

2. **Backend JWT Middleware**
   - File: `server/middleware/supabase-auth.ts`
   - ✅ JWT verification with jose library
   - ✅ Token extraction from Authorization header
   - ✅ User context enrichment from database
   - ✅ Role and tenant resolution
   - ✅ Platform admin detection

3. **Password Security**
   - Files: `client/src/pages/Signup.tsx`, `server/auth-routes.ts`
   - ✅ 12+ character minimum
   - ✅ Complexity requirements (uppercase, lowercase, number, special char)
   - ✅ Zod validation on frontend and backend

4. **OAuth Support**
   - File: `client/src/pages/Login.tsx`
   - ✅ Google OAuth
   - ✅ Apple OAuth
   - ✅ Proper redirect handling

5. **Rate Limiting & Security**
   - File: `server/auth-routes.ts`
   - ✅ Login rate limiting (10 attempts/15 min)
   - ✅ Password reset rate limiting (5 attempts/hour)
   - ✅ Signup rate limiting (3 attempts/hour)
   - ✅ Account lockout after 5 failed attempts (30 min)
   - ✅ Session regeneration on login

6. **Auth Callback Handling**
   - File: `client/src/pages/AuthCallback.tsx`
   - ✅ Handles OAuth callbacks
   - ✅ Email verification links
   - ✅ Password recovery links
   - ✅ PKCE code exchange
   - ✅ Error handling with user-friendly messages

---

## ⚠️ Areas for Improvement

### 1. **Email Verification Flow** (Priority: High)

**Current Implementation:**

- Custom token-based verification (`server/auth-routes.ts:479-485`)
- Token stored in `email_verifications` table
- 24-hour expiration
- Link sent via email

**Best Practice (from AUTH_SETUP_DOCUMENTATION.md):**

- Use Supabase OTP (One-Time Password)
- 6-digit code sent via email
- Shorter expiration (10 minutes)
- Resend capability with cooldown
- Better UX (user stays on page, enters code)

**Recommended Changes:**

```typescript
// Instead of custom verification token:
await db.insert(emailVerifications).values({...});

// Use Supabase OTP:
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
    data: metadata, // User metadata
  }
});
```

**Implementation Files to Update:**

- `server/auth-routes.ts` - Remove custom verification logic
- `client/src/pages/Signup.tsx` - Add OTP verification UI
- Create `client/src/components/auth/OTPVerification.tsx` - New component

---

### 2. **Signup Flow Architecture** (Priority: High)

**Current Implementation:**

- Direct database insertion (`server/auth-routes.ts:416-519`)
- Creates tenant first, then user
- Custom password hashing with bcrypt
- Custom email verification system

**Best Practice:**

- Use `supabase.auth.signUp()` for user creation
- Supabase handles password hashing
- Supabase handles email verification
- Use database triggers or webhooks for tenant creation
- Store tenant metadata in `auth.users.app_metadata`

**Recommended Architecture:**

```typescript
// Frontend (client/src/pages/Signup.tsx)
const { data, error } = await supabase.auth.signUp({
  email: data.email,
  password: data.password,
  options: {
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
    },
    // Tenant creation happens via webhook/trigger
  },
});

// Backend: Database trigger on auth.users INSERT
// Creates tenant and links user automatically
```

**Benefits:**

- Single source of truth (Supabase Auth)
- No password hash mismatch issues
- Built-in security features
- Automatic session management
- Better error handling

---

### 3. **Input Validation & Sanitization** (Priority: Medium)

**Current Implementation:**

- Zod validation for schema structure
- No explicit sanitization utilities

**Best Practice (from AUTH_SETUP_DOCUMENTATION.md):**

```typescript
// client/src/lib/validations.ts (needs to be created)
export function sanitizeHTML(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '');
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'"]/g, '')
    .trim();
}

export function sanitizeEmail(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .replace(/[^\w@.-]/g, '');
}

export function sanitizeURL(url: string): string {
  // Prevent open redirect attacks
  if (!url) return '/';
  if (!url.startsWith('/')) return '/';
  if (url.startsWith('//')) return '/';
  if (url.toLowerCase().includes('javascript:')) return '/';
  if (url.toLowerCase().includes('data:')) return '/';
  return url;
}
```

**Files to Update:**

- Create `client/src/lib/validations.ts`
- Update `client/src/pages/Login.tsx` - Use sanitization
- Update `client/src/pages/Signup.tsx` - Use sanitization
- Update `server/auth-routes.ts` - Server-side sanitization

---

### 4. **Enhanced Open Redirect Prevention** (Priority: Medium)

**Current Implementation:**

- Login page has some validation (`Login.tsx:111-149`)
- Checks for relative paths
- Blocks javascript: and data: schemes

**Best Practice:**

- Whitelist of allowed redirect paths
- Decode URL encoding to prevent bypass
- Validate against allowed patterns

**Recommended Enhancement:**

```typescript
// client/src/lib/auth-utils.ts (new file)
const ALLOWED_REDIRECT_PATHS = [
  '/dashboard',
  '/customers',
  '/deals',
  '/reports',
  '/settings',
  // Add all valid app routes
];

const BLOCKED_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/',
  '/api/',
];

export function getSafeRedirectRoute(route: string | null): string {
  if (!route) return '/';

  // Decode to prevent bypass
  let decoded: string;
  try {
    decoded = decodeURIComponent(route);
  } catch {
    return '/';
  }

  // Must be relative
  if (!decoded.startsWith('/')) return '/';
  if (decoded.startsWith('//')) return '/';

  // Block malicious schemes
  const lowercase = decoded.toLowerCase();
  if (lowercase.includes('javascript:') || lowercase.includes('data:')) {
    return '/';
  }

  // Block auth pages
  if (BLOCKED_PREFIXES.some((prefix) => decoded.startsWith(prefix))) {
    return '/';
  }

  // Validate pattern
  if (!/^[a-zA-Z0-9\-_/?#&=]+$/.test(decoded)) {
    return '/';
  }

  return decoded;
}
```

---

### 5. **OAuth Redirect Preservation** (Priority: Low)

**Current Implementation:**

- `Login.tsx:56` - Hardcoded `/auth/callback`
- Doesn't preserve intended destination

**Best Practice:**

```typescript
const signInWithOAuth = async (provider: 'google' | 'apple') => {
  // Get the original redirect intent
  const lastRoute = localStorage.getItem('printyx_last_route') || '/';
  const redirectTo = getSafeRedirectRoute(lastRoute);

  const callbackUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl,
    },
  });
};
```

**Files to Update:**

- `client/src/pages/Login.tsx` - OAuth redirect preservation
- `client/src/pages/AuthCallback.tsx` - Read redirect parameter

---

### 6. **Real-Time Password Strength Indicator** (Priority: Low)

**Current Implementation:**

- Static validation messages
- No visual feedback during typing

**Best Practice:**

```typescript
// Real-time strength calculation
const calculatePasswordStrength = (
  password: string,
): {
  score: number;
  feedback: string[];
} => {
  let score = 0;
  const feedback: string[] = [];

  if (password.length >= 12) score++;
  else feedback.push('At least 12 characters');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('One uppercase letter');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('One lowercase letter');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('One number');

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else feedback.push('One special character');

  return { score, feedback };
};
```

**Implementation:**

- Create `client/src/components/auth/PasswordStrengthIndicator.tsx`
- Update `client/src/pages/Signup.tsx` to use component
- Visual progress bar with color coding (red → yellow → green)

---

### 7. **Supabase Email Templates** (Priority: Medium)

**Current Implementation:**

- Custom email templates in `server/services/email-templates.ts`
- Sent via custom email service

**Best Practice:**

- Configure Supabase email templates
- Use Supabase Auth's built-in email system
- Customize templates in Supabase dashboard

**Configuration Location:**

- Supabase Dashboard → Authentication → Email Templates
- Or: `supabase/config.toml` for self-hosted

**Templates to Configure:**

1. **Confirmation** - Email verification
2. **Magic Link** - Passwordless login
3. **Recovery** - Password reset
4. **Email Change** - Email change confirmation
5. **Invite** - Team member invitation

**Example Template Variables:**

```
{{ .ConfirmationURL }}
{{ .Token }}
{{ .TokenHash }}
{{ .SiteURL }}
{{ .Email }}
```

---

## Implementation Priority

### Phase 1: Critical Security (Week 1)

1. ✅ **Input sanitization utilities** - Prevent XSS and injection
2. ✅ **Enhanced open redirect prevention** - Security vulnerability
3. ✅ **Supabase signup integration** - Use auth provider properly

### Phase 2: User Experience (Week 2)

4. ⏳ **OTP email verification** - Better UX than link-based
5. ⏳ **Password strength indicator** - Real-time feedback
6. ⏳ **OAuth redirect preservation** - Seamless flow

### Phase 3: Infrastructure (Week 3)

7. ⏳ **Supabase email templates** - Leverage built-in system
8. ⏳ **Database triggers for tenant creation** - Automated provisioning
9. ⏳ **Audit logging enhancements** - Track all auth events

---

## Migration Considerations

### Breaking Changes

- Email verification flow changes (affects in-progress signups)
- Signup endpoint response format changes

### Migration Steps

1. ✅ Add new utilities and components (non-breaking)
2. ✅ Update signup flow with backward compatibility
3. ⏳ Test new flow in development
4. ⏳ Deploy to staging for testing
5. ⏳ Gradual rollout to production
6. ⏳ Monitor error rates and user feedback
7. ⏳ Remove legacy code after 30 days

### Rollback Plan

- Keep legacy endpoints active during migration
- Feature flag for new vs old signup flow
- Database rollback scripts if needed

---

## Testing Requirements

### Unit Tests

- [ ] Sanitization functions
- [ ] Password strength calculation
- [ ] Redirect validation
- [ ] Token generation and validation

### Integration Tests

- [ ] Full signup flow (email/password)
- [ ] Full signup flow (OAuth)
- [ ] Email verification (OTP)
- [ ] Password reset flow
- [ ] Account lockout behavior
- [ ] Session persistence across page reload

### E2E Tests (Playwright)

- [ ] User can sign up with email/password
- [ ] User receives and enters OTP
- [ ] User can sign in with Google
- [ ] User can sign in with Apple
- [ ] User can reset password
- [ ] Protected routes redirect to login
- [ ] After login, redirects to intended page

---

## Monitoring & Metrics

### Key Metrics to Track

1. **Signup Success Rate** - % of signups that complete
2. **Email Verification Rate** - % of users who verify within 24h
3. **OAuth vs Email Signup** - Distribution of auth methods
4. **Password Reset Completion** - % of resets completed
5. **Account Lockout Frequency** - Potential security issues
6. **Session Duration** - User engagement
7. **Token Refresh Failures** - Infrastructure issues

### Alerting Thresholds

- Signup success rate drops below 80%
- Email verification rate drops below 60%
- Account lockouts spike (>10 per hour)
- Token refresh failures (>1% of requests)

---

## Documentation Updates

### Files to Create/Update

1. ✅ `AUTH_IMPROVEMENT_PLAN.md` (this file)
2. ⏳ `AUTH_MIGRATION_GUIDE.md` - Step-by-step migration
3. ⏳ `AUTH_TESTING_GUIDE.md` - QA checklist
4. ⏳ Update `CLAUDE.md` - Authentication section
5. ⏳ Update `README.md` - Setup instructions

---

## References

- **EatPal Auth Documentation**: `AUTH_SETUP_DOCUMENTATION.md`
- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth
- **Supabase Self-Hosted**: https://supabase.com/docs/guides/self-hosting
- **OWASP Auth Guidelines**: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

---

## Next Steps

1. ✅ Review this plan with team
2. ⏳ Start Phase 1 implementation (input sanitization)
3. ⏳ Create feature branch: `feature/auth-improvements`
4. ⏳ Implement changes with tests
5. ⏳ Code review and QA
6. ⏳ Deploy to staging
7. ⏳ Production rollout with monitoring

---

**Last Updated:** January 7, 2026  
**Status:** Draft - Awaiting Review
