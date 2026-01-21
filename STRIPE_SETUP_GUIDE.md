# Stripe Payment Integration Setup Guide

This guide will help you set up Stripe payment processing for Printyx.

## 🎯 What's Included

The Stripe integration provides:

- ✅ Secure credit/debit card collection via Stripe Elements
- ✅ Payment method management (add, view, delete)
- ✅ Customer creation and management
- ✅ Setup intents for saving cards without charging
- ✅ Webhook handlers for payment events
- ✅ Invoice history and billing management
- ✅ Ready for subscription billing

---

## 📋 Prerequisites

1. **Stripe Account** - Sign up at [stripe.com](https://stripe.com)
2. **Node.js** - v18 or higher
3. **Environment Variables** - Access to `.env` file

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Get Your Stripe API Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Developers** → **API keys**
3. Copy your keys:
   - **Publishable key** (starts with `pk_test_` for test mode)
   - **Secret key** (starts with `sk_test_` for test mode)

> ⚠️ **Important**: Use **test mode** keys during development. Switch to **live mode** keys only when ready for production.

### Step 2: Configure Environment Variables

Add these to your `.env` file:

```bash
# Stripe Payment Integration
STRIPE_SECRET_KEY=sk_test_51ABC...xyz
STRIPE_PUBLISHABLE_KEY=pk_test_51ABC...xyz
STRIPE_WEBHOOK_SECRET=whsec_ABC...xyz
```

### Step 3: Install Dependencies

The Stripe packages are already installed. If you need to reinstall:

```bash
npm install stripe @stripe/stripe-js @stripe/react-stripe-js
```

### Step 4: Restart Your Server

```bash
npm run dev
```

That's it! Stripe is now configured. 🎉

---

## 🧪 Testing the Integration

### Test Credit Cards

Stripe provides test card numbers that simulate different scenarios:

| Card Number           | Brand      | Scenario                            |
| --------------------- | ---------- | ----------------------------------- |
| `4242 4242 4242 4242` | Visa       | Success                             |
| `4000 0000 0000 9995` | Visa       | Decline (insufficient funds)        |
| `4000 0025 0000 3155` | Visa       | Requires authentication (3D Secure) |
| `5555 5555 5555 4444` | Mastercard | Success                             |

- **Expiry Date**: Any future date (e.g., 12/34)
- **CVC**: Any 3 digits (e.g., 123)
- **ZIP**: Any 5 digits (e.g., 12345)

### Step-by-Step Testing

1. **Start the app** and log in as a tenant user
2. **Navigate to** `/settings/billing`
3. **Click** "Add Payment Method"
4. **Enter** a test card: `4242 4242 4242 4242`
5. **Fill in** expiry (12/34), CVC (123), ZIP (12345)
6. **Click** "Add Payment Method"
7. **Verify** the card appears in the payment methods list

### Expected Behavior

✅ Card should be added successfully
✅ Toast notification: "Payment method added"
✅ Card shows as: "VISA •••• 4242"
✅ Card is marked as "Default" (if it's the first one)

---

## 🔧 Advanced Configuration

### Setting Up Webhooks (Required for Production)

Webhooks allow Stripe to notify your app about payment events (successful payments, failed charges, etc.)

#### Development (Local Testing)

1. **Install Stripe CLI**:

   ```bash
   brew install stripe/stripe-cli/stripe
   # or download from: https://stripe.com/docs/stripe-cli
   ```

2. **Login**:

   ```bash
   stripe login
   ```

3. **Forward webhooks to local server**:

   ```bash
   stripe listen --forward-to localhost:5000/api/billing/stripe/webhooks
   ```

4. **Copy the webhook secret** (starts with `whsec_`) and add to `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_ABC...xyz
   ```

#### Production

1. **Go to** [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. **Click** "Add endpoint"
3. **Enter** your production URL: `https://yourdomain.com/api/billing/stripe/webhooks`
4. **Select events** to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `payment_method.attached`
   - `payment_method.detached`
5. **Copy the signing secret** and add to production `.env`

---

## 🛡️ Security Best Practices

### ✅ Do's

- ✅ Use test mode keys during development
- ✅ Store API keys in environment variables (never commit to Git)
- ✅ Verify webhook signatures (already implemented)
- ✅ Use HTTPS in production
- ✅ Regularly rotate API keys

### ❌ Don'ts

- ❌ Never expose secret keys in client-side code
- ❌ Never commit `.env` file to version control
- ❌ Don't skip webhook signature verification
- ❌ Don't use live keys in development
- ❌ Don't log sensitive card data

---

## 📊 Monitoring & Debugging

### View Stripe Logs

1. **Dashboard**: [Stripe Logs](https://dashboard.stripe.com/logs)
2. **Filter by**: Request type, status, date
3. **Inspect**: Full request/response data

### Server Logs

The integration logs important events:

```bash
✅ Created Stripe customer cus_ABC123 for tenant ten_XYZ789
✅ Added payment method pm_1ABC... to customer cus_ABC123
✅ Subscription created for tenant ten_XYZ789
📨 Received Stripe webhook: invoice.paid
```

### Common Issues

**Issue**: "Stripe is not configured" error
**Fix**: Check that `STRIPE_SECRET_KEY` is set in `.env`

**Issue**: "Invalid API key" error
**Fix**: Verify key starts with `sk_test_` or `sk_live_` (no extra spaces)

**Issue**: Card element not appearing
**Fix**: Check browser console for Stripe.js loading errors

**Issue**: "Webhook signature verification failed"
**Fix**: Ensure `STRIPE_WEBHOOK_SECRET` matches the one from Stripe CLI or Dashboard

---

## 🏗️ Architecture Overview

### Frontend (Billing.tsx)

```
User clicks "Add Payment Method"
    ↓
Load Stripe.js with publishable key
    ↓
Render Stripe CardElement
    ↓
User enters card details
    ↓
Request setup intent from backend
    ↓
Stripe.confirmCardSetup() → Creates PaymentMethod
    ↓
Send payment method ID to backend
    ↓
Backend saves to database
    ↓
Success! Card is added
```

### Backend Flow

```
POST /api/billing/stripe/setup-intent
    ↓
Get or create Stripe customer
    ↓
Create setup intent
    ↓
Return client secret

POST /api/billing/payment-methods
    ↓
Attach payment method to customer (Stripe API)
    ↓
Save payment method to database
    ↓
Set as default if first method
    ↓
Return success
```

### Database Schema

**subscriptionPaymentMethods** table stores:

- `stripePaymentMethodId` - Stripe PM ID (pm_xxx)
- `cardBrand` - "visa", "mastercard", etc.
- `cardLast4` - Last 4 digits
- `cardExpMonth` / `cardExpYear` - Expiration
- `isDefault` - Boolean for default payment method
- `billingDetails` - JSON with address info

---

## 🚀 Going to Production

### Pre-Launch Checklist

- [ ] Switch to **live mode** API keys in production `.env`
- [ ] Set up webhook endpoint in production Stripe account
- [ ] Test with real card (in test mode first, then small live charge)
- [ ] Enable HTTPS on production domain
- [ ] Review Stripe account settings (business details, branding)
- [ ] Set up payout schedule (daily, weekly, monthly)
- [ ] Configure email notifications for failed payments
- [ ] Test subscription renewal flow
- [ ] Review fraud protection settings
- [ ] Set up Stripe Radar (fraud prevention)

### Switching to Live Mode

1. **Get live keys**:
   - Publishable: `pk_live_...`
   - Secret: `sk_live_...`

2. **Update production `.env`**:

   ```bash
   STRIPE_SECRET_KEY=sk_live_ABC...
   STRIPE_PUBLISHABLE_KEY=pk_live_ABC...
   STRIPE_WEBHOOK_SECRET=whsec_ABC... # Get from production webhook
   ```

3. **Activate Stripe account** (complete business verification)

4. **Test with small real payment** ($0.50 test transaction)

5. **Monitor production logs** closely for first 48 hours

---

## 📈 Next Steps

### Implemented Features

✅ Payment method collection (Stripe Elements)
✅ Customer creation
✅ Setup intents for card storage
✅ Payment method management (add/delete)
✅ Webhook handlers
✅ Billing address storage

### Future Enhancements

⏳ Subscription creation and management
⏳ Trial-to-paid conversion automation
⏳ Invoice PDF generation
⏳ Usage-based billing
⏳ Coupon/discount code support
⏳ Multiple currency support
⏳ Dunning management (failed payment recovery)

---

## 🆘 Support Resources

- **Stripe Documentation**: [stripe.com/docs](https://stripe.com/docs)
- **API Reference**: [stripe.com/docs/api](https://stripe.com/docs/api)
- **Testing Guide**: [stripe.com/docs/testing](https://stripe.com/docs/testing)
- **Security**: [stripe.com/docs/security](https://stripe.com/docs/security)
- **PCI Compliance**: [stripe.com/docs/security/guide](https://stripe.com/docs/security/guide)

---

## 📝 Summary

You've successfully integrated Stripe payment processing! Users can now:

1. Add credit/debit cards securely
2. Manage multiple payment methods
3. Update billing addresses
4. View billing history (when invoices exist)

**What's Working**:

- ✅ Frontend: Stripe Elements for card collection
- ✅ Backend: Stripe API integration
- ✅ Database: Payment method storage
- ✅ Security: PCI-compliant card handling
- ✅ Webhooks: Event processing ready

**Ready for**: Trial-to-paid conversion, subscription billing, invoice generation

Need help? Check the Stripe logs or review the code in:

- `server/services/stripe-service.ts` - Core Stripe logic
- `server/routes-billing.ts` - API endpoints
- `client/src/pages/Billing.tsx` - UI components
